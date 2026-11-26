// Deployment settings and browser-environment parsing.
//
// The original build only ran on scim.gg hosts and refused to start anywhere
// else. This fork runs wherever it is served, so the host is taken from the
// page location (it is used to build and recognise replay links).
import { siteHost } from "../seo/site.js";
var deploymentConfig = {
  hosts: [globalThis.location?.host ?? "localhost"],
  // Search engines index the project's own site and nothing else: a fork, a
  // preview or a local build asks them not to, and its canonical address is
  // the page of the site.
  indexable: globalThis.location?.host === siteHost,
};
function getDeploymentConfig() {
  return deploymentConfig;
}
function getDeploymentTarget() {
  return "community";
}
var browserNames = {
  Safari: true,
  Chrome: true,
  Firefox: true,
  Edge: true,
  Samsung: true,
  other: true,
};
var engineNames = {
  WebKit: true,
  Blink: true,
  Gecko: true,
  other: true,
};
var operatingSystems = {
  iOS: true,
  iPadOS: true,
  Android: true,
  macOS: true,
  Windows: true,
  Linux: true,
  other: true,
};
var deviceClasses = {
  mobile: true,
  tablet: true,
  desktop: true,
};
var deviceFamilies = {
  iPhone: {
    os: "iOS",
    deviceClass: "mobile",
  },
  iPod: {
    os: "iOS",
    deviceClass: "mobile",
  },
  iPad: {
    os: "iPadOS",
    deviceClass: "tablet",
  },
  "Android phone": {
    os: "Android",
    deviceClass: "mobile",
  },
  "Android tablet": {
    os: "Android",
    deviceClass: "tablet",
  },
};
function isKnownStringKey(a, b) {
  return "string" == typeof b && Object.hasOwn(a, b);
}
function parseMajorVersion(a) {
  const c = "string" == typeof a ? Number.parseInt(a, 10) : a;
  if ("number" == typeof c && Number.isSafeInteger(c) && c > 0 && c <= 999) {
    return c;
  } else {
    return undefined;
  }
}
function parseDisplayMode(a) {
  if (a === "standalone" || a === "browser") {
    return a;
  } else {
    return undefined;
  }
}
function parseBrowserEnvironment(a) {
  const c = (function (f) {
    if ("object" != typeof f || null === f) {
      return null;
    }
    const g = f;
    const {
      browser: browser,
      engine: engine,
      os: k,
      deviceClass: deviceClass,
    } = g;
    if (
      !isKnownStringKey(browserNames, browser) ||
      !isKnownStringKey(engineNames, engine) ||
      !isKnownStringKey(operatingSystems, k) ||
      !isKnownStringKey(deviceClasses, deviceClass)
    ) {
      return null;
    }
    const m =
      "number" == typeof g.browserMajor
        ? parseMajorVersion(g.browserMajor)
        : undefined;
    const p =
      "number" == typeof g.osMajor ? parseMajorVersion(g.osMajor) : undefined;
    const { deviceFamily: deviceFamily } = g;
    const v =
      isKnownStringKey(deviceFamilies, deviceFamily) &&
      deviceFamilies[deviceFamily].os === k &&
      deviceFamilies[deviceFamily].deviceClass === deviceClass
        ? deviceFamily
        : undefined;
    return {
      browser: browser,
      ...(m === undefined
        ? {}
        : {
            browserMajor: m,
          }),
      engine: engine,
      os: k,
      ...(undefined === p
        ? {}
        : {
            osMajor: p,
          }),
      deviceClass: deviceClass,
      ...(v === undefined
        ? {}
        : {
            deviceFamily: v,
          }),
    };
  })(a);
  if (c === null) {
    return null;
  }
  const d = parseDisplayMode(a.displayMode);
  if (d === undefined) {
    return c;
  } else {
    return {
      ...c,
      displayMode: d,
    };
  }
}
export {
  getDeploymentTarget,
  parseMajorVersion,
  parseBrowserEnvironment,
  getDeploymentConfig,
  parseDisplayMode,
};
