import Link from "next/link";
import { ExternalLink, Lock, MapPin, Star } from "lucide-react";
import { ThreadCanvas } from "@/components/thread/ThreadCanvas";
import { btn, cardPad, h2 } from "@/components/ui/styles";
import { InvitePanel } from "@/components/collabs/InvitePanel";
import { FavoriteButton } from "@/components/square/FavoriteButton";
import { creatorMediaUrl } from "@/lib/creator-media";
import { formatNumber, formatPercent, formatTwd, initialOf } from "@/lib/format";
import type { CreatorStatus, PortfolioItem, PublicCreator, Rate, ViewerKind } from "@/lib/creators/view";
import { brandLogoUrl } from "@/lib/brand-logo";
import { formatDateTw } from "@/lib/briefs/dates";
import { NO_REVIEW_STATS, statsSummary, type PublicReview, type ReviewStats } from "@/lib/reviews/view";
import { Stars } from "@/components/reviews/Stars";

/** favorite：品牌是否已收藏；只有品牌瀏覽時才有意義（其他身分不顯示 ♡）。 */
type Props = {
  creator: PublicCreator; portfolio: PortfolioItem[]; rates: Rate[]; viewer: ViewerKind; favorite?: boolean;
  /** 評分統計與品牌寫的評價（已公開的）；hasMoreReviews＝還有更舊的沒列出來 */
  stats?: ReviewStats; reviews?: PublicReview[]; hasMoreReviews?: boolean;
};

export function ProfileView({ creator: c, portfolio, rates, viewer, favorite, stats = NO_REVIEW_STATS, reviews = [], hasMoreReviews }: Props) {
  return (
    <div className="pt-2 md:pt-6">
      {c.isSelf && c.status !== "approved" && <SelfPreviewBanner status={c.status} />}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <HeaderCard c={c} stats={stats} favorite={viewer === "brand" ? (favorite ?? false) : undefined} />
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
          <RatesSection viewer={viewer} rates={rates} />
          <ReviewsSection stats={stats} reviews={reviews} hasMore={hasMoreReviews === true} />
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

/** card：只有獨立區塊（作品、報價）用卡片；其他用分隔線隔開（規格 §8）。 */
function Section({ title, children, card }: { title: string; children: React.ReactNode; card?: boolean }) {
  return (
    <section className={card ? cardPad : "border-t border-line pt-5 md:pt-6"}>
      <h2 className={h2}>{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chips({ label, items, dark }: { label: string; items: string[]; dark?: boolean }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((t) => (
        <li key={t} className={`rounded-btn px-3 py-1 text-sm ${dark ? "bg-ink font-bold text-on-ink" : "bg-subtle text-ink"}`}>{t}</li>
      ))}
    </ul>
  );
}

function HeaderCard({ c, stats, favorite }: { c: PublicCreator; stats: ReviewStats; favorite?: boolean }) {
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
        <p className={`mt-4 flex items-center gap-1 text-sm ${stats.avg === null ? "text-muted" : "font-semibold text-ink"}`}>
          <Star size={14} strokeWidth={1.5} aria-hidden="true" className={stats.avg === null ? "" : "fill-current text-primary"} />
          {stats.avg === null
            ? statsSummary(stats, stats.completed > 0 ? "尚無評價" : "新創作者・尚無評價")
            : <a href="#reviews" className="underline-offset-4 hover:underline">{statsSummary(stats, "")}</a>}
        </p>
        {c.bio && <p className="mt-5 whitespace-pre-line break-words border-t border-line pt-5 text-sm text-ink">{c.bio}</p>}
      </div>
    </section>
  );
}

/** 品牌寫的評價（雙方都寫完或期滿後才公開）。評價只來自平台上完成的合作案。 */
function ReviewsSection({ stats, reviews, hasMore }: { stats: ReviewStats; reviews: PublicReview[]; hasMore: boolean }) {
  return (
    <section id="reviews" className="scroll-mt-4 border-t border-line pt-5 md:pt-6">
      <h2 className={h2}>合作評價{stats.count > 0 && <span className="ml-2 text-sm font-normal text-muted">{stats.count} 則</span>}</h2>
      {reviews.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {stats.completed > 0 ? "已完成合作，評價還沒公開" : "還沒有完成的合作"}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {reviews.map((r) => {
            const logo = brandLogoUrl(r.brandLogoPath);
            return (
              <li key={r.id} className="flex gap-3 py-4 first:pt-0">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-full border border-line bg-subtle object-cover" />
                ) : (
                  <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-bold text-ink">
                    {initialOf(r.brandName)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-ink">{r.brandName}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Stars rating={r.rating} size={14} />
                    {r.createdAt && <span className="text-xs text-muted">{formatDateTw(r.createdAt)}</span>}
                  </p>
                  {r.comment && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink">{r.comment}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && <p className="mt-3 text-sm text-muted">只顯示最新的 {reviews.length} 則</p>}
    </section>
  );
}

function StatsCard({ c }: { c: PublicCreator }) {
  return (
    <section className="border-t border-line pt-5 md:pt-6" aria-label="數據">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {c.followerCount !== null ? (
          <Stat label="IG 粉絲" value={formatNumber(c.followerCount)} />
        ) : (
          <div>
            <dt className="text-xs text-muted">IG 粉絲</dt>
            <dd className="mt-1">
              <Link
                href={`/login?next=${encodeURIComponent(`/c/${c.handle}`)}`}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-btn px-2 text-sm font-bold text-ink underline underline-offset-4 hover:text-accent"
              >
                <Lock size={14} strokeWidth={1.5} aria-hidden="true" />登入後顯示
              </Link>
            </dd>
          </div>
        )}
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
    <Section title="作品" card>
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

/** 報價是公開的：所有人（含訪客）都看得到。訪客另外看到一行「怎麼邀請」。 */
function RatesSection({ viewer, rates }: { viewer: ViewerKind; rates: Rate[] }) {
  return (
    <Section title="報價方案" card>
      {rates.length === 0 ? (
        <p className="text-sm text-muted">{viewer === "brand" ? "尚未提供報價，可以直接邀請洽談" : "尚未提供報價"}</p>
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
      {viewer === "guest" && (
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
          想合作？<Link href="/signup?role=brand" className="font-bold text-ink underline underline-offset-4 hover:text-accent">註冊品牌帳號</Link>就能直接邀請，款項由平台保管。
        </p>
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
