import { useEffect, useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, CreditCard, ArrowRight } from "lucide-react";

export type TossPayItem = {
  title: string;
  subtitle?: string;
  amountLabel: string; // 예: "9,900원" 또는 "1,500P"
  methodLabel?: string; // 예: "토스페이" / "럭키포인트"
};

type Phase = "confirm" | "processing" | "success";

interface TossPaySheetProps {
  open: boolean;
  item: TossPayItem | null;
  /** 실제 승인(서버 mutation) 실행. resolve 시 성공 처리 */
  onApprove: () => Promise<void>;
  /** 시트가 완전히 닫힐 때(성공 후 포함) */
  onClose: () => void;
  /** 성공 후 자동 닫힘까지 대기(ms). 기본 1600. 0이면 자동 닫힘 없이 CTA 노출 */
  successHoldMs?: number;
  /** 성공 화면에 노출할 주요 CTA 라벨 (예: "내 추천번호 확인하기") */
  successCtaLabel?: string;
  /** 성공 CTA 클릭 시 동작. 지정 시 successHoldMs 자동 닫힘 대신 CTA를 노출 */
  onSuccessCta?: () => void;
}

/**
 * 토스페이 스타일 모의 결제 시트.
 * 하단에서 부드럽게 슬라이드업 → 결제 확인 → 승인 처리(진행바) → 성공 체크 애니메이션.
 * 실제 출시 시 onApprove 내부를 토스페이 SDK 승인 흐름으로 교체.
 */
export function TossPaySheet({
  open,
  item,
  onApprove,
  onClose,
  successHoldMs = 1600,
  successCtaLabel,
  onSuccessCta,
}: TossPaySheetProps) {
  const hasCta = !!onSuccessCta;
  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 시트가 열릴 때 상태 초기화
  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setError(null);
    }
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [open]);

  async function handlePay() {
    setError(null);
    setPhase("processing");
    // 토스페이 결제창 승인 연출(진행바)과 실제 승인을 병렬로 진행
    const minDelay = new Promise<void>((res) => {
      const t = setTimeout(res, 1400);
      timersRef.current.push(t);
    });
    try {
      await Promise.all([onApprove(), minDelay]);
      setPhase("success");
      // CTA가 있으면 사용자가 직접 다음 행동을 선택하도록 자동 닫힘을 생략
      if (!hasCta && successHoldMs > 0) {
        const t = setTimeout(() => {
          onClose();
        }, successHoldMs);
        timersRef.current.push(t);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제를 다시 시도해 주세요.");
      setPhase("confirm");
    }
  }

  const locked = phase === "processing" || phase === "success";

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o && !locked) onClose();
      }}
    >
      <DrawerContent className="mx-auto max-w-[480px] border-border bg-card">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="flex items-center gap-2 text-base">
            <span className="flex h-6 items-center rounded bg-[#0064FF] px-1.5 text-[11px] font-bold text-white">
              toss pay
            </span>
            <span className="text-muted-foreground">결제</span>
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8 pt-2">
          {phase === "success" ? (
            <SuccessView
              ctaLabel={successCtaLabel}
              onCta={onSuccessCta}
              onSecondary={onClose}
            />
          ) : (
            <>
              {item && (
                <div className="rounded-2xl bg-secondary/50 p-4">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.subtitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.subtitle}
                    </p>
                  )}
                  <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      결제 금액
                    </span>
                    <span className="text-2xl font-extrabold text-primary">
                      {item.amountLabel}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
                <CreditCard className="h-4 w-4 text-[#0064FF]" />
                <span className="text-sm font-medium">
                  {item?.methodLabel ?? "토스페이"}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  연결됨
                </span>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                안전하게 결제해요. 실제 청구는 아직 발생하지 않아요.
              </div>

              {error && (
                <p className="mt-3 text-xs text-destructive">{error}</p>
              )}

              {/* 진행바 */}
              {phase === "processing" && (
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="pay-progress-fill h-full rounded-full bg-[#0064FF]" />
                </div>
              )}

              <Button
                className="mt-4 h-12 w-full bg-[#0064FF] text-base font-bold text-white hover:bg-[#0052cc] active:scale-[0.98]"
                style={{ transition: "transform 160ms var(--ease-out-snappy)" }}
                disabled={locked}
                onClick={handlePay}
              >
                {phase === "processing"
                  ? "결제 승인 중이에요..."
                  : `${item?.amountLabel ?? ""} 결제하기`}
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SuccessView({
  ctaLabel,
  onCta,
  onSecondary,
}: {
  ctaLabel?: string;
  onCta?: () => void;
  onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="pay-success-ring absolute inset-0 rounded-full bg-primary/30" />
        <span className="pay-success-badge flex h-20 w-20 items-center justify-center rounded-full bg-primary">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path
              className="pay-success-check"
              d="M5 13l4 4L19 7"
              stroke="#1a1407"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <div>
        <p className="text-lg font-extrabold">결제했어요!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          타이거마스크의 분석이 함께합니다 🐯
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-primary">
        <Check className="h-3.5 w-3.5" /> 혜택이 바로 적용됐어요
      </div>

      {onCta && (
        <div className="pay-cta-reveal mt-2 w-full space-y-2">
          <Button
            className="h-12 w-full text-base font-bold active:scale-[0.98]"
            style={{ transition: "transform 160ms var(--ease-out-snappy)" }}
            onClick={onCta}
          >
            {ctaLabel ?? "내 분석번호 확인하기"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-9 w-full text-xs text-muted-foreground"
            onClick={onSecondary}
          >
            닫기
          </Button>
        </div>
      )}
    </div>
  );
}
