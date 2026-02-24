# Product Requirements Documentation

## Overview

This directory contains Product Requirements Documents (PRDs) for Dash features. PRDs complement the existing technical documentation by providing business context, user needs, and success criteria.

**What PRDs Answer:**

-   **Why** are we building this feature? (Problem statement, business value)
-   **Who** is it for? (User personas, pain points)
-   **What** defines success? (Acceptance criteria, metrics)
-   **When** should it be done? (Implementation phases, priorities)

**What Technical Docs Answer:**

-   **How** is it built? (Architecture, design patterns)
-   **Where** is the code? (File locations, code structure)
-   **What** are the APIs? (Function signatures, parameters)

## Documentation Hierarchy

```
PRDs (requirements)
  ↓ Define user needs and acceptance criteria
Architecture Docs (design)
  ↓ Define system structure and patterns
Implementation Guides (code)
  ↓ Provide code examples and integration steps
```

## When to Create a PRD

Create a new PRD when:

-   **Starting a new major feature** - OAuth integration, widget marketplace, etc.
-   **Significant user-facing changes** - New UI paradigm, workflow redesign
-   **Cross-cutting concerns** - Security model overhaul, theme system redesign
-   **Need to define success metrics** before technical work begins
-   **Stakeholder alignment required** before implementation

**Example:** LayoutBuilder Hybrid Redesign - new interaction model, measurable UX goals, multiple user personas affected

## When to Update Existing Technical Docs

Update existing technical docs (not a new PRD) when:

-   **Bug fixes or small improvements**
-   **API signature changes**
-   **Implementation details change**
-   **Adding code examples or troubleshooting tips**
-   **Performance optimizations** that don't change user workflows

**Example:** Adding a new method to ComponentManager - update API reference

## When to Update Both

Update both PRD and technical docs when:

-   **Feature scope expands** - Add to PRD "Future Considerations", update technical docs with new APIs
-   **Success metrics change** - Update PRD metrics, add instrumentation in technical docs
-   **User workflows change** - Update PRD workflow section AND technical implementation guide

**Example:** Provider system adds OAuth support - update PRD with new user stories, update architecture docs with OAuth flow diagrams

---

## Existing PRDs

-   **[Test Feature](./prd/test-feature.md)** - Status: Draft - 2026-02-14
-   **[LayoutBuilder Hybrid Redesign](./prd/layout-builder-hybrid.md)** - Status: In Progress - 2026-02-14
-   **[Enhanced WidgetDropdown with Mac Finder-Style Interface](./prd/widget-dropdown.md)** - Status: Draft - 2026-02-14
-   **[MCP Providers](./prd/mcp-providers.md)** - Status: Completed - MCP provider system for widget-to-tool connectivity
-   **[Command Palette Navigation](./prd/command-palette-navigation.md)** - Status: Draft - Command palette for quick navigation

---

## Creating a New PRD

### Using the prdize Script (Recommended)

```bash
# Create new PRD from template
npm run prdize "Feature Name"

# Dry run (preview without creating files)
npm run prdize "Feature Name" --dry-run
```

The script will:

1. Create `docs/requirements/prd/feature-name.md` from template
2. Replace placeholders with feature name and current date
3. Update this README with new PRD entry
4. Open the file in your default editor

### Manual Creation

1. Copy [PRD-TEMPLATE.md](./PRD-TEMPLATE.md)
2. Rename to `prd/your-feature-name.md`
3. Replace all `[Feature Name]` placeholders
4. Update dates (`YYYY-MM-DD`)
5. Add entry to "Existing PRDs" section above

---

## PRD Template Sections

Each PRD includes:

1. **Status & Metadata** - Status, last updated, owner, related PRDs
2. **Executive Summary** - One-paragraph overview
3. **Context & Background** - Problem statement, current state, limitations
4. **Goals & Success Metrics** - Measurable objectives, non-goals
5. **User Personas** - Who benefits, their goals, pain points
6. **User Stories** - Acceptance criteria by priority (P0/P1/P2)
7. **Feature Requirements** - Functional and non-functional requirements
8. **User Workflows** - Step-by-step flows with examples
9. **Design Considerations** - UI/UX, architecture, dependencies
10. **Open Questions & Decisions** - Decision tracking
11. **Out of Scope** - Explicitly excluded items
12. **Implementation Phases** - MVP/Enhancement/Polish breakdown
13. **Technical Documentation** - Links to architecture docs
14. **Revision History** - Version tracking

---

## User Stories Format

User stories are embedded in PRDs with this structure:

```markdown
### Must-Have (P0)

**US-001: [Story Title]**

> As a [persona],
> I want to [action],
> so that [benefit].

**Acceptance Criteria:**

-   [ ] AC1: Given [context], when [action], then [result]
-   [ ] AC2: [Specific, testable criterion]

**Edge Cases:**

-   [Edge case] → [Expected behavior]

**Technical Notes:**
[Implementation hints, links to docs, constraints]

**Example Scenario:**
```

User has empty dashboard.
User clicks "+" button.
Expected: WidgetDropdown appears centered.

```

**Definition of Done:**
- [ ] Code implemented and reviewed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Acceptance criteria verified
- [ ] Documentation updated
```

---

## Testing PRDs

### Generate Test Checklist

```bash
# View all acceptance criteria for a PRD
npm run test:prd layout-builder-hybrid

# View checklist with verification steps
npm run test:prd layout-builder-hybrid --checklist
```

### Check Test Coverage

```bash
# See which acceptance criteria have automated tests
npm run prd:coverage layout-builder-hybrid
```

### Testing Workflow

**During Implementation:**

1. Read PRD user story
2. Run `npm run test:prd [prd-name] --checklist`
3. Implement feature
4. Write tests for each acceptance criterion
5. Run `npm run prd:coverage [prd-name]`

**During PR Review:**

1. Verify PR links to specific user story
2. Check Definition of Done checklist is complete
3. Run automated tests
4. Manually verify ACs that can't be automated
5. Check PRD coverage report

**Post-Merge:**

1. Update PRD user story status to "Completed"
2. Check off acceptance criteria in PRD
3. Run full coverage report

---

## Integration with Technical Documentation

PRDs work alongside existing technical documentation:

### PRDs Link TO Technical Docs

```markdown
**Technical Notes:** See [PROVIDER_ARCHITECTURE.md](../../PROVIDER_ARCHITECTURE.md) for implementation details.
```

### Technical Docs Link FROM PRDs

Add to existing architecture/implementation docs:

```markdown
This architecture implements requirements from [PRD: Provider System](../requirements/prd/provider-system.md).
```

### One Source of Truth Rule

-   If information exists in a technical doc, the PRD **links** to it
-   PRDs focus on **WHY** and **WHO**
-   Technical docs focus on **HOW**
-   No duplication of content

---

## Related Documentation

**Technical Documentation:**

-   [INDEX.md](../INDEX.md) - Main documentation index
-   [WIDGET_SYSTEM.md](../WIDGET_SYSTEM.md) - Widget architecture
-   [PROVIDER_ARCHITECTURE.md](../PROVIDER_ARCHITECTURE.md) - Provider system design
-   [WIDGET_DEVELOPMENT.md](../WIDGET_DEVELOPMENT.md) - Widget development guide

**Project Context:**

-   [CLAUDE.md](../../CLAUDE.md) - High-level project guide for AI assistants
-   [README.md](../../README.md) - Project overview and quick start

---

## Maintenance

**PRD Lifecycle:**

1. **Draft** - Initial creation, collecting requirements
2. **In Progress** - Implementation ongoing
3. **Completed** - Feature shipped, PRD serves as historical reference
4. **Deprecated** - Feature removed or replaced

**Annual Review:**

-   Review all PRDs for staleness
-   Mark completed PRDs with status "Completed"
-   Archive deprecated PRDs to `prd/archive/` directory
-   Update when requirements change significantly

**Keeping PRDs Current:**

-   Update "Last Updated" date when making changes
-   Add to "Revision History" for major changes
-   Link new user stories to related technical docs
-   Update success metrics if goals change

---

## Questions?

For questions about PRDs or this documentation system:

-   See [PRD-TEMPLATE.md](./PRD-TEMPLATE.md) for the full template
-   Check existing PRDs for examples
-   Consult [CLAUDE.md](../../CLAUDE.md) for AI assistant workflow guidance

For questions about technical implementation:

-   See [INDEX.md](../INDEX.md) for technical documentation index
-   Review architecture docs for design patterns
-   Check implementation guides for code examples
