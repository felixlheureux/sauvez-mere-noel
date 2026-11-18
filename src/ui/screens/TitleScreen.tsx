import { Map as MapIcon, Play, Settings, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { LEVELS_META, T } from "@/i18n/fr-QC";
import { IMPLEMENTED_LEVELS } from "@/levels";
import { Button } from "@/ui/components/button";
import { Snowfall } from "@/ui/components/Snowfall";
import { useGame } from "@/ui/GameContext";
import { useStore } from "@/ui/store";
import { CreditsDialog } from "./CreditsDialog";
import { OptionsDialog } from "./OptionsDialog";

const letters = (s: string) => s.split("");

export function TitleScreen() {
  const game = useGame();
  const progress = useStore((s) => s.progress);
  const [options, setOptions] = useState(false);
  const [credits, setCredits] = useState(false);
  // Older saves may not have a resume point.
  const resume = progress.resume ?? null;
  const started = progress.unlocked > 0 || (resume !== null && resume.checkpoint > 0);
  const resumeMeta = resume ? LEVELS_META[resume.levelId] : null;

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-between bg-gradient-to-b from-night/10 via-transparent to-night/50 py-[7vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Snowfall count={30} />
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
          className="text-outline text-[clamp(2.5rem,7vw,5rem)] leading-none font-bold text-white"
        >
          {letters("Sauvez").map((c, i) => (
            <motion.span
              // biome-ignore lint/suspicious/noArrayIndexKey: static letters of the logo
              key={`a${i}`}
              className="inline-block"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.6, delay: i * 0.08, repeat: Number.POSITIVE_INFINITY }}
            >
              {c}
            </motion.span>
          ))}
        </motion.div>
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.55, delay: 0.3 }}
          className="text-outline -mt-1 text-[clamp(3.5rem,11vw,8rem)] leading-none font-bold text-primary"
        >
          Mère Noël!
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-3 rounded-full bg-white/85 px-5 py-1.5 text-lg font-medium text-foreground shadow-chunky"
        >
          {T.tagline}
        </motion.p>
      </div>

      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
      >
        <Button
          size="lg"
          className="animate-float"
          onClick={() => {
            // Pick up exactly where the save says: level + checkpoint.
            if (resume && IMPLEMENTED_LEVELS.includes(resume.levelId))
              void game?.loadLevel(resume.levelId, resume.checkpoint);
            else if (progress.mapUnlocked) useStore.setState({ screen: "map" });
            else void game?.loadLevel(0);
          }}
        >
          <Play className="fill-current" />
          {started ? T.continue : T.play}
        </Button>
        {started && resumeMeta && (
          <p className="-mt-1 rounded-full bg-white/85 px-4 py-1 text-sm font-semibold text-foreground shadow-chunky">
            Niveau {resumeMeta.id} · {resumeMeta.name}
            {resume && resume.checkpoint > 0 ? ` · lanterne ${resume.checkpoint}` : ""}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {progress.mapUnlocked && (
            <Button variant="secondary" onClick={() => useStore.setState({ screen: "map" })}>
              <MapIcon /> {T.map}
            </Button>
          )}
          <Button variant="outline" onClick={() => setOptions(true)}>
            <Settings /> {T.options}
          </Button>
          <Button variant="outline" onClick={() => setCredits(true)}>
            <Sparkles /> {T.credits}
          </Button>
        </div>
        <p className="mt-2 text-sm font-medium text-white/90 drop-shadow">
          Défi Festive.js · AGEEI 2026
        </p>
      </motion.div>
      <OptionsDialog open={options} onOpenChange={setOptions} />
      <CreditsDialog open={credits} onOpenChange={setCredits} />
    </motion.div>
  );
}
