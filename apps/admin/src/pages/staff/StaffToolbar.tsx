import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Facet, FilterChip, Popover, type FacetOption } from '../../components/ui';
import {
  INVITE_LABELS,
  SORT_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  describeFacet,
  hasActiveFacets,
  hasAnyFilter,
  type InviteState,
  type SortPreset,
  type StaffFilters,
} from './model';

const STATUS_OPTIONS: FacetOption[] = STATUS_ORDER.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

const INVITE_OPTIONS: FacetOption[] = (['activated', 'code-sent'] as InviteState[]).map(
  (value) => ({ value, label: INVITE_LABELS[value] }),
);

const SORT_OPTIONS = Object.keys(SORT_LABELS) as SortPreset[];

export function StaffToolbar({
  filters,
  onChange,
  roleOptions,
  roleNames,
  shown,
  total,
}: {
  filters: StaffFilters;
  onChange: (next: StaffFilters) => void;
  roleOptions: FacetOption[];
  roleNames: Map<string, string>;
  shown: number;
  total: number;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const set = <K extends keyof StaffFilters>(key: K, value: StaffFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const reset = () => onChange({ ...filters, search: '', status: [], role: [], invite: [] });

  const facets = (['status', 'role', 'invite'] as const).filter((k) => filters[k].length > 0);
  const count = hasAnyFilter(filters)
    ? `${shown} of ${total} member${total === 1 ? '' : 's'}`
    : `${total} member${total === 1 ? '' : 's'}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex min-w-60 flex-1 items-center gap-3 rounded-xl border border-sand bg-white/75 px-4 py-2.5 shadow-sm transition-all focus-within:border-orange focus-within:ring-4 focus-within:ring-orange/10">
          <Search size={16} className="shrink-0 text-landmark" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Search name, email or phone"
            aria-label="Search staff"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-stone"
          />
        </label>
        <Facet
          label="Status"
          options={STATUS_OPTIONS}
          selected={filters.status}
          onChange={(next) => set('status', next as StaffFilters['status'])}
        />
        <Facet
          label="Role"
          options={roleOptions}
          selected={filters.role}
          onChange={(next) => set('role', next)}
        />
        {/* TODO(M2): building scope facet — every M1 role is organization-wide. */}
        <Facet
          label="Scope"
          options={[]}
          selected={[]}
          onChange={() => undefined}
          disabled
          disabledHint="Building scope arrives with the property hierarchy (M2)."
        />
        <Facet
          label="Invite"
          options={INVITE_OPTIONS}
          selected={filters.invite}
          onChange={(next) => set('invite', next as InviteState[])}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-sm font-bold" aria-live="polite">
          {count}
        </span>
        {facets.map((key) => (
          <FilterChip key={key} onClear={() => set(key, [])}>
            {describeFacet(key, filters[key], roleNames)}
          </FilterChip>
        ))}
        {hasActiveFacets(filters) && (
          <button
            type="button"
            onClick={reset}
            className="text-sm font-semibold text-ember transition-colors hover:text-orange"
          >
            Reset
          </button>
        )}
        <div className="ml-auto">
          <Popover
            open={sortOpen}
            onClose={() => setSortOpen(false)}
            align="right"
            anchor={
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-stone/35 bg-white/70 px-4 py-2 text-sm font-semibold transition-colors hover:border-orange/35"
              >
                <SlidersHorizontal size={14} className="text-landmark" />
                {SORT_LABELS[filters.sort]}
                <ChevronDown size={14} />
              </button>
            }
          >
            <ul role="listbox" className="min-w-52">
              {SORT_OPTIONS.map((preset) => (
                <li key={preset}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={filters.sort === preset}
                    onClick={() => {
                      set('sort', preset);
                      setSortOpen(false);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-orange/6 ${
                      filters.sort === preset ? 'text-ember' : ''
                    }`}
                  >
                    {SORT_LABELS[preset]}
                  </button>
                </li>
              ))}
            </ul>
          </Popover>
        </div>
      </div>
    </div>
  );
}
