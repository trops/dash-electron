/**
 * wait-for-npm.test.js — scripts/wait-for-npm.js with fake gh and npm
 * (DASH-48).
 */
"use strict";

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { waitForNpm, parseSpec } = require("./wait-for-npm");

const made = [];
after(() => {
    for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

// Fakes: gh prints a package.json with FAKE_GH_VERSION (or fails when it's
// "fail"); npm prints the next line of FAKE_NPM_VERSIONS each call.
function fakes({ ghVersion, npmVersions }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wait-npm-test-"));
    made.push(dir);
    const gh = path.join(dir, "gh");
    fs.writeFileSync(
        gh,
        `#!/usr/bin/env node
if (process.env.FAKE_GH_VERSION === "fail") process.exit(1);
console.log(JSON.stringify({ version: process.env.FAKE_GH_VERSION }));
`,
        { mode: 0o755 }
    );
    const counter = path.join(dir, "n");
    const npm = path.join(dir, "npm");
    fs.writeFileSync(
        npm,
        `#!/usr/bin/env node
const fs = require("fs");
const f = ${JSON.stringify(counter)};
const n = fs.existsSync(f) ? Number(fs.readFileSync(f, "utf8")) : 0;
fs.writeFileSync(f, String(n + 1));
const list = process.env.FAKE_NPM_VERSIONS.split(",");
console.log(list[Math.min(n, list.length - 1)]);
`,
        { mode: 0o755 }
    );
    return {
        ...process.env,
        WAIT_FOR_NPM_GH: gh,
        WAIT_FOR_NPM_NPM: npm,
        WAIT_FOR_NPM_INTERVAL_SEC: "0.01",
        WAIT_FOR_NPM_TIMEOUT_SEC: "1",
        FAKE_GH_VERSION: ghVersion,
        FAKE_NPM_VERSIONS: npmVersions.join(","),
    };
}
const SPEC = "@trops/dash-core=trops/dash-core@master";
const quiet = () => {};

describe("wait-for-npm", () => {
    it("parses pkg=owner/repo@branch", () => {
        assert.deepEqual(parseSpec(SPEC), {
            pkg: "@trops/dash-core",
            repo: "trops/dash-core",
            branch: "master",
        });
        assert.throws(() => parseSpec("nonsense"), /Bad spec/);
    });

    it("goes on at once when npm already has it", async () => {
        const env = fakes({ ghVersion: "0.1.953", npmVersions: ["0.1.953"] });
        const [r] = await waitForNpm([SPEC], env, quiet);
        assert.equal(r.latest, "0.1.953");
        assert.equal(r.waited, false);
    });

    it("waits until npm catches up", async () => {
        const env = fakes({
            ghVersion: "0.1.954",
            npmVersions: ["0.1.953", "0.1.953", "0.1.954"],
        });
        const [r] = await waitForNpm([SPEC], env, quiet);
        assert.equal(r.latest, "0.1.954");
        assert.equal(r.waited, true);
    });

    it("fails clearly when npm never catches up", async () => {
        const env = fakes({ ghVersion: "0.1.954", npmVersions: ["0.1.953"] });
        await assert.rejects(
            () => waitForNpm([SPEC], env, quiet),
            /npm still has 0\.1\.953/
        );
    });

    it("doesn't wait when GitHub can't be read", async () => {
        const env = fakes({ ghVersion: "fail", npmVersions: ["0.1.953"] });
        const [r] = await waitForNpm([SPEC], env, quiet);
        assert.equal(r.waited, false);
        assert.equal(r.expected, null);
    });
});
