/**
 * WeeklyAnnouncementBanner
 *
 * 홈 화면 상단에 띄우는 "이번 주 당첨 발표" 공지 배너.
 * - 전체 회원 1~5등 인원수 집계를 보여줌 (개인 결과가 아니라 전체 통계)
 * - "1주일간 보지 않기" 클릭 시 서버에 기록 → 그 주 동안 다시 안 뜸
 *   (개인 당첨 결과를 보여주는 WinResultPopup과는 별개의 기능)
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export function WeeklyAnnouncementBanner() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: announcement } = trpc.announcement.latest.useQuery();
  const dismissMut = trpc.announcement.dismiss.useMutation({
    onSuccess: () => {
      utils.announcement.latest.invalidate();
    },
  });

  if (!announcement) return null;

  const rows = [
    { label: "1등", count: announcement.rank1Count },
    { label: "2등", count: announcement.rank2Count },
    { label: "3등", count: announcement.rank3Count },
    { label: "4등", count: announcement.rank4Count },
    { label: "5등", count: announcement.rank5Count },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4">
      {isAuthenticated && (
        <button
          aria-label="닫기"
          className="absolute right-3 top-3 text-muted-foreground"
          onClick={() => dismissMut.mutate({ weekId: announcement.weekId })}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <p className="text-sm font-bold">
        🎉 {announcement.round}회 당첨 발표
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        이번 주 회원분들 중 당첨자가 나왔어요!
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {rows.map((r) => (
          <span
            key={r.label}
            className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold"
          >
            {r.label} {r.count}명
          </span>
        ))}
      </div>

      {isAuthenticated && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 h-7 px-2 text-[11px] text-muted-foreground"
          disabled={dismissMut.isPending}
          onClick={() => dismissMut.mutate({ weekId: announcement.weekId })}
        >
          1주일간 보지 않기
        </Button>
      )}
    </div>
  );
}
