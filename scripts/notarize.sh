#!/bin/bash

# .env vars 
set -o allexport && source .env && set +o allexport

# path to the .dmg file
PATH_TO_DMG=$(pwd)/out/make/Dash.dmg

echo $PATH_TO_DMG $REACT_APP_APPLE_ID $REACT_APP_APPLE_PASSWORD $REACT_APP_APPLE_TEAM_ID

if [[ -e $PATH_TO_DMG ]]; then
    echo "We have a DMG file"
    xcrun notarytool submit --verbose --apple-id $REACT_APP_APPLE_ID --password $REACT_APP_APPLE_PASSWORD --team-id $REACT_APP_APPLE_TEAM_ID $PATH_TO_DMG
else
    echo "We do not have a dmg file, please run npm run package"
fi