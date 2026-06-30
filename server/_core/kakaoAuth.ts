/**
 * 실제 운영용 로그인 모듈 (카카오 로그인).
 *
 * 기존 sdk.ts는 Manus 자체 개발 플랫폼(manus.im)의 내부 인증 서버에 의존하고 있어,
 * 앱을 Manus 환경 밖(독립 서버 + 안드로이드)으로 배포하면 전혀 동작하지 않았습니다.
 * 이 파일은 그 자리를 대체하는, 실제로 동작하는 카카오 OAuth 연동입니다.
 *
 * 사전 준비:
 * 1) https://developers.kakao.com 에서 애플리케이션 생성
 * 2) "카카오 로그인" 활성화 + Redirect URI 등록 (예: https://yourdomain.com/api/oauth/callback)
 * 3) 동의항목에서 닉네임/이메일(선택) 등 필요한 항목 설정
 * 4) 발급받은 REST API 키 → KAKAO_CLIENT_ID 환경변수에 설정
 */

import { ForbiddenError } from "@shared/_core/errors";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_USERINFO_URL = "https://kapi.kakao.com/v2/user/me";

export type SessionPayload = {
  openId: string;
  name: string;
};

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
}

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    profile?: { nickname?: string };
    email?: string;
  };
}

export interface NormalizedUserInfo {
  openId: string; // "kakao_<id>" 형태로 저장 (다른 로그인 수단과 충돌 방지)
  name: string | null;
  email: string | null;
  loginMethod: "kakao";
}

class KakaoAuthService {
  /** 인가 코드(authorization code) → 액세스 토큰 교환 */
  async exchangeCodeForToken(code: string): Promise<KakaoTokenResponse> {
    if (!ENV.kakaoClientId || !ENV.kakaoRedirectUri) {
      throw new Error(
        "KAKAO_CLIENT_ID / KAKAO_REDIRECT_URI 환경변수가 설정되지 않았습니다.",
      );
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ENV.kakaoClientId,
      redirect_uri: ENV.kakaoRedirectUri,
      code,
    });
    if (ENV.kakaoClientSecret) {
      body.set("client_secret", ENV.kakaoClientSecret);
    }

    const res = await fetch(KAKAO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`카카오 토큰 교환 실패 (${res.status}): ${text}`);
    }

    return res.json() as Promise<KakaoTokenResponse>;
  }

  /** 액세스 토큰 → 사용자 정보 조회 */
  async getUserInfo(accessToken: string): Promise<NormalizedUserInfo> {
    const res = await fetch(KAKAO_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`카카오 사용자 정보 조회 실패 (${res.status}): ${text}`);
    }

    const data = (await res.json()) as KakaoUserInfo;
    return {
      openId: `kakao_${data.id}`,
      name: data.kakao_account?.profile?.nickname ?? null,
      email: data.kakao_account?.email ?? null,
      loginMethod: "kakao",
    };
  }

  private getSessionSecret() {
    if (!ENV.cookieSecret) {
      throw new Error(
        "JWT_SECRET 환경변수가 설정되지 않았습니다. 세션을 발급/검증할 수 없습니다.",
      );
    }
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({ openId, name: options.name ?? "" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, name } = payload as Record<string, unknown>;
      if (typeof openId !== "string" || openId.length === 0) return null;
      return { openId, name: typeof name === "string" ? name : "" };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  /** 매 요청마다 세션 쿠키로부터 로그인한 사용자를 조회 */
  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const user = await db.getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    return user;
  }
}

export const kakaoAuth = new KakaoAuthService();
