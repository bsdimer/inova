import { useState } from 'react';
import { SlidersHorizontal } from '../../components/icons';
import {
  Facet,
  FilterChip,
  FilterSheet,
  SearchField,
  SortSelect,
  type FacetOption,
} from '../../components/ui';
import {
  FACET_TITLES,
  SORT_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  counted,
  facetCount,
  facetValueLabel,
  hasActiveFacets,
  hasAnyFilter,
  type BuildingFilters,
  type FacetKey,
} from './model';

const STATUS_OPTIONS: FacetOption[] = STATUS_ORDER.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

function asOptions(values: string[]): FacetOption[] {
  return values.map((value) => ({ value, label: value }));
}

interface ToolbarProps {
  filters: BuildingFilters;
  onChange: (next: BuildingFilters) => void;
  districts: string[];
  /** «Град» is offered only when the organisation spans several (1553:33265). */
  cities: string[];
  shown: number;
  total: number;
}

// TODO(M2): the «Домоуправител» facet (945:5119) once the list carries the manager (WHI-96).
export function BuildingsToolbar(props: ToolbarProps) {
  const { filters, onChange, districts, cities, shown, total } = props;
  const [sheetOpen, setSheetOpen] = useState(false);

  const set = <K extends keyof BuildingFilters>(key: K, value: BuildingFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const clearFacets = () => onChange({ ...filters, district: [], status: [], city: [] });
  const facets = facetGroups(districts, cities);
  const active = facets.filter(({ key }) => filters[key].length > 0);
  const count = hasAnyFilter(filters)
    ? `${shown} от ${total} сгради`
    : counted(total, 'сграда', 'сгради');

  return (
    // V2 Toolbar: the filters, then the result line, 12 apart and 12 between items.
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={filters.search}
          onChange={(next) => set('search', next)}
          placeholder="Търси сграда или адрес"
          label="Търсене в сградите"
          className="flex-1"
        />

        {/* Facets have room of their own only from md up; below that they live in the sheet. */}
        <div className="hidden flex-wrap items-center gap-3 md:flex">
          {facets.map(({ key, options }) => (
            <Facet
              key={key}
              label={FACET_TITLES[key]}
              options={options}
              selected={filters[key]}
              onChange={(next) => set(key, next as BuildingFilters[typeof key])}
            />
          ))}
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
        {active.map(({ key }) => (
          <FilterChip key={key} onClear={() => set(key, [])}>
            {FACET_TITLES[key]}: {filters[key].map((v) => facetValueLabel(key, v)).join(', ')}
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
        groups={facets.map(({ key, options }) => ({
          key,
          title: FACET_TITLES[key],
          options,
          selected: filters[key],
        }))}
        onToggle={(key, value) => onChange(toggled(filters, key as FacetKey, value))}
        onClear={clearFacets}
        shown={shown}
      />
    </div>
  );
}

interface FacetGroup {
  key: FacetKey;
  options: FacetOption[];
}

function facetGroups(districts: string[], cities: string[]): FacetGroup[] {
  const groups: FacetGroup[] = [
    { key: 'district', options: asOptions(districts) },
    { key: 'status', options: STATUS_OPTIONS },
  ];
  if (cities.length > 1) groups.unshift({ key: 'city', options: asOptions(cities) });
  return groups;
}

function toggled(filters: BuildingFilters, key: FacetKey, value: string): BuildingFilters {
  const current = filters[key] as string[];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...filters, [key]: next };
}
