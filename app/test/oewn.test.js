const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { buildDatabase } = require('../oewn');
const { buildAndSwap } = require('../sync-dictionary');
const { writeFixture } = require('./fixture');

function tmp() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'dict-test-'));
}

function lookup(dbPath, lemma) {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
        const row = db.prepare('SELECT data FROM entries WHERE lemma = ?').get(lemma);
        return row ? JSON.parse(row.data) : null;
    } finally {
        db.close();
    }
}

test('maps OEWN fixture to dictionaryapi.dev shape', () => {
    const work = tmp();
    writeFixture(path.join(work, 'src'));
    const dbPath = path.join(work, 'd.db');
    const counts = buildDatabase(path.join(work, 'src'), dbPath, { sourceUrl: 'http://x' });
    assert.strictEqual(counts.lemmas, 3); // run (merged with Run), hot, cold; nodef skipped
    const run = lookup(dbPath, 'run');
    assert.strictEqual(run.length, 1);
    assert.strictEqual(run[0].word, 'run');
    assert.strictEqual(run[0].source, 'oewn-2025');
    assert.strictEqual(run[0].phonetic, '/ɹʌn/');
    assert.deepStrictEqual(run[0].phonetics, [{ text: '/ɹʌn/' }]);
    const pos = run[0].meanings.map(m => m.partOfSpeech).sort();
    assert.deepStrictEqual(pos, ['noun', 'verb']);
    const noun = run[0].meanings.find(m => m.partOfSpeech === 'noun');
    assert.strictEqual(noun.definitions.length, 2); // Run + run noun senses
    assert.deepStrictEqual(noun.definitions[0], {
        definition: 'a score in baseball', example: 'he hit a run', synonyms: ['tally'], antonyms: []
    });
    const verb = run[0].meanings.find(m => m.partOfSpeech === 'verb');
    assert.strictEqual(verb.definitions[0].example, '');
    assert.deepStrictEqual(verb.definitions[0].synonyms, ['sprint']);
    assert.deepStrictEqual(lookup(dbPath, 'hot')[0].meanings[0].definitions[0].antonyms, ['cold']);
    assert.strictEqual(lookup(dbPath, 'cold')[0].meanings[0].partOfSpeech, 'adjective');
    assert.strictEqual(lookup(dbPath, 'nodef'), null);
    assert.strictEqual(lookup(dbPath, 'hot')[0].phonetic, '');
});

test('meta table records source, time and counts', () => {
    const work = tmp();
    writeFixture(path.join(work, 'src'));
    const dbPath = path.join(work, 'd.db');
    buildDatabase(path.join(work, 'src'), dbPath, { sourceUrl: 'http://example/oewn.zip' });
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map(r => [r.key, r.value]));
    db.close();
    assert.strictEqual(meta.source_url, 'http://example/oewn.zip');
    assert.strictEqual(meta.lemmas, '3');
    assert.ok(!isNaN(Date.parse(meta.built_at)));
});

test('successful build swaps atomically into dictionary.db', () => {
    const work = tmp();
    writeFixture(path.join(work, 'src'));
    const data = path.join(work, 'data');
    buildAndSwap(path.join(work, 'src'), data, { minLemmas: 1 });
    assert.ok(fs.existsSync(path.join(data, 'dictionary.db')));
    assert.ok(!fs.existsSync(path.join(data, 'dictionary.db.tmp')));
});

test('failed build leaves the old DB intact', () => {
    const work = tmp();
    writeFixture(path.join(work, 'src'));
    const data = path.join(work, 'data');
    buildAndSwap(path.join(work, 'src'), data, { minLemmas: 1 });
    const dbFile = path.join(data, 'dictionary.db');
    const before = fs.readFileSync(dbFile);

    // Too few lemmas -> sanity check fails
    assert.throws(() => buildAndSwap(path.join(work, 'src'), data, { minLemmas: 100000 }), /only 3 lemmas/);
    // Corrupt source -> build throws
    fs.writeFileSync(path.join(work, 'src', 'entries-h.json'), '{not json');
    assert.throws(() => buildAndSwap(path.join(work, 'src'), data, { minLemmas: 1 }));

    assert.ok(before.equals(fs.readFileSync(dbFile)), 'dictionary.db changed');
    assert.ok(!fs.existsSync(dbFile + '.tmp'), 'tmp file left behind');
    assert.ok(lookup(dbFile, 'run'));
});
