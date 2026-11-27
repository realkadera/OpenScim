// Zulrah encounter: 4 OSRS rotations, Magma melee slams, Jad alternation, Snakelings, Toxic clouds, and Venom.
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget, buildNpcProjectileVisual, scheduleNextActionTick } from "../shared/npcHelpers.js";
import { getNpcPursuitMoves } from "../shared/npcMovement.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";

function emitZulrahVisual(tickEvents, visual) {
  if (!tickEvents) return;
  emitInfernoVisual(tickEvents, {
    animations: [],
    projectiles: [],
    graphics: [],
    ...visual,
  });
}
import { zulrahRotations, zulrahSpots } from "./rotations.js";
import { animationTicks } from "./animations.js";
import { zulrahLoadouts } from "./loadouts.js";

export const zulrahKind = "zulrah";

// Zulrah's Shrine spans map squares (35, 47) [region 9007] and (35, 48) [region 9008].
export const zulrahMapSquare = { x: 35, y: 47 };
export const zulrahMapSquareOffsets = [
  { dx: 0, dy: 0 },
  { dx: 0, dy: 1 },
];

// World (2268, 3068) relative to (35, 47) -> [28, 60] (south-center of the shrine).
const playerStart = [28, 60];
export const zulrahCenterStart = zulrahSpots.CENTER;

export const zulrahActorId = "zulrah";
export const zulrahNpcIds = {
  serpentine: 2042,
  magma: 2043,
  tanzanite: 2044,
  snakelingMelee: 2045,
  snakelingMagic: 2046,
};

export const zulrahSeqIds = {
  idle: 5070,
  shoot: 5069,
  submerge: 5072,
  emerge: 5073,
  initialRise: 5071,
  meleeFocus: 5806,
  meleeAttack: 5807,
};

export const zulrahLocIds = {
  toxicCloud: 11700, // CACHE: SNAKEBOSS_POISONCLOUD 3x3 animated loc
};

export const zulrahSpotIds = {
  rangedProjectile: 1044, // CACHE/OBS: Zulrah ranged projectile (SNAKEBOSS_DOUBLE_ORB).
  toxicCloud: 1045, // CACHE/OBS: Zulrah venom cloud orb projectile (SNAKEBOSS_ORB).
  magicProjectile: 1046, // CACHE/OBS: Zulrah magic projectile (SNAKEBOSS_FIREBALL).
  snakelingSpawn: 1047, // CACHE/OBS: Snakeling egg projectile (SNAKEBOSS_EGG).
  snakelingMagic: 1230, // CACHE/WIKI: Snakeling magic projectile.
  stunned: 80, // CACHE: Generic stunned circling birds.
};

const zulrahSize = 5;
const attackSpeedTicks = 3; // WIKI: Zulrah attacks every 3 ticks (1.8s) during ranged/magic/jad phases.
const cloudCadenceTicks = 3; // WIKI/OBS: Toxic cloud volleys & snakeling spawns occur every 3 ticks.
const cloudTravelTicks = 3; // WIKI/OBS: Toxic clouds land 3 ticks after Zulrah spits them.
const submergeDurationTicks = animationTicks("submerge"); // CACHE: full dive sequence.
const submergedDurationTicks = 1; // inferred: keep the model hidden between dive and surface.
const emergeDurationTicks = 4; // WIKI: Zulrah surfaces (~4 ticks) before its first action.
const openerDelayTicks = 5; // OBS: Zulrah allows 5 ticks grace period after rising before taking its first action, unless attacked early.
const toxicCloudDurationTicks = 30; // OBS (phas3r & boulder-bros recordings): clouds persist for 30 ticks (18.0s).
const snakelingLifetimeTicks = 42; // WIKI/TSPS: snakelings live ~25s (~42 ticks).
const venomVarpSeverity = 1000000; // Engine VENOM_VARP_THRESHOLD.
const ticksFromDefeatToVictory = 4;
const meleeStunTicks = 5; // inferred: WIKI Strategies says "several seconds"; 3 seconds pending recorded timing.

export const zulrahRotationKey = "zulrahRotation";
export const zulrahTrainingOverlayKey = "zulrahTrainingOverlay";
export const zulrahSnakelingsKey = "zulrahSnakelings";
export const zulrahToxicCloudsKey = "zulrahToxicClouds";

export const nextPhaseCommand = { encounter: zulrahKind, type: "next-phase" };
export const resetRotationCommand = { encounter: zulrahKind, type: "reset-rotation" };
export const jumpToJadCommand = { encounter: zulrahKind, type: "jump-to-jad" };

const rangedProjectile = {
  spotAnimId: zulrahSpotIds.rangedProjectile,
  timing: { delay: 41, lengthAdjustment: 0, stepMultiplier: 5, progress: 0 },
  slope: 16,
  startHeight: 43,
  endHeight: 31,
};

const magicProjectile = {
  spotAnimId: zulrahSpotIds.magicProjectile,
  timing: { delay: 41, lengthAdjustment: 0, stepMultiplier: 5, progress: 0 },
  slope: 16,
  startHeight: 43,
  endHeight: 31,
};

const snakelingMagicProjectile = {
  spotAnimId: zulrahSpotIds.snakelingMagic, // CACHE/WIKI: Snakeling projectile (1230), distinct from Zulrah's fireball.
  timing: { delay: 10, lengthAdjustment: 0, stepMultiplier: 5, progress: 0 },
  slope: 0,
  startHeight: 20,
  endHeight: 31,
};

function formToNpcTypeId(form) {
  if (form === "magma") return zulrahNpcIds.magma;
  if (form === "tanzanite") return zulrahNpcIds.tanzanite;
  return zulrahNpcIds.serpentine;
}

function faceTile(actor, targetTile) {
  if (!actor || !targetTile) return;
  const cx = actor.position[0] + (actor.size ? (actor.size - 1) / 2 : 2);
  const cy = actor.position[1] + (actor.size ? (actor.size - 1) / 2 : 2);
  const dx = targetTile[0] - cx;
  const dy = targetTile[1] - cy;
  if (dx === 0 && dy === 0) return;
  const radians = Math.atan2(-dx, -dy);
  const angle = ((Math.round(radians * (2048 / (2 * Math.PI))) % 2048) + 2048) % 2048;
  actor.facing = angle;
  actor.lockedFacing = angle;
}

const zulrahBossNpc = defineNpc({
  id: "zulrah-boss",
  move: false,
  tick: ({ actor, context, config }) => {
    const encounter = config.getEncounter();
    return encounter.tickBoss(actor, context);
  },
});

export const snakelingNpc = defineNpc({
  id: "zulrah-snakeling",
  move: ({ actor, context }) => getNpcPursuitMoves(actor, context),
  tick: ({ actor, context }) => {
    const idle = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!actor.alive || !player.alive) return idle;
    if (actor.lifetimeTicks && context.tick >= (actor.spawnTick ?? 0) + actor.lifetimeTicks) {
      actor.alive = false;
      return idle;
    }
    if (context.tick < actor.combat.nextActionTick) return idle;

    const isMagic = actor.npcTypeId === zulrahNpcIds.snakelingMagic;
    const distance = Math.max(
      Math.abs(actor.position[0] - player.position[0]),
      Math.abs(actor.position[1] - player.position[1]),
    );
    if (!isMagic && distance > 1) return idle;
    if (isMagic && distance > 10) return idle;

    const npcAttack = rollNpcAttack({
      attacker: actor,
      target: player,
      plan: {
        formulaStyle: isMagic ? "magic" : "melee",
        damageType: isMagic ? "magic" : "melee",
        attackKind: isMagic ? "magic_fire" : "melee_crush",
        maxHit: 15, // WIKI: Snakelings hit up to 15.
        projectile: isMagic ? snakelingMagicProjectile.timing : null,
        impactDelayTicks: 1,
        prayerCheckAt: "launch",
        sourceDeathPolicy: "cancel-before-impact",
      },
      random: context.random,
    });
    if (!npcAttack) return idle;

    if (npcAttack.baseDamage > 0) {
      npcAttack.applyPoison = venomVarpSeverity;
    }

    faceTile(actor, player.position);
    emitInfernoNpcAttack(context, {
      actor,
      target: player,
      clipId: isMagic ? "magicAttack" : "attack",
      kind: isMagic ? "snakeling_magic" : "snakeling_melee",
      impactDelayTicks: npcAttack.impactDelayTicks,
      projectiles: isMagic ? [buildNpcProjectileVisual(actor, player, snakelingMagicProjectile)] : [],
    });

    actor.combat.lastAttackTick = context.tick;
    scheduleNextActionTick(actor.combat, context.tick, 4);
    return { environmentalDamages: [], npcAttacks: [npcAttack] };
  },
});

class ZulrahEncounter {
  kind = zulrahKind;
  runStartMechanicsKeys = [zulrahRotationKey, zulrahSnakelingsKey, zulrahToxicCloudsKey];

  constructor() {
    this.definitions = new NpcDefinitionRegistry([
      zulrahBossNpc.register({ getEncounter: () => this }),
      snakelingNpc.register({}),
    ]);
    this.reset();
  }

  reset(seeds) {
    this.seed = seeds?.encounterSeed ?? Math.floor(Math.random() * 2 ** 32);
    this.random = createSeededRandom(this.seed);
    this.outcome = { phase: "active" };
    this.rotation = 1;
    this.phaseIndex = 0;
    this.phaseState = "emerging";
    this.stateUntilTick = emergeDurationTicks;
    this.bossAnimation = { clipId: "initialRise", startedTick: 0 };
    this.phaseAttackCount = 0;
    this.phaseActions = [];
    this.pendingClouds = [];
    this.pendingMeleeTarget = null;
    this.meleeWindupEndTick = null;
    this.activeClouds = [];
    this.pendingSnakelings = [];
    this.snakelingCounter = 0;
    this.spawnedSnakelingIds = [];
    this.snakelingsEnabled = true;
    this.toxicCloudsEnabled = true;
    this.lastCloudDamageTick = -10;
    this.currentTick = 0;
    this.stunnedUntilTick = 0;
    this.isInitialOpener = true;
    this.openerEarlyTriggered = false;
    this.openerDelayEndTick = emergeDurationTicks + openerDelayTicks;
  }

  getSeeds() {
    return { encounterSeed: this.seed };
  }

  getDefaultMechanicsConfig() {
    return {
      [zulrahRotationKey]: "random",
      [zulrahTrainingOverlayKey]: true,
      [zulrahSnakelingsKey]: true,
      [zulrahToxicCloudsKey]: true,
    };
  }

  getDefaultPlayerStart() {
    return [...playerStart];
  }

  getIntroConfig() {
    return null;
  }

  getArenaConfig() {
    return { bounds: { minX: 0, maxX: 63, minY: 0, maxY: 63 }, collisionMap: null, walkableTiles: null };
  }

  middle(actor) {
    const size = actor?.size ?? zulrahSize;
    return [actor.position[0] + Math.floor(size / 2), actor.position[1] + Math.floor(size / 2)];
  }

  moveNpc(npc, context) {
    if (!npc.alive || this.outcome.phase !== "active") return [];
    if (npc.id === zulrahActorId) return [];
    return this.definitions.move(npc, { ...context, random: this.random });
  }

  triggerOpenerEarly() {
    if (this.isInitialOpener) {
      this.isInitialOpener = false;
      this.openerEarlyTriggered = true;
    }
  }

  onPlayerAttackStarted(attack) {
    if (attack?.targetId === zulrahActorId || attack?.target?.id === zulrahActorId) {
      this.triggerOpenerEarly();
    }
  }

  onPlayerAttackResolved(attack) {
    if (attack?.targetId === zulrahActorId || attack?.target?.id === zulrahActorId) {
      this.triggerOpenerEarly();
    }
  }

  configureRunStart(mechanics) {
    const choice = mechanics?.[zulrahRotationKey] ?? "random";
    if (choice === "random") {
      this.rotation = 1 + Math.floor(this.random() * 4);
    } else {
      this.rotation = Number(choice) || 1;
    }
    this.snakelingsEnabled = mechanics?.[zulrahSnakelingsKey] ?? true;
    this.toxicCloudsEnabled = mechanics?.[zulrahToxicCloudsKey] ?? true;
    this.phaseIndex = 0;
    this.phaseState = "emerging";
    this.stateUntilTick = emergeDurationTicks;
    this.bossAnimation = { clipId: "initialRise", startedTick: 0 };
    this.phaseAttackCount = 0;
    this.phaseActions = [];
    this.pendingClouds = [];
    this.pendingMeleeTarget = null;
    this.meleeWindupEndTick = null;
    this.activeClouds = [];
    this.pendingSnakelings = [];
    this.stunnedUntilTick = 0;
    this.isInitialOpener = true;
    this.openerEarlyTriggered = false;
    this.openerDelayEndTick = emergeDurationTicks + openerDelayTicks;
  }

  getEngineRules() {
    return {
      onTickStart: ({ tick }) => { this.currentTick = tick; },
      // WIKI: each hitsplat above 50 is re-rolled to 45..50, not clamped to 50.
      playerDamageOnNpc: (damage, { target }) => {
        if (target?.id === zulrahActorId) {
          this.triggerOpenerEarly();
        }
        return target?.id === zulrahActorId && damage > 50 ? 45 + Math.floor(this.random() * 6) : damage;
      },
      // Stun prevents the player from attacking; prayer, eating, drinking, and gear switches still work.
      validateAttack: () => this.currentTick >= this.stunnedUntilTick,
      onPlayerDamageTaken: (hit) => {
        // Only the landed tail slam stuns; ranged, magic and clouds do not.
        if (hit.source === "Zulrah (Melee)" && hit.effectiveDamage > 0) {
          this.stunnedUntilTick = Math.max(this.stunnedUntilTick, hit.tick + meleeStunTicks);
        }
      },
    };
  }

  moveDisplacedPlayer(player) {
    if (this.currentTick >= this.stunnedUntilTick) return undefined;
    player.previousPosition = [...player.position];
    player.movementPath = [];
    player.isMoving = false;
    player.isRunning = false;
    return false;
  }

  getCurrentPhase() {
    const phases = zulrahRotations[this.rotation] ?? zulrahRotations[1];
    return phases[this.phaseIndex % phases.length];
  }

  getNextPhase() {
    const phases = zulrahRotations[this.rotation] ?? zulrahRotations[1];
    const nextIdx = this.phaseIndex + 1 >= phases.length ? 1 : this.phaseIndex + 1;
    return phases[nextIdx];
  }

  createNpcs() {
    const phase = this.getCurrentPhase();
    const npcTypeId = formToNpcTypeId(phase.form);
    const hitpoints = getMonsterHitpoints(npcTypeId);
    const pos = zulrahSpots[phase.spot] ?? zulrahCenterStart;
    return [
      zulrahBossNpc.createActor(
        {
          id: zulrahActorId,
          kind: "npc",
          role: "boss",
          npcTypeId,
          archetypeId: "zulrah",
          size: zulrahSize,
          alive: true,
          untargetable: true,
          position: [...pos],
          previousPosition: [...pos],
          facing: 0,
          lockedFacing: 0,
          history: new Map(),
          vitals: { hp: hitpoints, maxHp: hitpoints },
          formulaStats: structuredClone(getMonsterFormulaStats(npcTypeId)),
          combat: {
            attackSpeed: attackSpeedTicks,
            attackRange: 25,
            attackStyle: "range",
            nextActionTick: emergeDurationTicks + openerDelayTicks,
            targetId: "player",
            lastAttackTick: null,
            animations: { attack: null, death: null },
          },
        },
        {},
      ),
    ];
  }

  getNpcDefinitions() {
    return this.definitions;
  }

  buildPhaseActions(phase) {
    if (phase.interleaved) {
      const actions = [];
      const volleys = this.toxicCloudsEnabled && phase.cloudVolleys ? [...phase.cloudVolleys] : [];
      const snakelings = this.snakelingsEnabled && phase.snakelings ? [...phase.snakelings] : [];
      const maxLen = Math.max(volleys.length, snakelings.length);
      for (let i = 0; i < maxLen; i += 1) {
        if (i < volleys.length) actions.push({ kind: "venom", volley: volleys[i] });
        if (i < snakelings.length) actions.push({ kind: "snakeling", spec: snakelings[i] });
      }
      const attackCount = phase.attacks ?? 0;
      const attackKind = phase.pattern === "melee" ? "melee" : "attack";
      for (let i = 0; i < attackCount; i += 1) {
        actions.push({ kind: attackKind });
      }
      return actions;
    }
    const actions = [];
    const attackCount = phase.attacks ?? 0;
    const attackKind = phase.pattern === "melee" ? "melee" : "attack";
    for (let i = 0; i < attackCount; i += 1) {
      actions.push({ kind: attackKind });
    }
    if (this.toxicCloudsEnabled && phase.cloudVolleys?.length) {
      for (const volley of phase.cloudVolleys) {
        actions.push({ kind: "venom", volley });
      }
    }
    if (this.snakelingsEnabled && phase.snakelings?.length) {
      for (const spec of phase.snakelings) {
        actions.push({ kind: "snakeling", spec });
      }
    }
    return actions;
  }

  playBossAnimation(clipId, context) {
    this.bossAnimation = { clipId, startedTick: context.tick };
    emitZulrahVisual(context.tickEvents, {
      animations: [{ actorId: zulrahActorId, clipId, delayCycles: 0 }],
    });
  }

  finishShot(actor, context, cadence) {
    this.phaseState = "attacking";
    this.stateUntilTick = context.tick + animationTicks("shoot");
    scheduleNextActionTick(actor.combat, context.tick, cadence);
  }

  submergeBoss(actor, context) {
    this.phaseState = "submerging";
    this.stateUntilTick = context.tick + submergeDurationTicks;
    actor.untargetable = true;
    this.playBossAnimation("submerge", context);
    emitZulrahVisual(context.tickEvents, {
      zulrahSounds: [{ id: 2675, range: 15, position: this.middle(actor) }],
    });
  }

  transitionToPhase(actor, nextIndex, context, { immediate = false } = {}) {
    const phases = zulrahRotations[this.rotation] ?? zulrahRotations[1];
    this.phaseIndex = nextIndex % phases.length;
    const phase = phases[this.phaseIndex];
    const nextType = formToNpcTypeId(phase.form);
    const pos = zulrahSpots[phase.spot] ?? zulrahCenterStart;

    actor.npcTypeId = nextType;
    actor.formulaStats = structuredClone(getMonsterFormulaStats(nextType));
    actor.position = [...pos];
    actor.previousPosition = [...pos];
    faceTile(actor, context.world.getPlayer()?.position);
    this.phaseAttackCount = 0;
    this.phaseActions = this.buildPhaseActions(phase);
    this.pendingMeleeTarget = null;
    this.meleeWindupEndTick = null;
    this.isInitialOpener = false;

    if (immediate) {
      this.phaseState = "active";
      actor.untargetable = false;
      actor.combat.nextActionTick = context.tick + 1;
    } else {
      this.phaseState = "emerging";
      this.stateUntilTick = context.tick + emergeDurationTicks;
      actor.untargetable = true;
      actor.combat.nextActionTick = context.tick + emergeDurationTicks;
      emitZulrahVisual(context.tickEvents, {
        zulrahSounds: [{ id: 2685, range: 15, position: this.middle(actor) }],
      });
    }

    this.playBossAnimation("emerge", context);
  }

  tickBoss(actor, context) {
    const idle = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!actor.alive || !player.alive) return idle;

    // Land any toxic clouds whose travel delay has elapsed.
    if (this.pendingClouds.length) {
      const landed = [];
      const remaining = [];
      for (const c of this.pendingClouds) {
        if (context.tick >= c.landTick) landed.push(c);
        else remaining.push(c);
      }
      this.pendingClouds = remaining;
      if (landed.length) {
        const graphics = [];
        for (const c of landed) {
          this.activeClouds.push({ x: c.x, y: c.y, expiresTick: context.tick + toxicCloudDurationTicks });
          graphics.push({
            spotAnimId: zulrahSpotIds.toxicCloud,
            target: { kind: "tile", position: [c.x, c.y] },
            height: 0,
            delayCycles: 0,
          });
        }
        if (this.toxicCloudsEnabled) {
          emitZulrahVisual(context.tickEvents, {
            graphics,
            zulrahSounds: landed.map((c) => ({ id: 790, range: 7, position: [c.x, c.y] })),
          });
        }
      }
    }

    const expiring = this.activeClouds.filter((c) => c.expiresTick <= context.tick);
    if (expiring.length && this.toxicCloudsEnabled) {
      emitZulrahVisual(context.tickEvents, {
        zulrahSounds: expiring.map((c) => ({ id: 795, range: 7, position: [c.x, c.y] })),
      });
    }
    this.activeClouds = this.activeClouds.filter((c) => c.expiresTick > context.tick);
    if (this.toxicCloudsEnabled && this.activeClouds.length && context.tick % 4 === 0) {
      emitZulrahVisual(context.tickEvents, {
        graphics: this.activeClouds.map((c) => ({
          spotAnimId: zulrahSpotIds.toxicCloud,
          target: { kind: "tile", position: [c.x, c.y] },
          height: 0,
          delayCycles: 0,
        })),
      });
    }

    if (this.phaseState === "submerging") {
      if (context.tick >= this.stateUntilTick) {
        this.phaseState = "submerged";
        this.stateUntilTick = context.tick + submergedDurationTicks;
      }
      return idle;
    }

    if (this.phaseState === "submerged") {
      if (context.tick >= this.stateUntilTick) {
        const phases = zulrahRotations[this.rotation] ?? zulrahRotations[1];
        const nextIdx = this.phaseIndex + 1 >= phases.length ? 1 : this.phaseIndex + 1;
        this.transitionToPhase(actor, nextIdx, context);
      }
      return idle;
    }

    if (this.phaseState === "emerging") {
      // CACHE: the visible surface sequence ends before the existing first-action delay.
      actor.untargetable = context.tick < this.bossAnimation.startedTick + animationTicks(this.bossAnimation.clipId ?? "emerge");
      if (actor.untargetable) return idle;
      this.phaseState = "recovering";
      if (!this.phaseActions.length) this.phaseActions = this.buildPhaseActions(this.getCurrentPhase());
      if (this.isInitialOpener && !this.openerEarlyTriggered) {
        actor.combat.nextActionTick = this.openerDelayEndTick;
      }
    }

    if (this.openerEarlyTriggered) {
      this.openerEarlyTriggered = false;
      this.isInitialOpener = false;
      actor.combat.nextActionTick = Math.min(actor.combat.nextActionTick, context.tick);
    } else if (this.isInitialOpener) {
      const playerAttacking = player.attackTarget === zulrahActorId || (player.combat?.targetId === zulrahActorId && (player.combat?.lastAttackTick === context.tick || player.isAttacking));
      if (playerAttacking) {
        this.isInitialOpener = false;
        actor.combat.nextActionTick = Math.min(actor.combat.nextActionTick, context.tick);
      } else if (context.tick >= this.openerDelayEndTick) {
        this.isInitialOpener = false;
      }
    }

    const phase = this.getCurrentPhase();

    // Complete Magma melee slam windup & impact (5806/5807 are full ~7-tick slam animations).
    if (this.pendingMeleeTarget && context.tick >= this.meleeWindupEndTick) {
      const [tx, ty] = this.pendingMeleeTarget;
      const [px, py] = player.position;
      this.pendingMeleeTarget = null;
      this.meleeWindupEndTick = null;
      this.phaseAttackCount += 1;
      this.phaseState = "recovering";
      const environmentalDamages = [];

      // Safe spots: tucked behind pillars when Zulrah is at the middle spot (OBS/WIKI).
      const isMiddleSpot = phase.spot === "CENTER" || phase.spot === "middle";
      const isBehindWestPillar = (px === 24 && py >= 62 && py <= 64) || (px === 25 && py === 62);
      const isBehindEastPillar = (px === 32 && py >= 62 && py <= 64) || (px === 31 && py === 62) || (px >= 32 && py >= 68);
      const safeBehindPillar = isMiddleSpot && (isBehindWestPillar || isBehindEastPillar);

      // WIKI Strategies: Tail slam hits 3x3 area around targeted tile; safe 2+ tiles away.
      const inTailArea = Math.max(Math.abs(px - tx), Math.abs(py - ty)) <= 1;

      if (inTailArea && !safeBehindPillar) {
        environmentalDamages.push({
          baseDamage: 20 + Math.floor(this.random() * 11), // WIKI Strategies: tail slam deals 20..30 damage.
          attackType: "typeless",
          source: "Zulrah (Melee)",
          playerPosition: [...player.position],
        });
        this.stunnedUntilTick = Math.max(this.stunnedUntilTick, context.tick + meleeStunTicks);
        emitZulrahVisual(context.tickEvents, {
          graphics: [{ spotAnimId: zulrahSpotIds.stunned, target: buildActorVisualTarget(player), height: 100, delayCycles: 0 }],
        });
      }
      // Allow 2 ticks for the slam recovery before diving or winding up the next slam.
      scheduleNextActionTick(actor.combat, context.tick, this.phaseActions.length ? 3 : 2);
      this.stateUntilTick = actor.combat.nextActionTick;
      return { environmentalDamages };
    }

    if (this.phaseState === "attacking" && !this.pendingMeleeTarget && context.tick >= this.stateUntilTick) {
      this.phaseState = "recovering";
    }
    if (this.pendingMeleeTarget || context.tick < actor.combat.nextActionTick) return idle;

    if (this.phaseState === "attacking" || this.phaseState === "recovering") {
      this.phaseState = "active";
    }

    if (!this.phaseActions.length) {
      this.submergeBoss(actor, context);
      return idle;
    }

    const action = this.phaseActions.shift();

    if (action.kind === "melee") {
      this.pendingMeleeTarget = [...player.position];
      this.meleeWindupEndTick = context.tick + 5;
      this.phaseState = "attacking";
      faceTile(actor, this.pendingMeleeTarget);
      this.playBossAnimation(this.phaseAttackCount % 2 === 0 ? "meleeFocus" : "meleeAttack", context);
      return idle;
    }

    if (action.kind === "venom") {
      this.playBossAnimation("shoot", context);
      const avgX = action.volley.reduce((acc, [vx]) => acc + vx, 0) / action.volley.length;
      const avgY = action.volley.reduce((acc, [, vy]) => acc + vy, 0) / action.volley.length;
      faceTile(actor, [avgX, avgY]);
      const projectiles = [];
      for (const [x, y] of action.volley) {
        this.pendingClouds.push({ x, y, landTick: context.tick + cloudTravelTicks });
        projectiles.push({
          spotAnimId: zulrahSpotIds.toxicCloud,
          sourcePosition: [actor.position[0] + 2.5, actor.position[1] + 2.5],
          target: { kind: "tile", position: [x, y] },
          startDelayCycles: 0,
          endDelayCycles: cloudTravelTicks * 30,
          slope: 16,
          startOffset: 0,
          startHeight: 43,
          endHeight: 0,
        });
      }
      emitZulrahVisual(context.tickEvents, {
        projectiles,
        zulrahSounds: [{ id: 796, range: 15, position: this.middle(actor) }],
      });
      this.finishShot(actor, context, cloudCadenceTicks);
      return idle;
    }

    if (action.kind === "snakeling") {
      this.playBossAnimation("shoot", context);
      const targetPos = action.spec?.position ?? action.spec;
      const targetTile = Array.isArray(targetPos) ? targetPos : [28, 60];
      faceTile(actor, targetTile);
      const specObj = Array.isArray(action.spec) ? { position: action.spec } : action.spec;
      this.pendingSnakelings.push({ ...specObj, position: targetTile, spawnAtTick: context.tick + cloudTravelTicks });
      emitZulrahVisual(context.tickEvents, {
        projectiles: [
          {
            spotAnimId: zulrahSpotIds.snakelingSpawn,
            sourcePosition: [actor.position[0] + 2.5, actor.position[1] + 2.5],
            target: { kind: "tile", position: [...targetTile] },
            startDelayCycles: 0,
            endDelayCycles: cloudTravelTicks * 30,
            slope: 16,
            startOffset: 0,
            startHeight: 43,
            endHeight: 0,
          },
        ],
        zulrahSounds: [{ id: 788, range: 15, position: this.middle(actor) }],
      });
      this.finishShot(actor, context, cloudCadenceTicks);
      return idle;
    }

    // Standard Ranged, Tanzanite (Mage/Range mix), or Jad alternating attacks.
    let isMagic = false;
    if (phase.pattern === "jad_range_first") {
      isMagic = this.phaseAttackCount % 2 === 1;
    } else if (phase.pattern === "jad_mage_first") {
      isMagic = this.phaseAttackCount % 2 === 0;
    } else if (phase.pattern === "mage") {
      // Tanzanite phase primarily uses Magic (~85%) with occasional Ranged (~15%) (OBS: 45/53 network attacks).
      isMagic = this.random() < 0.85;
    }

    const projectile = isMagic ? magicProjectile : rangedProjectile;
    const npcAttack = rollNpcAttack({
      attacker: actor,
      target: player,
      plan: {
        formulaStyle: isMagic ? "magic" : "ranged",
        damageType: isMagic ? "magic" : "range",
        attackKind: isMagic ? "magic_fire" : "range_arrow",
        maxHit: 41, // WIKI: Zulrah max hit is 41 for ranged and magic.
        projectile: projectile.timing,
        prayerCheckAt: "launch",
        sourceDeathPolicy: "cancel-before-impact",
      },
      random: context.random,
    });
    if (!npcAttack) return idle;

    if (npcAttack.baseDamage > 0) {
      npcAttack.applyPoison = venomVarpSeverity;
    }

    faceTile(actor, player.position);
    emitInfernoNpcAttack(context, {
      actor,
      target: player,
      clipId: "shoot",
      kind: isMagic ? "zulrah_magic" : "zulrah_ranged",
      impactDelayTicks: npcAttack.impactDelayTicks,
      projectiles: [buildNpcProjectileVisual(actor, player, projectile)],
    });
    this.bossAnimation = { clipId: "shoot", startedTick: context.tick };

    actor.combat.lastAttackTick = context.tick;
    this.phaseAttackCount += 1;

    this.finishShot(actor, context, attackSpeedTicks);

    return { environmentalDamages: [], npcAttacks: [npcAttack] };
  }

  resolveHazards(context, mechanics) {
    if (!(mechanics?.[zulrahToxicCloudsKey] ?? this.toxicCloudsEnabled)) return [];
    const player = context.world.getPlayer();
    if (!player?.alive || !this.activeClouds.length) return [];
    if (context.tick === this.lastCloudDamageTick) return [];

    const [px, py] = player.position;
    const inCloud = this.activeClouds.some(
      (c) => c.expiresTick > context.tick && Math.max(Math.abs(px - c.x), Math.abs(py - c.y)) <= 1,
    );
    if (!inCloud) return [];

    this.lastCloudDamageTick = context.tick;
    return [
      {
        baseDamage: 1 + Math.floor(this.random() * 4), // WIKI: Toxic clouds deal 1-4 venom damage per tick interval.
        attackType: "typeless",
        hitsplatType: "venom",
        source: "Toxic cloud",
        playerPosition: [...player.position],
        // WIKI Strategies: clouds deal damage every tick but do not envenom.
      },
    ];
  }

  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }

  processPostTick(context) {
    if (this.pendingSnakelings.length > 0 && this.outcome.phase === "active") {
      const graphics = [];
      const zulrahSounds = [];
      const remaining = [];
      const newlySpawnedIds = [];
      for (const spec of this.pendingSnakelings) {
        if ((spec.spawnAtTick ?? 0) > context.tick) {
          remaining.push(spec);
          continue;
        }
        this.snakelingCounter += 1;
        const id = `snakeling_${this.snakelingCounter}`;
        const specType = spec.type ?? (this.random() < 0.5 ? "magic" : "melee");
        const npcTypeId = specType === "magic" ? zulrahNpcIds.snakelingMagic : zulrahNpcIds.snakelingMelee;
        const hitpoints = getMonsterHitpoints(npcTypeId);
        this.spawnedSnakelingIds.push(id);
        newlySpawnedIds.push(id);
        context.spawnNpc(
          snakelingNpc.createActor(
            {
              id,
              kind: "npc",
              role: "minion",
              npcTypeId,
              archetypeId: "snakeling",
              size: 1,
              alive: true,
              spawnTick: context.tick,
              lifetimeTicks: snakelingLifetimeTicks,
              position: [...spec.position],
              previousPosition: [...spec.position],
              facing: 0,
              history: new Map(),
              vitals: { hp: hitpoints, maxHp: hitpoints },
              formulaStats: structuredClone(getMonsterFormulaStats(npcTypeId)),
              combat: {
                attackSpeed: 4,
                attackRange: specType === "magic" ? 10 : 1,
                attackStyle: specType === "magic" ? "magic" : "melee",
                nextActionTick: context.tick + 2,
                targetId: "player",
                lastAttackTick: null,
                animations: { attack: specType === "magic" ? 2414 : 2408, death: 2407 },
              },
            },
            {},
          ),
        );
        graphics.push({
          spotAnimId: zulrahSpotIds.snakelingSpawn,
          target: { kind: "tile", position: [...spec.position] },
          height: 0,
          delayCycles: 0,
        });
        zulrahSounds.push({ id: 1930, range: 7, position: [...spec.position] });
      }
      this.pendingSnakelings = remaining;
      if (graphics.length) {
        emitZulrahVisual(context.tickEvents, {
          graphics,
          zulrahSounds,
          animations: newlySpawnedIds.map((sid) => ({ actorId: sid, clipId: "spawn", delayCycles: 0 })),
        });
      }
    }

    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) {
      this.outcome = { ...this.outcome, phase: "victory" };
    }
    return [];
  }

  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== zulrahActorId || completionOwnership !== "encounter-owned") return;
    for (const id of this.spawnedSnakelingIds) {
      if (context?.world?.getNpc(id)?.alive) {
        context.despawnNpc(id);
      }
    }
    this.activeClouds = [];
    this.pendingClouds = [];
    emitZulrahVisual(context.tickEvents, {
      zulrahSounds: [{ id: 2675, range: 15, position: zulrahSpots.CENTER }],
    });
    this.outcome = {
      phase: "resolving",
      decisiveTick: defeat.tick,
      completionTick: defeat.tick + ticksFromDefeatToVictory,
      primaryActorId: zulrahActorId,
      completionActorIds: [zulrahActorId],
    };
  }

  executeCommand(command, context) {
    if (command.encounter !== zulrahKind) return null;
    this.triggerOpenerEarly();
    const boss = context.world.getNpc(zulrahActorId);
    if (!boss?.alive) return null;

    if (command.type === nextPhaseCommand.type) {
      const phases = zulrahRotations[this.rotation] ?? zulrahRotations[1];
      const nextIdx = this.phaseIndex + 1 >= phases.length ? 1 : this.phaseIndex + 1;
      this.transitionToPhase(boss, nextIdx, context, { immediate: true });
      return { gameEvents: [] };
    }
    if (command.type === resetRotationCommand.type) {
      this.activeClouds = [];
      this.pendingClouds = [];
      this.pendingSnakelings = [];
      for (const id of this.spawnedSnakelingIds) {
        if (context.world.getNpc(id)?.alive) context.despawnNpc(id);
      }
      this.spawnedSnakelingIds = [];
      this.transitionToPhase(boss, 0, context, { immediate: false });
      return { gameEvents: [] };
    }
    if (command.type === jumpToJadCommand.type) {
      const phases = zulrahRotations[this.rotation] ?? zulrahRotations[1];
      const jadIndex = phases.findIndex((p) => p.pattern.startsWith("jad_"));
      this.transitionToPhase(boss, jadIndex >= 0 ? jadIndex : 0, context, { immediate: true });
      return { gameEvents: [] };
    }
    return null;
  }

  getOutcome() {
    return this.outcome;
  }

  getSnapshot() {
    const phases = zulrahRotations[this.rotation] ?? zulrahRotations[1];
    const current = this.getCurrentPhase();
    const next = this.getNextPhase();
    return {
      kind: zulrahKind,
      state: {
        rotation: this.rotation,
        phaseIndex: this.phaseIndex,
        phaseCount: phases.length,
        phaseState: this.phaseState,
        bossAnimation: { ...this.bossAnimation },
        playerStunned: this.currentTick < this.stunnedUntilTick,
        stunnedUntilTick: this.stunnedUntilTick,
        form: current.form,
        pattern: current.pattern,
        hint: current.hint,
        safeTiles: current.safeTiles,
        nextForm: next.form,
        nextPattern: next.pattern,
        nextSafeTiles: next.safeTiles,
        nextHint: next.hint,
        meleeTargetTile: this.pendingMeleeTarget,
        pendingClouds: this.pendingClouds.map(({ x, y }) => [x, y]),
        activeClouds: this.activeClouds.map(({ x, y }) => [x, y]),
      },
      visuals: {},
    };
  }

  getNpcDamageSourceLabel(npcId) {
    return npcId === zulrahActorId ? "Zulrah" : "Snakeling";
  }
}

export const zulrahDefinition = {
  kind: zulrahKind,
  factory: () => new ZulrahEncounter(),
  descriptor: {
    kind: zulrahKind,
    displayName: "Zulrah",
    description: "Zulrah's Shrine — 4 rotations, Jad phases, Snakelings, Toxic clouds & training aids.",
    mapSquare: zulrahMapSquare,
    mapSquareOffsets: zulrahMapSquareOffsets,
    playerStart,
    loadsMapLocs: true,
    isWorkInProgress: true,
    collision: { mode: "auto", seed: playerStart },
    victory: { title: "VICTORY", narrative: "ZULRAH DEFEATED", accent: "gold" },
    loadouts: zulrahLoadouts,
  },
  controls: {
    defaultMechanicsConfig: {
      [zulrahRotationKey]: "random",
      [zulrahTrainingOverlayKey]: true,
      [zulrahSnakelingsKey]: true,
      [zulrahToxicCloudsKey]: true,
    },
    mechanicsToggles: [
      {
        key: zulrahRotationKey,
        label: "Rotation",
        setup: true,
        wrap: true,
        choices: [
          { value: "random", label: "Random" },
          { value: "1", label: "R1 (Magma A)" },
          { value: "2", label: "R2 (Magma B)" },
          { value: "3", label: "R3 (Serp)" },
          { value: "4", label: "R4 (Tanza)" },
        ],
      },
      {
        key: zulrahTrainingOverlayKey,
        label: "Rotation & Safe-Tile Guide",
        group: "aid",
      },
      {
        key: zulrahSnakelingsKey,
        label: "Snakeling spawns",
      },
      {
        key: zulrahToxicCloudsKey,
        label: "Toxic clouds",
      },
    ],
    debugActions: [
      { command: nextPhaseCommand, label: "Next phase" },
      { command: jumpToJadCommand, label: "Jump to Jad phase" },
      { command: resetRotationCommand, label: "Restart rotation" },
    ],
  },
};

export { zulrahDefinition as definition };
export const order = 78;
