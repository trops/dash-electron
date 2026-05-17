/**
 * dash-react component schemas — composer-facing curated subset.
 *
 * Sister to dashReactComponentRegistry.js. The registry is the full
 * 150-entry export list used to validate JSX names in AI-generated
 * code (slice 19G.1). This file is a smaller, more opinionated
 * subset: the components a widget author actually uses regularly,
 * with structured prop schemas the Compose UI (slice 20.C*) reads
 * to drive its property inspector and "wire to provider" flow.
 *
 * Why two files instead of extending the registry: the registry has
 * many components that are framework-internal, preview-only, or
 * variant flavors (Heading vs Heading2 vs Heading3). The composer
 * wants ONE canonical Heading, not three; one Tag, not three. Surfacing
 * every variant in the palette would be noise. Keeping them in the
 * registry preserves the validator's broad acceptance — we don't want
 * to reject an AI widget that happens to import Heading3 — while the
 * composer paints from a sharper palette.
 *
 * Schema shape per component:
 *   {
 *     category: "layout" | "display" | "input" | "action" | "feedback",
 *     props: {
 *       <propName>: { type: "string" | "number" | "boolean" | "function" | "Array<...>" | ..., required?: boolean }
 *     },
 *     dataSlots: ["propName", ...]  // subset of props.keys() that are wirable to a provider method
 *   }
 *
 * `dataSlots` is the key composer-time concept. A `<Heading title="..." />`
 * is static text; its `title` is not a data slot. A `<Table data={...} />`
 * holds the result of a provider call; `data` IS a data slot. The composer
 * shows a "static value | wire to provider" toggle for every key in dataSlots.
 *
 * Type strings are deliberately loose ("Array<Object>", "Array<{label,value}>")
 * — they're hints for the composer's method-matching UI, not a runtime type
 * system. Stage 3 (Wire) uses them to filter the methods dropdown to
 * return-shape-compatible candidates.
 */
export const DASH_REACT_COMPONENT_SCHEMAS = {
    // ─── Layout ─────────────────────────────────────────────────────
    Panel: {
        category: "layout",
        props: {
            children: { type: "ReactNode" },
        },
        dataSlots: [],
        fillsCell: true,
    },
    Panel2: {
        category: "layout",
        props: {
            children: { type: "ReactNode" },
        },
        dataSlots: [],
        fillsCell: true,
    },
    Panel3: {
        category: "layout",
        props: {
            children: { type: "ReactNode" },
        },
        dataSlots: [],
        fillsCell: true,
    },
    Card: {
        category: "layout",
        props: {
            children: { type: "ReactNode" },
        },
        dataSlots: [],
        fillsCell: true,
    },
    Card2: {
        category: "layout",
        props: {
            children: { type: "ReactNode" },
        },
        dataSlots: [],
        fillsCell: true,
    },
    Card3: {
        category: "layout",
        props: {
            children: { type: "ReactNode" },
        },
        dataSlots: [],
        fillsCell: true,
    },
    Container: {
        category: "layout",
        props: {
            children: { type: "ReactNode" },
        },
        dataSlots: [],
        fillsCell: true,
    },
    // Tabs and Accordion are intentionally omitted: dash-react
    // requires sub-component nesting (<Tabs.List>, <Tabs.Trigger
    // value=…>, <Tabs.Content value=…> / <Accordion.Item>,
    // <Accordion.Trigger>, <Accordion.Content>) which the composer
    // can't yet model in its tree. A bare <Tabs>{children}</Tabs>
    // emits valid JSX but renders nothing visible. Re-add when the
    // composer learns to insert sub-component children.

    // ─── Display ────────────────────────────────────────────────────
    Heading: {
        category: "display",
        props: {
            title: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Heading2: {
        category: "display",
        props: {
            title: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Heading3: {
        category: "display",
        props: {
            title: { type: "string", required: true },
        },
        dataSlots: [],
    },
    SubHeading: {
        category: "display",
        props: {
            title: { type: "string", required: true },
        },
        dataSlots: [],
    },
    SubHeading2: {
        category: "display",
        props: {
            title: { type: "string", required: true },
        },
        dataSlots: [],
    },
    SubHeading3: {
        category: "display",
        props: {
            title: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Paragraph: {
        category: "display",
        props: {
            // dash-react's <Paragraph> renders its `children` as
            // the visible text. The composer surfaces that as an
            // editable `text` prop and the emitter renders it as
            // JSX children — same pattern as Tag/ButtonIcon which
            // accept either prop in the real component.
            text: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Paragraph2: {
        category: "display",
        props: {
            text: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Paragraph3: {
        category: "display",
        props: {
            text: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Tag: {
        category: "display",
        props: {
            text: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Tag2: {
        category: "display",
        props: {
            text: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Tag3: {
        category: "display",
        props: {
            text: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Table: {
        category: "display",
        props: {
            data: { type: "Array<Object>", required: true },
            columns: { type: "Array<{key,label}>", required: true },
        },
        dataSlots: ["data", "columns"],
        fillsCell: true,
    },
    Table2: {
        category: "display",
        props: {
            data: { type: "Array<Object>", required: true },
            columns: { type: "Array<{key,label}>", required: true },
        },
        dataSlots: ["data", "columns"],
        fillsCell: true,
    },
    Table3: {
        category: "display",
        props: {
            data: { type: "Array<Object>", required: true },
            columns: { type: "Array<{key,label}>", required: true },
        },
        dataSlots: ["data", "columns"],
        fillsCell: true,
    },
    DataList: {
        category: "display",
        props: {
            items: { type: "Array<{label,value}>", required: true },
        },
        dataSlots: ["items"],
        fillsCell: true,
    },
    // Menu is a data-driven leaf: wire `items` to a provider/pipe
    // and the emitter generates a <MenuItem> row per item inside the
    // <Menu>. `onSelect` (optional) fires when a row is clicked, with
    // the chosen item's value. Mirrors the DataList shim — the user
    // doesn't add MenuItems by hand; they're iteration output.
    Menu: {
        category: "display",
        props: {
            items: { type: "Array<{label,value}>", required: true },
            onSelect: { type: "function" },
        },
        dataSlots: ["items"],
        fillsCell: true,
    },
    Menu2: {
        category: "display",
        props: {
            items: { type: "Array<{label,value}>", required: true },
            onSelect: { type: "function" },
        },
        dataSlots: ["items"],
        fillsCell: true,
    },
    Menu3: {
        category: "display",
        props: {
            items: { type: "Array<{label,value}>", required: true },
            onSelect: { type: "function" },
        },
        dataSlots: ["items"],
        fillsCell: true,
    },
    // MenuItem(2/3) stay in the schema so the import collector can
    // include them when the Menu shim's iteration uses them, but
    // they're hidden from the palette — users only get them as
    // iteration output of a wired Menu, not as a standalone drop.
    MenuItem: {
        category: "display",
        props: {
            children: { type: "ReactNode" },
            onClick: { type: "function" },
        },
        dataSlots: [],
        hideFromPalette: true,
    },
    MenuItem2: {
        category: "display",
        props: {
            children: { type: "ReactNode" },
            onClick: { type: "function" },
        },
        dataSlots: [],
        hideFromPalette: true,
    },
    MenuItem3: {
        category: "display",
        props: {
            children: { type: "ReactNode" },
            onClick: { type: "function" },
        },
        dataSlots: [],
        hideFromPalette: true,
    },
    FontAwesomeIcon: {
        category: "display",
        props: {
            icon: { type: "string", required: true },
        },
        dataSlots: [],
    },

    // ─── Input ──────────────────────────────────────────────────────
    InputText: {
        category: "input",
        props: {
            label: { type: "string" },
            value: { type: "string" },
            onChange: { type: "function" },
            placeholder: { type: "string" },
        },
        dataSlots: [],
    },
    TextArea: {
        category: "input",
        props: {
            label: { type: "string" },
            value: { type: "string" },
            onChange: { type: "function" },
            placeholder: { type: "string" },
            rows: { type: "number" },
        },
        dataSlots: [],
    },
    SearchInput: {
        category: "input",
        props: {
            label: { type: "string" },
            value: { type: "string" },
            onChange: { type: "function" },
            placeholder: { type: "string" },
        },
        dataSlots: [],
    },
    SelectInput: {
        category: "input",
        props: {
            value: { type: "any" },
            onChange: { type: "function" },
            options: { type: "Array<{label,value}>", required: true },
        },
        dataSlots: ["options"],
    },
    Switch: {
        category: "input",
        props: {
            label: { type: "string" },
            checked: { type: "boolean" },
            onChange: { type: "function" },
        },
        dataSlots: [],
    },
    Toggle: {
        category: "input",
        props: {
            label: { type: "string" },
            checked: { type: "boolean" },
            onChange: { type: "function" },
        },
        dataSlots: [],
    },
    Toggle2: {
        category: "input",
        props: {
            label: { type: "string" },
            checked: { type: "boolean" },
            onChange: { type: "function" },
        },
        dataSlots: [],
    },
    Toggle3: {
        category: "input",
        props: {
            label: { type: "string" },
            checked: { type: "boolean" },
            onChange: { type: "function" },
        },
        dataSlots: [],
    },
    Checkbox: {
        category: "input",
        props: {
            label: { type: "string" },
            checked: { type: "boolean" },
            onChange: { type: "function" },
        },
        dataSlots: [],
    },
    RadioGroup: {
        category: "input",
        props: {
            value: { type: "any" },
            onChange: { type: "function" },
            options: { type: "Array<{label,value}>", required: true },
        },
        dataSlots: ["options"],
    },
    Slider: {
        category: "input",
        props: {
            label: { type: "string" },
            value: { type: "number" },
            onChange: { type: "function" },
            min: { type: "number" },
            max: { type: "number" },
            step: { type: "number" },
        },
        dataSlots: [],
    },

    // ─── Action ─────────────────────────────────────────────────────
    Button: {
        category: "action",
        props: {
            title: { type: "string", required: true },
            onClick: { type: "function" },
            disabled: { type: "boolean" },
        },
        dataSlots: [],
    },
    Button2: {
        category: "action",
        props: {
            title: { type: "string", required: true },
            onClick: { type: "function" },
            disabled: { type: "boolean" },
        },
        dataSlots: [],
    },
    Button3: {
        category: "action",
        props: {
            title: { type: "string", required: true },
            onClick: { type: "function" },
            disabled: { type: "boolean" },
        },
        dataSlots: [],
    },
    ButtonIcon: {
        category: "action",
        props: {
            icon: { type: "string", required: true },
            text: { type: "string" },
            onClick: { type: "function" },
            disabled: { type: "boolean" },
        },
        dataSlots: [],
    },
    ButtonIcon2: {
        category: "action",
        props: {
            icon: { type: "string", required: true },
            text: { type: "string" },
            onClick: { type: "function" },
            disabled: { type: "boolean" },
        },
        dataSlots: [],
    },
    ButtonIcon3: {
        category: "action",
        props: {
            icon: { type: "string", required: true },
            text: { type: "string" },
            onClick: { type: "function" },
            disabled: { type: "boolean" },
        },
        dataSlots: [],
    },
    // DropdownPanel intentionally omitted: needs caller-managed
    // isOpen/onClose state + DropdownPanel.Header / .Divider
    // sub-components the composer can't model yet. Re-add when
    // we support component-local state for non-input primitives.

    // ─── Feedback ───────────────────────────────────────────────────
    Alert: {
        category: "feedback",
        props: {
            title: { type: "string" },
            message: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Alert2: {
        category: "feedback",
        props: {
            title: { type: "string" },
            message: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Alert3: {
        category: "feedback",
        props: {
            title: { type: "string" },
            message: { type: "string", required: true },
        },
        dataSlots: [],
    },
    EmptyState: {
        category: "feedback",
        props: {
            title: { type: "string", required: true },
            description: { type: "string" },
            children: { type: "ReactNode" },
        },
        dataSlots: [],
    },
    ErrorMessage: {
        category: "feedback",
        props: {
            message: { type: "string", required: true },
        },
        dataSlots: [],
    },
    Skeleton: {
        category: "feedback",
        props: {},
        dataSlots: [],
    },
    ProgressBar: {
        category: "feedback",
        props: {
            value: { type: "number", required: true },
            max: { type: "number" },
        },
        dataSlots: [],
    },
    ProgressBar2: {
        category: "feedback",
        props: {
            value: { type: "number", required: true },
            max: { type: "number" },
        },
        dataSlots: [],
    },
    ProgressBar3: {
        category: "feedback",
        props: {
            value: { type: "number", required: true },
            max: { type: "number" },
        },
        dataSlots: [],
    },
};

/**
 * Convenience: list of all component names in the schema (for tests +
 * the palette UI's iteration). Sorted for deterministic display order.
 */
export const SCHEMA_COMPONENT_NAMES = Object.keys(
    DASH_REACT_COMPONENT_SCHEMAS
).sort();

/**
 * Convenience: components grouped by category for the palette UI.
 * Each entry: { category, names: [name, name, ...] }, with names
 * sorted alphabetically within each category.
 */
export function getSchemasByCategory() {
    const groups = {};
    for (const [name, schema] of Object.entries(DASH_REACT_COMPONENT_SCHEMAS)) {
        // Skip components that exist in the schema for emitter
        // bookkeeping (so imports resolve when the emitter injects
        // them via a shim — MenuItem inside a wired Menu, etc.) but
        // shouldn't appear as user-droppable palette buttons.
        if (schema.hideFromPalette) continue;
        const cat = schema.category;
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(name);
    }
    for (const cat of Object.keys(groups)) {
        groups[cat].sort();
    }
    return groups;
}

/**
 * Lookup helper. Returns null for unknown names so the caller can
 * gracefully fall through (the composer should never render a
 * component the schema doesn't know).
 */
export function getComponentSchema(name) {
    if (typeof name !== "string") return null;
    return DASH_REACT_COMPONENT_SCHEMAS[name] || null;
}

/**
 * For input-category components, returns the auto-managed
 * value/onChange binding the composer should emit. Input components
 * always have their value backed by useState — the composer hides
 * those props from the wire UI and emits the state allocation +
 * onChange-to-setter wiring automatically. Other components return
 * null.
 *
 * Shape:
 *   { valueProp: "value" | "checked", changeProp: "onChange",
 *     defaultValue: '""' | "false" | "0" | "null" }
 *
 * `defaultValue` is a JS expression source the emitter drops into
 * `useState(...)` as-is.
 */
export function getInputBinding(name) {
    const schema = getComponentSchema(name);
    if (!schema) return null;
    const props = schema.props || {};

    // Selection-emitting display components (Menu / Menu2 / Menu3).
    // The component renders a list and fires onSelect with the chosen
    // item's value — same auto-state pattern as SearchInput, except
    // there's no JSX `value` prop to bind back (the selection isn't
    // displayed on the menu itself). Result: useState allocated,
    // onSelect binds to setter, no value-prop slot binding. Other
    // slots in the widget can reference the state var
    // (`menuSelected`, …) via the Code tab today; a pipe-source UI
    // for auto-state can land later without changing this shape.
    if (
        "onSelect" in props &&
        Array.isArray(schema.dataSlots) &&
        schema.dataSlots.includes("items")
    ) {
        return {
            valueProp: null,
            changeProp: "onSelect",
            defaultValue: "null",
            stateSuffix: "Selected",
        };
    }

    if (schema.category !== "input") return null;
    let valueProp = null;
    if ("value" in props) valueProp = "value";
    else if ("checked" in props) valueProp = "checked";
    if (!valueProp) return null;
    if (!("onChange" in props)) return null;
    const type = props[valueProp].type;
    let defaultValue = "null";
    if (type === "string") defaultValue = '""';
    else if (type === "number") defaultValue = "0";
    else if (type === "boolean") defaultValue = "false";
    return {
        valueProp,
        changeProp: "onChange",
        defaultValue,
        stateSuffix: "Value",
    };
}

/**
 * Whether a component has any data slots — quick test for the
 * composer's "this component needs wiring" badge in the tree view.
 */
export function hasDataSlots(name) {
    const schema = getComponentSchema(name);
    if (!schema) return false;
    return Array.isArray(schema.dataSlots) && schema.dataSlots.length > 0;
}

/**
 * Whether a component is expected to fill the cell it's dropped into
 * inside the composer's grid layout. True for containers (Panel,
 * Card, Container) and data-display components that benefit from
 * vertical room (Table, DataList); false for primitives like
 * Heading, Tag, SearchInput, Button — those render at content size
 * with whitespace below.
 *
 * The grid emitter consults this when sizing each row + cell wrapper
 * so the user gets sensible "Panel fills the canvas / Heading sits at
 * top" defaults without having to think about layout.
 */
export function componentFillsCell(name) {
    const schema = getComponentSchema(name);
    return Boolean(schema && schema.fillsCell);
}
