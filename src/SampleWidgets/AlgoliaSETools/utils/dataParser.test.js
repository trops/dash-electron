import {
    detectFormat,
    parseDelimited,
    parseJson,
    parseNdjson,
    parseAny,
} from "./dataParser";

// ===========================================================================
// detectFormat
// ===========================================================================

describe("detectFormat", () => {
    test("detects JSON array", () => {
        expect(detectFormat('[{"id":"1"}]')).toBe("json");
    });

    test("detects JSON object", () => {
        expect(detectFormat('{"hits":[{"id":"1"}]}')).toBe("json");
    });

    test("detects NDJSON", () => {
        const ndjson = '{"id":"1"}\n{"id":"2"}\n{"id":"3"}';
        expect(detectFormat(ndjson)).toBe("ndjson");
    });

    test("detects CSV", () => {
        expect(detectFormat("name,age,city\nAlice,30,NYC")).toBe("csv");
    });

    test("detects TSV", () => {
        expect(detectFormat("name\tage\tcity\nAlice\t30\tNYC")).toBe("tsv");
    });

    test("returns unknown for empty input", () => {
        expect(detectFormat("")).toBe("unknown");
        expect(detectFormat(null)).toBe("unknown");
    });

    test("returns unknown for plain text", () => {
        expect(detectFormat("hello world")).toBe("unknown");
    });
});

// ===========================================================================
// parseDelimited
// ===========================================================================

describe("parseDelimited", () => {
    test("parses CSV with header row", () => {
        const csv = "name,age,city\nAlice,30,NYC\nBob,25,LA";
        const { columns, rows } = parseDelimited(csv, ",");
        expect(columns).toEqual(["name", "age", "city"]);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({ name: "Alice", age: "30", city: "NYC" });
        expect(rows[1]).toEqual({ name: "Bob", age: "25", city: "LA" });
    });

    test("parses TSV", () => {
        const tsv = "name\tage\nAlice\t30";
        const { columns, rows } = parseDelimited(tsv, "\t");
        expect(columns).toEqual(["name", "age"]);
        expect(rows[0]).toEqual({ name: "Alice", age: "30" });
    });

    test("handles quoted CSV fields with commas", () => {
        const csv = 'name,description\nAlice,"Has a, comma"\nBob,Normal';
        const { rows } = parseDelimited(csv, ",");
        expect(rows[0].description).toBe("Has a, comma");
    });

    test("handles escaped quotes in CSV", () => {
        const csv = 'name,quote\nAlice,"She said ""hello"""\nBob,world';
        const { rows } = parseDelimited(csv, ",");
        expect(rows[0].quote).toBe('She said "hello"');
    });

    test("returns empty for empty input", () => {
        const { columns, rows } = parseDelimited("", ",");
        expect(columns).toEqual([]);
        expect(rows).toEqual([]);
    });

    test("handles rows with fewer columns than header", () => {
        const csv = "a,b,c\n1,2\n4,5,6";
        const { rows } = parseDelimited(csv, ",");
        expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
    });
});

// ===========================================================================
// parseJson
// ===========================================================================

describe("parseJson", () => {
    test("parses JSON array of objects", () => {
        const json = '[{"id":"1","name":"Alice"},{"id":"2","name":"Bob"}]';
        const { columns, rows } = parseJson(json);
        expect(columns).toContain("id");
        expect(columns).toContain("name");
        expect(rows).toHaveLength(2);
        expect(rows[0].name).toBe("Alice");
    });

    test("parses wrapped JSON (hits key)", () => {
        const json = '{"hits":[{"id":"1"}],"total":1}';
        const { columns, rows } = parseJson(json);
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe("1");
    });

    test("parses single object as one row", () => {
        const json = '{"id":"1","name":"Alice"}';
        const { rows } = parseJson(json);
        expect(rows).toHaveLength(1);
    });

    test("collects columns from all objects (sparse data)", () => {
        const json = '[{"a":"1"},{"b":"2"},{"a":"3","c":"4"}]';
        const { columns } = parseJson(json);
        expect(columns).toContain("a");
        expect(columns).toContain("b");
        expect(columns).toContain("c");
    });

    test("stringifies nested objects", () => {
        const json = '[{"id":"1","meta":{"key":"val"}}]';
        const { rows } = parseJson(json);
        expect(rows[0].meta).toBe('{"key":"val"}');
    });
});

// ===========================================================================
// parseNdjson
// ===========================================================================

describe("parseNdjson", () => {
    test("parses NDJSON lines", () => {
        const ndjson = '{"id":"1","name":"Alice"}\n{"id":"2","name":"Bob"}';
        const { columns, rows } = parseNdjson(ndjson);
        expect(columns).toContain("id");
        expect(rows).toHaveLength(2);
        expect(rows[1].name).toBe("Bob");
    });

    test("handles sparse NDJSON", () => {
        const ndjson = '{"a":"1"}\n{"b":"2"}';
        const { columns } = parseNdjson(ndjson);
        expect(columns).toContain("a");
        expect(columns).toContain("b");
    });
});

// ===========================================================================
// parseAny
// ===========================================================================

describe("parseAny", () => {
    test("auto-detects and parses CSV", () => {
        const { format, columns, rows } = parseAny("x,y\n1,2\n3,4");
        expect(format).toBe("csv");
        expect(columns).toEqual(["x", "y"]);
        expect(rows).toHaveLength(2);
    });

    test("auto-detects and parses JSON", () => {
        const { format, rows } = parseAny('[{"id":"1"}]');
        expect(format).toBe("json");
        expect(rows).toHaveLength(1);
    });

    test("returns empty for unknown format", () => {
        const { format, columns, rows } = parseAny("just some text");
        expect(format).toBe("unknown");
        expect(columns).toEqual([]);
        expect(rows).toEqual([]);
    });
});
