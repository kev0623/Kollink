import { ImageResponse } from "next/og";
import { loadApprovedCreatorAsGuest } from "@/lib/creators/public-profile";
import { avatarDataUri } from "@/lib/creators/og-avatar";
import { formatNumber, initialOf } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} 創作者公開頁`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse 不吃 Tailwind class；值與 src/app/globals.css 的 token 相同
const OG_COLORS = { bg: "#F3F3F2", surface: "#FFFFFF", line: "#E4E4E7", ink: "#18181B", muted: "#686872", onInk: "#FFFFFF" };

// 最多顯示前 3 個類別，避免超出 1200x630
const MAX_OG_CATEGORIES = 3;

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // 訪客身分：只有已審核的創作者有 OG 圖片，未審核或不存在一律 404
  const c = await loadApprovedCreatorAsGuest(handle);
  if (!c) return new Response("Not found", { status: 404 });
  const avatar = await avatarDataUri(c.avatarPath);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: OG_COLORS.bg, color: OG_COLORS.ink, padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {avatar ? (
            <img src={avatar} alt="" width={200} height={200} style={{ borderRadius: 100, objectFit: "cover" }} />
          ) : (
            <div
              style={{
                width: 200, height: 200, borderRadius: 100, background: OG_COLORS.ink, color: OG_COLORS.onInk,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96,
              }}
            >
              {initialOf(c.displayName)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 808, overflow: "hidden" }}>
            <div
              style={{
                display: "block", maxWidth: 808, fontSize: 72, fontWeight: 700, overflow: "hidden",
                whiteSpace: "nowrap", textOverflow: "ellipsis",
              }}
            >
              {c.displayName}
            </div>
            <div
              style={{
                display: "block", maxWidth: 808, fontSize: 36, color: OG_COLORS.muted, overflow: "hidden",
                whiteSpace: "nowrap", textOverflow: "ellipsis",
              }}
            >
              {`@${c.handle}`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 44 }}>{`IG 粉絲 ${formatNumber(c.followerCount)}`}</div>
          <div style={{ display: "flex", gap: 12, width: "100%", overflow: "hidden" }}>
            {c.categories.slice(0, MAX_OG_CATEGORIES).map((cat) => (
              <div
                key={cat}
                style={{
                  display: "block", padding: "8px 24px", borderRadius: 9999, background: OG_COLORS.surface,
                  border: `2px solid ${OG_COLORS.line}`, fontSize: 28, maxWidth: 360, overflow: "hidden",
                  whiteSpace: "nowrap", textOverflow: "ellipsis",
                }}
              >
                {cat}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
