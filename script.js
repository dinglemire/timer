/* --- STATE MANAGEMENT --- */
let appData = {
    theme: 'theme-dark',
    layout: 'list', 
    activeTabId: 1,
    tabs: []
};

let lastActionTime = 0;
const INPUT_COOLDOWN = 1500; 

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// --- SOUND ENGINE ---
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'beep2') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(0.05, now);
        osc.start(now); osc.stop(now + 0.1);
    }
    else if (type === 'finish_standard') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(900, now + 0.4);
        gainNode.gain.setValueAtTime(0.1, now);
        osc.start(); osc.stop(now + 0.4);
    }
}

// --- INITIALIZATION ---
function init() {
    const saved = localStorage.getItem('proTimerData');
    if (saved) {
        appData = JSON.parse(saved);
        if(!appData.tabs) appData.tabs = [];
    } else {
        createTab('Tab 1', true);
    }
    applyTheme(appData.theme);
    applyLayout(appData.layout);
    renderTabs();
    renderTimers();
}

// --- GLOBAL LOOP ---
setInterval(() => {
    let needsSave = false;
    appData.tabs.forEach(tab => {
        tab.timers.forEach(timer => {
            if (timer.isRunning) {
                if (timer.type === 'stopwatch') {
                    timer.currentSessionTime++;
                    timer.totalTime++;
                } else if (timer.type === 'countdown' && timer.remaining > 0) {
                    timer.remaining--;
                    if(timer.remaining === 0 && timer.sound !== 'none') playSound('beep2');
                }
                if (tab.id === appData.activeTabId) updateTimerDOM(timer);
                needsSave = true;
            }
        });
    });
    if (needsSave) saveData();
}, 1000);

// --- LOGIC ---
function createTab(name, isFirst = false) {
    const newTab = { id: Date.now(), name: name, timers: [] };
    newTab.timers.push(createTimerObject(Date.now()+1, 60, 1)); 
    appData.tabs.push(newTab);
    if (!isFirst) switchTab(newTab.id);
    saveData(); renderTabs(); renderTimers();
}

function switchTab(id) { appData.activeTabId = id; saveData(); renderTabs(); renderTimers(); }

function createTimerObject(id, duration, countNumber) {
    return { id, type: 'countdown', name: `Timer ${countNumber}`, totalDuration: duration, remaining: duration, isRunning: false, isEditing: false, sound: 'none' };
}

function createStopwatchObject(id, countNumber) {
    return { id, type: 'stopwatch', name: `Training Log ${countNumber}`, isRunning: false, currentMode: 'none', currentSessionTime: 0, totalTime: 0, currentSet: 1, splits: [], outcome: 'none' };
}

function deleteTimer(timerId) {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    tab.timers = tab.timers.filter(t => t.id !== timerId);
    saveData(); renderTimers();
}

function setStopwatchMode(id, newMode) {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    const timer = tab.timers.find(t => t.id === id);
    if (timer.currentMode === newMode && timer.isRunning) return;

    if (timer.currentMode !== 'none' && !timer.currentMode.includes('stopped') && timer.currentSessionTime > 0) {
        timer.splits.push({ mode: timer.currentMode, set: timer.currentSet, duration: timer.currentSessionTime });
        if (timer.currentMode === 'rest' && newMode === 'work') timer.currentSet++;
    }

    if (newMode === 'stopped_release') {
        playSound('finish_standard');
        timer.isRunning = false;
        timer.currentMode = 'stopped_release';
        timer.outcome = 'RELEASED (SESSION COMPLETE)';
    } else if (newMode === 'stopped_no_release') {
        playSound('finish_standard');
        timer.isRunning = false;
        timer.currentMode = 'stopped_no_release';
        timer.outcome = 'NO RELEASE (SESSION ENDED)';
    } else {
        playSound('beep2');
        timer.currentMode = newMode;
        timer.currentSessionTime = 0;
        timer.isRunning = true;
        timer.outcome = 'none';
    }
    saveData(); renderTimers();
}

function resetStopwatch(id) {
    if (!confirm("Reset Training stats?")) return;
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    const timer = tab.timers.find(t => t.id === id);
    timer.isRunning = false; timer.currentMode = 'none'; timer.currentSessionTime = 0; timer.totalTime = 0; timer.currentSet = 1; timer.splits = []; timer.outcome = 'none';
    saveData(); renderTimers();
}

function exportStopwatch(id) {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    const timer = tab.timers.find(t => t.id === id);
    const now = new Date();
    const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

    let totalStrokeSec = 0, totalRestSec = 0, breakCount = 0;
    timer.splits.forEach(s => {
        if (s.mode === 'work') totalStrokeSec += s.duration;
        else { totalRestSec += s.duration; breakCount++; }
    });

    let text = `=== STROKE / REST TRAINING LOG ===\n`;
    text += `Date: ${dateStr} (${weekday})\n`;
    text += `Outcome: ${timer.outcome === 'none' ? 'In Progress' : timer.outcome}\n`;
    text += `Total Session Time: ${formatTime(timer.totalTime)}\n`;
    text += `Total Stroke Duration: ${formatTime(totalStrokeSec)}\n`;
    text += `Total Rest Duration: ${formatTime(totalRestSec)}\n`;
    text += `Total Breaks Taken: ${breakCount}\n`;
    text += `------------------------------------------\n\n`;
    timer.splits.forEach(s => {
        text += `Phase ${s.set} [${s.mode === 'work' ? 'STROKE' : 'BREAK'}] - Duration: ${formatTime(s.duration)}\n`;
    });
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Training_Log_${dateStr.replace(/\//g, '-')}_${timeStr}.txt`;
    a.click();
}

// --- DOM RENDERERS ---
function renderTabs() {
    const list = document.getElementById('tabs-list');
    list.innerHTML = '';
    appData.tabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${tab.id === appData.activeTabId ? 'active' : ''}`;
        btn.textContent = tab.name;
        btn.onclick = () => switchTab(tab.id);
        list.appendChild(btn);
    });
    const currentTab = appData.tabs.find(t => t.id === appData.activeTabId);
    if (currentTab) document.getElementById('current-tab-name').value = currentTab.name;
}

function renderTimers() {
    const container = document.getElementById('timers-list');
    container.innerHTML = '';
    const currentTab = appData.tabs.find(t => t.id === appData.activeTabId);
    if (!currentTab) return;

    currentTab.timers.forEach(timer => {
        const div = document.createElement('div');
        div.id = `card-${timer.id}`;
        if (timer.type === 'stopwatch') {
            const currentBreaks = timer.splits.filter(s => s.mode === 'rest').length + (timer.currentMode === 'rest' ? 1 : 0);
            div.className = `timer-card ${timer.isRunning && timer.currentMode === 'work' ? 'running' : (timer.isRunning && timer.currentMode === 'rest' ? 'resting' : '')}`;
            div.innerHTML = `
                <div class="timer-header">
                    <input type="text" class="timer-name" value="${timer.name}" onchange="updateTimerProp(${timer.id}, 'name', this.value)">
                    <div style="font-weight:bold; color: var(--accent-paused); font-size: 1.1rem;">BREAKS USED: ${currentBreaks}</div>
                    <button class="btn btn-icon" onclick="deleteTimer(${timer.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div style="text-align:center; color: var(--text-secondary); margin-top:5px; font-size: 0.9rem;" class="total-time-display">Total Session Time: ${formatTime(timer.totalTime)}</div>
                <div class="timer-display" style="color: ${timer.currentMode === 'work' ? 'var(--accent-primary)' : timer.currentMode === 'rest' ? 'var(--accent-running)' : 'var(--text-primary)'}">${formatTime(timer.currentSessionTime)}</div>
                <div class="mode-indicator">
                    ${timer.currentMode === 'work' ? 'STROKE' : (timer.currentMode === 'rest' ? 'BREAK #' + timer.currentSet : (timer.currentMode.includes('stopped') ? timer.outcome : 'Ready'))}
                </div>
                <div class="timer-controls">
                    <button class="btn" style="background:var(--accent-primary);" onclick="setStopwatchMode(${timer.id}, 'work')"><i class="fa-solid fa-fire"></i> Stroke</button>
                    <button class="btn" style="background:var(--accent-running);" onclick="setStopwatchMode(${timer.id}, 'rest')"><i class="fa-solid fa-bed"></i> Break</button>
                    <button class="btn" style="background:#6c5ce7;" onclick="setStopwatchMode(${timer.id}, 'stopped_release')" title="Enter: Release"><i class="fa-solid fa-water"></i> Release</button>
                    <button class="btn" style="background:#636e72;" onclick="setStopwatchMode(${timer.id}, 'stopped_no_release')" title="Esc: No Release"><i class="fa-solid fa-xmark"></i> No Release</button>
                    <button class="btn btn-reset" onclick="exportStopwatch(${timer.id})"><i class="fa-solid fa-file-export"></i></button>
                    <button class="btn btn-reset" onclick="resetStopwatch(${timer.id})"><i class="fa-solid fa-rotate-right"></i></button>
                </div>
                <div class="splits-list">${timer.splits.map(s => `<div class="split-item"><span class="split-${s.mode}">${s.mode === 'work' ? 'Stroke' : 'Break #' + s.set}</span><span>${formatTime(s.duration)}</span></div>`).reverse().join('')}</div>
            `;
        } else {
            // Countdown Timer UI
            div.className = `timer-card`;
            div.innerHTML = `
                <div class="timer-header"><span>${timer.name}</span><button class="btn btn-icon" onclick="deleteTimer(${timer.id})"><i class="fa-solid fa-trash"></i></button></div>
                <div class="timer-display">${formatTime(timer.remaining)}</div>
            `;
        }
        container.appendChild(div);
    });
}

function updateTimerDOM(timer) {
    const card = document.getElementById(`card-${timer.id}`);
    if (!card) return;
    const display = card.querySelector('.timer-display');
    if (display) display.textContent = formatTime(timer.currentSessionTime || timer.remaining);
    const totalDisplay = card.querySelector('.total-time-display');
    if (totalDisplay) totalDisplay.textContent = `Total Session Time: ${formatTime(timer.totalTime)}`;
}

function formatTime(s) { 
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function saveData() { localStorage.setItem('proTimerData', JSON.stringify(appData)); }
function applyTheme(t) { document.body.className = t; appData.theme = t; saveData(); }
function applyLayout(l) { appData.layout = l; saveData(); }
function updateTimerProp(id, prop, val) { 
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    const timer = tab.timers.find(t => t.id === id);
    if(timer) timer[prop] = val; saveData();
}

// --- INPUT HANDLERS ---
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const now = Date.now();
    if (now - lastActionTime < INPUT_COOLDOWN) return;
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    const sw = tab.timers.find(t => t.type === 'stopwatch');
    if (!sw) return;

    if (e.code === 'Space') {
        e.preventDefault(); lastActionTime = now;
        setStopwatchMode(sw.id, sw.currentMode === 'work' ? 'rest' : 'work');
    } else if (e.code === 'Enter') {
        lastActionTime = now; setStopwatchMode(sw.id, 'stopped_release');
    } else if (e.code === 'Escape') {
        lastActionTime = now; setStopwatchMode(sw.id, 'stopped_no_release');
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 1) { // Middle click
        const now = Date.now();
        if (now - lastActionTime < INPUT_COOLDOWN) return;
        const tab = appData.tabs.find(t => t.id === appData.activeTabId);
        const sw = tab.timers.find(t => t.type === 'stopwatch');
        if (sw) setStopwatchMode(sw.id, sw.currentMode === 'work' ? 'rest' : 'work');
    }
});

document.getElementById('add-timer-btn').onclick = () => { const tab = appData.tabs.find(t => t.id === appData.activeTabId); tab.timers.push(createTimerObject(Date.now(), 60, tab.timers.length+1)); renderTimers(); };
document.getElementById('add-stopwatch-btn').onclick = () => { const tab = appData.tabs.find(t => t.id === appData.activeTabId); tab.timers.push(createStopwatchObject(Date.now(), tab.timers.length+1)); renderTimers(); };
document.getElementById('theme-select').onchange = (e) => applyTheme(e.target.value);
document.getElementById('layout-toggle-btn').onclick = () => { appData.layout = appData.layout === 'grid' ? 'list' : 'grid'; applyLayout(appData.layout); renderTimers(); };

init();
