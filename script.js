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

// Audio Setup (Web Audio API to avoid external assets)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1); // E6
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
        oscillator.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.2); // A2
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    }
}

// Functions
function updateUI() {
    bookList.innerHTML = '';
    inventory.forEach((id, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${id}</span>`;
        bookList.appendChild(li);
    });
    countSpan.textContent = inventory.length;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
}

function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = `feedback show ${type}`;
    setTimeout(() => {
        feedback.className = 'feedback';
    }, 2000);
}

function addBook() {
    const value = bookInput.value.trim();
    if (!value) return;

    if (REGEX.test(value)) {
        if (inventory.includes(value)) {
            showFeedback('此編號已在清單中', 'error');
            playSound('error');
            bookInput.value = '';
        } else {
            inventory.unshift(value); // Newest on top
            updateUI();
            showFeedback('成功加入', 'success');
            playSound('success');
            bookInput.value = '';
        }
    } else {
        showFeedback('錯誤：編號格式不符 (需為 FGS 加 7 位數字)', 'error');
        playSound('error');
        bookInput.value = '';
    }
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
        updateUI();
        showFeedback('清單已清空', 'success');
    }
});

copyButton.addEventListener('click', () => {
    if (inventory.length === 0) {
        showFeedback('清單為空，無法複製', 'error');
        return;
    }

    // Format for Google Spreadsheet (one ID per line)
    const textToCopy = inventory.join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
        showFeedback('已複製到剪貼簿', 'success');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showFeedback('複製失敗', 'error');
    });
});

// Initialize
updateUI();
