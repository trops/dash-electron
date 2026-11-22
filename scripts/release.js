#!/usr/bin/env node
/**
 * release.js — the git half of scripts/ci.sh (DASH-48).
 *
 * ci.sh validates, then hands the git workflow to this script:
 *
 *   node scripts/release.js --mode <commit|push|pr|release> -m "message"
 *       [--main <default branch>] [--pre-commit "<command>"]
 *
 * It is resumable and safe to run again:
 *   - Local changes → commit, rebase, bump the version (once per branch),
 *     push, open the PR, merge, tag — as far as --mode says.
 *   - No local changes but the branch already has an open PR (an earlier
 *     --pr) → skip straight to what's left. A merged PR → straight to
 *     tagging. Run again after a release → nothing to do, exit 0.
 *   - Worktree-safe: the tag goes on the PR's merge commit, and it never
 *     checks out a branch another worktree has checked out.
 *
 * The same file is in dash-core, dash-react and dash-electron; keep them in
 * step. Same with its test (scripts/release.test.js).
 */
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
    const opts = { mode: null, message: "", main: "master", preCommit: "" };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--mode") opts.mode = argv[++i];
        else if (a === "-m") opts.message = argv[++i] || "";
        else if (a === "--main") opts.main = argv[++i];
        else if (a === "--pre-commit") opts.preCommit = argv[++i] || "";
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

    const dirty =
        out("git", ["status", "--porcelain", "--untracked-files=no"]) !== "";
    run("git", ["fetch", "origin", "--tags"]);

    if (!merged) {
        if (dirty) {
            if (opts.preCommit) {
                step("Checking before commit");
                run("bash", ["-c", opts.preCommit]);
            }
            step("Committing changes");
            run("git", ["add", "-u"]);
            run("git", ["commit", "-m", message]);
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

        step("Merging pull request");
        run("gh", ["pr", "merge", branch, "--merge"]);
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

module.exports = { release, parseArgs, compareVersions, nextPatch };
