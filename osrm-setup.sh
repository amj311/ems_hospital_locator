#!/usr/bin/env bash
# One-time script to download and preprocess OSM data for self-hosted OSRM.
#
# Runs from your local machine and targets the remote Docker server,
# the same way deploy.sh does. SSH credentials and the remote data
# directory are read from .env.deploy.
#
# Usage:
#   ./osrm-setup.sh                        # downloads full US dataset (~12 GB)
#   ./osrm-setup.sh north-america/us/utah  # smaller region (recommended for testing)
#   ./osrm-setup.sh europe/germany         # any Geofabrik region path
#
# Required vars (in .env.deploy or already exported):
#   SSH_USER        — remote username
#   SSH_HOST        — remote hostname / IP
#   OSRM_DATA_PATH  — absolute path on the remote server where data will live
#
# Full region list: https://download.geofabrik.de/

set -euo pipefail

REGION="${1:-north-america/us/utah}"
FILENAME="$(basename "$REGION")-latest"

# ── Load .env.deploy (same as deploy.sh) ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.env.deploy" ]]; then
    . "${SCRIPT_DIR}/.env.deploy"
fi

: "${SSH_USER:?SSH_USER must be set in .env.deploy or the environment}"
: "${SSH_HOST:?SSH_HOST must be set in .env.deploy or the environment}"
: "${OSRM_DATA_PATH:?OSRM_DATA_PATH must be set in .env.deploy or the environment}"

PBF_FILE="${FILENAME}.osm.pbf"
REMOTE_PBF="${OSRM_DATA_PATH}/${PBF_FILE}"

# ── Step 1: Download PBF directly on the remote server ───────────────────────
# Avoids downloading to the local machine and re-uploading.
echo "Checking for existing PBF on remote ..."
REMOTE_HAS_PBF=$(ssh "${SSH_USER}@${SSH_HOST}" "[ -f '${REMOTE_PBF}' ] && echo yes || echo no")

if [ "$REMOTE_HAS_PBF" = "yes" ]; then
    echo "✓ PBF already exists on remote, skipping download: ${REMOTE_PBF}"
else
    URL="https://download.geofabrik.de/${REGION}-latest.osm.pbf"
    echo "⬇ Downloading $URL directly on remote ..."
    ssh "${SSH_USER}@${SSH_HOST}" "sudo mkdir -p '${OSRM_DATA_PATH}' && sudo curl -L --progress-bar -o '${REMOTE_PBF}' '${URL}'"
fi

# ── Steps 2-4: OSRM preprocessing on the remote Docker daemon ────────────────
# DOCKER_HOST targets the remote server, so -v paths reference the remote filesystem.
# Using MLD pipeline (recommended for large datasets).

echo ""
echo "⚙ Running osrm-extract on remote ..."
sudo DOCKER_HOST="ssh://${SSH_USER}@${SSH_HOST}" docker run --rm -t \
    -v "${OSRM_DATA_PATH}:/data" \
    osrm/osrm-backend \
    osrm-extract -p /opt/car.lua "/data/${PBF_FILE}"

echo ""
echo "⚙ Running osrm-partition on remote ..."
sudo DOCKER_HOST="ssh://${SSH_USER}@${SSH_HOST}" docker run --rm -t \
    -v "${OSRM_DATA_PATH}:/data" \
    osrm/osrm-backend \
    osrm-partition "/data/${FILENAME}.osrm"

echo ""
echo "⚙ Running osrm-customize on remote ..."
sudo DOCKER_HOST="ssh://${SSH_USER}@${SSH_HOST}" docker run --rm -t \
    -v "${OSRM_DATA_PATH}:/data" \
    osrm/osrm-backend \
    osrm-customize "/data/${FILENAME}.osrm"

echo ""
echo "✅ Done! OSRM data is ready on the remote server at: ${OSRM_DATA_PATH}"
echo ""
echo "If your region is not 'utah-latest', update the command in docker-compose-prod.yml:"
echo "  command: osrm-routed --algorithm mld /data/${FILENAME}.osrm --max-table-size 1000"
