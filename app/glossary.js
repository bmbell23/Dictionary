// Personal glossary: Brandon's own terms, stored in SQLite under DATA_DIR.
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const FIELDS = ['term', 'definition', 'partOfSpeech', 'tags', 'notes', 'seeAlso'];

let db = null;

function open(dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data')) {
    if (db) db.close();
    fs.mkdirSync(dataDir, { recursive: true });
    db = new DatabaseSync(path.join(dataDir, 'glossary.db'));
    db.exec(`
        CREATE TABLE IF NOT EXISTS terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term TEXT NOT NULL,
            term_key TEXT NOT NULL UNIQUE,
            definition TEXT NOT NULL,
            part_of_speech TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            notes TEXT NOT NULL DEFAULT '',
            see_also TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);
    return db;
}

function conn() {
    return db || open();
}

function key(term) {
    return String(term || '').trim().toLowerCase();
}

function toList(value) {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
    return [];
}

function fromRow(row) {
    if (!row) return null;
    return {
        term: row.term,
        definition: row.definition,
        partOfSpeech: row.part_of_speech,
        tags: JSON.parse(row.tags),
        notes: row.notes,
        seeAlso: JSON.parse(row.see_also),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

// Throws { status, message } on bad input.
function validate(input, { partial = false } = {}) {
    const unknown = Object.keys(input || {}).filter(k => !FIELDS.includes(k));
    if (unknown.length) throw { status: 400, message: `Unknown field(s): ${unknown.join(', ')}` };
    const out = {};
    if (!partial || input.term !== undefined) {
        out.term = String(input.term || '').trim();
        if (!out.term) throw { status: 400, message: 'term is required' };
        if (out.term.length > 200) throw { status: 400, message: 'term is too long (max 200)' };
    }
    if (!partial || input.definition !== undefined) {
        out.definition = String(input.definition || '').trim();
        if (!out.definition) throw { status: 400, message: 'definition is required' };
    }
    if (input.partOfSpeech !== undefined) out.partOfSpeech = String(input.partOfSpeech).trim();
    if (input.notes !== undefined) out.notes = String(input.notes).trim();
    if (input.tags !== undefined) out.tags = toList(input.tags);
    if (input.seeAlso !== undefined) out.seeAlso = toList(input.seeAlso);
    return out;
}

function get(term) {
    return fromRow(conn().prepare('SELECT * FROM terms WHERE term_key = ?').get(key(term)));
}

function list({ tag, q } = {}) {
    let rows = conn().prepare('SELECT * FROM terms ORDER BY term_key').all().map(fromRow);
    if (tag) rows = rows.filter(t => t.tags.some(x => x.toLowerCase() === tag.toLowerCase()));
    if (q) rows = rows.filter(t => t.term.toLowerCase().includes(q.toLowerCase()));
    return rows;
}

function tags() {
    const counts = {};
    for (const t of list()) for (const tag of t.tags) counts[tag] = (counts[tag] || 0) + 1;
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}

function suggest(prefix, max = 8) {
    const p = key(prefix).replace(/[\\%_]/g, c => '\\' + c);
    if (!p) return [];
    return conn()
        .prepare("SELECT term FROM terms WHERE term_key LIKE ? ESCAPE '\\' ORDER BY term_key LIMIT ?")
        .all(p + '%', max)
        .map(r => r.term);
}

function create(input) {
    const t = validate(input);
    if (get(t.term)) throw { status: 409, message: `"${t.term}" is already in the glossary` };
    const now = new Date().toISOString();
    conn().prepare(`
        INSERT INTO terms (term, term_key, definition, part_of_speech, tags, notes, see_also, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(t.term, key(t.term), t.definition, t.partOfSpeech || '', JSON.stringify(t.tags || []),
        t.notes || '', JSON.stringify(t.seeAlso || []), now, now);
    return get(t.term);
}

function update(term, input) {
    const existing = get(term);
    if (!existing) throw { status: 404, message: `"${term}" is not in the glossary` };
    const merged = { ...existing, ...validate(input, { partial: true }) };
    if (key(merged.term) !== key(existing.term) && get(merged.term)) {
        throw { status: 409, message: `"${merged.term}" is already in the glossary` };
    }
    conn().prepare(`
        UPDATE terms SET term = ?, term_key = ?, definition = ?, part_of_speech = ?, tags = ?, notes = ?,
            see_also = ?, updated_at = ?
        WHERE term_key = ?
    `).run(merged.term, key(merged.term), merged.definition, merged.partOfSpeech, JSON.stringify(merged.tags),
        merged.notes, JSON.stringify(merged.seeAlso), new Date().toISOString(), key(existing.term));
    return get(merged.term);
}

function remove(term) {
    const result = conn().prepare('DELETE FROM terms WHERE term_key = ?').run(key(term));
    if (!result.changes) throw { status: 404, message: `"${term}" is not in the glossary` };
}

module.exports = { open, get, list, tags, suggest, create, update, remove };
