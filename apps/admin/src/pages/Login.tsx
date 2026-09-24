import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { validateLoginForm, type LoginFieldError } from '@inova/shared';
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
import { LoginError, login } from '../lib/auth';

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
  const [problem, setProblem] = useState<Problem>(NO_PROBLEM);
  const [submitted, setSubmitted] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // After a failed submit an input error goes as soon as its field is right;
  // a rejected pair clears on any edit, and a notice about the server stays.
  const edit = (field: 'email' | 'password', next: { email: string; password: string }) => {
    if (!submitted) return;
    setProblem((current) => {
      if (current.kind === 'mismatch') return NO_PROBLEM;
      if (current.kind !== 'input') return current;
      const errors = validateLoginForm(next);
      return { ...current, [field]: errors[field] };
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errors = validateLoginForm({ email, password });
    if (errors.email || errors.password) {
      setProblem({ kind: 'input', ...errors });
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setLoading(true);
    setProblem(NO_PROBLEM);
    try {
      await login(email.trim(), password);
      void navigate({ to: '/' });
    } catch (err) {
      const failure = err instanceof LoginError ? err.failure : 'unavailable';
      if (failure === 'invalid-email') {
        setProblem({ kind: 'input', email: 'invalid' });
        emailRef.current?.focus();
      } else if (failure === 'mismatch') {
        setProblem({ kind: 'mismatch' });
        emailRef.current?.focus();
      } else {
        // Not an input error: the fields stay as they are and so does the focus.
        setProblem({ kind: 'notice', failure });
      }
    } finally {
      setLoading(false);
    }
  };

  const emailInvalid = problem.kind === 'mismatch' || (problem.kind === 'input' && !!problem.email);
  const passwordInvalid =
    problem.kind === 'mismatch' || (problem.kind === 'input' && !!problem.password);
  const emailMessage =
    problem.kind === 'mismatch'
      ? COPY.mismatch
      : problem.kind === 'notice'
        ? COPY[problem.failure]
        : problem.kind === 'input' && problem.email
          ? COPY.email[problem.email]
          : null;
  const passwordMessage =
    problem.kind === 'input' && problem.password ? COPY.password.required : null;

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

            <form onSubmit={submit} className="mt-7" noValidate>
              {/*
                A rejected pair marks both fields and speaks once, under the
                e-mail, so it never says which of the two was wrong (920:3885).
              */}
              <Field label="Имейл" invalid={emailInvalid} message={emailMessage}>
                <EnvelopeSimple
                  size={20}
                  className={`shrink-0 ${emailInvalid ? 'text-status-urgent' : email ? 'text-ink' : 'text-ink-faint'}`}
                />
                <input
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    edit('email', { email: e.target.value, password });
                  }}
                  placeholder="name@company.bg"
                  aria-invalid={emailInvalid || undefined}
                  className={INPUT}
                />
              </Field>

              <div className="mt-[18px]">
                <Field label="Парола" invalid={passwordInvalid} message={passwordMessage}>
                  <Lock
                    size={20}
                    className={`shrink-0 ${passwordInvalid ? 'text-status-urgent' : password ? 'text-ink' : 'text-ink-faint'}`}
                  />
                  <input
                    ref={passwordRef}
                    type={reveal ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      edit('password', { email, password: e.target.value });
                    }}
                    placeholder="••••••••••"
                    aria-invalid={passwordInvalid || undefined}
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

/**
 * V2/Field (906:487): overline label, the pill, and a message under it.
 * `invalid` is State=error — the red edge; a message can also stand alone,
 * for a notice that is not the field's fault.
 */
function Field({
  label,
  invalid = false,
  message,
  children,
}: {
  label: string;
  invalid?: boolean;
  message?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-overline-12 font-semibold text-ink-muted uppercase">{label}</span>
      <span
        className="glass-field flex items-center gap-3 px-[18px] py-[15px]"
        data-invalid={invalid ? 'true' : undefined}
      >
        {children}
      </span>
      {message && (
        <span role="alert" className="flex gap-1.5 pt-0.5 pl-0.5 text-body-13-tight text-ink">
          <TriangleAlert size={14} className="mt-px shrink-0 text-status-urgent" />
          {message}
        </span>
      )}
    </label>
  );
}

type Problem =
  | { kind: 'none' }
  | { kind: 'input'; email?: LoginFieldError; password?: 'required' }
  | { kind: 'mismatch' }
  | { kind: 'notice'; failure: 'throttled' | 'unavailable' };

const NO_PROBLEM: Problem = { kind: 'none' };

/** Wording agreed with the design session on 24.09; 401's is the frame's own. */
const COPY = {
  email: {
    required: 'Въведете имейл адреса си.',
    invalid: 'Въведете валиден имейл адрес, например name@company.bg.',
  },
  password: { required: 'Въведете паролата си.' },
  mismatch: 'Имейлът или паролата не съвпадат.',
  // auth-service lets five sign-ins through per minute (AUTH_THROTTLE_STRICT).
  throttled: 'Твърде много опити. Опитайте отново след минута.',
  unavailable: 'Няма връзка със сървъра. Опитайте отново.',
} as const;
