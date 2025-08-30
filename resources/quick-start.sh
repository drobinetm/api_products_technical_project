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
pkg_installed() { dpkg -s "$1" >/dev/null 2>&1; }

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

apt_install_if_missing() {
  local pkg="$1"
  if pkg_installed "$pkg"; then
    echo "[APT] '$pkg' already installed."
    return 0
  fi
  [[ $NO_INSTALL -eq 1 ]] && { err "'$pkg' not installed and NO_INSTALL is active."; exit 1; }
  say "Installing package: $pkg"
  sudo apt-get install -y "$pkg"
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
  say "Checking occupied ports (27017 Mongo, 5672 Rabbit, 9200 ES, 5601 Kibana, 4000 API-A, 3001 API-B)"
  local ports=(27017 5672 9200 5601 4000 3001) p
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
  local major="${1:-22}"
  [[ $NO_INSTALL -eq 1 ]] && { err "Node ${major}.x required but NO_INSTALL is active. Install manually."; exit 1; }
  if pkg_installed nodejs; then
    echo "[APT] nodejs already installed ($(node -v 2>/dev/null || true))."
    return 0
  fi
  say "Installing Node.js ${major}.x (NodeSource)"
  curl -fsSL "https://deb.nodesource.com/setup_${major}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
}
ensure_node() {
  say "Checking Node.js (prefer 22 or 20)"
  local have_ok=0
  if need_cmd node; then
    local mj; mj="$(node -p "process.versions.node.split('.')[0]")" || true
    if [[ "$mj" == "22" || "$mj" == "20" ]]; then
      echo "Node ready: $(node -v); npm: $(npm -v)"
      have_ok=1
    fi
  fi
  if [[ $have_ok -eq 1 ]]; then return; fi

  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then . "$HOME/.nvm/nvm.sh"; fi
  if need_cmd nvm; then
    echo "Using NVM to activate 22/20..."
    if nvm use 22 >/dev/null 2>&1 || { [[ $NO_INSTALL -eq 0 ]] && nvm install 22 >/dev/null 2>&1; }; then nvm use 22 || true
    elif nvm use 20 >/dev/null 2>&1 || { [[ $NO_INSTALL -eq 0 ]] && nvm install 20 >/dev/null 2>&1; }; then nvm use 20 || true
    else
      [[ $NO_INSTALL -eq 1 ]] && { err "NVM present but 22/20 not installed (NO_INSTALL active)."; exit 1; }
      warn "NVM failed; will install Node ${NODE_MAJOR_DEFAULT}."
      install_node_nodesource "${NODE_MAJOR_DEFAULT}"
    fi
  else
    [[ $NO_INSTALL -eq 1 ]] && { err "NVM not found and Node 22/20 not present (NO_INSTALL active)."; exit 1; }
    echo "NVM not found; installing Node ${NODE_MAJOR_DEFAULT}."
    install_node_nodesource "${NODE_MAJOR_DEFAULT}"
  fi

  local mjf; mjf="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$mjf" != "22" && "$mjf" != "20" ]]; then
    err "Node 22/20 not available. Current: $(node -v 2>/dev/null || echo 'not installed')"; exit 1;
  fi
  echo "Node ready: $(node -v); npm: $(npm -v)"
}

# ---------- MongoDB ----------
is_mongo_running() { pgrep -x mongod >/dev/null 2>&1 || systemctl is-active --quiet mongod; }
mongodb_repo_present() { [[ -f "/etc/apt/sources.list.d/mongodb-org-${MONGODB_MAJOR}.list" ]]; }
ensure_mongodb() {
  say "Checking MongoDB ${MONGODB_MAJOR}"
  if need_cmd mongod || need_cmd mongosh; then
    if is_mongo_running; then echo "MongoDB already running."; return; fi
    [[ $NO_INSTALL -eq 1 ]] && { err "MongoDB installed but not running (NO_INSTALL active)."; exit 1; }
    say "Starting MongoDB service..."
    sudo systemctl enable --now mongod || true
    sleep 2
    return
  fi

  [[ $NO_INSTALL -eq 1 ]] && { err "MongoDB not installed and NO_INSTALL active."; exit 1; }
  say "Installing MongoDB ${MONGODB_MAJOR}"

  local codename ubuntu_codename
  codename="$(lsb_release -cs)"
  case "$codename" in
    virginia|vera|vanessa|victoria) ubuntu_codename="jammy" ;;  # Mint 21.x
    una|ulyssa|ulyana|uma)          ubuntu_codename="focal" ;;  # Mint 20.x
    tricia|tina|tessa|tara)         ubuntu_codename="bionic" ;; # Mint 19.x
    *) ubuntu_codename="$codename" ;;
  esac

  if ! mongodb_repo_present; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-${MONGODB_MAJOR%%.*}.0.asc \
      | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-${MONGODB_MAJOR%%.*}.gpg
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${MONGODB_MAJOR%%.*}.gpg ] https://repo.mongodb.org/apt/ubuntu ${ubuntu_codename}/mongodb-org/${MONGODB_MAJOR} multiverse" \
      | sudo tee /etc/apt/sources.list.d/mongodb-org-${MONGODB_MAJOR}.list >/dev/null
    sudo apt-get update -y
  else
    echo "[APT] MongoDB repo already present."
  fi

  apt_install_if_missing mongodb-org
  sudo systemctl enable --now mongod || true
  sleep 2
}

# ---------- RabbitMQ ----------
is_rabbit_running() { systemctl is-active --quiet rabbitmq-server; }
ensure_rabbitmq() {
  say "Checking RabbitMQ"
  if pkg_installed rabbitmq-server; then
    echo "rabbitmq-server already installed."
    if is_rabbit_running; then
      echo "RabbitMQ already running."
      return
    fi
    [[ $NO_INSTALL -eq 1 ]] && { err "RabbitMQ installed but not running (NO_INSTALL active)."; exit 1; }
    say "Starting RabbitMQ service..."
    sudo systemctl enable --now rabbitmq-server || true
    sleep 2
    return
  fi

  [[ $NO_INSTALL -eq 1 ]] && { err "RabbitMQ not installed and NO_INSTALL active."; exit 1; }
  say "Installing RabbitMQ"
  sudo apt-get update -y
  apt_install_if_missing rabbitmq-server
  sudo systemctl enable --now rabbitmq-server || true
  sleep 2
}

# ---------- Elasticsearch ----------
is_es_running() { curl -sSf http://localhost:9200 >/dev/null 2>&1; }
elastic_repo_present() { [[ -f "/etc/apt/sources.list.d/elastic-${ES_MAJOR}.x.list" ]]; }
ensure_elasticsearch() {
  say "Checking Elasticsearch ${ES_MAJOR}.x"
  if is_es_running; then echo "Elasticsearch responding on :9200."; return; fi

  if pkg_installed elasticsearch; then
    [[ $NO_INSTALL -eq 1 ]] && { err "Elasticsearch installed but not running (NO_INSTALL active)."; exit 1; }
    say "Starting Elasticsearch service..."
    sudo systemctl enable --now elasticsearch || true
    sleep 5
    return
  fi

  [[ $NO_INSTALL -eq 1 ]] && { err "Elasticsearch not installed and NO_INSTALL active."; exit 1; }
  say "Installing Elasticsearch ${ES_MAJOR}.x"

  if ! elastic_repo_present; then
    curl -fsSL https://artifacts.elastic.co/GPG-KEY-elasticsearch \
      | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/${ES_MAJOR}.x/apt stable main" \
      | sudo tee /etc/apt/sources.list.d/elastic-${ES_MAJOR}.x.list >/dev/null
    sudo apt-get update -y
  else
    echo "[APT] Elastic repo already present."
  fi

  apt_install_if_missing elasticsearch

  # Dev mode: ensure single security line without duplicates
  sudo sed -i '/^# Dev mode$/,/^xpack\.security\.enabled: false$/d' /etc/elasticsearch/elasticsearch.yml || true
  if grep -q "^xpack\.security\.enabled:" /etc/elasticsearch/elasticsearch.yml; then
    sudo sed -i 's/^xpack\.security\.enabled:.*/xpack.security.enabled: false/' /etc/elasticsearch/elasticsearch.yml
  else
    echo -e "\n# Dev mode\nxpack.security.enabled: false" | sudo tee -a /etc/elasticsearch/elasticsearch.yml >/dev/null
  fi

  sudo systemctl enable --now elasticsearch || true
  sleep 5
}

# ---------- Kibana ----------
is_kibana_running() { curl -sSf http://localhost:5601/api/status >/dev/null 2>&1; }
ensure_kibana() {
  say "Checking Kibana"
  if is_kibana_running; then echo "Kibana responding on :5601."; return; fi

  if pkg_installed kibana; then
    [[ $NO_INSTALL -eq 1 ]] && { err "Kibana installed but not running (NO_INSTALL active)."; exit 1; }
    say "Starting Kibana service..."
    sudo systemctl enable --now kibana || true
    sleep 5
    return
  fi

  [[ $NO_INSTALL -eq 1 ]] && { err "Kibana not installed and NO_INSTALL active."; exit 1; }
  say "Installing Kibana"

  # Ensure Elastic repo exists (shared with Elasticsearch)
  if ! elastic_repo_present; then
    curl -fsSL https://artifacts.elastic.co/GPG-KEY-elasticsearch \
      | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/${ES_MAJOR}.x/apt stable main" \
      | sudo tee /etc/apt/sources.list.d/elastic-${ES_MAJOR}.x.list >/dev/null
    sudo apt-get update -y
  else
    echo "[APT] Elastic repo already present."
  fi

  apt_install_if_missing kibana

  # Idempotent config
  sudo sed -i 's|^#\?server.port:.*|server.port: 5601|' /etc/kibana/kibana.yml
  sudo sed -i 's|^#\?server.host:.*|server.host: "0.0.0.0"|' /etc/kibana/kibana.yml
  if grep -q "^elasticsearch.hosts:" /etc/kibana/kibana.yml; then
    sudo sed -i 's|^elasticsearch\.hosts:.*|elasticsearch.hosts: ["http://localhost:9200"]|' /etc/kibana/kibana.yml
  else
    echo 'elasticsearch.hosts: ["http://localhost:9200"]' | sudo tee -a /etc/kibana/kibana.yml >/dev/null
  fi

  sudo systemctl daemon-reload
  sudo systemctl enable --now kibana || true
  sleep 5
}

# ---------- Verify Services ----------
verify_services() {
  say "Verifying services health"
  mongosh --eval "db.adminCommand('ping')" || warn "MongoDB ping failed (first startup may take time)"
  sudo rabbitmqctl status >/dev/null 2>&1 || warn "RabbitMQ status NOK"
  curl -sSf http://localhost:9200 >/dev/null 2>&1 || warn "Elasticsearch NOK"
  curl -sSf http://localhost:5601/api/status >/dev/null 2>&1 || warn "Kibana NOK"
}

prepare_env_and_install() {
  say "Preparing project at: ${PROJECT_DIR}"
  cd "${PROJECT_DIR}"

  [[ -f "api-a-core/.env"   ]] || [[ ! -f "api-a-core/.env.example"   ]] || cp api-a-core/.env.example   api-a-core/.env
  [[ -f "api-b-search/.env" ]] || [[ ! -f "api-b-search/.env.example" ]] || cp api-b-search/.env.example api-b-search/.env

  if [[ -d "shared" ]]; then (cd shared && npm i); fi
  if [[ -d "api-a-core" ]]; then (cd api-a-core && npm i); fi
  if [[ -d "api-b-search" ]]; then (cd api-b-search && npm i || true); fi

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
  ensure_kibana
  verify_services
  prepare_env_and_install
  say "API ports before starting:"
  check_ports
  say "Setup completed 🎉"
}

main "$@"
