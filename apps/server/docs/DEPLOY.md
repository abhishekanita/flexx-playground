# Staging Server Deployment Guide

Deploy the Express server to an AWS EC2 instance. Uses `git push` → `git pull` on EC2 → build → restart.

---

## How it works

```
Your machine                         EC2 Instance (staging)
┌─────────────┐   git push          ┌──────────────────────────┐
│  monorepo/  │ ────────► GitHub ──►│  git pull                │
│             │                     │  pnpm install            │
│             │        SSH          │  turbo build             │
│             │ ──────────────────► │  PM2 restart → :8000     │
└─────────────┘                     └──────────────────────────┘
                                      ▲ Elastic IP (static)
                                      │
                                    Mobile app connects here
```

1. You run `./deploy-staging.sh` from your machine
2. Script pushes your local commits to GitHub
3. SSHs into EC2, does `git pull`, installs deps, builds, restarts PM2

---

## Part 1: EC2 Setup (one-time)

### 1.1 Launch EC2 Instance

1. **AWS Console → EC2 → Launch Instance**
2. Settings:
    - **Name:** `staging-server`
    - **AMI:** Ubuntu 24.04 LTS
    - **Instance type:** `t3.small` (2 vCPU, 2GB RAM)
    - **Key pair:** Create new → download `.pem` → save to `~/.ssh/staging-server.pem`
    - **Storage:** 20 GB gp3
3. **Security Group** — inbound rules:

| Type       | Port | Source    | Purpose    |
| ---------- | ---- | --------- | ---------- |
| SSH        | 22   | Your IP   | SSH access |
| Custom TCP | 8000 | 0.0.0.0/0 | Server API |

### 1.2 Allocate Elastic IP (static IP)

1. **EC2 → Elastic IPs → Allocate**
2. Select the new IP → **Actions → Associate** → pick your instance
3. Note the IP — this is your permanent staging address

### 1.3 Fix SSH key permissions (on your machine)

```bash
chmod 400 ~/.ssh/staging-server.pem
```

### 1.4 SSH in and install dependencies

```bash
ssh -i ~/.ssh/staging-server.pem ubuntu@<ELASTIC_IP>
```

Then run on the EC2 instance:

```bash
# System update
sudo apt update && sudo apt upgrade -y

# Install git (usually pre-installed on Ubuntu)
sudo apt install git -y

# Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm alias default 20

# pnpm (match monorepo version)
npm install -g pnpm@9.12.1

# PM2 (process manager)
npm install -g pm2

# Turbo (build tool)
npm install -g turbo
```

### 1.5 Clone the repo on EC2

You need EC2 to be able to pull from your GitHub repo. Two options:

**Option A: Deploy key (recommended)**

```bash
# On EC2, generate a key
ssh-keygen -t ed25519 -C "staging-server" -f ~/.ssh/github_deploy -N ""

# Print the public key
cat ~/.ssh/github_deploy.pub
```

Copy the output → Go to **GitHub repo → Settings → Deploy keys → Add deploy key** → paste it.

Then configure SSH on EC2:

```bash
cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  StrictHostKeyChecking no
EOF
```

Now clone:

```bash
cd ~
git clone git@github.com:<your-org>/<your-repo>.git monorepo
```

**Option B: Personal access token (simpler)**

```bash
cd ~
git clone https://xxx@github.com/abhishekanita/flexx-mobile-app.git
```

### 1.6 Create `.env.staging` on EC2

This file stays on the server only — never committed to git.

```bash
nano ~/monorepo/apps/server/.env.staging
```

Paste your staging env vars:

```env
NODE_ENV=staging
APP_NAME=your-app-staging
API_SERVER_PORT=8000
CORS_ORIGIN=*
DASHBOARD_URL=https://staging-admin.yourdomain.com
SERVER_URL=http://<ELASTIC_IP>:8000

JWT_SECRET=<generate-a-random-string>
JWT_EXPIRES_IN=30d

# Use a separate staging database
DB_URI=mongodb+srv://user:pass@cluster.mongodb.net
DB_NAME=your-app-staging

REDIS_URL=redis://localhost:6379

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_PUBLIC_BUCKET_NAME=...
AWS_PRIVATE_BUCKET_NAME=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URL=http://<ELASTIC_IP>:8000/api/v1/auth/google/callback

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

### 1.7 (Optional) Install Redis on EC2

If you don't have a managed Redis:

```bash
sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping   # → PONG
```

### 1.8 Set up PM2 to survive reboots

```bash
pm2 startup
# Run the command it outputs (starts with sudo env ...)
```

### 1.9 Add swap space (prevents out-of-memory during build)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Part 2: Deploying

### 2.1 One-time local setup

```bash
chmod +x apps/server/scripts/deploy-staging.sh
export EC2_HOST=<your-elastic-ip>   # add to ~/.zshrc or ~/.bashrc to persist
```

### 2.2 Deploy

```bash
# From the monorepo root (or anywhere — script resolves paths)
./apps/server/scripts/deploy-staging.sh
```

Or with inline config:

```bash
EC2_HOST=3.110.50.12 ./apps/server/scripts/deploy-staging.sh
```

### 2.3 What the script does

| Step | Action                                                                       |
| ---- | ---------------------------------------------------------------------------- |
| 1    | `git push origin main` locally (warns if uncommitted changes)                |
| 2    | SSH → `git fetch && git reset --hard origin/main` on EC2                     |
| 3    | SSH → `pnpm install --frozen-lockfile`                                       |
| 4    | SSH → `turbo build --filter=@app/server...` (builds types → schema → server) |
| 5    | SSH → `pm2 restart staging-server` (or starts it on first deploy)            |

### 2.4 Configuration

All configurable via env vars:

| Variable     | Default                     | Description            |
| ------------ | --------------------------- | ---------------------- |
| `EC2_HOST`   | (required)                  | Elastic IP or hostname |
| `EC2_USER`   | `ubuntu`                    | SSH user               |
| `EC2_KEY`    | `~/.ssh/staging-server.pem` | SSH private key path   |
| `REMOTE_DIR` | `/home/ubuntu/monorepo`     | Repo location on EC2   |
| `NODE_ENV`   | `staging`                   | Environment name       |
| `GIT_BRANCH` | `main`                      | Branch to deploy       |

---

## Part 3: Common Operations

```bash
# SSH shortcut
ssh -i ~/.ssh/staging-server.pem ubuntu@<ELASTIC_IP>

# View logs
pm2 logs staging-server

# View last 100 lines
pm2 logs staging-server --lines 100

# Restart without redeploying
cd ~/monorepo/apps/server && NODE_ENV=staging pm2 restart staging-server

# Check status
pm2 status

# Monitor CPU/memory
pm2 monit

# Stop server
pm2 stop staging-server
```

---

## Part 4: Point Mobile App to Staging

Update your mobile app's API base URL:

```
http://<ELASTIC_IP>:8000
```

---

## Troubleshooting

| Problem                           | Fix                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Can't connect from mobile app** | Check EC2 security group allows port 8000 from 0.0.0.0/0                                            |
| **Server crashes on start**       | `pm2 logs staging-server --lines 50` — usually a missing env var                                    |
| **Build OOM**                     | Add swap (section 1.9) or upgrade to `t3.medium`                                                    |
| **pnpm install fails**            | Version mismatch — run `npm install -g pnpm@9.12.1` on EC2                                          |
| **git pull fails**                | Deploy key not set up — check section 1.5                                                           |
| **`.env.staging` got wiped**      | `git reset --hard` doesn't touch untracked files, but if you accidentally committed it, recreate it |
