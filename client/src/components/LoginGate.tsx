import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";

export function LoginGate({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
      <span className="text-3xl">🐯</span>
      <p className="text-sm text-muted-foreground">
        {message ?? "로그인하고 이번 주 분석 번호를 받아요."}
      </p>
      <Button
        className="w-full"
        onClick={() => {
          window.location.href = getLoginUrl();
        }}
      >
        카카오로 시작하기
      </Button>
      <p className="text-[11px] text-muted-foreground/60">
        카카오 계정으로 간편하게 시작할 수 있어요.
      </p>
    </div>
  );
}
