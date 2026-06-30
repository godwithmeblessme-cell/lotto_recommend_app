import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getActiveSubscription,
  createSubscription,
  listUserSubscriptions,
  getSubscriptionByPurchaseToken,
} from "../db";
import { PLANS, PLAN_ORDER, type PlanId } from "@shared/plans";
import { verifyPlaySubscriptionPurchase } from "../_core/playBilling";

const planIdSchema = z.enum(
  PLAN_ORDER as [PlanId, ...PlanId[]],
);

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
   * 회원가입 후 1회, 1주 무료체험(10조합) 발급.
   * 구독 이력(유료/무료체험 포함)이 한 번이라도 있으면 재발급하지 않습니다.
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
   * 구글 플레이 인앱결제(Play Billing) 구매 승인.
   *
   * 클라이언트(Digital Goods API)에서 받은 purchaseToken을 그대로 믿지 않고,
   * 서버에서 Google Play Developer API로 실제 결제 상태를 다시 확인합니다.
   * 검증을 통과하지 못하면 구독을 발급하지 않습니다.
   */
  purchase: protectedProcedure
    .input(
      z.object({
        planId: planIdSchema,
        purchaseToken: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 동일 토큰으로 이미 구독이 발급된 적이 있는지 확인 (중복 클릭/재전송 방지)
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
          message: "결제 확인에 실패했습니다. 구글 플레이 결제가 완료되지 않았습니다.",
        });
      }

      const plan = PLANS[input.planId];
      const startAt = Date.now();
      const endAt =
        verification.expiryTimeMs ??
        startAt + plan.durationWeeks * 7 * 24 * 60 * 60 * 1000;

      const id = await createSubscription({
        userId: ctx.user.id,
        planId: input.planId,
        isDouble: false,
        startAt,
        endAt,
        status: "active",
        source: "google_play",
        purchaseToken: input.purchaseToken,
      });
      return { subscriptionId: id, planId: input.planId };
    }),
});
