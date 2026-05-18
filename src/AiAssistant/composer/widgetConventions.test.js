/**
 * Pin the shape of widgetConventions.js so future PRs can't silently
 * weaken the rubric.
 *
 * The convention object is consumed by three places that will land in
 * Phase C:
 *   - the AI scaffold prompt (`QuickStartPane.buildSystemPrompt`)
 *     interpolates the heading rule + layout defaults + state
 *     patterns + required states
 *   - the starter-layout authors pick variants from `headings.preferredTitle`
 *   - the emitter guardrails downgrade obvious mistakes by checking
 *     `headings.forbidden`
 *
 * If any of these fields disappear, all three consumers silently lose
 * their authority — the tests below catch that explicitly so it
 * surfaces during CI instead of as a quality regression in shipped
 * widgets.
 */

import {
    WIDGET_CONVENTIONS,
    HEADING_CONVENTIONS,
    LAYOUT_CONVENTIONS,
    STATE_PATTERNS,
    REQUIRED_STATES,
    USER_CONFIG_CONVENTIONS,
    ACCEPTANCE_CHECKLIST,
} from "./widgetConventions";

describe("HEADING_CONVENTIONS", () => {
    test("forbids raw Heading (the H1 the user explicitly complained about)", () => {
        expect(HEADING_CONVENTIONS.forbidden).toContain("Heading");
    });

    test("preferredTitle is SubHeading2 — what every hand-authored sample uses", () => {
        expect(HEADING_CONVENTIONS.preferredTitle).toBe("SubHeading2");
    });

    test("preferredSubsection is SubHeading3", () => {
        expect(HEADING_CONVENTIONS.preferredSubsection).toBe("SubHeading3");
    });

    test("Heading2 and Heading3 are allowed for numeric display (stat widgets)", () => {
        expect(HEADING_CONVENTIONS.allowedNumericDisplay).toContain("Heading2");
        expect(HEADING_CONVENTIONS.allowedNumericDisplay).toContain("Heading3");
    });

    test("rule string mentions both 'SubHeading2' and 'Heading' so an AI reading it gets the contrast", () => {
        expect(HEADING_CONVENTIONS.rule).toMatch(/SubHeading2/);
        expect(HEADING_CONVENTIONS.rule).toMatch(/Heading/);
    });
});

describe("LAYOUT_CONVENTIONS", () => {
    test("rootClassName declares vertical-stack + breathing-room + full-height", () => {
        const cn = LAYOUT_CONVENTIONS.rootClassName;
        expect(cn).toMatch(/flex/);
        expect(cn).toMatch(/flex-col/);
        expect(cn).toMatch(/gap-/); // gap-4 specifically observed across samples
        expect(cn).toMatch(/h-full/);
    });

    test("multiChildContainerSpacing is set (used by the emitter guardrail in Phase C)", () => {
        expect(typeof LAYOUT_CONVENTIONS.multiChildContainerSpacing).toBe(
            "string"
        );
        expect(
            LAYOUT_CONVENTIONS.multiChildContainerSpacing.length
        ).toBeGreaterThan(0);
    });

    test("inputPadding + inputTextSize are present so the prompt can quote concrete defaults", () => {
        expect(LAYOUT_CONVENTIONS.inputPadding).toBeTruthy();
        expect(LAYOUT_CONVENTIONS.inputTextSize).toBeTruthy();
    });
});

describe("STATE_PATTERNS", () => {
    test("covers the four observed patterns: mcp provider, credential provider, events, autoSave", () => {
        expect(STATE_PATTERNS).toHaveProperty("mcpProvider");
        expect(STATE_PATTERNS).toHaveProperty("credentialProvider");
        expect(STATE_PATTERNS).toHaveProperty("events");
        expect(STATE_PATTERNS).toHaveProperty("autoSave");
    });

    test("each pattern is a non-empty descriptive string (consumed verbatim by the AI prompt)", () => {
        for (const [name, body] of Object.entries(STATE_PATTERNS)) {
            expect(typeof body).toBe("string");
            // The patterns become rules in the AI prompt — a few-word
            // body would be too vague to be useful.
            expect(body.length).toBeGreaterThanOrEqual(40);
        }
    });

    test("mcpProvider mentions parseMcpResponse — the per-package utility every MCP widget uses", () => {
        expect(STATE_PATTERNS.mcpProvider).toMatch(/parseMcpResponse/);
    });

    test("events pattern names both publishEvent and listen", () => {
        expect(STATE_PATTERNS.events).toMatch(/publishEvent/);
        expect(STATE_PATTERNS.events).toMatch(/listen/);
    });
});

describe("REQUIRED_STATES", () => {
    test("contains loading, empty, and error — each one rendered separately by acceptance check", () => {
        expect(REQUIRED_STATES).toEqual(["loading", "empty", "error"]);
    });
});

describe("USER_CONFIG_CONVENTIONS", () => {
    test("requires displayName + instructions on every userConfig field", () => {
        expect(USER_CONFIG_CONVENTIONS.requiredFields).toContain("displayName");
        expect(USER_CONFIG_CONVENTIONS.requiredFields).toContain(
            "instructions"
        );
    });

    test("recommends defaultValue", () => {
        expect(USER_CONFIG_CONVENTIONS.recommendedFields).toContain(
            "defaultValue"
        );
    });

    test("hardcodingRule mentions concrete examples (channel/repo/index)", () => {
        const r = USER_CONFIG_CONVENTIONS.hardcodingRule;
        expect(r).toMatch(/channel/i);
        expect(r).toMatch(/repo|repository/i);
        expect(r).toMatch(/index/i);
    });
});

describe("WIDGET_CONVENTIONS aggregator", () => {
    test("re-exports every sub-object plus the placeholders consumers will populate", () => {
        expect(WIDGET_CONVENTIONS.headings).toBe(HEADING_CONVENTIONS);
        expect(WIDGET_CONVENTIONS.layout).toBe(LAYOUT_CONVENTIONS);
        expect(WIDGET_CONVENTIONS.statePatterns).toBe(STATE_PATTERNS);
        expect(WIDGET_CONVENTIONS.requiredStates).toBe(REQUIRED_STATES);
        expect(WIDGET_CONVENTIONS.userConfig).toBe(USER_CONFIG_CONVENTIONS);
    });

    test("fewShotExamples + referencedWidgets are arrays (Phase C populates them)", () => {
        expect(Array.isArray(WIDGET_CONVENTIONS.fewShotExamples)).toBe(true);
        expect(Array.isArray(WIDGET_CONVENTIONS.referencedWidgets)).toBe(true);
    });
});

describe("ACCEPTANCE_CHECKLIST", () => {
    test("has at least 10 concrete items — the user's bar is high", () => {
        expect(ACCEPTANCE_CHECKLIST.length).toBeGreaterThanOrEqual(10);
    });

    test("each item is a complete sentence ending in a period", () => {
        for (const item of ACCEPTANCE_CHECKLIST) {
            expect(item).toMatch(/\.$/);
            // Short stubs would defeat the purpose — every item should
            // be specific enough to fail or pass against an actual
            // widget.
            expect(item.length).toBeGreaterThanOrEqual(30);
        }
    });

    test("mentions the H1 rule explicitly (the user's literal complaint)", () => {
        const joined = ACCEPTANCE_CHECKLIST.join(" ");
        expect(joined).toMatch(/SubHeading2/);
        expect(joined).toMatch(/Heading/);
    });

    test("mentions each required state by name", () => {
        const joined = ACCEPTANCE_CHECKLIST.join(" ").toLowerCase();
        for (const state of REQUIRED_STATES) {
            expect(joined).toContain(state);
        }
    });

    test("mentions parseMcpResponse and useMcpProvider so MCP widgets can self-verify", () => {
        const joined = ACCEPTANCE_CHECKLIST.join(" ");
        expect(joined).toMatch(/parseMcpResponse/);
        expect(joined).toMatch(/useMcpProvider/);
    });

    test("mentions userConfig + the hardcoding rule (covered by separate items)", () => {
        const joined = ACCEPTANCE_CHECKLIST.join(" ").toLowerCase();
        expect(joined).toContain("userconfig");
        expect(joined).toMatch(/hardcoded/);
    });
});
