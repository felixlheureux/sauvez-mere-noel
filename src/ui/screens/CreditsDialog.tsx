import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/dialog";

export function CreditsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Crédits</DialogTitle>
        <DialogDescription className="sr-only">Qui a fait le jeu</DialogDescription>
        <div className="mt-4 space-y-3 text-foreground">
          <p>
            <span className="font-semibold">Jeu, code et design :</span> Félix Servant-L'Heureux
          </p>
          <p>
            <span className="font-semibold">Moteur 3D :</span> Babylon.js
          </p>
          <p>
            <span className="font-semibold">Modèles 3D, sons et musique :</span> tous générés par le
            code, en low-poly.
          </p>
          <p className="text-muted-foreground">
            Fait pour le défi Festive.js de l'AGEEI, décembre 2026. Joyeux Noël, tabarnouche!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
