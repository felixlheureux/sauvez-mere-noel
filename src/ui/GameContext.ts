import { createContext, useContext } from "react";
import type { Game } from "@/core/Game";

export const GameContext = createContext<Game | null>(null);

export function useGame() {
  return useContext(GameContext);
}
