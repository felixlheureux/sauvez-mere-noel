import { LEVELS_META, T } from "@/i18n/fr-QC";
import { IMPLEMENTED_LEVELS } from "@/levels";
import { Button } from "@/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/dialog";
import { Slider } from "@/ui/components/slider";
import { Switch } from "@/ui/components/switch";
import { useGame } from "@/ui/GameContext";
import { useStore } from "@/ui/store";

export function OptionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const game = useGame();
  const settings = useStore((s) => s.settings);
  const set = (patch: Partial<typeof settings>) => {
    useStore.getState().setSettings(patch);
    game?.applySettings();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogTitle>{T.options}</DialogTitle>
        <DialogDescription className="sr-only">Réglages du jeu</DialogDescription>
        <div className="mt-5 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-semibold">{T.optConfetti} 🎉</span>
              <span className="text-sm text-muted-foreground">{T.optConfettiHint}</span>
            </span>
            <Switch
              aria-label={T.optConfetti}
              checked={settings.confetti}
              onCheckedChange={(v) => set({ confetti: v })}
            />
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-semibold">{T.optSensitivity}</span>
            <Slider
              min={0.3}
              max={2.5}
              step={0.05}
              value={[settings.sensitivity]}
              onValueChange={([v]) => set({ sensitivity: v ?? 1 })}
            />
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-semibold">{T.optVolume}</span>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[settings.volume]}
              onValueChange={([v]) => set({ volume: v ?? 0.8 })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{T.optMusic}</span>
            <Switch
              aria-label={T.optMusic}
              checked={settings.music}
              onCheckedChange={(v) => set({ music: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{T.optInvert}</span>
            <Switch
              aria-label={T.optInvert}
              checked={settings.invertY}
              onCheckedChange={(v) => set({ invertY: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <span>
              <span className="block font-semibold">Mode test 🛠️</span>
              <span className="text-sm text-muted-foreground">
                Commencer n'importe quel niveau directement.
              </span>
            </span>
            <Switch
              aria-label="Mode test"
              checked={settings.debug}
              onCheckedChange={(v) => set({ debug: v })}
            />
          </div>
          {settings.debug && (
            <div className="-mt-2 grid grid-cols-2 gap-2">
              {IMPLEMENTED_LEVELS.map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant="secondary"
                  className="justify-start"
                  onClick={() => {
                    onOpenChange(false);
                    void game?.loadLevel(id, 0);
                  }}
                >
                  {id} · {LEVELS_META[id]?.short}
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
