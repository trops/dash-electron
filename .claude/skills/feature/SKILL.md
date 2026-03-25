---
name: feature
description: Execute a feature, fix, or any code change using the mandatory CLAUDE.md workflow. Use when the user wants to implement something, fix a bug, add functionality, or make any code changes. Trigger on "build", "implement", "add", "fix", "create", "update", "change", "refactor", or any request that will modify source code.
---

# Feature Workflow

You are executing a code change. **CLAUDE.md is the binding protocol for all code changes.**

Read CLAUDE.md first. Then execute these phases in order:

## 1. SYNC

Follow CLAUDE.md "MANDATORY: Before Any Code Changes":

-   Sync this repo and all sibling repos
-   Create a feature branch

## 2. PRD GATE

Follow CLAUDE.md "MANDATORY: PRD Gate":

-   Check for relevant PRDs in this repo and in dash-core
-   Confirm to the user which PRD was read (or that none was found)

Follow CLAUDE.md "MANDATORY: PRD Management":

-   Create or update PRDs as required

## 3. PLAN

Follow CLAUDE.md "Phase 1 — PLAN":

-   State the task, list files, list dependencies, identify risks
-   If the task affects UI, include the `npm run screenshot` command with correct navigation flags (see CLAUDE.md navigation map)
-   **Stop and wait for explicit user approval before coding**

## 4. IMPLEMENT

Follow CLAUDE.md "Phase 2 — IMPLEMENT":

-   Make only the approved changes
-   Run Prettier, stage new files explicitly

## 5. VALIDATE

Follow CLAUDE.md "Phase 3 — VALIDATE":

-   Run `npm run ci` and ensure it passes
-   Do not proceed with a failing build

## 6. RELEASE

Follow CLAUDE.md "Phase 4 — RELEASE":

-   Use `npm run ci:release -- -m "type(scope): description"`
-   Never use manual git commands for release

---

**Do not skip, combine, or reorder phases. If anything fails, stop and report.**
