import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getActiveSubscription, listLottoResults } from "../db";
import { PLANS, type PlanId } from "@shared/plans";
import {
  getWeekId,
  isReleaseWindow,
  RELEASE_CLOSED_NOTICE,
  RELEASE_WINDOW_NOTICE,
} from "@shared/week";
import { allocateFromMasterPool } from "../allocation";
import { comboKey } from "@shared/lottoPool";

/**
 * DB에 저장된 당첨 결과(관리자 입력)를 배분 제외 키 집합으로 변환.
 * winners.json(과거 1228회)은 lottoPool 쪽에서 자동 제외되므로,
 * 여기서는 그 이후 회차(운영자가 매주 저장하는 최신 당첨번호)를 커버한다.
 */
async function recentWinnerKeys(): Promise<Set<string>> {
  try {
    const rows = await listLottoResults(500);
    return new Set(
      rows.map((r) => comboKey((r.winNumbers as number[]) ?? [])),
    );
  } catch {
    return new Set();
  }
}

export const recommendRouter = router({
  /** 방출 시간/주차/안내 — 공개 (로그인 불필요) */
  weekStatus: publicProcedure.query(async () => {
    const weekId = getWeekId();
    const open = isReleaseWindow();
    return {
      weekId,
      open,
      // 마스터 풀 자동 배분 체제 — 운영자 주간 게시 없이 항상 준비 상태
      published: true,
      notice: open ? RELEASE_WINDOW_NOTICE : RELEASE_CLOSED_NOTICE,
    };
  }),

  /**
   * 이번 주 내 추천 조합.
   * - 구독 없으면 잠금(구독 유도)
   * - 방출 시간 외에는 안내
   * - 구독 등급별 combosPerWeek (2배 옵션 시 x2) 만큼
   *   마스터 풀(약 321만 조합)에서 중복 없이 자동 배분
   * - 역대 + 최신 1등 당첨번호는 자동 제외
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
    const count = plan ? plan.combosPerWeek * (sub.isDouble ? 2 : 1) : 0;

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

    const excluded = await recentWinnerKeys();

    const result = await allocateFromMasterPool(
      weekId,
      ctx.user.id,
      count,
      "subscription",
      excluded,
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
