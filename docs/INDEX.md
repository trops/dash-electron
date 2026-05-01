# Dash-Electron Documentation Index

Documentation for the dash-electron application template — an Electron dashboard app built on `@trops/dash-core` and `@trops/dash-react`.

## Developer Guide

-   **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Comprehensive guide to building widgets, dashboards, and themes (start here)
-   **[SCRIPTS.md](./SCRIPTS.md)** - Complete npm script reference with usage examples

## Getting Started

-   **[QUICK_START.md](./QUICK_START.md)** - Quick start guide to get up and running
-   **[README.md](./README.md)** - Overview and setup instructions
-   **[DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)** - Development workflow and best practices

## Building Widgets with Claude Code

-   **[.claude/skills/dash-widget-builder/SKILL.md](../.claude/skills/dash-widget-builder/SKILL.md)** - Claude Code skill for guided widget development (scaffold → MCP research → build → test → distribute)

## Requirements & Product Design

-   **[requirements/prd/developer-experience.md](./requirements/prd/developer-experience.md)** - Developer Experience & Asset Distribution PRD
-   **[requirements/README.md](./requirements/README.md)** - PRD system overview
-   **[requirements/PRD-TEMPLATE.md](./requirements/PRD-TEMPLATE.md)** - Template for creating new PRDs

Framework-level PRDs are in [@trops/dash-core](https://github.com/trops/dash-core/tree/master/docs/requirements/prd).

## MCP Dash Server

-   **[MCP_DASH_SERVER.md](./MCP_DASH_SERVER.md)** - Complete MCP server reference — all 19 tools, 3 prompts, 5 resources, setup, and usage examples

## Template-Specific Documentation

-   **[MAIN_APP_INTEGRATION.md](./MAIN_APP_INTEGRATION.md)** - Application integration patterns and checklist

## Quality Assurance

-   **[QA/MANUAL-TEST-PLAN.md](./QA/MANUAL-TEST-PLAN.md)** - End-to-end manual test checklist organized by topic (Dashboards, Widgets, Themes, Providers, Settings, AI Assistant, App Lifecycle)
-   **[QA/REPORT-TEMPLATE.md](./QA/REPORT-TEMPLATE.md)** - Copy-paste template for filing a QA finding

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
