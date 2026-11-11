#!/usr/bin/env node
/**
 * checkTempLeaks.js — run a command and fail if it leaves test folders or
 * files behind in the OS temp dir (os.tmpdir()).
 *
 * Usage: node scripts/checkTempLeaks.js -- <command> [args...]
 *   e.g. node scripts/checkTempLeaks.js -- node --test public/a.test.js
 *
 * It lists os.tmpdir() before and after the command. A NEW entry (not
 * there before, changed after the start) whose name starts with one of
 * the test prefixes below is a leak: the script prints each one and exits
 * 1. The command's own failure exit code is passed through first. Entries
 * that other programs make (or that were already there) are ignored.
 * Tests should make temp folders with scripts/testUtils/tempDir.js, which
 * removes them when the test process exits.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

// Names our tests (and the app code they run) give temp entries.
const TEST_PREFIXES = [
    "zz-",
    "skill-",
    "skill2-",
    "no-skill",
    "dash-ver-",
    "dash-test-",
    "dash-ai-build-",
    "dash-ai-preview-",
    "dash-check-",
    "dash-drafts-test-",
    "dash-e2e-",
    "dash-explore-",
    "ipc-test-",
    // Made by app code the tests run (aiBuild "Update original",
    // validateWidget, installWithBackup — the old fixed
    // dash-widget-update-backups folder and the per-update
    // dash-widget-update-backup-* folders).
    "dash-ai-update-",
    "dash-validate-widget-",
    "dash-widget-update-backup",
];

function isTestEntry(name) {
    return TEST_PREFIXES.some((p) => name.startsWith(p));
}

function listTmp(dir) {
    try {
        return fs.readdirSync(dir);
    } catch (_) {
        return [];
    }
}

function newLeaks(dir, before, startMs) {
    return listTmp(dir).filter((name) => {
        if (before.has(name) || !isTestEntry(name)) return false;
        try {
            // 1s slack for filesystems with coarse mtimes.
            return fs.lstatSync(path.join(dir, name)).mtimeMs >= startMs - 1000;
        } catch (_) {
            return false; // removed while we looked
        }
    });
}

function main(argv) {
    const sep = argv.indexOf("--");
    const cmd = sep === -1 ? argv : argv.slice(sep + 1);
    if (cmd.length === 0) {
        console.error(
            "Usage: node scripts/checkTempLeaks.js -- <command> [args...]"
        );
        return 2;
    }
    const tmp = os.tmpdir();
    const before = new Set(listTmp(tmp));
    const startMs = Date.now();
    const res = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit" });
    if (res.error) {
        console.error(`checkTempLeaks: could not run ${cmd[0]}:`, res.error);
        return 1;
    }
    if (res.status !== 0) return res.status === null ? 1 : res.status;

    const leaks = newLeaks(tmp, before, startMs);
    if (leaks.length > 0) {
        console.error(
            `\nTemp leak check FAILED: the tests left ${leaks.length} entr${
                leaks.length === 1 ? "y" : "ies"
            } in ${tmp}:`
        );
        for (const name of leaks.sort()) console.error(`  - ${name}`);
        console.error(
            "Make test temp folders/files with scripts/testUtils/tempDir.js " +
                "(tempDir / tempFile), or remove them in a finally."
        );
        return 1;
    }
    console.log(`Temp leak check passed: no test leftovers in ${tmp}.`);
    return 0;
}

if (require.main === module) {
    process.exit(main(process.argv.slice(2)));
}

module.exports = { isTestEntry, newLeaks, TEST_PREFIXES };
