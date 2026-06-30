import { AppShell } from "@/components/AppShell";
import { LoginGate } from "@/components/LoginGate";
import { TossPaySheet, type TossPayItem } from "@/components/TossPaySheet";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PLANS, PLAN_ORDER, REFUND_POLICY, DISCLAIMER, type PlanId } from "@shared/plans";
import { useState } from "react";
import { useLocation } from "wouter";
import { Check, Crown } from "lucide-react";
import { PageWrapper, SkeletonPlanCard } from "@/components/PageWrapper";
import { purchaseSubscription, isPlayBillingAvailable } from "@/lib/playBilling";

export default function Subscribe() {
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const current = trpc.subscription.current.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const history = trpc.subscription.history.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const purchase = trpc.subscription.purchase.useMutation();
  const claimTrial = trpc.subscription.claimTrial.useMutation();
  const hasAnyHistory = (history.data?.length ?? 0) > 0;

  const selectedPlan = selected ? PLANS[selected] : null;
  const totalKRW = selectedPlan ? selectedPlan.priceKRW : 0;

  const payItem: TossPayItem | null = selectedPlan
    ? {
        title: selectedPlan.name,
        subtitle: `매주 ${selectedPlan.combosPerWeek}조합 배분`,
        amountLabel: `${totalKRW.toLocaleString()}원`,
        methodLabel: "구글플레이 결제",
      }
    : null;

  /**
   * 구글 플레이 인앱결제(Play Billing) 실제 결제 흐름.
   * 1) 클라이언트에서 Play 결제 다이얼로그를 띄워 purchaseToken을 받음
   * 2) 서버에 purchaseToken을 보내 "진짜 결제인지" 검증 받은 뒤에만 구독 발급
   */
  async function handleApprove() {
    if (!selected) return;
    const plan = PLANS[selected];
    if (!plan.playProductId) return;

    if (!isPlayBillingAvailable()) {
      setPayError(
        "구글 플레이 결제는 Play 스토어로 설치한 안드로이드 앱에서만 가능해요. (웹 미리보기에서는 결제 테스트가 불가능합니다)",
      );
      throw new Error("Play Billing not available");
    }

    const result = await purchaseSubscription(plan.playProductId);
    try {
      await purchase.mutateAsync({
        planId: selected,
        purchaseToken: result.purchaseToken,
      });
      await result.complete("success");
    } catch (err) {
      await result.complete("fail");
      throw err;
    }
  }

  async function handleClaimTrial() {
    setPayError(null);
    try {
      await claimTrial.mutateAsync();
      utils.subscription.current.invalidate();
      utils.subscription.history.invalidate();
      utils.recommend.myWeekly.invalidate();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "무료체험 신청에 실패했습니다.");
    }
  }

  function refreshAfterSuccess() {
    utils.subscription.current.invalidate();
    utils.subscription.history.invalidate();
    utils.recommend.myWeekly.invalidate();
    setSelected(null);
    purchase.reset();
  }

  function handlePaySheetClose() {
    setPayOpen(false);
    if (purchase.isSuccess) refreshAfterSuccess();
  }

  function handleGoRecommend() {
    setPayOpen(false);
    refreshAfterSuccess();
    navigate("/recommend");
  }

  const isFirstLoad = loading || (isAuthenticated && current.isLoading);

  if (isFirstLoad) {
    return (
      <AppShell>
        <div className="space-y-4 px-4 py-5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonPlanCard key={i} />)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageWrapper className="space-y-4 px-4 py-5">
        <div>
          <h1 className="text-xl font-extrabold">구독 플랜</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            등급이 높을수록 매주 더 많은 통계 분석 조합을 받아요.
          </p>
        </div>

        {!isAuthenticated && !loading && <LoginGate />}

        {isAuthenticated && (
          <>
            {current.data?.plan && (
              <Card className="flex items-center gap-3 border-primary/40 bg-primary/10 p-4">
                <Crown className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">
                    현재 등급: {current.data.plan.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    주 {current.data.plan.combosPerWeek}조합
                  </p>
                </div>
              </Card>
            )}

            {!hasAnyHistory && (
              <Card className="flex items-center justify-between gap-3 border-primary/40 bg-primary/5 p-4">
                <div>
                  <p className="text-sm font-bold">🎁 1주 무료체험</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    가입 기념, 분석 조합 10개를 한 번 무료로 드려요.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleClaimTrial}
                  disabled={claimTrial.isPending}
                >
                  {claimTrial.isPending ? "처리 중..." : "무료로 받기"}
                </Button>
              </Card>
            )}

            <div className="space-y-3">
              {PLAN_ORDER.map((id) => {
                const plan = PLANS[id];
                const popular = id === "year";
                return (
                  <Card
                    key={id}
                    className={`p-4 ${popular ? "border-primary/50" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold">{plan.name}</p>
                          {popular && (
                            <Badge className="bg-primary text-primary-foreground">
                              인기
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {plan.blurb}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-primary">
                          {plan.priceKRW.toLocaleString()}원
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          주 {plan.combosPerWeek}조합
                        </p>
                      </div>
                    </div>
                    <Button
                      className="mt-3 w-full active:scale-[0.98]"
                      style={{
                        transition: "transform 160ms var(--ease-out-snappy)",
                      }}
                      variant={popular ? "default" : "outline"}
                      onClick={() => {
                        setPayError(null);
                        setSelected(id);
                      }}
                    >
                      선택하기
                    </Button>
                  </Card>
                );
              })}
            </div>

            {/* 부당광고 방지: 통계 분석일 뿐 당첨 확률을 높이지 않는다는 점을 결제 화면에 항상 노출 */}
            <Card className="border-destructive/40 bg-destructive/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">결제 전 꼭 확인해주세요</p>
              <p className="mt-1">{DISCLAIMER}</p>
              <p className="mt-2">{REFUND_POLICY}</p>
            </Card>

            {payError && (
              <Card className="border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                {payError}
              </Card>
            )}
          </>
        )}
      </PageWrapper>

      {/* 1단계: 옵션 확인 모달 */}
      <Dialog
        open={!!selected && !payOpen}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle>{selectedPlan?.name} 구독</DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">주간 조합 수</span>
                <span className="font-semibold">
                  {selectedPlan.combosPerWeek}조합
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-muted-foreground">결제 금액</span>
                <span className="text-lg font-extrabold text-primary">
                  {totalKRW.toLocaleString()}원
                </span>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-primary" /> 매주 통계 분석 조합을 받아요
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-primary" /> 출석 체크로 추가 조합을 받아요
                </li>
              </ul>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {REFUND_POLICY}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              className="w-full active:scale-[0.98]"
              style={{ transition: "transform 160ms var(--ease-out-snappy)" }}
              onClick={() => setPayOpen(true)}
            >
              구글플레이로 결제하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2단계: 결제 진행 시트 (실제 결제는 handleApprove에서 Play Billing 호출) */}
      <TossPaySheet
        open={payOpen}
        item={payItem}
        onApprove={handleApprove}
        onClose={handlePaySheetClose}
              successCtaLabel="내 분석번호 확인하기"
        onSuccessCta={handleGoRecommend}
      />
    </AppShell>
  );
}
