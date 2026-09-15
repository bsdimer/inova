import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MailPlus, RotateCcw, ShieldOff, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  ErrorNote,
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  StatusBadge,
  inputClass,
} from '../components/ui';
import { api, ApiError, type Role, type StaffMember } from '../lib/api';
import { getSession } from '../lib/auth';
import { useSelectedTenantId } from '../lib/tenant';

export function StaffPage() {
  const tenantId = useSelectedTenantId();
  const queryClient = useQueryClient();
  const session = getSession();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const staff = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => api<StaffMember[]>('/tenant/staff', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
  });
  const roles = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => api<Role[]>('/tenant/roles', { tenantId: tenantId! }),
    enabled: Boolean(tenantId),
  });

  const update = useMutation({
    mutationFn: (input: { userId: string; roleKey?: string; status?: string }) =>
      api(`/tenant/staff/${input.userId}`, {
        method: 'PATCH',
        tenantId: tenantId!,
        body: { roleKey: input.roleKey, status: input.status },
      }),
    onSuccess: () => {
      setRowError(null);
      void queryClient.invalidateQueries({ queryKey: ['staff', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
    },
    onError: (e) => setRowError(e instanceof ApiError ? e.message : 'Something went wrong.'),
  });

  if (staff.error instanceof ApiError && staff.error.status === 403) {
    return <AccessNote page="Staff" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-landmark">
            People who can sign in to this organization and what they are allowed to do.
          </p>
        </div>
        <PrimaryButton onClick={() => setInviteOpen(true)}>
          <span className="flex items-center gap-2">
            <MailPlus size={16} /> Invite member
          </span>
        </PrimaryButton>
      </div>

      <ErrorNote message={rowError} />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-x-auto rounded-3xl border border-sand/70 bg-white/80 shadow-sm shadow-landmark/5 backdrop-blur"
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sand/80 bg-cream/70 text-xs font-semibold tracking-wider text-landmark uppercase">
              <th className="px-6 py-3">Member</th>
              <th className="px-6 py-3">Contact</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Since</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.isLoading && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-landmark">
                  Loading staff…
                </td>
              </tr>
            )}
            {staff.data?.map((member) => {
              const isSelf = member.userId === session?.user.id;
              return (
                <tr
                  key={member.userId}
                  className="border-b border-sand/60 transition-colors last:border-0 hover:bg-orange/4"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[35%] bg-gradient-to-br from-orange-bright to-orange text-sm font-bold text-white shadow-sm shadow-orange/15">
                        {member.fullName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-semibold">
                        {member.fullName}
                        {isSelf && <span className="ml-2 text-xs text-landmark">(you)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-landmark">
                    <p>{member.email ?? '—'}</p>
                    {member.phone && <p className="text-xs">{member.phone}</p>}
                  </td>
                  <td className="px-6 py-3.5">
                    <select
                      value={member.roleKey}
                      disabled={isSelf || member.status === 'revoked' || update.isPending}
                      onChange={(e) =>
                        update.mutate({ userId: member.userId, roleKey: e.target.value })
                      }
                      className="rounded-lg border border-sand bg-white/80 px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-orange disabled:opacity-50"
                    >
                      {(roles.data ?? [{ key: member.roleKey, name: member.roleKey }]).map(
                        (role) => (
                          <option key={role.key} value={role.key}>
                            {role.name}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={member.status} />
                  </td>
                  <td className="px-6 py-3.5 text-landmark">
                    {new Date(member.since).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex justify-end gap-2">
                      {member.status === 'active' && (
                        <GhostButton
                          disabled={isSelf || update.isPending}
                          onClick={() =>
                            update.mutate({ userId: member.userId, status: 'suspended' })
                          }
                        >
                          <span className="flex items-center gap-1.5">
                            <ShieldOff size={14} /> Suspend
                          </span>
                        </GhostButton>
                      )}
                      {member.status === 'suspended' && (
                        <GhostButton
                          disabled={update.isPending}
                          onClick={() => update.mutate({ userId: member.userId, status: 'active' })}
                        >
                          <span className="flex items-center gap-1.5">
                            <RotateCcw size={14} /> Reactivate
                          </span>
                        </GhostButton>
                      )}
                      {member.status !== 'revoked' && (
                        <GhostButton
                          danger
                          disabled={isSelf || update.isPending}
                          onClick={() =>
                            update.mutate({ userId: member.userId, status: 'revoked' })
                          }
                        >
                          <span className="flex items-center gap-1.5">
                            <UserX size={14} /> Revoke
                          </span>
                        </GhostButton>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {staff.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-landmark">
                  No staff members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        tenantId={tenantId}
        roles={roles.data ?? []}
      />
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  tenantId,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string | null;
  roles: Role[];
}) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleKey, setRoleKey] = useState('manager');
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);

  const invite = useMutation({
    mutationFn: () =>
      api<{ inviteSent: boolean }>('/tenant/staff', {
        method: 'POST',
        tenantId: tenantId!,
        body: { fullName, email, phone: phone || undefined, roleKey },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
      setInvited(true);
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong.'),
  });

  const reset = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setRoleKey('manager');
    setError(null);
    setInvited(false);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    invite.mutate();
  };

  return (
    <Modal open={open} title={invited ? 'Invite sent' : 'Invite a staff member'} onClose={reset}>
      {invited ? (
        <div className="space-y-4">
          <p className="text-sm text-landmark">
            <strong className="text-gold-black">{fullName}</strong> was added with an activation
            code. They activate their account from the mobile or web app using the code.
          </p>
          <p className="rounded-xl border border-orange/15 bg-orange/8 px-3.5 py-2.5 text-xs font-medium text-ember">
            Dev note: SMS/Viber delivery is mocked until the gateway lands — the code is printed in
            the core-api console.
          </p>
          <div className="flex justify-end">
            <PrimaryButton onClick={reset}>Done</PrimaryButton>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name">
            <input
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nikol Petrova"
              required
              minLength={2}
            />
          </Field>
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nikol@example.bg"
              required
            />
          </Field>
          <Field label="Phone" hint="Optional — used for the SMS/Viber activation code.">
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+359881234567"
              pattern="\+\d{6,15}"
            />
          </Field>
          <Field label="Role">
            <select
              className={inputClass}
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.name}
                </option>
              ))}
            </select>
          </Field>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <GhostButton onClick={reset}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Inviting…' : 'Send invite'}
            </PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function AccessNote({ page }: { page: string }) {
  return (
    <div className="rounded-3xl border border-sand/70 bg-white/80 p-10 text-center shadow-sm shadow-landmark/5 backdrop-blur">
      <h1 className="text-xl font-extrabold">{page}</h1>
      <p className="mt-2 text-sm text-landmark">Your role doesn't include access to this page.</p>
    </div>
  );
}
