/* --- STATE MANAGEMENT --- */
let appData = {
    theme: 'theme-dark',
    activeTabId: 1,
    tabs: []
};

// Audio Context
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

    if (type === 'beep') {
        // Longer Beep (0.3s)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.1, now);
        osc.start();
        osc.stop(now + 0.3);
    } 
    else if (type === 'beep2') {
        // Double Digital Beep
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(0.05, now);
        
        // First blip
        osc.start(now);
        osc.stop(now + 0.1);

        // Second blip
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1200, now);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        gain2.gain.setValueAtTime(0.05, now);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.25);
    }
    else if (type === 'alarm') {
        // Classic Alarm
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.6);
        gainNode.gain.setValueAtTime(0.1, now);
        osc.start();
        osc.stop(now + 0.6);
    }
}

// --- INITIALIZATION ---
function init() {
    const saved = localStorage.getItem('proTimerData');
    if (saved) {
        appData = JSON.parse(saved);
        // Ensure data integrity if upgrading from old versions
        if(!appData.tabs) appData.tabs = [];
    } else {
        // Default Setup: Tab 1 with 1 timer
        createTab('Timer 1', true);
    }
    
    applyTheme(appData.theme);
    renderTabs();
    renderTimers();
}

// --- GLOBAL LOOP (100ms) ---
// We loop through ALL tabs and ALL timers to ensure background tabs still count down
setInterval(() => {
    let needsSave = false;
    let needsRender = false;

    appData.tabs.forEach(tab => {
        tab.timers.forEach(timer => {
            if (timer.isRunning) {
                if (timer.remaining > 0) {
                    timer.remaining--;
                } else {
                    timer.isRunning = false;
                    timer.remaining = 0;
                    if (timer.sound !== 'none') playSound(timer.sound);
                    needsRender = true; // Timer finished, update UI
                }
                
                // Only update DOM if this timer is currently visible in active tab
                if (tab.id === appData.activeTabId) {
                    updateTimerDOM(timer);
                }
                needsSave = true;
            }
        });
    });

    if (needsSave) saveData();
    if (needsRender) renderTimers();
}, 1000);

// --- TAB LOGIC ---
function createTab(name = "New Tab", isFirst = false) {
    const newTab = {
        id: Date.now(),
        name: name,
        timers: []
    };
    
    // Add default timer (1 min)
    const timerId = Date.now() + 1;
    newTab.timers.push(createTimerObject(timerId, 60)); // 60 seconds default

    appData.tabs.push(newTab);
    if (!isFirst) switchTab(newTab.id);
    saveData();
    renderTabs();
    renderTimers();
}

function switchTab(id) {
    appData.activeTabId = id;
    saveData();
    renderTabs();
    renderTimers();
}

function deleteCurrentTab() {
    if (appData.tabs.length <= 1) {
        alert("You must have at least one tab.");
        return;
    }
    if (confirm("Delete this tab and all its timers?")) {
        appData.tabs = appData.tabs.filter(t => t.id !== appData.activeTabId);
        appData.activeTabId = appData.tabs[0].id;
        saveData();
        renderTabs();
        renderTimers();
    }
}

function renameCurrentTab(newName) {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    if(tab) {
        tab.name = newName;
        saveData();
        renderTabs(); // Refresh button names
    }
}

// --- TIMER LOGIC ---
function createTimerObject(id, duration) {
    return {
        id: id,
        name: `Timer`,
        totalDuration: duration,
        remaining: duration,
        isRunning: false,
        isEditing: false,
        sound: 'none'
    };
}

function addTimerToCurrentTab() {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    if (!tab) return;
    
    // Default 1 Minute (60 seconds)
    tab.timers.push(createTimerObject(Date.now(), 60)); 
    saveData();
    renderTabs(); // In case we want to show timer counts in tabs later
    renderTimers();
}

function deleteTimer(timerId) {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    tab.timers = tab.timers.filter(t => t.id !== timerId);
    saveData();
    renderTimers();
}

function toggleTimer(timerId) {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    const timer = tab.timers.find(t => t.id === timerId);
    
    if (timer.remaining === 0) timer.remaining = timer.totalDuration;
    timer.isRunning = !timer.isRunning;
    renderTimers();
}

function resetTimer(timerId) {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    const timer = tab.timers.find(t => t.id === timerId);
    timer.isRunning = false;
    timer.remaining = timer.totalDuration;
    renderTimers();
}

function toggleEdit(timerId) {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    const timer = tab.timers.find(t => t.id === timerId);
    timer.isEditing = !timer.isEditing;
    
    if (!timer.isEditing) {
        const h = parseInt(document.getElementById(`h-${timerId}`).value) || 0;
        const m = parseInt(document.getElementById(`m-${timerId}`).value) || 0;
        const s = parseInt(document.getElementById(`s-${timerId}`).value) || 0;
        timer.totalDuration = (h * 3600) + (m * 60) + s;
        timer.remaining = timer.totalDuration;
    }
    renderTimers();
}

function updateTimerProp(timerId, prop, value) {
    const tab = appData.tabs.find(t => t.id === appData.activeTabId);
    const timer = tab.timers.find(t => t.id === timerId);
    timer[prop] = value;
    saveData();
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

    // Update current tab name input
    const currentTab = appData.tabs.find(t => t.id === appData.activeTabId);
    if(currentTab) document.getElementById('current-tab-name').value = currentTab.name;
}

function renderTimers() {
    const container = document.getElementById('timers-list');
    container.innerHTML = '';
    
    const currentTab = appData.tabs.find(t => t.id === appData.activeTabId);
    if (!currentTab) return;

    currentTab.timers.forEach(timer => {
        const h = Math.floor(timer.totalDuration / 3600);
        const m = Math.floor((timer.totalDuration % 3600) / 60);
        const s = timer.totalDuration % 60;

        const div = document.createElement('div');
        div.id = `card-${timer.id}`;
        div.className = `timer-card ${timer.isRunning ? 'running' : ''} ${timer.isEditing ? 'editing' : ''}`;
        
        div.innerHTML = `
            <div class="timer-header">
                <input type="text" class="timer-name" value="${timer.name}" onchange="updateTimerProp(${timer.id}, 'name', this.value)">
                <div>
                    <select onchange="updateTimerProp(${timer.id}, 'sound', this.value)">
                        <option value="none" ${timer.sound === 'none' ? 'selected' : ''}>No Sound</option>
                        <option value="beep" ${timer.sound === 'beep' ? 'selected' : ''}>Beep (Long)</option>
                        <option value="beep2" ${timer.sound === 'beep2' ? 'selected' : ''}>Beep 2 (Double)</option>
                        <option value="alarm" ${timer.sound === 'alarm' ? 'selected' : ''}>Alarm</option>
                    </select>
                    <button class="btn btn-icon" onclick="deleteTimer(${timer.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>

            <div class="timer-display">${formatTime(timer.remaining)}</div>

            <div class="edit-inputs">
                <input type="number" id="h-${timer.id}" value="${h}" min="0"> h
                <input type="number" id="m-${timer.id}" value="${m}" min="0" max="59"> m
                <input type="number" id="s-${timer.id}" value="${s}" min="0" max="59"> s
                <button class="btn btn-reset" onclick="toggleEdit(${timer.id})">Save</button>
            </div>

            <div class="progress-container">
                <div class="progress-bar" style="width: ${(timer.remaining / timer.totalDuration) * 100}%"></div>
            </div>

            <div class="timer-controls">
                <button class="btn btn-start" onclick="toggleTimer(${timer.id})">
                    <i class="fa-solid fa-play"></i> Start
                </button>
                <button class="btn btn-pause" onclick="toggleTimer(${timer.id})">
                    <i class="fa-solid fa-pause"></i> Pause
                </button>
                <button class="btn btn-reset" onclick="resetTimer(${timer.id})">
                    <i class="fa-solid fa-rotate-right"></i> Reset
                </button>
                <button class="btn btn-icon" style="margin-left: auto;" onclick="toggleEdit(${timer.id})">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
            </div>
        `;
        container.appendChild(div);
        
        // Initial visual update to set colors correctly
        updateTimerDOM(timer);
    });
}

function updateTimerDOM(timer) {
    const card = document.getElementById(`card-${timer.id}`);
    if (!card) return;

    // Display
    const display = card.querySelector('.timer-display');
    if(display) display.textContent = formatTime(timer.remaining);

    // Progress
    const progress = card.querySelector('.progress-bar');
    const percent = timer.totalDuration > 0 ? (timer.remaining / timer.totalDuration) * 100 : 0;
    if(progress) {
        progress.style.width = `${percent}%`;
        // Color logic
        const rootStyles = getComputedStyle(document.body);
        if(percent < 10) progress.style.backgroundColor = rootStyles.getPropertyValue('--accent-paused');
        else progress.style.backgroundColor = rootStyles.getPropertyValue('--accent-primary');
    }
}

// --- UTILS ---
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function saveData() {
    localStorage.setItem('proTimerData', JSON.stringify(appData));
}

function applyTheme(themeName) {
    document.body.className = themeName;
    appData.theme = themeName;
    document.getElementById('theme-select').value = themeName;
    saveData();
}

// --- EVENT LISTENERS ---
document.getElementById('add-timer-btn').addEventListener('click', addTimerToCurrentTab);
document.getElementById('add-tab-btn').addEventListener('click', () => createTab(`Tab ${appData.tabs.length + 1}`));
document.getElementById('delete-tab-btn').addEventListener('click', deleteCurrentTab);
document.getElementById('current-tab-name').addEventListener('input', (e) => renameCurrentTab(e.target.value));
document.getElementById('theme-select').addEventListener('change', (e) => applyTheme(e.target.value));

document.getElementById('clear-data-btn').addEventListener('click', () => {
    if(confirm('Reset ALL tabs and settings?')) {
        localStorage.removeItem('proTimerData');
        location.reload();
    }
});

// Run
init();
