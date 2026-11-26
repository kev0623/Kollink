import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { textLink } from "@/components/ui/styles";
import { SITE_NAME, TERMS_PAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: `${SITE_NAME} 如何蒐集、處理與利用你的個人資料，以及你依個人資料保護法享有的權利。`,
};

// 內容依目前實際運作撰寫（README、docs/superpowers/specs/、supabase/migrations/）。不知道的事實一律用「（…）」佔位，不可自行編造。
// 新增蒐集的資料或新的第三方服務時（例如開放綠界付款），這裡要一起更新。
const OPERATOR = "（營運者名稱）";
const OPERATOR_ADDRESS = "（營運者地址）";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="隱私權政策"
      intro={
        <p>
          {SITE_NAME}（以下稱「本平台」）由{OPERATOR}（地址：{OPERATOR_ADDRESS}，以下稱「我們」）營運。
          我們依《個人資料保護法》蒐集、處理與利用你的個人資料。這份政策說明我們蒐集哪些資料、怎麼使用、交給誰處理，以及你可以行使的權利。
          使用本平台也適用<Link href={TERMS_PAGE} className={textLink}>《服務條款》</Link>。
        </p>
      }
    >
      <LegalSection id="privacy-purpose" title="一、蒐集目的">
        <p>我們為了下列目的蒐集你的個人資料：</p>
        <ul>
          <li>建立與管理帳號、登入驗證（含管理員的兩步驟驗證）。</li>
          <li>媒合品牌與創作者、管理合作案、交稿與站內訊息。</li>
          <li>確認付款、撥款與處理退款、爭議。</li>
          <li>維護平台安全：審核創作者、偵測與處理違規、保存操作紀錄。</li>
          <li>回覆你的詢問與客服需求。</li>
        </ul>
        <p>對應個人資料保護法的特定目的：〇六九 契約、類似契約或其他法律關係事務；〇九〇 消費者、客戶管理與服務；一三五 資（通）訊服務；一三六 資（通）訊與資料庫管理；一四八 網路購物及其他電子商務服務。</p>
      </LegalSection>

      <LegalSection id="privacy-data" title="二、我們蒐集的資料">
        <ul>
          <li><strong>帳號資料：</strong>Email、身分（品牌或創作者）。使用 Google 登入時，另外會收到 Google 提供的 Email、名稱與大頭貼網址。使用 LINE 登入時，我們會收到 LINE 使用者 ID、顯示名稱、大頭貼網址與 Email，只儲存 LINE 使用者 ID（用來辨識是同一個 LINE 帳號）與 Email，不儲存 LINE 的顯示名稱與大頭貼。</li>
          <li><strong>品牌資料：</strong>品牌名稱、產業、Logo。</li>
          <li><strong>創作者資料：</strong>網址代稱、Instagram 帳號、追蹤數、互動率、地區、類別、自我介紹、頭像與作品圖片。審核通過後，這些資料會顯示在你的公開頁。</li>
          <li><strong>創作者收款帳戶：</strong>銀行代碼、分行代碼、帳號與戶名。<strong>只有你本人與平台管理員看得到</strong>，品牌看不到，只用於撥款。</li>
          <li><strong>合作與內容：</strong>招募、報名、合作案內容與狀態、交稿檔案、站內訊息。</li>
          <li><strong>付款紀錄：</strong>付款金額、方式、時間與交易編號、撥款與退款紀錄。我們不儲存信用卡號。</li>
          <li><strong>操作紀錄：</strong>管理員的審核、停權、付款確認、撥款等操作紀錄（稽核紀錄），以及訊息是否含聯絡方式的標記。</li>
          <li><strong>技術資料：</strong>為了提供服務與維護安全，伺服器會記錄 IP 位址、瀏覽器資訊與存取時間。</li>
        </ul>
      </LegalSection>

      <LegalSection id="privacy-use" title="三、利用的期間、地區、對象與方式">
        <ul>
          <li><strong>期間：</strong>你的帳號存續期間；帳號刪除後，付款、撥款與稽核紀錄等依法令或處理爭議需要的資料，會在必要期間內保存。</li>
          <li><strong>地區：</strong>台灣，以及下方處理者的主機所在地（資料庫位於日本東京）。</li>
          <li><strong>對象：</strong>我們與下方列出的處理者；合作對方（品牌看得到創作者的公開資料，合作案雙方看得到彼此的訊息與交稿）；依法令要求的機關。</li>
          <li><strong>方式：</strong>以電子方式儲存與處理，用於上述目的。</li>
        </ul>
      </LegalSection>

      <LegalSection id="privacy-processors" title="四、受託處理資料的服務">
        <p>我們使用下列服務來營運本平台，它們只依我們的指示處理資料：</p>
        <ul>
          <li><strong>Supabase：</strong>資料庫、登入、檔案儲存與即時訊息（主機位於日本東京）。</li>
          <li><strong>Vercel：</strong>網站代管（伺服器程式在日本東京執行）。</li>
          <li><strong>Resend：</strong>寄送登入驗證碼等 Email。</li>
          <li><strong>Google：</strong>只有在你選擇用 Google 登入時，由 Google 驗證你的身分。</li>
          <li><strong>LINE（LY Corporation）：</strong>只有在你選擇用 LINE 登入時，由 LINE 驗證你的身分並提供 Email。</li>
          <li><strong>綠界科技（ECPay）：</strong>開放線上付款後，用於處理品牌的信用卡與 ATM 付款；卡號由綠界處理，我們不會取得。</li>
        </ul>
        <p>我們不會出售你的個人資料，也不會提供給第三方做行銷。</p>
      </LegalSection>

      <LegalSection id="privacy-cookies" title="五、Cookie 與瀏覽器儲存">
        <ul>
          <li>我們只使用維持登入狀態所必需的 Cookie，不使用廣告或追蹤 Cookie。使用 LINE 登入時，另外有兩個加密的暫存 Cookie 保存登入流程的狀態，10 分鐘內失效。</li>
          <li>深色／淺色主題與列表顯示方式等偏好，存在你瀏覽器的 localStorage，不會傳到我們的伺服器。</li>
        </ul>
      </LegalSection>

      <LegalSection id="privacy-rights" title="六、你的權利">
        <p>依個人資料保護法第 3 條，你可以向我們請求：</p>
        <ul>
          <li>查詢或閱覽你的個人資料，或製給複製本。</li>
          <li>補充或更正你的個人資料（大部分資料可以直接在平台上修改）。</li>
          <li>停止蒐集、處理或利用你的個人資料。</li>
          <li>刪除你的個人資料或帳號。</li>
        </ul>
        <p>請透過下方的聯絡方式提出，我們確認是你本人後會儘快處理。依法令必須保存的資料（例如付款紀錄），我們可能無法立即刪除。你可以選擇不提供個人資料，但沒有 Email 就無法註冊登入，創作者沒有收款帳戶就無法收到撥款。</p>
      </LegalSection>

      <LegalSection id="privacy-security" title="七、資料安全">
        <ul>
          <li>全站使用 HTTPS 加密連線。</li>
          <li>資料庫以權限規則限制每個人只能讀寫自己有權限的資料；交稿檔案是私密的，只有合作雙方與管理員能以短效連結查看。</li>
          <li>管理員必須通過兩步驟驗證，所有管理操作都會留下紀錄。</li>
        </ul>
      </LegalSection>

      <LegalSection id="privacy-changes" title="八、政策修改">
        <p>我們可能修改這份政策。重大變更會在本平台公告。</p>
      </LegalSection>
    </LegalPage>
  );
}
