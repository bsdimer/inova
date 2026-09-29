import { motion } from 'framer-motion';
import { Hammer } from '../components/icons';

/**
 * A section of the menu that is not built yet. It says so in plain words: the
 * milestone that brings it is a plan code and stays in main.tsx (design.md →
 * Words).
 */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass flex min-h-[60vh] flex-col items-center justify-center gap-4 p-10 text-center"
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-3xl text-ink-soft"
        style={{
          background: 'var(--glass-inner)',
          boxShadow: 'inset 0 0 0 0.0625rem var(--glass-edge-soft)',
        }}
      >
        <Hammer size="1.625rem" />
      </span>
      <h1 className="text-title-22 font-medium">{title}</h1>
      <p className="max-w-sm text-sm text-ink-muted">Разделът още не е наличен.</p>
    </motion.div>
  );
}
