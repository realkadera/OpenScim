// The lobby's public chat in the chatbox and above the heads.
//
// 1. Signed out: the chatbox's input line is "Player: *" as before, with no
//    input, and a key typed goes nowhere new.
// 2. Signed in (/api/auth/me and /api/meta answered here) with a scripted
//    WebSocket: the input line is "<the welcome's name>: *"; a character no
//    keybind uses starts typing, a bound one (W, the camera's) does not;
//    Enter sends, the server's line comes back as "<name>: <text>" (name in
//    the message colour, text in the public colour) and above our head in
//    yellow; another player's line with an effect shows its text without the
//    prefix in the chatbox and in its colour, a character at a time, above
//    his head; a refusal of the server is a game line.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";
import { fixtureBody } from "./net-fakes.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);
const look = { gender: 0, hair_kit: 0, jaw_kit: 10, torso_kit: 18, arms_kit: 26, hands_kit: 33, legs_kit: 36, feet_kit: 42, hair_color: 0, torso_color: 0, legs_color: 0, feet_color: 0, skin_color: 0 };

async function exposeEngines(page) {
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = "this.encounter = options.encounter;";
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "if (options.encounter.kind === 'lobby') (window.lobbyEngines ??= []).push(this);") });
  });
}

async function openLobby(page) {
  await page.goto(origin + "/");
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 120000 });
  await page.waitForFunction(() => window.lobbyEngines?.some((engine) => engine.getState().currentTick > 0), null, { timeout: 60000 });
  await page.keyboard.press("Escape");
}

const inputLine = (page) => page.locator(".chatbox__input").evaluate((el) => el.textContent);

try {
  // --- 1. signed out ----------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack));
    await exposeEngines(page);
    await openLobby(page);
    assert.equal(await inputLine(page), "Player: *");
    assert.equal(await page.locator(".chatbox__field").count(), 0, "no input signed out");
    await page.keyboard.press("h");
    assert.equal(await inputLine(page), "Player: *");
    // The camera turns by the arrow keys by default (as in the game; the letters are the chat's).
    const cameraKeys = () => page.evaluate(() => JSON.parse(localStorage.getItem("osrs-unified-keybinds")).camera);
    assert.deepEqual(
      (({ orbitRotateLeft, orbitRotateRight, orbitTiltUp, orbitTiltDown }) => [orbitRotateLeft, orbitRotateRight, orbitTiltUp, orbitTiltDown])(await cameraKeys()),
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
    );
    // Held, an arrow key turns the camera: the compass turns with it.
    const turned = () => page.evaluate(() => [...document.querySelectorAll("*")].some((el) => /rotate\((?!0deg)/.test(el.style?.transform || "")));
    assert.equal(await turned(), false);
    await page.keyboard.down("ArrowLeft");
    await page.waitForFunction(() => [...document.querySelectorAll("*")].some((el) => /rotate\((?!0deg)/.test(el.style?.transform || "")), null, { timeout: 5000 });
    await page.keyboard.up("ArrowLeft");
    // Keys stored by an earlier visit that are still the first defaults (A, D, W, S) move to the arrows once;
    // set again after that, they are kept.
    const storeLetters = (forget) =>
      page.evaluate((forget) => {
        const keybinds = JSON.parse(localStorage.getItem("osrs-unified-keybinds"));
        Object.assign(keybinds.camera, { orbitRotateLeft: "a", orbitRotateRight: "d", orbitTiltUp: "w", orbitTiltDown: "s" });
        localStorage.setItem("osrs-unified-keybinds", JSON.stringify(keybinds));
        if (forget) localStorage.removeItem("osrs-camera-arrow-keys");
      }, forget);
    await storeLetters(true);
    await openLobby(page);
    assert.equal((await cameraKeys()).orbitRotateLeft, "ArrowLeft", "the first defaults, moved once");
    await storeLetters(false);
    await openLobby(page);
    assert.equal((await cameraKeys()).orbitRotateLeft, "a", "chosen after that: kept");
    assert.deepEqual(errors, []);
    await page.close();
  }

  // --- 2. signed in -------------------------------------------------------------------
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
        window.WebSocket = class extends EventTarget {
          constructor(url, protocols) {
            if (!String(url).includes("/api/ws")) return new Real(url, protocols);
            super();
            this.url = String(url);
            this.readyState = 0;
            window.apiWs = this;
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
            // Every member's line back to all, the sender included.
            if (msg.t === "chat") this.reply({ t: "chat", id: welcome.you.id, name: welcome.you.name, text: msg.text, tick: 1 });
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
    await page.waitForFunction(async () => (await import("/net/remotePlayers.js")).presentedRemotePlayers().some((e) => e.id === 8 && e.rig && e.chatAnchor), null, { timeout: 30000 });
    // The text hangs from the top of the model as it is drawn: the posed height and the lift the scene draws it
    // with (its lowest point, the stance's offset), not the posed height alone, which put the text in the head.
    const heights = await page.evaluate(async () => {
      const e = (await import("/net/remotePlayers.js")).presentedRemotePlayers().find((entry) => entry.id === 8);
      const lift = e.rig.minHeight + e.rig.controller._w();
      // overheadAnchor is 7 px above the point 15 over the posed height: the pixels of one unit of height.
      const unit = (e.screenCenter.y - (e.overheadAnchor.y + 7)) / (e.rig.controller.posedModelHeight / 2 + 15);
      return { lift, above: (e.overheadAnchor.y + 7 - e.chatAnchor.y) / unit };
    });
    assert.ok(heights.lift > 0, JSON.stringify(heights));
    assert.ok(Math.abs(heights.above - (heights.lift - 15)) < 2.5, "the anchor is the lift above the posed height: " + JSON.stringify(heights));

    // Our own name from the welcome, not "Player".
    await page.waitForFunction(() => document.querySelector(".chatbox__input")?.textContent === "Player-0420: *", null, { timeout: 30000 });
    const field = page.locator(".chatbox__field");
    assert.equal(await field.count(), 1);
    const focused = () => page.evaluate(() => document.activeElement?.classList.contains("chatbox__field") === true);

    // A line longer than the chatbox stays inside it: its start scrolls out to the left, the star stays in view.
    await page.keyboard.press("h");
    await page.keyboard.type("W".repeat(79));
    const box = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const [typing, line, field] = [rect(".chatbox__typing"), rect(".chatbox__typing-line"), rect(".chatbox__field")];
      return { width: typing.width, max: field.width, startHidden: line.left < typing.left, endShown: Math.abs(line.right - typing.right) < 1 };
    });
    assert.ok(box.width <= box.max + 1, `the input line is ${box.width}px wide in a chatbox of ${box.max}px`);
    assert.ok(box.startHidden && box.endShown, "the end of a long line is the part shown");
    for (let i = 0; i < 80; i++) await page.keyboard.press("Backspace");
    await page.keyboard.press("Escape");
    assert.equal(await inputLine(page), "Player-0420: *");

    // A camera key starts a line as any character does: the first letter is not lost.
    await page.keyboard.press("w");
    assert.equal(await focused(), true);
    assert.equal(await inputLine(page), "Player-0420: w*");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Escape");
    assert.equal(await focused(), false);
    assert.equal(await inputLine(page), "Player-0420: *");
    await page.keyboard.press("h");
    assert.equal(await focused(), true);
    await page.keyboard.type("ello world");
    assert.equal(await inputLine(page), "Player-0420: hello world*");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("d");
    await page.keyboard.press("Enter");
    assert.equal(await focused(), false, "Enter sends and leaves the line");
    assert.equal(await inputLine(page), "Player-0420: *");
    const sent = await page.evaluate(() => window.apiWsFrames.filter((msg) => msg.t === "chat").map((msg) => msg.text));
    assert.deepEqual(sent, ["Hello world"]);

    // Back from the server: in the chatbox, and above our head in yellow.
    const line = page.locator(".chatbox__line--speaker").last();
    await line.waitFor();
    const transparent = await page.locator(".chatbox").evaluate((el) => el.classList.contains("chatbox--transparent"));
    const [speaker, said] = await line.evaluate((el) => [el.querySelector(".chatbox__speaker"), el.querySelector(".chatbox__said")].map((s) => [s.textContent, getComputedStyle(s).color]));
    assert.equal(speaker[0], "Player-0420:");
    assert.equal(said[0], "Hello world");
    // WIKI (Chat Interface): public chat is blue in the chatbox, the name black (opaque) or white (transparent).
    assert.equal(speaker[1], transparent ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)");
    assert.equal(said[1], transparent ? "rgb(144, 144, 255)" : "rgb(0, 0, 255)");
    const overhead = (text) =>
      page.waitForFunction((text) => [...document.querySelectorAll("[data-overhead-texts] > span")].find((s) => s.textContent === text), text, { timeout: 10000 }).then((h) => h.evaluate((s) => ({ color: getComputedStyle(s).color, parts: s.children.length })));
    assert.deepEqual(await overhead("Hello world"), { color: "rgb(255, 255, 0)", parts: 0 });
    // It is drawn as the game's client draws it: 1-bit glyphs on a canvas (every pixel on or off), yellow, each
    // with a black pixel one right and one down where no glyph pixel is; the span of the text is not seen.
    const bitmap = await page.waitForFunction(() => {
      const canvas = document.querySelector("canvas[data-overhead-bitmap]");
      const text = canvas?.drawnTexts?.find((drawn) => drawn.text === "Hello world");
      if (!text) return null;
      const { data, width } = canvas.getContext("2d").getImageData(text.left - 2, text.baseline - 16, text.width + 6, 24);
      const at = (x, y) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)].join();
      let yellow = 0;
      let black = 0;
      let soft = 0;
      let unshadowed = 0;
      for (let y = 0; y < 23; y++) {
        for (let x = 0; x < width - 1; x++) {
          const pixel = at(x, y);
          if (pixel === "255,255,0,255") {
            yellow++;
            if (at(x + 1, y + 1) === "0,0,0,0") unshadowed++;
          } else if (pixel === "0,0,0,255") black++;
          else if (pixel !== "0,0,0,0") soft++;
        }
      }
      const span = [...document.querySelectorAll("[data-overhead-texts] > span")].find((s) => s.textContent === "Hello world");
      return { yellow, black, soft, unshadowed, width: text.width, spanSeen: getComputedStyle(span).visibility !== "hidden" };
    }, null, { timeout: 10000 }).then((handle) => handle.jsonValue());
    assert.ok(bitmap.yellow > 100 && bitmap.black > 50, JSON.stringify(bitmap));
    assert.deepEqual({ soft: bitmap.soft, unshadowed: bitmap.unshadowed, spanSeen: bitmap.spanSeen }, { soft: 0, unshadowed: 0, spanSeen: false }, JSON.stringify(bitmap));

    // Another player says something red and waving.
    await page.evaluate(() => window.apiWs.reply({ t: "chat", id: 8, name: "Remote", text: "red:wave:Hi there", tick: 2 }));
    await page.waitForFunction(() => document.querySelector(".chatbox__line--speaker:last-child .chatbox__speaker")?.textContent === "Remote:");
    assert.equal(await page.locator(".chatbox__line--speaker").last().locator(".chatbox__said").textContent(), "Hi there");
    assert.deepEqual(await overhead("Hi there"), { color: "rgb(255, 0, 0)", parts: 8 });
    // A pattern: each character in its code's colour (q black, 3 yellow), the prefix not shown.
    await page.evaluate(() => window.apiWs.reply({ t: "chat", id: 8, name: "Remote", text: "patternq3:Bees", tick: 3 }));
    const bees = await page.waitForFunction(() => [...document.querySelectorAll("[data-overhead-texts] > span")].find((s) => s.textContent === "Bees"), null, { timeout: 10000 });
    assert.deepEqual(await bees.evaluate((s) => [...s.children].map((part) => getComputedStyle(part).color)), ["rgb(44, 44, 44)", "rgb(44, 44, 44)", "rgb(255, 237, 0)", "rgb(255, 237, 0)"]);

    // Shot for the pull request, while both are above the heads.
    if (process.env.LOBBY_CHAT_SCREENSHOT) await page.screenshot({ path: process.env.LOBBY_CHAT_SCREENSHOT });

    // The server refuses a line: a game line.
    await page.evaluate(() => window.apiWs.reply({ t: "chat_rejected", reason: "muted" }));
    await page.waitForFunction(() => [...document.querySelectorAll(".chatbox__line")].at(-1)?.textContent === "You are muted and cannot talk.");

    // The overhead text goes after its 3 s.
    await page.waitForFunction(() => ![...document.querySelectorAll("[data-overhead-texts] > span")].some((s) => s.textContent === "Hello world"), null, { timeout: 10000 });

    // The Public stone: "On"; a right click gives the game's modes; "Show none" makes it "Off", takes the public
    // lines out of the chatbox but our own, and no text is drawn above a head (OBS: the game's client), our own
    // neither; "Hide" keeps the texts above the heads and empties the chatbox of public lines.
    const stone = page.locator('[data-chat-tab="public"]');
    const stoneLabel = () => stone.evaluate((el) => [el.children[1].textContent, getComputedStyle(el.children[1]).color]);
    assert.deepEqual(await stoneLabel(), ["On", "rgb(13, 193, 13)"]);
    const menuItems = page.locator('[role="menuitem"]');
    const chooseMode = async (entry) => {
      await stone.click({ button: "right" });
      await menuItems.first().waitFor();
      const texts = await menuItems.evaluateAll((els) => els.map((el) => el.textContent));
      const index = texts.findIndex((text) => text.includes(entry));
      assert.ok(index >= 0, `${entry} in ${JSON.stringify(texts)}`);
      const box = await menuItems.nth(index).boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await menuItems.first().waitFor({ state: "detached" });
      return texts;
    };
    const publicLines = () => page.locator(".chatbox__line--speaker .chatbox__speaker").evaluateAll((els) => els.map((el) => el.textContent));
    // A click on a stone shows that stone's lines: Game the game lines, Public the players', All both.
    const shownTab = () => page.locator('[data-chat-tab-shown="true"]').getAttribute("data-chat-tab");
    const lineKinds = () => page.locator(".chatbox__line").evaluateAll((els) => els.map((el) => (el.classList.contains("chatbox__line--speaker") ? "public" : "game")));
    assert.equal(await shownTab(), "all");
    const allKinds = await lineKinds();
    assert.ok(allKinds.includes("public") && allKinds.includes("game"), JSON.stringify(allKinds));
    await page.locator('[data-chat-tab="game"]').click();
    assert.equal(await shownTab(), "game");
    assert.deepEqual([...new Set(await lineKinds())], ["game"]);
    await stone.click();
    assert.equal(await shownTab(), "public");
    assert.deepEqual([...new Set(await lineKinds())], ["public"]);
    await page.locator('[data-chat-tab="trade"]').click();
    assert.deepEqual(await lineKinds(), []);
    await page.locator('[data-chat-tab="all"]').click();
    assert.deepEqual(await lineKinds(), allKinds);
    const modes = await chooseMode("Show none");
    assert.deepEqual(["Show standard", "Show friends", "Show none", "Hide"].map((entry) => modes.some((text) => text.includes(entry))), [true, true, true, true]);
    assert.deepEqual(await stoneLabel(), ["Off", "rgb(255, 0, 0)"]);
    assert.deepEqual(await publicLines(), ["Player-0420:"]);
    await page.evaluate(() => window.apiWs.reply({ t: "chat", id: 7, name: "Player-0420", text: "Unseen", tick: 9 }));
    await page.waitForFunction(() => document.querySelectorAll(".chatbox__line--speaker").length === 2);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("[data-overhead-texts] > span")].some((s) => s.textContent === "Unseen")), false, "Off: nothing above our head");
    await chooseMode("Hide");
    assert.deepEqual(await stoneLabel(), ["Hide", "rgb(0, 255, 255)"]);
    assert.deepEqual(await publicLines(), []);
    await page.waitForFunction(() => [...document.querySelectorAll("[data-overhead-texts] > span")].some((s) => s.textContent === "Unseen"), null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => localStorage.getItem("openscim.chat.public")), "hide");
    // "Clear history" on the Public stone: back in On, its lines are gone, the game lines are not.
    await chooseMode("Show standard");
    assert.ok((await publicLines()).length > 0);
    await chooseMode("Clear history");
    assert.deepEqual(await publicLines(), []);
    assert.ok((await lineKinds()).includes("game"));
    assert.deepEqual(errors, []);
    await page.close();
  }
  // --- 3. the interface scaled (Stretched Mode at 2): the text is scaled with the overlay ------------
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack));
    await page.addInitScript(() => {
      if (!localStorage.getItem("osrs-yama-settings")) localStorage.setItem("osrs-yama-settings", JSON.stringify({ uiScale: 2, stretchedModeEnabled: true, stretchedModeScale: 2 }));
    });
    await exposeEngines(page);
    await openLobby(page);
    await page.evaluate(async (look) => {
      const remotes = await import("/net/remotePlayers.js");
      const chat = await import("/net/lobbyChat.js");
      const alice = { id: 1, name: "Alice", appearance: look, equipment: {}, combat: 100, tile: [30, 23], facing: 0, run: false, fromTile: [30, 23], steps: [], snapped: true, lastTick: null };
      remotes.setRemotePlayersSource({ list: () => [alice], getById: () => alice });
      window.scaledRemotes = remotes;
      const said = { display: { colour: "yellow", effect: null, text: "Scaled" } };
      chat.setLobbyChatSource({
        chat: { overheadFor: (id) => (id === 1 ? { ...said, at: Date.now() - 100 } : null), getSnapshot: () => ({ lines: [], filter: "on" }), subscribe: () => () => {} },
        session: { getSnapshot: () => ({ you: { id: 99, name: "Me" }, chatEnabled: true, state: "open", limits: { chat_max_chars: 80 } }), subscribe: () => () => {} },
      });
    }, look);
    const scaled = await page
      .waitForFunction(() => {
        const canvas = document.querySelector("canvas[data-overhead-bitmap]");
        const text = canvas?.drawnTexts?.find((drawn) => drawn.text === "Scaled");
        const entry = window.scaledRemotes.presentedRemotePlayers().find((e) => e.id === 1);
        if (!text || !entry?.chatAnchor || canvas.style.transform === "") return null;
        const rect = canvas.getBoundingClientRect();
        const parent = canvas.parentElement.getBoundingClientRect();
        // (The frame after the scale is set, the canvas takes its size in game pixels.)
        if (rect.width > parent.width + 1) return null;
        return {
          transform: canvas.style.transform,
          layer: document.querySelector("[data-overhead-texts]").style.transform,
          covers: [Math.round(rect.width - parent.width), Math.round(rect.height - parent.height)],
          // In game pixels: the baseline 2 px under the point and raised by 10 (inferred), the text centred on it.
          dy: text.baseline - Math.round(entry.chatAnchor.y),
          dx: Math.abs(text.left + text.width / 2 - entry.chatAnchor.x) <= 1,
          // On the screen: the game pixel of the baseline is the point's, scaled.
          screenY: Math.round(rect.top + text.baseline * 2),
          anchorScreenY: Math.round(parent.top + entry.chatAnchor.y * 2),
        };
      }, null, { timeout: 30000 })
      .then((handle) => handle.jsonValue());
    assert.equal(scaled.transform, "scale(2)", JSON.stringify(scaled));
    assert.equal(scaled.layer, "scale(2)");
    assert.deepEqual(scaled.covers, [0, 0], "the scaled canvas covers the overlay exactly");
    assert.equal(scaled.dy, 2 - 10);
    assert.equal(scaled.dx, true);
    assert.ok(Math.abs(scaled.screenY - scaled.anchorScreenY - (2 - 10) * 2) <= 2, JSON.stringify(scaled));
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("Lobby chat passed");
} finally {
  await browser.close();
}
