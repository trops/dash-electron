/**
 * ipcValidators.cjs — IPC payload shape validation for algolia handlers.
 *
 * Audit reference: Phase 5A, P1 #14 — "`providerHash`, `indexName`, `dir`
 * pass through without shape/format check." This module pins the contract
 * at the handler edge so a compromised renderer can't smuggle malformed
 * inputs into the main process.
 *
 * Hand-rolled — no zod/joi dep. Scope is intentionally narrow (algolia
 * handlers only); broader IPC validation is a separate sweep.
 */

const path = require("path");
const fs = require("fs");

const INDEX_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/;
const HEX_64_RE = /^[a-f0-9]{64}$/i;

function check(type, value) {
    const optional = type.endsWith("?");
    const baseType = optional ? type.slice(0, -1) : type;

    if (value === undefined || value === null) {
        return optional ? { ok: true } : { ok: false, reason: "is required" };
    }

    switch (baseType) {
        case "string":
            if (typeof value !== "string" || value.length === 0)
                return { ok: false, reason: "must be a non-empty string" };
            return { ok: true };
        case "boolean":
            if (typeof value !== "boolean")
                return { ok: false, reason: "must be boolean" };
            return { ok: true };
        case "number":
            if (typeof value !== "number" || !Number.isFinite(value))
                return { ok: false, reason: "must be a finite number" };
            return { ok: true };
        case "object":
            if (typeof value !== "object" || Array.isArray(value))
                return { ok: false, reason: "must be a plain object" };
            return { ok: true };
        case "indexName":
            if (typeof value !== "string" || !INDEX_NAME_RE.test(value))
                return {
                    ok: false,
                    reason: "must match [A-Za-z0-9._-]{1,64}",
                };
            return { ok: true };
        case "providerHash":
            if (typeof value !== "string" || !HEX_64_RE.test(value))
                return { ok: false, reason: "must be 64 hex chars (SHA-256)" };
            return { ok: true };
        case "absPath":
            if (typeof value !== "string")
                return { ok: false, reason: "must be a string" };
            if (value.length === 0 || value.length > 4096)
                return { ok: false, reason: "must be 1..4096 chars" };
            if (value.includes("\0"))
                return { ok: false, reason: "must not contain null bytes" };
            if (!path.isAbsolute(value))
                return { ok: false, reason: "must be an absolute path" };
            return { ok: true };
        case "existingDir":
            {
                const inner = check("absPath", value);
                if (!inner.ok) return inner;
            }
            try {
                const st = fs.statSync(value);
                if (!st.isDirectory())
                    return {
                        ok: false,
                        reason: "must point to an existing directory",
                    };
            } catch {
                return {
                    ok: false,
                    reason: "must point to an existing directory",
                };
            }
            return { ok: true };
        case "existingFile":
            {
                const inner = check("absPath", value);
                if (!inner.ok) return inner;
            }
            try {
                const st = fs.statSync(value);
                if (!st.isFile())
                    return {
                        ok: false,
                        reason: "must point to an existing file",
                    };
            } catch {
                return {
                    ok: false,
                    reason: "must point to an existing file",
                };
            }
            return { ok: true };
        case "stringOrObject":
            if (typeof value !== "string" && typeof value !== "object")
                return { ok: false, reason: "must be a string or object" };
            return { ok: true };
        default:
            return { ok: false, reason: `unknown validator type: ${baseType}` };
    }
}

/**
 * Validate a payload against a schema. Returns {ok:true, value} or
 * {ok:false, error}. `error` is a structured string safe to throw back
 * across the IPC boundary.
 */
function validate(schema, payload, channel) {
    if (payload === undefined || payload === null) {
        return {
            ok: false,
            error: `[ipc:${channel}] payload is required`,
        };
    }
    if (typeof payload !== "object" || Array.isArray(payload)) {
        return {
            ok: false,
            error: `[ipc:${channel}] payload must be a plain object`,
        };
    }
    for (const [field, type] of Object.entries(schema)) {
        const result = check(type, payload[field]);
        if (!result.ok) {
            return {
                ok: false,
                error: `[ipc:${channel}] ${field} ${result.reason}`,
            };
        }
    }
    return { ok: true, value: payload };
}

const PROVIDER_FIELDS = {
    dashboardAppId: "string",
    providerName: "string",
};
const PROVIDER_FIELDS_WITH_HASH = {
    providerHash: "providerHash",
    ...PROVIDER_FIELDS,
};

const SCHEMAS = {
    "algolia-list-indices": {
        providerHash: "providerHash?",
        ...PROVIDER_FIELDS,
    },
    "algolia-partial-update-objects": {
        ...PROVIDER_FIELDS,
        indexName: "indexName",
        dir: "existingDir",
        createIfNotExists: "boolean?",
    },
    "algolia-create-batch": {
        filepath: "existingFile",
        batchFilepath: "absPath",
        batchSize: "number",
    },
    "algolia-browse-objects": {
        ...PROVIDER_FIELDS,
        indexName: "indexName",
        toFilename: "absPath",
        query: "string?",
    },
    "algolia-search": {
        ...PROVIDER_FIELDS,
        indexName: "indexName",
        query: "string?",
        options: "object?",
    },
    "algolia-get-settings": {
        ...PROVIDER_FIELDS_WITH_HASH,
        indexName: "indexName",
    },
    "algolia-set-settings": {
        ...PROVIDER_FIELDS_WITH_HASH,
        indexName: "indexName",
        settings: "object",
    },
    "algolia-search-rules": {
        ...PROVIDER_FIELDS_WITH_HASH,
        indexName: "indexName",
        query: "string?",
        hitsPerPage: "number?",
        page: "number?",
    },
    "algolia-save-rule": {
        ...PROVIDER_FIELDS_WITH_HASH,
        indexName: "indexName",
        rule: "object",
    },
    "algolia-delete-rule": {
        ...PROVIDER_FIELDS_WITH_HASH,
        indexName: "indexName",
        objectID: "string",
    },
    "algolia-analytics": {
        ...PROVIDER_FIELDS,
        indexName: "indexName",
        query: "stringOrObject",
    },
};

module.exports = { validate, SCHEMAS, check };
