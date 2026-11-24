import { beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));

import { loadOwnPublicProfile } from "./own-profile";

function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "maybeSingle", "single"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

beforeEach(() => from.mockReset());

describe("loadOwnPublicProfile", () => {
  it("合併檔案、作品與報價", async () => {
    const results: Record<string, unknown> = {
      creator_profiles: { data: {
        bio: null, style_tags: ["日系"], collab_types: ["IG 貼文", "Reels"], engagement_rate: 3.5,
        audience_age: "18-24", avatar_path: null,
      }, error: null },
      creator_portfolio_items: { data: [{ image_path: "u1/portfolio-a.jpg", link_url: "https://www.instagram.com/p/1/" }], error: null },
      creator_rates: { data: [{ collab_type: "Reels", price_twd: 8000 }, { collab_type: "IG 貼文", price_twd: 4500 }], error: null },
    };
    from.mockImplementation((table: string) => chain(results[table]));
    expect(await loadOwnPublicProfile("u1")).toEqual({
      profile: { bio: "", styleTags: ["日系"], collabTypes: ["IG 貼文", "Reels"], engagementRate: 3.5, audienceAge: "18-24", avatarPath: null },
      portfolio: [{ imagePath: "u1/portfolio-a.jpg", linkUrl: "https://www.instagram.com/p/1/" }],
      rates: [{ collabType: "IG 貼文", priceTwd: 4500 }, { collabType: "Reels", priceTwd: 8000 }],
    });
  });
  it("任何一個查詢失敗就丟出", async () => {
    from.mockImplementation((table: string) =>
      chain(table === "creator_rates" ? { data: null, error: { message: "boom" } } : { data: [], error: null }));
    await expect(loadOwnPublicProfile("u1")).rejects.toEqual({ message: "boom" });
  });
});
