import type { NextConfig } from "next";
// 設定檔不能用 "@/" 別名
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // 全站安全標頭（資安修正）。Supabase 網域由 NEXT_PUBLIC_SUPABASE_URL 推導：本機是 http://127.0.0.1:54321，正式環境是 https://<ref>.supabase.co。
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV === "development",
          vercelPreview: process.env.VERCEL_ENV === "preview",
        }),
      },
    ];
  },
};

export default nextConfig;
