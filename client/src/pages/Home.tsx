import { AppShell } from "@/components/AppShell";
import { LoginGate } from "@/components/LoginGate";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Gift, Crown, Coins, ChevronRight } from "lucide-react";
import { PLANS, type PlanId, DISCLAIMER } from "@shared/plans";
import { WinResultPopup } from "@/components/WinResultPopup";
import { PageWrapper, SkeletonCard, SkeletonHero } from "@/components/PageWrapper";

function StatusBanner() {
  const { data } = trpc.recommend.weekStatus.useQuery();
  if (!data) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        data.open
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-accent/40 bg-accent/10 text-foreground"
      }`}
    >
      <p className="font-semibold">
        {data.open ? "🟢 이번 주 번호 방출 중" : "🟠 다음 주 번호 준비 중"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{data.notice}</p>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, loading, user } = useAuth();
  const sub = trpc.subscription.current.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const points = trpc.points.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const attendance = trpc.attendance.status.useQuery(
    { yearMonth: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7) },
    { enabled: isAuthenticated },
  );
  const weekly = trpc.recommend.myWeekly.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const weeklySummary = (() => {
    const w = weekly.data;
    if (!w) return null;
    if (!w.locked)
      return `이번 주 분석 ${w.combos.length}조합이 준비됐어요`;
    if (w.reason === "no_subscription") return "구독하면 이번 주 분석을 받아요";
    if (w.reason === "closed_window") return "다음 주 번호 준비 중";
    return "이번 주 분석 번호가 곳 공개됩니다";
  })();

  // 첫 로딩 스켈레톤
  const isFirstLoad = loading || (isAuthenticated && sub.isLoading && points.isLoading);
  const checkedInToday = attendance.data?.checkedInToday ?? false;
  const streak = attendance.data?.streak ?? 0;

  if (isFirstLoad) {
    return (
      <AppShell>
        <div className="space-y-4 px-4 py-5">
          <SkeletonHero />
          <SkeletonCard />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </div>
          <SkeletonCard lines={2} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* 당첨 결과 팝업 — 토요일 추첨 후 접속 시 자동 노출 */}
      <WinResultPopup />
      <PageWrapper className="space-y-4 px-4 py-5">
        {/* 히어로 */}
        <Card className="tiger-gradient relative overflow-hidden border-0 p-5 text-[#1a1407]">
          <div className="relative z-10">
            <p className="text-xs font-semibold opacity-80">
              바른생활 사나이 타이거마스크의
            </p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight">
              이번 주 분석 번호
            </h1>
            <p className="mt-2 text-sm font-medium opacity-90">
              타이거마스크가 직접 선별한 통계 분석 참고 번호에요.
            </p>
            <Link href="/recommend">
              <Button className="mt-4 bg-[#1a1407] text-primary hover:bg-[#2a2110]">
                내 분석번호 보기 <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <span className="pointer-events-none absolute -right-3 -top-3 text-[7rem] opacity-20">
            🐯
          </span>
        </Card>

        <StatusBanner />

        {!isAuthenticated && !loading && (
          <LoginGate message="로그인하고 회원 전용 분석 번호를 받아요." />
        )}

        {isAuthenticated && (
          <>
            {/* 내 상태 요약 */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Crown className="h-4 w-4 text-primary" />
                  <span className="text-xs">내 등급</span>
                </div>
                <p className="mt-2 text-lg font-bold">
                  {sub.data?.plan
                    ? sub.data.plan.name
                    : "무료 회원"}
                </p>
                {sub.data?.plan && (
                  <p className="text-xs text-muted-foreground">
                    주 {sub.data.plan.combosPerWeek}
                    {sub.data.subscription?.isDouble ? " × 2" : ""}조합
                  </p>
                )}
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-xs">럭키포인트</span>
                </div>
                <p className="mt-2 text-lg font-bold">
                  {(points.data?.balance ?? 0).toLocaleString()}P
                </p>
                <Link href="/points">
                  <span className="text-xs text-primary">적립/교환 →</span>
                </Link>
              </Card>
            </div>

            {/* 이번 주 추천 요약 */}
            <Link href="/recommend">
              <Card className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">이번 주 분석</p>
                    <p className="text-xs text-muted-foreground">
                      {weekly.isLoading
                        ? "불러오는 중..."
                        : (weeklySummary ?? "내 분석번호 확인")}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Card>
            </Link>

            {/* 오늘의 출석 체크 */}
            <Card className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Gift className="h-6 w-6 text-accent" />
                <div>
                  <p className="text-sm font-semibold">오늘 출석 체크</p>
                  <p className="text-xs text-muted-foreground">
                    {checkedInToday
                      ? `${streak}일 연속 출석 완료 ✓`
                      : "출석하면 번호 조합 1개를 드려요"}
                  </p>
                </div>
              </div>
              <Link href="/daily">
                <Button
                  size="sm"
                  variant={checkedInToday ? "outline" : "default"}
                  className={checkedInToday ? "bg-secondary" : ""}
                >
                  {checkedInToday ? "확인" : "출석하기"}
                </Button>
              </Link>
            </Card>

            {/* 구독 유도 (무료 회원) */}
            {!sub.data?.plan && (
              <Card className="border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">
                    구독하면 더 많은 조합을 받아요
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["week1", "month", "year"] as PlanId[]).map((id) => (
                    <Badge
                      key={id}
                      variant="outline"
                      className="border-primary/40 text-xs"
                    >
                      {PLANS[id].name} · 주 {PLANS[id].combosPerWeek}조합
                    </Badge>
                  ))}
                </div>
                <Link href="/subscribe">
                  <Button className="mt-3 w-full" size="sm">
                    구독 플랜 보기
                  </Button>
                </Link>
              </Card>
            )}
          </>
        )}

        {/* 면책 */}
        <p className="px-1 pt-2 text-[10px] leading-relaxed text-muted-foreground">
          {DISCLAIMER}
        </p>
      </PageWrapper>
    </AppShell>
  );
}
