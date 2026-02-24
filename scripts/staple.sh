#!/bin/bash

PATH_TO_DMG=$(pwd)/out/make/Dash.dmg

if [[ -e $PATH_TO_DMG ]]; then
    echo "We have a DMG file"
    xcrun stapler staple -v $PATH_TO_DMG
else
    echo "We do not have a dmg file, please run npm run package"
fi