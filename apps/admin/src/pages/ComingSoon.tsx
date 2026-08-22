import { motion } from 'framer-motion';
import { Hammer } from 'lucide-react';

export function ComingSoonPage({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue/15 to-brand-green/15"
      >
        <Hammer size={28} className="text-brand-blue" />
      </motion.div>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="max-w-sm text-sm text-ink-secondary">
        This module arrives in milestone {milestone} of the implementation plan.
      </p>
    </div>
  );
}
