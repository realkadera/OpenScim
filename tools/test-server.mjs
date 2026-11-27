// One of the servers of `npm test`: tools/run-tests.mjs forks a few, since a page of the app asks for 1450 files and
// one process serving sixteen pages at once was what they all waited for. It tells its parent its port, and lives
// until the parent goes.
// Usage: only as forked; node tools/test-server.mjs <index>
import { createServer } from "vite";

// No source maps: inline in every module, they were 57 of the 69 MB of script each page of a test loaded, and the
// modules are served as they are written, line for line. (A module with no map gets one from Vite, made anew at
// each request; one whose map has empty mappings is left alone. The line added at the end is for the modules no
// transform changes, data/monsters.js for one: Vite drops the map of a transform that left the code as it was.)
const noSourceMaps = { name: "no-source-maps", enforce: "post", transform: (code) => ({ code: code + "\n", map: { mappings: "" } }) };

const server = await createServer({
  mode: "test",
  logLevel: "error",
  // Each its own: two servers preparing the dependencies in one directory would write over each other.
  cacheDir: "../node_modules/.vite-test/" + process.argv[2],
  plugins: [noSourceMaps],
  // The first free port from 8791 up. The pages' consoles stay out of the output: a test that minds one listens to it.
  server: { port: 8791, forwardConsole: false },
});
await server.listen();
// Node closes a connection that has been idle for 5 seconds. A test that serves a module itself (page.route with
// route.fetch) asks for it over a connection Playwright keeps open, and one that had idled just that long was closed
// under the request: "route.fetch: read ECONNRESET", now and then, in tests whose page loads for longer. The server
// lives no longer than the tests, so its connections may stay open.
server.httpServer.keepAliveTimeout = 0;
process.on("disconnect", () => process.exit(0));
process.send(server.httpServer.address().port);
