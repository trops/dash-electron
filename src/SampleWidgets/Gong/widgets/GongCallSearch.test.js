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

// ===========================================================================
// End-to-end: MCP response → parse → event payload → listener handler
// ===========================================================================

const { parseMcpResponse, parseGongTextEntries } = require("../utils/mcpUtils");

/**
 * Simulate the full pipeline:
 * 1. MCP callTool returns raw response
 * 2. parseMcpResponse extracts call list
 * 3. User clicks a call → buildCallSelectedPayload
 * 4. DashboardPublisher wraps in { message, event, uuid }
 * 5. Listener handler unwraps and extracts id
 */
function simulateFullPipeline(mcpResponse) {
    // Step 1-2: Parse MCP response (same as GongCallSearch.handleLoadCalls)
    const { data, error } = parseMcpResponse(mcpResponse, {
        arrayKeys: ["calls", "records"],
        textParser: parseGongTextEntries,
    });

    if (error || !Array.isArray(data) || data.length === 0) {
        return { error: error || "no calls parsed", calls: data };
    }

    // Step 3: Build payload from first call (same as handleSelectCall)
    const call = data[0];
    const payload = buildCallSelectedPayload(call);

    // Step 4: DashboardPublisher.emit wraps in envelope
    const envelope = {
        message: payload,
        event: "GongCallSearch[1].callSelected",
        uuid: "listener-uuid",
    };

    // Step 5: Listener handler unwraps (same as GongCallDetail line 53)
    const received = envelope.message || envelope;
    const extractedId = received.id;

    return {
        parsedCalls: data,
        firstCall: call,
        eventPayload: payload,
        envelope,
        receivedByListener: received,
        extractedId,
        listenerWouldAct: !!extractedId,
    };
}

describe("End-to-end: MCP response → event → listener", () => {
    test("standard markdown table response from list_calls", () => {
        const mcpResponse = {
            content: [
                {
                    type: "text",
                    text: [
                        "| ID | Title | Date | Duration | Scope |",
                        "|---|---|---|---|---|",
                        "| 7890123456 | Q4 Strategy Review | 3/24/2026 | 64m | External |",
                        "| 1234567890 | Sprint Retro | 3/25/2026 | 30m | Internal |",
                    ].join("\n"),
                },
            ],
        };

        const result = simulateFullPipeline(mcpResponse);
        expect(result.parsedCalls).toHaveLength(2);
        expect(result.extractedId).toBe("7890123456");
        expect(result.listenerWouldAct).toBe(true);
    });

    test("response with numeric call IDs (Gong uses large numbers)", () => {
        const mcpResponse = {
            content: [
                {
                    type: "text",
                    text: [
                        "| ID | Title | Date | Duration |",
                        "|---|---|---|---|",
                        "| 8527419630 | Customer Demo | 4/1/2026 | 45m |",
                    ].join("\n"),
                },
            ],
        };

        const result = simulateFullPipeline(mcpResponse);
        expect(result.extractedId).toBe("8527419630");
        expect(result.listenerWouldAct).toBe(true);
    });

    test("response with 'Call ID' column header (space in name)", () => {
        const mcpResponse = {
            content: [
                {
                    type: "text",
                    text: [
                        "| Call ID | Title | Date | Duration |",
                        "|---|---|---|---|",
                        "| abc-123 | Test Call | 4/1/2026 | 15m |",
                    ].join("\n"),
                },
            ],
        };

        const result = simulateFullPipeline(mcpResponse);
        expect(result.extractedId).toBe("abc-123");
        expect(result.listenerWouldAct).toBe(true);
    });

    test("JSON array response (some MCP servers return JSON)", () => {
        const mcpResponse = {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        calls: [
                            {
                                id: "call-999",
                                title: "JSON Call",
                                started: "2026-04-01T10:00:00Z",
                                duration: 1800,
                            },
                        ],
                    }),
                },
            ],
        };

        const result = simulateFullPipeline(mcpResponse);
        expect(result.extractedId).toBe("call-999");
        expect(result.listenerWouldAct).toBe(true);
    });

    test("response with metaData wrapper (Gong v2 API format)", () => {
        const mcpResponse = {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        calls: [
                            {
                                metaData: {
                                    id: "gong-meta-id",
                                    title: "Meta Call",
                                    started: "2026-04-01",
                                    duration: 900,
                                },
                            },
                        ],
                    }),
                },
            ],
        };

        const result = simulateFullPipeline(mcpResponse);
        // Call object from JSON won't go through parseMarkdownTable
        // It goes through parseMcpResponse → findArray("calls")
        // The call object has metaData but no top-level id
        expect(result.firstCall.metaData.id).toBe("gong-meta-id");
        expect(result.extractedId).toBe("gong-meta-id");
        expect(result.listenerWouldAct).toBe(true);
    });

    test("CRITICAL: response where ID column is missing entirely", () => {
        const mcpResponse = {
            content: [
                {
                    type: "text",
                    text: [
                        "| Title | Date | Duration | Scope |",
                        "|---|---|---|---|",
                        "| No ID Call | 4/1/2026 | 30m | Internal |",
                    ].join("\n"),
                },
            ],
        };

        const result = simulateFullPipeline(mcpResponse);
        // Without an ID column, the parser can't extract an ID
        expect(result.extractedId).toBe("");
        expect(result.listenerWouldAct).toBe(false);
    });

    test("envelope unwrapping: data.message path", () => {
        const payload = { id: "test-id", title: "Test" };
        const envelope = {
            message: payload,
            event: "GongCallSearch[1].callSelected",
            uuid: "uuid-1",
        };

        const received = envelope.message || envelope;
        expect(received.id).toBe("test-id");
    });

    test("envelope unwrapping: direct data path (no message wrapper)", () => {
        const payload = { id: "direct-id", title: "Direct" };
        const received = payload.message || payload;
        expect(received.id).toBe("direct-id");
    });

    test("empty id in envelope should NOT trigger listener action", () => {
        const payload = { id: "", title: "No ID" };
        const envelope = { message: payload, event: "test", uuid: "u" };
        const received = envelope.message || envelope;
        expect(!!received.id).toBe(false);
    });
});
