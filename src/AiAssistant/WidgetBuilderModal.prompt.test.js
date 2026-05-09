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
        const block1 = source.slice(block1Start - 2500, block1End);

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
        const block1 = source.slice(block1Start - 2500, block1End);

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

/**
 * Pins the dash-react component API reference in the system prompt.
 *
 * Without these guards, the AI generates widgets that destructure dash-react
 * primitives (Heading, Button, EmptyState, …) and pass `text=` / `message=`
 * props that DO NOT EXIST on those components. The components silently
 * ignore the unknown props and render their empty defaults, producing a
 * widget tree with the right shape but zero visible content. From the
 * user's perspective, the preview is "black".
 *
 * Verified prop names (read from node_modules/@trops/dash-react/dist/index.js):
 *   Heading      -> title
 *   Button       -> title, onClick, disabled
 *   EmptyState   -> title, description, children (NOT message)
 *   Alert        -> title, message, children
 *
 * The prompt must teach these explicitly so generated widgets render.
 */
describe("WidgetBuilderModal system prompt — dash-react component API reference", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    // Specific verbatim anchor strings that the implementation must emit
    // into the prompt. Loose regexes were tried first and gave false
    // positives because the prompt body contains widget code examples
    // like `<Heading text={title} />` (the very pattern we're trying to
    // forbid) and unrelated mentions of "Heading" near "title". Anchor
    // strings remove that ambiguity.
    test("prompt names the dash-react component API reference section", () => {
        expect(source).toContain("DASH-REACT COMPONENT API");
    });

    // NOTE on regex: `NEVER` and the JSX example are separated in the
    // source by a backtick that's escaped for the surrounding template
    // literal (so source bytes contain `\` + `` ` ``). The regexes
    // tolerate an optional backslash there so the test reflects what
    // the AI actually sees in the rendered prompt, not the raw file.

    test("prompt teaches Heading uses `title` (not `text`)", () => {
        expect(source).toMatch(/`<Heading title=/);
        expect(source).toMatch(/NEVER\s\\?`<Heading text=/);
    });

    test("prompt teaches EmptyState uses `title` (not `message`)", () => {
        expect(source).toMatch(/`<EmptyState title=/);
        expect(source).toMatch(/NEVER\s\\?`<EmptyState message=/);
    });

    test("prompt teaches Button uses `title` (not `text`)", () => {
        expect(source).toMatch(/`<Button title=/);
        expect(source).toMatch(/NEVER\s\\?`<Button text=/);
    });
});

/**
 * Pins the inlined SKILL.md guidance + the explicit "do not invoke
 * the dash-widget-builder skill" rule in the modal prompt.
 *
 * Why this exists: the dash-widget-builder skill auto-loads in the
 * modal (description-match against the user's "build a widget"
 * intent), and once loaded triggers Bash/Read/Glob exploration.
 * Inlining the skill's curated content + telling the AI the skill
 * is already provided removes the duplication and the auto-load
 * trigger.
 */
describe("WidgetBuilderModal system prompt — inlined SKILL.md guidance", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    test("imports WIDGET_BUILDER_GUIDANCE from skillPromptContent", () => {
        expect(source).toMatch(
            /import\s*\{[^}]*WIDGET_BUILDER_GUIDANCE[^}]*\}\s*from\s*["']\.\/skillPromptContent["']/
        );
    });

    test("interpolates ${WIDGET_BUILDER_GUIDANCE} in all three prompt branches", () => {
        const occurrences =
            source.split("${WIDGET_BUILDER_GUIDANCE}").length - 1;
        expect(occurrences).toBe(3);
    });

    test("each branch tells the AI the skill is already provided (3 occurrences)", () => {
        // Stronger than the existing "Do NOT invoke the dash-widget-builder
        // skill" line — the new wording explicitly says the skill's
        // content is INLINED, so the AI doesn't reason "I should call
        // the skill to get widget-building knowledge."
        const re = /skill[^.]{0,120}(inlined|already (provided|included))/gi;
        const matches = source.match(re);
        expect(matches?.length || 0).toBeGreaterThanOrEqual(3);
    });
});

/**
 * Pins the per-call lockdown flags on the modal's ChatCore mount.
 *
 * Why these are required: prompt-level "do not invoke the skill"
 * rules were not enough — Claude Code's default system prompt
 * (kept active by `--append-system-prompt`) advertises the Skill
 * tool, and the AI invoked the dash-widget-builder skill anyway,
 * which then ran Bash/Read/Glob inside the modal where only text
 * + code-block output is wanted. The fix is at the CLI invocation
 * layer: replace the default system prompt entirely, and disable
 * every built-in tool.
 *
 * Both flags must be on the modal's ChatCore mount, and only on
 * that one — the AssistantPanel mount is unrelated and must keep
 * the legacy behavior.
 */
describe("WidgetBuilderModal — ChatCore lockdown flags", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    test("ChatCore mount sets replaceSystemPrompt={true}", () => {
        // Slice the ChatCore JSX block by anchoring on the opening
        // and closing of the mount. This avoids matching the prop
        // name in any unrelated comment.
        const open = source.indexOf("<ChatCore");
        expect(open).toBeGreaterThan(-1);
        const close = source.indexOf("/>", open);
        expect(close).toBeGreaterThan(open);
        const block = source.slice(open, close);
        expect(block).toMatch(/replaceSystemPrompt\s*=\s*\{true\}/);
    });

    test("ChatCore mount sets disableTools={true}", () => {
        const open = source.indexOf("<ChatCore");
        const close = source.indexOf("/>", open);
        const block = source.slice(open, close);
        expect(block).toMatch(/disableTools\s*=\s*\{true\}/);
    });
});

/**
 * Pins the provider-API registry injection (slice 17b.12).
 *
 * The focused branch of buildSystemPrompt must call
 * formatProviderApiSection(pickedType) so the AI sees the actual
 * list of available `window.mainApi.<service>.*` methods. Without
 * this, the AI hallucinates methods that don't exist (e.g.
 * algolia.getRules / saveRule / deleteRule), the widget compiles
 * but throws at runtime, and the rules-manager flow we hit during
 * testing fails silently with an empty index dropdown.
 */
describe("WidgetBuilderModal — provider API registry injection", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    test("imports formatProviderApiSection from providerApiRegistry", () => {
        expect(source).toMatch(
            /import\s*\{[^}]*formatProviderApiSection[^}]*\}\s*from\s*["']\.\/providerApiRegistry["']/
        );
    });

    test("imports validateProviderApiUsage + buildAiCorrectionMessage from widgetCodeValidator", () => {
        expect(source).toMatch(
            /import\s*\{[^}]*validateProviderApiUsage[^}]*\}\s*from\s*["']\.\/widgetCodeValidator["']/
        );
        expect(source).toContain("buildAiCorrectionMessage");
    });

    test("focused-branch prompt interpolates ${formatProviderApiSection(pickedType)}", () => {
        // The focused branch is unique in having `pickedType` in
        // scope. Anchoring on that combination locates the right
        // injection site.
        expect(source).toContain("${formatProviderApiSection(pickedType)}");
    });

    test("compile pipeline runs validateProviderApiUsage post-bundle", () => {
        // The validator is invoked inside the success branch of
        // compilePreview, gated by `apiCheck.ok`. We assert the
        // function is called somewhere in the modal source.
        expect(source).toContain("validateProviderApiUsage(");
    });

    test("validation failures set previewErrorMeta with kind 'provider-api-hallucination'", () => {
        expect(source).toContain("provider-api-hallucination");
    });

    test("Send-error-to-AI button uses buildAiCorrectionMessage's output when present", () => {
        // The existing button needs to send the validator's
        // structured correction (which names the bad methods + the
        // real ones) instead of a generic "fix this error" prompt.
        expect(source).toMatch(
            /previewErrorMeta\?\.correction[\s\S]{0,500}msgs\.push/
        );
    });
});

/**
 * Pins the single-purpose-widget rules + Modal/Dialog/Drawer
 * forbid (slice 17b.13).
 */
describe("WidgetBuilderModal — single-purpose widget rules", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    test("defines the SINGLE_PURPOSE_RULES constant", () => {
        expect(source).toMatch(/const SINGLE_PURPOSE_RULES\s*=/);
    });

    test("interpolates ${SINGLE_PURPOSE_RULES} in all three prompt branches", () => {
        const occurrences = source.split("${SINGLE_PURPOSE_RULES}").length - 1;
        expect(occurrences).toBe(3);
    });

    test("rules forbid Modal, Dialog, Drawer inside widgets", () => {
        // The constant body must explicitly call out all three tags.
        const constStart = source.indexOf("const SINGLE_PURPOSE_RULES");
        const constEnd = source.indexOf("`;", constStart);
        const body = source.slice(constStart, constEnd);
        expect(body).toMatch(/Modal/);
        expect(body).toMatch(/Dialog/);
        expect(body).toMatch(/Drawer/);
        // And explicitly say "no" / "forbid" / "NOT" near those tags.
        expect(body).toMatch(/NO\s+`?<Modal|forbidden|NOT/i);
    });

    test("rules teach inline-Card alternative", () => {
        const constStart = source.indexOf("const SINGLE_PURPOSE_RULES");
        const constEnd = source.indexOf("`;", constStart);
        const body = source.slice(constStart, constEnd);
        expect(body).toMatch(/INLINE/);
        expect(body).toMatch(/Card/);
    });

    test("rules teach cross-widget event coordination", () => {
        const constStart = source.indexOf("const SINGLE_PURPOSE_RULES");
        const constEnd = source.indexOf("`;", constStart);
        const body = source.slice(constStart, constEnd);
        expect(body).toMatch(/useWidgetEvents/);
    });

    test("imports validateNoModalUsage + buildNoModalCorrectionMessage", () => {
        expect(source).toContain("validateNoModalUsage");
        expect(source).toContain("buildNoModalCorrectionMessage");
    });

    test("compile pipeline runs validateNoModalUsage", () => {
        // Validator must be called inside the compilePreview success
        // branch so a Modal-using widget never mounts.
        expect(source).toMatch(/validateNoModalUsage\s*\(/);
    });

    test("validation failures set previewErrorMeta with kind 'modal-in-widget'", () => {
        expect(source).toContain("modal-in-widget");
    });
});

/**
 * Pins the iframe error-reporting wiring (slice 17c.4).
 *
 * The PreviewIframe component dispatches `bridge:error` payloads to
 * its `onError` callback. WidgetBuilderModal must route those into
 * the existing previewError UI so the user gets a friendly banner
 * (and the "Send error to AI" button works) for runtime errors
 * thrown inside the iframe — same UX as inline-preview render
 * errors caught by PreviewErrorBoundary.
 */
describe("WidgetBuilderModal — iframe error reporting (slice 17c.4)", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    test("defines a handleIframePreviewError callback", () => {
        expect(source).toMatch(
            /handleIframePreviewError\s*=\s*useCallback\s*\(/
        );
    });

    test("the callback sets previewError + previewErrorMeta", () => {
        // Slice the function body and confirm both setters are
        // called inside.
        const start = source.indexOf("handleIframePreviewError");
        expect(start).toBeGreaterThan(-1);
        const block = source.slice(start, start + 2000);
        expect(block).toContain("setPreviewError(");
        expect(block).toContain("setPreviewErrorMeta(");
    });

    test("the meta carries kind: 'iframe-error' and a correction message", () => {
        const start = source.indexOf("handleIframePreviewError");
        const block = source.slice(start, start + 2000);
        expect(block).toContain('kind: "iframe-error"');
        expect(block).toContain("correction:");
    });

    test("PreviewIframe mount passes onError={handleIframePreviewError}", () => {
        const open = source.indexOf("<PreviewIframe");
        expect(open).toBeGreaterThan(-1);
        const close = source.indexOf("/>", open);
        const block = source.slice(open, close);
        // Tolerate prettier's multi-line JSX expression formatting:
        //   onError={
        //       handleIframePreviewError
        //   }
        expect(block).toMatch(
            /onError\s*=\s*\{\s*handleIframePreviewError\s*\}/
        );
    });
});
