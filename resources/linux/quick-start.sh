#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$PWD}"

echo "Running quick-start.sh in $PROJECT_DIR"

say() { echo -e "\n\033[1;32m[QUICK-START]\033[0m $*\n"; }
warn() { echo -e "\n\033[1;33m[WARN]\033[0m $*\n"; }

# --- helper: check port ---
port_in_use() {
  local port="$1"
  ss -lntp 2>/dev/null | awk '{print $4}' | grep -q ":$port$"
}

# --- step 1: run setup ---
say "Running setup_dev_linux.sh..."
if [[ -x "$PROJECT_DIR/resources/linux/setup_dev_linux.sh" ]]; then
  "$PROJECT_DIR/resources/linux/setup_dev_linux.sh"
else
  warn "setup_dev_linux.sh not found or not executable!"
fi

# --- step 2: start services ---
say "Starting infrastructure services..."
if [[ -x "$PROJECT_DIR/resources/linux/start_services.sh" ]]; then
  "$PROJECT_DIR/resources/linux/start_services.sh"
else
  warn "start_services.sh not found or not executable!"
fi

# --- step 3: start API A ---
say "Checking API A (Core - GraphQL) on port 4000..."
if port_in_use 4000; then
  echo "API A already running on :4000"
else
  say "Starting API A..."
  (cd "$PROJECT_DIR/resources/linux/api-a-core" && nohup npm run dev > api-a-core.log 2>&1 &)
  echo "API A started → logs in api-a-core.log"
fi

# --- step 4: start API B ---
say "Checking API B (Search - REST) on port 3001..."
if port_in_use 3001; then
  echo "API B already running on :3001"
else
  say "Starting API B..."
  (cd "$PROJECT_DIR/resources/linux/api-b-search" && nohup npm run dev > api-b-search.log 2>&1 &)
  echo "API B started → logs in api-b-search.log"
fi

say "Quick start complete 🎉"
echo "→ API A: http://localhost:4000/health"
echo "→ API B: http://localhost:3001/health"
