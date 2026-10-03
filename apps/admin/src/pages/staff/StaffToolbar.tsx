import { SlidersHorizontal } from '../../components/icons';
import { useState } from 'react';
import type { RoleSummary, StaffStatus } from '@inova/shared';
import {
  Facet,
  FilterChip,
  FilterSheet,
  type FilterChoice,
  SearchField,
  SortSelect,
  type FacetOption,
} from '../../components/ui';
import {
  INVITE_LABELS,
  SORT_LABELS,
  SORT_SHORT_LABELS,
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
  roles: RoleSummary[];
  shown: number;
  total: number;
  /** How many members a choice of facets would leave, for the sheet's preview. */
  countWith: (filters: StaffFilters) => number;
}

export function StaffToolbar(props: ToolbarProps) {
  const { filters, onChange, roleOptions, roles, shown, total, countWith } = props;
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
          className="w-full md:w-auto md:flex-1"
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
            disabledHint="Обхватът по сгради идва с йерархията на имотите."
          />
          <Facet
            label="Покана"
            options={INVITE_OPTIONS}
            selected={filters.invite}
            onChange={(next) => set('invite', next as InviteState[])}
          />
        </div>
      </div>

      {/* On a phone: «Филтри» and the sort share the row under the search (877:2945). */}
      <div className="flex items-center gap-3 md:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`text-body-14 flex h-11 items-center gap-2 rounded-full px-4 font-medium ${
            facetCount(filters) > 0 ? 'glass-control-active' : 'glass-control text-ink'
          }`}
        >
          Филтри
          {facetCount(filters) > 0 && <span className="num">· {facetCount(filters)}</span>}
          <SlidersHorizontal size="0.9375rem" />
        </button>
        <SortSelect
          value={filters.sort}
          options={SORT_LABELS}
          buttonLabels={SORT_SHORT_LABELS}
          onChange={(next) => set('sort', next)}
        />
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
        <div className="ml-auto hidden md:block">
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
        groups={[
          { key: 'status', title: 'Статус', options: STATUS_OPTIONS },
          { key: 'role', title: 'Роля', options: roleOptions },
          { key: 'invite', title: 'Покана', options: INVITE_OPTIONS },
        ]}
        applied={{ status: filters.status, role: filters.role, invite: filters.invite }}
        onApply={(choice) => onChange(withChoice(filters, choice))}
        countWith={(choice) => countWith(withChoice(filters, choice))}
        preview={(choice) => {
          const n = countWith(withChoice(filters, choice));
          return `${n} ${n === 1 ? 'служител' : 'служители'}`;
        }}
      />
    </div>
  );
}

type SheetKey = 'status' | 'role' | 'invite';

function isStaffStatus(value: string): value is StaffStatus {
  return (STATUS_ORDER as readonly string[]).includes(value);
}

function isInviteState(value: string): value is InviteState {
  return INVITE_OPTIONS.some((option) => option.value === value);
}

function withChoice(filters: StaffFilters, choice: FilterChoice<SheetKey>): StaffFilters {
  return {
    ...filters,
    status: choice.status.filter(isStaffStatus),
    role: choice.role,
    invite: choice.invite.filter(isInviteState),
  };
}
