import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, Sparkles, Gift, Crown, Menu } from "lucide-react";
import { BannerAd } from "./AdSlots";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "/", label: "홈", icon: Home },
  { path: "/recommend", label: "분석번호", icon: Sparkles },
  { path: "/daily", label: "무료혜택", icon: Gift },
  { path: "/subscribe", label: "구독", icon: Crown },
  { path: "/more", label: "더보기", icon: Menu },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="app-shell relative flex min-h-screen flex-col">
        {/* 상단 브랜드 바 */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🐯</span>
            <span className="text-base font-extrabold tracking-tight">
              조작 <span className="text-primary">로또번호 분석</span>
            </span>
          </Link>
        </header>

        {/* 본문 */}
        <main className="flex-1 pb-32">{children}</main>

        {/* 하단 배너 광고 (유료 포함 상시) */}
        <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2">
          <BannerAd />
        </div>

        {/* 하단 탭 */}
        <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[480px] -translate-x-1/2 items-stretch border-t border-border bg-background/95 backdrop-blur">
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
    </div>
  );
}
