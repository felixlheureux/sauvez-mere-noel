import { useMemo } from "react";

/** Lightweight CSS snowfall for menus. */
export function Snowfall({ count = 40, className = "" }: { count?: number; className?: string }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 4 + Math.random() * 8,
        duration: 7 + Math.random() * 9,
        delay: -Math.random() * 16,
        drift: `${(Math.random() - 0.5) * 120}px`,
        opacity: 0.5 + Math.random() * 0.5,
      })),
    [count],
  );
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {flakes.map((f) => (
        <span
          key={f.id}
          className="absolute -top-4 animate-fall rounded-full bg-white"
          style={
            {
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
              "--drift": f.drift,
              filter: "blur(0.5px)",
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
