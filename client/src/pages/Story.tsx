import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageWrapper } from "@/components/PageWrapper";

export default function Story() {
  return (
    <AppShell>
      <PageWrapper className="space-y-4 px-4 py-5">
        <Link href="/more">
          <Button variant="ghost" size="sm" className="px-0 text-muted-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> 더보기
          </Button>
        </Link>

        <Card className="tiger-gradient relative overflow-hidden border-0 p-6 text-[#1a1407]">
          <span className="text-5xl">🐯</span>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight">
            넉살좋은
            <br />
            플라잉 타이거
          </h1>
          <p className="mt-2 text-sm font-medium opacity-90">
            정직하게, 꾸준하게, 행운을 나눕니다.
          </p>
        </Card>

        <Card className="space-y-4 p-5 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-1 font-bold text-primary">연구의 시작</h2>
            <p className="text-muted-foreground">
              넉살좋은 플라잉 타이거는 오랜 시간 로또 번호의 출현 패턴을 직접
              정리하고 기록해 왔어요. 역대 당첨 조합, 번호대 분포, 홀짝
              구성, 연속 번호와 같은 다양한 규칙을 다단계로 살펴보며 자신만의
              기준을 세웠어요.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-bold text-primary">이 앱의 취지</h2>
            <p className="text-muted-foreground">
              혼자만 보던 분석을 더 많은 분과 나누고자 이 앱을 시작했어요.
              매주 직접 엄선한 번호 조합을 회원분들께 중복 없이 배분해서,
              번호를 고르는 수고를 덜어드리는 게 목표예요.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-bold text-primary">행운의 메시지</h2>
            <p className="text-muted-foreground">
              로또는 누구에게나 공평한 무작위 추첨이에요. 이 앱은 재미와
              참고를 위한 서비스예요. 당첨을 약속하지는 않아요. 부담 없는
              범위에서 즐기시고, 매주 작은 설렘과 함께해요.
            </p>
          </section>

          <section className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">
              넉살좋은 플라잉 타이거의 더 많은 이야기와 영상은 외부 채널에서 만나볼 수
              있어요. 앱 정책상 외부 링크 자동 이동은 제공하지 않아요.
              채널명을 검색해서 직접 방문해 주세요.
              <br /><br />
              유튜브 채널 검색에서{" "}
              <span className="font-semibold text-foreground">로또 1등 당첨되기 프로젝트</span>
              를 검색해 주세요.
            </p>
          </section>
        </Card>

        <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
          이 서비스는 데이터 기반 참고용 추천 정보를 드려요. 당첨을 보장하지는 않아요. 과도한 구매는 삼가 주세요.
        </p>
      </PageWrapper>
    </AppShell>
  );
}
