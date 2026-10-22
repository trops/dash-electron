/**
 * updateCheckError.test.js — a manual update check that finds nothing yet
 * says "No update available yet", not "Could not check for updates"
 * (QA 2026-10-22: the update service's 404 reached users as an error).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { isNoUpdateYet } = require("./lib/updateCheckError.cjs");

describe("isNoUpdateYet", () => {
    it("the update service's 404 is 'no update yet'", () => {
        assert.equal(
            isNoUpdateYet(
                new Error(
                    "Update check failed. The server sent an invalid response: No updates found (needs asset matching *{darwin-arm64}*)"
                )
            ),
            true
        );
    });

    it("Squirrel's code 5 is 'no update yet'", () => {
        assert.equal(
            isNoUpdateYet(
                new Error(
                    "The operation couldn't be completed. (SQRLUpdaterErrorDomain error 5.) Code=5"
                )
            ),
            true
        );
    });

    it("a real failure is still an error", () => {
        assert.equal(isNoUpdateYet(new Error("getaddrinfo ENOTFOUND")), false);
        assert.equal(
            isNoUpdateYet(new Error("SQRLUpdaterErrorDomain Code=8")),
            false
        );
        assert.equal(isNoUpdateYet(null), false);
    });

    it("the error handler uses it for a manual check", () => {
        const main = fs.readFileSync(
            path.join(__dirname, "electron.js"),
            "utf8"
        );
        assert.match(main, /require\("\.\/lib\/updateCheckError\.cjs"\)/);
        assert.match(main, /if \(isNoUpdateYet\(err\)\)/);
        assert.match(main, /No update available yet/);
    });
});
