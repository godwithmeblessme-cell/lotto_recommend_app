import { AppShell } from "@/components/AppShell";
import { LoginGate } from "@/components/LoginGate";
import { ComboRow } from "@/components/LottoBalls";
import { ShareSheet } from "@/components/ShareSheet";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Clock, Crown, Share2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { PageWrapper, SkeletonComboRow } from "@/components/PageWrapper";

export default function Recommend() {
  const { isAuthenticated, loading } = useAuth();
  const weekly = trpc.recommend.myWeekly.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [shareOpen, setShareOpen] = useState(false);

  const combos = weekly.data && !weekly.data.locked ? weekly.data.combos : [];
  const planName = weekly.data && !weekly.data.locked ? weekly.data.plan?.name : undefined;

  return (
    <AppShell>
      <PageWrapper className="space-y-4 px-4 py-5">
        <div>
          <h1 className="text-xl font-extrabold">이번 주 분석 번호</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            태권 V가 직접 선별한 통계 분석 참고 번호에요.
          </p>
        </div>

        {!isAuthenticated && !loading && <LoginGate />}

        {isAuthenticated && weekly.isLoading && (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonComboRow key={i} />
            ))}
          </div>
        )}

        {isAuthenticated && weekly.data && (
          <>
            {weekly.data.locked ? (
              <LockedCard
                reason={weekly.data.reason}
                notice={(weekly.data as { notice?: string }).notice}
              />
            ) : (
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Crown className="h-4 w-4 text-primary" />
                    {weekly.data.plan?.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {weekly.data.combos.length}조합
                    </span>
                    {/* 공유 버튼 */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex h-7 items-center gap-1 px-2 text-xs active:scale-[0.97]"
                      style={{ transition: "transform 160ms var(--ease-out-snappy)" }}
                      onClick={() => setShareOpen(true)}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      공유
                    </Button>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {weekly.data.combos.map((c, i) => (
                    <ComboRow key={i} combo={c} index={i} />
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </PageWrapper>

      {/* 공유 시트 */}
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        combos={combos}
        planName={planName}
        weekId={weekly.data && !weekly.data.locked ? (weekly.data as { weekId?: string }).weekId : undefined}
      />
    </AppShell>
  );
}

function LockedCard({
  reason,
  notice,
}: {
  reason: string | null;
  notice?: string;
}) {
  if (reason === "no_subscription") {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          구독하면 매주 분석 번호를 받을 수 있어요.
        </p>
          <Link href="/subscribe" className="w-full">
          <Button className="w-full">구독하고 분석 번호 받기</Button>
        </Link>
      </Card>
    );
  }
  if (reason === "closed_window") {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <Clock className="h-8 w-8 text-accent" />
        <p className="text-sm text-muted-foreground">
          {notice ??
            "번호 확인은 매주 월요일 ~ 토요일 오후 7시까지 가능해요."}
        </p>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center">
      <Clock className="h-8 w-8 text-accent" />
      <p className="text-sm text-muted-foreground">
        {notice ?? "이번 주 분석 번호가 곳 공개될 예정이에요."}
      </p>
    </Card>
  );
}
