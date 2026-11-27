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
//     releaseRig(rig),                      optional: a rig that is not drawn any more
//     now,                                  optional, () => milliseconds (Date.now)
//     maxDrawn,                             REMOTE_DRAW_MAX
//     onError(error, id?),                  optional, told once per kind of failure,
//                                           and once per id whose rig broke
//   });
//   remotes.markBroken(id, error)     the scene could not draw that rig
//   remotes.update(records, { localPosition, deltaMs })  each frame; returns
//                                     the entries to draw, nearest first
//   remotes.hitTestData()             [{ actorId: id, name, combat, hitTestData }] of those
//   remotes.get(id), remotes.entries(), remotes.clear(), remotes.size
//
// An entry: { id, name, combat (3..126 or null), tile, position (visual [x, y]), facingAngle, state (the
// tracker's), rig, modelMatrix (its own Float32Array(16), written by the
// scene), overheadAnchor (the screen point above the head, set by the scene,
// or null) }. buildRig's rig is { meshCommands, hitModel?, controller?, ... };
// only meshCommands and hitModel are read here.
//
// Nothing a member sends can throw out of update(): a record that is not
// whole is skipped, an appearance value the client cannot draw is replaced by
// the default appearance's, and a rig that fails is built again without the
// equipment, then with the default look.
import { COMBAT_MAX, COMBAT_MIN, EQUIPMENT_SLOTS, ITEM_ID_MAX, NAME_MAX_CHARS, TILE_MAX, TILE_MIN } from "./protocol.js";

// At most this many other players are drawn, the nearest to the local player:
// each rig is animated on the CPU every frame (inferred: a cost bound; see the
// frame times in the pull request).
export const REMOTE_DRAW_MAX = 30;
// Rigs built in one frame at most, so a crowd arriving does not stall a frame.
export const RIG_BUILDS_PER_FRAME = 2;
// A member's look is built again at most this often (a look sent every tick
// must not rebuild a rig every tick), and a rig that broke while drawn is
// tried again after this long when its look has not changed (inferred: costs).
export const REBUILD_INTERVAL_MS = 3000;
export const BROKEN_RETRY_MS = 30000;
// A drawn player stays drawn unless another is this much nearer (tiles).
export const DRAW_HYSTERESIS_TILES = 2;

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

// A name from another player is text and nothing else: no control, format,
// line-separator or direction characters (U+0000-001F, U+007F-009F, the soft
// hyphen U+00AD, the Arabic letter mark U+061C, U+200B-200F, U+2028-202E,
// U+2066-2069, U+FEFF), no "<" or ">" (the menus read "<col=...>" in the
// cache's names), at most two combining marks on a character, at most 24
// characters.
const STRIPPED_RANGES = [[0x00, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x61c, 0x61c], [0x200b, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069], [0xfeff, 0xfeff], [0x3c, 0x3c], [0x3e, 0x3e]];
const codePoint = (code) => "\\u{" + code.toString(16) + "}";
const STRIPPED = new RegExp("[" + STRIPPED_RANGES.map(([from, to]) => (from === to ? codePoint(from) : codePoint(from) + "-" + codePoint(to))).join("") + "]", "gu");
const COMBINING = /^\p{M}$/u;
export const COMBINING_MARKS_MAX = 2;
export function safeName(name) {
  if (typeof name !== "string") return "Player";
  const kept = [];
  let marks = 0;
  for (const char of name.normalize("NFC").replace(STRIPPED, "")) {
    if (COMBINING.test(char)) {
      if (++marks > COMBINING_MARKS_MAX) continue;
    } else marks = 0;
    kept.push(char);
  }
  const text = kept.slice(0, NAME_MAX_CHARS).join("").trim();
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

// The angle (0..2047: 0 south, 512 west, 1024 north, 1536 east) at which an
// actor at `from` faces one at `to`, both visual positions in tiles; `keep`
// when they are on the same point. OBS, the game's client: every client cycle
// an actor with a target takes atan2(x - target.x, y - target.y) * 1024 / pi,
// cut to an integer, from the two drawn positions in 1/128 tile, also while
// it walks, and keeps its angle when the two are equal.
export function faceAngle(from, to, keep = null) {
  const dx = Math.trunc(from[0] * 128) - Math.trunc(to[0] * 128);
  const dy = Math.trunc(from[1] * 128) - Math.trunc(to[1] * 128);
  if (dx === 0 && dy === 0) return keep;
  return Math.trunc((Math.atan2(dx, dy) * 1024) / Math.PI) & 2047;
}

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

// Whom the local player keeps facing: a function that gives a remote player's
// id or null (lobbyLink.js: the leader while following).
let localFace = () => null;
export function setLocalFaceTarget(fn) {
  localFace = typeof fn === "function" ? fn : () => null;
}
// The angle for the local player, drawn at `position`, to face that player
// this frame (faceAngle; `current` when on the same point), or null: nobody
// to face.
export function localFaceAngle(position, current) {
  const id = safeCall(localFace);
  const target = Number.isSafeInteger(id) ? presented?.positionOf(id) : null;
  return target ? faceAngle(position, target, current) : null;
}

export function createRemotePlayers({ buildRig, makeTracker, isValidKit, releaseRig, now = () => Date.now(), maxDrawn = REMOTE_DRAW_MAX, onError } = {}) {
  if (typeof buildRig !== "function" || typeof makeTracker !== "function") throw new TypeError("createRemotePlayers: buildRig and makeTracker are needed");
  const entries = new Map();
  let drawn = [];
  const reported = new Set();
  const report = (kind, error) => {
    if (reported.has(kind)) return;
    reported.add(kind);
    safeCall(() => onError?.(error));
  };
  // A rig no longer drawn is handed back (its meshes are not drawn again).
  const release = (entry) => {
    if (entry.rig) safeCall(() => releaseRig?.(entry.rig));
    entry.rig = null;
    entry.hit = null;
  };

  const place = (entry, tile, facing) => {
    entry.tracker = makeTracker(tile[0], tile[1]);
    entry.tracker.facingAngle = facing;
    entry.faced = false;
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
  // The rig of the latest look, built again at most once per
  // REBUILD_INTERVAL_MS (a look that changes faster is built when the time is
  // up, as it is then); a rig that broke waits for a new look or
  // BROKEN_RETRY_MS.
  const ensureRig = (entry, t) => {
    const key = lookKey(entry);
    if (entry.brokenAt !== null) {
      if (key === entry.brokenKey && t - entry.brokenAt < BROKEN_RETRY_MS) return false;
    } else if (key === entry.rigKey) return false;
    if (entry.rig && t - entry.builtAt < REBUILD_INTERVAL_MS) return false;
    const old = entry.rig;
    entry.rigKey = key;
    entry.builtAt = t;
    entry.brokenAt = null;
    entry.hit = null;
    entry.rig =
      tryBuild(entry, entry.appearance, entry.equipment) ??
      (Object.keys(entry.equipment).length ? tryBuild(entry, entry.appearance, {}) : null) ??
      tryBuild(entry, { ...DEFAULT_APPEARANCE }, {});
    if (old && old !== entry.rig) safeCall(() => releaseRig?.(old));
    return true;
  };
  const brokenReported = new Set();

  const api = {
    // ownId and localVisual: our own player's id and drawn position, for the remotes that face us.
    update(records, { localPosition = null, deltaMs = 0, ownId = null, localVisual = null } = {}) {
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
            entry = { id, name: "Player", combat: null, tile, facing, face: null, faced: false, position: [tile[0], tile[1]], facingAngle: facing, state: null, lastTick: record.lastTick, moves: 0, appearance: null, equipment: {}, rig: null, rigKey: null, builtAt: -Infinity, brokenAt: null, brokenKey: null, hit: null, modelMatrix: new Float32Array(16), overheadAnchor: null, tracker: null };
            place(entry, tile, facing);
            entries.set(id, entry);
          } else {
            feed(entry, record, tile, facing);
          }
          entry.name = safeName(record.name);
          entry.combat = isInt(record.combat, COMBAT_MIN, COMBAT_MAX) ? record.combat : null;
          entry.tile = tile;
          entry.facing = facing;
          entry.face = Number.isSafeInteger(record.face) && record.face > 0 ? record.face : null;
          entry.appearance = record.appearance ? appearanceFromWire(record.appearance, isValidKit) : null;
          entry.equipment = equipmentFromWire(record.equipment);
        } catch (error) {
          report("record", error);
        }
      }
      for (const [id, entry] of [...entries]) {
        if (seen.has(id)) continue;
        release(entry);
        entries.delete(id);
      }

      for (const entry of entries.values()) {
        try {
          entry.tracker.setTargetAngle(entry.facing); // the record's facing, once it stands
          // A player that keeps facing another (faceAngle) turns to it every frame, walking too. As the
          // game's client has it for an actor with a target (OBS): not slowed while it turns.
          const faced = entry.face === null ? null : entry.face === ownId ? localVisual : entries.get(entry.face)?.position;
          if (Array.isArray(faced)) {
            entry.tracker.setInteracting(true);
            entry.tracker.setForcedFacingAngle(faceAngle(entry.position, faced, entry.tracker.currentTurnTarget()));
            entry.faced = true;
          } else if (entry.faced) {
            entry.faced = false;
            entry.tracker.setInteracting(false);
            entry.tracker.setForcedFacingAngle(null);
          }
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

      // The nearest to the local player, a look known; ties by id. One drawn
      // now stays drawn unless another is nearer by DRAW_HYSTERESIS_TILES, so
      // the set does not flicker at the edge of the cap.
      const [lx, ly] = readTile(localPosition) ?? [31, 25];
      const shown = new Set(drawn.map((entry) => entry.id));
      const near = [...entries.values()]
        .filter((entry) => entry.appearance)
        .map((entry) => {
          const d = Math.hypot(entry.position[0] - lx, entry.position[1] - ly);
          return { entry, d: shown.has(entry.id) ? d - DRAW_HYSTERESIS_TILES + 1e-9 : d };
        })
        .sort((a, b) => a.d - b.d || a.entry.id - b.entry.id)
        .slice(0, Math.max(0, maxDrawn))
        .map(({ entry }) => entry);
      const inNear = new Set(near);
      for (const entry of entries.values()) {
        if (!inNear.has(entry) && entry.rig) {
          release(entry);
          entry.rigKey = null;
        }
      }
      const t = now();
      let builds = 0;
      for (const entry of near) {
        if (builds < RIG_BUILDS_PER_FRAME && ensureRig(entry, t)) builds++;
      }
      drawn = near.filter((entry) => entry.rig && entry.rig.meshCommands);
      return drawn;
    },
    // The scene could not draw this entry's rig: it is dropped, and built
    // again only for a new look or after BROKEN_RETRY_MS; told once per id.
    markBroken(id, error) {
      const entry = entries.get(id);
      if (!entry) return;
      release(entry);
      entry.brokenAt = now();
      entry.brokenKey = lookKey(entry);
      drawn = drawn.filter((each) => each !== entry);
      if (!brokenReported.has(id)) {
        brokenReported.add(id);
        safeCall(() => onError?.(error, id));
      }
    },
    drawn: () => drawn,
    // Where a player is drawn ([x, y] in tiles), drawn or not; undefined when not placed.
    positionOf: (id) => entries.get(id)?.position,
    hitTestData() {
      const out = [];
      for (const entry of drawn) {
        const model = entry.rig?.hitModel;
        if (!model) continue;
        entry.hit ??= { ...model, modelMatrix: entry.modelMatrix, useBoundingBox: true };
        out.push({ actorId: entry.id, name: entry.name, combat: entry.combat, hitTestData: entry.hit });
      }
      return out;
    },
    get: (id) => entries.get(id),
    entries: () => [...entries.values()],
    get size() {
      return entries.size;
    },
    clear() {
      for (const entry of entries.values()) release(entry);
      entries.clear();
      drawn = [];
    },
  };
  return api;
}
