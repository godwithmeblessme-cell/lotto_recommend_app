/**
 * ShareSheet — 추천번호 공유 시트
 * 카카오톡 공유 / 이미지 저장(Web Share) 두 가지 방법을 제공.
 */
import { useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useShareLotto } from "@/hooks/useShareLotto";
import { toast } from "sonner";
import { Download, Share2, MessageCircle } from "lucide-react";

/* ── 공유 카드 (캡처 대상) ── */
function ShareCard({
  cardRef,
  combos,
  planName,
  weekId,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  combos: number[][];
  planName?: string;
  weekId?: string;
}) {
  return (
    <div
      ref={cardRef}
      style={{
        background: "linear-gradient(145deg, #1a0e04 0%, #2e1a06 60%, #1a0e04 100%)",
        borderRadius: "1.2rem",
        padding: "1.5rem 1.25rem",
        width: "100%",
        maxWidth: 340,
        margin: "0 auto",
        fontFamily: "Pretendard, system-ui, sans-serif",
        color: "#f5e6c0",
      }}
    >
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "1.4rem" }}>🤖</span>
        <div>
          <p style={{ fontWeight: 800, fontSize: "0.95rem", color: "#f0c040", lineHeight: 1.2 }}>
            태권 V 분석
          </p>
          {planName && (
            <p style={{ fontSize: "0.65rem", color: "#b8a070", marginTop: "0.1rem" }}>
              {planName} · {weekId ?? "이번 주"} 분석번호
            </p>
          )}
        </div>
      </div>

      {/* 구분선 */}
      <div style={{ height: 1, background: "rgba(240,192,64,0.25)", marginBottom: "0.75rem" }} />

      {/* 번호 조합 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
        {combos.map((combo, i) => {
          const sorted = [...combo].sort((a, b) => a - b);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: "1.3rem", fontSize: "0.7rem", color: "#b8a070", fontWeight: 700 }}>
                {i + 1}
              </span>
              {sorted.map((n) => (
                <span
                  key={n}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "9999px",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    color: "#1a1407",
                    background: ballGrad(n),
                    boxShadow: "0 2px 5px rgba(0,0,0,0.4)",
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* 푸터 */}
      <div style={{ marginTop: "0.85rem", fontSize: "0.6rem", color: "#7a6040", textAlign: "right" }}>
        본 서비스는 참고용 정보 제공이며 당첨을 보장하지 않습니다.
      </div>
    </div>
  );
}

function ballGrad(n: number) {
  if (n <= 10) return "linear-gradient(135deg,#f6c453,#e8a020)";
  if (n <= 20) return "linear-gradient(135deg,#5aa9e6,#2f78c4)";
  if (n <= 30) return "linear-gradient(135deg,#f0786f,#d8453a)";
  if (n <= 40) return "linear-gradient(135deg,#b8b8b8,#8a8a8a)";
  return "linear-gradient(135deg,#7fd28a,#3fae55)";
}

/* ── 공유 시트 ── */
export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  combos: number[][];
  planName?: string;
  weekId?: string;
}

export function ShareSheet({
  open,
  onClose,
  combos,
  planName,
  weekId,
}: ShareSheetProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { kakaoReady, shareKakao, shareImage } = useShareLotto();
  const [loading, setLoading] = useState<"kakao" | "image" | null>(null);

  async function handleKakao() {
    setLoading("kakao");
    try {
      shareKakao({ combos, planName, weekId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "카카오 공유를 다시 시도해 주세요.");
    } finally {
      setLoading(null);
    }
  }

  async function handleImage() {
    if (!cardRef.current) return;
    setLoading("image");
    try {
      await shareImage(cardRef.current, { combos, planName, weekId });
      toast.success("이미지를 저장했어요!");
    } catch (e) {
      toast.error("이미지 저장을 다시 시도해 주세요.");
    } finally {
      setLoading(null);
    }
  }

  const hasWebShare =
    typeof navigator !== "undefined" && !!navigator.share;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto max-w-[480px] border-border bg-card">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 text-primary" />
            분석번호 공유하기
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8 pt-2 space-y-4">
          {/* 미리보기 카드 */}
          <div className="overflow-hidden rounded-2xl border border-border/40">
            <ShareCard
              cardRef={cardRef}
              combos={combos}
              planName={planName}
              weekId={weekId}
            />
          </div>

          {/* 공유 버튼들 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 카카오톡 */}
            <Button
              className="h-14 flex-col gap-1 bg-[#FEE500] text-[#3C1E1E] hover:bg-[#f0d800] active:scale-[0.97]"
              style={{ transition: "transform 160ms var(--ease-out-snappy)" }}
              disabled={!kakaoReady || loading === "kakao"}
              onClick={handleKakao}
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs font-bold">
                {kakaoReady ? "카카오톡" : "카카오 설정 필요"}
              </span>
            </Button>

            {/* 이미지 저장 / 공유 */}
            <Button
              className="h-14 flex-col gap-1 active:scale-[0.97]"
              style={{ transition: "transform 160ms var(--ease-out-snappy)" }}
              disabled={loading === "image"}
              onClick={handleImage}
            >
              {hasWebShare ? (
                <Share2 className="h-5 w-5" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              <span className="text-xs font-bold">
                {loading === "image"
                  ? "저장 중이에요..."
                  : hasWebShare
                    ? "이미지 공유"
                    : "이미지 저장"}
              </span>
            </Button>
          </div>

          {!kakaoReady && (
            <p className="text-center text-[11px] text-muted-foreground">
              카카오 공유는 운영자 앱 키를 설정하면 쓸 수 있어요.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
