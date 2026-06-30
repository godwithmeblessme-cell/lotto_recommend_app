/**
 * 구독 플랜 / 광고 정책 공유 상수
 * (서버·클라이언트 공통 사용)
 */

export type PlanId = "trial" | "month" | "year";

export interface Plan {
  id: PlanId;
  name: string;
  /** 주당 분석 조합 수 */
  combosPerWeek: number;
  /** 구독 지속 주 수 */
  durationWeeks: number;
  /** VAT 포함 표시 가격 (원) */
  priceKRW: number;
  /** 정기결제(구독)형 여부 */
  recurring: boolean;
  /** 짧은 설명 */
  blurb: string;
  /** 인기/추천 뱃지 */
  badge?: string;
  /**
   * 구글 플레이 콘솔에 등록한 구독 상품 ID.
   * trial(무료체험)은 결제가 없으므로 비워둡니다.
   */
  playProductId?: string;
}

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "1주 무료체험",
    combosPerWeek: 10,
    durationWeeks: 1,
    priceKRW: 0,
    recurring: false,
    blurb: "회원가입 시 1회, 분석 조합 10개 무료 제공",
  },
  month: {
    id: "month",
    name: "1개월 구독",
    combosPerWeek: 20,
    durationWeeks: 4,
    priceKRW: 5500,
    recurring: true,
    blurb: "매주 분석 조합 20개 (월 정기구독)",
    playProductId: "month_sub",
  },
  year: {
    id: "year",
    name: "1년 정기구독",
    combosPerWeek: 50,
    durationWeeks: 52,
    priceKRW: 11000,
    recurring: true,
    blurb: "매주 분석 조합 50개 (연 정기구독, 최고 혜택)",
    badge: "최고 혜택",
    playProductId: "year_sub",
  },
};

/** 결제로 구매 가능한 플랜만 (무료체험 제외) */
export const PLAN_ORDER: PlanId[] = ["month", "year"];

/** 환불 정책 안내 문구 (결제 화면 노출용) */
export const REFUND_POLICY =
  "본 상품은 디지털 콘텐츠(분석 번호 정보)로, 분석 조합이 제공(열람)된 이후에는 콘텐츠 특성상 환불이 제한될 수 있습니다. 자세한 환불 기준은 이용약관 및 관련 법령(전자상거래법 등)에 따릅니다.";

/** 면책 / 사행성 고지 문구 */
export const DISCLAIMER =
  "본 서비스는 과거 당첨 데이터 기반 통계 분석 참고 서비스입니다. 당첨을 보장하지 않으며, 복권 구매는 본인 책임 하에 이루어집니다. 로또는 매 회차 무작위 추첨이며 어떠한 분석도 당첨 확률을 수학적으로 높이지 않습니다. 본 서비스를 이용한 결과에 대해 당사는 책임을 지지 않습니다. 본 서비스는 실제 복권 판매·베팅을 제공하지 않습니다.";

/** 광고 종류 */
export type AdType = "banner" | "rewarded" | "interstitial";

/* ------------------------------------------------------------------ */
/* 순수 계산 헬퍼 (서버 로직 + 테스트 공용)                            */
/* ------------------------------------------------------------------ */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 플랜의 주간 분석 조합 수 */
export function combosForPlan(planId: PlanId): number {
  const plan = PLANS[planId];
  if (!plan) return 0;
  return plan.combosPerWeek;
}

/** 구독 종료 시각(ms) */
export function computeEndAt(planId: PlanId, startAt: number): number {
  const plan = PLANS[planId];
  if (!plan) return startAt;
  return startAt + plan.durationWeeks * WEEK_MS;
}
