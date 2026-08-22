import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Building2,
  TrendingUp,
  Wrench,
} from 'lucide-react';

// Mock data until the reports API lands (M9).
const STATS = [
  {
    label: 'Outstanding',
    value: '12 480 лв',
    delta: '-4.2%',
    up: false,
    icon: Banknote,
    tint: 'text-brand-blue bg-brand-blue/10',
  },
  {
    label: 'Collected this month',
    value: '38 950 лв',
    delta: '+12.8%',
    up: true,
    icon: TrendingUp,
    tint: 'text-brand-green bg-brand-green/10',
  },
  {
    label: 'Open issues',
    value: '17',
    delta: '+3',
    up: false,
    icon: Wrench,
    tint: 'text-brand-purple bg-brand-purple/10',
  },
  {
    label: 'Buildings',
    value: '24',
    delta: '+1',
    up: true,
    icon: Building2,
    tint: 'text-navy bg-navy/10',
  },
] as const;

const RECENT_PAYMENTS = [
  { id: 'p1', resident: 'Maria Ivanova', building: 'Iztok 24 · Apt 12', amount: '86.40 лв', method: 'Bank transfer', time: 'Today 14:05' },
  { id: 'p2', resident: 'Georgi Petrov', building: 'Mladost 7 · Apt 3', amount: '54.00 лв', method: 'Cash', time: 'Today 11:42' },
  { id: 'p3', resident: 'Elena Dimitrova', building: 'Iztok 24 · Apt 8', amount: '112.20 лв', method: 'Bank transfer', time: 'Yesterday' },
  { id: 'p4', resident: 'Stefan Kolev', building: 'Center 3 · Apt 21', amount: '73.60 лв', method: 'Bank transfer', time: 'Yesterday' },
] as const;

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Cross-portfolio overview — mock data until the reports API ships (M9).
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map(({ label, value, delta, up, icon: Icon, tint }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.07 }}
            className="rounded-2xl bg-white p-5 shadow-sm shadow-navy/5 transition-shadow hover:shadow-md hover:shadow-navy/10"
          >
            <div className="flex items-center justify-between">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
                <Icon size={20} />
              </span>
              <span
                className={`flex items-center gap-0.5 text-xs font-bold ${
                  up ? 'text-brand-green' : 'text-ink-secondary'
                }`}
              >
                {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {delta}
              </span>
            </div>
            <p className="mt-4 text-2xl font-extrabold tracking-tight">{value}</p>
            <p className="mt-0.5 text-sm font-medium text-ink-secondary">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent payments */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
        className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-navy/5"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="font-bold">Recent payments</h2>
          <button className="text-sm font-semibold text-brand-blue hover:underline">
            View all
          </button>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-navy/8 bg-mist/60 text-xs font-semibold tracking-wider text-ink-secondary uppercase">
              <th className="px-6 py-3">Resident</th>
              <th className="px-6 py-3">Apartment</th>
              <th className="px-6 py-3">Method</th>
              <th className="px-6 py-3">When</th>
              <th className="px-6 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_PAYMENTS.map((p) => (
              <tr
                key={p.id}
                className="border-b border-navy/5 transition-colors last:border-0 hover:bg-mist/40"
              >
                <td className="px-6 py-3.5 font-semibold">{p.resident}</td>
                <td className="px-6 py-3.5 text-ink-secondary">{p.building}</td>
                <td className="px-6 py-3.5 text-ink-secondary">{p.method}</td>
                <td className="px-6 py-3.5 text-ink-secondary">{p.time}</td>
                <td className="px-6 py-3.5 text-right font-bold">{p.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
