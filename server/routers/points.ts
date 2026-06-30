import { protectedProcedure, router } from "../_core/trpc";
import {
  getPointsBalance,
  listPointsHistory,
  getRecentClaimDates,
} from "../db";

export const pointsRouter = router({
  /** 보유 포인트 잔액 */
  balance: protectedProcedure.query(async ({ ctx }) => {
    const balance = await getPointsBalance(ctx.user.id);
    return { balance };
  }),

  /** 적립/차감 내역 */
  history: protectedProcedure.query(async ({ ctx }) => {
    return listPointsHistory(ctx.user.id);
  }),

  /** 최근 출석 날짜 (연속 출석 시각화용) */
  recentClaims: protectedProcedure.query(async ({ ctx }) => {
    return getRecentClaimDates(ctx.user.id);
  }),
});
