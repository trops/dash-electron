/**
 * Pins for the Slack MCP response parser.
 *
 * slack-mcp-server (korotovsky) returns most list/read tools as CSV
 * inside the MCP `content[0].text` payload — no env knob switches that
 * to JSON. The parser has to detect CSV, parse it (handling quoted
 * cells with commas), and normalize the all-caps Go field names
 * (`ID,Name,Topic,Purpose,MemberCount,Cursor`) to lowercase-first
 * keys so widget code that reads `.id` / `.name` keeps working.
 *
 * The JSON regression cases prove the existing path still fires when
 * a server (or a manual fixture) speaks JSON — we did NOT replace the
 * JSON path, only added a CSV fallback for the case where JSON.parse
 * fails.
 */
const {
    parseMcpResponse,
    parseCsvLine,
    normalizeCsvKey,
    csvToObjects,
    looksLikeCsv,
} = require("./mcpUtils");

// Real fixture captured via direct stdio probe of slack-mcp-server
// v1.3.0 against the user's Slack workspace. Includes a quoted Purpose
// cell with embedded commas — the most fragile CSV case.
const CHANNELS_LIST_CSV =
    "ID,Name,Topic,Purpose,MemberCount,Cursor\n" +
    "C0AGCHX3ME2,#3dprint-ideas,,,3,\n" +
    'C0AG43RV3S7,#project-ideas,,"Write Code Project ideas in this channel. Claude will check this channel each morning, create a detailed spec/outline, and await my approval. Once I approve by replying to the thread, Claude will generate the Jira board, and begin adding Todo issues.",2,\n' +
    'C03H9MLDM,#random,,"A place for non-work banter, links, articles of interest, humor or anything else which you\'d like concentrated in some place other than work-related channels.",1,\n';

function wrapMcpText(text) {
    return { content: [{ type: "text", text }] };
}

describe("normalizeCsvKey", () => {
    test("all-caps keys go fully lowercase", () => {
        expect(normalizeCsvKey("ID")).toBe("id");
        expect(normalizeCsvKey("URL")).toBe("url");
    });

    test("mixed-case keys lowercase only the first character", () => {
        expect(normalizeCsvKey("Name")).toBe("name");
        expect(normalizeCsvKey("MemberCount")).toBe("memberCount");
        expect(normalizeCsvKey("ThreadTs")).toBe("threadTs");
    });

    test("already-lowercase keys are unchanged", () => {
        expect(normalizeCsvKey("text")).toBe("text");
    });
});

describe("parseCsvLine", () => {
    test("plain comma split", () => {
        expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
    });

    test("respects quoted cells with embedded commas", () => {
        expect(parseCsvLine('a,"b, with comma",c')).toEqual([
            "a",
            "b, with comma",
            "c",
        ]);
    });

    test("handles escaped double-quotes inside quoted cells", () => {
        expect(parseCsvLine('a,"he said ""hi""",b')).toEqual([
            "a",
            'he said "hi"',
            "b",
        ]);
    });

    test("trailing empty cell preserved", () => {
        expect(parseCsvLine("a,b,")).toEqual(["a", "b", ""]);
    });
});

describe("looksLikeCsv", () => {
    test("detects slack channels header", () => {
        expect(looksLikeCsv(CHANNELS_LIST_CSV)).toBe(true);
    });

    test("rejects single-line text without newline", () => {
        expect(looksLikeCsv("ID,Name,Topic")).toBe(false);
    });

    test("rejects prose containing commas", () => {
        expect(
            looksLikeCsv(
                "Hello, world\nthis is just text, not CSV with headers."
            )
        ).toBe(false);
    });

    test("rejects JSON arrays", () => {
        expect(looksLikeCsv('[{"id":"X"}]')).toBe(false);
    });

    test("rejects empty strings", () => {
        expect(looksLikeCsv("")).toBe(false);
    });
});

describe("csvToObjects", () => {
    test("parses the real channels CSV fixture", () => {
        const rows = csvToObjects(CHANNELS_LIST_CSV);
        expect(rows).toHaveLength(3);
        expect(rows[0]).toEqual({
            id: "C0AGCHX3ME2",
            name: "3dprint-ideas",
            topic: "",
            purpose: "",
            memberCount: "3",
            cursor: "",
        });
    });

    test("strips leading # from channel names", () => {
        // Server returns `#channel-name`. Widgets render `#${ch.name}`,
        // so leaving the `#` in produces `##channel-name`.
        const rows = csvToObjects(CHANNELS_LIST_CSV);
        expect(rows.map((r) => r.name)).toEqual([
            "3dprint-ideas",
            "project-ideas",
            "random",
        ]);
    });

    test("handles quoted cells with embedded commas correctly", () => {
        const rows = csvToObjects(CHANNELS_LIST_CSV);
        // The quoted Purpose for #project-ideas contains multiple
        // commas — easy to break if quoting isn't honored.
        expect(rows[1].purpose).toContain(
            "Write Code Project ideas in this channel"
        );
        expect(rows[1].purpose).toContain("await my approval");
        expect(rows[1].memberCount).toBe("2");
    });

    test("empty input → empty array", () => {
        expect(csvToObjects("")).toEqual([]);
    });

    test("header-only input → empty array", () => {
        expect(csvToObjects("ID,Name,Topic")).toEqual([]);
    });
});

describe("parseMcpResponse — CSV path", () => {
    test("CSV inside MCP content → array of normalized objects", () => {
        const { data, error } = parseMcpResponse(
            wrapMcpText(CHANNELS_LIST_CSV)
        );
        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(3);
        expect(data[0].id).toBe("C0AGCHX3ME2");
        expect(data[0].name).toBe("3dprint-ideas");
    });

    test("CSV path ignores arrayKeys (CSV has no wrapper object)", () => {
        // Widget code passes { arrayKeys: ["channels"] } expecting JSON.
        // Against CSV that key doesn't exist; parser should still
        // return the row array directly rather than dropping data.
        const { data } = parseMcpResponse(wrapMcpText(CHANNELS_LIST_CSV), {
            arrayKeys: ["channels"],
        });
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(3);
    });
});

describe("parseMcpResponse — JSON regression (existing path must keep working)", () => {
    test("JSON array passes through", () => {
        const { data } = parseMcpResponse(
            wrapMcpText('[{"id":"X","name":"general"}]')
        );
        expect(data).toEqual([{ id: "X", name: "general" }]);
    });

    test("JSON object with arrayKeys still resolves", () => {
        const { data } = parseMcpResponse(
            wrapMcpText('{"channels":[{"id":"X"}]}'),
            { arrayKeys: ["channels"] }
        );
        expect(data).toEqual([{ id: "X" }]);
    });

    test("MCP error surfaces", () => {
        const { data, error } = parseMcpResponse({
            isError: true,
            content: [{ type: "text", text: "not_authed" }],
        });
        expect(data).toBeNull();
        expect(error).toBe("not_authed");
    });
});
