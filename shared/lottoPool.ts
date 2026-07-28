/**
 * 로또 마스터 풀 판정 로직 (사장님 최종 이론 — lotto_survivors.xlsx 재현 검증 완료)
 *
 * 한국 로또 6/45 전체 조합 C(45,6)=8,145,060 에서 아래 규칙을 적용해 남는
 * 마스터 풀을 정의한다.
 *
 * [규칙 — 2026-07 확정본]
 *  R1.  역대 1등 당첨번호 제거 (winners.json + DB lotto_results 는 배분 시 동적 제외)
 *  R2.  홀수 5개 이상 또는 짝수 5개 이상 제거
 *  R3.  홀짝홀짝홀짝 / 짝홀짝홀짝홀 교대 패턴 제거
 *  R4.  같은 끝자리가 3번 이상 반복되는 조합 제거
 *  R5.  1과 45 동시 포함 제거
 *  R6.  6개가 모두 한 번호대(1/10/20/30번대)인 조합 제거
 *  R7.  두 개 번호대에서만 나온 조합 제거
 *  R8.  연속 숫자 3개 이상 제거 (구이론 계승 — 신규칙의 4개 이상을 포함)
 *  R9.  한 번호대에서 4개 이상 제거
 *  R10. 첫 숫자 끝자리 == 마지막 숫자 끝자리 제거
 *  R11. 2와 44 동시 포함 제거
 *  R12. 3과 43 동시 포함 제거
 *  R13. 39~45 중 3개 이상 포함 제거
 *  R14. 시작부터 동일 홀짝 3연속 제거
 *  R15. 1과 2 동시 포함 제거 (구이론)
 *  R16. 4&42, 5&41, 6&40, 7&39, 7&45 동시 포함 제거 (구이론)
 *  R17. 45와 {2,3,4,5,44} 중 하나라도 동시 포함 제거 (구이론)
 *
 * 검증: 위 규칙만 적용 시 3,213,513개 / winners.json(1228회) 제외 시 3,213,029개
 *       — 업로드된 lotto_survivors.xlsx 기반 최종본과 완전 일치 확인.
 */

import winnersRaw from "./data/winners.json";

/** C(45,6) 전체 조합 수 */
export const TOTAL_COMBINATIONS = 8145060;

/** 규칙만 적용한 마스터 풀 크기 (역대 당첨 제외 전) */
export const MASTER_POOL_RULES_TOTAL = 3213513;

/** winners.json(1228회) 기준 역대 당첨 제외 후 마스터 풀 크기 */
export const MASTER_POOL_TOTAL = 3213029;

// 역대 1등 당첨번호를 "정렬된 6개 번호의 키 문자열" 집합으로 변환
const WINNER_SET: Set<string> = new Set(
  (winnersRaw as number[][]).map((nums) =>
    [...nums].sort((a, b) => a - b).join(","),
  ),
);

/** winners.json 에 포함된 역대 1등 당첨 조합인지 */
export function isBaseWinner(combo: number[]): boolean {
  return WINNER_SET.has([...combo].sort((a, b) => a - b).join(","));
}

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
 * 규칙(R2~R17)만 검사 — 역대 당첨(R1) 검사는 하지 않는다.
 * (당첨 제외는 배분 시 winners.json + DB 최신 당첨을 합쳐 동적으로 처리)
 */
export function passesRules(input: number[]): boolean {
  if (input.length !== 6) return false;
  const combo = [...input].sort((a, b) => a - b);

  // 유효성: 1~45, 중복 없음
  for (let i = 0; i < 6; i++) {
    if (combo[i] < 1 || combo[i] > 45) return false;
    if (i > 0 && combo[i] === combo[i - 1]) return false;
  }

  const s = new Set(combo);

  // R2: 홀수 5개 이상 / 짝수 5개 이상
  const odd = combo.reduce((acc, n) => acc + (n % 2 === 1 ? 1 : 0), 0);
  if (odd >= 5 || odd <= 1) return false;

  // R3: 교대 패턴
  const parity = combo.map((n) => (n % 2 === 1 ? "1" : "0")).join("");
  if (parity === "101010" || parity === "010101") return false;

  // R4: 같은 끝자리 3회 이상
  const lastDigitCount = new Array<number>(10).fill(0);
  for (const n of combo) lastDigitCount[n % 10] += 1;
  if (Math.max(...lastDigitCount) >= 3) return false;

  // R5: 1 & 45
  if (s.has(1) && s.has(45)) return false;

  // R6 + R7: 번호대 1개 또는 2개
  const bandCounts = [0, 0, 0, 0, 0];
  for (const n of combo) bandCounts[band(n)] += 1;
  const nBands = bandCounts.filter((c) => c > 0).length;
  if (nBands <= 2) return false;

  // R8: 연속 3개 이상
  if (maxConsecutiveRun(combo) >= 3) return false;

  // R9: 한 번호대 4개 이상
  if (Math.max(...bandCounts) >= 4) return false;

  // R10: 첫 숫자 끝자리 == 마지막 숫자 끝자리
  if (combo[0] % 10 === combo[5] % 10) return false;

  // R11 / R12: 2&44, 3&43
  if (s.has(2) && s.has(44)) return false;
  if (s.has(3) && s.has(43)) return false;

  // R13: 39~45 중 3개 이상
  let highCount = 0;
  for (const n of combo) if (n >= 39) highCount += 1;
  if (highCount >= 3) return false;

  // R14: 시작부터 동일 홀짝 3연속
  if (leadingSameParityRun(combo) >= 3) return false;

  // R15: 1 & 2
  if (s.has(1) && s.has(2)) return false;

  // R16: 4&42, 5&41, 6&40, 7&39, 7&45
  if (
    (s.has(4) && s.has(42)) ||
    (s.has(5) && s.has(41)) ||
    (s.has(6) && s.has(40)) ||
    (s.has(7) && s.has(39)) ||
    (s.has(7) && s.has(45))
  )
    return false;

  // R17: 45와 {2,3,4,5,44} 동시 포함
  if (s.has(45) && (s.has(2) || s.has(3) || s.has(4) || s.has(5) || s.has(44)))
    return false;

  return true;
}

/**
 * combo: 길이 6, 1~45, 중복 없는 번호 배열 (정렬 여부 무관)
 * 규칙 통과 + winners.json 역대 당첨 제외까지 검사 (구버전 호환용).
 */
export function inPool(input: number[]): boolean {
  if (!passesRules(input)) return false;
  const combo = [...input].sort((a, b) => a - b);
  if (WINNER_SET.has(combo.join(","))) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* 조합 랭킹/언랭킹 (사전식) — 전체 8,145,060 조합에 0-based 번호 부여 */
/* ------------------------------------------------------------------ */

/** 이항계수 테이블 C[n][k] (n<=45, k<=6) */
const BINOM: number[][] = (() => {
  const t: number[][] = [];
  for (let n = 0; n <= 45; n++) {
    t.push(new Array<number>(7).fill(0));
    t[n][0] = 1;
    for (let k = 1; k <= Math.min(n, 6); k++) {
      t[n][k] = t[n - 1][k - 1] + (n - 1 >= k ? t[n - 1][k] : 0);
    }
  }
  return t;
})();

/**
 * 0-based 인덱스(0 ~ 8,145,059)를 사전식 조합(오름차순 number[6])으로 변환.
 * 예) 0 → [1,2,3,4,5,6], 8145059 → [40,41,42,43,44,45]
 */
export function unrankCombo(index: number): number[] {
  let idx = index;
  const combo: number[] = [];
  let prev = 0;
  for (let pos = 0; pos < 6; pos++) {
    const slotsLeft = 6 - pos - 1; // 이 자리 뒤에 더 뽑아야 하는 개수
    for (let v = prev + 1; v <= 45; v++) {
      const cnt = BINOM[45 - v][slotsLeft];
      if (idx < cnt) {
        combo.push(v);
        prev = v;
        break;
      }
      idx -= cnt;
    }
  }
  return combo;
}

/* ------------------------------------------------------------------ */
/* 기존 호환 유틸                                                       */
/* ------------------------------------------------------------------ */

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
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) break;
    idx[i] += 1;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

/**
 * 운영자 지정번호 집합에서 만들 수 있는 6조합 중 마스터 풀에 속하는 것만 반환.
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
