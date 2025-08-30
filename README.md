# Products API Technical Test

A microservices-based product management system with GraphQL API, real-time search indexing via RabbitMQ, and Elasticsearch-powered search capabilities.

## Architecture

- **API-A-Core**: GraphQL API for product management (Node.js)
- **API-B-Search**: RESTful search API with Elasticsearch (TypeScript/Node.js)
- **Database**: MongoDB for product storage
- **Search Engine**: Elasticsearch for full-text search
- **Message Queue**: RabbitMQ for real-time search indexing

## Prerequisites

Make sure you have the following installed:

- Node.js (v16+)
- MongoDB
- Elasticsearch
- RabbitMQ
- npm or yarn

## Project Structure

```
.
├── api-a-core/          # GraphQL API service
├── api-b-search/        # Search API service
├── resources/           # Scripts and utilities
├── shared/              # Shared event definitions
└── docker-compose.yml   # Docker services (optional)
```

## Installation

### 1. Clone and Install Dependencies

```bash
# Install dependencies for both services
cd api-a-core && npm install
cd ../api-b-search && npm install
```

### 2. Environment Configuration

**API-A-Core** (`api-a-core/.env`):
```bash
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/products
JWT_SECRET=dev-secret
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_EXCHANGE=products
PORT=4000
```

**API-B-Search** (`api-b-search/.env`):
```bash
NODE_ENV=development
ELASTIC_URL=http://localhost:9200
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_EXCHANGE=products
RABBITMQ_QUEUE=products-search
PORT=3001
```

### 3. Start Required Services

Make sure these services are running:

```bash
# MongoDB (usually runs as a service)
sudo systemctl start mongod

# Elasticsearch (usually runs as a service)
sudo systemctl start elasticsearch

# RabbitMQ (usually runs as a service)
sudo systemctl start rabbitmq-server
```

Verify services are running:
```bash
# Check MongoDB
mongosh --eval "db.adminCommand('ping')"

# Check Elasticsearch
curl http://localhost:9200/_cluster/health

# Check RabbitMQ
sudo rabbitmqctl status
```

## Running the Application

### Option 1: Local Development

#### Linux: Automated Setup (Recommended)

For Linux systems (Ubuntu/Debian/Linux Mint), use the provided scripts:

**1. Install and configure all services:**
```bash
# Install MongoDB, Elasticsearch, RabbitMQ, and Node.js
chmod +x resources/linux/setup_dev_linux.sh
./resources/linux/setup_dev_linux.sh
```

**2. Start system services:**
```bash
# Start MongoDB, Elasticsearch, and RabbitMQ
chmod +x resources/linux/start_services.sh
./resources/linux/start_services.sh
```

**3. Start the APIs (in separate terminals):**

**Terminal 1 - Start GraphQL API:**
```bash
cd api-a-core
npm run dev
# API will be available at http://localhost:4000
# GraphQL endpoint: http://localhost:4000/graphql
# Health check: http://localhost:4000/health
```

**Terminal 2 - Start Search API:**
```bash
cd api-b-search
npm run dev
# API will be available at http://localhost:3001
# Search endpoint: http://localhost:3001/search?q=<query>
# Health check: http://localhost:3001/health
```

**4. Reset GraphQL database (if needed):**
```bash
# Clear all data from MongoDB and Elasticsearch
chmod +x resources/linux/reset-graphql.sh
./resources/linux/reset-graphql.sh
```

**5. Stop system services (when done):**
```bash
# Stop MongoDB, Elasticsearch, and RabbitMQ
chmod +x resources/linux/stop_services.sh
./resources/linux/stop_services.sh
```

#### Manual Setup (All Platforms)

If you prefer manual setup or are not using Linux:

### Option 2: Docker (if services are dockerized)

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps
```

## API Documentation

### GraphQL API (Port 4000)

**Endpoint:** `http://localhost:4000/graphql`

#### Queries

```graphql

# Get single product by ID
query {
  product(id: "product_id_here") {
    id
    gs1Id
    name
    description
    brand
    manufacturer
    netWeight
    status
    createdByRole
    createdAt
    updatedAt
    history {
      id
      action
      changedBy
      createdAt
    }
  }
}
```

```graphql
# Get paginated products list
query {
  products(page: 1, limit: 10) {
    total
    page
    pages
    items {
      id
      gs1Id
      name
      description
      brand
      status
      createdByRole
    }
  }
}
```

#### Mutations

```graphql
# Create product (requires x-role header: PROVIDER or EDITOR)
mutation {
  createProduct(input: {
    gs1Id: "GS1-001"
    name: "Product Name"
    description: "Product description"
    brand: "Brand Name"
    manufacturer: "Manufacturer Name"
    netWeight: "500g"
  }) {
    id
    status
    gs1Id
    name
  }
}
```

```graphql
# Update product (requires x-role header: PROVIDER or EDITOR)
mutation {
  updateProduct(id: "product_id_here", patch: {
    name: "Updated Name"
    description: "Updated description"
  }) {
    id
    name
    description
  }
}
```

```graphql
# Approve product (requires x-role header: EDITOR)
mutation {
  approveProduct(id: "product_id_here") {
    id
    status
  }
}
```

```graphql
# Clear all products
mutation {
  clearProducts {
    success
  }
}
```

**Role Headers:**
- `x-role: PROVIDER` - Can create products (status: PENDING), update own products
- `x-role: EDITOR` - Can create products (status: PUBLISHED), update any product, approve products

### Search API (Port 3001)

**Endpoint:** `http://localhost:3001/search`

```bash
# Search products
GET /search?q=coffee
GET /search?q=agua
GET /search?q=cafe  # Works with accent-folding
```

**Response:**
```json
{
  "hits": [
    {
      "id": "product_id",
      "score": 2.5,
      "gs1Id": "GS1-002",
      "name": "Ground Coffee 250g",
      "brand": "Cafetal",
      "description": "Medium roast",
      "manufacturer": "Beans SRL",
      "netWeight": "250g",
      "status": "PUBLISHED",
      "updatedAt": "2025-08-30T13:02:37.202Z"
    }
  ]
}
```

## Testing

### 1. Health Checks

Use the provided health check script:

```bash
cd resources
chmod +x health-check.sh
./health-check.sh
```

Or manually check each service:

```bash
# Check all services are running
curl http://localhost:4000/health  # GraphQL API
curl http://localhost:3001/health  # Search API
curl http://localhost:9200/_cluster/health  # Elasticsearch
sudo rabbitmqctl status  # RabbitMQ
```

### 2. Seed Test Data

Run the included seed script to populate the system with test data:

```bash
cd resources
chmod +x seed.sh
./seed.sh
```

The seed script will:
- Clear existing data from both MongoDB and Elasticsearch
- Create test products with different roles (PROVIDER and EDITOR)
- Test product listing via GraphQL with pagination
- Test search functionality with accent-folding
- Verify real-time indexing via RabbitMQ messaging

### 3. Run Complete Test Suite

Execute all tests including integration tests:

```bash
cd resources
chmod +x run-tests.sh
./run-tests.sh
```

This comprehensive test script includes:
- Health checks for all services
- Database seeding
- API endpoint testing
- RabbitMQ message flow verification
- Elasticsearch indexing validation
- Search functionality testing

### 3. Manual Testing Examples

#### Create a Product (PROVIDER role)

```bash
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -H 'x-role: PROVIDER' \
  --data '{
    "query": "mutation($input: ProductInput!) { createProduct(input: $input) { id status gs1Id name } }",
    "variables": {
      "input": {
        "gs1Id": "GS1-TEST",
        "name": "Test Product",
        "brand": "Test Brand",
        "description": "Test Description",
        "manufacturer": "Test Manufacturer",
        "netWeight": "100g"
      }
    }
  }'
```

#### Search for Products

```bash
# Search for coffee products
curl "http://localhost:3001/search?q=coffee"

# Search with accents
curl "http://localhost:3001/search?q=coffee"

# Search without accents (should still work)
curl "http://localhost:3001/search?q=coffee"
```

#### Get Products List

```bash
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  --data '{
    "query": "{ products(page: 1, limit: 10) { total items { id name status } } }"
  }'
```

### 4. RabbitMQ Integration Testing

Verify that RabbitMQ is properly routing messages:

```bash
# Check RabbitMQ queues and messages
sudo rabbitmqctl list_queues name messages consumers

# Check RabbitMQ exchanges
sudo rabbitmqctl list_exchanges

# Check bindings
sudo rabbitmqctl list_bindings
```

### 5. Elasticsearch Testing

```bash
# Check indexed products
curl "http://localhost:9200/products/_search?pretty"

# Check index mapping
curl "http://localhost:9200/products/_mapping?pretty"

# Test search directly in Elasticsearch
curl -X POST "http://localhost:9200/products/_search?pretty" \
  -H 'Content-Type: application/json' \
  --data '{
    "query": {
      "multi_match": {
        "query": "coffee",
        "fields": ["name^3", "brand^2", "description"]
      }
    }
  }'
```

## Troubleshooting

### Common Issues

1. **Services not starting:**
   - Check if ports 4000, 3001, 9200, 5672, 27017 are available
   - Verify environment files are correctly configured
   - Check service logs for error messages

2. **Search not working:**
   - Verify Elasticsearch is running and accessible
   - Check if RabbitMQ consumer is processing messages
   - Ensure products are being indexed after creation

3. **RabbitMQ issues:**
   - Check if RabbitMQ is running: `sudo systemctl status rabbitmq-server`
   - Verify queue bindings: `sudo rabbitmqctl list_bindings`
   - Check for failed messages: `sudo rabbitmqctl list_queues name messages`

4. **GraphQL errors:**
   - Verify MongoDB connection
   - Check if required headers (x-role) are provided
   - Validate input data format

### Logs

```bash
# View API logs
cd api-a-core && npm run dev  # Check console output
cd api-b-search && npm run dev  # Check console output

# System service logs
sudo journalctl -u mongod -f
sudo journalctl -u elasticsearch -f
sudo journalctl -u rabbitmq-server -f
```

## Performance Notes

- The system uses real-time indexing via RabbitMQ for immediate search availability
- Elasticsearch is configured with accent-folding for international product names
- GraphQL API includes pagination for efficient large dataset handling
- Search API uses relevance scoring with field boosting (name > brand > description)

## Development

- Both APIs support hot reloading in development mode
- Use GraphQL Playground at `http://localhost:4000/graphql` for interactive API testing
- Elasticsearch index can be reset/recreated by restarting the search service
- RabbitMQ messages are persistent and will be reprocessed if consumers restart
