# Dictionary Monitoring & Health Checks

## 🔍 Overview

The dictionary service includes a comprehensive monitoring system to ensure all APIs stay healthy and the service remains available.

## 🏥 Health Check System

### What's Monitored

The system monitors three external APIs:

1. **Dictionary API** (dictionaryapi.dev)
   - Provides word definitions, phonetics, examples
   - Checked every hour
   - Critical for main dictionary functionality

2. **Translation API** (MyMemory)
   - Provides translations in 9 languages
   - Checked every hour
   - Used for translations and learning mode

3. **Autocomplete API** (Datamuse)
   - Provides word suggestions as you type
   - Checked every hour
   - Used for search autocomplete

### Health Check Frequency

- **Automatic checks**: Every 60 minutes
- **On startup**: Immediate health check when container starts
- **Manual checks**: Available via API endpoint

## 📊 Health Check API

### View Health Status

```bash
curl http://100.69.184.113:8098/api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-21T06:51:39.543Z",
  "apis": {
    "lastCheck": "2026-03-21T06:51:38.661Z",
    "dictionaryApi": {
      "status": "healthy",
      "lastSuccess": "2026-03-21T06:51:38.661Z"
    },
    "translationApi": {
      "status": "healthy",
      "lastSuccess": "2026-03-21T06:51:38.661Z"
    },
    "autocompleteApi": {
      "status": "healthy",
      "lastSuccess": "2026-03-21T06:51:38.661Z"
    }
  }
}
```

### Force Health Check

```bash
curl -X POST http://100.69.184.113:8098/api/health/check
```

This triggers an immediate health check of all APIs.

## 🤖 Automated Monitoring (Cron Job)

### Setup Cron Job

Run the setup script to enable automated monitoring:

```bash
cd /home/brandon/projects/Dictionary
./scripts/setup-cron.sh
```

This will:
- Create a cron job that runs every 15 minutes
- Check if the container is running
- Verify all APIs are healthy
- Restart the container if it's down
- Log all activity

### Cron Schedule

**Frequency**: Every 15 minutes

**What it does:**
1. Checks if dictionary-api container is running
2. If not running → starts the container
3. If running → checks health endpoint
4. If health check fails → restarts container
5. If APIs are unhealthy → logs warning (doesn't restart)
6. Logs all activity to `health-check.log`

### View Cron Jobs

```bash
crontab -l
```

### Remove Cron Job

```bash
crontab -e
# Delete the line containing "health-check.sh"
```

## 📝 Logs

### Health Check Logs

Location: `/home/brandon/projects/Dictionary/logs/health-check.log`

**View logs:**
```bash
tail -f /home/brandon/projects/Dictionary/logs/health-check.log
```

**Example log entries:**
```
[2026-03-21 00:51:45] All systems healthy (Dictionary: healthy, Translation: healthy, Autocomplete: healthy)
[2026-03-21 01:06:45] All systems healthy (Dictionary: healthy, Translation: healthy, Autocomplete: healthy)
[2026-03-21 01:21:45] WARNING: Translation API is unhealthy
[2026-03-21 01:36:45] All systems healthy (Dictionary: healthy, Translation: healthy, Autocomplete: healthy)
```

**Log rotation:**
- Automatically keeps last 1000 lines
- Older entries are removed
- Prevents log file from growing too large

### Container Logs

```bash
docker logs dictionary-api
docker logs dictionary-api -f  # Follow logs
```

## 🔧 Manual Health Check

Run the health check script manually:

```bash
cd /home/brandon/projects/Dictionary
./scripts/health-check.sh
```

**Output:**
```
[2026-03-21 00:51:45] All systems healthy (Dictionary: healthy, Translation: healthy, Autocomplete: healthy)
```

## ⚠️ Troubleshooting

### Container Not Running

If the health check detects the container is down:
1. Automatically starts the container
2. Logs the event
3. Waits 5 seconds for startup
4. Next check verifies it's running

### API Unhealthy

If an external API is unhealthy:
1. Logs a warning
2. Does NOT restart container (it's not our fault)
3. Continues monitoring
4. Usually resolves itself when API recovers

### Health Check Fails

If the health endpoint returns non-200:
1. Restarts the container
2. Logs the event
3. Waits 5 seconds
4. Next check verifies it's working

## 📈 Monitoring Best Practices

### Regular Checks

1. **Weekly**: Review health-check.log for patterns
2. **Monthly**: Check if APIs have frequent issues
3. **After updates**: Verify health checks still work

### Dashboard Integration

The health endpoint can be integrated with monitoring tools:
- Prometheus
- Grafana
- Uptime Kuma
- Custom dashboards

**Example Prometheus scrape config:**
```yaml
scrape_configs:
  - job_name: 'dictionary'
    static_configs:
      - targets: ['100.69.184.113:8098']
    metrics_path: '/api/health'
```

## 🎯 What Gets Updated

### Automatic Updates

The health check system ensures:
- ✅ Container stays running
- ✅ APIs are monitored
- ✅ Automatic restarts if needed
- ✅ Logs for troubleshooting

### What Doesn't Auto-Update

- ❌ Dictionary data (comes from external APIs)
- ❌ Container image (manual: `docker compose pull`)
- ❌ Code changes (manual: restart container)

### Updating the Container

To update to the latest code:

```bash
cd /home/brandon/projects/Dictionary
docker compose down
docker compose up -d
```

## 📊 Status Summary

**Current Setup:**
- ✅ Health checks every hour (in-app)
- ✅ Cron monitoring every 15 minutes (optional)
- ✅ Automatic container restart if down
- ✅ Logging of all health events
- ✅ Manual health check available

**APIs Monitored:**
- ✅ Dictionary API (dictionaryapi.dev)
- ✅ Translation API (mymemory.translated.net)
- ✅ Autocomplete API (datamuse.com)

All systems operational! 🎉

