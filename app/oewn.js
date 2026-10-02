// Open English WordNet (JSON release) -> SQLite, with one precomputed
// dictionaryapi.dev-shaped JSON blob per lowercase lemma.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const POS_NAMES = { n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' };

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Entry POS keys can carry a homograph suffix ("n-1"); strip it.
function basePos(key) {
    return key.split('-')[0];
}

// Load every synset file (everything that isn't entries-*.json / frames.json).
function loadSynsets(srcDir) {
    const synsets = {};
    for (const f of fs.readdirSync(srcDir)) {
        if (!f.endsWith('.json') || f.startsWith('entries-') || f === 'frames.json') continue;
        Object.assign(synsets, readJson(path.join(srcDir, f)));
    }
    return synsets;
}

// Load all entries merged by lowercase lemma:
// Map<lowerLemma, { pronunciations: [], senses: [{pos, id, synset, antonym}] }>
function loadEntries(srcDir) {
    const lemmas = new Map();
    const senseLemma = new Map(); // sense id -> lowercase lemma
    for (const f of fs.readdirSync(srcDir).sort()) {
        if (!f.startsWith('entries-') || !f.endsWith('.json')) continue;
        const data = readJson(path.join(srcDir, f));
        for (const [lemma, byPos] of Object.entries(data)) {
            const key = lemma.toLowerCase();
            let rec = lemmas.get(key);
            if (!rec) {
                rec = { pronunciations: [], senses: [] };
                lemmas.set(key, rec);
            }
            for (const [posKey, e] of Object.entries(byPos)) {
                const pos = basePos(posKey);
                for (const p of e.pronunciation || []) {
                    if (p.value && !rec.pronunciations.includes(p.value)) rec.pronunciations.push(p.value);
                }
                for (const s of e.sense || []) {
                    rec.senses.push({ pos, id: s.id, synset: s.synset, antonym: s.antonym || [] });
                    senseLemma.set(s.id, key);
                }
            }
        }
    }
    return { lemmas, senseLemma };
}

// Build the dictionaryapi.dev-shaped array for one lemma.
function buildEntry(lemma, rec, synsets, senseLemma) {
    const meaningsByPos = new Map();
    for (const s of rec.senses) {
        const syn = synsets[s.synset];
        if (!syn || !syn.definition || !syn.definition[0]) continue;
        const name = POS_NAMES[s.pos] || s.pos;
        if (!meaningsByPos.has(name)) meaningsByPos.set(name, []);
        const seen = new Set([lemma]);
        const synonyms = [];
        for (const m of syn.members || []) {
            const l = m.toLowerCase();
            if (!seen.has(l)) { seen.add(l); synonyms.push(m); }
        }
        const antonyms = [];
        for (const id of s.antonym) {
            const l = senseLemma.get(id);
            if (l && !antonyms.includes(l)) antonyms.push(l);
        }
        meaningsByPos.get(name).push({
            definition: syn.definition[0],
            example: (syn.example && syn.example[0]) || '',
            synonyms,
            antonyms
        });
    }
    if (meaningsByPos.size === 0) return null;
    const pron = rec.pronunciations[0] ? `/${rec.pronunciations[0]}/` : '';
    return {
        senseCount: rec.senses.length,
        entries: [{
            word: lemma,
            phonetic: pron,
            phonetics: rec.pronunciations.map(p => ({ text: `/${p}/` })),
            meanings: [...meaningsByPos].map(([partOfSpeech, definitions]) => ({ partOfSpeech, definitions })),
            source: 'oewn-2025'
        }]
    };
}

// Build the SQLite file at dbPath from an extracted JSON release in srcDir.
// Returns { lemmas, senses }. Throws if fewer than minLemmas lemmas result.
function buildDatabase(srcDir, dbPath, { sourceUrl = '', minLemmas = 0 } = {}) {
    const synsets = loadSynsets(srcDir);
    const { lemmas, senseLemma } = loadEntries(srcDir);
    const db = new DatabaseSync(dbPath);
    let lemmaCount = 0;
    let senseCount = 0;
    try {
        db.exec(`
            CREATE TABLE entries (lemma TEXT PRIMARY KEY, data TEXT NOT NULL) WITHOUT ROWID;
            CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        `);
        const ins = db.prepare('INSERT INTO entries (lemma, data) VALUES (?, ?)');
        db.exec('BEGIN');
        for (const [lemma, rec] of lemmas) {
            const built = buildEntry(lemma, rec, synsets, senseLemma);
            if (!built) continue;
            ins.run(lemma, JSON.stringify(built.entries));
            lemmaCount++;
            senseCount += built.senseCount;
        }
        const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
        meta.run('source_url', sourceUrl);
        meta.run('source', 'Open English WordNet 2025');
        meta.run('built_at', new Date().toISOString());
        meta.run('lemmas', String(lemmaCount));
        meta.run('senses', String(senseCount));
        db.exec('COMMIT');
    } finally {
        db.close();
    }
    if (lemmaCount < minLemmas) {
        throw new Error(`build produced only ${lemmaCount} lemmas (expected at least ${minLemmas})`);
    }
    return { lemmas: lemmaCount, senses: senseCount };
}

module.exports = { buildDatabase, buildEntry, loadEntries, loadSynsets, POS_NAMES };
