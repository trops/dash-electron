/**
 * Sample composer layouts — curated starting grids the user can pick
 * from when opening a fresh widget. Each layout is structure-only
 * (no preconfigured wires) so it's portable across users regardless
 * of which providers they've configured.
 *
 * Each entry exposes a `buildGrid()` that composes the grid through
 * the same mutators a user-driven session would use
 * (`makeEmptyGrid` + `setCellComponent` + `addRow` + `splitCell`) —
 * NOT a hand-rolled object literal. This guarantees the produced
 * grid passes every invariant the rest of the composer expects
 * (stable cell ids, correct `_nextCellId`, proper container/leaf
 * shape per the schema's `children` prop).
 *
 * Heading variants follow WIDGET_CONVENTIONS.headings (Phase C): all
 * titles use SubHeading2; sub-section labels use SubHeading3; the only
 * Heading2/Heading3 in this file is for the stat starter's big-number
 * display. NEVER raw Heading — the H1 the user explicitly complained
 * about.
 *
 * Provider-flavored starters carry a `provider` tag — when the user
 * picked a provider in the QuickStartPane wizard, those starters
 * surface first via `getSampleLayoutsForIntent(intent, providerChoice)`.
 *
 * Add a new entry by appending to SAMPLE_LAYOUTS. Each layout needs
 * a stable id (used as React key), a short label and one-liner
 * description, an `outline` text sketch for the picker card, and
 * `intents` (one or more from INTENTS). Optionally a `provider` id
 * to flag it as flavored for a specific service.
 */

import {
    makeEmptyGrid,
    addRow,
    splitCell,
    setCellComponent,
} from "./gridLayout";
import { HEADING_CONVENTIONS } from "./widgetConventions";

// Local helpers for the buildGrid mutators. Each one re-reads the
// freshest cell ids after every mutation — setCellComponent /
// addRow / splitCell return a NEW grid with potentially new ids;
// caching the row index instead of re-reading is the standard
// footgun, so we always go through grid.grids[gridId].rows[idx].
function setSeedTo(g, componentName, props) {
    const root = g.rootGridId;
    const seed = g.grids[root].rows[0].cells[0];
    return setCellComponent(g, seed, componentName, props);
}

function appendChild(g, parentGridId, componentName, props) {
    g = addRow(g, parentGridId);
    const rowIdx = g.grids[parentGridId].rows.length - 1;
    const cellId = g.grids[parentGridId].rows[rowIdx].cells[0];
    return setCellComponent(g, cellId, componentName, props);
}

// ── Generic starters — provider-agnostic, used when the user didn't
//    pre-pick a provider OR when the picked provider has no flavored
//    starter yet.

function buildSearchAndList() {
    // Panel { SubHeading2, SearchInput, DataList } — canonical
    // "type and see results" shape. SubHeading2 makes the widget
    // self-labeling out of the box (no "this is the AI's placeholder"
    // guesswork).
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Search",
    });
    g = appendChild(g, panelGridId, "SearchInput", {
        placeholder: "Search…",
        label: "Search",
    });
    g = appendChild(g, panelGridId, "DataList");
    return g;
}

function buildTwoColumnSplit() {
    // Panel { SubHeading2, [Card, Card] } — two side-by-side surfaces
    // under a shared title. The title used to be skipped at this layer
    // (the rationale was "each Card carries its own context once
    // filled"), but the scorecard's title rule fires before the user
    // has wired the Cards to anything, so the starter now always ships
    // with a title placeholder the user can rename.
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Section title",
    });
    // Add a row below the title for the two-column split.
    g = appendChild(g, panelGridId, "Card");
    // appendChild added a single Card row; locate its cell and split
    // it horizontally to create the second Card.
    const splitRow = g.grids[panelGridId].rows[1];
    const leftCellId = splitRow.cells[0];
    g = splitCell(g, leftCellId);
    const [leftId, rightId] = g.grids[panelGridId].rows[1].cells;
    g = setCellComponent(g, leftId, "Card");
    g = setCellComponent(g, rightId, "Card");
    return g;
}

function buildStatTile() {
    // Panel { SubHeading2, Heading2 (number), Paragraph } — stat
    // template derived from GmailUnreadCount. Heading2 is the only
    // place inside a widget where a large display is appropriate
    // (allowedNumericDisplay in conventions).
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Unread",
    });
    g = appendChild(
        g,
        panelGridId,
        HEADING_CONVENTIONS.allowedNumericDisplay[0],
        { title: "0" }
    );
    g = appendChild(g, panelGridId, "Paragraph", {
        text: "unread items",
    });
    return g;
}

function buildSubmitForm() {
    // Panel { SubHeading2, InputText, InputText, Button } — minimal
    // form. Button.onClick gets wired to a tool that reads the
    // inputs via componentValue arg bindings.
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Compose",
    });
    g = appendChild(g, panelGridId, "InputText", { label: "Name" });
    g = appendChild(g, panelGridId, "InputText", { label: "Notes" });
    g = appendChild(g, panelGridId, "Button", { title: "Submit" });
    return g;
}

function buildTableViewer() {
    // Panel { SubHeading2, Table } — list-of-records pattern. User
    // wires Table.data to a fetch + edits Table.columns.
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Records",
    });
    g = appendChild(g, panelGridId, "Table");
    return g;
}

// ── Provider-flavored starters — modeled after Phase B accepted
//    widgets. Tagged with a `provider` id so they float to the top
//    when the user picked that service in the QuickStartPane wizard.

function buildAlgoliaRulesList() {
    // Modeled after AlgoliaRulesList: title + index sub-label +
    // search input for rule filtering + result list. The "Index
    // rules" sub-heading hints to the user that this is the rules
    // ListView (vs. a generic records table).
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Algolia Rules",
    });
    g = appendChild(g, panelGridId, HEADING_CONVENTIONS.preferredSubsection, {
        title: "Index rules",
    });
    g = appendChild(g, panelGridId, "SearchInput", {
        placeholder: "Filter rules…",
        label: "Filter",
    });
    g = appendChild(g, panelGridId, "DataList");
    return g;
}

function buildGitHubPRList() {
    // Modeled after GitHubPRList. Repository sub-label, list of PRs,
    // refresh button. Pairs with a future PR detail widget via
    // prSelected event.
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Open Pull Requests",
    });
    g = appendChild(g, panelGridId, HEADING_CONVENTIONS.preferredSubsection, {
        title: "Repository",
    });
    g = appendChild(g, panelGridId, "DataList");
    g = appendChild(g, panelGridId, "Button", { title: "Refresh" });
    return g;
}

function buildSlackChannelList() {
    // Modeled after SlackListChannels. Title + search filter + list
    // of channels. Clicking publishes channelSelected — pairs with
    // SlackChannelMessages or any messages widget.
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Slack Channels",
    });
    g = appendChild(g, panelGridId, "SearchInput", {
        placeholder: "Filter channels…",
        label: "Filter",
    });
    g = appendChild(g, panelGridId, "DataList");
    return g;
}

function buildGmailUnreadStat() {
    // Modeled after GmailUnreadCount. Title + big number + label +
    // refresh button. Heading2 for the number is the conventions'
    // sanctioned use of a non-SubHeading variant.
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Unread Email",
    });
    g = appendChild(
        g,
        panelGridId,
        HEADING_CONVENTIONS.allowedNumericDisplay[0],
        { title: "0" }
    );
    g = appendChild(g, panelGridId, "Paragraph", {
        text: "unread email",
    });
    g = appendChild(g, panelGridId, "Button", { title: "Refresh" });
    return g;
}

function buildDriveRecentFiles() {
    // Modeled after GoogleDriveRecentFiles. Title + DataList for the
    // recent-files rows + refresh.
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Recent Files",
    });
    g = appendChild(g, panelGridId, "DataList");
    g = appendChild(g, panelGridId, "Button", { title: "Refresh" });
    return g;
}

function buildNotionSearch() {
    // Modeled after NotionPageSearch. Title + search input + DataList
    // for results. Debouncing happens at runtime — the layout itself
    // is just structure.
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Notion Search",
    });
    g = appendChild(g, panelGridId, "SearchInput", {
        placeholder: "Search pages…",
        label: "Search by title",
    });
    g = appendChild(g, panelGridId, "DataList");
    return g;
}

function buildFilesystemTree() {
    // Modeled after FilesystemDirectoryViewer (single-pane tree).
    // Title + DataList (which the user wires into a recursive tree
    // visualization at runtime). Simplified layout — the recursion
    // lives in the wired component, not the starter.
    let g = makeEmptyGrid();
    g = setSeedTo(g, "Panel");
    const root = g.rootGridId;
    const panelGridId = g.cells[g.grids[root].rows[0].cells[0]].gridId;
    const titleCell = g.grids[panelGridId].rows[0].cells[0];
    g = setCellComponent(g, titleCell, HEADING_CONVENTIONS.preferredTitle, {
        title: "Files",
    });
    g = appendChild(g, panelGridId, HEADING_CONVENTIONS.preferredSubsection, {
        title: "Root path",
    });
    g = appendChild(g, panelGridId, "DataList");
    return g;
}

/**
 * Intent tags drive the intent-first quick-start UI: after the user
 * picks an intent (search / view / act / else), QuickStartPane shows
 * only the matching layouts. A layout can fit multiple intents (e.g.
 * Two-column split is generic enough for search OR free-form), so
 * each entry carries an array.
 */
export const INTENTS = [
    {
        id: "search",
        label: "Search",
        icon: "🔍",
        tagline: "Find or filter data — input on top, results below.",
        aiHint:
            "The user wants a SEARCH widget: prioritize layouts with " +
            "an input (SearchInput / InputText) up top driving a " +
            "results region (DataList / Table) below it.",
    },
    {
        id: "view",
        label: "View",
        icon: "📊",
        tagline: "Show data, stats, or records — a read-only surface.",
        aiHint:
            "The user wants a VIEW widget: prioritize layouts that " +
            "display data (SubHeading2 + Table / DataList / Card with " +
            "stats). No input controls unless filtering is essential.",
    },
    {
        id: "act",
        label: "Act",
        icon: "⚡",
        tagline: "Submit a form or fire an action — inputs + a button.",
        aiHint:
            "The user wants an ACTION widget: include input fields " +
            "(InputText / TextArea / SelectInput) and a Button to " +
            "submit. The Button.onClick will be wired to a tool.",
    },
    {
        id: "else",
        label: "Custom",
        icon: "✨",
        tagline: "Something else — start free-form or let AI propose.",
        aiHint:
            "The user wants a CUSTOM widget that doesn't fit search / " +
            "view / action neatly. Suggest a flexible layout with " +
            "containers (Panel / Card) the user can fill in.",
    },
    {
        id: "provider",
        label: "Provider",
        icon: "📡",
        tagline:
            "Start from a service — Slack, Algolia, Google Drive, " +
            "GitHub, etc.",
        // aiHint is overridden at scaffold time by the chosen
        // provider's name (see QuickStartPane.buildSystemPrompt) —
        // this string is a fallback if the user lands on the AI
        // form without picking a provider first.
        aiHint:
            "The user wants a widget that connects to a specific " +
            "external service. Suggest layouts whose data slots are " +
            "obviously meant to be wired to provider tools.",
    },
];

export const SAMPLE_LAYOUTS = [
    // ── Provider-flavored starters (Phase C step 2). Each carries
    //    a `provider` tag so getSampleLayoutsForIntent floats it to
    //    the top when that provider was pre-picked.
    {
        id: "algolia-rules-list",
        label: "Algolia rules list",
        intents: ["search", "view", "provider"],
        provider: "algolia",
        description:
            "Modeled on AlgoliaRulesList: title + filter input + result " +
            "list, perfect for browsing query rules per index.",
        outline: [
            "Panel",
            " ├─ SubHeading2 (Algolia Rules)",
            " ├─ SubHeading3 (Index rules)",
            " ├─ SearchInput",
            " └─ DataList",
        ].join("\n"),
        buildGrid: buildAlgoliaRulesList,
    },
    {
        id: "github-pr-list",
        label: "GitHub PR list",
        intents: ["view", "provider"],
        provider: "github",
        description:
            "Modeled on GitHubPRList: open PRs for a repo with a " +
            "refresh button. Publishes prSelected on row click.",
        outline: [
            "Panel",
            " ├─ SubHeading2 (Open Pull Requests)",
            " ├─ SubHeading3 (Repository)",
            " ├─ DataList",
            " └─ Button (Refresh)",
        ].join("\n"),
        buildGrid: buildGitHubPRList,
    },
    {
        id: "slack-channel-list",
        label: "Slack channel list",
        intents: ["view", "search", "provider"],
        provider: "slack",
        description:
            "Modeled on SlackListChannels: scrollable list of channels " +
            "with a filter. Publishes channelSelected for paired widgets.",
        outline: [
            "Panel",
            " ├─ SubHeading2 (Slack Channels)",
            " ├─ SearchInput",
            " └─ DataList",
        ].join("\n"),
        buildGrid: buildSlackChannelList,
    },
    {
        id: "gmail-unread-stat",
        label: "Gmail unread stat",
        intents: ["view", "provider"],
        provider: "gmail",
        description:
            "Modeled on GmailUnreadCount: single big number for unread " +
            "email with a refresh button. The stat-tile template.",
        outline: [
            "Panel",
            " ├─ SubHeading2 (Unread Email)",
            " ├─ Heading2 (0)",
            " ├─ Paragraph",
            " └─ Button (Refresh)",
        ].join("\n"),
        buildGrid: buildGmailUnreadStat,
    },
    {
        id: "drive-recent-files",
        label: "Drive recent files",
        intents: ["view", "provider"],
        provider: "google-drive",
        description:
            "Modeled on GoogleDriveRecentFiles: list of recently " +
            "modified files with a refresh.",
        outline: [
            "Panel",
            " ├─ SubHeading2 (Recent Files)",
            " ├─ DataList",
            " └─ Button (Refresh)",
        ].join("\n"),
        buildGrid: buildDriveRecentFiles,
    },
    {
        id: "notion-page-search",
        label: "Notion page search",
        intents: ["search", "provider"],
        provider: "notion",
        description:
            "Modeled on NotionPageSearch: debounced search input + " +
            "result list of pages. Publishes pageSelected on click.",
        outline: [
            "Panel",
            " ├─ SubHeading2 (Notion Search)",
            " ├─ SearchInput",
            " └─ DataList",
        ].join("\n"),
        buildGrid: buildNotionSearch,
    },
    {
        id: "filesystem-tree",
        label: "Filesystem tree",
        intents: ["view", "provider"],
        provider: "filesystem",
        description:
            "Modeled on FilesystemDirectoryViewer: title + root path " +
            "sub-label + tree list of directory contents.",
        outline: [
            "Panel",
            " ├─ SubHeading2 (Files)",
            " ├─ SubHeading3 (Root path)",
            " └─ DataList",
        ].join("\n"),
        buildGrid: buildFilesystemTree,
    },
    // ── Generic starters — provider-agnostic. Surfaced when the user
    //    didn't pre-pick a provider OR when their pick has no flavored
    //    starter yet.
    {
        id: "search-and-list",
        label: "Search & list",
        intents: ["search"],
        description:
            "Type-ahead search across a provider, with a list of " +
            "matching items below.",
        outline: [
            "Panel",
            " ├─ SubHeading2",
            " ├─ SearchInput",
            " └─ DataList",
        ].join("\n"),
        buildGrid: buildSearchAndList,
    },
    {
        id: "two-column-split",
        label: "Two-column split",
        intents: ["search", "view", "else"],
        description:
            "Two side-by-side cards. Drop different content in each — " +
            "filters + results, metrics + chart, etc.",
        outline: ["Panel", " └─ [ Card | Card ]"].join("\n"),
        buildGrid: buildTwoColumnSplit,
    },
    {
        id: "stat-tile",
        label: "Stat tile",
        intents: ["view"],
        description:
            "Single big number on a titled panel. The conventions-" +
            "sanctioned use of Heading2 inside a widget.",
        outline: [
            "Panel",
            " ├─ SubHeading2",
            " ├─ Heading2 (the number)",
            " └─ Paragraph (label)",
        ].join("\n"),
        buildGrid: buildStatTile,
    },
    {
        id: "table-viewer",
        label: "Table viewer",
        intents: ["view"],
        description:
            "Titled panel containing a Table. Wire Table.data to a " +
            "provider fetch.",
        outline: ["Panel", " ├─ SubHeading2", " └─ Table"].join("\n"),
        buildGrid: buildTableViewer,
    },
    {
        id: "submit-form",
        label: "Submit form",
        intents: ["act"],
        description:
            "Two text inputs and a submit button. Wire the button's " +
            "onClick to a tool that reads the inputs.",
        outline: [
            "Panel",
            " ├─ SubHeading2",
            " ├─ InputText",
            " ├─ InputText",
            " └─ Button",
        ].join("\n"),
        buildGrid: buildSubmitForm,
    },
];

/**
 * Sample layouts filtered to a given intent. Returns the full list
 * when intent is null/unknown (defensive). Always at least one
 * entry per intent in the shipped fixture set.
 *
 * When a `providerChoice` is supplied (the wirable-type record from
 * QuickStartPane's ProviderPicker), provider-flavored starters whose
 * `provider` matches `providerChoice.id` float to the top of the
 * returned list. Generic starters still appear below — the user can
 * always escape the provider-specific cluster.
 */
export function getSampleLayoutsForIntent(intentId, providerChoice = null) {
    const matches = intentId
        ? SAMPLE_LAYOUTS.filter(
              (l) => Array.isArray(l.intents) && l.intents.includes(intentId)
          )
        : SAMPLE_LAYOUTS.slice();
    if (!providerChoice || !providerChoice.id) return matches;
    // Stable partition: flavored-for-this-provider first, everything
    // else after, original order preserved within each group.
    const flavored = [];
    const rest = [];
    for (const l of matches) {
        if (l.provider && l.provider === providerChoice.id) flavored.push(l);
        else rest.push(l);
    }
    return [...flavored, ...rest];
}
