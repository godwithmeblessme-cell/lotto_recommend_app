import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PLANS, DISCLAIMER, REFUND_POLICY, type PlanId } from "@shared/plans";
import { useState } from "react";
import { useLocation } from "wouter";
import { Crown, Check, X, Flame } from "lucide-react";
import { purchaseSubscription, isPlayBillingAvailable } from "@/lib/playBilling";
import { toast } from "sonner";

interface SubscribeSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SubscribeSheet({ open, onClose }: SubscribeSheetProps) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [showTrial, setShowTrial] = useState(false);

  const purchase = trpc.subscription.purchase.useMutation();
  const claimTrial = trpc.subscription.claimTrial.useMutation();
  const history = trpc.subscription.history.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const hasAnyHistory = (history.data?.length ?? 0) > 0;

  // 선착순 현황 (남은 자리/마감 여부) — 30초마다 자동 갱신
  const pricing = trpc.subscription.pricingStatus.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
  const soldOut = pricing.data?.soldOut ?? false;
  const remaining = pricing.data?.remaining ?? null;
  const soldCount = pricing.data?.soldCount ?? 0;
  const cap = pricing.data?.cap ?? 500;

  const year = PLANS.year;
  const month = PLANS.month;

  function refreshAll() {
    utils.subscription.current.invalidate();
    utils.subscription.history.invalidate();
    utils.recommend.myWeekly.invalidate();
  }

  async function handleBuy(planId: "year" | "month") {
    const plan = PLANS[planId];
    if (!plan.playProductId) return;
    if (!isPlayBillingAvailable()) {
      toast.error(
        "구글 플레이 결제는 Play 스토어로 설치한 안드로이드 앱에서만 가능해요.",
      );
      return;
    }
    // 연 구독: 화면에 로드된 최신 선착순 현황으로 마감 여부 확인
    // (결제창은 버튼 클릭 직후 바로 열려야 하므로 여기서 서버 조회를 하면 안 됨.
    //  정확한 500명 컷은 서버 발급 단계에서 최종 보장된다.)
    if (planId === "year" && soldOut) {
      toast.error("앗, 선착순 정원이 모두 마감되었어요!");
      utils.subscription.pricingStatus.invalidate();
      return;
    }
    setLoading(planId);
    try {
      const result = await purchaseSubscription(plan.playProductId);
      await purchase.mutateAsync({
        planId,
        purchaseToken: result.purchaseToken,
      });
      await result.complete("success");
      refreshAll();
      toast.success(`${plan.name} 구독이 시작됐어요! 🎉`);
      onClose();
      navigate("/recommend");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "결제에 실패했어요.");
    } finally {
      setLoading(null);
    }
  }

  async function handleTrial() {
    setLoading("trial");
    try {
      await claimTrial.mutateAsync();
      refreshAll();
      toast.success("1주 무료체험이 시작됐어요! 🎁");
      onClose();
      navigate("/recommend");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "무료체험 신청에 실패했어요.",
      );
    } finally {
      setLoading(null);
    }
  }

  if (!open) return null;

  const monthPerYear = month.priceKRW * 12;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-full md:max-w-[480px] -translate-x-1/2 animate-in slide-in-from-bottom-4 rounded-t-2xl border-t border-border bg-card duration-300">
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="max-h-[88vh] overflow-y-auto px-4 pb-8 pt-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-extrabold">구독하기</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ===== 주인공: 1년 구독 히어로 카드 ===== */}
          <div className="relative mt-4 overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-b from-primary/20 to-primary/5 p-5 shadow-lg">
            {soldOut ? (
              <>
                {/* ---- 마감 상태 ---- */}
                <p className="text-xl font-black leading-snug text-foreground">
                  {pricing.data?.soldOutTitle ??
                    "🎉 1차 선착순 500명 전원 마감!"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {pricing.data?.soldOutDesc ??
                    "성원에 진심으로 감사드립니다. 다음 오픈 소식은 공지로 알려드릴게요!"}
                </p>
                <Button
                  className="mt-4 h-12 w-full text-base font-extrabold"
                  disabled
                >
                  선착순 마감 — 다음 오픈을 기다려주세요
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground">
                    <Flame className="h-3 w-3" />{" "}
                    {pricing.data?.badge ?? "선착순 500명 한정"}
                  </span>
                  {remaining !== null && (
                    <span className="text-[11px] font-bold text-primary">
                      {remaining.toLocaleString()}자리 남음!
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xl font-black leading-snug text-foreground">
                  선착순 {cap?.toLocaleString() ?? "500"}명!
                  <br />
                  <span className="text-primary">
                    {year.priceKRW.toLocaleString()}원
                  </span>
                  으로 <span className="text-primary">평생</span> 1년 구독!!!
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  매주 분석 조합{" "}
                  <span className="font-bold text-foreground">50개</span> · 첫{" "}
                  {cap?.toLocaleString() ?? "500"}명은 이 가격 그대로 매년 갱신
                </p>

                <ul className="mt-3 space-y-1.5 text-sm">
                  <li className="flex items-center gap-2 font-semibold text-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    매주 50개 분석번호 자동 배분
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    출석 체크 보너스 조합 포함
                  </li>
                  <li className="flex items-center gap-2 font-semibold text-primary">
                    <Check className="h-4 w-4 shrink-0" />
                    마감되면 가격이 올라요 — 지금이 평생 최저가!
                  </li>
                </ul>

                {/* 실시간 진행 바 */}
                {cap !== null && (
                  <>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (soldCount / cap) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      현재 {soldCount.toLocaleString()}명 참여 /{" "}
                      {cap.toLocaleString()}명 한정
                    </p>
                  </>
                )}

                <Button
                  className="mt-4 h-12 w-full text-base font-extrabold"
                  disabled={loading !== null}
                  onClick={() => handleBuy("year")}
                >
                  {loading === "year"
                    ? "처리 중..."
                    : `지금 ${year.priceKRW.toLocaleString()}원으로 1년 구독`}
                </Button>
              </>
            )}
          </div>

          {/* ===== 조연: 월 구독 (작게, 비교용) ===== */}
          <button
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3 text-left transition hover:border-primary/40"
            disabled={loading !== null}
            onClick={() => handleBuy("month")}
          >
            <div>
              <p className="text-sm font-bold text-foreground">
                월 구독 · {month.priceKRW.toLocaleString()}원
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                매주 {month.combosPerWeek}개 · 매달 자동 결제
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">
                1년이면 {monthPerYear.toLocaleString()}원
              </p>
              <p className="text-[11px] font-bold text-primary">
                연 구독이 훨씬 이득!
              </p>
            </div>
          </button>

          {/* ===== 맨 아래: 무료체험 (작게 숨김) ===== */}
          {isAuthenticated && !hasAnyHistory && (
            <div className="mt-5 text-center">
              {!showTrial ? (
                <button
                  className="text-[11px] text-muted-foreground underline underline-offset-2"
                  onClick={() => setShowTrial(true)}
                >
                  결제가 망설여진다면? 무료체험 먼저 보기
                </button>
              ) : (
                <div className="mt-1 flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">
                    1주 무료체험 · 분석 조합 10개
                  </p>
                  <button
                    className="text-[11px] font-semibold text-primary disabled:opacity-50"
                    onClick={handleTrial}
                    disabled={loading !== null}
                  >
                    {loading === "trial" ? "처리 중..." : "무료로 받기"}
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="mt-5 text-[10px] leading-relaxed text-muted-foreground">
            {REFUND_POLICY}
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </>
  );
}
