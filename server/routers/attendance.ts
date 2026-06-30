import { protectedProcedure, router } from "../_core/trpc";
import {
  getAttendance,
  getRecentAttendanceDates,
  getMonthAttendance,
  insertAttendance,
  getPublishedWeeklyPick,
} from "../db";
import { kstDateString, getWeekId, isReleaseWindow } from "@shared/week";
import { allocateForUser } from "../allocation";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

/** KST 날짜 문자열 배열로 연속 출석 일수 계산 */
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

/**
 * 연속 출석 보너스 계산
 * - 15일 연속 → +5개
 * - 30일 연속 → +10개 (15일 보너스 대신 30일 보너스 적용)
 */
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

export const attendanceRouter = router({
  /** 오늘 출석 상태 + 이번 달 캘린더 데이터 */
  status: protectedProcedure
    .input(z.object({ yearMonth: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const today = kstDateString();
      const yearMonth = input.yearMonth ?? today.slice(0, 7); // "2026-06"

      const todayRecord = await getAttendance(ctx.user.id, today);
      const recentDates = await getRecentAttendanceDates(ctx.user.id, 35);

      // streak: 오늘 출석했으면 오늘 포함, 아니면 어제까지
      const streakBase = todayRecord ? today : (() => {
        const d = new Date(today + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().slice(0, 10);
      })();
      const streak = computeStreak(recentDates, streakBase);

      const monthRecords = await getMonthAttendance(ctx.user.id, yearMonth);
      const attendedDates = monthRecords.map((r) => r.attendDate);

      // 다음 보너스 정보
      const nextStreak15 = 15 - (streak % 15 === 0 ? 15 : streak % 15);
      const nextStreak30 = 30 - (streak % 30 === 0 ? 30 : streak % 30);

      return {
        checkedInToday: !!todayRecord,
        streak,
        attendedDates,
        todayRecord: todayRecord
          ? {
              combosGranted: todayRecord.combosGranted,
              bonusType: todayRecord.bonusType,
            }
          : null,
        nextMilestone: {
          streak15In: nextStreak15,
          streak30In: nextStreak30,
        },
      };
    }),

  /** 출석 체크 → 번호 조합 지급 */
  checkIn: protectedProcedure.mutation(async ({ ctx }) => {
    const today = kstDateString();

    // 중복 체크
    const existing = await getAttendance(ctx.user.id, today);
    if (existing) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "오늘은 이미 출석 체크를 완료했습니다.",
      });
    }

    // 방출 시간 체크
    if (!isReleaseWindow()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "지금은 번호 방출 시간이 아닙니다. (월~토 오후 7시까지 가능)",
      });
    }

    // 이번 주 게시된 번호 풀 확인
    const weekId = getWeekId();
    const pick = await getPublishedWeeklyPick(weekId);
    if (!pick || (pick.combos as number[][]).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "이번 주 분석 번호가 아직 준비되지 않았습니다.",
      });
    }

    // 연속 출석 계산
    const recentDates = await getRecentAttendanceDates(ctx.user.id, 35);
    // 어제까지의 streak 에 오늘을 더함
    const yesterday = (() => {
      const d = new Date(today + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const prevStreak = computeStreak(recentDates, yesterday);
    const streak = prevStreak + 1;

    // 보너스 계산
    const { bonusCombos, bonusType } = calcBonus(streak);
    const totalCombos = 1 + bonusCombos;

    // 번호 배분
    const result = await allocateForUser(
      weekId,
      ctx.user.id,
      totalCombos,
      pick.combos as number[][],
      "free",
    );

    // 출석 기록 저장
    await insertAttendance({
      userId: ctx.user.id,
      attendDate: today,
      streakCount: streak,
      combosGranted: totalCombos,
      bonusType,
    });

    return {
      success: true,
      streak,
      combosGranted: totalCombos,
      bonusType,
      bonusCombos,
      combos: result.combos,
      weekId,
    };
  }),
});
