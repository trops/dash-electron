/**
 * Shared MCP utility functions.
 *
 * Extracted from McpServerPicker so ProviderDetail (and any future consumer)
 * can reuse the same field-derivation logic.
 */

/**
 * Derive required form fields from an mcpConfig, using credentialSchema
 * as optional enrichment for display names, instructions, and secret flags.
 *
 * For streamable_http: extracts {{placeholder}} fields from url and headerTemplate.
 * For stdio: extracts credential field names from envMapping values.
 *
 * @param {object} mcpConfig - The MCP server configuration
 * @param {object} credentialSchema - Optional metadata for field labels/instructions
 * @returns {Array<{ key, displayName, required, secret, instructions, type }>}
 */
export function deriveFormFields(mcpConfig, credentialSchema = {}) {
    const fieldKeys = new Set();

    if (mcpConfig.transport === "streamable_http") {
        // Extract {{field}} placeholders from url
        if (mcpConfig.url) {
            const urlMatches = mcpConfig.url.match(/\{\{(\w+)\}\}/g) || [];
            urlMatches.forEach((m) => fieldKeys.add(m.slice(2, -2)));
        }
        // Extract {{field}} placeholders from headerTemplate values
        if (mcpConfig.headerTemplate) {
            Object.values(mcpConfig.headerTemplate).forEach((template) => {
                const matches = template.match(/\{\{(\w+)\}\}/g) || [];
                matches.forEach((m) => fieldKeys.add(m.slice(2, -2)));
            });
        }
    } else {
        // stdio: extract credential field names from envMapping values
        if (mcpConfig.envMapping) {
            Object.values(mcpConfig.envMapping).forEach((credField) => {
                fieldKeys.add(credField);
            });
        }
    }

    // Also include any fields defined in credentialSchema that aren't already derived
    if (credentialSchema) {
        Object.keys(credentialSchema).forEach((key) => fieldKeys.add(key));
    }

    // Build the field list with metadata from credentialSchema or auto-generated defaults
    return Array.from(fieldKeys).map((key) => {
        const schemaMeta = credentialSchema[key];

        if (schemaMeta) {
            return {
                key,
                displayName: schemaMeta.displayName || formatFieldName(key),
                required: schemaMeta.required !== false,
                secret: schemaMeta.secret || false,
                instructions: schemaMeta.instructions || null,
                type: schemaMeta.type || "text",
            };
        }

        // Auto-generate defaults from the field name
        return {
            key,
            displayName: formatFieldName(key),
            required: true,
            secret: isLikelySecret(key),
            instructions: null,
            type: "text",
        };
    });
}

/**
 * Convert a camelCase field name to a human-readable title.
 * e.g., "apiKey" → "API Key", "url" → "URL", "botToken" → "Bot Token"
 */
export function formatFieldName(name) {
    const acronyms = { url: "URL", api: "API", id: "ID", mcp: "MCP" };

    return name
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim()
        .split(" ")
        .map((word) => acronyms[word.toLowerCase()] || word)
        .join(" ");
}

/**
 * Heuristic: does this field name likely contain a secret value?
 */
export function isLikelySecret(name) {
    const lower = name.toLowerCase();
    return /key|token|secret|password|credential|auth/.test(lower);
}
