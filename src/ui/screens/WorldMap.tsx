import { ArrowLeft, Lock, Skull, Star } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { LEVELS_META, T } from "@/i18n/fr-QC";
import { IMPLEMENTED_LEVELS } from "@/levels";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { Snowfall } from "@/ui/components/Snowfall";
import { useGame } from "@/ui/GameContext";
import { useStore } from "@/ui/store";

/** Node positions on the 1000×600 map, from the cute village to the nightmare. */
const NODES: [number, number][] = [
  [90, 500],
  [200, 430],
  [310, 488],
  [400, 385],
  [300, 290],
  [430, 205],
  [575, 250],
  [670, 345],
  [800, 300],
  [860, 190],
  [935, 92],
];

function pathThrough(points: [number, number][]) {
  let d = `M ${points[0]?.[0]} ${points[0]?.[1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1] as [number, number];
    const [x1, y1] = points[i] as [number, number];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2 - 25;
    d += ` Q ${mx} ${my} ${x1} ${y1}`;
  }
  return d;
}

function Pine({ x, y, s = 1, dark = false }: { x: number; y: number; s?: number; dark?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3" y="0" width="6" height="8" fill={dark ? "#3a2230" : "#8a5a3b"} />
      <path d="M0 -34 L16 -8 L-16 -8Z M0 -24 L20 4 L-20 4Z" fill={dark ? "#2a1a2a" : "#2f9e6a"} />
      {!dark && <path d="M0 -34 L6 -24 L-6 -24Z" fill="#fff" />}
    </g>
  );
}

function House({ x, y, dark = false }: { x: number; y: number; dark?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-14" y="-14" width="28" height="18" fill={dark ? "#4a2a2a" : "#c9813f"} />
      <path d="M-18 -12 L0 -30 L18 -12Z" fill={dark ? "#2b1010" : "#ff8fbf"} />
      <rect x="-4" y="-6" width="8" height="10" fill={dark ? "#ff2238" : "#ffd88a"} />
    </g>
  );
}

export function WorldMap() {
  const game = useGame();
  const progress = useStore((s) => s.progress);
  const [hover, setHover] = useState<number | null>(null);
  const current = Math.min(progress.unlocked, 10);
  const info = LEVELS_META[hover ?? current];
  const rec = progress.records[hover ?? current];

  const play = (id: number) => {
    if (id > progress.unlocked) return;
    if (!IMPLEMENTED_LEVELS.includes(id)) {
      useStore.setState({ screen: "comingSoon" });
      return;
    }
    void game?.loadLevel(id);
  };

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-night/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Snowfall count={25} />
      <div className="flex w-[min(64rem,100%)] items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => game?.quitToTitle()}>
          <ArrowLeft /> Menu
        </Button>
        <h1 className="text-outline text-4xl font-bold text-white">{T.map}</h1>
        <div className="w-24" />
      </div>
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.35 }}
        className="relative aspect-[5/3] w-[min(64rem,100%,calc((100vh-14rem)*5/3))] shrink-0 overflow-hidden rounded-[2rem] border-[6px] border-white shadow-[0_12px_0_0_rgba(0,0,0,0.35)]"
      >
        <svg
          viewBox="0 0 1000 600"
          className="block h-auto w-full"
          role="img"
          aria-label="Carte des niveaux"
        >
          <defs>
            <linearGradient id="mapSky" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#ffe3f1" />
              <stop offset="0.35" stopColor="#c7e3ff" />
              <stop offset="0.6" stopColor="#8a6aa8" />
              <stop offset="0.85" stopColor="#5a1a2e" />
              <stop offset="1" stopColor="#1a0610" />
            </linearGradient>
            <radialGradient id="ice" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#e8f6ff" />
              <stop offset="1" stopColor="#9fd6ff" />
            </radialGradient>
          </defs>
          <rect width="1000" height="600" fill="url(#mapSky)" />
          {/* Snowy hills */}
          <path
            d="M0 540 Q 180 470 360 540 T 720 520 T 1000 500 V600 H0Z"
            fill="#ffffff"
            opacity="0.9"
          />
          <path d="M0 600 Q 250 520 500 580 T 1000 560 V600Z" fill="#eef4ff" />
          {/* Regions */}
          <House x={60} y={470} />
          <House x={120} y={480} />
          <Pine x={30} y={520} />
          <Pine x={240} y={470} s={0.8} />
          <rect x="170" y="395" width="40" height="22" rx="4" fill="#ff8fbf" />
          <Pine x={280} y={520} />
          <Pine x={335} y={510} s={1.2} />
          <Pine x={355} y={470} s={0.9} />
          <path
            d="M370 410 Q 400 330 450 360"
            stroke="#fff"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="270" y="300" width="34" height="22" fill="#8a5a3b" />
          <path d="M266 302 L287 284 L308 302Z" fill="#5e3a26" />
          <ellipse
            cx="430"
            cy="215"
            rx="70"
            ry="26"
            fill="url(#ice)"
            stroke="#fff"
            strokeWidth="3"
          />
          <House x={545} y={270} dark />
          <House x={600} y={262} dark />
          <rect x="640" y="340" width="54" height="30" fill="#5e3a26" />
          <path d="M636 342 L667 320 L698 342Z" fill="#3a1a1a" />
          <rect x="770" y="300" width="50" height="26" fill="#4a2a2a" />
          <path d="M830 220 L860 140 L890 220Z" fill="#a3172b" opacity="0.7" />
          <path d="M900 120 L935 50 L970 120Z" fill="#1d0a12" />
          <Pine x={960} y={150} dark />
          <Pine x={905} y={150} dark s={0.8} />
          {/* Path */}
          <path
            d={pathThrough(NODES)}
            stroke="#3a2340"
            strokeOpacity="0.35"
            strokeWidth="16"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={pathThrough(NODES)}
            stroke="#fff"
            strokeWidth="7"
            strokeDasharray="2 16"
            fill="none"
            strokeLinecap="round"
          />
          {/* Nodes */}
          {NODES.map(([x, y], id) => {
            const meta = LEVELS_META[id];
            const unlocked = id <= progress.unlocked;
            const done = Boolean(progress.records[id]);
            const boss = Boolean(meta && "boss" in meta && meta.boss);
            const r = boss ? 30 : 23;
            const fill = done ? "#ffc94a" : unlocked ? "#ffffff" : "#8a8199";
            return (
              // biome-ignore lint/a11y/useSemanticElements: SVG nodes can't be <button>s
              <g
                // biome-ignore lint/suspicious/noArrayIndexKey: one node per level id
                key={id}
                transform={`translate(${x} ${y})`}
                className={unlocked ? "cursor-pointer" : "cursor-not-allowed"}
                onMouseEnter={() => setHover(id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => play(id)}
                onKeyDown={(e) => e.key === "Enter" && play(id)}
                tabIndex={unlocked ? 0 : -1}
                role="button"
                aria-label={meta?.name}
              >
                {id === current && (
                  <circle r={r + 10} fill="none" stroke="#fff" strokeWidth="4" opacity="0.8">
                    <animate
                      attributeName="r"
                      values={`${r + 4};${r + 14};${r + 4}`}
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.9;0.1;0.9"
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle r={r} fill={fill} stroke={boss ? "#a3172b" : "#3a2340"} strokeWidth="5" />
                <text
                  y="8"
                  textAnchor="middle"
                  fontSize="22"
                  fontWeight="700"
                  fill="#3a2340"
                  fontFamily="Fredoka"
                >
                  {unlocked ? id : ""}
                </text>
              </g>
            );
          })}
        </svg>
        {/* Overlay icons (lucide) positioned in % so they scale with the SVG */}
        {NODES.map(([x, y], id) => {
          const unlocked = id <= progress.unlocked;
          const meta = LEVELS_META[id];
          const boss = Boolean(meta && "boss" in meta && meta.boss);
          const stars = progress.records[id]?.stars ?? 0;
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: one overlay per level id
              key={`ov${id}`}
              className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${x / 10}%`, top: `${y / 6}%` }}
            >
              {!unlocked && <Lock className="size-5 -translate-y-1/2 text-white" />}
              {boss && <Skull className="absolute -top-14 size-7 text-primary drop-shadow" />}
              {stars > 0 && (
                <div className="absolute top-6 flex gap-0.5">
                  {[0, 1, 2].map((s) => (
                    <Star
                      key={s}
                      className={`size-4 ${s < stars ? "fill-accent text-accent" : "text-white/70"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Santa marker */}
        <motion.div
          className="pointer-events-none absolute text-4xl"
          animate={{
            left: `${(NODES[current]?.[0] ?? 0) / 10}%`,
            top: `${(NODES[current]?.[1] ?? 0) / 6 - 14}%`,
            y: [0, -8, 0],
          }}
          transition={{
            y: { duration: 1, repeat: Number.POSITIVE_INFINITY },
            default: { type: "spring" },
          }}
          style={{ translateX: "-50%" }}
        >
          🎅
        </motion.div>
      </motion.div>
      <div className="flex min-h-20 w-[min(64rem,100%)] items-center justify-between gap-4 rounded-2xl bg-white/90 px-6 py-3 shadow-chunky">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={(hover ?? current) >= 5 ? "dark" : "mint"}>
              Niveau {hover ?? current}
            </Badge>
            {info && "boss" in info && info.boss && <Badge>Boss</Badge>}
            {!IMPLEMENTED_LEVELS.includes(hover ?? current) && (
              <Badge variant="muted">Bientôt</Badge>
            )}
          </div>
          <p className="mt-1 text-xl font-bold text-foreground">{info?.name}</p>
          {rec && (
            <p className="text-sm text-muted-foreground">
              Meilleur temps {Math.round(rec.bestTime)} s · {rec.bells}/3 cloches
            </p>
          )}
        </div>
        <Button
          onClick={() => play(hover ?? current)}
          disabled={(hover ?? current) > progress.unlocked}
        >
          {T.play}
        </Button>
      </div>
    </motion.div>
  );
}
