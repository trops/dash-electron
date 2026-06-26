/**
 * Curated widget-builder guidance, sourced from
 * .claude/skills/dash-widget-builder/SKILL.md.
 *
 * Why this exists: the dash-widget-builder skill produces excellent
 * widgets when invoked from the terminal `claude` CLI, because it
 * gives the AI rich architectural context about the four-repo
 * ecosystem and the runtime widget shape. The in-app widget-builder
 * modal previously maintained its own (drifted) prompt and missed
 * that context. Inlining a curated copy here keeps the modal aligned
 * with what's working well in the CLI.
 *
 * What is KEPT (verbatim or near-verbatim):
 *   - Ecosystem Overview (four-repo summary)
 *   - How Widgets Work — The Big Picture (architecture diagram +
 *     key insights about app-level providers and runtime loading)
 *   - Quick Reference — Common Patterns (Minimal Widget, Widget
 *     with MCP Data, Widget .dash.js Configuration, dash.json)
 *
 * What is STRIPPED:
 *   - "Before You Start — Scan This Project" — bash/ls/cat
 *     instructions that don't apply in the modal (no shell tools).
 *   - "Workflow — Building a Widget" Phases 1-5 — scaffolding,
 *     testing, packaging via shell. The modal doesn't scaffold;
 *     it compiles the AI's emitted code blocks directly.
 *   - "Reference Documents" — paths to references/*.md files that
 *     the AI loads via the Read tool in CLI mode. Not applicable
 *     in the modal (no Read tool).
 *
 * What is FIXED (deliberate divergence from SKILL.md):
 *   - The Minimal Widget example uses `<Heading title=...>` /
 *     `<SubHeading title=...>` rather than `text=`. SKILL.md's
 *     example is wrong for the current dash-react API — Heading /
 *     SubHeading take `title`, not `text` (verified in
 *     dash-react/dist/index.js). The CLI workflow gets away with
 *     it because the AI reads references/widget-development.md
 *     which has correct examples; the modal has no Read tool, so
 *     the inlined example must be correct on its own.
 *
 * If SKILL.md is updated to fix its prop names, the divergence
 * disappears and this file should be re-curated to match.
 */
export const WIDGET_BUILDER_GUIDANCE = `## Widget Builder Guidance

Build, test, and distribute widgets for the Dash Electron dashboard project. The content below is the same architectural and pattern guidance the standalone \`claude\` CLI uses when building widgets in this project — its instructions are inlined here so this modal does not need to invoke the dash-widget-builder skill separately.

### Ecosystem Overview

Dash is a four-repo ecosystem:

| Repo | Purpose | Key Exports |
| ---- | ------- | ----------- |
| dash-electron | Electron app template — this project | Scaffold, dev server, packaging |
| dash-core | Framework internals — widget system, MCP, providers | \`useMcpProvider\`, \`useWidgetProviders\`, \`useDashboard\`, \`ComponentManager\`, \`mcpController\` |
| dash-react | UI component library | \`Widget\`, \`Panel\`, \`Heading\`, \`Button\`, \`Menu\`, \`ThemeContext\`, \`FontAwesomeIcon\`, etc. |
| dash-registry | Widget marketplace & project scaffolding | Manifest validation, registry index |

### How Widgets Work — The Big Picture

A Dash widget is a **React component that acts as a UI shell** for data from external services. The architecture is:

\`\`\`
┌─────────────────────────────────────────────────┐
│  Electron App (Providers Settings)              │
│  ┌──────────────────────────────────────────┐   │
│  │ "Slack" provider: MCP URL, auth token    │   │
│  │ "Algolia" provider: MCP URL, API key     │   │
│  │  (configured once, shared to all widgets)│   │
│  └──────────────────┬───────────────────────┘   │
│                     │                            │
│  Electron Main Process                          │
│  ┌─────────────┐   │   ┌────────────────────┐  │
│  │ mcpController│───┘   │ MCP Server Catalog │  │
│  │ (IPC broker) │───────│ (Slack, etc.)      │  │
│  └──────┬──────┘       └────────────────────┘  │
│         │ IPC                                    │
├─────────┼───────────────────────────────────────┤
│  Renderer Process                                │
│         │                                        │
│  ┌──────▼──────┐                                 │
│  │useMcpProvider│  ← Hook from dash-core         │
│  └──────┬──────┘                                 │
│     ┌───┴───────────────┐                        │
│  ┌──▼─────────┐  ┌──────▼──────┐                 │
│  │ Widget A    │  │ Widget B    │  ← All widgets  │
│  │ (channels)  │  │ (messages)  │    sharing same  │
│  └─────────────┘  └─────────────┘    provider      │
└─────────────────────────────────────────────────┘
\`\`\`

**Key insights:**

- Widgets are loaded at runtime without recompiling Electron.
- **Providers are app-level** — the user configures MCP connections (URL, auth tokens) once in the Electron app's Providers settings. Any widget that specifies it needs that provider gets the shared connection automatically.
- **Every widget declares its own \`providers\` array** in its \`.dash.js\` file. The Electron app handles deduplication and credential sharing at runtime.
- **Widgets just call \`mcp.callTool()\`** — no wrapper components or context setup needed.

### Quick Reference — Common Patterns

#### Minimal Widget

\`\`\`javascript
import { Widget, Panel, Heading, SubHeading } from "@trops/dash-react";

export const MyWidget = ({
    title = "Hello",
    subtitle = "I'm a widget",
    api,
    ...props
}) => {
    return (
        <Widget {...props}>
            <Panel>
                <Heading title={title} />
                <SubHeading title={subtitle} />
            </Panel>
        </Widget>
    );
};
\`\`\`

#### Widget with MCP Data

\`\`\`javascript
import { useState } from "react";
import { Widget, Panel, Heading, Menu, MenuItem } from "@trops/dash-react";
import { useMcpProvider } from "@trops/dash-core";

// MCP tool results come back wrapped in a content-block envelope:
//   { content: [{ type: "text", text: "<JSON string>" }] }
// You MUST extract content[].text and JSON.parse it — the parsed object is
// NOT on the raw return (e.g. \`response.results\` / \`response.settings\` are
// undefined). This is true for EVERY MCP tool (search, getSettings, etc.).
// Always include this helper in widgets that call mcp.callTool():
function parseMcpJson(res) {
    if (typeof res === "string") {
        try { return JSON.parse(res); } catch { return res; }
    }
    if (res?.content && Array.isArray(res.content)) {
        const text = res.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\\n");
        try { return JSON.parse(text); } catch { return text; }
    }
    return res;
}

export const SearchWidget = ({ api, ...props }) => {
    const mcp = useMcpProvider("algolia");
    const [results, setResults] = useState([]);

    const handleSearch = async (query) => {
        const res = await mcp.callTool("search", { query });
        const parsed = parseMcpJson(res); // unwrap content[].text + JSON.parse
        setResults(parsed.hits ?? parsed.results ?? []);
    };

    return (
        <Widget {...props}>
            <Panel>
                <Heading title="Search" />
                <Menu>
                    {results.map((item) => (
                        <MenuItem key={item.id}>{item.title}</MenuItem>
                    ))}
                </Menu>
            </Panel>
        </Widget>
    );
};
\`\`\`

#### Widget .dash.js Configuration

\`\`\`javascript
import { MyWidget } from "./MyWidget";

export default {
    component: MyWidget,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "My Widget",
            displayName: "Title",
            instructions: "The title shown at the top of the widget",
            required: true,
        },
    },
    providers: [
        {
            type: "my-service",
            providerClass: "credential",
            required: true,
            credentialSchema: {
                apiKey: {
                    type: "password",
                    required: true,
                    displayName: "API Key",
                },
            },
        },
    ],
};
\`\`\`

#### dash.json Package Manifest

\`\`\`json
{
    "name": "@ai-built/mywidget",
    "displayName": "My Widget",
    "version": "1.0.0",
    "description": "Widget: MyWidget",
    "author": "AI Assistant",
    "widgets": [
        {
            "name": "MyWidget",
            "displayName": "My Widget",
            "description": ""
        }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
}
\`\`\`
`;
