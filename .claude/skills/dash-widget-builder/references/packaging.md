# Packaging & Distribution

## Table of Contents

1. Bundling Widgets
2. Publishing as an npm Package
3. Registry Manifest
4. Submitting to the Dash Registry
5. Installing External Widget Packages
6. Packaging the Full Electron App

---

## 1. Bundling Widgets

When your widget is ready for distribution, bundle it:

```bash
npm run package-widgets
```

This compiles your widgets from `src/Widgets/` into distributable bundles that can
be consumed by other Dash projects as npm packages.

---

## 2. Publishing as an npm Package

### Step 1: Update package.json

Set the widget package name and version:

```json
{
    "name": "@your-org/my-widgets-package",
    "version": "1.0.0",
    "main": "dist/index.js"
}
```

### Step 2: Bundle

```bash
npm run package-widgets
```

### Step 3: Version bump

```bash
npm version patch    # or minor / major
```

### Step 4: Push to repository

```bash
git push origin master
```

A GitHub Actions workflow (configured in `.github/workflows/`) automatically
publishes the package on push to master.

---

## 3. Registry Manifest

To list your widget in the Dash Registry (https://trops.github.io/dash-registry/),
you need a `manifest.json` file.

The manifest lives in the registry repo under your scope:

```
packages/
  your-github-username/
    your-widget-name/
      manifest.json
```

### Manifest structure

The manifest describes your widget package for the registry's search index and
detail pages. It includes metadata like name, description, version, repository URL,
and which widgets are included.

Check the dash-registry CONTRIBUTING.md for the current schema:
https://github.com/trops/dash-registry/blob/main/CONTRIBUTING.md

The registry runs validation on all manifests via `npm run validate` and the
`scripts/validate-packages.js` script. CI checks PRs automatically.

---

## 4. Submitting to the Dash Registry

### Step 1: Fork the registry

Fork https://github.com/trops/dash-registry

### Step 2: Create your package directory

```bash
mkdir -p packages/your-username/your-widget-name
```

### Step 3: Create manifest.json

Write a manifest following the schema from CONTRIBUTING.md.

### Step 4: Validate locally

```bash
npm run validate
```

### Step 5: Submit a PR

Push your branch and open a PR to `main`. The CI pipeline will:

-   Validate your manifest schema
-   Run the linter
-   Build the registry index

Once merged, the registry site auto-deploys via GitHub Pages.

---

## 5. Installing External Widget Packages

Other Dash projects consume your widgets by importing and registering them:

```javascript
// In the consuming app's main component
import * as MyWidgets from "@your-org/my-widgets-package/dist";

// Register each widget with the ComponentManager
Object.keys(MyWidgets).forEach((widgetName) => {
    ComponentManager.registerWidget(MyWidgets[widgetName], widgetName);
});
```

`ComponentManager` is imported from `@trops/dash-core`:

```javascript
import { ComponentManager } from "@trops/dash-core";
```

This is how widgets load at runtime without recompiling the Electron app — the
ComponentManager dynamically registers widget components, and the framework's
WidgetFactory renders them on demand.

---

## 6. Packaging the Full Electron App

If the user needs to distribute the entire dashboard app (not just widgets):

### Mac .dmg

Requires XCode and an Apple Developer account with code signing certificates.

```bash
# Set up signing credentials in .env first
npm run package          # Creates /out/make/[YourApp].dmg
npm run apple-notarize   # Required for distribution
npm run apple-staple     # Staple the notarization ticket
```

### Requirements for app packaging

1. Apple Developer account with code signing certificates
2. Application-Specific Password from Apple
3. XCode installed and configured
4. Environment variables set in `.env`

This is separate from widget packaging — most widget developers only need
`npm run package-widgets` and npm publishing. Full app packaging is for
distributing the entire Dash dashboard as a standalone Mac application.
