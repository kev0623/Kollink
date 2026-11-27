// 公開頁的中英文切換。做法與主題相同：<head> 的腳本在繪製前把 <html data-lang> 設好，
// 兩種語言的文字都在 HTML 裡，由 CSS 只顯示其中一種（globals.css 的 [data-l]），所以頁面可以照常預先產生、切換不用重新載入。
// 範圍：首頁、/creators、/features、/for-brands、/for-creators、/pricing 與它們的頂列、頁尾。登入後的各區與登入頁只有中文。
import { CATEGORIES, REGIONS } from "@/lib/options";

export const LANG_STORAGE_KEY = "kollink-lang";
export type Lang = "zh" | "en";
/** 一段有兩種語言的文字 */
export type L = { zh: string; en: string };

export function parseLang(v: unknown): Lang {
  return v === "en" ? "en" : "zh";
}

/** 寫成 ES5（在任何 bundle 之前執行）。預設中文；只有選過英文才改。 */
export const LANG_SCRIPT =
  `(function(){try{if(localStorage.getItem("${LANG_STORAGE_KEY}")==="en"){var d=document.documentElement;` +
  `d.setAttribute("data-lang","en");d.lang="en"}}catch(e){}})();`;

export function readLang(): Lang {
  try {
    return parseLang(window.localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return "zh";
  }
}

/** 瀏覽器：套用到 <html>；persist 為 true 時寫回 localStorage。 */
export function applyLang(lang: Lang, persist: boolean): void {
  const root = document.documentElement;
  if (lang === "en") root.setAttribute("data-lang", "en");
  else root.removeAttribute("data-lang");
  root.lang = lang === "en" ? "en" : "zh-Hant";
  if (!persist) return;
  try {
    if (lang === "en") window.localStorage.setItem(LANG_STORAGE_KEY, "en");
    else window.localStorage.removeItem(LANG_STORAGE_KEY);
  } catch {
    // 無痕模式等：只影響這一頁
  }
}

// 類別與地區在資料庫裡存的是中文（篩選的值也是中文）；英文只是顯示用。
const CATEGORY_EN: Record<(typeof CATEGORIES)[number], string> = {
  美妝: "Beauty", 保養: "Skincare", 美食: "Food", 旅遊: "Travel", 寵物: "Pets", "3C": "Tech",
  親子: "Family", 穿搭: "Fashion", 居家: "Home", 運動: "Fitness", 生活: "Lifestyle",
};
const REGION_EN: Record<(typeof REGIONS)[number], string> = {
  基隆市: "Keelung", 台北市: "Taipei", 新北市: "New Taipei", 桃園市: "Taoyuan", 新竹市: "Hsinchu City", 新竹縣: "Hsinchu County",
  苗栗縣: "Miaoli", 台中市: "Taichung", 彰化縣: "Changhua", 南投縣: "Nantou", 雲林縣: "Yunlin", 嘉義市: "Chiayi City",
  嘉義縣: "Chiayi County", 台南市: "Tainan", 高雄市: "Kaohsiung", 屏東縣: "Pingtung", 宜蘭縣: "Yilan", 花蓮縣: "Hualien",
  台東縣: "Taitung", 澎湖縣: "Penghu", 金門縣: "Kinmen", 連江縣: "Lienchiang", 海外: "Overseas",
};

/** 類別或地區的顯示文字；清單以外的值（舊資料）兩種語言都顯示原文。 */
export function optionLabel(value: string): L {
  const en = (CATEGORY_EN as Record<string, string>)[value] ?? (REGION_EN as Record<string, string>)[value];
  return { zh: value, en: en ?? value };
}
