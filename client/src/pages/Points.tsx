import { AppShell } from "@/components/AppShell";
import { LoginGate } from "@/components/LoginGate";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Coins } from "lucide-react";
import { PageWrapper, SkeletonCard, SkeletonRow } from "@/components/PageWrapper";

const REASON_LABEL: Record<string, string> = {
  checkin: "입장 적립",
  streak7: "연속 입장 보너스",
  free_combo: "무료 조합 활동",
  exchange: "구독권 교환",
  admin: "운영자 조정",
};

export default function Points() {
  const { isAuthenticated, loading } = useAuth();
  const balance = trpc.points.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const history = trpc.points.history.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const isFirstLoad = loading || (isAuthenticated && (balance.isLoading || history.isLoading));

  if (isFirstLoad) {
    return (
      <AppShell>
        <div className="space-y-4 px-4 py-5">
          <SkeletonCard lines={1} />
          <SkeletonCard lines={2} />
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageWrapper className="space-y-4 px-4 py-5">
        <h1 className="text-xl font-extrabold">럭키포인트</h1>

        {!isAuthenticated && !loading && <LoginGate />}

        {isAuthenticated && (
          <>
            <Card className="tiger-gradient border-0 p-5 text-[#1a1407]">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                <span className="text-sm font-semibold">보유 포인트</span>
              </div>
              <p className="mt-2 text-3xl font-extrabold">
                {(balance.data?.balance ?? 0).toLocaleString()}P
              </p>
            </Card>

            {/* 적립 안내 */}
            <Card className="p-4 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">럭키포인트 안내</p>
              <p>· 럭키포인트는 출석 체크 시스템으로 대체되었어요.</p>
              <p>· 출석 체크로 분석 조합을 얻어보세요!</p>
            </Card>

            {/* 내역 */}
            <div>
              <h2 className="mb-2 text-sm font-bold">적립/사용 내역</h2>
              <div className="space-y-1.5">
                {history.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    아직 내역이 없어요. 출석하면 포인트를 쉽게 모을 수 있어요.
                  </p>
                )}
                {history.data?.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium">
                        {REASON_LABEL[h.reason] ?? h.reason}
                      </p>
                      <p className="text-muted-foreground">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={
                        h.delta >= 0 ? "text-primary" : "text-destructive"
                      }
                    >
                      {h.delta >= 0 ? "+" : ""}
                      {h.delta.toLocaleString()}P
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </PageWrapper>

    </AppShell>
  );
}
