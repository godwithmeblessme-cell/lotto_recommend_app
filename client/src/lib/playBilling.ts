/**
 * 구글 플레이 인앱결제(Google Play Billing) 클라이언트 헬퍼.
 *
 * 안드로이드(구글플레이)에 디지털 콘텐츠 구독을 판매하려면 반드시 Google Play Billing을
 * 사용해야 합니다(토스페이 등 외부 PG 직접 연동은 정책 위반으로 앱이 삭제될 수 있습니다).
 *
 * 이 앱을 TWA(Trusted Web Activity)로 패키징했다면, Chrome이 제공하는
 * Digital Goods API + Payment Request API 로 Play Billing을 호출합니다.
 * (자세한 안드로이드 패키징 방법은 함께 제공한 "안드로이드_출시_가이드.md" 참고)
 *
 * 주의: 이 API는 실제 구글플레이 앱(서명된 패키지, Play Console 등록, 상품 등록)이
 * 갖춰져야 동작합니다. 일반 웹 브라우저(PC, 사파리 등)에서는 지원되지 않습니다.
 */

export interface PlayBillingResult {
  purchaseToken: string;
  productId: string;
  /** 서버 검증 결과(success/fail)에 따라 반드시 호출해야 결제 UI가 정상적으로 닫힙니다. */
  complete: (status: "success" | "fail") => Promise<void>;
}

declare global {
  interface Window {
    getDigitalGoodsService?: (
      paymentMethod: string,
    ) => Promise<DigitalGoodsService>;
  }
}

interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<
    { itemId: string; price: { currency: string; value: string }; title?: string }[]
  >;
  listPurchases(): Promise<{ itemId: string; purchaseToken: string }[]>;
  acknowledge(purchaseToken: string, type: "repeatable" | "onetime"): Promise<void>;
  consume?(purchaseToken: string): Promise<void>;
}

const PLAY_BILLING_METHOD = "https://play.google.com/billing";

/** 안드로이드 TWA + Play Billing 환경인지 확인 */
export function isPlayBillingAvailable(): boolean {
  return typeof window !== "undefined" && "getDigitalGoodsService" in window;
}

/**
 * 구글 플레이 콘솔에 등록한 productId(구독 상품 ID)로 결제 다이얼로그를 띄웁니다.
 * 성공 시 서버에 보낼 purchaseToken을 반환합니다.
 *
 * @param productId Play Console > 수익 창출 > 제품 > 구독에서 등록한 상품 ID
 *   (예: "month_sub", "year_sub")
 */
export async function purchaseSubscription(
  productId: string,
): Promise<PlayBillingResult> {
  if (!isPlayBillingAvailable()) {
    throw new Error(
      "구글 플레이 결제는 안드로이드 앱(Play 스토어로 설치된 버전)에서만 가능합니다.",
    );
  }

  const paymentMethods = [
    { supportedMethods: PLAY_BILLING_METHOD, data: { sku: productId } },
  ];
  // Play Billing 사용 시 실제 가격/통화는 Play 콘솔 설정을 따르므로 details는 형식상 값만 채움.
  const paymentDetails = {
    total: { label: "Total", amount: { currency: "KRW", value: "0" } },
  };

  const request = new PaymentRequest(paymentMethods, paymentDetails);
  const paymentResponse = await request.show();
  const purchaseToken: string | undefined = (paymentResponse.details as any)
    ?.purchaseToken;

  if (!purchaseToken) {
    await paymentResponse.complete("fail");
    throw new Error("결제 토큰을 받지 못했습니다.");
  }

  return {
    purchaseToken,
    productId,
    complete: (status: "success" | "fail") => paymentResponse.complete(status),
  };
}

/** 이미 보유 중인 구독 구매 내역 조회 (재설치/기기변경 시 복구용) */
export async function listExistingPurchases(): Promise<
  { itemId: string; purchaseToken: string }[]
> {
  if (!isPlayBillingAvailable()) return [];
  const service = await window.getDigitalGoodsService!(PLAY_BILLING_METHOD);
  return service.listPurchases();
}
