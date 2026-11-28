// Brutus's and Demonic Brutus's walk to the player: the shared pursuit, and a step out of a corner.
import { getNpcPursuitMoves, isArenaFootprintWalkable } from "../shared/npcMovement.js";
import { bossSize, edgeDistance } from "./ids.js";

// The player beside him (not at a corner): where he butts from (a melee NPC's reach).
export function besideHim(corner, [x, y]) {
  if (edgeDistance(corner, bossSize, [x, y]) !== 1) return false;
  return (x >= corner[0] && x < corner[0] + bossSize) || (y >= corner[1] && y < corner[1] + bossSize);
}

// His moves toward the player. The shared pursuit stops him with the player at a corner of him (it counts that as in
// reach), where he can't butt, so he'd stand there: a special can leave him so. From a corner he steps a tile along
// one axis so that the player is beside him, the first of the two that is open and doesn't put him over the player
// (inferred: as a melee NPC in the game; no recording shows it).
export function brutusPursuitMoves(boss, context) {
  const player = context.world.getPlayer();
  if (player && edgeDistance(boss.position, bossSize, player.position) === 1 && !besideHim(boss.position, player.position)) {
    const [bx, by] = boss.position;
    const sx = player.position[0] < bx ? -1 : 1;
    const sy = player.position[1] < by ? -1 : 1;
    for (const tile of [[bx + sx, by], [bx, by + sy]]) {
      if (isArenaFootprintWalkable(tile, bossSize) && edgeDistance(tile, bossSize, player.position) === 1 && besideHim(tile, player.position)) {
        return [{ npcId: boss.id, path: [tile] }];
      }
    }
  }
  return getNpcPursuitMoves(boss, context);
}
