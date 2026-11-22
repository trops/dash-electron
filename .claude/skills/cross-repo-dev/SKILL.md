---
name: cross-repo-dev
description: Guide cross-repo development across dash-core, dash-react, and dash-electron. Handles linking, testing, CI validation, and shipping changes that span multiple Dash packages.
triggers:
    - "change in dash-core"
    - "update dash-react"
    - "cross-repo"
    - "link-core"
    - "link-react"
    - any request spanning multiple Dash repos
---

# Cross-Repo Development Workflow

Use this workflow when a change touches `dash-core`, `dash-react`, or both, and needs to be tested through `dash-electron`.

## Repo Locations

| Repo          | Path                                        | Main Branch | Package             |
| ------------- | ------------------------------------------- | ----------- | ------------------- |
| dash-core     | `~/Development/dash-core/dash-core`         | `master`    | `@trops/dash-core`  |
| dash-react    | `~/Development/dash-react/dash-react`       | `main`      | `@trops/dash-react` |
| dash-electron | `~/Development/dash-electron/dash-electron` | `master`    | N/A (app)           |
| dash-registry | `~/Development/dash-registry`               | `main`      | N/A (site)          |

## Step 1: Identify Scope

Determine which repos need changes and the dependency order:

1. **dash-react** first (if UI components change)
2. **dash-core** second (if framework changes)
3. **dash-electron** last (consuming app)

If only one dependency repo changes, skip the others.

## Step 2: Make Changes in Dependency Repo

```bash
# In the dependency repo (dash-core or dash-react)
cd ~/Development/<repo>/<repo>
git checkout -b feat/<description>

# Make code changes...

# Run local CI to validate
npm run ci
```

## Step 3: Link and Test in dash-electron

### Linking dash-core

```bash
cd ~/Development/dash-electron/dash-electron
npm run link-core -- ~/Development/dash-core/dash-core
rm -rf node_modules/.cache
npm run dev
# Ask user to verify changes work
```

### Linking dash-react

```bash
cd ~/Development/dash-electron/dash-electron
npm run link-react -- ~/Development/dash-react/dash-react
rm -rf node_modules/.cache
npm run dev
# Ask user to verify changes work
```

### Run dash-electron CI

```bash
cd ~/Development/dash-electron/dash-electron
npm run ci
```

## Step 4: Unlink and Ship

### Unlink

```bash
cd ~/Development/dash-electron/dash-electron
npm run unlink-core   # or npm run unlink-react
```

### Ship the dependency repo

```bash
cd ~/Development/<dependency-repo>/<dependency-repo>

# Option A: Create PR for review
npm run ci:pr -- -m "description of changes"

# Option B: Full release (merge + tag)
npm run ci:release -- -m "description of changes"
```

### Then update dash-electron (DASH-48)

After the dependency repo's release, its Publish Package workflow puts the new version
on npm (a few minutes). You don't bump dash-electron by hand:

-   dash-electron's `ci.sh` installs the latest published `@trops/dash-core` and
    `@trops/dash-react`, after waiting (`scripts/wait-for-npm.js`, up to 10 minutes) for npm
    to show what their default branches released. So a dash-electron change made right
    after a dependency release just runs `npm run ci` and picks it up.
-   With no dash-electron change of its own, the **bump-deps** workflow opens a PR
    `chore(deps): take @trops/dash-core X, @trops/dash-react Y` within 15 minutes
    (`gh workflow run bump-deps.yml --repo trops/dash-electron` to start it now). Release it:
    `git fetch origin && git switch deps/…` then `npm run ci:release -- -m "<PR title>"`.

## Step 5: Jira Transitions

Move the ticket through statuses at the right moments:

| When         | Transition               | ID  |
| ------------ | ------------------------ | --- |
| Start coding | To Do -> In Progress     | 21  |
| PR created   | In Progress -> In Review | 31  |
| PR merged    | In Review -> Done        | 41  |

```
mcp__claude_ai_Atlassian__transitionJiraIssue({
  cloudId: "7b4552a1-0fb9-4194-b92f-ded50fefa326",
  issueIdOrKey: "DASH-X",
  transition: { id: "<transition-id>" }
})
```

## CI Commands (All Repos)

Each flag is cumulative -- `--release` runs all prior steps.

```bash
npm run ci                          # validate only
npm run ci:commit -- -m "message"   # validate + commit + bump
npm run ci:push -- -m "message"     # above + push
npm run ci:pr -- -m "message"       # above + create PR
npm run ci:release -- -m "message"  # above + merge + tag + cleanup
```

`ci:release` waits for the PR's GitHub checks (PR CI) to pass before merging. It resumes:
after `ci:pr`, or after a release that stopped partway, run the same `ci:release` again on
the same branch. It works in a git worktree. It ends with
`Release complete: v<version> (<commit>)`. Never finish a release with hand-made git
commands. Details: each repo's `CLAUDE.md` › "Resuming and rerunning".

## Multi-Repo Change Checklist

-   [ ] Changes made in dependency repo
-   [ ] `npm run ci` passes in dependency repo
-   [ ] Linked into dash-electron and tested
-   [ ] `npm run ci` passes in dash-electron (while linked)
-   [ ] Unlinked from dash-electron
-   [ ] Dependency repo PR created/merged
-   [ ] dash-electron updated to published version
-   [ ] `npm run ci` passes in dash-electron (with published version)
-   [ ] Jira ticket transitioned appropriately
