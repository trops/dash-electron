/**
 * 09-instance-grants.spec.js (DASH-46)
 *
 * Two placed widgets of one type (two Notes Folders on different
 * dashboards) each get their own MCP grant. The type grant was approved
 * for the Woodworking one; the Dash Specs one asks for its own folder,
 * the approval is saved under its instance key only, and neither widget
 * can then read the other's folder.
 *
 * Mounts are registered through the real preload bridge
 * (`framework.registerMount(widgetId, instanceId)`) and calls carry the
 * returned token, as a widget's bound api does.
 */
const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    stubMcpServer,
    restoreMcpClient,
} = require("../helpers/mock-mcp-transport");
const {
    setSecurityFlags,
    seedGrant,
    readAllGrants,
    startServer,
    waitForJitModal,
    clickJitAllow,
    clickJitDeny,
} = require("./helpers");

const NOTES = "ai-built.notesfolder.NotesFolder";
const SERVER = "test-server";
const SPEC = "Dash/Specs/DASH-40 README one-line comment.md";

let electronApp;
let window;
let tempUserData;

async function registerMount(window, widgetId, instanceId) {
    return await window.evaluate(
        async ({ widgetId, instanceId }) =>
            await window.mainApi.framework.registerMount(widgetId, instanceId),
        { widgetId, instanceId }
    );
}

async function readNote(window, token, notePath) {
    return await window.evaluate(
        async ({ token, notePath, server }) =>
            await window.mainApi.mcp.callTool(
                server,
                "read_note",
                { path: notePath },
                null,
                null,
                null,
                token
            ),
        { token, notePath, server: SERVER }
    );
}

const deniedFor = (result, pattern) =>
    result?.error === true && pattern.test(result.message || "");

test.describe("per-instance MCP grants (DASH-46)", () => {
    test.beforeEach(async () => {
        ({ electronApp, window, tempUserData } = await launchApp({
            hermetic: true,
        }));
        await setSecurityFlags(electronApp, { enforce: true, jit: true });
        await stubMcpServer(electronApp, {
            match: { commandIncludes: SERVER },
            tools: [
                { name: "list_notes", inputSchema: { type: "object" } },
                { name: "read_note", inputSchema: { type: "object" } },
            ],
            callResults: {
                read_note: { content: [{ type: "text", text: "ok" }] },
            },
        });
        await startServer(window, SERVER);
        await seedGrant(electronApp, NOTES, {
            grantOrigin: "live",
            servers: {
                [SERVER]: {
                    tools: ["list_notes", "read_note"],
                    readPaths: ["Woodworking"],
                    writePaths: [],
                },
            },
        });
    });

    test.afterEach(async () => {
        await restoreMcpClient(electronApp);
        await closeApp(electronApp, { tempUserData });
    });

    test("the second widget asks for its folder; each reads only its own", async () => {
        const woodworking = await registerMount(window, NOTES, "ws1:u1");
        const specs = await registerMount(window, NOTES, "ws2:u3");

        // The Woodworking widget runs under the type grant.
        const first = await readNote(window, woodworking, "Woodworking/x.md");
        expect(deniedFor(first, /not within any allowed root/i)).toBe(false);

        // The Dash Specs widget is asked for its folder instead of failing.
        const pending = readNote(window, specs, SPEC);
        await waitForJitModal(window);
        await expect(
            window.getByText("Allow this widget to read", { exact: false })
        ).toBeVisible();
        await clickJitAllow(window, "Allow for any file in this folder");
        const second = await pending;
        expect(deniedFor(second, /not within any allowed root/i)).toBe(false);

        const grants = await readAllGrants(electronApp);
        expect(Object.keys(grants).sort()).toEqual([NOTES, `${NOTES}#ws2:u3`]);
        expect(grants[NOTES].servers[SERVER].readPaths).toEqual([
            "Woodworking",
        ]);
        expect(grants[`${NOTES}#ws2:u3`].servers[SERVER].readPaths).toEqual([
            "Dash/Specs",
        ]);

        // Neither reads the other's folder: each is asked (JIT is on)
        // instead of being let in, and a Deny leaves it refused.
        const pendingA = readNote(window, woodworking, SPEC);
        await waitForJitModal(window);
        await clickJitDeny(window);
        expect((await pendingA)?.error).toBe(true);
        const pendingB = readNote(window, specs, "Woodworking/x.md");
        await waitForJitModal(window);
        await clickJitDeny(window);
        expect((await pendingB)?.error).toBe(true);
    });
});
