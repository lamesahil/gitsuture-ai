#!/bin/bash
# scripts/deploy.sh
# Deployment script for GitSuture on Ubuntu VM.
# Run this from the /opt/gitsuture directory after the initial clone.

set -e

APP_DIR="/opt/gitsuture"

echo "🚀 Starting GitSuture Deployment..."

# Basic sanity checks
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Error: $APP_DIR does not exist."
    echo "Please clone the repository first: git clone https://github.com/lamesahil/gitsuture-ai.git $APP_DIR"
    exit 1
fi

if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "❌ Error: Node.js/npm is not installed."
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "❌ Error: pm2 is not installed."
    exit 1
fi

if ! command -v caddy &> /dev/null; then
    echo "❌ Error: caddy is not installed."
    exit 1
fi

cd $APP_DIR

echo "📥 Pulling latest changes from main..."
git pull origin main

echo "📦 Installing root dependencies..."
npm install

echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "🏗️ Building backend..."
npm run build

echo "🏗️ Building frontend..."
cd frontend
npm run build
cd ..

echo "🗄️ Pushing Prisma schema to SQLite (if needed)..."
npx prisma db push

# Prepare log directory for PM2
mkdir -p /var/log/gitsuture
chown -R $USER:$USER /var/log/gitsuture

echo "⚙️ Reloading backend process via PM2..."
pm2 start ecosystem.config.js || pm2 reload gitsuture || pm2 restart gitsuture
pm2 save

echo "🔒 Reloading Caddy configuration..."
# Assuming Caddyfile is placed at /etc/caddy/Caddyfile during initial manual setup
if systemctl is-active --quiet caddy; then
    systemctl reload caddy
else
    echo "⚠️ Caddy is not running. Start it manually: systemctl start caddy"
fi

echo "✅ Deployment complete!"
echo ""
echo "MANUAL ONE-TIME SETUP FOR FRESH VM:"
echo "1. Create $APP_DIR/.env with your secrets: PORT, GITHUB_WEBHOOK_SECRET, GITHUB_TOKEN, GEMINI_API_KEY"
echo "2. Copy Caddyfile.example to /etc/caddy/Caddyfile and edit your domain."
echo "3. Run: docker pull node:20-alpine"
echo "4. Ensure the user running pm2 is in the docker group."
