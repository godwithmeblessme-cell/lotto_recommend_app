import { describe, it, expect } from "vitest";
import { computeAllocation, type CursorState } from "./allocation";

/**
 * computeAllocation 단위 테스트.
 *
 * 기존 allocation.flow.test.ts는 server/db 전체를 vi.mock 으로 흉내내서
 * allocateForUser(DB 트랜잭션 포함)를 통째로 테스트했었다.
 * allocateForUser가 실제 DB 트랜잭션 + FOR UPDATE 잠금을 쓰도록 바뀌면서
 * (동시성 버그 수정), 더 이상 그 방식으로는 의미 있게 테스트할 수 없다.
 *
 * 대신 "무엇을 배분해야 하는가"를 결정하는 순수 로직만 분리해(computeAllocation)
 * DB 없이 직접 테스트한다. 실제 DB 읽기/쓰기/잠금 부분은 코드 리뷰 + 스테이징 환경에서
 * 수동으로 동시 요청을 보내보는 식으로 확인하는 것을 권장한다.
 */

const TOTAL = 100;

describe("computeAllocation 기본 동작", () => {
  it("커서가 없으면 need개만큼 배분하고 커서를 정확히 진행시킨다", () => {
    const r = computeAllocation("2026-W25", TOTAL, 10, undefined);
    expect(r.pickedIndices).toHaveLength(10);
    expect(new Set(r.pickedIndices).size).toBe(10); // 중복 없음
    expect(r.cursor.nextIndex).toBe(10);
    expect(r.cursor.cycleNum).toBe(1);
  });

  it("이전 커서 이후부터 이어서 배분한다 (중복 없음)", () => {
    const first = computeAllocation("2026-W25", TOTAL, 10, undefined);
    const second = computeAllocation("2026-W25", TOTAL, 10, first.cursor);
    const overlap = first.pickedIndices.filter((i) =>
      second.pickedIndices.includes(i),
    );
    expect(overlap).toHaveLength(0);
    expect(second.pickedIndices).toHaveLength(10);
    expect(second.cursor.nextIndex).toBe(20);
  });

  it("cycle 1 도 무작위로 섞인 순서다 (사용자 요청: 처음부터 골고루 무작위 배분)", () => {
    const total = 1000;
    const r = computeAllocation("2026-W25", total, 10, undefined);
    const sortedAsLexicographic = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(r.pickedIndices).not.toEqual(sortedAsLexicographic);
    // 그래도 0..total-1 범위 안의, 중복 없는 값들이어야 한다.
    expect(new Set(r.pickedIndices).size).toBe(10);
    for (const idx of r.pickedIndices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(total);
    }
  });
});

describe("풀 소진 시 셔플 재배분", () => {
  it("풀보다 많이 요청하면 cycle 이 증가한다", () => {
    const small = 10;
    const r = computeAllocation("2026-W25", small, 25, undefined);
    expect(r.pickedIndices).toHaveLength(25);
    expect(r.cursor.cycleNum).toBeGreaterThanOrEqual(3);
  });

  it("cycle 2 의 순서는 cycle 1과 다르다(재믹스)지만 같은 인덱스 집합의 순열이다", () => {
    const small = 10;
    const cycle1 = computeAllocation("2026-W25", small, small, undefined); // 정확히 소진
    const cycle2 = computeAllocation("2026-W25", small, small, cycle1.cursor);
    expect(cycle2.pickedIndices).not.toEqual(cycle1.pickedIndices);
    expect(new Set(cycle2.pickedIndices)).toEqual(new Set(cycle1.pickedIndices));
  });

  it("같은 (weekId, cycleNum) 조합의 셔플은 결정적이다", () => {
    const small = 10;
    const c1a = computeAllocation("2026-W25", small, small, undefined);
    const c2a = computeAllocation("2026-W25", small, small, c1a.cursor);

    const c1b = computeAllocation("2026-W25", small, small, undefined);
    const c2b = computeAllocation("2026-W25", small, small, c1b.cursor);

    expect(c2a.pickedIndices).toEqual(c2b.pickedIndices);
  });
});

describe("need가 0이면 아무것도 배분하지 않는다", () => {
  it("pickedIndices가 빈 배열이고 커서는 그대로", () => {
    const cursor: CursorState = {
      nextIndex: 5,
      cycleNum: 1,
      order: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    };
    const r = computeAllocation("2026-W25", 10, 0, cursor);
    expect(r.pickedIndices).toEqual([]);
    expect(r.cursor).toEqual(cursor);
  });
});
