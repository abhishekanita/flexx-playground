#!/bin/bash
set -euo pipefail

# =============================================================================
# Staging Deployment Script
# Pushes code to git, SSHs into EC2, pulls latest, builds, and restarts server
# =============================================================================

# ---- Configuration (edit these or set as env vars) ----
EC2_HOST="${EC2_HOST:-}"                          # e.g. 3.110.50.12
EC2_USER="${EC2_USER:-ubuntu}"                     # default Ubuntu AMI user
EC2_KEY="${EC2_KEY:-$HOME/.ssh/staging-server.pem}" # path to your .pem key
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/monorepo}"  # where the repo is cloned on EC2
NODE_ENV="${NODE_ENV:-staging}"                     # env name (loads .env.staging)
GIT_BRANCH="${GIT_BRANCH:-main}"                   # branch to deploy

# ---- Resolve paths ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# ---- Validate ----
if [ -z "$EC2_HOST" ]; then
  echo "ERROR: EC2_HOST is not set."
  echo "Usage: EC2_HOST=<ip> ./deploy-staging.sh"
  echo "   or: export EC2_HOST=<ip> && ./deploy-staging.sh"
  exit 1
fi

if [ ! -f "$EC2_KEY" ]; then
  echo "ERROR: SSH key not found at $EC2_KEY"
  echo "Set EC2_KEY=/path/to/your-key.pem"
  exit 1
fi

SSH_CMD="ssh -i $EC2_KEY -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST"

echo "============================================"
echo " Deploying to STAGING"
echo " Host:       $EC2_HOST"
echo " Branch:     $GIT_BRANCH"
echo " NODE_ENV:   $NODE_ENV"
echo "============================================"

# ---- Step 1: Push local changes ----
echo ""
echo "[1/4] Pushing local changes to origin/$GIT_BRANCH..."

cd "$MONOREPO_ROOT"

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo ""
  echo "WARNING: You have uncommitted changes."
  echo "Commit or stash them before deploying."
  echo ""
  git status --short
  echo ""
  read -p "Continue deploying what's already pushed? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
  echo "Continuing with already-pushed commits..."
else
  git push origin "$GIT_BRANCH"
  echo "Pushed."
fi

# ---- Step 2: Pull on EC2 ----
echo ""
echo "[2/4] Pulling latest code on EC2..."

$SSH_CMD << ENDSSH
  cd $REMOTE_DIR
  git fetch origin
  git reset --hard origin/$GIT_BRANCH
  echo "Pulled latest from origin/$GIT_BRANCH"
  echo "HEAD is now at: \$(git log --oneline -1)"
ENDSSH

# ---- Step 3: Install + Build ----
echo ""
echo "[3/4] Installing dependencies and building..."

$SSH_CMD << ENDSSH
  cd $REMOTE_DIR
  pnpm install --frozen-lockfile
  NODE_ENV=$NODE_ENV pnpm turbo run build --filter=@app/server...
ENDSSH

echo "Build complete."

# ---- Step 4: Restart server with PM2 ----
echo ""
echo "[4/4] Restarting server..."

$SSH_CMD << ENDSSH
  cd $REMOTE_DIR/apps/server

  if pm2 describe staging-server > /dev/null 2>&1; then
    echo "Restarting existing PM2 process..."
    NODE_ENV=$NODE_ENV pm2 restart staging-server --update-env
  else
    echo "Starting new PM2 process..."
    NODE_ENV=$NODE_ENV pm2 start dist/index.js --name staging-server
  fi

  pm2 save
  echo ""
  echo "Server status:"
  pm2 status staging-server
ENDSSH

echo ""
echo "============================================"
echo " Deployment complete!"
echo " Server running at http://$EC2_HOST:8000"
echo "============================================"
