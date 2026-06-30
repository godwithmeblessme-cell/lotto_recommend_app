import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getActiveSubscription,
  getPublishedWeeklyPick,
} from "../db";
import { PLANS, type PlanId } from "@shared/plans";
import {
  getWeekId,
  isReleaseWindow,
  RELEASE_CLOSED_NOTICE,
  RELEASE_WINDOW_NOTICE,
} from "@shared/week";
import { allocateForUser } from "../allocation";

export const recommendRouter = router({
  /** 방출 시간/주차/안내 — 공개 (로그인 불필요) */
  weekStatus: publicProcedure.query(async () => {
    const weekId = getWeekId();
    const open = isReleaseWindow();
    let published = false;
    try {
      const pick = await getPublishedWeeklyPick(weekId);
      published = !!pick;
    } catch {
      published = false;
    }
    return {
      weekId,
      open,
      published,
      notice: open ? RELEASE_WINDOW_NOTICE : RELEASE_CLOSED_NOTICE,
    };
  }),

  /**
   * 이번 주 내 추천 조합.
   * - 구독 없으면 잠금(구독 유도)
   * - 방출 시간 외에는 안내
   * - 구독 등급별 combosPerWeek (2배 옵션 시 x2) 만큼 배분
   */
  myWeekly: protectedProcedure.query(async ({ ctx }) => {
    const weekId = getWeekId();
    const open = isReleaseWindow();

    const sub = await getActiveSubscription(ctx.user.id);
    if (!sub) {
      return {
        locked: true,
        reason: "no_subscription" as const,
        weekId,
        open,
        combos: [] as number[][],
        plan: null,
      };
    }

    const plan = PLANS[sub.planId as PlanId];
    const count = plan
      ? plan.combosPerWeek * (sub.isDouble ? 2 : 1)
      : 0;

    if (!open) {
      return {
        locked: true,
        reason: "closed_window" as const,
        weekId,
        open,
        combos: [] as number[][],
        plan,
        expectedCount: count,
        notice: RELEASE_CLOSED_NOTICE,
      };
    }

    const pick = await getPublishedWeeklyPick(weekId);
    if (!pick || (pick.combos as number[][]).length === 0) {
      return {
        locked: true,
        reason: "not_published" as const,
        weekId,
        open,
        combos: [] as number[][],
        plan,
        expectedCount: count,
        notice: "이번 주 추천 번호가 곧 공개됩니다.",
      };
    }

    const result = await allocateForUser(
      weekId,
      ctx.user.id,
      count,
      pick.combos as number[][],
      "subscription",
    );

    return {
      locked: false,
      reason: null,
      weekId,
      open,
      combos: result.combos,
      plan,
      expectedCount: count,
    };
  }),
});
