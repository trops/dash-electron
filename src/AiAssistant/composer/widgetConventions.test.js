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

const fs = require("fs");
const path = require("path");

import {
    WIDGET_CONVENTIONS,
    HEADING_CONVENTIONS,
    LAYOUT_CONVENTIONS,
    STATE_PATTERNS,
    REQUIRED_STATES,
    USER_CONFIG_CONVENTIONS,
    ACCEPTANCE_CHECKLIST,
    FEW_SHOT_EXAMPLES,
    REFERENCED_WIDGETS,
    COLOR_RULE,
    PRIMITIVE_CONVENTIONS,
    COLOR_TAILWIND_REGEX,
    EXEMPLAR_WIDGETS,
    ALLOWED_VARIANTS,
    getAllowedVariantsForType,
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
        expect(WIDGET_CONVENTIONS.colorRule).toBe(COLOR_RULE);
        expect(WIDGET_CONVENTIONS.primitives).toBe(PRIMITIVE_CONVENTIONS);
        expect(WIDGET_CONVENTIONS.allowedVariants).toBe(ALLOWED_VARIANTS);
    });

    test("fewShotExamples + referencedWidgets are populated arrays (Phase C populated them)", () => {
        expect(Array.isArray(WIDGET_CONVENTIONS.fewShotExamples)).toBe(true);
        expect(Array.isArray(WIDGET_CONVENTIONS.referencedWidgets)).toBe(true);
        expect(WIDGET_CONVENTIONS.fewShotExamples.length).toBeGreaterThan(0);
        expect(WIDGET_CONVENTIONS.referencedWidgets.length).toBeGreaterThan(0);
    });
});

describe("REFERENCED_WIDGETS", () => {
    test("lists exactly the 8 Phase B widgets", () => {
        expect(REFERENCED_WIDGETS.length).toBe(8);
    });

    test("every referenced widget path exists on disk — stale entries fail loud", () => {
        // The few-shot examples are derived from these widgets; a
        // moved/deleted file would silently teach the AI a pattern
        // from a widget that no longer exists. Failing here forces
        // the conventions to be updated alongside any widget move.
        const repoRoot = path.resolve(__dirname, "..", "..", "..");
        for (const relPath of REFERENCED_WIDGETS) {
            const full = path.join(repoRoot, relPath);
            expect(fs.existsSync(full)).toBe(true);
        }
    });

    test("paths point at .js (not .dash.js) — the component, not the config", () => {
        for (const relPath of REFERENCED_WIDGETS) {
            expect(relPath.endsWith(".js")).toBe(true);
            expect(relPath.endsWith(".dash.js")).toBe(false);
        }
    });
});

describe("FEW_SHOT_EXAMPLES", () => {
    test("has at least 3 examples covering different shapes", () => {
        // Three shapes minimum: stat / list / search. Phase C uses
        // these as the in-prompt teaching material — fewer than 3 is
        // too narrow a pattern set to anchor the AI.
        expect(FEW_SHOT_EXAMPLES.length).toBeGreaterThanOrEqual(3);
    });

    test("every example has a description string and a tree shape", () => {
        for (const ex of FEW_SHOT_EXAMPLES) {
            expect(typeof ex.description).toBe("string");
            expect(ex.description.length).toBeGreaterThan(10);
            expect(ex.tree).toBeTruthy();
            expect(ex.tree.root).toBeTruthy();
        }
    });

    test("every example's tree.root.type is 'Panel' (the AI output schema rule)", () => {
        for (const ex of FEW_SHOT_EXAMPLES) {
            expect(ex.tree.root.type).toBe("Panel");
        }
    });

    test("no example uses raw Heading — only SubHeading2/SubHeading3 or numeric Heading2/Heading3", () => {
        const walk = (node) => {
            if (!node || typeof node !== "object") return;
            if (node.type === "Heading") {
                throw new Error(
                    `few-shot example "${ex.description}" uses forbidden Heading`
                );
            }
            if (Array.isArray(node.children)) node.children.forEach(walk);
        };
        let ex;
        for (ex of FEW_SHOT_EXAMPLES) walk(ex.tree.root);
    });

    test("every node's type is in the allowed conventions (SubHeading2 / SubHeading3 / Heading2 / Heading3 for any heading-like node)", () => {
        // Walk every node, when type matches a heading family it
        // must be one of the allowed forms.
        const walk = (node, ex) => {
            if (!node || typeof node !== "object") return;
            if (
                typeof node.type === "string" &&
                node.type.includes("Heading")
            ) {
                const allowed = [
                    HEADING_CONVENTIONS.preferredTitle,
                    HEADING_CONVENTIONS.preferredSubsection,
                    ...HEADING_CONVENTIONS.allowedNumericDisplay,
                ];
                expect(allowed).toContain(node.type);
            }
            if (Array.isArray(node.children))
                node.children.forEach((c) => walk(c, ex));
        };
        for (const ex of FEW_SHOT_EXAMPLES) walk(ex.tree.root, ex);
    });

    test("examples are compact — under 8 nodes each (prompt's 'keep each suggestion compact' rule)", () => {
        const count = (node) => {
            if (!node || typeof node !== "object") return 0;
            const childCount = Array.isArray(node.children)
                ? node.children.reduce((n, c) => n + count(c), 0)
                : 0;
            return 1 + childCount;
        };
        for (const ex of FEW_SHOT_EXAMPLES) {
            expect(count(ex.tree.root)).toBeLessThanOrEqual(8);
        }
    });
});

describe("COLOR_RULE", () => {
    test("is a non-empty string describing the no-hardcoded-color contract", () => {
        expect(typeof COLOR_RULE).toBe("string");
        expect(COLOR_RULE.length).toBeGreaterThan(80);
    });

    test("names the three banned utility prefixes (bg-, text-, border-)", () => {
        expect(COLOR_RULE).toMatch(/bg-\{color\}/);
        expect(COLOR_RULE).toMatch(/text-\{color\}/);
        expect(COLOR_RULE).toMatch(/border-\{color\}/);
    });

    test("names ThemeContext and dash-react as the source of color", () => {
        expect(COLOR_RULE).toMatch(/ThemeContext/);
        expect(COLOR_RULE).toMatch(/dash-react/);
    });

    test("explicitly allows theme-neutral utilities so the prompt isn't read as banning all Tailwind", () => {
        expect(COLOR_RULE).toMatch(/(spacing|sizing|flex|grid)/i);
    });
});

describe("PRIMITIVE_CONVENTIONS", () => {
    test("covers every use case the audit found drifting (button / status / error / empty / loading / stat)", () => {
        expect(PRIMITIVE_CONVENTIONS).toHaveProperty("button");
        expect(PRIMITIVE_CONVENTIONS).toHaveProperty("statusOrBadge");
        expect(PRIMITIVE_CONVENTIONS).toHaveProperty("errorRegion");
        expect(PRIMITIVE_CONVENTIONS).toHaveProperty("emptyState");
        expect(PRIMITIVE_CONVENTIONS).toHaveProperty("loadingState");
        expect(PRIMITIVE_CONVENTIONS).toHaveProperty("statTile");
    });

    test("each use case lists at least one primitive + a defaultChoice + a rule string", () => {
        for (const [name, body] of Object.entries(PRIMITIVE_CONVENTIONS)) {
            expect(Array.isArray(body.primitives)).toBe(true);
            expect(body.primitives.length).toBeGreaterThan(0);
            expect(typeof body.defaultChoice).toBe("string");
            expect(body.primitives).toContain(body.defaultChoice);
            expect(typeof body.rule).toBe("string");
            expect(body.rule.length).toBeGreaterThan(30);
        }
    });

    test("button rule explicitly forbids raw <button> tags", () => {
        expect(PRIMITIVE_CONVENTIONS.button.rule).toMatch(/raw.*<button/i);
        expect(PRIMITIVE_CONVENTIONS.button.forbidden).toContain("<button");
    });

    test("statusOrBadge defaults to StatusBadge (the new primitive that closes the gap)", () => {
        expect(PRIMITIVE_CONVENTIONS.statusOrBadge.defaultChoice).toBe(
            "StatusBadge"
        );
    });

    test("button defaults to Button2 (the chrome-default secondary)", () => {
        expect(PRIMITIVE_CONVENTIONS.button.defaultChoice).toBe("Button2");
    });
});

describe("COLOR_TAILWIND_REGEX", () => {
    test.each([
        "bg-red-500",
        "text-emerald-400",
        "border-amber-700",
        "hover:bg-blue-600",
        "hover:text-rose-400",
        "bg-purple-600",
        "text-gray-200",
    ])("matches forbidden utility %s", (cls) => {
        expect(cls).toMatch(COLOR_TAILWIND_REGEX);
    });

    test.each([
        "bg-black",
        "bg-white",
        "text-white",
        "bg-transparent",
        "opacity-50",
        "grid-cols-3",
        "flex-col",
        "p-4",
        "px-3",
        "gap-4",
        "rounded-lg",
        "transition-colors",
        "animate-pulse",
    ])("does NOT match theme-neutral utility %s", (cls) => {
        expect(cls).not.toMatch(COLOR_TAILWIND_REGEX);
    });
});

describe("ALLOWED_VARIANTS (PropertyInspector variant-picker source of truth)", () => {
    test("Heading + SubHeading bases both list the same widget-friendly variants", () => {
        // Same allowed set on both bases so a click on Heading vs
        // SubHeading vs Heading2 all surface the same option set —
        // the rule is "what's widget-friendly", not "what's in the
        // same numbered-suffix family".
        expect(ALLOWED_VARIANTS.Heading).toBeTruthy();
        expect(ALLOWED_VARIANTS.SubHeading).toBeTruthy();
        expect(ALLOWED_VARIANTS.Heading.allowed).toEqual(
            ALLOWED_VARIANTS.SubHeading.allowed
        );
    });

    test("Raw `Heading` is NOT in the allowed list (forbidden in widgets)", () => {
        // The whole point of the inspector hook — Heading is H1 and
        // banned in widget interiors. Phase 3's exemplars all use
        // SubHeading2 for the widget title; the inspector must
        // reflect that.
        expect(ALLOWED_VARIANTS.Heading.allowed).not.toContain("Heading");
    });

    test("Each variant has a semantic label for the picker pill", () => {
        for (const name of ALLOWED_VARIANTS.Heading.allowed) {
            expect(typeof ALLOWED_VARIANTS.Heading.labels[name]).toBe("string");
            expect(
                ALLOWED_VARIANTS.Heading.labels[name].length
            ).toBeGreaterThan(2);
        }
    });

    test("getAllowedVariantsForType resolves family from suffixed variants", () => {
        // Inspector calls this with whatever the cell's current type
        // happens to be — Heading2, Heading3, SubHeading2 all need
        // to map to the same family entry. Base-stripping is the
        // contract.
        expect(getAllowedVariantsForType("Heading")).toBe(
            ALLOWED_VARIANTS.Heading
        );
        expect(getAllowedVariantsForType("Heading2")).toBe(
            ALLOWED_VARIANTS.Heading
        );
        expect(getAllowedVariantsForType("Heading3")).toBe(
            ALLOWED_VARIANTS.Heading
        );
        expect(getAllowedVariantsForType("SubHeading2")).toBe(
            ALLOWED_VARIANTS.SubHeading
        );
    });

    test("getAllowedVariantsForType returns null for families without overrides", () => {
        // Tag/Button/Card etc. fall through to the schema's numbered-
        // suffix logic — they don't need cross-family swaps.
        expect(getAllowedVariantsForType("Tag")).toBe(null);
        expect(getAllowedVariantsForType("Button")).toBe(null);
        expect(getAllowedVariantsForType("Panel")).toBe(null);
    });

    test("getAllowedVariantsForType safely handles bad input", () => {
        expect(getAllowedVariantsForType(null)).toBe(null);
        expect(getAllowedVariantsForType(undefined)).toBe(null);
        expect(getAllowedVariantsForType(42)).toBe(null);
        expect(getAllowedVariantsForType("")).toBe(null);
    });
});

describe("EXEMPLAR_WIDGETS lint", () => {
    test("EXEMPLAR_WIDGETS is an array (Phase 3 populates it)", () => {
        expect(Array.isArray(EXEMPLAR_WIDGETS)).toBe(true);
    });

    test("every exemplar widget's file contains zero hardcoded color Tailwind utilities", () => {
        // CI-blocking once Phase 3 populates EXEMPLAR_WIDGETS. Phase 2
        // ships it empty so the test exists and is wired up — but
        // doesn't break CI on day-1 (the 8 Phase B widgets all currently
        // drift, fixing them in bulk is a separate cleanup pass).
        const repoRoot = path.resolve(__dirname, "..", "..", "..");
        for (const relPath of EXEMPLAR_WIDGETS) {
            const full = path.join(repoRoot, relPath);
            expect(fs.existsSync(full)).toBe(true);
            const src = fs.readFileSync(full, "utf8");
            // Strip block + line comments first — a comment that
            // mentions `bg-purple-600` (e.g. "replaced raw bg-purple-600
            // with ProviderButton") should not trip the lint.
            const stripped = src
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/\/\/[^\n]*/g, "");
            // Iterate every className occurrence and check it against
            // the regex. Done in JS rather than regex.test() over the
            // whole file so the error message can point at the
            // offending substring.
            const matches = stripped.match(
                new RegExp(COLOR_TAILWIND_REGEX, "g")
            );
            if (matches && matches.length > 0) {
                throw new Error(
                    `Exemplar widget ${relPath} contains hardcoded color ` +
                        `Tailwind classes — these MUST come from a dash-react ` +
                        `primitive that reads ThemeContext instead. Found: ` +
                        `${matches.slice(0, 5).join(", ")}` +
                        (matches.length > 5
                            ? `, … (${matches.length} total)`
                            : "")
                );
            }
        }
    });
});

describe("ACCEPTANCE_CHECKLIST", () => {
    test("has at least 10 concrete items — the user's bar is high", () => {
        expect(ACCEPTANCE_CHECKLIST.length).toBeGreaterThanOrEqual(10);
    });

    test("Phase 2 grew the checklist to at least 16 items (covering color rule + primitive enforcement)", () => {
        expect(ACCEPTANCE_CHECKLIST.length).toBeGreaterThanOrEqual(16);
    });

    test("mentions the no-hardcoded-color rule", () => {
        const joined = ACCEPTANCE_CHECKLIST.join(" ");
        expect(joined).toMatch(/Tailwind color/i);
        expect(joined).toMatch(/ThemeContext/);
    });

    test("mentions the no-raw-<button> rule", () => {
        const joined = ACCEPTANCE_CHECKLIST.join(" ");
        expect(joined).toMatch(/Button.*Button2/);
        expect(joined).toMatch(/raw.*<button|<button.*className/i);
    });

    test("mentions StatusBadge / Tag for status indicators", () => {
        const joined = ACCEPTANCE_CHECKLIST.join(" ");
        expect(joined).toMatch(/StatusBadge/);
        expect(joined).toMatch(/Tag/);
    });

    test("mentions EmptyState / Skeleton / Alert for empty/loading/error", () => {
        const joined = ACCEPTANCE_CHECKLIST.join(" ");
        expect(joined).toMatch(/EmptyState/);
        expect(joined).toMatch(/Skeleton/);
        expect(joined).toMatch(/Alert/);
    });
});

describe("ACCEPTANCE_CHECKLIST legacy items (re-pin from Phase A)", () => {
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
