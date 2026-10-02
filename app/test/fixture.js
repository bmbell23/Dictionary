// Tiny OEWN-JSON-shaped fixture (same layout as the real release).
const fs = require('fs');
const path = require('path');

function writeFixture(dir) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'entries-r.json'), JSON.stringify({
        Run: { n: { pronunciation: [{ value: 'ɹʌn' }], sense: [{ id: 'run%1:04:00::', synset: '1-n' }] } },
        run: {
            v: { sense: [{ id: 'run%2:38:00::', synset: '2-v' }] },
            'n-1': { sense: [{ id: 'run%1:04:01::', synset: '1-n' }] }
        }
    }));
    fs.writeFileSync(path.join(dir, 'entries-h.json'), JSON.stringify({
        hot: { a: { sense: [{ id: 'hot%3:00:01::', synset: '3-a', antonym: ['cold%3:00:01::'] }] } }
    }));
    fs.writeFileSync(path.join(dir, 'entries-c.json'), JSON.stringify({
        cold: { s: { sense: [{ id: 'cold%3:00:01::', synset: '4-s' }] } },
        nodef: { n: { sense: [{ id: 'nodef%1:00:00::', synset: '99-n' }] } }
    }));
    fs.writeFileSync(path.join(dir, 'noun.act.json'), JSON.stringify({
        '1-n': { definition: ['a score in baseball'], example: ['he hit a run'], members: ['run', 'tally'], partOfSpeech: 'n' }
    }));
    fs.writeFileSync(path.join(dir, 'verb.motion.json'), JSON.stringify({
        '2-v': { definition: ['move fast on foot'], members: ['run', 'sprint'], partOfSpeech: 'v' }
    }));
    fs.writeFileSync(path.join(dir, 'adj.all.json'), JSON.stringify({
        '3-a': { definition: ['high temperature'], members: ['hot'], partOfSpeech: 'a' },
        '4-s': { definition: ['low temperature'], members: ['cold'], partOfSpeech: 's' }
    }));
    fs.writeFileSync(path.join(dir, 'frames.json'), '{}');
}

module.exports = { writeFixture };
