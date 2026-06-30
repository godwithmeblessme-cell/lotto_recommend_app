import { describe, it, expect } from "vitest";
import { seededShuffle } from "./allocation";
import { inPool, poolCombosFromPicks, comboKey } from "@shared/lottoPool";
import { getWeekId, isReleaseWindow, kstDateString } from "@shared/week";

describe("seededShuffle", () => {
  it("같은 시드는 동일한 순열을 생성한다 (결정적)", () => {
    const a = seededShuffle(50, 12345);
    const b = seededShuffle(50, 12345);
    expect(a).toEqual(b);
  });

  it("0..n-1 의 순열이다 (누락/중복 없음)", () => {
    const arr = seededShuffle(100, 999);
    const sorted = [...arr].sort((x, y) => x - y);
    expect(sorted).toEqual(Array.from({ length: 100 }, (_, i) => i));
  });

  it("다른 시드는 (대개) 다른 순열을 만든다", () => {
    const a = seededShuffle(50, 1);
    const b = seededShuffle(50, 2);
    expect(a).not.toEqual(b);
  });
});

describe("inPool 필터", () => {
  it("역대 당첨/제외 규칙: 45 포함 조합은 풀에 없다", () => {
    expect(inPool([1, 2, 3, 4, 5, 45])).toBe(false);
  });

  it("44 포함 조합은 풀에 없다", () => {
    expect(inPool([1, 11, 21, 31, 12, 44])).toBe(false);
  });

  it("모두 홀수 조합은 풀에 없다", () => {
    expect(inPool([1, 3, 5, 7, 9, 11])).toBe(false);
  });

  it("poolCombosFromPicks 결과는 모두 inPool 을 통과한다", () => {
    const picks = [1, 5, 8, 12, 17, 23, 28, 33, 38];
    const combos = poolCombosFromPicks(picks);
    for (const c of combos) {
      expect(inPool(c)).toBe(true);
    }
  });
});

describe("comboKey", () => {
  it("정렬 무관하게 동일 키를 만든다", () => {
    expect(comboKey([5, 1, 3, 2, 4, 6])).toBe(comboKey([6, 5, 4, 3, 2, 1]));
  });
});

describe("week 유틸", () => {
  it("getWeekId 는 YYYY-Www 형식이다", () => {
    expect(getWeekId(Date.now())).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("kstDateString 는 YYYY-MM-DD 형식이다", () => {
    expect(kstDateString(Date.now())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("일요일(KST)은 방출 불가", () => {
    // 2026-06-14 는 일요일. KST 정오 → UTC 03:00
    const sunNoonKstUtc = Date.UTC(2026, 5, 14, 3, 0, 0);
    expect(isReleaseWindow(sunNoonKstUtc)).toBe(false);
  });

  it("토요일 20시(KST)는 방출 불가", () => {
    // 2026-06-13 토요일 20:00 KST → UTC 11:00
    const satEveKstUtc = Date.UTC(2026, 5, 13, 11, 0, 0);
    expect(isReleaseWindow(satEveKstUtc)).toBe(false);
  });

  it("토요일 18시(KST)는 방출 가능", () => {
    // 2026-06-13 토요일 18:00 KST → UTC 09:00
    const satDayKstUtc = Date.UTC(2026, 5, 13, 9, 0, 0);
    expect(isReleaseWindow(satDayKstUtc)).toBe(true);
  });

  it("수요일(KST)은 방출 가능", () => {
    const wedKstUtc = Date.UTC(2026, 5, 10, 3, 0, 0);
    expect(isReleaseWindow(wedKstUtc)).toBe(true);
  });
});
