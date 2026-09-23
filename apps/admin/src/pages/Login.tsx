import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useState, type FormEvent, type ReactNode } from 'react';
import { AppBackground } from '../components/AppBackground';
import {
  EnvelopeSimple,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  TriangleAlert,
} from '../components/icons';
import { InovaWordmark } from '../components/Logo';
import { login } from '../lib/auth';

/**
 * Вход, as drawn in Figma Screens 911:3793 (light), 920:3865 (dark), 920:3885
 * (error) and 920:3958 (402). The card is 440 wide with 40 of padding, 370
 * with 24/28 on a phone; the gaps between its parts are the ones named in the
 * frame (24 · 6 · 28 · 18 · 14 · 22).
 */
export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      void navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Нещо се обърка.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppBackground />
      {/*
        The card sits in the middle of the screen, not of the space above the
        tagline: equal padding top and bottom keeps it centred and clear of it.
      */}
      <div className="app-content relative flex min-h-full flex-col items-center px-4">
        <div className="flex w-full flex-1 items-center justify-center py-[72px] sm:py-[88px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="glass-data w-full max-w-[440px] px-6 py-7 sm:p-10"
          >
            <div className="pt-2 pb-3 pl-2 text-ink">
              <InovaWordmark size={22} />
            </div>

            <h1 className="mt-6 text-title-22 font-medium">Добре дошли отново</h1>
            <p className="mt-1.5 text-body-14 text-ink-soft">
              Влезте, за да управлявате портфолиото си.
            </p>

            <form onSubmit={submit} className="mt-7">
              {/* The error belongs to the pair, and the mock-up hangs it under the first field. */}
              <Field label="Имейл" error={error}>
                <EnvelopeSimple
                  size={20}
                  className={`shrink-0 ${error ? 'text-status-urgent' : email ? 'text-ink' : 'text-ink-faint'}`}
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.bg"
                  aria-invalid={error ? true : undefined}
                  className={INPUT}
                />
              </Field>

              <div className="mt-[18px]">
                <Field label="Парола">
                  <Lock
                    size={20}
                    className={`shrink-0 ${password ? 'text-ink' : 'text-ink-faint'}`}
                  />
                  <input
                    type={reveal ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    aria-invalid={error ? true : undefined}
                    className={INPUT}
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((v) => !v)}
                    aria-label={reveal ? 'Скрий паролата' : 'Покажи паролата'}
                    className="shrink-0 rounded-full text-ink-muted transition-colors hover:text-ink"
                  >
                    {reveal ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </Field>
              </div>

              <div className="mt-3.5 flex justify-end pr-1">
                <button
                  type="button"
                  onClick={() => setRecovery(true)}
                  className="text-body-14 font-semibold text-ink-soft underline transition-colors hover:text-ink"
                >
                  Забравена парола?
                </button>
              </div>

              {/*
                TODO(M1): public password recovery (B14). The mock-up has the
                whole flow (954:6136 and on), but auth-service has no recovery
                endpoint yet, so the link says who can help instead of pretending.
              */}
              {recovery && (
                <p className="mt-3.5 flex gap-1.5 pl-0.5 text-body-13-tight text-ink">
                  <TriangleAlert size={14} className="mt-px shrink-0 text-status-pending" />
                  Възстановяването на парола още не е налично. Свържете се с администратора на
                  организацията, който може да изпрати нов код за активиране.
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="cta text-body-14 mt-[22px] flex h-11 w-full items-center justify-center gap-2 px-7 font-semibold transition-opacity disabled:opacity-60"
              >
                {loading ? <LoaderCircle size={18} className="animate-spin" /> : 'Влез'}
              </button>
            </form>
          </motion.div>
        </div>

        <p className="absolute inset-x-0 bottom-10 text-center text-body-13-tight text-ink-soft sm:bottom-14">
          Порталът за управление на Вашите имоти.
        </p>
      </div>
    </>
  );
}

const INPUT =
  'min-w-0 flex-1 bg-transparent text-body-15 font-medium text-ink outline-none placeholder:text-ink-faint';

/** V2/Field (906:487): overline label, the pill, and the message under it in the error state. */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-overline-12 font-semibold text-ink-muted uppercase">{label}</span>
      <span
        className="glass-field flex items-center gap-3 px-[18px] py-[15px]"
        data-invalid={error ? 'true' : undefined}
      >
        {children}
      </span>
      {error && (
        <span role="alert" className="flex gap-1.5 pt-0.5 pl-0.5 text-body-13-tight text-ink">
          <TriangleAlert size={14} className="mt-px shrink-0 text-status-urgent" />
          {error}
        </span>
      )}
    </label>
  );
}
