/**
 * 주차(weekId) 계산 및 KST 기준 방출 가능 시간 유틸.
 * 서버·클라이언트 공통 사용.
 *
 * 운영 규칙:
 * - 로또 추첨: 매주 토요일 저녁
 * - 다음 주 예상번호 산출: 토요일 밤
 * - 번호 방출/조회 가능: 월요일 00:00 ~ 토요일 19:00 (KST)
 * - 그 외 시간(토 19:00 ~ 월 00:00): "다음 주 번호 준비 중"
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 주어진 시각(UTC ms)을 KST 기준 Date 컴포넌트로 변환 */
export function toKstParts(utcMs: number): {
  year: number;
  month: number; // 1-12
  day: number;
  dow: number; // 0=일 ~ 6=토
  hour: number;
  minute: number;
} {
  const d = new Date(utcMs + KST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    dow: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** KST 기준 "YYYY-MM-DD" 날짜 문자열 */
export function kstDateString(utcMs: number = Date.now()): string {
  const p = toKstParts(utcMs);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

/**
 * ISO-8601 주차 계산 (KST 기준). 결과 예: "2026-W25".
 * 한 "운영 주"는 월요일 시작으로 본다.
 */
export function getWeekId(utcMs: number = Date.now()): string {
  // KST 자정 기준 Date 구성
  const p = toKstParts(utcMs);
  // UTC 로 KST 날짜를 표현하는 Date (시간 정보 제거)
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  // ISO week: 목요일 기준
  const dayNum = (date.getUTCDay() + 6) % 7; // 월=0 ... 일=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // 해당 주 목요일
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNo =
    1 +
    Math.round(
      (date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * 현재(KST) 번호 방출/조회가 가능한 시간대인지 판정.
 * 가능: 월(1) 00:00 ~ 토(6) 19:00
 */
export function isReleaseWindow(utcMs: number = Date.now()): boolean {
  const p = toKstParts(utcMs);
  // 일요일(0)은 불가
  if (p.dow === 0) return false;
  // 토요일(6)은 19시 전까지만
  if (p.dow === 6) return p.hour < 19;
  // 월~금(1~5) 종일 가능
  return true;
}

/** 방출 불가 시간대 안내 문구 */
export const RELEASE_CLOSED_NOTICE =
  "다음 주 분석번호를 준비하고 있습니다. 번호 확인은 매주 월요일부터 토요일 오후 7시까지 가능합니다.";

/** 방출 가능 시간 안내(상시 표시용) */
export const RELEASE_WINDOW_NOTICE =
  "번호 방출 및 확인은 매주 월요일 ~ 토요일 오후 7시(KST)까지 가능합니다.";

/**
 * 주어진 시각으로부터 N주 뒤의 weekId 를 계산.
 * 운영자가 토요일 밤에 "다음 주" 번호를 등록할 때 사용.
 */
export function shiftedWeekId(weeks: number, utcMs: number = Date.now()): string {
  return getWeekId(utcMs + weeks * 7 * 24 * 60 * 60 * 1000);
}

/** 다음 주 weekId */
export function nextWeekId(utcMs: number = Date.now()): string {
  return shiftedWeekId(1, utcMs);
}
