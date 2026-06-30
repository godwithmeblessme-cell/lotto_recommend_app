/**
 * Firebase Cloud Messaging 서비스 워커.
 *
 * 앱이 꺼져있거나 백그라운드 상태일 때도 푸시 알림을 받을 수 있게 해주는 필수 파일.
 * 브라우저가 이 파일을 "/firebase-messaging-sw.js" 경로로 직접 불러오기 때문에,
 * Vite 빌드 과정의 환경변수 치환이 적용되지 않는다. 그래서 아래 firebaseConfig
 * 값은 직접 채워 넣어야 한다 (이 값들은 비밀값이 아니라 공개되어도 안전한
 * 클라이언트 설정값들이다 — Firebase 콘솔 > 프로젝트 설정 > 일반 탭에서 확인 가능).
 *
 * ⚠️ 아래 "여기를_채워주세요" 부분을, .env의 VITE_FIREBASE_* 값과 동일하게 채워주세요.
 */

importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC7OMEQoVKlKZZ3sF-TMKwvv_ThP4kr5O4",
  authDomain: "lotto-number-app.firebaseapp.com",
  projectId: "lotto-number-app",
  storageBucket: "lotto-number-app.firebasestorage.app",
  messagingSenderId: "253621984362",
  appId: "1:253621984362:web:61060cde456188d9523e13",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "로또 통계 분석";
  const body = payload.notification?.body ?? "";
  self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
  });
});
