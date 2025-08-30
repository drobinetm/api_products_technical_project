#!/usr/bin/env bash
set -euo pipefail

echo "🏥 Health Check - Products API System"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check service health

check_service() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $name... "
    
    if response=$(curl -s -w "%{http_code}" --max-time 10 "$url" 2>/dev/null); then
        status_code="${response: -3}"
        if [ "$status_code" = "$expected_status" ]; then
            echo -e "${GREEN}✓ OK${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ HTTP $status_code${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ UNREACHABLE${NC}"
        return 1
    fi
}

echo
echo "🌐 Service Endpoints Status"
echo "--------------------------"

# Check service endpoints
ENDPOINTS_OK=0
check_service "MongoDB" "http://localhost:27017" && ((ENDPOINTS_OK++)) || {
    # Try MongoDB ping command
    echo -n "Checking MongoDB (alternative)... "
    if mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        ((ENDPOINTS_OK++))
    else
        echo -e "${RED}✗ FAILED${NC}"
    fi
}
check_service "Elasticsearch" "http://localhost:9200/_cluster/health" && ((ENDPOINTS_OK++)) || true
check_service "GraphQL API" "http://localhost:4000/health" && ((ENDPOINTS_OK++)) || true
check_service "Search API" "http://localhost:3001/health" && ((ENDPOINTS_OK++)) || true

echo
echo "🐰 RabbitMQ Details"
echo "------------------"

if sudo rabbitmqctl status > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} RabbitMQ broker is running"
    
    echo "Queue status:"
    sudo rabbitmqctl list_queues name messages consumers 2>/dev/null | while read line; do
        echo "  $line"
    done
    
    echo "Exchange status:"
    sudo rabbitmqctl list_exchanges name type 2>/dev/null | grep -E "(^name|^products)" | while read line; do
        echo "  $line"
    done
else
    echo -e "${RED}✗${NC} RabbitMQ is not accessible"
fi

echo
echo "🔍 Elasticsearch Details"
echo "------------------------"

if curl -s --max-time 5 "http://localhost:9200/_cluster/health" > /dev/null 2>&1; then
    # Get cluster health
    health=$(curl -s "http://localhost:9200/_cluster/health?pretty" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓${NC} Cluster health: $health"
    
    # Check products index
    if curl -s "http://localhost:9200/products" > /dev/null 2>&1; then
        doc_count=$(curl -s "http://localhost:9200/products/_count" | jq -r '.count // 0' 2>/dev/null || echo "0")
        echo -e "${GREEN}✓${NC} Products index exists with $doc_count documents"
    else
        echo -e "${YELLOW}⚠${NC} Products index does not exist"
    fi
else
    echo -e "${RED}✗${NC} Elasticsearch is not accessible"
fi

echo
echo "🧪 Quick API Tests"
echo "-----------------"

# Test GraphQL API
if curl -s --max-time 5 "http://localhost:4000/health" > /dev/null 2>&1; then
    echo -n "Testing GraphQL products query... "
    products_response=$(curl -s -X POST http://localhost:4000/graphql \
        -H 'Content-Type: application/json' \
        --data '{"query":"{ products(page:1, limit:1){ total } }"}' \
        2>/dev/null || echo '{"errors":[]}')
    
    if echo "$products_response" | jq -e '.data.products.total' > /dev/null 2>&1; then
        total=$(echo "$products_response" | jq -r '.data.products.total')
        echo -e "${GREEN}✓ OK${NC} (found $total products)"
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Response: $products_response"
    fi
else
    echo -e "${YELLOW}⚠${NC} GraphQL API not available - skipping API tests"
fi

# Test Search API
if curl -s --max-time 5 "http://localhost:3001/health" > /dev/null 2>&1; then
    echo -n "Testing Search API... "
    search_response=$(curl -s "http://localhost:3001/search?q=test" 2>/dev/null || echo '{"error":"failed"}')
    
    if echo "$search_response" | jq -e '.hits' > /dev/null 2>&1; then
        hits=$(echo "$search_response" | jq -r '.hits | length')
        echo -e "${GREEN}✓ OK${NC} (returned $hits results)"
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Response: $search_response"
    fi
else
    echo -e "${YELLOW}⚠${NC} Search API not available - skipping search tests"
fi

echo
echo "🔧 Port Usage Check"
echo "------------------"

check_port() {
    local port=$1
    local service_name=$2
    
    echo -n "Port $port ($service_name)... "
    if ss -lntp 2>/dev/null | awk '{print $4}' | grep -q ":$port$" 2>/dev/null || \
       lsof -iTCP -sTCP:LISTEN -P 2>/dev/null | awk '{print $9}' | grep -q ":$port$" 2>/dev/null || \
       netstat -lntp 2>/dev/null | awk '{print $4}' | grep -q ":$port$" 2>/dev/null; then
        echo -e "${GREEN}✓ IN USE${NC}"
    else
        echo -e "${RED}✗ FREE${NC}"
    fi
}

check_port 27017 "MongoDB"
check_port 5672 "RabbitMQ"
check_port 9200 "Elasticsearch"
check_port 4000 "GraphQL API"
check_port 3001 "Search API"

echo
echo "📊 Summary"
echo "----------"

total_endpoints=5

if  [ $ENDPOINTS_OK -eq $total_endpoints ]; then
    echo -e "${GREEN}🎉 All systems are operational!${NC}"
    echo -e "${GREEN}✓${NC} $ENDPOINTS_OK/$total_endpoints endpoints responding"
    echo
    echo "Ready for development! 🚀"
    echo
    echo "Next steps:"
    echo "• Run seed script for test data: ./seed.sh"
    echo "• Access GraphQL Playground: http://localhost:4000/graphql"
    echo "• Try search API: http://localhost:3001/search?q=your_query"
    
    exit 0
else
    echo -e "${YELLOW}⚠ System partially operational${NC}"
    echo -e "   $ENDPOINTS_OK/$total_endpoints endpoints responding"
    echo
    echo "Issues detected. Please check the failed services above."
    
    if [ $ENDPOINTS_OK -lt 2 ]; then
        echo
        echo "🔧 Troubleshooting tips:"
        echo "• Make sure both API services are running:"
        echo "  Terminal 1: cd api-a-core && npm run dev"
        echo "  Terminal 2: cd api-b-search && npm run dev"
        echo "• Check system services are started:"
        echo "  ./linux/start_services.sh"
        echo "• For Linux users, run full setup:"
        echo "  ./linux/setup_dev_linux.sh"
        echo "• Check service logs:"
        echo "  sudo journalctl -u mongod -f"
        echo "  sudo journalctl -u elasticsearch -f"
        echo "  sudo journalctl -u rabbitmq-server -f"
    fi
    
    exit 1
fi
