#!/bin/bash
# ==================================================================================
# PRIMARY DEPLOYMENT METHOD (RECOMMENDED)
# ----------------------------------------------------------------------------------
# 1. Builds images LOCALLY (saves server CPU).
# 2. Pushes only CHANGES (diffs) to Docker Hub (fast upload).
# 3. Server pulls and restarts.
#
# USE THIS SCRIPT FOR DAILY DEPLOYMENTS.
# ==================================================================================
set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# --- Configuration ---
# You can hardcode your username here to skip the prompt
DOCKER_USER="mirzavu" 
REPO_NAME="production-apps"
SERVER_IP="107.172.133.139"
SERVER_USER="dev"
TARGET_DIR="/home/dev/web/portal.demotesting.co.uk"
SSH_OPTS="-o StrictHostKeyChecking=no"

# --- Credentials ---
if [ -z "$DOCKER_USER" ]; then
    read -p "Enter Docker Hub Username: " DOCKER_USER
fi

FULL_REPO="$DOCKER_USER/$REPO_NAME"

echo "================================================"
echo "DEPLOYING APP TO DOCKER HUB: $FULL_REPO"
echo "================================================"

# 1. Login to Docker Hub (Locally)
if ! docker info | grep -q "Username"; then
    echo "Logging in to Docker Hub..."
    docker login
fi

# 2. Source Env Vars (for Build Args)
if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
fi

echo "[1/4] Building Images (amd64)..."
# NextJS
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_POCKETBASE_URL="$NEXT_PUBLIC_POCKETBASE_URL" \
  --build-arg NEXT_PUBLIC_PIN_CODE="$NEXT_PUBLIC_PIN_CODE" \
  --build-arg NEXT_PUBLIC_CAMERA_STREAM_URL="$NEXT_PUBLIC_CAMERA_STREAM_URL" \
  -t $FULL_REPO:portal-frontend \
  -f Dockerfile .

# PocketBase
docker build --platform linux/amd64 \
  -t $FULL_REPO:portal-pocketbase \
  -f Dockerfile.pocketbase .

echo "[2/4] Pushing Images to Docker Hub..."
docker push $FULL_REPO:portal-frontend
docker push $FULL_REPO:portal-pocketbase

echo "[3/4] Syncing Config Files..."
# Ensure target directory exists
ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "mkdir -p $TARGET_DIR"

rsync -avhzI --delete \
  -e "ssh $SSH_OPTS" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env.local' \
  --exclude 'pb_data' \
  --exclude '.next' \
  . $SERVER_USER@$SERVER_IP:$TARGET_DIR/ || echo "Rsync managed with warnings (continuing)..."

echo "[4/4] Updating Server Environment..."
# Check if server is logged in, if not prompt commands
echo "Ensuring server has DOCKER_HUB_REPO set in .env..."
ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "
  cd $TARGET_DIR
  # Ensure .env exists
  cp .env.production .env 2>/dev/null || true
  
  # Update/Add DOCKER_HUB_REPO variable in .env
  if grep -q 'DOCKER_HUB_REPO=' .env; then
    sed -i 's|DOCKER_HUB_REPO=.*|DOCKER_HUB_REPO=$FULL_REPO|' .env
  else
    echo 'DOCKER_HUB_REPO=$FULL_REPO' >> .env
  fi

  echo 'Pulling...'
  docker compose -f docker-compose.prod.yml pull
  echo 'Restarting...'
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  
  # Force restart pocketbase to apply migrations (since image might not have changed)
  docker compose -f docker-compose.prod.yml restart pocketbase
"

echo "================================================"
echo "DEPLOYMENT COMPLETE!"
echo "================================================"
