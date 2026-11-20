import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { sound } from "@/audio/Sound";
import { Game } from "@/core/Game";
import { GameContext } from "./GameContext";
import { Hud } from "./screens/Hud";
import { LoadingScreen } from "./screens/LoadingScreen";
import { ComingSoon, Ending, GameOver, LevelComplete, PauseMenu } from "./screens/Menus";
import { ScreenGate, useScreenGate } from "./screens/ScreenGate";
import { TitleScreen } from "./screens/TitleScreen";
import { WorldMap } from "./screens/WorldMap";
import { useStore } from "./store";

// Created once, even if React (StrictMode) runs effects twice in dev.
let gamePromise: Promise<Game> | null = null;

export function App() {
  const [game, setGame] = useState<Game | null>(null);
  const screen = useStore((s) => s.screen);
  const fade = useStore((s) => s.fade);
  const gate = useScreenGate();

  useEffect(() => {
    const canvas = document.getElementById("game") as HTMLCanvasElement;
    let cancelled = false;
    const started = performance.now();
    gamePromise ??= Game.create(canvas, (p, label) =>
      useStore.setState({ loading: p, loadingLabel: label }),
    );
    gamePromise
      .then(async (g) => {
        // Let the loading animation breathe a little.
        const wait = Math.max(0, 1400 - (performance.now() - started));
        await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;
        setGame(g);
        // Handy for debugging from the browser console.
        Object.assign(window, { game: g, store: useStore, sound });
        useStore.setState({ screen: "title" });
      })
      .catch((err) => {
        console.error(err);
        useStore.setState({ loadingLabel: "Oups! WebGL n'est pas disponible sur cet appareil." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inGame =
    screen === "playing" ||
    screen === "paused" ||
    screen === "levelComplete" ||
    screen === "gameOver";

  return (
    <GameContext.Provider value={game}>
      {inGame && <Hud />}
      <AnimatePresence mode="wait">
        {screen === "loading" && <LoadingScreen key="loading" />}
        {screen === "title" && <TitleScreen key="title" />}
        {screen === "map" && <WorldMap key="map" />}
        {screen === "paused" && <PauseMenu key="paused" />}
        {screen === "levelComplete" && <LevelComplete key="complete" />}
        {screen === "gameOver" && <GameOver key="over" />}
        {screen === "comingSoon" && <ComingSoon key="soon" />}
        {screen === "ending" && <Ending key="ending" />}
      </AnimatePresence>
      <AnimatePresence>
        {gate.blocked && <ScreenGate key="gate" touchOnly={gate.touchOnly} />}
      </AnimatePresence>
      <motion.div
        className="pointer-events-none fixed inset-0 bg-night"
        animate={{ opacity: fade }}
        transition={{ duration: 0.4 }}
        initial={false}
      />
    </GameContext.Provider>
  );
}
