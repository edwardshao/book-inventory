// Constants
const STORAGE_KEY = 'book_inventory_list';
const SOUND_THEME_KEY = 'book_inventory_sound_theme';
const REGEX = /^FGS\d{7}$/;

// Elements
const bookInput = document.getElementById('bookInput');
const addButton = document.getElementById('addButton');
const feedback = document.getElementById('feedback');
const bookList = document.getElementById('bookList');
const countSpan = document.getElementById('count');
const copyButton = document.getElementById('copyButton');
const clearButton = document.getElementById('clearButton');
const soundThemeSelect = document.getElementById('soundThemeSelect');
const previewSoundBtn = document.getElementById('previewSoundBtn');

// State
let inventory = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
// Use a Set for O(1) duplicate checking instead of O(n) Array.includes()
let inventorySet = new Set(inventory);

// Feedback timer — kept so we can cancel before starting a new one (prevent stale timers)
let feedbackTimer = null;

// Audio Setup (Web Audio API to avoid external assets)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Sound Themes — each theme has its own success / warning / error signature
// so multiple users can tell their beeps apart.
const SOUND_THEMES = {
    // 主題 A：原始高昇音
    A: {
        label: '🔵 主題 A（原始）',
        success: (ctx) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
            g.gain.setValueAtTime(0.1, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(); osc.stop(ctx.currentTime + 0.2);
            osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
        },
        warning: (ctx) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.1);
            g.gain.setValueAtTime(0.1, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(); osc.stop(ctx.currentTime + 0.2);
            osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
        },
        error: (ctx) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.2);
            g.gain.setValueAtTime(0.1, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(); osc.stop(ctx.currentTime + 0.3);
            osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
        },
    },
    // 主題 B：雙音節叮咚
    B: {
        label: '🟢 主題 B（叮咚）',
        success: (ctx) => {
            [0, 0.15].forEach((delay, i) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(i === 0 ? 1047 : 1319, ctx.currentTime + delay);
                g.gain.setValueAtTime(0, ctx.currentTime + delay);
                g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + delay + 0.02);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.18);
                osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
            });
        },
        warning: (ctx) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
            g.gain.setValueAtTime(0.1, ctx.currentTime);
            g.gain.setValueAtTime(0.0, ctx.currentTime + 0.08);
            g.gain.setValueAtTime(0.1, ctx.currentTime + 0.1);
            g.gain.setValueAtTime(0.0, ctx.currentTime + 0.18);
            g.gain.setValueAtTime(0.1, ctx.currentTime + 0.2);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
            osc.start(); osc.stop(ctx.currentTime + 0.3);
            osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
        },
        error: (ctx) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(330, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.25);
            g.gain.setValueAtTime(0.12, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(); osc.stop(ctx.currentTime + 0.3);
            osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
        },
    },
    // 主題 C：高頻短促嗶
    C: {
        label: '🟡 主題 C（嗶嗶）',
        success: (ctx) => {
            [0, 0.12].forEach((delay) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.type = 'square';
                osc.frequency.setValueAtTime(1800, ctx.currentTime + delay);
                g.gain.setValueAtTime(0.06, ctx.currentTime + delay);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.1);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.1);
                osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
            });
        },
        warning: (ctx) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            g.gain.setValueAtTime(0.06, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start(); osc.stop(ctx.currentTime + 0.15);
            osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
        },
        error: (ctx) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.25);
            g.gain.setValueAtTime(0.07, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(); osc.stop(ctx.currentTime + 0.3);
            osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
        },
    },
    // 主題 D：溫柔木琴風
    D: {
        label: '🟠 主題 D（木琴）',
        success: (ctx) => {
            [[0, 523], [0.1, 659], [0.2, 784]].forEach(([delay, freq]) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
                g.gain.setValueAtTime(0, ctx.currentTime + delay);
                g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + delay + 0.01);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.22);
                osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
            });
        },
        warning: (ctx) => {
            [[0, 440], [0.15, 370]].forEach(([delay, freq]) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
                g.gain.setValueAtTime(0.1, ctx.currentTime + delay);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.2);
                osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
            });
        },
        error: (ctx) => {
            [[0, 294], [0.12, 247]].forEach(([delay, freq]) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
                g.gain.setValueAtTime(0.1, ctx.currentTime + delay);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.22);
                osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
            });
        },
    },
    // 主題 E：低沉鼓聲風
    E: {
        label: '🔴 主題 E（低鼓）',
        success: (ctx) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(160, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
            g.gain.setValueAtTime(0.25, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start(); osc.stop(ctx.currentTime + 0.25);
            osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
        },
        warning: (ctx) => {
            [0, 0.18].forEach((delay) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(120, ctx.currentTime + delay);
                osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + delay + 0.12);
                g.gain.setValueAtTime(0.2, ctx.currentTime + delay);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.15);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.15);
                osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
            });
        },
        error: (ctx) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
            g.gain.setValueAtTime(0.2, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.start(); osc.stop(ctx.currentTime + 0.35);
            osc.addEventListener('ended', () => { osc.disconnect(); g.disconnect(); }, { once: true });
        },
    },
};

// Current active theme (persisted in localStorage)
let currentTheme = localStorage.getItem(SOUND_THEME_KEY) || 'A';
if (!SOUND_THEMES[currentTheme]) currentTheme = 'A';

function playSound(type) {
    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const theme = SOUND_THEMES[currentTheme];
    if (theme && theme[type]) theme[type](audioCtx);
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

// Sound theme selector — populate options & restore saved choice
Object.entries(SOUND_THEMES).forEach(([key, theme]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = theme.label;
    soundThemeSelect.appendChild(option);
});
soundThemeSelect.value = currentTheme;

soundThemeSelect.addEventListener('change', () => {
    currentTheme = soundThemeSelect.value;
    localStorage.setItem(SOUND_THEME_KEY, currentTheme);
    // Play a short preview on change so the user can confirm the sound
    playSound('success');
});

previewSoundBtn.addEventListener('click', () => {
    playSound('success');
});

// Initialize — use rebuildList() on startup to render items from localStorage
rebuildList();
