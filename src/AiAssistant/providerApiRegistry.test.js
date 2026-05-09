/**
 * Drift detector for providerApiRegistry.
 *
 * Parses public/preload.js and asserts:
 *   1. every method in PROVIDER_API_REGISTRY[service] also appears
 *      in the preload's `<service>: { ... }` block (no fictional
 *      entries — the registry can't tell the AI about methods that
 *      don't exist)
 *   2. every preload method appears in the registry (no missing
 *      entries — anything reachable from the renderer must be
 *      documented or explicitly excluded)
 *
 * If preload changes, this test fails. The fix is to update the
 * registry to match — never to weaken the test. The whole point
 * of the registry is "what's actually exposed."
 */
const fs = require("fs");
const path = require("path");
const { PROVIDER_API_REGISTRY } = require("./providerApiRegistry");

const preloadPath = path.join(__dirname, "..", "..", "public", "preload.js");
const preloadSource = fs.readFileSync(preloadPath, "utf8");

/**
 * Pull the body of a top-level `<key>: { ... }` block out of
 * preload.js. Naive bracket-counting walk — preload doesn't have
 * embedded template literals or strings with stray braces in the
 * relevant blocks, so a bare counter is robust enough.
 */
function extractObjectBlock(source, key) {
    const re = new RegExp(`\\b${key}\\s*:\\s*\\{`);
    const m = source.match(re);
    if (!m) return null;
    const start = m.index + m[0].length - 1; // position of opening `{`
    let depth = 0;
    for (let i = start; i < source.length; i++) {
        const ch = source[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) return source.slice(start + 1, i);
        }
    }
    return null;
}

/**
 * Get the method names defined in a preload-style `<service>: { ... }`
 * block. Looks for arrow-function definitions like
 * `methodName: (msg) => ...`.
 */
function methodsDefinedDirectly(blockBody) {
    const names = [];
    const matches = blockBody.matchAll(/(\w+)\s*:\s*\([^)]*\)\s*=>/g);
    for (const m of matches) {
        names.push(m[1]);
    }
    return names;
}

describe("providerApiRegistry — drift against public/preload.js", () => {
    test("preload exposes an `algolia: { … }` block we can read", () => {
        const block = extractObjectBlock(preloadSource, "algolia");
        expect(block).not.toBeNull();
        expect(block.length).toBeGreaterThan(0);
    });

    test("every algolia method in the registry exists in preload", () => {
        const block = extractObjectBlock(preloadSource, "algolia");
        const preloadNames = new Set(methodsDefinedDirectly(block));
        const fictional = Object.keys(PROVIDER_API_REGISTRY.algolia).filter(
            (n) => !preloadNames.has(n)
        );
        if (fictional.length > 0) {
            throw new Error(
                `registry contains methods not defined in preload.js: ${fictional.join(
                    ", "
                )}. Either add them to preload or remove from registry.`
            );
        }
    });

    test("every algolia method in preload exists in the registry", () => {
        const block = extractObjectBlock(preloadSource, "algolia");
        const preloadNames = methodsDefinedDirectly(block);
        const registered = new Set(Object.keys(PROVIDER_API_REGISTRY.algolia));
        const undocumented = preloadNames.filter((n) => !registered.has(n));
        if (undocumented.length > 0) {
            throw new Error(
                `preload defines methods not in the registry: ${undocumented.join(
                    ", "
                )}. The AI cannot use these reliably until they're documented in providerApiRegistry.js.`
            );
        }
    });
});

describe("formatProviderApiSection", () => {
    const { formatProviderApiSection } = require("./providerApiRegistry");

    test("returns empty string for unknown services", () => {
        expect(formatProviderApiSection(null)).toBe("");
        expect(formatProviderApiSection(undefined)).toBe("");
        expect(formatProviderApiSection("nope-doesnt-exist")).toBe("");
        expect(formatProviderApiSection(123)).toBe("");
    });

    test("emits an AVAILABLE METHODS section for algolia", () => {
        const out = formatProviderApiSection("algolia");
        expect(out).toMatch(/AVAILABLE METHODS/);
        expect(out).toMatch(/window\.mainApi\.algolia/);
    });

    test("lists every algolia method by name", () => {
        const out = formatProviderApiSection("algolia");
        for (const name of Object.keys(PROVIDER_API_REGISTRY.algolia)) {
            expect(out).toContain(`algolia.${name}(`);
        }
    });

    test("explicitly forbids hallucinated methods", () => {
        const out = formatProviderApiSection("algolia");
        // The wording must include a hard "ONLY"/"any method not
        // in this list" instruction so the AI doesn't hedge.
        expect(out).toMatch(/ONLY methods you may call/);
        expect(out).toMatch(/Calling any method not in this list/);
    });

    test("teaches the providerHash + dashboardAppId + providerName triplet", () => {
        const out = formatProviderApiSection("algolia");
        expect(out).toContain("providerHash");
        expect(out).toContain("dashboardAppId");
        expect(out).toContain("providerName");
        expect(out).toContain("useProviderClient");
    });
});
