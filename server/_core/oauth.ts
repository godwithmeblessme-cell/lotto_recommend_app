import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { kakaoAuth } from "./kakaoAuth";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const errorParam = getQueryParam(req, "error");

    if (errorParam) {
      // 사용자가 카카오 로그인 동의를 취소한 경우 등
      res.redirect(302, "/?loginError=cancelled");
      return;
    }

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      const tokenResponse = await kakaoAuth.exchangeCodeForToken(code);
      const userInfo = await kakaoAuth.getUserInfo(tokenResponse.access_token);

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name,
        email: userInfo.email,
        loginMethod: userInfo.loginMethod,
        lastSignedIn: new Date(),
      });

      const sessionToken = await kakaoAuth.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Kakao callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
