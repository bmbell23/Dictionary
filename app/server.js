const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { VOCABULARY_LEVELS } = require('./vocabulary-data.js');
const glossary = require('./glossary.js');

const app = express();
const PORT = 3000;

// Local dictionary (Open English WordNet, built by sync-dictionary.js)
let localDb = null;
let localDbStamp = null; // `${ino}:${mtimeMs}` of the file the handle was opened on

function dbPath() {
    return path.join(process.env.DATA_DIR || '/data', 'dictionary.db');
}

// Lazily open read-only; reopen when the file was replaced by a sync. Returns null if unavailable.
function getLocalDb() {
    let stamp;
    try {
        const st = fs.statSync(dbPath());
        stamp = `${st.ino}:${st.mtimeMs}`;
    } catch (e) {
        closeLocalDb();
        return null;
    }
    if (localDb && stamp === localDbStamp) return localDb;
    closeLocalDb();
    try {
        localDb = new DatabaseSync(dbPath(), { readOnly: true });
        localDbStamp = stamp;
    } catch (e) {
        console.error('Could not open local dictionary:', e.message);
        localDb = null;
        localDbStamp = null;
    }
    return localDb;
}

function closeLocalDb() {
    if (localDb) {
        try { localDb.close(); } catch (e) { /* ignore */ }
    }
    localDb = null;
    localDbStamp = null;
}

function localDictionaryInfo() {
    const db = getLocalDb();
    if (!db) return { status: 'missing', words: 0, builtAt: null };
    try {
        const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map(r => [r.key, r.value]));
        return { status: 'ok', words: parseInt(meta.lemmas, 10) || 0, builtAt: meta.built_at || null };
    } catch (e) {
        return { status: 'error', words: 0, builtAt: null };
    }
}

// Returns a dictionaryapi.dev-shaped array, or null if the word is not found.
// Local DB first, then live dictionaryapi.dev. Throws on non-404 live errors.
async function fetchEnglishEntries(word) {
    const key = String(word).trim().toLowerCase();
    const db = getLocalDb();
    if (db) {
        try {
            const row = db.prepare('SELECT data FROM entries WHERE lemma = ?').get(key);
            if (row) return JSON.parse(row.data);
        } catch (e) {
            console.error('Local dictionary lookup failed:', e.message);
        }
    }
    try {
        const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
        return response.data.map(entry => ({ ...entry, source: 'dictionaryapi.dev' }));
    } catch (error) {
        if (error.response && error.response.status === 404) return null;
        throw error;
    }
}

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Health check data
let healthStatus = {
    lastCheck: null,
    dictionaryApi: { status: 'unknown', lastSuccess: null },
    translationApi: { status: 'unknown', lastSuccess: null },
    autocompleteApi: { status: 'unknown', lastSuccess: null }
};

// Language codes for translation
const LANGUAGES = {
    'spanish': 'es',
    'french': 'fr',
    'italian': 'it',
    'mandarin': 'zh',
    'japanese': 'ja',
    'korean': 'ko',
    'german': 'de',
    'russian': 'ru',
    'polish': 'pl'
};

// Health check endpoint (must come before /api/:word).
// Answers from the cached upstream status and never waits on an upstream:
// k8s probes hit this, and a hanging dictionaryapi.dev must not take the pod down (#10).
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        apis: healthStatus,
        localDictionary: localDictionaryInfo()
    });
});

// Force health check (must come before /api/:word)
app.post('/api/health/check', async (req, res) => {
    await performHealthCheck();
    res.json({
        message: 'Health check completed',
        apis: healthStatus
    });
});

// Learning system endpoints (must come before /api/:word)

// Get vocabulary for a specific level
app.get('/api/learn/level/:level', (req, res) => {
    const level = parseInt(req.params.level);
    if (level < 1 || level > 20 || !VOCABULARY_LEVELS[level]) {
        return res.status(404).json({ error: 'Level not found' });
    }
    res.json({
        level: level,
        words: VOCABULARY_LEVELS[level],
        totalWords: VOCABULARY_LEVELS[level].length
    });
});

// Get a specific lesson (10 words from a level)
app.get('/api/learn/level/:level/lesson/:lesson', async (req, res) => {
    const level = parseInt(req.params.level);
    const lesson = parseInt(req.params.lesson);

    if (level < 1 || level > 20 || !VOCABULARY_LEVELS[level]) {
        return res.status(404).json({ error: 'Level not found' });
    }

    const words = VOCABULARY_LEVELS[level];
    const startIdx = (lesson - 1) * 10;
    const endIdx = startIdx + 10;

    if (startIdx >= words.length || startIdx < 0) {
        return res.status(404).json({ error: 'Lesson not found' });
    }

    const lessonWords = words.slice(startIdx, endIdx);

    // Fetch detailed data for each word
    const wordDetails = await Promise.all(
        lessonWords.map(async (word) => {
            try {
                const entries = await fetchEnglishEntries(word);
                const data = entries[0];
                return {
                    word: word,
                    phonetic: data.phonetic || '',
                    definition: data.meanings[0]?.definitions[0]?.definition || '',
                    partOfSpeech: data.meanings[0]?.partOfSpeech || '',
                    example: data.meanings[0]?.definitions[0]?.example || '',
                    audio: data.phonetics?.find(p => p.audio)?.audio || ''
                };
            } catch (error) {
                return {
                    word: word,
                    phonetic: '',
                    definition: 'Definition not available',
                    partOfSpeech: '',
                    example: '',
                    audio: ''
                };
            }
        })
    );

    res.json({
        level: level,
        lesson: lesson,
        totalLessons: Math.ceil(words.length / 10),
        words: wordDetails
    });
});

// Get quiz for a lesson
app.get('/api/learn/level/:level/lesson/:lesson/quiz', async (req, res) => {
    const level = parseInt(req.params.level);
    const lesson = parseInt(req.params.lesson);
    const language = req.query.language || 'es';

    if (level < 1 || level > 20 || !VOCABULARY_LEVELS[level]) {
        return res.status(404).json({ error: 'Level not found' });
    }

    const words = VOCABULARY_LEVELS[level];
    const startIdx = (lesson - 1) * 10;
    const lessonWords = words.slice(startIdx, startIdx + 10);

    // Generate quiz questions
    const questions = await Promise.all(
        lessonWords.map(async (word) => {
            try {
                // Get translation
                const transResponse = await axios.get(
                    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|${language}`
                );
                const correctAnswer = transResponse.data.responseData.translatedText;

                // Get wrong answers from other words in the lesson
                const wrongWords = lessonWords.filter(w => w !== word).slice(0, 3);
                const wrongAnswers = await Promise.all(
                    wrongWords.map(async (w) => {
                        const r = await axios.get(
                            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(w)}&langpair=en|${language}`
                        );
                        return r.data.responseData.translatedText;
                    })
                );

                return {
                    word: word,
                    correctAnswer: correctAnswer,
                    options: [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5)
                };
            } catch (error) {
                return null;
            }
        })
    );

    res.json({
        level: level,
        lesson: lesson,
        questions: questions.filter(q => q !== null)
    });
});

// API endpoint for word of the day (must come before /api/:word)
app.get('/api/word-of-day', async (req, res) => {
    // Use a curated list of interesting words
    const interestingWords = [
        'serendipity', 'ephemeral', 'eloquent', 'mellifluous', 'petrichor',
        'luminous', 'ethereal', 'sonorous', 'ineffable', 'quintessential',
        'ubiquitous', 'paradigm', 'resilient', 'enigmatic', 'benevolent',
        'cacophony', 'ebullient', 'fastidious', 'gregarious', 'halcyon',
        'idyllic', 'juxtapose', 'kaleidoscope', 'loquacious', 'magnanimous',
        'nebulous', 'opulent', 'panacea', 'quixotic', 'resplendent',
        'sanguine', 'tenacious', 'vivacious', 'whimsical'
    ];

    // Pick word based on day of year (consistent per day)
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const wordIndex = dayOfYear % interestingWords.length;
    const word = interestingWords[wordIndex];

    try {
        const entries = await fetchEnglishEntries(word);
        if (!entries) {
            return res.status(404).json({ error: 'Word of the day not found' });
        }
        res.json({
            word: word,
            data: entries[0]
        });
    } catch (error) {
        console.error('Word of day error:', error.message);
        res.status(500).json({ error: 'Error fetching word of the day', details: error.message });
    }
});

// API endpoint for full sentence translation (must come before /api/:word)
app.post('/api/translate-text', async (req, res) => {
    const { text, from, to } = req.body;

    if (!text || !from || !to) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const response = await axios.get(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
        );

        if (response.data && response.data.responseData) {
            res.json({
                translatedText: response.data.responseData.translatedText,
                from: from,
                to: to
            });
        } else {
            res.status(500).json({ error: 'Translation failed' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error translating text' });
    }
});

// API endpoint to get translations (must come before /api/:word)
app.get('/api/translate/:word', async (req, res) => {
    const word = req.params.word.toLowerCase();

    try {
        const translations = {};

        // Use MyMemory Translation API (free, no key required)
        for (const [langName, langCode] of Object.entries(LANGUAGES)) {
            try {
                const response = await axios.get(
                    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|${langCode}`
                );

                if (response.data && response.data.responseData) {
                    translations[langName] = {
                        translation: response.data.responseData.translatedText,
                        code: langCode
                    };
                }
            } catch (err) {
                console.error(`Translation error for ${langName}:`, err.message);
            }
        }

        res.json(translations);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching translations' });
    }
});

// API endpoint to get word definition with language support
app.get('/api/define/:lang/:word', async (req, res) => {
    const word = req.params.word.toLowerCase();
    const lang = req.params.lang;

    try {
        if (lang === 'en') {
            const entries = await fetchEnglishEntries(word);
            if (!entries) {
                return res.status(404).json({ error: 'Word not found' });
            }
            res.json(entries);
        } else {
            // For other languages, translate to English and get definition
            const transResponse = await axios.get(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${lang}|en`
            );

            if (transResponse.data && transResponse.data.responseData) {
                const englishWord = transResponse.data.responseData.translatedText;

                // Get English definition
                try {
                    const entries = await fetchEnglishEntries(englishWord);
                    if (!entries) throw new Error('English definition not found');
                    const dictData = entries[0];

                    // Create a modified response with the original foreign word
                    const modifiedData = {
                        word: word,
                        phonetic: dictData.phonetic || '',
                        phonetics: dictData.phonetics || [],
                        meanings: dictData.meanings.map(meaning => ({
                            partOfSpeech: meaning.partOfSpeech,
                            definitions: meaning.definitions.map(def => ({
                                definition: def.definition,
                                example: def.example ? def.example.replace(new RegExp(englishWord, 'gi'), word) : '',
                                synonyms: def.synonyms || [],
                                antonyms: def.antonyms || []
                            }))
                        })),
                        translation: {
                            from: lang,
                            to: 'en',
                            englishEquivalent: englishWord
                        }
                    };

                    res.json([modifiedData]);
                } catch (dictError) {
                    // If English definition not found, return basic translation
                    res.json([{
                        word: word,
                        phonetic: '',
                        phonetics: [],
                        meanings: [{
                            partOfSpeech: 'translation',
                            definitions: [{
                                definition: `English translation: ${englishWord}`,
                                example: '',
                                synonyms: [],
                                antonyms: []
                            }]
                        }],
                        translation: {
                            from: lang,
                            to: 'en',
                            englishEquivalent: englishWord
                        }
                    }]);
                }
            } else {
                res.status(404).json({ error: 'Translation not found' });
            }
        }
    } catch (error) {
        console.error('Definition error:', error.message);
        if (error.response && error.response.status === 404) {
            res.status(404).json({ error: 'Word not found' });
        } else {
            res.status(500).json({ error: 'Error fetching definition' });
        }
    }
});

// Personal glossary endpoints (must come before /api/:word)

function sendGlossaryError(res, error) {
    if (error && error.status) return res.status(error.status).json({ error: error.message });
    console.error('Glossary error:', error);
    res.status(500).json({ error: 'Glossary error' });
}

app.get('/api/terms', (req, res) => {
    try {
        res.json(glossary.list({ tag: req.query.tag, q: req.query.q, defined: req.query.defined === '1' }));
    } catch (error) { sendGlossaryError(res, error); }
});

app.get('/api/terms/tags', (req, res) => {
    try {
        res.json(glossary.tags());
    } catch (error) { sendGlossaryError(res, error); }
});

app.get('/api/terms/export', (req, res) => {
    try {
        const date = new Date().toISOString().slice(0, 10);
        res.set('Content-Disposition', `attachment; filename="glossary-${date}.json"`);
        res.json({ exportedAt: new Date().toISOString(), terms: glossary.list() });
    } catch (error) { sendGlossaryError(res, error); }
});

app.get('/api/terms/:term', (req, res) => {
    try {
        const term = glossary.get(req.params.term);
        if (!term) return res.status(404).json({ error: 'Term not found' });
        res.json(term);
    } catch (error) { sendGlossaryError(res, error); }
});

app.post('/api/terms', (req, res) => {
    try {
        res.status(201).json(glossary.create(req.body || {}));
    } catch (error) { sendGlossaryError(res, error); }
});

app.put('/api/terms/:term', (req, res) => {
    try {
        res.json(glossary.update(req.params.term, req.body || {}));
    } catch (error) { sendGlossaryError(res, error); }
});

app.delete('/api/terms/:term', (req, res) => {
    try {
        glossary.remove(req.params.term);
        res.status(204).end();
    } catch (error) { sendGlossaryError(res, error); }
});

// Combined lookup: personal glossary term (if any) beside the dictionary entry (if any)
app.get('/api/lookup/:word', async (req, res) => {
    const word = req.params.word;
    let term = null;
    try {
        term = glossary.get(word);
    } catch (error) {
        console.error('Glossary lookup error:', error);
    }
    let dictionary = null;
    try {
        dictionary = await fetchEnglishEntries(word.toLowerCase());
    } catch (error) {
        if (!term) return res.status(500).json({ error: 'Error fetching definition' });
    }
    if (!term && !dictionary) return res.status(404).json({ error: 'Word not found' });
    res.json({ word, glossary: term, dictionary });
});

// Autocomplete: glossary terms first, then Datamuse suggestions
app.get('/api/suggest', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    let mine = [];
    try {
        mine = glossary.suggest(q, 8);
    } catch (error) {
        console.error('Glossary suggest error:', error);
    }
    let others = [];
    try {
        const response = await axios.get(`https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=8`, { timeout: 5000 });
        others = response.data.map(s => s.word);
    } catch (error) {
        console.error('Autocomplete error:', error.message);
    }
    const seen = new Set(mine.map(t => t.toLowerCase()));
    const suggestions = mine.map(word => ({ word, glossary: true }));
    for (const word of others) {
        if (suggestions.length >= 8) break;
        if (!seen.has(word.toLowerCase())) suggestions.push({ word, glossary: false });
    }
    res.json(suggestions);
});

// Legacy API endpoint (English only, for backwards compatibility)
app.get('/api/:word', async (req, res) => {
    const word = req.params.word.toLowerCase();

    try {
        const entries = await fetchEnglishEntries(word);
        if (!entries) return res.status(404).json({ error: 'Word not found' });
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching definition' });
    }
});

// Root path - must come before /:word catch-all
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Direct word lookup - catch-all route (must be last)
app.get('/:word', (req, res) => {
    const word = req.params.word;
    // Serve the HTML page with the word pre-filled
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;

const UPSTREAM_CHECKS = {
    dictionaryApi: { label: 'Dictionary API', url: 'https://api.dictionaryapi.dev/api/v2/entries/en/test' },
    translationApi: { label: 'Translation API', url: 'https://api.mymemory.translated.net/get?q=hello&langpair=en|es' },
    autocompleteApi: { label: 'Autocomplete API', url: 'https://api.datamuse.com/sug?s=test&max=1' }
};

// Health check function: checks the upstreams in parallel and updates healthStatus
async function performHealthCheck() {
    const now = new Date().toISOString();
    healthStatus.lastCheck = now;

    await Promise.all(Object.entries(UPSTREAM_CHECKS).map(async ([key, { label, url }]) => {
        try {
            await axios.get(url, { timeout: 5000 });
            healthStatus[key] = { status: 'healthy', lastSuccess: now };
        } catch (error) {
            healthStatus[key].status = 'unhealthy';
            console.error(`${label} health check failed:`, error.message);
        }
    }));

    // Log status
    console.log(`[${now}] Health Check:`, {
        dictionary: healthStatus.dictionaryApi.status,
        translation: healthStatus.translationApi.status,
        autocomplete: healthStatus.autocompleteApi.status
    });
}

if (require.main === module) {
    glossary.open();

    // Perform health check on startup
    performHealthCheck();

    // Refresh upstream status in the background
    setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL_MS);

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Dictionary server running on http://0.0.0.0:${PORT}`);
        console.log('Health checks will run every 5 minutes');
    });
}

module.exports = { app, fetchEnglishEntries, getLocalDb, closeLocalDb, localDictionaryInfo };
