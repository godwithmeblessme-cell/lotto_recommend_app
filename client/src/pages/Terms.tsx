import { AppShell } from "@/components/AppShell";
import { PageWrapper } from "@/components/PageWrapper";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

export default function Terms() {
  return (
    <AppShell>
      <PageWrapper className="px-4 py-5">
        <div className="mb-4 flex items-center gap-2">
          <Link href="/more">
            <button className="flex items-center gap-1 text-sm text-muted-foreground">
              <ChevronLeft className="h-4 w-4" /> 더보기
            </button>
          </Link>
        </div>

        <h1 className="mb-6 text-xl font-extrabold">이용약관</h1>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-2 text-base font-bold">제1조 (목적)</h2>
            <p className="text-muted-foreground">
              이 약관은 로또 통계 분석 (운영: 무적 로또 태권 V 프로젝트, 이하 "서비스")이 제공하는 서비스의 이용과 관련하여 서비스와 이용자의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제2조 (서비스의 성격 및 면책)</h2>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="font-semibold text-foreground">⚠️ 중요 안내</p>
              <p className="mt-1 text-muted-foreground">
                본 서비스는 과거 당첨 데이터 기반 통계 분석 참고 서비스입니다. 당첨을 보장하지 않으며, 복권 구매는 본인 책임 하에 이루어집니다. 로또는 매 회차 무작위 추첨이며 어떠한 분석도 당첨 확률을 수학적으로 높이지 않습니다. 본 서비스를 이용한 결과에 대해 당사는 책임을 지지 않습니다.
              </p>
            </div>
            <p className="mt-3 text-muted-foreground">
              본 서비스는 운영자(무적 로또 태권 V)가 번호를 직접 선별·배분하는 방식으로 운영되며, 복권 당첨을 조작하거나 보장하지 않습니다. 본 서비스는 실제 복권 판매 및 베팅을 제공하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제3조 (이용자의 의무)</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>이용자는 서비스를 이용함에 있어 관련 법령을 준수해야 합니다.</li>
              <li>이용자는 타인의 계정을 사용하거나 서비스를 부정한 방법으로 이용해서는 안 됩니다.</li>
              <li>이용자는 서비스에서 제공하는 분석 번호를 상업적으로 재판매하거나 배포해서는 안 됩니다.</li>
              <li>이용자는 서비스를 이용하여 얻은 정보를 당첨 보장 광고 등에 활용해서는 안 됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제4조 (구독 및 결제)</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>구독 서비스는 선결제 방식으로 운영됩니다.</li>
              <li>구독 기간 중 서비스 이용이 가능하며, 구독 만료 후 자동 갱신되지 않습니다.</li>
              <li>분석 번호가 제공(열람)된 이후에는 콘텐츠 특성상 환불이 제한될 수 있습니다.</li>
              <li>평생 회원권은 고액 상품으로, 결제 전 혜택과 환불 제한 사항을 충분히 확인해 주세요.</li>
              <li>자세한 환불 기준은 전자상거래법 등 관련 법령에 따릅니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제5조 (서비스의 제공 및 중단)</h2>
            <p className="text-muted-foreground">
              서비스는 분석 번호를 매주 월요일부터 토요일 오후 7시(KST)까지 제공합니다. 시스템 점검, 장애, 운영상의 이유로 서비스가 일시 중단될 수 있으며, 이 경우 사전 공지를 통해 안내합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제6조 (분쟁 해결)</h2>
            <p className="text-muted-foreground">
              서비스 이용과 관련하여 발생한 분쟁에 대해서는 관련 법령에 따르며, 분쟁 발생 시 앱 내 고객센터를 통해 먼저 해결을 시도합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제7조 (약관의 변경)</h2>
            <p className="text-muted-foreground">
              서비스는 필요한 경우 약관을 변경할 수 있으며, 변경 시 시행 7일 전에 공지합니다. 이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.
            </p>
            <p className="mt-2 text-muted-foreground">시행일: 2026년 6월 16일</p>
          </section>
        </div>
      </PageWrapper>
    </AppShell>
  );
}
