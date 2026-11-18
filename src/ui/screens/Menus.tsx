import { Home, Map as MapIcon, Play, RotateCcw, Settings, Sparkles, Star } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { CONTROLS, LEVELS_META, T } from "@/i18n/fr-QC";
import { Button } from "@/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/components/card";
import { Kbd } from "@/ui/components/kbd";
import { Snowfall } from "@/ui/components/Snowfall";
import { useGame } from "@/ui/GameContext";
import { useStore } from "@/ui/store";
import { CreditsDialog } from "./CreditsDialog";
import { OptionsDialog } from "./OptionsDialog";

function Backdrop({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <motion.div
      className={`fixed inset-0 flex items-center justify-center p-4 backdrop-blur-[3px] ${dark ? "bg-blood/40" : "bg-night/55"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Snowfall count={20} />
      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.45 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function PauseMenu() {
  const game = useGame();
  const tier = useStore((s) => s.controlsTier);
  const [options, setOptions] = useState(false);
  // Same rule as the in-game panel: once you hold a weapon, left click attacks with it.
  const controls = [
    ...CONTROLS.basic.filter((c) => tier < 1 || c.keys[0] !== "Clic gauche"),
    ...(tier >= 1 ? CONTROLS.combat : []),
  ];
  return (
    <Backdrop>
      <Card className="w-[min(94vw,46rem)]">
        <CardHeader>
          <CardTitle className="text-center text-4xl">{T.paused}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="lg" onClick={() => game?.resume()}>
            <Play className="fill-current" /> {T.resume}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setOptions(true)}>
              <Settings /> {T.options}
            </Button>
            <Button variant="outline" onClick={() => void game?.restartLevel()}>
              <RotateCcw /> Recommencer
            </Button>
          </div>
          <Button variant="ghost" onClick={() => game?.quitToTitle()}>
            <Home /> {T.quit}
          </Button>
          <div className="mt-2 rounded-2xl bg-muted p-4">
            <p className="mb-2 font-bold">{T.controls}</p>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {controls.map((c) => (
                <li key={c.label + c.keys.join()} className="flex items-center gap-2 text-sm">
                  {/* Same layout as the in-game panel: a fixed key column, labels on one line. */}
                  <span className="flex w-[7.5rem] shrink-0 gap-1">
                    {c.keys.map((k) => (
                      <Kbd key={k} className="whitespace-nowrap">
                        {k}
                      </Kbd>
                    ))}
                  </span>
                  <span className="whitespace-nowrap">{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        <OptionsDialog open={options} onOpenChange={setOptions} />
      </Card>
    </Backdrop>
  );
}

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function LevelComplete() {
  const game = useGame();
  const stats = useStore((s) => s.stats);
  const mapUnlocked = useStore((s) => s.progress.mapUnlocked);
  if (!stats) return null;
  return (
    <Backdrop>
      <Card className="w-[min(92vw,30rem)] text-center">
        <CardHeader className="items-center">
          <CardDescription className="font-bold tracking-[0.25em] text-primary uppercase">
            Niveau {stats.levelId} · {LEVELS_META[stats.levelId]?.name}
          </CardDescription>
          <CardTitle className="text-4xl">{T.levelComplete}</CardTitle>
          <div className="mt-3 flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3 + i * 0.25, type: "spring", bounce: 0.6 }}
              >
                <Star
                  className={`size-14 ${i < stats.stars ? "fill-accent text-accent-foreground" : "text-muted"}`}
                  strokeWidth={1.5}
                />
              </motion.span>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <p className="-mt-1 mb-3 text-xs text-muted-foreground">
            ★ Niveau fini · ★ Toutes les cloches · ★ 75 % des bonbons
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              [T.kills, String(stats.kills)],
              [T.time, fmtTime(stats.time)],
              [T.bells, `${stats.bells}/${stats.bellsTotal}`],
              [T.candies, `${stats.candies}/${stats.candiesTotal}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-muted px-2 py-3">
                <div className="text-2xl font-bold">{v}</div>
                <div className="text-sm text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
          {stats.levelId === 0 && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="mt-4 rounded-2xl bg-accent/40 px-3 py-2 font-semibold"
            >
              🗺️ {T.mapUnlocked}
            </motion.p>
          )}
        </CardContent>
        <CardFooter className="flex-col">
          <Button size="lg" className="w-full" onClick={() => game?.nextLevel()}>
            {mapUnlocked ? <MapIcon /> : <Play className="fill-current" />}
            {mapUnlocked ? T.map : T.next}
          </Button>
          <Button variant="ghost" onClick={() => void game?.restartLevel()}>
            <RotateCcw /> Rejouer
          </Button>
        </CardFooter>
      </Card>
    </Backdrop>
  );
}

export function GameOver() {
  const game = useGame();
  return (
    <Backdrop dark>
      <Card className="w-[min(92vw,28rem)] text-center">
        <CardHeader className="items-center">
          <motion.div
            animate={{ rotate: [-6, 6, -6] }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.4 }}
            className="text-6xl"
          >
            🎅💫
          </motion.div>
          <CardTitle className="text-5xl text-primary">{T.gameOver}</CardTitle>
          <CardDescription className="text-lg">{T.gameOverSub}</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col">
          <Button size="lg" className="w-full" onClick={() => void game?.retryFromCheckpoint()}>
            <RotateCcw /> {T.tryAgain}
          </Button>
          <Button variant="ghost" onClick={() => game?.quitToTitle()}>
            <Home /> {T.quit}
          </Button>
        </CardFooter>
      </Card>
    </Backdrop>
  );
}

/** After the last level: Christmas is saved. */
export function Ending() {
  const game = useGame();
  const [credits, setCredits] = useState(false);
  return (
    <Backdrop>
      <Card className="w-[min(92vw,32rem)] text-center">
        <CardHeader className="items-center gap-2">
          <motion.div
            animate={{ y: [0, -12, 0], rotate: [-4, 4, -4] }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.6 }}
            className="text-7xl"
          >
            🎄
          </motion.div>
          <CardTitle className="text-5xl text-primary">{T.endingTitle}</CardTitle>
          <CardDescription className="text-lg">{T.endingBody}</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => setCredits(true)}>
            <Sparkles /> {T.endingCredits}
          </Button>
          <Button variant="ghost" onClick={() => game?.quitToTitle()}>
            <Home /> {T.quit}
          </Button>
        </CardFooter>
      </Card>
      <CreditsDialog open={credits} onOpenChange={setCredits} />
    </Backdrop>
  );
}

export function ComingSoon() {
  const game = useGame();
  return (
    <Backdrop>
      <Card className="w-[min(92vw,28rem)] text-center">
        <CardHeader className="items-center">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.2 }}
            className="text-6xl"
          >
            🎁
          </motion.div>
          <CardTitle>{T.comingSoon}</CardTitle>
          <CardDescription>Les lutins sont encore en train de l'emballer.</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col">
          <Button className="w-full" onClick={() => useStore.setState({ screen: "map" })}>
            <MapIcon /> {T.map}
          </Button>
          <Button variant="ghost" onClick={() => game?.quitToTitle()}>
            <Home /> {T.quit}
          </Button>
        </CardFooter>
      </Card>
    </Backdrop>
  );
}
