/**
 * composerHookEmitter — Stage 4 helper that translates the tree's
 * collected wire specs into the React hook scaffolding the emitted
 * widget needs at the top of its component function.
 *
 * Split out of composerEmitter.js to keep that file focused on
 * tree↔JSX shape; this one is responsible for the "data plumbing"
 * code (imports, hook calls, state, effects, IPC calls).
 *
 * Inputs: an array of `{ nodeId, propName, wire }` triples gathered
 * from the tree by collectWires().
 *
 * Outputs:
 *   {
 *     extraReactImports:  Set<string>,    // "useState" / "useEffect"
 *     coreImports:        Set<string>,    // useWidgetProviders, …
 *     hookLines:          string[],       // lines inside the component body
 *     slotVarBySlotKey:   Map<key,string> // "<nodeId>:<propName>" → varName
 *   }
 *
 * The downstream emitter (composerEmitter.emitWidgetCode) consumes
 * these to assemble the final component source. Wired slots whose
 * `slotVarBySlotKey` entry exists override the placeholder-rendering
 * branch and emit `prop={varName}` instead.
 *
 * Auto args:
 *   - credential class: providerHash, dashboardAppId, providerName
 *     are always supplied from the resolved pc handle. The user
 *     never needs to bind them.
 *   - mcp class: serverName/workspaceId/etc. are handled by
 *     useMcpProvider's callTool internally — only the per-method
 *     args show up.
 *
 * Arg bindings (C4 scope):
 *   - kind "literal" → JSON-encoded value emitted inline.
 *   - kind "userConfig" → emitted as `userConfig.<field>` (and
 *     userConfig is destructured from the widget's props).
 *   - missing/unrecognized → omitted (the IPC handler should
 *     tolerate undefined for non-required args).
 */

/**
 * Walk the tree and return all configured wire specs along with
 * their node + prop context. Unconfigured wires (skeleton
 * `{ provider: null, method: null }`) are skipped — the picker
 * UI's job to surface those.
 *
 * Each returned entry also carries the wired prop's schema type
 * (e.g., "Array<Object>", "function", "string") which the hook
 * emitter uses to decide between data-fetch wires (useState +
 * useEffect populating a slot value) and callback wires (useCallback
 * firing the tool when the user interacts).
 *
 * `getPropType` is injected for testability — callers in production
 * pass a function backed by dashReactComponentSchemas; tests can
 * pass a stub.
 */
export function collectWires(tree, getPropType = () => "any") {
    const out = [];
    if (!tree || !tree.root) return out;
    walk(tree.root, (node) => {
        if (!node.wires) return;
        for (const [propName, wire] of Object.entries(node.wires)) {
            // A configured wire requires a method (the chosen tool/
            // IPC method). The provider instance name is optional;
            // a null provider means "any instance of providerType"
            // and gets resolved at runtime.
            if (
                wire &&
                wire.method &&
                typeof wire.method === "string" &&
                wire.providerType
            ) {
                out.push({
                    nodeId: node.id,
                    propName,
                    wire,
                    propType: getPropType(node.type, propName),
                });
            }
        }
    });
    return out;
}

function walk(node, visit) {
    if (!node) return;
    visit(node);
    if (Array.isArray(node.children)) {
        for (const c of node.children) walk(c, visit);
    }
}

/**
 * Sanitize an arbitrary string into a JS identifier. Used for
 * deriving handle names from provider instance names that may
 * contain spaces, hyphens, etc.
 */
function toIdent(s) {
    if (typeof s !== "string" || s.length === 0) return "x";
    let cleaned = s.replace(/[^A-Za-z0-9_$]/g, "_");
    if (/^[0-9]/.test(cleaned)) cleaned = "_" + cleaned;
    return cleaned;
}

/**
 * Render a single arg binding as a JS literal expression. Returns
 * the rhs string suitable for `<argName>: <rhs>` in an object
 * literal. Returns null if the binding is missing/unrecognized —
 * the caller should omit the arg entirely.
 *
 * Also collects userConfig field names into `userConfigFields` so
 * the emitter can declare them in the .dash.js config (post-C4).
 */
function renderArgBinding(binding, userConfigFields) {
    if (!binding || typeof binding !== "object") return null;
    if (binding.kind === "literal") {
        if (binding.value === undefined) return null;
        try {
            return JSON.stringify(binding.value);
        } catch {
            return null;
        }
    }
    if (binding.kind === "userConfig") {
        if (typeof binding.field !== "string" || binding.field.length === 0) {
            return null;
        }
        userConfigFields.add(binding.field);
        return `userConfig.${binding.field}`;
    }
    return null;
}

/**
 * Heuristic: should the emitted `.then(result => …)` use `result`
 * or unwrap `result.hits` / `result.items` / etc.?
 *
 * Drives the wrap-vs-unwrap line for credential providers based on
 * the method's `returns.type` annotation. For mcp tools there is
 * no annotation, so we leave it as plain `result`.
 */
function unwrapResultExpr(returnsType) {
    if (typeof returnsType !== "string") return "result";
    // "{hits:Array<…>" or ",hits:Array<…>" or ":hits:Array<…>" —
    // accept either a field-position separator (`{`, `,`, `:`) before
    // the field name. The leading-{ case is the common one (return
    // shapes like "{hits:Array<Object>,nbHits}").
    if (/[{:,]\s*hits\s*:\s*Array/.test(returnsType)) {
        return "result?.hits || []";
    }
    if (/[{:,]\s*items\s*:\s*Array/.test(returnsType)) {
        return "result?.items || []";
    }
    if (/^Array(<|$)/.test(returnsType)) {
        return "Array.isArray(result) ? result : []";
    }
    return "result";
}

/**
 * Main entry point. Given the tree and the providerApiRegistry, emit
 * the imports / hook lines / slot-var map needed for hook
 * scaffolding.
 *
 * `providerApiRegistry` is injected so this module stays
 * provider-agnostic and easy to test with fakes.
 */
export function buildHookScaffold(
    tree,
    providerApiRegistry,
    getPropType = () => "any"
) {
    const wires = collectWires(tree, getPropType);
    const extraReactImports = new Set();
    const coreImports = new Set();
    const hookLines = [];
    const slotVarBySlotKey = new Map();
    const userConfigFields = new Set();

    if (wires.length === 0) {
        return {
            extraReactImports,
            coreImports,
            hookLines,
            slotVarBySlotKey,
            userConfigFields,
        };
    }

    // Cluster wires by provider so the useProviderClient /
    // useMcpProvider hook only renders once per provider instance,
    // even if the same provider drives multiple slots.
    const credentialProvidersSeen = new Map(); // providerName → varSuffix
    const mcpProvidersSeen = new Map(); // providerType → varSuffix

    // Pass 1: emit provider hook resolution lines + state OR
    // useCallback handler per wire.
    //
    // Data-fetch wires (propType !== "function") allocate a useState
    // slot and a useEffect that fires when the provider client is
    // ready.
    //
    // Callback wires (propType === "function") allocate a useCallback
    // that fires the tool when the React event handler fires, with
    // no state allocation — the handler is the binding itself.
    const hasDataWire = wires.some((w) => w.propType !== "function");
    const hasCallbackWire = wires.some((w) => w.propType === "function");
    if (hasDataWire) {
        extraReactImports.add("useState");
        extraReactImports.add("useEffect");
    }
    if (hasCallbackWire) {
        extraReactImports.add("useCallback");
    }

    for (const { nodeId, propName, wire } of wires) {
        if (wire.providerClass === "mcp") {
            if (!mcpProvidersSeen.has(wire.providerType)) {
                const suffix = toIdent(wire.providerType);
                mcpProvidersSeen.set(wire.providerType, suffix);
                coreImports.add("useMcpProvider");
                hookLines.push(
                    `    const mcp_${suffix} = useMcpProvider(${JSON.stringify(
                        wire.providerType
                    )});`
                );
            }
        } else {
            // credential class is the default. The hook key is the
            // resolved provider type (everything resolves through
            // useWidgetProviders().getProvider(<type>)); the
            // provider instance name is only used as a stable suffix
            // when present, so two different wires to the same type
            // share one useProviderClient call.
            const providerKey = wire.provider || wire.providerType;
            if (!credentialProvidersSeen.has(providerKey)) {
                const suffix = toIdent(providerKey);
                credentialProvidersSeen.set(providerKey, suffix);
                coreImports.add("useWidgetProviders");
                coreImports.add("useProviderClient");
                hookLines.push(
                    `    const { getProvider: getProvider_${suffix} } = useWidgetProviders();`
                );
                hookLines.push(
                    `    const provider_${suffix} = getProvider_${suffix}(${JSON.stringify(
                        wire.providerType
                    )});`
                );
                hookLines.push(
                    `    const pc_${suffix} = useProviderClient(provider_${suffix});`
                );
            }
        }

        // State variable (data wire) OR handler name (callback wire)
        // for this slot. Stored in slotVarBySlotKey so the JSX
        // renderer can bind `prop={varName}` regardless of which
        // shape the wire takes.
        const slotKey = `${nodeId}:${propName}`;
        const baseVar = toIdent(propName);
        // If the same baseVar is already taken (two components with
        // the same prop name wired), disambiguate by appending the
        // sanitized nodeId.
        let varName = baseVar;
        let suffix = 0;
        const taken = new Set(slotVarBySlotKey.values());
        while (taken.has(varName)) {
            suffix += 1;
            varName = `${baseVar}_${suffix}`;
        }
        slotVarBySlotKey.set(slotKey, varName);

        // Data wire: allocate state. Callback wire: skip — the
        // useCallback declaration in pass 2 IS the binding, no
        // intermediate state needed.
        const w = wires.find(
            (x) => x.nodeId === nodeId && x.propName === propName
        );
        const isCallback = w && w.propType === "function";
        if (!isCallback) {
            hookLines.push(
                `    const [${varName}, set_${varName}] = useState(null);`
            );
        }
    }

    // Pass 2: emit one useEffect (data) or useCallback (handler)
    // per wire.
    for (const { nodeId, propName, wire, propType } of wires) {
        const slotKey = `${nodeId}:${propName}`;
        const varName = slotVarBySlotKey.get(slotKey);
        const setFn = `set_${varName}`;
        const isCallback = propType === "function";

        if (isCallback) {
            // Build the args literal — same logic as the data-wire
            // path. Auto args (credential triplet for credential
            // class) are still supplied.
            const argLines = [];
            if (wire.providerClass !== "mcp") {
                const providerKey = wire.provider || wire.providerType;
                const suffix = credentialProvidersSeen.get(providerKey);
                const handle = `pc_${suffix}`;
                argLines.push(
                    `                providerHash: ${handle}.providerHash,`,
                    `                dashboardAppId: ${handle}.dashboardAppId,`,
                    `                providerName: ${handle}.providerName,`
                );
            }
            const args = wire.args || {};
            for (const [argName, binding] of Object.entries(args)) {
                const rhs = renderArgBinding(binding, userConfigFields);
                if (rhs !== null)
                    argLines.push(`                ${argName}: ${rhs},`);
            }
            const argsLiteral =
                argLines.length === 0
                    ? "{}"
                    : `{\n${argLines.join("\n")}\n            }`;

            if (wire.providerClass === "mcp") {
                const suffix = mcpProvidersSeen.get(wire.providerType);
                const handle = `mcp_${suffix}`;
                hookLines.push(
                    "",
                    `    const ${varName} = useCallback(async () => {`,
                    `        if (!${handle}?.isConnected) return;`,
                    `        try {`,
                    `            await ${handle}.callTool(${JSON.stringify(
                        wire.method
                    )}, ${argsLiteral});`,
                    `        } catch (err) {`,
                    `            // Tool errors are swallowed here so a CTA`,
                    `            // failure doesn't crash the widget. Production`,
                    `            // widgets should add user-visible error UI.`,
                    `        }`,
                    `    }, [${handle}?.isConnected]);`
                );
            } else {
                const providerKey = wire.provider || wire.providerType;
                const suffix = credentialProvidersSeen.get(providerKey);
                const handle = `pc_${suffix}`;
                hookLines.push(
                    "",
                    `    const ${varName} = useCallback(async () => {`,
                    `        if (!${handle}?.providerHash) return;`,
                    `        try {`,
                    `            await window.mainApi.${wire.providerType}.${wire.method}(${argsLiteral});`,
                    `        } catch (err) {`,
                    `            // See note in the MCP branch above — silent`,
                    `            // failure intentionally.`,
                    `        }`,
                    `    }, [${handle}?.providerHash]);`
                );
            }
            continue;
        }

        if (wire.providerClass === "mcp") {
            const suffix = mcpProvidersSeen.get(wire.providerType);
            const handle = `mcp_${suffix}`;
            const argLines = [];
            const args = wire.args || {};
            for (const [argName, binding] of Object.entries(args)) {
                const rhs = renderArgBinding(binding, userConfigFields);
                if (rhs !== null)
                    argLines.push(`            ${argName}: ${rhs},`);
            }
            const argsLiteral =
                argLines.length === 0
                    ? "{}"
                    : `{\n${argLines.join("\n")}\n        }`;
            hookLines.push(
                "",
                `    useEffect(() => {`,
                `        if (!${handle}?.isConnected) return;`,
                `        let cancelled = false;`,
                `        ${handle}.callTool(${JSON.stringify(
                    wire.method
                )}, ${argsLiteral})`,
                `            .then((result) => {`,
                `                if (cancelled) return;`,
                `                ${setFn}(result);`,
                `            })`,
                `            .catch(() => {});`,
                `        return () => {`,
                `            cancelled = true;`,
                `        };`,
                `    }, [${handle}?.isConnected]);`
            );
        } else {
            const providerKey = wire.provider || wire.providerType;
            const suffix = credentialProvidersSeen.get(providerKey);
            const handle = `pc_${suffix}`;
            const argLines = [
                `            providerHash: ${handle}.providerHash,`,
                `            dashboardAppId: ${handle}.dashboardAppId,`,
                `            providerName: ${handle}.providerName,`,
            ];
            const args = wire.args || {};
            for (const [argName, binding] of Object.entries(args)) {
                const rhs = renderArgBinding(binding, userConfigFields);
                if (rhs !== null)
                    argLines.push(`            ${argName}: ${rhs},`);
            }
            const argsLiteral = `{\n${argLines.join("\n")}\n        }`;
            const registryEntry =
                providerApiRegistry &&
                providerApiRegistry[wire.providerType] &&
                providerApiRegistry[wire.providerType][wire.method];
            const returnsType =
                registryEntry &&
                registryEntry.returns &&
                registryEntry.returns.type;
            const unwrap = unwrapResultExpr(returnsType);

            hookLines.push(
                "",
                `    useEffect(() => {`,
                `        if (!${handle}?.providerHash) return;`,
                `        let cancelled = false;`,
                `        window.mainApi.${wire.providerType}.${wire.method}(${argsLiteral})`,
                `            .then((result) => {`,
                `                if (cancelled) return;`,
                `                ${setFn}(${unwrap});`,
                `            })`,
                `            .catch(() => {});`,
                `        return () => {`,
                `            cancelled = true;`,
                `        };`,
                `    }, [${handle}?.providerHash]);`
            );
        }
    }

    return {
        extraReactImports,
        coreImports,
        hookLines,
        slotVarBySlotKey,
        userConfigFields,
    };
}
