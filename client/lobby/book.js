// The encounter book: a lectern a few tiles in front of where the player
// arrives. A click on it opens the encounter picker, which lists every
// registered encounter, so a new fight needs no place of its own in the lobby.
// It is written as a gateway (see gateway.js) on the north spoke, where a
// layout is the lobby itself: nothing is turned.
import { lobbyGateway } from "./gateway.js";
import { lobbyMesh, lobbyShaderModes } from "./shader.js";

// The tile of the lectern. The player arrives on [31, 25] and looks north.
export const bookTile = [31, 28];
const [tileX, tileY] = bookTile;
const centreX = tileX + 0.5, centreY = tileY + 0.5;

// [object id, x, y, rotation]: a mahogany eagle lectern (CACHE, object
// 13647), its book towards the arriving player.
const placements = [[13647, tileX, tileY, 2]];

const { turnMatrix, gatewayLocs, turnGatewayObject } = lobbyGateway(90, placements);
export { gatewayLocs, turnGatewayObject };

// A click on the lectern opens the picker: `browse` shows the list of all
// encounters. The lectern is clicked as a whole (gateways.js, pickLobbyObject),
// since it stands taller than its tile is deep.
export const gatewayPortals = [{ position: bookTile, displayName: "Encounters", open: (select, browse) => browse() }];
export const clickBoxes = [{ min: [tileX, tileY, 0], max: [tileX + 1, tileY + 1, 1.6], tile: bookTile, action: "Pick", name: "Boss Encounter" }];

// The lectern stands in the way.
export function extendLobbyArena(walkable, block) {
  block(centreX, centreY);
}

// The lobby leaves its fallen columns off the rune circle.
const circleRadius = 2.2;
export const gatewayCovers = (x, y) => Math.hypot(x - centreX, y - centreY) <= circleRadius;

// `hsl(h, s, l)` packs a colour the way the renderer expects; `baseZ` is the
// height of the lobby floor.
export function gatewayMeshes({ baseZ, hsl }) {
  const gold = hsl(36, 200, 165);
  const part = (name, zIndex, animParams) => lobbyMesh("lobby-book-" + name, zIndex, "read", animParams, turnMatrix);

  // A rune circle on the floor around the lectern.
  // Above the dark rays the lobby floor draws around its centre.
  const surface = baseZ + 0.1;
  const circle = part("circle", 5, [lobbyShaderModes.circle, circleRadius, 0, 0]);
  circle.quad(
    circle.vertex(centreX - circleRadius, centreY - circleRadius, surface, gold, 1, -1, -1),
    circle.vertex(centreX + circleRadius, centreY - circleRadius, surface, gold, 1, 1, -1),
    circle.vertex(centreX + circleRadius, centreY + circleRadius, surface, gold, 1, 1, 1),
    circle.vertex(centreX - circleRadius, centreY + circleRadius, surface, gold, 1, -1, 1),
  );

  // Sparks rise around the lectern, on two upright cylinders. Along a
  // cylinder the sheet's "across" runs once around it.
  const motesHeight = 4, segments = 16;
  const motes = [0.7, 1.3].map((radius, index) => {
    const mesh = part("motes-" + index, 7, [lobbyShaderModes.motes, Math.PI * radius, motesHeight, index]);
    const corner = (step, up) => {
      const angle = (step / segments) * 2 * Math.PI;
      return mesh.vertex(centreX + radius * Math.cos(angle), centreY + radius * Math.sin(angle), baseZ + up * motesHeight, gold, 1, (step / segments) * 2 - 1, up);
    };
    for (let step = 0; step < segments; step++) mesh.quad(corner(step, 0), corner(step + 1, 0), corner(step + 1, 1), corner(step, 1));
    return mesh;
  });

  // A round light around the open book. The shader works it out along the
  // line of sight, so it is round from every side; the mesh is only a box
  // that holds it, and carries the light's radius as each vertex's "across".
  const haloRadius = 1.2, bookHeight = 1.15;
  const halo = part("halo", 8, [lobbyShaderModes.halo, centreX, centreY, baseZ + bookHeight]);
  const corners = [];
  for (const dz of [-1, 1]) for (const dy of [-1, 1]) for (const dx of [-1, 1])
    corners.push(halo.vertex(centreX + dx * haloRadius, centreY + dy * haloRadius, baseZ + bookHeight + dz * haloRadius, gold, 0.75, haloRadius));
  for (const [a, b, c, d] of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]])
    halo.quad(corners[a], corners[b], corners[c], corners[d]);

  return [circle, ...motes, halo].map((mesh) => mesh.command());
}
