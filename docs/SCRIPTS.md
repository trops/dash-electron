# Script Reference

Complete reference for all npm scripts in dash-electron. Scripts are organized by category.

**Quick link:** [Developer Guide](./DEVELOPER_GUIDE.md)

---

## Development

### `npm run setup`

One-time project setup. Runs the setup shell script, installs npm dependencies, and rebuilds native modules.

```bash
npm run setup
```

**What it does:** `./scripts/setup.sh && npm install && npm run rebuild`

---

### `npm run dev`

Start the full development environment with hot reload.

```bash
npm run dev
```

**What it does:** Runs three processes concurrently:

1. Tailwind CSS watcher (`build:css:watch`)
2. React dev server at `http://localhost:3000` (`BROWSER=none craco start`)
3. Electron app (waits for dev server, then launches with `--preserve-symlinks`)

**Notes:** Use this instead of `npm start` -- it includes symlink preservation needed for linked packages.

---

### `npm start`

Start the React dev server only (no Electron, no Tailwind watcher).

```bash
npm start
```

**What it does:** `GENERATE_SOURCEMAP=false craco start`

**Notes:** Typically used internally by other scripts. For development, prefer `npm run dev`.

---

### `npm run electron`

Start the Electron shell only (expects React dev server already running on port 3000).

```bash
npm run electron
```

**What it does:** `NODE_OPTIONS=--preserve-symlinks electron .`

---

### `npm run build`

Full production build (setup, format, CSS, dev server + Electron).

```bash
npm run build
```

**What it does:** `npm run setup && npm run prettify && npm run build:css && concurrently -k "BROWSER=none npm start" "npm:electron"`

---

### `npm run dry`

Quick build without full setup (format, bump version, dev server + Electron).

```bash
npm run dry
```

**What it does:** `npm run prettify && npm run bump && concurrently -k "BROWSER=none npm start" "npm:electron"`

---

### `npm run build:css`

Compile Tailwind CSS from `src/index.css` to `public/tailwind.css` (minified).

```bash
npm run build:css
```

**Important:** Do not run this manually during development. `ci.sh` handles Tailwind rebuilds automatically when source files change. The `dev` command includes a CSS watcher.

---

### `npm run build:css:watch`

Watch mode for Tailwind CSS compilation. Rebuilds on file changes.

```bash
npm run build:css:watch
```

**Notes:** Automatically started by `npm run dev`. Rarely needed standalone.

---

### `npm run prettify`

Format all project files with Prettier.

```bash
npm run prettify
```

**What it does:** `npx prettier --write .`

**Notes:** Run before every commit. Enforced by `ci.sh`.

---

### `npm run rebuild`

Rebuild native Node modules for the current Electron version.

```bash
npm run rebuild
```

**What it does:** `electron-rebuild -f -w node-expat`

**When to use:** After `npm install`, after switching Node versions, or when native modules fail to load.

---

## Widget Development

### `npm run widgetize <WidgetName>`

Scaffold a new widget in `src/Widgets/`.

```bash
npm run widgetize MyWidget
```

**What it does:**

1. Copies template from `scripts/template/`
2. Renames all "Template" references to `<WidgetName>`
3. Creates `src/Widgets/<WidgetName>/` with widget component, `.dash.js` config, context, and barrel export
4. Appends export to `src/Widgets/index.js`

**Output:**

```
src/Widgets/MyWidget/
├── widgets/
│   ├── MyWidget.js
│   └── MyWidget.dash.js
├── contexts/
│   ├── MyWidgetContext.js
│   └── index.js
└── index.js
```

---

### `npm run package-widgets`

Bundle widgets from `src/Widgets/` using Rollup. Produces CJS and ES module outputs in `dist/`.

```bash
npm run package-widgets
```

**What it does:** `NODE_ENV=prod rollup -c`

**Environment variables:**

-   `ROLLUP_WIDGET=<Name>` -- bundle a single widget directory
-   `ROLLUP_WIDGETS_DIR=<path>` -- custom source directory

**Output:** `dist/index.cjs.js`, `dist/index.esm.js`

**Externals:** `react`, `react-dom`, `@trops/dash-core`, `@trops/dash-react` are not bundled.

---

### `npm run package-zip`

Bundle widgets and create a distributable ZIP with metadata.

```bash
# Package all widgets
npm run package-zip

# Package a single widget
npm run package-zip -- --widget MyWidget

# Custom source directory
npm run package-zip -- --dir src/SampleWidgets
```

**What it does:** Runs `package-widgets` then `scripts/packageZip.js`

**Flags:**
| Flag | Description |
| ----------------- | ----------------------------------------- |
| `--widget <Name>` | Package a single widget directory |
| `--dir <path>` | Custom widget source directory |

**Output:** `widgets-{name}-v{version}.zip` containing `dist/`, `configs/`, and `dash.json`

---

### `npm run publish-to-registry`

Publish widget packages to the Dash Registry via the API.

```bash
# Publish all widgets
npm run publish-to-registry -- --all

# Publish a single widget
npm run publish-to-registry -- --widget Slack

# Preview manifest without publishing
npm run publish-to-registry -- --dry-run

# Custom source directory
npm run publish-to-registry -- --all --dir src/SampleWidgets

# Override registry name
npm run publish-to-registry -- --widget MyWidget --name custom-name

# Overwrite existing version
npm run publish-to-registry -- --widget MyWidget --republish
```

**What it does:**

1. Scans for `.dash.js` config files
2. Builds manifest with metadata (name, author, description, icon, version, providers)
3. Validates manifest against registry schema
4. Authenticates via OAuth device flow (opens browser)
5. Builds widget bundle via Rollup
6. Creates ZIP via `packageZip.js`
7. POSTs ZIP + manifest to registry API

**Flags:**
| Flag | Description |
| ----------------- | ----------------------------------------- |
| `--widget <Name>` | Publish a single widget directory |
| `--all` | Publish all widget directories |
| `--dir <path>` | Custom widget source directory |
| `--dry-run` | Preview manifest without publishing |
| `--name <name>` | Override registry package name |
| `--republish` | Delete existing version before publishing |

---

### `npm run validate:manifest`

Validate widget manifest against the registry schema.

```bash
npm run validate:manifest
```

**What it does:** `node scripts/validateWidget.cjs`

---

## Theme Publishing

### `npm run publish-themes`

Publish curated themes to the Dash Registry.

```bash
# Publish all 10 curated themes
npm run publish-themes

# Publish a single theme
npm run publish-themes -- --theme nordic-frost

# Preview without publishing
npm run publish-themes -- --dry-run

# Save themes as local ZIPs (skip registry)
npm run publish-themes -- --local

# Overwrite existing versions
npm run publish-themes -- --republish
```

**What it does:**

1. Reads 10 curated theme definitions from `scripts/registryThemes.js`
2. Builds manifest for each theme (type: "theme" with colors)
3. Authenticates via OAuth device flow (unless `--local`)
4. Creates minimal ZIP for each theme (manifest.json + .theme.json)
5. POSTs each ZIP + manifest to registry API (or saves locally with `--local`)

**Flags:**
| Flag | Description |
| ----------------- | ---------------------------------------------- |
| `--theme <name>` | Publish a single theme by name |
| `--dry-run` | Preview manifests without publishing |
| `--local` | Save ZIPs to `themes/` directory (skip registry) |
| `--republish` | Delete existing versions before publishing |

**Output (--local):** `themes/theme-{name}-v{version}.zip`

**Available themes:** `nordic-frost`, `monokai-ember`, `dracula-night`, `tokyo-neon`, `forest-canopy`, `oceanic-deep`, `volcanic-ash`, `desert-dusk`, `arctic-aurora`, `midnight-luxe`

---

## CI/CD

### `npm run ci`

Validate the project (Prettier, Tailwind, ESLint errors, build, widget tests). Does not commit or push.

```bash
npm run ci
```

**What it does:** Runs `scripts/ci.sh` with no flags (validate-only mode)

**Exit code:** 0 if all checks pass, non-zero on failure.

---

### `npm run ci:commit`

Validate + commit + version bump.

```bash
npm run ci:commit -- -m "feat(widgets): add Slack integration"
```

**What it does:** All of `ci` plus: stage changes, commit with message, bump patch version.

---

### `npm run ci:push`

Validate + commit + version bump + push to remote.

```bash
npm run ci:push -- -m "feat(widgets): add Slack integration"
```

---

### `npm run ci:pr`

Validate + commit + version bump + push + create PR.

```bash
npm run ci:pr -- -m "feat(widgets): add Slack integration"
```

---

### `npm run ci:release`

Full release pipeline: validate + commit + version bump + push + PR + merge + tag + cleanup.

```bash
npm run ci:release -- -m "feat(widgets): add Slack integration"
```

**What it does:**

1. Ensure Node 20 via nvm
2. Update @trops deps to latest
3. Run Prettier
4. Build Tailwind CSS (if changed)
5. CI build (ESLint errors)
6. Widget tests
7. Commit with message
8. Bump patch version
9. Rebase on latest remote
10. Push to branch
11. Create PR
12. Merge PR
13. Create git tag
14. Clean up branch

**Important:** This is the **only approved release path**. Do not use manual `git commit`, `git push`, `git tag`, or `gh pr` commands.

---

## Testing

### `npm run test:widgets`

Run widget integration tests.

```bash
npm run test:widgets
```

**What it does:** `node scripts/testWidgetIntegration.cjs`

---

### `npm run test:e2e`

Run Playwright end-to-end tests (headless).

```bash
npm run test:e2e
```

**What it does:** `npx playwright test --config=e2e/playwright.config.js`

---

### `npm run test:e2e:headed`

Run Playwright tests with visible browser.

```bash
npm run test:e2e:headed
```

---

### `npm run test:all`

Run all tests (widget integration + E2E).

```bash
npm run test:all
```

**What it does:** `npm run test:widgets && npm run test:e2e`

---

### `npm run validate:full`

Full validation suite (shell validation + widget tests + E2E).

```bash
npm run validate:full
```

**What it does:** `./scripts/validate.sh && npm run test:widgets && npm run test:e2e`

---

### `npm run screenshot`

Capture a screenshot of the running Dash app. Requires the dev server to be running (`npm run dev`).

```bash
# Full window screenshot
npm run screenshot

# Click a sidebar item, then capture
npm run screenshot -- --click "Home"

# CSS selector click, then text click
npm run screenshot -- --click-selector "css" --click "Text"

# Run navigation steps from a JS file
npm run screenshot -- --steps scripts/steps/nav.js

# Element-only screenshot
npm run screenshot -- --selector ".sidebar" /tmp/sidebar.png
```

**Flags:**
| Flag | Description |
| ------------------------ | ---------------------------------------------- |
| `--click "Text"` | Click an element by visible text |
| `--click-selector "css"` | Click an element by CSS selector |
| `--selector "css"` | Screenshot a specific element only |
| `--steps <file>` | Run navigation steps from a JS file |

**Output:** `/tmp/dash-review.png` (default) or specified path

**Navigation map for feature areas:**

| Feature Area         | Command                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Home / default view  | `npm run screenshot`                                                                                                                        |
| Settings > General   | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings"`                     |
| Settings > Themes    | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Themes"`    |
| Settings > Providers | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Providers"` |
| Settings > Widgets   | `npm run screenshot -- --click-selector 'button:has([data-icon="circle-user"], [data-icon="user"])' --click "Settings" --click "Widgets"`   |
| Sidebar only         | `npm run screenshot -- --selector "aside"`                                                                                                  |

---

## Cross-Repo Development

### `npm run link-core`

Link a local dash-core build into this project (replaces the npm-published version).

```bash
npm run link-core -- ~/Development/dash-core/dash-core
```

**What it does:** Builds dash-core, creates a direct symlink in `node_modules/@trops/dash-core`.

**Notes:** The path argument is required. Uses direct symlinks (not `npm link`).

---

### `npm run unlink-core`

Remove the local dash-core symlink and restore the published version.

```bash
npm run unlink-core
```

**What it does:** Removes symlink, runs `npm install` to restore the published package.

---

### `npm run link-react`

Link a local dash-react build into this project.

```bash
npm run link-react -- ~/Development/dash-react/dash-react
```

---

### `npm run unlink-react`

Remove the local dash-react symlink and restore the published version.

```bash
npm run unlink-react
```

---

## PRD Management

### `npm run prdize`

Create a new PRD from the template.

```bash
npm run prdize "Feature Name"
```

**What it does:** Creates `docs/requirements/prd/{feature-name}.md` from `docs/requirements/PRD-TEMPLATE.md`.

---

### `npm run test:prd`

Validate PRD documents against the template schema.

```bash
npm run test:prd
```

---

### `npm run prd:coverage`

Analyze PRD coverage across the project.

```bash
npm run prd:coverage
```

---

## Packaging & Distribution

### `npm run package`

Package the Electron app as a Mac `.dmg` distributable.

```bash
npm run package
```

**What it does:** `craco build && electron-forge package`

**Prerequisites:** Apple Developer account, code signing certificates, XCode.

---

### `npm run package:universal`

Package as a universal (ARM + Intel) Mac app.

```bash
npm run package:universal
```

---

### `npm run make`

Build and create the distributable installer.

```bash
npm run make
```

**What it does:** `craco build && electron-forge make`

**Output:** `/out/make/[YourApp].dmg`

---

### `npm run make:universal`

Build a universal Mac installer.

```bash
npm run make:universal
```

---

### `npm run apple-notarize`

Submit the packaged app to Apple for notarization.

```bash
npm run apple-notarize
```

**Prerequisites:** Packaged app in `/out/`, Apple Developer credentials in `.env`.

---

### `npm run apple-staple`

Staple the notarization ticket to the packaged app.

```bash
npm run apple-staple
```

---

### `npm run apple-history`

Check Apple notarization history.

```bash
npm run apple-history
```

---

### `npm run apple-log`

View Apple notarization log.

```bash
npm run apple-log
```

---

## Utility

### `npm run bump`

Bump the patch version in `package.json` (no git tag).

```bash
npm run bump
```

**What it does:** `npm version --no-git-tag-version patch`

**Notes:** Handled automatically by `ci.sh`. Rarely needed standalone.

---

### `npm run clean`

Clear npm cache and remove lock file.

```bash
npm run clean
```

---

### `npm run publish-forge`

Publish via Electron Forge (from dry run output).

```bash
npm run publish-forge
```

**What it does:** `electron-forge publish -- --from-dry-run`
