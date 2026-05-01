/**
 * Pins the MCP examples + rules in the AI builder prompt to gate
 * tool calls on BOTH `isConnected` AND `tools.length > 0`.
 *
 * Bug it fixes: `useMcpProvider` exposes `isConnected` and `tools`
 * separately. There's a race where `isConnected` flips true before
 * the server's `tools` list arrives — a widget that gates only on
 * `isConnected` will fire `callTool(...)` against an empty registry,
 * which the MCP server can't resolve, and the widget renders an
 * error or a permanently-empty state instead of the actual data.
 *
 * Fix: every MCP example AND the rules section must teach the
 * combined gate. We assert on the source so future prompt edits
 * can't quietly drop it.
 */
const fs = require("fs");
const path = require("path");

describe("WidgetBuilderModal — MCP gate must include tools.length", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    test("rules section warns about the isConnected → tools race", () => {
        // Look for prose that explicitly tells the AI: connection
        // becomes ready before tools are populated. Tolerant phrasing
        // covers the various ways the warning can be worded.
        const lower = source.toLowerCase();
        const racePhrases = [
            /before\s+(?:the\s+)?(?:server'?s?\s+)?tools/,
            /tools\s+(?:aren't|are\s+not|not)\s+loaded/,
            /tools\s+(?:list|array|registry)\s+is\s+(?:loaded|empty|ready)/,
            /tools\s+(?:list|array|registry)\s+(?:is|aren't|isn't)/,
            /empty\s+(?:tool\s+)?registry/,
        ];
        const hit = racePhrases.some((re) => re.test(lower));
        expect(hit).toBe(true);
    });

    // The combined gate has two semantically equivalent forms via
    // De Morgan: positive `isConnected && tools.length > 0` and
    // negative `!isConnected || tools.length === 0`. Both are
    // acceptable evidence that the AI is being taught the gate.
    const COMBINED_GATE_POSITIVE = /isConnected\s*&&\s*tools\.length\s*>\s*0/;
    const COMBINED_GATE_NEGATIVE =
        /!\s*isConnected\s*\|\|\s*tools\.length\s*===?\s*0/;
    function hasCombinedGate(text) {
        return (
            COMBINED_GATE_POSITIVE.test(text) ||
            COMBINED_GATE_NEGATIVE.test(text)
        );
    }

    test("rules section requires the combined gate (isConnected AND tools.length)", () => {
        expect(hasCombinedGate(source)).toBe(true);
    });

    test("at least one MCP example uses the combined gate", () => {
        // Find each MCP example block — anchored on `useMcpProvider(...)`
        // and walking until the closing `}` of its component.
        const exampleBlocks = [];
        const re = /useMcpProvider\([^)]+\)[\s\S]*?\n\s*\}/g;
        let m;
        while ((m = re.exec(source)) !== null) {
            exampleBlocks.push(m[0]);
        }
        const anyHasCombined = exampleBlocks.some(hasCombinedGate);
        expect(anyHasCombined).toBe(true);
    });

    test("no example uses the bare `if (!isConnected) return;` early-bail", () => {
        // Detect the regression. A bare bail on isConnected alone
        // (no tools.length check on the same line or the next line)
        // is the bug. We allow `if (!isConnected || tools.length === 0)`
        // and similar combined forms.
        const bareBailRe = /if\s*\(\s*!\s*isConnected\s*\)/g;
        const matches = source.match(bareBailRe) || [];
        expect(matches.length).toBe(0);
    });
});
