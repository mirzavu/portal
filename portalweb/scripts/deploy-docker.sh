
#!/bin/bash

# Deploy script for Portal Web App
# Usage: ./scripts/deploy-docker.sh

SERVER_IP="104.168.98.204"
USER="dev"
export SSHPASS='i9l6+x42AMY35twRSVPymw=='
TARGET_DIR="/home/dev/web/portal.demotesting.co.uk"

# Ensure we are in the project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "Deploying to $USER@$SERVER_IP..."
echo "Project Root: $(pwd)"

# Create directory
sshpass -e ssh -o StrictHostKeyChecking=no $USER@$SERVER_IP "mkdir -p $TARGET_DIR/pb_migrations $TARGET_DIR/pb_data"

# Rsync files
# We exclude node_modules and .next (except standalone if we were building locally, but we are building remotely here)
# We need the source code for the remote build.

echo "Syncing files..."
sshpass -e rsync -avhz --delete \
    --exclude '/node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude 'pb_data' \
    --exclude 'pocketbase' \
    --exclude '.env.local' \
    . $USER@$SERVER_IP:$TARGET_DIR

# Remove .env.local if exists (to ensure production env usage)
sshpass -e ssh $USER@$SERVER_IP "rm -f $TARGET_DIR/.env.local"

# Use .env.production as .env if .env doesn't exist or just overwrite it
sshpass -e ssh $USER@$SERVER_IP "cp $TARGET_DIR/.env.production $TARGET_DIR/.env"


# Run Docker Compose
echo "Starting application with Docker Compose..."

# We need to stop the old one first.
sshpass -e ssh $USER@$SERVER_IP "cd $TARGET_DIR && docker compose down && docker compose up -d --build"

echo "Deployment completed!"
