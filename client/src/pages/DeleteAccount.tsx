/**
 * 계정 및 데이터 삭제 페이지.
 *
 * 구글 플레이 "데이터 보안" 선언에서 요구하는 "계정 삭제 URL"로 등록할 페이지.
 * - 로그인 안 한 상태: 삭제 절차 안내 + 로그인 유도
 * - 로그인 한 상태: 실제 탈퇴(모든 데이터 영구 삭제) 버튼 제공
 */
import { AppShell } from "@/components/AppShell";
import { LoginGate } from "@/components/LoginGate";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageWrapper } from "@/components/PageWrapper";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export default function DeleteAccount() {
  const { isAuthenticated, loading, user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, navigate] = useLocation();

  const deleteMut = trpc.account.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("계정과 모든 데이터가 삭제되었습니다.");
      navigate("/");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageWrapper className="space-y-4 px-4 py-5">
        <div>
          <h1 className="text-xl font-extrabold">계정 및 데이터 삭제</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            회원 탈퇴 시 아래 데이터가 영구적으로 삭제됩니다.
          </p>
        </div>

        <Card className="space-y-2 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">삭제되는 항목</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>회원 정보 (닉네임, 이메일, 카카오 연동 정보)</li>
            <li>구독/결제 이력</li>
            <li>받았던 분석 번호 조합 기록</li>
            <li>출석/포인트 적립 기록</li>
            <li>푸시 알림 등록 정보</li>
          </ul>
          <p className="pt-2 text-xs">
            탈퇴 처리는 즉시 이루어지며, 삭제된 데이터는 복구할 수 없습니다.
            진행 중인 유료 구독이 있다면 탈퇴 전 구글 플레이에서 별도로
            구독을 취소해주세요 (탈퇴만으로는 정기결제가 자동 취소되지
            않습니다).
          </p>
        </Card>

        {loading && (
          <Card className="p-4 text-sm text-muted-foreground">
            확인 중...
          </Card>
        )}

        {!loading && !isAuthenticated && (
          <>
            <Card className="p-4 text-sm text-muted-foreground">
              탈퇴를 진행하려면 먼저 카카오 계정으로 로그인해주세요. 로그인
              후 이 페이지로 다시 돌아오시면 탈퇴 버튼이 나타납니다.
            </Card>
            <LoginGate message="탈퇴를 진행하려면 로그인이 필요해요." />
          </>
        )}

        {!loading && isAuthenticated && (
          <Card className="space-y-3 border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">{user?.name ?? "회원"}</span>{" "}
                님의 계정을 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setConfirmOpen(true)}
            >
              계정 탈퇴 진행
            </Button>
          </Card>
        )}
      </PageWrapper>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle>정말 탈퇴하시겠어요?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            계정과 모든 데이터가 영구적으로 삭제되며, 이 작업은 취소할 수
            없습니다.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              {deleteMut.isPending ? "처리 중..." : "영구 삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
