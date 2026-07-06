import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Zap } from "lucide-react";

const LIMIT = 500;

export function LimitedOfferBanner({ className = "" }: { className?: string }) {
  const { isAuthenticated } = useAuth();
  const sub = trpc.subscription.current.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (sub.data?.plan && sub.data.plan.id !== "trial") return null;

  const countQuery = trpc.subscription.yearSubCount.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const yearCount = countQuery.data?.yearSubs ?? 0;
  const remaining = Math.max(0, LIMIT - yearCount);
  const pct = Math.min(100, (yearCount / LIMIT) * 100);

  return (
    <div className={`overflow-hidden rounded-xl border border-primary/50 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-4 py-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm font-bold text-foreground">
          🎉 첫 오픈 기념 — 선착순 {LIMIT.toLocaleString()}명 한정
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        지금 1년 정기구독 시{" "}
        <span className="font-bold text-primary">11,000원</span>으로 이용 가능해요.{" "}
        {remaining > 0 ? (
          <span className="font-semibold text-foreground">{remaining.toLocaleString()}자리 남았어요!</span>
        ) : (
          <span className="font-semibold text-destructive">마감됐어요.</span>
        )}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {yearCount.toLocaleString()}명 참여 중 / {LIMIT.toLocaleString()}명 한정
      </p>
    </div>
  );
}
