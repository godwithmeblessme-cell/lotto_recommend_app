/**
 * WinResultPopup
 *
 * 토요일 추첨 후 홈 접속 시 자동으로 뜨는 당첨 결과 확인 팝업.
 * - 이번 주 당첨번호 + 보너스번호 표시
 * - 내 배분 조합과 매칭 하이라이트 (맞은 번호 골드 강조)
 * - 등수 안내 (1~5등 / 미당첨)
 * - 1회 노출 후 localStorage 에 기록해 재접속 시 다시 안 뜸
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LottoBall } from "@/components/LottoBalls";
import { useAuth } from "@/_core/hooks/useAuth";

const SEEN_KEY_PREFIX = "win_result_seen_";

function seenKey(weekId: string) {
  return `${SEEN_KEY_PREFIX}${weekId}`;
}

/** 등수별 색상·이모지 */
function rankStyle(rank: number | null): { color: string; emoji: string; label: string } {
  if (rank === 1) return { color: "text-yellow-400", emoji: "🏆", label: "1등 당첨!" };
  if (rank === 2) return { color: "text-yellow-300", emoji: "🥈", label: "2등 당첨!" };
  if (rank === 3) return { color: "text-amber-400", emoji: "🥉", label: "3등 당첨!" };
  if (rank === 4) return { color: "text-orange-400", emoji: "🎉", label: "4등 당첨!" };
  if (rank === 5) return { color: "text-green-400", emoji: "✅", label: "5등 당첨!" };
  return { color: "text-muted-foreground", emoji: "😢", label: "이번엔 아쉬웠어요" };
}

export function WinResultPopup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // 이번 주 당첨 결과 (공개)
  const { data: latestData } = trpc.result.latest.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // 내 번호 매칭 (로그인 시)
  const { data: matchData } = trpc.result.myMatch.useQuery(undefined, {
    enabled: !!user && !!latestData?.result,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!latestData?.result) return;
    const weekId = latestData.weekId;
    const alreadySeen = localStorage.getItem(seenKey(weekId));
    if (!alreadySeen) {
      setOpen(true);
    }
  }, [latestData]);

  function handleClose() {
    if (latestData?.weekId) {
      localStorage.setItem(seenKey(latestData.weekId), "1");
    }
    setOpen(false);
  }

  if (!latestData?.result) return null;

  const { winNumbers, bonusNumber, round } = latestData.result;
  const matches = matchData?.matches ?? [];
  const bestRank = matchData?.bestRank ?? null;
  const { color, emoji, label } = rankStyle(bestRank);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl bg-card border-border p-0 overflow-hidden">
        {/* 헤더 배너 */}
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span>🎱</span>
              <span>{round}회 당첨 결과</span>
            </DialogTitle>
          </DialogHeader>

          {/* 당첨 번호 */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">이번 주 당첨번호</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {winNumbers.map((n) => (
                <LottoBall key={n} n={n} />
              ))}
              <span className="text-muted-foreground text-sm mx-1">+</span>
              <div className="relative">
                <LottoBall n={bonusNumber} />
                <span className="absolute -top-2 -right-1 text-[9px] bg-primary text-primary-foreground rounded px-0.5 leading-tight font-bold">
                  보너스
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* 내 번호 결과 */}
          {user ? (
            matches.length > 0 ? (
              <div>
                {/* 최고 등수 배지 */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground font-medium">내 번호 결과</p>
                  <span className={`text-sm font-bold ${color}`}>
                    {emoji} {label}
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {matches.map((m, i) => (
                    <MatchRow key={i} match={m} winNumbers={winNumbers} bonusNumber={bonusNumber} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-sm text-muted-foreground">이번 주 배분받은 번호가 없어요.</p>
                <p className="text-xs text-muted-foreground mt-1">구독하면 다음 주에 번호를 받을 수 있어요!</p>
              </div>
            )
          ) : (
            <div className="text-center py-3 space-y-1">
              <p className="text-sm text-muted-foreground">로그인하면 내 번호 당첨 여부를 확인할 수 있어요.</p>
            </div>
          )}

          <Separator />

          <Button
            className="w-full font-semibold"
            onClick={handleClose}
          >
            확인했어요
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 개별 조합 매칭 행 */
function MatchRow({
  match,
  winNumbers,
  bonusNumber,
}: {
  match: {
    combo: number[];
    kind: string;
    rank: number | null;
    matchCount: number;
    hasBonus: boolean;
    label: string;
  };
  winNumbers: number[];
  bonusNumber: number;
}) {
  const winSet = new Set(winNumbers);
  const { color, emoji } = rankStyle(match.rank);

  return (
    <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
      {/* 번호 볼 — 맞은 번호 강조 */}
      <div className="flex gap-1 flex-wrap flex-1">
        {match.combo.map((n) => {
          const isWin = winSet.has(n);
          const isBonus = n === bonusNumber;
          return (
            <span
              key={n}
              className={`
                inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                transition-all
                ${isWin
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/60 scale-110"
                  : isBonus
                  ? "bg-blue-500/80 text-white ring-1 ring-blue-400"
                  : "bg-muted text-muted-foreground opacity-60"
                }
              `}
            >
              {n}
            </span>
          );
        })}
      </div>

      {/* 등수 / 매칭 수 */}
      <div className="text-right shrink-0">
        <span className={`text-xs font-bold ${color}`}>
          {emoji} {match.label}
        </span>
        <p className="text-[10px] text-muted-foreground">
          {match.matchCount}개 일치{match.hasBonus ? " +보너스" : ""}
          {match.kind === "free" ? " (무료)" : ""}
        </p>
      </div>
    </div>
  );
}
