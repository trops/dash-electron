module.exports = {
    packagerConfig: {
        name: "<Package Name>",
        osxSign: {
            identity: "<DEVELOPER-ID-FROM-CERT>",
            "hardened-runtime": true,
            entitlements: "entitlements.plist",
            "entitlements-inherit": "entitlements.plist",
            "signature-flags": "library",
        },
        // osxNotarize: {
        //     tool: "notarytool",
        //     appleId: process.env.REACT_APP_APPLE_ID,
        //     appleIdPassword: process.env.REACT_APP_APPLE_PASSWORD,
        //     teamId: process.env.REACT_APP_APPLE_TEAM_ID,
        // },
    },
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {
                name: "<APP-NAME>",
            },
        },
        {
            name: "@electron-forge/maker-dmg",
            config: {
                name: "<APP-NAME>",
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
            config: {
                repository: {
                    owner: "<GITHUB-USER>",
                    name: "<REPO-NAME>",
                },
                authToken: "<GITHUB-AUTH-TOKEN>",
                prerelease: true,
            },
        },
    ],
};
