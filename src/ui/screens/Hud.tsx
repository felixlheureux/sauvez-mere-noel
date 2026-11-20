import { Bell, Crosshair, MousePointerClick } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { sound } from "@/audio/Sound";
import type { ScreenPoint } from "@/core/Game";
import { BUFF_TEXT, CONTROLS, SPEAKERS, T, WEAPON_NAMES } from "@/i18n/fr-QC";
import { Badge } from "@/ui/components/badge";
import { Kbd } from "@/ui/components/kbd";
import { Portrait } from "@/ui/components/Portrait";
import { useGame } from "@/ui/GameContext";
import { useStore } from "@/ui/store";

function HealthBar() {
  const hp = useStore((s) => s.hp);
  const max = useStore((s) => s.maxHp);
  const pct = Math.max(0, hp / max);
  return (
    <div className="flex items-center gap-3">
      <div className="text-outline-sm text-2xl font-bold text-white">♥</div>
      <div className="relative h-7 w-56 overflow-hidden rounded-full border-4 border-white bg-night/40 shadow-chunky">
        <motion.div
          className={`h-full rounded-full ${pct < 0.3 ? "animate-pulse" : ""} candy-stripes`}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
        />
        <span className="text-outline-sm absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
          {Math.ceil(hp)}
        </span>
      </div>
    </div>
  );
}

function Bells() {
  const bells = useStore((s) => s.bells);
  const total = useStore((s) => s.bellsTotal);
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 shadow-chunky">
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size list of bell slots
        <motion.span key={i} animate={i < bells ? { scale: [1.6, 1], rotate: [20, 0] } : {}}>
          <Bell
            className={`size-6 ${i < bells ? "fill-accent text-accent-foreground" : "text-muted-foreground/50"}`}
          />
        </motion.span>
      ))}
    </div>
  );
}

function Candies() {
  const n = useStore((s) => s.candies);
  const total = useStore((s) => s.candiesTotal);
  if (!total) return null;
  return (
    <motion.div
      key={n}
      initial={{ scale: n ? 1.25 : 1 }}
      animate={{ scale: 1 }}
      className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 font-bold text-foreground shadow-chunky"
    >
      <span className="inline-block h-4 w-6 rounded-full bg-[radial-gradient(circle,#ff8fbf_45%,#e2384d_46%,#e2384d_60%,#fff_61%)]" />
      {n}/{total}
    </motion.div>
  );
}

const BUFF_STYLE = {
  rage: "bg-primary text-white",
  speed: "bg-candy text-foreground",
  shield: "bg-sky-300 text-foreground",
} as const;

function Buffs() {
  const buffs = useStore((s) => s.buffs);
  const active = (["rage", "speed", "shield"] as const).filter((k) => buffs[k] > 0);
  return (
    <div className="flex gap-2">
      <AnimatePresence>
        {active.map((k) => (
          <motion.div
            key={k}
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            className={`flex items-center gap-1.5 rounded-full border-2 border-white px-3 py-0.5 text-sm font-bold shadow-chunky ${BUFF_STYLE[k]} ${
              k !== "shield" && buffs[k] <= 3 ? "animate-pulse" : ""
            }`}
          >
            {BUFF_TEXT[k].short}
            <span className="tabular-nums">{k === "shield" ? `×${buffs[k]}` : `${buffs[k]}s`}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function RageTint() {
  const rage = useStore((s) => s.buffs.rage);
  if (rage <= 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle,transparent_60%,rgba(255,60,60,0.25)_100%)]" />
  );
}

/** Speed lines while sliding on the snow tube. */
function SpeedLines() {
  const riding = useStore((s) => s.riding);
  return (
    <AnimatePresence>
      {riding && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0.35, 0.6, 0.35],
            scale: [1, 1.04, 1],
            transition: { duration: 0.35, repeat: Number.POSITIVE_INFINITY },
          }}
          // Its own (finite) transition: inheriting the endless pulse, the exit never ended
          // and the lines stayed on screen after the slide.
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          className="pointer-events-none absolute inset-0 bg-[repeating-conic-gradient(from_0deg,rgba(255,255,255,0.55)_0deg_0.6deg,transparent_0.6deg_9deg)] [mask-image:radial-gradient(circle,transparent_42%,black_80%)]"
        />
      )}
    </AnimatePresence>
  );
}

/** The boss's health bar, under the objective. */
function BossBar() {
  const boss = useStore((s) => s.boss);
  return (
    <AnimatePresence>
      {boss && (
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          className="mt-3 flex w-[28rem] flex-col items-center gap-1"
        >
          <div className="text-outline-sm text-lg font-bold tracking-wide text-white">
            {boss.name}
            {boss.phase > 1 && (
              <span className="ml-2 text-sm text-red-200">· phase {boss.phase}</span>
            )}
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-full border-4 border-white bg-night/50 shadow-chunky">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-red-700 via-red-500 to-orange-400"
              animate={{ width: `${Math.max(0, boss.hp / boss.max) * 100}%` }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
            />
            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/70" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Objective waypoint: a glowing diamond with the distance over the target, or an
 * arrow pinned to the screen edge pointing the way when it's off screen.
 * Positioned straight from the game each frame (no React re-render).
 */
function ObjectiveMarker() {
  const game = useGame();
  const ref = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el || !game) return;
      const s = game.objectiveScreen();
      if (!s) {
        el.style.opacity = "0";
        return;
      }
      const { x, y, onScreen, angle } = pinToScreen(s);
      el.style.opacity = "1";
      el.style.transform = `translate(${x}px, ${y}px)`;
      if (label.current) label.current.textContent = `${Math.round(s.dist)} m`;
      if (arrow.current) {
        arrow.current.style.opacity = onScreen ? "0" : "1";
        arrow.current.style.transform = `rotate(${angle}rad) translateX(26px)`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [game]);
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute top-0 left-0 opacity-0 transition-opacity"
      style={{ willChange: "transform" }}
    >
      <div className="relative -translate-x-1/2 -translate-y-1/2">
        <div ref={arrow} className="absolute top-1/2 left-1/2 -mt-2 -ml-2 size-4">
          <div className="size-0 border-y-[10px] border-l-[18px] border-y-transparent border-l-accent drop-shadow" />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="size-7 rotate-45 animate-pulse rounded-md border-[3px] border-white bg-accent shadow-[0_0_18px_6px_rgba(255,201,74,0.75)]" />
          <span
            ref={label}
            className="text-outline-sm mt-1 rounded-full bg-night/70 px-2 text-sm font-bold text-white"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * A screen point, or — when it's off screen or behind the camera — pinned to the screen
 * edge in its direction (with the angle for an arrow).
 */
function pinToScreen(s: ScreenPoint, m = 56) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  let { x, y } = s;
  const onScreen = s.ahead && x > m && x < W - m && y > m && y < H - m;
  let angle = 0;
  if (!onScreen) {
    // Direction from screen centre; behind the camera, flip it.
    let dx = x - W / 2;
    let dy = y - H / 2;
    if (!s.ahead) {
      dx = -dx;
      dy = Math.abs(dy) + H;
    }
    angle = Math.atan2(dy, dx);
    const k = Math.min(
      (W / 2 - m) / Math.abs(Math.cos(angle) || 1e-6),
      (H / 2 - m) / Math.abs(Math.sin(angle) || 1e-6),
    );
    x = W / 2 + Math.cos(angle) * k;
    y = H / 2 + Math.sin(angle) * k;
  }
  return { x, y, onScreen, angle };
}

/**
 * The last few enemies, once they've been hard to find for a while: a red marker over
 * each, or an arrow at the screen edge pointing to it.
 */
function StragglerMarkers() {
  const game = useGame();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const marks = game?.stragglerScreens() ?? [];
      refs.current.forEach((el, i) => {
        if (!el) return;
        const s = marks[i];
        if (!s) {
          el.style.opacity = "0";
          return;
        }
        const { x, y, onScreen, angle } = pinToScreen(s, 40);
        el.style.opacity = "1";
        el.style.transform = `translate(${x}px, ${y}px)`;
        const arrow = el.firstElementChild as HTMLElement | null;
        if (arrow) {
          arrow.style.opacity = onScreen ? "0" : "1";
          arrow.style.transform = `rotate(${angle}rad) translateX(20px)`;
        }
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [game]);
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="pointer-events-none absolute top-0 left-0 opacity-0 transition-opacity"
          style={{ willChange: "transform" }}
        >
          <div className="absolute -mt-2 -ml-2 size-4">
            <div className="size-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-red-500 drop-shadow" />
          </div>
          <div className="-translate-x-1/2 -translate-y-full animate-bounce">
            <div className="size-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-red-500 drop-shadow-[0_0_6px_rgba(255,40,60,0.9)]" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Hostile elves left: helps find the last straggler of a wave. */
function EnemiesLeft() {
  const n = useStore((s) => s.enemiesLeft);
  const boss = useStore((s) => s.boss);
  if (n <= 0 || boss) return null;
  return (
    <motion.div
      key={n}
      initial={{ scale: 1.2 }}
      animate={{ scale: 1 }}
      className="mt-2 rounded-full bg-night/70 px-3 py-0.5 text-sm font-semibold text-white shadow-chunky"
    >
      {n} {n > 1 ? "lutins possédés" : "lutin possédé"}
    </motion.div>
  );
}

function Objective() {
  const objective = useStore((s) => s.objective);
  return (
    <AnimatePresence mode="wait">
      {objective && (
        <motion.div
          key={objective}
          initial={{ y: -20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="rounded-full border-4 border-white bg-secondary px-5 py-1.5 text-lg font-semibold text-white shadow-chunky"
        >
          ★ {objective}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Combo() {
  const combo = useStore((s) => s.combo);
  const at = useStore((s) => s.comboAt);
  return (
    <AnimatePresence>
      {combo >= 2 && (
        <motion.div
          key={at}
          initial={{ scale: 1.8, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: -6, opacity: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          className="text-outline absolute top-1/3 right-10 text-5xl font-bold text-accent"
        >
          COMBO x{combo}
          {combo >= 3 && <div className="text-3xl text-primary">AYOYE!</div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Weapon() {
  const weapon = useStore((s) => s.weapon);
  const owned = useStore((s) => s.weapons);
  if (!weapon) return null;
  return (
    <motion.div
      key={weapon}
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="flex items-center gap-3 rounded-2xl border-4 border-white bg-night/80 px-4 py-2 text-white shadow-chunky"
    >
      <span className="text-sm text-white/70">Arme</span>
      <span className="text-lg font-bold">{WEAPON_NAMES[weapon] ?? weapon}</span>
      {weapon !== "fists" && <span className="text-xl font-bold text-accent">∞</span>}
      {owned.length > 1 && (
        <span className="ml-1 flex gap-1">
          {owned.map((w, i) => (
            <span
              key={w}
              title={WEAPON_NAMES[w]}
              className={`flex size-6 items-center justify-center rounded-md text-xs font-bold ${w === weapon ? "bg-accent text-accent-foreground" : "bg-white/15 text-white/70"}`}
            >
              {i + 1}
            </span>
          ))}
        </span>
      )}
    </motion.div>
  );
}

function ControlsPanel() {
  const tier = useStore((s) => s.controlsTier);
  const isNew = useStore((s) => s.controlsNew);
  const show = useStore((s) => s.showControls);
  const pointerLocked = useStore((s) => s.pointerLocked);
  const [collapsed, setCollapsed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-open the panel when new controls unlock
  useEffect(() => {
    setCollapsed(false);
    const t = window.setTimeout(() => {
      setCollapsed(true);
      useStore.setState({ controlsNew: false });
    }, 14000);
    return () => window.clearTimeout(t);
  }, [tier]);
  if (!show) return null;
  const rows = [
    // Once you have a gun, left click shoots (punching moves to right click).
    ...CONTROLS.basic
      .filter((c) => tier < 1 || c.keys[0] !== "Clic gauche")
      .map((c) => ({ ...c, fresh: false })),
    ...(tier >= 1 ? CONTROLS.combat.map((c) => ({ ...c, fresh: isNew })) : []),
  ];
  return (
    // One fixed width, collapsed or not: resizing it (a layout animation) squashed and
    // clipped the labels while it opened.
    <motion.div
      className="w-[21.5rem] rounded-2xl border-4 border-white bg-white/90 p-3 text-foreground shadow-chunky"
      onClick={() => setCollapsed((c) => !c)}
    >
      <div className="flex items-center justify-between gap-6">
        <span className="font-bold">{T.controls}</span>
        {tier >= 1 && isNew && <Badge>{T.newBadge}</Badge>}
        {!pointerLocked && (
          <span className="text-xs text-muted-foreground">{collapsed ? "▸" : "▾"}</span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 flex flex-col gap-1.5 overflow-hidden"
          >
            {rows.map((r) => (
              <motion.li
                key={r.label + r.keys.join()}
                initial={r.fresh ? { x: -30, opacity: 0 } : false}
                animate={{ x: 0, opacity: 1 }}
                className={`flex items-center gap-2 rounded-lg px-1 text-sm ${r.fresh ? "bg-accent/40" : ""}`}
              >
                <span className="flex w-[8.5rem] shrink-0 gap-1">
                  {r.keys.map((k) => (
                    <Kbd key={k} className="whitespace-nowrap">
                      {k}
                    </Kbd>
                  ))}
                </span>
                <span className="whitespace-nowrap">{r.label}</span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DialogueBox() {
  const game = useGame();
  const line = useStore((s) => s.dialogue);
  const id = useStore((s) => s.dialogueId);
  const skip = useStore((s) => s.dialogueSkip);
  // Blocking cutscene lines get the big box; tips during gameplay stay small.
  const big = useStore((s) => s.letterbox);
  const blocking = useStore((s) => s.dialogueBlocking);
  const tipDuration = useStore((s) => s.tipDuration);
  const [shown, setShown] = useState(0);
  const skipRef = useRef(skip);

  // biome-ignore lint/correctness/useExhaustiveDependencies: restart typing for every new line id
  useEffect(() => {
    if (!line) return;
    setShown(0);
    useStore.setState({ dialogueTyped: false });
    const speaker = SPEAKERS[line.speaker];
    let i = 0;
    const timer = window.setInterval(() => {
      i++;
      setShown(i);
      if (i % 2 === 0 && line.text[i] !== " ") sound.bip(speaker.pitch);
      if (i >= line.text.length) {
        window.clearInterval(timer);
        useStore.setState({ dialogueTyped: true });
      }
    }, 28);
    return () => window.clearInterval(timer);
  }, [line, id]);

  useEffect(() => {
    if (skip !== skipRef.current && line) {
      skipRef.current = skip;
      setShown(line.text.length);
      useStore.setState({ dialogueTyped: true });
    }
  }, [skip, line]);

  return (
    <AnimatePresence>
      {line && (
        <motion.div
          key={id}
          initial={{ y: 40, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.35 }}
          className={`absolute left-1/2 flex -translate-x-1/2 cursor-pointer items-start gap-4 border-4 border-white bg-card/95 shadow-[0_8px_0_0_rgba(58,35,64,0.4)] ${
            big
              ? "bottom-[13vh] w-[min(92vw,46rem)] rounded-[1.75rem] p-4 pr-6"
              : "bottom-24 w-[min(80vw,30rem)] rounded-3xl p-2.5 pr-5"
          }`}
          onClick={() => game?.advanceDialogue()}
        >
          <Portrait
            speaker={line.speaker}
            className={`${big ? "size-20" : "size-12"} shrink-0 drop-shadow`}
          />
          <div className="min-w-0 flex-1">
            <span
              className="inline-block rounded-full px-3 py-0.5 text-sm font-bold text-white"
              style={{ background: SPEAKERS[line.speaker].color }}
            >
              {SPEAKERS[line.speaker].name}
            </span>
            <p className={`mt-1.5 leading-snug text-foreground ${big ? "text-xl" : "text-base"}`}>
              {line.text.slice(0, shown)}
              <span className="opacity-0">{line.text.slice(shown)}</span>
            </p>
            <div className="mt-1.5 flex justify-end">
              <motion.span
                animate={{ opacity: blocking && shown >= line.text.length ? [1, 0.4, 1] : 0.7 }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1 }}
              >
                <Kbd className="h-5 min-w-0 px-1.5 text-[11px]">Entrée</Kbd>
              </motion.span>
            </div>
          </div>
          {!blocking && (
            // Tips move on by themselves: a draining bar shows it.
            <motion.div
              key={`bar${id}`}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: tipDuration, ease: "linear" }}
              className="absolute inset-x-6 bottom-1.5 h-1 origin-left rounded-full bg-primary/35"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="absolute top-24 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ y: -20, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={
              t.kind === "bark"
                ? "rounded-2xl rounded-bl-none border-4 border-white bg-white/95 px-4 py-1.5 text-lg font-semibold text-foreground shadow-chunky"
                : "flex flex-col items-center rounded-2xl border-4 border-white bg-accent px-6 py-2 text-accent-foreground shadow-chunky"
            }
          >
            <span
              className={t.kind === "bark" ? "" : "text-sm font-bold uppercase tracking-widest"}
            >
              {t.title}
            </span>
            {t.body && <span className="text-2xl font-bold">{t.body}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function TitleCard() {
  const card = useStore((s) => s.titleCard);
  return (
    <AnimatePresence>
      {card && (
        <motion.div
          initial={{ x: "-110%" }}
          animate={{ x: 0 }}
          exit={{ x: "110%", opacity: 0 }}
          transition={{ type: "spring", bounce: 0.25, duration: 0.7 }}
          className="pointer-events-none absolute top-[30vh] left-0 right-0 flex justify-center"
        >
          <div className="candy-stripes rounded-[2rem] p-2 shadow-[0_10px_0_0_rgba(0,0,0,0.3)]">
            <div className="rounded-[1.5rem] bg-white px-10 py-4 text-center">
              <div className="text-lg font-bold tracking-[0.3em] text-primary uppercase">
                Niveau {card.num}
              </div>
              <div className="text-4xl font-bold text-foreground">{card.name}</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface Splat {
  id: number;
  x: number;
  y: number;
  size: number;
  rot: number;
  shape: number;
}

/** Blob outlines (100×100 viewBox); drips and droplets are added around them. */
const SPLAT_SHAPES = [
  "M60 10 C80 5 95 25 88 45 C100 55 90 75 72 70 C70 90 45 95 40 78 C20 85 5 65 20 52 C5 40 20 20 38 28 C40 12 52 5 60 10Z",
  "M50 14 C62 4 74 18 70 30 C86 26 96 42 82 52 C94 64 80 80 66 72 C62 90 40 92 38 76 C22 84 8 70 18 58 C4 48 14 30 30 34 C28 22 40 10 50 14Z",
  "M46 18 C58 8 80 14 78 32 C92 40 88 60 74 62 C78 78 60 86 50 76 C38 88 18 80 24 64 C10 58 12 38 28 36 C26 24 36 16 46 18Z",
];

/** A spot on the screen's outer band: blood never covers the middle, where you aim. */
function edgeSpot(id: number, size: number): Splat {
  const a = Math.random() * Math.PI * 2;
  const r = 0.9 + Math.random() * 0.12;
  return {
    id,
    x: 50 + Math.cos(a) * 46 * r,
    y: 50 + Math.sin(a) * 46 * r,
    size: 12 + size * 14 + Math.random() * 4,
    rot: Math.random() * 360,
    shape: Math.floor(Math.random() * SPLAT_SHAPES.length),
  };
}

/** Blood on the "lens" when an enemy bursts nearby: edges only, at most 4, gone in ~2 s. */
function BloodSplatter() {
  const at = useStore((s) => s.bloodSplat);
  const size = useStore((s) => s.splatSize);
  const [splats, setSplats] = useState<Splat[]>([]);
  const last = useRef(0);
  useEffect(() => {
    if (!at || at - last.current < 300) return;
    last.current = at;
    const fresh = Array.from({ length: 1 + Math.round(size * 2) }, (_, i) =>
      edgeSpot(at + i, size),
    );
    setSplats((s) => [...s, ...fresh].slice(-4));
    // Not cleared on the next splat: each one goes on its own schedule.
    setTimeout(() => setSplats((s) => s.filter((x) => !fresh.includes(x))), 2300);
  }, [at, size]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {splats.map((p) => (
        <motion.svg
          key={p.id}
          viewBox="0 0 100 130"
          aria-hidden="true"
          initial={{ opacity: 0.9, scale: 0.5 }}
          animate={{ opacity: [0.9, 0.85, 0], scale: [0.5, 1, 1.02] }}
          transition={{ duration: 2.2, times: [0, 0.08, 1], ease: "easeIn" }}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}vh`,
            height: `${p.size * 1.3}vh`,
            translate: "-50% -40%",
            rotate: `${p.rot}deg`,
          }}
        >
          <path d={SPLAT_SHAPES[p.shape]} fill="#7a0014" />
          <path d={SPLAT_SHAPES[p.shape]} fill="#a3001c" transform="translate(12 12) scale(0.76)" />
          <rect x="34" y="70" width="5" height="40" rx="2.5" fill="#7a0014" />
          <rect x="58" y="72" width="4" height="28" rx="2" fill="#7a0014" />
          <circle cx="36.5" cy="111" r="4" fill="#7a0014" />
          <circle cx="12" cy="20" r="4" fill="#7a0014" />
          <circle cx="92" cy="18" r="3" fill="#7a0014" />
          <circle cx="94" cy="96" r="2.5" fill="#7a0014" />
        </motion.svg>
      ))}
    </div>
  );
}

function HurtOverlay() {
  const hurtAt = useStore((s) => s.hurtAt);
  const dir = useStore((s) => s.hurtDir);
  const hp = useStore((s) => s.hp);
  return (
    <>
      <AnimatePresence>
        <motion.div
          key={hurtAt}
          initial={{ opacity: hurtAt ? 0.8 : 0 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(200,0,30,0.65)_100%)]"
        />
      </AnimatePresence>
      {hp < 30 && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle,transparent_55%,rgba(160,0,20,0.45)_100%)]" />
      )}
      {dir !== null && hurtAt > 0 && (
        <motion.div
          key={`d${hurtAt}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9 }}
          className="pointer-events-none absolute top-1/2 left-1/2 h-0 w-0"
          style={{ transform: `rotate(${dir}rad)` }}
        >
          <div className="absolute -top-[22vh] -left-6 h-0 w-0 border-x-[24px] border-b-[36px] border-x-transparent border-b-red-600/80" />
        </motion.div>
      )}
    </>
  );
}

function ClickToPlay() {
  const locked = useStore((s) => s.pointerLocked);
  const game = useGame();
  if (locked) return null;
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute top-[38%] left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border-4 border-white bg-primary px-6 py-3 text-xl font-bold text-white shadow-chunky"
      onClick={() => game?.input.requestPointerLock()}
    >
      <MousePointerClick /> {T.clickToPlay}
    </motion.button>
  );
}

/** Debug mode: frame stats, read straight from the game twice a second. */
function PerfOverlay() {
  const game = useGame();
  const [text, setText] = useState("");
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!game) return;
      const p = game.perf;
      setText(
        `${p.fps.toFixed(0)} fps (pire ${p.worstMs.toFixed(0)} ms) · logique ${p.logicMs.toFixed(1)} ms · rendu ${p.renderMs.toFixed(1)} ms · GPU ${p.gpuMs.toFixed(1)} ms · ${p.drawCalls.toFixed(0)} draws · ${p.meshes} meshes · échelle ${p.scale.toFixed(2)}`,
      );
    }, 500);
    return () => window.clearInterval(id);
  }, [game]);
  return (
    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 font-mono text-white text-xs">
      {text}
    </div>
  );
}

export function Hud() {
  const crosshair = useStore((s) => s.crosshair);
  const letterbox = useStore((s) => s.letterbox);
  const killAt = useStore((s) => s.killAt);
  const levelName = useStore((s) => s.levelName);
  const levelId = useStore((s) => s.levelId);
  const playing = useStore((s) => s.screen === "playing");
  const debug = useStore((s) => s.settings.debug);

  return (
    <div className="pointer-events-none fixed inset-0">
      <HurtOverlay />
      <BloodSplatter />
      <AnimatePresence>
        {letterbox && (
          <>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "11vh" }}
              exit={{ height: 0 }}
              className="absolute inset-x-0 top-0 bg-black"
            />
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "11vh" }}
              exit={{ height: 0 }}
              className="absolute inset-x-0 bottom-0 bg-black"
            />
          </>
        )}
      </AnimatePresence>
      {!letterbox && playing && (
        <>
          <RageTint />
          <SpeedLines />
          <ObjectiveMarker />
          <StragglerMarkers />
          <div className="absolute top-5 left-5 flex flex-col gap-2">
            <HealthBar />
            <Buffs />
            <span className="text-outline-sm text-sm font-bold text-white">
              Niveau {levelId} · {levelName}
            </span>
          </div>
          <div className="absolute top-5 right-5 flex flex-col items-end gap-2">
            <Bells />
            <Candies />
          </div>
          <div className="absolute top-5 left-1/2 flex -translate-x-1/2 flex-col items-center">
            <Objective />
            <EnemiesLeft />
            <BossBar />
          </div>
          <div className="absolute right-5 bottom-5">
            <Weapon />
          </div>
          <div className="pointer-events-auto absolute bottom-5 left-5">
            <ControlsPanel />
          </div>
          {crosshair && (
            <motion.div
              key={killAt}
              initial={{ scale: killAt ? 1.8 : 1, rotate: killAt ? 45 : 0 }}
              animate={{ scale: 1, rotate: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
            >
              <Crosshair className="size-7" strokeWidth={2.5} />
            </motion.div>
          )}
          <Combo />
          <div className="pointer-events-auto">
            <ClickToPlay />
          </div>
        </>
      )}
      <TitleCard />
      <Toasts />
      {playing && (
        <div className="pointer-events-auto">
          <DialogueBox />
        </div>
      )}
      {playing && debug && <PerfOverlay />}
    </div>
  );
}
