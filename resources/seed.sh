#!/usr/bin/env bash
set -euo pipefail

# Check if required services are running
echo "Checking if services are available..."

if ! curl -s -f http://localhost:4000/health > /dev/null 2>&1; then
    echo "Error: GraphQL API (api-a-core) is not running on port 4000"
    echo "Please start the services with: cd api-a-core && npm run dev"
    exit 1
fi

if ! curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "Error: Search API (api-b-search) is not running on port 3001"
    echo "Please start the services with: cd api-b-search && npm run dev"
    exit 1
fi

echo "Services are available. Starting seed process..."
echo

# Clear existing data first
echo "Clearing existing products..."
curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"mutation { clearProducts { success } }"}' \
  || { echo "Failed to clear products"; exit 1; }
echo "Database cleared successfully."
echo

# Products  GraphQL
echo "Creating product 1 (PROVIDER role)..."
curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -H 'x-role: PROVIDER' \
  --data '{"query":"mutation($in:ProductInput!){ createProduct(input:$in){ id status gs1Id name } }","variables":{"in":{"gs1Id":"GS1-001","name":"Agua Mineral 500ml","brand":"Aqua","description":"Agua sin gas","manufacturer":"Hydro SA","netWeight":"500ml"}}}' \
  || { echo "Failed to create product 1"; exit 1; }

echo

echo "Creating product 2 (EDITOR role)..."
curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -H 'x-role: EDITOR' \
  --data '{"query":"mutation($in:ProductInput!){ createProduct(input:$in){ id status gs1Id name } }","variables":{"in":{"gs1Id":"GS1-002","name":"Café Molido 250g","brand":"Cafetal","description":"Tueste medio","manufacturer":"Beans SRL","netWeight":"250g"}}}' \
  || { echo "Failed to create product 2"; exit 1; }

echo

# List Pagination
echo "Fetching products list (pagination)..."
curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ products(page:1, limit:10){ total page pages items{ id name status } } }"}' \
  || { echo "Failed to fetch products list"; exit 1; }

echo

# Search API B
echo "Searching products via Search API..."
curl -s "http://localhost:3001/search?q=cafe" \
  || { echo "Failed to search products"; exit 1; }

echo
echo "Seed process completed successfully!"
