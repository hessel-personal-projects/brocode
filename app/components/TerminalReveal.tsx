'use client'

import { motion } from 'framer-motion'

export function TerminalReveal({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden flex-1 flex flex-col">
      <motion.div
        aria-hidden="true"
        className="absolute left-0 right-0 h-0.5 pointer-events-none"
        style={{
          background: 'var(--color-phosphor)',
          boxShadow: '0 0 16px 4px var(--color-phosphor)',
          zIndex: 50,
        }}
        initial={{ top: 0 }}
        animate={{ top: '100%' }}
        transition={{ duration: 0.4, ease: 'linear' }}
      />
      <motion.div
        className="flex-1 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.2 }}
      >
        {children}
      </motion.div>
    </div>
  )
}
