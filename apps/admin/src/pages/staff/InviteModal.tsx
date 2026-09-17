import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import {
  ErrorNote,
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
} from '../../components/ui';
import { api, ApiError, type Role } from '../../lib/api';

export function InviteModal({
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
