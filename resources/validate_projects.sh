#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run commands in a project directory
run_commands() {
    local project_name=$1
    local project_path=$2
    
    echo -e "\n${BLUE}=== Running commands for ${project_name} ===${NC}"
    cd "$project_path" || exit 1
    
    echo -e "\n${GREEN}Installing dependencies...${NC}"
    npm install
    
    echo -e "\n${GREEN}Running linter...${NC}"
    npm run lint
    
    echo -e "\n${GREEN}Fixing linting issues...${NC}"
    npm run lint:fix
    
    echo -e "\n${GREEN}Formatting code...${NC}"
    npm run format
    
    echo -e "\n${GREEN}Running tests...${NC}"
    npm run test
    
    echo -e "\n${GREEN}Validating project...${NC}"
    npm run validate
    
    echo -e "\n${GREEN}${project_name} commands completed!${NC}"
    cd - > /dev/null || return
}

# Get the base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Run commands for api-a-core
run_commands "api-a-core" "${BASE_DIR}/api-a-core"

# Run commands for api-b-search
run_commands "api-b-search" "${BASE_DIR}/api-b-search"

echo -e "\n${BLUE}All commands completed successfully!${NC}"
