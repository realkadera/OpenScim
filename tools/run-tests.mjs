// Serves the client on the address the tests expect, runs them, stops the server.
// Usage: npm test            (everything, one file at a time)
//        npm test -- test/test-zebak-tide.mjs
//
// A test is a file test/test-*.mjs. Left to itself, `node --test` would also
// run every other script under test/ (the modules of test/fixtures/).
import { spawn } from "node:child_process";
import { createServer } from "vite";

const server = await createServer({ mode: "test", server: { port: 8791, strictPort: true } });
await server.listen();
// Node closes a connection that has been idle for 5 seconds. A test that serves a module itself (page.route with
// route.fetch) asks for it over a connection Playwright keeps open, and one that had idled just that long was closed
// under the request: "route.fetch: read ECONNRESET", now and then, in tests whose page loads for longer. The server
// lives no longer than the tests, so its connections may stay open.
server.httpServer.keepAliveTimeout = 0;
const files = process.argv.slice(2);
const run = spawn(process.execPath, ["--test", "--test-concurrency=1", ...(files.length ? files : ["test/test-*.mjs"])], { stdio: "inherit" });
run.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 1);
});
