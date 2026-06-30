import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getDailyClaim,
  insertDailyClaim,
  getRecentClaimDates,
  getPublishedWeeklyPick,
} from "../db";
import { kstDateString, getWeekId, isReleaseWindow } from "@shared/week";
import { allocateForUser } from "../allocation";
import { TRPCError } from "@trpc/server";

/** 연속 출석 일수 계산 (오늘 포함, KST 날짜 문자열 기준) */
function computeStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  let streak = 0;
  let cursor = today;
  while (set.has(cursor)) {
    streak += 1;
    const d = new Date(cursor + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

export const dailyRouter = router({
  /** 오늘 혜택 수령 상태 */
  status: protectedProcedure.query(async ({ ctx }) => {
    const today = kstDateString();
    const claim = await getDailyClaim(ctx.user.id, today);
    const dates = await getRecentClaimDates(ctx.user.id);
    const streak = claim ? computeStreak(dates, today) : 0;
    return {
      claimed: !!claim,
      claimType: claim?.claimType ?? null,
      streak,
    };
  }),

  /**
   * 오늘 무료 조합 1개 받기.
   */
  claimFreeCombo: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isReleaseWindow()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "지금은 번호 방출 시간이 아닙니다. (월~토 오후 7시까지 가능)",
      });
    }
    const today = kstDateString();
    const existing = await getDailyClaim(ctx.user.id, today);
    if (existing) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "오늘은 이미 혜택을 받았습니다.",
      });
    }
    const weekId = getWeekId();
    const pick = await getPublishedWeeklyPick(weekId);
    if (!pick || (pick.combos as number[][]).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "이번 주 분석 번호가 아직 준비되지 않았습니다.",
      });
    }
    await insertDailyClaim(ctx.user.id, today, "combo");
    const result = await allocateForUser(
      weekId,
      ctx.user.id,
      1,
      pick.combos as number[][],
      "free",
    );
    const combo = result.combos[result.combos.length - 1] ?? result.combos[0];
    return { combo };
  }),
});
