#!/bin/bash

# Dictionary Health Check Script
# This script checks if the dictionary service is healthy and restarts if needed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$REPO_ROOT/logs/health-check.log"
HEALTH_URL="http://localhost:8098/api/health"
MAX_LOG_LINES=1000

mkdir -p "$REPO_ROOT/logs"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to trim log file
trim_log() {
    if [ -f "$LOG_FILE" ]; then
        tail -n $MAX_LOG_LINES "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
}

# Check if container is running
if ! docker ps | grep -q dictionary-api; then
    log "ERROR: Dictionary container is not running!"
    log "Attempting to start container..."
    cd "$REPO_ROOT"
    docker compose up -d
    log "Container started"
    trim_log
    exit 1
fi

# Check health endpoint
RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" != "200" ]; then
    log "ERROR: Health check failed with HTTP code: $HTTP_CODE"
    log "Restarting container..."
    docker restart dictionary-api
    sleep 5
    log "Container restarted"
    trim_log
    exit 1
fi

# Parse JSON response to check API statuses
DICT_STATUS=$(echo "$BODY" | grep -o '"dictionaryApi":{[^}]*"status":"[^"]*"' | grep -o 'status":"[^"]*"' | cut -d'"' -f3)
TRANS_STATUS=$(echo "$BODY" | grep -o '"translationApi":{[^}]*"status":"[^"]*"' | grep -o 'status":"[^"]*"' | cut -d'"' -f3)
AUTO_STATUS=$(echo "$BODY" | grep -o '"autocompleteApi":{[^}]*"status":"[^"]*"' | grep -o 'status":"[^"]*"' | cut -d'"' -f3)

# Check if any API is unhealthy
UNHEALTHY=0
if [ "$DICT_STATUS" = "unhealthy" ]; then
    log "WARNING: Dictionary API is unhealthy"
    UNHEALTHY=1
fi

if [ "$TRANS_STATUS" = "unhealthy" ]; then
    log "WARNING: Translation API is unhealthy"
    UNHEALTHY=1
fi

if [ "$AUTO_STATUS" = "unhealthy" ]; then
    log "WARNING: Autocomplete API is unhealthy"
    UNHEALTHY=1
fi

if [ $UNHEALTHY -eq 1 ]; then
    log "Some APIs are unhealthy, but this may be temporary. Monitoring..."
    # Don't restart for API issues - they're external services
else
    log "All systems healthy (Dictionary: $DICT_STATUS, Translation: $TRANS_STATUS, Autocomplete: $AUTO_STATUS)"
fi

trim_log
exit 0

