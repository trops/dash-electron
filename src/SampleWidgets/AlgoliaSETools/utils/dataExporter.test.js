import {
    toCsv,
    toTsv,
    toJson,
    toNdjson,
    castValue,
    exportToFormat,
} from "./dataExporter";

// ===========================================================================
// castValue
// ===========================================================================

describe("castValue", () => {
    test("casts to number", () => {
        expect(castValue("42", "number")).toBe(42);
        expect(castValue("3.14", "number")).toBe(3.14);
        expect(castValue("not a number", "number")).toBe("not a number");
    });

    test("casts to boolean", () => {
        expect(castValue("true", "boolean")).toBe(true);
        expect(castValue("false", "boolean")).toBe(false);
        expect(castValue("1", "boolean")).toBe(true);
        expect(castValue("0", "boolean")).toBe(false);
        expect(castValue("yes", "boolean")).toBe(true);
        expect(castValue("no", "boolean")).toBe(false);
        expect(castValue("maybe", "boolean")).toBe("maybe");
    });

    test("auto-detects type", () => {
        expect(castValue("42", "auto")).toBe(42);
        expect(castValue("true", "auto")).toBe(true);
        expect(castValue("hello", "auto")).toBe("hello");
    });

    test("returns empty/null values as-is", () => {
        expect(castValue("", "number")).toBe("");
        expect(castValue(null, "number")).toBeNull();
    });

    test("default (string) returns value unchanged", () => {
        expect(castValue("42", "string")).toBe("42");
        expect(castValue("42", undefined)).toBe("42");
    });
});

// ===========================================================================
// toCsv
// ===========================================================================

describe("toCsv", () => {
    test("exports columns and rows", () => {
        const csv = toCsv(
            ["name", "age"],
            [
                { name: "Alice", age: "30" },
                { name: "Bob", age: "25" },
            ]
        );
        expect(csv).toBe("name,age\nAlice,30\nBob,25");
    });

    test("escapes values with commas", () => {
        const csv = toCsv(["desc"], [{ desc: "has, comma" }]);
        expect(csv).toBe('desc\n"has, comma"');
    });

    test("escapes values with quotes", () => {
        const csv = toCsv(["desc"], [{ desc: 'say "hi"' }]);
        expect(csv).toBe('desc\n"say ""hi"""');
    });
});

// ===========================================================================
// toTsv
// ===========================================================================

describe("toTsv", () => {
    test("exports tab-separated values", () => {
        const tsv = toTsv(["name", "age"], [{ name: "Alice", age: "30" }]);
        expect(tsv).toBe("name\tage\nAlice\t30");
    });
});

// ===========================================================================
// toJson
// ===========================================================================

describe("toJson", () => {
    test("exports JSON array with type casting", () => {
        const json = toJson(
            ["name", "age", "active"],
            [{ name: "Alice", age: "30", active: "true" }],
            { age: "number", active: "boolean" }
        );
        const parsed = JSON.parse(json);
        expect(parsed[0].name).toBe("Alice");
        expect(parsed[0].age).toBe(30);
        expect(parsed[0].active).toBe(true);
    });

    test("exports valid JSON without type map", () => {
        const json = toJson(["id"], [{ id: "1" }]);
        expect(JSON.parse(json)).toEqual([{ id: "1" }]);
    });
});

// ===========================================================================
// toNdjson
// ===========================================================================

describe("toNdjson", () => {
    test("exports one JSON object per line", () => {
        const ndjson = toNdjson(
            ["id", "name"],
            [
                { id: "1", name: "Alice" },
                { id: "2", name: "Bob" },
            ]
        );
        const lines = ndjson.split("\n");
        expect(lines).toHaveLength(2);
        expect(JSON.parse(lines[0])).toEqual({ id: "1", name: "Alice" });
        expect(JSON.parse(lines[1])).toEqual({ id: "2", name: "Bob" });
    });

    test("applies type casting", () => {
        const ndjson = toNdjson(["count"], [{ count: "5" }], {
            count: "number",
        });
        expect(JSON.parse(ndjson).count).toBe(5);
    });
});

// ===========================================================================
// exportToFormat
// ===========================================================================

describe("exportToFormat", () => {
    const cols = ["id", "name"];
    const data = [{ id: "1", name: "Alice" }];

    test("dispatches to csv", () => {
        expect(exportToFormat(cols, data, "csv")).toContain("id,name");
    });

    test("dispatches to tsv", () => {
        expect(exportToFormat(cols, data, "tsv")).toContain("id\tname");
    });

    test("dispatches to json", () => {
        const result = exportToFormat(cols, data, "json");
        expect(JSON.parse(result)).toEqual([{ id: "1", name: "Alice" }]);
    });

    test("dispatches to ndjson", () => {
        const result = exportToFormat(cols, data, "ndjson");
        expect(JSON.parse(result)).toEqual({ id: "1", name: "Alice" });
    });

    test("defaults to json for unknown format", () => {
        const result = exportToFormat(cols, data, "xml");
        expect(JSON.parse(result)).toEqual([{ id: "1", name: "Alice" }]);
    });
});
