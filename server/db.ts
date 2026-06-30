import { and, desc, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  subscriptions,
  weeklyPicks,
  allocatedCombos,
  allocationCursor,
  pointsLedger,
  dailyClaims,
  pushTokens,
  type InsertSubscription,
  type InsertWeeklyPick,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** DB 미가용 시 명확히 에러 — 비즈니스 로직에서 사용 */
async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/* ----------------------------- users ----------------------------- */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/* -------------------------- subscriptions -------------------------- */

/** 현재 활성 구독 (가장 최근 생성). endAt 만료 자동 갱신은 호출측에서 검사. */
export async function getActiveSubscription(userId: number) {
  const db = await requireDb();
  const now = Date.now();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")),
    )
    .orderBy(desc(subscriptions.createdAt));
  // endAt 이 지난 active 는 무시 (lifetime 은 endAt null)
  const valid = rows.find((r) => r.endAt === null || r.endAt > now);
  return valid;
}

export async function createSubscription(input: InsertSubscription) {
  const db = await requireDb();
  const res = await db.insert(subscriptions).values(input).$returningId();
  return res[0]?.id;
}

export async function expireSubscription(id: number) {
  const db = await requireDb();
  await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(eq(subscriptions.id, id));
}

export async function listUserSubscriptions(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt));
}

/** 동일 구글플레이 purchaseToken 으로 이미 발급된 구독이 있는지 확인 (중복 발급 방지) */
export async function getSubscriptionByPurchaseToken(purchaseToken: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.purchaseToken, purchaseToken))
    .limit(1);
  return rows[0];
}

/* --------------------------- weekly picks --------------------------- */

export async function getWeeklyPick(weekId: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(weeklyPicks)
    .where(eq(weeklyPicks.weekId, weekId))
    .limit(1);
  return rows[0];
}

export async function getPublishedWeeklyPick(weekId: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(weeklyPicks)
    .where(
      and(eq(weeklyPicks.weekId, weekId), eq(weeklyPicks.published, true)),
    )
    .limit(1);
  return rows[0];
}

export async function upsertWeeklyPick(input: InsertWeeklyPick) {
  const db = await requireDb();
  const existing = await getWeeklyPick(input.weekId);
  if (existing) {
    await db
      .update(weeklyPicks)
      .set({
        numbers: input.numbers,
        combos: input.combos,
        poolComboCount: input.poolComboCount,
        published: input.published ?? existing.published,
      })
      .where(eq(weeklyPicks.weekId, input.weekId));
    return existing.id;
  }
  const res = await db.insert(weeklyPicks).values(input).$returningId();
  return res[0]?.id;
}

export async function setWeeklyPublished(weekId: string, published: boolean) {
  const db = await requireDb();
  await db
    .update(weeklyPicks)
    .set({ published })
    .where(eq(weeklyPicks.weekId, weekId));
}

export async function listWeeklyPicks() {
  const db = await requireDb();
  return db.select().from(weeklyPicks).orderBy(desc(weeklyPicks.weekId));
}

/* ------------------------ allocation cursor ------------------------ */

export async function getCursor(weekId: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(allocationCursor)
    .where(eq(allocationCursor.weekId, weekId))
    .limit(1);
  return rows[0];
}

export async function upsertCursor(
  weekId: string,
  nextIndex: number,
  cycleNum: number,
  order: number[],
) {
  const db = await requireDb();
  const existing = await getCursor(weekId);
  if (existing) {
    await db
      .update(allocationCursor)
      .set({ nextIndex, cycleNum, order })
      .where(eq(allocationCursor.weekId, weekId));
  } else {
    await db
      .insert(allocationCursor)
      .values({ weekId, nextIndex, cycleNum, order });
  }
}

/* ----------------------- allocated combos ------------------------- */

export async function getUserAllocations(weekId: string, userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(allocatedCombos)
    .where(
      and(
        eq(allocatedCombos.weekId, weekId),
        eq(allocatedCombos.userId, userId),
      ),
    )
    .orderBy(allocatedCombos.id);
}

export async function insertAllocations(
  rows: (typeof allocatedCombos.$inferInsert)[],
) {
  if (rows.length === 0) return;
  const db = await requireDb();
  await db.insert(allocatedCombos).values(rows);
}

export async function countWeekAllocations(weekId: string) {
  const db = await requireDb();
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(allocatedCombos)
    .where(eq(allocatedCombos.weekId, weekId));
  return Number(rows[0]?.c ?? 0);
}

/* ----------------------------- points ----------------------------- */

export async function getPointsBalance(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${pointsLedger.delta}),0)` })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId));
  return Number(rows[0]?.total ?? 0);
}

export async function addPoints(
  userId: number,
  delta: number,
  reason: string,
  memo?: string,
) {
  const db = await requireDb();
  await db.insert(pointsLedger).values({ userId, delta, reason, memo });
}

export async function listPointsHistory(userId: number, limit = 50) {
  const db = await requireDb();
  return db
    .select()
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId))
    .orderBy(desc(pointsLedger.createdAt))
    .limit(limit);
}

/* --------------------------- daily claims -------------------------- */

export async function getDailyClaim(userId: number, claimDate: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(dailyClaims)
    .where(
      and(
        eq(dailyClaims.userId, userId),
        eq(dailyClaims.claimDate, claimDate),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function insertDailyClaim(
  userId: number,
  claimDate: string,
  claimType: "combo" | "points",
) {
  const db = await requireDb();
  await db.insert(dailyClaims).values({ userId, claimDate, claimType });
}

/** 최근 N일 출석(claim) 날짜 목록 — 연속 출석 계산용 */
export async function getRecentClaimDates(userId: number, limit = 14) {
  const db = await requireDb();
  const rows = await db
    .select({ claimDate: dailyClaims.claimDate })
    .from(dailyClaims)
    .where(eq(dailyClaims.userId, userId))
    .orderBy(desc(dailyClaims.claimDate))
    .limit(limit);
  return rows.map((r) => r.claimDate);
}

/* ---------------------------- push tokens -------------------------- */

export async function upsertPushToken(
  userId: number,
  token: string,
  platform = "toss",
) {
  const db = await requireDb();
  const existing = await db
    .select()
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(pushTokens).values({ userId, token, platform });
  }
}

/* ----------------------------- admin ------------------------------ */

export async function adminStats(weekId: string) {
  const db = await requireDb();
  const [subCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));
  const allocCount = await countWeekAllocations(weekId);
  return {
    activeSubscriptions: Number(subCount?.c ?? 0),
    weekAllocations: allocCount,
  };
}

/* ------------------- admin: 회원별 배분 현황 ------------------- */

/** 해당 주 회원별 배분 조합 수 + 이름 (상위 N명) */
export async function adminWeekAllocationByUser(weekId: string, limit = 100) {
  const db = await requireDb();
  const rows = await db
    .select({
      userId: allocatedCombos.userId,
      name: users.name,
      count: sql<number>`count(*)`,
      maxCycle: sql<number>`max(${allocatedCombos.cycleNum})`,
    })
    .from(allocatedCombos)
    .leftJoin(users, eq(users.id, allocatedCombos.userId))
    .where(eq(allocatedCombos.weekId, weekId))
    .groupBy(allocatedCombos.userId, users.name)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name ?? `회원#${r.userId}`,
    count: Number(r.count),
    maxCycle: Number(r.maxCycle ?? 1),
  }));
}

/** 전체 활성 구독 목록 (회원명 포함, 최신순) */
export async function adminListSubscriptions(limit = 200) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      name: users.name,
      planId: subscriptions.planId,
      isDouble: subscriptions.isDouble,
      status: subscriptions.status,
      source: subscriptions.source,
      startAt: subscriptions.startAt,
      endAt: subscriptions.endAt,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .leftJoin(users, eq(users.id, subscriptions.userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, name: r.name ?? `회원#${r.userId}` }));
}

/** 운영자: 특정 구독의 상태 변경 (수동 조정) */
export async function adminSetSubscriptionStatus(
  id: number,
  status: "active" | "expired" | "cancelled",
) {
  const db = await requireDb();
  await db
    .update(subscriptions)
    .set({ status })
    .where(eq(subscriptions.id, id));
}

/* ------------------------------------------------------------------ */
/* 로또 당첨 결과 헬퍼                                                  */
/* ------------------------------------------------------------------ */
import { lottoResults, type InsertLottoResult } from "../drizzle/schema";

export async function upsertLottoResult(
  input: InsertLottoResult,
): Promise<void> {
  const db = await requireDb();
  await db
    .insert(lottoResults)
    .values(input)
    .onDuplicateKeyUpdate({
      set: {
        round: input.round,
        winNumbers: input.winNumbers,
        bonusNumber: input.bonusNumber,
        published: input.published,
        publishedAt: input.publishedAt,
        updatedAt: new Date(),
      },
    });
}

export async function getLottoResult(weekId: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(lottoResults)
    .where(eq(lottoResults.weekId, weekId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPublishedLottoResult(weekId: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(lottoResults)
    .where(and(eq(lottoResults.weekId, weekId), eq(lottoResults.published, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function setLottoResultPublished(
  weekId: string,
  published: boolean,
): Promise<void> {
  const db = await requireDb();
  await db
    .update(lottoResults)
    .set({ published, publishedAt: published ? Date.now() : null, updatedAt: new Date() })
    .where(eq(lottoResults.weekId, weekId));
}

export async function listLottoResults(limit = 10) {
  const db = await requireDb();
  return db
    .select()
    .from(lottoResults)
    .orderBy(desc(lottoResults.createdAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* 출석 체크 헬퍼 (attendance)                                          */
/* ------------------------------------------------------------------ */
import { attendance, type InsertAttendance } from "../drizzle/schema";

/** 특정 날짜 출석 기록 조회 */
export async function getAttendance(userId: number, attendDate: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(attendance)
    .where(
      and(eq(attendance.userId, userId), eq(attendance.attendDate, attendDate)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** 최근 N일 출석 날짜 목록 (연속 출석 계산용) */
export async function getRecentAttendanceDates(userId: number, limit = 35) {
  const db = await requireDb();
  const rows = await db
    .select({ attendDate: attendance.attendDate })
    .from(attendance)
    .where(eq(attendance.userId, userId))
    .orderBy(desc(attendance.attendDate))
    .limit(limit);
  return rows.map((r) => r.attendDate);
}

/** 이번 달 출석 기록 전체 (캘린더 표시용) */
export async function getMonthAttendance(userId: number, yearMonth: string) {
  const db = await requireDb();
  // yearMonth: "2026-06"
  const rows = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.userId, userId),
        sql`${attendance.attendDate} LIKE ${yearMonth + "-%"}`,
      ),
    )
    .orderBy(attendance.attendDate);
  return rows;
}

/** 출석 기록 삽입 */
export async function insertAttendance(input: InsertAttendance) {
  const db = await requireDb();
  await db.insert(attendance).values(input);
}

/** 전체 출석 수 (streak 계산용 보조) */
export async function getTotalAttendanceCount(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(attendance)
    .where(eq(attendance.userId, userId));
  return Number(rows[0]?.c ?? 0);
}
