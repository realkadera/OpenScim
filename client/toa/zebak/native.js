import { configure, soloZebakHitpoints, zebakAutoMaxHit } from "./rules.js";
import { cyclesPerTick, spitClips, spitTiming, roarWindupTick, specialThrow } from "./timing.js";
import {CloudMotion} from "./cloud-motion.js";

import { ZebakPhases, phaseModels, acidScene } from "./phases.js";
const mapSquare = { x: 61, y: 84 };
const start = [29, 32];
const spitBurstHeight = 560;
const position = [14, 28];
const onBiteRow = ([x, y], depth) =>
  x >= position[0] + 9 && x < position[0] + 9 + depth &&
  y >= position[1] && y < position[1] + 9;
const withinBiteImpact = tile => onBiteRow(tile, 2);
// The proc rate, damage, and lifetimes are estimates. The two reach bands and
// damage increasing with movement are documented by Chompington/Zebak.
const bleed = { chance: 0.5, duration: 14, damage: [2, 10], trailLifetime: 6 };
const head = {
  npcTypeId: 11730,
  idleSeqId: 9618,
  attackClips: {
    attack: 9624,
    ...spitClips(9624, 9626),
    enrage: 9626,
    roar: 9628,
    special: 9632,
    tail: 9630,
    melee: 9620,
    enragedMelee: 9622,
  },
  deathSeqId: 9634,
  bossDeathAnimationEnabled: true,
};
const tail = {
  npcTypeId: 11731,
  idleSeqId: 9619,
  attackClips: {
    attack: 9625,
    ...spitClips(9625, 9627),
    enrage: 9627,
    roar: 9629,
    special: 9633,
    tail: 9631,
    melee: 9621,
    enragedMelee: 9623,
  },
  deathSeqId: 9635,
};
const renderConfig = {
  terrainMapSquare: mapSquare,
  locRender: { bounds: null, levels: [0, 1, 2] },
  primaryNpc: {
    actorId: "zebak",
    npcTypeId: 11730,
    basePosition: position,
    size: 9,
    deathSeqId: 9634,
  },
  createSceneObjectController: acidScene,
  preloadNpcTypes: [head, tail, { ...head, npcTypeId: 11732 }, ...phaseModels],
  spotAnimIds: [
    2176, 2177, 2178, 2179, 2181, 2182, 2185, 2186, 2187, 2188, 2189, 2190,
    2172, 2173, 2194, 2184, 2191, 2192, 2193, 2195, 2174, 1556, 68, 95, 2449, 377, 2128,
  ],
};
export const zebakPresentation = (BaseScene) => ({
  kind: "zebak",
  renderConfig,
  sceneBuilder(context) {
    class ZebakScene extends BaseScene {
      cloudPositions = new WeakMap();
      getPlayingSequenceFrames() {
        const poses = super.getPlayingSequenceFrames();
        // The recorded roar and ground hits have the same mix level across the arena.
        // A null position plays the head sequence through the effects volume at unity.
        for (const pose of poses) {
          if (pose.seqId === head.attackClips.roar) pose.position = null;
        }
        return poses;
      }
      syncNpcInstances(npcs, hidden, state, paused) {
        const manager = this.npcInstanceManager;
        for (const npc of npcs) {
          const id = this.getNpcRenderInstanceId(npc.id);
          const current = manager.instanceRegistry.get(id);
          if (current && current.npcTypeId !== npc.npcTypeId && this.isNpcTypeLoaded(npc.npcTypeId))
            manager.removeInstance(id);
        }
        super.syncNpcInstances(npcs, hidden, state, paused);
        if (hidden || !state) return;
        for (const npc of npcs) {
          if (npc.npcTypeId !== 11742 && npc.npcTypeId !== 11743) continue;
          const model = manager.instanceRegistry.get(npc.id);
          if (!model) continue;
          let motion = this.cloudPositions.get(model);
          if (!motion) {
            motion = new CloudMotion();
            this.cloudPositions.set(model, motion);
          }
          const position = motion.sample(npc.position, npc.previousPosition, state.currentTick, this.primaryCycle);
          model.lastRenderPosition = position;
          manager.setInstancePositionAndFacing(npc.id, position, npc.size, model.lastRenderFacingAngle);
          manager.movementByActorId.set(npc.id, motion.waypoints.length > 0);
        }
      }
      setTerrainHeightsAndBounds(map, bounds) {
        // Actors and ground effects stand on the raised surface where the cache marks a bridge.
        const heights = map.tileHeights[0].map((column, x) =>
          column.map((height, y) =>
            map.tileRenderFlags[1]?.[x]?.[y] & 2
              ? map.tileHeights[1][x][y]
              : height,
          ),
        );
        super.setTerrainHeightsAndBounds(
          { ...map, tileHeights: [heights, ...map.tileHeights.slice(1)] },
          bounds,
        );
      }
    }
    const scene = new ZebakScene();
    scene.setEncounterRenderConfig(renderConfig);
    scene.setGroundItemLoaderSource(context.cacheManager);
    scene.setEventAudioPlayer(context.eventAudioPlayer);
    scene.setFrameSoundTracker(context.frameSoundTracker);
    return scene;
  },
  audio: {
    layerName: "zebak",
    rules: {
      inferno_visual: {
        preloadIds: [5860, 5836, 5845, 5904, 5838, 5851, 5863, 5829, 5881, 5888, 5852, 102, 5908, 5909, 5867, 5882, 5880],
        resolve(event) {
          if (event.greatRoarStart) return {kind: "play", sound: [
            {id: 5845, delayCycles: 32, channel: "sfx"},
            {id: 5904, delayCycles: 69, channel: "sfx"},
          ]};
          if (event.tidalSurgeSound) return {kind: "play", sound: {id: 5852, delayCycles: 20, channel: "sfx"}};
          if (event.projectiles?.some(cue => cue.spotAnimId === 2173))
            return {kind: "play", sound: {id: 5908, delayCycles: specialThrow.sound, channel: "sfx"}};
          if (event.objectsLanded) return {kind: "play", sound: {id: 5867, channel: "sfx"}};
          if (event.graphics?.some(cue => cue.spotAnimId === 1556))
            return {kind: "play", sound: {id: 5909, delayCycles: cyclesPerTick, channel: "sfx"}};
          if (event.graphics?.some(cue => cue.spotAnimId === 2195)) {
            const delay = event.shoreSoundDelayCycles ?? 0;
            return {kind: "play", sound: [
              {id: 5882, delayCycles: delay, channel: "sfx"},
              {id: 5880, delayCycles: delay + 200, channel: "sfx"},
            ]};
          }
          if (event.graphics?.length === 1 && event.graphics[0].spotAnimId === 2449)
            return {kind: "play", sound: {id: 5880, channel: "sfx"}};
          if (event.graphics?.some(cue => cue.spotAnimId === 377 && cue.target.actorId === "player"))
            return {kind: "play", sound: {id: 102, channel: "sfx"}};
          if (event.roarPulse !== undefined) {
            const id = [5829, 5881, 5888][event.roarPulse];
            if (id) return {kind: "play", sound: {id, channel: "sfx"}};
          }
          return {kind: "pass"};
        },
      },
      zuk_attack: {
        preloadIds: [5819, 5823, 5878, 5896, 5884],
        resolve(event) {
          if (event.attack !== "zebak_magic" && event.attack !== "zebak_range") return {kind: "pass"};
          const magic = event.attack === "zebak_magic";
          const impactTicks = event.impactTick - event.launchTick;
          const redirectTicks = (impactTicks + 1) / 2;
          return {
            kind: "play",
            sound: [
              {id: magic ? 5823 : 5819, channel: "sfx"},
              {id: magic ? 5878 : 5896, delayCycles: redirectTicks * cyclesPerTick, channel: "sfx"},
              {id: 5884, delayCycles: impactTicks * cyclesPerTick, channel: "sfx"},
            ],
          };
        },
      },
    },
  },
  defaultCamera: { yaw: 90, pitch: -40, zoom: 240 },
  presentation: {
    title: "Zebak",
    tagline: "Tombs of Amascut",
    setupContext: "Path of Crondis",
    blurb: "Solo Zebak. Great Roar, Tidal Waves and blood magic.",
    portrait: {
      npcTypeId: 11730,
      framing: { yaw: -30, pitch: -12, focusHeight: 0.65, span: 0.65 },
    },
  },
});
export function zebakDefinition({
  stats,
  seedRandom,
  walkable,
  makeCollision,
  solidFlag,
  rollAttack,
  showAttack,
  projectile,
  animate,
  startNpcDeath,
}) {
  class ZebakEncounter {
    kind = "zebak";
    constructor() {
      this.reset();
    }
    reset(seeds) {
      this.seed = seeds?.encounterSeed ?? Math.floor(Math.random() * 2 ** 32);
      this.random = seedRandom(this.seed);
      this.outcome = { phase: "active" };
      this.tailRemovalTick = null;
      this.attackTick = 4;
      this.phases = new ZebakPhases(this.random, walkable, animate);
      this.pendingBarrages = new Set();
      this.pendingBloodClouds = new Set();
      this.bloodSpellIndex = 0;
      this.autoCount = 0;
      this.firstEnragedAttack = false;
      this.bleedStart = null;
      this.bloodTrail = new Map();
    }
    getSeeds() {
      return { encounterSeed: this.seed };
    }
    getDefaultPlayerStart() {
      return [...start];
    }
    getDefaultMechanicsConfig() {
      return { path: "0", other: "0" };
    }
    getIntroConfig() {
      return null;
    }
    getArenaConfig() {
      return { bounds: null, collisionMap: null, walkableTiles: null };
    }
    refineArenaConfig(arena) {
      if (!arena.collisionMap) return arena;
      const map = makeCollision(
        arena.collisionMap.sizeX,
        arena.collisionMap.sizeY,
      );
      map.flags.set(arena.collisionMap.flags);
      this.phases.setRockCollision = (p, blocked) =>
        blocked ? map.flag(...p, solidFlag) : map.unflag(...p, solidFlag);
      for (const rock of this.phases.of("rock"))
        this.phases.setRockCollision(rock.actor.position, true);
      return { ...arena, collisionMap: map };
    }
    getNpcDamageSourceLabel() {
      return "Zebak";
    }
    getOutcome() {
      return this.outcome;
    }
    getSnapshot() {
      return { kind: this.kind, state: {
        ...this.phases.snapshot(), bloodTrail: [...this.bloodTrail.values()].map(mark => mark.position),
      }, visuals: {} };
    }
    resolveHazards(context) {
      const boss = context.world.actors.get("zebak");
      const hits = this.phases.step(context, this.settings, boss);
      if (boss?.alive && this.pendingBloodClouds.delete(context.tick))
        this.phases.summonClouds(context, this.settings, context.world.actors.get("player"));
      if (this.pendingBarrages.delete(context.tick)) {
        this.phases.graphics(context, [{
          spotAnimId: 377,
          target: {kind: "actor", actorId: "player", size: 1, position: [...context.playerPos]},
          height: 0,
          delayCycles: 0,
        }]);
        hits.push({
          source: "Blood Barrage",
          attackType: "magic",
          baseDamage: [8, 12],
          ...(this.settings.quiet
            ? { prayerReduction: { type: "reduce", value: 0.1 } }
            : {}),
        });
      }
      if (boss?.debuffs)
        boss.debuffs.defenceDrain = Math.min(
          20,
          boss.debuffs.defenceDrain ?? 0,
        );
      return hits;
    }
    executeCommand(command, context) {
      return this.phases.command(command, context);
    }
    moveDisplacedPlayer(player, target, place) {
      return this.phases.moveWithTide(player, target, place);
    }
    approachRange(targetId, weaponRange) {
      if (this.phases.pendingJug?.id !== targetId) return undefined;
      return this.phases.pendingJug.action === "Hit" ? weaponRange : 1;
    }
    moveNpc(actor) {
      return this.phases.movementFor(actor);
    }
    processPostTick(context) {
      if (this.tailRemovalTick !== null && context.tick >= this.tailRemovalTick) {
        context.despawnNpc("zebak-tail");
        this.tailRemovalTick = null;
      }
      if (
        this.outcome.phase === "resolving" &&
        context.tick >= this.outcome.completionTick
      )
        this.outcome = { ...this.outcome, phase: "victory" };
      const hits = this.phases.resolveCloudContact(context, this.settings);
      for (const [key, mark] of this.bloodTrail) {
        if (context.tick >= mark.expires) this.bloodTrail.delete(key);
      }
      const player = context.world.actors.get("player");
      if (this.bleedStart !== null && context.tick > this.bleedStart && player?.alive) {
        const path = player.movementPath ?? [];
        if (path.length) {
          // Mark each tile the player leaves, including the intermediate running step.
          for (const tile of [player.previousPosition, ...path.slice(0, -1)]) {
            this.bloodTrail.set(tile.join(","), {position: [...tile], expires: context.tick + bleed.trailLifetime});
          }
        }
        if (path.length || context.tick === this.bleedStart + 1)
          hits.push({source: "Zebak bleed", attackType: "typeless", baseDamage: bleed.damage});
        if (context.tick >= this.bleedStart + bleed.duration) this.bleedStart = null;
      }
      return hits;
    }
    configureRunStart(mechanics, context) {
      this.settings = {
        ...configure(mechanics),
        quiet: mechanics.quiet === true,
      };
      const hp = soloZebakHitpoints(this.settings.raid, this.settings.path);
      for (const id of ["zebak", "zebak-tail"]) {
        const npc = context?.world.actors.get(id);
        if (!npc) continue;
        const damage = npc.vitals.maxHp - npc.vitals.hp;
        npc.vitals = { hp: Math.max(0, hp - damage), maxHp: hp };
        npc.formulaStats.toaRaidLevel = this.settings.raid;
        npc.combat.attackSpeed = this.settings.period;
      }
    }
    createNpcs() {
      const hp = soloZebakHitpoints(this.settings.raid, this.settings.path);
      return [head, tail].map((model, index) => ({
        id: index ? "zebak-tail" : "zebak",
        kind: "npc",
        role: index ? "npc" : "boss",
        npcTypeId: model.npcTypeId,
        archetypeId: index ? "zebak-tail" : "zebak",
        size: 9,
        alive: true,
        facing: 1536,
        lockedFacing: 1536,
        untargetable: Boolean(index),
        blocksNpcMovement: false,
        position: [...position],
        previousPosition: [...position],
        history: new Map(),
        vitals: { hp, maxHp: hp },
        formulaStats: { ...structuredClone(stats(11730)), toaRaidLevel: this.settings.raid },
        combat: {
          attackSpeed: this.settings.period,
          attackRange: 64,
          attackStyle: "ranged",
          nextActionTick: 0,
          targetId: index ? null : "player",
          lastAttackTick: null,
          animations: {
            idle: model.idleSeqId,
            walk: null,
            run: null,
            attack: model.attackClips.attack,
            death: model.deathSeqId,
          },
        },
      }));
    }
    getEngineRules() {
      return {
        isTombsOfAmascut: true,
        validateAttack: (_, id) =>
          this.phases.water || id === "zebak-tail" || this.phases.actors.has(id)
            ? false
            : null,
        onPlayerDamageTaken: (hit) => {
          if (hit.source === "Blood Barrage" && this.boss)
            this.boss.vitals.hp = Math.min(
              this.boss.vitals.maxHp,
              this.boss.vitals.hp +
                hit.effectiveDamage * (this.settings.spray ? 3 : 2),
            );
          if (hit.sourceNpcTypeId === 11730 || hit.sourceNpcTypeId === 11732) {
            if (
              hit.attackType === "melee" &&
              this.random() < bleed.chance
            )
              this.bleedStart = hit.tick;
          }
        },
      };
    }
    processNpcTick(actor, context) {
      const result = { environmentalDamages: [] };
      if (actor.id !== "zebak") return result;
      this.boss = actor;
      if (this.phases.enraged && actor.npcTypeId !== 11732) {
        actor.npcTypeId = 11732;
        actor.combat.attackSpeed = this.settings.enragePeriod;
        this.firstEnragedAttack = true;
        // Keep a shot already due. An interrupted special cannot hold the boss
        // past the ordinary attack period on entering enrage.
        this.attackTick = Math.min(this.attackTick, context.tick + this.settings.period);
      }
      if (context.tick < this.attackTick) return result;
      if (this.phases.active) {
        const phase = this.phases.active;
        const elapsed = context.tick - phase.start;
        if (phase.kind === "roar" ? elapsed >= roarWindupTick(this.settings.period, phase.secondRoar) : elapsed < 16) return result;
      }
      if (this.phases.queue.length && this.phases.canBegin(context.tick)) {
        const kind = this.phases.queue.shift();
        this.phases.begin(context, kind, this.settings);
        this.attackTick = context.tick + (kind === "roar" ? 10 : this.settings.period);
        return result;
      }
      const player = context.world.actors.get("player");
      if (!player?.alive) return result;
      const enraged = this.phases.enraged;
      // At path 4 the first enraged spit at 624.98s recovered for five ticks,
      // then every spit from 627.99s onward recovered for two.
      const recovery = enraged && !this.firstEnragedAttack ? this.settings.enragePeriod : this.settings.period;
      this.attackTick = context.tick + recovery;
      this.firstEnragedAttack = false;
      if (this.settings.blood && !this.phases.active && ++this.autoCount >= (enraged ? 8 : 6)) {
        this.autoCount = 0;
        const due = context.tick + 3;
        if (this.bloodSpellIndex === 0) {
          this.pendingBloodClouds.add(due);
        } else {
          this.pendingBarrages.add(due);
          const [x, y] = actor.position;
          this.phases.graphics(context, [2, 6].map(handY => ({
            spotAnimId: 377,
            target: {kind: "tile", position: [x + 7, y + handY]},
            height: 16,
            delayCycles: 0,
          })));
        }
        this.bloodSpellIndex = (this.bloodSpellIndex + 1) % 3;
      }
      const melee = onBiteRow(player.position, 1);
      const magic = !melee && this.random() < 0.5;
      const timing = spitTiming(this.settings.path, enraged);
      const delay = melee ? 1 : timing.impactTicks;
      const clipId = melee
        ? enraged
          ? "enragedMelee"
          : "melee"
        : timing.clipId;
      const plan = {
        formulaStyle: melee ? "melee_crush" : magic ? "magic" : "ranged",
        damageType: melee ? "melee" : magic ? "magic" : "range",
        attackKind: melee
          ? "melee_crush"
          : magic
            ? "magic_fire"
            : "range_arrow",
        maxHit: zebakAutoMaxHit(melee, this.settings.raid, this.settings.path),
        prayerCheckAt: melee ? "launch" : "impact",
        impactDelayTicks: delay,
        sourceDeathPolicy: "persist",
      };
      const hit = rollAttack({
        attacker: actor,
        target: player,
        plan,
        random: this.random,
      });
      if (hit) {
        if (!melee && this.settings.quiet)
          hit.prayerReduction = { type: "reduce", value: 0.1 };
        if (melee) {
          hit.canHitPosition = withinBiteImpact;
          hit.prayerReduction = { type: "reduce", value: 0.25 };
          if (player.activePrayer === "ProtectMelee" && this.random() < 0.5)
            hit.accuracySucceeded = false;
        }
        result.npcAttacks = [hit];
      }
      const projectiles = [];
      const graphics = [];
      if (!melee) {
        const { release: launchCycle, split: splitCycle } = timing;
        const mouth = timing.mouth;
        const origin = [actor.position[0] + mouth.x, actor.position[1] + mouth.y];
        // The intact projectile flies toward the arena centerline. The pieces
        // acquire the player after the burst. Off-axis recordings show both legs.
        const split = [actor.position[0] + 15, actor.position[1] + 4];
        const flight = (spotAnimId, delay, startHeight, endHeight, slope) =>
          projectile(actor, player, {
            spotAnimId, timing: { delay, progress: 0 }, slope, startHeight, endHeight,
          }, timing.arrival);
        const sourcePosition = split.map(v => v + 0.5);
        const distanceToBurst = Math.hypot(sourcePosition[0] - origin[0], sourcePosition[1] - origin[1]);
        // The floor under the burst is 0.9 tiles higher than under the jaw.
        // The intact pot is still rising at midflight and levels out at the split.
        const rise = (spitBurstHeight - mouth.height) / 128 + 0.9;
        const slope = Math.round(128 / Math.PI * Math.atan2(2 * rise, distanceToBurst));
        projectiles.push({
          ...flight(magic ? (enraged ? 2177 : 2176) : enraged ? 2179 : 2178,
            launchCycle, mouth.height, spitBurstHeight, slope),
          sourcePosition: origin,
          target: { kind: "tile", position: split },
          endDelayCycles: splitCycle,
        });
        projectiles.push({
          ...flight(magic ? 2181 : 2182, splitCycle, spitBurstHeight, 64, 0),
          sourcePosition,
        });
        graphics.push({
          spotAnimId: magic ? 2186 : 2185,
          target: { kind: "tile", position: split },
          height: spitBurstHeight,
          delayCycles: splitCycle,
        });
        if (!magic) {
          [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ].forEach(([dx, dy], i) =>
            projectiles.push({
              ...flight(2187 + i, splitCycle, spitBurstHeight, 0, 0),
              sourcePosition,
              target: {
                kind: "tile",
                position: [split[0] + dx, split[1] + dy],
              },
            }),
          );
        }
      }
      showAttack(context, {
        actor,
        target: player,
        kind: melee ? "zebak_melee" : magic ? "zebak_magic" : "zebak_range",
        clipId,
        impactDelayTicks: delay,
        projectiles,
      });
      animate(context.tickEvents, {
        animations: [{ actorId: "zebak-tail", clipId, delayCycles: 0 }],
        projectiles: [],
        graphics,
      });
      return result;
    }
    onNpcDefeated(defeat, context, owner) {
      if (defeat.npcId !== "zebak") return;
      this.phases.finish(context);
      this.pendingBarrages.clear();
      this.pendingBloodClouds.clear();
      const tailActor = context.world.actors.get("zebak-tail");
      const completionTick = defeat.tick + 5;
      if (tailActor?.alive) {
        tailActor.vitals.hp = 0;
        startNpcDeath(tailActor, defeat.tick);
        context.tickEvents.emit({type: "actor_died", actorId: tailActor.id});
        this.tailRemovalTick = completionTick;
      }
      if (owner === "encounter-owned")
        this.outcome = {
          phase: "resolving",
          decisiveTick: defeat.tick,
          completionTick,
          primaryActorId: "zebak",
          completionActorIds: ["zebak", "zebak-tail"],
        };
    }
  }
  return {
    kind: "zebak",
    factory: () => new ZebakEncounter(),
    descriptor: {
      kind: "zebak",
      displayName: "Zebak",
      description: "Tombs of Amascut",
      playerStart: start,
      mapSquare,
      loadsMapLocs: true,
      isWorkInProgress: true,
      collision: { mode: "auto", seed: start },
      victory: {
        title: "VICTORY",
        narrative: "ZEBAK DEFEATED",
        accent: "gold",
      },
    },
    controls: {
      defaultMechanicsConfig: { path: "0", other: "0" },
      mechanicsToggles: [
        ...Object.entries({
          quiet: "Quiet Prayers (+20)",
          blood: "Not Just a Head (+15)",
          spray: "Arterial Spray (+10)",
          clouds: "Blood Thinners (+5)",
          upset: "Upset Stomach (+15)",
        }).map(([key, label]) => ({ key, label, setup: true })),
        {
          key: "path",
          label: "Path level",
          setup: true,
          choices: Array.from({ length: 7 }, (_, n) => ({
            value: String(n),
            label: String(n),
          })),
        },
        {
          key: "other",
          label: "Other raid points",
          setup: true,
          choices: [
            0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600,
          ].map((n) => ({ value: String(n), label: String(n) })),
        },
      ],
      debugActions: [],
    },
  };
}
