#!/bin/bash

# .env vars 
set -o allexport && source .env && set +o allexport

xcrun notarytool log a30e71a7-86dd-4cdb-8491-18d0fc528061 --apple-id $REACT_APP_APPLE_ID --password $REACT_APP_APPLE_PASSWORD --team-id $REACT_APP_APPLE_TEAM_ID