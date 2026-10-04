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
        // The element's props span many lines (and contain nested JSX
        // like arrow functions), so search a window after the tag.
        const block = source.slice(open, open + 8000);
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

    test("imports validateProviderApiUsage + buildAiCorrectionMessage from widgetCodeValidator", () => {
        expect(source).toMatch(
            /import\s*\{[^}]*validateProviderApiUsage[^}]*\}\s*from\s*["']\.\/widgetCodeValidator["']/
        );
        expect(source).toContain("buildAiCorrectionMessage");
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
        // It sends through ChatCore (dash:chat-core-send), not by
        // writing localStorage — ChatCore only reads that at mount.
        expect(source).toMatch(
            /previewErrorMeta\?\.correction\s*\?\s*previewErrorMeta\.correction[\s\S]{0,800}"dash:chat-core-send"/
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
        const open = source.indexOf("<PreviewIframe\n");
        expect(open).toBeGreaterThan(-1);
        // The element's props span many lines (and contain nested JSX
        // like arrow functions), so search a window after the tag.
        const block = source.slice(open, open + 8000);
        // Tolerate prettier's multi-line JSX expression formatting:
        //   onError={
        //       handleIframePreviewError
        //   }
        expect(block).toMatch(
            /onError\s*=\s*\{\s*handleIframePreviewError\s*\}/
        );
    });
});

/**
 * Pins the iframe render-stats wiring (slice 17c.5).
 *
 * The iframe shell measures its own DOM after each render commit
 * (host can't query iframe content via previewWrapperRef in
 * cross-document mode) and posts `bridge:render-stats`. The host
 * uses these to drive the existing `previewLooksEmpty` banner.
 */
describe("WidgetBuilderModal — iframe render stats (slice 17c.5)", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    test("defines a handleIframeRenderStats callback", () => {
        expect(source).toMatch(
            /handleIframeRenderStats\s*=\s*useCallback\s*\(/
        );
    });

    test("the callback flips previewLooksEmpty based on text + child count", () => {
        const start = source.indexOf("handleIframeRenderStats");
        expect(start).toBeGreaterThan(-1);
        const block = source.slice(start, start + 1500);
        expect(block).toContain("setPreviewLooksEmpty");
        expect(block).toMatch(/textLength\s*===\s*0/);
        expect(block).toMatch(/childCount\s*<=?\s*1/);
    });

    test("PreviewIframe mount passes onRenderStats={handleIframeRenderStats}", () => {
        const open = source.indexOf("<PreviewIframe\n");
        // The element's props span many lines (and contain nested JSX
        // like arrow functions), so search a window after the tag.
        const block = source.slice(open, open + 8000);
        expect(block).toMatch(
            /onRenderStats\s*=\s*\{\s*handleIframeRenderStats\s*\}/
        );
    });
});
