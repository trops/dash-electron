/**
 * @jest-environment jsdom
 *
 * Tests for the localStorage-backed widget credential-grants
 * store (slice 17d.1).
 *
 * The store records, per (packageName, service, method), whether
 * the user granted permission for the widget to make that call.
 * Granularity:
 *   - packageName = the install path (e.g. "@ai-built/algoliarulesmanager")
 *   - service     = "algolia" / "slack" / "gmail" / etc.
 *   - method      = SDK method name ("listIndices", "deleteRule", …)
 *
 * Storage shape on disk (in localStorage under
 * "dash:widget-credential-grants"):
 *
 *   {
 *     "@ai-built/algoliarulesmanager": {
 *       algolia: { listIndices: true, search: true, deleteRule: false }
 *     },
 *     "@ai-built/slackdigest": {
 *       slack: { postMessage: true }
 *     }
 *   }
 *
 * Default for absent entries: false (denied). Errs on the side of
 * security — calls without an explicit grant are blocked.
 */
import {
    getGrants,
    setGrants,
    getGrant,
    clearGrantsForPackage,
    GRANTS_STORAGE_KEY,
} from "./widgetCredentialGrants";

// Reset localStorage before EVERY test (both describes), not just
// the first describe's. Previously the second describe inherited
// state from the first, which made the "robustness" tests flaky
// depending on test order.
beforeEach(() => {
    try {
        window.localStorage.clear();
    } catch {
        /* jsdom always has it */
    }
});

describe("widgetCredentialGrants — read / write", () => {
    test("getGrants returns {} when nothing is stored", () => {
        expect(getGrants("@ai-built/x")).toEqual({});
    });

    test("setGrants persists, getGrants reads back", () => {
        setGrants("@ai-built/algoliarulesmanager", {
            algolia: { listIndices: true, deleteRule: false },
        });
        expect(getGrants("@ai-built/algoliarulesmanager")).toEqual({
            algolia: { listIndices: true, deleteRule: false },
        });
    });

    test("getGrant returns the boolean for a specific (service, method)", () => {
        setGrants("@ai-built/x", {
            algolia: { listIndices: true, deleteRule: false },
        });
        expect(getGrant("@ai-built/x", "algolia", "listIndices")).toBe(true);
        expect(getGrant("@ai-built/x", "algolia", "deleteRule")).toBe(false);
    });

    test("getGrant defaults to false for unknown package / service / method", () => {
        expect(getGrant("@ai-built/x", "algolia", "listIndices")).toBe(false);
        setGrants("@ai-built/x", { slack: {} });
        expect(getGrant("@ai-built/x", "algolia", "listIndices")).toBe(false);
        expect(getGrant("@ai-built/x", "slack", "postMessage")).toBe(false);
    });

    test("setGrants overwrites the package's grants atomically", () => {
        setGrants("@ai-built/x", {
            algolia: { listIndices: true, search: true },
        });
        setGrants("@ai-built/x", {
            algolia: { listIndices: false },
        });
        expect(getGrants("@ai-built/x")).toEqual({
            algolia: { listIndices: false },
        });
    });

    test("setGrants for one package does not touch others", () => {
        setGrants("@ai-built/a", { algolia: { listIndices: true } });
        setGrants("@ai-built/b", { slack: { postMessage: true } });
        expect(getGrants("@ai-built/a")).toEqual({
            algolia: { listIndices: true },
        });
        expect(getGrants("@ai-built/b")).toEqual({
            slack: { postMessage: true },
        });
    });

    test("clearGrantsForPackage removes only that package's entry", () => {
        setGrants("@ai-built/a", { algolia: { listIndices: true } });
        setGrants("@ai-built/b", { slack: { postMessage: true } });
        clearGrantsForPackage("@ai-built/a");
        expect(getGrants("@ai-built/a")).toEqual({});
        expect(getGrants("@ai-built/b")).toEqual({
            slack: { postMessage: true },
        });
    });

    test("uses the documented localStorage key", () => {
        setGrants("@ai-built/x", { algolia: { listIndices: true } });
        const raw = window.localStorage.getItem(GRANTS_STORAGE_KEY);
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw);
        expect(parsed["@ai-built/x"]).toEqual({
            algolia: { listIndices: true },
        });
    });
});

describe("widgetCredentialGrants — robustness", () => {
    test("returns {} when localStorage is throwing (private mode etc.)", () => {
        const orig = window.localStorage.getItem;
        window.localStorage.getItem = () => {
            throw new Error("storage disabled");
        };
        try {
            expect(getGrants("@ai-built/x")).toEqual({});
            expect(getGrant("@ai-built/x", "algolia", "listIndices")).toBe(
                false
            );
        } finally {
            window.localStorage.getItem = orig;
        }
    });

    test("returns {} when stored JSON is corrupted", () => {
        window.localStorage.setItem(GRANTS_STORAGE_KEY, "{not-valid-json");
        expect(getGrants("@ai-built/x")).toEqual({});
    });
});
