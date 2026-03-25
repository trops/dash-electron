# Dash-Electron — Electron App Template

> ⚠️ **THIS FILE IS A PROTOCOL, NOT DOCUMENTATION.**
> Every section marked MANDATORY must be followed in order, without exception.
> If anything is unclear — requirements, file locations, which repo to change —
> **ASK before proceeding. Do not infer. Do not improvise.**

---

## ⚠️ MANDATORY: Before Any Code Changes

These steps are NON-NEGOTIABLE and must happen in this exact order before writing any code:

1. Sync dash-electron (this repo):

    ```bash
    git checkout master && git pull origin master
    ```

2. Locate and sync dependency repos:

    ```bash
    REPO_ROOT="$(git rev-parse --show-toplevel)"
    DASH_CORE="$(find "$(dirname "$REPO_ROOT")" -maxdepth 3 -name "package.json" | xargs grep -l '"name": "@trops/dash-core"' 2>/dev/null | head -1 | xargs dirname)"
    DASH_REACT="$(find "$(dirname "$REPO_ROOT")" -maxdepth 3 -name "package.json" | xargs grep -l '"name": "@trops/dash-react"' 2>/dev/null | head -1 | xargs dirname)"
    echo "dash-core:  $DASH_CORE"
    echo "dash-react: $DASH_REACT"
    ```

    If either is not found, **STOP and ask the user where the repo is cloned.** Do not assume a path.

3. Pull latest in each found repo:

    ```bash
    cd "$DASH_CORE" && git pull origin master
    cd "$DASH_REACT" && git pull origin main
    ```

4. Return to this repo and create a feature branch:
    ```bash
    cd "$REPO_ROOT"
    git checkout -b feat/<TICKET-KEY>-<slug>
    ```

**If any pull fails: STOP. Report the exact error. Do not proceed.**

---

## ⚠️ MANDATORY: PRD Gate

Before writing any code for a feature:

1. Check for local PRDs:
    ```bash
    ls docs/requirements/prd/
    ```
2. Check for framework PRDs in dash-core (discovered via step 2 above):
    ```bash
    ls "$DASH_CORE/docs/requirements/prd/"
    ```
3. If a relevant PRD exists, read it fully before proceeding.
4. Confirm to the user: "Read PRD: `<filename>`" or "No relevant PRD found."
5. Do not start implementation until this confirmation is given.

---

## ⚠️ MANDATORY: PRD Management

When implementing a new feature or significant enhancement:

1. **Check for existing PRD:** Check `docs/requirements/prd/` in this repo and in dash-core
   (discovered via the repo discovery protocol above).
2. **If a PRD exists:** Read it fully. Update its status, acceptance criteria, and implementation
   notes to reflect the current work. Do not create a duplicate.
3. **If no PRD exists:** Create one using `node scripts/prdize.js "Feature Name"` (or manually
   from the template at `docs/requirements/PRD-TEMPLATE.md`). At minimum, fill in: Executive Summary,
   Problem Statement, and User Stories with acceptance criteria.
4. **After implementation:** Update the PRD with implementation notes, lessons learned,
   and correct status (Draft → In Progress → Implemented).

Bug fixes and single-file changes do not require a PRD.
Template-specific features: PRD goes in this repo. Framework features: PRD goes in dash-core.

---

## ⚠️ MANDATORY: Development Phases

These four phases are sequential and cannot be skipped, combined, or reordered.

### Phase 1 — PLAN

1. State the task in one sentence.
2. List every file that will be created or modified.
3. List any dependencies that will be added.
4. Identify risks, ambiguities, or cross-repo implications.
5. **Wait for explicit user approval before writing a single line of code.**
   Acceptable approvals: "proceed", "looks good", "go ahead", 👍.
   Silence is NOT approval.

### Phase 2 — IMPLEMENT

1. Make only the changes listed in the approved plan.
2. Do not refactor, rename, or "improve" anything outside the plan.
3. Do not add dependencies not listed in the plan.
4. Run Prettier when done:
    ```bash
    npm run prettify
    ```
5. Fix any Prettier errors before proceeding.

### Phase 3 — VALIDATE

1. Run the full CI validation:
    ```bash
    npm run ci
    ```
2. If it fails, fix the errors and re-run. Do not proceed with a failing build.
3. Do not mark this phase complete until `npm run ci` exits cleanly.
4. **If you cannot make CI pass: STOP. Report the exact output. Do not proceed.**

### Phase 4 — RELEASE

1. Use the CI script — **this is the only approved release path**:
    ```bash
    npm run ci:release -- -m "type(scope): description"
    ```
2. Do not manually construct `git commit`, `git push`, `git tag`, or `gh pr` commands.
   Manual git commands outside of `ci.sh` are not permitted.
3. Confirm to the user: "Released. Commit: `<hash>` pushed to `<branch>`."

---

## ⚠️ MANDATORY: Cross-Repo Changes

When a task touches dash-core or dash-react AND dash-electron:

1. Sync ALL repos first (see Mandatory Pre-Work above).
2. Make and validate changes in the dependency repo **first** (dash-core or dash-react).
3. Run that repo's `npm run ci` to confirm it passes before touching dash-electron.
4. Only then update dash-electron.
5. Never modify dash-electron to work around a missing dash-core change — fix it at the source.
6. Read `.claude/skills/cross-repo-dev/SKILL.md` before starting any cross-repo task.

---

## ⚠️ NON-NEGOTIABLE RULES

-   **Never skip a phase.** Even if the task "seems simple."
-   **Never combine phases.** Do not implement and validate in the same step.
-   **Never push directly to master.** Always use feature branches and PRs via `ci:release`.
-   **Never use `git push --force` or `git reset --hard`.**
-   **Never use `git add .` or `git add -A`.** Stage only the files changed in Phase 2.
-   **When in doubt, ask.** Do not infer requirements. Do not improvise solutions.
-   **If a command fails, stop.** Report the exact error output. Do not attempt workarounds.
-   **Never run `npm run build:css` manually.** Tailwind CSS is only rebuilt by `ci.sh`
    when `src/index.css` or `tailwind.config.js` has changed. Do not add `build:css`
    to any validate, dev, or pre-commit sequence.

---

## ci.sh — The Only Approved Release Path

The `scripts/ci.sh` script handles the full pipeline: Node 20 via nvm, Prettier, Tailwind CSS,
CI build with ESLint errors, widget tests, commit, version bump, push, PR, merge, tag, and cleanup.

```bash
# Validate only
npm run ci

# Validate + commit + version bump
npm run ci:commit -- -m "Your commit message"

# Above + push branch
npm run ci:push -- -m "Your commit message"

# Above + create PR
npm run ci:pr -- -m "Your commit message"

# Above + merge PR + tag + cleanup
npm run ci:release -- -m "Your commit message"
```

Each flag is cumulative. `--release` runs all prior steps automatically.

---

## Important Patterns

### Import Rules

**ThemeContext** must come from `@trops/dash-react`:

```javascript
// CORRECT
import { ThemeContext } from "@trops/dash-react";

// WRONG - creates dual context instance
import { ThemeContext } from "./Context/ThemeContext";
```

**FontAwesomeIcon** must come from `@trops/dash-react`:

```javascript
// CORRECT
import { FontAwesomeIcon } from "@trops/dash-react";

// WRONG - duplicates the dependency
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
```

### Provider System

**Critical:** Providers are read from `AppContext.providers`, NOT `DashboardContext.providers`.
DashboardContext.providers is structurally empty due to component tree ordering.

---

### Visual Inspection

After `npm run ci` passes, capture a screenshot of the feature for UI review. Requires the React dev server to be running (`npm start` or `npm run dev`).

**Usage:**

```bash
npm run screenshot                                    # full window → /tmp/dash-review.png
npm run screenshot -- --click "Home"                  # click sidebar item, then capture
npm run screenshot -- --click-selector "css" --click "Text"  # CSS click, then text click
npm run screenshot -- --steps scripts/steps/nav.js    # run JS navigation file
npm run screenshot -- --selector ".sidebar" /tmp/s.png       # element screenshot
```

**Navigation map** — use this to determine the `--click` / `--click-selector` flags for each feature area:

| Feature Area             | Screenshot Command                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Home / default view      | `npm run screenshot`                                                                                                                            |
| Settings > General       | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings"`                         |
| Settings > Themes        | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Themes"`        |
| Settings > Providers     | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Providers"`     |
| Settings > Widgets       | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Widgets"`       |
| Settings > Folders       | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Folders"`       |
| Settings > Notifications | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Notifications"` |
| Settings > Account       | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Account"`       |
| Settings > MCP Server    | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "MCP Server"`    |
| Specific workspace       | `npm run screenshot -- --click "<workspace name>"`                                                                                              |
| Sidebar only             | `npm run screenshot -- --selector "aside"`                                                                                                      |

**Planning requirement:** When planning a task that affects the UI, the plan's verification section MUST include the `npm run screenshot` command with the appropriate flags from the navigation map above. Claude determines the correct navigation by mapping the changed files to the feature area they affect.

---

## Code Style

-   **React components:** PascalCase (`MyWidget.js`)
-   **Widget configs:** `{ComponentName}.dash.js`
-   **Utilities:** camelCase (`layout.js`)
-   **Formatting:** Prettier (`.prettierrc`), 4-space indentation
-   Run `npm run prettify` before every commit — enforced by `ci.sh`

---

## Reference

For architecture, directory structure, development commands, environment setup, widget system,
build/deploy, and troubleshooting, see [README.md](README.md) and [docs/INDEX.md](docs/INDEX.md).
