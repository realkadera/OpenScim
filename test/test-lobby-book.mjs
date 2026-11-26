import assert from "node:assert/strict";
import * as book from "../client/lobby/book.js";
import { gatewayPortals, pickLobbyObject } from "../client/lobby/gateways.js";

// The lectern stands a few tiles north of the tile the player arrives on
// ([31, 25], LobbyEncounter.getDefaultPlayerStart), blocks its tile, and
// leaves the tile in front of it free.
const [startX, startY] = [31, 25];
const [x, y] = book.bookTile;
assert.equal(x, startX);
assert.ok(y > startY + 2 && y < startY + 8, "the book stands in front of the arriving player");
const blocked = new Set();
book.extendLobbyArena(new Set(), (blockX, blockY) => blocked.add(Math.floor(blockX) + "," + Math.floor(blockY)));
assert.deepEqual([...blocked], [x + "," + y], "the lectern blocks its tile and no other");

// Its tile is a portal of the lobby that shows the list of all encounters
// and sets up no fight of its own.
const portal = gatewayPortals.find(({ position }) => position[0] === x && position[1] === y);
assert.ok(portal, "the lectern's tile is a portal");
assert.equal(portal.encounterKind, undefined);
const calls = [];
portal.open(() => calls.push("select"), () => calls.push("browse"));
assert.deepEqual(calls, ["browse"]);

// A pointer ray through the book, well above the floor, picks the lectern's
// tile; a ray that passes beside it picks nothing.
const ray = (from, to) => ({
  origin: { x: from[0], y: from[1], z: from[2] },
  direction: { x: to[0] - from[0], y: to[1] - from[1], z: to[2] - from[2] },
});
assert.deepEqual(pickLobbyObject(ray([x + 0.5, y - 10, 4], [x + 0.5, y + 0.5, 1.2]))?.tile, book.bookTile);
assert.deepEqual(pickLobbyObject(ray([x + 0.5, y + 0.5, 9], [x + 0.5, y + 0.5, 0]))?.tile, book.bookTile);
assert.equal(pickLobbyObject(ray([x + 3.5, y - 10, 4], [x + 3.5, y + 0.5, 1.2])), null);
// The lectern behind the pointer is not picked.
assert.equal(pickLobbyObject(ray([x + 0.5, y - 10, 4], [x + 0.5, y - 20, 4])), null);
console.log("Lobby book passed");
