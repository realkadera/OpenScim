// How the fixture encounter is registered: the same two lists a contributor
// adds a line to (docs/ADDING-AN-ENCOUNTER.md), with the lines put in when
// the module is loaded instead of committed, so that the site never has the
// fixture. The determinism harness applies them through its module hooks
// (tools/determinism/node-hooks.mjs), a browser test through the requests of
// its page (serveFixture below).
//
// Each entry: the client module, a text of it that occurs once, what that
// text becomes, and the import line the new text needs. The import goes to
// the end of the module, so the modules it loads are evaluated in the order
// they always were.
import { readFileSync } from "node:fs";

/** Where the fixture's modules are served from, and where they are on disk. */
export const fixtureUrlPrefix = "/test-fixtures/";
export const fixtureDirectory = new URL("./", import.meta.url);

export const registrations = [
  {
    module: "encounters/registry.js",
    find: "var registeredEncounterDefinitions = [",
    replace: "var registeredEncounterDefinitions = [\n  trainingGroundDefinition,",
    importLine: 'import { trainingGroundDefinition } from "/test-fixtures/training-ground/encounter.js";',
  },
  {
    module: "encounters/presentations.js",
    find: "export const presentationBuilders = [zebakPresentation, nexusPresentation",
    replace: "export const presentationBuilders = [zebakPresentation, nexusPresentation, trainingGroundPresentation",
    importLine: 'import { trainingGroundPresentation } from "/test-fixtures/training-ground/presentation.js";',
  },
];

/** The source of a client module with the fixture registered; `path` is relative to client/. Other modules come back as they are. */
export function registerFixture(path, source) {
  const registration = registrations.find((entry) => path === entry.module);
  if (!registration) return source;
  if (source.split(registration.find).length !== 2) throw new Error(`${path}: expected once: ${registration.find}`);
  return source.replace(registration.find, registration.replace) + (registration.importLine ? "\n" + registration.importLine + "\n" : "");
}

/** For a Playwright page: serves the fixture's modules and registers the fixture in the two client modules as they are served. */
export async function serveFixture(page) {
  await page.route("**" + fixtureUrlPrefix + "**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const file = new URL(path.slice(fixtureUrlPrefix.length), fixtureDirectory);
    return route.fulfill({ contentType: "text/javascript", body: readFileSync(file, "utf8") });
  });
  for (const { module } of registrations) {
    await page.route("**/" + module + "*", async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, body: registerFixture(module, await response.text()) });
    });
  }
}
