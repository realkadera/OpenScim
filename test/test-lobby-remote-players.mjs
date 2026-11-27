// Other players in the lobby, from a fake source and no server: two are
// drawn, a right click on one offers "Follow <name>" above "Walk here", and
// choosing it walks the local player after the leader.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = "http://127.0.0.1:8791";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  const sockets = [];
  page.on("websocket", (socket) => sockets.push(socket.url()));
  // The lobby's engines; the one that ticks is the live one.
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = "this.encounter = options.encounter;";
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "if (options.encounter.kind === 'lobby') (window.lobbyEngines ??= []).push(this);") });
  });
  await page.goto(origin + "/");
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 120000 });
  await page.waitForFunction(() => window.lobbyEngines?.some((engine) => engine.getState().currentTick > 0), null, { timeout: 60000 });
  await page.keyboard.press("Escape");
  const local = () => page.evaluate(() => window.lobbyEngines.reduce((a, b) => (b.getState().currentTick >= a.getState().currentTick ? b : a)).getState().playerPosition);

  // A fake store as the source the lobby scene draws.
  await page.evaluate(async () => {
    const remotes = await import("/net/remotePlayers.js");
    const look = { gender: 0, hair_kit: 0, jaw_kit: 10, torso_kit: 18, arms_kit: 26, hands_kit: 33, legs_kit: 36, feet_kit: 42, hair_color: 0, torso_color: 0, legs_color: 0, feet_color: 0, skin_color: 0 };
    const players = new Map();
    const add = (id, name, tile, facing, equipment, combat) =>
      players.set(id, { id, name, appearance: look, equipment, combat, tile, facing, run: false, fromTile: tile, steps: [], snapped: true, lastTick: null });
    add(1, "Alice", [28, 22], 0, {}, 100);
    add(2, "<col=ff0000>Bob", [34, 22], 1536, { weapon: 22325 }, null);
    let tick = 0;
    window.lobbyFake = {
      remotes,
      players,
      west(id) {
        const p = players.get(id);
        const tile = [p.tile[0] - 1, p.tile[1]];
        players.set(id, { ...p, fromTile: p.tile, steps: [tile], tile, run: false, snapped: false, lastTick: ++tick, facing: 512 });
      },
    };
    remotes.setRemotePlayersSource({ list: () => [...players.values()], getById: (id) => players.get(id) });
  });

  // Both drawn, as full rigs, with hit-test data; the name is text without tags.
  await page.waitForFunction(() => window.lobbyFake.remotes.presentedRemotePlayers().filter((e) => e.rig?.meshCommands.length > 0 && e.overheadAnchor).length === 2, null, { timeout: 30000 });
  const drawn = await page.evaluate(() => window.lobbyFake.remotes.presentedRemotePlayers().map((e) => ({ id: e.id, name: e.name, tile: e.tile, anchor: e.overheadAnchor, meshIds: e.rig.meshCommands.map((m) => m.meshId) })));
  assert.deepEqual(drawn.map((e) => e.id).sort(), [1, 2]);
  assert.equal(drawn.find((e) => e.id === 2).name, "col=ff0000Bob");
  for (const e of drawn) assert.ok(e.meshIds.every((id) => id.startsWith(`remote-player-${e.id}-`)), "its own mesh ids");

  // Bob sent no level: his name alone, as text (no "<", no ">").
  const menuItems = page.locator('[role="menuitem"]');
  const bob = drawn.find((e) => e.id === 2);
  await page.mouse.click(bob.anchor.x, bob.anchor.y + 45, { button: "right" });
  await menuItems.first().waitFor();
  assert.deepEqual(await menuItems.evaluateAll((els) => els.map((el) => [...el.querySelectorAll("span")].map((s) => s.textContent).join(" "))), ["Walk here col=ff0000Bob", "Follow col=ff0000Bob", "Cancel"]);
  const cancelBox = await menuItems.last().boundingBox();
  await page.mouse.click(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2);
  await menuItems.first().waitFor({ state: "detached" });

  // A right click on Alice (level 100, the local player's is 126): exactly her two entries and Cancel,
  // the level coloured by the difference (client/util/combatLevelColor.js: 26 lower is #00ff00).
  const alice = drawn.find((e) => e.id === 1);
  await page.mouse.click(alice.anchor.x, alice.anchor.y + 45, { button: "right" });
  const items = page.locator('[role="menuitem"]');
  await items.first().waitFor();
  const spans = () => items.evaluateAll((els) => els.map((el) => [...el.querySelectorAll("span")].map((s) => [s.textContent, getComputedStyle(s).color])));
  const menu = await spans();
  assert.deepEqual(menu.map((entry) => entry.map(([text]) => text).join(" ")), ["Walk here Alice (level-100)", "Follow Alice (level-100)", "Cancel"]);
  assert.equal(menu[0][2][1], "rgb(0, 255, 0)");
  const follow = 1;

  // Follow her while she walks west: the local player walks after her.
  const box = await items.nth(follow).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const start = await local();
  await page.evaluate(() => {
    window.lobbyFake.timer = setInterval(() => window.lobbyFake.west(1), 600);
  });
  const distance = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  const aliceTile = () => page.evaluate(() => window.lobbyFake.players.get(1).tile);
  const before = distance(start, await aliceTile());
  await page.waitForFunction(() => window.lobbyFake.players.get(1).tile[0] <= 24, null, { timeout: 20000 });
  await page.evaluate(() => clearInterval(window.lobbyFake.timer));
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const end = await local();
  assert.ok(end[0] < start[0], `walked west after her: ${start} -> ${end}`);
  assert.ok(distance(end, await aliceTile()) <= Math.max(1, before - 1), `closer to her: ${end}`);

  // No socket to /api/ws: nobody is signed in.
  assert.ok(!sockets.some((url) => url.includes("/api/ws")), JSON.stringify(sockets));
  assert.deepEqual(errors, []);
  console.log("Lobby remote players passed");
} finally {
  await browser.close();
}
