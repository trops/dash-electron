/**
 * registryAuth.js
 *
 * Shared registry authentication and API utilities.
 * Used by publishToRegistry.js, publishThemes.js, publishKitchenSink.js,
 * and reinstallWidgets.js.
 *
 * Exports:
 *   authenticate(registryBaseUrl)  — OAuth device code flow, returns access token
 *   getScope(registryBaseUrl, token) — Fetch authenticated username
 *   publishToApi(registryBaseUrl, token, manifest, zipPath) — Upload ZIP + manifest
 *   deleteFromApi(registryBaseUrl, token, scope, name) — Delete a package
 *   getFormDataImpl() — FormData/File polyfill resolution
 *   sleep(ms) — Promise-based delay
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function authenticate(registryBaseUrl) {
    console.log("\nAuthenticating with the registry...");

    const initRes = await fetch(`${registryBaseUrl}/api/auth/device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });

    if (!initRes.ok) {
        console.error(
            `Error: Device flow initiation failed (HTTP ${initRes.status})`
        );
        process.exit(1);
    }

    const initData = await initRes.json();
    const { device_code, user_code, verification_uri_complete, interval } =
        initData;

    console.log(`\nOpening browser for authentication...`);
    console.log(`Code: ${user_code}`);
    console.log(`URL:  ${verification_uri_complete}\n`);

    try {
        execSync(`open "${verification_uri_complete}"`, { stdio: "ignore" });
    } catch {
        console.log(
            "Could not open browser automatically. Please visit the URL above."
        );
    }

    console.log("Waiting for authorization...");
    const maxAttempts = Math.ceil(900 / (interval || 5));
    const pollInterval = (interval || 5) * 1000;

    for (let i = 0; i < maxAttempts; i++) {
        await sleep(pollInterval);

        const pollRes = await fetch(
            `${registryBaseUrl}/api/auth/device?device_code=${encodeURIComponent(
                device_code
            )}`
        );

        if (pollRes.ok) {
            const data = await pollRes.json();
            console.log("Authorized!\n");
            return data.access_token;
        }

        if (pollRes.status === 428) {
            // authorization_pending — keep polling
            continue;
        }

        if (pollRes.status === 400) {
            const data = await pollRes.json();
            if (data.error === "expired_token") {
                console.error("Error: Device code expired. Please try again.");
                process.exit(1);
            }
            continue;
        }

        console.error(
            `Error: Unexpected poll response (HTTP ${pollRes.status})`
        );
        process.exit(1);
    }

    console.error("Error: Authorization timed out. Please try again.");
    process.exit(1);
}

async function getScope(registryBaseUrl, token) {
    const res = await fetch(`${registryBaseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        console.error(
            `Error: Could not fetch user profile (HTTP ${res.status}). Make sure you are registered at the registry website.`
        );
        process.exit(1);
    }

    const data = await res.json();
    return data.user.username;
}

async function getFormDataImpl() {
    if (
        typeof globalThis.FormData !== "undefined" &&
        typeof globalThis.File !== "undefined"
    ) {
        return { FormData: globalThis.FormData, File: globalThis.File };
    }
    const undici = await import("undici");
    return { FormData: undici.FormData, File: undici.File };
}

async function publishToApi(registryBaseUrl, token, manifest, zipPath) {
    const zipBuffer = fs.readFileSync(zipPath);
    const zipFileName = path.basename(zipPath);

    const { FormData, File } = await getFormDataImpl();
    const form = new FormData();
    form.append(
        "file",
        new File([zipBuffer], zipFileName, { type: "application/zip" })
    );
    form.append("manifest", JSON.stringify(manifest));

    const res = await fetch(`${registryBaseUrl}/api/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });

    const data = await res.json();

    if (!res.ok) {
        return {
            success: false,
            error: data.error || `HTTP ${res.status}`,
            details: data.details,
        };
    }

    return { success: true, ...data };
}

async function deleteFromApi(registryBaseUrl, token, scope, name) {
    const res = await fetch(
        `${registryBaseUrl}/api/packages/${encodeURIComponent(
            scope
        )}/${encodeURIComponent(name)}`,
        {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        }
    );

    if (res.status === 404) {
        return { success: true, notFound: true };
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
            success: false,
            error: data.error || `HTTP ${res.status}`,
        };
    }

    return { success: true };
}

module.exports = {
    sleep,
    authenticate,
    getScope,
    getFormDataImpl,
    publishToApi,
    deleteFromApi,
};
