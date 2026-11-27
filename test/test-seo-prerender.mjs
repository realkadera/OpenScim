// The pages search engines are given (client/seo/routes.js) and what the build
// writes of them (tools/seo/prerender.mjs). Needs no game cache and no browser,
// so GitHub Actions runs it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isIndexed, loadSeoModules, renderPage, renderSitemap } from "../tools/seo/prerender.mjs";

const modules = await loadSeoModules();
const { buildSeoRoutes, findSeoRoute, canonicalUrl } = modules.routes;
const routes = buildSeoRoutes();
const byPath = new Map(routes.map((route) => [route.path, route]));
const indexed = routes.filter(isIndexed);

// One route per address, the home page first, and every address written without its closing "/".
assert.equal(byPath.size, routes.length, "two routes share an address");
assert.equal(routes[0].path, "/");
for (const route of routes) assert.match(route.path, /^\/$|^(\/[a-z0-9-]+)+$/, route.path);
assert.equal(findSeoRoute("/yama/?x=1#y"), byPath.get("/yama"));
assert.equal(findSeoRoute("/no-such-page/"), routes[0]);

// The home page and the fights with texts of their own are indexed. A fixture or a fight without `seo` is not.
for (const path of ["/", "/yama", "/inferno", "/sol-heredit", "/colosseum", "/zebak", "/vardorvis", "/disclaimer"]) assert.ok(isIndexed(byPath.get(path)), path + " is indexed");

// A retired address is another address of its encounter's page.
const zuk = byPath.get("/zuk");
assert.equal(zuk.noindex, true);
assert.equal(canonicalUrl(zuk), "https://openscim.dev/inferno/");
assert.equal(zuk.title, byPath.get("/inferno").title);

// A fight in beta says so, as the menus do; one that is not does not.
assert.match(byPath.get("/inferno").title, /^OSRS Inferno Simulator \(Beta\) \| /);
assert.match(byPath.get("/inferno").h1, / \(Beta\)$/);
assert.doesNotMatch(byPath.get("/yama").title, /Beta/);

// What a search result shows: a title and a description of its own for every indexed page, neither cut short by a search engine.
assert.equal(new Set(indexed.map((route) => route.title)).size, indexed.length, "two indexed pages share a title");
assert.equal(new Set(indexed.map((route) => route.description)).size, indexed.length, "two indexed pages share a description");
for (const route of indexed) {
  assert.ok(route.title.length <= 70, `${route.path}: the title has ${route.title.length} characters`);
  assert.ok(route.description.length >= 50 && route.description.length <= 240, `${route.path}: the description has ${route.description.length} characters`);
  assert.ok(route.title.endsWith(" | OpenScim.dev"), route.path);
}
// The home page lists the indexed fights, and only those.
const listed = routes[0].jsonLd.find((data) => data["@type"] === "ItemList").itemListElement.map((item) => item.url);
assert.ok(listed.includes("https://openscim.dev/vardorvis/"));
for (const url of listed) assert.ok(indexed.some((route) => canonicalUrl(route) === url), url + " is listed and not indexed");

// The pages, from index.html as it is written (the build's differs in the addresses of the scripts only).
const template = readFileSync("client/index.html", "utf8");
assert.ok(!template.includes('name="robots"'), "index.html asks for nothing of search engines: a page that is not indexed says so itself");
for (const route of routes) {
  const html = renderPage(template, route, routes, modules);
  const count = (pattern) => html.match(pattern)?.length ?? 0;
  assert.equal(count(/<title>/g), 1, route.path);
  assert.equal(count(/<h1[ >]/g), 1, route.path);
  assert.ok(html.includes(`<link rel="canonical" href="${canonicalUrl(route)}" />`), route.path);
  assert.equal(html.includes('<meta name="robots" content="noindex, follow" />'), route.noindex === true, route.path + ": noindex");
  assert.match(html, /<div id="root"><main .*<\/main><div class="loading-screen"/, route.path + ": #root has the page's text, then the loading screen");
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(json);
}
// Text is escaped: an apostrophe and a quote in a title do not end a tag.
const quoted = renderPage(template, { ...routes[0], title: 'A "quoted" <title> & more', h1: "<b>" }, routes, modules);
assert.ok(quoted.includes("<title>A &quot;quoted&quot; &lt;title&gt; &amp; more</title>"));
assert.ok(!quoted.includes("<b>"));
// A tag that index.html has lost fails the build.
assert.throws(() => renderPage(template.replace(/<title>.*<\/title>/, ""), routes[0], routes, modules), /<title>/);

// The sitemap: the indexed pages by their canonical addresses, nothing else.
const sitemap = renderSitemap(routes, modules);
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, location]) => location);
assert.deepEqual(locations, indexed.map(canonicalUrl));
assert.ok(locations.includes("https://openscim.dev/") && !locations.includes("https://openscim.dev/zuk/"));
assert.match(readFileSync("client/robots.txt", "utf8"), /^Sitemap: https:\/\/openscim\.dev\/sitemap\.xml$/m);

console.log(`seo: ${routes.length} routes, ${indexed.length} indexed`);
