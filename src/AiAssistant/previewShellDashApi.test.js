/**
 * The preview iframe shell gives widgets a dashApi (app-navigation
 * NAV-011): useMcpProvider / useWebSocketProvider read `dashApi` from
 * AppContext, but the bridge only carries plain data, so MCP and
 * WebSocket widgets showed "Dashboard API not available" in every
 * preview. The shell builds one from its own (scoped) window.mainApi.
 *
 * The shell is a plain script in public/; this loads the helper from
 * between its markers and runs it.
 */
const fs = require("fs");
const path = require("path");

const shell = fs.readFileSync(
    path.join(__dirname, "..", "..", "public", "widget-preview-shell.js"),
    "utf8"
);
const match = shell.match(
    /\/\/ BEGIN appContextWithDashApi\n([\s\S]*?)\/\/ END appContextWithDashApi/
);

function load() {
    // eslint-disable-next-line no-new-func
    return new Function(`${match[1]}; return appContextWithDashApi;`)();
}

class FakeDashApi {
    constructor(api, appId) {
        this.api = api;
        this.appId = appId;
    }
}

describe("preview shell — dashApi for widgets", () => {
    it("is defined in the shell and used for the widget's AppContext", () => {
        expect(match).toBeTruthy();
        expect(shell).toMatch(
            /dashCore\.AppContext\.Provider,\s*\{\s*value: appContextWithDashApi\(/
        );
    });

    it("adds a dashApi built from the sandbox's mainApi and the app id", () => {
        const appContextWithDashApi = load();
        const mainApi = { mcp: {} };
        const cache = {};
        const ctx = appContextWithDashApi(
            { providers: { A: {} }, credentials: { appId: "app" } },
            { ElectronDashboardApi: FakeDashApi },
            mainApi,
            cache
        );
        expect(ctx.providers).toEqual({ A: {} });
        expect(ctx.dashApi).toBeInstanceOf(FakeDashApi);
        expect(ctx.dashApi.api).toBe(mainApi);
        expect(ctx.dashApi.appId).toBe("app");
    });

    it("reuses the same dashApi across renders (hooks reconnect on a new one)", () => {
        const appContextWithDashApi = load();
        const mainApi = {};
        const cache = {};
        const host = { ElectronDashboardApi: FakeDashApi };
        const a = appContextWithDashApi({}, host, mainApi, cache);
        const b = appContextWithDashApi(
            { providers: {} },
            host,
            mainApi,
            cache
        );
        expect(b.dashApi).toBe(a.dashApi);
        // A different mainApi (re-installed scope proxy) gets a new one.
        const c = appContextWithDashApi({}, host, {}, cache);
        expect(c.dashApi).not.toBe(a.dashApi);
    });

    it("leaves the context alone without a mainApi or the class", () => {
        const appContextWithDashApi = load();
        expect(
            appContextWithDashApi({ x: 1 }, {}, {}, {}).dashApi
        ).toBeUndefined();
        expect(
            appContextWithDashApi(
                { x: 1 },
                { ElectronDashboardApi: FakeDashApi },
                null,
                {}
            ).dashApi
        ).toBeUndefined();
        expect(appContextWithDashApi(null, {}, null, {})).toEqual({});
    });
});
