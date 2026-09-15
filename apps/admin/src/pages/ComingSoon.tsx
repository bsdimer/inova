import { motion } from 'framer-motion';
import { Hammer } from 'lucide-react';

export function ComingSoonPage({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14 }}
        className="flex h-16 w-16 items-center justify-center rounded-3xl border border-orange/15 bg-gradient-to-br from-orange/15 to-orange-bright/5 shadow-lg shadow-orange/10"
      >
        <Hammer size={28} className="text-orange" />
      </motion.div>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="max-w-sm text-sm text-landmark">
        This module arrives in milestone {milestone} of the implementation plan.
      </p>
    </div>
  );
}
