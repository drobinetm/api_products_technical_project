#!/usr/bin/env bash
set -euo pipefail

# Products  GraphQL
curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -H 'x-role: PROVIDER' \
  --data '{"query":"mutation($in:ProductInput!){ createProduct(input:$in){ id status gs1Id name } }","variables":{"in":{"gs1Id":"GS1-001","name":"Agua Mineral 500ml","brand":"Aqua","description":"Agua sin gas","manufacturer":"Hydro SA","netWeight":"500ml"}}}'

echo

curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -H 'x-role: EDITOR' \
  --data '{"query":"mutation($in:ProductInput!){ createProduct(input:$in){ id status gs1Id name } }","variables":{"in":{"gs1Id":"GS1-002","name":"Café Molido 250g","brand":"Cafetal","description":"Tueste medio","manufacturer":"Beans SRL","netWeight":"250g"}}}'

echo

# List Pagination
curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ products(page:1, limit:10){ total page pages items{ id name status } } }"}'

echo

# Search API B
curl -s "http://localhost:3001/search?q=cafe"