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


## Local dictionary (Open English WordNet)

English lookups are served from a local SQLite database built from Open English WordNet 2025 (JSON release), with live `api.dictionaryapi.dev` as a fallback when the DB is missing or the word is not in it. Responses carry `source: "oewn-2025"` or `"dictionaryapi.dev"`.

- **Where it lives:** `./data/dictionary.db` on the host (`/data/dictionary.db` in the container, via `DATA_DIR=/data`). `data/` is gitignored.
- **Build / refresh:** `docker exec dictionary-api node sync-dictionary.js`. It builds `dictionary.db.tmp`, sanity-checks the download and word count, then atomically renames it into place; on any failure the existing DB is untouched and the script exits non-zero. The server notices the replaced file and reopens it, so no restart is needed.
- **Status:** `/api/health` reports `localDictionary: {status, words, builtAt}`.
- **Schedule:** `dagu/dictionary-sync.yaml` is a weekly (Sunday 04:00 America/New_York) Dagu DAG. It is not installed anywhere yet; Dagu cannot run host jobs (`docker exec`) today.
- **Tests:** `cd app && npm test` (Node 22+, uses built-in `node:sqlite`).

## `!define` — glossary entries with a personal connection

`!define <term>` in Mattermost wakes Daphne. It works for any word: a word for your writing, a neat one you heard, or one from the infrastructure. She replies with the definition and, when there is one, **how it connects to you**. Then she saves it to the personal glossary on the live copy with `scripts/define-save`:

```bash
scripts/define-save ingress \
  --definition "The act of entering, or a way in; in Kubernetes, the rules that route outside HTTP traffic to services." \
  --notes "In our setup: Traefik on k3s01-03 is the ingress; dictionary.10.0.0.201.sslip.io comes in through it." \
  --pos noun --tags infra,k8s --see-also "egress,Traefik"
```

**Every `!define` reply comes in three tiers, each linking to the next (#21):**
1. **Inline**, where Brandon typed it: 1–2 lines with the gist, then `[more in #dictionary](<permalink>) · [in the dictionary](<app link>)`.
2. **`#dictionary`**: the fuller, fun version. It has all the senses, the etymology, the word spelled out, the personal connection and related words, and ends with the app link. Posted with `/home/brandon/projects/agent-bus/bin/say daphne '#dictionary' -`, which prints the post id. The permalink is `http://100.69.184.113:8015/office/pl/<post id>`.
3. **The app**: `http://dictionary.10.0.0.201.sslip.io/<term, URL-encoded>`. The `/:word` route pre-fills the search and shows the 📒 term with its 📖 badge and notes.

The order: save the term first, then post tier 2, then write tier 1 with both links. If tier 2 can't be posted, say so in tier 1 and keep the app link.

Tier 1 starts with the word itself, with no process talk ("saved… one catch…"). Mention a problem only if something actually failed. The dictionary link is always the app page above, never `/api/...` JSON.

- Every save stamps `definedAt` with the current time. In the UI it's the **📖 !define'd <date>** badge, on the lookup card and in the Terms tab. `GET /api/terms?defined=1` lists only the terms I was asked to define. Terms you add by hand don't get the badge.
- The script creates the term, or updates it if it's already there. On an update, any field you don't pass keeps its current value.
- `DICTIONARY_URL` overrides the target (default `http://dictionary.10.0.0.201.sslip.io`). Exit codes: 1 = HTTP error, 2 = usage.
- **Entry convention:**
  - `definition`: the general meaning, all of its senses (*ingress* is a river mouth and an astronomer's word too, not just Kubernetes).
  - `notes`: the personal connection, only when there's a real one, and with concrete details:
    - **"In our setup:"** hosts, ports, repos, tickets. This is the most valuable kind.
    - **"In your books:"** authors and titles from the GreatReads library.
    - **"For your hobbies:"** woodworking, bookbinding, writing, music, photography.
  - Leave `notes` out rather than invent a connection, and keep anything private or explicit out of it.
  - `tags`: the topic, e.g. `infra`, `writing`, `bookbinding`, `woodworking`, `neat-word`.
  - `seeAlso`: related words.
