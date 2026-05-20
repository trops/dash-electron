/**
 * widgetOwnership — security-relevant boundary tests.
 *
 * The Update Original toggle in WidgetBuilderModal lets the signed-in
 * user publish over the widget they're editing. If isOwner is wrong,
 * the user gets to write to a package they don't own. False positives
 * here mean cross-account writes; false negatives mean an annoying
 * "Remix only" footer.
 *
 * These tests are weighted toward the negative space — far more cases
 * for "should NOT be owner" than for "should be owner". Any future
 * change to the matching logic must keep all of these green.
 */

import { deriveWidgetOwnership, deriveWidgetScope } from "./widgetOwnership";

// ─── deriveWidgetScope — scope extraction from the three accepted shapes ───

describe("deriveWidgetScope", () => {
    test("@scope/package — canonical npm form", () => {
        expect(
            deriveWidgetScope({ originalPackage: "@trops/dash-samples" })
        ).toBe("trops");
    });

    test("scope/package — npm form missing @", () => {
        expect(
            deriveWidgetScope({ originalPackage: "trops/dash-samples" })
        ).toBe("trops");
    });

    test("falls back to first dot-segment of originalComponentName", () => {
        expect(
            deriveWidgetScope({
                originalPackage: null,
                originalComponentName: "trops.dash-samples.ThemeViewerWidget",
            })
        ).toBe("trops");
    });

    test("originalPackage wins over originalComponentName when both present", () => {
        // Anchor: if the host passes both, the package field is the
        // authoritative source — the component name is just a
        // fallback.
        expect(
            deriveWidgetScope({
                originalPackage: "@trops/dash-samples",
                originalComponentName: "evil.fake.Widget",
            })
        ).toBe("trops");
    });

    test("returns null when no shape matches", () => {
        expect(
            deriveWidgetScope({
                originalPackage: "ThemeViewerWidget", // no slash, no dot
                originalComponentName: "ThemeViewerWidget", // no dot
            })
        ).toBe(null);
    });

    test("returns null for null / undefined / non-string input", () => {
        expect(deriveWidgetScope({})).toBe(null);
        expect(deriveWidgetScope({ originalPackage: null })).toBe(null);
        expect(deriveWidgetScope({ originalPackage: 42 })).toBe(null);
        expect(deriveWidgetScope({ originalComponentName: {} })).toBe(null);
    });

    test("doesn't strip more than the scope — package + version stay out of the scope match", () => {
        // For "@trops/dash-samples@1.0.0", the scope is still "trops"
        // — the @ that precedes the version doesn't pollute the
        // match because the regex stops at the first slash.
        expect(
            deriveWidgetScope({
                originalPackage: "@trops/dash-samples@1.0.0",
            })
        ).toBe("trops");
    });
});

// ─── deriveWidgetOwnership — the security-relevant boolean ───

describe("deriveWidgetOwnership — POSITIVE cases (isOwner === true)", () => {
    test("@ai-built/* — always owner regardless of username", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "@ai-built/my-widget",
                registryUsername: null,
            }).isOwner
        ).toBe(true);
        expect(
            deriveWidgetOwnership({
                originalPackage: "@ai-built/my-widget",
                registryUsername: "someone-else",
            }).isOwner
        ).toBe(true);
        // Even without a package — falls back to component name.
        expect(
            deriveWidgetOwnership({
                originalComponentName: "ai-built.my-widget.MyWidget",
                registryUsername: null,
            }).isOwner
        ).toBe(true);
    });

    test("exact scope/username match — base case", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/dash-samples",
                registryUsername: "trops",
            }).isOwner
        ).toBe(true);
    });

    test("case-insensitive: username 'Trops' on '@trops/foo'", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/dash-samples",
                registryUsername: "Trops",
            }).isOwner
        ).toBe(true);
    });

    test("case-insensitive: scope '@TROPS/foo' with username 'trops'", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "@TROPS/dash-samples",
                registryUsername: "trops",
            }).isOwner
        ).toBe(true);
    });

    test("strips a leading @ from registryUsername (display convention)", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/dash-samples",
                registryUsername: "@trops",
            }).isOwner
        ).toBe(true);
    });

    test("non-@ package form: 'trops/dash-samples' with username 'trops'", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "trops/dash-samples",
                registryUsername: "trops",
            }).isOwner
        ).toBe(true);
    });

    test("dotted-componentName fallback: 'trops.dash-samples.X' with username 'trops'", () => {
        expect(
            deriveWidgetOwnership({
                originalComponentName: "trops.dash-samples.ThemeViewerWidget",
                registryUsername: "trops",
            }).isOwner
        ).toBe(true);
    });
});

describe("deriveWidgetOwnership — NEGATIVE cases (isOwner === false, security boundary)", () => {
    test("different username — basic mismatch", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/dash-samples",
                registryUsername: "someone-else",
            }).isOwner
        ).toBe(false);
    });

    test("username is a SUBSTRING of scope — must reject", () => {
        // A user with username "trop" must NOT match scope "trops".
        // Substring matches are a classic ownership-confusion vector
        // and the strict-equality check below the normalization
        // layer is what blocks them.
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/foo",
                registryUsername: "trop",
            }).isOwner
        ).toBe(false);
    });

    test("scope is a SUBSTRING of username — must reject", () => {
        // Inverse of above: "trops-official" username with scope
        // "trops" must NOT match.
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/foo",
                registryUsername: "trops-official",
            }).isOwner
        ).toBe(false);
    });

    test("username with trailing whitespace — strict equality rejects", () => {
        // We deliberately do not trim. If a registry returns "trops "
        // (with whitespace), that's the registry's bug to fix; we
        // reject the match rather than silently massaging values
        // that might come from elsewhere.
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/foo",
                registryUsername: "trops ",
            }).isOwner
        ).toBe(false);
    });

    test("username with internal whitespace — strict equality rejects", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/foo",
                registryUsername: "tr ops",
            }).isOwner
        ).toBe(false);
    });

    test("Unicode lookalike (Cyrillic 'а') must NOT match Latin 'a'", () => {
        // Cyrillic 'а' (U+0430) looks identical to Latin 'a' but is
        // a different code point. JavaScript === is bytewise, so
        // they don't match — confirming we're not doing any
        // normalization that would conflate them.
        const cyrillicA = "trаops"; // 'trаops' visually but the 'а' is Cyrillic
        expect(
            deriveWidgetOwnership({
                originalPackage: "@traops/foo",
                registryUsername: cyrillicA,
            }).isOwner
        ).toBe(false);
    });

    test("registryUsername null — never owner (except @ai-built)", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/foo",
                registryUsername: null,
            }).isOwner
        ).toBe(false);
    });

    test("registryUsername empty string — never owner", () => {
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/foo",
                registryUsername: "",
            }).isOwner
        ).toBe(false);
    });

    test("registryUsername of just '@' — strips to empty, not owner", () => {
        // Edge: "@" alone normalizes to "" which then equals only
        // empty scope (impossible). Safe.
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/foo",
                registryUsername: "@",
            }).isOwner
        ).toBe(false);
    });

    test("widgetScope unresolvable — never owner", () => {
        // No package, no dotted name, no scope. Even with a valid
        // username, can't claim ownership of nothing.
        expect(
            deriveWidgetOwnership({
                originalPackage: null,
                originalComponentName: null,
                registryUsername: "trops",
            }).isOwner
        ).toBe(false);
    });

    test("widgetScope = empty string after extraction — never owner", () => {
        // Construct a pathological "@/foo" — the scope between @ and
        // / is empty. Even with empty username it must NOT be
        // considered a match (would let null-vs-null pass).
        const result = deriveWidgetOwnership({
            originalPackage: "@/foo",
            registryUsername: "",
        });
        expect(result.isOwner).toBe(false);
    });

    test("scope 'ai-built' literal match in dotted form — always owner", () => {
        // Confirm dotted form still respects the ai-built rule.
        expect(
            deriveWidgetOwnership({
                originalComponentName: "ai-built.foo.Bar",
                registryUsername: "anyone",
            }).isOwner
        ).toBe(true);
    });

    test("'AI-BUILT' (uppercase) — case-insensitive ai-built check still wins", () => {
        // The @ai-built/ always-owner rule normalizes via lowercase
        // so the user can't accidentally lose the @ai-built
        // workspace by uppercasing.
        expect(
            deriveWidgetOwnership({
                originalPackage: "@AI-BUILT/foo",
                registryUsername: null,
            }).isOwner
        ).toBe(true);
    });

    test("registryUsername equals literal 'ai-built' but scope is different — NOT owner", () => {
        // A user whose registry name is literally "ai-built" doesn't
        // get to update @trops/foo. The ai-built rule is about
        // scope, not username.
        expect(
            deriveWidgetOwnership({
                originalPackage: "@trops/foo",
                registryUsername: "ai-built",
            }).isOwner
        ).toBe(false);
    });
});

describe("deriveWidgetOwnership — return shape", () => {
    test("returns both widgetScope and isOwner together", () => {
        const result = deriveWidgetOwnership({
            originalPackage: "@trops/dash-samples",
            registryUsername: "trops",
        });
        expect(result).toEqual({
            widgetScope: "trops",
            isOwner: true,
        });
    });

    test("widgetScope is null when nothing matched, isOwner is false", () => {
        const result = deriveWidgetOwnership({
            originalPackage: null,
            originalComponentName: null,
            registryUsername: "trops",
        });
        expect(result).toEqual({
            widgetScope: null,
            isOwner: false,
        });
    });
});
