import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ComboRow } from "@/components/LottoBalls";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Admin() {
  const { isAuthenticated, user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [picks, setPicks] = useState<number[]>([]);
  const [weekIdInput, setWeekIdInput] = useState("");
  const [preview, setPreview] = useState<{
    poolComboCount: number;
    sample: number[][];
  } | null>(null);

  // 당첨번호 입력 상태
  const [resultWeekId, setResultWeekId] = useState("");
  const [resultRound, setResultRound] = useState("");
  const [resultNums, setResultNums] = useState(""); // "1,2,3,4,5,6"
  const [resultBonus, setResultBonus] = useState("");

  const poolInfo = trpc.admin.poolInfo.useQuery(undefined, { enabled: isAdmin });
  const stats = trpc.admin.stats.useQuery(undefined, { enabled: isAdmin });
  const weeks = trpc.admin.listWeeks.useQuery(undefined, { enabled: isAdmin });
  const allocByUser = trpc.admin.allocationByUser.useQuery(undefined, {
    enabled: isAdmin,
  });
  const subs = trpc.admin.listSubscriptions.useQuery(undefined, {
    enabled: isAdmin,
  });

  const previewMut = trpc.admin.preview.useMutation({
    onSuccess: (r) => setPreview(r),
    onError: (e) => toast.error(e.message),
  });
  const saveMut = trpc.admin.saveWeekly.useMutation({
    onSuccess: (r) => {
      toast.success(
        `${r.weekId} 저장 완료 (${r.poolComboCount.toLocaleString()}조합${r.published ? ", 게시됨" : ""})`,
      );
      utils.admin.listWeeks.invalidate();
      utils.admin.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const pubMut = trpc.admin.setPublished.useMutation({
    onSuccess: () => {
      toast.success("게시 상태 변경됨");
      utils.admin.listWeeks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const saveResultMut = trpc.adminResult.saveResult.useMutation({
    onSuccess: (r) => {
      toast.success(
        `${r.weekId} 당첨번호 저장 완료${r.published ? " (게시됨)" : ""}`
      );
      utils.adminResult.listResults.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const publishResultMut = trpc.adminResult.publishResult.useMutation({
    onSuccess: (r) => {
      toast.success(r.published ? "당첨 결과 게시됨" : "게시 취소됨");
      utils.adminResult.listResults.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const resultList = trpc.adminResult.listResults.useQuery(undefined, {
    enabled: isAdmin,
  });

  const subStatusMut = trpc.admin.setSubscriptionStatus.useMutation({
    onSuccess: () => {
      toast.success("구독 상태 변경됨");
      utils.admin.listSubscriptions.invalidate();
      utils.admin.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleNum(n: number) {
    setPreview(null);
    setPicks((prev) =>
      prev.includes(n)
        ? prev.filter((x) => x !== n)
        : [...prev, n].sort((a, b) => a - b),
    );
  }

  if (!loading && (!isAuthenticated || !isAdmin)) {
    return (
      <AppShell>
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          운영자만 접근할 수 있습니다.
        </div>
      </AppShell>
    );
  }

  const targetWeek = weekIdInput || poolInfo.data?.nextWeekId || "";

  return (
    <AppShell>
      <div className="space-y-4 px-4 py-5">
        <Link href="/more">
          <Button variant="ghost" size="sm" className="px-0 text-muted-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> 더보기
          </Button>
        </Link>
        <h1 className="text-xl font-extrabold">운영자 관리</h1>

        {/* 현황 */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3">
            <p className="text-[11px] text-muted-foreground">마스터 풀</p>
            <p className="mt-1 text-base font-bold">
              {(poolInfo.data?.masterPoolTotal ?? 0).toLocaleString()}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] text-muted-foreground">활성 구독</p>
            <p className="mt-1 text-base font-bold">
              {stats.data?.activeSubscriptions ?? 0}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] text-muted-foreground">주간 배분</p>
            <p className="mt-1 text-base font-bold">
              {stats.data?.weekAllocations ?? 0}
            </p>
          </Card>
        </div>

        <Tabs defaultValue="weekly">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="weekly">주간 번호</TabsTrigger>
            <TabsTrigger value="result">당첨 결과</TabsTrigger>
            <TabsTrigger value="alloc">회원 배분</TabsTrigger>
            <TabsTrigger value="subs">구독 관리</TabsTrigger>
          </TabsList>

          {/* ── 당첨 결과 ── */}
          <TabsContent value="result" className="space-y-4 pt-3">
            <Card className="p-4 space-y-3">
              <p className="text-sm font-bold">당첨번호 입력</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">주차 (weekId)</p>
                  <Input
                    placeholder={poolInfo.data?.nextWeekId ?? "2026-W25"}
                    value={resultWeekId}
                    onChange={(e) => setResultWeekId(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">회차 번호</p>
                  <Input
                    placeholder="1175"
                    value={resultRound}
                    onChange={(e) => setResultRound(e.target.value)}
                    className="h-8 text-sm"
                    type="number"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">당첨번호 6개 (콤마 구분)</p>
                <Input
                  placeholder="1,7,14,22,35,42"
                  value={resultNums}
                  onChange={(e) => setResultNums(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">보너스 번호</p>
                <Input
                  placeholder="5"
                  value={resultBonus}
                  onChange={(e) => setResultBonus(e.target.value)}
                  className="h-8 text-sm"
                  type="number"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={saveResultMut.isPending}
                  onClick={() => {
                    const nums = resultNums.split(",").map((s) => parseInt(s.trim(), 10));
                    const bonus = parseInt(resultBonus, 10);
                    const round = parseInt(resultRound, 10);
                    if (nums.length !== 6 || nums.some(isNaN) || isNaN(bonus) || isNaN(round)) {
                      toast.error("입력값을 확인해주세요");
                      return;
                    }
                    saveResultMut.mutate({
                      weekId: resultWeekId || undefined,
                      round,
                      winNumbers: nums,
                      bonusNumber: bonus,
                      publish: false,
                    });
                  }}
                >
                  저장
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={saveResultMut.isPending}
                  onClick={() => {
                    const nums = resultNums.split(",").map((s) => parseInt(s.trim(), 10));
                    const bonus = parseInt(resultBonus, 10);
                    const round = parseInt(resultRound, 10);
                    if (nums.length !== 6 || nums.some(isNaN) || isNaN(bonus) || isNaN(round)) {
                      toast.error("입력값을 확인해주세요");
                      return;
                    }
                    saveResultMut.mutate({
                      weekId: resultWeekId || undefined,
                      round,
                      winNumbers: nums,
                      bonusNumber: bonus,
                      publish: true,
                    });
                  }}
                >
                  저장+게시
                </Button>
              </div>
            </Card>

            {/* 당첨 결과 목록 */}
            <div className="space-y-2">
              {resultList.data?.map((r) => (
                <Card key={r.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        {r.weekId} · {r.round}회
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(r.winNumbers as number[]).join(", ")} + {r.bonusNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.published ? "default" : "outline"}>
                        {r.published ? "게시" : "대기"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={publishResultMut.isPending}
                        onClick={() =>
                          publishResultMut.mutate({
                            weekId: r.weekId,
                            published: !r.published,
                          })
                        }
                      >
                        {r.published ? "게시취소" : "게시"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {resultList.data?.length === 0 && (
                <p className="text-xs text-muted-foreground">당첨 결과가 없습니다.</p>
              )}
            </div>
          </TabsContent>

          {/* ── 주간 번호 ── */}
          <TabsContent value="weekly" className="space-y-4 pt-3">
            <Card className="p-4">
              <p className="mb-1 text-sm font-bold">지정번호 선택</p>
              <p className="mb-2 text-xs text-muted-foreground">
                토요일 추첨 후, 다음 주 번호를 등록합니다. 기본 대상 주차:{" "}
                <span className="font-semibold text-primary">
                  {poolInfo.data?.nextWeekId ?? "-"}
                </span>{" "}
                (이번 주: {poolInfo.data?.currentWeekId ?? "-"})
              </p>

              <Input
                value={weekIdInput}
                onChange={(e) => setWeekIdInput(e.target.value)}
                placeholder={`대상 주차 (비우면 ${poolInfo.data?.nextWeekId ?? "다음 주"})`}
                className="mb-3 h-9 text-sm"
              />

              <div className="grid grid-cols-9 gap-1.5">
                {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
                  const on = picks.includes(n);
                  return (
                    <button
                      key={n}
                      onClick={() => toggleNum(n)}
                      className={`flex h-8 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  선택 {picks.length}개 · 대상 {targetWeek}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPicks([]);
                    setPreview(null);
                  }}
                >
                  초기화
                </Button>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  disabled={picks.length < 6 || previewMut.isPending}
                  onClick={() => previewMut.mutate({ numbers: picks })}
                >
                  미리보기
                </Button>
                <Button
                  className="flex-1"
                  disabled={picks.length < 6 || saveMut.isPending}
                  onClick={() =>
                    saveMut.mutate({
                      numbers: picks,
                      publish: true,
                      weekId: weekIdInput || undefined,
                    })
                  }
                >
                  저장 + 게시
                </Button>
              </div>

              {preview && (
                <div className="mt-3 rounded-lg bg-secondary/50 p-3">
                  <p className="text-sm font-semibold">
                    교집합 조합:{" "}
                    <span className="text-primary">
                      {preview.poolComboCount.toLocaleString()}개
                    </span>
                  </p>
                  <p className="mb-2 mt-2 text-xs text-muted-foreground">
                    샘플 (최대 20)
                  </p>
                  <div className="space-y-1.5">
                    {preview.sample.map((c, i) => (
                      <ComboRow key={i} combo={c} />
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <div>
              <h2 className="mb-2 text-sm font-bold">주간 기록</h2>
              <div className="space-y-2">
                {weeks.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    아직 저장된 주간 데이터가 없습니다.
                  </p>
                )}
                {weeks.data?.map((w) => (
                  <Card
                    key={w.weekId}
                    className="flex items-center justify-between p-3"
                  >
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {w.weekId}
                        {w.published ? (
                          <Badge className="bg-primary text-primary-foreground">
                            게시
                          </Badge>
                        ) : (
                          <Badge variant="outline">미게시</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {w.poolComboCount.toLocaleString()}조합 · 지정{" "}
                        {(w.numbers as number[]).length}개
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pubMut.isPending}
                      onClick={() =>
                        pubMut.mutate({
                          weekId: w.weekId,
                          published: !w.published,
                        })
                      }
                    >
                      {w.published ? "게시중단" : "게시"}
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── 회원 배분 ── */}
          <TabsContent value="alloc" className="space-y-2 pt-3">
            <p className="text-xs text-muted-foreground">
              {allocByUser.data?.weekId} 기준 회원별 배분 현황
            </p>
            {allocByUser.data?.users.length === 0 && (
              <p className="text-xs text-muted-foreground">
                아직 배분 내역이 없습니다.
              </p>
            )}
            {allocByUser.data?.users.map((u) => (
              <Card
                key={u.userId}
                className="flex items-center justify-between p-3"
              >
                <div>
                  <p className="text-sm font-semibold">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    순환 {u.maxCycle}회차
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {u.count}조합
                </Badge>
              </Card>
            ))}
          </TabsContent>

          {/* ── 구독 관리 ── */}
          <TabsContent value="subs" className="space-y-2 pt-3">
            {subs.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                구독 내역이 없습니다.
              </p>
            )}
            {subs.data?.map((s) => (
              <Card key={s.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {s.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        · {s.planId}
                        {s.isDouble ? " ×2" : ""}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.startAt).toLocaleDateString()} ~{" "}
                      {s.endAt
                        ? new Date(s.endAt).toLocaleDateString()
                        : "무기한"}{" "}
                      · {s.source}
                    </p>
                  </div>
                  <Badge
                    variant={s.status === "active" ? "default" : "outline"}
                    className={
                      s.status === "active"
                        ? "bg-primary text-primary-foreground"
                        : ""
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs"
                    disabled={s.status === "active" || subStatusMut.isPending}
                    onClick={() =>
                      subStatusMut.mutate({ id: s.id, status: "active" })
                    }
                  >
                    활성화
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs"
                    disabled={s.status === "expired" || subStatusMut.isPending}
                    onClick={() =>
                      subStatusMut.mutate({ id: s.id, status: "expired" })
                    }
                  >
                    만료
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs"
                    disabled={s.status === "cancelled" || subStatusMut.isPending}
                    onClick={() =>
                      subStatusMut.mutate({ id: s.id, status: "cancelled" })
                    }
                  >
                    취소
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
