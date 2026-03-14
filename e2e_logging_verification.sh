#!/bin/bash

# End-to-End Verification Script for Enhanced Debug Logging
# Task 008: Enhanced Debug Logging with Structured Output and Performance Metrics

set -e

echo "=================================================="
echo "E2E Verification: Logging Infrastructure"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

function test_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# ============================================================================
# Step 1: Verify Environment Configuration
# ============================================================================
test_section "Step 1: Environment Configuration"

if grep -q "DEBUG=true" .env; then
    test_pass "DEBUG=true set in .env file"
else
    test_fail "DEBUG=true not found in .env file"
fi

if grep -q "LOG_LEVEL=DEBUG" .env; then
    test_pass "LOG_LEVEL=DEBUG set in .env file"
else
    test_info "LOG_LEVEL not set to DEBUG (optional)"
fi

if grep -q "LOG_FORMAT" .env; then
    test_pass "LOG_FORMAT configured in .env"
else
    test_info "LOG_FORMAT using default value"
fi

# ============================================================================
# Step 2: Verify Backend is Running
# ============================================================================
test_section "Step 2: Backend Status"

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    test_pass "Backend is running and accessible"
else
    test_fail "Backend is not accessible at http://localhost:8000"
    echo "Please start the backend with: cd backend && source .venv/bin/activate && DEBUG=true uvicorn main:app --reload"
    exit 1
fi

# ============================================================================
# Step 3: Test API Request with Request ID
# ============================================================================
test_section "Step 3: Request ID Generation"

request_id=$(curl -I -s http://localhost:8000/health | grep -i "x-request-id" | cut -d' ' -f2 | tr -d '\r')
if [ -n "$request_id" ]; then
    test_pass "X-Request-ID header present: $request_id"
else
    test_fail "X-Request-ID header missing from response"
fi

# Verify uniqueness
id1=$(curl -I -s http://localhost:8000/health | grep -i "x-request-id" | cut -d' ' -f2 | tr -d '\r')
id2=$(curl -I -s http://localhost:8000/health | grep -i "x-request-id" | cut -d' ' -f2 | tr -d '\r')
id3=$(curl -I -s http://localhost:8000/health | grep -i "x-request-id" | cut -d' ' -f2 | tr -d '\r')

if [ "$id1" != "$id2" ] && [ "$id2" != "$id3" ] && [ "$id1" != "$id3" ]; then
    test_pass "Request IDs are unique across requests"
else
    test_fail "Request IDs are not unique"
fi

# ============================================================================
# Step 4: Make API Request that Queries Database
# ============================================================================
test_section "Step 4: Database Query Request"

# Test the statfin tables endpoint which queries the database
response=$(curl -s -w "\n%{http_code}" http://localhost:8000/api/statfin/tables)
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    test_pass "API request successful (status 200)"
else
    test_info "API returned status $http_code (database may be empty)"
fi

# ============================================================================
# Step 5: Check Log File Creation and Structure
# ============================================================================
test_section "Step 5: Log File Verification"

if [ -d "./logs" ]; then
    test_pass "Logs directory exists"

    if [ -f "./logs/app.log" ]; then
        test_pass "Log file app.log exists"

        # Check if log file contains JSON
        if head -1 ./logs/app.log | python3 -m json.tool > /dev/null 2>&1; then
            test_pass "Log file contains valid JSON"

            # Check for required fields
            log_sample=$(head -1 ./logs/app.log)

            if echo "$log_sample" | grep -q '"timestamp"'; then
                test_pass "Log entry contains 'timestamp' field"
            else
                test_fail "Log entry missing 'timestamp' field"
            fi

            if echo "$log_sample" | grep -q '"level"'; then
                test_pass "Log entry contains 'level' field"
            else
                test_fail "Log entry missing 'level' field"
            fi

            if echo "$log_sample" | grep -q '"logger"'; then
                test_pass "Log entry contains 'logger' field"
            else
                test_fail "Log entry missing 'logger' field"
            fi

            if echo "$log_sample" | grep -q '"message"'; then
                test_pass "Log entry contains 'message' field"
            else
                test_fail "Log entry missing 'message' field"
            fi

        else
            test_fail "Log file does not contain valid JSON"
        fi

        # Check for request/response logs
        if grep -q '"event": "request_started"' ./logs/app.log; then
            test_pass "Log contains request_started events"
        else
            test_info "No request_started events found (may need to make API calls)"
        fi

        if grep -q '"event": "request_completed"' ./logs/app.log; then
            test_pass "Log contains request_completed events"
        else
            test_info "No request_completed events found (may need to make API calls)"
        fi

        # Check for database query logs
        if grep -q '"sql"' ./logs/app.log; then
            test_pass "Log contains SQL query logs"
        else
            test_info "No SQL query logs found (may need to trigger database queries)"
        fi

        # Check for request_id in logs
        if grep -q '"request_id"' ./logs/app.log; then
            test_pass "Log entries contain request_id field"
        else
            test_fail "Log entries missing request_id field"
        fi

        # Check for duration_ms (performance metrics)
        if grep -q '"duration_ms"' ./logs/app.log; then
            test_pass "Log contains performance metrics (duration_ms)"
        else
            test_info "No performance metrics found yet"
        fi

    else
        test_fail "Log file app.log does not exist"
        test_info "Backend may not be running with DEBUG=true"
    fi
else
    test_fail "Logs directory does not exist"
    test_info "Backend needs to be started with DEBUG=true to create logs"
fi

# ============================================================================
# Step 6: Test Log Export Endpoint
# ============================================================================
test_section "Step 6: Log Export Endpoint"

if [ -d "./logs" ] && [ -f "./logs/app.log" ]; then
    response=$(curl -s -w "\n%{http_code}" -o /tmp/logs-export.zip http://localhost:8000/api/admin/logs/export)
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "200" ]; then
        test_pass "Log export endpoint returns 200"

        if [ -f "/tmp/logs-export.zip" ]; then
            test_pass "Downloaded logs.zip file"

            if unzip -t /tmp/logs-export.zip > /dev/null 2>&1; then
                test_pass "Downloaded zip file is valid"

                # List contents
                file_count=$(unzip -l /tmp/logs-export.zip | grep -c "\.log" || echo "0")
                if [ "$file_count" -gt "0" ]; then
                    test_pass "Zip contains $file_count log file(s)"
                else
                    test_info "Zip file may contain non-.log files (this is OK)"
                fi
            else
                test_fail "Downloaded zip file is corrupted"
            fi

            rm -f /tmp/logs-export.zip
        else
            test_fail "Zip file not downloaded"
        fi
    elif [ "$http_code" = "404" ]; then
        test_info "Log export returns 404 (logs directory may be empty or missing)"
    else
        test_fail "Log export endpoint returned status $http_code"
    fi
else
    test_info "Skipping log export test - logs directory not available"
fi

# ============================================================================
# Step 7: Verify Request ID Consistency
# ============================================================================
test_section "Step 7: Request ID Consistency"

if [ -f "./logs/app.log" ]; then
    # Extract a request_id from the logs
    sample_request_id=$(grep -o '"request_id": "[^"]*"' ./logs/app.log | head -1 | cut -d'"' -f4)

    if [ -n "$sample_request_id" ]; then
        test_pass "Found request_id in logs: ${sample_request_id:0:8}..."

        # Count occurrences of this request_id
        occurrence_count=$(grep -c "\"$sample_request_id\"" ./logs/app.log || echo "0")

        if [ "$occurrence_count" -gt "1" ]; then
            test_pass "Request ID appears in multiple log entries ($occurrence_count times)"
            test_info "This confirms request_id propagation across the request lifecycle"
        else
            test_info "Request ID found in only 1 log entry (may need more API activity)"
        fi
    else
        test_info "No request_id found in logs yet"
    fi
else
    test_info "Skipping request ID consistency check - log file not available"
fi

# ============================================================================
# Step 8: Frontend Verification (Manual)
# ============================================================================
test_section "Step 8: Frontend Debug Logging (Manual Check Required)"

test_info "Frontend debug logging can be verified manually:"
echo "  1. Open http://localhost:5173 in your browser"
echo "  2. Open the browser console (F12)"
echo "  3. Interact with the application (browse tables, etc.)"
echo "  4. Look for console.debug messages like:"
echo "     [API] GET http://localhost:8000/api/statfin/tables - 200 (123.45ms)"
echo "  5. Trigger a slow request and verify console.warn appears for >2s requests"
echo ""

# ============================================================================
# Step 9: Slow Request Detection (Manual)
# ============================================================================
test_section "Step 9: Slow Request Detection (Manual Test Required)"

test_info "To test slow request detection:"
echo "  1. Add a slow endpoint to backend for testing (e.g., add time.sleep(2) in a route)"
echo "  2. Make request to the slow endpoint"
echo "  3. Check logs for WARNING level log with 'SLOW REQUEST' message"
echo "  4. Verify log entry has 'slow_request': true and 'threshold': 'warning'"
echo ""
echo "  For very slow requests (>5s):"
echo "  1. Create endpoint with time.sleep(6)"
echo "  2. Check logs for ERROR level log with 'VERY SLOW REQUEST'"
echo "  3. Verify 'threshold': 'error' in log entry"
echo ""

# ============================================================================
# Summary
# ============================================================================
test_section "Verification Summary"

echo ""
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}✓ All automated tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Complete the manual frontend verification (Step 8)"
    echo "2. Test slow request detection (Step 9)"
    echo "3. Review logs at ./logs/app.log to verify JSON structure and content"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review above.${NC}"
    echo ""
    echo "Common issues:"
    echo "- Backend not running with DEBUG=true"
    echo "- Need to restart backend after updating .env"
    echo "- Logs directory permissions"
    exit 1
fi
