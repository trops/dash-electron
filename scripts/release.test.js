/**
 * release.test.js — scripts/release.js against a real temporary git
 * "remote" and a fake `gh` (DASH-48). Same file in dash-core, dash-react
 * and dash-electron.
 */
"use strict";

const { describe, it, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { release, compareVersions, nextPatch } = require("./release");

const made = [];
after(() => {
    for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});
function tmp(prefix) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(d);
    return d;
}
function git(cwd, ...args) {
    return execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: "pipe",
    }).trim();
}

// A fake `gh`: keeps one PR per branch in a JSON file; `pr merge` really
// merges the branch into main on the "remote" through a scratch clone.
const FAKE_GH = `#!/usr/bin/env node
const fs = require("fs");
const { execFileSync } = require("child_process");
const state = process.env.FAKE_GH_STATE;
const db = fs.existsSync(state) ? JSON.parse(fs.readFileSync(state, "utf8")) : {};
const save = () => fs.writeFileSync(state, JSON.stringify(db));
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
const [cmd, sub, ...rest] = process.argv.slice(2);
const branch = () => git(process.cwd(), "branch", "--show-current");
if (cmd === "auth") process.exit(0);
if (cmd === "pr" && sub === "view") {
  const pr = db[rest[0]];
  if (!pr) { console.error("no pull requests found"); process.exit(1); }
  console.log(JSON.stringify(pr));
  process.exit(0);
}
if (cmd === "pr" && sub === "create") {
  const b = branch();
  db[b] = { number: Object.keys(db).length + 1, state: "OPEN", url: "https://example/pr/" + b, mergeCommit: null };
  save();
  console.log(db[b].url);
  process.exit(0);
}
if (cmd === "pr" && sub === "merge") {
  const b = rest[0];
  const mf = state + ".mergefails";
  const m = fs.existsSync(mf) ? Number(fs.readFileSync(mf, "utf8")) : 0;
  if (m < Number(process.env.FAKE_GH_MERGE_FAILS || 0)) {
    fs.writeFileSync(mf, String(m + 1));
    console.error("GraphQL: Base branch was modified. Review and try the merge again. (mergePullRequest)");
    process.exit(1);
  }
  const scratch = process.env.FAKE_GH_SCRATCH;
  git(scratch, "fetch", "origin");
  git(scratch, "checkout", "-q", "-B", process.env.FAKE_GH_MAIN, "origin/" + process.env.FAKE_GH_MAIN);
  git(scratch, "merge", "--no-ff", "-q", "-m", "Merge " + b, "origin/" + b);
  git(scratch, "push", "-q", "origin", process.env.FAKE_GH_MAIN);
  db[b].state = "MERGED";
  db[b].mergeCommit = { oid: git(scratch, "rev-parse", "HEAD") };
  save();
  process.exit(0);
}
if (cmd === "pr" && sub === "checks") {
  // FAKE_GH_CHECKS: pass (default) | fail | none | "pending,pending,pass"
  // (one state per call; the last one repeats).
  const plan = (process.env.FAKE_GH_CHECKS || "pass").split(",");
  const f = state + ".checks";
  const n = fs.existsSync(f) ? Number(fs.readFileSync(f, "utf8")) : 0;
  fs.writeFileSync(f, String(n + 1));
  const now = plan[Math.min(n, plan.length - 1)];
  if (now === "none") { console.error("no checks reported on the '" + rest[0] + "' branch"); process.exit(1); }
  console.log(JSON.stringify([{ name: "validate", bucket: now }]));
  process.exit(now === "pass" ? 0 : now === "pending" ? 8 : 1);
}
console.error("fake gh: unsupported " + process.argv.slice(2).join(" "));
process.exit(1);
`;

let origin;
let work;
let env;
const MAIN = "main";

function setup() {
    const root = tmp("release-test-");
    origin = path.join(root, "origin.git");
    git(root, "init", "-q", "--bare", "-b", MAIN, origin);
    const seed = path.join(root, "seed");
    git(root, "clone", "-q", origin, seed);
    git(seed, "checkout", "-q", "-b", MAIN);
    fs.writeFileSync(
        path.join(seed, "package.json"),
        JSON.stringify({ name: "x", version: "1.0.0" }, null, 2) + "\n"
    );
    fs.writeFileSync(path.join(seed, "a.txt"), "one\n");
    git(seed, "add", ".");
    git(
        seed,
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@t",
        "commit",
        "-q",
        "-m",
        "init"
    );
    git(seed, "push", "-q", "origin", MAIN);

    work = path.join(root, "work");
    git(root, "clone", "-q", origin, work);
    const scratch = path.join(root, "scratch");
    git(root, "clone", "-q", origin, scratch);
    for (const d of [work, scratch]) {
        git(d, "config", "user.name", "t");
        git(d, "config", "user.email", "t@t");
    }
    const bin = path.join(root, "bin");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "gh"), FAKE_GH, { mode: 0o755 });
    env = {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        FAKE_GH_STATE: path.join(root, "gh.json"),
        FAKE_GH_SCRATCH: scratch,
        FAKE_GH_MAIN: MAIN,
        RELEASE_SKIP_GH_AUTH: "1",
        RELEASE_CHECKS_INTERVAL_SEC: "0.01",
        RELEASE_CHECKS_GRACE_SEC: "0.05",
        RELEASE_MERGE_RETRY_SEC: "0.01",
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t",
    };
}

function change(file = "a.txt", text = "two\n") {
    fs.writeFileSync(path.join(work, file), text);
}
const opts = (mode) => ({
    mode,
    message: "feat: x",
    main: MAIN,
    preCommit: "",
});
const quiet = (fn) => {
    const log = console.log;
    console.log = () => {};
    try {
        return fn();
    } finally {
        console.log = log;
    }
};
const remoteTags = () => git(work, "ls-remote", "--tags", "origin");
const remoteMainVersion = () =>
    JSON.parse(git(work, "show", `origin/${MAIN}:package.json`)).version;

describe("release.js", () => {
    beforeEach(setup);

    it("does it all in one go from local changes", () => {
        git(work, "checkout", "-q", "-b", "feat/one");
        change();
        const r = quiet(() => release(opts("release"), { cwd: work, env }));
        git(work, "fetch", "-q", "origin");
        assert.equal(r.tag, "v1.0.1");
        assert.equal(remoteMainVersion(), "1.0.1");
        assert.match(remoteTags(), /refs\/tags\/v1\.0\.1/);
        assert.equal(git(work, "branch", "--show-current"), MAIN);
    });

    it("resumes after --pr: merges and tags without a new commit or bump", () => {
        git(work, "checkout", "-q", "-b", "feat/two");
        change();
        quiet(() => release(opts("pr"), { cwd: work, env }));
        const before = git(work, "rev-parse", "HEAD");
        const r = quiet(() => release(opts("release"), { cwd: work, env }));
        assert.equal(r.tag, "v1.0.1");
        git(work, "fetch", "-q", "origin");
        // The merge commit's first parent is main, its second the branch tip.
        assert.equal(git(work, "rev-parse", `${r.sha}^2`), before);
        assert.equal(remoteMainVersion(), "1.0.1");
    });

    it("goes straight to tagging when the PR is already merged", () => {
        git(work, "checkout", "-q", "-b", "feat/three");
        change();
        quiet(() => release(opts("pr"), { cwd: work, env }));
        execFileSync("gh", ["pr", "merge", "feat/three", "--merge"], {
            cwd: work,
            env,
        });
        const r = quiet(() => release(opts("release"), { cwd: work, env }));
        assert.equal(r.tag, "v1.0.1");
        assert.match(remoteTags(), /refs\/tags\/v1\.0\.1/);
    });

    it("is a no-op the second time (tag already there)", () => {
        git(work, "checkout", "-q", "-b", "feat/four");
        change();
        quiet(() => release(opts("pr"), { cwd: work, env }));
        execFileSync("gh", ["pr", "merge", "feat/four", "--merge"], {
            cwd: work,
            env,
        });
        // Someone already tagged it.
        const db = JSON.parse(fs.readFileSync(env.FAKE_GH_STATE, "utf8"));
        git(work, "fetch", "-q", "origin");
        git(work, "tag", "v1.0.1", db["feat/four"].mergeCommit.oid);
        git(work, "push", "-q", "origin", "v1.0.1");
        const r = quiet(() => release(opts("release"), { cwd: work, env }));
        assert.equal(r.tag, "v1.0.1");
    });

    it("refuses a tag that's on another commit", () => {
        git(work, "checkout", "-q", "-b", "feat/five");
        change();
        quiet(() => release(opts("pr"), { cwd: work, env }));
        git(work, "tag", "v1.0.1", `origin/${MAIN}`);
        assert.throws(
            () => quiet(() => release(opts("release"), { cwd: work, env })),
            /already exists on/
        );
    });

    it("works in a worktree while main is checked out elsewhere", () => {
        const wt = path.join(path.dirname(work), "wt");
        git(
            work,
            "worktree",
            "add",
            "-q",
            "-b",
            "feat/six",
            wt,
            `origin/${MAIN}`
        );
        // `work` keeps main checked out.
        assert.equal(git(work, "branch", "--show-current"), MAIN);
        fs.writeFileSync(path.join(wt, "a.txt"), "six\n");
        const r = quiet(() => release(opts("release"), { cwd: wt, env }));
        assert.equal(r.tag, "v1.0.1");
        // The worktree ends detached on the merge commit.
        assert.equal(git(wt, "branch", "--show-current"), "");
        assert.equal(git(wt, "rev-parse", "HEAD"), r.sha);
    });

    it("bumps only once per branch, past main", () => {
        git(work, "checkout", "-q", "-b", "feat/seven");
        change();
        quiet(() => release(opts("push"), { cwd: work, env }));
        change("a.txt", "seven again\n");
        quiet(() => release(opts("push"), { cwd: work, env }));
        const pkg = JSON.parse(
            fs.readFileSync(path.join(work, "package.json"), "utf8")
        );
        assert.equal(pkg.version, "1.0.1");
    });

    it("says when there's nothing to release", () => {
        git(work, "checkout", "-q", "-b", "feat/empty");
        assert.throws(
            () => quiet(() => release(opts("release"), { cwd: work, env })),
            /Nothing to release/
        );
    });

    it("won't run on main", () => {
        change();
        assert.throws(
            () => quiet(() => release(opts("pr"), { cwd: work, env })),
            /Create a feature branch/
        );
    });

    it("won't merge while PR CI is failing", () => {
        git(work, "checkout", "-q", "-b", "feat/red");
        change();
        quiet(() => release(opts("pr"), { cwd: work, env }));
        assert.throws(
            () =>
                quiet(() =>
                    release(opts("release"), {
                        cwd: work,
                        env: { ...env, FAKE_GH_CHECKS: "pending,fail" },
                    })
                ),
            /PR CI failed: validate\. Nothing was merged/
        );
        const db = JSON.parse(fs.readFileSync(env.FAKE_GH_STATE, "utf8"));
        assert.equal(db["feat/red"].state, "OPEN");
        assert.equal(remoteMainVersion(), "1.0.0");
    });

    it("waits for PR CI that's still running, then releases", () => {
        git(work, "checkout", "-q", "-b", "feat/wait");
        change();
        const r = quiet(() =>
            release(opts("release"), {
                cwd: work,
                env: { ...env, FAKE_GH_CHECKS: "none,pending,pending,pass" },
            })
        );
        assert.equal(r.tag, "v1.0.1");
    });

    it("tries the merge again when GitHub says the base was modified", () => {
        git(work, "checkout", "-q", "-b", "feat/retry");
        change();
        const r = quiet(() =>
            release(opts("release"), {
                cwd: work,
                env: { ...env, FAKE_GH_MERGE_FAILS: "2" },
            })
        );
        assert.equal(r.tag, "v1.0.1");
    });

    it("gives up after three refused merges, with nothing merged", () => {
        git(work, "checkout", "-q", "-b", "feat/refused");
        change();
        assert.throws(() =>
            quiet(() =>
                release(opts("release"), {
                    cwd: work,
                    env: { ...env, FAKE_GH_MERGE_FAILS: "5" },
                })
            )
        );
        assert.equal(remoteMainVersion(), "1.0.0");
    });

    it("won't merge a PR with no checks at all, unless told to", () => {
        git(work, "checkout", "-q", "-b", "feat/nochecks");
        change();
        quiet(() => release(opts("pr"), { cwd: work, env }));
        const noChecks = { ...env, FAKE_GH_CHECKS: "none" };
        assert.throws(
            () =>
                quiet(() =>
                    release(opts("release"), { cwd: work, env: noChecks })
                ),
            /No PR CI checks/
        );
        const r = quiet(() =>
            release(opts("release"), {
                cwd: work,
                env: { ...noChecks, RELEASE_ALLOW_NO_CHECKS: "1" },
            })
        );
        assert.equal(r.tag, "v1.0.1");
    });
});

describe("versions", () => {
    it("compares and bumps x.y.z", () => {
        assert.equal(compareVersions("1.0.10", "1.0.9"), 1);
        assert.equal(compareVersions("0.1.953", "0.1.953"), 0);
        assert.equal(compareVersions("0.0.9", "0.1.0"), -1);
        assert.equal(nextPatch("0.1.953"), "0.1.954");
    });
});
