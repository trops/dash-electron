/**
 * Pins the credential-provider example in the WidgetBuilderModal system prompt
 * to the hooks-first ordering. Without this, the AI is taught to write:
 *
 *   if (!hasProvider("...")) return <Panel>...</Panel>;   // EARLY RETURN
 *   const pc = useProviderClient(provider);               // hook AFTER return
 *   useEffect(...);                                        // hook AFTER return
 *
 * which violates React's Rules of Hooks. When the user later picks a
 * provider and `hasProvider` flips false→true on a subsequent render,
 * React throws "Rendered more hooks than during the previous render"
 * and the entire app crashes — not the widget, the app, because Rules
 * of Hooks failures during a commit can escape error boundaries.
 *
 * The fix is in the prompt itself: BOTH credential examples must put
 * every hook (useState / useEffect / useProviderClient) ABOVE the
 * `if (!hasProvider(...))` early return. `useProviderClient(null)` and
 * `getProvider(missingType)` are both safe — they return null-shaped
 * handles. So the hooks can run unconditionally and the conditional
 * render goes at the bottom.
 *
 * Static source-presence test (no JSX/jsdom): reads the prompt as
 * text and asserts each credential example's hooks-first ordering.
 */
const fs = require("fs");
const path = require("path");

describe("WidgetBuilderModal system prompt — credential examples must be hooks-first", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    function findOrderedIndices(haystack, needle, fromIndex = 0) {
        return haystack.indexOf(needle, fromIndex);
    }

    test("first credential example: useProviderClient is called before the early return", () => {
        // Locate the first credential example block. It's identified by the
        // hasProvider check + EmptyState message that anchors the credential
        // pattern (the mcp example uses isConnected/Skeleton instead).
        const block1Start = source.indexOf(
            'if (!hasProvider("${pickedType}"))'
        );
        expect(block1Start).toBeGreaterThan(-1);

        // The example block ends at the closing fence of its jsx.
        const block1End = source.indexOf("```", block1Start);
        expect(block1End).toBeGreaterThan(block1Start);
        const block1 = source.slice(block1Start - 800, block1End);

        const useProviderClientPos = block1.indexOf(
            "useProviderClient(provider)"
        );
        const earlyReturnPos = block1.indexOf(
            'if (!hasProvider("${pickedType}"))'
        );

        expect(useProviderClientPos).toBeGreaterThan(-1);
        expect(earlyReturnPos).toBeGreaterThan(-1);
        // Hooks must come BEFORE the early return.
        expect(useProviderClientPos).toBeLessThan(earlyReturnPos);
    });

    test("first credential example: useEffect is called before the early return", () => {
        const block1Start = source.indexOf(
            'if (!hasProvider("${pickedType}"))'
        );
        const block1End = source.indexOf("```", block1Start);
        const block1 = source.slice(block1Start - 800, block1End);

        const useEffectPos = block1.indexOf("useEffect(");
        const earlyReturnPos = block1.indexOf(
            'if (!hasProvider("${pickedType}"))'
        );

        expect(useEffectPos).toBeGreaterThan(-1);
        expect(useEffectPos).toBeLessThan(earlyReturnPos);
    });

    test("second credential example: useProviderClient is called before the early return", () => {
        // The second copy is anchored by the literal "algolia" hasProvider
        // check (vs the templated ${pickedType} in the first copy).
        // Find the SECOND occurrence of useProviderClient(provider) and the
        // FIRST occurrence of the literal "algolia" hasProvider check, and
        // assert the hook comes first.
        const firstHookPos = source.indexOf("useProviderClient(provider)");
        const secondHookPos = source.indexOf(
            "useProviderClient(provider)",
            firstHookPos + 1
        );
        const earlyReturnPos = source.indexOf('if (!hasProvider("algolia"))');

        expect(secondHookPos).toBeGreaterThan(-1);
        expect(earlyReturnPos).toBeGreaterThan(-1);
        expect(secondHookPos).toBeLessThan(earlyReturnPos);
    });

    test("second credential example: useEffect is called before the early return", () => {
        // Find the useEffect that lives in the second example block — i.e.
        // the LAST useEffect before the literal "algolia" hasProvider check.
        const earlyReturnPos = source.indexOf('if (!hasProvider("algolia"))');
        const useEffectPos = source.lastIndexOf("useEffect(", earlyReturnPos);

        expect(useEffectPos).toBeGreaterThan(-1);
        expect(useEffectPos).toBeLessThan(earlyReturnPos);
    });

    test("widget-config-rules has an explicit Rules of Hooks callout", () => {
        // The prompt must explicitly tell the AI: hooks before any
        // conditional return. Otherwise it follows the example structurally
        // but might re-introduce the bug in novel shapes.
        const lower = source.toLowerCase();
        expect(lower).toMatch(/rules of hooks|all hooks|every hook/);
        expect(lower).toMatch(
            /(before|above)[^.]*?(if|conditional|early return|return)/
        );
    });
});
