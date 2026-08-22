import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { SosedoMark, SosedoWordmark } from '../components/Logo';
import { login } from '../lib/auth';

const TAGLINE: Array<{ word: string; dot: string }> = [
  { word: 'Together', dot: 'text-brand-blue' },
  { word: 'Better', dot: 'text-brand-green' },
  { word: 'Home', dot: 'text-brand-purple' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      void navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-navy to-navy-soft lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-blue opacity-25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-24 -left-24 h-80 w-80 rounded-full bg-brand-purple opacity-20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 right-10 h-64 w-64 rounded-full bg-brand-green opacity-20 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4"
        >
          <SosedoMark size={48} />
          <SosedoWordmark size={22} />
        </motion.div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex gap-3 text-3xl font-semibold tracking-wide text-white"
          >
            {TAGLINE.map(({ word, dot }, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.35 + i * 0.15 }}
              >
                {word}
                <span className={`font-extrabold ${dot}`}>.</span>
              </motion.span>
            ))}
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="max-w-md text-lg leading-relaxed text-white/60"
          >
            The admin panel for professional property managers — buildings, fees, payments,
            issues and neighbors in one calm place.
          </motion.p>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-sm text-white/40"
        >
          Community management for apartment buildings and neighborhoods.
        </motion.p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="mb-10 flex flex-col items-start gap-4 lg:hidden">
            <SosedoMark size={48} />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-ink-secondary">Sign in to manage your portfolio.</p>

          <form onSubmit={submit} className="mt-10 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold tracking-wider text-ink-secondary uppercase">
                Email
              </span>
              <div className="group flex items-center gap-3 rounded-2xl border-2 border-navy/10 bg-white px-4 py-3.5 shadow-sm transition-all focus-within:border-brand-blue focus-within:shadow-lg focus-within:shadow-brand-blue/10">
                <Mail size={18} className="text-ink-secondary" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.bg"
                  className="w-full bg-transparent font-medium outline-none placeholder:text-ink-secondary/50"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold tracking-wider text-ink-secondary uppercase">
                Password
              </span>
              <div className="flex items-center gap-3 rounded-2xl border-2 border-navy/10 bg-white px-4 py-3.5 shadow-sm transition-all focus-within:border-brand-blue focus-within:shadow-lg focus-within:shadow-brand-blue/10">
                <Lock size={18} className="text-ink-secondary" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full bg-transparent font-medium outline-none placeholder:text-ink-secondary/50"
                />
              </div>
            </label>

            <div className="flex justify-end">
              <button type="button" className="text-sm font-semibold text-brand-blue hover:underline">
                Forgot password?
              </button>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-sm font-semibold text-red-500"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-blue to-brand-green py-4 font-bold text-white shadow-lg shadow-brand-blue/25 transition-shadow hover:shadow-xl hover:shadow-brand-blue/30 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
