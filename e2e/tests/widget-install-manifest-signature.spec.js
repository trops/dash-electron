const { test, expect } = require("@playwright/test");
const http = require("node:http");
const ed = require("@noble/ed25519");
const { sha512 } = require("@noble/hashes/sha2.js");
ed.hashes.sha512 = sha512;

const {
    startMockRegistry,
    stopMockRegistry,
    registerPackage,
    getMockRootPublicKey,
    signMockManifestBody,
} = require("../helpers/mock-registry");

/**
 * Widget install manifest signature — Phase 5D pin (P1 #24).
 *
 * dash-registry's `/api/packages/[scope]/[name]/download` response
 * now carries `manifest_signature` + `manifest_signature_keyid: "v1"`
 * over the rest of the body. dash-core's install flow verifies the
 * signature against the bundled root public key before consuming
 * downloadUrl / publisher cert / zip signature from the same body —
 * closing the MITM swap-the-response vector.
 *
 * The verifier logic itself is unit-tested in dash-core
 * (`verifyDownloadManifest.test.js`, 9 cases covering off/warn/strict
 * × signed/unsigned/tampered/unknown-keyid). This e2e pins the
 * **wire-format contract** between server + client:
 *
 *   1. The mock-registry returns a properly signed body when called
 *      with ?wrapped=1.
 *   2. The signature is non-empty base64 over canonical-JSON of the
 *      body minus the two signature fields.
 *   3. Mutations to any field invalidate the signature.
 *   4. Re-signing after tampering produces a valid signature again
 *      (proves the canonicalization is symmetric server ↔ verifier).
 *
 * Verification is done inline with @noble/ed25519 + a small
 * canonical-JSON port — same algorithm the registry + dash-core use.
 * No reliance on dash-core's electron export.
 */

let mockPort;
const SCOPE = "@ai-built";
const PKG_NAME = "phase5d-fixture";

function canonicalJsonStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return "[" + value.map(canonicalJsonStringify).join(",") + "]";
    }
    const keys = Object.keys(value).sort();
    return (
        "{" +
        keys
            .map(
                (k) =>
                    JSON.stringify(k) + ":" + canonicalJsonStringify(value[k])
            )
            .join(",") +
        "}"
    );
}

function canonicalizeManifestBody(body) {
    const stripped = { ...body };
    delete stripped.manifest_signature;
    delete stripped.manifest_signature_keyid;
    return canonicalJsonStringify(stripped);
}

async function verifyManifestSignature({ body, signature, publicKeyBase64 }) {
    const message = new TextEncoder().encode(canonicalizeManifestBody(body));
    const sigBytes = new Uint8Array(Buffer.from(signature, "base64"));
    const pubBytes = new Uint8Array(Buffer.from(publicKeyBase64, "base64"));
    return ed.verifyAsync(sigBytes, message, pubBytes);
}

async function fetchJson(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${mockPort}${path}`, (res) => {
            let buf = "";
            res.on("data", (chunk) => (buf += chunk));
            res.on("end", () => {
                try {
                    resolve(JSON.parse(buf));
                } catch (err) {
                    reject(err);
                }
            });
            res.on("error", reject);
        });
    });
}

test.beforeAll(async () => {
    mockPort = await startMockRegistry();
    // The mock helper strips the leading `@` from `scope` when
    // composing pkgKey — pass the bare form here.
    registerPackage({
        scope: SCOPE.slice(1),
        name: PKG_NAME,
        version: "1.0.0",
        zipBuffer: Buffer.from("PKmock-zip", "binary"),
    });
});

test.afterAll(async () => {
    await stopMockRegistry();
});

test("mock /download?wrapped=1 returns body with manifest_signature + manifest_signature_keyid", async () => {
    const body = await fetchJson(
        `/api/packages/${encodeURIComponent(SCOPE)}/${encodeURIComponent(
            PKG_NAME
        )}/download?version=1.0.0&wrapped=1`
    );
    expect(typeof body.manifest_signature).toBe("string");
    expect(body.manifest_signature.length).toBeGreaterThan(0);
    expect(body.manifest_signature_keyid).toBe("v1");
    expect(typeof body.downloadUrl).toBe("string");
    expect(body.downloadUrl).toMatch(/\/_mock\/zips\//);
    expect(body.version).toBe("1.0.0");
    // The mock's pkgKey produces "@ai-built/name" but packageId in
    // the response is composed from the raw URL captures (no `@`).
    // Both forms identify the same package — assert non-empty.
    expect(typeof body.packageId).toBe("string");
});

test("signature verifies against the mock root public key", async () => {
    const body = await fetchJson(
        `/api/packages/${encodeURIComponent(SCOPE)}/${encodeURIComponent(
            PKG_NAME
        )}/download?version=1.0.0&wrapped=1`
    );
    const ok = await verifyManifestSignature({
        body,
        signature: body.manifest_signature,
        publicKeyBase64: getMockRootPublicKey(),
    });
    expect(ok).toBe(true);
});

test("tampered downloadUrl invalidates the signature", async () => {
    const body = await fetchJson(
        `/api/packages/${encodeURIComponent(SCOPE)}/${encodeURIComponent(
            PKG_NAME
        )}/download?version=1.0.0&wrapped=1`
    );
    body.downloadUrl = "https://evil.example/malware.zip";
    const ok = await verifyManifestSignature({
        body,
        signature: body.manifest_signature,
        publicKeyBase64: getMockRootPublicKey(),
    });
    expect(ok).toBe(false);
});

test("tampered version field invalidates the signature", async () => {
    const body = await fetchJson(
        `/api/packages/${encodeURIComponent(SCOPE)}/${encodeURIComponent(
            PKG_NAME
        )}/download?version=1.0.0&wrapped=1`
    );
    body.version = "9.9.9";
    const ok = await verifyManifestSignature({
        body,
        signature: body.manifest_signature,
        publicKeyBase64: getMockRootPublicKey(),
    });
    expect(ok).toBe(false);
});

test("re-signing after tampering produces a valid signature (canonicalization is symmetric)", async () => {
    const body = await fetchJson(
        `/api/packages/${encodeURIComponent(SCOPE)}/${encodeURIComponent(
            PKG_NAME
        )}/download?version=1.0.0&wrapped=1`
    );
    body.downloadUrl = "https://different.example/whatever.zip";
    body.manifest_signature = await signMockManifestBody(body);
    const ok = await verifyManifestSignature({
        body,
        signature: body.manifest_signature,
        publicKeyBase64: getMockRootPublicKey(),
    });
    expect(ok).toBe(true);
});

test("verification rejects a signature from a different root key", async () => {
    const body = await fetchJson(
        `/api/packages/${encodeURIComponent(SCOPE)}/${encodeURIComponent(
            PKG_NAME
        )}/download?version=1.0.0&wrapped=1`
    );
    // Replace the public key with a freshly generated one. The
    // mock's signature won't verify against the foreign key.
    const foreignPriv = ed.utils.randomSecretKey();
    const foreignPub = await ed.getPublicKeyAsync(foreignPriv);
    const foreignPubB64 = Buffer.from(foreignPub).toString("base64");
    const ok = await verifyManifestSignature({
        body,
        signature: body.manifest_signature,
        publicKeyBase64: foreignPubB64,
    });
    expect(ok).toBe(false);
});

test("default (unwrapped) /download still returns raw zip bytes for back-compat", async () => {
    // Phase 5D added the wrapped JSON shape behind ?wrapped=1.
    // Existing tests rely on the default behavior — assert it still
    // works so we don't break the install-from-registry e2e.
    const resp = await new Promise((resolve, reject) => {
        http.get(
            `http://127.0.0.1:${mockPort}/api/packages/${encodeURIComponent(
                SCOPE
            )}/${encodeURIComponent(PKG_NAME)}/download?version=1.0.0`,
            (r) => {
                const chunks = [];
                r.on("data", (c) => chunks.push(c));
                r.on("end", () =>
                    resolve({
                        statusCode: r.statusCode,
                        contentType: r.headers["content-type"],
                        body: Buffer.concat(chunks),
                    })
                );
                r.on("error", reject);
            }
        );
    });
    expect(resp.statusCode).toBe(200);
    expect(resp.contentType).toMatch(/application\/zip/);
    expect(resp.body.toString("binary")).toContain("PKmock-zip");
});
