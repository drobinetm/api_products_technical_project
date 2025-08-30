#!/usr/bin/env bash
set -euo pipefail

say() { echo -e "\n\033[1;32m[START]\033[0m $*\n"; }

say "Starting MongoDB..."
sudo systemctl start mongod || true

say "Starting RabbitMQ..."
sudo systemctl start rabbitmq-server || true

say "Starting Elasticsearch..."
sudo systemctl start elasticsearch || true

say "Checking service statuses..."
echo
systemctl status mongod --no-pager -l | head -n 10 || true
systemctl status rabbitmq-server --no-pager -l | head -n 10 || true
systemctl status elasticsearch --no-pager -l | head -n 10 || true

say "All services started. Ports expected:"
echo "  - MongoDB       : 27017"
echo "  - RabbitMQ      : 5672"
echo "  - Elasticsearch : 9200"
