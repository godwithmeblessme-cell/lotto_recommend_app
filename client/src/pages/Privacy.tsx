import { AppShell } from "@/components/AppShell";
import { PageWrapper } from "@/components/PageWrapper";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

export default function Privacy() {
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

        <h1 className="mb-6 text-xl font-extrabold">개인정보처리방침</h1>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-2 text-base font-bold">제1조 (개인정보의 처리 목적)</h2>
            <p className="text-muted-foreground">
              로또 통계 분석 (운영: 무적 로또 태권 V 프로젝트, 이하 "서비스")은 다음의 목적을 위해 개인정보를 처리합니다. 처리하는 개인정보는 다음의 목적 이외의 용도로 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행합니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>회원 가입 및 관리</li>
              <li>서비스 제공 및 분석 번호 배분</li>
              <li>구독 결제 및 정산</li>
              <li>고객 문의 응대</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제2조 (처리하는 개인정보 항목)</h2>
            <p className="text-muted-foreground">
              서비스는 다음의 개인정보 항목을 처리합니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>필수 항목: 카카오 계정 식별자(OpenID), 닉네임</li>
              <li>자동 수집: 서비스 이용 기록, 접속 로그, 결제 기록</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제3조 (개인정보의 처리 및 보유 기간)</h2>
            <p className="text-muted-foreground">
              서비스는 법령에 따른 개인정보 보유·이용 기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용 기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>회원 정보: 회원 탈퇴 시까지</li>
              <li>결제 기록: 전자상거래법에 따라 5년</li>
              <li>서비스 이용 기록: 3년</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제4조 (개인정보의 제3자 제공)</h2>
            <p className="text-muted-foreground">
              서비스는 원칙적으로 정보주체의 개인정보를 제3자에게 제공하지 않습니다. 다만, 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우는 예외로 합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제5조 (정보주체의 권리·의무 및 행사 방법)</h2>
            <p className="text-muted-foreground">
              정보주체는 서비스에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리 정지 요구</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제6조 (개인정보 보호책임자)</h2>
            <p className="text-muted-foreground">
              서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만 처리 및 피해 구제 등을 위해 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <div className="mt-2 rounded-xl border border-border bg-secondary/30 p-3 text-muted-foreground">
              <p>개인정보 보호책임자: 무적 로또 태권 V 프로젝트 운영팀</p>
              <p className="mt-1">문의: 앱 내 고객센터를 통해 접수</p>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">제7조 (개인정보처리방침 변경)</h2>
            <p className="text-muted-foreground">
              이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경 사항의 시행 7일 전부터 공지사항을 통하여 고지합니다.
            </p>
            <p className="mt-2 text-muted-foreground">시행일: 2026년 6월 16일</p>
          </section>
        </div>
      </PageWrapper>
    </AppShell>
  );
}
