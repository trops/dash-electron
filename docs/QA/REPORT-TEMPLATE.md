# Dash QA Finding — Report Template

Copy this block and fill it in for each finding. One finding per issue / message. If something doesn't apply, write `n/a` instead of leaving it blank — that way we know you considered it.

```
**Severity:** Blocker | Major | Minor | Cosmetic
**Topic / scenario:** e.g. "Widgets §2.3 — Publish — personal-paths warning"
**Build:** Dash vX.Y.Z (macOS 14.4 arm64 / Windows 11 x64 / etc.)
**Account state:** signed-in as <username> | signed-out | fresh install

**Steps to reproduce (from a clean state):**
1.
2.
3.

**Expected:**

**Actual:**

**Screenshot or recording:**

**Console errors / log output (optional, paste in a code block):**

**Notes / hypotheses:**
```

## Severity guide

-   **Blocker** — app crashes, data loss, can't sign in, can't install/uninstall, can't open the app, dashboard becomes unrecoverable.
-   **Major** — a feature is visibly broken but the app stays alive: published widget not installable, listener wiring lost on save, OAuth fails silently.
-   **Minor** — feature works but the UX is wrong: misleading copy, missing badge, wrong default option, sort order off.
-   **Cosmetic** — visual / polish only: alignment, spacing, color contrast, typo.

If you're not sure, err high — we can downgrade.

## Tips

-   **App version** is in Settings → General.
-   **OS version**: macOS → Apple menu → About This Mac. Windows → Settings → System → About.
-   **Console errors**: View → Toggle Developer Tools → Console tab (in dev/debug builds; in production builds the menu is hidden — note that and skip).
-   **Recording**: macOS Cmd+Shift+5 (built-in), Windows Win+G (Game Bar). Keep it short — 10-30 seconds is plenty.
-   **From a clean state** matters: if you can repro from a fresh launch (or fresh install), say so. If repro requires specific prior state, list the state you were in.
