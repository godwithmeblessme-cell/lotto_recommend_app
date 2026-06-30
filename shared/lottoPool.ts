/**
 * 로또 마스터 풀 판정 로직 (Python compute_lotto.py의 20단계 필터를 TS로 이식)
 *
 * 한국 로또 6/45 전체 조합 C(45,6)=8,145,060 에서 사용자 정의 20단계 필터를
 * 순차 적용하여 남는 마스터 풀(3,091,431개)을 정의한다.
 *
 * - inPool(combo): 정렬된 6개 번호 배열이 마스터 풀에 속하는지 판정
 * - 1단계(역대 1등 당첨번호 제거)는 winners.json 데이터에 의존
 */

import winnersRaw from "./data/winners.json";

// 역대 1등 당첨번호를 "정렬된 6개 번호의 키 문자열" 집합으로 변환
const WINNER_SET: Set<string> = new Set(
  (winnersRaw as number[][]).map((nums) =>
    [...nums].sort((a, b) => a - b).join(","),
  ),
);

const HIGH = new Set([39, 40, 41, 42, 43, 44, 45]);

export function band(n: number): number {
  if (n >= 1 && n <= 10) return 0; // 1번대
  if (n >= 11 && n <= 20) return 1; // 10번대
  if (n >= 21 && n <= 30) return 2; // 20번대
  if (n >= 31 && n <= 40) return 3; // 30번대
  return 4; // 40번대 (41-45)
}

function maxConsecutiveRun(combo: number[]): number {
  let best = 1;
  let cur = 1;
  for (let i = 1; i < combo.length; i++) {
    if (combo[i] === combo[i - 1] + 1) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

function leadingSameParityRun(c: number[]): number {
  const firstParity = c[0] % 2;
  let run = 1;
  for (let i = 1; i < c.length; i++) {
    if (c[i] % 2 === firstParity) run += 1;
    else break;
  }
  return run;
}

/**
 * combo: 길이 6, 1~45, 중복 없는 번호 배열 (정렬 여부 무관 — 내부에서 정렬)
 * @returns 마스터 풀에 속하면 true
 */
export function inPool(input: number[]): boolean {
  if (input.length !== 6) return false;
  const combo = [...input].sort((a, b) => a - b);

  // 유효성: 1~45, 중복 없음
  for (let i = 0; i < 6; i++) {
    if (combo[i] < 1 || combo[i] > 45) return false;
    if (i > 0 && combo[i] === combo[i - 1]) return false;
  }

  const s = new Set(combo);

  // 단계 1: 역대 1등 당첨번호 제거
  if (WINNER_SET.has(combo.join(","))) return false;

  // 단계 2: 모두 홀수 또는 모두 짝수 제거
  const odd = combo.reduce((acc, n) => acc + (n % 2 === 1 ? 1 : 0), 0);
  if (odd === 6 || odd === 0) return false;

  // 구간 집합
  const bands = new Set(combo.map(band));
  const nb = bands.size;

  // 단계 3: 단일 구간만 사용 제거
  if (nb === 1) return false;

  // 단계 4: 정확히 두 구간만 사용 제거
  if (nb === 2) return false;

  // 단계 5: 연속 4개 이상 제거
  if (maxConsecutiveRun(combo) >= 4) return false;

  // 단계 6: 홀/짝 5:1 제거
  if (odd >= 5 || odd <= 1) return false;

  // 단계 7: 1과 45 동시 포함 제거
  if (s.has(1) && s.has(45)) return false;

  // 단계 8: 3&43 또는 2&44 동시 포함 제거
  if ((s.has(3) && s.has(43)) || (s.has(2) && s.has(44))) return false;

  // 단계 9: 연속 3개 이상 제거
  if (maxConsecutiveRun(combo) >= 3) return false;

  // 단계 10: 4&42 동시 포함 제거
  if (s.has(4) && s.has(42)) return false;

  // 단계 11: 5&41, 6&40, 7&39, 7&45 동시 포함 제거
  if (
    (s.has(5) && s.has(41)) ||
    (s.has(6) && s.has(40)) ||
    (s.has(7) && s.has(39)) ||
    (s.has(7) && s.has(45))
  )
    return false;

  // 단계 12: 39~45 중 3개 이상 포함 제거
  let highCount = 0;
  for (const n of combo) if (HIGH.has(n)) highCount += 1;
  if (highCount >= 3) return false;

  // 단계 13: 45와 {2,3,4,5,44} 중 하나라도 동시 포함 제거
  if (s.has(45) && (s.has(2) || s.has(3) || s.has(4) || s.has(5) || s.has(44)))
    return false;

  // 단계 14: 1과 2 동시 포함 제거
  if (s.has(1) && s.has(2)) return false;

  // 단계 15: 맨 앞부터 동일 홀짝 연속 3개 이상 제거
  if (leadingSameParityRun(combo) >= 3) return false;

  // 단계 16: 홀-짝-홀-짝-홀-짝 패턴 제거
  const parity = combo.map((n) => n % 2);
  if (parity.join("") === "101010") return false;

  // 단계 17: 짝-홀-짝-홀-짝-홀 패턴 제거
  if (parity.join("") === "010101") return false;

  // 단계 18: 한 번호대에서 4개 이상 제거
  const bandCounts = [0, 0, 0, 0, 0];
  for (const n of combo) bandCounts[band(n)] += 1;
  if (Math.max(...bandCounts) >= 4) return false;

  // 단계 19: 45 포함 제거
  if (s.has(45)) return false;

  // 단계 20: 44 포함 제거
  if (s.has(44)) return false;

  return true;
}

/** 마스터 풀 총 개수 (고정 상수) */
export const MASTER_POOL_TOTAL = 3091431;

/**
 * k개 번호 중 6개를 뽑는 모든 조합을 순회하며 콜백 호출.
 * (운영자 지정번호 → 6조합 생성용)
 */
export function forEachCombination(
  numbers: number[],
  k: number,
  cb: (combo: number[]) => void,
): void {
  const arr = [...numbers].sort((a, b) => a - b);
  const n = arr.length;
  if (n < k) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    cb(idx.map((i) => arr[i]));
    // 다음 조합
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) break;
    idx[i] += 1;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

/**
 * 운영자 지정번호 집합에서 만들 수 있는 6조합 중 마스터 풀에 속하는 것만 반환.
 * 각 조합은 정렬된 number[6].
 */
export function poolCombosFromPicks(picks: number[]): number[][] {
  const uniq = Array.from(new Set(picks)).filter((n) => n >= 1 && n <= 45);
  const result: number[][] = [];
  forEachCombination(uniq, 6, (combo) => {
    if (inPool(combo)) result.push(combo);
  });
  return result;
}

/** 조합을 안정적인 문자열 키로 변환 (정렬 후 콤마 조인) */
export function comboKey(combo: number[]): string {
  return [...combo].sort((a, b) => a - b).join(",");
}
