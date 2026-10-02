import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Buildings, Lock, MagnifyingGlass, Warning } from '../components/icons';
import { EmptyState, GhostButton, PrimaryButton } from '../components/ui';
import { api, ApiError, type Building, type TenantContext } from '../lib/api';
import { useSelectedTenantId } from '../lib/tenant';
import { permissionLabel } from './roles/permissions';
import {
  BodyMessage,
  BuildingCard,
  BuildingCards,
  BuildingRow,
  BuildingsTable,
  SkeletonRows,
} from './buildings/BuildingsTable';
import { BuildingsToolbar } from './buildings/BuildingsToolbar';
import {
  EMPTY_FILTERS,
  applyFilters,
  counted,
  describeFilters,
  hasAnyFilter,
  propertyTotal,
  sortBuildings,
  valuesOf,
  type BuildingFilters,
} from './buildings/model';

// TODO(M2): «Добави сграда» and «Импорт от таблица» (945:5108) come with the
// building form and the import screens.
export function BuildingsPage() {
  const tenantId = useSelectedTenantId();
  const [filters, setFilters] = useState<BuildingFilters>(EMPTY_FILTERS);

  const context = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => api<TenantContext>('/tenant', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });
  const list = useQuery({
    queryKey: ['buildings', tenantId],
    queryFn: () => api<Building[]>('/buildings', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
    // A refusal (403) does not change on a retry; say so at once.
    retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 3,
  });

  const buildings = useMemo(() => list.data ?? [], [list.data]);
  const visible = useMemo(
    () => sortBuildings(applyFilters(buildings, filters), filters.sort),
    [buildings, filters],
  );
  const tenantName = context.data?.tenant.name ?? 'организацията';
  const denied = list.error instanceof ApiError && list.error.status === 403;
  const properties = buildings.reduce((sum, b) => sum + propertyTotal(b), 0);
  const loading = list.isPending;
  const hasList = buildings.length > 0;
  // The toolbar stays from the first frame so the rows do not jump down when
  // they arrive; it goes only where there is nothing to search.
  const showToolbar = !list.error && (loading || hasList);

  const message = bodyMessage({
    denied,
    failed: Boolean(list.error) && !denied,
    loaded: !list.isPending,
    tenantName,
    total: buildings.length,
    shown: visible.length,
    filters,
    retrying: list.isFetching,
    onRetry: () => void list.refetch(),
    onReset: () => setFilters({ ...EMPTY_FILTERS, sort: filters.sort }),
  });

  return (
    // Page head, toolbar and table stand 16 apart (945:5108: 72 + 50 → 138, 242 → 258).
    <div className="space-y-4">
      <div className="min-w-0">
        <h1 className="text-title-22 font-medium">Сгради</h1>
        <p className="text-body-14 mt-1 hidden text-ink-muted md:block">
          Портфолиото на {tenantName} — всяка сграда с входовете, имотите и домоуправителя ѝ.
        </p>
        {hasList && (
          <p className="num text-body-14 mt-1 text-ink-muted md:hidden">
            {counted(buildings.length, 'сграда', 'сгради')} · {counted(properties, 'имот', 'имота')}
          </p>
        )}
      </div>

      {showToolbar && (
        <BuildingsToolbar
          filters={filters}
          onChange={setFilters}
          districts={valuesOf(buildings, 'district')}
          cities={valuesOf(buildings, 'city')}
          shown={visible.length}
          total={buildings.length}
          loading={loading}
        />
      )}

      {message.kind === 'portfolio-empty' ? (
        // An organisation without buildings gets the message alone (947:5498).
        <div className="glass-data">{message.body}</div>
      ) : (
        <>
          <div className="hidden md:block">
            <BuildingsTable>
              {message.body ? (
                <BodyMessage>{message.body}</BodyMessage>
              ) : list.isPending ? (
                <SkeletonRows />
              ) : (
                visible.map((building) => <BuildingRow key={building.id} building={building} />)
              )}
            </BuildingsTable>
          </div>
          <div className="md:hidden">
            <BuildingCards>
              {message.body ? (
                <div className="glass-data">{message.body}</div>
              ) : list.isPending ? (
                <div className="glass-data space-y-3 p-4">
                  <div className="h-16 animate-pulse rounded-2xl bg-glass-inner" />
                  <div className="h-16 animate-pulse rounded-2xl bg-glass-inner" />
                </div>
              ) : (
                visible.map((building) => <BuildingCard key={building.id} building={building} />)
              )}
            </BuildingCards>
          </div>
        </>
      )}
    </div>
  );
}

type Message = { kind: 'rows' | 'state' | 'portfolio-empty'; body: ReactNode };

/** What stands in for the rows (1519:21142), or rows when there are some. */
function bodyMessage(input: {
  denied: boolean;
  failed: boolean;
  loaded: boolean;
  tenantName: string;
  total: number;
  shown: number;
  filters: BuildingFilters;
  /** A retry runs its own back-off; the button waits for it. */
  retrying: boolean;
  onRetry: () => void;
  onReset: () => void;
}): Message {
  if (input.denied) {
    return {
      kind: 'state',
      body: (
        <EmptyState icon={<Lock size="1.375rem" />} title="Ролята ви не може да вижда сгради">
          За преглед е нужно правото „{permissionLabel('property.read')}“. Администратор на{' '}
          {input.tenantName} може да го добави към ролята ви.
        </EmptyState>
      ),
    };
  }
  if (input.failed) {
    return {
      kind: 'state',
      body: (
        <EmptyState
          icon={<Warning size="1.375rem" />}
          title="Списъкът не се зареди"
          action={
            <PrimaryButton onClick={input.onRetry} disabled={input.retrying}>
              {input.retrying ? 'Зарежда…' : 'Опитай отново'}
            </PrimaryButton>
          }
        >
          Проверете връзката и опитайте отново.
        </EmptyState>
      ),
    };
  }
  // Until the list has arrived there is nothing to call empty: skeleton rows stand in.
  if (!input.loaded) return { kind: 'rows', body: null };
  if (input.total === 0) {
    return {
      kind: 'portfolio-empty',
      body: (
        <EmptyState icon={<Buildings size="1.375rem" />} title="Още няма сгради">
          Започнете с една сграда: адрес, входове и списък с имоти. Собствениците и живущите се
          добавят после — един по един, от реда на имота.
        </EmptyState>
      ),
    };
  }
  if (input.shown === 0 && hasAnyFilter(input.filters)) {
    return {
      kind: 'state',
      body: (
        <EmptyState
          icon={<MagnifyingGlass size="1.375rem" />}
          title="Няма сгради по тези филтри"
          action={<GhostButton onClick={input.onReset}>Изчисти филтрите</GhostButton>}
        >
          {describeFilters(input.filters)}. Разширете филтрите или ги изчистете, за да видите всички{' '}
          {counted(input.total, 'сграда', 'сгради')}.
        </EmptyState>
      ),
    };
  }
  return { kind: 'rows', body: null };
}
