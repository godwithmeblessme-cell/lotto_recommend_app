export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // --- 카카오 로그인 (실제 운영용 OAuth) ---
  // https://developers.kakao.com 에서 앱 등록 후 발급받는 값으로 채워주세요.
  kakaoClientId: process.env.KAKAO_CLIENT_ID ?? "",
  kakaoClientSecret: process.env.KAKAO_CLIENT_SECRET ?? "", // 카카오는 보통 비워둬도 동작(선택)
  kakaoRedirectUri: process.env.KAKAO_REDIRECT_URI ?? "",

  // --- 구글 플레이 인앱결제(Play Billing) 서버 검증용 ---
  // Play Console > 설정 > API 액세스에서 만든 서비스 계정의 JSON 키 내용을 그대로 넣습니다.
  googlePlayPackageName: process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "",
  googlePlayServiceAccountJson: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? "",
};
