#!/bin/bash

# .env vars 
set -o allexport && source .env && set +o allexport

xcrun notarytool history --apple-id \"$REACT_APP_APPLE_ID\" --password \"$REACT_APP_APPLE_PASSWORD\" --team-id \"$REACT_APP_APPLE_TEAM_ID\"