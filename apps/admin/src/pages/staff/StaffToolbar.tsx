import { SlidersHorizontal } from '../../components/icons';
import { useState } from 'react';
import {
  Drawer,
  Facet,
  FilterChip,
  SearchField,
  SortSelect,
  type FacetOption,
} from '../../components/ui';
import type { Role } from '../../lib/api';
import {
  INVITE_LABELS,
  SORT_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  describeFacet,
  facetCount,
  hasActiveFacets,
  hasAnyFilter,
  type InviteState,
  type StaffFilters,
} from './model';

const STATUS_OPTIONS: FacetOption[] = STATUS_ORDER.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

const INVITE_OPTIONS: FacetOption[] = (['activated', 'code-sent'] as InviteState[]).map(
  (value) => ({ value, label: INVITE_LABELS[value] }),
);

interface ToolbarProps {
  filters: StaffFilters;
  onChange: (next: StaffFilters) => void;
  roleOptions: FacetOption[];
  roles: Role[];
  shown: number;
  total: number;
}

export function StaffToolbar(props: ToolbarProps) {
  const { filters, onChange, roleOptions, roles, shown, total } = props;
  const [sheetOpen, setSheetOpen] = useState(false);

  const set = <K extends keyof StaffFilters>(key: K, value: StaffFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const clearFacets = () => onChange({ ...filters, status: [], role: [], invite: [] });

  const active = (['status', 'role', 'invite'] as const).filter((k) => filters[k].length > 0);
  const count = hasAnyFilter(filters)
    ? `${shown} от ${total} служители`
    : `${total} ${total === 1 ? 'служител' : 'служители'}`;

  return (
    // V2 Toolbar: the filters, then the result line, 12 apart and 12 between items.
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={filters.search}
          onChange={(next) => set('search', next)}
          placeholder="Търси по име, имейл или телефон"
          label="Търсене в служителите"
          className="flex-1"
        />

        {/* Facets have room of their own only from md up; below that they live in the sheet. */}
        <div className="hidden flex-wrap items-center gap-3 md:flex">
          <Facet
            label="Статус"
            options={STATUS_OPTIONS}
            selected={filters.status}
            onChange={(next) => set('status', next as StaffFilters['status'])}
          />
          <Facet
            label="Роля"
            options={roleOptions}
            selected={filters.role}
            onChange={(next) => set('role', next)}
          />
          {/* TODO(M2): building scope facet — every M1 role is organization-wide. */}
          <Facet
            label="Обхват"
            options={[]}
            selected={[]}
            onChange={() => undefined}
            disabled
            disabledHint="Обхватът по сгради идва с йерархията на имотите (M2)."
          />
          <Facet
            label="Покана"
            options={INVITE_OPTIONS}
            selected={filters.invite}
            onChange={(next) => set('invite', next as InviteState[])}
          />
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`text-body-14 flex h-12 items-center gap-2 rounded-full px-4 font-medium md:hidden ${
            facetCount(filters) > 0 ? 'glass-control-active' : 'glass-control text-ink'
          }`}
        >
          <SlidersHorizontal size="0.9375rem" />
          Филтри
          {facetCount(filters) > 0 && <span className="num">· {facetCount(filters)}</span>}
        </button>
      </div>

      <div className="flex min-h-11 flex-wrap items-center gap-3 px-1">
        <span className="num text-body-14 font-medium text-ink" aria-live="polite">
          {count}
        </span>
        {active.map((key) => (
          <FilterChip key={key} onClear={() => set(key, [])}>
            {describeFacet(key, filters[key], roles)}
          </FilterChip>
        ))}
        {hasActiveFacets(filters) && (
          <button
            type="button"
            onClick={clearFacets}
            className="text-body-14 font-medium text-ink underline transition-opacity hover:opacity-80"
          >
            Изчисти
          </button>
        )}
        <div className="ml-auto">
          <SortSelect
            value={filters.sort}
            options={SORT_LABELS}
            onChange={(next) => set('sort', next)}
          />
        </div>
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        {...props}
        roleOptions={roleOptions}
      />
    </div>
  );
}

/** Phone filters: pinned header and footer, the facet groups scroll between. */
function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
  roleOptions,
  shown,
}: ToolbarProps & { open: boolean; onClose: () => void }) {
  const groups: { key: 'status' | 'role' | 'invite'; title: string; options: FacetOption[] }[] = [
    { key: 'status', title: 'Статус', options: STATUS_OPTIONS },
    { key: 'role', title: 'Роля', options: roleOptions },
    { key: 'invite', title: 'Покана', options: INVITE_OPTIONS },
  ];

  const toggle = (key: 'status' | 'role' | 'invite', value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      label="Филтри"
      header={
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Филтри</h2>
          <button
            type="button"
            onClick={() => onChange({ ...filters, status: [], role: [], invite: [] })}
            className="text-sm font-medium text-panel-ink-muted underline underline-offset-4"
          >
            Изчисти
          </button>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-full bg-panel-ink py-3 text-sm font-semibold text-panel-ink-inverse"
        >
          Покажи {shown}
        </button>
      }
    >
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-panel-ink-faint uppercase">
              {group.title}
            </h3>
            <div className="space-y-1.5">
              {group.options.map((option) => {
                const checked = (filters[group.key] as string[]).includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(group.key, option.value)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                      checked ? 'bg-panel-row-strong' : 'bg-panel-row'
                    }`}
                  >
                    <span
                      className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded ${
                        checked ? 'bg-panel-ink' : ''
                      }`}
                      style={{
                        boxShadow: checked ? 'none' : 'inset 0 0 0 0.0625rem var(--panel-border)',
                      }}
                    >
                      {checked && (
                        <span
                          className="h-1.5 w-1.5 rounded-[0.0625rem]"
                          style={{ background: 'var(--panel-text-inverse)' }}
                        />
                      )}
                    </span>
                    {option.label}
                  </button>
                );
              })}
              {group.options.length === 0 && (
                <p className="text-sm text-panel-ink-faint">Няма налични стойности.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </Drawer>
  );
}
