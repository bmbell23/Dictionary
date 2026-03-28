# Dictionary - Web-Based Word Lookup

A simple, beautiful dictionary service using the Free Dictionary API.

## Features

- **Modern Web Interface**: Clean, beautiful gradient design
- **Instant Lookups**: Fast word definitions powered by Free Dictionary API
- **Comprehensive Data**: Definitions, synonyms, antonyms, examples, phonetics
- **Audio Pronunciations**: Hear how words are pronounced
- **Direct Links**: Share word definitions with simple URLs
- **No Configuration**: Works immediately, no setup needed

## Quick Start

### 1. Start the Container

```bash
cd /home/brandon/projects/Dictionary
docker compose up -d
```

### 2. Access the Dictionary

Open your browser and go to:
- **Local**: http://localhost:8098
- **Tailscale**: http://100.69.184.113:8098

### 3. Start Looking Up Words!

That's it! No configuration needed. Just type a word and search.

## Usage

### Web Interface

Simply open http://100.69.184.113:8098 and type any word in the search box.

### Direct Word Lookup

Navigate directly to a word definition:
```
http://100.69.184.113:8098/<word>
```

Examples:
- http://100.69.184.113:8098/hello
- http://100.69.184.113:8098/serendipity
- http://100.69.184.113:8098/ephemeral

### API Access

Get JSON data for any word:
```bash
curl http://100.69.184.113:8098/api/hello
```

### What You Get

- **Definitions**: Multiple meanings with examples
- **Part of Speech**: Noun, verb, adjective, etc.
- **Phonetics**: Pronunciation guides
- **Audio**: Pronunciation audio files
- **Synonyms**: Similar words
- **Antonyms**: Opposite words
- **Examples**: Real usage examples

## Directory Structure

```
dictionary/
├── docker-compose.yml
├── README.md
├── version.txt
├── docs/
│   ├── WORKING-GUIDE.md
│   ├── SUMMARY.md
│   └── MONITORING.md
├── scripts/
│   ├── health-check.sh
│   └── setup-cron.sh
├── logs/
│   └── health-check.log
└── app/
    ├── server.js        # Node.js server
    ├── package.json
    └── public/
        └── index.html   # Web interface
```

## Management

### View Logs

```bash
docker logs dictionary-api
docker logs dictionary-api -f  # Follow logs
```

### Restart the Service

```bash
cd /home/brandon/projects/Dictionary
docker compose restart
```

### Stop the Service

```bash
docker compose down
```

### Start the Service

```bash
docker compose up -d
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker logs dictionary-api
```

### Can't access from Tailscale IP

Check iptables rules:
```bash
sudo iptables-save | grep 8098
```

If there are stale DNAT rules, remove them:
```bash
sudo iptables -t nat -D DOCKER ! -i <old-bridge> -p tcp -m tcp --dport 8098 -j DNAT --to-destination <old-ip>:8098
```

### Word not found

The Free Dictionary API has comprehensive coverage but may not have every word. Try:
- Checking spelling
- Trying a different form of the word
- Using a more common synonym

## Technical Details

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript with modern CSS
- **Data Source**: Free Dictionary API (https://dictionaryapi.dev/)
- **Port**: 8098
- **Container**: dictionary-api

## Why This Approach?

Unlike traditional dictionary apps that require downloading large dictionary files:

- ✅ **Zero configuration** - Works immediately
- ✅ **Always up-to-date** - Dictionary data maintained by the API
- ✅ **No storage needed** - No large dictionary files to manage
- ✅ **Simple and reliable** - Minimal dependencies
- ✅ **Beautiful interface** - Modern, responsive design

## Links

- **Free Dictionary API**: https://dictionaryapi.dev/
- **Dashboard**: http://100.69.184.113:8001

## Documentation

- **Guide**: `docs/WORKING-GUIDE.md`
- **Monitoring**: `docs/MONITORING.md`
- **Feature Summary**: `docs/SUMMARY.md`

