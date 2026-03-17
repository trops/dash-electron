---
name: feature
description: Execute a feature, fix, or any code change using the mandatory CLAUDE.md workflow. Use when the user wants to implement something, fix a bug, add functionality, or make any code changes. Trigger on "build", "implement", "add", "fix", "create", "update", "change", "refactor", or any request that will modify source code.
disable-model-invocation: false
user-invocable: true
argument-hint: "[TICKET-KEY] description of the task"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# Feature Workflow

You are executing a code change. **You MUST follow every step below in order. No skipping. No combining. No improvising.**

**First: Read the CLAUDE.md file in this repo RIGHT NOW before doing anything else.**

```bash
cat CLAUDE.md
```

Everything in CLAUDE.md is binding. If this skill and CLAUDE.md conflict, CLAUDE.md wins.

---

## Step 0 — SYNC (do this first, no exceptions)

1. Sync this repo:

    ```bash
    REPO_ROOT="$(git rev-parse --show-toplevel)"
    cd "$REPO_ROOT"
    git checkout master && git pull origin master
    ```

2. Locate and sync sibling repos (discover paths, never hardcode):

    ```bash
    SEARCH_ROOT="$(dirname "$(dirname "$REPO_ROOT")")"
    DASH_CORE="$(find "$SEARCH_ROOT" -maxdepth 4 -name "package.json" -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs grep -l '"name": "@trops/dash-core"' 2>/dev/null | head -1 | xargs dirname)"
    DASH_REACT="$(find "$SEARCH_ROOT" -maxdepth 4 -name "package.json" -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs grep -l '"name": "@trops/dash-react"' 2>/dev/null | head -1 | xargs dirname)"
    echo "dash-core:  $DASH_CORE"
    echo "dash-react: $DASH_REACT"
    ```

    If either is not found, **STOP and ask the user where the repo is cloned.** Do not assume a path.

3. Pull latest in each found sibling repo (detect default branch automatically):

    ```bash
    cd "$DASH_CORE" && git pull origin "$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')"
    cd "$DASH_REACT" && git pull origin "$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')"
    ```

4. Return to this repo and create a feature branch:

    ```bash
    cd "$REPO_ROOT"
    git checkout -b feat/<TICKET-KEY>-<slug>
    ```

    Use the ticket key from `$ARGUMENTS` if provided. If no ticket key, use a descriptive slug like `feat/add-screenshot-script`.

**If any pull fails: STOP. Report the exact error. Do not proceed.**

---

## Step 1 — PRD GATE

```bash
ls docs/requirements/prd/
```

-   If a relevant PRD exists, read it fully.
-   Confirm to the user: "Read PRD: `<filename>`" or "No relevant PRD found."
-   Do not proceed until this confirmation is given.

---

## Step 2 — PLAN

1. State the task in one sentence.
2. List every file that will be created or modified.
3. List any dependencies that will be added.
4. Identify risks, ambiguities, or cross-repo implications.
5. If the task affects UI, include the `npm run screenshot` command with correct navigation flags (see CLAUDE.md navigation map).

**STOP HERE. Wait for explicit user approval before writing any code.**

Acceptable approvals: "proceed", "looks good", "go ahead", 👍.
**Silence is NOT approval. Do not continue without one of these responses.**

---

## Step 3 — IMPLEMENT

1. Make ONLY the changes listed in the approved plan.
2. Do not refactor, rename, or "improve" anything outside the plan.
3. Do not add dependencies not listed in the plan.
4. Stage any new (untracked) files explicitly by path:
    ```bash
    git add <file1> <file2>
    ```
    Never use `git add .` or `git add -A`.
5. Run Prettier:
    ```bash
    npm run prettify
    ```
6. Fix any Prettier errors before proceeding.

**Tell the user: "Implementation complete. Moving to validation."**

---

## Step 4 — VALIDATE

1. Run the full CI validation:
    ```bash
    npm run ci
    ```
2. If it fails, fix the errors and re-run `npm run ci`.
3. Do not proceed until `npm run ci` exits cleanly.
4. **If you cannot make CI pass: STOP. Report the exact output. Do not proceed.**

**Tell the user: "CI passed. Ready to release."**

---

## Step 5 — RELEASE

1. Use the CI script — this is the ONLY way to release:
    ```bash
    npm run ci:release -- -m "type(scope): description"
    ```
2. **Do NOT manually run `git commit`, `git push`, `git tag`, or `gh pr create`.**
3. Confirm to the user: "Released. Commit: `<hash>` pushed to `<branch>`."

---

## Rules (from CLAUDE.md — repeated here so you cannot miss them)

-   **Never skip a step.** Even if the task "seems simple."
-   **Never combine steps.** Do not implement and validate in the same step.
-   **Never push directly to master.** `ci:release` handles branches, PRs, merge, tags, and cleanup.
-   **Never use `git push --force` or `git reset --hard`.**
-   **Never use `git add .` or `git add -A`.** Stage files explicitly.
-   **Never run `npm run build:css` manually.** `ci.sh` handles this.
-   **Never manually construct git commit, push, tag, or gh pr commands.** `ci:release` is the only release path.
-   **When in doubt, ask.** Do not infer. Do not improvise.
-   **If a command fails, stop.** Report the exact error. Do not attempt workarounds.
