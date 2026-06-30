/**
 * Firebase Cloud Messaging(FCM) 클라이언트 — 푸시 알림 권한 요청 + 토큰 등록.
 *
 * 동작 흐름:
 * 1) 사용자가 "알림 받기" 버튼을 누름
 * 2) 브라우저가 알림 권한을 물어봄 (사용자가 허용해야 함)
 * 3) 허용되면 FCM 토큰을 발급받음
 * 4) 그 토큰을 서버(push.register)에 저장 → 서버가 나중에 이 토큰으로 알림을 보냄
 *
 * 필요한 환경변수 (모두 Firebase 콘솔에서 확인 가능):
 * - VITE_FIREBASE_API_KEY
 * - VITE_FIREBASE_AUTH_DOMAIN
 * - VITE_FIREBASE_PROJECT_ID
 * - VITE_FIREBASE_STORAGE_BUCKET
 * - VITE_FIREBASE_MESSAGING_SENDER_ID
 * - VITE_FIREBASE_APP_ID
 * - VITE_FIREBASE_VAPID_KEY (Cloud Messaging > Web Push 인증서에서 생성)
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

/** 이 브라우저/기기가 푸시 알림을 지원하는지 (오래된 iOS Safari 등은 미지원) */
export async function isPushSupported(): Promise<boolean> {
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/**
 * 알림 권한을 요청하고, 허용되면 FCM 토큰을 반환한다.
 * 거부되었거나 미지원 환경이면 null을 반환한다 (예외를 던지지 않음 — 호출부에서
 * "못 받았어요" UI만 보여주면 되도록).
 */
export async function requestPushToken(): Promise<string | null> {
  if (!(await isPushSupported())) return null;
  if (typeof Notification === "undefined") return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (error) {
    console.error("[Push] FCM 토큰 발급 실패:", error);
    return null;
  }
}
