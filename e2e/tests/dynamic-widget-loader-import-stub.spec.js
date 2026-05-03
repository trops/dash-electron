const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * DynamicWidgetLoader — import-stub regression spec (v0.0.471)
 *
 * The bug shipped in v0.0.470: a widget's `.dash.js` config that
 * referenced an imported value inside the literal (e.g.
 * `providers: [algoliaProvider]`) crashed at config-load time with
 *
 *   ReferenceError: algoliaProvider is not defined
 *
 * because `vm.runInContext` doesn't have a module resolver — the
 * import statement is real, but the imported names aren't bound.
 *
 * The fix: `collectImportedNames` scans the source for every
 * `import` form (named, default, namespace) and stubs each to
 * `undefined` in the VM context before eval. Any widget config can
 * now reference its imports inside the literal without crashing the
 * loader. Imported values show up as `undefined`; callers that
 * iterate (providers, …) are expected to filter nullish entries.
 *
 * This spec installs a synthetic widget whose `.dash.js` exercises
 * three import shapes (named, default, namespace) and references
 * each inside the config literal. If `getComponentConfigs` ever
 * starts throwing again on a widget with imports, every widget-list
 * surface (Settings → Widgets, the Add Widget picker, Discover) goes
 * blank — exactly the kind of regression the QA plan flags as
 * "DynamicWidgetLoader import-stub fix for `algoliaProvider`
 * ReferenceError (v0.0.471)".
 */

let electronApp;
let window;
let tempUserData;
let fixtureRoot;

const PACKAGE_NAME = "import-stub-test";

const COMPONENT_SOURCE = `
import React from "react";

const ImportStubTest = ({ title = "Import Stub Test" }) => {
    return React.createElement("div", null, title);
};

export default ImportStubTest;
`.trim();

// .dash.js with three import shapes the loader must stub. Each
// imported identifier is referenced as a bare value inside the
// literal — the regression's failure mode was a ReferenceError on
// the bare identifier. (Member access like `utils.foo` is OUT of
// the fix's contract: stubbing an import name to `undefined` makes
// `[name]` parse but `name.foo` still throws TypeError; the
// renderer's compiled widget bundle is what actually evaluates the
// imports at runtime, the loader only needs the metadata.)
const DASH_CONFIG_SOURCE = `
import { algoliaProvider } from "./providers/algolia";
import slackProvider from "./providers/slack";
import * as utils from "./utils";

export default {
    name: "ImportStubTest",
    type: "widget",
    icon: "puzzle-piece",
    description: "DynamicWidgetLoader regression fixture",
    providers: [algoliaProvider, slackProvider, utils],
    userConfig: {
        title: {
            type: "text",
            displayName: "Title",
            defaultValue: "Import Stub Test",
        },
    },
};
`.trim();

const PACKAGE_JSON = JSON.stringify(
    {
        name: PACKAGE_NAME,
        version: "1.0.0",
        description: "DynamicWidgetLoader import-stub regression fixture",
        author: "e2e",
        main: "widgets/ImportStubTest.js",
    },
    null,
    2
);

test.beforeAll(async () => {
    fixtureRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "dash-e2e-import-stub-")
    );
    const pkgDir = path.join(fixtureRoot, PACKAGE_NAME);
    fs.mkdirSync(path.join(pkgDir, "widgets"), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "package.json"), PACKAGE_JSON);
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "ImportStubTest.js"),
        COMPONENT_SOURCE
    );
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "ImportStubTest.dash.js"),
        DASH_CONFIG_SOURCE
    );

    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));

    // Install our synthetic package locally.
    await window.evaluate(
        async ({ name, dir }) => window.mainApi.widgets.installLocal(name, dir),
        { name: PACKAGE_NAME, dir: path.join(fixtureRoot, PACKAGE_NAME) }
    );
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
    try {
        if (fixtureRoot && fs.existsSync(fixtureRoot)) {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    } catch (_) {}
});

test("getComponentConfigs loads a widget whose config references three import shapes", async () => {
    await test.step("widget is registered", async () => {
        const widgets = await window.evaluate(async () =>
            window.mainApi.widgets.list()
        );
        const found = (widgets || []).find((w) => w.name === PACKAGE_NAME);
        expect(found).toBeTruthy();
    });

    await test.step("getComponentConfigs returns the parsed config without throwing", async () => {
        // Pre-fix this call would throw ReferenceError: algoliaProvider
        // is not defined while parsing our fixture's .dash.js. The
        // controller catches per-widget config errors, so a regression
        // surfaces as "the entry is missing from the configs list", not
        // as a thrown promise.
        const configs = await window.evaluate(async () =>
            window.mainApi.widgets.getComponentConfigs()
        );
        expect(Array.isArray(configs)).toBe(true);

        const entry = configs.find((c) => c.componentName === "ImportStubTest");
        expect(entry).toBeTruthy();
        expect(entry.config).toBeTruthy();

        // The literal's metadata fields are preserved.
        expect(entry.config.name).toBe("ImportStubTest");
        expect(entry.config.type).toBe("widget");
        expect(entry.config.userConfig?.title?.displayName).toBe("Title");

        // Imported values are stubbed to undefined — the loader's
        // contract is "preserve everything except the imports".
        // `providers: [algoliaProvider, slackProvider, utils]` parses,
        // and all three elements are undefined (named, default, and
        // namespace imports were each stubbed).
        expect(Array.isArray(entry.config.providers)).toBe(true);
        expect(entry.config.providers.length).toBe(3);
        for (const p of entry.config.providers) {
            expect(p).toBeUndefined();
        }
    });
});
