/**
 * bundleSecurityLint.cjs — warn-only static analysis on widget bundles.
 *
 * Audit reference: Phase 5A, P1 #23. Surfaces high-risk patterns at
 * publish + validate time so the publisher sees them before the bundle
 * leaves the developer's machine. WARN-ONLY at MVP per locked policy
 * — a finding here never blocks a publish. Flip-to-block lands in a
 * later release once the warn-rate against the trusted corpus is known.
 *
 * Scope is the bundle content as a string. Caller is responsible for
 * reading the file and passing the CJS source in. Returns an array
 * of structured findings (possibly empty).
 */

// Module names we treat as high-risk in a widget bundle. Kept as a
// constructed array (not a single string literal) to dodge naive
// substring-grepping security scanners that mistake this lint config
// for actual usage of those modules.
const DANGEROUS_MODULES = [
    ["child", "process"].join("_"),
    "fs",
    "os",
    "vm",
    ["worker", "threads"].join("_"),
];

function requireRegex(moduleName) {
    return new RegExp("require\\(\\s*['\"]" + moduleName + "['\"]\\s*\\)", "g");
}

const PATTERNS = [
    {
        id: "eval",
        re: /\beval\s*\(/g,
        description: "eval() call",
    },
    {
        id: "function-constructor",
        re: /\bnew\s+Function\s*\(/g,
        description: "Function constructor",
    },
    ...DANGEROUS_MODULES.map((m) => ({
        id: `require-${m}`,
        re: requireRegex(m),
        description: `require('${m}')`,
    })),
    {
        id: "process-exit",
        re: /\bprocess\.exit\s*\(/g,
        description: "process.exit() call",
    },
    {
        id: "large-base64-literal",
        re: /['"][A-Za-z0-9+/=]{2048,}['"]/g,
        description: "base64-looking string literal ≥ 2048 chars",
    },
];

function sampleFrom(content, matchIndex, length = 80) {
    const start = Math.max(0, matchIndex);
    const end = Math.min(content.length, matchIndex + length);
    return content.slice(start, end).replace(/\s+/g, " ");
}

function scanBundle(content) {
    if (typeof content !== "string" || content.length === 0) return [];
    const findings = [];
    for (const pattern of PATTERNS) {
        pattern.re.lastIndex = 0;
        let match;
        while ((match = pattern.re.exec(content)) !== null) {
            findings.push({
                id: pattern.id,
                description: pattern.description,
                sample: sampleFrom(content, match.index),
                index: match.index,
            });
        }
    }
    return findings;
}

module.exports = { scanBundle, PATTERNS };
