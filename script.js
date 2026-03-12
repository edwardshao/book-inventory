// Constants
const STORAGE_KEY = 'book_inventory_list';
const REGEX = /^FGS\d{7}$/;

// Elements
const bookInput = document.getElementById('bookInput');
const addButton = document.getElementById('addButton');
const feedback = document.getElementById('feedback');
const bookList = document.getElementById('bookList');
const countSpan = document.getElementById('count');
const copyButton = document.getElementById('copyButton');
const clearButton = document.getElementById('clearButton');

// State
let inventory = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
// Use a Set for O(1) duplicate checking instead of O(n) Array.includes()
let inventorySet = new Set(inventory);

// Feedback timer — kept so we can cancel before starting a new one (prevent stale timers)
let feedbackTimer = null;

// Audio Setup (Web Audio API to avoid external assets)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'warning') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(660, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    }

    // FIX: Disconnect nodes after they finish to release AudioContext graph memory.
    // Without this, every call leaks an OscillatorNode + GainNode permanently.
    oscillator.addEventListener('ended', () => {
        oscillator.disconnect();
        gainNode.disconnect();
    }, { once: true });
}

// Functions

// FIX: Instead of rebuilding the entire list on every change (DOM thrashing),
// only prepend the newest item. The list is only fully rebuilt on init/clear.
function prependItem(id) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = id; // Use textContent, not innerHTML, for XSS safety
    li.appendChild(span);
    bookList.prepend(li);
    countSpan.textContent = inventory.length;
}

function rebuildList() {
    bookList.innerHTML = '';
    const fragment = document.createDocumentFragment(); // Batch DOM insertion — single reflow
    inventory.forEach((id) => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = id;
        li.appendChild(span);
        fragment.appendChild(li);
    });
    bookList.appendChild(fragment);
    countSpan.textContent = inventory.length;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
}

function showFeedback(message, type) {
    // FIX: Cancel any pending timer before starting a new one.
    // Without this, rapid inputs cause multiple stale timers fighting over the feedback element.
    if (feedbackTimer !== null) {
        clearTimeout(feedbackTimer);
    }
    feedback.textContent = message;
    feedback.className = `feedback show ${type}`;
    feedbackTimer = setTimeout(() => {
        feedback.className = 'feedback';
        feedbackTimer = null;
    }, 2000);
}

function addBook() {
    const value = bookInput.value.trim();
    if (!value) return;

    if (REGEX.test(value)) {
        if (inventorySet.has(value)) { // O(1) lookup via Set
            showFeedback('此編號已在清單中', 'error');
            playSound('warning');
        } else {
            inventory.unshift(value);
            inventorySet.add(value); // Keep Set in sync
            prependItem(value);      // Only insert one new DOM node, not rebuild all
            localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
            showFeedback('成功加入', 'success');
            playSound('success');
        }
    } else {
        showFeedback('錯誤：編號格式不符 (需為 FGS 加 7 位數字)', 'error');
        playSound('error');
    }
    bookInput.value = '';
    bookInput.focus();
}

// Event Listeners
addButton.addEventListener('click', addBook);

bookInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addBook();
    }
});

clearButton.addEventListener('click', () => {
    if (inventory.length === 0) return;
    if (confirm('確定要清空所有編號嗎？')) {
        inventory = [];
        inventorySet.clear(); // Keep Set in sync
        rebuildList();
        showFeedback('清單已清空', 'success');
    }
});

copyButton.addEventListener('click', () => {
    if (inventory.length === 0) {
        showFeedback('清單為空，無法複製', 'error');
        return;
    }
    const textToCopy = inventory.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
        showFeedback('已複製到剪貼簿', 'success');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showFeedback('複製失敗', 'error');
    });
});

// Initialize — use rebuildList() on startup to render items from localStorage
rebuildList();
