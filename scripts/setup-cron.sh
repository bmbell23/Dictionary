#!/bin/bash

# Setup cron job for dictionary health checks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTH_SCRIPT="$SCRIPT_DIR/health-check.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$REPO_ROOT/logs/health-check.log"
CRON_JOB="*/15 * * * * $HEALTH_SCRIPT >> $LOG_FILE 2>&1"

echo "Setting up cron job for dictionary health checks..."
echo ""
echo "This will run the health check every 15 minutes."
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$HEALTH_SCRIPT"; then
    echo "Cron job already exists!"
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep "$HEALTH_SCRIPT"
    echo ""
    read -p "Do you want to remove and re-add it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
    
    # Remove existing cron job
    crontab -l | grep -v "$HEALTH_SCRIPT" | crontab -
    echo "Removed existing cron job."
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo ""
echo "✅ Cron job added successfully!"
echo ""
echo "Schedule: Every 15 minutes"
echo "Script: $HEALTH_SCRIPT"
echo "Log: $LOG_FILE"
echo ""
echo "To view current cron jobs:"
echo "  crontab -l"
echo ""
echo "To view health check logs:"
echo "  tail -f $LOG_FILE"
echo ""
echo "To remove the cron job:"
echo "  crontab -e"
echo "  (then delete the line with health-check.sh)"
echo ""

