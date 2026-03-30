import {
    unwrapResponse,
    safeParse,
    extractJsonFromText,
    isMcpError,
    parseMcpResponse,
    parseGongTextEntries,
    parseMarkdownTable,
    parseDuration,
} from "./mcpUtils";

// ===========================================================================
// unwrapResponse
// ===========================================================================

describe("unwrapResponse", () => {
    test("returns null/undefined as-is", () => {
        expect(unwrapResponse(null)).toBeNull();
        expect(unwrapResponse(undefined)).toBeUndefined();
    });

    test("returns strings as-is", () => {
        expect(unwrapResponse("hello")).toBe("hello");
    });

    test("unwraps standard MCP content blocks", () => {
        const res = {
            content: [
                { type: "text", text: "line one" },
                { type: "text", text: "line two" },
            ],
        };
        expect(unwrapResponse(res)).toBe("line one\nline two");
    });

    test("unwraps single content block", () => {
        const res = { type: "text", text: "single" };
        expect(unwrapResponse(res)).toBe("single");
    });

    test("unwraps { result: <inner> } wrapper", () => {
        const res = { result: { calls: [{ id: "1" }] } };
        const inner = unwrapResponse(res);
        expect(inner).toEqual({ calls: [{ id: "1" }] });
    });

    test("returns arrays as-is", () => {
        const arr = [{ id: "1" }];
        expect(unwrapResponse(arr)).toBe(arr);
    });

    test("returns objects without special keys as-is", () => {
        const obj = { calls: [{ id: "1" }] };
        expect(unwrapResponse(obj)).toBe(obj);
    });
});

// ===========================================================================
// safeParse
// ===========================================================================

describe("safeParse", () => {
    test("parses valid JSON strings", () => {
        expect(safeParse('[{"id":"1"}]')).toEqual([{ id: "1" }]);
    });

    test("returns non-strings as-is", () => {
        const obj = { id: "1" };
        expect(safeParse(obj)).toBe(obj);
    });

    test("returns invalid JSON strings as-is", () => {
        expect(safeParse("not json")).toBe("not json");
    });
});

// ===========================================================================
// extractJsonFromText
// ===========================================================================

describe("extractJsonFromText", () => {
    test("extracts JSON array from text", () => {
        const text = 'Some preamble [{"id":"1"},{"id":"2"}]';
        expect(extractJsonFromText(text)).toEqual([{ id: "1" }, { id: "2" }]);
    });

    test("extracts JSON object from text", () => {
        const text = 'Result: {"calls":[{"id":"1"}]}';
        expect(extractJsonFromText(text)).toEqual({ calls: [{ id: "1" }] });
    });

    test("returns null for non-strings", () => {
        expect(extractJsonFromText(42)).toBeNull();
    });

    test("returns null for text without JSON", () => {
        expect(extractJsonFromText("no json here")).toBeNull();
    });
});

// ===========================================================================
// isMcpError
// ===========================================================================

describe("isMcpError", () => {
    test("detects isError flag", () => {
        expect(isMcpError({ isError: true }, "something failed")).toBe(
            "something failed"
        );
    });

    test("detects error strings", () => {
        expect(isMcpError({}, "Error: timeout")).toBe("Error: timeout");
    });

    test("detects { ok: false, error } objects", () => {
        expect(isMcpError({}, { ok: false, error: "bad request" })).toBe(
            "bad request"
        );
    });

    test("returns null for non-errors", () => {
        expect(isMcpError({}, [{ id: "1" }])).toBeNull();
        expect(isMcpError({}, { ok: true })).toBeNull();
        expect(isMcpError({}, "success")).toBeNull();
    });
});

// ===========================================================================
// parseDuration
// ===========================================================================

describe("parseDuration", () => {
    test("parses minutes", () => {
        expect(parseDuration("30m")).toBe(1800);
        expect(parseDuration("64m")).toBe(3840);
    });

    test("parses hours", () => {
        expect(parseDuration("2h")).toBe(7200);
    });

    test("parses hours and minutes", () => {
        expect(parseDuration("1h 4m")).toBe(3840);
        expect(parseDuration("2h 30m")).toBe(9000);
    });

    test("returns null for empty/falsy", () => {
        expect(parseDuration("")).toBeNull();
        expect(parseDuration(null)).toBeNull();
        expect(parseDuration(undefined)).toBeNull();
    });

    test("returns null for unrecognised format", () => {
        expect(parseDuration("abc")).toBeNull();
    });
});

// ===========================================================================
// parseMarkdownTable
// ===========================================================================

describe("parseMarkdownTable", () => {
    const STANDARD_TABLE = [
        "| ID | Title | Date | Duration | Scope |",
        "|---|---|---|---|---|",
        "| call-1 | Q4 Strategy Review | 3/24/2026 | 64m | External |",
        "| call-2 | Sprint Retro | 3/25/2026 | 30m | Internal |",
    ].join("\n");

    test("parses standard markdown table", () => {
        const result = parseMarkdownTable(STANDARD_TABLE);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            id: "call-1",
            title: "Q4 Strategy Review",
            started: "3/24/2026",
            duration: 3840,
            scope: "External",
            parties: [],
        });
        expect(result[1]).toEqual({
            id: "call-2",
            title: "Sprint Retro",
            started: "3/25/2026",
            duration: 1800,
            scope: "Internal",
            parties: [],
        });
    });

    test("handles case-insensitive column headers", () => {
        const table = [
            "| id | TITLE | DATE | duration | SCOPE |",
            "|---|---|---|---|---|",
            "| x1 | Test Call | 1/1/2026 | 10m | Internal |",
        ].join("\n");
        const result = parseMarkdownTable(table);
        expect(result[0].id).toBe("x1");
        expect(result[0].title).toBe("Test Call");
    });

    test("handles alternative column names (callid, name, started)", () => {
        const table = [
            "| CallID | Name | Started | Duration | Scope |",
            "|---|---|---|---|---|",
            "| c99 | Alt Call | 2026-01-01 | 1h 4m | External |",
        ].join("\n");
        const result = parseMarkdownTable(table);
        expect(result[0].id).toBe("c99");
        expect(result[0].title).toBe("Alt Call");
        expect(result[0].started).toBe("2026-01-01");
        expect(result[0].duration).toBe(3840);
    });

    test("returns null for non-table text", () => {
        expect(parseMarkdownTable("no table here")).toBeNull();
    });

    test("returns null for empty table (header only)", () => {
        const table = ["| ID | Title |", "|---|---|"].join("\n");
        expect(parseMarkdownTable(table)).toBeNull();
    });

    test("handles rows with missing cells gracefully", () => {
        const table = [
            "| ID | Title | Date | Duration | Scope |",
            "|---|---|---|---|---|",
            "| c1 | Only Title |",
        ].join("\n");
        const result = parseMarkdownTable(table);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("c1");
        expect(result[0].title).toBe("Only Title");
        expect(result[0].started).toBe("");
        expect(result[0].duration).toBeNull();
    });
});

// ===========================================================================
// parseGongTextEntries
// ===========================================================================

describe("parseGongTextEntries", () => {
    test("parses markdown table format", () => {
        const text = [
            "| ID | Title | Date | Duration | Scope |",
            "|---|---|---|---|---|",
            "| 123 | Q4 Review | 3/24/2026 | 30m | External |",
        ].join("\n");
        const result = parseGongTextEntries(text);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("123");
    });

    test("parses numbered list format", () => {
        const text = "1. Sprint Planning (2026-03-01) - ID: abc123";
        const result = parseGongTextEntries(text);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Sprint Planning");
        expect(result[0].date).toBe("2026-03-01");
        expect(result[0].id).toBe("abc123");
    });

    test("returns null for non-string input", () => {
        expect(parseGongTextEntries(42)).toBeNull();
        expect(parseGongTextEntries(null)).toBeNull();
    });

    test("returns null for unrecognised text", () => {
        expect(parseGongTextEntries("nothing useful here")).toBeNull();
    });
});

// ===========================================================================
// parseMcpResponse — full pipeline
// ===========================================================================

describe("parseMcpResponse", () => {
    test("parses standard MCP content with JSON array", () => {
        const res = {
            content: [
                {
                    type: "text",
                    text: JSON.stringify([
                        { id: "1", title: "Call A" },
                        { id: "2", title: "Call B" },
                    ]),
                },
            ],
        };
        const { data, error } = parseMcpResponse(res, {
            arrayKeys: ["calls"],
        });
        expect(error).toBeNull();
        expect(data).toHaveLength(2);
        expect(data[0].id).toBe("1");
    });

    test("parses MCP content with markdown table via textParser", () => {
        const tableText = [
            "| ID | Title | Date | Duration | Scope |",
            "|---|---|---|---|---|",
            "| c1 | Strategy | 3/24/2026 | 64m | External |",
        ].join("\n");
        const res = { content: [{ type: "text", text: tableText }] };
        const { data, error } = parseMcpResponse(res, {
            arrayKeys: ["calls", "records"],
            textParser: parseGongTextEntries,
        });
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].id).toBe("c1");
        expect(data[0].title).toBe("Strategy");
        expect(data[0].duration).toBe(3840);
    });

    test("parses direct array response", () => {
        const res = [{ id: "1" }, { id: "2" }];
        const { data, error } = parseMcpResponse(res);
        expect(error).toBeNull();
        expect(data).toHaveLength(2);
    });

    test("parses object with calls key", () => {
        const res = { calls: [{ id: "1" }], total: 1 };
        const { data, error } = parseMcpResponse(res, {
            arrayKeys: ["calls"],
        });
        expect(error).toBeNull();
        expect(data).toEqual([{ id: "1" }]);
    });

    test("detects error response", () => {
        const res = {
            isError: true,
            content: [{ type: "text", text: "Unauthorized" }],
        };
        const { data, error } = parseMcpResponse(res);
        expect(error).toBeTruthy();
        expect(data).toBeNull();
    });

    test("provides raw string for debug display", () => {
        const res = { content: [{ type: "text", text: "hello" }] };
        const { raw } = parseMcpResponse(res);
        expect(typeof raw).toBe("string");
        expect(raw.length).toBeGreaterThan(0);
    });

    test("handles null response gracefully", () => {
        const { data, error } = parseMcpResponse(null);
        expect(data).toBeNull();
        expect(error).toBeNull();
    });
});
