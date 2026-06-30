/**
 * 주간 당첨 발표 작업.
 *
 * 매주 일요일 9시(KST)에 (scheduler.ts 가) 자동으로 실행하거나,
 * 운영자가 관리자 화면에서 수동으로 실행할 수 있다.
 *
 * 하는 일:
 * 1) 해당 주(weekId)에 회원들에게 배분됐던 모든 조합을 당첨번호와 대조
 * 2) 1~5등 인원수 집계 → weekly_announcements 테이블에 저장 (홈 화면 공지 배너용)
 * 3) 전체 회원에게 "이번 주 결과: 1등 N명, 2등 N명..." 푸시 발송
 * 4) 당첨된 회원에게는 추가로 "축하합니다! N등에 당첨되셨습니다" 개별 푸시 발송
 *
 * 같은 주(weekId)에 대해 이미 발표가 만들어져 있으면 아무것도 하지 않는다(멱등).
 * → 서버가 재시작되거나 스케줄러가 같은 시각에 두 번 실행돼도 중복 발송되지 않는다.
 */

import {
  getPublishedLottoResult,
  getAllAllocationsForWeek,
  getWeeklyAnnouncement,
  insertWeeklyAnnouncement,
  getAllPushTokens,
  getPushTokensForUsers,
} from "../db";
import { calcRank } from "../routers/result";
import { sendPushToMany } from "../_core/push";

export interface WeeklyAnnouncementJobResult {
  ran: boolean;
  reason?: string;
  weekId: string;
  rankCounts?: { 1: number; 2: number; 3: number; 4: number; 5: number };
  broadcastSent?: { success: number; failed: number };
  winnerPushSent?: { success: number; failed: number };
}

export async function runWeeklyAnnouncementJob(
  weekId: string,
): Promise<WeeklyAnnouncementJobResult> {
  // 1) 이미 이번 주 발표가 있으면 건너뜀 (중복 발송 방지)
  const existing = await getWeeklyAnnouncement(weekId);
  if (existing) {
    return { ran: false, reason: "이미 이 주의 발표가 생성되어 있습니다.", weekId };
  }

  // 2) 당첨번호가 아직 게시되지 않았으면 할 일이 없음
  const result = await getPublishedLottoResult(weekId);
  if (!result) {
    return { ran: false, reason: "이 주의 당첨번호가 아직 게시되지 않았습니다.", weekId };
  }

  const winNumbers = result.winNumbers as number[];
  const bonusNumber = result.bonusNumber;

  // 3) 이 주에 배분된 모든 조합을 당첨번호와 대조
  const allocations = await getAllAllocationsForWeek(weekId);

  const rankCounts: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  /** userId -> 그 회원의 최고 등수 (가장 높은 등수 1개만 — 중복 알림 방지) */
  const winnersByUser = new Map<number, number>();

  for (const a of allocations) {
    const { rank } = calcRank(a.combo as number[], winNumbers, bonusNumber);
    if (rank === null) continue;
    rankCounts[rank as 1 | 2 | 3 | 4 | 5] += 1;

    const prevBest = winnersByUser.get(a.userId);
    if (prevBest === undefined || rank < prevBest) {
      winnersByUser.set(a.userId, rank);
    }
  }

  // 4) 집계 저장 (홈 화면 공지 배너가 이 데이터를 읽음)
  await insertWeeklyAnnouncement({
    weekId,
    round: result.round,
    rank1Count: rankCounts[1],
    rank2Count: rankCounts[2],
    rank3Count: rankCounts[3],
    rank4Count: rankCounts[4],
    rank5Count: rankCounts[5],
    totalCombos: allocations.length,
  });

  // 5) 전체 회원에게 결과 요약 푸시
  const allTokenRows = await getAllPushTokens();
  const summaryText =
    `1등 ${rankCounts[1]}명 · 2등 ${rankCounts[2]}명 · 3등 ${rankCounts[3]}명 · ` +
    `4등 ${rankCounts[4]}명 · 5등 ${rankCounts[5]}명`;

  const broadcastSent = await sendPushToMany(
    allTokenRows.map((t) => t.token),
    {
      title: `${result.round}회 당첨 결과 발표`,
      body: summaryText,
      data: { screen: "result", weekId },
    },
  );

  // 6) 당첨된 회원에게는 개별 축하 메시지 추가 발송
  const winnerUserIds = Array.from(winnersByUser.keys());
  const winnerTokenRows = await getPushTokensForUsers(winnerUserIds);
  // userId -> 토큰 목록
  const tokensByUser = new Map<number, string[]>();
  for (const row of winnerTokenRows) {
    const list = tokensByUser.get(row.userId) ?? [];
    list.push(row.token);
    tokensByUser.set(row.userId, list);
  }

  let winnerSuccess = 0;
  let winnerFailed = 0;
  for (const [userId, rank] of winnersByUser) {
    const tokens = tokensByUser.get(userId) ?? [];
    if (tokens.length === 0) continue;
    const r = await sendPushToMany(tokens, {
      title: "🎉 축하합니다!",
      body: `이번 주 ${rank}등에 당첨되셨어요! 앱에서 자세한 내용을 확인하세요.`,
      data: { screen: "result", weekId },
    });
    winnerSuccess += r.success;
    winnerFailed += r.failed;
  }

  return {
    ran: true,
    weekId,
    rankCounts,
    broadcastSent,
    winnerPushSent: { success: winnerSuccess, failed: winnerFailed },
  };
}
