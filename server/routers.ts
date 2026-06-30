import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { subscriptionRouter } from "./routers/subscription";
import { pointsRouter } from "./routers/points";
import { dailyRouter } from "./routers/daily";
import { recommendRouter } from "./routers/recommend";
import { adminRouter } from "./routers/admin";
import { resultRouter, adminResultRouter } from "./routers/result";
import { attendanceRouter } from "./routers/attendance";
import { announcementRouter, adminAnnouncementRouter } from "./routers/announcement";
import { accountRouter } from "./routers/account";
import { upsertPushToken } from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  subscription: subscriptionRouter,
  points: pointsRouter,
  daily: dailyRouter,
  recommend: recommendRouter,
  admin: adminRouter,
  adminResult: adminResultRouter,
  adminAnnouncement: adminAnnouncementRouter,
  result: resultRouter,
  attendance: attendanceRouter,
  announcement: announcementRouter,
  account: accountRouter,

  /** 푸시 토큰 등록 자리 (FCM 등 푸시 연동 시 사용) */
  push: router({
    register: protectedProcedure
      .input(z.object({ token: z.string().min(1), platform: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await upsertPushToken(ctx.user.id, input.token, input.platform ?? "android");
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
