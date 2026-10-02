import { useState } from 'react';
import { SlidersHorizontal } from '../../components/icons';
import {
  Facet,
  FilterChip,
  FilterSheet,
  type FilterChoice,
  SearchField,
  SkeletonBar,
  SortSelect,
  type FacetOption,
} from '../../components/ui';
import {
  FACET_TITLES,
  SORT_LABELS,
  SORT_SHORT_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  counted,
  facetCount,
  facetValueLabel,
  hasActiveFacets,
  hasAnyFilter,
  type BuildingFilters,
  type BuildingStatus,
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
  /** How many buildings a choice of facets would leave, for the sheet's preview. */
  countWith: (filters: BuildingFilters) => number;
  /** The list is on its way: the count line holds its place with a bar. */
  loading: boolean;
}

// TODO(M2): the «Домоуправител» facet (945:5119) once the list carries the manager (WHI-96).
export function BuildingsToolbar(props: ToolbarProps) {
  const { filters, onChange, districts, cities, shown, total, loading, countWith } = props;
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
          className="w-full md:w-auto md:flex-1"
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
      </div>

      {/* On a phone: «Филтри» and the sort share the row under the search (952:5831). */}
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
        {loading ? (
          <SkeletonBar className="w-20" />
        ) : (
          <span className="num text-body-14 font-medium text-ink" aria-live="polite">
            {count}
          </span>
        )}
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
        groups={facets.map(({ key, options }) => ({ key, title: FACET_TITLES[key], options }))}
        applied={{ district: filters.district, status: filters.status, city: filters.city }}
        onApply={(choice) => onChange(withChoice(filters, choice))}
        preview={(choice) => counted(countWith(withChoice(filters, choice)), 'сграда', 'сгради')}
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

function isBuildingStatus(value: string): value is BuildingStatus {
  return (STATUS_ORDER as readonly string[]).includes(value);
}

function withChoice(filters: BuildingFilters, choice: FilterChoice<FacetKey>): BuildingFilters {
  return {
    ...filters,
    district: choice.district,
    status: choice.status.filter(isBuildingStatus),
    city: choice.city,
  };
}
