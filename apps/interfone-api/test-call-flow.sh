#!/bin/bash

# Agora Call Flow Test Script
# This script tests the complete call flow via API endpoints

set -e

API_URL="${API_URL:-http://localhost:3001}"
BUILDING_ID="${BUILDING_ID:-test-building-id}"
APARTMENT_NUMBER="${APARTMENT_NUMBER:-101}"
DOORMAN_ID="${DOORMAN_ID:-porteiro-test-id}"
DOORMAN_NAME="${DOORMAN_NAME:-Porteiro Teste}"

echo "🧪 Testing Agora Call Flow"
echo "===================================="
echo "API URL: $API_URL"
echo "Building: $BUILDING_ID"
echo "Apartment: $APARTMENT_NUMBER"
echo "Doorman: $DOORMAN_NAME"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo "📋 Test 1: API Health Check"
echo "----------------------------"
HEALTH_RESPONSE=$(curl -s "$API_URL/api/status")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ API is healthy${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    echo "$HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Test 2: Generate Token
echo "📋 Test 2: Generate Token Bundle"
echo "----------------------------"
TOKEN_RESPONSE=$(curl -s -X POST "$API_URL/api/tokens/generate" \
    -H "Content-Type: application/json" \
    -d "{
        \"channelName\": \"test-channel-$(date +%s)\",
        \"uid\": \"test-user-123\",
        \"role\": \"publisher\"
    }")

if echo "$TOKEN_RESPONSE" | grep -q "rtcToken"; then
    echo -e "${GREEN}✅ Token generated successfully${NC}"
    RTC_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"rtcToken":"[^"]*' | cut -d'"' -f4)
    echo "   RTC Token: ${RTC_TOKEN:0:20}..."
else
    echo -e "${RED}❌ Token generation failed${NC}"
    echo "$TOKEN_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Start Call
echo "📋 Test 3: Start Intercom Call"
echo "----------------------------"
CALL_RESPONSE=$(curl -s -X POST "$API_URL/api/calls/start" \
    -H "Content-Type: application/json" \
    -d "{
        \"apartmentNumber\": \"$APARTMENT_NUMBER\",
        \"buildingId\": \"$BUILDING_ID\",
        \"doormanId\": \"$DOORMAN_ID\",
        \"doormanName\": \"$DOORMAN_NAME\",
        \"clientVersion\": \"test-1.0.0\",
        \"schemaVersion\": 1
    }")

if echo "$CALL_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Call started successfully${NC}"

    CALL_ID=$(echo "$CALL_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    CHANNEL_NAME=$(echo "$CALL_RESPONSE" | grep -o '"channelName":"[^"]*' | head -1 | cut -d'"' -f4)
    NOTIFICATIONS_SENT=$(echo "$CALL_RESPONSE" | grep -o '"notificationsSent":[0-9]*' | head -1 | cut -d':' -f2)

    echo "   Call ID: $CALL_ID"
    echo "   Channel: $CHANNEL_NAME"
    echo "   Notifications Sent: ${NOTIFICATIONS_SENT:-0}"

    # Check for signaling payload
    if echo "$CALL_RESPONSE" | grep -q '"signaling"'; then
        echo -e "   ${GREEN}✅ Signaling payload present${NC}"
    fi

    # Check for tokens
    if echo "$CALL_RESPONSE" | grep -q '"initiator"'; then
        echo -e "   ${GREEN}✅ Initiator tokens present${NC}"
    fi
else
    echo -e "${RED}❌ Call start failed${NC}"
    echo "$CALL_RESPONSE"
    exit 1
fi
echo ""

# Test 4: Get Call Status
echo "📋 Test 4: Get Call Status"
echo "----------------------------"
if [ -n "$CALL_ID" ]; then
    STATUS_RESPONSE=$(curl -s "$API_URL/api/calls/$CALL_ID/status")

    if echo "$STATUS_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Call status retrieved${NC}"
        CALL_STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)
        echo "   Status: $CALL_STATUS"
    else
        echo -e "${YELLOW}⚠️  Could not retrieve call status${NC}"
        echo "$STATUS_RESPONSE"
    fi
else
    echo -e "${YELLOW}⚠️  No call ID available (skipped)${NC}"
fi
echo ""

# Test 5: Answer Call (simulation)
echo "📋 Test 5: Answer Call (Simulation)"
echo "----------------------------"
if [ -n "$CALL_ID" ]; then
    ANSWER_RESPONSE=$(curl -s -X POST "$API_URL/api/calls/$CALL_ID/answer" \
        -H "Content-Type: application/json" \
        -d "{
            \"userId\": \"morador-test-id\",
            \"userType\": \"resident\"
        }")

    if echo "$ANSWER_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Call answered successfully${NC}"
        ANSWERED_STATUS=$(echo "$ANSWER_RESPONSE" | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)
        echo "   New Status: $ANSWERED_STATUS"
    else
        echo -e "${YELLOW}⚠️  Could not answer call (this is expected if no residents exist)${NC}"
        echo "$ANSWER_RESPONSE" | head -n 3
    fi
else
    echo -e "${YELLOW}⚠️  No call ID available (skipped)${NC}"
fi
echo ""

# Test 6: End Call
echo "📋 Test 6: End Call"
echo "----------------------------"
if [ -n "$CALL_ID" ]; then
    END_RESPONSE=$(curl -s -X POST "$API_URL/api/calls/$CALL_ID/end" \
        -H "Content-Type: application/json" \
        -d "{
            \"userId\": \"$DOORMAN_ID\",
            \"userType\": \"doorman\",
            \"cause\": \"hangup\"
        }")

    if echo "$END_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Call ended successfully${NC}"
        DURATION=$(echo "$END_RESPONSE" | grep -o '"duration":[0-9]*' | cut -d':' -f2)
        echo "   Duration: ${DURATION:-0} seconds"
    else
        echo -e "${YELLOW}⚠️  Could not end call${NC}"
        echo "$END_RESPONSE" | head -n 3
    fi
else
    echo -e "${YELLOW}⚠️  No call ID available (skipped)${NC}"
fi
echo ""

# Summary
echo "===================================="
echo "📊 Test Summary"
echo "===================================="
echo -e "${GREEN}✅ API is operational${NC}"
echo -e "${GREEN}✅ Token generation works${NC}"
echo -e "${GREEN}✅ Call creation works${NC}"
echo ""
echo "Note: Some tests may show warnings if test data (apartments, residents)"
echo "doesn't exist in your database. This is expected for a clean installation."
echo ""
echo "To set up test data, run the database migration scripts or manually"
echo "create test buildings, apartments, and resident profiles."
echo ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo "1. Set up test users in Supabase (porteiro and morador)"
echo "2. Create test building and apartment"
echo "3. Run Expo app on two devices to test real audio calls"
echo "4. Check logs in API console for detailed information"
echo ""
echo "See TESTING_AGORA_CALLS.md for full testing guide."
