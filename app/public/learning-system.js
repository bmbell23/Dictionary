// Comprehensive Learning System JavaScript

const LANGUAGES = {
    spanish: { name: 'Spanish', flag: '🇪🇸', code: 'es' },
    french: { name: 'French', flag: '🇫🇷', code: 'fr' },
    italian: { name: 'Italian', flag: '🇮🇹', code: 'it' },
    mandarin: { name: 'Mandarin', flag: '🇨🇳', code: 'zh' },
    japanese: { name: 'Japanese', flag: '🇯🇵', code: 'ja' },
    korean: { name: 'Korean', flag: '🇰🇷', code: 'ko' },
    german: { name: 'German', flag: '🇩🇪', code: 'de' },
    russian: { name: 'Russian', flag: '🇷🇺', code: 'ru' },
    polish: { name: 'Polish', flag: '🇵🇱', code: 'pl' }
};

let currentLanguage = null;
let currentLevel = null;
let currentLesson = null;
let currentLessonData = null;
let currentQuiz = { score: 0, total: 0, streak: 0, questions: [], currentQuestion: 0 };

// Progress tracking
function getLearnProgress() {
    const progress = localStorage.getItem('learn_progress');
    return progress ? JSON.parse(progress) : {};
}

function saveLearnProgress(progress) {
    localStorage.setItem('learn_progress', JSON.stringify(progress));
}

function getLanguageProgress(language) {
    const progress = getLearnProgress();
    if (!progress[language]) {
        progress[language] = {
            currentLevel: 1,
            currentLesson: 1,
            learned: [],      // Words seen in lessons
            practiced: [],    // Words quizzed at least once
            mastered: []      // Words with 3+ correct answers
        };
        saveLearnProgress(progress);
    }
    return progress[language];
}

function markWordLearned(language, word) {
    const progress = getLearnProgress();
    const langProgress = getLanguageProgress(language);
    if (!langProgress.learned.includes(word)) {
        langProgress.learned.push(word);
    }
    progress[language] = langProgress;
    saveLearnProgress(progress);
}

function markWordPracticed(language, word, correct) {
    const progress = getLearnProgress();
    const langProgress = getLanguageProgress(language);
    
    if (!langProgress.practiced.includes(word)) {
        langProgress.practiced.push(word);
    }
    
    // Track correct answers
    if (!langProgress.correctCounts) langProgress.correctCounts = {};
    if (!langProgress.correctCounts[word]) langProgress.correctCounts[word] = 0;
    
    if (correct) {
        langProgress.correctCounts[word]++;
        
        // Mark as mastered after 3 correct answers
        if (langProgress.correctCounts[word] >= 3 && !langProgress.mastered.includes(word)) {
            langProgress.mastered.push(word);
        }
    }
    
    progress[language] = langProgress;
    saveLearnProgress(progress);
}

// Load language selection
function loadLanguages() {
    const progress = getLearnProgress();
    const grid = document.getElementById('language-grid');
    
    grid.innerHTML = Object.entries(LANGUAGES).map(([key, lang]) => {
        const langProgress = progress[key] || { currentLevel: 1, learned: [], mastered: [] };
        const totalWords = langProgress.learned.length;
        const masteredWords = langProgress.mastered.length;
        
        return `
            <div class="language-card" onclick="selectLanguage('${key}')">
                <div class="language-flag">${lang.flag}</div>
                <div class="language-name">${lang.name}</div>
                <div class="language-progress">
                    <div class="progress-text">
                        Level ${langProgress.currentLevel} • ${totalWords} words learned
                    </div>
                    <div class="progress-text" style="margin-top: 5px;">
                        ⭐ ${masteredWords} mastered
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Select language and show levels
function selectLanguage(language) {
    currentLanguage = language;
    const lang = LANGUAGES[language];
    const langProgress = getLanguageProgress(language);
    
    document.getElementById('learn-home').style.display = 'none';
    document.getElementById('learn-levels').style.display = 'block';
    document.getElementById('level-title').textContent = `${lang.name} - Choose a Level`;
    
    loadLevels();
}

// Load levels for selected language
function loadLevels() {
    const langProgress = getLanguageProgress(currentLanguage);
    const grid = document.getElementById('levels-grid');
    
    let html = '';
    for (let level = 1; level <= 5; level++) {  // Show first 5 levels for now
        const isLocked = level > langProgress.currentLevel;
        const wordsInLevel = langProgress.learned.filter(w => {
            // This is simplified - in real app, track which level each word is from
            return true;
        }).length;
        
        html += `
            <div class="level-card ${isLocked ? 'locked' : ''}" onclick="${isLocked ? '' : `selectLevel(${level})`}">
                ${isLocked ? '<div class="level-badge">🔒</div>' : ''}
                ${level === langProgress.currentLevel ? '<div class="level-badge">▶️</div>' : ''}
                ${level < langProgress.currentLevel ? '<div class="level-badge">✅</div>' : ''}
                <div class="level-number">Level ${level}</div>
                <div class="level-status">
                    ${isLocked ? 'Locked' : level < langProgress.currentLevel ? 'Completed' : 'In Progress'}
                </div>
                <div class="progress-bar" style="margin-top: 15px;">
                    <div class="progress-fill" style="width: ${isLocked ? 0 : level < langProgress.currentLevel ? 100 : 50}%"></div>
                </div>
            </div>
        `;
    }
    
    // Add progress view button
    html += `
        <div class="level-card" onclick="showProgress()">
            <div class="level-badge">📊</div>
            <div class="level-number">Progress</div>
            <div class="level-status">View your stats</div>
        </div>
    `;
    
    grid.innerHTML = html;
}

// Select level and show lessons
async function selectLevel(level) {
    currentLevel = level;
    const lang = LANGUAGES[currentLanguage];

    document.getElementById('learn-levels').style.display = 'none';

    // For now, show lesson 1 directly
    // In full version, show lesson selection
    await loadLesson(level, 1);
}

// Load a specific lesson
async function loadLesson(level, lesson) {
    currentLevel = level;
    currentLesson = lesson;

    const lang = LANGUAGES[currentLanguage];
    document.getElementById('lesson-title').textContent = `${lang.name} - Level ${level}, Lesson ${lesson}`;

    try {
        const response = await fetch(`/api/learn/level/${level}/lesson/${lesson}`);
        const data = await response.json();
        currentLessonData = data;

        const content = document.getElementById('lesson-content');
        content.innerHTML = data.words.map((word, index) => `
            <div class="lesson-word-card">
                <div class="lesson-word-title">${index + 1}. ${word.word}</div>
                ${word.phonetic ? `<div class="lesson-word-phonetic">${word.phonetic}</div>` : ''}
                ${word.partOfSpeech ? `<span class="lesson-word-pos">${word.partOfSpeech}</span>` : ''}
                <div class="lesson-word-definition">${word.definition}</div>
                ${word.example ? `<div class="lesson-word-example">"${word.example}"</div>` : ''}
                ${word.audio ? `
                    <div class="lesson-word-audio">
                        <button onclick="playAudio('${word.audio}')">🔊 Listen</button>
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Mark all words as learned
        data.words.forEach(word => {
            markWordLearned(currentLanguage, word.word);
        });

        document.getElementById('learn-lesson').style.display = 'block';
    } catch (error) {
        console.error('Error loading lesson:', error);
        alert('Error loading lesson. Please try again.');
    }
}

// Play audio pronunciation
function playAudio(url) {
    const audio = new Audio(url);
    audio.play();
}

// Start quiz for current lesson
async function startLessonQuiz() {
    document.getElementById('learn-lesson').style.display = 'none';
    document.getElementById('learn-quiz').style.display = 'block';

    currentQuiz = { score: 0, total: 0, streak: 0, questions: [], currentQuestion: 0 };
    updateQuizStats();

    try {
        const response = await fetch(
            `/api/learn/level/${currentLevel}/lesson/${currentLesson}/quiz?language=${LANGUAGES[currentLanguage].code}`
        );
        const data = await response.json();
        currentQuiz.questions = data.questions;

        showQuizQuestion();
    } catch (error) {
        console.error('Error loading quiz:', error);
        alert('Error loading quiz. Please try again.');
    }
}

// Show current quiz question
function showQuizQuestion() {
    if (currentQuiz.currentQuestion >= currentQuiz.questions.length) {
        showQuizResults();
        return;
    }

    const question = currentQuiz.questions[currentQuiz.currentQuestion];
    const lang = LANGUAGES[currentLanguage];

    const content = document.getElementById('quiz-content');
    content.innerHTML = `
        <div class="quiz-question">What is "${question.word}" in ${lang.name}?</div>
        <div class="quiz-word">${question.word}</div>
        <div class="quiz-options">
            ${question.options.map(opt => `
                <div class="quiz-option" onclick="checkQuizAnswer('${opt.replace(/'/g, "\\'")}')">
                    ${opt}
                </div>
            `).join('')}
        </div>
    `;
}

// Check quiz answer
function checkQuizAnswer(selected) {
    const question = currentQuiz.questions[currentQuiz.currentQuestion];
    const correct = selected === question.correctAnswer;

    // Disable all options
    document.querySelectorAll('.quiz-option').forEach(opt => {
        opt.style.pointerEvents = 'none';
        if (opt.textContent.trim() === question.correctAnswer) {
            opt.classList.add('correct');
        }
    });

    if (correct) {
        document.querySelector(`.quiz-option:contains("${selected}")`);
        currentQuiz.score++;
        currentQuiz.streak++;
    } else {
        const selectedOpt = Array.from(document.querySelectorAll('.quiz-option'))
            .find(opt => opt.textContent.trim() === selected);
        if (selectedOpt) selectedOpt.classList.add('incorrect');
        currentQuiz.streak = 0;
    }

    currentQuiz.total++;
    markWordPracticed(currentLanguage, question.word, correct);
    updateQuizStats();

    // Next question after delay
    setTimeout(() => {
        currentQuiz.currentQuestion++;
        showQuizQuestion();
    }, 1500);
}

// Update quiz stats display
function updateQuizStats() {
    document.getElementById('quiz-score').textContent = currentQuiz.score;
    document.getElementById('quiz-total').textContent = currentQuiz.total;
    document.getElementById('quiz-streak').textContent = currentQuiz.streak;
}

// Show quiz results
function showQuizResults() {
    const percentage = Math.round((currentQuiz.score / currentQuiz.total) * 100);
    const passed = percentage >= 70;

    const content = document.getElementById('quiz-content');
    content.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4em; margin-bottom: 20px;">
                ${passed ? '🎉' : '📚'}
            </div>
            <h2 style="color: #3e2723; margin-bottom: 20px;">
                ${passed ? 'Great Job!' : 'Keep Practicing!'}
            </h2>
            <div style="font-size: 2em; color: #6d4c41; margin-bottom: 20px;">
                ${currentQuiz.score} / ${currentQuiz.total} (${percentage}%)
            </div>
            <div style="margin-top: 30px;">
                <button class="translate-btn" onclick="backToLevels()">Back to Levels</button>
                <button class="translate-btn" onclick="startLessonQuiz()" style="margin-left: 10px;">Retry Quiz</button>
            </div>
        </div>
    `;

    // Update progress if passed
    if (passed) {
        const progress = getLearnProgress();
        const langProgress = getLanguageProgress(currentLanguage);

        // Unlock next lesson/level logic here
        // For now, just save progress
        saveLearnProgress(progress);
    }
}

// Navigation functions
function backToLanguages() {
    document.getElementById('learn-levels').style.display = 'none';
    document.getElementById('learn-quiz').style.display = 'none';
    document.getElementById('learn-lesson').style.display = 'none';
    document.getElementById('learn-progress').style.display = 'none';
    document.getElementById('learn-home').style.display = 'block';
    loadLanguages();
}

function backToLevels() {
    document.getElementById('learn-lesson').style.display = 'none';
    document.getElementById('learn-quiz').style.display = 'none';
    document.getElementById('learn-progress').style.display = 'none';
    document.getElementById('learn-levels').style.display = 'block';
    loadLevels();
}

function backToLesson() {
    document.getElementById('learn-quiz').style.display = 'none';
    document.getElementById('learn-lesson').style.display = 'block';
}

// Show progress view
function showProgress() {
    const langProgress = getLanguageProgress(currentLanguage);
    const lang = LANGUAGES[currentLanguage];

    document.getElementById('learn-levels').style.display = 'none';
    document.getElementById('learn-progress').style.display = 'block';

    const content = document.getElementById('progress-content');
    content.innerHTML = `
        <div class="progress-section">
            <h3>📊 Overall Progress</h3>
            <div style="font-size: 1.2em; margin-top: 15px;">
                <div>✅ <strong>${langProgress.learned.length}</strong> words learned</div>
                <div>📝 <strong>${langProgress.practiced.length}</strong> words practiced</div>
                <div>⭐ <strong>${langProgress.mastered.length}</strong> words mastered</div>
            </div>
        </div>

        <div class="progress-section">
            <h3>⭐ Mastered Words</h3>
            <div class="word-list">
                ${langProgress.mastered.length > 0
                    ? langProgress.mastered.map(w => `<div class="word-chip mastered">${w}</div>`).join('')
                    : '<p>No mastered words yet. Keep practicing!</p>'}
            </div>
        </div>

        <div class="progress-section">
            <h3>📝 Practiced Words</h3>
            <div class="word-list">
                ${langProgress.practiced.filter(w => !langProgress.mastered.includes(w)).length > 0
                    ? langProgress.practiced.filter(w => !langProgress.mastered.includes(w))
                        .map(w => `<div class="word-chip practiced">${w}</div>`).join('')
                    : '<p>No practiced words yet.</p>'}
            </div>
        </div>

        <div class="progress-section">
            <h3>📚 Learned Words</h3>
            <div class="word-list">
                ${langProgress.learned.filter(w => !langProgress.practiced.includes(w)).length > 0
                    ? langProgress.learned.filter(w => !langProgress.practiced.includes(w))
                        .map(w => `<div class="word-chip learned">${w}</div>`).join('')
                    : '<p>All learned words have been practiced!</p>'}
            </div>
        </div>
    `;
}

