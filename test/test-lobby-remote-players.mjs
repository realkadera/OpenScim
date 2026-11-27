// Other players in the lobby.
//
// 1. A fake source through the hook, no server: two are drawn, a right click
//    on one gives exactly "Walk here <name> (level-N)", "Follow <name>
//    (level-N)", Cancel (the level coloured by the difference, left out when
//    unknown, the name as text), and Follow walks the local player after the
//    leader. Signed out, no /api/ws socket is opened.
// 2. Signed in (/api/auth/me and /api/meta answered here) with a scripted
//    WebSocket: the application's own path connects, says hello, sends its
//    look and tile, joins, and draws the member the room holds.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";
import { fixtureBody } from "./net-fakes.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);
const look = { gender: 0, hair_kit: 0, jaw_kit: 10, torso_kit: 18, arms_kit: 26, hands_kit: 33, legs_kit: 36, feet_kit: 42, hair_color: 0, torso_color: 0, legs_color: 0, feet_color: 0, skin_color: 0 };

// The lobby's engines; the one that ticks is the live one.
async function exposeEngines(page) {
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = "this.encounter = options.encounter;";
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "if (options.encounter.kind === 'lobby') (window.lobbyEngines ??= []).push(this);") });
  });
}
const liveEngine = "window.lobbyEngines.reduce((a, b) => (b.getState().currentTick >= a.getState().currentTick ? b : a))";

async function openLobby(page) {
  await page.goto(origin + "/");
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 120000 });
  await page.waitForFunction(() => window.lobbyEngines?.some((engine) => engine.getState().currentTick > 0), null, { timeout: 60000 });
  await page.keyboard.press("Escape");
}

try {
  // --- 1. a fake source -------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack));
    const sockets = [];
    page.on("websocket", (socket) => sockets.push(socket.url()));
    await exposeEngines(page);
    await openLobby(page);
    const local = () => page.evaluate(`${liveEngine}.getState().playerPosition`);

    await page.evaluate(async (look) => {
      const remotes = await import("/net/remotePlayers.js");
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
    }, look);

    // Both drawn, as full rigs with their own mesh ids, with hit-test data and a screen point.
    const drawnNow = () =>
      page.evaluate(() => window.lobbyFake.remotes.presentedRemotePlayers().map((e) => ({ id: e.id, name: e.name, at: e.screenCenter, meshIds: e.rig.meshCommands.map((m) => m.meshId), hit: !!e.rig.hitModel })));
    await page.waitForFunction(() => window.lobbyFake.remotes.presentedRemotePlayers().filter((e) => e.rig?.meshCommands.length > 0 && e.screenCenter).length === 2, null, { timeout: 30000 });
    const drawn = await drawnNow();
    assert.deepEqual(drawn.map((e) => e.id).sort(), [1, 2]);
    assert.equal(drawn.find((e) => e.id === 2).name, "col=ff0000Bob");
    for (const e of drawn) {
      assert.ok(e.meshIds.every((id) => id.startsWith(`remote-player-${e.id}-`)), "its own mesh ids");
      assert.ok(e.hit, "hit-test data");
    }

    const items = page.locator('[role="menuitem"]');
    const menuOn = async (id) => {
      const at = (await drawnNow()).find((e) => e.id === id).at;
      await page.mouse.click(at.x, at.y, { button: "right" });
      await items.first().waitFor();
      return items.evaluateAll((els) => els.map((el) => [...el.querySelectorAll("span")].map((s) => [s.textContent, getComputedStyle(s).color])));
    };
    const choose = async (index) => {
      const box = await items.nth(index).boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await items.first().waitFor({ state: "detached" });
    };
    const texts = (menu) => menu.map((entry) => entry.map(([text]) => text).join(" "));

    // Bob sent no level: his name alone, as text (no "<", no ">").
    assert.deepEqual(texts(await menuOn(2)), ["Walk here col=ff0000Bob", "Follow col=ff0000Bob", "Cancel"]);
    await choose(2);
    // Alice is level 100, the local player 126: the level is #00ff00 (client/util/combatLevelColor.js).
    const menu = await menuOn(1);
    assert.deepEqual(texts(menu), ["Walk here Alice (level-100)", "Follow Alice (level-100)", "Cancel"]);
    assert.equal(menu[0][2][1], "rgb(0, 255, 0)");
    assert.equal(menu[1][2][1], "rgb(0, 255, 0)");

    // Follow her while she walks west: the local player walks after her and ends next to her.
    await choose(1);
    const start = await local();
    await page.evaluate(() => {
      window.lobbyFake.timer = setInterval(() => window.lobbyFake.players.get(1).tile[0] > 24 && window.lobbyFake.west(1), 600);
    });
    await page.waitForFunction(
      (engines) => {
        const p = eval(engines).getState().playerPosition;
        const a = window.lobbyFake.players.get(1).tile;
        return a[0] === 24 && Math.max(Math.abs(p[0] - a[0]), Math.abs(p[1] - a[1])) <= 1;
      },
      liveEngine,
      { timeout: 30000, polling: 100 },
    );
    await page.evaluate(() => clearInterval(window.lobbyFake.timer));
    const end = await local();
    assert.ok(end[0] < start[0], `walked west after her: ${start} -> ${end}`);
    // The follower keeps facing her (OBS: the game client's angle to an actor's target), and so does another
    // player whose record names her as the one it faces, though its own facing says south.
    const angles = await page.evaluate(async (engines) => {
      const { remotes, players } = window.lobbyFake;
      const alice = players.get(1).tile;
      players.set(7, { ...players.get(2), id: 7, name: "Turned", tile: [alice[0] + 2, alice[1] + 1], fromTile: [alice[0] + 2, alice[1] + 1], facing: 0, face: 1 });
      await new Promise((done) => setTimeout(done, 1500));
      const at = eval(engines).getState().playerPosition;
      return {
        local: eval(engines).getState().playerFacingAngle,
        localWant: remotes.faceAngle(at, alice),
        remote: remotes.presentedRemotePlayers().find((e) => e.id === 7)?.state,
        remoteWant: remotes.faceAngle([alice[0] + 2, alice[1] + 1], alice),
      };
    }, liveEngine);
    assert.equal(angles.local, angles.localWant, "the follower's facing is the angle to its leader");
    assert.equal(angles.remoteWant, Math.trunc((Math.atan2(256, 128) * 1024) / Math.PI) & 2047, "an angle that is not one of eight");
    assert.equal(angles.remote?.targetAngle, angles.remoteWant, "a remote player turns to the player it faces");
    assert.equal(angles.remote.facingAngle, angles.remoteWant, "and has turned");
    // Stepping away from the player it faces, it walks backward (OBS: the game's client chooses the walk by the
    // step's direction against the drawn angle); toward it, forward.
    const stepOf7 = (dx) =>
      page.evaluate((dx) => {
        const p = window.lobbyFake.players.get(7);
        const tile = [p.tile[0] + dx, p.tile[1]];
        window.lobbyFake.players.set(7, { ...p, fromTile: p.tile, steps: [tile], tile, run: false, snapped: false, lastTick: 1000 + tile[0] });
      }, dx);
    const walks7 = (how) => page.waitForFunction((how) => window.lobbyFake.remotes.presentedRemotePlayers().find((e) => e.id === 7)?.state?.locomotionState === how, how, { timeout: 10000, polling: "raf" });
    await stepOf7(1);
    await walks7("walkBack");
    await page.waitForTimeout(900);
    await stepOf7(-1);
    await walks7("walk");
    await page.evaluate(() => window.lobbyFake.players.delete(7));

    // Another player on the local player's own tile is not drawn over it (the local player is the one seen), and
    // one on the next tile is drawn.
    const here = await local();
    await page.evaluate(
      ({ here, look }) => {
        const add = (id, name, tile) => window.lobbyFake.players.set(id, { id, name, appearance: look, equipment: {}, combat: 50, tile, facing: 0, run: false, fromTile: tile, steps: [], snapped: true, lastTick: null });
        add(3, "Same", [here[0], here[1]]);
        add(4, "Behind", [here[0], here[1] + 1]);
        add(5, "Before", [here[0], here[1] - 1]);
        add(6, "Stacked", [here[0], here[1] - 1]);
      },
      { here, look },
    );
    await page.waitForFunction(() => [3, 4, 5, 6].every((id) => window.lobbyFake.remotes.presentedRemotePlayers().some((e) => e.id === id && e.rig && e.screenCenter)), null, { timeout: 30000 });
    // (Once the local player stands: it was still walking after her.)
    await page.waitForFunction(() => window.lobbyFake.remotes.presentedRemotePlayers().find((e) => e.id === 3)?.covered === true, null, { timeout: 30000 });
    const covered = await page.evaluate(() => Object.fromEntries(window.lobbyFake.remotes.presentedRemotePlayers().map((e) => [e.id, e.covered])));
    assert.equal(covered[3], true, "on our tile: not drawn");
    assert.equal(covered[4], false);
    assert.equal(covered[5], false);
    assert.equal(covered[6], true, "two others standing on one tile: one is drawn (OBS: the game's client, addPlayerToScene)");
    if (process.env.LOBBY_PLAYERS_SCREENSHOT) await page.screenshot({ path: process.env.LOBBY_PLAYERS_SCREENSHOT });

    assert.ok(!sockets.some((url) => url.includes("/api/ws")), "signed out: no socket, " + JSON.stringify(sockets));
    assert.deepEqual(errors, []);
    await page.close();
  }

  // --- 2. signed in, the application's own path, a scripted WebSocket ---------------------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack));
    await page.route("**/api/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: 1, name: "Tester" } }) }));
    await page.route("**/api/meta", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: { realtime: true } }) }));
    const welcome = fixtureBody("valid", "welcome");
    const member = { id: 8, name: "Remote", appearance: look, equipment: { weapon: 4151 }, tile: [29, 22], facing: 0, combat: 90 };
    await page.addInitScript(
      ({ welcome, member }) => {
        const Real = window.WebSocket;
        window.apiWsFrames = [];
        // The lobby's socket answers as the server would; any other (the dev server's) is real.
        window.WebSocket = class extends EventTarget {
          constructor(url, protocols) {
            if (!String(url).includes("/api/ws")) return new Real(url, protocols);
            super();
            this.url = String(url);
            window.apiWs = this;
            this.readyState = 0;
            setTimeout(() => {
              this.readyState = 1;
              this.onopen?.({});
            }, 10);
          }
          reply(msg) {
            setTimeout(() => this.onmessage?.({ data: JSON.stringify(msg) }), 5);
          }
          send(text) {
            const msg = JSON.parse(text);
            window.apiWsFrames.push(msg);
            if (msg.t === "hello") this.reply(welcome);
            if (msg.t === "join") this.reply({ t: "joined", rid: msg.rid, room: { id: "lobby-1", kind: "lobby", instance: 1 }, members: [member] });
          }
          close() {
            this.readyState = 3;
          }
        };
        window.WebSocket.OPEN = 1;
      },
      { welcome, member },
    );
    await exposeEngines(page);
    await openLobby(page);
    // The look and the tile go before join; then the room's member is drawn.
    await page.waitForFunction(() => ["hello", "appearance", "presence", "join"].every((t) => window.apiWsFrames.some((msg) => msg.t === t)), null, { timeout: 30000 });
    const frames = await page.evaluate(() => window.apiWsFrames);
    const order = frames.map((msg) => msg.t);
    assert.equal(order[0], "hello");
    assert.equal(frames[0].build, "web");
    assert.ok(order.indexOf("appearance") < order.indexOf("join") && order.indexOf("presence") < order.indexOf("join"), order.join(","));
    const appearance = frames.find((msg) => msg.t === "appearance");
    assert.deepEqual(Object.keys(appearance.appearance), Object.keys(look));
    assert.equal(appearance.combat, 126, "the local player's combat level");
    assert.deepEqual(frames.find((msg) => msg.t === "presence").tile, await page.evaluate(`${liveEngine}.getState().playerPosition`));
    await page.waitForFunction(
      async () => (await import("/net/remotePlayers.js")).presentedRemotePlayers().some((e) => e.id === 8 && e.name === "Remote" && e.combat === 90 && e.rig),
      null,
      { timeout: 30000 },
    );
    // With the other players, the game goes on while the window is not focused (it pauses there otherwise).
    const tickNow = () => page.evaluate(`${liveEngine}.getState().currentTick`);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    const blurredAt = await tickNow();
    await page.waitForFunction((args) => eval(args.engines).getState().currentTick >= args.from + 3, { engines: liveEngine, from: blurredAt }, { timeout: 15000 });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    // Follow over the wire, in a window that is hidden (no frames come, as behind another window): the leader
    // walks east a tile a tick, as the room tells it; the local player ends on the tile behind the leader.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      window.requestAnimationFrame = () => 0;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.evaluate(async () => (await import("/net/lobbyLink.js")).followRemotePlayer(8));
    for (let n = 1; n <= 6; n++) {
      await page.evaluate((n) => window.apiWs.reply({ t: "presence_tick", tick: 100 + n, d: [{ id: 8, tile: [29 + n, 22], steps: [[29 + n, 22]], run: false, facing: 1536 }] }), n);
      await page.waitForTimeout(600);
    }
    const followState = async () =>
      page.evaluate(async (engines) => {
        const { lobbyLink } = await import("/net/lobbyLink.js");
        return { at: eval(engines).getState().playerPosition, leader: lobbyLink.follow.leaderId, cancel: lobbyLink.follow.lastCancel };
      }, liveEngine);
    await page
      .waitForFunction((engines) => eval(engines).getState().playerPosition.join() === "34,22", liveEngine, { timeout: 15000 })
      .catch(async () => assert.fail("the follower did not end behind the leader: " + JSON.stringify(await followState())));
    assert.equal((await followState()).leader, 8, "still following");
    // While it follows, every presence names the leader it faces, and none did before.
    const presences = (await page.evaluate(() => window.apiWsFrames)).filter((msg) => msg.t === "presence");
    assert.equal(presences[0].face, undefined);
    assert.equal(presences.at(-1).face, 8);
    assert.equal(presences.at(-1).facing, 1536, "behind a leader that walked east: facing east");

    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Lobby remote players passed");
} finally {
  await browser.close();
}
