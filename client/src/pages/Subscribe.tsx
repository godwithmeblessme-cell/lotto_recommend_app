import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, Sparkles, Menu, Crown } from "lucide-react";
import { BannerAd } from "./AdSlots";
import { cn } from "@/lib/utils";
import { SubscribeSheet } from "./SubscribeSheet";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const TABS = [
  { path: "/", label: "홈", icon: Home },
  { path: "/recommend", label: "내 번호", icon: Sparkles },
  { path: "/more", label: "더보기", icon: Menu },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [subOpen, setSubOpen] = useState(false);

  // 예전 /subscribe 경로(토스 페이지 제거됨)로 들어오면 새 구독 시트를 자동으로 연다.
  useEffect(() => {
    if (location === "/subscribe") setSubOpen(true);
  }, [location]);
  const { isAuthenticated } = useAuth();
  const sub = trpc.subscription.current.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const hasPaidSub = sub.data?.plan && sub.data.plan.id !== "trial";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="app-shell relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <span className="text-base font-extrabold tracking-tight">
              <span className="text-primary">로또 통계</span> 분석
            </span>
          </Link>
          {isAuthenticated && !hasPaidSub && (
            <button
              onClick={() => setSubOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
            >
              <Crown className="h-3.5 w-3.5" />
              구독하기
            </button>
          )}
        </header>

        <main className="flex-1 pb-32">{children}</main>

        <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-full md:max-w-[480px] -translate-x-1/2">
          <BannerAd />
        </div>

        <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-full md:max-w-[480px] -translate-x-1/2 items-stretch border-t border-border bg-background/95 backdrop-blur">
          {TABS.map((tab) => {
            const active =
              tab.path === "/"
                ? location === "/"
                : location.startsWith(tab.path);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                href={tab.path}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <SubscribeSheet open={subOpen} onClose={() => setSubOpen(false)} />
    </div>
  );
}
