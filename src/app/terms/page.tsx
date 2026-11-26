import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { textLink } from "@/components/ui/styles";
import { PRIVACY_PAGE, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "服務條款",
  description: `${SITE_NAME} 的服務條款：帳號、創作者審核、合作與付款、站內訊息、停權與責任。`,
};

// 內容依目前實際運作撰寫（README、docs/superpowers/specs/）。不知道的事實一律用「（…）」佔位，不可自行編造。
// 改了流程（例如開放線上付款、開始收手續費）時，這裡要一起更新。
const OPERATOR = "（營運者名稱）";

export default function TermsPage() {
  return (
    <LegalPage
      title="服務條款"
      intro={
        <p>
          歡迎使用 {SITE_NAME}（以下稱「本平台」）。本平台由{OPERATOR}（以下稱「我們」）營運，提供品牌與創作者媒合、合作管理、交稿與站內訊息的服務。
          註冊或使用本平台，即表示你已閱讀並同意這份服務條款與
          <Link href={PRIVACY_PAGE} className={textLink}>《隱私權政策》</Link>。
        </p>
      }
    >
      <LegalSection id="terms-account" title="一、帳號">
        <ul>
          <li>你可以用 Email 驗證碼登入；我們開放時，也可以用 Google 等第三方帳號登入。本平台不使用密碼。</li>
          <li>註冊時請選擇身分：<strong>品牌</strong>（發布招募、邀請創作者、付款）或<strong>創作者</strong>（建立公開頁、報名招募、交稿、收款）。</li>
          <li>請提供真實、正確的資料，並妥善保管你的 Email 信箱與登入裝置。透過你的帳號進行的操作，視為你本人的操作。</li>
          <li>一個人或一個品牌請只使用一個帳號。帳號不可轉讓、出借或販售。</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-review" title="二、創作者審核">
        <ul>
          <li>創作者需要填寫 Instagram 帳號等資料，並依指示把驗證碼放到 IG 自我介紹，由我們人工核對後審核。</li>
          <li>審核通過前，你的公開頁不會公開，只有你自己看得到。</li>
          <li>我們可以依資料真實性、內容品質或本條款的規定決定是否通過審核，不一定說明理由。</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-collab" title="三、合作流程">
        <ul>
          <li>品牌可以發布招募讓創作者報名，或直接邀請創作者；雙方確認後成立合作案。</li>
          <li>合作內容、金額、交付項目與時程由品牌與創作者自行約定，並以合作案上記載的內容為準。本平台不是任何一方的代理人或經紀人。</li>
          <li>創作者在平台上交稿，品牌在平台上審核；品牌審核通過、創作者發佈貼文後，合作案才進入撥款。</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-payment" title="四、付款與撥款">
        <ul>
          <li><strong>線上付款目前尚未開放。</strong>品牌付款由我們人工確認入帳後，在合作案標記為已付款；開放線上付款（綠界）後，會另外公告並更新本條款。</li>
          <li>品牌支付的款項先由平台保管，等合作完成（交稿、審核通過並發佈）後，再以<strong>人工銀行轉帳</strong>撥給創作者在「收款帳戶」填寫的帳戶。創作者沒有填寫收款帳戶時，我們無法撥款。</li>
          <li>本平台<strong>目前不收取平台手續費</strong>，品牌支付的合作金額全額撥給創作者。若日後要收費，會事先公告並取得你的同意。</li>
          <li>本平台目前不開立發票；稅務與發票事宜由品牌與創作者依法自行處理。</li>
          <li>合作案因爭議被平台取消時，已付款的款項會全額退回品牌。</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-messages" title="五、站內訊息與交稿">
        <ul>
          <li>站內訊息、交稿檔案與合作紀錄都儲存在本平台，合作雙方與我們的管理員可以查看，用來處理撥款、爭議與違規。</li>
          <li>為了保障雙方，請在平台上溝通與付款。訊息包含電話、Email、LINE ID 或外部連結時，系統會在送出前提醒，送出後會被標記，管理員可以檢視被標記的訊息。</li>
          <li>請勿傳送騷擾、歧視、詐騙或違法的內容。</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-content" title="六、你上傳的內容">
        <ul>
          <li>你上傳的頭像、作品、招募封面、交稿檔案與訊息，著作權仍屬於你或原權利人。</li>
          <li>你同意我們在提供本平台服務的必要範圍內儲存、處理與顯示這些內容（例如在創作者公開頁顯示作品、讓合作對方查看交稿）。</li>
          <li>品牌取得交稿內容後可以如何使用，依雙方在合作案中的約定。</li>
          <li>請確認你有權上傳這些內容，且內容不侵害他人的權利。</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-prohibited" title="七、禁止的行為">
        <ul>
          <li>冒用他人身分、提供虛假的追蹤數或成效資料。</li>
          <li>以本平台進行詐騙、洗錢或其他違法行為。</li>
          <li>干擾或破壞本平台的運作，例如未經授權存取他人帳號或資料、大量自動化操作。</li>
          <li>違反本條款或法令的其他行為。</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-suspension" title="八、停權">
        <ul>
          <li>違反本條款、法令，或有影響其他使用者或平台安全的情形時，我們可以暫停你的帳號。</li>
          <li>創作者帳號暫停期間，對話會暫停（雙方仍看得到歷史訊息，但不能再送出），也不能成立新的合作。</li>
          <li>想了解停權原因或申訴，請聯絡我們。</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-liability" title="九、責任">
        <ul>
          <li>我們會盡力維持本平台正常運作，但可能因維護、第三方服務異常或不可抗力而暫時無法使用。</li>
          <li>合作內容的品質、成效與雙方之間的約定，由品牌與創作者自行負責；我們會依本條款協助處理爭議。</li>
          <li>在法律允許的範圍內，我們不對間接損失負責。法律另有強制規定的，依其規定。</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-changes" title="十、條款修改">
        <p>我們可能修改這份條款。重大變更會在本平台公告；變更後你繼續使用本平台，即表示你同意修改後的條款。</p>
      </LegalSection>

      <LegalSection id="terms-law" title="十一、準據法與管轄">
        <p>本條款以中華民國法律為準據法。因本條款發生爭議時，雙方同意以（管轄法院）為第一審管轄法院。</p>
      </LegalSection>
    </LegalPage>
  );
}
