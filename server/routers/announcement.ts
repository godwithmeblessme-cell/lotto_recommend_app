/**
 * 주간 당첨 발표 공지 라우터.
 *
 * - announcement.latest  : 홈 화면에 띄울 최신 공지 (이 회원이 이미 닫았으면 null)
 * - announcement.dismiss : "1주일간 보지 않기" 클릭 시 호출
 * - adminAnnouncement.runNow : 운영자가 수동으로 즉시 실행 (테스트/스케줄 놓쳤을 때 대비)
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import {
  getLatestWeeklyAnnouncement,
  hasUserDismissedAnnouncement,
  dismissAnnouncement,
} from "../db";
import { runWeeklyAnnouncementJob } from "../jobs/weeklyAnnouncement";
import { getWeekId } from "@shared/week";

export const announcementRouter = router({
  /**
   * 가장 최근 주간 발표를 반환.
   * 로그인 상태면 "이 회원이 이미 닫았는지"도 함께 확인해서, 닫았으면 null을 준다
   * (화면에서는 latest 가 null이면 배너를 안 띄우면 됨).
   */
  latest: publicProcedure.query(async ({ ctx }) => {
    const announcement = await getLatestWeeklyAnnouncement();
    if (!announcement) return null;

    if (ctx.user) {
      const dismissed = await hasUserDismissedAnnouncement(
        ctx.user.id,
        announcement.weekId,
      );
      if (dismissed) return null;
    }

    return announcement;
  }),

  /** "1주일간 보지 않기" — 이번 주차 공지를 다시 안 보이게 함 */
  dismiss: protectedProcedure
    .input(z.object({ weekId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await dismissAnnouncement(ctx.user.id, input.weekId);
      return { success: true } as const;
    }),
});

export const adminAnnouncementRouter = router({
  /**
   * 운영자가 수동으로 즉시 실행 (자동 스케줄을 놓쳤거나, 미리 테스트해보고 싶을 때).
   * weekId 미지정 시 이번 주(현재 시각 기준) 사용.
   * 이미 생성된 주는 다시 실행해도 안전(멱등) — 그냥 "이미 발표됨"이라고 알려준다.
   */
  runNow: adminProcedure
    .input(z.object({ weekId: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      const weekId = input?.weekId || getWeekId();
      return runWeeklyAnnouncementJob(weekId);
    }),
});
