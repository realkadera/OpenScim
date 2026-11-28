// Scurrius' giant rats (https://oldschool.runescape.wiki/w/Giant_rat_(Scurrius)).
//
// He calls six at once, from a pile or in the middle of the room; they come
// two ticks into the call, each on a floor tile of its own with room for its
// 2x2 body (OBS, tsps: no two of a wave on one tile in 203 waves). He calls at
// most twelve waves (WIKI), at least 41 ticks apart, and never while one of
// his rats lives (OBS, tsps). They walk up to the player and bite: up to 4
// (TABLE), and 0 or 1 through Protect from Melee (WIKI; OBS, tsps: 1 on 73
// ticks, 0 on 15). Any hit of the player's kills one (WIKI), which
// encounter.js's rules see to. They stay when he dies (WIKI).
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { rollNpcAttack, isNpcInAttackRange } from "../shared/npcAttack.js";
import { scheduleNextActionTick } from "../shared/npcHelpers.js";
import { emitInfernoNpcAttack } from "../inferno/events.js";
import { npcTypeIds, ratSize, floor } from "./ids.js";
import { isArenaFootprintWalkable } from "../shared/npcMovement.js";

export const ratsPerWave = 6; // WIKI, OBS (tsps)
export const ratWaveLimit = 12; // WIKI
export const ratCallCooldownTicks = 41; // OBS (tsps): the shortest of 27 gaps between calls
export const ratSpawnTicks = 2; // OBS (tsps): they come two ticks into the call
const attackSpeed = 4; // TABLE
const firstBiteTicks = 2; // inferred: a rat bites once it reaches the player, from two ticks after it comes
const protectedMaxHit = 1; // WIKI, OBS (tsps)
const tileAttempts = 40; // inferred: tsps' tries for a free tile before giving up on one

// A rat's turn: the default walk (towards its target) has run; a bite when it is beside the player.
export const ratDefinition = defineNpc({
  id: "scurrius-rat",
  tick: ({ actor, context, config }) => {
    const idle = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!actor.alive || context.tick < actor.combat.nextActionTick || !player.alive) return idle;
    if (!isNpcInAttackRange(actor, player, actor.combat.attackRange)) return idle;
    const bite = rollNpcAttack({
      attacker: actor,
      target: player,
      plan: { formulaStyle: "melee_slash", damageType: "melee", attackKind: "melee_slash", impactDelayTicks: 0, sourceDeathPolicy: "cancel-before-impact" },
      random: config.random,
    });
    if (!bite) throw new TypeError("Missing formula stats for Scurrius' giant rat");
    emitInfernoNpcAttack(context, { actor, target: player, clipId: "attack", kind: "scurrius_rat_bite", impactDelayTicks: 0 });
    actor.combat.lastAttackTick = context.tick;
    scheduleNextActionTick(actor.combat, context.tick, attackSpeed);
    return { environmentalDamages: [], npcAttacks: [{ ...bite, prayerReduction: { type: "cap", value: protectedMaxHit } }] };
  },
});

export class Rats {
  constructor(encounter) {
    this.encounter = encounter;
  }
  reset() {
    this.count = 0;
  }
  isRat(npc) {
    return ratDefinition.isActor(npc);
  }
  living(world) {
    return world.getNpcs().filter((npc) => this.isRat(npc) && npc.alive);
  }
  anyAlive(world) {
    return this.living(world).length > 0;
  }
  // A floor tile for a rat's south-west corner: its whole body on open floor,
  // on no tile another rat of the wave came to.
  freeTile(taken) {
    const random = this.encounter.random;
    for (let attempt = 0; attempt < tileAttempts; attempt++) {
      const tile = [
        floor.minX + Math.floor(random() * (floor.maxX - ratSize + 1 - floor.minX + 1)),
        floor.minY + Math.floor(random() * (floor.maxY - ratSize + 1 - floor.minY + 1)),
      ];
      if (!taken.has(tile.join()) && isArenaFootprintWalkable(tile, ratSize)) {
        taken.add(tile.join());
        return tile;
      }
    }
    return null;
  }
  spawnWave(context) {
    const taken = new Set();
    const hp = getMonsterHitpoints(npcTypeIds.rat); // TABLE: 15
    for (let n = 0; n < ratsPerWave; n++) {
      const position = this.freeTile(taken);
      if (!position) continue;
      context.spawnNpc(ratDefinition.createActor(
        {
          id: "scurrius-rat-" + this.count++, kind: "npc", role: "minion", npcTypeId: npcTypeIds.rat, archetypeId: "scurrius-rat",
          size: ratSize, alive: true, position: [...position], previousPosition: [...position], facing: 0, history: new Map(),
          vitals: { hp, maxHp: hp }, formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.rat)), spawnTick: context.tick,
          combat: {
            attackSpeed, attackRange: 1, attackStyle: "melee", nextActionTick: context.tick + firstBiteTicks, targetId: "player", lastAttackTick: null,
            animations: { idle: null, walk: null, run: null, attack: null, death: null },
          },
        },
        {},
      ));
    }
  }
}
