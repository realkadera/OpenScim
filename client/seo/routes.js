// The pages of the site as search engines are told of them: for each route
// its title, description, heading, texts and structured data. Two readers:
//
//   assets/application.js   sets the document's title and meta tags when the
//                           route changes, and draws the landmark section
//   tools/seo/prerender.mjs writes one HTML page per route into the build,
//                           and sitemap.xml from those that are indexed
//
// An encounter's texts are its descriptor's `seo` (encounters/registry.js).
// Without them its page has the display name and the description, and asks
// search engines not to index it. This module imports no chunk.
//
// A route is { path, title, description, h1, intro, body?, keywords,
// ogImagePath, breadcrumbs, jsonLd, noindex?, canonicalPath? }. `body` is
// further paragraphs for the page that is written into the build.
import { encounterDefinitions } from "../engine/encounterKinds.js";
import { encounterRegistry } from "../encounters/registry.js";
import { yamaContractVariants } from "../encounters/yama/contracts.js";
import { legalDocuments, legalDocumentsDate } from "./legalDocuments.js";
import { repositoryUrl, siteName, siteOrigin } from "./site.js";

const ogImagePath = "/assets/openscim-logo/openscim-logo/og-image.png?v=b16c9498";
const homeTitle = "OSRS Simulator: Practice Bosses in Your Browser | " + siteName;
const homeDescription =
  "Free, community driven OSRS simulator. Practice Old School RuneScape bosses, raids and wave fights in your browser, then take them on for real.";
const homeKeywords = [
  "OSRS simulator",
  "OSRS combat simulator",
  "OSRS boss simulator",
  "OSRS sim",
  "Old School RuneScape simulator",
  "OSRS PvM simulator",
  "OSRS boss practice",
  "OSRS HCIM practice",
];
const betaNote = "Beta: the fight is playable while its timings and mechanics are still being tuned.";
const osrsVideoGame = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Old School RuneScape",
  alternateName: "OSRS",
  publisher: { "@type": "Organization", name: "Jagex" },
  genre: ["MMORPG", "Role-playing game"],
  url: "https://oldschool.runescape.com/",
};

export function withTrailingSlash(path) {
  return path === "/" ? "/" : path.replace(/\/+$/, "") + "/";
}
export function absoluteUrl(path) {
  return siteOrigin + withTrailingSlash(path);
}
// A retired route's page is the page of the route that took its place.
export function canonicalUrl(route) {
  return absoluteUrl(route.canonicalPath ?? route.path);
}
function truncateAtWord(text, length) {
  if (text.length <= length) return text;
  const cut = text.slice(0, length - 1);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trimEnd() + "…";
}
function breadcrumbJsonLd(breadcrumbs) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((breadcrumb, index) => ({ "@type": "ListItem", position: index + 1, name: breadcrumb.name, item: absoluteUrl(breadcrumb.path) })),
  };
}

// The home page. `entries` are the encounters whose routes are indexed.
function buildHomeRoute(entries) {
  return {
    path: "/",
    title: homeTitle,
    description: homeDescription,
    h1: siteName + ": Community driven OSRS simulator",
    intro:
      "Practice the hardest fights in Old School RuneScape in your browser. Learn an encounter in sim, drill the mechanics until you are confident, then take it on for real.",
    body: [
      "Every fight runs on the game's own tick, with the prayers, gear switches, movement and special attacks you would use in game. Pick a boss, set up your loadout, and retry a mechanic as often as you need: nothing to install, and nothing at stake.",
      siteName + " is free and open source. It is the community continuation of Scim.GG, developed in the open at " + repositoryUrl + ".",
    ],
    keywords: [...homeKeywords, ...entries.map((entry) => entry.name + " simulator")],
    ogImagePath,
    breadcrumbs: [{ name: "Home", path: "/" }],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: siteName,
        url: siteOrigin,
        description: homeDescription,
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        browserRequirements: "Requires a modern browser with WebGL 2 support",
        featureList: entries.map((entry) => entry.name + " simulator"),
      },
      { "@context": "https://schema.org", "@type": "Organization", name: siteName, url: siteOrigin, logo: siteOrigin + "/assets/openscim-logo/openscim-logo/openscim-wordmark.svg", sameAs: [repositoryUrl] },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "OSRS boss simulators on " + siteName,
        itemListElement: entries.map((entry, index) => ({ "@type": "ListItem", position: index + 1, name: entry.name + " simulator", description: entry.description, url: absoluteUrl(entry.path) })),
      },
    ],
  };
}

// An encounter's entry: its name and summary for the home page's lists, and
// `buildRoute(path)`. Nothing for a kind without a descriptor. With the
// descriptor's `seo` the route is listed and indexed, unless that says
// `noindex`; an encounter marked `isWorkInProgress` says "(Beta)" in its
// title and heading, as the menus do.
function buildEncounterEntry(encounterKind) {
  const descriptor = encounterRegistry.getDescriptor(encounterKind);
  if (!descriptor) return;
  const { displayName, description, seo } = descriptor;
  if (!seo) {
    return {
      name: displayName,
      description,
      buildRoute: (path) => ({ path, title: displayName + " | " + siteName, description, h1: displayName, intro: description, keywords: [displayName], ogImagePath, breadcrumbs: [{ name: displayName, path }], jsonLd: [], noindex: true }),
    };
  }
  const name = seo.name ?? displayName;
  const beta = descriptor.isWorkInProgress ? " (Beta)" : "";
  return {
    name,
    description: seo.summary ?? description,
    buildRoute: (path) => {
      const breadcrumbs = [
        { name: "Home", path: "/" },
        { name: seo.breadcrumb ?? name, path },
      ];
      return {
        path,
        title: seo.title + beta + " | " + siteName,
        description: seo.description,
        h1: (seo.h1 ?? name) + beta,
        intro: seo.intro ?? seo.description,
        body: [...(seo.body ?? []), ...(beta ? [betaNote] : [])],
        keywords: seo.keywords ?? [name],
        ogImagePath,
        breadcrumbs,
        jsonLd: [breadcrumbJsonLd(breadcrumbs), osrsVideoGame],
        ...(seo.noindex ? { noindex: true } : {}),
      };
    },
  };
}

// A Yama contract's page, under Yama's own; none for "no contract", which is
// Yama's page.
function buildYamaContractRoute(contract, yamaPath) {
  if (contract.id === "no_contract") return null;
  const path = yamaPath + "/" + contract.id.replace(/_/g, "-");
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Yama (P3)", path: yamaPath },
    { name: contract.name, path },
  ];
  return {
    path,
    title: truncateAtWord(contract.name + ": OSRS Yama Contract Simulator | " + siteName, 65),
    description: truncateAtWord("Practice the " + contract.name + " contract on Yama in your browser. " + contract.subtitle + " Learn it before trying it for real.", 240),
    h1: "Yama: " + contract.name + " Contract",
    intro: contract.name + " is a Yama contract. " + contract.subtitle + " Practice it in sim before trying it for real.",
    keywords: ["Yama " + contract.name, contract.name + " contract", "OSRS Yama " + contract.name, "Yama P3 contracts", "OSRS Yama simulator"],
    ogImagePath,
    breadcrumbs,
    jsonLd: [breadcrumbJsonLd(breadcrumbs), osrsVideoGame],
    noindex: !contract.available,
  };
}

function buildLegalRoute(document) {
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: document.navLabel, path: document.routePath },
  ];
  const site = { name: siteName, url: siteOrigin };
  return {
    path: document.routePath,
    title: document.metaTitle,
    description: document.metaDescription,
    h1: document.title,
    intro: document.summary,
    keywords: document.keywords,
    ogImagePath,
    breadcrumbs,
    jsonLd: [
      breadcrumbJsonLd(breadcrumbs),
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: document.title,
        url: absoluteUrl(document.routePath),
        description: document.metaDescription,
        inLanguage: "en",
        datePublished: legalDocumentsDate,
        dateModified: legalDocumentsDate,
        isPartOf: { "@type": "WebSite", ...site },
        publisher: { "@type": "Organization", ...site },
      },
    ],
  };
}

// Every route, the home page first. The list is the same for as long as the
// page lives (the encounters are fixed at load), so it is built once.
let routesOfEveryEncounter;
export function buildSeoRoutes(definitions = encounterDefinitions) {
  if (definitions === encounterDefinitions && routesOfEveryEncounter) return routesOfEveryEncounter;
  const routed = definitions.filter((definition) => definition.registered && definition.slug !== null);
  const entries = routed.map((definition) => {
    const entry = buildEncounterEntry(definition.kind);
    if (!entry) throw new Error("Missing SEO metadata for registered encounter: " + definition.kind);
    return { ...entry, path: "/" + definition.slug };
  });
  const encounterRoutes = entries.map((entry) => entry.buildRoute(entry.path));
  const routes = [buildHomeRoute(entries.filter((entry, index) => !encounterRoutes[index].noindex)), ...encounterRoutes];
  // A kind that is one no more ("zuk" is the Inferno started at wave 69) keeps its address, as another address of its encounter's page.
  routed.forEach((definition, index) => {
    for (const retired of definition.retiredKinds ?? []) routes.push({ ...encounterRoutes[index], path: "/" + retired.slug, noindex: true, canonicalPath: "/" + definition.slug });
  });
  for (const definition of routed) {
    for (const contract of yamaContractVariants) {
      if (!definition.variantKinds.includes(contract.encounterKind)) continue;
      const route = buildYamaContractRoute(contract, "/" + definition.slug);
      if (route) routes.push(route);
    }
  }
  for (const document of legalDocuments) routes.push(buildLegalRoute(document));
  if (definitions === encounterDefinitions) routesOfEveryEncounter = routes;
  return routes;
}

// The route of an address; the home page for one that has none.
export function findSeoRoute(location) {
  const path = location.replace(/\?.*$/, "").replace(/#.*$/, "").replace(/\/+$/, "") || "/";
  const routes = buildSeoRoutes();
  return routes.find((route) => route.path === path) ?? routes[0];
}
