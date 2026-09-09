#!/bin/bash
# scripts/deploy.sh
# Bootstrap script for a fresh Ubuntu 22.04/24.04 VM to run GitSuture.
# Run this script AS ROOT or with sudo.

set -e

echo "🚀 Bootstrapping GitSuture Virtual Machine..."

# 1. Update and install prerequisites
apt-get update
apt-get install -y curl git apt-transport-https ca-certificates software-properties-common

# 2. Install Node.js v20
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js v20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 3. Install Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" -y
    apt-get update
    apt-get install -y docker-ce
fi

# 4. Install Caddy
if ! command -v caddy &> /dev/null; then
    echo "🔒 Installing Caddy (Reverse Proxy)..."
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
fi

# 5. Pre-pull the sandbox image for Agent 1
echo "📥 Pre-pulling Agent 1 Docker Sandbox Image (node:20-alpine)..."
docker pull node:20-alpine

# 6. Install PM2 globally
echo "⚙️ Installing PM2..."
npm install -g pm2

# 7. Setup Directory
APP_DIR="/opt/gitsuture"
if [ ! -d "$APP_DIR" ]; then
    echo "📁 Creating application directory at $APP_DIR..."
    git clone https://github.com/lamesahil/gitsuture-ai.git $APP_DIR
    chown -R $SUDO_USER:$SUDO_USER $APP_DIR
fi

echo "✅ Bootstrap complete!"
echo ""
echo "Next Steps:"
echo "1. cd $APP_DIR"
echo "2. cp .env.example .env (and fill in your secrets!)"
echo "3. npm install && npm run build"
echo "4. cd frontend && npm install && npm run build"
echo "5. npx prisma db push"
echo "6. pm2 start dist/index.js --name gitsuture"
echo "7. cp Caddyfile.example /etc/caddy/Caddyfile (Edit with your domain) && systemctl reload caddy"
