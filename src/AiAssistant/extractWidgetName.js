/**
 * extractWidgetName — the widget component's name from the AI's component
 * source, which the builder needs before it can compile a preview.
 *
 * Common export styles:
 *   export default function WidgetName
 *   export const WidgetName = (
 *   export function WidgetName(
 *   function WidgetName … export default WidgetName       (with or without ;)
 *   function WidgetName … export { WidgetName as default }
 *
 * null when none match — the builder then reports a build error the AI can
 * fix, instead of silently not compiling (phase 2d).
 */
export function extractWidgetName(code) {
    if (!code) return null;
    const patterns = [
        /export\s+default\s+function\s+(\w+)/,
        /export\s+(?:const|let|var)\s+(\w+)\s*=/,
        /export\s+function\s+(\w+)/,
        /export\s+default\s+(\w+)\s*(?:;|$)/m,
        /export\s*\{\s*(\w+)\s+as\s+default\s*\}/,
    ];
    for (const re of patterns) {
        const match = code.match(re);
        if (match) return match[1];
    }
    return null;
}
