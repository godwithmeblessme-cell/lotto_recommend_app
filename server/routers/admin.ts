import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  upsertWeeklyPick,
  getWeeklyPick,
  setWeeklyPublished,
  listWeeklyPicks,
  adminStats,
  adminWeekAllocationByUser,
  adminListSubscriptions,
  adminSetSubscriptionStatus,
} from "../db";
import { poolCombosFromPicks, MASTER_POOL_TOTAL, comboKey } from "@shared/lottoPool";
import { getWeekId, nextWeekId } from "@shared/week";
import { TRPCError } from "@trpc/server";

const numbersSchema = z
  .array(z.number().int().min(1).max(45))
  .min(6)
  .max(45)
  .refine((arr) => new Set(arr).size === arr.length, {
    message: "중복된 번호가 있습니다.",
  });

/** 6개 번호로 이뤄진 조합 1개 (정렬 여부 무관, 서버에서 정렬) */
const comboRowSchema = z
  .array(z.number().int().min(1).max(45))
  .length(6)
  .refine((arr) => new Set(arr).size === 6, {
    message: "조합 안에 중복된 번호가 있습니다.",
  });

export const adminRouter = router({
  /** 마스터 풀 총 개수 + 이번주/다음주 weekId (운영자 참고용) */
  poolInfo: adminProcedure.query(() => ({
    masterPoolTotal: MASTER_POOL_TOTAL,
    currentWeekId: getWeekId(),
    nextWeekId: nextWeekId(),
  })),

  /**
   * 지정번호 미리보기 — 저장하지 않고 교집합 조합 수만 계산.
   */
  preview: adminProcedure
    .input(z.object({ numbers: numbersSchema }))
    .mutation(({ input }) => {
      const combos = poolCombosFromPicks(input.numbers);
      return {
        inputCount: input.numbers.length,
        poolComboCount: combos.length,
        sample: combos.slice(0, 20),
      };
    }),

  /**
   * 주간 지정번호 저장.
   * weekId 미지정 시 기본값은 "다음 주"(토요일 밤 산출 운영 흐름 기준).
   */
  saveWeekly: adminProcedure
    .input(
      z.object({
        weekId: z.string().optional(),
        numbers: numbersSchema,
        publish: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const weekId = input.weekId || nextWeekId();
      const combos = poolCombosFromPicks(input.numbers);
      if (combos.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "교집합 조합이 0개입니다. 지정번호를 더 추가하거나 조정해 주세요.",
        });
      }
      await upsertWeeklyPick({
        weekId,
        numbers: input.numbers,
        combos,
        poolComboCount: combos.length,
        published: input.publish,
        createdBy: ctx.user.id,
      });
      return { weekId, poolComboCount: combos.length, published: input.publish };
    }),

  /** 게시/게시중단 토글 */
  setPublished: adminProcedure
    .input(z.object({ weekId: z.string(), published: z.boolean() }))
    .mutation(async ({ input }) => {
      const pick = await getWeeklyPick(input.weekId);
      if (!pick) {
        throw new TRPCError({ code: "NOT_FOUND", message: "주간 데이터 없음" });
      }
      await setWeeklyPublished(input.weekId, input.published);
      return { weekId: input.weekId, published: input.published };
    }),

  /**
   * 운영자가 직접 만든 조합 목록을 통째로 업로드 (CSV에서 파싱된 결과를 받음).
   * "지정번호 → 교집합 자동계산" 방식(saveWeekly)과 달리, 조합을 그대로 신뢰하고 저장한다.
   * 같은 조합이 두 번 들어오면 에러로 막아서, 실수로 같은 줄을 중복 입력하는 걸 방지한다.
   */
  uploadWeeklyCombos: adminProcedure
    .input(
      z.object({
        weekId: z.string().optional(),
        combos: z.array(comboRowSchema).min(1).max(500_000),
        publish: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const weekId = input.weekId || nextWeekId();

      const sortedCombos = input.combos.map((c) => [...c].sort((a, b) => a - b));

      const seen = new Set<string>();
      for (const combo of sortedCombos) {
        const key = comboKey(combo);
        if (seen.has(key)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `중복된 조합이 있습니다: ${combo.join(",")}`,
          });
        }
        seen.add(key);
      }

      // numbers 컬럼은 "운영자 지정번호" 용도였지만, 직접 업로드 방식에선 의미가 없어
      // 정보용으로 "이 업로드에 등장한 모든 숫자"를 정렬해 저장해둔다 (필수 컬럼이라 비워둘 수 없음).
      const allNumbers = Array.from(
        new Set(sortedCombos.flat()),
      ).sort((a, b) => a - b);

      await upsertWeeklyPick({
        weekId,
        numbers: allNumbers,
        combos: sortedCombos,
        poolComboCount: sortedCombos.length,
        published: input.publish,
        createdBy: ctx.user.id,
      });
      return { weekId, poolComboCount: sortedCombos.length, published: input.publish };
    }),

  /** 주간 목록 (combos 는 무거우므로 메타만) */
  listWeeks: adminProcedure.query(async () => {
    const rows = await listWeeklyPicks();
    return rows.map((r) => ({
      weekId: r.weekId,
      numbers: r.numbers,
      poolComboCount: r.poolComboCount,
      published: r.published,
      createdAt: r.createdAt,
    }));
  }),

  /** 현재 주(또는 지정 주) 현황 통계 */
  stats: adminProcedure
    .input(z.object({ weekId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const weekId = input?.weekId || getWeekId();
      const stats = await adminStats(weekId);
      return { weekId, ...stats };
    }),

  /** 회원별 배분 현황 (해당 주) */
  allocationByUser: adminProcedure
    .input(z.object({ weekId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const weekId = input?.weekId || getWeekId();
      const rows = await adminWeekAllocationByUser(weekId);
      return { weekId, users: rows };
    }),

  /** 전체 구독 목록 */
  listSubscriptions: adminProcedure.query(async () => {
    return adminListSubscriptions();
  }),

  /** 구독 상태 수동 조정 */
  setSubscriptionStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["active", "expired", "cancelled"]),
      }),
    )
    .mutation(async ({ input }) => {
      await adminSetSubscriptionStatus(input.id, input.status);
      return { ok: true };
    }),
});
