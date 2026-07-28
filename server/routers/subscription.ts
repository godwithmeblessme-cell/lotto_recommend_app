import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getActiveSubscription,
  createSubscription,
  createYearSubscriptionCapped,
  countYearSubscriptions,
  YearCapReachedError,
  listUserSubscriptions,
  getSubscriptionByPurchaseToken,
} from "../db";
import { PLANS, PLAN_ORDER, type PlanId } from "@shared/plans";
import { YEAR_SALE } from "@shared/salesCap";
import { verifyPlaySubscriptionPurchase } from "../_core/playBilling";

const planIdSchema = z.enum(PLAN_ORDER as [PlanId, ...PlanId[]]);

export const subscriptionRouter = router({
  /** 현재 활성 구독 + 플랜 정보 */
  current: protectedProcedure.query(async ({ ctx }) => {
    const sub = await getActiveSubscription(ctx.user.id);
    if (!sub) return { subscription: null, plan: null };
    return { subscription: sub, plan: PLANS[sub.planId as PlanId] ?? null };
  }),

  /** 내 구독 이력 */
  history: protectedProcedure.query(async ({ ctx }) => {
    return listUserSubscriptions(ctx.user.id);
  }),

  /**
   * 연 구독 선착순 현황 (공개 — 로그인 없이도 조회 가능).
   * 화면이 이 값으로 "남은 자리 / 마감 여부"를 실시간 표시하고,
   * 마감 시 결제 버튼을 잠근다.
   */
  pricingStatus: publicProcedure.query(async () => {
    let soldCount = 0;
    try {
      soldCount = await countYearSubscriptions();
    } catch {
      soldCount = 0;
    }
    const cap = YEAR_SALE.cap;
    const remaining = cap === null ? null : Math.max(0, cap - soldCount);
    const soldOut = cap !== null && soldCount >= cap;
    return {
      soldCount,
      cap,
      remaining,
      soldOut,
      priceKRW: PLANS.year.priceKRW,
      badge: YEAR_SALE.badge,
      soldOutTitle: YEAR_SALE.soldOutTitle,
      soldOutDesc: YEAR_SALE.soldOutDesc,
    };
  }),

  /** (구버전 호환) 연 구독자 수 */
  yearSubCount: publicProcedure.query(async () => {
    let yearSubs = 0;
    try {
      yearSubs = await countYearSubscriptions();
    } catch {
      yearSubs = 0;
    }
    return { yearSubs };
  }),

  /**
   * 회원가입 후 1회, 1주 무료체험(10조합) 발급.
   */
  claimTrial: protectedProcedure.mutation(async ({ ctx }) => {
    const history = await listUserSubscriptions(ctx.user.id);
    if (history.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "이미 무료체험을 사용했거나 구독 이력이 있습니다.",
      });
    }

    const plan = PLANS.trial;
    const startAt = Date.now();
    const endAt = startAt + plan.durationWeeks * 7 * 24 * 60 * 60 * 1000;
    const id = await createSubscription({
      userId: ctx.user.id,
      planId: "trial",
      isDouble: false,
      startAt,
      endAt,
      status: "active",
      source: "trial",
      purchaseToken: null,
    });
    return { subscriptionId: id, planId: "trial" as const };
  }),

  /**
   * 구글 플레이 인앱결제 승인.
   * - 연 구독은 선착순 상한(YEAR_SALE.cap)을 서버가 강제한다.
   *   상한 초과 시 발급을 거부 → 클라이언트가 결제 완료 처리를 하지 않으므로
   *   미확인(unacknowledged) 결제로 남아 구글이 자동 취소/환불한다.
   */
  purchase: protectedProcedure
    .input(
      z.object({
        planId: planIdSchema,
        purchaseToken: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 같은 토큰 중복 방지 (이미 발급됐으면 그대로 반환)
      const already = await getSubscriptionByPurchaseToken(input.purchaseToken);
      if (already) {
        return { subscriptionId: already.id, planId: already.planId as PlanId };
      }

      const verification = await verifyPlaySubscriptionPurchase(
        input.purchaseToken,
      );
      if (!verification.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "결제 확인에 실패했습니다. 구글 플레이 결제가 완료되지 않았습니다.",
        });
      }

      const plan = PLANS[input.planId];
      const startAt = Date.now();
      const endAt =
        input.planId === "year"
          ? startAt + plan.durationWeeks * 7 * 24 * 60 * 60 * 1000
          : (verification.expiryTimeMs ??
            startAt + plan.durationWeeks * 7 * 24 * 60 * 60 * 1000);

      const subInput = {
        userId: ctx.user.id,
        planId: input.planId,
        isDouble: false,
        startAt,
        endAt,
        status: "active" as const,
        source: "google_play" as const,
        purchaseToken: input.purchaseToken,
      };

      // 연 구독: 선착순 상한을 정확히 지키는 발급 (딱 cap 명에서 컷)
      if (input.planId === "year") {
        try {
          const id = await createYearSubscriptionCapped(
            subInput,
            YEAR_SALE.cap,
          );
          return { subscriptionId: id, planId: input.planId };
        } catch (err) {
          if (err instanceof YearCapReachedError) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "앗, 방금 선착순 정원이 모두 마감되었습니다. 이번 결제는 확정되지 않으며 구글 플레이에서 자동 취소/환불됩니다.",
            });
          }
          throw err;
        }
      }

      // 월 구독 등 나머지
      const id = await createSubscription(subInput);
      return { subscriptionId: id, planId: input.planId };
    }),
});
