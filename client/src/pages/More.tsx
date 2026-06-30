import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  BookOpen,
  Shield,
  LogOut,
  Settings,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Lock,
  Bell,
  BellOff,
} from "lucide-react";
import { RELEASE_WINDOW_NOTICE } from "@shared/week";
import { DISCLAIMER } from "@shared/plans";
import { PageWrapper } from "@/components/PageWrapper";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { requestPushToken, isPushSupported } from "@/lib/firebase";
import { toast } from "sonner";

/** 알림 받기 켜기/끄기 카드. 권한 요청 → FCM 토큰 발급 → 서버 등록까지 한 번에 처리. */
function PushNotificationCard() {
  const [status, setStatus] = useState<"idle" | "loading" | "enabled" | "denied">(
    "idle",
  );
  const registerMut = trpc.push.register.useMutation();

  async function handleEnable() {
    setStatus("loading");
    const supported = await isPushSupported();
    if (!supported) {
      toast.error("이 기기/브라우저는 알림 기능을 지원하지 않아요.");
      setStatus("idle");
      return;
    }
    const token = await requestPushToken();
    if (!token) {
      setStatus("denied");
      toast.error("알림 권한이 거부되었어요. 기기 설정에서 다시 허용해주세요.");
      return;
    }
    try {
      await registerMut.mutateAsync({ token, platform: "android" });
      setStatus("enabled");
      toast.success("알림을 받을 수 있게 설정했어요!");
    } catch (e) {
      setStatus("idle");
      toast.error("알림 등록에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3">
        {status === "enabled" ? (
          <Bell className="h-5 w-5 text-primary" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-semibold">당첨 발표 알림</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            매주 일요일 9시, 당첨 결과를 알림으로 받아요.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={status === "enabled" ? "outline" : "default"}
        disabled={status === "loading" || status === "enabled"}
        onClick={handleEnable}
      >
        {status === "enabled" ? "켜짐" : status === "loading" ? "처리 중..." : "켜기"}
      </Button>
    </Card>
  );
}

export default function More() {
  const { isAuthenticated, user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <AppShell>
      <PageWrapper className="space-y-4 px-4 py-5">
        <h1 className="text-xl font-extrabold">더보기</h1>

        <div className="space-y-2">
          <MenuItem href="/story" icon={BookOpen} label="타이거마스크 이야기" />
          {isAuthenticated && (
            <>
              <MenuItem href="/points" icon={Coins} label="럭키포인트" />
              <MenuItem href="/subscribe" icon={CreditCard} label="구독 / 이용권" />
            </>
          )}
          {isAdmin && (
            <MenuItem href="/admin" icon={Settings} label="운영자 관리" />
          )}
          <MenuItem href="/terms" icon={FileText} label="이용약관" />
          <MenuItem href="/privacy" icon={Lock} label="개인정보처리방침" />
        </div>

        {isAuthenticated && <PushNotificationCard />}

        <Card className="flex items-start gap-3 p-4">
          <Clock className="mt-0.5 h-5 w-5 text-accent" />
          <div>
            <p className="text-sm font-semibold">번호 방출 시간</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {RELEASE_WINDOW_NOTICE}
            </p>
          </div>
        </Card>

        <Card className="flex items-start gap-3 p-4">
          <Shield className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">면책 안내</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {DISCLAIMER}
            </p>
          </div>
        </Card>

        {isAuthenticated && (
          <Button
            variant="outline"
            className="w-full bg-secondary/50"
            onClick={() => logout()}
          >
            <LogOut className="mr-1 h-4 w-4" /> 로그아웃
          </Button>
        )}
      </PageWrapper>
    </AppShell>
  );
}

function MenuItem({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: any;
  label: string;
}) {
  return (
    <Link href={href}>
      <Card className="flex items-center justify-between p-4">
        <span className="flex items-center gap-3 text-sm font-medium">
          <Icon className="h-5 w-5 text-primary" />
          {label}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Card>
    </Link>
  );
}
