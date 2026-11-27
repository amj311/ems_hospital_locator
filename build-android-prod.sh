#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env.deploy"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: $ENV_FILE was not found." >&2
    exit 1
fi

# Load deployment settings from the same file used by deploy.sh.
set -a
source "$ENV_FILE"
set +a

if [[ -z "${BEACON_API_BASE_URL:-}" ]]; then
    echo "Error: Set BEACON_API_BASE_URL in .env.deploy (for example, https://api.example.com/api)." >&2
    exit 1
fi

export VITE_API_BASE_URL="$BEACON_API_BASE_URL"

echo "Building web assets with API URL: $BEACON_API_BASE_URL"
yarn build-only

echo "Syncing web assets and plugins to Android..."
npx cap sync android

echo "Building Android debug APK..."
(
    cd android
    ./gradlew assembleDebug "-PBEACON_API_BASE_URL=$BEACON_API_BASE_URL"
)

echo "Android APK built: $ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
