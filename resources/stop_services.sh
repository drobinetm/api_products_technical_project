#!/usr/bin/env bash
set -euo pipefail

say() { echo -e "\n\033[1;32m[STOP]\033[0m $*\n"; }

kill_port() {
  local port=$1
  local pid
  pid=$(lsof -t -i :$port 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    say "Killing process on port $port (PID $pid)..."
    kill -9 "$pid" || true
  else
    say "No process found on port $port"
  fi
}

say "Stopping MongoDB..."
sudo systemctl stop mongod || true

say "Stopping RabbitMQ..."
sudo systemctl stop rabbitmq-server || true

say "Stopping Elasticsearch..."
sudo systemctl stop elasticsearch || true

say "Stopping Kibana..."
sudo systemctl stop kibana || true

say "Stopping API A (port 4000)..."
kill_port 4000

say "Stopping API B (port 3001)..."
kill_port 3001

say "All services stopped."