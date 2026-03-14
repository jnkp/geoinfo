#!/bin/bash

# End-to-End Verification Script for Debug Mode
# Tests all aspects of the debug mode implementation

set -e

echo "=================================================="
echo "E2E Verification: Debug Mode Flow"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

function test_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((pass_count++))
}

function test_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((fail_count++))
}

function test_info() {
    echo -e "${YELLOW}ℹ INFO:${NC} $1"
}

echo "Step 1: Verify backend is running with DEBUG=true"
echo "---------------------------------------------------"
response=$(curl -s http://localhost:8000/health)
if echo "$response" | grep -q '"debug_mode": true'; then
    test_pass "Backend health endpoint shows debug_mode: true"
else
    test_fail "Backend health endpoint does not show debug mode"
fi

echo ""
echo "Step 2: Verify X-Request-ID header is present"
echo "----------------------------------------------"
request_id=$(curl -I -s http://localhost:8000/health | grep -i "x-request-id" | cut -d' ' -f2 | tr -d '\r')
if [ -n "$request_id" ]; then
    test_pass "X-Request-ID header present: $request_id"
else
    test_fail "X-Request-ID header missing"
fi

echo ""
echo "Step 3: Verify X-Request-ID is exposed via CORS"
echo "------------------------------------------------"
cors_headers=$(curl -I -s http://localhost:8000/health | grep -i "access-control-expose-headers")
if echo "$cors_headers" | grep -qi "x-request-id"; then
    test_pass "X-Request-ID is exposed in CORS headers"
else
    test_fail "X-Request-ID not exposed in CORS headers"
fi

echo ""
echo "Step 4: Trigger an error and verify debug info in response"
echo "------------------------------------------------------------"
# Try to access a non-existent endpoint to trigger an error
error_response=$(curl -s http://localhost:8000/api/nonexistent 2>&1)
if echo "$error_response" | grep -q "stack_trace"; then
    test_pass "Error response includes stack_trace field (DEBUG=true)"
else
    test_fail "Error response missing stack_trace field"
fi

if echo "$error_response" | grep -q "request_id"; then
    test_pass "Error response includes request_id field"
else
    test_fail "Error response missing request_id field"
fi

if echo "$error_response" | grep -q '"type"'; then
    test_pass "Error response includes type field (DEBUG=true)"
else
    test_fail "Error response missing type field"
fi

echo ""
echo "Step 5: Verify frontend is accessible"
echo "--------------------------------------"
if curl -s http://localhost:5175 > /dev/null 2>&1; then
    test_pass "Frontend is accessible at http://localhost:5175"
else
    test_fail "Frontend is not accessible"
fi

echo ""
echo "Step 6: Test backend with DEBUG=false"
echo "--------------------------------------"
test_info "Stopping backend and restarting with DEBUG=false..."

# Stop the current backend
pkill -f "uvicorn main:app" || true
sleep 2

# Start backend with DEBUG=false
cd backend
source .venv/bin/activate
DEBUG=false LOG_LEVEL=INFO python -m uvicorn main:app --reload --port 8000 > /tmp/backend-production.log 2>&1 &
BACKEND_PID=$!
sleep 5

echo ""
echo "Step 7: Verify backend runs with DEBUG=false"
echo "---------------------------------------------"
response=$(curl -s http://localhost:8000/health)
if echo "$response" | grep -q '"status": "healthy"'; then
    test_pass "Backend health endpoint responds"
else
    test_fail "Backend health endpoint not responding"
fi

if echo "$response" | grep -q '"debug"'; then
    test_fail "Health endpoint exposes debug info when DEBUG=false (security issue!)"
else
    test_pass "Health endpoint hides debug info when DEBUG=false"
fi

echo ""
echo "Step 8: Trigger error with DEBUG=false and verify no stack trace"
echo "------------------------------------------------------------------"
error_response=$(curl -s http://localhost:8000/api/nonexistent 2>&1)
if echo "$error_response" | grep -q "stack_trace"; then
    test_fail "Error response includes stack_trace when DEBUG=false (security issue!)"
else
    test_pass "Error response hides stack_trace when DEBUG=false"
fi

if echo "$error_response" | grep -q "request_id"; then
    test_pass "Error response still includes request_id (always present)"
else
    test_fail "Error response missing request_id"
fi

echo ""
echo "Step 9: Verify request ID uniqueness"
echo "-------------------------------------"
id1=$(curl -I -s http://localhost:8000/health | grep -i "x-request-id" | cut -d' ' -f2 | tr -d '\r')
id2=$(curl -I -s http://localhost:8000/health | grep -i "x-request-id" | cut -d' ' -f2 | tr -d '\r')
id3=$(curl -I -s http://localhost:8000/health | grep -i "x-request-id" | cut -d' ' -f2 | tr -d '\r')

if [ "$id1" != "$id2" ] && [ "$id2" != "$id3" ] && [ "$id1" != "$id3" ]; then
    test_pass "Request IDs are unique across requests"
else
    test_fail "Request IDs are not unique"
fi

echo ""
echo "Step 10: Verify backend logs request IDs"
echo "-----------------------------------------"
if grep -q "request_id" /tmp/backend-production.log 2>/dev/null; then
    test_info "Request IDs found in logs (optional feature)"
else
    test_info "Request IDs not in logs (this is OK for basic implementation)"
fi

echo ""
echo "=================================================="
echo "Verification Summary"
echo "=================================================="
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review above.${NC}"
    exit 1
fi
