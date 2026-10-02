/**
 * popoutRoute.test.js — a dashboard popout can open in the Bots view on a
 * bot (bot-teams TEAM-011 B3). The renderer's options are validated in the
 * main process before anything reaches the window's URL.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { parseBotsOptions, popoutHashRoute } = require("./lib/popoutRoute.cjs");

describe("parseBotsOptions", () => {
    it("accepts the Bots view with a plain bot id and a known tab", () => {
        assert.deepEqual(
            parseBotsOptions({
                view: "bots",
                botId: "bot_mur5633g_9g78fn_0",
                tab: "activity",
            }),
            { view: "bots", botId: "bot_mur5633g_9g78fn_0", tab: "activity" }
        );
    });

    it("defaults the tab to conversation", () => {
        assert.equal(
            parseBotsOptions({ view: "bots", botId: "b1" }).tab,
            "conversation"
        );
    });

    it("rejects anything else", () => {
        for (const bad of [
            null,
            undefined,
            "bots",
            {},
            { view: "dashboard", botId: "b1" },
            { view: "bots" },
            { view: "bots", botId: "../x" },
            { view: "bots", botId: "b1&view=evil" },
            { view: "bots", botId: "a".repeat(129) },
            { view: "bots", botId: 42 },
        ]) {
            assert.equal(parseBotsOptions(bad), null, JSON.stringify(bad));
        }
    });

    it("an unknown tab falls back to conversation", () => {
        assert.equal(
            parseBotsOptions({ view: "bots", botId: "b1", tab: "<script>" })
                .tab,
            "conversation"
        );
    });
});

describe("popoutHashRoute", () => {
    it("is the plain dashboard route without options", () => {
        assert.equal(popoutHashRoute("7", null), "#/popout/7");
    });

    it("adds the Bots view query when given validated options", () => {
        assert.equal(
            popoutHashRoute("7", {
                view: "bots",
                botId: "b1",
                tab: "activity",
            }),
            "#/popout/7?view=bots&bot=b1&tab=activity"
        );
    });

    it("encodes the workspace id", () => {
        assert.equal(popoutHashRoute("a/b", null), "#/popout/a%2Fb");
    });
});

describe("electron.js — popout-open wiring (static pin)", () => {
    const src = fs.readFileSync(path.join(__dirname, "electron.js"), "utf8");

    it("validates options and focuses + re-targets an existing popout", () => {
        assert.match(src, /require\("\.\/lib\/popoutRoute\.cjs"\)/);
        assert.match(src, /const bots = parseBotsOptions\(message\)/);
        assert.match(
            src,
            /existing\.webContents\.send\("popout-show-bots", \{\s*botId: bots\.botId,\s*tab: bots\.tab,\s*\}\)/
        );
        assert.match(src, /createPopoutWindow\(wsId, bots\)/);
        assert.match(
            src,
            /const hashRoute = popoutHashRoute\(workspaceId, bots\)/
        );
    });

    it("registers the recent-runs handler on botController", () => {
        assert.match(src, /BOTS_LIST_RECENT_RUNS,/);
        assert.match(
            src,
            /loggedHandle\(\s*BOTS_LIST_RECENT_RUNS,[\s\S]{0,120}botController\.listRecentRuns\(/
        );
    });
});
