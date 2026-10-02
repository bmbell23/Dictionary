const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { buildAndSwap } = require('../sync-dictionary');
const { writeFixture } = require('./fixture');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dict-server-test-'));
process.env.DATA_DIR = path.join(work, 'data');
const { fetchEnglishEntries, closeLocalDb, localDictionaryInfo } = require('../server');

function stubLive(impl) {
    const orig = axios.get;
    axios.get = impl;
    return () => { axios.get = orig; };
}

test('missing DB falls back to live dictionaryapi.dev', async () => {
    const restore = stubLive(async () => ({ data: [{ word: 'zzz', meanings: [] }] }));
    try {
        const r = await fetchEnglishEntries('zzz');
        assert.strictEqual(r[0].source, 'dictionaryapi.dev');
        assert.strictEqual(localDictionaryInfo().status, 'missing');
    } finally { restore(); }
});

test('live 404 returns null', async () => {
    const restore = stubLive(async () => { const e = new Error('nf'); e.response = { status: 404 }; throw e; });
    try {
        assert.strictEqual(await fetchEnglishEntries('qqqq'), null);
    } finally { restore(); }
});

test('hits local DB first (no live call), case-insensitive', async () => {
    writeFixture(path.join(work, 'src'));
    buildAndSwap(path.join(work, 'src'), process.env.DATA_DIR, { minLemmas: 1 });
    let liveCalls = 0;
    const restore = stubLive(async () => { liveCalls++; throw new Error('should not be called'); });
    try {
        const r = await fetchEnglishEntries('RUN');
        assert.strictEqual(r[0].source, 'oewn-2025');
        assert.strictEqual(r[0].word, 'run');
        assert.strictEqual(liveCalls, 0);
        const info = localDictionaryInfo();
        assert.strictEqual(info.status, 'ok');
        assert.strictEqual(info.words, 3);
        assert.ok(info.builtAt);
    } finally { restore(); }
});

test('word absent locally falls back to live', async () => {
    const restore = stubLive(async () => ({ data: [{ word: 'notinwordnet', meanings: [] }] }));
    try {
        const r = await fetchEnglishEntries('notinwordnet');
        assert.strictEqual(r[0].source, 'dictionaryapi.dev');
    } finally { restore(); }
});

test('reopens the DB after a sync replaces the file', async () => {
    const restore = stubLive(async () => { throw new Error('no live'); });
    try {
        assert.strictEqual((await fetchEnglishEntries('hot'))[0].meanings[0].definitions[0].definition, 'high temperature');
        fs.writeFileSync(path.join(work, 'src', 'adj.all.json'), JSON.stringify({
            '3-a': { definition: ['changed definition'], members: ['hot'], partOfSpeech: 'a' },
            '4-s': { definition: ['low temperature'], members: ['cold'], partOfSpeech: 's' }
        }));
        buildAndSwap(path.join(work, 'src'), process.env.DATA_DIR, { minLemmas: 1 });
        assert.strictEqual((await fetchEnglishEntries('hot'))[0].meanings[0].definitions[0].definition, 'changed definition');
    } finally { restore(); }
});

test.after(() => closeLocalDb());
