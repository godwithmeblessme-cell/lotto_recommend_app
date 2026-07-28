/**
 * 주간 추천 조합 배분 로직.
 *
 * [기존] 운영자 지정번호 기반 소형 풀 배분 (allocateForUser) — 호환 유지
 * [신규] 마스터 풀(약 321만 조합) 전체에서 직접 배분 (allocateFromMasterPool)
 *
 * 신규 방식 개요:
 * - 전체 조합 공간 C(45,6)=8,145,060 에 0~8,145,059 인덱스를 부여(사전식)
 * - (weekId, cycleNum) 시드 기반 Feistel 순열로 인덱스 순서를 매주 무작위 재편성
 *   → 순열이므로 한 사이클 안에서는 절대 중복 배분되지 않음
 *   → 배열을 통째로 만들지 않아 메모리 사용 O(1)
 * - 각 인덱스를 조합으로 복원(unrank)한 뒤 규칙 통과 + 당첨 이력 제외 검사를
 *   통과한 조합만 배분. 통과 못 하면 다음 인덱스로 스킵.
 * - 커서(nextIndex, cycleNum)는 allocation_cursor 테이블에 "M:{weekId}" 키로 저장.
 * - 풀 소진(커서가 끝에 도달) 시 cycleNum+1 로 새 순열을 만들어 자동 재셔플.
 *
 * 동시성: weekId 별 커서 행에 SELECT ... FOR UPDATE 잠금 + 단일 트랜잭션 처리.
 */

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { allocationCursor, allocatedCombos } from "../drizzle/schema";
import {
  comboKey,
  passesRules,
  isBaseWinner,
  unrankCombo,
  TOTAL_COMBINATIONS,
} from "@shared/lottoPool";

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

/** Fisher-Yates 셔플 (시드 결정적) — 기존 소형 풀 배분용 */
export function seededShuffle(n: number, seed: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  const rnd = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildOrder(weekId: string, cycleNum: number, total: number): number[] {
  return seededShuffle(total, seedFromString(`${weekId}#${cycleNum}`));
}

export interface CursorState {
  nextIndex: number;
  cycleNum: number;
  order: number[];
}

export interface ComputeAllocationResult {
  pickedIndices: number[];
  cursor: CursorState;
}

/** [기존] 소형 풀 순수 배분 계산 — 테스트 호환 유지 */
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

/** [기존] 운영자 지정 풀 기반 배분 — 호환 유지 */
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

/* ================================================================== */
/* [신규] 마스터 풀 전체 배분 — Feistel 순열 + 커서                       */
/* ================================================================== */

/** Feistel 도메인: 2^24 (12비트 + 12비트). 8,145,060 < 2^24 */
const FEISTEL_BITS_HALF = 12;
const FEISTEL_MASK = (1 << FEISTEL_BITS_HALF) - 1; // 0xFFF
const FEISTEL_DOMAIN = 1 << (FEISTEL_BITS_HALF * 2); // 16,777,216
const FEISTEL_ROUNDS = 4;

/** 라운드 함수: 시드+라운드 기반 해시 */
function feistelRound(right: number, roundKey: number): number {
  let x = (right ^ roundKey) >>> 0;
  x = Math.imul(x ^ (x >>> 7), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) & FEISTEL_MASK;
}

/** 2^24 도메인 위의 Feistel 순열 1회 적용 */
function feistelOnce(value: number, seed: number): number {
  let left = (value >>> FEISTEL_BITS_HALF) & FEISTEL_MASK;
  let right = value & FEISTEL_MASK;
  for (let r = 0; r < FEISTEL_ROUNDS; r++) {
    const roundKey = (seed + Math.imul(r + 1, 0x9e3779b9)) >>> 0;
    const next = left ^ feistelRound(right, roundKey);
    left = right;
    right = next & FEISTEL_MASK;
  }
  return ((left << FEISTEL_BITS_HALF) | right) >>> 0;
}

/**
 * [0, TOTAL_COMBINATIONS) 위의 결정적 순열.
 * cycle-walking: 결과가 도메인 밖이면 순열을 다시 적용 (평균 약 2회).
 * 순열이므로 pos ≠ pos' 이면 결과도 항상 다르다 → 사이클 내 중복 배분 불가.
 */
export function permutedIndex(pos: number, seed: number): number {
  let x = pos;
  do {
    x = feistelOnce(x, seed);
  } while (x >= TOTAL_COMBINATIONS);
  return x;
}

export interface MasterCursorState {
  nextIndex: number;
  cycleNum: number;
}

export interface ComputeMasterResult {
  picked: number[][];
  cursor: MasterCursorState;
  /** 안전 한도로 중단됐는지 (풀에서 need 만큼 못 뽑은 비정상 상황) */
  truncated: boolean;
}

/**
 * 순수 함수: 마스터 풀에서 need 개 조합 선택 계산 (DB I/O 없음).
 * accept(combo) 가 true 인 조합만 채택하고, 아니면 다음 위치로 스킵.
 */
export function computeMasterAllocation(
  weekId: string,
  need: number,
  cursor: MasterCursorState | undefined,
  accept: (combo: number[]) => boolean,
): ComputeMasterResult {
  let cycleNum = cursor?.cycleNum ?? 1;
  let nextIndex = cursor?.nextIndex ?? 0;
  let seed = seedFromString(`${weekId}#M#${cycleNum}`);

  const picked: number[][] = [];
  // 안전 한도: 통과율 약 39% 기준 넉넉히 (need*20 + 2000)
  let budget = need * 20 + 2000;
  let truncated = false;

  while (picked.length < need) {
    if (budget-- <= 0) {
      truncated = true;
      break;
    }
    if (nextIndex >= TOTAL_COMBINATIONS) {
      // 풀 소진 → 자동 재셔플 (새 사이클)
      cycleNum += 1;
      nextIndex = 0;
      seed = seedFromString(`${weekId}#M#${cycleNum}`);
    }
    const idx = permutedIndex(nextIndex, seed);
    nextIndex += 1;
    const combo = unrankCombo(idx);
    if (accept(combo)) picked.push(combo);
  }

  return { picked, cursor: { nextIndex, cycleNum }, truncated };
}

/** 마스터 풀 배분 커서의 weekId 키 (기존 소형 풀 커서와 분리) */
function masterCursorKey(weekId: string): string {
  return `M:${weekId}`; // varchar(16) 안에 안전하게 들어감 (예: "M:2026-W31")
}

/**
 * [신규] 마스터 풀에서 사용자에게 count 개 조합 배분.
 * - 멱등: 이번 주 이미 배분받았으면 그대로 반환
 * - excludedKeys: DB 최신 당첨번호 등 추가 제외 조합 키 집합 (comboKey 형식)
 * - winners.json 역대 당첨은 isBaseWinner 로 자동 제외
 */
export async function allocateFromMasterPool(
  weekId: string,
  userId: number,
  count: number,
  kind: "subscription" | "free" = "subscription",
  excludedKeys: Set<string> = new Set(),
): Promise<AllocationResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cursorKey = masterCursorKey(weekId);

  return db.transaction(async (tx) => {
    // 1) 멱등: 이미 배분된 조합 확인
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

    // 2) 커서 행 보장 생성 후 FOR UPDATE 잠금 (주 단위 직렬화)
    await tx
      .insert(allocationCursor)
      .values({ weekId: cursorKey, nextIndex: 0, cycleNum: 1, order: [] })
      .onDuplicateKeyUpdate({
        set: { nextIndex: sql`${allocationCursor.nextIndex}` },
      });

    const cursorRows = await tx
      .select()
      .from(allocationCursor)
      .where(eq(allocationCursor.weekId, cursorKey))
      .for("update");
    const cursorRow = cursorRows[0];
    const cursorState: MasterCursorState | undefined = cursorRow
      ? { nextIndex: cursorRow.nextIndex, cycleNum: cursorRow.cycleNum }
      : undefined;

    const need =
      kind === "subscription" ? count - existingOfKind.length : count;

    const accept = (combo: number[]): boolean => {
      if (!passesRules(combo)) return false; // 이론 규칙 (R2~R17)
      if (isBaseWinner(combo)) return false; // R1: winners.json 역대 당첨
      if (excludedKeys.has(comboKey(combo))) return false; // R1: DB 최신 당첨 등
      return true;
    };

    const { picked, cursor: newCursor } = computeMasterAllocation(
      weekId,
      need,
      cursorState,
      accept,
    );

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

    // 4) 커서 갱신
    await tx
      .update(allocationCursor)
      .set({ nextIndex: newCursor.nextIndex, cycleNum: newCursor.cycleNum })
      .where(eq(allocationCursor.weekId, cursorKey));

    const all =
      kind === "subscription"
        ? [...existingOfKind.map((e) => e.combo as number[]), ...picked]
        : picked;

    return { combos: all, cycleNum: newCursor.cycleNum };
  });
}
