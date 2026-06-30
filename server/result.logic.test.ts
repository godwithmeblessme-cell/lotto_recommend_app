/**
 * 당첨 등수 계산 로직 단위 테스트
 */
import { describe, it, expect } from "vitest";
import { calcRank, rankLabel } from "./routers/result";

const WIN = [3, 13, 24, 35, 40, 42];
const BONUS = 7;

describe("calcRank — 등수 계산", () => {
  it("6개 일치 → 1등", () => {
    const { rank, matchCount } = calcRank([3, 13, 24, 35, 40, 42], WIN, BONUS);
    expect(rank).toBe(1);
    expect(matchCount).toBe(6);
  });

  it("5개 일치 + 보너스 → 2등", () => {
    const { rank, matchCount, hasBonus } = calcRank([3, 7, 13, 24, 35, 40], WIN, BONUS);
    // 7은 WIN에 없고 BONUS임
    expect(matchCount).toBe(5);
    expect(hasBonus).toBe(true);
    expect(rank).toBe(2);
  });

  it("5개 일치, 보너스 없음 → 3등", () => {
    const { rank, matchCount, hasBonus } = calcRank([3, 13, 24, 35, 40, 1], WIN, BONUS);
    expect(matchCount).toBe(5);
    expect(hasBonus).toBe(false);
    expect(rank).toBe(3);
  });

  it("4개 일치 → 4등", () => {
    const { rank } = calcRank([3, 13, 24, 35, 1, 2], WIN, BONUS);
    expect(rank).toBe(4);
  });

  it("3개 일치 → 5등", () => {
    const { rank } = calcRank([3, 13, 24, 1, 2, 4], WIN, BONUS);
    expect(rank).toBe(5);
  });

  it("2개 일치 → 미당첨 (null)", () => {
    const { rank } = calcRank([3, 13, 1, 2, 4, 5], WIN, BONUS);
    expect(rank).toBeNull();
  });

  it("1개 일치 → 미당첨 (null)", () => {
    const { rank } = calcRank([3, 1, 2, 4, 5, 6], WIN, BONUS);
    expect(rank).toBeNull();
  });

  it("0개 일치 → 미당첨 (null)", () => {
    const { rank } = calcRank([1, 2, 4, 5, 6, 8], WIN, BONUS);
    expect(rank).toBeNull();
  });

  it("보너스만 일치 (5개 미일치) → 미당첨", () => {
    // 5개 일치 + 보너스가 아니면 2등 아님
    const { rank } = calcRank([7, 1, 2, 4, 5, 6], WIN, BONUS);
    expect(rank).toBeNull();
  });
});

describe("rankLabel — 등수 라벨", () => {
  it("1등 → '1등'", () => expect(rankLabel(1)).toBe("1등"));
  it("5등 → '5등'", () => expect(rankLabel(5)).toBe("5등"));
  it("null → '미당첨'", () => expect(rankLabel(null)).toBe("미당첨"));
});

describe("calcRank — 경계 케이스", () => {
  it("번호 순서가 달라도 동일하게 계산", () => {
    // 역순으로 넣어도 동일 결과
    const { rank } = calcRank([42, 40, 35, 24, 13, 3], WIN, BONUS);
    expect(rank).toBe(1);
  });

  it("보너스 번호가 당첨번호에 포함된 경우 — 5개 일치 + 보너스 중복 없음", () => {
    // 실제로 서버에서 보너스 ∉ winNumbers 를 검증하지만, 클라이언트 로직도 안전해야 함
    const fakeBonus = 3; // WIN에 포함된 번호를 보너스로 가정
    const { rank } = calcRank([3, 13, 24, 35, 40, 1], WIN, fakeBonus);
    // 5개 일치, hasBonus = true (3이 combo에 있고 fakeBonus=3)
    // 하지만 3은 winNumbers에도 있으므로 matchCount=5, hasBonus=true → 2등
    expect(rank).toBe(2);
  });
});
