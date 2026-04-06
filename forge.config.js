/**
 * Forge Configuration
 *
 * Code signing (osxSign) and notarization (osxNotarize) are conditional:
 * - Set REACT_APP_APPLE_CERT_ID in .env to enable signing
 * - Set REACT_APP_APPLE_ID, REACT_APP_APPLE_PASSWORD, REACT_APP_APPLE_TEAM_ID to enable notarization
 * - When credentials are absent, builds remain unsigned (local dev)
 */
const packageJson = require("./package.json");
require("dotenv").config();

module.exports = {
    packagerConfig: {
        asar: {
            unpack: "{**/node_modules/@esbuild/**,**/node_modules/esbuild/**}",
        },
        // Tell the universal (x64+arm64) stitcher which unpacked files are x64-only
        // so it keeps both arch binaries side by side instead of failing on merge
        x64ArchFiles:
            "Contents/Resources/app.asar.unpacked/node_modules/@esbuild/**",
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
