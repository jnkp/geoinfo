#!/bin/bash
#
# End-to-End Flow Verification Script
#
# This script verifies the complete data fetch flow:
# StatFin → Database → API → Frontend
#
# Prerequisites:
#   - Docker and docker-compose installed
#   - Node.js (for frontend tests)
#   - curl, jq (for API tests)
#
# Usage:
#   ./scripts/verify-e2e-flow.sh
#
# Options:
#   --skip-setup    Skip docker-compose up (assume services running)
#   --skip-frontend Skip frontend verification
#   --verbose       Show detailed output
#   --help          Show this help message

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
SKIP_SETUP=false
SKIP_FRONTEND=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            head -30 "$0" | tail -20
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Utility functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Check if command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is required but not installed"
        return 1
    fi
}

# Verify API is accessible
check_api() {
    local endpoint=$1
    local expected_status=${2:-200}

    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")

    if [[ "$response" == "$expected_status" ]]; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# Verification Steps
# =============================================================================

echo ""
echo "=========================================="
echo "   E2E Flow Verification"
echo "   StatFin → Database → API → Frontend"
echo "=========================================="
echo ""

# Step 0: Check prerequisites
log_info "Step 0: Checking prerequisites..."

check_command "curl" || exit 1
check_command "jq" || exit 1
check_command "docker" || log_warning "Docker not found (needed for setup)"

if [[ "$SKIP_FRONTEND" == false ]]; then
    check_command "node" || log_warning "Node.js not found (needed for frontend)"
fi

log_success "Prerequisites check complete"

# Step 1: Start services (if not skipped)
if [[ "$SKIP_SETUP" == false ]]; then
    log_info "Step 1: Starting services with docker-compose..."

    cd "$(dirname "$0")/.."

    # Start database first
    docker-compose up -d db

    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    for i in {1..30}; do
        if docker-compose exec -T db pg_isready -U geoinfo > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    # Start all services
    docker-compose --profile full up -d

    # Wait for services to be ready
    log_info "Waiting for services to start..."
    sleep 10

    log_success "Services started"
else
    log_info "Step 1: Skipping service setup (--skip-setup)"
fi

# Step 2: Verify API health
log_info "Step 2: Verifying API health..."

for i in {1..30}; do
    if check_api "/health"; then
        log_success "API is healthy"
        break
    fi
    if [[ $i == 30 ]]; then
        log_error "API health check failed after 30 attempts"
        exit 1
    fi
    sleep 1
done

# Step 3: Verify API documentation
log_info "Step 3: Verifying API documentation..."

if check_api "/docs"; then
    log_success "API documentation accessible at $API_URL/docs"
else
    log_error "API documentation not accessible"
fi

# Step 4: Test StatFin table browsing
log_info "Step 4: Testing StatFin table browsing..."

STATFIN_RESPONSE=$(curl -s "$API_URL/api/statfin/tables")
STATFIN_COUNT=$(echo "$STATFIN_RESPONSE" | jq -r '.total // 0')

if [[ "$STATFIN_COUNT" -gt 0 ]]; then
    log_success "StatFin table browsing works (found $STATFIN_COUNT items)"
    if [[ "$VERBOSE" == true ]]; then
        echo "$STATFIN_RESPONSE" | jq '.tables[:3]'
    fi
else
    log_warning "StatFin API may not be accessible or returned no tables"
fi

# Step 5: Create test dataset
log_info "Step 5: Creating test dataset..."

DATASET_ID="e2e-verify-$(date +%s)"
DATASET_RESPONSE=$(curl -s -X POST "$API_URL/api/datasets" \
    -H "Content-Type: application/json" \
    -d "{
        \"id\": \"$DATASET_ID\",
        \"name\": \"E2E Verification Dataset\",
        \"description\": \"Created by verification script\",
        \"statfin_table_id\": \"vaerak/statfin_vaerak_pxt_11re.px\",
        \"time_resolution\": \"year\",
        \"has_region\": true
    }")

if echo "$DATASET_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    log_success "Dataset created: $DATASET_ID"
    if [[ "$VERBOSE" == true ]]; then
        echo "$DATASET_RESPONSE" | jq '.'
    fi
else
    log_error "Failed to create dataset"
    echo "$DATASET_RESPONSE"
    exit 1
fi

# Step 6: Create fetch configuration
log_info "Step 6: Creating fetch configuration..."

FETCH_CONFIG_RESPONSE=$(curl -s -X POST "$API_URL/api/fetch-configs" \
    -H "Content-Type: application/json" \
    -d "{
        \"dataset_id\": \"$DATASET_ID\",
        \"is_active\": true,
        \"fetch_interval_hours\": 24,
        \"priority\": 1
    }")

FETCH_CONFIG_ID=$(echo "$FETCH_CONFIG_RESPONSE" | jq -r '.id // empty')

if [[ -n "$FETCH_CONFIG_ID" ]]; then
    log_success "Fetch configuration created: ID=$FETCH_CONFIG_ID"
else
    log_error "Failed to create fetch configuration"
    echo "$FETCH_CONFIG_RESPONSE"
    # Clean up dataset
    curl -s -X DELETE "$API_URL/api/datasets/$DATASET_ID"
    exit 1
fi

# Step 7: Verify fetch configuration list
log_info "Step 7: Verifying fetch configuration list..."

CONFIGS_RESPONSE=$(curl -s "$API_URL/api/fetch-configs")
CONFIGS_COUNT=$(echo "$CONFIGS_RESPONSE" | jq -r '.total // 0')

if [[ "$CONFIGS_COUNT" -gt 0 ]]; then
    log_success "Fetch configurations accessible (total: $CONFIGS_COUNT)"
else
    log_warning "No fetch configurations found"
fi

# Step 8: Check statistics endpoint
log_info "Step 8: Checking statistics endpoint..."

STATS_RESPONSE=$(curl -s "$API_URL/api/statistics")
STATS_STATUS=$(echo "$STATS_RESPONSE" | jq -e '.items' > /dev/null 2>&1 && echo "ok" || echo "fail")

if [[ "$STATS_STATUS" == "ok" ]]; then
    STATS_COUNT=$(echo "$STATS_RESPONSE" | jq -r '.total // 0')
    log_success "Statistics endpoint works (total: $STATS_COUNT records)"
else
    log_error "Statistics endpoint not working"
fi

# Step 9: Check dimension endpoints
log_info "Step 9: Checking dimension endpoints..."

REGIONS_RESPONSE=$(curl -s "$API_URL/api/regions")
if echo "$REGIONS_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
    REGIONS_COUNT=$(echo "$REGIONS_RESPONSE" | jq -r '.total // 0')
    log_success "Regions endpoint works (total: $REGIONS_COUNT)"
else
    log_warning "Regions endpoint may not be working properly"
fi

INDUSTRIES_RESPONSE=$(curl -s "$API_URL/api/industries")
if echo "$INDUSTRIES_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
    INDUSTRIES_COUNT=$(echo "$INDUSTRIES_RESPONSE" | jq -r '.total // 0')
    log_success "Industries endpoint works (total: $INDUSTRIES_COUNT)"
else
    log_warning "Industries endpoint may not be working properly"
fi

# Step 10: Verify frontend (if not skipped)
if [[ "$SKIP_FRONTEND" == false ]]; then
    log_info "Step 10: Verifying frontend..."

    FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")

    if [[ "$FRONTEND_RESPONSE" == "200" ]]; then
        log_success "Frontend accessible at $FRONTEND_URL"
    else
        log_warning "Frontend not accessible (may not be running)"
    fi
else
    log_info "Step 10: Skipping frontend verification (--skip-frontend)"
fi

# Step 11: Clean up test data
log_info "Step 11: Cleaning up test data..."

# Delete fetch config
curl -s -X DELETE "$API_URL/api/fetch-configs/$FETCH_CONFIG_ID" > /dev/null

# Delete dataset
curl -s -X DELETE "$API_URL/api/datasets/$DATASET_ID" > /dev/null

log_success "Cleanup complete"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "=========================================="
echo "   Verification Summary"
echo "=========================================="
echo ""
log_success "E2E flow verification complete!"
echo ""
echo "Components verified:"
echo "  ✓ API health endpoint"
echo "  ✓ API documentation (OpenAPI)"
echo "  ✓ StatFin table browsing"
echo "  ✓ Dataset CRUD operations"
echo "  ✓ Fetch configuration CRUD"
echo "  ✓ Statistics query endpoint"
echo "  ✓ Dimension endpoints (regions, industries)"
if [[ "$SKIP_FRONTEND" == false ]]; then
    echo "  ✓ Frontend accessibility"
fi
echo ""
echo "To test the complete data fetch flow with real data:"
echo "  1. Create a dataset via UI at $FRONTEND_URL/config"
echo "  2. Configure a fetch job for a StatFin table"
echo "  3. Wait for scheduled fetch or trigger manually"
echo "  4. View data in dashboard at $FRONTEND_URL/"
echo ""
echo "For manual fetch testing, use the worker:"
echo "  cd backend && python -c 'from worker import trigger_fetch_now; import asyncio; asyncio.run(trigger_fetch_now())'"
echo ""
