/**
 * useShareLotto
 * 추천번호 조합을 카카오톡 또는 이미지(Web Share / 다운로드)로 공유하는 훅.
 *
 * 카카오 앱 키 설정:
 *   VITE_KAKAO_APP_KEY 환경변수에 JavaScript 앱 키를 넣으면 카카오 공유가 활성화됩니다.
 *   키가 없으면 카카오 버튼은 비활성 상태로 표시되고 이미지 공유만 동작합니다.
 */

import html2canvas from "html2canvas";

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share: {
        sendDefault: (options: object) => void;
      };
    };
  }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_APP_KEY as string | undefined;

function initKakao() {
  if (!KAKAO_KEY) return false;
  if (!window.Kakao) return false;
  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_KEY);
  }
  return true;
}

/** DOM 요소를 PNG Blob으로 변환 */
async function elementToBlob(el: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(el, {
    backgroundColor: "#291e0a",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas toBlob failed"))),
      "image/png",
    );
  });
}

export type ShareMethod = "kakao" | "image" | "webshare";

export interface ShareLottoOptions {
  combos: number[][];
  planName?: string;
  weekId?: string;
}

export function useShareLotto() {
  const kakaoReady = initKakao();

  /**
   * 카카오톡 공유 (Feed 메시지)
   * 카드 이미지를 서버에 올리는 대신, 앱 아이콘과 텍스트만 사용하는 텍스트 공유 방식.
   * 실제 이미지 공유를 원하면 이미지를 S3에 업로드 후 imageUrl을 넣으면 됩니다.
   */
  function shareKakao({ combos, planName, weekId }: ShareLottoOptions) {
    if (!kakaoReady || !window.Kakao) {
      throw new Error("카카오 앱 키가 설정되지 않았습니다.");
    }
    const lines = combos
      .map((c, i) => `${i + 1}. ${[...c].sort((a, b) => a - b).join(", ")}`)
      .join("\n");
    const description = `[태권 V 분석]\n${weekId ? weekId + " 분석번호\n" : ""}${lines}`;

    window.Kakao.Share.sendDefault({
      objectType: "text",
      text: description,
      link: {
        mobileWebUrl: window.location.origin,
        webUrl: window.location.origin,
      },
      buttons: [
        {
          title: "태권 V 분석 앱 열기",
          link: {
            mobileWebUrl: window.location.origin,
            webUrl: window.location.origin,
          },
        },
      ],
    });
  }

  /**
   * 이미지 저장 또는 Web Share API 공유.
   * cardEl: 캡처할 DOM 요소 (ref.current)
   */
  async function shareImage(
    cardEl: HTMLElement,
    opts: ShareLottoOptions,
  ): Promise<void> {
    const blob = await elementToBlob(cardEl);
    const file = new File([blob], "taekwonv-lotto.png", { type: "image/png" });

    // Web Share API (모바일 기본 공유 시트)
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      const lines = opts.combos
        .map((c, i) => `${i + 1}. ${[...c].sort((a, b) => a - b).join(", ")}`)
        .join("\n");
      await navigator.share({
        title: "태권 V 분석번호",
        text: `[태권 V 분석]\n${opts.weekId ? opts.weekId + " 분석번호\n" : ""}${lines}\n${window.location.origin}`,
        files: [file],
      });
      return;
    }

    // fallback: 이미지 다운로드
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "taekwonv-lotto.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  return { kakaoReady, shareKakao, shareImage };
}
