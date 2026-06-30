import { describe, it, expect } from "vitest";
import {
  PLANS,
  combosForPlan,
  computeEndAt,
} from "@shared/plans";

describe("combosForPlan — 등급별 주간 조합 수", () => {
  it("1개월 플랜은 주 20개 조합을 반환한다", () => {
    expect(combosForPlan("month")).toBe(20);
  });

  it("1년 플랜은 주 50개 조합을 반환한다", () => {
    expect(combosForPlan("year")).toBe(50);
  });

  it("PLANS 객체와 combosForPlan 결과가 일치한다", () => {
    expect(combosForPlan("month")).toBe(PLANS.month.combosPerWeek);
    expect(combosForPlan("year")).toBe(PLANS.year.combosPerWeek);
  });
});

describe("computeEndAt — 구독 종료 시각", () => {
  const start = 1_700_000_000_000;
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  it("1개월 플랜은 4주 후 종료된다", () => {
    expect(computeEndAt("month", start)).toBe(start + 4 * WEEK);
  });

  it("1년 플랜은 52주 후 종료된다", () => {
    expect(computeEndAt("year", start)).toBe(start + 52 * WEEK);
  });
});

describe("PLANS 상수 — 플랜 구조 검증", () => {
  it("1개월 플랜 가격은 5500원이다", () => {
    expect(PLANS.month.priceKRW).toBe(5500);
  });

  it("1년 플랜 가격은 11000원이다", () => {
    expect(PLANS.year.priceKRW).toBe(11000);
  });

  it("trial(무료체험) 플랜은 가격이 0원이고 1주짜리다", () => {
    expect(PLANS.trial.priceKRW).toBe(0);
    expect(PLANS.trial.durationWeeks).toBe(1);
    expect(PLANS.trial.combosPerWeek).toBe(10);
  });

  it("유료 플랜(month/year)은 모두 가격이 0보다 크다", () => {
    for (const id of ["month", "year"] as const) {
      const plan = PLANS[id];
      expect(plan.id).toBeTruthy();
      expect(plan.name).toBeTruthy();
      expect(plan.combosPerWeek).toBeGreaterThan(0);
      expect(plan.durationWeeks).toBeGreaterThan(0);
      expect(plan.priceKRW).toBeGreaterThan(0);
      expect(plan.playProductId).toBeTruthy();
    }
  });
});
