import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Field, Modal, panelInputClass } from '../../components/ui';
import { api, ApiError, type Role } from '../../lib/api';
import { ROLE_NAMES } from './model';

/**
 * Invite a staff member. The mock-ups do not have an invite panel yet, so this
 * stays a dialog on the light panel surface rather than inventing a second
 * drawer layout.
 */
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
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Нещо се обърка.'),
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
    <Modal open={open} title={invited ? 'Поканата е изпратена' : 'Покани служител'} onClose={reset}>
      {invited ? (
        <div className="space-y-4">
          <p className="text-sm text-panel-ink-muted">
            <strong className="font-semibold text-panel-ink">{fullName}</strong> е добавен с код за
            активиране. Акаунтът се активира с този код от мобилното приложение или от уеб портала.
          </p>
          {/* MOCK: delivery is logged by core-api until the worker and the SMS gateway land. */}
          <p className="rounded-xl bg-panel-row px-3.5 py-2.5 text-xs text-panel-ink-muted">
            Бележка за разработка: доставката по SMS/Viber още е имитирана — кодът се печата в
            конзолата на core-api.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-panel-ink px-5 py-2 text-sm font-semibold text-panel-ink-inverse"
            >
              Готово
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Име и фамилия">
            <input
              className={panelInputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Никол Петрова"
              required
              minLength={2}
            />
          </Field>
          <Field label="Имейл">
            <input
              className={panelInputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nikol@example.bg"
              required
            />
          </Field>
          <Field label="Телефон" hint="По избор — за кода за активиране по SMS/Viber.">
            <input
              className={panelInputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+359881234567"
              pattern="\+\d{6,15}"
            />
          </Field>
          <Field label="Роля">
            <select
              className={panelInputClass}
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role.key} value={role.key}>
                  {ROLE_NAMES[role.key] ?? role.name}
                </option>
              ))}
            </select>
          </Field>
          {error && (
            <p className="rounded-xl bg-panel-row px-3.5 py-2.5 text-sm font-medium text-panel-status-urgent">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-panel-border px-4 py-2 text-sm font-medium text-panel-ink"
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={invite.isPending}
              className="rounded-full bg-panel-ink px-5 py-2 text-sm font-semibold text-panel-ink-inverse disabled:opacity-40"
            >
              {invite.isPending ? 'Изпраща…' : 'Изпрати покана'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
