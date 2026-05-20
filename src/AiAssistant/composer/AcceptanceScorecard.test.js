/**
 * @jest-environment jsdom
 *
 * AcceptanceScorecard — static-analysis check that the regex passes
 * pin the right items as ✗ given a known-bad widget code, and ✓ given
 * a known-good one. Smoke-tests the React rendering too.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    AcceptanceScorecard,
    evaluateScorecard,
    buildScorecardChatMessage,
} from "./AcceptanceScorecard";

// Strong "everything wrong" sample. Hits the color-Tailwind rule, the
// raw-button rule, raw <Heading>, no EmptyState / Skeleton / Alert.
// Imports useMcpProvider so the data-fetch-conditional checks (2/3/4/
// 5/15) actually fire — a pure-UI bad widget would resolve those to
// n/a, which would defeat the purpose of this fixture.
const BAD_WIDGET_CODE = `
import React, { useEffect } from "react";
import { Panel, Heading } from "@trops/dash-react";
import { useMcpProvider } from "@trops/dash-core";

export default function BadWidget() {
    const { callTool } = useMcpProvider("slack");
    useEffect(() => {
        callTool("slack_list_channels", {});
    }, []);
    return (
        <Panel>
            <Heading title="Hi" />
            <div className="bg-purple-600 text-white p-2 rounded">
                hardcoded color block
            </div>
            <button className="bg-emerald-500 hover:bg-emerald-400 text-white">
                Refresh
            </button>
            <p className="text-gray-600 italic">No results</p>
        </Panel>
    );
}
`;

// "Mostly good" sample — uses every primitive the rubric prefers.
// Some rubric items (userConfig, compiles-clean, etc.) aren't
// statically checkable; the scorecard marks them n/a, not ✗.
const GOOD_WIDGET_CODE = `
import React, { useState } from "react";
import {
    Panel,
    SubHeading2,
    Button2,
    StatusBadge,
    EmptyState,
    Alert2,
    Skeleton,
} from "@trops/dash-react";
import { useMcpProvider, useWidgetEvents } from "@trops/dash-core";

export default function GoodWidget({ title = "Hello" }) {
    const { isConnected } = useMcpProvider("slack");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    return (
        <Panel>
            <div className="flex flex-col gap-4 h-full overflow-y-auto">
                <SubHeading2 title={title} />
                <StatusBadge state={isConnected ? "success" : "neutral"} compact />
                {error && <Alert2 title="Failed" message={error} />}
                {loading && <Skeleton.Text lines={3} />}
                <EmptyState title="No data" description="Connect a provider." />
                <Button2 title="Refresh" onClick={() => parseMcpResponse({})} />
            </div>
        </Panel>
    );
}
`;

describe("evaluateScorecard — bad widget code", () => {
    const result = evaluateScorecard(BAD_WIDGET_CODE);
    const byIndex = Object.fromEntries(result.map((r) => [r.index, r]));

    test("flags item 0 (raw <Heading> in widget)", () => {
        expect(byIndex[0].pass).toBe(false);
    });

    test("flags item 12 (hardcoded color Tailwind classes)", () => {
        expect(byIndex[12].pass).toBe(false);
        // Surface the actual offending classes for the user.
        expect(byIndex[12].matches.length).toBeGreaterThan(0);
        expect(byIndex[12].matches.some((m) => /bg-purple-600/.test(m))).toBe(
            true
        );
    });

    test("flags item 13 (raw <button className=...>)", () => {
        expect(byIndex[13].pass).toBe(false);
        expect(byIndex[13].matches.length).toBeGreaterThan(0);
    });

    test("flags item 3 (EmptyState missing)", () => {
        expect(byIndex[3].pass).toBe(false);
    });

    test("flags item 4 (visible error region missing)", () => {
        expect(byIndex[4].pass).toBe(false);
    });

    test("passes item 5 — the bad fixture DOES wire useMcpProvider, the rule fires because hasDataFetchSurface is true", () => {
        // The bad widget legitimately has a provider hook (useMcpProvider
        // is imported + called). That's NOT the violation; items 2/3/4/15
        // are the real failures because the widget pulls data but
        // shows no loading/empty/error state. This test pins the
        // hasDataFetchSurface gate working as intended.
        expect(byIndex[5].pass).toBe(true);
    });
});

describe("evaluateScorecard — pure-UI widget (no data-fetch surface)", () => {
    // A widget with no @trops/dash-core import, no window.mainApi
    // call, no provider hook — e.g. a clock, calculator, or a
    // freshly-emitted Submit Form starter that hasn't been wired yet.
    // Items 2/3/4/5/15 should resolve to n/a (pass === null), not
    // fail — the rubric items aren't applicable to widgets that
    // don't move data.
    const PURE_UI_CODE = `
import React from "react";
import { Panel, SubHeading2, InputText, Button2 } from "@trops/dash-react";

export default function SubmitFormStarter() {
    return (
        <Panel>
            <div className="flex flex-col gap-4 h-full overflow-y-auto">
                <SubHeading2 title="Compose" />
                <InputText label="Name" />
                <InputText label="Notes" />
                <Button2 title="Submit" />
            </div>
        </Panel>
    );
}
`;
    const result = evaluateScorecard(PURE_UI_CODE);
    const byIndex = Object.fromEntries(result.map((r) => [r.index, r]));

    test("item 2 (loading state) resolves to n/a", () => {
        expect(byIndex[2].pass).toBeNull();
    });

    test("item 3 (empty state) resolves to n/a", () => {
        expect(byIndex[3].pass).toBeNull();
    });

    test("item 4 (error state) resolves to n/a", () => {
        expect(byIndex[4].pass).toBeNull();
    });

    test("item 5 (provider hook) resolves to n/a", () => {
        expect(byIndex[5].pass).toBeNull();
    });

    test("item 15 (empty/loading/error primitives) resolves to n/a", () => {
        expect(byIndex[15].pass).toBeNull();
    });

    test("non-conditional items still fire — item 0 (title) passes, item 12 (no color) passes", () => {
        expect(byIndex[0].pass).toBe(true);
        expect(byIndex[12].pass).toBe(true);
    });

    test("the whole pure-UI starter has zero failures", () => {
        const failed = result.filter((r) => r.pass === false);
        expect(failed.length).toBe(0);
    });
});

describe("evaluateScorecard — good widget code", () => {
    const result = evaluateScorecard(GOOD_WIDGET_CODE);
    const byIndex = Object.fromEntries(result.map((r) => [r.index, r]));

    test("passes item 0 (uses SubHeading2, no raw Heading)", () => {
        expect(byIndex[0].pass).toBe(true);
    });

    test("passes item 1 (root container uses flex-col + gap)", () => {
        expect(byIndex[1].pass).toBe(true);
    });

    test("passes item 3 (EmptyState present)", () => {
        expect(byIndex[3].pass).toBe(true);
    });

    test("passes item 4 (Alert2 used for error region)", () => {
        expect(byIndex[4].pass).toBe(true);
    });

    test("passes item 5 (useMcpProvider hook)", () => {
        expect(byIndex[5].pass).toBe(true);
    });

    test("passes item 12 (no hardcoded color Tailwind)", () => {
        expect(byIndex[12].pass).toBe(true);
        expect(byIndex[12].matches.length).toBe(0);
    });

    test("passes item 13 (no raw <button> tags)", () => {
        expect(byIndex[13].pass).toBe(true);
    });

    test("passes item 15 (EmptyState + Skeleton + Alert all present)", () => {
        expect(byIndex[15].pass).toBe(true);
    });
});

describe("evaluateScorecard — empty / unparseable input", () => {
    test("non-string input does not throw", () => {
        expect(() => evaluateScorecard(null)).not.toThrow();
        expect(() => evaluateScorecard(undefined)).not.toThrow();
        expect(() => evaluateScorecard(42)).not.toThrow();
    });

    test("empty string returns one row per checklist item", () => {
        const result = evaluateScorecard("");
        // Always 16 rows — one per ACCEPTANCE_CHECKLIST entry.
        expect(result.length).toBe(16);
    });
});

describe("AcceptanceScorecard component", () => {
    test("renders one row per checklist item", () => {
        render(<AcceptanceScorecard code={BAD_WIDGET_CODE} />);
        for (let i = 0; i < 16; i += 1) {
            expect(
                screen.getByTestId(`acceptance-scorecard-row-${i}`)
            ).toBeInTheDocument();
        }
    });

    test("summary shows pass/fail/n-a counts", () => {
        render(<AcceptanceScorecard code={BAD_WIDGET_CODE} />);
        const summary = screen.getByTestId("acceptance-scorecard-summary");
        expect(summary.textContent).toMatch(/pass/);
        expect(summary.textContent).toMatch(/fail/);
        expect(summary.textContent).toMatch(/n\/a/);
    });

    test("good code yields zero fails (only pass + n/a rows)", () => {
        render(<AcceptanceScorecard code={GOOD_WIDGET_CODE} />);
        const failRows = document.querySelectorAll(
            '[data-testid^="acceptance-scorecard-row-"][data-pass="false"]'
        );
        expect(failRows.length).toBe(0);
    });

    test("fail rows surface the offending substring when expanded", () => {
        render(<AcceptanceScorecard code={BAD_WIDGET_CODE} />);
        // Item 12 is the color-Tailwind rule — has matches we can expand.
        const row = screen.getByTestId("acceptance-scorecard-row-12");
        const button = row.querySelector("button");
        fireEvent.click(button);
        const matches = screen.getByTestId("acceptance-scorecard-matches-12");
        expect(matches.textContent).toMatch(/bg-purple-600/);
    });

    test("safe to render with empty/null code", () => {
        expect(() => render(<AcceptanceScorecard code="" />)).not.toThrow();
        expect(() => render(<AcceptanceScorecard code={null} />)).not.toThrow();
        expect(() =>
            render(<AcceptanceScorecard code={undefined} />)
        ).not.toThrow();
    });
});

describe("buildScorecardChatMessage — pure formatter", () => {
    test("empty input returns empty string", () => {
        expect(buildScorecardChatMessage([])).toBe("");
        expect(buildScorecardChatMessage(null)).toBe("");
        expect(buildScorecardChatMessage(undefined)).toBe("");
    });

    test("single rule produces conversational message + 'output BOTH code blocks'", () => {
        const msg = buildScorecardChatMessage([
            { index: 0, item: "Title uses SubHeading2.", matches: [] },
        ]);
        expect(msg).toMatch(/flags this rule/);
        expect(msg).toContain("Title uses SubHeading2.");
        expect(msg).toMatch(/Output BOTH/);
    });

    test("single rule with matches surfaces the offending substrings", () => {
        const msg = buildScorecardChatMessage([
            {
                index: 12,
                item: "No hardcoded Tailwind color classes.",
                matches: ["bg-purple-600", "text-gray-400"],
            },
        ]);
        expect(msg).toMatch(/Offending substring/);
        expect(msg).toContain("bg-purple-600");
        expect(msg).toContain("text-gray-400");
    });

    test("multiple rules produces a numbered list", () => {
        const msg = buildScorecardChatMessage([
            { index: 0, item: "Use SubHeading2.", matches: [] },
            { index: 4, item: "Error state rendered.", matches: [] },
            { index: 13, item: "No raw button tags.", matches: ["<button"] },
        ]);
        expect(msg).toMatch(/flags 3 rules/);
        expect(msg).toMatch(/1\. Use SubHeading2/);
        expect(msg).toMatch(/2\. Error state rendered/);
        expect(msg).toMatch(/3\. No raw button tags/);
        expect(msg).toContain("<button");
        expect(msg).toMatch(/Output BOTH/);
    });

    test("matches list is capped (head of 5 for single, head of 3 for multi)", () => {
        const single = buildScorecardChatMessage([
            {
                index: 12,
                item: "No hardcoded color.",
                matches: ["a", "b", "c", "d", "e", "f", "g"],
            },
        ]);
        // Single-rule cap = 5; the 6th and 7th render as "+N more".
        expect(single).toContain("a, b, c, d, e");
        expect(single).toMatch(/\+2 more/);

        const multi = buildScorecardChatMessage([
            { index: 0, item: "X", matches: [] },
            { index: 1, item: "Y", matches: ["m1", "m2", "m3", "m4"] },
        ]);
        // Multi-rule cap = 3; m4 surfaces as "+1 more".
        expect(multi).toContain("m1, m2, m3");
        expect(multi).toMatch(/\+1 more/);
    });
});

describe("AcceptanceScorecard — Ask AI integration", () => {
    test("Ask AI button renders per failing row when onSendToAi is provided", () => {
        const onSendToAi = jest.fn();
        render(
            <AcceptanceScorecard
                code={BAD_WIDGET_CODE}
                onSendToAi={onSendToAi}
            />
        );
        // Item 0 (raw Heading) and 12 (color tailwind) both fail in
        // the bad fixture — both should get a Send to AI button.
        expect(
            screen.getByTestId("acceptance-scorecard-row-0-send-to-ai")
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("acceptance-scorecard-row-12-send-to-ai")
        ).toBeInTheDocument();
    });

    test("Ask AI button is NOT rendered on passing or n/a rows", () => {
        const onSendToAi = jest.fn();
        render(
            <AcceptanceScorecard
                code={GOOD_WIDGET_CODE}
                onSendToAi={onSendToAi}
            />
        );
        // Good widget has no fails — no Send buttons anywhere.
        const sendButtons = document.querySelectorAll(
            '[data-testid^="acceptance-scorecard-row-"][data-testid$="-send-to-ai"]'
        );
        expect(sendButtons.length).toBe(0);
    });

    test("Ask AI buttons absent when onSendToAi is not provided", () => {
        render(<AcceptanceScorecard code={BAD_WIDGET_CODE} />);
        // No host wiring → read-only scorecard, no buttons.
        const sendButtons = document.querySelectorAll(
            '[data-testid^="acceptance-scorecard-row-"][data-testid$="-send-to-ai"]'
        );
        expect(sendButtons.length).toBe(0);
        // The "fix all" header button is also absent.
        expect(
            screen.queryByTestId("acceptance-scorecard-send-all-to-ai")
        ).not.toBeInTheDocument();
    });

    test("clicking per-row Ask AI invokes onSendToAi with that single rule", () => {
        const onSendToAi = jest.fn();
        render(
            <AcceptanceScorecard
                code={BAD_WIDGET_CODE}
                onSendToAi={onSendToAi}
            />
        );
        fireEvent.click(
            screen.getByTestId("acceptance-scorecard-row-12-send-to-ai")
        );
        expect(onSendToAi).toHaveBeenCalledTimes(1);
        const [rules] = onSendToAi.mock.calls[0];
        expect(Array.isArray(rules)).toBe(true);
        expect(rules.length).toBe(1);
        expect(rules[0].index).toBe(12);
    });

    test("'Ask AI to fix all N' button renders when there are >1 failing rules", () => {
        const onSendToAi = jest.fn();
        render(
            <AcceptanceScorecard
                code={BAD_WIDGET_CODE}
                onSendToAi={onSendToAi}
            />
        );
        const btn = screen.getByTestId("acceptance-scorecard-send-all-to-ai");
        expect(btn).toBeInTheDocument();
        // Label includes the count.
        expect(btn.textContent).toMatch(/fix all \d+/i);
    });

    test("clicking 'fix all' invokes onSendToAi with every failing rule", () => {
        const onSendToAi = jest.fn();
        render(
            <AcceptanceScorecard
                code={BAD_WIDGET_CODE}
                onSendToAi={onSendToAi}
            />
        );
        fireEvent.click(
            screen.getByTestId("acceptance-scorecard-send-all-to-ai")
        );
        expect(onSendToAi).toHaveBeenCalledTimes(1);
        const [rules] = onSendToAi.mock.calls[0];
        expect(rules.length).toBeGreaterThan(1);
        // All sent rules must be failing rows.
        expect(rules.every((r) => r.pass === false)).toBe(true);
    });
});
