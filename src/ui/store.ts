import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Line } from "../i18n/fr-QC";

export type Screen =
  | "loading"
  | "title"
  | "map"
  | "playing"
  | "paused"
  | "levelComplete"
  | "gameOver"
  | "comingSoon"
  | "ending";

export interface LevelRecord {
  stars: number;
  bells: number;
  candies?: number;
  bestTime: number;
}

export interface Toast {
  id: number;
  title: string;
  body?: string;
  kind: "weapon" | "info" | "bark";
}

export interface LevelStats {
  levelId: number;
  kills: number;
  time: number;
  bells: number;
  bellsTotal: number;
  candies: number;
  candiesTotal: number;
  stars: number;
}

interface Settings {
  confetti: boolean;
  sensitivity: number;
  /** Master volume, 0–1. */
  volume: number;
  musicVolume: number;
  invertY: boolean;
  music: boolean;
  /** Test mode: jump to any level / checkpoint from Options. */
  debug: boolean;
}

interface Progress {
  /** Highest level that can be played. */
  unlocked: number;
  /** World map becomes available after finishing level 0. */
  mapUnlocked: boolean;
  records: Record<number, LevelRecord>;
  /** Where "Continuer" picks up: a level and a checkpoint inside it. */
  resume: { levelId: number; checkpoint: number } | null;
}

/** HUD + menu state. The game writes to it; React reads from it. */
interface HudState {
  screen: Screen;
  loading: number;
  loadingLabel: string;
  levelId: number;
  levelName: string;
  hp: number;
  maxHp: number;
  weapon: string | null;
  /** Guns owned, in slot order (1, 2, …). */
  weapons: string[];
  objective: string;
  bells: number;
  bellsTotal: number;
  candies: number;
  candiesTotal: number;
  /** Seconds left (rage, speed) and hits left (shield). */
  buffs: { rage: number; speed: number; shield: number };
  combo: number;
  comboAt: number;
  hurtAt: number;
  hurtDir: number | null;
  killAt: number;
  dialogue: Line | null;
  dialogueId: number;
  dialogueSkip: number;
  dialogueTyped: boolean;
  /** Cutscene line that waits for the player (vs. a tip that moves on by itself). */
  dialogueBlocking: boolean;
  tipDuration: number;
  titleCard: { num: number; name: string } | null;
  toasts: Toast[];
  /** 0 = movement only, 1 = combat controls shown. */
  controlsTier: number;
  controlsNew: boolean;
  showControls: boolean;
  crosshair: boolean;
  pointerLocked: boolean;
  bloodSplat: number;
  /** How big the last splat is, 0–1 (1 = a kill right in Santa's face). */
  splatSize: number;
  stats: LevelStats | null;
  letterbox: boolean;
  /** On the snow tube: the HUD draws speed lines. */
  riding: boolean;
  /** Boss health bar (null when no boss is fighting). */
  boss: { name: string; hp: number; max: number; phase: number } | null;
  /** Hostile elves still standing (0 hides the counter). */
  enemiesLeft: number;
  fade: number;
}

interface Store extends HudState {
  settings: Settings;
  progress: Progress;
  setSettings: (s: Partial<Settings>) => void;
  completeLevel: (id: number, rec: LevelRecord) => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dropToast: (id: number) => void;
  setResume: (levelId: number, checkpoint: number) => void;
  resetProgress: () => void;
}

let toastId = 0;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      screen: "loading",
      loading: 0,
      loadingLabel: "",
      levelId: 0,
      levelName: "",
      hp: 100,
      maxHp: 100,
      weapon: null,
      weapons: [],
      objective: "",
      bells: 0,
      bellsTotal: 3,
      candies: 0,
      candiesTotal: 0,
      buffs: { rage: 0, speed: 0, shield: 0 },
      combo: 0,
      comboAt: 0,
      hurtAt: 0,
      hurtDir: null,
      killAt: 0,
      dialogue: null,
      dialogueId: 0,
      dialogueSkip: 0,
      dialogueTyped: false,
      dialogueBlocking: false,
      tipDuration: 4,
      titleCard: null,
      toasts: [],
      controlsTier: 0,
      controlsNew: false,
      showControls: true,
      crosshair: false,
      pointerLocked: false,
      bloodSplat: 0,
      splatSize: 0,
      stats: null,
      letterbox: false,
      riding: false,
      boss: null,
      enemiesLeft: 0,
      fade: 0,
      settings: {
        confetti: false,
        sensitivity: 1,
        volume: 0.75,
        musicVolume: 0.75,
        invertY: false,
        music: true,
        debug: false,
      },
      progress: { unlocked: 0, mapUnlocked: false, records: {}, resume: null },
      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      completeLevel: (id, rec) => {
        const p = get().progress;
        const old = p.records[id];
        const best: LevelRecord = old
          ? {
              stars: Math.max(old.stars, rec.stars),
              bells: Math.max(old.bells, rec.bells),
              bestTime: Math.min(old.bestTime, rec.bestTime),
            }
          : rec;
        set({
          progress: {
            unlocked: Math.max(p.unlocked, id + 1),
            mapUnlocked: p.mapUnlocked || id >= 0,
            records: { ...p.records, [id]: best },
            resume: { levelId: id + 1, checkpoint: 0 },
          },
        });
      },
      pushToast: (t) => {
        const id = ++toastId;
        set({ toasts: [...get().toasts, { ...t, id }].slice(-3) });
        window.setTimeout(() => get().dropToast(id), t.kind === "bark" ? 1800 : 3200);
      },
      dropToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      setResume: (levelId, checkpoint) =>
        set({ progress: { ...get().progress, resume: { levelId, checkpoint } } }),
      resetProgress: () =>
        set({ progress: { unlocked: 0, mapUnlocked: false, records: {}, resume: null } }),
    }),
    {
      name: "sauvez-mere-noel",
      version: 3,
      // Saves from version 1 had no `resume` field, and before 3 no music volume.
      migrate: (state) => {
        const s = state as { progress?: Progress; settings?: Settings };
        if (s.progress) s.progress = { ...s.progress, resume: s.progress.resume ?? null };
        if (s.settings) s.settings = { ...s.settings, musicVolume: s.settings.musicVolume ?? 0.75 };
        return s as never;
      },
      partialize: (s) => ({ settings: s.settings, progress: s.progress }),
    },
  ),
);

export const hud = {
  get: () => useStore.getState(),
  set: (s: Partial<HudState>) => useStore.setState(s),
};
