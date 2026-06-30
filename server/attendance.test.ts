/**
 * 출석 체크 로직 단위 테스트
 *
 * - streak 계산 함수
 * - 보너스 계산 함수
 */
import { describe, it, expect } from "vitest";

/** 연속 출석 일수 계산 (attendance 라우터 내부 로직 복사) */
function computeStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  let streak = 0;
  let cursor = today;
  while (set.has(cursor)) {
    streak += 1;
    const d = new Date(cursor + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

/** 보너스 계산 (attendance 라우터 내부 로직 복사) */
function calcBonus(streak: number): {
  bonusCombos: number;
  bonusType: "none" | "streak15" | "streak30";
} {
  if (streak > 0 && streak % 30 === 0) {
    return { bonusCombos: 10, bonusType: "streak30" };
  }
  if (streak > 0 && streak % 15 === 0) {
    return { bonusCombos: 5, bonusType: "streak15" };
  }
  return { bonusCombos: 0, bonusType: "none" };
}

describe("출석 streak 계산", () => {
  it("오늘만 출석하면 streak=1", () => {
    expect(computeStreak(["2026-06-16"], "2026-06-16")).toBe(1);
  });

  it("연속 3일 출석하면 streak=3", () => {
    const dates = ["2026-06-14", "2026-06-15", "2026-06-16"];
    expect(computeStreak(dates, "2026-06-16")).toBe(3);
  });

  it("중간에 하루 빠지면 streak은 최근 연속만 계산", () => {
    // 14일, 16일 출석 (15일 빠짐) → 오늘(16일) 기준 streak=1
    const dates = ["2026-06-14", "2026-06-16"];
    expect(computeStreak(dates, "2026-06-16")).toBe(1);
  });

  it("오늘 출석 안 했으면 streak=0", () => {
    const dates = ["2026-06-14", "2026-06-15"];
    expect(computeStreak(dates, "2026-06-16")).toBe(0);
  });

  it("30일 연속 출석하면 streak=30", () => {
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date("2026-06-16T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    expect(computeStreak(dates, "2026-06-16")).toBe(30);
  });
});

describe("출석 보너스 계산", () => {
  it("streak=1: 보너스 없음", () => {
    const r = calcBonus(1);
    expect(r.bonusCombos).toBe(0);
    expect(r.bonusType).toBe("none");
  });

  it("streak=14: 보너스 없음", () => {
    const r = calcBonus(14);
    expect(r.bonusCombos).toBe(0);
    expect(r.bonusType).toBe("none");
  });

  it("streak=15: +5개 보너스", () => {
    const r = calcBonus(15);
    expect(r.bonusCombos).toBe(5);
    expect(r.bonusType).toBe("streak15");
  });

  it("streak=29: 보너스 없음", () => {
    const r = calcBonus(29);
    expect(r.bonusCombos).toBe(0);
    expect(r.bonusType).toBe("none");
  });

  it("streak=30: +10개 보너스 (streak30 우선)", () => {
    const r = calcBonus(30);
    expect(r.bonusCombos).toBe(10);
    expect(r.bonusType).toBe("streak30");
  });

  it("streak=45: +5개 보너스 (15의 배수)", () => {
    const r = calcBonus(45);
    expect(r.bonusCombos).toBe(5);
    expect(r.bonusType).toBe("streak15");
  });

  it("streak=60: +10개 보너스 (30의 배수)", () => {
    const r = calcBonus(60);
    expect(r.bonusCombos).toBe(10);
    expect(r.bonusType).toBe("streak30");
  });
});
