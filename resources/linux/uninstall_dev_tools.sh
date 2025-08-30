#!/usr/bin/env bash
set -euo pipefail

say() { echo -e "\n\033[1;31m[UNINSTALL]\033[0m $*\n"; }

say "Uninstalling MongoDB..."
sudo systemctl stop mongod || true
sudo apt-get purge -y mongodb-org*
sudo rm -rf /var/log/mongodb /var/lib/mongodb /etc/apt/sources.list.d/mongodb-org-*.list

say "Uninstalling RabbitMQ..."
sudo systemctl stop rabbitmq-server || true
sudo apt-get purge -y rabbitmq-server*
sudo rm -rf /var/lib/rabbitmq /etc/rabbitmq

say "Uninstalling Elasticsearch..."
sudo systemctl stop elasticsearch || true
sudo apt-get purge -y elasticsearch
sudo rm -rf /var/lib/elasticsearch /etc/elasticsearch /etc/apt/sources.list.d/elastic-*.list

say "Uninstalling Node.js (apt version)..."
sudo apt-get purge -y nodejs npm || true

say "Cleaning up unused packages..."
sudo apt-get autoremove -y
sudo apt-get autoclean -y

say "All developer tools have been removed."