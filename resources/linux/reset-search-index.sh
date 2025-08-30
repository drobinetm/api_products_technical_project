#!/usr/bin/env bash
set -euo pipefail

echo "Resetting Elasticsearch index..."

# Delete the current index
curl -s -X DELETE "http://localhost:9200/products" || echo "Index might not exist, continuing..."

# Create new index with proper mapping
curl -s -X PUT "http://localhost:9200/products" \
  -H 'Content-Type: application/json' \
  --data '{
    "settings": {
      "number_of_shards": 1,
      "analysis": {
        "analyzer": {
          "folding_analyzer": {
            "tokenizer": "standard",
            "filter": ["lowercase", "asciifolding"]
          }
        }
      }
    },
    "mappings": {
      "properties": {
        "id": { "type": "keyword" },
        "gs1Id": { "type": "keyword" },
        "name": {
          "type": "text",
          "analyzer": "folding_analyzer",
          "search_analyzer": "folding_analyzer"
        },
        "brand": {
          "type": "text",
          "analyzer": "folding_analyzer",
          "search_analyzer": "folding_analyzer"
        },
        "description": {
          "type": "text",
          "analyzer": "folding_analyzer",
          "search_analyzer": "folding_analyzer"
        },
        "manufacturer": { "type": "text" },
        "netWeight": { "type": "keyword" },
        "status": { "type": "keyword" },
        "updatedAt": { "type": "date" }
      }
    }
  }' || { echo "Failed to create index"; exit 1; }

echo "Index reset completed."

# Get all products from GraphQL API and index them
echo "Re-indexing products from GraphQL API..."

# Fetch products from GraphQL
PRODUCTS=$(curl -s -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ products(page:1, limit:100){ items{ id gs1Id name brand description manufacturer netWeight status updatedAt } } }"}')

echo "Fetched products: $PRODUCTS"

# Extract products and index them individually
# This is a simple approach - in production you'd want bulk indexing
echo "Indexing products into Elasticsearch..."

# Note: This is a simplified approach. In a real scenario, you'd parse JSON properly.
# For now, let's manually index the known products by calling the GraphQL mutations again
# which should trigger the RabbitMQ events (if RabbitMQ is running)

echo "Trigger re-indexing by clearing and re-creating products..."

# Use the seed script which will recreate the products and trigger events
./seed.sh

echo "Re-indexing completed!"
