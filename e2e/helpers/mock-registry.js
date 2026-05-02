const http = require("http");
const AdmZip = require("adm-zip");

/**
 * Mock registry server for E2E tests.
 *
 * Serves the subset of the dash-registry HTTP API that the app actually
 * calls during install / publish / discover / update / delete:
 *
 *   GET    /api/packages                          → index { packages: [...] }
 *   GET    /api/packages/:scope/:name             → single package metadata
 *   GET    /api/packages/:scope/:name/download    → zip download (?version=)
 *   POST   /api/publish                           → records publish, returns {success, version}
 *   DELETE /api/packages/:scope/:name             → records delete, 204
 *   POST   /api/packages/resolve                  → resolves a list of names
 *
 * Tests seed packages via `registerPackage()` and assert against
 * `getPublishHistory()` / `getDeleteHistory()` to verify the app made
 * the right calls. The 10 stock themes are auto-registered on start
 * for back-compat with `registry-theme-install.spec.js`.
 *
 * Switched in via DASH_REGISTRY_API_URL=http://127.0.0.1:<port>.
 */

const STOCK_THEMES = {
    "nordic-frost": {
        name: "Nordic Frost",
        primary: "sky",
        secondary: "slate",
        tertiary: "blue",
        colors: {
            primary: "#0ea5e9",
            secondary: "#64748b",
            tertiary: "#3b82f6",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
    "dracula-night": {
        name: "Dracula Night",
        primary: "purple",
        secondary: "pink",
        tertiary: "cyan",
        colors: {
            primary: "#a855f7",
            secondary: "#ec4899",
            tertiary: "#06b6d4",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
    "solarized-warm": {
        name: "Solarized Warm",
        primary: "amber",
        secondary: "orange",
        tertiary: "yellow",
        colors: {
            primary: "#f59e0b",
            secondary: "#f97316",
            tertiary: "#eab308",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
    "monokai-ember": {
        name: "Monokai Ember",
        primary: "orange",
        secondary: "rose",
        tertiary: "green",
        colors: {
            primary: "#f97316",
            secondary: "#f43f5e",
            tertiary: "#22c55e",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
    "evergreen-pine": {
        name: "Evergreen Pine",
        primary: "emerald",
        secondary: "teal",
        tertiary: "lime",
        colors: {
            primary: "#10b981",
            secondary: "#14b8a6",
            tertiary: "#84cc16",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
    "sakura-blossom": {
        name: "Sakura Blossom",
        primary: "pink",
        secondary: "rose",
        tertiary: "fuchsia",
        colors: {
            primary: "#ec4899",
            secondary: "#f43f5e",
            tertiary: "#d946ef",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
    "oceanic-breeze": {
        name: "Oceanic Breeze",
        primary: "cyan",
        secondary: "sky",
        tertiary: "teal",
        colors: {
            primary: "#06b6d4",
            secondary: "#0ea5e9",
            tertiary: "#14b8a6",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
    "volcanic-ash": {
        name: "Volcanic Ash",
        primary: "red",
        secondary: "amber",
        tertiary: "orange",
        colors: {
            primary: "#ef4444",
            secondary: "#f59e0b",
            tertiary: "#f97316",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
    "lavender-haze": {
        name: "Lavender Haze",
        primary: "violet",
        secondary: "indigo",
        tertiary: "purple",
        colors: {
            primary: "#8b5cf6",
            secondary: "#6366f1",
            tertiary: "#a855f7",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
    "copper-canyon": {
        name: "Copper Canyon",
        primary: "orange",
        secondary: "amber",
        tertiary: "red",
        colors: {
            primary: "#f97316",
            secondary: "#f43f5e",
            tertiary: "#ef4444",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
};

// ----- Per-server state (reset on each start) ----------------------------

let packages = new Map(); // pkgKey → { scope, name, type, versions, latest, metadata }
let publishHistory = [];
let deleteHistory = [];

const pkgKey = (scope, name) => `@${scope}/${name}`;

/**
 * Register a package the mock should serve.
 *
 * @param {Object} pkg
 * @param {"theme"|"widget"|"dashboard"} pkg.type
 * @param {string} pkg.scope            - e.g. "trops" (no leading @)
 * @param {string} pkg.name
 * @param {string} [pkg.version="1.0.0"]
 * @param {Buffer} [pkg.zipBuffer]      - download payload; auto-built for stock themes
 * @param {Object} [pkg.metadata]       - extra fields merged into the index entry
 */
function registerPackage(pkg) {
    const {
        type,
        scope,
        name,
        version = "1.0.0",
        zipBuffer,
        metadata = {},
    } = pkg;
    const key = pkgKey(scope, name);
    let entry = packages.get(key);
    if (!entry) {
        entry = {
            type,
            scope,
            name,
            versions: new Map(),
            latest: version,
            metadata: { ...metadata },
        };
        packages.set(key, entry);
    }
    if (zipBuffer) entry.versions.set(version, zipBuffer);
    if (semverGt(version, entry.latest)) entry.latest = version;
    if (metadata) entry.metadata = { ...entry.metadata, ...metadata };
}

function semverGt(a, b) {
    const pa = a.split(".").map((n) => parseInt(n, 10));
    const pb = b.split(".").map((n) => parseInt(n, 10));
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return true;
        if ((pa[i] || 0) < (pb[i] || 0)) return false;
    }
    return false;
}

function clearPackages() {
    packages = new Map();
}

function getPublishHistory() {
    return publishHistory.slice();
}

function getDeleteHistory() {
    return deleteHistory.slice();
}

function clearHistory() {
    publishHistory = [];
    deleteHistory = [];
}

function buildThemeZip(themeName) {
    const themeData = STOCK_THEMES[themeName];
    if (!themeData) return null;
    const zip = new AdmZip();
    zip.addFile(
        `${themeName}.theme.json`,
        Buffer.from(JSON.stringify(themeData, null, 2))
    );
    return zip.toBuffer();
}

function seedStockThemes() {
    // Shape mirrors dash-core/electron/registry/test-registry-index.json
    // so the renderer's discover/install path treats these like the real
    // fixture entries (description / author / category / tags / colors).
    const descriptions = {
        "nordic-frost":
            "Cool Scandinavian palette with sky blues and slate accents",
        "dracula-night":
            "Dark editor-inspired theme with purple, pink, and cyan tones",
        "solarized-warm": "Warm autumn palette with amber and orange",
        "monokai-ember": "Ember-style classic editor palette",
        "evergreen-pine": "Forest greens and teals",
        "sakura-blossom": "Soft pinks and roses",
        "oceanic-breeze": "Cool cyans and seafoam",
        "volcanic-ash": "Hot reds and oranges",
        "lavender-haze": "Dreamy violets and indigos",
        "copper-canyon": "Earthy oranges and ambers",
    };
    const tagsByName = {
        "nordic-frost": ["cool", "minimal"],
        "dracula-night": ["dark", "editor"],
        "solarized-warm": ["warm", "classic"],
        "monokai-ember": ["dark", "editor"],
        "evergreen-pine": ["natural", "calm"],
        "sakura-blossom": ["soft", "pastel"],
        "oceanic-breeze": ["cool", "fresh"],
        "volcanic-ash": ["bold", "warm"],
        "lavender-haze": ["soft", "dreamy"],
        "copper-canyon": ["earthy", "warm"],
    };
    for (const [name, data] of Object.entries(STOCK_THEMES)) {
        registerPackage({
            type: "theme",
            scope: "trops",
            name,
            version: "1.0.0",
            zipBuffer: buildThemeZip(name),
            metadata: {
                displayName: data.name,
                description: descriptions[name] || `${data.name} theme`,
                author: "johng",
                category: "general",
                tags: tagsByName[name] || [],
                colors: data.colors,
            },
        });
    }
}

// ----- HTTP server -------------------------------------------------------

function indexEntryFor(entry) {
    // dash-core's renderer constructs download URLs as
    // `/api/packages/${encodeURIComponent(scope)}/${encodeURIComponent(name)}/...`
    // and the canonical test-registry-index.json stores `scope` with a
    // leading "@" (e.g. "@trops"). We store scope without "@" internally
    // for cleaner pkgKey lookups, but emit it WITH "@" in the index
    // response so the renderer hits this mock's download regex (which
    // accepts %40 / @ prefixes).
    const emittedScope = entry.scope.startsWith("@")
        ? entry.scope
        : `@${entry.scope}`;
    return {
        name: entry.name,
        scope: emittedScope,
        packageName: pkgKey(entry.scope, entry.name),
        type: entry.type,
        version: entry.latest,
        latestVersion: entry.latest,
        ...entry.metadata,
    };
}

function readBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

function send(res, status, payload, type = "application/json") {
    const body =
        type === "application/json"
            ? Buffer.from(JSON.stringify(payload))
            : payload;
    res.writeHead(status, {
        "Content-Type": type,
        "Content-Length": body.length,
    });
    res.end(body);
}

function createMockRegistryServer() {
    return http.createServer(async (req, res) => {
        const url = req.url || "";
        const method = req.method || "GET";

        // Index: GET /api/packages (no scope/name)
        if (method === "GET" && /^\/api\/packages\/?(\?.*)?$/.test(url)) {
            const list = Array.from(packages.values()).map(indexEntryFor);
            return send(res, 200, { packages: list });
        }

        // Resolve: POST /api/packages/resolve
        if (method === "POST" && /^\/api\/packages\/resolve/.test(url)) {
            const body = await readBody(req);
            let parsed = {};
            try {
                parsed = JSON.parse(body.toString("utf8"));
            } catch (_) {
                /* tolerate empty body */
            }
            const names = Array.isArray(parsed?.names) ? parsed.names : [];
            const found = names
                .map((n) => packages.get(n) || null)
                .filter(Boolean)
                .map(indexEntryFor);
            return send(res, 200, { packages: found });
        }

        // Download: GET /api/packages/:scope/:name/download?version=
        const downloadMatch = url.match(
            /^\/api\/packages\/(?:%40|@)([^/]+)\/([^/?]+)\/download(?:\?(.*))?$/
        );
        if (method === "GET" && downloadMatch) {
            const scope = decodeURIComponent(downloadMatch[1]);
            const name = decodeURIComponent(downloadMatch[2]);
            const query = new URLSearchParams(downloadMatch[3] || "");
            const requestedVersion = query.get("version");
            const entry = packages.get(pkgKey(scope, name));
            if (!entry) return send(res, 404, { error: "Package not found" });
            const version = requestedVersion || entry.latest;
            const zipBuffer = entry.versions.get(version);
            if (!zipBuffer)
                return send(res, 404, { error: "Version not found" });
            return send(res, 200, zipBuffer, "application/zip");
        }

        // Single package: GET /api/packages/:scope/:name
        const pkgMatch = url.match(
            /^\/api\/packages\/(?:%40|@)([^/]+)\/([^/?]+)\/?(\?.*)?$/
        );
        if (method === "GET" && pkgMatch) {
            const scope = decodeURIComponent(pkgMatch[1]);
            const name = decodeURIComponent(pkgMatch[2]);
            const entry = packages.get(pkgKey(scope, name));
            if (!entry) return send(res, 404, { error: "Package not found" });
            return send(res, 200, indexEntryFor(entry));
        }

        // Delete: DELETE /api/packages/:scope/:name
        if (method === "DELETE" && pkgMatch) {
            const scope = decodeURIComponent(pkgMatch[1]);
            const name = decodeURIComponent(pkgMatch[2]);
            const key = pkgKey(scope, name);
            const existed = packages.delete(key);
            deleteHistory.push({ scope, name, packageName: key, existed });
            res.writeHead(existed ? 204 : 404);
            return res.end();
        }

        // Publish: POST /api/publish
        if (method === "POST" && /^\/api\/publish\/?$/.test(url)) {
            const body = await readBody(req);
            // Real endpoint is multipart/form-data with a zip + manifest;
            // we record raw bytes + headers. Tests can parse if they care.
            const entry = {
                receivedAt: new Date().toISOString(),
                bodyBytes: body.length,
                contentType: req.headers["content-type"] || null,
                authorization: req.headers["authorization"] || null,
            };
            publishHistory.push(entry);
            return send(res, 200, {
                success: true,
                version: "1.0.1",
                receivedBytes: body.length,
            });
        }

        // Fallback
        send(res, 404, { error: "Not Found" });
    });
}

let serverInstance = null;
let serverPort = null;

/**
 * Start the mock registry. By default the 10 stock themes are auto-
 * registered for back-compat. Pass `{ seedThemes: false }` for a
 * clean slate.
 *
 * @param {Object} [opts]
 * @param {number} [opts.port=0] - 0 = OS-assigned ephemeral port
 * @param {boolean} [opts.seedThemes=true]
 * @returns {Promise<number>} bound port
 */
async function startMockRegistry(opts = {}) {
    const { port = 0, seedThemes = true } = opts;
    clearPackages();
    clearHistory();
    if (seedThemes) seedStockThemes();
    serverInstance = createMockRegistryServer();
    return new Promise((resolve) => {
        serverInstance.listen(port, "127.0.0.1", () => {
            serverPort = serverInstance.address().port;
            resolve(serverPort);
        });
    });
}

async function stopMockRegistry() {
    if (serverInstance) {
        return new Promise((resolve) => {
            serverInstance.close(resolve);
            serverInstance = null;
            serverPort = null;
        });
    }
}

module.exports = {
    startMockRegistry,
    stopMockRegistry,
    registerPackage,
    clearPackages,
    getPublishHistory,
    getDeleteHistory,
    clearHistory,
    THEMES: STOCK_THEMES, // kept for back-compat with existing spec
};
