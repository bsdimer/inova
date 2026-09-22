import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  Chip,
  ErrorNote,
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  panelInputClass,
} from '../components/ui';
import { api, ApiError, type Permission, type Role } from '../lib/api';
import { useSelectedTenantId } from '../lib/tenant';
import { AccessNote } from './Staff';
import { ROLE_NAMES } from './staff/model';

/** Role descriptions in the stakeholder's words; custom roles have none. */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Всички права в организацията, включително ролите и служителите.',
  manager: 'Ежедневните операции за сградите, в които е назначен.',
  accountant: 'Такси, плащания и финансови отчети.',
  resident: 'Собственият апартамент.',
  owner: 'Собственият апартамент, гласуване и предложения за анкети.',
  tenant: 'Само собственият апартамент.',
  cleaning: 'Вижда само сигналите с етикет «Чистота» в сградите, които са ѝ възложени.',
  technician: 'Вижда само сигналите с етикет «Поддръжка» в сградите, които са му възложени.',
};

/** Bulgarian headings for the permission catalogue, keyed by the prefix. */
const PERMISSION_GROUPS: Record<string, string> = {
  tenant: 'Организация',
  staff: 'Служители',
  roles: 'Роли',
  audit: 'Одит',
  property: 'Имоти',
  residents: 'Жители',
  billing: 'Финанси',
  payments: 'Плащания',
  notifications: 'Комуникация',
  surveys: 'Анкети',
  issues: 'Нередности',
  tasks: 'Задачи',
  documents: 'Документи',
  reports: 'Отчети',
  settings: 'Настройки',
};

function memberLabel(count: number): string {
  if (count === 0) return 'още никой';
  return `${count} ${count === 1 ? 'акаунт' : 'акаунта'}`;
}

export function RolesPage() {
  const tenantId = useSelectedTenantId();
  const queryClient = useQueryClient();
  const [editorRole, setEditorRole] = useState<Role | 'new' | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

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

  if (roles.error instanceof ApiError && roles.error.status === 403) {
    return <AccessNote page="Роли" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Роли</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Всяка роля е набор от права от общия каталог. Обхватът — кои сгради — се задава при
            назначаване, в Служители.
          </p>
        </div>
        <PrimaryButton onClick={() => setEditorRole('new')}>
          <span className="flex items-center gap-2">
            <Plus size={16} /> Нова роля
          </span>
        </PrimaryButton>
      </div>

      <ErrorNote message={pageError} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {roles.data?.map((role, i) => {
          const locked = role.key === 'admin';
          return (
            <motion.article
              key={role.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.05 }}
              className="glass flex flex-col p-5"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base font-semibold">{ROLE_NAMES[role.key] ?? role.name}</h2>
                <Chip muted>
                  {role.key} · {role.isSystem ? 'системна' : 'собствена'}
                </Chip>
                {locked && <Chip muted>заключена</Chip>}
                <span className="num ml-auto text-xs text-ink-faint">
                  {memberLabel(role.members)}
                </span>
              </div>

              {ROLE_DESCRIPTIONS[role.key] && (
                <p className="mt-2 text-sm text-ink-muted">{ROLE_DESCRIPTIONS[role.key]}</p>
              )}

              <div className="mt-4 flex flex-1 flex-wrap content-start gap-1.5">
                {locked ? (
                  <Chip>всички права</Chip>
                ) : (
                  role.permissions.map((p) => <Chip key={p}>{p}</Chip>)
                )}
                {!locked && role.permissions.length === 0 && (
                  <span className="text-xs text-ink-faint">Без права</span>
                )}
              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-glass-divider pt-4">
                {locked ? (
                  <span className="flex items-center gap-2 text-xs text-ink-muted">
                    <Lock size={13} /> Системна роля — правата не се променят
                  </span>
                ) : (
                  <>
                    <GhostButton onClick={() => setEditorRole(role)}>
                      <span className="flex items-center gap-1.5">
                        <Pencil size={13} /> Редактирай
                      </span>
                    </GhostButton>
                    {!role.isSystem && (
                      <GhostButton
                        danger
                        disabled={role.members > 0 || remove.isPending}
                        onClick={() => remove.mutate(role.key)}
                      >
                        <span className="flex items-center gap-1.5">
                          <Trash2 size={13} /> Изтрий
                        </span>
                      </GhostButton>
                    )}
                  </>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>

      <PermissionCatalogue catalog={permissions.data ?? []} />

      <RoleEditor
        role={editorRole}
        onClose={() => setEditorRole(null)}
        tenantId={tenantId}
        catalog={permissions.data ?? []}
      />
    </div>
  );
}

/** Every right the platform knows, grouped by the area it belongs to. */
function PermissionCatalogue({ catalog }: { catalog: Permission[] }) {
  if (catalog.length === 0) return null;
  const groups = new Map<string, Permission[]>();
  for (const permission of catalog) {
    const prefix = permission.key.split('.')[0] ?? 'other';
    const title = PERMISSION_GROUPS[prefix] ?? prefix;
    groups.set(title, [...(groups.get(title) ?? []), permission]);
  }

  return (
    <section className="glass p-5">
      <h2 className="text-base font-semibold">Каталог на правата</h2>
      <div className="mt-4 space-y-3">
        {[...groups].map(([title, items]) => (
          <div key={title} className="flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 text-xs font-semibold tracking-wider text-ink-faint uppercase">
              {title}
            </span>
            {items.map((permission) => (
              <span key={permission.key} title={permission.description}>
                <Chip>{permission.key}</Chip>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function RoleEditor({
  role,
  onClose,
  tenantId,
  catalog,
}: {
  role: Role | 'new' | null;
  onClose: () => void;
  tenantId: string | null;
  catalog: Permission[];
}) {
  const queryClient = useQueryClient();
  const isNew = role === 'new';
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
      title={isNew ? 'Нова роля' : `Редактиране на ${role?.name ?? ''}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
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

        <div>
          <p className="mb-2 text-sm font-semibold">Права</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {catalog.map((permission) => (
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
                  <span className="block text-sm font-medium text-panel-ink">{permission.key}</span>
                  <span className="block text-xs text-panel-ink-muted">
                    {permission.description}
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
            disabled={save.isPending}
            className="rounded-full bg-panel-ink px-5 py-2 text-sm font-semibold text-panel-ink-inverse disabled:opacity-40"
          >
            {save.isPending ? 'Запазва…' : isNew ? 'Създай роля' : 'Запази промените'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
