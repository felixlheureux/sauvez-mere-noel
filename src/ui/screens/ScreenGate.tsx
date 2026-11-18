import { Monitor } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { T } from "@/i18n/fr-QC";
import { Card, CardDescription, CardHeader, CardTitle } from "@/ui/components/card";
import { Kbd } from "@/ui/components/kbd";
import { Snowfall } from "@/ui/components/Snowfall";
import { useGame } from "@/ui/GameContext";
import { useStore } from "@/ui/store";

/** The game needs a keyboard, a mouse and a wide enough window. */
export const MIN_WIDTH = 960;
export const MIN_HEIGHT = 540;

function check() {
  const touchOnly =
    window.matchMedia("(pointer: coarse)").matches &&
    !window.matchMedia("(any-pointer: fine)").matches;
  const tooSmall = window.innerWidth < MIN_WIDTH || window.innerHeight < MIN_HEIGHT;
  return { touchOnly, tooSmall, blocked: touchOnly || tooSmall };
}

export function useScreenGate() {
  const [state, setState] = useState(check);
  useEffect(() => {
    const update = () => setState(check());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return state;
}

export function ScreenGate({ touchOnly }: { touchOnly: boolean }) {
  const game = useGame();
  const screen = useStore((s) => s.screen);
  // Pause the game while the window is too small.
  useEffect(() => {
    if (screen === "playing") game?.pause();
  }, [screen, game]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#ffd6ea_0%,#c9b6ff_45%,#2b1d3f_100%)] p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Snowfall count={30} />
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.45 }}
      >
        <Card className="w-[min(90vw,26rem)] text-center">
          <CardHeader className="items-center gap-3">
            <motion.div
              animate={{ rotate: [-6, 6, -6] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.6 }}
              className="flex size-20 items-center justify-center rounded-full bg-primary text-white shadow-chunky"
            >
              <Monitor className="size-10" />
            </motion.div>
            <CardTitle className="text-2xl">{T.tooSmallTitle}</CardTitle>
            <CardDescription className="text-base">
              {touchOnly ? T.tooSmallTouch : T.tooSmallBody}
            </CardDescription>
            {!touchOnly && (
              <p className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-muted-foreground">
                Minimum{" "}
                <Kbd>
                  {MIN_WIDTH} × {MIN_HEIGHT}
                </Kbd>{" "}
                · actuellement{" "}
                <Kbd>
                  {window.innerWidth} × {window.innerHeight}
                </Kbd>
              </p>
            )}
          </CardHeader>
        </Card>
      </motion.div>
    </motion.div>
  );
}
