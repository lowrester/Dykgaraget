#!/bin/bash
# ============================================================
# Dykgaraget - Proxmox LXC Orchestrator
# Runs on: Proxmox Host Shell
# Purpose: Creates a container and runs the deployment script
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running on Proxmox
if ! command -v pct &> /dev/null; then
    error "This script must be run on a Proxmox host (pct command not found)."
fi

# Configuration
STORAGE="local-lvm" # Change if needed
TEMPLATE_STORAGE="local"
UBUNTU_TEMPLATE="ubuntu-24.04-standard_24.04-1_amd64.tar.zst"

echo "╔══════════════════════════════════════════════════╗"
echo "║   🌊  Dykgaraget — Proxmox LXC Creator         ║"
echo "╚══════════════════════════════════════════════════╝"

# Get user input
read -p "Enter Container ID (e.g., 200): " CTID
read -p "Enter Hostname (e.g., dykgaraget): " CTHOST
read -p "Enter IP Address (e.g., 192.168.1.50/24): " CTIP
read -p "Enter Gateway (e.g., 192.168.1.1): " CTGW

# Check if template exists
if ! pveam list $TEMPLATE_STORAGE | grep -q "$UBUNTU_TEMPLATE"; then
    info "Downloading Ubuntu template..."
    pveam update
    pveam download $TEMPLATE_STORAGE "$UBUNTU_TEMPLATE"
fi

# Create LXC
info "Creating LXC container $CTID..."
pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$UBUNTU_TEMPLATE" \
    --hostname "$CTHOST" \
    --net0 name=eth0,bridge=vmbr0,gw="$CTGW",ip="$CTIP",type=veth \
    --storage "$STORAGE" \
    --password "ChangeMeLater123" \
    --unprivileged 1 \
    --features nesting=1 \
    --rootfs "$STORAGE:8" # 8GB disk

info "Starting container $CTID..."
pct start "$CTID"
sleep 5 # Wait for networking

info "Installing necessary dependencies in container..."
pct exec "$CTID" -- apt update
pct exec "$CTID" -- apt install -y curl # Needed for node install

# Get the project root (parent of deployment folder)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

info "Transferring project files to container..."
pct exec "$CTID" -- mkdir -p /tmp/dykgaraget
# We use tar to preserve permissions and structure during transfer
cd "$PROJECT_ROOT"
tar -cf - . | pct exec "$CTID" -- tar -xf - -C /tmp/dykgaraget

info "Running deployment script in container..."
pct exec "$CTID" -- chmod +x /tmp/dykgaraget/deployment/deploy-proxmox.sh
pct exec "$CTID" -- /tmp/dykgaraget/deployment/deploy-proxmox.sh

echo ""
echo "✅ LXC Created and Deployed! Access your site at http://${CTIP%/*}"
echo "📝 Note: Root password for LXC is 'ChangeMeLater123'"
