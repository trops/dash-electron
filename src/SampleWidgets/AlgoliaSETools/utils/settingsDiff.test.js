import { diffSettings, displayValue, isEqual } from "./settingsDiff";

describe("isEqual", () => {
    test("primitives", () => {
        expect(isEqual(1, 1)).toBe(true);
        expect(isEqual("a", "a")).toBe(true);
        expect(isEqual(1, 2)).toBe(false);
    });

    test("null/undefined", () => {
        expect(isEqual(null, null)).toBe(true);
        expect(isEqual(null, undefined)).toBe(true);
        expect(isEqual(null, "a")).toBe(false);
    });

    test("arrays", () => {
        expect(isEqual(["a", "b"], ["a", "b"])).toBe(true);
        expect(isEqual(["a", "b"], ["a", "c"])).toBe(false);
        expect(isEqual([], [])).toBe(true);
    });

    test("objects", () => {
        expect(isEqual({ a: 1 }, { a: 1 })).toBe(true);
        expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
});

describe("displayValue", () => {
    test("formats arrays", () => {
        expect(displayValue(["a", "b"])).toBe("a, b");
        expect(displayValue([])).toBe("(empty array)");
    });

    test("formats null/undefined", () => {
        expect(displayValue(null)).toBe("(not set)");
        expect(displayValue(undefined)).toBe("(not set)");
    });

    test("formats primitives", () => {
        expect(displayValue(true)).toBe("true");
        expect(displayValue(42)).toBe("42");
    });
});

describe("diffSettings", () => {
    test("identical settings produce no diffs", () => {
        const settings = {
            searchableAttributes: ["title"],
            customRanking: ["desc(pop)"],
        };
        const result = diffSettings(settings, settings);
        expect(result.diffs).toHaveLength(0);
        expect(result.summary.differences).toBe(0);
        expect(result.identical.length).toBeGreaterThan(0);
    });

    test("different searchableAttributes detected", () => {
        const a = { searchableAttributes: ["title"] };
        const b = { searchableAttributes: ["title", "description"] };
        const result = diffSettings(a, b);
        const diff = result.diffs.find((d) => d.key === "searchableAttributes");
        expect(diff).toBeTruthy();
        expect(diff.valueA).toBe("title");
        expect(diff.valueB).toBe("title, description");
    });

    test("null vs defined produces diff", () => {
        const a = {};
        const b = { customRanking: ["desc(pop)"] };
        const result = diffSettings(a, b);
        const diff = result.diffs.find((d) => d.key === "customRanking");
        expect(diff).toBeTruthy();
        expect(diff.valueA).toBe("(not set)");
    });

    test("handles null inputs", () => {
        const result = diffSettings(null, null);
        expect(result.diffs).toHaveLength(0);
        expect(result.summary.totalChecked).toBeGreaterThan(0);
    });

    test("extra keys outside DIFF_KEYS detected", () => {
        const a = { someCustomSetting: true };
        const b = { someCustomSetting: false };
        const result = diffSettings(a, b);
        expect(result.extraDiffs.length).toBeGreaterThan(0);
        expect(result.extraDiffs[0].key).toBe("someCustomSetting");
    });

    test("summary counts are correct", () => {
        const a = {
            searchableAttributes: ["title"],
            hitsPerPage: 20,
        };
        const b = {
            searchableAttributes: ["title", "body"],
            hitsPerPage: 20,
        };
        const result = diffSettings(a, b);
        expect(result.summary.differences).toBe(result.diffs.length);
        expect(result.summary.identicalCount).toBe(result.identical.length);
        expect(result.summary.differences + result.summary.identicalCount).toBe(
            result.summary.totalChecked
        );
    });

    test("boolean differences detected", () => {
        const a = { typoTolerance: true };
        const b = { typoTolerance: false };
        const result = diffSettings(a, b);
        const diff = result.diffs.find((d) => d.key === "typoTolerance");
        expect(diff).toBeTruthy();
    });
});
