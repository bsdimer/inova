import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Lock, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  ErrorNote,
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
} from '../components/ui';
import { api, ApiError, type Permission, type Role } from '../lib/api';
import { useSelectedTenantId } from '../lib/tenant';
import { AccessNote } from './Staff';

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
    onError: (e) => setPageError(e instanceof ApiError ? e.message : 'Something went wrong.'),
  });

  if (roles.error instanceof ApiError && roles.error.status === 403) {
    return <AccessNote page="Roles" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Roles</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Each role maps to a set of permissions. The Administrator role is locked and always
            has every permission.
          </p>
        </div>
        <PrimaryButton onClick={() => setEditorRole('new')}>
          <span className="flex items-center gap-2">
            <Plus size={16} /> New role
          </span>
        </PrimaryButton>
      </div>

      <ErrorNote message={pageError} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {roles.data?.map((role, i) => {
          const locked = role.key === 'admin';
          return (
            <motion.div
              key={role.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="flex flex-col rounded-2xl bg-white p-5 shadow-sm shadow-navy/5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-extrabold">{role.name}</h2>
                  <p className="text-xs text-ink-secondary">
                    {role.key}
                    {role.isSystem && ' · system'}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-mist px-2.5 py-1 text-xs font-bold text-ink-secondary">
                  <Users size={13} />
                  {role.members}
                </span>
              </div>

              <div className="mt-4 flex flex-1 flex-wrap content-start gap-1.5">
                {role.permissions.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-brand-blue/8 px-2.5 py-1 text-xs font-semibold text-brand-blue"
                  >
                    {p}
                  </span>
                ))}
                {role.permissions.length === 0 && (
                  <span className="text-xs text-ink-secondary">No permissions</span>
                )}
              </div>

              <div className="mt-5 flex items-center gap-2">
                {locked ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
                    <Lock size={13} /> Locked — always has all permissions
                  </span>
                ) : (
                  <>
                    <GhostButton onClick={() => setEditorRole(role)}>
                      <span className="flex items-center gap-1.5">
                        <Pencil size={13} /> Edit
                      </span>
                    </GhostButton>
                    {!role.isSystem && (
                      <GhostButton
                        danger
                        disabled={role.members > 0 || remove.isPending}
                        onClick={() => remove.mutate(role.key)}
                      >
                        <span className="flex items-center gap-1.5">
                          <Trash2 size={13} /> Delete
                        </span>
                      </GhostButton>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <RoleEditor
        role={editorRole}
        onClose={() => setEditorRole(null)}
        tenantId={tenantId}
        catalog={permissions.data ?? []}
      />
    </div>
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
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong.'),
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
      title={isNew ? 'New role' : `Edit ${role?.name ?? ''}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isNew && (
            <Field label="Key" hint="Lowercase slug, cannot be changed later.">
              <input
                className={inputClass}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="accountant"
                pattern="[a-z0-9][a-z0-9-]{1,30}"
                required
              />
            </Field>
          )}
          <Field label="Name">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Accountant"
              required
              minLength={2}
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Permissions</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {catalog.map((permission) => (
              <label
                key={permission.key}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${
                  selected.has(permission.key)
                    ? 'border-brand-blue bg-brand-blue/5'
                    : 'border-navy/8 hover:border-navy/15'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(permission.key)}
                  onChange={() => toggle(permission.key)}
                  className="mt-0.5 accent-brand-blue"
                />
                <span>
                  <span className="block text-sm font-bold">{permission.key}</span>
                  <span className="block text-xs text-ink-secondary">
                    {permission.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
