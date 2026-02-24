/**
 * Forge
 * Some configuration options have been commented out due to the scripts not working.
 * Specifically the osxNotarize configuration will work, but sporadically due to the file not
 * being uploaded to Apple successfully and will 9/10 times error out. I have included incstructions
 * in the README for packaging and notarizing the .dmg file that is generated from the npm run package script.
 *
 * For Windows compilation there is another process entirely that requires a Windows machine or some other tooling such as
 * a Docker container, etc to setup a VM for compilation. (TBD)
 */
const packageJson = require("./package.json");
require("dotenv").config();

module.exports = {
    packagerConfig: {
        name: process.env.REACT_APP_PACKAGE_NAME,
        osxSign: {
            identity: process.env.REACT_APP_APPLE_CERT_ID,
            optionsForFile: () => ({
                entitlements: "entitlements.plist",
                signatureFlags: "library",
            }),
        },
        // osxNotarize: {
        //     tool: "notarytool",
        //     appleId: process.env.REACT_APP_APPLE_ID,
        //     appleIdPassword: process.env.REACT_APP_APPLE_PASSWORD,
        //     teamId: process.env.REACT_APP_APPLE_TEAM_ID,
        // },
    },
    makers: [
        // Windows
        // {
        //     name: "@electron-forge/maker-squirrel",
        //     config: {
        //         name: process.env.REACT_APP_APP_NAME,
        //     },
        // },
        {
            name: "@electron-forge/maker-dmg",
            platforms: ["darwin"],
            config: {
                name: process.env.REACT_APP_APP_NAME,
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
            platforms: ["darwin"],
            config: {
                repository: {
                    owner: process.env.REACT_APP_GITHUB_USER, // github username
                    name: process.env.REACT_APP_GITHUB_REPO, // name of your github repo
                },
                authToken: process.env.REACT_APP_GITHUB_TOKEN, // github auth token created
                prerelease: true,
                draft: true,
            },
        },
    ],
};
