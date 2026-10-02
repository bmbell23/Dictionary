#!/usr/bin/env node
// Download Open English WordNet 2025 (JSON) and build ${DATA_DIR}/dictionary.db.
// Builds into dictionary.db.tmp and renames over dictionary.db only on success;
// on any failure the existing dictionary.db is left untouched and we exit non-zero.
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { execFileSync } = require('child_process');
const { buildDatabase } = require('./oewn');

const SOURCE_URL = 'https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip';
const MIN_ZIP_BYTES = 5 * 1024 * 1024;
const MIN_LEMMAS = 100000;

async function download(url, dest) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, maxRedirects: 5 });
    fs.writeFileSync(dest, Buffer.from(res.data));
    return fs.statSync(dest).size;
}

// Build srcDir -> dataDir/dictionary.db atomically. Exported for tests.
function buildAndSwap(srcDir, dataDir, { sourceUrl = SOURCE_URL, minLemmas = MIN_LEMMAS } = {}) {
    const finalPath = path.join(dataDir, 'dictionary.db');
    const tmpPath = finalPath + '.tmp';
    fs.mkdirSync(dataDir, { recursive: true });
    fs.rmSync(tmpPath, { force: true });
    try {
        const counts = buildDatabase(srcDir, tmpPath, { sourceUrl, minLemmas });
        fs.renameSync(tmpPath, finalPath);
        return { ...counts, finalPath };
    } catch (err) {
        fs.rmSync(tmpPath, { force: true });
        throw err;
    }
}

async function main() {
    const started = Date.now();
    const dataDir = process.env.DATA_DIR || '/data';
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'oewn-'));
    try {
        console.log(`Downloading ${SOURCE_URL}`);
        const zipPath = path.join(work, 'oewn.zip');
        const size = await download(SOURCE_URL, zipPath);
        console.log(`Downloaded ${(size / 1048576).toFixed(1)} MB`);
        if (size < MIN_ZIP_BYTES) throw new Error(`download too small (${size} bytes)`);

        const srcDir = path.join(work, 'src');
        fs.mkdirSync(srcDir);
        execFileSync('unzip', ['-q', '-o', zipPath, '-d', srcDir]);

        const { lemmas, senses, finalPath } = buildAndSwap(srcDir, dataDir);
        const dbMb = (fs.statSync(finalPath).size / 1048576).toFixed(1);
        console.log(`OK: ${lemmas} lemmas, ${senses} senses, ${dbMb} MB -> ${finalPath} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error(`Sync FAILED (existing dictionary.db untouched): ${err.message}`);
        process.exit(1);
    });
}

module.exports = { buildAndSwap, SOURCE_URL };
