const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glossary-test-'));
process.env.DATA_DIR = dataDir;

const glossary = require('../glossary.js');
const { app } = require('../server.js');

let server;
let base;

test.before(async () => {
    glossary.open(dataDir);
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
});

function api(method, url, body) {
    return fetch(base + url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
    });
}

test('create, read, list by tag, update, delete', async () => {
    let res = await api('POST', '/api/terms', {
        term: 'Dockerhost', definition: "Brandon's home server.", tags: 'server, homelab', seeAlso: ['Proxmox']
    });
    assert.strictEqual(res.status, 201);
    const created = await res.json();
    assert.deepStrictEqual(created.tags, ['server', 'homelab']);
    assert.deepStrictEqual(created.seeAlso, ['Proxmox']);

    res = await api('POST', '/api/terms', { term: 'dockerhost', definition: 'dupe' });
    assert.strictEqual(res.status, 409, 'terms are unique case-insensitively');

    await api('POST', '/api/terms', { term: 'GreatReads', definition: 'The library app.', tags: ['project:GreatReads'] });

    res = await api('GET', '/api/terms/DOCKERHOST');
    assert.strictEqual((await res.json()).term, 'Dockerhost');

    res = await api('GET', '/api/terms?tag=server');
    assert.deepStrictEqual((await res.json()).map(t => t.term), ['Dockerhost']);

    res = await api('GET', '/api/terms/tags');
    assert.deepStrictEqual(await res.json(), [
        { tag: 'homelab', count: 1 }, { tag: 'project:GreatReads', count: 1 }, { tag: 'server', count: 1 }
    ]);

    res = await api('PUT', '/api/terms/dockerhost', { definition: 'The home server (dockerhost).' });
    const updated = await res.json();
    assert.strictEqual(updated.definition, 'The home server (dockerhost).');
    assert.deepStrictEqual(updated.tags, ['server', 'homelab'], 'partial update keeps other fields');

    res = await api('PUT', '/api/terms/dockerhost', { term: 'greatreads' });
    assert.strictEqual(res.status, 409, 'cannot rename onto an existing term');

    res = await api('GET', '/api/terms/export');
    const dump = await res.json();
    assert.strictEqual(dump.terms.length, 2);

    res = await api('DELETE', '/api/terms/greatreads');
    assert.strictEqual(res.status, 204);
    res = await api('DELETE', '/api/terms/greatreads');
    assert.strictEqual(res.status, 404);
});

test('validation rejects bad input', async () => {
    let res = await api('POST', '/api/terms', { term: '  ', definition: 'x' });
    assert.strictEqual(res.status, 400);
    res = await api('POST', '/api/terms', { term: 'x' });
    assert.strictEqual(res.status, 400);
    res = await api('POST', '/api/terms', { term: 'x', definition: 'y', colour: 'red' });
    assert.strictEqual(res.status, 400);
});

test('lookup returns a glossary-only term without the dictionary', async (t) => {
    await api('POST', '/api/terms', { term: 'zorblaxian', definition: 'A made-up word.' });
    const res = await api('GET', '/api/lookup/Zorblaxian');
    // The dictionary half may be null (not a word) or unreachable offline; the term must be there either way.
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.glossary.term, 'zorblaxian');
});

test('suggest puts glossary terms first and escapes LIKE wildcards', async () => {
    await api('POST', '/api/terms', { term: 'zo_rb', definition: 'underscore term' });
    const mine = glossary.suggest('zo');
    assert.deepStrictEqual(mine, ['zo_rb', 'zorblaxian']);
    assert.deepStrictEqual(glossary.suggest('z_'), [], '_ is literal, not a wildcard');
    const res = await api('GET', '/api/suggest?q=zo');
    const suggestions = await res.json();
    assert.deepStrictEqual(suggestions.slice(0, 2), [
        { word: 'zo_rb', glossary: true }, { word: 'zorblaxian', glossary: true }
    ]);
});

test('terms survive reopening the database', () => {
    glossary.open(dataDir);
    assert.ok(glossary.get('dockerhost'));
});

test('definedAt: stored, kept on unrelated updates, filterable, validated', async () => {
    let res = await api('POST', '/api/terms', { term: 'Ingress', definition: 'Routes HTTP into the cluster.', definedAt: '2026-10-04T20:35:00Z' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual((await res.json()).definedAt, '2026-10-04T20:35:00.000Z');
    await api('POST', '/api/terms', { term: 'Handmade', definition: 'Added by hand.' });

    res = await api('PUT', '/api/terms/ingress', { notes: 'In our setup: Traefik on k3s.' });
    assert.strictEqual((await res.json()).definedAt, '2026-10-04T20:35:00.000Z');

    res = await api('GET', '/api/terms?defined=1');
    assert.deepStrictEqual((await res.json()).map(t => t.term), ['Ingress']);
    res = await api('GET', '/api/terms/handmade');
    assert.strictEqual((await res.json()).definedAt, null);

    res = await api('PUT', '/api/terms/ingress', { definedAt: 'not a date' });
    assert.strictEqual(res.status, 400);
    res = await api('PUT', '/api/terms/ingress', { definedAt: null });
    assert.strictEqual((await res.json()).definedAt, null);

    await api('DELETE', '/api/terms/ingress');
    await api('DELETE', '/api/terms/handmade');
});

test('opening a pre-#14 glossary adds defined_at and keeps its terms', () => {
    const { DatabaseSync } = require('node:sqlite');
    const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glossary-old-'));
    const old = new DatabaseSync(path.join(oldDir, 'glossary.db'));
    old.exec(`CREATE TABLE terms (id INTEGER PRIMARY KEY AUTOINCREMENT, term TEXT NOT NULL, term_key TEXT NOT NULL UNIQUE,
        definition TEXT NOT NULL, part_of_speech TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '', see_also TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    old.prepare(`INSERT INTO terms (term, term_key, definition, created_at, updated_at) VALUES ('Old', 'old', 'From before', 'x', 'x')`).run();
    old.close();
    try {
        glossary.open(oldDir);
        assert.strictEqual(glossary.get('old').definedAt, null);
        assert.strictEqual(glossary.update('old', { definedAt: '2026-10-05T00:00:00Z' }).definedAt, '2026-10-05T00:00:00.000Z');
    } finally {
        glossary.open(dataDir);
        fs.rmSync(oldDir, { recursive: true, force: true });
    }
});
