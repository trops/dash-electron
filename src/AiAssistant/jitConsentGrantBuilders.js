/**
 * jitConsentGrantBuilders
 *
 * Pure constructors for the grant blobs JitConsentModal sends back to
 * the main process when the user approves a JIT consent prompt.
 *
 * Slice 4 (per-action scoping): every fs/network grant carries an
 * explicit `actions: [action]` array alongside the path/host scope.
 * Without it, the gate's slice-4 allowlist falls back to legacy
 * "any-action" semantics, defeating the point of per-action consent.
 * These builders are the single source of truth for writing the
 * field — the modal calls into them rather than constructing inline,
 * so a future schema change (or refactor that forgets the field) is
 * caught by the unit tests.
 *
 * CommonJS so `node --test` can require directly. Webpack handles
 * import interop when JitConsentModal does `import { ... }`.
 */

function buildFsFilenameGrant({ action, filename, isWrite }) {
    return {
        grantOrigin: "live",
        domains: {
            fs: {
                actions: [action],
                readPaths: !isWrite ? [filename] : [],
                writePaths: isWrite ? [filename] : [],
            },
        },
    };
}

function buildFsAnyGrant({ action, isWrite }) {
    return {
        grantOrigin: "live",
        domains: {
            fs: {
                actions: [action],
                readPaths: !isWrite ? ["*"] : [],
                writePaths: isWrite ? ["*"] : [],
            },
        },
    };
}

function buildNetHostGrant({ action, host }) {
    return {
        grantOrigin: "live",
        domains: {
            network: {
                actions: [action],
                hosts: [host],
            },
        },
    };
}

function buildNetSubdomainGrant({ action, pattern }) {
    return {
        grantOrigin: "live",
        domains: {
            network: {
                actions: [action],
                hosts: [pattern],
            },
        },
    };
}

function buildNetAnyGrant({ action }) {
    return {
        grantOrigin: "live",
        domains: {
            network: {
                actions: [action],
                hosts: ["*"],
            },
        },
    };
}

module.exports = {
    buildFsFilenameGrant,
    buildFsAnyGrant,
    buildNetHostGrant,
    buildNetSubdomainGrant,
    buildNetAnyGrant,
};
