const http = require("http");
const AdmZip = require("adm-zip");

/**
 * Mock registry server for E2E theme install tests.
 *
 * Serves:
 * - GET /api/packages/:scope/:name/download — returns a ZIP containing a .theme.json
 *
 * The theme data is derived from the package name so each theme gets unique colors.
 */

// Theme definitions matching the test-registry-index.json entries in dash-core
const THEMES = {
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
            secondary: "#f59e0b",
            tertiary: "#ef4444",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
    },
};

/**
 * Build a ZIP buffer containing a .theme.json file for the given theme name.
 */
function buildThemeZip(themeName) {
    const themeData = THEMES[themeName];
    if (!themeData) return null;

    const zip = new AdmZip();
    zip.addFile(
        `${themeName}.theme.json`,
        Buffer.from(JSON.stringify(themeData, null, 2))
    );
    return zip.toBuffer();
}

function createMockRegistryServer() {
    return http.createServer((req, res) => {
        // Parse URL: /api/packages/%40trops/nordic-frost/download?version=1.0.0
        const downloadMatch = req.url.match(
            /\/api\/packages\/(?:%40|@)(\w+)\/([^/]+)\/download/
        );

        if (downloadMatch && req.method === "GET") {
            const themeName = decodeURIComponent(downloadMatch[2]);
            const zipBuffer = buildThemeZip(themeName);

            if (zipBuffer) {
                res.writeHead(200, {
                    "Content-Type": "application/zip",
                    "Content-Length": zipBuffer.length,
                });
                res.end(zipBuffer);
            } else {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Package not found" }));
            }
            return;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    });
}

let serverInstance = null;
let serverPort = null;

async function startMockRegistry(port = 0) {
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

module.exports = { startMockRegistry, stopMockRegistry, THEMES };
