// What a sandbox monster brings along that is not a monster of its own: it
// never counts for the victory, cannot be attacked, and is the scenario's
// (encounter.js keeps a host from taking it away).
//
//   companion  a second body drawn with the first (catalog.js, `companion`:
//              Zebak's tail, an NPC of its own in his fight, toa/zebak/
//              native.js). It stands where its body stands, faces as it
//              does, plays the same clips (encounter.js, echo) and goes with it.
//   tornado    the Corrupted Hunllef's (catalog.js, `tornadoes`): it chases
//              its owner's target a tile a tick and hurts each enemy of its
//              owner it stands on, every tick, until its time is up
//              (corrupted-hunllef/encounter.js); encounter.js hurts and ends it.
import { defineNpc } from "../shared/npcDefinitions.js";

export const companionNpcDefinition = defineNpc({ id: "sandbox-companion", move: false });
export const isCompanion = (npc) => npc?.definition?.id === companionNpcDefinition.id;

export const tornadoNpcDefinition = defineNpc({
  id: "sandbox-tornado",
  move: ({ actor, context, config }) => config.step(actor, context),
});
export const isTornado = (npc) => npc?.definition?.id === tornadoNpcDefinition.id;

const inert = (attackStyle) => ({
  attackSpeed: 1,
  attackRange: 0,
  attackStyle,
  nextActionTick: Number.MAX_SAFE_INTEGER,
  targetId: null,
  lastAttackTick: null,
  animations: { idle: null, walk: null, run: null, attack: null, death: null },
});

export function createCompanionActor(id, owner, companion) {
  return companionNpcDefinition.createActor(
    {
      id,
      kind: "npc",
      role: "npc",
      npcTypeId: companion.npcTypeId,
      archetypeId: "sandbox_companion",
      size: owner.size,
      alive: true,
      position: [...owner.position],
      previousPosition: [...owner.position],
      facing: owner.facing ?? 0,
      ...(owner.lockedFacing === undefined ? {} : { lockedFacing: owner.lockedFacing }),
      vitals: { hp: 1, maxHp: 1 },
      history: new Map(),
      formulaStats: null,
      untargetable: true,
      blocksNpcMovement: false,
      combat: inert("typeless"),
    },
    { ownerId: owner.id },
  );
}

export function createTornadoActor(id, position, owner, tornadoes, tick) {
  return tornadoNpcDefinition.createActor(
    {
      id,
      kind: "npc",
      role: "hazard",
      npcTypeId: tornadoes.npcTypeId,
      archetypeId: "sandbox_tornado",
      size: 1,
      alive: true,
      position: [...position],
      previousPosition: [...position],
      facing: 0,
      vitals: { hp: 1, maxHp: 1 },
      history: new Map(),
      formulaStats: null,
      untargetable: true,
      blocksNpcMovement: false,
      combat: inert("typeless"),
    },
    { ownerId: owner.id, expiresAt: tick + tornadoes.lifetime },
  );
}

// One step, diagonals too, toward the nearest tile of its target; through
// anything (corrupted-hunllef/encounter.js: no clipping, inferred).
export function tornadoStep(tornado, target, context) {
  if (!target || context.tick >= tornado.state.expiresAt) return [];
  const size = target.size ?? 1;
  const [x, y] = tornado.position;
  const nearest = [
    Math.min(Math.max(x, target.position[0]), target.position[0] + size - 1),
    Math.min(Math.max(y, target.position[1]), target.position[1] + size - 1),
  ];
  const next = [x + Math.sign(nearest[0] - x), y + Math.sign(nearest[1] - y)];
  return next[0] === x && next[1] === y ? [] : [{ npcId: tornado.id, path: [next] }];
}
