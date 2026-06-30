/**
 * 로또 당첨 결과 라우터
 *
 * - result.latest       : 이번 주(또는 최근) 게시된 당첨 결과 조회 (공개)
 * - result.myMatch      : 내 배분 조합과 당첨번호 대조 (로그인 필요)
 * - admin.saveResult    : 당첨번호 저장 (관리자)
 * - admin.publishResult : 게시 토글 (관리자)
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import {
  upsertLottoResult,
  getLottoResult,
  getPublishedLottoResult,
  setLottoResultPublished,
  listLottoResults,
  getUserAllocations,
} from "../db";
import { getWeekId } from "@shared/week";
import { TRPCError } from "@trpc/server";

/** 로또 등수 계산 */
export function calcRank(
  myCombo: number[],
  winNumbers: number[],
  bonusNumber: number,
): { rank: number | null; matchCount: number; hasBonus: boolean } {
  const winSet = new Set(winNumbers);
  const matchCount = myCombo.filter((n) => winSet.has(n)).length;
  const hasBonus = myCombo.includes(bonusNumber);

  let rank: number | null = null;
  if (matchCount === 6) rank = 1;
  else if (matchCount === 5 && hasBonus) rank = 2;
  else if (matchCount === 5) rank = 3;
  else if (matchCount === 4) rank = 4;
  else if (matchCount === 3) rank = 5;
  // 2개 이하는 미당첨

  return { rank, matchCount, hasBonus };
}

/** 등수 라벨 */
export function rankLabel(rank: number | null): string {
  if (rank === null) return "미당첨";
  return `${rank}등`;
}

export const resultRouter = router({
  /**
   * 이번 주(또는 지정 주) 게시된 당첨 결과.
   * 로그인 여부 무관 — 공개 정보.
   */
  latest: publicProcedure
    .input(z.object({ weekId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const weekId = input?.weekId ?? getWeekId();
      const result = await getPublishedLottoResult(weekId);
      if (!result) return { weekId, result: null };
      return {
        weekId,
        result: {
          round: result.round,
          winNumbers: result.winNumbers as number[],
          bonusNumber: result.bonusNumber,
          publishedAt: result.publishedAt,
        },
      };
    }),

  /**
   * 내 배분 조합과 이번 주 당첨번호 대조.
   * 구독 + 무료 조합 모두 포함.
   */
  myMatch: protectedProcedure
    .input(z.object({ weekId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const weekId = input?.weekId ?? getWeekId();
      const result = await getPublishedLottoResult(weekId);
      if (!result) {
        return {
          weekId,
          hasResult: false,
          winNumbers: [] as number[],
          bonusNumber: 0,
          round: 0,
          matches: [] as ReturnType<typeof buildMatchRow>[],
          bestRank: null as number | null,
        };
      }

      const winNumbers = result.winNumbers as number[];
      const bonusNumber = result.bonusNumber;

      // 이번 주 내 모든 배분 조합 (구독 + 무료)
      const allocations = await getUserAllocations(weekId, ctx.user.id);

      const matches = allocations.map((a) =>
        buildMatchRow(a.combo as number[], winNumbers, bonusNumber, a.kind),
      );

      const bestRank =
        matches.reduce(
          (best, m) =>
            m.rank !== null ? (best === null ? m.rank : Math.min(best, m.rank)) : best,
          null as number | null,
        );

      return {
        weekId,
        hasResult: true,
        winNumbers,
        bonusNumber,
        round: result.round,
        matches,
        bestRank,
      };
    }),
});

function buildMatchRow(
  combo: number[],
  winNumbers: number[],
  bonusNumber: number,
  kind: string,
) {
  const { rank, matchCount, hasBonus } = calcRank(combo, winNumbers, bonusNumber);
  return {
    combo,
    kind,
    rank,
    matchCount,
    hasBonus,
    label: rankLabel(rank),
  };
}

/** 관리자용 당첨번호 관리 라우터 (admin 라우터에 merge) */
export const adminResultRouter = router({
  /** 당첨번호 저장 (upsert) */
  saveResult: adminProcedure
    .input(
      z.object({
        weekId: z.string().optional(),
        round: z.number().int().positive(),
        winNumbers: z
          .array(z.number().int().min(1).max(45))
          .length(6)
          .refine((arr) => new Set(arr).size === 6, { message: "중복 번호 불가" }),
        bonusNumber: z.number().int().min(1).max(45),
        publish: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const weekId = input.weekId ?? getWeekId();
      const sorted = [...input.winNumbers].sort((a, b) => a - b);
      if (sorted.includes(input.bonusNumber)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "보너스 번호는 당첨 번호와 달라야 합니다.",
        });
      }
      await upsertLottoResult({
        weekId,
        round: input.round,
        winNumbers: sorted,
        bonusNumber: input.bonusNumber,
        published: input.publish,
        publishedAt: input.publish ? Date.now() : null,
        createdBy: ctx.user.id,
      });
      return { weekId, round: input.round, published: input.publish };
    }),

  /** 게시/게시중단 토글 */
  publishResult: adminProcedure
    .input(z.object({ weekId: z.string(), published: z.boolean() }))
    .mutation(async ({ input }) => {
      const existing = await getLottoResult(input.weekId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "당첨 결과 없음" });
      }
      await setLottoResultPublished(input.weekId, input.published);
      return { weekId: input.weekId, published: input.published };
    }),

  /** 당첨 결과 목록 */
  listResults: adminProcedure.query(async () => {
    return listLottoResults(20);
  }),
});
