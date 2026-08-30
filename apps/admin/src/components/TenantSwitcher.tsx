import { AnimatePresence, motion } from 'framer-motion';
import { Building, Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { setSelectedTenantId, useSelectedTenantId, useTenantOptions } from '../lib/tenant';

/** Sidebar dropdown to pick the active tenant (drives X-Tenant-Id). */
export function TenantSwitcher() {
  const selectedId = useSelectedTenantId();
  const { options, isLoading } = useTenantOptions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // super_admin has no memberships — default to the first platform tenant.
  useEffect(() => {
    const first = options[0];
    if (!selectedId && first) setSelectedTenantId(first.id);
  }, [selectedId, options]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = options.find((o) => o.id === selectedId);

  return (
    <div ref={ref} className="relative mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl bg-white/8 px-3.5 py-3 text-left transition-colors hover:bg-white/12"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-purple">
          <Building size={15} className="text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-white">
            {selected?.name ?? (isLoading ? 'Loading…' : 'Select tenant')}
          </span>
          <span className="block truncate text-xs text-white/45">
            {selected ? selected.key : 'organization'}
          </span>
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-white/40" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl bg-navy-deep p-1.5 shadow-xl shadow-black/40 ring-1 ring-white/10"
          >
            {options.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-white/45">No tenants available</li>
            )}
            {options.map((option) => (
              <li key={option.id}>
                <button
                  onClick={() => {
                    setSelectedTenantId(option.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-white/80 transition-colors hover:bg-white/8 hover:text-white"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.name}</span>
                    <span className="block truncate text-xs font-normal text-white/40">
                      {option.key}
                    </span>
                  </span>
                  {option.id === selectedId && (
                    <Check size={15} className="shrink-0 text-brand-green" />
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
