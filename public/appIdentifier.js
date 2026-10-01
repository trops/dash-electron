/**
 * appIdentifier.js — the app id the main process uses to locate the user's
 * data (providers.json, etc. under userData/Dashboard/<appId>/).
 *
 * `.env` sets REACT_APP_IDENTIFIER=$npm_package_name. CRA expands that for the
 * renderer, but the main process loads .env with plain dotenv (no variable
 * expansion), so in dev the value arrives as the literal "$npm_package_name".
 * Treat any unexpanded `$…` value as unset and fall back to the package name.
 * Pure — no electron import.
 */
"use strict";

const DEFAULT_APP_ID = "@trops/dash-electron";

function resolveAppIdentifier(env = process.env, packageName = null) {
    const fromEnv = env && env.REACT_APP_IDENTIFIER;
    if (typeof fromEnv === "string" && fromEnv && !fromEnv.startsWith("$")) {
        return fromEnv;
    }
    if (typeof packageName === "string" && packageName) return packageName;
    return DEFAULT_APP_ID;
}

module.exports = { resolveAppIdentifier, DEFAULT_APP_ID };
