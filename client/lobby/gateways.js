// The lobby's gateways together: what the lobby asks of one, it asks of all.
// Only the encounter book stands in the lobby now. The gateways of the Tombs
// of Amascut (../toa/gateway.js), Desert Treasure II (../dt2/gateway.js) and
// the Sandbox (../encounters/sandbox/gateway.js) are still written as
// gateways; naming one here puts it back.
import * as book from "./book.js";

const gateways = { book };
const all = Object.values(gateways);

// Tiles that open something when clicked: { position, displayName } with
// either `encounterKind`, the encounter to enter, or `open(select, browse)`,
// which asks the player and passes `select` the fight to set up, or calls
// `browse` to show the list of all encounters.
export const gatewayPortals = all.flatMap((gateway) => gateway.gatewayPortals);
export const gatewayCovers = (x, y) => all.some((gateway) => gateway.gatewayCovers(x, y));
// Whether the lobby should lay its own floor at a position beyond its rim.
export const gatewayFloor = (x, y) => all.some((gateway) => gateway.gatewayFloor?.(x, y));
export const extendLobbyArena = (walkable, block) => all.forEach((gateway) => gateway.extendLobbyArena(walkable, block));

// Scenery that is clicked as a whole and not by the tile under the pointer: a
// gateway's `clickBoxes` are { min, max, tile, action, name }: a box in lobby
// tiles with its heights above the floor, the tile a click on it counts for,
// and what the pointer says over it ("Pick" "Boss Encounter"). `ray` is the
// pointer's ray, { origin, direction }, in the same tiles. Returns the box.
export function pickLobbyObject(ray) {
  for (const gateway of all)
    for (const box of gateway.clickBoxes ?? []) {
      const { min, max } = box;
      let near = -Infinity, far = Infinity;
      for (const [axis, index] of [["x", 0], ["y", 1], ["z", 2]]) {
        const a = (min[index] - ray.origin[axis]) / ray.direction[axis];
        const b = (max[index] - ray.origin[axis]) / ray.direction[axis];
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
      if (far >= Math.max(near, 0)) return box;
    }
  return null;
}
export const gatewayMeshes = (context) => all.flatMap((gateway) => gateway.gatewayMeshes(context));

// Loads each gateway's objects into an object renderer of its own. A renderer
// merges its still objects into one mesh, and a mesh has one turn, so
// gateways on different spokes cannot share one.
export async function loadGatewayObjects(ObjectRenderer, loader, terrainHeights) {
  const drawn = [];
  for (const [name, gateway] of Object.entries(gateways)) {
    const renderer = new ObjectRenderer();
    renderer.setTerrainHeights(terrainHeights);
    // No bounds: the objects are laid out before the turn, outside the lobby's arena.
    await renderer.load(loader, gateway.gatewayLocs(loader), { bounds: null });
    // Every renderer gives its merged mesh the same name, and the graphics
    // memory is kept by name.
    for (const command of renderer.cachedLocMeshes) {
      if (!command.meshSource.id.endsWith(name)) command.meshSource.id += "-" + name;
      command.meshId += "-" + name;
    }
    drawn.push({ gateway, renderer });
  }
  return drawn;
}

// Adds the loaded objects to a frame's draw queue, turned to their spokes.
export function drawGatewayObjects(drawn, queue) {
  for (const { gateway, renderer } of drawn ?? []) {
    const first = queue.commands.length;
    renderer.renderLocs(queue);
    for (let i = first; i < queue.commands.length; i++) gateway.turnGatewayObject(queue.commands[i]);
  }
}
