"use client";

import { CATEGORIES, COLLAB_TYPES, REGIONS } from "@/lib/options";
import {
  ENGAGEMENT_OPTIONS, FOLLOWER_RANGES, KEYWORD_MAX, PRICE_RANGES, activeFilterCount, clearFilters, toggleValue,
  type SquareQuery,
} from "@/lib/creators/square-query";

type Props = {
  /** 桌面側欄與手機抽屜同時存在 DOM 裡，id 與 radio name 要用前綴區分 */
  idPrefix: string;
  query: SquareQuery;
  popularTags: string[];
  onChange: (next: SquareQuery) => void;
};

const legendCls = "text-sm font-semibold text-ink";

export function FilterPanel({ idPrefix, query, popularTags, onChange }: Props) {
  const set = (patch: Partial<SquareQuery>) => onChange({ ...query, ...patch });
  return (
    <div className="space-y-6">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const v = new FormData(e.currentTarget).get("q");
          set({ q: typeof v === "string" ? v.trim() : "" });
        }}
      >
        <label htmlFor={`${idPrefix}-q`} className={legendCls}>關鍵字</label>
        <div className="mt-2 flex gap-2">
          {/* key：網址的關鍵字改變（例如清除篩選）時，輸入框跟著重設 */}
          <input
            key={query.q}
            id={`${idPrefix}-q`}
            name="q"
            type="search"
            defaultValue={query.q}
            maxLength={KEYWORD_MAX}
            placeholder="名稱、網址代稱、IG 帳號"
            className="h-10 min-w-0 flex-1 rounded-input border border-line bg-surface px-3 text-sm text-ink"
          />
          <button type="submit" className="h-10 shrink-0 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink">搜尋</button>
        </div>
      </form>

      <label className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
        只看收藏
        <input
          type="checkbox"
          role="switch"
          checked={query.fav}
          onChange={(e) => set({ fav: e.target.checked })}
          className="h-5 w-5 accent-primary"
        />
      </label>

      <ChipGroup legend="內容領域" options={CATEGORIES} selected={query.categories}
        onToggle={(v) => set({ categories: toggleValue(query.categories, v) })} />
      <ChipGroup legend="風格標籤" options={popularTags} selected={query.tags}
        onToggle={(v) => set({ tags: toggleValue(query.tags, v) })} />
      <RadioGroup legend="粉絲數" name={`${idPrefix}-followers`} options={FOLLOWER_RANGES} value={query.followers}
        onChange={(followers) => set({ followers })} />
      <RadioGroup legend="互動率" name={`${idPrefix}-er`} options={ENGAGEMENT_OPTIONS} value={query.engagement}
        onChange={(engagement) => set({ engagement })} />
      <RadioGroup legend="起價" name={`${idPrefix}-price`} options={PRICE_RANGES} value={query.price}
        onChange={(price) => set({ price })} />
      <ChipGroup legend="地區" options={REGIONS} selected={query.regions}
        onToggle={(v) => set({ regions: toggleValue(query.regions, v) })} />
      <ChipGroup legend="合作類型" options={COLLAB_TYPES} selected={query.collabs}
        onToggle={(v) => set({ collabs: toggleValue(query.collabs, v) })} />

      <button
        type="button"
        onClick={() => onChange(clearFilters(query))}
        disabled={activeFilterCount(query) === 0}
        className="h-10 w-full rounded-btn border border-line bg-surface text-sm font-semibold text-ink hover:bg-subtle disabled:opacity-50"
      >
        清除篩選
      </button>
    </div>
  );
}

function ChipGroup({ legend, options, selected, onToggle }: {
  legend: string; options: readonly string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  // 網址裡有清單以外的值（舊資料或手改網址）時也顯示出來，才能取消
  const all = [...options, ...selected.filter((s) => !options.includes(s))];
  if (all.length === 0) return null;
  return (
    <fieldset>
      <legend className={legendCls}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o} type="button" aria-pressed={on} onClick={() => onToggle(o)}
              className={`min-h-9 rounded-btn border px-3 py-1 text-sm ${on ? "border-ink bg-ink font-medium text-on-ink" : "border-line bg-surface text-ink hover:bg-subtle"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RadioGroup<K extends string>({ legend, name, options, value, onChange }: {
  legend: string; name: string; options: readonly { key: K; label: string }[]; value: K | null; onChange: (v: K | null) => void;
}) {
  const item = "flex min-h-9 items-center gap-2 text-sm text-ink";
  return (
    <fieldset>
      <legend className={legendCls}>{legend}</legend>
      <div className="mt-1">
        <label className={item}>
          <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} className="accent-primary" />不限
        </label>
        {options.map((o) => (
          <label key={o.key} className={item}>
            <input type="radio" name={name} checked={value === o.key} onChange={() => onChange(o.key)} className="accent-primary" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
