/**
 * Forge Configuration
 *
 * Code signing is conditional on env vars — when absent, builds
 * remain unsigned (local dev path).
 *
 * macOS:
 * - Set REACT_APP_APPLE_CERT_ID to enable osxSign
 * - Set REACT_APP_APPLE_ID, REACT_APP_APPLE_PASSWORD, REACT_APP_APPLE_TEAM_ID to enable notarization
 *
 * Windows (Phase 4B):
 * - Set WINDOWS_CERTIFICATE_PATH to a .pfx file path to enable
 *   maker-squirrel signing
 * - Set WINDOWS_CERTIFICATE_PASSWORD to the PFX password
 * - In CI, the "Install Windows certificate" step in
 *   .github/workflows/release-app.yml decodes the
 *   WINDOWS_CERTIFICATE_BASE64 secret into a temp .pfx file and
 *   exports WINDOWS_CERTIFICATE_PATH + WINDOWS_CERTIFICATE_PASSWORD
 *   to the build environment.
 */
const packageJson = require("./package.json");
require("dotenv").config();

module.exports = {
    packagerConfig: {
        asar: {
            unpack: "{**/node_modules/@esbuild/**,**/node_modules/esbuild/**}",
        },
        // Tell @electron/universal which unpacked files are arch-specific
        // so the x64+arm64 stitcher keeps both esbuild binaries
        osxUniversal: {
            x64ArchFiles:
                "{Contents/Resources/app.asar.unpacked/node_modules/@esbuild/**,Contents/Resources/app.asar.unpacked/node_modules/esbuild/**}",
        },
        name: process.env.REACT_APP_PACKAGE_NAME,
        icon: "./assets/icons/icon",
        ...(process.env.REACT_APP_APPLE_CERT_ID
            ? {
                  osxSign: {
                      identity: process.env.REACT_APP_APPLE_CERT_ID,
                      optionsForFile: () => ({
                          entitlements: "entitlements.plist",
                          signatureFlags: "library",
                      }),
                  },
              }
            : {}),
        ...(process.env.REACT_APP_APPLE_ID
            ? {
                  osxNotarize: {
                      tool: "notarytool",
                      appleId: process.env.REACT_APP_APPLE_ID,
                      appleIdPassword: process.env.REACT_APP_APPLE_PASSWORD,
                      teamId: process.env.REACT_APP_APPLE_TEAM_ID,
                  },
              }
            : {}),
    },
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            platforms: ["win32"],
            config: {
                name: process.env.REACT_APP_APP_NAME,
                iconUrl:
                    "https://raw.githubusercontent.com/trops/dash-electron/master/assets/icons/icon.ico",
                setupIcon: "./assets/icons/icon.ico",
                // Windows code-signing (Phase 4B). Active iff the
                // workflow's "Install Windows certificate" step has
                // decoded the WINDOWS_CERTIFICATE_BASE64 secret to a
                // temp .pfx and exported the path + password. Local
                // builds without these env vars produce an unsigned
                // installer — same as the pre-Phase-4B behavior.
                //
                // If WINDOWS_CERTIFICATE_BASE64 is set in secrets but
                // the decode step fails (truncated, wrong format),
                // the CI step errors loudly — silently shipping
                // unsigned when signing was expected is the worse
                // failure mode.
                ...(process.env.WINDOWS_CERTIFICATE_PATH
                    ? {
                          certificateFile: process.env.WINDOWS_CERTIFICATE_PATH,
                          certificatePassword:
                              process.env.WINDOWS_CERTIFICATE_PASSWORD,
                      }
                    : {}),
            },
        },
        {
            name: "@electron-forge/maker-dmg",
            platforms: ["darwin"],
            config: {
                name: process.env.REACT_APP_APP_NAME,
                icon: "./assets/icons/icon.icns",
                format: "ULFO",
                overwrite: true,
            },
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["darwin"],
        },
    ],
    publishers: [
        {
            name: "@electron-forge/publisher-github",
            platforms: ["darwin", "win32"],
            config: {
                repository: {
                    owner: process.env.REACT_APP_GITHUB_USER, // github username
                    name: process.env.REACT_APP_GITHUB_REPO, // name of your github repo
                },
                authToken: process.env.REACT_APP_GITHUB_TOKEN, // github auth token created
                prerelease: false,
                draft: false,
            },
        },
    ],
};
