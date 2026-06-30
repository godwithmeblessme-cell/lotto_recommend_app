/**
 * 계정 관리 라우터.
 *
 * deleteAccount: 회원 탈퇴 — 이 회원과 관련된 모든 데이터를 영구 삭제하고
 * 로그인 세션을 종료한다. 구글 플레이 데이터 보안 선언에서 필수로 요구하는
 * "계정 및 데이터 삭제" 기능이다.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { deleteUserAccount } from "../db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";

export const accountRouter = router({
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteUserAccount(ctx.user.id);

    // 탈퇴 직후 바로 로그아웃 상태가 되도록 세션 쿠키도 지운다.
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

    return { success: true } as const;
  }),
});
