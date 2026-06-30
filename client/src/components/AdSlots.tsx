import { useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * 광고 자리 컴포넌트 모음 (현재는 플레이스홀더 UI만 있음, 실제 광고 SDK 미연동).
 *
 * 주의: "토스 광고 SDK"는 토스 미니앱(앱인토스) 전용이라 독립 안드로이드 앱에는 쓸 수 없습니다.
 * 구글플레이로 출시하는 안드로이드 앱이라면 보통 Google AdMob을 사용합니다.
 * (TWA로 패키징하는 경우 웹용 AdSense/CMP 연동, Capacitor라면 AdMob 네이티브 플러그인 사용)
 */

/** 하단 상시 배너 — 유료 회원 포함 항상 노출 */
export function BannerAd() {
  return (
    <div
      className="flex h-14 w-full items-center justify-center gap-2 border-t border-border bg-secondary/60 text-xs text-muted-foreground"
      aria-label="광고 배너"
    >
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
        AD
      </span>
      광고 배너 영역 (AdMob 등 연동 예정)
    </div>
  );
}

/**
 * 보상형 동영상 광고 모달.
 * onReward 콜백으로 보상 지급 트리거. 실제로는 SDK 완료 콜백에서 호출.
 */
export function useRewardedAd() {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [onComplete, setOnComplete] = useState<(() => void) | null>(null);

  const show = useCallback((cb: () => void) => {
    setOnComplete(() => cb);
    setSeconds(5);
    setOpen(true);
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const finish = useCallback(() => {
    setOpen(false);
    onComplete?.();
    setOnComplete(null);
  }, [onComplete]);

  const node = (
    <Dialog open={open} onOpenChange={(o) => !o && seconds === 0 && setOpen(false)}>
      <DialogContent
        className="max-w-sm border-border bg-card text-card-foreground"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-32 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
            <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold">
              AD
            </span>
            <span className="ml-2">보상형 광고 (SDK 연동 예정)</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {seconds > 0
              ? `${seconds}초 후 보상을 받을 수 있습니다.`
              : "광고 시청 완료! 보상을 받으세요."}
          </p>
          <Button
            className="w-full"
            disabled={seconds > 0}
            onClick={finish}
          >
            {seconds > 0 ? `${seconds}초` : "보상 받기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { show, node };
}

/**
 * 전면(인터스티셜) 광고 모달.
 * 화면 전환/이탈 시점에 전체 화면으로 1회 노출하는 자리.
 * 실제 출시 시 AdMob 전면광고 SDK로 교체.
 */
export function useInterstitialAd() {
  const [open, setOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [onClosed, setOnClosed] = useState<(() => void) | null>(null);

  const show = useCallback((cb?: () => void) => {
    setOnClosed(() => cb ?? null);
    setCanClose(false);
    setOpen(true);
    const t = setTimeout(() => setCanClose(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    onClosed?.();
    setOnClosed(null);
  }, [onClosed]);

  const node = (
    <Dialog open={open} onOpenChange={(o) => !o && canClose && close()}>
      <DialogContent
        className="max-w-md border-border bg-card text-card-foreground"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-56 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
            <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold">
              AD
            </span>
            <span className="ml-2">전면 광고 (SDK 연동 예정)</span>
          </div>
          <Button
            className="w-full"
            variant="outline"
            disabled={!canClose}
            onClick={close}
          >
            {canClose ? "닫기" : "광고 표시 중..."}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { show, node };
}
