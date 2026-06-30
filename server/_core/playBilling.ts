/**
 * 구글 플레이 구매 토큰(purchaseToken) 서버 검증.
 *
 * 클라이언트(Digital Goods API)에서 받은 purchaseToken은 그 자체로는 아무 의미가 없습니다.
 * 반드시 서버에서 Google Play Developer API를 호출해 "진짜 결제가 승인되었는지"를
 * 확인해야 합니다. 이 검증 없이 구독을 발급하면, 누구나 가짜 토큰으로 무료 이용이 가능합니다.
 * (이전 토스페이 모의결제 코드가 정확히 이 문제를 갖고 있었습니다.)
 *
 * 사전 준비:
 * 1) Play Console > 설정 > API 액세스 에서 서비스 계정 생성 + JSON 키 다운로드
 * 2) 해당 서비스 계정에 "재무 데이터 보기/관리" 권한 부여
 * 3) JSON 키 파일 내용을 GOOGLE_PLAY_SERVICE_ACCOUNT_JSON 환경변수에 통째로 넣기
 * 4) GOOGLE_PLAY_PACKAGE_NAME 환경변수에 앱 패키지명 설정 (예: com.yourcompany.lottoapp)
 */

import { SignJWT, importPKCS8 } from "jose";
import { ENV } from "./env";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface SubscriptionPurchaseV2 {
  subscriptionState:
    | "SUBSCRIPTION_STATE_ACTIVE"
    | "SUBSCRIPTION_STATE_CANCELED"
    | "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
    | "SUBSCRIPTION_STATE_ON_HOLD"
    | "SUBSCRIPTION_STATE_EXPIRED"
    | string;
  lineItems?: { expiryTime?: string; productId?: string }[];
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount(): ServiceAccountKey {
  if (!ENV.googlePlayServiceAccountJson) {
    throw new Error(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다.",
    );
  }
  return JSON.parse(ENV.googlePlayServiceAccountJson) as ServiceAccountKey;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 30) {
    return cachedAccessToken.token;
  }

  const account = getServiceAccount();
  const privateKey = await importPKCS8(account.private_key, "RS256");

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/androidpublisher",
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
    throw new Error(`구글 access token 발급 실패 (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

/**
 * 구매 토큰이 유효한 "활성 구독"인지 확인.
 * @returns 유효하면 만료 시각(ms), 무효하면 null
 */
export async function verifyPlaySubscriptionPurchase(
  purchaseToken: string,
): Promise<{ valid: boolean; expiryTimeMs: number | null }> {
  if (!ENV.googlePlayPackageName) {
    throw new Error("GOOGLE_PLAY_PACKAGE_NAME 환경변수가 설정되지 않았습니다.");
  }

  const accessToken = await getAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(ENV.googlePlayPackageName)}/purchases/subscriptionsv2/tokens/` +
    `${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404 || res.status === 400) {
    return { valid: false, expiryTimeMs: null };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`구글 구매 검증 실패 (${res.status}): ${text}`);
  }

  const data = (await res.json()) as SubscriptionPurchaseV2;
  const isActive =
    data.subscriptionState === "SUBSCRIPTION_STATE_ACTIVE" ||
    data.subscriptionState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD";

  const expiry = data.lineItems?.[0]?.expiryTime
    ? new Date(data.lineItems[0].expiryTime).getTime()
    : null;

  return { valid: isActive, expiryTimeMs: expiry };
}
