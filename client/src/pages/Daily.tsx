import { AppShell } from "@/components/AppShell";
import { LoginGate } from "@/components/LoginGate";
import { ComboRow } from "@/components/LottoBalls";
import { PageWrapper, SkeletonCard } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CheckCircle2, Flame, Gift, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** KST 기준 오늘 날짜 "YYYY-MM-DD" */
function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** 이번 달 캘린더 날짜 배열 생성 */
function buildCalendar(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${yearMonth}-${String(d).padStart(2, "0")}`;
  });
}

export default function Daily() {
  const { isAuthenticated, loading } = useAuth();
  const today = todayKST();
  const yearMonth = today.slice(0, 7);

  const utils = trpc.useUtils();
  const status = trpc.attendance.status.useQuery(
    { yearMonth },
    { enabled: isAuthenticated },
  );

  const [showCombos, setShowCombos] = useState(false);

  const checkIn = trpc.attendance.checkIn.useMutation({
    onSuccess: (data) => {
      utils.attendance.status.invalidate();
      utils.recommend.myWeekly.invalidate();
      setShowCombos(true);
      if (data.bonusType === "streak30") {
        toast.success(
          `🎉 ${data.streak}일 연속 출석! 번호 조합 ${data.combosGranted}개 지급!`,
          { description: "+10개 보너스 달성!" },
        );
      } else if (data.bonusType === "streak15") {
        toast.success(
          `🔥 ${data.streak}일 연속 출석! 번호 조합 ${data.combosGranted}개 지급!`,
          { description: "+5개 보너스 달성!" },
        );
      } else {
        toast.success("출석 완료! 번호 조합 1개 지급됐어요.");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const calendarDays = buildCalendar(yearMonth);
  const attendedSet = new Set(status.data?.attendedDates ?? []);

  return (
    <AppShell>
      <PageWrapper className="space-y-4 px-4 py-5">
        <div>
          <h1 className="text-xl font-extrabold">무료 혜택</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            매일 출석하면 번호 조합을 드려요. 연속 출석 보너스도 있어요!
          </p>
        </div>

        {!isAuthenticated && !loading && <LoginGate />}

        {isAuthenticated && status.isLoading && <SkeletonCard />}

        {isAuthenticated && status.data && (
          <>
            {/* 연속 출석 배지 */}
            <Card className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Flame className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-extrabold">
                  {status.data.streak}일 연속 출석 중
                </p>
                <p className="text-xs text-muted-foreground">
                  {status.data.nextMilestone.streak15In > 0
                    ? `15일 보너스까지 ${status.data.nextMilestone.streak15In}일 남았어요`
                    : `30일 보너스까지 ${status.data.nextMilestone.streak30In}일 남았어요`}
                </p>
              </div>
              {status.data.checkedInToday && (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
              )}
            </Card>

            {/* 보너스 안내 */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="flex flex-col items-center gap-1 p-3 text-center">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <p className="text-xs font-semibold">15일 연속</p>
                <p className="text-[11px] text-muted-foreground">
                  번호 조합 +5개 보너스
                </p>
              </Card>
              <Card className="flex flex-col items-center gap-1 p-3 text-center">
                <Trophy className="h-5 w-5 text-amber-400" />
                <p className="text-xs font-semibold">30일 연속</p>
                <p className="text-[11px] text-muted-foreground">
                  번호 조합 +10개 보너스
                </p>
              </Card>
            </div>

            {/* 출석 체크 버튼 / 완료 상태 */}
            {!status.data.checkedInToday ? (
              <Button
                className="w-full"
                size="lg"
                disabled={checkIn.isPending}
                onClick={() => checkIn.mutate()}
              >
                {checkIn.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    출석 처리 중...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    오늘 출석 체크하기
                  </span>
                )}
              </Button>
            ) : (
              <Card className="flex flex-col items-center gap-2 p-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <p className="font-semibold">오늘 출석 완료!</p>
                <p className="text-sm text-muted-foreground">
                  번호 조합{" "}
                  <span className="font-bold text-primary">
                    {status.data.todayRecord?.combosGranted ?? 1}개
                  </span>{" "}
                  지급됐어요.
                  {status.data.todayRecord?.bonusType !== "none" && (
                    <span className="ml-1 text-yellow-500">
                      {status.data.todayRecord?.bonusType === "streak30"
                        ? "🎉 30일 보너스!"
                        : "🔥 15일 보너스!"}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  내일 다시 와서 또 받아요!
                </p>
              </Card>
            )}

            {/* 출석 직후 받은 번호 조합 표시 */}
            {checkIn.isSuccess && checkIn.data.combos.length > 0 && (
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    지급된 번호 조합 ({checkIn.data.combos.length}개)
                  </p>
                  <button
                    className="text-xs text-primary underline"
                    onClick={() => setShowCombos((v) => !v)}
                  >
                    {showCombos ? "접기" : "펼치기"}
                  </button>
                </div>
                {showCombos && (
                  <div className="space-y-2">
                    {checkIn.data.combos.map((combo, i) => (
                      <ComboRow key={i} combo={combo} />
                    ))}
                  </div>
                )}
                {!showCombos && (
                  <p className="text-xs text-muted-foreground">
                    분석번호 탭에서도 확인할 수 있어요.
                  </p>
                )}
              </Card>
            )}

            {/* 이번 달 출석 캘린더 */}
            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold">
                {yearMonth.replace("-", "년 ")}월 출석 현황
              </p>
              <div className="grid grid-cols-7 gap-1">
                {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-medium text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
                {/* 첫 날 요일 오프셋 */}
                {Array.from(
                  {
                    length: new Date(
                      calendarDays[0] + "T00:00:00",
                    ).getDay(),
                  },
                  (_, i) => <div key={`empty-${i}`} />,
                )}
                {calendarDays.map((date) => {
                  const dayNum = Number(date.slice(8));
                  const attended = attendedSet.has(date);
                  const isToday = date === today;
                  return (
                    <div
                      key={date}
                      className={cn(
                        "flex h-8 w-full items-center justify-center rounded-full text-xs font-medium transition-colors",
                        attended
                          ? "bg-primary text-primary-foreground"
                          : isToday
                            ? "border border-primary text-primary"
                            : "text-muted-foreground",
                      )}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </PageWrapper>
    </AppShell>
  );
}
