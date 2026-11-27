// The sandbox's obstacles, one tile each, that a scenario places (scenario.js,
// `obstacles`); several make a wall. Two kinds:
//   boulder  [x, y]: blocks the way and the line of sight, as the Inferno's
//            pillars do. Drawn as Zebak's boulder (CACHE: NPC 11737, model
//            46376).
//   low      [x, y, "low"]: blocks the way only; attacks from afar pass over
//            it, as over a table. Drawn as Zebak's jug (CACHE: NPC 11735,
//            model 46413).
// Each is an NPC that never acts and cannot be attacked (toa/zebak/phases.js
// loads both the same way, with no sequence), and its tile is flagged in
// the arena's collision (encounter.js, refineArenaConfig), so that the
// player walks around it and a monster is stopped by it. The line of sight
// (engine/attackRange.js) asks the projectile flags only.
import { CollisionFlag, createCollisionMap } from "../../engine/collision.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { obstacleSize } from "./scenario.js";

export const obstacleKinds = {
  // As the Inferno's pillars: an object that also stops projectiles (inferno/collisionFlags.js).
  boulder: { npcTypeId: 11737, flags: CollisionFlag.OBJECT | CollisionFlag.OBJECT_PROJECTILE_BLOCKER },
  // An object only: walked around, shot over.
  low: { npcTypeId: 11735, flags: CollisionFlag.OBJECT },
};
export const obstacleKindOf = (entry) => (entry[2] === "low" ? "low" : "boulder");
export const obstacleNpcTypeIds = Object.values(obstacleKinds).map((kind) => kind.npcTypeId);

export const obstacleNpcDefinition = defineNpc({ id: "sandbox-obstacle", move: false });
export const isObstacle = (npc) => npc?.definition?.id === obstacleNpcDefinition.id;

/** The tiles an obstacle covers, from its south-west corner. */
export const obstacleTiles = ([x, y]) =>
  Array.from({ length: obstacleSize * obstacleSize }, (_, index) => [x + (index % obstacleSize), y + Math.floor(index / obstacleSize)]);

export function createObstacleActor(id, entry) {
  const position = entry.slice(0, 2);
  return obstacleNpcDefinition.createActor(
    {
      id,
      kind: "npc",
      npcTypeId: obstacleKinds[obstacleKindOf(entry)].npcTypeId,
      archetypeId: "sandbox_obstacle",
      size: obstacleSize,
      role: "npc",
      alive: true,
      position: [...position],
      previousPosition: [...position],
      facing: 0,
      lockedFacing: 0,
      // Never hit (untargetable): the numbers only fill the record.
      vitals: { hp: 1, maxHp: 1 },
      history: new Map(),
      formulaStats: null,
      untargetable: true,
      // Its tiles are in the collision: the NPCs' own blocking would count it twice.
      blocksNpcMovement: false,
      combat: {
        attackSpeed: 1,
        attackRange: 0,
        attackStyle: "typeless",
        nextActionTick: Number.MAX_SAFE_INTEGER,
        targetId: null,
        lastAttackTick: null,
        animations: { idle: null, walk: null, run: null, attack: null, death: null },
      },
    },
    {},
  );
}

// A copy of the arena's collision with the obstacles' tiles flagged and
// taken out of the walkable tiles; the arena's own map is left as it is.
export function withObstacles(arena, obstacles) {
  if (obstacles.length === 0) return arena;
  const base = arena.collisionMap;
  const collisionMap = base ? createCollisionMap(base.sizeX, base.sizeY) : createCollisionMap(64, 64);
  if (base?.flags) collisionMap.flags.set(base.flags);
  else if (base) {
    // A map without its array (an overlay, as the Inferno's pillars make): flag by flag.
    for (let x = 0; x < base.sizeX; x++) {
      for (let y = 0; y < base.sizeY; y++) {
        const flag = base.getFlag(x, y);
        if (flag > 0) collisionMap.flag(x, y, flag);
      }
    }
  }
  const walkableTiles = arena.walkableTiles ? new Set(arena.walkableTiles) : null;
  for (const entry of obstacles) {
    for (const [x, y] of obstacleTiles(entry)) {
      collisionMap.flag(x, y, obstacleKinds[obstacleKindOf(entry)].flags);
      walkableTiles?.delete(`${x},${y}`);
    }
  }
  return { ...arena, collisionMap, walkableTiles };
}
