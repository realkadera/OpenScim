// The NPCs that stand in the lobby: { actorId, npcTypeId, position,
// facingAngle, available, displaySize? }. The lobby's arena blocks a disc
// around each, and the lobby's scene in rendering.js draws them and their
// light. There are none: the encounter book (client/lobby/book.js) lists
// every encounter, so no boss needs a place of its own.
var lobbyNpcs = [];
export { lobbyNpcs };
