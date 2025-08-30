#!/usr/bin/env bash
set -euo pipefail

say() { echo -e "\n\033[1;32m[STOP]\033[0m $*\n"; }

say "Stopping MongoDB..."
sudo systemctl stop mongod || true

say "Stopping RabbitMQ..."
sudo systemctl stop rabbitmq-server || true

say "Stopping Elasticsearch..."
sudo systemctl stop elasticsearch || true

say "All services stopped."