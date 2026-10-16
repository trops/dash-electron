/**
 * widgetIdentity — a package registers only its own widgets: the id,
 * scope and packageName come from the package being loaded, never from
 * what its .dash.js claims (a copy of AlgoliaHits declaring
 * "trops.algolia-search.AlgoliaHits" took the original's place).
 */
const fs = require("fs");
const path = require("path");
import { ownWidgetIdentity } from "./widgetIdentity";

describe("ownWidgetIdentity", () => {
    test("a copy that claims another package's id gets its own", () => {
        expect(
            ownWidgetIdentity(
                "@ai-built/algoliahits",
                "trops.algolia-search.AlgoliaHits",
                {
                    id: "trops.algolia-search.AlgoliaHits",
                    scope: "trops",
                    packageName: "algolia-search",
                    name: "AlgoliaHits",
                }
            )
        ).toEqual({
            id: "ai-built.algoliahits.AlgoliaHits",
            scope: "ai-built",
            packageName: "algoliahits",
            bare: "AlgoliaHits",
            claimed: "trops.algolia-search.AlgoliaHits",
        });
    });

    test("a package's own widget keeps its id; nothing is claimed", () => {
        expect(
            ownWidgetIdentity("@trops/algolia-search", "AlgoliaHits", {
                id: "trops.algolia-search.AlgoliaHits",
            })
        ).toEqual({
            id: "trops.algolia-search.AlgoliaHits",
            scope: "trops",
            packageName: "algolia-search",
            bare: "AlgoliaHits",
            claimed: null,
        });
    });

    test("an unscoped package is left to its config, as before", () => {
        expect(ownWidgetIdentity("dash-samples", "Clock", {})).toBeNull();
        expect(ownWidgetIdentity(null, "Clock", {})).toBeNull();
    });
});

describe("Dash.js registers bundles under their own package's identity", () => {
    const dash = fs.readFileSync(path.join(__dirname, "..", "Dash.js"), "utf8");
    test("registerBundleConfigs uses ownWidgetIdentity and overrides scope/packageName", () => {
        expect(dash).toMatch(/ownWidgetIdentity\(widgetName, key, config\)/);
        expect(dash).toMatch(/config\.scope = own\.scope;/);
        expect(dash).toMatch(/config\.packageName = own\.packageName;/);
    });
});
