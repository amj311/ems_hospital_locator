#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ -f .env.deploy ]]; then
	set -a
	source .env.deploy
	set +a
fi

: "${SSH_USER:?Set SSH_USER in .env.deploy}"
: "${SSH_HOST:?Set SSH_HOST in .env.deploy}"

VERBOSE="${1:-}"
OUT=/dev/null
if [[ "$VERBOSE" == "-v" ]]; then
	OUT=/dev/stdout
fi

SSH_TARGET="${SSH_USER}@${SSH_HOST}"
REMOTE_HOME="$(ssh "$SSH_TARGET" 'printf "%s" "$HOME"')"
if [[ -z "$REMOTE_HOME" || "$REMOTE_HOME" != /* ]]; then
	echo "Error: Could not determine an absolute home directory for $SSH_TARGET" >&2
	exit 1
fi
REMOTE_DOWNLOAD_DIR="$REMOTE_HOME/beacon-downloads"
export ANDROID_DOWNLOADS_DIR="$REMOTE_DOWNLOAD_DIR"
APK_PATH="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

echo "Building Android app with the production API URL..."
"$ROOT_DIR/build-android-prod.sh"

if [[ ! -s "$APK_PATH" ]]; then
	echo "Error: Android APK is missing or empty at $APK_PATH" >&2
	exit 1
fi

echo "Copying Android APK to the production host..."
ssh "$SSH_TARGET" "mkdir -p '$REMOTE_DOWNLOAD_DIR'"
scp "$APK_PATH" "$SSH_TARGET:$REMOTE_DOWNLOAD_DIR/android-latest.apk.tmp"
ssh "$SSH_TARGET" "mv '$REMOTE_DOWNLOAD_DIR/android-latest.apk.tmp' '$REMOTE_DOWNLOAD_DIR/android-latest.apk'"

echo "Deploying production services..."
DOCKER_HOST="ssh://${SSH_TARGET}" docker compose -f docker-compose-prod.yml up -d --build --force-recreate > "$OUT"

echo "Cleaning up..."
DOCKER_HOST="ssh://${SSH_TARGET}" docker system prune -f --filter "label=com.docker.compose.project=beacon" > "$OUT"

echo "Finished! Android download endpoint: /api/downloads/android/latest"