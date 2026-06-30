/**
 * Firebase Cloud Messaging(FCM) 푸시 알림 발송 모듈.
 *
 * firebase-admin 같은 별도 SDK를 새로 설치하지 않고, FCM의 HTTP v1 API를
 * 직접 fetch로 호출한다. 인증은 Google Play Billing 검증(playBilling.ts)과
 * 똑같은 방식 — 서비스 계정 JSON으로 JWT를 서명해 OAuth 액세스 토큰을 받는다.
 * (이미 의존성에 있는 jose 라이브러리만 사용 — 새 npm 패키지 설치 없음)
 *
 * 사전 준비:
 * 1) Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성"으로
 *    JSON 키 파일 다운로드
 * 2) 그 파일 내용 전체를 FIREBASE_SERVICE_ACCOUNT_JSON 환경변수에 한 줄로 붙여넣기
 *    (project_id는 이 JSON 안에 이미 들어있어서 별도 입력 필요 없음)
 */

import { SignJWT, importPKCS8 } from "jose";
import { ENV } from "./env";

interface ServiceAccountKey {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let cachedServiceAccount: ServiceAccountKey | null = null;

function getServiceAccount(): ServiceAccountKey {
  if (cachedServiceAccount) return cachedServiceAccount;
  if (!ENV.firebaseServiceAccountJson) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다.",
    );
  }
  cachedServiceAccount = JSON.parse(
    ENV.firebaseServiceAccountJson,
  ) as ServiceAccountKey;
  return cachedServiceAccount;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 30) {
    return cachedAccessToken.token;
  }

  const account = getServiceAccount();
  const privateKey = await importPKCS8(account.private_key, "RS256");

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firebase access token 발급 실패 (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

export interface PushMessage {
  /** 사용자 기기의 FCM 토큰 (push_tokens 테이블에 저장된 값) */
  token: string;
  title: string;
  body: string;
  /** 앱에서 알림 클릭 시 사용할 추가 데이터 (예: { screen: "result" }) */
  data?: Record<string, string>;
}

/**
 * 한 명의 사용자에게 푸시 알림 1건 발송.
 * 실패해도 예외를 던지지 않고 false를 반환한다
 * (수백~수천 명에게 보낼 때, 토큰 하나 잘못됐다고 전체가 멈추면 안 되므로).
 */
export async function sendPushToToken(message: PushMessage): Promise<boolean> {
  try {
    const account = getServiceAccount();
    const accessToken = await getAccessToken();

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: message.token,
            notification: { title: message.title, body: message.body },
            data: message.data,
          },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Push] 발송 실패 (${res.status}): ${text}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Push] 발송 중 오류:", error);
    return false;
  }
}

/**
 * 여러 사용자에게 같은 알림을 발송 (순차 처리, 실패한 토큰은 건너뜀).
 * @returns 성공/실패 건수
 */
export async function sendPushToMany(
  tokens: string[],
  content: Omit<PushMessage, "token">,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  for (const token of tokens) {
    const ok = await sendPushToToken({ ...content, token });
    if (ok) success += 1;
    else failed += 1;
  }
  return { success, failed };
}
