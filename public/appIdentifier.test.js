/**
 * appIdentifier.test.js — the app id the main process uses to locate the
 * user's data (providers.json etc.).
 *
 * Regression: `.env` sets REACT_APP_IDENTIFIER=$npm_package_name. CRA expands
 * that for the renderer, but the main process loads .env with plain dotenv
 * (no variable expansion), so in dev the bot controller got the LITERAL
 * "$npm_package_name" and read providers from a wrong, empty folder — bots
 * found none of the user's providers (or their AI keys).
 */
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolveAppIdentifier } = require("./appIdentifier");

describe("resolveAppIdentifier", () => {
    it("uses a real REACT_APP_IDENTIFIER", () => {
        assert.equal(
            resolveAppIdentifier(
                { REACT_APP_IDENTIFIER: "@acme/dash" },
                "@trops/x"
            ),
            "@acme/dash"
        );
    });

    it("ignores an unexpanded $variable and falls back to the package name", () => {
        assert.equal(
            resolveAppIdentifier(
                { REACT_APP_IDENTIFIER: "$npm_package_name" },
                "@trops/dash-electron"
            ),
            "@trops/dash-electron"
        );
    });

    it("falls back to the package name when unset (packaged builds)", () => {
        assert.equal(
            resolveAppIdentifier({}, "@trops/dash-electron"),
            "@trops/dash-electron"
        );
    });

    it("falls back to the default when nothing usable is available", () => {
        assert.equal(
            resolveAppIdentifier({
                REACT_APP_IDENTIFIER: "${npm_package_name}",
            }),
            "@trops/dash-electron"
        );
    });
});
