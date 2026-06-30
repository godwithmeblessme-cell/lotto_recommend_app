/**
 * 매주 일요일 9시(KST) 자동 실행 스케줄러.
 *
 * 별도의 cron 서비스(Railway Cron 등 추가 결제가 필요한 기능)를 쓰지 않고,
 * 이미 떠있는 서버 프로세스 안에서 "1분마다 지금이 일요일 9시인지 확인" 하는
 * 방식으로 구현했다. 가볍고, 추가 인프라/비용이 들지 않는다.
 *
 * 중복 실행 방지는 weeklyAnnouncement.ts 쪽의 멱등성(weekId 당 1번만 생성)에
 * 맡긴다 — 그래서 어쩌다 같은 분에 두 번 체크가 일어나도 안전하다.
 */

import { toKstParts, getWeekId } from "@shared/week";
import { runWeeklyAnnouncementJob } from "../jobs/weeklyAnnouncement";

const CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 확인

function isSunday9amKst(nowMs: number): boolean {
  const p = toKstParts(nowMs);
  return p.dow === 0 && p.hour === 9;
}

export function startWeeklyAnnouncementScheduler() {
  setInterval(async () => {
    const now = Date.now();
    if (!isSunday9amKst(now)) return;

    try {
      const weekId = getWeekId(now);
      const result = await runWeeklyAnnouncementJob(weekId);
      if (result.ran) {
        console.log(
          `[Scheduler] 주간 발표 자동 실행 완료: ${weekId}`,
          result.rankCounts,
        );
      }
      // ran=false (이미 실행됐거나 결과 미게시)인 경우는 흔한 정상 상황이라 로그 생략
    } catch (error) {
      console.error("[Scheduler] 주간 발표 자동 실행 실패:", error);
    }
  }, CHECK_INTERVAL_MS);

  console.log("[Scheduler] 주간 발표 스케줄러 시작 (매주 일요일 9시 KST 확인)");
}
