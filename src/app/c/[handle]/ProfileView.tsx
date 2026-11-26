import Link from "next/link";
import { ExternalLink, Lock, MapPin, Star } from "lucide-react";
import { ThreadCanvas } from "@/components/thread/ThreadCanvas";
import { btn, cardPad, h2 } from "@/components/ui/styles";
import { InvitePanel } from "@/components/collabs/InvitePanel";
import { FavoriteButton } from "@/components/square/FavoriteButton";
import { creatorMediaUrl } from "@/lib/creator-media";
import { formatNumber, formatPercent, formatTwd, initialOf } from "@/lib/format";
import type { CreatorStatus, PortfolioItem, PublicCreator, Rate, ViewerKind } from "@/lib/creators/view";

/** favorite：品牌是否已收藏；只有品牌瀏覽時才有意義（其他身分不顯示 ♡）。 */
type Props = { creator: PublicCreator; portfolio: PortfolioItem[]; rates: Rate[]; viewer: ViewerKind; favorite?: boolean };

export function ProfileView({ creator: c, portfolio, rates, viewer, favorite }: Props) {
  return (
    <div className="pt-2 md:pt-6">
      {c.isSelf && c.status !== "approved" && <SelfPreviewBanner status={c.status} />}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <HeaderCard c={c} favorite={viewer === "brand" ? (favorite ?? false) : undefined} />
          <StatsCard c={c} />
          {c.styleTags.length > 0 && (
            <Section title="風格"><Chips label="風格標籤" items={c.styleTags} /></Section>
          )}
        </div>
        <div className="space-y-4 md:space-y-6">
          <Invite viewer={viewer} creatorId={c.userId} creatorName={c.displayName} />
          {portfolio.length > 0 && <PortfolioGrid name={c.displayName} items={portfolio} />}
          <Section title="想接的合作">
            {c.collabTypes.length > 0
              ? <Chips label="想接的合作" items={c.collabTypes} />
              : <p className="text-sm text-muted">尚未設定</p>}
          </Section>
          <RatesSection viewer={viewer} handle={c.handle} rates={rates} />
          <Section title="合作過的品牌">
            <p className="text-sm text-muted">還沒有完成的合作</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function SelfPreviewBanner({ status }: { status: CreatorStatus }) {
  return (
    <div role="note" className="mb-4 rounded-card border border-line bg-surface p-4 text-sm text-ink md:mb-6">
      <b>{status === "suspended"
        ? "帳號已暫停，公開頁目前不會顯示給其他人。"
        : status === "rejected"
          ? "審核沒有通過，修正並重新送審、通過後才會公開。"
          : "審核通過後才會公開。"}</b>
      <span className="text-muted"> 這是只有你看得到的預覽。</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={cardPad}>
      <h2 className={h2}>{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chips({ label, items, dark }: { label: string; items: string[]; dark?: boolean }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((t) => (
        <li key={t} className={`rounded-btn px-3 py-1 text-sm ${dark ? "bg-ink font-medium text-on-ink" : "bg-subtle text-ink"}`}>{t}</li>
      ))}
    </ul>
  );
}

function HeaderCard({ c, favorite }: { c: PublicCreator; favorite?: boolean }) {
  const avatar = creatorMediaUrl(c.avatarPath);
  return (
    <section className="relative overflow-hidden rounded-card border border-line bg-surface">
      {/* 頂部 96px 的紅線帶（規格 §8）：桌面滑鼠裝置用 WebGL，其他一律 SVG */}
      <div className="relative h-24 bg-panel">
        <ThreadCanvas variant="ribbon" />
      </div>
      <div className="px-5 pb-5 md:px-8 md:pb-8">
        <div className="-mt-12 flex items-end justify-between gap-3">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="relative h-24 w-24 shrink-0 rounded-full border-2 border-thread bg-subtle object-cover" />
          ) : (
            <div aria-hidden="true" className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-thread bg-subtle font-serif text-4xl font-bold text-ink">
              {initialOf(c.displayName)}
            </div>
          )}
          {favorite !== undefined && <FavoriteButton creatorId={c.userId} name={c.displayName} initial={favorite} />}
        </div>
        <h1 className="mt-4 min-w-0 break-words font-serif text-[28px] font-bold leading-tight text-ink md:text-[40px]">{c.displayName}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span>@{c.handle}</span>
          {c.region && <span className="inline-flex items-center gap-1"><MapPin size={14} strokeWidth={1.5} aria-hidden="true" />{c.region}</span>}
        </p>
        {c.categories.length > 0 && <div className="mt-4"><Chips label="內容領域" items={c.categories} dark /></div>}
        <p className="mt-4 flex items-center gap-1 text-sm text-muted">
          <Star size={14} strokeWidth={1.5} aria-hidden="true" />新創作者・尚無評價
        </p>
        {c.bio && <p className="mt-4 whitespace-pre-line break-words text-sm text-ink">{c.bio}</p>}
      </div>
    </section>
  );
}

function StatsCard({ c }: { c: PublicCreator }) {
  return (
    <section className={cardPad} aria-label="數據">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="IG 粉絲" value={formatNumber(c.followerCount)} />
        <Stat label="互動率" value={formatPercent(c.engagementRate)} />
        <Stat label="主要受眾" value={c.audienceAge ? `${c.audienceAge} 歲` : "—"} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-sans text-2xl font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function PortfolioGrid({ name, items }: { name: string; items: PortfolioItem[] }) {
  return (
    <Section title="作品">
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {items.map((it, i) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creatorMediaUrl(it.imagePath) ?? undefined} alt={`${name} 的作品 ${i + 1}`} loading="lazy"
              className="aspect-square w-full rounded-input bg-subtle object-cover"
            />
          );
          return (
            <li key={it.imagePath} className="relative">
              {it.linkUrl ? (
                <a
                  href={it.linkUrl} target="_blank" rel="noopener noreferrer"
                  className="block rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  {img}
                  <span className="absolute right-2 top-2 rounded-btn bg-surface p-1 text-ink">
                    <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="sr-only">（在 Instagram 開啟，另開新分頁）</span>
                </a>
              ) : img}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function RatesSection({ viewer, handle, rates }: { viewer: ViewerKind; handle: string; rates: Rate[] }) {
  if (viewer === "creator") {
    return (
      <Section title="報價方案">
        <p className="flex items-center gap-2 rounded-input bg-subtle p-4 text-sm font-semibold text-ink">
          <Lock size={16} strokeWidth={1.5} aria-hidden="true" />報價只開放給品牌查看
        </p>
      </Section>
    );
  }
  if (viewer !== "brand") {
    return (
      <Section title="報價方案">
        <Link
          href={`/login?next=${encodeURIComponent(`/c/${handle}`)}`}
          className="flex items-center gap-2 rounded-input bg-subtle p-4 text-sm font-semibold text-ink hover:bg-line"
        >
          <Lock size={16} strokeWidth={1.5} aria-hidden="true" />品牌登入後可查看報價
        </Link>
      </Section>
    );
  }
  return (
    <Section title="報價方案">
      {rates.length === 0 ? (
        <p className="text-sm text-muted">尚未提供報價，可以直接邀請洽談</p>
      ) : (
        <ul className="divide-y divide-line">
          {rates.map((r) => (
            <li key={r.collabType} className="flex items-center justify-between py-3 text-sm">
              <span className="text-ink">{r.collabType}</span>
              <span className="font-bold text-ink">{formatTwd(r.priceTwd)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** 邀請合作：訪客 → 註冊品牌；品牌 → 頁面內的邀請表單（計畫 6）；創作者（含本人）→ 不顯示。 */
function Invite({ viewer, creatorId, creatorName }: { viewer: ViewerKind; creatorId: string; creatorName: string }) {
  if (viewer === "creator") return null;
  if (viewer === "brand") return <InvitePanel creatorId={creatorId} creatorName={creatorName} />;
  const button = <Link href="/signup?role=brand" className={`${btn.primary} w-full`}>邀請合作</Link>;
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
        {button}
      </div>
      <div className="hidden md:sticky md:top-4 md:z-10 md:block">{button}</div>
    </>
  );
}
