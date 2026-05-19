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
import { AcceptanceScorecard, evaluateScorecard } from "./AcceptanceScorecard";

// Strong "everything wrong" sample. Hits the color-Tailwind rule, the
// raw-button rule, no SubHeading2, no EmptyState / Skeleton / Alert,
// no provider hook.
const BAD_WIDGET_CODE = `
import React from "react";
import { Panel, Heading } from "@trops/dash-react";

export default function BadWidget() {
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

    test("flags item 5 (no provider hook used)", () => {
        expect(byIndex[5].pass).toBe(false);
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
