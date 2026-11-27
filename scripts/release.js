#!/usr/bin/env node
/**
 * release.js — the git half of scripts/ci.sh (DASH-48).
 *
 * ci.sh validates, then hands the git workflow to this script:
 *
 *   node scripts/release.js --mode <commit|push|pr|release> -m "message"
 *       [--main <default branch>] [--pre-commit "<command>"]
 *       [--files-from <file>]
 *
 * What it commits (DASH-153): only named files, never `git add -u`.
 *   - --files-from names them, one path per line. ci.sh writes the files
 *     that were changed *before* validation ran, so a file validation (a
 *     formatter, an `npm install`) rewrote is never committed. If such a file
 *     is still changed, the release stops before committing and names it.
 *   - Without --files-from, every changed tracked file is named.
 *   - package-lock.json is committed only when a dependency section of
 *     package.json changed on the branch, or it changed only in its own
 *     version fields. RELEASE_ALLOW_LOCKFILE=1 overrides that (a person's
 *     call, e.g. after `npm audit fix`).
 *
 * It waits for the PR's GitHub checks (PR CI) to pass before merging, and
 * stops without merging if one fails.
 *
 * It is resumable and safe to run again:
 *   - Local changes → commit, rebase, bump the version (once per branch),
 *     push, open the PR, merge, tag — as far as --mode says.
 *   - No local changes but the branch already has an open PR (an earlier
 *     --pr) → skip straight to what's left. A merged PR → straight to
 *     tagging. Run again after a release → nothing to do, exit 0.
 *   - Worktree-safe: the tag goes on the PR's merge commit, and it never
 *     checks out a branch another worktree has checked out.
 *   - Two PRs open at once (DASH-60): it merges the default branch in
 *     first; a clash only on the version lines takes the default branch's,
 *     and the bump moves past it. Any other conflict stops.
 *
 * The same file is in dash-core, dash-react and dash-electron; keep them in
 * step. Same with its test (scripts/release.test.js).
 */
"use strict";

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
    const opts = {
        mode: null,
        message: "",
        main: "master",
        preCommit: "",
        filesFrom: "",
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--mode") opts.mode = argv[++i];
        else if (a === "-m") opts.message = argv[++i] || "";
        else if (a === "--main") opts.main = argv[++i];
        else if (a === "--pre-commit") opts.preCommit = argv[++i] || "";
        else if (a === "--files-from") opts.filesFrom = argv[++i] || "";
        else throw new Error(`Unknown argument: ${a}`);
    }
    if (!["commit", "push", "pr", "release"].includes(opts.mode)) {
        throw new Error("--mode must be commit, push, pr or release");
    }
    if (!opts.message) {
        throw new Error('-m "message" is required');
    }
    return opts;
}

function step(title) {
    console.log(`\n=====> ${title}\n`);
}

function makeRunner(cwd, env) {
    // Run and show output; throw on failure.
    function run(cmd, args) {
        execFileSync(cmd, args, { cwd, env, stdio: "inherit" });
    }
    // Run quietly and return trimmed stdout; throw on failure.
    function out(cmd, args) {
        return execFileSync(cmd, args, {
            cwd,
            env,
            stdio: ["ignore", "pipe", "pipe"],
            encoding: "utf8",
        }).trim();
    }
    // Like out(), but null instead of throwing.
    function tryOut(cmd, args) {
        try {
            return out(cmd, args);
        } catch (_e) {
            return null;
        }
    }
    return { run, out, tryOut };
}

// Files whose version lines two PRs from the same main always both change.
const VERSION_FILES = ["package.json", "package-lock.json"];
const VERSION_LINE = /^\s*"version":\s*"[^"]*",?\s*$/;

/**
 * A conflicted file's text with every conflict resolved to the default
 * branch's side — or null when any conflict is about more than version
 * lines. ("ours" is the branch, "theirs" the default branch, as `git merge
 * origin/<main>` writes them.)
 */
function resolveVersionOnlyConflict(text) {
    const lines = String(text).split("\n");
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith("<<<<<<< ")) {
            out.push(lines[i]);
            continue;
        }
        const ours = [];
        const theirs = [];
        let j = i + 1;
        while (j < lines.length && lines[j] !== "=======")
            ours.push(lines[j++]);
        j++;
        while (j < lines.length && !lines[j].startsWith(">>>>>>> ")) {
            theirs.push(lines[j++]);
        }
        if (j >= lines.length) return null;
        const onlyVersions = (side) =>
            side.length > 0 && side.every((l) => VERSION_LINE.test(l));
        if (
            ours.length !== theirs.length ||
            !onlyVersions(ours) ||
            !onlyVersions(theirs)
        ) {
            return null;
        }
        out.push(...theirs);
        i = j;
    }
    return out.join("\n");
}

/**
 * Bring origin/<main> into the branch when it isn't there yet (DASH-60).
 * Conflicts only on version lines in package.json / package-lock.json take
 * main's (the bump after this moves past it); anything else aborts the
 * merge and stops, as a rebase conflict does.
 * @returns {boolean} whether it merged
 */
function mergeMain({ main, run, tryOut, cwd }) {
    const upToDate =
        tryOut("git", [
            "merge-base",
            "--is-ancestor",
            `origin/${main}`,
            "HEAD",
        ]) !== null;
    if (upToDate) return false;
    step(`Bringing in ${main}`);
    // Plain conflict markers, whatever the user's merge.conflictStyle.
    const merge = [
        "-c",
        "merge.conflictStyle=merge",
        "merge",
        "--no-edit",
        `origin/${main}`,
    ];
    if (tryOut("git", merge) !== null) return true;
    const conflicted = (
        tryOut("git", ["diff", "--name-only", "--diff-filter=U"]) || ""
    )
        .split("\n")
        .filter(Boolean);
    const fail = (why) => {
        tryOut("git", ["merge", "--abort"]);
        throw new Error(
            `Merging ${main} into the branch failed (${why}). Resolve and run again.`
        );
    };
    if (!conflicted.length) fail("it didn't finish");
    const other = conflicted.filter((f) => !VERSION_FILES.includes(f));
    if (other.length) fail(`conflicts in ${other.join(", ")}`);
    for (const f of conflicted) {
        const file = path.join(cwd, f);
        const fixed = resolveVersionOnlyConflict(fs.readFileSync(file, "utf8"));
        if (fixed === null) fail(`conflicts in ${f} beyond its version`);
        fs.writeFileSync(file, fixed);
    }
    run("git", ["add", ...conflicted]);
    run("git", ["commit", "--no-edit"]);
    console.log(
        `Took ${main}'s version in ${conflicted.join(
            ", "
        )}; bumping past it next.`
    );
    return true;
}

/** -1, 0 or 1 comparing two x.y.z versions. */
function compareVersions(a, b) {
    const pa = String(a)
        .split(/[.-]/)
        .map((n) => parseInt(n, 10) || 0);
    const pb = String(b)
        .split(/[.-]/)
        .map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0))
            return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
    }
    return 0;
}

function nextPatch(v) {
    const [maj, min, pat] = String(v)
        .split(".")
        .map((n) => parseInt(n, 10) || 0);
    return `${maj}.${min}.${pat + 1}`;
}

function sleepMs(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** A GitHub check run as pass / fail / cancel / pending. */
function bucketOf(run) {
    if (run.status !== "completed") return "pending";
    if (["success", "neutral", "skipped"].includes(run.conclusion)) {
        return "pass";
    }
    return run.conclusion === "cancelled" ? "cancel" : "fail";
}

/**
 * Wait until the GitHub checks (PR CI) on `sha` — the commit just pushed —
 * have all passed. Checks are read for that exact commit, so a run on an
 * earlier push never counts. A failed or cancelled check stops the release
 * before anything is merged. No checks at all after a short grace period also
 * stops it (PR CI should be there), unless RELEASE_ALLOW_NO_CHECKS is set.
 *
 * Env (tests): RELEASE_CHECKS_INTERVAL_SEC (15), RELEASE_CHECKS_TIMEOUT_SEC
 * (1800), RELEASE_CHECKS_GRACE_SEC (120).
 */
function waitForChecks(sha, { cwd = process.cwd(), env = process.env } = {}) {
    step(`Waiting for PR CI to pass on ${sha.slice(0, 8)}`);
    const intervalMs = Number(env.RELEASE_CHECKS_INTERVAL_SEC || 15) * 1000;
    const timeoutMs = Number(env.RELEASE_CHECKS_TIMEOUT_SEC || 1800) * 1000;
    const graceMs = Number(env.RELEASE_CHECKS_GRACE_SEC || 120) * 1000;
    const started = Date.now();
    let said = "";
    for (;;) {
        const res = spawnSync(
            "gh",
            ["api", `repos/{owner}/{repo}/commits/${sha}/check-runs`],
            { cwd, env, encoding: "utf8" }
        );
        let checks = [];
        try {
            const body = JSON.parse(String(res.stdout || "").trim() || "{}");
            checks = (body.check_runs || []).map((r) => ({
                name: r.name,
                bucket: bucketOf(r),
            }));
        } catch (_e) {
            checks = [];
        }
        const names = (list) => list.map((c) => c.name).join(", ");
        const failed = checks.filter(
            (c) => c.bucket === "fail" || c.bucket === "cancel"
        );
        if (failed.length) {
            throw new Error(
                `PR CI failed: ${names(failed)}. Nothing was merged. ` +
                    "Fix it, push the fix, and run this again."
            );
        }
        const pending = checks.filter((c) => c.bucket === "pending");
        if (checks.length && !pending.length) {
            console.log(`PR CI passed: ${names(checks)}`);
            return checks;
        }
        const waited = Date.now() - started;
        if (!checks.length && waited >= graceMs) {
            if (env.RELEASE_ALLOW_NO_CHECKS) {
                console.log(
                    "No PR checks; RELEASE_ALLOW_NO_CHECKS is set, going on."
                );
                return checks;
            }
            throw new Error(
                "No PR CI checks on this pull request. Nothing was merged. " +
                    "Is .github/workflows/pr-ci.yml in the repo? " +
                    "(RELEASE_ALLOW_NO_CHECKS=1 releases without them.)"
            );
        }
        if (waited >= timeoutMs) {
            throw new Error(
                `PR CI is still running after ${Math.round(
                    timeoutMs / 60000
                )} ` +
                    `minutes (${names(pending)}). Nothing was merged. ` +
                    "Run this again to keep waiting."
            );
        }
        const now = checks.length
            ? `Waiting for ${names(pending)}…`
            : "Waiting for PR CI to start…";
        if (now !== said) {
            console.log(now);
            said = now;
        }
        sleepMs(intervalMs);
    }
}

const DEP_KEYS = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
];

/** A package-lock.json's text without its root version fields, as JSON. */
function lockWithoutVersion(text) {
    if (text === null || text === undefined) return null;
    let lock;
    try {
        lock = JSON.parse(text);
    } catch (_e) {
        return String(text);
    }
    delete lock.version;
    if (lock.packages && lock.packages[""]) delete lock.packages[""].version;
    return JSON.stringify(lock);
}

/** The dependency sections of a package.json's text, as JSON. */
function depsOf(text) {
    if (text === null || text === undefined) return null;
    let pkg;
    try {
        pkg = JSON.parse(text);
    } catch (_e) {
        return String(text);
    }
    return JSON.stringify(DEP_KEYS.map((k) => pkg[k] || {}));
}

/**
 * Why committing this package-lock.json would be wrong, or null when it's
 * fine (DASH-153): it may change beyond its root version fields only when a
 * dependency section of package.json changed too — against HEAD or the
 * branch's base on main.
 * @param {object} p
 * @param {string|null} p.lockBefore  package-lock.json at HEAD
 * @param {string|null} p.lockNow     package-lock.json in the working tree
 * @param {Array<string|null>} p.pkgBefore  package.json at HEAD / the base
 * @param {string|null} p.pkgNow      package.json in the working tree
 */
function lockfileProblem({ lockBefore, lockNow, pkgBefore, pkgNow }) {
    if (lockWithoutVersion(lockBefore) === lockWithoutVersion(lockNow)) {
        return null;
    }
    const now = depsOf(pkgNow);
    if ((pkgBefore || []).some((before) => depsOf(before) !== now)) return null;
    return (
        "package-lock.json changed, but no dependency in package.json did " +
        "(an `npm install` rewrote it?). Undo it with " +
        "`git checkout HEAD -- package-lock.json` and run again. " +
        "(RELEASE_ALLOW_LOCKFILE=1 commits it anyway: a person's call.)"
    );
}

/** Paths in a --files-from file: one per line, blanks and # lines skipped. */
function readFileList(file) {
    return fs
        .readFileSync(file, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
}

/**
 * The tracked files to commit (DASH-153). `changed` is every tracked file
 * changed against HEAD now; `named` the files changed before validation ran
 * (null: all of `changed`). Throws when something else changed too — the
 * release never commits, or leaves behind, a file nobody meant to change.
 */
function filesToCommit(changed, named) {
    if (!named) return changed.slice();
    const wanted = new Set(named);
    const extra = changed.filter((f) => !wanted.has(f));
    if (extra.length) {
        throw new Error(
            `These files changed during validation and aren't yours to commit: ` +
                `${extra.join(", ")}. Nothing was committed. Undo them with ` +
                `\`git checkout HEAD -- ${extra.join(
                    " "
                )}\` (or, if you did mean ` +
                "to change them, run this again: they then count as yours)."
        );
    }
    return changed.filter((f) => wanted.has(f));
}

function release(opts, { cwd = process.cwd(), env = process.env } = {}) {
    const { run, out, tryOut } = makeRunner(cwd, env);
    const { mode, message, main } = opts;
    const at = (m) => ["commit", "push", "pr", "release"].indexOf(m);

    const branch = out("git", ["branch", "--show-current"]);
    if (!branch) throw new Error("Not on a branch (detached HEAD).");
    if (branch === main) {
        throw new Error(
            `Cannot run --${mode} from ${main}. Create a feature branch first.`
        );
    }

    if (!env.RELEASE_SKIP_GH_AUTH) {
        step("Configuring git credentials via gh");
        run("gh", ["auth", "setup-git"]);
    }

    const prInfo = () => {
        const json = tryOut("gh", [
            "pr",
            "view",
            branch,
            "--json",
            "number,state,url,mergeCommit",
        ]);
        if (!json) return null;
        try {
            return JSON.parse(json);
        } catch (_e) {
            return null;
        }
    };
    let pr = prInfo();
    if (pr && pr.state === "CLOSED") pr = null;
    const merged = !!(pr && pr.state === "MERGED");

    // Every tracked file changed against HEAD, staged or not (renames as
    // both paths, deletions included).
    const changed = (
        out("git", ["diff", "--name-only", "--no-renames", "HEAD"]) || ""
    )
        .split("\n")
        .filter(Boolean);
    const dirty = changed.length > 0;
    run("git", ["fetch", "origin", "--tags"]);

    if (!merged) {
        if (dirty) {
            const named = opts.filesFrom ? readFileList(opts.filesFrom) : null;
            const files = filesToCommit(changed, named);
            if (
                files.includes("package-lock.json") &&
                !env.RELEASE_ALLOW_LOCKFILE
            ) {
                const base = tryOut("git", [
                    "merge-base",
                    `origin/${main}`,
                    "HEAD",
                ]);
                const show = (ref, f) => tryOut("git", ["show", `${ref}:${f}`]);
                const read = (f) => {
                    const p = path.join(cwd, f);
                    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
                };
                const problem = lockfileProblem({
                    lockBefore: show("HEAD", "package-lock.json"),
                    lockNow: read("package-lock.json"),
                    pkgBefore: [show("HEAD", "package.json")].concat(
                        base ? [show(base, "package.json")] : []
                    ),
                    pkgNow: read("package.json"),
                });
                if (problem)
                    throw new Error(`${problem} Nothing was committed.`);
            }
            if (opts.preCommit) {
                step("Checking before commit");
                run("bash", ["-c", opts.preCommit]);
            }
            step("Committing changes");
            console.log(files.join("\n"));
            run("git", ["add", "--", ...files]);
            run("git", ["commit", "-m", message, "--", ...files]);
        } else if (pr) {
            step(`Nothing new to commit; resuming PR ${pr.url}`);
        } else {
            const ahead = out("git", [
                "rev-list",
                "--count",
                `origin/${main}..HEAD`,
            ]);
            if (ahead === "0") {
                throw new Error(
                    `Nothing to release: no changes on ${branch} and no pull request for it.`
                );
            }
            step(`Nothing new to commit; ${ahead} commit(s) ahead of ${main}`);
        }

        step("Rebasing on latest origin");
        const target = tryOut("git", [
            "rev-parse",
            "--verify",
            `origin/${branch}`,
        ])
            ? `origin/${branch}`
            : `origin/${main}`;
        try {
            run("git", ["rebase", target]);
        } catch (_e) {
            tryOut("git", ["rebase", "--abort"]);
            throw new Error(
                `Rebase on ${target} failed (conflicts). Resolve and run again.`
            );
        }

        // Two PRs opened from the same main both claimed the next version
        // (DASH-60): bring main in. A clash only on version lines takes main's;
        // the bump below then moves past it. Any other conflict stops.
        mergeMain({ main, run, tryOut, cwd });

        // The branch's version must be past the default branch's. Bump once.
        const mainVersion = JSON.parse(
            out("git", ["show", `origin/${main}:package.json`])
        ).version;
        const pkgPath = path.join(cwd, "package.json");
        const branchVersion = JSON.parse(
            fs.readFileSync(pkgPath, "utf8")
        ).version;
        if (compareVersions(branchVersion, mainVersion) <= 0) {
            step("Bumping version");
            const next = nextPatch(mainVersion);
            run("npm", [
                "version",
                next,
                "--no-git-tag-version",
                "--allow-same-version",
            ]);
            const files = ["package.json"];
            if (fs.existsSync(path.join(cwd, "package-lock.json"))) {
                files.push("package-lock.json");
            }
            run("git", ["add", ...files]);
            run("git", ["commit", "-m", `Bump version to ${next}`]);
            console.log(`New version: ${next}`);
        } else {
            console.log(
                `Version ${branchVersion} is already past ${main} (${mainVersion}).`
            );
        }

        if (at(mode) < at("push")) return { done: "commit" };

        step("Pushing branch to origin");
        run("git", ["push", "-u", "origin", branch]);
        if (at(mode) < at("pr")) return { done: "push" };

        if (!pr) {
            step("Creating pull request");
            const version = JSON.parse(
                fs.readFileSync(path.join(cwd, "package.json"), "utf8")
            ).version;
            const body = (
                env.RELEASE_PR_BODY ||
                `## Summary\n${message}\n\nVersion: {{VERSION}}`
            ).replace(/\{\{VERSION\}\}/g, version);
            const url = out("gh", [
                "pr",
                "create",
                "--title",
                message,
                "--body",
                body,
            ]);
            console.log(`PR created: ${url}`);
        } else {
            console.log(`PR already open: ${pr.url}`);
        }
        if (at(mode) < at("release")) return { done: "pr" };

        // The checks of the commit just pushed — never an earlier push's.
        waitForChecks(out("git", ["rev-parse", "HEAD"]), { cwd, env });

        step("Merging pull request");
        // Right after a push GitHub can refuse with "Base branch was
        // modified" while it works out the PR's new state: try again.
        for (let attempt = 1; ; attempt++) {
            try {
                run("gh", ["pr", "merge", branch, "--merge"]);
                break;
            } catch (e) {
                if (attempt >= 3) throw e;
                console.log(
                    `Merge refused; trying again (${attempt + 1} of 3)…`
                );
                sleepMs(Number(env.RELEASE_MERGE_RETRY_SEC || 10) * 1000);
            }
        }
        pr = prInfo();
    } else {
        step(`PR already merged: ${pr.url}`);
        if (at(mode) < at("release")) return { done: mode };
    }

    const sha = pr && pr.mergeCommit && pr.mergeCommit.oid;
    if (!sha) throw new Error("The pull request has no merge commit yet.");
    run("git", ["fetch", "origin", main, "--tags"]);
    const version = JSON.parse(
        out("git", ["show", `${sha}:package.json`])
    ).version;
    const tag = `v${version}`;

    step(`Tagging ${tag}`);
    const existing = tryOut("git", ["rev-list", "-n", "1", tag]);
    if (existing && existing !== sha) {
        throw new Error(
            `Tag ${tag} already exists on ${existing}, not on the merge commit ${sha}.`
        );
    }
    if (!existing) run("git", ["tag", tag, sha]);
    const remoteTag = tryOut("git", [
        "ls-remote",
        "--tags",
        "origin",
        `refs/tags/${tag}`,
    ]);
    if (!remoteTag) run("git", ["push", "origin", tag]);
    else console.log(`${tag} is already on origin.`);

    step(`Cleaning up branch: ${branch}`);
    tryOut("git", ["push", "origin", "--delete", branch]);
    // Leave the branch: the default branch if no other worktree has it,
    // otherwise the merge commit, detached.
    const worktrees = out("git", ["worktree", "list", "--porcelain"]);
    const mainTaken = worktrees
        .split("\n")
        .some((l) => l === `branch refs/heads/${main}`);
    if (!mainTaken && tryOut("git", ["rev-parse", "--verify", main])) {
        run("git", ["checkout", main]);
        run("git", ["merge", "--ff-only", `origin/${main}`]);
    } else if (!mainTaken) {
        run("git", ["checkout", "-b", main, `origin/${main}`]);
    } else {
        run("git", ["switch", "--detach", sha]);
    }
    tryOut("git", ["branch", "-D", branch]);

    console.log(`\nRelease complete: ${tag} (${sha.slice(0, 8)})`);
    return { done: "release", tag, sha };
}

if (require.main === module) {
    try {
        release(parseArgs(process.argv.slice(2)));
    } catch (e) {
        console.error(`\nRelease stopped: ${e.message}`);
        process.exit(1);
    }
}

module.exports = {
    release,
    waitForChecks,
    bucketOf,
    parseArgs,
    compareVersions,
    nextPatch,
    resolveVersionOnlyConflict,
    lockfileProblem,
    filesToCommit,
    readFileList,
};
