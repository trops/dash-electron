import { extractWidgetName } from "./extractWidgetName";

describe("extractWidgetName", () => {
    test.each([
        ["export default function Counter() {}", "Counter"],
        ["export const Counter = () => null;", "Counter"],
        ["export function Counter() {}", "Counter"],
        ["function Counter() {}\nexport default Counter;", "Counter"],
        // Missed before 2d — the build silently never compiled.
        ["function Counter() {}\nexport default Counter", "Counter"],
        ["function Counter() {}\nexport default Counter\n", "Counter"],
        ["function Counter() {}\nexport { Counter as default };", "Counter"],
    ])("%j → %s", (code, name) => {
        expect(extractWidgetName(code)).toBe(name);
    });

    test("nothing to go on → null", () => {
        expect(extractWidgetName("")).toBeNull();
        expect(extractWidgetName(null)).toBeNull();
        expect(extractWidgetName("export default () => null;")).toBeNull();
    });

    test("doesn't take a word from the middle of a line", () => {
        expect(
            extractWidgetName(
                "// we export default Counter later\nconst x = 1;"
            )
        ).toBeNull();
    });
});
