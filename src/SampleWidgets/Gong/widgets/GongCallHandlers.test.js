/**
 * Gong receiver widget handler tests
 *
 * Tests the `data.message || data` defensive pattern used by
 * GongCallDetail, GongCallSummary, and GongCallTranscript.
 *
 * DashboardPublisher wraps payloads as: { message: <payload>, event, uuid }
 * The defensive pattern ensures handlers work with both the wrapped
 * envelope and a raw payload (future-proofing).
 */

// Mirrors the extraction logic in GongCallDetail/Summary/Transcript handlers
function extractPayload(data) {
    return data.message || data;
}

describe("Gong receiver handler: payload extraction", () => {
    const CALL_PAYLOAD = {
        id: "call-123",
        title: "Q4 Strategy Review",
        date: "2026-03-15T14:00:00Z",
        duration: 1800,
        scope: "External",
    };

    test("extracts payload from DashboardPublisher envelope", () => {
        const data = {
            message: CALL_PAYLOAD,
            event: "GongCallSearch[1].callSelected",
            uuid: "dash-1-GongCallDetail-1",
        };
        const payload = extractPayload(data);
        expect(payload.id).toBe("call-123");
        expect(payload.title).toBe("Q4 Strategy Review");
        expect(payload.duration).toBe(1800);
    });

    test("extracts payload from raw data (fallback)", () => {
        const payload = extractPayload(CALL_PAYLOAD);
        expect(payload.id).toBe("call-123");
        expect(payload.title).toBe("Q4 Strategy Review");
    });

    test("handles null message field — falls back to data itself", () => {
        const data = {
            message: null,
            event: "GongCallSearch[1].callSelected",
            uuid: "test",
        };
        const payload = extractPayload(data);
        // Falls back to data since message is null
        expect(payload).toBe(data);
        // The handler's if(payload.id) check would fail, which is correct
        expect(payload.id).toBeUndefined();
    });

    test("handles undefined message field — falls back to data", () => {
        const data = {
            event: "GongCallSearch[1].callSelected",
            uuid: "test",
        };
        const payload = extractPayload(data);
        expect(payload).toBe(data);
    });

    test("empty id does not pass the guard check", () => {
        const data = {
            message: { id: "", title: "No ID" },
            event: "GongCallSearch[1].callSelected",
            uuid: "test",
        };
        const payload = extractPayload(data);
        // Simulates: if (payload.id) loadCall(payload.id)
        // Empty string is falsy, so load should NOT be called
        expect(!!payload.id).toBe(false);
    });

    test("valid id passes the guard check", () => {
        const data = {
            message: { id: "call-456", title: "Valid" },
            event: "GongCallSearch[1].callSelected",
            uuid: "test",
        };
        const payload = extractPayload(data);
        expect(!!payload.id).toBe(true);
    });

    test("GongCallSummary extracts title alongside id", () => {
        const data = {
            message: {
                id: "call-789",
                title: "Weekly Standup",
                date: "2026-03-20",
                duration: 900,
                scope: "Internal",
            },
            event: "GongCallSearch[1].callSelected",
            uuid: "dash-1-GongCallSummary-1",
        };
        const payload = extractPayload(data);
        expect(payload.id).toBe("call-789");
        expect(payload.title).toBe("Weekly Standup");
    });

    test("GongCallTranscript extracts id and title", () => {
        const data = {
            message: {
                id: "call-abc",
                title: "Sales Demo",
                date: "2026-03-22",
                duration: 2700,
                scope: "External",
            },
            event: "GongCallSearch[1].callSelected",
            uuid: "dash-1-GongCallTranscript-1",
        };
        const payload = extractPayload(data);
        expect(payload.id).toBe("call-abc");
        expect(payload.title).toBe("Sales Demo");
    });
});
