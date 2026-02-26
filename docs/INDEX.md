# Dash-Electron Documentation Index

Documentation for the dash-electron application template — an Electron dashboard app built on `@trops/dash-core` and `@trops/dash-react`.

## Getting Started

-   **[QUICK_START.md](./QUICK_START.md)** - Quick start guide to get up and running
-   **[README.md](./README.md)** - Overview and setup instructions
-   **[DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)** - Development workflow and best practices

## Building Widgets with Claude Code

-   **[.claude/skills/dash-widget-builder/SKILL.md](../.claude/skills/dash-widget-builder/SKILL.md)** - Claude Code skill for guided widget development (scaffold → MCP research → build → test → distribute)

## Requirements & Product Design

Product Requirements Documents (PRDs) define the "why" and "what" of features:

-   **[requirements/README.md](./requirements/README.md)** - PRD system overview and navigation
-   **[requirements/PRD-TEMPLATE.md](./requirements/PRD-TEMPLATE.md)** - Template for creating new PRDs
-   **[requirements/prd/layout-builder-hybrid.md](./requirements/prd/layout-builder-hybrid.md)** - LayoutBuilder Hybrid Redesign PRD
-   **[requirements/prd/mcp-providers.md](./requirements/prd/mcp-providers.md)** - MCP Provider System PRD
-   **[requirements/prd/command-palette-navigation.md](./requirements/prd/command-palette-navigation.md)** - Command Palette Navigation PRD

**PRDs answer:** Why are we building this? Who is it for? What defines success?

## Template-Specific Documentation

-   **[MAIN_APP_INTEGRATION.md](./MAIN_APP_INTEGRATION.md)** - Application integration patterns and checklist

## Core Framework Documentation

The widget system, provider architecture, and widget API are documented in `@trops/dash-core`:

**Widget System:**

-   [Widget System](https://github.com/trops/dash-core/blob/master/docs/WIDGET_SYSTEM.md) - Architecture, auto-registration, hot reload
-   [Widget API](https://github.com/trops/dash-core/blob/master/docs/WIDGET_API.md) - Management API reference
-   [Widget API Quick Reference](https://github.com/trops/dash-core/blob/master/docs/WIDGET_API_QUICK_REF.md) - Condensed method reference
-   [Widget Development](https://github.com/trops/dash-core/blob/master/docs/WIDGET_DEVELOPMENT.md) - Create and test widgets
-   [Widget Registry](https://github.com/trops/dash-core/blob/master/docs/WIDGET_REGISTRY.md) - Packaging and distribution

**Provider System:**

-   [Provider Architecture](https://github.com/trops/dash-core/blob/master/docs/PROVIDER_ARCHITECTURE.md) - Three-tier storage model, encryption, MCP
-   [Widget Provider Configuration](https://github.com/trops/dash-core/blob/master/docs/WIDGET_PROVIDER_CONFIGURATION.md) - Provider config in .dash.js

**Testing:**

-   [Testing Guide](https://github.com/trops/dash-core/blob/master/docs/TESTING.md) - Provider and widget testing

## Images & Diagrams

Additional resources and diagrams are available in the `images/` subdirectory.

---

**Related Documentation:**

-   [@trops/dash-core](https://github.com/trops/dash-core) — Core framework documentation
-   [@trops/dash-react](https://github.com/trops/dash-react) — React UI component library
