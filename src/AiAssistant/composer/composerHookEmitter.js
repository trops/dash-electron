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
 */
export function collectWires(tree) {
    const out = [];
    if (!tree || !tree.root) return out;
    walk(tree.root, (node) => {
        if (!node.wires) return;
        for (const [propName, wire] of Object.entries(node.wires)) {
            if (
                wire &&
                wire.provider &&
                wire.method &&
                typeof wire.provider === "string" &&
                typeof wire.method === "string"
            ) {
                out.push({ nodeId: node.id, propName, wire });
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
export function buildHookScaffold(tree, providerApiRegistry) {
    const wires = collectWires(tree);
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

    extraReactImports.add("useState");
    extraReactImports.add("useEffect");

    // Pass 1: emit provider hook resolution lines + state declarations.
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

        // State variable for this slot.
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

        hookLines.push(
            `    const [${varName}, set_${varName}] = useState(null);`
        );
    }

    // Pass 2: emit one useEffect per slot.
    for (const { nodeId, propName, wire } of wires) {
        const slotKey = `${nodeId}:${propName}`;
        const varName = slotVarBySlotKey.get(slotKey);
        const setFn = `set_${varName}`;

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
