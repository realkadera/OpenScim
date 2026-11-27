// One HTML page per route, and the sitemap, written into the build.
//
// The client is a single page: without this every address is served the same
// index.html, with the home page's title and an empty <body>, and a search
// engine has to run the application to learn what a page is. Here each route
// of client/seo/routes.js gets dist/<path>/index.html: the built index.html
// with the route's own title, description, canonical address, social tags and
// structured data, and its heading and texts inside #root, under the loading
// screen index.html has there. The application replaces what is in #root
// when it starts (createRoot).
//
// A route that is not indexed gets its page too, saying "noindex". Nothing
// here knows the host: the application adds "noindex" at runtime on any host
// but the site's (client/assets/deployment.js).
//
// sitemap.xml lists the indexed routes; client/robots.txt names it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Inside <script>, "<" must not start a tag ("</script>").
const jsonForScript = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

/** The modules of client/seo/, loaded as Vite loads them (the registry finds the encounters with Vite's glob import). */
export async function loadSeoModules(root = "client") {
  const server = await createServer({
    configFile: false,
    root,
    publicDir: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  // The encounters import client/assets/vendor.js, and with it PicoGL, which reads `self` when it loads (as tools/determinism/harness.mjs has it).
  globalThis.self ??= globalThis;
  try {
    return { routes: await server.ssrLoadModule("/seo/routes.js"), legal: await server.ssrLoadModule("/seo/legalDocuments.js"), site: await server.ssrLoadModule("/seo/site.js") };
  } finally {
    await server.close();
  }
}

export const isIndexed = (route) => !route.noindex && !route.canonicalPath;

// `pattern` must match exactly once: a tag that index.html no longer has fails the build instead of leaving a page with the home page's.
function replaceOnce(html, pattern, replacement, what) {
  const matches = html.match(new RegExp(pattern.source, "g"))?.length ?? 0;
  if (matches !== 1) throw new Error(`prerender: index.html has ${matches} of ${what}, expected 1`);
  return html.replace(pattern, () => replacement);
}
const setContent = (html, selector, value) =>
  replaceOnce(html, new RegExp(`<meta ${selector} content="[^"]*" />`), `<meta ${selector} content="${escapeHtml(value)}" />`, `<meta ${selector}>`);

const linkStyle = 'style="color: #e8c170;"';
const paragraph = (text, style = "margin: 0 0 1rem 0;") => `<p style="${style}">${escapeHtml(text)}</p>`;

function legalSections(document) {
  return document.sections
    .map((section) => {
      const blocks = section.blocks.map((block) =>
        block.kind === "list" ? `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : paragraph(block.text, block.kind === "callout" ? "margin: 0 0 1rem 0; font-weight: 600;" : undefined),
      );
      return `<h2 style="font-size: 1.25rem; margin: 1.5rem 0 0.5rem 0;">${escapeHtml(section.heading)}</h2>${blocks.join("")}`;
    })
    .join("");
}

/** What a page has inside #root until the application starts. */
export function renderContent(route, allRoutes, { routes, legal, site }) {
  const breadcrumbs = route.breadcrumbs
    .map((breadcrumb, index) =>
      index === route.breadcrumbs.length - 1 ? `<span aria-current="page">${escapeHtml(breadcrumb.name)}</span>` : `<a ${linkStyle} href="${routes.withTrailingSlash(breadcrumb.path)}">${escapeHtml(breadcrumb.name)}</a>`,
    )
    .join(" › ");
  const document = legal.legalDocuments.find((entry) => entry.routePath === route.path);
  const legalPaths = new Set(legal.legalDocuments.map((entry) => entry.routePath));
  const others = allRoutes.filter((other) => isIndexed(other) && other.path !== "/" && other.path !== route.path && !legalPaths.has(other.path));
  const list = others.map((other) => `<li style="margin: 0 0 0.5rem 0;"><a ${linkStyle} href="${routes.withTrailingSlash(other.path)}">${escapeHtml(other.h1)}</a>: ${escapeHtml(other.description)}</li>`).join("");
  const footer = [
    ...(route.path === "/" ? [] : [`<a ${linkStyle} href="/">${escapeHtml(site.siteName)}</a>`]),
    ...legal.legalDocuments.filter((entry) => entry.routePath !== route.path).map((entry) => `<a ${linkStyle} href="${routes.withTrailingSlash(entry.routePath)}">${escapeHtml(entry.navLabel)}</a>`),
    `<a ${linkStyle} href="${site.repositoryUrl}">Source on GitHub</a>`,
  ].join(" · ");
  return [
    '<main style="max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; font-family: system-ui, sans-serif; line-height: 1.6; color: #f1e8d0;">',
    `<nav aria-label="Breadcrumb" style="font-size: 0.875rem; color: #9aa0a6; margin-bottom: 0.75rem;">${breadcrumbs}</nav>`,
    `<h1 style="font-size: 2rem; line-height: 1.2; margin: 0 0 1rem 0;">${escapeHtml(route.h1)}</h1>`,
    paragraph(route.intro),
    ...(route.body ?? []).map((text) => paragraph(text)),
    ...(document ? [legalSections(document)] : ['<p role="status" style="margin: 0 0 1rem 0; color: #9aa0a6;">Loading the simulator…</p>']),
    ...(list ? [`<h2 style="font-size: 1.25rem; margin: 2rem 0 0.75rem 0;">${route.path === "/" ? "Fights you can practice" : "More OSRS simulators"}</h2>`, `<ul style="padding-left: 1.25rem; margin: 0 0 1.5rem 0;">${list}</ul>`] : []),
    `<p style="font-size: 0.875rem; color: #9aa0a6;">${footer}</p>`,
    "</main>",
  ].join("");
}

/** The built index.html as the page of `route`. */
export function renderPage(template, route, allRoutes, modules) {
  const { routes, site } = modules;
  const canonical = routes.canonicalUrl(route);
  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(route.title)}</title>`, "<title>");
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />`, '<link rel="canonical">');
  html = setContent(html, 'name="description"', route.description);
  html = setContent(html, 'property="og:url"', canonical);
  html = setContent(html, 'property="og:title"', route.title);
  html = setContent(html, 'property="og:description"', route.description);
  html = setContent(html, 'property="og:image"', site.siteOrigin + route.ogImagePath);
  html = setContent(html, 'name="twitter:title"', route.title);
  html = setContent(html, 'name="twitter:description"', route.description);
  html = setContent(html, 'name="twitter:image"', site.siteOrigin + route.ogImagePath);
  const head = [
    `<meta name="keywords" content="${escapeHtml(route.keywords.join(", "))}" />`,
    ...(route.noindex ? ['<meta name="robots" content="noindex, follow" />'] : []),
    ...route.jsonLd.map((data) => `<script type="application/ld+json">${jsonForScript(data)}</script>`),
  ];
  html = replaceOnce(html, /<\/head>/, head.map((line) => "  " + line + "\n  ").join("") + "</head>", "</head>");
  // Ahead of the loading screen index.html has in #root, which covers it.
  return replaceOnce(html, /<div id="root">/, `<div id="root">${renderContent(route, allRoutes, modules)}`, '<div id="root">');
}

export function renderSitemap(allRoutes, { routes }) {
  const urls = allRoutes.filter(isIndexed).map((route) => `  <url><loc>${escapeHtml(routes.canonicalUrl(route))}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** Writes the pages and the sitemap into `outDir`, whose index.html is the template. The number of pages. */
export async function prerender(outDir, root = "client") {
  const modules = await loadSeoModules(root);
  const allRoutes = modules.routes.buildSeoRoutes();
  const template = readFileSync(path.join(outDir, "index.html"), "utf8");
  for (const route of allRoutes) {
    const directory = path.join(outDir, ...route.path.split("/").filter(Boolean));
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, "index.html"), renderPage(template, route, allRoutes, modules));
  }
  writeFileSync(path.join(outDir, "sitemap.xml"), renderSitemap(allRoutes, modules));
  return allRoutes.length;
}

/** The Vite plugin: after the bundle is written. */
export function prerenderRoutes() {
  let outDir, root;
  return {
    name: "prerender-routes",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      // A build that failed has written no index.html.
      if (!existsSync(path.join(outDir, "index.html"))) return;
      const pages = await prerender(outDir, root);
      this.info?.(`prerendered ${pages} pages and sitemap.xml`);
    },
  };
}
