/**
 * GongCallSearch — Event payload construction tests
 *
 * Tests the logic that extracts fields from a parsed call object
 * and builds the callSelected event payload. This is the critical
 * data transformation between MCP response → published event.
 */

// Extract the payload construction logic as a pure function for testing.
// This mirrors the logic in GongCallSearch.handleSelectCall exactly.
function buildCallSelectedPayload(call) {
    return {
        id: call.id || call.metaData?.id || call.callId || "",
        title:
            call.title ||
            call.metaData?.title ||
            call.subject ||
            call.name ||
            "",
        date: call.started || call.date || call.metaData?.started || "",
        duration: call.duration ?? call.metaData?.duration ?? null,
        scope: call.scope || "",
    };
}

describe("GongCallSearch: callSelected payload construction", () => {
    test("standard call with all fields", () => {
        const call = {
            id: "call-123",
            title: "Q4 Strategy Review",
            started: "2026-03-15T14:00:00Z",
            duration: 1800,
            scope: "External",
        };
        expect(buildCallSelectedPayload(call)).toEqual({
            id: "call-123",
            title: "Q4 Strategy Review",
            date: "2026-03-15T14:00:00Z",
            duration: 1800,
            scope: "External",
        });
    });

    test("call from markdown table (started field, no metaData)", () => {
        const call = {
            id: "c1",
            title: "Sprint Retro",
            started: "3/24/2026",
            duration: 3840,
            scope: "Internal",
            parties: [],
        };
        expect(buildCallSelectedPayload(call)).toEqual({
            id: "c1",
            title: "Sprint Retro",
            date: "3/24/2026",
            duration: 3840,
            scope: "Internal",
        });
    });

    test("metaData fallbacks", () => {
        const call = {
            metaData: {
                id: "meta-id",
                title: "Meta Title",
                started: "2026-01-01",
                duration: 600,
            },
        };
        expect(buildCallSelectedPayload(call)).toEqual({
            id: "meta-id",
            title: "Meta Title",
            date: "2026-01-01",
            duration: 600,
            scope: "",
        });
    });

    test("callId fallback for id", () => {
        const call = { callId: "fallback-id", name: "Fallback Name" };
        const payload = buildCallSelectedPayload(call);
        expect(payload.id).toBe("fallback-id");
        expect(payload.title).toBe("Fallback Name");
    });

    test("subject fallback for title", () => {
        const call = { id: "1", subject: "Subject Title" };
        expect(buildCallSelectedPayload(call).title).toBe("Subject Title");
    });

    test("date field fallback", () => {
        const call = { id: "1", date: "2026-06-01" };
        expect(buildCallSelectedPayload(call).date).toBe("2026-06-01");
    });

    test("all fields missing → defaults", () => {
        const call = {};
        expect(buildCallSelectedPayload(call)).toEqual({
            id: "",
            title: "",
            date: "",
            duration: null,
            scope: "",
        });
    });

    test("duration zero is preserved (not treated as falsy)", () => {
        const call = { id: "1", duration: 0 };
        expect(buildCallSelectedPayload(call).duration).toBe(0);
    });

    test("duration null from metaData when primary is undefined", () => {
        const call = { id: "1", metaData: { duration: null } };
        expect(buildCallSelectedPayload(call).duration).toBeNull();
    });

    test("primary fields take precedence over metaData", () => {
        const call = {
            id: "primary",
            title: "Primary Title",
            started: "2026-01-01",
            duration: 100,
            metaData: {
                id: "meta-id",
                title: "Meta Title",
                started: "2025-01-01",
                duration: 999,
            },
        };
        const payload = buildCallSelectedPayload(call);
        expect(payload.id).toBe("primary");
        expect(payload.title).toBe("Primary Title");
        expect(payload.date).toBe("2026-01-01");
        expect(payload.duration).toBe(100);
    });
});
