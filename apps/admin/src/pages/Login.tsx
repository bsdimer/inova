import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Eye, EyeOff, LoaderCircle, Lock, Mail } from '../components/icons';
import { useState, type FormEvent } from 'react';
import { AppBackground } from '../components/AppBackground';
import { InovaWordmark } from '../components/Logo';
import { ErrorNote } from '../components/ui';
import { login } from '../lib/auth';

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
      <div className="app-content flex min-h-full flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="glass-data w-full max-w-sm p-7 sm:p-8"
        >
          <div className="text-ink">
            <InovaWordmark size={20} />
          </div>

          <h1 className="mt-7 text-2xl font-semibold tracking-tight">Добре дошли отново</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Влезте, за да управлявате портфолиото си.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold tracking-wider text-ink-muted uppercase">
                Имейл
              </span>
              <span className="glass-control flex items-center gap-3 rounded-xl px-3.5 py-3">
                <Mail size={16} className="shrink-0 text-ink-faint" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.bg"
                  className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-faint"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold tracking-wider text-ink-muted uppercase">
                Парола
              </span>
              <span className="glass-control flex items-center gap-3 rounded-xl px-3.5 py-3">
                <Lock size={16} className="shrink-0 text-ink-faint" />
                <input
                  type={reveal ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-faint"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Скрий паролата' : 'Покажи паролата'}
                  className="shrink-0 rounded-full p-0.5 text-ink-faint transition-colors hover:text-ink"
                >
                  {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setRecovery(true)}
                className="text-xs font-medium text-ink-muted underline underline-offset-4 transition-colors hover:text-ink"
              >
                Забравена парола?
              </button>
            </div>

            {/*
              TODO(M1): public password recovery (B14). The screen offers the
              link because the mock-up does, but auth-service has no recovery
              endpoint yet, so it says who can help instead of pretending.
            */}
            {recovery && (
              <p className="rounded-xl px-3.5 py-2.5 text-xs text-ink-soft" style={GLASS_NOTE}>
                Възстановяването на парола още не е налично. Свържете се с администратора на
                организацията, който може да изпрати нов код за активиране.
              </p>
            )}

            <ErrorNote message={error} />

            <button
              type="submit"
              disabled={loading}
              className="cta flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-opacity disabled:opacity-60"
            >
              {loading ? <LoaderCircle size={18} className="animate-spin" /> : 'Влез'}
            </button>
          </form>
        </motion.div>

        <p className="mt-6 text-xs text-ink-faint">Общност за жилищни сгради и квартали.</p>
      </div>
    </>
  );
}

const GLASS_NOTE = {
  background: 'var(--glass-chip)',
  boxShadow: 'inset 0 0 0 1px var(--glass-edge-soft)',
} as const;
