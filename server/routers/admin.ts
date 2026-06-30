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
import { poolCombosFromPicks, MASTER_POOL_TOTAL } from "@shared/lottoPool";
import { getWeekId, nextWeekId } from "@shared/week";
import { TRPCError } from "@trpc/server";

const numbersSchema = z
  .array(z.number().int().min(1).max(45))
  .min(6)
  .max(45)
  .refine((arr) => new Set(arr).size === arr.length, {
    message: "중복된 번호가 있습니다.",
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
