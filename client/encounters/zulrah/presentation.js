// Zulrah presentation: loads Zulrah's Shrine terrain, Zulrah forms, Snakelings, safe-tile markers, and coach overlay.
import { buildScene } from "../shared/buildScene.js";
import { clientCyclesPerTick, sampleBossAnimation } from "./animations.js";
import { zulrahAudio } from "./audio.js";
import {
  zulrahActorId,
  zulrahCenterStart,
  zulrahKind,
  zulrahLocIds,
  zulrahMapSquare,
  zulrahMapSquareOffsets,
  zulrahNpcIds,
  zulrahSeqIds,
  zulrahSpotIds,
  zulrahTrainingOverlayKey,
} from "./encounter.js";

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// Scene object controller rendering Zulrah's animated 3D toxic clouds (loc 11700, 3x3 footprint).
const cloudScene = () => ({
  consumeEvents() {},
  update({ state }) {
    const clouds = state.encounter?.state?.activeClouds ?? [];
    return clouds.map(([cx, cy]) => {
      const id = `zulrah-cloud-${cx}-${cy}`;
      return {
        id,
        meshId: id,
        materialId: "osrs-npc",
        modelMatrix: identity,
        lifecycle: { kind: "sync" },
        classification: "groundDecal",
        data: {
          kind: "loc",
          locId: zulrahLocIds.toxicCloud,
          modelType: 10,
          rotation: 0,
          localX: cx - 1,
          localY: cy - 1,
          level: 0,
          seqId: -1,
        },
      };
    });
  },
});

const zulrahClips = {
  shoot: zulrahSeqIds.shoot,
  submerge: zulrahSeqIds.submerge,
  emerge: zulrahSeqIds.emerge,
  initialRise: zulrahSeqIds.initialRise,
  meleeFocus: zulrahSeqIds.meleeFocus,
  meleeAttack: zulrahSeqIds.meleeAttack,
};

const renderConfig = {
  terrainMapSquare: zulrahMapSquare,
  mapSquareOffsets: zulrahMapSquareOffsets,
  locRender: { bounds: null, levels: [0, 1] },
  primaryNpc: {
    actorId: zulrahActorId,
    npcTypeId: zulrahNpcIds.serpentine,
    basePosition: zulrahCenterStart,
    size: 5,
    deathSeqId: zulrahSeqIds.submerge,
  },
  createSceneObjectController: cloudScene,
  spotAnimIds: [
    zulrahSpotIds.rangedProjectile,
    zulrahSpotIds.toxicCloud,
    zulrahSpotIds.magicProjectile,
    zulrahSpotIds.snakelingSpawn,
    zulrahSpotIds.snakelingMagic,
    zulrahSpotIds.stunned,
  ],
  preloadNpcTypes: [
    {
      npcTypeId: zulrahNpcIds.serpentine,
      idleSeqId: zulrahSeqIds.idle,
      attackClips: zulrahClips,
      deathSeqId: zulrahSeqIds.submerge,
      bossDeathAnimationEnabled: true,
    },
    {
      npcTypeId: zulrahNpcIds.magma,
      idleSeqId: zulrahSeqIds.idle,
      attackClips: zulrahClips,
      deathSeqId: zulrahSeqIds.submerge,
      bossDeathAnimationEnabled: true,
    },
    {
      npcTypeId: zulrahNpcIds.tanzanite,
      idleSeqId: zulrahSeqIds.idle,
      attackClips: zulrahClips,
      deathSeqId: zulrahSeqIds.submerge,
      bossDeathAnimationEnabled: true,
    },
    {
      npcTypeId: zulrahNpcIds.snakelingMelee,
      idleSeqId: 2405,
      attackClips: { attack: 2408, spawn: 2413 },
      deathSeqId: 2407,
    },
    {
      npcTypeId: zulrahNpcIds.snakelingMagic,
      idleSeqId: 2405,
      attackClips: { attack: 2414, magicAttack: 2414, spawn: 2413 },
      deathSeqId: 2407,
    },
  ],
};

const FORM_COLORS = {
  serpentine: "#4ade80",
  magma: "#f87171",
  tanzanite: "#60a5fa",
};

const FORM_LABELS = {
  serpentine: "Serpentine (Range)",
  magma: "Magma (Melee)",
  tanzanite: "Tanzanite (Mage)",
};

const ROTATION_NAMES = {
  1: "R1 (Magma A)",
  2: "R2 (Magma B)",
  3: "R3 (Serp)",
  4: "R4 (Tanza)",
};

let coachElement = null;

function removeCoachOverlay() {
  coachElement?.remove();
  coachElement = null;
}

function syncCoachOverlay(state, enabled) {
  if (!enabled || !state) {
    removeCoachOverlay();
    return;
  }
  const viewport = document.querySelector(".scene-viewport");
  if (!viewport) return;

  if (!coachElement || !viewport.contains(coachElement)) {
    removeCoachOverlay();
    coachElement = document.createElement("div");
    coachElement.style.cssText =
      "position:absolute;top:12px;left:12px;z-index:20;pointer-events:none;" +
      "background:rgba(12,14,18,0.82);border:1px solid rgba(255,255,255,0.14);" +
      "border-radius:8px;padding:8px 12px;color:#e5e7eb;font:12px/1.45 system-ui,sans-serif;" +
      "max-width:380px;backdrop-filter:blur(4px);box-shadow:0 4px 12px rgba(0,0,0,0.4);";
    viewport.appendChild(coachElement);
  }

  const formColor = FORM_COLORS[state.form] ?? "#e5e7eb";
  const nextColor = FORM_COLORS[state.nextForm] ?? "#9ca3af";
  const formLabel = FORM_LABELS[state.form] ?? state.form;
  const nextLabel = FORM_LABELS[state.nextForm] ?? state.nextForm;
  const rotationTitle = ROTATION_NAMES[state.rotation] ?? `Rotation ${state.rotation}`;

  coachElement.replaceChildren();

  const header = document.createElement("div");
  header.style.cssText = "font-weight:600;margin-bottom:2px;";
  header.textContent = `${rotationTitle} · Phase ${state.phaseIndex + 1}/${state.phaseCount} · `;
  const formSpan = document.createElement("span");
  formSpan.style.color = formColor;
  formSpan.textContent = formLabel;
  header.appendChild(formSpan);

  if (["submerging", "submerged", "emerging", "recovering"].includes(state.phaseState) || state.pendingClouds?.length) {
    const statusSpan = document.createElement("span");
    statusSpan.style.marginLeft = "6px";
    statusSpan.style.fontSize = "11px";
    if (state.phaseState === "submerging") {
      statusSpan.style.color = "#fbbf24";
      statusSpan.textContent = "(Diving...)";
    } else if (state.phaseState === "submerged") {
      statusSpan.style.color = "#38bdf8";
      statusSpan.textContent = "(Submerged...)";
    } else if (state.phaseState === "emerging") {
      statusSpan.style.color = "#38bdf8";
      statusSpan.textContent = "(Surfacing...)";
    } else if (state.phaseState === "recovering") {
      statusSpan.style.color = "#9ca3af";
      statusSpan.textContent = "(Recovering...)";
    } else {
      statusSpan.style.color = "#a3e635";
      statusSpan.textContent = "(Venom incoming!)";
    }
    header.appendChild(statusSpan);
  }

  const hint = document.createElement("div");
  hint.style.cssText = "color:#f3f4f6;margin-bottom:4px;";
  hint.textContent = state.playerStunned
    ? "STUNNED: the tail slam has stopped movement."
    : state.meleeTargetTile
    ? "DODGE! Step 2 tiles off the red tile!"
    : (state.hint ?? "");

  const nextRow = document.createElement("div");
  nextRow.style.cssText = "font-size:11px;color:#9ca3af;";
  nextRow.textContent = "Next: ";
  const nextSpan = document.createElement("span");
  nextSpan.style.color = nextColor;
  nextSpan.textContent = nextLabel;
  nextRow.appendChild(nextSpan);

  coachElement.append(header, hint, nextRow);
}

function isTileInClouds(tile, clouds) {
  if (!tile || !clouds?.length) return false;
  const [tx, ty] = tile;
  return clouds.some(([cx, cy]) => Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) <= 1);
}

function pickSafeTile(candidates, activeClouds, pendingClouds) {
  if (!candidates?.length) return null;
  const clear = candidates.find(
    (tile) => !isTileInClouds(tile, activeClouds) && !isTileInClouds(tile, pendingClouds),
  );
  if (clear) return clear;
  const notActive = candidates.find((tile) => !isTileInClouds(tile, activeClouds));
  return notActive ?? candidates[0];
}

function buildZulrahMarkers(input) {
  const state = input.simulationState?.encounter?.state;
  const mechanicsConfig = input.simulationState?.mechanicsConfig;
  const showGuide = mechanicsConfig?.[zulrahTrainingOverlayKey] ?? true;

  syncCoachOverlay(state, showGuide);

  if (!state) return input;
  const markers = [];

  if (showGuide) {
    const standTile = pickSafeTile(state.safeTiles, state.activeClouds, state.pendingClouds);
    const nextTile = pickSafeTile(state.nextSafeTiles, state.activeClouds, null);
    if (standTile) {
      markers.push({ x: standTile[0], y: standTile[1], color: "#22C55E", opacity: 0.34, label: "Stand" });
    }
    if (nextTile && (!standTile || nextTile[0] !== standTile[0] || nextTile[1] !== standTile[1])) {
      markers.push({ x: nextTile[0], y: nextTile[1], color: "#38BDF8", opacity: 0.22, label: "Move Next" });
    }
  }

  if (state.meleeTargetTile) {
    const [x, y] = state.meleeTargetTile;
    markers.push({ x, y, color: "#EF4444", opacity: 0.45, label: "DODGE!" });
  }

  const seenPendingTiles = new Set();
  for (const [cx, cy] of state.pendingClouds ?? []) {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const x = cx + dx;
        const y = cy + dy;
        const key = `${x},${y}`;
        if (seenPendingTiles.has(key)) continue;
        seenPendingTiles.add(key);
        markers.push({
          x,
          y,
          color: "#F59E0B",
          opacity: 0.34,
          label: dx === 0 && dy === 0 ? "Venom" : "",
        });
      }
    }
  }

  // Active clouds are drawn as animated 3D game objects (loc 11700) via cloudScene, not flat tile markers.

  if (markers.length === 0) return input;
  const options = input.options ?? {};
  return {
    ...input,
    options: { ...options, showTileMarkers: true },
    tileMarkers: [...(options.showTileMarkers ? (input.tileMarkers ?? []) : []), ...markers],
  };
}

export const zulrahPresentation = (BaseScene) => ({
  kind: zulrahKind,
  renderConfig,
  audio: zulrahAudio,
  sceneBuilder(context) {
    class ZulrahScene extends BaseScene {
      // Keep the boss pose on the simulation clock. A newly created colour
      // variant, a paused frame or a replay seek must not lose its visual cue.
      syncNpcInstances(npcs, ...rest) {
        for (const npc of npcs ?? []) {
          const id = this.getNpcRenderInstanceId(npc.id);
          const drawn = this.npcInstanceManager.instanceRegistry.get(id);
          if (drawn && drawn.npcTypeId !== npc.npcTypeId && this.isNpcTypeLoaded(npc.npcTypeId)) {
            this.npcInstanceManager.removeInstance(id);
          }
        }
        return super.syncNpcInstances(npcs, ...rest);
      }

      getEncounterAttackTriggers(state, tick = state.currentTick) {
        const result = super.getEncounterAttackTriggers(state, tick);
        this.restoreBossAnimation(state, tick * clientCyclesPerTick);
        return result;
      }

      restoreEncounterPrimaries(input) {
        const restored = super.restoreEncounterPrimaries(input);
        if (restored) this.restoreBossAnimation(input.simulationState, this.primaryCycle);
        return restored;
      }

      restoreBossAnimation(state, cycle) {
        const boss = state.npcs.find((npc) => npc.id === zulrahActorId);
        if (!boss?.alive) return; // Let the base scene own the death clip.
        const instance = this.npcInstanceManager.instanceRegistry.get(this.getNpcRenderInstanceId(zulrahActorId));
        const controller = instance?.animController;
        if (!controller) return;
        const sample = sampleBossAnimation(state.encounter.state.bossAnimation, cycle);
        const clip = sample && controller.animationSet.attackClips?.[sample.clipId];
        // restorePrimaryAt restores an animation track without priority arbitration; the
        // encounter has already serialized attacks, recovery, dive and surface.
        controller.restorePrimaryAt(clip ? {
          clip,
          elapsedTicks: Math.floor(sample.elapsed),
          duration: sample.duration,
          delayClientTicks: 0,
          remainderMs: (sample.elapsed % 1) * 20, // CACHE: milliseconds per client cycle.
        } : null);
      }

      resolveHiddenNpcModels(npcs, options) {
        const hidden = super.resolveHiddenNpcModels(npcs, options);
        if (!this.zulrahSubmerged) return hidden;
        const bossId = this.getNpcRenderInstanceId(zulrahActorId);
        return (id, ...args) => id === bossId || hidden?.(id, ...args) === true;
      }

      build(input, camera, ...rest) {
        this.zulrahSubmerged = input.simulationState?.encounter?.state?.phaseState === "submerged";
        return super.build(buildZulrahMarkers(input), camera, ...rest);
      }

      getAllNpcHitTestData() {
        const entries = super.getAllNpcHitTestData();
        if (!this.zulrahSubmerged) return entries;
        const bossId = this.getNpcRenderInstanceId(zulrahActorId);
        return entries.filter(({ actorId }) => actorId !== bossId);
      }

      dispose(...rest) {
        removeCoachOverlay();
        return super.dispose?.(...rest);
      }
    }
    return buildScene(ZulrahScene, renderConfig, context);
  },
  defaultCamera: { yaw: 180, pitch: -45, zoom: 420 },
});

export { zulrahPresentation as presentation };
