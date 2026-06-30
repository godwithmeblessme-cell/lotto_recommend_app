import {
  bigint,
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/* ------------------------------------------------------------------ */
/* 구독 (subscriptions)                                                */
/* ------------------------------------------------------------------ */
export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    /** plans.ts 의 PlanId */
    planId: varchar("planId", { length: 32 }).notNull(),
    /** 2배 결제 옵션 적용 여부 */
    isDouble: boolean("isDouble").default(false).notNull(),
    /** UTC ms */
    startAt: bigint("startAt", { mode: "number" }).notNull(),
    /** UTC ms, lifetime 은 null */
    endAt: bigint("endAt", { mode: "number" }),
    status: mysqlEnum("status", ["active", "expired", "cancelled"])
      .default("active")
      .notNull(),
    /** 결제 출처: google_play | trial | admin (기존 tosspay는 더 이상 사용하지 않음) */
    source: varchar("source", { length: 16 }).default("google_play").notNull(),
    /**
     * 구글 플레이 구매 토큰. 동일 토큰으로 구독이 중복 발급되는 것을 막기 위해 unique.
     * trial/admin 발급은 null.
     */
    purchaseToken: varchar("purchaseToken", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userIdx: index("subs_user_idx").on(t.userId),
    statusIdx: index("subs_status_idx").on(t.status),
    purchaseTokenIdx: uniqueIndex("subs_purchase_token_idx").on(t.purchaseToken),
  }),
);
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/* ------------------------------------------------------------------ */
/* 주간 운영자 지정번호 (weekly_picks)                                 */
/* ------------------------------------------------------------------ */
export const weeklyPicks = mysqlTable(
  "weekly_picks",
  {
    id: int("id").autoincrement().primaryKey(),
    /** 주 식별자: 예) "2026-W25" */
    weekId: varchar("weekId", { length: 16 }).notNull().unique(),
    /** 운영자가 지정한 번호 배열 (1~45) */
    numbers: json("numbers").$type<number[]>().notNull(),
    /** 마스터 풀 교집합 조합 개수 (스냅샷) */
    poolComboCount: int("poolComboCount").default(0).notNull(),
    /** 교집합 조합 전체 (사전식 정렬, number[6][]) — 배분 원본 */
    combos: json("combos").$type<number[][]>().notNull(),
    /** 게시 여부 (true 면 회원에게 노출) */
    published: boolean("published").default(false).notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    weekIdx: uniqueIndex("wp_week_idx").on(t.weekId),
  }),
);
export type WeeklyPick = typeof weeklyPicks.$inferSelect;
export type InsertWeeklyPick = typeof weeklyPicks.$inferInsert;

/* ------------------------------------------------------------------ */
/* 배분된 조합 (allocated_combos)                                      */
/* ------------------------------------------------------------------ */
export const allocatedCombos = mysqlTable(
  "allocated_combos",
  {
    id: int("id").autoincrement().primaryKey(),
    weekId: varchar("weekId", { length: 16 }).notNull(),
    userId: int("userId").notNull(),
    /** 정렬된 6개 번호 */
    combo: json("combo").$type<number[]>().notNull(),
    /** 조합 키 "n1,n2,...,n6" — 중복 배분 방지/조회용 */
    comboKey: varchar("comboKey", { length: 32 }).notNull(),
    /** 무료(daily)인지 구독(subscription)인지 */
    kind: mysqlEnum("kind", ["subscription", "free"])
      .default("subscription")
      .notNull(),
    /** 순환 번호 (풀 소진 시 +1) */
    cycleNum: int("cycleNum").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    weekUserIdx: index("ac_week_user_idx").on(t.weekId, t.userId),
    weekKeyIdx: index("ac_week_key_idx").on(t.weekId, t.comboKey),
  }),
);
export type AllocatedCombo = typeof allocatedCombos.$inferSelect;
export type InsertAllocatedCombo = typeof allocatedCombos.$inferInsert;

/* ------------------------------------------------------------------ */
/* 주간 배분 커서 (allocation_cursor) — 어디까지 나눠줬는지            */
/* ------------------------------------------------------------------ */
export const allocationCursor = mysqlTable(
  "allocation_cursor",
  {
    weekId: varchar("weekId", { length: 16 }).primaryKey(),
    /** 다음에 배분할 조합 인덱스 (현재 cycle 내) */
    nextIndex: int("nextIndex").default(0).notNull(),
    /** 현재 순환 번호 */
    cycleNum: int("cycleNum").default(1).notNull(),
    /** 현재 cycle 에서 사용 중인 셔플 순서 (combos 배열 인덱스 순열) */
    order: json("order").$type<number[]>().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
);
export type AllocationCursor = typeof allocationCursor.$inferSelect;
export type InsertAllocationCursor = typeof allocationCursor.$inferInsert;

/* ------------------------------------------------------------------ */
/* 포인트 원장 (points_ledger)                                         */
/* ------------------------------------------------------------------ */
export const pointsLedger = mysqlTable(
  "points_ledger",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    /** 양수=적립, 음수=차감 */
    delta: int("delta").notNull(),
    /** checkin | streak7 | free_combo | exchange | admin */
    reason: varchar("reason", { length: 32 }).notNull(),
    memo: text("memo"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("pl_user_idx").on(t.userId),
  }),
);
export type PointsEntry = typeof pointsLedger.$inferSelect;
export type InsertPointsEntry = typeof pointsLedger.$inferInsert;

/* ------------------------------------------------------------------ */
/* 매일 무료 혜택 기록 (daily_claims)                                  */
/* ------------------------------------------------------------------ */
export const dailyClaims = mysqlTable(
  "daily_claims",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    /** KST 기준 날짜 "YYYY-MM-DD" */
    claimDate: varchar("claimDate", { length: 10 }).notNull(),
    /** combo = 무료조합 받기 / points = 출석 포인트 */
    claimType: mysqlEnum("claimType", ["combo", "points"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userDateIdx: uniqueIndex("dc_user_date_idx").on(t.userId, t.claimDate),
  }),
);
export type DailyClaim = typeof dailyClaims.$inferSelect;
export type InsertDailyClaim = typeof dailyClaims.$inferInsert;

/* ------------------------------------------------------------------ */
/* 푸시 토큰 (push_tokens)                                             */
/* ------------------------------------------------------------------ */
export const pushTokens = mysqlTable(
  "push_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    token: varchar("token", { length: 512 }).notNull(),
    platform: varchar("platform", { length: 16 }).default("android").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("pt_user_idx").on(t.userId),
  }),
);
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = typeof pushTokens.$inferInsert;

/* ------------------------------------------------------------------ */
/* 로또 당첨 결과 (lotto_results)                                       */
/* ------------------------------------------------------------------ */
export const lottoResults = mysqlTable(
  "lotto_results",
  {
    id: int("id").autoincrement().primaryKey(),
    /** 주 식별자: 예) "2026-W25" */
    weekId: varchar("weekId", { length: 16 }).notNull().unique(),
    /** 회차 번호 (예: 1175) */
    round: int("round").notNull(),
    /** 당첨 번호 6개 (정렬) */
    winNumbers: json("winNumbers").$type<number[]>().notNull(),
    /** 보너스 번호 */
    bonusNumber: int("bonusNumber").notNull(),
    /** 게시 여부 (true 면 사용자에게 노출) */
    published: boolean("published").default(false).notNull(),
    /** 운영자가 입력한 시각 (UTC ms) */
    publishedAt: bigint("publishedAt", { mode: "number" }),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    weekIdx: uniqueIndex("lr_week_idx").on(t.weekId),
  }),
);
export type LottoResult = typeof lottoResults.$inferSelect;
export type InsertLottoResult = typeof lottoResults.$inferInsert;

/* ------------------------------------------------------------------ */
/* 출석 체크 (attendance)                                              */
/* ------------------------------------------------------------------ */
export const attendance = mysqlTable(
  "attendance",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    /** KST 기준 날짜 "YYYY-MM-DD" */
    attendDate: varchar("attendDate", { length: 10 }).notNull(),
    /** 연속 출석 일수 (이 출석 시점의 streak) */
    streakCount: int("streakCount").default(1).notNull(),
    /** 지급된 번호 조합 수 (1 + 보너스) */
    combosGranted: int("combosGranted").default(1).notNull(),
    /** 보너스 타입: none | streak15 | streak30 */
    bonusType: mysqlEnum("bonusType", ["none", "streak15", "streak30"])
      .default("none")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userDateIdx: uniqueIndex("att_user_date_idx").on(t.userId, t.attendDate),
    userIdx: index("att_user_idx").on(t.userId),
  }),
);
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

/* ------------------------------------------------------------------ */
/* 주간 당첨 발표 집계 (weekly_announcements)                          */
/* 매주 일요일 9시(KST) 자동 작업이 1회만 생성 — weekId 가 PK라서      */
/* 같은 주에 작업이 두 번 실행돼도 중복 발송되지 않는다(멱등).         */
/* ------------------------------------------------------------------ */
export const weeklyAnnouncements = mysqlTable("weekly_announcements", {
  weekId: varchar("weekId", { length: 16 }).primaryKey(),
  round: int("round").notNull(),
  rank1Count: int("rank1Count").default(0).notNull(),
  rank2Count: int("rank2Count").default(0).notNull(),
  rank3Count: int("rank3Count").default(0).notNull(),
  rank4Count: int("rank4Count").default(0).notNull(),
  rank5Count: int("rank5Count").default(0).notNull(),
  /** 발송 대상이었던 전체 배분 조합 수 (참고용) */
  totalCombos: int("totalCombos").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WeeklyAnnouncement = typeof weeklyAnnouncements.$inferSelect;
export type InsertWeeklyAnnouncement = typeof weeklyAnnouncements.$inferInsert;

/* ------------------------------------------------------------------ */
/* 공지 닫기 기록 (announcement_dismissals)                            */
/* "1주일간 보지 않기" 클릭 시 해당 회원+주차 조합을 기록한다.         */
/* ------------------------------------------------------------------ */
export const announcementDismissals = mysqlTable(
  "announcement_dismissals",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    weekId: varchar("weekId", { length: 16 }).notNull(),
    dismissedAt: timestamp("dismissedAt").defaultNow().notNull(),
  },
  (t) => ({
    userWeekIdx: uniqueIndex("ad_user_week_idx").on(t.userId, t.weekId),
  }),
);
export type AnnouncementDismissal = typeof announcementDismissals.$inferSelect;
