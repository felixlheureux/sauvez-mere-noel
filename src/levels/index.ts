import type { Game } from "../core/Game";
import type { Level } from "../world/Level";
import { Level0 } from "./Level0";
import { Level1 } from "./Level1";
import { Level2 } from "./Level2";
import { Level3 } from "./Level3";
import { Level4 } from "./Level4";
import { Level5 } from "./Level5";
import { Level6 } from "./Level6";
import { Level7 } from "./Level7";
import { Level8 } from "./Level8";
import { Level9 } from "./Level9";
import { Level10 } from "./Level10";

/** Levels that are playable right now. The map shows the others as "coming soon". */
export const IMPLEMENTED_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function createLevel(id: number, game: Game): Level {
  switch (id) {
    case 0:
      return new Level0(game);
    case 1:
      return new Level1(game);
    case 2:
      return new Level2(game);
    case 3:
      return new Level3(game);
    case 4:
      return new Level4(game);
    case 5:
      return new Level5(game);
    case 6:
      return new Level6(game);
    case 7:
      return new Level7(game);
    case 8:
      return new Level8(game);
    case 9:
      return new Level9(game);
    case 10:
      return new Level10(game);
    default:
      throw new Error(`Level ${id} is not built yet`);
  }
}
