/**
 * @jest-environment jsdom
 *
 * Phase 3 exemplar widgets — render smoke + primitive-usage assertions.
 *
 * Mounts each of the 4 re-authored exemplar widgets (Slack, GitHub,
 * Gmail, Algolia) with disconnected-provider stubs and asserts:
 *
 *   1. The widget mounts without throwing. Catches JSX / hook ordering
 *      / unresolved-import regressions that the source-level
 *      EXEMPLAR_WIDGETS lint can't see (it only greps for forbidden
 *      class names, not whether the code actually compiles + runs).
 *
 *   2. The new primitives appear in the rendered output with the
 *      expected props. Specifically:
 *        - StatusBadge mounts (for the connection-indicator pattern)
 *        - EmptyState mounts when no provider is configured
 *        - StatCard mounts for the Gmail stat widget
 *      Each primitive is mocked as a marker component so we can
 *      assert presence + props without depending on dash-react's
 *      theme resolution machinery.
 *
 *   3. No raw <button> tag with className appears in the output —
 *      every button comes from a dash-react Button variant. (The
 *      EXEMPLAR_WIDGETS lint checks the source; this checks the
 *      compiled render.)
 *
 * jsdom render rather than Playwright e2e because:
 *   - The claim under test is "these widgets render with the new
 *     primitives", which is testable at the React-tree level.
 *     Going through registry install + dashboard mount just to
 *     observe the same DOM is orchestration without payoff.
 *   - Visual cohesion ("looks like the chrome") is human judgment;
 *     no automated test substitutes for opening the running app.
 *
 * Mocks:
 *   - `@trops/dash-react`: identity-stubs for every primitive the
 *     widgets import. Each stub records its props as data attributes
 *     so the tests can read them back via querySelector.
 *   - `@trops/dash-core`: Widget = passthrough, hooks return
 *     disconnected/empty default state.
 *   - `window.mainApi.algolia`: no-op stub for the credential
 *     branch.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// ─── @trops/dash-react primitive mocks ──────────────────────────────
//
// Each mock is a thin marker component. The widget tests then query
// them by data-testid + read recorded props from data attributes.
jest.mock("@trops/dash-react", () => {
    const React = require("react");
    const stub = (name) => (props) =>
        React.createElement(
            "div",
            {
                "data-stub": name,
                "data-state": props.state ?? "",
                "data-label": props.label ?? "",
                "data-title": props.title ?? "",
                "data-description": props.description ?? "",
                "data-value": props.value ?? "",
                "data-message": props.message ?? "",
                "data-compact": props.compact ? "true" : "false",
                "data-disabled": props.disabled ? "true" : "false",
                "data-on-click":
                    typeof props.onClick === "function" ? "true" : "false",
            },
            props.title ??
                props.label ??
                props.message ??
                props.text ??
                props.children ??
                null
        );
    const passthrough = (name) =>
        function Passthrough(props) {
            return React.createElement(
                "div",
                { "data-stub": name },
                props.children
            );
        };
    return {
        Panel: passthrough("Panel"),
        SubHeading2: stub("SubHeading2"),
        SubHeading3: stub("SubHeading3"),
        Caption: stub("Caption"),
        Caption2: stub("Caption2"),
        Paragraph: stub("Paragraph"),
        Button: stub("Button"),
        Button2: stub("Button2"),
        Button3: stub("Button3"),
        InputText: stub("InputText"),
        Menu: passthrough("Menu"),
        MenuItem: passthrough("MenuItem"),
        StatusBadge: stub("StatusBadge"),
        EmptyState: stub("EmptyState"),
        StatCard: stub("StatCard"),
        Alert2: stub("Alert2"),
        Skeleton: Object.assign(stub("Skeleton"), {
            Text: stub("Skeleton.Text"),
            Card: stub("Skeleton.Card"),
        }),
    };
});

// ─── @trops/dash-core hooks ───────────────────────────────────────
//
// Returns disconnected / no-provider state by default. The render
// path we care about is the empty / disconnected branch — that's
// where EmptyState + StatusBadge + Alert2 are the visible primitives
// the cohesion rule's biggest beneficiaries.
jest.mock("@trops/dash-core", () => {
    const React = require("react");
    return {
        Widget: function Widget(props) {
            return React.createElement(
                "div",
                { "data-stub": "Widget" },
                props.children
            );
        },
        useMcpProvider: () => ({
            isConnected: false,
            isConnecting: false,
            error: null,
            tools: [],
            callTool: jest.fn(),
            status: "disconnected",
        }),
        useWidgetProviders: () => ({
            hasProvider: () => false,
            getProvider: () => null,
        }),
        useProviderClient: () => ({
            providerHash: null,
            providerName: null,
            dashboardAppId: null,
        }),
        useWidgetEvents: () => ({
            publishEvent: jest.fn(),
            listen: jest.fn(),
            listeners: {},
        }),
    };
});

// window.mainApi stubs — the credential widget (AlgoliaRulesList)
// reaches for `window.mainApi.algolia.searchRules` even in the
// disconnected branch's defensive code. A no-op promise covers it.
beforeAll(() => {
    if (typeof window !== "undefined") {
        window.mainApi = window.mainApi || {};
        window.mainApi.algolia = window.mainApi.algolia || {
            searchRules: () =>
                Promise.resolve({ hits: [], nbPages: 0, nbHits: 0, page: 0 }),
        };
    }
});

// Import widgets AFTER mocks are registered.
const { SlackListChannels } = require("./Slack/widgets/SlackListChannels");
const { GitHubPRList } = require("./GitHub/widgets/GitHubPRList");
const { GmailUnreadCount } = require("./Gmail/widgets/GmailUnreadCount");
const { AlgoliaRulesList } = require("./Algolia/widgets/AlgoliaRulesList");

function assertNoRawButtons(container) {
    // Every actual <button> in the rendered tree must come from a
    // mocked dash-react Button variant — which in our mocks renders
    // as a <div data-stub="Button…"> NOT a real <button>. So a real
    // <button> tag in the output indicates raw <button className=…>
    // JSX in the widget source — a cohesion-rule violation.
    const rawButtons = container.querySelectorAll("button");
    expect(rawButtons.length).toBe(0);
}

describe("SlackListChannels — disconnected render", () => {
    test("mounts without throwing", () => {
        expect(() =>
            render(<SlackListChannels title="Slack Channels" />)
        ).not.toThrow();
    });

    test("renders StatusBadge for the connection indicator (compact mode, neutral state)", () => {
        const { container } = render(
            <SlackListChannels title="Slack Channels" />
        );
        const badges = container.querySelectorAll('[data-stub="StatusBadge"]');
        expect(badges.length).toBeGreaterThanOrEqual(1);
        // The connection badge in disconnected mode renders in compact
        // mode with state="neutral".
        const connBadge = Array.from(badges).find(
            (b) => b.getAttribute("data-compact") === "true"
        );
        expect(connBadge).toBeTruthy();
        expect(connBadge.getAttribute("data-state")).toBe("neutral");
    });

    test("renders EmptyState with the Slack-not-connected message", () => {
        const { container } = render(
            <SlackListChannels title="Slack Channels" />
        );
        const empties = container.querySelectorAll('[data-stub="EmptyState"]');
        expect(empties.length).toBeGreaterThanOrEqual(1);
        const titles = Array.from(empties).map((e) =>
            e.getAttribute("data-title")
        );
        expect(titles.some((t) => /slack not connected/i.test(t || ""))).toBe(
            true
        );
    });

    test("no raw <button> tags in output", () => {
        const { container } = render(
            <SlackListChannels title="Slack Channels" />
        );
        assertNoRawButtons(container);
    });
});

describe("GitHubPRList — no-repo render", () => {
    test("mounts without throwing", () => {
        expect(() => render(<GitHubPRList title="GitHub PRs" />)).not.toThrow();
    });

    test("renders StatusBadge for the connection indicator", () => {
        const { container } = render(<GitHubPRList title="GitHub PRs" />);
        const badges = container.querySelectorAll('[data-stub="StatusBadge"]');
        expect(badges.length).toBeGreaterThanOrEqual(1);
        const compactBadge = Array.from(badges).find(
            (b) => b.getAttribute("data-compact") === "true"
        );
        expect(compactBadge).toBeTruthy();
    });

    test("renders EmptyState when no repository is configured", () => {
        const { container } = render(<GitHubPRList title="GitHub PRs" />);
        const empties = container.querySelectorAll('[data-stub="EmptyState"]');
        const titles = Array.from(empties).map((e) =>
            e.getAttribute("data-title")
        );
        expect(titles.some((t) => /no repository/i.test(t || ""))).toBe(true);
    });

    test("no raw <button> tags in output", () => {
        const { container } = render(<GitHubPRList title="GitHub PRs" />);
        assertNoRawButtons(container);
    });
});

describe("GmailUnreadCount — disconnected render", () => {
    test("mounts without throwing", () => {
        expect(() =>
            render(<GmailUnreadCount title="Unread Email" />)
        ).not.toThrow();
    });

    test("renders StatCard with the stat-tile pattern (em-dash placeholder when no count)", () => {
        const { container } = render(<GmailUnreadCount title="Unread Email" />);
        const cards = container.querySelectorAll('[data-stub="StatCard"]');
        expect(cards.length).toBe(1);
        expect(cards[0].getAttribute("data-value")).toBe("—");
    });

    test("renders StatusBadge for connection state (compact mode)", () => {
        const { container } = render(<GmailUnreadCount title="Unread Email" />);
        const badges = container.querySelectorAll('[data-stub="StatusBadge"]');
        const compactBadge = Array.from(badges).find(
            (b) => b.getAttribute("data-compact") === "true"
        );
        expect(compactBadge).toBeTruthy();
    });

    test("Refresh button is a dash-react Button variant (no raw <button>)", () => {
        const { container } = render(<GmailUnreadCount title="Unread Email" />);
        // At least one Button2 must be in the tree (the Refresh CTA).
        const buttons = container.querySelectorAll('[data-stub="Button2"]');
        expect(buttons.length).toBeGreaterThanOrEqual(1);
        assertNoRawButtons(container);
    });
});

describe("AlgoliaRulesList — no-provider render", () => {
    test("mounts without throwing", () => {
        expect(() =>
            render(<AlgoliaRulesList title="Algolia Rules" />)
        ).not.toThrow();
    });

    test("renders StatusBadge for the connection indicator", () => {
        const { container } = render(
            <AlgoliaRulesList title="Algolia Rules" />
        );
        const badges = container.querySelectorAll('[data-stub="StatusBadge"]');
        const compactBadge = Array.from(badges).find(
            (b) => b.getAttribute("data-compact") === "true"
        );
        expect(compactBadge).toBeTruthy();
    });

    test("renders 'No Algolia provider' EmptyState when credentials missing", () => {
        const { container } = render(
            <AlgoliaRulesList title="Algolia Rules" />
        );
        const empties = container.querySelectorAll('[data-stub="EmptyState"]');
        const titles = Array.from(empties).map((e) =>
            e.getAttribute("data-title")
        );
        expect(titles.some((t) => /no algolia provider/i.test(t || ""))).toBe(
            true
        );
    });

    test("no raw <button> tags in output", () => {
        const { container } = render(
            <AlgoliaRulesList title="Algolia Rules" />
        );
        assertNoRawButtons(container);
    });
});

describe("Cohesion rule — every exemplar's tree uses only dash-react primitives", () => {
    test.each([
        ["SlackListChannels", SlackListChannels],
        ["GitHubPRList", GitHubPRList],
        ["GmailUnreadCount", GmailUnreadCount],
        ["AlgoliaRulesList", AlgoliaRulesList],
    ])(
        "%s renders only primitives + layout divs (no raw input / button / span pills)",
        (name, Widget) => {
            const { container } = render(<Widget title={`Test ${name}`} />);
            // Raw HTML controls that should never appear (the widgets must
            // route through dash-react's InputText / Button* / StatusBadge
            // / Tag instead).
            expect(container.querySelectorAll("button").length).toBe(0);
            expect(container.querySelectorAll("input").length).toBe(0);
        }
    );
});
