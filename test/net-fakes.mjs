// Fakes for the tests of client/net: a clock with timers, a scripted
// WebSocket and a fetch of /api/meta and /api/auth/me. No real time passes.
import { readFileSync, readdirSync } from "node:fs";

export const fixtureDir = new URL("../contract/fixtures/ws/", import.meta.url);
export const readFixtures = (kind) =>
  readdirSync(new URL(kind + "/", fixtureDir))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((file) => ({ file, ...JSON.parse(readFileSync(new URL(`${kind}/${file}`, fixtureDir), "utf8")) }));
export const fixtureBody = (kind, name) => readFixtures(kind).find((fixture) => fixture.name === name).body;

const drain = () => new Promise((resolve) => setImmediate(resolve));

export function createClock(start = 1_800_000_000_000) {
  let t = start, nextId = 1;
  const timers = new Map();
  const clock = {
    now: () => t,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: t + Math.max(0, ms), fn, id });
      return id;
    },
    clearTimeout: (id) => void timers.delete(id),
    pending: () => timers.size,
    // Runs every timer due within ms, in order, letting promises settle after each.
    async advance(ms) {
      const end = t + ms;
      await drain();
      for (;;) {
        const due = [...timers.values()].filter((timer) => timer.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        timers.delete(due.id);
        t = due.at;
        due.fn();
        await drain();
      }
      t = end;
    },
    settle: drain,
  };
  return clock;
}

export function createFakeWebSocket() {
  const sockets = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      this.closedWith = null;
      sockets.push(this);
    }
    send(text) {
      if (this.readyState !== 1) throw new Error("send on a socket that is not open");
      if (typeof text !== "string") throw new Error("a frame that is not text");
      this.sent.push(text);
    }
    close(code, reason) {
      this.closedWith = { code, reason };
      this.readyState = 3;
    }
    // The server's side of the script.
    open() {
      this.readyState = 1;
      this.onopen?.({});
    }
    receive(message) {
      this.onmessage?.({ data: typeof message === "string" || message instanceof ArrayBuffer ? message : JSON.stringify(message) });
    }
    serverClose(code, reason = "") {
      this.readyState = 3;
      this.onclose?.({ code, reason, wasClean: code !== 1006 });
    }
    get messages() {
      return this.sent.map((text) => JSON.parse(text));
    }
    types() {
      return this.messages.map((msg) => msg.t);
    }
  }
  return { FakeWebSocket, sockets, last: () => sockets[sockets.length - 1] };
}

// meta: the features.realtime answered; user: /api/auth/me's user (null: signed out);
// fail: fetch rejects, as when offline.
export function createFakeFetch(state = {}) {
  const server = { realtime: true, user: { id: "u1", username: "Player-0420" }, fail: false, calls: [], ...state };
  const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  server.fetch = async (path) => {
    server.calls.push(path);
    if (server.fail) throw new TypeError("Failed to fetch");
    if (server.hang) return new Promise(() => {});
    // A static host answers every path with its page.
    if (server.html) return { ok: true, status: 200, json: async () => JSON.parse("<!doctype html>") };
    if (path === "/api/meta") return respond(200, { api: 1, build: "dev", providers: [], features: { replay_upload: "signed_in", realtime: server.realtime } });
    if (path === "/api/auth/me") return respond(200, { user: server.user });
    return respond(404, { error: { code: "not_found", message: "Not found." } });
  };
  return server;
}
