import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Lock, PencilSimple, Trash } from '../components/icons';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import {
  Chip,
  ErrorNote,
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SkeletonBar,
  panelInputClass,
} from '../components/ui';
import { api, ApiError, type Permission, type Role } from '../lib/api';
import { useSelectedTenantId, useTenantContext } from '../lib/tenant';
import { AccessNote } from './Staff';
import { groupPermissions, permissionLabel, sortPermissions } from './roles/permissions';
import { ROLE_NAMES } from './staff/model';

/** Role descriptions as drawn in Роли (1091:10390); custom roles have none. */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Всички права в организацията, включително ролите и служителите.',
  manager: 'Ежедневните операции за сградите, в които е назначен.',
  accountant: 'Входни такси, плащания и финансови отчети.',
  resident: 'Собственият имот.',
  owner: 'Собственият имот, гласуване и предложения за анкети.',
  tenant: 'Само собственият имот.',
  cleaning: 'Вижда само сигналите с етикет «Чистота» в сградите, които са ѝ възложени. Нищо друго.',
  technician:
    'Вижда само сигналите с етикет «Поддръжка» в сградите, които са му възложени. Нищо друго.',
};

const wideQuery = '(min-width: 64rem)';

/** lg and up: the page's own two-column breakpoint, not the menu's. */
function useWide(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const list = window.matchMedia(wideQuery);
      list.addEventListener('change', fn);
      return () => list.removeEventListener('change', fn);
    },
    () => window.matchMedia(wideQuery).matches,
    () => true,
  );
}

function memberLabel(count: number): string {
  if (count === 0) return 'още никой';
  return `${count} ${count === 1 ? 'акаунт' : 'акаунта'}`;
}

export function RolesPage() {
  const tenantId = useSelectedTenantId();
  const queryClient = useQueryClient();
  const [editorRole, setEditorRole] = useState<Role | 'new' | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  // Without roles.manage every write ends in 403, so the buttons are not
  // offered; while the rights load, nothing is offered either.
  const canManage = useTenantContext().data?.permissions.includes('roles.manage') === true;

  const roles = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => api<Role[]>('/tenant/roles', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
  });
  const permissions = useQuery({
    queryKey: ['permissions', tenantId],
    queryFn: () => api<Permission[]>('/tenant/permissions', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
  });

  const remove = useMutation({
    mutationFn: (key: string) =>
      api(`/tenant/roles/${key}`, { method: 'DELETE', tenantId: tenantId! }),
    onSuccess: () => {
      setPageError(null);
      void queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
    },
    onError: (e) => setPageError(e instanceof ApiError ? e.message : 'Нещо се обърка.'),
  });

  const twoColumns = useWide();
  const roleCards = (roles.data ?? []).map((role, i) => (
    <RoleCard
      key={role.key}
      role={role}
      index={i}
      catalogue={permissions.data ?? []}
      canManage={canManage}
      onEdit={() => setEditorRole(role)}
      onDelete={() => remove.mutate(role.key)}
      deleting={remove.isPending}
    />
  ));

  if (roles.error instanceof ApiError && roles.error.status === 403) {
    return <AccessNote page="Роли" />;
  }

  return (
    // Head, grid and catalogue 16 apart, as on the other pages (1091:10390).
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-title-22 font-medium">Роли</h1>
          <p className="text-body-14 mt-1 text-ink-muted">
            Всяка роля е набор от права от общия каталог. Обхватът — кои сгради — се задава при
            назначаване, в Служители.
          </p>
        </div>
        {canManage && <PrimaryButton onClick={() => setEditorRole('new')}>Нова роля</PrimaryButton>}
      </div>

      <ErrorNote message={pageError} />

      {/*
        Two columns that fill independently, as drawn: each card is as tall as
        its rights, roles alternating between them in the API's order. Below
        lg one column in that order — a flat list, so reading and Tab follow
        what is on screen.
      */}
      {roles.isError ? (
        <ErrorNote message="Ролите не се заредиха." />
      ) : roles.isPending ? (
        <div aria-hidden className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="glass-data flex flex-col gap-3 rounded-3xl px-[1.5625rem] py-[1.0625rem]"
            >
              <SkeletonBar className="h-5 w-2/5" />
              <SkeletonBar className="h-4 w-4/5" />
              <SkeletonBar className="h-6 w-3/5" />
            </div>
          ))}
        </div>
      ) : twoColumns ? (
        <div className="grid grid-cols-2 items-start gap-5">
          {[0, 1].map((column) => (
            <div key={column} className="flex flex-col gap-5">
              {roleCards.filter((_, i) => i % 2 === column)}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">{roleCards}</div>
      )}

      {/* After the roles: a catalogue that answers first does not jump down. */}
      {roles.isSuccess &&
        (permissions.isError ? (
          <ErrorNote message="Каталогът на правата не се зареди." />
        ) : (
          <PermissionCatalogue catalogue={permissions.data ?? []} />
        ))}

      <RoleEditor
        role={editorRole}
        onClose={() => setEditorRole(null)}
        tenantId={tenantId}
        catalogue={permissions.data}
      />
    </div>
  );
}

/** A right on glass: glass/chip, Label/12 Regular (1092:210). */
function RightChip({ children }: { children: string }) {
  return (
    <li className="text-label-12 rounded-full bg-glass-chip px-2.5 py-[0.3125rem] whitespace-nowrap text-ink shadow-[inset_0_0_0_0.0625rem_var(--glass-edge-soft)]">
      {children}
    </li>
  );
}

/** Role card (1092:201): name, kind, people, what it is for, its rights, the action. */
function RoleCard({
  role,
  index,
  catalogue,
  canManage,
  onEdit,
  onDelete,
  deleting,
}: {
  role: Role;
  index: number;
  catalogue: Permission[];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const locked = role.key === 'admin';
  const descriptionOf = (key: string) => catalogue.find((p) => p.key === key)?.description;
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.05 }}
      // 25 in and 17 down: 24 and 16 inside the 1 px edge (1092:201).
      className="glass-data flex flex-col gap-2.5 rounded-3xl px-[1.5625rem] py-[1.0625rem]"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-title-16 font-medium">{ROLE_NAMES[role.key] ?? role.name}</h2>
        <Chip>{role.isSystem ? 'системна' : 'собствена'}</Chip>
        {locked && <Chip>заключена</Chip>}
        <span className="num text-body-13-tight ml-2.5 text-ink-soft">
          {memberLabel(role.members)}
        </span>
      </div>

      {ROLE_DESCRIPTIONS[role.key] && (
        <p className="text-body-13-tight text-ink-soft">{ROLE_DESCRIPTIONS[role.key]}</p>
      )}

      {!locked && role.permissions.length === 0 ? (
        <p className="text-label-12 text-ink-soft">Без права</p>
      ) : (
        <ul aria-label="Права" className="flex flex-wrap gap-2">
          {locked ? (
            <RightChip>всички права</RightChip>
          ) : (
            sortPermissions(role.permissions).map((key) => (
              <RightChip key={key}>{permissionLabel(key, descriptionOf(key))}</RightChip>
            ))
          )}
        </ul>
      )}

      {/* A role that only reads gets no action line; the locked role still says why. */}
      {(locked || canManage) && (
        <>
          <hr className="border-[var(--glass-edge-soft)]" />
          <div className="flex items-center gap-2">
            {locked ? (
              <span className="text-body-13-tight flex items-center gap-2 text-ink-soft">
                <Lock size="1rem" /> Системна роля — правата не се променят
              </span>
            ) : (
              <>
                <SecondaryButton size="sm" onClick={onEdit}>
                  <span className="flex items-center gap-1.5">
                    <PencilSimple size="0.875rem" /> Редактирай
                  </span>
                </SecondaryButton>
                {/* Not drawn: a custom role nobody holds any more can go. */}
                {!role.isSystem && role.members === 0 && (
                  <GhostButton danger disabled={deleting} onClick={onDelete}>
                    <span className="flex items-center gap-1.5">
                      <Trash size="0.8125rem" /> Изтрий
                    </span>
                  </GhostButton>
                )}
              </>
            )}
          </div>
        </>
      )}
    </motion.article>
  );
}

/** Каталог на правата (1093:154): every right the platform knows, by area. */
function PermissionCatalogue({ catalogue }: { catalogue: Permission[] }) {
  if (catalogue.length === 0) return null;
  return (
    <section
      aria-labelledby="catalogue-title"
      className="glass-data flex flex-col gap-2 rounded-3xl px-[1.5625rem] py-[1.0625rem]"
    >
      <h2 id="catalogue-title" className="text-body-15 font-medium">
        Каталог на правата
      </h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2.5">
        {groupPermissions(catalogue).map(({ title, items }) => (
          <div key={title} className="flex flex-wrap items-center gap-2">
            <span aria-hidden className="text-overline-12 font-semibold text-ink-soft uppercase">
              {title}
            </span>
            <ul aria-label={title} className="flex flex-wrap gap-2">
              {items.map((permission) => (
                <RightChip key={permission.key}>
                  {permissionLabel(permission.key, permission.description)}
                </RightChip>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-label-12 text-ink-soft">
        Няма отделно право за търсене: търсенето връща само типовете, за които акаунтът вече има
        право на четене.
      </p>
    </section>
  );
}

function RoleEditor({
  role,
  onClose,
  tenantId,
  catalogue,
}: {
  role: Role | 'new' | null;
  onClose: () => void;
  tenantId: string | null;
  /** Undefined until it loads, or when it failed: nothing to choose from yet. */
  catalogue: Permission[] | undefined;
}) {
  const queryClient = useQueryClient();
  const isNew = role === 'new';
  const systemRole = !isNew && role !== null && role.isSystem;
  const displayName = isNew || !role ? '' : (ROLE_NAMES[role.key] ?? role.name);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Sync form state when a different role is opened.
  const [loadedFor, setLoadedFor] = useState<Role | 'new' | null>(null);
  if (role !== loadedFor) {
    setLoadedFor(role);
    setKey(isNew || !role ? '' : role.key);
    setName(isNew || !role ? '' : role.name);
    setSelected(new Set(isNew || !role ? [] : role.permissions));
    setError(null);
  }

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? api('/tenant/roles', {
            method: 'POST',
            tenantId: tenantId!,
            body: { key, name, permissions: [...selected] },
          })
        : api(`/tenant/roles/${(role as Role).key}`, {
            method: 'PATCH',
            tenantId: tenantId!,
            body: { name, permissions: [...selected] },
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Нещо се обърка.'),
  });

  const toggle = (permissionKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permissionKey)) next.delete(permissionKey);
      else next.add(permissionKey);
      return next;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Modal
      open={role !== null}
      title={isNew ? 'Нова роля' : `Редактиране на ${displayName}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        {/*
          A system role is always shown by its Bulgarian name (ROLE_NAMES); its
          stored name is English and renaming it would change nothing anyone
          sees, so only a new or custom role has a key and a name to edit.
        */}
        {!systemRole && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isNew && (
              <Field label="Ключ" hint="Малки букви и тирета; не се променя по-късно.">
                <input
                  className={panelInputClass}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="accountant"
                  pattern="[a-z0-9][a-z0-9-]{1,30}"
                  required
                />
              </Field>
            )}
            <Field label="Име">
              <input
                className={panelInputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Счетоводител"
                required
                minLength={2}
              />
            </Field>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold">Права</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {groupPermissions(catalogue ?? [])
              .flatMap((group) => group.items)
              .map((permission) => (
                <label
                  key={permission.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl px-3.5 py-3 transition-colors ${
                    selected.has(permission.key)
                      ? 'bg-panel-row-strong'
                      : 'bg-panel-row hover:bg-panel-row-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(permission.key)}
                    onChange={() => toggle(permission.key)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-panel-ink">
                      {permissionLabel(permission.key, permission.description)}
                    </span>
                    {/* WHI-40: the code only here, small, for whoever configures roles. */}
                    <span className="block font-mono text-xs text-panel-ink-muted">
                      {permission.key}
                    </span>
                  </span>
                </label>
              ))}
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-panel-row px-3.5 py-2.5 text-sm font-medium text-panel-status-urgent">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-panel-border px-4 py-2 text-sm font-medium text-panel-ink"
          >
            Отказ
          </button>
          <button
            type="submit"
            disabled={save.isPending || !catalogue}
            className="rounded-full bg-panel-ink px-5 py-2 text-sm font-semibold text-panel-ink-inverse disabled:opacity-40"
          >
            {save.isPending ? 'Запазва…' : isNew ? 'Създай роля' : 'Запази промените'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
