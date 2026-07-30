import { AppShell } from "@/components/AppShell";
import { LoginGate } from "@/components/LoginGate";
import { Crown } from "lucide-react";

/**
 * /subscribe 경로 페이지.
 *
 * 예전 토스(TossPaySheet) 기반 결제 화면은 완전히 제거되었습니다.
 * 이 경로로 들어오면 AppShell 이 자동으로 새 구독 시트
 * (SubscribeSheet: 선착순 500명, 구글플레이 결제)를 띄웁니다.
 */
export default function Subscribe() {
  return (
    <AppShell>
      <LoginGate>
        <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
          <Crown className="h-10 w-10 text-primary" />
          <p className="text-base font-bold text-foreground">구독 안내</p>
          <p className="text-sm text-muted-foreground">
            구독 창이 자동으로 열려요. 닫혔다면 화면 위 "구독하기" 버튼을
            눌러주세요.
          </p>
        </div>
      </LoginGate>
    </AppShell>
  );
}
