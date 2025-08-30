#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Resetting GraphQL Database and Search Index"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if GraphQL API is running
if ! curl -s --max-time 5 "http://localhost:4000/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ GraphQL API is not running on port 4000${NC}"
    echo "Please start the GraphQL API first:"
    echo "  cd api-a-core && npm run dev"
    exit 1
fi

echo -e "${BLUE}📊 Current Database Status${NC}"
echo "------------------------"

# Get current product count
CURRENT_COUNT=$(curl -s -X POST http://localhost:4000/graphql \
    -H 'Content-Type: application/json' \
    --data '{"query":"{ products(page:1, limit:1000){ total } }"}' \
    | jq -r '.data.products.total // 0' 2>/dev/null || echo "0")

echo "Current products in MongoDB: $CURRENT_COUNT"

# Check Elasticsearch count if available
if curl -s --max-time 5 "http://localhost:9200/products/_count" > /dev/null 2>&1; then
    ES_COUNT=$(curl -s "http://localhost:9200/products/_count" | jq -r '.count // 0' 2>/dev/null || echo "0")
    echo "Current products in Elasticsearch: $ES_COUNT"
else
    echo "Elasticsearch not accessible (this is okay if search service is not running)"
fi

echo
echo -e "${YELLOW}⚠️  This will completely reset:${NC}"
echo "   • All products in MongoDB"
echo "   • All audit logs in MongoDB"  
echo "   • All products in Elasticsearch search index"
echo

read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Reset cancelled."
    exit 0
fi

echo
echo -e "${BLUE}🗑️  Clearing GraphQL Database${NC}"
echo "-----------------------------"

# Clear all products via GraphQL
echo "Clearing products and audit logs..."
CLEAR_RESULT=$(curl -s -X POST http://localhost:4000/graphql \
    -H 'Content-Type: application/json' \
    --data '{"query":"mutation { clearProducts { success } }"}')

if echo "$CLEAR_RESULT" | jq -e '.data.clearProducts.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} GraphQL database cleared successfully"
else
    echo -e "${RED}✗${NC} Failed to clear GraphQL database"
    echo "Response: $CLEAR_RESULT"
    exit 1
fi

# Wait for RabbitMQ message processing
echo "Waiting for RabbitMQ message processing..."
sleep 3

echo
echo -e "${BLUE}🔍 Verifying Reset${NC}"
echo "------------------"

# Verify GraphQL database is empty
NEW_COUNT=$(curl -s -X POST http://localhost:4000/graphql \
    -H 'Content-Type: application/json' \
    --data '{"query":"{ products(page:1, limit:1000){ total } }"}' \
    | jq -r '.data.products.total // 0' 2>/dev/null || echo "unknown")

echo "Products in MongoDB after reset: $NEW_COUNT"

# Verify Elasticsearch is cleared (if accessible)
if curl -s --max-time 5 "http://localhost:9200/products/_count" > /dev/null 2>&1; then
    NEW_ES_COUNT=$(curl -s "http://localhost:9200/products/_count" | jq -r '.count // 0' 2>/dev/null || echo "unknown")
    echo "Products in Elasticsearch after reset: $NEW_ES_COUNT"
    
    if [ "$NEW_ES_COUNT" = "0" ]; then
        echo -e "${GREEN}✓${NC} Search index cleared successfully"
    else
        echo -e "${YELLOW}⚠${NC} Search index may still be processing clear event"
    fi
else
    echo "Elasticsearch not accessible - cannot verify search index reset"
fi

if [ "$NEW_COUNT" = "0" ]; then
    echo
    echo -e "${GREEN}🎉 Reset completed successfully!${NC}"
    echo
    echo "Next steps:"
    echo "• Run the seed script to add test data: cd resources && ./seed.sh"
    echo "• Or create products manually via GraphQL API"
    echo "• Check health: cd resources && ./health-check.sh"
else
    echo
    echo -e "${RED}❌ Reset may not have completed successfully${NC}"
    echo "Expected 0 products, found: $NEW_COUNT"
    exit 1
fi
