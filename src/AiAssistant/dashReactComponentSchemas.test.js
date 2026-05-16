/**
 * Drift detector for dashReactComponentSchemas (composer-facing
 * curated subset of dashReactComponentRegistry).
 *
 * Three invariants:
 *
 *   1. Drift: every schema entry name is also in DASH_REACT_COMPONENTS
 *      (the validator's source-of-truth registry). A fictional schema
 *      entry would surface a component in the composer palette that
 *      the validator then rejects post-emit — confusing the user.
 *
 *   2. Shape: every entry has a valid {category, props, dataSlots}
 *      shape, and every dataSlot name appears in props. The composer
 *      reads these fields directly; a malformed entry crashes the
 *      property inspector.
 *
 *   3. Helpers: the convenience exports (SCHEMA_COMPONENT_NAMES,
 *      getSchemasByCategory, getComponentSchema, hasDataSlots) return
 *      the expected shapes for at least one known entry. This guards
 *      against accidental refactors that break the composer's public
 *      surface without anyone touching the schemas themselves.
 *
 * Coverage is NOT enforced in the reverse direction (we do NOT
 * require every registry entry to have a schema) — the schemas file
 * is intentionally curated. See dashReactComponentSchemas.js header
 * for the two-files rationale.
 */
const { DASH_REACT_COMPONENTS } = require("./dashReactComponentRegistry");
const {
    DASH_REACT_COMPONENT_SCHEMAS,
    SCHEMA_COMPONENT_NAMES,
    getSchemasByCategory,
    getComponentSchema,
    hasDataSlots,
} = require("./dashReactComponentSchemas");

const VALID_CATEGORIES = new Set([
    "layout",
    "display",
    "input",
    "action",
    "feedback",
]);

describe("dashReactComponentSchemas — drift against dashReactComponentRegistry", () => {
    test("every schema entry name is also in the registry", () => {
        const fictional = Object.keys(DASH_REACT_COMPONENT_SCHEMAS).filter(
            (name) => !DASH_REACT_COMPONENTS.has(name)
        );
        if (fictional.length > 0) {
            throw new Error(
                `schemas contains components NOT in DASH_REACT_COMPONENTS: ${fictional.join(
                    ", "
                )}. Either add the export to dash-react (and then to the registry) or remove the schema entry — otherwise the composer surfaces a component the validator then rejects.`
            );
        }
    });
});

describe("dashReactComponentSchemas — entry shape", () => {
    test.each(Object.entries(DASH_REACT_COMPONENT_SCHEMAS))(
        "%s has a valid {category, props, dataSlots} shape",
        (name, schema) => {
            expect(VALID_CATEGORIES.has(schema.category)).toBe(true);
            expect(typeof schema.props).toBe("object");
            expect(schema.props).not.toBeNull();
            expect(Array.isArray(schema.dataSlots)).toBe(true);

            for (const [propName, propSchema] of Object.entries(schema.props)) {
                expect(typeof propName).toBe("string");
                expect(typeof propSchema).toBe("object");
                expect(propSchema).not.toBeNull();
                expect(typeof propSchema.type).toBe("string");
            }

            for (const slot of schema.dataSlots) {
                expect(typeof slot).toBe("string");
                if (!(slot in schema.props)) {
                    throw new Error(
                        `${name}.dataSlots references "${slot}" which is not a key in ${name}.props. Every dataSlot must be a wirable prop.`
                    );
                }
            }
        }
    );
});

describe("dashReactComponentSchemas — convenience helpers", () => {
    test("SCHEMA_COMPONENT_NAMES is the sorted list of schema keys", () => {
        const expected = Object.keys(DASH_REACT_COMPONENT_SCHEMAS).sort();
        expect(SCHEMA_COMPONENT_NAMES).toEqual(expected);
    });

    test("getSchemasByCategory groups names under each valid category", () => {
        const groups = getSchemasByCategory();
        const total = Object.values(groups).reduce(
            (sum, arr) => sum + arr.length,
            0
        );
        expect(total).toBe(Object.keys(DASH_REACT_COMPONENT_SCHEMAS).length);
        for (const cat of Object.keys(groups)) {
            expect(VALID_CATEGORIES.has(cat)).toBe(true);
            const sorted = [...groups[cat]].sort();
            expect(groups[cat]).toEqual(sorted);
        }
    });

    test("getComponentSchema returns the entry for a known name", () => {
        const table = getComponentSchema("Table");
        expect(table).not.toBeNull();
        expect(table.category).toBe("display");
        expect(table.dataSlots).toContain("data");
    });

    test("getComponentSchema returns null for unknown or non-string input", () => {
        expect(getComponentSchema("NotARealComponent")).toBeNull();
        expect(getComponentSchema(null)).toBeNull();
        expect(getComponentSchema(undefined)).toBeNull();
        expect(getComponentSchema(42)).toBeNull();
    });

    test("hasDataSlots discriminates wirable from static components", () => {
        expect(hasDataSlots("Table")).toBe(true);
        expect(hasDataSlots("Heading")).toBe(false);
        expect(hasDataSlots("NotARealComponent")).toBe(false);
    });
});
