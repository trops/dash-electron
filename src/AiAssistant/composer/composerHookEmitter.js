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
            if (!wire) continue;
            // Pipe wires reference another wire's result state. They
            // have no provider/method of their own — bind their slot
            // to the source wire's var name in buildHookScaffold's
            // pass 1b.
            if (
                wire.kind === "pipe" &&
                wire.sourceNodeId &&
                wire.sourcePropName
            ) {
                out.push({
                    nodeId: node.id,
                    propName,
                    wire,
                    propType: getPropType(node.type, propName),
                });
                continue;
            }
            // A configured method wire requires a method (the chosen
            // tool/IPC method). The provider instance name is
            // optional; a null provider means "any instance of
            // providerType" and gets resolved at runtime.
            if (
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
 * Walk the tree and populate inputStateByNodeId for every input-
 * category node. Var names derive from the component type + a
 * counter so two SearchInputs in the same tree get distinct vars.
 */
function collectInputStates(tree, getInputBinding, out) {
    if (!tree || !tree.root) return;
    const seenNames = new Set();
    walk(tree.root, (node) => {
        if (!node || !node.type) return;
        const binding = getInputBinding(node.type);
        if (!binding) return;
        let base =
            node.type.charAt(0).toLowerCase() + node.type.slice(1) + "Value";
        let varName = base;
        let suffix = 0;
        while (seenNames.has(varName)) {
            suffix += 1;
            varName = `${base}_${suffix}`;
        }
        seenNames.add(varName);
        // A user-set static value becomes the initial state — so
        // `Slider props: { value: 50 }` initializes the slider at
        // 50 but still tracks subsequent edits via useState.
        const userValue =
            node.props && node.props[binding.valueProp] !== undefined
                ? node.props[binding.valueProp]
                : undefined;
        const initial =
            userValue !== undefined
                ? JSON.stringify(userValue)
                : binding.defaultValue;
        out.set(node.id, {
            varName,
            setter: `set${varName.charAt(0).toUpperCase()}${varName.slice(1)}`,
            valueProp: binding.valueProp,
            changeProp: binding.changeProp,
            defaultValue: initial,
            componentType: node.type,
        });
    });
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
 *
 * Binding kinds:
 *   - literal     → JSON-encoded value
 *   - userConfig  → userConfig.<field>
 *   - eventArg    → the literal `eventArg` (the callback handler's
 *                   first parameter — only valid inside a callback
 *                   wire's emitted handler).
 *   - componentValue → another node's auto-state var name; resolved
 *                   via inputStateByNodeId map passed by the caller.
 */
function renderArgBinding(binding, userConfigFields, inputStateByNodeId) {
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
    if (binding.kind === "eventArg") {
        return "eventArg";
    }
    if (binding.kind === "componentValue") {
        if (!inputStateByNodeId || !binding.sourceNodeId) return null;
        const entry = inputStateByNodeId.get(binding.sourceNodeId);
        return entry ? entry.varName : null;
    }
    return null;
}

/**
 * Initial state value for a wired slot. Mirrors the unwrap shape so
 * the consumer (Table, DataList, etc.) gets a usable empty value
 * before the first fetch / event fires, instead of `null` causing a
 * `Cannot read 'map' of null` crash on the first render.
 *
 * Returns a JS expression source — caller drops it into the
 * useState() call as-is.
 */
function initialResultValue(returnsType) {
    if (typeof returnsType !== "string") return "null";
    if (/^Array(<|$)/.test(returnsType)) return "[]";
    if (/[{:,]\s*hits\s*:\s*Array/.test(returnsType)) return "[]";
    if (/[{:,]\s*items\s*:\s*Array/.test(returnsType)) return "[]";
    return "null";
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
    getPropType = () => "any",
    getInputBinding = () => null
) {
    const wires = collectWires(tree, getPropType);
    const extraReactImports = new Set();
    const coreImports = new Set();
    const hookLines = [];
    const slotVarBySlotKey = new Map();
    const userConfigFields = new Set();
    // inputStateByNodeId: nodeId → { varName, setter, valueProp,
    // changeProp, defaultValue }. Pre-pass populates this for every
    // input-category node. Drives:
    //   - useState allocation at the top of the component
    //   - value/checked + onChange JSX binds (via slotVarBySlotKey)
    //   - the prepended setState(eventArg) line in wired-onChange
    //     handlers
    //   - the `componentValue` arg-binding resolver
    const inputStateByNodeId = new Map();
    collectInputStates(tree, getInputBinding, inputStateByNodeId);

    // Pre-pass: input-component auto-state. Allocates useState for
    // every input's value/checked, registers the var in the slot
    // map so the JSX renderer binds it, and pre-binds onChange to
    // setState — so even an unwired SearchInput holds its typed
    // value in component state available to downstream wires.
    if (inputStateByNodeId.size > 0) {
        extraReactImports.add("useState");
        for (const [nodeId, entry] of inputStateByNodeId) {
            hookLines.push(
                `    const [${entry.varName}, ${entry.setter}] = useState(${entry.defaultValue});`
            );
            // value/checked binds to the state var.
            slotVarBySlotKey.set(`${nodeId}:${entry.valueProp}`, entry.varName);
        }
    }

    if (wires.length === 0) {
        // Even with no wires, input nodes may still have generated
        // state — wire each input's onChange to its setter inline.
        // (Done after the wire loop below when wires exist; here we
        // handle the no-wire case so unwired inputs are still
        // interactive.)
        for (const [nodeId, entry] of inputStateByNodeId) {
            slotVarBySlotKey.set(`${nodeId}:${entry.changeProp}`, entry.setter);
        }
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
        // Pipe wires don't allocate any of: provider hook, state,
        // useEffect, or useCallback. Pass 1b binds them by looking
        // up the source wire's var name.
        if (wire.kind === "pipe") continue;

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

        // Data wire: allocate state for the slot var.
        // Callback wire: ALSO allocate a result state — even if
        // unused, the cost is one useState. This is what lets
        // downstream `pipe` wires bind to a callback's tool result
        // (Search.onChange fires google-drive.search → DataList
        // reads `onChangeResult`).
        //
        // Initial value comes from the wire's return-type metadata:
        // Array-shaped returns get `[]`, scalars/objects get `null`.
        // This prevents the `Cannot read 'map' of null` crash that
        // would otherwise hit on the first render before the fetch /
        // event fires.
        const w = wires.find(
            (x) => x.nodeId === nodeId && x.propName === propName
        );
        const isCallback = w && w.propType === "function";
        const registryEntry =
            providerApiRegistry &&
            providerApiRegistry[wire.providerType] &&
            providerApiRegistry[wire.providerType][wire.method];
        const returnsType =
            (registryEntry &&
                registryEntry.returns &&
                registryEntry.returns.type) ||
            null;
        const initial = initialResultValue(returnsType);
        if (isCallback) {
            // Need useState for the result-capture state, regardless
            // of whether anything pipes from it (cheap, and lets
            // the user wire it up later).
            extraReactImports.add("useState");
            hookLines.push(
                `    const [${varName}Result, set_${varName}Result] = useState(${initial});`
            );
        } else {
            hookLines.push(
                `    const [${varName}, set_${varName}] = useState(${initial});`
            );
        }
    }

    // Pass 1b: resolve pipe wires. A pipe wire points at another
    // node's wire (typically a callback handler) and binds its JSX
    // prop to that wire's result state. No provider hook, no
    // useState, no useEffect — the JSX bind below is the entire
    // implementation.
    for (const { nodeId, propName, wire } of wires) {
        if (wire.kind !== "pipe") continue;
        const slotKey = `${nodeId}:${propName}`;
        const srcKey = `${wire.sourceNodeId}:${wire.sourcePropName}`;
        const srcVar = slotVarBySlotKey.get(srcKey);
        if (!srcVar) {
            // Source wire isn't present (or hasn't allocated a var
            // yet) — leave this slot unresolved so the emitter
            // falls back to the placeholder. The composer UI will
            // already have surfaced this as a dangling pipe.
            continue;
        }
        // The pipe's effective var IS the source's result var. For
        // callback sources that's `<srcVar>Result`; for data
        // sources we can pipe the slot var directly.
        const srcWire = wires.find(
            (x) =>
                x.nodeId === wire.sourceNodeId &&
                x.propName === wire.sourcePropName
        );
        const srcIsCallback = srcWire && srcWire.propType === "function";
        slotVarBySlotKey.set(
            slotKey,
            srcIsCallback ? `${srcVar}Result` : srcVar
        );
    }

    // Pass 2: emit one useEffect (data) or useCallback (handler)
    // per wire. Pipe wires are handled entirely in pass 1b.
    for (const { nodeId, propName, wire, propType } of wires) {
        if (wire.kind === "pipe") continue;
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
                const rhs = renderArgBinding(
                    binding,
                    userConfigFields,
                    inputStateByNodeId
                );
                if (rhs !== null)
                    argLines.push(`                ${argName}: ${rhs},`);
            }
            const argsLiteral =
                argLines.length === 0
                    ? "{}"
                    : `{\n${argLines.join("\n")}\n            }`;

            // Result-capture: every callback writes its tool's
            // unwrapped result into `<varName>Result` state.
            // Downstream `pipe` wires read that state. The unwrap
            // heuristic matches the data-wire path so
            // {hits:Array<…>}-returning methods feed result.hits
            // (etc.) into the pipe — saves the user from writing
            // adapter code.
            const registryEntry =
                providerApiRegistry &&
                providerApiRegistry[wire.providerType] &&
                providerApiRegistry[wire.providerType][wire.method];
            const returnsType =
                (registryEntry &&
                    registryEntry.returns &&
                    registryEntry.returns.type) ||
                null;
            const unwrap = unwrapResultExpr(returnsType);

            // If this callback wire is on an input component's
            // changeProp, prepend a setter call so the typed value
            // is captured to state alongside firing the tool. The
            // handler signature uses `eventArg` so the arg-binding
            // path can also reference the new value directly via
            // kind: "eventArg".
            const inputState = inputStateByNodeId.get(nodeId);
            const isInputChange =
                inputState && inputState.changeProp === propName;
            const setterLine = isInputChange
                ? `        ${inputState.setter}(eventArg);\n`
                : "";

            if (wire.providerClass === "mcp") {
                const suffix = mcpProvidersSeen.get(wire.providerType);
                const handle = `mcp_${suffix}`;
                hookLines.push(
                    "",
                    `    const ${varName} = useCallback(async (eventArg) => {`,
                    setterLine + `        if (!${handle}?.isConnected) return;`,
                    `        try {`,
                    `            const result = await ${handle}.callTool(${JSON.stringify(
                        wire.method
                    )}, ${argsLiteral});`,
                    `            set_${varName}Result(${unwrap});`,
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
                    `    const ${varName} = useCallback(async (eventArg) => {`,
                    setterLine +
                        `        if (!${handle}?.providerHash) return;`,
                    `        try {`,
                    `            const result = await window.mainApi.${wire.providerType}.${wire.method}(${argsLiteral});`,
                    `            set_${varName}Result(${unwrap});`,
                    `        } catch (err) {`,
                    `            // See note in the MCP branch above — silent`,
                    `            // failure intentionally.`,
                    `        }`,
                    `    }, [${handle}?.providerHash]);`
                );
            }
            // Also register the changeProp slot var so the JSX
            // renderer binds onChange={varName} (the useCallback)
            // — overrides the default `setter` binding we set in
            // the no-wire pre-pass.
            if (isInputChange) {
                slotVarBySlotKey.set(`${nodeId}:${propName}`, varName);
            }
            continue;
        }

        if (wire.providerClass === "mcp") {
            const suffix = mcpProvidersSeen.get(wire.providerType);
            const handle = `mcp_${suffix}`;
            const argLines = [];
            const args = wire.args || {};
            for (const [argName, binding] of Object.entries(args)) {
                const rhs = renderArgBinding(
                    binding,
                    userConfigFields,
                    inputStateByNodeId
                );
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
                const rhs = renderArgBinding(
                    binding,
                    userConfigFields,
                    inputStateByNodeId
                );
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

    // Post-pass: for every input whose changeProp didn't end up
    // wired (no useCallback generated above), default-bind onChange
    // to the bare setter — so unwired inputs still capture typed
    // values into state. Wired onChange handlers already overrode
    // this entry inside the wire loop above.
    for (const [nodeId, entry] of inputStateByNodeId) {
        const changeKey = `${nodeId}:${entry.changeProp}`;
        if (!slotVarBySlotKey.has(changeKey)) {
            slotVarBySlotKey.set(changeKey, entry.setter);
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
