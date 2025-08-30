#!/usr/bin/env bash
set -euo pipefail

# ========= CONFIG =========
PROJECT_DIR="${PROJECT_DIR:-$PWD}"      # project root
NODE_MAJOR_DEFAULT="${NODE_MAJOR_DEFAULT:-20}"
MONGODB_MAJOR="${MONGODB_MAJOR:-7.0}"
ES_MAJOR="${ES_MAJOR:-8}"
NO_INSTALL=0   # activated with --no-install / -n
# =========================

say()  { echo -e "\n\033[1;32m[SETUP]\033[0m $*\n"; }
warn() { echo -e "\n\033[1;33m[WARN]\033[0m $*\n"; }
err()  { echo -e "\n\033[1;31m[ERR]\033[0m  $*\n"; }
need_cmd() { command -v "$1" >/dev/null 2>&1; }

usage() {
  cat <<EOF
Usage: $0 [--no-install|-n]
  --no-install, -n   Only verify (Node, services, ports), do not install
Env vars:
  PROJECT_DIR=/path/to/repo   (default: current directory)
EOF
}

# -------- Arguments --------
for arg in "$@"; do
  case "$arg" in
    --no-install|-n) NO_INSTALL=1 ;;
    -h|--help) usage; exit 0 ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

require_apt() {
  if [[ $NO_INSTALL -eq 1 ]]; then return; fi
  need_cmd apt-get || { err "apt-get required (Ubuntu/Debian)."; exit 1; }
  sudo apt-get update -y
  sudo apt-get install -y curl ca-certificates gnupg lsb-release software-properties-common apt-transport-https
}

# ---------- Port utilities ----------
port_in_use() {
  local port="$1"
  if need_cmd ss; then
    ss -lntp 2>/dev/null | awk '{print $4}' | grep -q ":$port$"
  elif need_cmd lsof; then
    lsof -iTCP -sTCP:LISTEN -P 2>/dev/null | awk '{print $9}' | grep -q ":$port$"
  elif need_cmd netstat; then
    netstat -lntp 2>/dev/null | awk '{print $4}' | grep -q ":$port$"
  else
    return 1
  fi
}
check_ports() {
  say "Checking occupied ports (27017 Mongo, 5672 Rabbit, 9200 ES, 4000 API-A, 3001 API-B)"
  local ports=(27017 5672 9200 4000 3001) p
  for p in "${ports[@]}"; do
    if port_in_use "$p"; then
      echo "  - Port $p: IN USE"
    else
      echo "  - Port $p: free"
    fi
  done
}

# ---------- Node: use nvm if present; otherwise NodeSource ----------
install_node_nodesource() {
  local major="${1:-20}"
  [[ $NO_INSTALL -eq 1 ]] && { err "Node ${major}.x required but NO_INSTALL is active. Install manually."; exit 1; }
  say "Installing Node.js ${major}.x (NodeSource)"
  curl -fsSL "https://deb.nodesource.com/setup_${major}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
}

ensure_node() {
  say "Checking Node.js (prefer 22 or 20)"
  local have_ok=0

  if need_cmd node; then
    local mj; mj="$(node -p "process.versions.node.split('.')[0]")" || true
    if [[ "$mj" == "22" || "$mj" == "20" ]]; then have_ok=1; fi
  fi

  if [[ $have_ok -eq 0 ]]; then
    # Load NVM if exists
    if [[ -s "$HOME/.nvm/nvm.sh" ]]; then . "$HOME/.nvm/nvm.sh"; fi
    if need_cmd nvm; then
      echo "Using NVM to activate 22/20..."
      if nvm use 22 >/dev/null 2>&1 || { [[ $NO_INSTALL -eq 0 ]] && nvm install 22; }; then nvm use 22 || true
      elif nvm use 20 >/dev/null 2>&1 || { [[ $NO_INSTALL -eq 0 ]] && nvm install 20; }; then nvm use 20 || true
      else
        if [[ $NO_INSTALL -eq 1 ]]; then
          err "NVM found but Node 22/20 not installed, and NO_INSTALL is active."; exit 1;
        fi
        warn "NVM failed; installing Node ${NODE_MAJOR_DEFAULT}."
        install_node_nodesource "${NODE_MAJOR_DEFAULT}"
      fi
    else
      if [[ $NO_INSTALL -eq 1 ]]; then
        err "NVM not found and Node 22/20 not present (NO_INSTALL active)."; exit 1;
      fi
      echo "NVM not found; installing Node ${NODE_MAJOR_DEFAULT}."
      install_node_nodesource "${NODE_MAJOR_DEFAULT}"
    fi
  fi

  local mjf; mjf="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$mjf" != "22" && "$mjf" != "20" ]]; then
    err "Node 22/20 not available. Current: $(node -v 2>/dev/null || echo 'not installed')"; exit 1;
  fi
  echo "Node ready: $(node -v); npm: $(npm -v)"
}

# ---------- MongoDB ----------
is_mongo_running() { pgrep -x mongod >/dev/null 2>&1 || systemctl is-active --quiet mongod; }
ensure_mongodb() {
  say "Checking MongoDB ${MONGODB_MAJOR}"
  if need_cmd mongod || need_cmd mongosh; then
    if is_mongo_running; then echo "MongoDB already running."; return; fi
  fi
  [[ $NO_INSTALL -eq 1 ]] && { err "MongoDB not running and NO_INSTALL active."; exit 1; }
  say "Installing MongoDB ${MONGODB_MAJOR}"
  
  # Get the appropriate Ubuntu codename for the repository
  # MongoDB doesn't have repositories for Linux Mint codenames, so we need to use Ubuntu equivalents
  local codename ubuntu_codename
  codename="$(lsb_release -cs)"
  
  # Map Linux Mint codenames to their Ubuntu base equivalents
  case "$codename" in
    virginia|vera|vanessa|victoria) ubuntu_codename="jammy" ;;  # Linux Mint 21.x -> Ubuntu 22.04
    una|ulyssa|ulyana|uma) ubuntu_codename="focal" ;;           # Linux Mint 20.x -> Ubuntu 20.04
    tricia|tina|tessa|tara) ubuntu_codename="bionic" ;;         # Linux Mint 19.x -> Ubuntu 18.04
    *) ubuntu_codename="$codename" ;;                           # Use as-is for Ubuntu systems
  esac
  
  # Clean up any existing MongoDB repository files that might have wrong codename
  sudo rm -f /etc/apt/sources.list.d/mongodb-org-${MONGODB_MAJOR}.list
  
  curl -fsSL https://www.mongodb.org/static/pgp/server-${MONGODB_MAJOR%%.*}.0.asc \
    | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-${MONGODB_MAJOR%%.*}.gpg
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${MONGODB_MAJOR%%.*}.gpg ] https://repo.mongodb.org/apt/ubuntu ${ubuntu_codename}/mongodb-org/${MONGODB_MAJOR} multiverse" \
    | sudo tee /etc/apt/sources.list.d/mongodb-org-${MONGODB_MAJOR}.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y mongodb-org
  sudo systemctl enable --now mongod || true
  sleep 2
}

# ---------- RabbitMQ ----------
is_rabbit_running() { systemctl is-active --quiet rabbitmq-server; }
ensure_rabbitmq() {
  say "Checking RabbitMQ"
  if need_cmd rabbitmqctl && is_rabbit_running; then echo "RabbitMQ already running."; return; fi
  [[ $NO_INSTALL -eq 1 ]] && { err "RabbitMQ not running and NO_INSTALL active."; exit 1; }
  say "Installing RabbitMQ"
  sudo apt-get install -y rabbitmq-server
  sudo systemctl enable --now rabbitmq-server || true
  sleep 2
}

# ---------- Elasticsearch ----------
is_es_running() { curl -sSf http://localhost:9200 >/dev/null 2>&1; }
ensure_elasticsearch() {
  say "Checking Elasticsearch ${ES_MAJOR}.x"
  if is_es_running; then echo "Elasticsearch responding on :9200."; return; fi
  [[ $NO_INSTALL -eq 1 ]] && { err "Elasticsearch not running and NO_INSTALL active."; exit 1; }
  say "Installing Elasticsearch ${ES_MAJOR}.x"
  curl -fsSL https://artifacts.elastic.co/GPG-KEY-elasticsearch \
    | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/${ES_MAJOR}.x/apt stable main" \
    | sudo tee /etc/apt/sources.list.d/elastic-${ES_MAJOR}.x.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y elasticsearch
  
  # Dev mode: configure security properly to avoid duplicates
  # Remove any duplicate entries that might exist
  sudo sed -i '/^# Dev mode$/,/^xpack\.security\.enabled: false$/d' /etc/elasticsearch/elasticsearch.yml || true
  
  # Set security to false for development (modify existing or add new)
  if grep -q "xpack.security.enabled" /etc/elasticsearch/elasticsearch.yml; then
    # Replace existing setting
    sudo sed -i 's/^xpack\.security\.enabled:.*/xpack.security.enabled: false/' /etc/elasticsearch/elasticsearch.yml
  else
    # Add new setting if it doesn't exist
    echo -e "\n# Dev mode\nxpack.security.enabled: false" | sudo tee -a /etc/elasticsearch/elasticsearch.yml >/dev/null
  fi
  
  sudo systemctl enable --now elasticsearch || true
  sleep 5
}

verify_services() {
  say "Verifying services health"
  mongosh --eval "db.adminCommand('ping')" || warn "MongoDB ping failed (first startup may take time)"
  sudo rabbitmqctl status >/dev/null 2>&1 || warn "RabbitMQ status NOK"
  curl -sSf http://localhost:9200 >/dev/null 2>&1 || warn "Elasticsearch NOK"
}

prepare_env_and_install() {
  say "Preparing project at: ${PROJECT_DIR}"
  cd "${PROJECT_DIR}"

  [[ -f "api-a-core/.env"   ]] || [[ ! -f "api-a-core/.env.example"   ]] || cp api-a-core/.env.example   api-a-core/.env
  [[ -f "api-b-search/.env" ]] || [[ ! -f "api-b-search/.env.example" ]] || cp api-b-search/.env.example api-b-search/.env

  if [[ -d "shared" ]]; then (cd shared && npm i); fi
  if [[ -d "api-a-core" ]]; then (cd api-a-core && npm i); fi
  if [[ -d "api-b-search" ]]; then (cd api-b-search && npm i || true); fi

  say "API ports before starting:"
  check_ports

  say "Manual start:"
  echo "  (cd api-a-core && npm run dev)   # :4000 /health /graphql"
  echo "  (cd api-b-search && npm run dev) # :3001 /health GET /search?q=..."
  echo "  (if 4000/3001 are IN USE, change PORT in .env)"
}

main() {
  require_apt
  ensure_node
  ensure_mongodb
  ensure_rabbitmq
  ensure_elasticsearch
  verify_services
  check_ports
  prepare_env_and_install
  say "Setup completed 🎉"
}

main "$@"
