export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// 카카오 로그인 URL 생성.
// developers.kakao.com 에서 발급받은 REST API 키를 VITE_KAKAO_CLIENT_ID 에 설정하세요.
export const getLoginUrl = () => {
  const clientId = import.meta.env.VITE_KAKAO_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");

  return url.toString();
};
