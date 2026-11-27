// The other players of the lobby as the lobby scene draws them: one entry per
// player of the store (remotePlayersStore.js), each with its own walk tracker,
// its own rig and its own model matrix. Presentation only: nothing here
// reaches the simulation, a replay or collision.
//
//   setRemotePlayersSource(players)   what the lobby scene draws, or null:
//                                     { list(), getById?(id) }, the store
//   getRemotePlayersSource()
//
//   const remotes = createRemotePlayers({
//     buildRig(appearance, equipment, id),  the renderer's rig, or null; may throw
//     makeTracker(x, y),                    a PlayerVisualTracker at a tile
//     isValidKit(kit, bodyPart),            optional: does the cache have this kit
//                                           for this body part (0 hair .. 6 feet)
//     maxDrawn,                             REMOTE_DRAW_MAX
//     onError(error),                       optional, told once per kind of failure
//   });
//   remotes.update(records, { localPosition, deltaMs })  each frame; returns
//                                     the entries to draw, nearest first
//   remotes.hitTestData()             [{ actorId: id, name, hitTestData }] of those
//   remotes.get(id), remotes.entries(), remotes.clear(), remotes.size
//
// An entry: { id, name, tile, position (visual [x, y]), facingAngle, state (the
// tracker's), rig, modelMatrix (its own Float32Array(16), written by the
// scene), overheadAnchor (the screen point above the head, set by the scene,
// or null) }. buildRig's rig is { meshCommands, hitModel?, controller?, ... };
// only meshCommands and hitModel are read here.
//
// Nothing a member sends can throw out of update(): a record that is not
// whole is skipped, an appearance value the client cannot draw is replaced by
// the default appearance's, and a rig that fails is built again without the
// equipment, then with the default look.
import { APPEARANCE_FIELDS, EQUIPMENT_SLOTS, ITEM_ID_MAX, NAME_MAX_CHARS, TILE_MAX, TILE_MIN } from "./protocol.js";

// At most this many other players are drawn, the nearest to the local player:
// each rig is animated on the CPU every frame (inferred: a cost bound; see the
// frame times in the pull request).
export const REMOTE_DRAW_MAX = 30;
// Rigs built in one frame at most, so a crowd arriving does not stall a frame.
export const RIG_BUILDS_PER_FRAME = 2;

// The client's default look (rendering.js `Wh`, player.js defaultPlayerModelConfig).
export const DEFAULT_APPEARANCE = Object.freeze({
  gender: 0,
  hairKit: 0,
  jawKit: 10,
  torsoKit: 18,
  armsKit: 26,
  handsKit: 33,
  legsKit: 36,
  feetKit: 42,
  hairColor: 0,
  torsoColor: 0,
  legsColor: 0,
  feetColor: 0,
  skinColor: 0,
});

// Wire field (protocol.js, snake_case) to the client's field, and for a kit the
// body part it dresses (CACHE: an identity kit's bodyPartId, 0 to 6 for the
// male kits and 7 to 13 for the female ones, in this order).
const FIELDS = Object.freeze([
  ["gender", "gender"],
  ["hair_kit", "hairKit", 0],
  ["jaw_kit", "jawKit", 1],
  ["torso_kit", "torsoKit", 2],
  ["arms_kit", "armsKit", 3],
  ["hands_kit", "handsKit", 4],
  ["legs_kit", "legsKit", 5],
  ["feet_kit", "feetKit", 6],
  ["hair_color", "hairColor"],
  ["torso_color", "torsoColor"],
  ["legs_color", "legsColor"],
  ["feet_color", "feetColor"],
  ["skin_color", "skinColor"],
]);
// A head without hair and a face without a jaw are real looks (bald, and every
// female look); the other parts always have a kit.
const MAY_BE_NONE = new Set(["hairKit", "jawKit"]);
// The renderer reads no colour (rendering.js loadPlayerModel dresses kits and
// items only): any index of the protocol's palette range is drawn the same.
const COLOR_MAX = 255;

const isInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

// The local look as the wire sends it (protocol.js buildAppearance).
export function appearanceToWire(appearance) {
  const look = { ...DEFAULT_APPEARANCE, ...(appearance ?? {}) };
  const out = {};
  for (const [wire, field] of FIELDS) out[wire] = look[field];
  return out;
}

// A member's look as the renderer takes it: every value it cannot draw is the
// default look's.
export function appearanceFromWire(wire, isValidKit) {
  const out = { ...DEFAULT_APPEARANCE };
  if (wire === null || typeof wire !== "object") return out;
  for (const [key, field, bodyPart] of FIELDS) {
    const value = wire[key];
    let ok;
    if (field === "gender") ok = value === 0 || value === 1;
    else if (bodyPart === undefined) ok = isInt(value, 0, COLOR_MAX);
    else if (value === -1) ok = MAY_BE_NONE.has(field);
    else ok = isInt(value, 0, 4095) && (!isValidKit || safeCall(() => isValidKit(value, bodyPart)) === true);
    if (ok) out[field] = value;
  }
  return out;
}

// Slot to item id, the wire's slots only, item ids only.
export function equipmentToWire(equipment) {
  const out = {};
  if (equipment === null || typeof equipment !== "object") return out;
  for (const slot of EQUIPMENT_SLOTS) if (isInt(equipment[slot], 0, ITEM_ID_MAX)) out[slot] = equipment[slot];
  return out;
}
export const equipmentFromWire = equipmentToWire;

// A name from another player is text and nothing else: no control or
// direction characters, no "<" or ">" (the menus read "<col=...>" in the
// cache's names), at most 24 characters.
export function safeName(name) {
  if (typeof name !== "string") return "Player";
  const text = [...name.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩<>]/g, "")]
    .slice(0, NAME_MAX_CHARS)
    .join("")
    .trim();
  return text || "Player";
}

const readTile = (tile) =>
  Array.isArray(tile) && tile.length === 2 && isInt(tile[0], TILE_MIN, TILE_MAX) && isInt(tile[1], TILE_MIN, TILE_MAX) ? [tile[0], tile[1]] : null;
const readFacing = (facing) => (isInt(facing, 0, 2047) ? facing : 0);
// The steps of a move, oldest first; null when one of them is not a tile.
const readSteps = (steps) => {
  if (!Array.isArray(steps) || steps.length > 8) return null;
  const out = [];
  for (const step of steps) {
    const tile = readTile(step);
    if (!tile) return null;
    out.push(tile);
  }
  return out;
};
const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

// --- the source the lobby scene asks each frame --------------------------------
let source = null;
let presented = null;
export function setRemotePlayersSource(next) {
  source = next && typeof next.list === "function" ? next : null;
}
export const getRemotePlayersSource = () => source;
// The entries the lobby scene drew last (for tests and diagnostics).
export const presentedRemotePlayers = () => presented?.drawn() ?? [];

export function createRemotePlayers({ buildRig, makeTracker, isValidKit, maxDrawn = REMOTE_DRAW_MAX, onError } = {}) {
  if (typeof buildRig !== "function" || typeof makeTracker !== "function") throw new TypeError("createRemotePlayers: buildRig and makeTracker are needed");
  const entries = new Map();
  let drawn = [];
  const reported = new Set();
  const report = (kind, error) => {
    if (reported.has(kind)) return;
    reported.add(kind);
    safeCall(() => onError?.(error));
  };

  const place = (entry, tile, facing) => {
    entry.tracker = makeTracker(tile[0], tile[1]);
    entry.tracker.facingAngle = facing;
  };

  // A new move of the store's record goes to the tracker once: its steps over
  // one tick, or a snap where it cannot be walked.
  const feed = (entry, record, tile, facing) => {
    if (record.lastTick === entry.lastTick) return;
    entry.lastTick = record.lastTick;
    const steps = readSteps(record.steps);
    const tracker = entry.tracker;
    if (record.snapped === true || !steps || steps.length === 0 || !sameTile(steps[steps.length - 1], tile)) {
      tracker.snapToUnwalkedPlacement(tile, facing);
      return;
    }
    tracker.enqueueTickMovement(++entry.moves, steps, record.run === true);
    // As for the local player (rendering.js, the tracker's feed): a route that
    // does not end on the tile is put right at once.
    tracker.snapToUnwalkedPlacement(tile, facing);
  };

  const lookKey = (entry) => JSON.stringify([entry.appearance, entry.equipment]);

  const tryBuild = (entry, appearance, equipment) => {
    try {
      return buildRig(appearance, equipment, entry.id) ?? null;
    } catch (error) {
      report("rig", error);
      return null;
    }
  };
  const ensureRig = (entry) => {
    const key = lookKey(entry);
    if (entry.rigKey === key) return false;
    entry.rigKey = key;
    entry.hit = null;
    entry.rig =
      tryBuild(entry, entry.appearance, entry.equipment) ??
      (Object.keys(entry.equipment).length ? tryBuild(entry, entry.appearance, {}) : null) ??
      tryBuild(entry, { ...DEFAULT_APPEARANCE }, {});
    return true;
  };

  const api = {
    update(records, { localPosition = null, deltaMs = 0 } = {}) {
      presented = api;
      const seen = new Set();
      for (const record of Array.isArray(records) ? records : []) {
        try {
          const id = record?.id;
          if (!Number.isSafeInteger(id) || id < 1 || seen.has(id)) continue;
          const tile = readTile(record.tile);
          if (!tile) continue; // not placed yet
          seen.add(id);
          const facing = readFacing(record.facing);
          let entry = entries.get(id);
          if (!entry) {
            entry = { id, name: "Player", tile, facing, position: [tile[0], tile[1]], facingAngle: facing, state: null, lastTick: record.lastTick, moves: 0, appearance: null, equipment: {}, rig: null, rigKey: null, hit: null, modelMatrix: new Float32Array(16), overheadAnchor: null, tracker: null };
            place(entry, tile, facing);
            entries.set(id, entry);
          } else {
            feed(entry, record, tile, facing);
          }
          entry.name = safeName(record.name);
          entry.tile = tile;
          entry.facing = facing;
          entry.appearance = record.appearance ? appearanceFromWire(record.appearance, isValidKit) : null;
          entry.equipment = equipmentFromWire(record.equipment);
        } catch (error) {
          report("record", error);
        }
      }
      for (const id of [...entries.keys()]) if (!seen.has(id)) entries.delete(id);

      for (const entry of entries.values()) {
        try {
          entry.tracker.setTargetAngle(entry.facing); // the record's facing, once it stands
          entry.state = entry.tracker.advance(deltaMs, 1);
          entry.position = entry.state.position;
          entry.facingAngle = entry.state.facingAngle;
        } catch (error) {
          report("tracker", error);
          place(entry, entry.tile, entry.facing);
          entry.state = null;
          entry.position = [entry.tile[0], entry.tile[1]];
        }
      }

      // The nearest to the local player, a look known; ties by id.
      const [lx, ly] = readTile(localPosition) ?? [31, 25];
      const near = [...entries.values()]
        .filter((entry) => entry.appearance)
        .map((entry) => ({ entry, d: (entry.position[0] - lx) ** 2 + (entry.position[1] - ly) ** 2 }))
        .sort((a, b) => a.d - b.d || a.entry.id - b.entry.id)
        .slice(0, Math.max(0, maxDrawn))
        .map(({ entry }) => entry);
      let builds = 0;
      for (const entry of near) {
        if (entry.rigKey !== lookKey(entry) && builds < RIG_BUILDS_PER_FRAME && ensureRig(entry)) builds++;
      }
      drawn = near.filter((entry) => entry.rig && entry.rig.meshCommands);
      return drawn;
    },
    drawn: () => drawn,
    hitTestData() {
      const out = [];
      for (const entry of drawn) {
        const model = entry.rig?.hitModel;
        if (!model) continue;
        entry.hit ??= { ...model, modelMatrix: entry.modelMatrix, useBoundingBox: true };
        out.push({ actorId: entry.id, name: entry.name, hitTestData: entry.hit });
      }
      return out;
    },
    get: (id) => entries.get(id),
    entries: () => [...entries.values()],
    get size() {
      return entries.size;
    },
    clear() {
      entries.clear();
      drawn = [];
    },
  };
  return api;
}
