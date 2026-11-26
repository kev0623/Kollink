"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { btn } from "@/components/ui/styles";

/** 404 頁用：已登入時多一顆「回後台」（/auth/continue 會依身分導向）。伺服器渲染與未登入時不輸出任何東西。
 * getSession 讀的是瀏覽器本機儲存的 session，不發網路請求；真正的授權仍由導向後的頁面檢查。 */
export function BackToConsole() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      createClient().auth.getSession().then(({ data }) => {
        if (alive && data.session) setSignedIn(true);
      }).catch(() => {});
    } catch {
      // 缺環境變數等：當作未登入
    }
    return () => { alive = false; };
  }, []);
  if (!signedIn) return null;
  return <Link href="/auth/continue" className={btn.secondary}>回後台</Link>;
}
