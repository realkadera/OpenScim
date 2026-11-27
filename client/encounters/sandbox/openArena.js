// The sandbox's open arena: 50 x 50 tiles of one floor inside a wall, and
// nothing else. Its floor is map square 25,96 (CACHE: region 6496), 64 x 64
// tiles of one textured floor (overlay 6, texture 6400) at one height and
// with no map object at all (tools/cache-objects.mjs map 6496); the arena is
// the middle 50 x 50 of it. Its wall is the Tombs of Amascut's sandstone
// wall (CACHE: loc 44999, as the nexus of client/toa/nexus.js places it, a
// straight wall, type 0), drawn by the scene along the floor's edge: the
// map has none.
export const openArenaMapSquare = { x: 25, y: 96 };
export const openArenaBounds = { minX: 7, maxX: 56, minY: 7, maxY: 56 };
// The south edge's middle, facing the arena.
export const openArenaPlayerStart = [31, 9];
const wallLocId = 44999; // CACHE

/** The arena: its 2,500 tiles walkable, nothing else (collision "custom"). */
export function openArenaFloor() {
  const { minX, maxX, minY, maxY } = openArenaBounds;
  const walkableTiles = new Set();
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) walkableTiles.add(`${x},${y}`);
  return { bounds: { ...openArenaBounds, width: maxX - minX + 1, height: maxY - minY + 1 }, collisionMap: null, walkableTiles };
}

// A wall of type 0 stands on one side of its tile: 0 west, 1 north, 2 east,
// 3 south (the cache's rotations); this one is thick, and its thickness is
// its own tile's. So it stands on the tiles around the floor, on the side
// that faces it, and the floor's edge stays clear.
const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const wall = (x, y, rotation) => ({
  id: `open-wall-${x}-${y}-${rotation}`,
  meshId: `open-wall-${x}-${y}-${rotation}`,
  materialId: "osrs-npc",
  modelMatrix: identity,
  lifecycle: { kind: "sync" },
  classification: "sceneMesh",
  data: { kind: "loc", locId: wallLocId, modelType: 0, rotation, localX: x, localY: y, level: 0, seqId: -1 },
});
const walls = (() => {
  const { minX, maxX, minY, maxY } = openArenaBounds;
  const list = [];
  for (let y = minY; y <= maxY; y++) list.push(wall(minX - 1, y, 2), wall(maxX + 1, y, 0));
  for (let x = minX; x <= maxX; x++) list.push(wall(x, maxY + 1, 3), wall(x, minY - 1, 1));
  return list;
})();

/** What the scene draws of it (a render config's createSceneObjectController): the wall. */
export const openArenaSceneObjects = () => ({
  consumeEvents() {},
  update() {
    return walls;
  },
});
