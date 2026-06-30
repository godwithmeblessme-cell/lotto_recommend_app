/**
 * 주간 추천 조합 배분 로직.
 *
 * 규칙(사용자 확정):
 * - 운영자 지정번호로 만든 마스터 풀 교집합 조합을 사전식 정렬해 둔 원본 배열(weekly_picks.combos)
 * - 회원에게 "중복 없이" 순차 배분. 커서(allocation_cursor)로 진행 위치를 추적.
 * - 풀이 소진되면 순서를 셔플(재믹스)하여 cycleNum 을 올리고 처음부터 다시 배분.
 *
 * 결정성: 셔플은 (weekId, cycleNum) 기반 시드 PRNG 로 재현 가능하게 구성.
 *
 * 동시성 주의:
 * 토요일 추첨 직후처럼 여러 사용자가 동시에 배분을 요청하면, 커서를 읽고 쓰는 사이에
 * 다른 요청이 끼어들어 같은 조합이 두 사람에게 나가는 사고(레이스 컨디션)가 날 수 있다.
 * 이를 막기 위해 weekId 별 커서 행에 `SELECT ... FOR UPDATE` 잠금을 걸고, 같은 DB 트랜잭션
 * 안에서 조회→배분→커서 갱신을 한 번에 처리한다(직렬화).
 */

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { allocationCursor, allocatedCombos } from "../drizzle/schema";
import { comboKey } from "@shared/lottoPool";

/** 결정적 셔플용 시드 PRNG (mulberry32) */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates 셔플 (시드 결정적) */
export function seededShuffle(n: number, seed: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  const rnd = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 초기 순서: cycle 1 은 사전식(원본) 순서 그대로 */
function buildOrder(weekId: string, cycleNum: number, total: number): number[] {
  if (cycleNum <= 1) {
    return Array.from({ length: total }, (_, i) => i);
  }
  return seededShuffle(total, seedFromString(`${weekId}#${cycleNum}`));
}

export interface CursorState {
  nextIndex: number;
  cycleNum: number;
  order: number[];
}

export interface ComputeAllocationResult {
  /** combos 배열에서 배분할 인덱스들 (호출측에서 combos[idx] 로 매핑) */
  pickedIndices: number[];
  cursor: CursorState;
}

/**
 * 순수 함수: DB I/O 없이 "다음에 무엇을 배분해야 하는지"만 계산한다.
 * allocateForUser(아래)가 트랜잭션 안에서 이 함수를 호출해 실제 DB에 반영한다.
 * DB 의존이 없어 테스트하기 쉽다 (allocation.logic.test.ts 참고).
 */
export function computeAllocation(
  weekId: string,
  total: number,
  need: number,
  cursor: CursorState | undefined,
): ComputeAllocationResult {
  let cycleNum = cursor?.cycleNum ?? 1;
  let order = cursor?.order ?? buildOrder(weekId, cycleNum, total);
  let nextIndex = cursor?.nextIndex ?? 0;

  const pickedIndices: number[] = [];
  for (let i = 0; i < need; i++) {
    if (nextIndex >= total) {
      // 풀 소진 → 다음 cycle 로 셔플 재배분
      cycleNum += 1;
      order = buildOrder(weekId, cycleNum, total);
      nextIndex = 0;
    }
    pickedIndices.push(order[nextIndex]);
    nextIndex += 1;
  }

  return {
    pickedIndices,
    cursor: { nextIndex, cycleNum, order },
  };
}

export interface AllocationResult {
  combos: number[][];
  cycleNum: number;
}

/**
 * 한 사용자에게 `count` 개의 조합을 배분.
 * - 이미 이번 주 배분받은 조합이 있으면 그대로 반환(멱등).
 * - 커서를 진행시키며 중복 없이 뽑고, 소진 시 셔플하여 다음 cycle 로 넘어간다.
 * - weekId 단위로 트랜잭션 + 행 잠금을 사용해 동시 요청에도 안전하게 동작한다.
 *
 * @param combos weekly_picks.combos (사전식 정렬된 원본 풀)
 */
export async function allocateForUser(
  weekId: string,
  userId: number,
  count: number,
  combos: number[][],
  kind: "subscription" | "free" = "subscription",
): Promise<AllocationResult> {
  const total = combos.length;
  if (total === 0) return { combos: [], cycleNum: 1 };

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx) => {
    // 1) 이미 배분된 게 있으면 멱등 반환 (subscription 종류 기준)
    const existing = await tx
      .select()
      .from(allocatedCombos)
      .where(
        and(
          eq(allocatedCombos.weekId, weekId),
          eq(allocatedCombos.userId, userId),
        ),
      )
      .orderBy(allocatedCombos.id);
    const existingOfKind = existing.filter((e) => e.kind === kind);
    if (kind === "subscription" && existingOfKind.length >= count) {
      return {
        combos: existingOfKind.slice(0, count).map((e) => e.combo as number[]),
        cycleNum: existingOfKind[0]?.cycleNum ?? 1,
      };
    }

    // 2) 커서 행을 보장 생성한 뒤 FOR UPDATE로 잠금 — 같은 주(weekId)의 동시 배분 요청을 직렬화한다.
    await tx
      .insert(allocationCursor)
      .values({ weekId, nextIndex: 0, cycleNum: 1, order: buildOrder(weekId, 1, total) })
      .onDuplicateKeyUpdate({ set: { nextIndex: sql`${allocationCursor.nextIndex}` } });

    const cursorRows = await tx
      .select()
      .from(allocationCursor)
      .where(eq(allocationCursor.weekId, weekId))
      .for("update");
    const cursorRow = cursorRows[0];
    const cursorState: CursorState | undefined = cursorRow
      ? {
          nextIndex: cursorRow.nextIndex,
          cycleNum: cursorRow.cycleNum,
          order: cursorRow.order as number[],
        }
      : undefined;

    const need = kind === "subscription" ? count - existingOfKind.length : count;
    const { pickedIndices, cursor: newCursor } = computeAllocation(
      weekId,
      total,
      need,
      cursorState,
    );
    const picked = pickedIndices.map((idx) => combos[idx]);

    // 3) 배분 기록 저장
    if (picked.length > 0) {
      await tx.insert(allocatedCombos).values(
        picked.map((combo) => ({
          weekId,
          userId,
          combo,
          comboKey: comboKey(combo),
          kind,
          cycleNum: newCursor.cycleNum,
        })),
      );
    }

    // 4) 커서 갱신 (같은 트랜잭션 + 잠금 내에서 수행되므로 안전)
    await tx
      .update(allocationCursor)
      .set(newCursor)
      .where(eq(allocationCursor.weekId, weekId));

    const all =
      kind === "subscription"
        ? [...existingOfKind.map((e) => e.combo as number[]), ...picked]
        : picked;

    return { combos: all, cycleNum: newCursor.cycleNum };
  });
}
