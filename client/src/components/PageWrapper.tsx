/**
 * PageWrapper
 *
 * 모든 페이지를 감싸는 진입 애니메이션 래퍼.
 * - 화면 전환 시 fade + slideUp (0.22s, ease-out-snappy)
 * - key 변경 시 재실행 → 탭 전환마다 자연스럽게 등장
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <div className={cn("page-enter", className)}>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────
 * Skeleton 컴포넌트 모음
 * ────────────────────────────────────────── */

/** 단순 사각형 스켈레톤 블록 */
export function SkeletonBox({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("skeleton", className)} />;
}

/** 카드 형태 스켈레톤 (제목 + 2줄 텍스트) */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <SkeletonBox className="h-4 w-2/5 rounded" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          className={cn("h-3 rounded", i === lines - 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

/** 로또 번호 볼 행 스켈레톤 */
export function SkeletonComboRow() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonBox key={i} className="h-9 w-9 rounded-full" />
      ))}
      <SkeletonBox className="ml-auto h-5 w-12 rounded" />
    </div>
  );
}

/** 포인트/내역 행 스켈레톤 */
export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="space-y-1.5">
        <SkeletonBox className="h-3.5 w-28 rounded" />
        <SkeletonBox className="h-2.5 w-20 rounded" />
      </div>
      <SkeletonBox className="h-4 w-14 rounded" />
    </div>
  );
}

/** 플랜 카드 스켈레톤 */
export function SkeletonPlanCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <SkeletonBox className="h-4 w-1/3 rounded" />
      <SkeletonBox className="h-6 w-1/2 rounded" />
      <SkeletonBox className="h-3 w-3/4 rounded" />
    </div>
  );
}

/** 홈 히어로 배너 스켈레톤 */
export function SkeletonHero() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
      <SkeletonBox className="h-5 w-2/5 rounded" />
      <SkeletonBox className="h-8 w-3/5 rounded" />
      <SkeletonBox className="h-3 w-4/5 rounded" />
      <SkeletonBox className="mt-2 h-10 w-36 rounded-xl" />
    </div>
  );
}
