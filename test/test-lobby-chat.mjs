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

    // A camera key does not start a line; a character no keybind uses does.
    await page.keyboard.press("w");
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

    // Another player says something red and waving.
    await page.evaluate(() => window.apiWs.reply({ t: "chat", id: 8, name: "Remote", text: "red:wave:Hi there", tick: 2 }));
    await page.waitForFunction(() => document.querySelector(".chatbox__line--speaker:last-child .chatbox__speaker")?.textContent === "Remote:");
    assert.equal(await page.locator(".chatbox__line--speaker").last().locator(".chatbox__said").textContent(), "Hi there");
    assert.deepEqual(await overhead("Hi there"), { color: "rgb(255, 0, 0)", parts: 8 });

    // Shot for the pull request, while both are above the heads.
    if (process.env.LOBBY_CHAT_SCREENSHOT) await page.screenshot({ path: process.env.LOBBY_CHAT_SCREENSHOT });

    // The server refuses a line: a game line.
    await page.evaluate(() => window.apiWs.reply({ t: "chat_rejected", reason: "muted" }));
    await page.waitForFunction(() => [...document.querySelectorAll(".chatbox__line")].at(-1)?.textContent === "You are muted and cannot talk.");

    // The overhead text goes after its 3 s.
    await page.waitForFunction(() => ![...document.querySelectorAll("[data-overhead-texts] > span")].some((s) => s.textContent === "Hello world"), null, { timeout: 10000 });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Lobby chat passed");
} finally {
  await browser.close();
}
