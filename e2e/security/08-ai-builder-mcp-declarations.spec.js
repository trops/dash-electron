/**
 * 08-ai-builder-mcp-declarations.spec.js
 *
 * Slice 7 — pin the AI builder's static MCP-permissions scan + manifest
 * write end-to-end:
 *   1. Submit a pre-baked widget that uses `useMcpProvider("...")` +
 *      `callTool("...")` via the `widget:ai-build` IPC.
 *   2. Verify the installed widget's `package.json` carries the
 *      canonical `dash.permissions.mcp` block.
 *   3. Verify `dash.json` mirrors the same block.
 *
 * Hermetic — every run starts with a fresh temp user-data dir and a
 * unique widget name so concurrent reruns don't collide.
 */
const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { launchApp, closeApp } = require("../helpers/electron-app");

let electronApp;
let window;
let tempUserData;
let widgetName;

test.beforeEach(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
    // Unique per-test widget so reruns don't collide on disk and the
    // installed scope path is predictable for the assertions below.
    widgetName = `Slice7Widget${Date.now()}`;
});

test.afterEach(async () => {
    await closeApp(electronApp, { tempUserData });
});

const WIDGET_COMPONENT = (name) => `import React, { useEffect } from "react";
import { useMcpProvider } from "@trops/dash-core";
import { Panel } from "@trops/dash-react";

export default function ${name}() {
  const { callTool, isConnected } = useMcpProvider("test-server");
  useEffect(() => {
    if (!isConnected) return;
    callTool("alpha_tool", { x: 1 });
    callTool("beta_tool", { y: 2 });
  }, [isConnected]);
  return <Panel>slice 7 test widget</Panel>;
}
`;

const WIDGET_CONFIG = (name) => `export default {
  name: "${name}",
  displayName: "${name}",
  providers: [
    { type: "test-server", providerClass: "mcp", required: false },
  ],
};
`;

test("aiBuild scans componentCode and writes dash.permissions.mcp block to package.json + dash.json", async () => {
    const result = await window.evaluate(
        async ({ widgetName, componentCode, configCode }) => {
            return await window.mainApi.widgetBuilder.aiBuild(
                widgetName,
                componentCode,
                configCode,
                "slice 7 e2e test widget",
                null,
                "@test/slice-7-app",
                null,
                [],
                null
            );
        },
        {
            widgetName,
            componentCode: WIDGET_COMPONENT(widgetName),
            configCode: WIDGET_CONFIG(widgetName),
        }
    );

    expect(result.success).toBe(true);

    const installDir = path.join(
        tempUserData,
        "widgets",
        "@ai-built",
        widgetName.toLowerCase()
    );
    const pkgJsonPath = path.join(installDir, "package.json");
    const dashJsonPath = path.join(installDir, "dash.json");

    // Both files must exist on disk after install.
    expect(fs.existsSync(pkgJsonPath)).toBe(true);
    expect(fs.existsSync(dashJsonPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    const dashManifest = JSON.parse(fs.readFileSync(dashJsonPath, "utf8"));

    // Canonical permissions shape parseable by parseManifestPermissions.
    expect(pkg.dash?.permissions?.mcp?.["test-server"]?.tools).toBeDefined();
    const tools = pkg.dash.permissions.mcp["test-server"].tools.sort();
    expect(tools).toEqual(["alpha_tool", "beta_tool"]);

    // dash.json carries the same block.
    expect(
        dashManifest.dash?.permissions?.mcp?.["test-server"]?.tools
    ).toBeDefined();
    expect(
        dashManifest.dash.permissions.mcp["test-server"].tools.sort()
    ).toEqual(["alpha_tool", "beta_tool"]);
});

test("widget without MCP usage gets no dash.permissions.mcp block (regression-pin)", async () => {
    const NON_MCP_COMPONENT = `import React from "react";
import { Panel } from "@trops/dash-react";
export default function ${widgetName}() {
  return <Panel>no mcp here</Panel>;
}
`;
    const NON_MCP_CONFIG = `export default {
  name: "${widgetName}",
  displayName: "${widgetName}",
  providers: [],
};
`;

    const result = await window.evaluate(
        async ({ widgetName, componentCode, configCode }) => {
            return await window.mainApi.widgetBuilder.aiBuild(
                widgetName,
                componentCode,
                configCode,
                "slice 7 non-mcp regression",
                null,
                "@test/slice-7-app",
                null,
                [],
                null
            );
        },
        {
            widgetName,
            componentCode: NON_MCP_COMPONENT,
            configCode: NON_MCP_CONFIG,
        }
    );

    expect(result.success).toBe(true);

    const installDir = path.join(
        tempUserData,
        "widgets",
        "@ai-built",
        widgetName.toLowerCase()
    );
    const pkgJsonPath = path.join(installDir, "package.json");

    // No-MCP widgets shouldn't get a permissions block.
    if (fs.existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
        expect(pkg.dash?.permissions?.mcp).toBeUndefined();
    }
    // dash.json may or may not exist depending on the install path —
    // if it does, it must not carry the permissions block either.
    const dashJsonPath = path.join(installDir, "dash.json");
    if (fs.existsSync(dashJsonPath)) {
        const dashManifest = JSON.parse(fs.readFileSync(dashJsonPath, "utf8"));
        expect(dashManifest.dash?.permissions?.mcp).toBeUndefined();
    }
});
