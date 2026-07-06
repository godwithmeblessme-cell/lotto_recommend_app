import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, PLAN_ORDER, DISCLAIMER, REFUND_POLICY, type PlanId } from "@shared/plans";
import { useState } from "react";
import { useLocation } from "wouter";
import { Crown, Check, X, Zap } from "lucide-react";
import { purchaseSubscription, isPlayBillingAvailable } from "@/lib/playBilling";
import { toast } from "sonner";
import { LimitedOfferBanner } from "./LimitedOfferBanner";

interface SubscribeSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SubscribeSheet({ open, onClose }: SubscribeSheetProps) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState<PlanId | null>(null);

  const purchase = trpc.subscription.purchase.useMutation();
  const claimTrial = trpc.subscription.claimTrial.useMutation();
  const history = trpc.subscription.history.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const hasAnyHistory = (history.data?.length ?? 0) > 0;

  function refreshAll() {
    utils.subscription.current.invalidate();
    utils.subscription.history.invalidate();
    utils.recommend.myWeekly.invalidate();
  }

  async function handleBuy(planId: PlanId) {
    const plan = PLANS[planId];
    if (!plan.playProductId) return;
    if (!isPlayBillingAvailable()) {
      toast.error("구글 플레이 결제는 Play 스토어로 설치한 안드로이드 앱에서만 가능해요.");
      return;
    }
    setLoading(planId);
    try {
      const result = await purchaseSubscription(plan.playProductId);
      await purchase.mutateAsync({ planId, purchaseToken: result.purchaseToken });
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
      toast.error(err instanceof Error ? err.message : "무료체험 신청에 실패했어요.");
    } finally {
      setLoading(null);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 animate-in slide-in-from-bottom-4 rounded-t-2xl border-t border-border bg-card duration-300">
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="max-h-[85vh] overflow-y-auto px-4 pb-8 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-extrabold">구독 플랜 선택</h2>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
              <X className="h-5 w-5" />
            </button>
          </div>
          <LimitedOfferBanner className="mt-4" />
          {isAuthenticated && !hasAnyHistory && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">🎁 1주 무료체험</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">가입 기념, 분석 조합 10개를 무료로 드려요.</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleTrial} disabled={loading !== null}>
                  {loading === "trial" ? "처리 중..." : "무료로 받기"}
                </Button>
              </div>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const isYear = id === "year";
              return (
                <div key={id} className={`rounded-xl border p-4 ${isYear ? "border-primary/60 bg-primary/5" : "border-border bg-card"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold">{plan.name}</p>
                        {isYear && (
                          <Badge className="bg-primary text-primary-foreground text-[10px]">
                            <Zap className="mr-0.5 h-2.5 w-2.5" /> 선착순 한정
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{plan.blurb}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-primary">{plan.priceKRW.toLocaleString()}원</p>
                      <p className="text-[10px] text-muted-foreground">주 {plan.combosPerWeek}조합</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" />매주 {plan.combosPerWeek}개 분석번호 배분</li>
                    <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" />출석 체크 보너스 조합 포함</li>
                    {isYear && <li className="flex items-center gap-1.5 font-semibold text-primary"><Check className="h-3 w-3" />선착순 500명 특가 (이후 가격 인상 예정)</li>}
                  </ul>
                  <Button className="mt-3 w-full" variant={isYear ? "default" : "outline"} disabled={loading !== null} onClick={() => handleBuy(id)}>
                    {loading === id ? "처리 중..." : "구독 시작하기"}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">{REFUND_POLICY}</p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
        </div>
      </div>
    </>
  );
}
