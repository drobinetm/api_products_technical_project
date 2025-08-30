# Resources Directory

This directory contains utility scripts and tools for setting up, testing, and managing the Products API system.

## Quick Start Scripts

### 🚀 `quick-start.sh`
Complete setup verification and dependency installation.
```bash
chmod +x quick-start.sh
./quick-start.sh
```
- Checks all prerequisites (Node.js, MongoDB, Elasticsearch, RabbitMQ)
- Installs npm dependencies for both APIs
- Sets up environment files
- Provides next steps for starting services

### 🏥 `health-check.sh`
Comprehensive health check for all system components.
```bash
chmod +x health-check.sh
./health-check.sh
```
- Verifies all services are running and accessible
- Tests API endpoints and basic functionality
- Shows RabbitMQ queue status and Elasticsearch health
- Provides troubleshooting suggestions

### 🌱 `seed.sh`
Populates the system with test data.
```bash
chmod +x seed.sh
./seed.sh
```
- Clears existing data
- Creates sample products with different roles
- Tests GraphQL pagination and search functionality
- Verifies RabbitMQ message flow

## Linux Service Management Scripts

### 📦 `linux/setup_dev_linux.sh`
**Complete development environment setup for Linux systems.**
```bash
chmod +x linux/setup_dev_linux.sh
./linux/setup_dev_linux.sh
```
**What it does:**
- Installs Node.js (v20/22) via NVM or NodeSource
- Installs and configures MongoDB 7.0
- Installs and configures Elasticsearch 8.x
- Installs and configures RabbitMQ
- Sets up environment files from examples
- Installs npm dependencies for both APIs
- Verifies all services are working

**Supported systems:** Ubuntu, Debian, Linux Mint

### ▶️ `linux/start_services.sh`
Starts all required system services.
```bash
chmod +x linux/start_services.sh
./linux/start_services.sh
```
- Starts MongoDB, Elasticsearch, and RabbitMQ
- Shows service status after startup

### ⏹️ `linux/stop_services.sh`
Stops all system services.
```bash
chmod +x linux/stop_services.sh
./linux/stop_services.sh
```
- Stops MongoDB, Elasticsearch, and RabbitMQ services

### 🔄 `linux/reset-graphql.sh`
**Reset GraphQL database and search index.**
```bash
chmod +x linux/reset-graphql.sh
./linux/reset-graphql.sh
```
**What it does:**
- Shows current database status
- Prompts for confirmation before proceeding
- Clears all products from MongoDB via GraphQL API
- Clears all audit logs
- Triggers Elasticsearch index clearing via RabbitMQ
- Verifies the reset was successful

**Use cases:**
- Clean slate for development
- Resetting after testing
- Clearing corrupted data

### 🔍 `linux/reset-search-index.sh`
Resets only the Elasticsearch search index.
```bash
chmod +x linux/reset-search-index.sh
./linux/reset-search-index.sh
```
- Deletes the current Elasticsearch products index
- Recreates index with proper mapping and accent-folding analyzer
- Re-indexes products from GraphQL API

## Usage Workflow

### First Time Setup (Linux)
```bash
# 1. Complete setup
./linux/setup_dev_linux.sh

# 2. Start services (if not auto-started)
./linux/start_services.sh

# 3. In separate terminals, start the APIs:
# Terminal 1:
cd api-a-core && npm run dev

# Terminal 2:
cd api-b-search && npm run dev

# 4. Verify everything is working
./health-check.sh

# 5. Add test data
./seed.sh
```

### Daily Development
```bash
# Start services
./linux/start_services.sh

# Start APIs (in separate terminals)
cd api-a-core && npm run dev
cd api-b-search && npm run dev

# When done
./linux/stop_services.sh
```

### Reset/Clean Development Environment
```bash
# Clear all data and start fresh
./linux/reset-graphql.sh

# Add test data back
./seed.sh

# Or reset just the search index
./linux/reset-search-index.sh
```

## Troubleshooting

If you encounter issues:

1. **Check service health:** `./health-check.sh`
2. **Verify services are running:** `./linux/start_services.sh`
3. **Check logs:** 
   - GraphQL API: Check terminal running `npm run dev` in `api-a-core`
   - Search API: Check terminal running `npm run dev` in `api-b-search`
   - System services: `sudo journalctl -u mongod -f` (and similar for elasticsearch, rabbitmq-server)
4. **Reset if needed:** `./linux/reset-graphql.sh`

## Environment Variables

All scripts respect the following environment variables:

- `PROJECT_DIR`: Project root directory (default: current directory)
- `NODE_MAJOR_DEFAULT`: Node.js major version to install (default: 20)
- `MONGODB_MAJOR`: MongoDB version (default: 7.0)
- `ES_MAJOR`: Elasticsearch major version (default: 8)

## Notes

- All scripts include colored output and error handling
- Linux scripts are designed for Ubuntu/Debian/Linux Mint
- Scripts check prerequisites before proceeding
- Most operations can be run multiple times safely
- Services are configured for development use (security disabled where appropriate)
