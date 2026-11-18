import { motion } from "motion/react";
import { T } from "@/i18n/fr-QC";
import { Snowfall } from "@/ui/components/Snowfall";
import { useStore } from "@/ui/store";

/** A gift that bounces, wiggles and unwraps while the scene is built. */
export function LoadingScreen() {
  const loading = useStore((s) => s.loading);
  const label = useStore((s) => s.loadingLabel);
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#ffd6ea_0%,#c9b6ff_45%,#2b1d3f_100%)]"
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
    >
      <Snowfall count={50} />
      <motion.div
        className="relative mb-10"
        animate={{ y: [0, -28, 0], rotate: [0, -6, 6, 0] }}
        transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      >
        <svg width="150" height="150" viewBox="0 0 120 120" aria-hidden="true">
          <motion.g
            animate={{ y: [0, -8, 0], rotate: [0, -8, 0] }}
            transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY }}
            style={{ originX: "60px", originY: "48px" }}
          >
            <rect x="14" y="36" width="92" height="20" rx="5" fill="#ff5a6e" />
            <rect x="52" y="36" width="16" height="20" fill="#ffc94a" />
            <path d="M60 36 C40 10 26 26 46 36 Z" fill="#ffc94a" />
            <path d="M60 36 C80 10 94 26 74 36 Z" fill="#ffc94a" />
          </motion.g>
          <rect x="20" y="56" width="80" height="54" rx="6" fill="#e2384d" />
          <rect x="52" y="56" width="16" height="54" fill="#ffc94a" />
          <circle cx="40" cy="80" r="3" fill="#fff" opacity="0.7" />
          <circle cx="84" cy="92" r="2.5" fill="#fff" opacity="0.7" />
        </svg>
        <motion.div
          className="absolute -bottom-4 left-1/2 h-3 w-24 -translate-x-1/2 rounded-full bg-night/30 blur-sm"
          animate={{ scaleX: [1, 0.6, 1] }}
          transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY }}
        />
      </motion.div>
      <h1 className="text-outline mb-6 text-5xl font-bold text-white">{T.title}</h1>
      <div className="h-7 w-[min(80vw,26rem)] overflow-hidden rounded-full border-4 border-white bg-white/40 shadow-chunky">
        {/* The fill only changes width; the stripes inside scroll on their own (CSS),
            anchored to its left edge, so progress never restarts or jumps them. */}
        <div
          className="relative h-full overflow-hidden rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(6, loading * 100)}%` }}
        >
          <div className="candy-stripes candy-scroll absolute inset-y-0 left-0 w-[calc(100%+40px)]" />
        </div>
      </div>
      <motion.p
        key={label}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 text-lg font-medium text-white drop-shadow"
      >
        {label || T.loading}
      </motion.p>
    </motion.div>
  );
}
