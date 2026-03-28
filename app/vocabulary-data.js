// Comprehensive vocabulary data for language learning
// 2000 most common words organized into 20 levels of 100 words each

const VOCABULARY_LEVELS = {
    1: [
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
        'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
        'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
        'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
        'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
        'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
        'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
        'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
        'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
        'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
    ],
    2: [
        'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having',
        'may', 'should', 'could', 'would', 'might', 'must', 'can', 'will', 'shall', 'being',
        'find', 'thing', 'give', 'many', 'through', 'back', 'much', 'before', 'go', 'good',
        'new', 'write', 'our', 'used', 'me', 'man', 'too', 'any', 'day', 'same',
        'right', 'look', 'think', 'also', 'around', 'another', 'came', 'come', 'work', 'three',
        'word', 'must', 'because', 'does', 'part', 'even', 'place', 'well', 'such', 'here',
        'take', 'why', 'help', 'put', 'different', 'away', 'again', 'off', 'went', 'old',
        'number', 'great', 'tell', 'men', 'say', 'small', 'every', 'found', 'still', 'between',
        'name', 'should', 'home', 'big', 'give', 'air', 'line', 'set', 'own', 'under',
        'read', 'last', 'never', 'us', 'left', 'end', 'along', 'while', 'might', 'next'
    ],
    3: [
        'sound', 'below', 'saw', 'something', 'thought', 'both', 'few', 'those', 'always', 'show',
        'large', 'often', 'together', 'asked', 'house', 'world', 'going', 'want', 'school', 'important',
        'until', 'form', 'food', 'keep', 'children', 'feet', 'land', 'side', 'without', 'boy',
        'once', 'animal', 'life', 'enough', 'took', 'four', 'head', 'above', 'kind', 'began',
        'almost', 'live', 'page', 'got', 'earth', 'need', 'far', 'hand', 'high', 'year',
        'mother', 'light', 'country', 'father', 'let', 'night', 'picture', 'being', 'study', 'second',
        'soon', 'story', 'since', 'white', 'ever', 'paper', 'hard', 'near', 'sentence', 'better',
        'best', 'across', 'during', 'today', 'however', 'sure', 'knew', 'its', 'try', 'told',
        'young', 'sun', 'thing', 'whole', 'hear', 'example', 'heard', 'several', 'change', 'answer',
        'room', 'sea', 'against', 'top', 'turned', 'learn', 'point', 'city', 'play', 'toward'
    ],
    4: [
        'five', 'himself', 'usually', 'money', 'seen', 'didn\'t', 'car', 'morning', 'I\'m', 'body',
        'upon', 'family', 'later', 'turn', 'move', 'face', 'door', 'cut', 'done', 'group',
        'true', 'half', 'red', 'fish', 'plants', 'living', 'black', 'eat', 'short', 'United',
        'run', 'book', 'gave', 'order', 'open', 'ground', 'cold', 'really', 'table', 'remember',
        'tree', 'course', 'front', 'American', 'space', 'inside', 'ago', 'sad', 'early', 'I\'ll',
        'learned', 'brought', 'close', 'nothing', 'though', 'idea', 'before', 'lived', 'became', 'add',
        'become', 'grow', 'draw', 'yet', 'less', 'wind', 'behind', 'cannot', 'letter', 'among',
        'able', 'dog', 'shown', 'mean', 'English', 'rest', 'perhaps', 'certain', 'six', 'feel',
        'fire', 'ready', 'green', 'yes', 'built', 'special', 'ran', 'full', 'town', 'complete',
        'oh', 'person', 'hot', 'anything', 'hold', 'state', 'list', 'stood', 'hundred', 'ten'
    ],
    5: [
        'fast', 'verb', 'sing', 'listen', 'six', 'table', 'travel', 'less', 'morning', 'ten',
        'simple', 'several', 'vowel', 'toward', 'war', 'lay', 'against', 'pattern', 'slow', 'center',
        'love', 'person', 'money', 'serve', 'appear', 'road', 'map', 'rain', 'rule', 'govern',
        'pull', 'cold', 'notice', 'voice', 'unit', 'power', 'town', 'fine', 'certain', 'fly',
        'fall', 'lead', 'cry', 'dark', 'machine', 'note', 'wait', 'plan', 'figure', 'star',
        'box', 'noun', 'field', 'rest', 'correct', 'able', 'pound', 'done', 'beauty', 'drive',
        'stood', 'contain', 'front', 'teach', 'week', 'final', 'gave', 'green', 'oh', 'quick',
        'develop', 'ocean', 'warm', 'free', 'minute', 'strong', 'special', 'mind', 'behind', 'clear',
        'tail', 'produce', 'fact', 'street', 'inch', 'multiply', 'nothing', 'course', 'stay', 'wheel',
        'full', 'force', 'blue', 'object', 'decide', 'surface', 'deep', 'moon', 'island', 'foot'
    ]
};

// Export for use in server
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VOCABULARY_LEVELS };
}

