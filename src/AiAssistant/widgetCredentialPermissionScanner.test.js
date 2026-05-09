/**
 * Static scanner for credentialed-API call sites in AI-generated
 * widget code (slice 17d.1). Returns the list of
 * `(window.)?mainApi.<provider>.<method>(...)` patterns the
 * widget calls — feeds the install-time permission modal.
 *
 * This is intentionally a regex-level pass, not a real AST. Same
 * trade-off as the existing widgetCodeValidator — widget files
 * are small, the patterns are syntactically narrow, and dynamic
 * property access (`mainApi.algolia[varName]`) is already
 * discouraged by other slices.
 */
const {
    scanCredentialMethodCalls,
    groupByProvider,
    findUngrantedCalls,
} = require("./widgetCredentialPermissionScanner");

describe("scanCredentialMethodCalls — extract provider method calls", () => {
    test("returns empty for empty / nullish input", () => {
        expect(scanCredentialMethodCalls("")).toEqual([]);
        expect(scanCredentialMethodCalls(null)).toEqual([]);
        expect(scanCredentialMethodCalls(undefined)).toEqual([]);
    });

    test("returns empty for code with no provider calls", () => {
        const code = `function W() { return <div>hello</div>; }`;
        expect(scanCredentialMethodCalls(code)).toEqual([]);
    });

    test("finds a single window.mainApi.<service>.<method>(...) call", () => {
        const code = `await window.mainApi.algolia.listIndices({});`;
        expect(scanCredentialMethodCalls(code)).toEqual([
            { service: "algolia", method: "listIndices", line: 1 },
        ]);
    });

    test("accepts the bare-mainApi style (no `window.` prefix)", () => {
        const code = `await mainApi.algolia.search({});`;
        expect(scanCredentialMethodCalls(code)).toEqual([
            { service: "algolia", method: "search", line: 1 },
        ]);
    });

    test("dedupes repeated calls to the same method (one entry per service.method)", () => {
        const code = `
            await window.mainApi.algolia.listIndices({});
            await window.mainApi.algolia.listIndices({ refresh: true });
            await window.mainApi.algolia.listIndices({});
        `;
        const result = scanCredentialMethodCalls(code);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            service: "algolia",
            method: "listIndices",
        });
    });

    test("captures multiple distinct methods on one provider", () => {
        const code = `
            await window.mainApi.algolia.listIndices({});
            await window.mainApi.algolia.search({ q: "x" });
            await window.mainApi.algolia.getRules({});
            await window.mainApi.algolia.deleteRule({});
        `;
        const result = scanCredentialMethodCalls(code);
        const methods = result.map((r) => r.method).sort();
        expect(methods).toEqual([
            "deleteRule",
            "getRules",
            "listIndices",
            "search",
        ]);
        expect(result.every((r) => r.service === "algolia")).toBe(true);
    });

    test("captures calls across multiple providers", () => {
        const code = `
            await window.mainApi.algolia.listIndices({});
            await window.mainApi.slack.postMessage({});
            await window.mainApi.gmail.send({});
        `;
        const result = scanCredentialMethodCalls(code);
        const services = new Set(result.map((r) => r.service));
        expect(services).toEqual(new Set(["algolia", "slack", "gmail"]));
    });

    test("reports a 1-based line number for the FIRST occurrence", () => {
        const code = [
            "// header comment",
            "function W() {",
            "    await window.mainApi.algolia.search({});",
            "    await window.mainApi.algolia.search({});",
            "}",
        ].join("\n");
        const result = scanCredentialMethodCalls(code);
        expect(result).toHaveLength(1);
        expect(result[0].line).toBe(3);
    });
});

describe("groupByProvider — pivot the call list for the modal UI", () => {
    test("groups methods under each service", () => {
        const calls = [
            { service: "algolia", method: "listIndices", line: 1 },
            { service: "algolia", method: "search", line: 2 },
            { service: "slack", method: "postMessage", line: 3 },
        ];
        const grouped = groupByProvider(calls);
        expect(grouped).toEqual({
            algolia: [
                { method: "listIndices", line: 1 },
                { method: "search", line: 2 },
            ],
            slack: [{ method: "postMessage", line: 3 }],
        });
    });

    test("returns {} for empty input", () => {
        expect(groupByProvider([])).toEqual({});
        expect(groupByProvider(null)).toEqual({});
    });
});

describe("findUngrantedCalls — diff against grants store", () => {
    const calls = [
        { service: "algolia", method: "listIndices", line: 1 },
        { service: "algolia", method: "deleteRule", line: 2 },
        { service: "slack", method: "postMessage", line: 3 },
    ];

    test("returns ALL calls when no grants exist", () => {
        expect(findUngrantedCalls(calls, {})).toEqual(calls);
        expect(findUngrantedCalls(calls, null)).toEqual(calls);
        expect(findUngrantedCalls(calls, undefined)).toEqual(calls);
    });

    test("returns only the not-yet-granted calls", () => {
        const grants = { algolia: { listIndices: true } };
        const result = findUngrantedCalls(calls, grants);
        expect(result.map((c) => c.method).sort()).toEqual([
            "deleteRule",
            "postMessage",
        ]);
    });

    test("treats explicit `false` as not-granted", () => {
        const grants = { algolia: { listIndices: false } };
        const result = findUngrantedCalls(calls, grants);
        expect(result.map((c) => c.method)).toContain("listIndices");
    });

    test("returns [] when every call is granted", () => {
        const grants = {
            algolia: { listIndices: true, deleteRule: true },
            slack: { postMessage: true },
        };
        expect(findUngrantedCalls(calls, grants)).toEqual([]);
    });

    test("returns [] for empty / non-array input", () => {
        expect(findUngrantedCalls(null, {})).toEqual([]);
        expect(findUngrantedCalls([], {})).toEqual([]);
    });
});
