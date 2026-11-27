import { toEsModule } from "./rolldown-runtime.js";
import { requireJSZip } from "./vendor.js";
import {
  Um as c,
  Nh as d,
  sg as e,
  logger as f,
  Rh as g,
  setArenaConfigFromCache as h,
  ah as i,
  Yh as j,
  Om as k,
  ce as l,
  vg as m,
  LogLevel as n,
  Fh as o,
  createDefaultStats as p,
  Ih as q,
  Nk as r,
  eh as s,
  Qm as t,
  Xm as u,
  ug as v,
  um as w,
  dm as x,
  Nm as y,
  gm as z,
  Bzip2Decoder as A,
  Qg as B,
  Am as C,
  mm as D,
  em as E,
  Rm as F,
  km as G,
  Cm as H,
  vm as I,
  _m as J,
  om as K,
  ge as L,
  ng as M,
  fg as N,
  Gh as O,
} from "./rendering.js";
var JSZipModule = toEsModule(requireJSZip(), 1);
var hasRequestedPersistentStorage = false;
var CacheDatabase = class {
  constructor() {
    l(this, "dbPromise", null);
    l(this, "dbGeneration", 0);
    this.requestPersistentStorage();
  }
  async requestPersistentStorage() {
    if (
      !hasRequestedPersistentStorage &&
      ((hasRequestedPersistentStorage = true),
      "undefined" != typeof navigator &&
        navigator.storage &&
        navigator.storage.persist)
    ) {
      try {
        if (!(await navigator.storage.persist())) {
          f.debug(
            "CacheStorage",
            "Persistent storage not granted. Cache may be evicted under storage pressure.",
          );
        }
      } catch (Q) {
        f.warn("CacheStorage", "Failed to request persistent storage:", Q);
      }
    }
  }
  openDatabase() {
    if (this.dbPromise) {
      return this.dbPromise;
    }
    const Q = ++this.dbGeneration;
    const R = () => {
      if (this.dbGeneration === Q) {
        this.dbPromise = null;
      }
    };
    this.dbPromise = new Promise((S, T) => {
      const U = indexedDB.open("osrs-yama-cache", 2);
      U.onerror = () => {
        R();
        T(new Error("Failed to open database: " + U.error?.message));
      };
      U.onupgradeneeded = (V) => {
        const result2 = V.target.result;
        const oldVersion2 = V.oldVersion;
        if (result2.objectStoreNames.contains("blobs") && oldVersion2 < 2) {
          result2.deleteObjectStore("blobs");
          if (result2.objectStoreNames.contains("meta")) {
            result2.deleteObjectStore("meta");
          }
        }
        if (!result2.objectStoreNames.contains("meta")) {
          result2.createObjectStore("meta", {
            keyPath: "cacheId",
          });
        }
        if (!result2.objectStoreNames.contains("blobs")) {
          result2.createObjectStore("blobs", {
            keyPath: ["cacheId", "path"],
          });
        }
        if (!result2.objectStoreNames.contains("parsed")) {
          result2
            .createObjectStore("parsed", {
              keyPath: ["cacheId", "kind", "id"],
            })
            .createIndex("byCacheId", "cacheId", {
              unique: false,
            });
        }
      };
      U.onsuccess = () => {
        const result3 = U.result;
        result3.onversionchange = () => {
          result3.close();
          R();
        };
        result3.onclose = R;
        S(result3);
      };
    });
    this.dbPromise = this.dbPromise.catch((S) => {
      R();
      throw S;
    });
    return this.dbPromise;
  }
  async storeCacheFile(P, Q, R = 0) {
    try {
      const T = await this.openDatabase();
      return new Promise((U, V) => {
        const W = {
          cjusj: function (a1, a2) {
            return a1 === a2;
          },
          EaNZr: function (a1, a2) {
            return a1(a2);
          },
          vqDDj: function (a1, a2) {
            return a1(a2);
          },
        };
        const X = T.transaction("blobs", "readwrite");
        const Y = X.objectStore("blobs");
        const Z = {
          path: P,
          cacheId: R,
          data: Q,
          size: Q.byteLength,
        };
        const a0 = Y.put(Z);
        a0.onerror = () => {
          if ("QuotaExceededError" === a0.error?.name) {
            V(
              new Error(
                "Storage quota exceeded while storing " +
                  P +
                  " (" +
                  Q.byteLength +
                  " bytes)",
              ),
            );
          } else {
            W.vqDDj(
              V,
              new Error("Failed to store cache file: " + a0.error?.message),
            );
          }
        };
        X.oncomplete = () => U();
        X.onerror = () =>
          V(new Error("Transaction failed: " + X.error?.message));
        X.onabort = () =>
          V(new Error("Transaction aborted: " + X.error?.message));
      });
    } catch (U) {
      if (U instanceof Error && U.message.includes("quota")) {
        throw U;
      }
      throw new Error("Failed to store cache file: " + U);
    }
  }
  async vm(P, Q = 0) {
    const S = await this.openDatabase();
    return new Promise((T, U) => {
      const V = S.transaction("blobs", "readonly")
        .objectStore("blobs")
        .get([Q, P]);
      V.onerror = () => {
        U(new Error("Failed to retrieve cache file: " + V.error?.message));
      };
      V.onsuccess = () => {
        const result4 = V.result;
        T(result4 ? result4.data : null);
      };
    });
  }
  async getCacheFilesParallel(P, Q, R = 0) {
    const T = await this.openDatabase();
    const U = new Map();
    return new Promise((V, W) => {
      const X = T.transaction("blobs", "readonly");
      const Y = X.objectStore("blobs");
      let Z = 0;
      const length2 = P.length;
      for (const a1 of P) {
        const a2 = Y.get([R, a1]);
        a2.onerror = () => {
          W(
            new Error(
              "Failed to retrieve cache file " + a1 + ": " + a2.error?.message,
            ),
          );
        };
        a2.onsuccess = () => {
          const result5 = a2.result;
          if (result5) {
            U.set(a1, result5.data);
          }
          Z++;
          if (Q) {
            Q(Z, length2);
          }
          if (Z === length2) {
            V(U);
          }
        };
      }
      if (0 === P.length) {
        V(U);
      }
      X.onerror = () => W(new Error("Transaction failed: " + X.error?.message));
    });
  }
  async hasCacheFile(P, Q = 0) {
    const S = await this.openDatabase();
    return new Promise((T, U) => {
      const W = S.transaction("blobs", "readonly")
        .objectStore("blobs")
        .getKey([Q, P]);
      W.onerror = () => {
        U(new Error("Failed to check cache file: " + W.error?.message));
      };
      W.onsuccess = () => {
        T(undefined !== W.result);
      };
    });
  }
  async sC(P) {
    const R = await this.openDatabase();
    return new Promise((S, T) => {
      const U = R.transaction("meta", "readwrite");
      const V = U.objectStore("meta").put(P);
      V.onerror = () => {
        T(new Error("Failed to store cache metadata: " + V.error?.message));
      };
      U.oncomplete = () => S();
      U.onerror = () => T(new Error("Transaction failed: " + U.error?.message));
      U.onabort = () =>
        T(new Error("Transaction aborted: " + U.error?.message));
    });
  }
  async iC(P) {
    const R = await this.openDatabase();
    return new Promise((S, T) => {
      const U = R.transaction("meta", "readonly").objectStore("meta").get(P);
      U.onerror = () => {
        T(new Error("Failed to retrieve cache metadata: " + U.error?.message));
      };
      U.onsuccess = () => {
        S(U.result || null);
      };
    });
  }
  async rC(P, Q, R, S) {
    const U = await this.openDatabase();
    return new Promise((V, W) => {
      const X = U.transaction("parsed", "readwrite");
      const Y = X.objectStore("parsed");
      const Z = {
        cacheId: P,
        kind: Q,
        id: R,
        data: S,
      };
      const a0 = Y.put(Z);
      a0.onerror = () => {
        W(new Error("Failed to store parsed data: " + a0.error?.message));
      };
      X.oncomplete = () => V();
      X.onerror = () => W(new Error("Transaction failed: " + X.error?.message));
      X.onabort = () =>
        W(new Error("Transaction aborted: " + X.error?.message));
    });
  }
  async nC(P, Q, R) {
    const T = await this.openDatabase();
    return new Promise((U, V) => {
      const W = T.transaction("parsed", "readonly")
        .objectStore("parsed")
        .get([P, Q, R]);
      W.onerror = () => {
        V(new Error("Failed to retrieve parsed data: " + W.error?.message));
      };
      W.onsuccess = () => {
        const result6 = W.result;
        U(result6 ? result6.data : null);
      };
    });
  }
  async deleteCacheMeta(P) {
    const Q = await this.openDatabase();
    return new Promise((R, S) => {
      const T = Q.transaction("meta", "readwrite");
      T.objectStore("meta").delete(P);
      T.oncomplete = () => R();
      T.onerror = () =>
        S(new Error("Failed to delete cache metadata: " + T.error?.message));
      T.onabort = () =>
        S(new Error("Failed to delete cache metadata: " + T.error?.message));
    });
  }
  async cC(P) {
    const R = await this.openDatabase();
    return new Promise((S, T) => {
      const U = R.transaction(["meta", "blobs", "parsed"], "readwrite");
      U.objectStore("meta").delete(P);
      const V = IDBKeyRange.bound([P], [P, []]);
      U.objectStore("blobs").delete(V);
      U.objectStore("parsed").delete(V);
      U.oncomplete = () => S();
      U.onerror = () =>
        T(new Error("Failed to delete cache: " + U.error?.message));
      U.onabort = () =>
        T(new Error("Failed to delete cache: " + U.error?.message));
    });
  }
  async hC(P) {
    const R = await this.openDatabase();
    return new Promise((S, T) => {
      const U = R.transaction(["meta", "blobs", "parsed"], "readwrite");
      U.objectStore("meta").delete(IDBKeyRange.upperBound(P, true));
      const V = IDBKeyRange.upperBound([P], true);
      U.objectStore("blobs").delete(V);
      U.objectStore("parsed").delete(V);
      U.oncomplete = () => S();
      U.onerror = () =>
        T(new Error("Failed to delete old caches: " + U.error?.message));
      U.onabort = () =>
        T(new Error("Failed to delete old caches: " + U.error?.message));
    });
  }
  async close() {
    if (this.dbPromise) {
      (await this.dbPromise).close();
      this.dbPromise = null;
    }
  }
};
function wrapErrorWithContext(P, Q) {
  const S = Q + ": " + (P instanceof Error ? P.message : "Unknown error");
  if (P instanceof L) {
    return new L(S);
  } else {
    return new Error(S);
  }
}
async function matchesSha256(P, Q) {
  const S = globalThis.crypto?.subtle;
  if (!S) {
    f.warn(
      "Cache",
      "SubtleCrypto unavailable; skipping disk.zip checksum verification",
    );
    return true;
  }
  const T = new Uint8Array(await S.digest("SHA-256", P));
  return (
    Array.from(T, (U) => U.toString(16).padStart(2, "0")).join("") ===
    Q.toLowerCase()
  );
}
var CacheDownloadClient = class {
  constructor(P, Q) {
    const R = {
      UBUua: function (S, T, U, V) {
        return S(T, U, V);
      },
      uOJLU: function (S, T) {
        return S ?? T;
      },
      QPgkL: "openrs2",
      IqtTd: "/osrs-cache",
    };
    l(this, "baseUrl", undefined);
    l(this, "mode", undefined);
    if (P !== undefined) {
      this.baseUrl = P;
      this.mode = R.uOJLU(Q, "openrs2");
      return;
    }
    this.baseUrl = "/osrs-cache";
    this.mode = Q ?? "mirror";
  }
  lC() {
    return this.mode;
  }
  dC(P, Q = {}) {
    if ("mirror" !== this.mode) {
      return this.baseUrl + "/caches/" + P + "/disk.zip";
    }
    const S = Q.diskZipSha256
      ? "?v=" + encodeURIComponent(Q.diskZipSha256)
      : "";
    return this.baseUrl + "/disk.zip" + S;
  }
  async uC() {
    const Q = "openrs2_cache_list";
    const R = this.mode !== "mirror";
    if (R) {
      try {
        const item = sessionStorage.getItem(Q);
        if (item) {
          const { data: data, timestamp: timestamp } = JSON.parse(item);
          if (Date.now() - timestamp < 3600000) {
            return data;
          }
        }
      } catch {}
    }
    try {
      const V =
        "mirror" === this.mode
          ? this.baseUrl + "/manifest.json"
          : this.baseUrl + "/caches.json";
      // index.html asked for the manifest while this script was on its way.
      const early = "mirror" === this.mode ? globalThis.__cacheBoot?.manifest : null;
      const W = (await early?.catch(() => null)) ?? (await m(() => v(V)));
      let X;
      if ("mirror" === this.mode) {
        if (
          !(function (Y) {
            if (!Y || typeof Y != "object" || Array.isArray(Y)) {
              return false;
            }
            const Z = Y;
            if (typeof Z.id != "number") {
              return false;
            }
            if ("string" != typeof Z.scope) {
              return false;
            }
            if (typeof Z.game != "string") {
              return false;
            }
            if (typeof Z.language != "string") {
              return false;
            }
            if ("string" != typeof Z.environment) {
              return false;
            }
            if ("string" != typeof Z.timestamp) {
              return false;
            }
            if (!Array.isArray(Z.builds) || Z.builds.length === 0) {
              return false;
            }
            const a0 = Z.builds[0];
            return !!a0 && !("number" != typeof a0.major);
          })(W)
        ) {
          throw new Error(
            "Invalid mirror manifest: missing id, builds, or timestamp",
          );
        }
        X = [W];
      } else {
        if (!Array.isArray(W)) {
          throw new Error("Invalid cache list response: expected array");
        }
        X = W;
      }
      if (R) {
        try {
          sessionStorage.setItem(
            Q,
            JSON.stringify({
              data: X,
              timestamp: Date.now(),
            }),
          );
        } catch {}
      }
      return X;
    } catch (Y) {
      throw wrapErrorWithContext(Y, "Failed to fetch cache list");
    }
  }
  async fC(P, Q, R = {}) {
    try {
      const T = this.dC(P, R);
      const U = (X) => m(() => this.yC(X, Q, R));
      let V = await U(T);
      const diskZipSha2562 = R.diskZipSha256;
      if (!diskZipSha2562) {
        return {
          data: V,
          matchesManifest: true,
        };
      }
      try {
        if (await matchesSha256(V, diskZipSha2562)) {
          return {
            data: V,
            matchesManifest: true,
          };
        }
        f.warn(
          "Cache",
          "disk.zip did not match manifest sha256 " +
            diskZipSha2562 +
            "; re-downloading once",
        );
        V = await U(
          "" + T + (T.includes("?") ? "&" : "?") + "retry=" + Date.now(),
        );
        if (await matchesSha256(V, diskZipSha2562)) {
          return {
            data: V,
            matchesManifest: true,
          };
        }
        f.error(
          "Cache",
          "disk.zip does not match its published checksum; using it for this session only",
        );
      } catch (X) {
        f.error(
          "Cache",
          "Could not check disk.zip against its published checksum; using it for this session only:",
          X,
        );
      }
      return {
        data: V,
        matchesManifest: false,
      };
    } catch (Y) {
      throw wrapErrorWithContext(Y, "Failed to download cache " + P);
    }
  }
  async yC(P, Q, R) {
    const S = {
      WCegh: function (V, W) {
        return V * W;
      },
      ucjDO: function (V, W, X) {
        return V?.(W, X);
      },
      JbXia: function (V, W, X) {
        return V(W, X);
      },
      sQjOh: "Cache",
    };
    // index.html asked for the whole cache while this script was on its way
    // (a first visit to a route without a boot pack): take over its download.
    await globalThis.__cacheBoot?.pack?.catch(() => null); // settled: it has decided
    const early = globalThis.__cacheBoot?.whole;
    if (early?.url === P) {
      globalThis.__cacheBoot.whole = null;
      early.onprogress = () => Q?.(Math.min(99, Math.round((early.loaded / (R.estimatedTotalBytes || 167772160)) * 100)), early.loaded);
      early.onprogress();
      try {
        return await early.bytes;
      } catch {}
    }
    const { bytes: bytes, contentType: contentType } = await N(P, {
      onProgress: (V, W) => {
        const X = W ?? (R.estimatedTotalBytes || 167772160);
        const Y = Math.round((V / X) * 100);
        S.ucjDO(Q, W ? Y : Math.min(99, Y), V);
      },
    });
    if (contentType?.includes("text/html")) {
      f.error(
        "Cache",
        "disk.zip was served as " +
          contentType +
          "; trying to read it as a zip anyway",
      );
    }
    return bytes;
  }
  async wC(P) {
    try {
      const R =
        this.mode === "mirror"
          ? this.baseUrl + "/keys.json"
          : this.baseUrl + "/caches/" + P + "/keys.json";
      const S = await m(() => v(R));
      if (!Array.isArray(S)) {
        throw new Error("Invalid keys response: expected array");
      }
      return S;
    } catch (T) {
      throw wrapErrorWithContext(T, "Failed to download keys for cache " + P);
    }
  }
  gC(P) {
    const R = P.filter(
      (T) =>
        T.scope === "runescape" &&
        T.game === "oldschool" &&
        T.language === "en" &&
        (T.environment === "live" || T.environment === "beta"),
    );
    if (0 === R.length) {
      throw new Error(
        "No OSRS caches found matching criteria (scope=runescape, game=oldschool, language=en, environment=live/beta)",
      );
    }
    const S = R.sort((T, U) => {
      const time = new Date(T.timestamp).getTime();
      return new Date(U.timestamp).getTime() - time;
    })[0];
    f.debug(
      "Cache",
      "Selected OSRS cache: ID " + S.id + ", Revision " + S.builds[0].major,
    );
    return S;
  }
};
var REQUIRED_CACHE_INDEXES = [0, 1, 2, 4, 5, 7, 8, 9, 22];
function hasRequiredCacheFiles(P) {
  return (
    (P.has("main_file_cache.dat2") || P.has("main_file_cache.dat")) &&
    P.has("main_file_cache.idx255") &&
    REQUIRED_CACHE_INDEXES.every((R) => P.has("main_file_cache.idx" + R))
  );
}
var CacheManager = class {
  constructor(P, Q) {
    l(this, "storage", undefined);
    l(this, "client", undefined);
    l(this, "state", "UNLOADED");
    l(this, "error", undefined);
    l(this, "downloadProgress", undefined);
    l(this, "cacheInfo", undefined);
    l(this, "listeners", new Set());
    l(this, "loadingState", {
      status: "idle",
    });
    l(this, "cacheSystem", null);
    l(this, "mapLoader", null);
    l(this, "underlayLoader", null);
    l(this, "overlayLoader", null);
    l(this, "locTypeLoader", null);
    l(this, "npcTypeLoader", null);
    l(this, "objTypeLoader", null);
    l(this, "enumTypeLoader", null);
    l(this, "structTypeLoader", null);
    l(this, "identKitLoader", null);
    l(this, "spotAnimTypeLoader", null);
    l(this, "locModelLoader", null);
    l(this, "npcModelLoader", null);
    l(this, "playerModelLoader", null);
    l(this, "spotAnimModelLoader", null);
    l(this, "modelLoader", null);
    l(this, "animationSystem", null);
    l(this, "textureLoader", null);
    l(this, "minimapNpcDotUrl", null);
    l(this, "arenaBounds", null);
    l(this, "rsCacheInfo", null);
    l(this, "xteaKeys", new Map());
    l(this, "additionalMapSquares", new Map());
    l(this, "store", null);
    // While the whole cache is on its way behind a boot pack (bootFromPack):
    // settles when it is under the loaders.
    l(this, "hydration", null);
    // Lets the whole cache start downloading; nothing to do without a boot pack.
    l(this, "beginHydration", () => {});
    this.storage = P || new CacheDatabase();
    this.client = Q || new CacheDownloadClient();
  }
  subscribe(P) {
    this.listeners.add(P);
    P(this.getState());
    return () => {
      this.listeners.delete(P);
    };
  }
  getState() {
    return {
      state: this.state,
      error: this.error,
      downloadProgress: this.downloadProgress,
      cacheInfo: this.cacheInfo,
    };
  }
  getDownloadState() {
    if ("loading" === this.loadingState.status) {
      return this.loadingState;
    }
    switch (this.state) {
      case "UNLOADED":
        return {
          status: "idle",
        };
      case "DOWNLOADING":
      case "EXTRACTING":
        return (
          this.loadingState ?? {
            status: "idle",
          }
        );
      case "LOADED":
        return {
          status: "success",
        };
      case "ERROR":
        return {
          status: "error",
          message: this.error || "Unknown error",
        };
    }
  }
  async ensureCache(P) {
    const Q = {
      IcPCE: function (R, S) {
        return R || S;
      },
      Mlair: function (R, S) {
        return R === S;
      },
      FZxjc: function (R, S) {
        return R !== S;
      },
      NmFay: "LOADED",
      igLzi: "DOWNLOADING",
      PnyjZ: function (R, S) {
        return R === S;
      },
      qvCIJ: "CacheManager.checkIndexedDB",
      RBTrn: function (R, S) {
        return R && S;
      },
      UkOsD: "Cache",
      DVmnk: "initializing",
      YIdzl: "Initializing cache system...",
      AczFl: "CacheManager.ensureCache",
      QxSTh: function (R, S) {
        return R && S;
      },
      XKrzi: "Unknown error",
      nESez: "ERROR",
    };
    e.start("CacheManager.ensureCache");
    if ("LOADED" !== this.state) {
      if ("DOWNLOADING" === this.state || "EXTRACTING" === this.state) {
        e.end("CacheManager.ensureCache");
        return this.waitForState("LOADED");
      }
      try {
        let R = P;
        if (!R) {
          e.start("CacheManager.getCacheList");
          const V = await this.client.uC();
          const W = this.client.gC(V);
          R = W.id;
          this.cacheInfo = W;
          e.end("CacheManager.getCacheList");
        }
        r(R, this.cacheInfo?.diskZipSha256);
        e.start("CacheManager.checkIndexedDB");
        const S = await this.readStoredMeta(R);
        e.end("CacheManager.checkIndexedDB");
        const T = this.cacheInfo?.diskZipSha256;
        const U = (function (X, Y) {
          return (
            !Q.IcPCE(!X, !Y) &&
            (!(X.manifestHash === Y) || !X.sourceUrl.includes("?v=" + Y))
          );
        })(S, T);
        if (Q.RBTrn(S, !U)) {
          f.info(
            "Cache",
            "Cache " +
              R +
              " found in IndexedDB (fetched at " +
              new Date(S.fetchedAt).toISOString() +
              ")",
          );
          this.pC("loading-from-storage", 0, "Reading from browser storage...");
          this.setState("DOWNLOADING");
          const X = await this.readStoredFiles(R);
          if (X) {
            this.pC("initializing", 8, "Initializing cache system...");
            await this.initializeCacheSystem(X);
            this.setState("LOADED");
            e.end("CacheManager.ensureCache");
            return;
          }
        } else if (Q.QxSTh(S, U)) {
          f.info(
            "Cache",
            "Cache " +
              R +
              ' content changed (stored "' +
              S.manifestHash +
              '" != deployed "' +
              T +
              '"), re-downloading',
          );
        } else {
          f.info(
            "Cache",
            "Cache " + R + " not found in IndexedDB, downloading...",
          );
        }
        if (!(await this.bootFromPack(R))) {
          await this.fC(R);
        }
        e.end("CacheManager.ensureCache");
      } catch (Y) {
        e.end("CacheManager.ensureCache");
        const Z = Y instanceof Error ? Y.message : "Unknown error";
        this.setState("ERROR", Z);
        throw Y;
      }
    } else {
      e.end("CacheManager.ensureCache");
    }
  }
  async fC(P) {
    e.start("CacheManager.downloadCache");
    this.pC("downloading", 0, "Connecting to cache server...");
    this.setState("DOWNLOADING");
    try {
      const R = this.cacheInfo?.size;
      const S = R ? Math.round(R / 1048576) : 160;
      e.start("CacheManager.downloadZip");
      const { data: data, matchesManifest: matchesManifest } =
        await this.client.fC(
          P,
          (Y, Z) => {
            const a0 = Z / 1048576;
            this.downloadProgress = {
              percent: Y,
              downloadedMB: a0,
              totalMB: S,
            };
            const a1 = a0.toFixed(0);
            this.pC("downloading", Y, a1 + " MB / " + S + " MB");
          },
          {
            ...(R
              ? {
                  estimatedTotalBytes: R,
                }
              : {}),
            ...(this.cacheInfo?.diskZipSha256
              ? {
                  diskZipSha256: this.cacheInfo.diskZipSha256,
                }
              : {}),
          },
        );
      e.end("CacheManager.downloadZip");
      const V = (data.byteLength / 1024 / 1024).toFixed(1);
      f.info("Cache", "Downloaded cache " + P + " (" + V + " MB)");
      this.pC("extracting", 0, "Unpacking cache archive...");
      this.setState("EXTRACTING");
      e.start("CacheManager.extractZip");
      const W = await this.extractZip(data);
      e.end("CacheManager.extractZip");
      let X = false;
      if (matchesManifest) {
        this.pC("storing", 0, "Saving to browser storage...");
        e.start("CacheManager.storeToIndexedDB");
        X = await this.storeFiles(P, W);
        e.end("CacheManager.storeToIndexedDB");
      }
      await this.initializeCacheSystem(W);
      if (X && (await this.storeMeta(P))) {
        await this.AC(P);
      }
      this.setState("LOADED");
      f.info(
        "Cache",
        "Cache " +
          P +
          " extracted" +
          (X ? " and stored in IndexedDB" : " (not persisted)"),
      );
      e.end("CacheManager.downloadCache");
    } catch (Y) {
      e.end("CacheManager.downloadCache");
      throw Y;
    }
  }
  // A first visit starts from the route's boot pack: a cache of the groups
  // the route reads on the way to its first frame (tools/boot-packs.mjs), a
  // fifth of the whole. The whole cache follows behind the running game
  // (hydrate). False when the route has no pack or it would not load: the
  // caller downloads the whole cache first, as it always did.
  async bootFromPack(P) {
    const name =
      location.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "lobby";
    const pack = this.cacheInfo?.bootPacks?.[name];
    if (!pack || globalThis.__noBootPack) {
      return false;
    }
    try {
      this.pC("downloading", 0, "Connecting to cache server...");
      this.setState("DOWNLOADING");
      const url =
        this.client.baseUrl + "/boot/" + name + ".zip?v=" + pack.sha256;
      const totalMB = (pack.bytes / 1048576).toFixed(1);
      // index.html asked for it while this script was still on its way.
      const early = await globalThis.__cacheBoot?.pack?.catch(() => null);
      const bytes =
        early?.url === url
          ? early.bytes
          : (
              await N(url, {
                onProgress: (loaded) =>
                  this.pC(
                    "downloading",
                    Math.min(99, Math.round((loaded / pack.bytes) * 100)),
                    (loaded / 1048576).toFixed(1) + " MB / " + totalMB + " MB",
                  ),
              })
            ).bytes;
      if (!(await matchesSha256(bytes, pack.sha256))) {
        throw new Error("it does not match its published checksum");
      }
      this.pC("extracting", 0, "Unpacking cache archive...");
      this.setState("EXTRACTING");
      await this.initializeCacheSystem(await this.extractZip(bytes));
    } catch (error) {
      f.warn(
        "Cache",
        "Could not start from boot pack " +
          name +
          "; downloading the whole cache first instead:",
        error,
      );
      return false;
    }
    // The whole cache waits for the world to be on screen (beginHydration,
    // which the application calls when its own assets are in): its 24 MB
    // would take the line from the images the first frame is waiting for.
    const begun = new Promise((resolve) => {
      this.beginHydration = resolve;
    });
    setTimeout(this.beginHydration, 30000);
    this.hydration = begun
      .then(() => this.hydrate(P))
      .catch((error) => {
        f.error(
          "Cache",
          "Could not load the whole cache behind boot pack " +
            name +
            "; what the pack lacks stays missing until a reload:",
          error,
        );
      })
      .then(() => {
        this.hydration = null;
      });
    this.setState("LOADED");
    return true;
  }
  // Puts the whole cache under the loaders that started from a boot pack.
  // The pack has the whole cache's reference tables and, for the groups it
  // holds, the same bytes, so what the loaders have read stays true; a group
  // the pack left out read as empty and is there from now on.
  async hydrate(P) {
    const sha = this.cacheInfo?.diskZipSha256;
    const size = this.cacheInfo?.size;
    const { data: data, matchesManifest: matchesManifest } =
      await this.client.fC(P, () => {}, {
        ...(size ? { estimatedTotalBytes: size } : {}),
        ...(sha ? { diskZipSha256: sha } : {}),
      });
    const files = await this.extractZip(data);
    const whole = B.bm("dat2", files, REQUIRED_CACHE_INDEXES).getIndex(
      REQUIRED_CACHE_INDEXES[0],
    ).store;
    this.store.dataFile = whole.dataFile;
    this.store.indexFiles = whole.indexFiles;
    this.store.metaFile = whole.metaFile;
    f.info("Cache", "Whole cache " + P + " is under the boot pack");
    if (matchesManifest) {
      // Not awaited: the game has the cache; the next visit wants it stored.
      this.storeFiles(P, files, true)
        .then((stored) => stored && this.storeMeta(P))
        .then((marked) => marked && this.AC(P));
    }
  }
  // Whether a boot pack left this group out and the whole cache, still on its
  // way, has it: the pack marks its idx entry "size 0, sector 1" (packCache,
  // tools/assets/cache.mjs).
  awaitsWholeCache(index, group) {
    const idx = this.store?.indexFiles[index];
    if (!this.hydration || !idx || group < 0 || group * 6 + 6 > idx.byteLength) {
      return false;
    }
    const entry = new DataView(idx, group * 6, 6);
    return (
      entry.getUint16(0) === 0 &&
      entry.getUint8(2) === 0 &&
      entry.getUint16(3) === 0 &&
      entry.getUint8(5) === 1
    );
  }
  async readStoredMeta(P) {
    try {
      return await this.storage.iC(P);
    } catch (R) {
      f.warn(
        "Cache",
        "Could not read cache metadata from browser storage; downloading instead:",
        R,
      );
      return null;
    }
  }
  // quiet: behind a running game (hydrate), where no loading screen listens.
  async storeFiles(P, Q, quiet = false) {
    try {
      await this.storage.deleteCacheMeta(P);
      const S = [...Q.entries()];
      for (let T = 0; T < S.length; T++) {
        const [U, V] = S[T];
        await this.storage.storeCacheFile(U, V, P);
        const W = Math.round(((T + 1) / S.length) * 100);
        if (quiet) {
          continue;
        }
        this.pC(
          "storing",
          W,
          "Saving " + U + " (" + (T + 1) + "/" + S.length + ")",
        );
      }
      return true;
    } catch (X) {
      f.warn(
        "Cache",
        "Could not save the cache to browser storage; using it for this session only:",
        X,
      );
      return false;
    }
  }
  async storeMeta(P) {
    const Q = {
      HnRnm: function (T, U) {
        return T ?? U;
      },
    };
    const R = this.cacheInfo?.diskZipSha256;
    const S = {
      cacheId: P,
      buildMajor: this.cacheInfo?.builds[0]?.major || 0,
      buildMinor: this.cacheInfo?.builds[0]?.minor || 0,
      fetchedAt: Date.now(),
      sourceUrl: this.client.dC(
        P,
        R
          ? {
              diskZipSha256: R,
            }
          : {},
      ),
      manifestHash: Q.HnRnm(R, ""),
    };
    try {
      await this.storage.sC(S);
      return true;
    } catch (T) {
      f.warn(
        "Cache",
        "Could not mark the stored cache complete; it will be downloaded again next visit:",
        T,
      );
      return false;
    }
  }
  async AC(P) {
    try {
      await this.storage.hC(P);
    } catch (R) {
      f.warn("Cache", "Could not remove older caches from browser storage:", R);
    }
  }
  async extractZip(P) {
    let R;
    try {
      R = await JSZipModule.default.loadAsync(P);
    } catch (T) {
      const U = T instanceof Error ? T.message : String(T);
      throw new Error("Cache archive is corrupt or incomplete: " + U);
    }
    const S = new Map();
    for (const [V, W] of Object.entries(R.files)) {
      if (W.dir) {
        continue;
      }
      const X = V.split("/").pop() || V;
      if (!this.isCacheFile(X)) {
        continue;
      }
      const Y = await W.async("arraybuffer");
      S.set(X, Y);
    }
    if (!hasRequiredCacheFiles(S)) {
      throw new Error("Invalid cache zip: missing required cache files");
    }
    return S;
  }
  isCacheFile(P) {
    return (
      "main_file_cache.dat2" === P ||
      "main_file_cache.dat" === P ||
      P.startsWith("main_file_cache.idx")
    );
  }
  async initializeCacheSystem(P) {
    e.start("CacheManager.initializeCacheSystem");
    const R = this.cacheInfo?.builds[0]?.major || 232;
    this.minimapNpcDotUrl = null;
    if (
      (function (T) {
        const U = T?.containerCompressions;
        return !Array.isArray(U) || U.includes("bzip2");
      })(this.cacheInfo)
    ) {
      this.pC("initializing", 10, "Starting Bzip2 decompressor...");
      e.start("CacheManager.Bzip2.initWasm");
      await A.Am();
      e.end("CacheManager.Bzip2.initWasm");
    }
    this.pC("initializing", 18, "Reading cache index files...");
    e.start("CacheManager.CacheSystem.fromMap");
    this.cacheSystem = B.bm("dat2", P, REQUIRED_CACHE_INDEXES);
    // Every index reads its groups through this one store.
    this.store = this.cacheSystem.getIndex(REQUIRED_CACHE_INDEXES[0]).store;
    // tools/boot-packs.mjs sets this to learn which groups a route reads.
    const recordedReads = globalThis.__cacheReads;
    if (recordedReads) {
      const readGroup = this.store.read.bind(this.store);
      this.store.read = (index, group) => {
        recordedReads.add(index + ":" + group);
        return readGroup(index, group);
      };
    }

    e.end("CacheManager.CacheSystem.fromMap");
    e.start("CacheManager.MapLoader.init");
    const index = this.cacheSystem.getIndex(5);
    this.mapLoader = new u(index, R);
    let zebakGroups;
    const prepareZebak = () => zebakGroups ??= Promise.all([
      import("./rendering.js").then(module => module.Bzip2Decoder.Am()),
      import("/toa/zebak/native-cache.js").then(module => module.installRoomGroups(this.cacheSystem))
    ]).catch(error => { zebakGroups = undefined; throw error; });
    if (location.pathname.replace(/\/+$/, "") === "/zebak") await prepareZebak();
    const readMap = this.mapLoader.loadMapSquare.bind(this.mapLoader);
    const startupSquares = new Set();
    let initializing = true;
    this.mapLoader.loadMapSquare = async (x,y) => {
      // Started from the lobby's boot pack: a fight is entered with the whole
      // cache, so every square but the lobby's own waits for it. Those are
      // the squares the pack lacks, and the one read here at start-up for
      // the arena bounds (TC), which the pack has and is a fight's.
      if (initializing) startupSquares.add(x + "," + y);
      else if (this.hydration && (startupSquares.has(x + "," + y) || this.awaitsWholeCache(5, this.mapLoader.af(x, y)))) {
        this.beginHydration();
        await this.hydration;
      }
      // The nexus (55,80) opens Zebak's setup window, whose portrait needs the model.
      if ((Math.abs(x-61)<=1 && Math.abs(y-84)<=1) || (x===55 && y===80)) await prepareZebak();
      return readMap(x,y);
    };
    e.end("CacheManager.MapLoader.init");
    this.rsCacheInfo = {
      name: "osrs",
      game: "oldschool",
      environment: "live",
      revision: R,
      timestamp: new Date().toISOString(),
      size: 0,
    };
    try {
      this.pC("initializing", 25, "Loading items, NPCs, and objects...");
      e.start("CacheManager.initConfigLoaders");
      const index2 = this.cacheSystem.getIndex(2);
      const U = 1;
      const V = 3;
      const W = 4;
      const X = 6;
      const Y = 9;
      const Z = 10;
      const a0 = 13;
      const a1 = 8;
      const a2 = 34;
      const a3 = index2.Lg(U);
      const a4 = index2.Lg(W);
      const a5 = index2.Lg(X);
      const a6 = index2.Lg(Y);
      const a7 = index2.Lg(Z);
      const a8 = index2.Lg(V);
      const a9 = index2.Lg(a0);
      const aa = index2.Lg(a1);
      const ab = index2.Lg(a2);
      this.underlayLoader = new w(this.rsCacheInfo, a3);
      this.overlayLoader = new I(this.rsCacheInfo, a4);
      this.locTypeLoader = new H(this.rsCacheInfo, a5);
      this.npcTypeLoader = new J(this.rsCacheInfo, a6);
      this.objTypeLoader = new y(this.rsCacheInfo, a7);
      this.enumTypeLoader = new D(this.rsCacheInfo, aa);
      this.structTypeLoader = new k(this.rsCacheInfo, ab);
      this.identKitLoader = new G(this.rsCacheInfo, a8);
      this.spotAnimTypeLoader = new c(this.rsCacheInfo, a9);
      const index3 = this.cacheSystem.getIndex(7);
      const index4 = this.cacheSystem.getIndex(0);
      const index5 = this.cacheSystem.getIndex(1);
      const af = index2.Lg(12);
      f.debug(
        "Cache",
        "seqArchive loaded, fileCount=" +
          af.fileCount +
          ", lastFileId=" +
          af.lastFileId,
      );
      this.pC("initializing", 38, "Preparing 3D model loaders...");
      this.locModelLoader = new F(
        this.rsCacheInfo,
        a5,
        index3,
        af,
        index4,
        index5,
      );
      this.modelLoader = new C(index3);
      this.npcModelLoader = new q(this.npcTypeLoader, this.modelLoader);
      this.spotAnimModelLoader = new o(
        this.spotAnimTypeLoader,
        this.modelLoader,
        this.locModelLoader.qh() ?? undefined,
        this.locModelLoader.getSeqFrameLoader() ?? undefined,
      );
      this.playerModelLoader = new g(
        this.objTypeLoader,
        this.identKitLoader,
        this.modelLoader,
      );
      this.pC("initializing", 50, "Loading animation sequences...");
      this.animationSystem = M();
      const index6 = this.cacheSystem.getIndex(22);
      this.animationSystem.initialize(
        this.rsCacheInfo,
        index4,
        index5,
        af,
        index6,
      );
      e.end("CacheManager.initConfigLoaders");
      f.info(
        "Cache",
        "Underlay/overlay/loc/npc/model loaders initialized successfully",
      );
    } catch (ai) {
      e.end("CacheManager.initConfigLoaders");
      const aj = ai instanceof Error ? ai.message : String(ai);
      throw new Error("Failed to load CONFIG index: " + aj);
    }
    try {
      this.pC("initializing", 60, "Loading sprites and textures...");
      e.start("CacheManager.initTextureLoader");
      const index7 = this.cacheSystem.getIndex(9);
      const index8 = this.cacheSystem.getIndex(8);
      this.textureLoader = j.load(index7, index8);
      try {
        const am = O.loadIntoIndexedSprite(index8, 511);
        if (am) {
          this.minimapNpcDotUrl = d(am);
        }
      } catch (an) {
        f.warn("Cache", "Failed to load minimap NPC dot sprite:", an);
      }
      e.end("CacheManager.initTextureLoader");
      f.debug(
        "Cache",
        "TextureLoader initialized with " +
          this.textureLoader.getTextureIds().length +
          " textures",
      );
    } catch (ao) {
      e.end("CacheManager.initTextureLoader");
      const ap = ao instanceof Error ? ao.message : String(ao);
      throw new Error("Failed to load TEXTURES index: " + ap);
    }
    this.pC("initializing", 68, "Fetching map encryption keys...");
    await this.loadXteaKeys();
    this.pC("initializing", 76, "Computing walkable tiles...");
    await this.analyzeArenaBounds();
    this.pC("initializing", 84, "Loading arena objects and NPCs...");
    if (f.isEnabled(n.DEBUG, "Cache")) {
      await this.kC();
    }
    initializing = false;
    e.end("CacheManager.initializeCacheSystem");
  }
  async loadMapLocs(P, Q, R) {
    if (!this.mapLoader) {
      return null;
    }
    const T = R ?? [
      {
        dx: 0,
        dy: 0,
      },
    ];
    const U = t(T);
    const V = await Promise.all(
      s(T).map(async ({ dx: X, dy: Y }) => {
        const Z = P + X;
        const a0 = Q + Y;
        return {
          squareX: Z,
          squareY: a0,
          terrain: await this.mapLoader?.loadMapSquare(Z, a0),
        };
      }),
    );
    const W = new Map();
    for (const { squareX: squareX, squareY: squareY, terrain: terrain } of V) {
      if (terrain) {
        W.set(squareX + "," + squareY, terrain);
      }
    }
    return (
      await Promise.all(
        U.map(
          async ({
            dx: a0,
            dy: a1,
            tileOffsetX: tileOffsetX,
            tileOffsetY: tileOffsetY,
          }) => {
            const a4 = P + a0;
            const a5 = Q + a1;
            const a6 = W.get(a4 + "," + a5);
            if (!a6) {
              return [];
            }
            const a7 = i(a6, (a8, a9) => W.get(a8 + "," + a9));
            return ((await this.loadLocationsWithTypes(a4, a5, this.getXteaKey(a4, a5))) ?? []).map(
              (a8) => ({
                ...a8,
                location: {
                  ...a8.location,
                  localX: a8.location.localX + tileOffsetX,
                  localY: a8.location.localY + tileOffsetY,
                },
                mapSquareOffset: {
                  x: tileOffsetX,
                  y: tileOffsetY,
                },
                terrainHeightPlanes: a7.tileHeights,
                terrainContextOrigin: {
                  x: a7.coreOriginX,
                  y: a7.coreOriginY,
                },
              }),
            );
          },
        ),
      )
    ).flat();
  }
  async loadXteaKeys() {
    e.start("CacheManager.loadXteaKeys");
    if (!this.cacheInfo) {
      e.end("CacheManager.loadXteaKeys");
      return;
    }
    const Q = this.cacheInfo.id;
    const R = "xtea_keys_" + Q + ".json";
    try {
      e.start("CacheManager.loadXteaKeys.checkCache");
      let S;
      let T = null;
      try {
        T = await this.storage.vm(R, Q);
      } catch (W) {
        f.warn(
          "Cache",
          "Could not read stored XTEA keys; fetching them instead:",
          W,
        );
      }
      e.end("CacheManager.loadXteaKeys.checkCache");
      let U = false;
      if (T) {
        e.start("CacheManager.loadXteaKeys.parseCache");
        const X = new TextDecoder();
        const Y = JSON.parse(X.decode(T));
        e.end("CacheManager.loadXteaKeys.parseCache");
        if (Y && "object" == typeof Y && !Array.isArray(Y) && "keys" in Y) {
          S = Y.keys;
          f.info("Cache", "Loaded XTEA keys from IndexedDB cache");
        } else if (Array.isArray(Y)) {
          S = Y;
          U = true;
          f.info(
            "Cache",
            "Loaded XTEA keys from IndexedDB cache (legacy format)",
          );
        } else {
          S = [];
          U = true;
        }
      } else {
        S = await this.fetchAndCacheXteaKeys(Q, R);
      }
      this.parseXteaKeysArray(S);
      if (this.xteaKeys.size === 0 && U) {
        f.warn(
          "Cache",
          "Cached XTEA data yielded 0 keys (legacy format), re-fetching from network...",
        );
        e.start("CacheManager.loadXteaKeys.refetch");
        try {
          S = await this.fetchAndCacheXteaKeys(Q, R);
          this.parseXteaKeysArray(S);
          f.info(
            "Cache",
            "Re-fetched " + this.xteaKeys.size + " XTEA keys, cache updated",
          );
        } catch (Z) {
          f.warn("Cache", "XTEA re-fetch failed:", Z);
        }
        e.end("CacheManager.loadXteaKeys.refetch");
      }
      f.info("Cache", "Loaded " + this.xteaKeys.size + " XTEA keys");
      const V = this.getXteaKey(23, 157);
      if (V) {
        f.trace(
          "Cache",
          "Found XTEA key for Yama map (23, 157): [" + V.join(", ") + "]",
        );
      }
      e.end("CacheManager.loadXteaKeys");
    } catch (a0) {
      e.end("CacheManager.loadXteaKeys");
      f.warn("Cache", "Failed to load XTEA keys:", a0);
    }
  }
  async fetchAndCacheXteaKeys(P, Q) {
    let S;
    e.start("CacheManager.loadXteaKeys.fetch");
    try {
      S = await this.client.wC(P);
    } finally {
      e.end("CacheManager.loadXteaKeys.fetch");
    }
    e.start("CacheManager.loadXteaKeys.storeCache");
    const T = {
      keys: Array.isArray(S) ? S : [],
      fetchedAt: Date.now(),
    };
    const buffer2 = new TextEncoder().encode(JSON.stringify(T)).buffer;
    try {
      await this.storage.storeCacheFile(Q, buffer2, P);
      f.info("Cache", "Fetched and cached XTEA keys to IndexedDB");
    } catch (V) {
      f.warn(
        "Cache",
        "Could not save XTEA keys to browser storage; using them for this session only:",
        V,
      );
    }
    e.end("CacheManager.loadXteaKeys.storeCache");
    if (Array.isArray(S)) {
      return S;
    } else {
      return [];
    }
  }
  parseXteaKeysArray(P) {
    this.xteaKeys.clear();
    if (Array.isArray(P)) {
      for (const Q of P) {
        if (
          Q.mapsquare !== undefined &&
          Array.isArray(Q.key) &&
          Q.key.length === 4
        ) {
          this.xteaKeys.set(Q.mapsquare, Q.key);
        }
      }
    }
  }
  getXteaKey(P, Q) {
    const S = (P << 8) | Q;
    return this.xteaKeys.get(S);
  }
  async kC() {
    const Q = 23;
    const R = 157;
    const S = this.getXteaKey(Q, R);
    f.info("Cache", "Loading Yama Arena contents from map 23_157...");
    if (S) {
      f.debug("Cache", "Using XTEA key for map 23_157");
    } else {
      f.warn("Cache", "No XTEA key found for map 23_157");
    }
    try {
      const T = await this.loadLocationsWithTypes(Q, R, S);
      if (T && T.length > 0) {
        f.info(
          "Cache",
          "Yama Arena Locations: " + T.length + " objects loaded",
        );
      } else {
        f.warn(
          "Cache",
          "Yama Arena: No locations found (locs file may need XTEA keys or does not exist)",
        );
      }
      const U = await this.loadNpcSpawnsWithTypes(Q, R, S);
      if (U && U.length > 0) {
        f.info("Cache", "Yama Arena NPC Spawns: " + U.length + " NPCs loaded");
        for (const V of U) {
          f.trace(
            "Cache",
            V.npcType.name +
              " (ID: " +
              V.spawn.id +
              ") at (" +
              V.spawn.x +
              ", " +
              V.spawn.y +
              ") level " +
              V.spawn.level,
          );
        }
      } else {
        f.warn(
          "Cache",
          "Yama Arena: No NPC spawns found (file may need XTEA keys or does not exist)",
        );
      }
    } catch (W) {
      f.error("Cache", "Failed to log Yama arena contents:", W);
    }
  }
  async readStoredFiles(P) {
    this.pC("loading-from-storage", 2, "Reading cache files...");
    e.start("CacheManager.readStoredFiles");
    const R = [
      "main_file_cache.dat2",
      "main_file_cache.dat",
      "main_file_cache.idx255",
    ];
    for (const T of REQUIRED_CACHE_INDEXES) {
      R.push("main_file_cache.idx" + T);
    }
    let S;
    try {
      S = await this.storage.getCacheFilesParallel(
        R,
        (U, V) => {
          const W = 2 + Math.round((U / V) * 5);
          this.pC(
            "loading-from-storage",
            W,
            "Reading cache files (" + U + "/" + V + ")...",
          );
        },
        P,
      );
    } catch (U) {
      e.end("CacheManager.readStoredFiles");
      f.warn(
        "Cache",
        "Could not read the stored cache from browser storage; downloading instead:",
        U,
      );
      return null;
    }
    e.end("CacheManager.readStoredFiles");
    if (hasRequiredCacheFiles(S)) {
      return S;
    } else {
      f.warn(
        "Cache",
        "Stored cache " + P + " is incomplete; downloading instead",
      );
      return null;
    }
  }
  hd() {
    return this.mapLoader;
  }
  getUnderlayLoader() {
    return this.underlayLoader;
  }
  getOverlayLoader() {
    return this.overlayLoader;
  }
  getTextureLoader() {
    return this.textureLoader;
  }
  getMinimapNpcDotUrl() {
    return this.minimapNpcDotUrl;
  }
  getLocTypeLoader() {
    return this.locTypeLoader;
  }
  getNpcTypeLoader() {
    return this.npcTypeLoader;
  }
  getSpotAnimTypeLoader() {
    return this.spotAnimTypeLoader;
  }
  getLocModelLoader() {
    return this.locModelLoader;
  }
  getNpcModelLoader() {
    return this.npcModelLoader;
  }
  getPlayerModelLoader() {
    return this.playerModelLoader;
  }
  getSpotAnimModelLoader() {
    return this.spotAnimModelLoader;
  }
  getAnimationSystem() {
    return this.animationSystem;
  }
  zC() {
    return this.arenaBounds;
  }
  async loadAdditionalMapSquare(P, Q) {
    const R = P + "_" + Q;
    const S = this.additionalMapSquares.get(R);
    if (S) {
      return S;
    }
    const T = this.getXteaKey(P, Q);
    const [U, V, W] = await Promise.all([
      this.mapLoader ? this.mapLoader.loadMapSquare(P, Q) : null,
      this.loadMapLocs(P, Q),
      this.loadNpcSpawnsWithTypes(P, Q, T),
    ]);
    const X = {
      mapX: P,
      mapY: Q,
      terrain: U,
      locations: V,
      npcs: W,
    };
    this.additionalMapSquares.set(R, X);
    return X;
  }
  getAdditionalMapSquareData(P, Q) {
    return this.additionalMapSquares.get(P + "_" + Q);
  }
  getModelLoader() {
    return this.modelLoader;
  }
  getObjTypeLoader() {
    return this.objTypeLoader;
  }
  getEnumTypeLoader() {
    return this.enumTypeLoader;
  }
  getStructTypeLoader() {
    return this.structTypeLoader;
  }
  async loadLocationsWithTypes(P, Q, R) {
    if (!this.mapLoader || !this.locTypeLoader) {
      f.warn("Cache", "MapLoader or LocTypeLoader not available");
      return null;
    }
    const T = this.mapLoader.tf(P, Q);
    f.trace("Cache", "Loc archive ID for " + P + "_" + Q + ": " + T);
    const U = await this.mapLoader.loadLocations(P, Q, R);
    if (!U) {
      f.warn(
        "Cache",
        "Failed to load locations for map " +
          P +
          "_" +
          Q +
          " (archive " +
          T +
          "). May need XTEA keys.",
      );
      return null;
    }
    f.debug(
      "Cache",
      "Loaded " + U.locations.length + " raw locations from l" + P + "_" + Q,
    );
    const V = [];
    for (const W of U.locations) {
      try {
        const X = this.locTypeLoader.load(W.id);
        V.push({
          location: W,
          locType: X,
          modelType: W.type,
        });
      } catch (Y) {
        f.warn("Cache", "Failed to load LocType " + W.id + ":", Y);
      }
    }
    return V;
  }
  async loadNpcSpawnsWithTypes(P, Q, R) {
    if (!this.mapLoader || !this.npcTypeLoader) {
      f.warn("Cache", "MapLoader or NpcTypeLoader not available");
      return null;
    }
    const T = this.mapLoader.getNpcSpawnArchiveId(P, Q);
    f.trace("Cache", "NPC spawn archive ID for " + P + "_" + Q + ": " + T);
    const U = await this.mapLoader.loadNpcSpawns(P, Q, R);
    if (!U) {
      f.debug(
        "Cache",
        "Failed to load NPC spawns for map " +
          P +
          "_" +
          Q +
          " (archive " +
          T +
          "). May need XTEA keys.",
      );
      return null;
    }
    f.debug(
      "Cache",
      "Loaded " + U.spawns.length + " raw NPC spawns from n" + P + "_" + Q,
    );
    const V = [];
    for (const W of U.spawns) {
      try {
        const X = this.npcTypeLoader.load(W.id);
        V.push({
          spawn: W,
          npcType: X,
        });
      } catch (Y) {
        f.warn("Cache", "Failed to load NpcType " + W.id + ":", Y);
      }
    }
    return V;
  }
  getLocCollisionLoader() {
    if (this.locTypeLoader) {
      return (P) => {
        try {
          const Q = this.locTypeLoader.load(P);
          return {
            clipType: Q.clipType,
            sizeX: Q.sizeX,
            sizeY: Q.sizeY,
            blocksProjectile: Q.blocksProjectile,
          };
        } catch {
          return;
        }
      };
    }
  }
  async buildArenaConfig(P) {
    const Q = {
      PmCHH: function (Z, a0) {
        return Z - a0;
      },
      jFJXQ: function (Z, a0) {
        return Z < a0;
      },
      NbxPs: function (Z, a0) {
        return Z === a0;
      },
      eZmSP: function (Z, a0) {
        return Z !== a0;
      },
      tBCMs: function (Z, a0, a1) {
        return Z(a0, a1);
      },
      SntZR: function (Z, a0) {
        return Z + a0;
      },
      Gymdc: function (Z, a0) {
        return Z * a0;
      },
      FYGeL: function (Z, a0) {
        return Z + a0;
      },
      VKaHN: function (Z, a0, a1, a2, a3, a4, a5) {
        return Z(a0, a1, a2, a3, a4, a5);
      },
      VqHho: "CacheManager.buildArenaConfig",
      HEqhv: "MapLoader not available for arena config build",
      fvQRo: "Cache",
      nmVAf: function (Z, a0) {
        return Z === a0;
      },
      bsDFe: function (Z, a0) {
        return Z === a0;
      },
      BIfCE: function (Z, a0) {
        return Z ?? a0;
      },
      fSltX: function (Z, a0) {
        return Z < a0;
      },
    };
    const {
      mapX: mapX,
      mapY: mapY,
      seedX: seedX,
      seedY: seedY,
      extraLocs: extraLocs,
      excludedStaticLocIds: excludedStaticLocIds,
      mapSquareOffsets: mapSquareOffsets,
    } = P;
    e.start("CacheManager.buildArenaConfig");
    const Y = {
      bounds: null,
      walkableTiles: null,
      collisionMap: null,
    };
    if (!this.mapLoader) {
      f.warn("Cache", "MapLoader not available for arena config build");
      e.end("CacheManager.buildArenaConfig");
      return Y;
    }
    try {
      const Z = await this.mapLoader.loadMapSquare(mapX, mapY);
      if (!Z) {
        f.warn(
          "Cache",
          "Failed to load map square " +
            mapX +
            "_" +
            mapY +
            " for arena config build",
        );
        e.end("CacheManager.buildArenaConfig");
        return Y;
      }
      const a0 = this.getLocCollisionLoader();
      let a1;
      let a2;
      const a3 = t(mapSquareOffsets);
      if (1 === a3.length && a3[0]?.dx === 0 && 0 === a3[0].dy) {
        const a6 = this.getXteaKey(mapX, mapY);
        const a7 = await this.mapLoader.loadLocations(mapX, mapY, a6);
        const ground = mapX === 61 && mapY === 84
          ? (await import("/toa/zebak/ground.js")).effectiveGround(Z, a7?.locations ?? [])
          : null;
        const a8 = K(
          ground?.map ?? Z,
          ground?.locations ?? Q.BIfCE(a7, undefined),
          a0,
          0,
          extraLocs,
          excludedStaticLocIds,
        );
        a1 = a8.collisionMap;
        a2 = a8.walkableTiles;
      } else {
        a1 = (function (aa) {
          const ab = {
            NFoRk: function (ag, ai) {
              return ag - ai;
            },
            WdqMU: function (ag, ai) {
              return ag < ai;
            },
            YfSQW: function (ag, ai) {
              return ag >= ai;
            },
            ooCrT: function (ag, ai) {
              return ag + ai;
            },
            czqzL: function (ag, ai, aj) {
              return ag(ai, aj);
            },
            nUswe: function (ag, ai) {
              return ag === ai;
            },
            DydVk: function (ag, ai) {
              return ag !== ai;
            },
            AMfGF: function (ag, ai) {
              return ag & ai;
            },
            XJEtZ: function (ag, ai, aj) {
              return ag(ai, aj);
            },
          };
          const ac = -aa * 64;
          const ad = (aa * 2 + 1) * 64;
          const ae = new Int32Array(ad * ad);
          const af = (ag, ai) => {
            const aj = ag - ac;
            const ak = ai - ac;
            if (aj >= 0 && aj < ad && ak >= 0 && ak < ad) {
              return aj + ak * ad;
            } else {
              return null;
            }
          };
          return {
            sizeX: ad,
            sizeY: ad,
            flags: ae,
            getFlag(ag, ai) {
              const aj = af(ag, ai);
              if (null === aj) {
                return -1;
              } else {
                return ae[aj];
              }
            },
            hasFlag(ag, ai, aj) {
              const flag2 = this.getFlag(ag, ai);
              return flag2 !== -1 && 0 !== (flag2 & aj);
            },
            flag(ag, ai, aj) {
              const ak = af(ag, ai);
              if (ak !== null) {
                ae[ak] |= aj;
              }
            },
            unflag(ag, ai, aj) {
              const ak = ab.XJEtZ(af, ag, ai);
              if (ak !== null) {
                ae[ak] &= ~aj;
              }
            },
          };
        })(
          Math.max(
            ...a3.flatMap(({ dx: aa, dy: ab }) => [Math.abs(aa), Math.abs(ab)]),
          ),
        );
        a2 = new Set();
        const a9 = await Promise.all(
          a3.map(
            async ({
              dx: aa,
              dy: ab,
              tileOffsetX: tileOffsetX,
              tileOffsetY: tileOffsetY,
            }) => {
              const ae = mapX + aa;
              const af = mapY + ab;
              const ag =
                aa === 0 && 0 === ab
                  ? Z
                  : await this.mapLoader?.loadMapSquare(ae, af);
              if (!ag) {
                return null;
              }
              const ai = await this.mapLoader?.loadLocations(ae, af, this.getXteaKey(ae, af));
              return {
                analysis: K(
                  ag,
                  ai ?? undefined,
                  a0,
                  0,
                  aa === 0 && 0 === ab ? extraLocs : undefined,
                  excludedStaticLocIds,
                ),
                tileOffsetX: tileOffsetX,
                tileOffsetY: tileOffsetY,
              };
            },
          ),
        );
        for (const aa of a9) {
          if (!aa) {
            continue;
          }
          const {
            analysis: analysis,
            tileOffsetX: tileOffsetX,
            tileOffsetY: tileOffsetY,
          } = aa;
          for (let ae = 0; ae < 64; ae++) {
            for (let af = 0; af < 64; af++) {
              const flag3 = analysis.collisionMap.getFlag(ae, af);
              if (flag3 !== 0) {
                a1.flag(ae + tileOffsetX, af + tileOffsetY, flag3);
              }
            }
          }
          for (const ai of analysis.walkableTiles) {
            const [aj, ak] = ai.split(",").map(Number);
            a2.add(aj + tileOffsetX + "," + (ak + tileOffsetY));
          }
        }
      }
      const a4 = x(a2, seedX, seedY, a1);
      if (0 === a4.size) {
        f.warn(
          "Cache",
          "No walkable region found around seed (" +
            seedX +
            ", " +
            seedY +
            ") in " +
            mapX +
            "_" +
            mapY,
        );
        e.end("CacheManager.buildArenaConfig");
        return Y;
      }
      const a5 = z(a4);
      e.end("CacheManager.buildArenaConfig");
      return {
        bounds: a5,
        walkableTiles: a4,
        collisionMap: a1,
      };
    } catch (al) {
      e.end("CacheManager.buildArenaConfig");
      f.warn("Cache", "Failed to build arena config:", al);
      return Y;
    }
  }
  async analyzeArenaBounds(P = 23, Q = 157, R = 32, S = 30) {
    const U = await this.buildArenaConfig({
      mapX: P,
      mapY: Q,
      seedX: R,
      seedY: S,
    });
    if (U.bounds) {
      this.arenaBounds = U.bounds;
      h(U);
      f.info(
        "Cache",
        "Arena bounds extracted: " +
          U.bounds.width +
          "x" +
          U.bounds.height +
          " (" +
          U.bounds.minX +
          "," +
          U.bounds.minY +
          ") to (" +
          U.bounds.maxX +
          "," +
          U.bounds.maxY +
          "), " +
          (U.walkableTiles?.size ?? 0) +
          " walkable tiles",
      );
    }
    return U;
  }
  async retry() {
    if ("ERROR" !== this.state) {
      throw new Error("Cannot retry: not in ERROR state");
    }
    this.error = undefined;
    this.setState("UNLOADED");
    return this.ensureCache();
  }
  async getBlob(P) {
    if ("LOADED" !== this.state) {
      throw new Error("Cache not loaded");
    }
    return this.storage.vm(P, this.cacheInfo?.id || 0);
  }
  async nC(P, Q) {
    if ("LOADED" !== this.state) {
      throw new Error("Cache not loaded");
    }
    const S = this.cacheInfo?.id || 0;
    return this.storage.nC(S, P, Q);
  }
  async setParsed(P, Q, R) {
    if (this.state !== "LOADED") {
      throw new Error("Cache not loaded");
    }
    const S = this.cacheInfo?.id || 0;
    return this.storage.rC(S, P, Q, R);
  }
  async iC(P) {
    return this.storage.iC(P);
  }
  async cC(P) {
    await this.storage.cC(P);
    if (this.state === "LOADED") {
      this.setState("UNLOADED");
    }
  }
  pC(P, Q, R) {
    this.loadingState = {
      status: "loading",
      stage: P,
      percent: Q,
      detail: R,
    };
    this.notifyListeners();
  }
  setState(P, Q) {
    this.state = P;
    this.error = Q;
    if (P !== "DOWNLOADING") {
      this.downloadProgress = undefined;
    }
    if (!("LOADED" !== P) || P === "ERROR") {
      this.loadingState = {
        status: "idle",
      };
    }
    this.notifyListeners();
  }
  notifyListeners() {
    const state2 = this.getState();
    this.listeners.forEach((R) => {
      R(state2);
    });
  }
  async waitForState(P, Q = 300000) {
    if (this.state !== P) {
      return new Promise((S, T) => {
        const U = setTimeout(() => {
          V();
          T(new Error("Timeout waiting for state " + P));
        }, Q);
        const V = this.subscribe((W) => {
          if (W.state === P) {
            clearTimeout(U);
            V();
            S();
          } else if ("ERROR" === W.state) {
            clearTimeout(U);
            V();
            T(new Error(W.error || "Unknown error"));
          }
        });
      });
    }
  }
};
function toLocPlacement(P) {
  return {
    id: P.locId,
    localX: P.localX,
    localY: P.localY,
    type: P.type ?? E.NORMAL,
    rotation: P.rotation,
    level: P.level ?? 0,
  };
}
var defaultPlayerModelConfig = {
  appearance: {
    gender: 0,
    hairKit: 0,
    jawKit: 10,
    torsoKit: 18,
    armsKit: 26,
    handsKit: 33,
    legsKit: 36,
    feetKit: 42,
    hairColor: 0,
    torsoColor: 0,
    legsColor: 0,
    feetColor: 0,
    skinColor: 0,
  },
  equipment: {},
  stats: p(),
};
export { CacheDatabase, toLocPlacement, CacheManager, defaultPlayerModelConfig };
