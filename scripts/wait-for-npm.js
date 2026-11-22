#!/usr/bin/env node
/**
 * wait-for-npm.js — wait until npm has what was released (DASH-48).
 *
 *   node scripts/wait-for-npm.js @trops/dash-core=trops/dash-core@master \
 *                                @trops/dash-react=trops/dash-react@main
 *
 * For each package: read the version on the repo's default branch (GitHub),
 * then wait until npm's `latest` is at least that and its package file
 * actually downloads (npm lists a version a little before the file is served). A merge to dash-core's
 * master publishes a few minutes later; without this, scripts/ci.sh would
 * quietly install the version before it.
 *
 * Fails (exit 1) when npm doesn't catch up within the time limit. If GitHub
 * can't be read (no `gh`, offline), it says so and doesn't wait for that
 * package.
 *
 * Env: WAIT_FOR_NPM_TIMEOUT_SEC (1200), WAIT_FOR_NPM_INTERVAL_SEC (15);
 * WAIT_FOR_NPM_GH / WAIT_FOR_NPM_NPM replace the `gh` / `npm` commands
 * (tests).
 */
"use strict";

const { execFileSync } = require("child_process");

function compareVersions(a, b) {
    const pa = String(a)
        .split(/[.-]/)
        .map((n) => parseInt(n, 10) || 0);
    const pb = String(b)
        .split(/[.-]/)
        .map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) {
            return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
        }
    }
    return 0;
}

function parseSpec(spec) {
    // @trops/dash-core=trops/dash-core@master
    const m = /^(@?[^=]+)=([^@]+)@(.+)$/.exec(String(spec));
    if (!m) throw new Error(`Bad spec "${spec}" (want pkg=owner/repo@branch)`);
    return { pkg: m[1], repo: m[2], branch: m[3] };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True when a HEAD request for `url` answers 200 (following redirects). */
function headStatusOk(url, hops = 0) {
    return new Promise((resolve) => {
        let u;
        try {
            u = new URL(url);
        } catch (_e) {
            return resolve(false);
        }
        const lib = u.protocol === "http:" ? require("http") : require("https");
        const req = lib.request(
            u,
            { method: "HEAD", timeout: 15000 },
            (res) => {
                res.resume();
                const loc = res.headers.location;
                if (
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    loc &&
                    hops < 5
                ) {
                    resolve(headStatusOk(new URL(loc, u).toString(), hops + 1));
                } else {
                    resolve(res.statusCode === 200);
                }
            }
        );
        req.on("timeout", () => req.destroy());
        req.on("error", () => resolve(false));
        req.end();
    });
}

async function waitForNpm(
    specs,
    env = process.env,
    log = console.log,
    { headOk = headStatusOk } = {}
) {
    const gh = env.WAIT_FOR_NPM_GH || "gh";
    const npm = env.WAIT_FOR_NPM_NPM || "npm";
    const timeoutMs = Number(env.WAIT_FOR_NPM_TIMEOUT_SEC || 1200) * 1000;
    const intervalMs = Number(env.WAIT_FOR_NPM_INTERVAL_SEC || 15) * 1000;
    const run = (cmd, args) =>
        execFileSync(cmd, args, {
            env,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        }).trim();

    const results = [];
    for (const { pkg, repo, branch } of specs.map(parseSpec)) {
        let expected = null;
        try {
            const raw = run(gh, [
                "api",
                "-H",
                "Accept: application/vnd.github.raw",
                `repos/${repo}/contents/package.json?ref=${branch}`,
            ]);
            expected = JSON.parse(raw).version;
        } catch (e) {
            log(
                `Can't read ${repo}@${branch} from GitHub; not waiting for ${pkg}.`
            );
            results.push({ pkg, expected: null, latest: null, waited: false });
            continue;
        }
        const started = Date.now();
        let polls = 0;
        for (;;) {
            polls++;
            let latest = null;
            try {
                latest = run(npm, ["view", pkg, "version", "--prefer-online"]);
            } catch (_e) {
                latest = null;
            }
            // npm lists a new version a little before its tarball can be
            // downloaded (a 404 on install): wait for the file too.
            let tarball = null;
            let downloadable = false;
            if (latest && compareVersions(latest, expected) >= 0) {
                try {
                    tarball = run(npm, [
                        "view",
                        `${pkg}@${latest}`,
                        "dist.tarball",
                        "--prefer-online",
                    ]);
                } catch (_e) {
                    tarball = null;
                }
                downloadable = !!tarball && (await headOk(tarball));
            }
            if (downloadable) {
                log(
                    `${pkg}: npm has ${latest} (${repo}@${branch} is ${expected}).`
                );
                results.push({ pkg, expected, latest, waited: polls > 1 });
                break;
            }
            if (Date.now() - started >= timeoutMs) {
                const secs = Math.round(timeoutMs / 1000);
                const listed = latest && compareVersions(latest, expected) >= 0;
                throw new Error(
                    listed
                        ? `${pkg}: npm lists ${latest} but its package ` +
                          `(${tarball || "no tarball URL"}) still doesn't ` +
                          `download after ${secs}s. Try again later.`
                        : `${pkg}: ${repo}@${branch} is ${expected} but npm still has ` +
                          `${latest || "nothing"} after ${secs}s. ` +
                          "Check its Publish Package workflow."
                );
            }
            log(
                latest && compareVersions(latest, expected) >= 0
                    ? `${pkg}: npm lists ${latest}; waiting for its package to download…`
                    : `${pkg}: waiting for npm to show ${expected} (has ${latest})…`
            );
            await sleep(intervalMs);
        }
    }
    return results;
}

if (require.main === module) {
    waitForNpm(process.argv.slice(2)).catch((e) => {
        console.error(`\nError: ${e.message}`);
        process.exit(1);
    });
}

module.exports = { waitForNpm, headStatusOk, parseSpec, compareVersions };
