/* --- STATE MANAGEMENT --- */
let appData = {
    theme: 'theme-dark',
    layout: 'list', // 'list' or 'grid'
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
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.1, now);
        osc.start();
        osc.stop(now + 0.3);
    } 
    else if (type === 'beep2') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(0.05, now);
        osc.start(now);
        osc.stop(now + 0.1);
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
        if(!appData.tabs) appData.tabs = [];
        if(!appData.layout) appData.layout = 'list';
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
    let needsRender = false;
    let lowestTime = Infinity;
    let activeTimersCount = 0;

    appData.tabs.forEach(tab => {
        tab.timers.forEach(timer => {
            if (timer.isRunning) {
                activeTimersCount++;
                if (timer.remaining < lowestTime) lowestTime = timer.remaining;

                if (timer.remaining > 0) {
                    timer.remaining--;
                } else {
                    timer.isRunning = false;
                    timer.remaining = 0;
                    if (timer.sound !== 'none') playSound(timer.sound);
                    needsRender = true;
                }
                
                if (tab.id === appData.activeTabId) {
                    updateTimerDOM(timer);
                }
                needsSave = true;
            }
        });
    });

    if (activeTimersCount > 0 && lowestTime !== Infinity) {
        document.title = `(${formatTime(lowestTime)}) ProTimer`;
    } else {
        document.title = "ProTimer";
    }

    if (needsSave) saveData();
    if (needsRender) renderTimers();
}, 1000);

// --- TAB LOGIC ---
function createTab(name, isFirst = false) {
    const newTab = {
        id: Date.now(),
        name: name,
        timers: []
    };
    
    const timerId = Date.now() + 1;
    newTab.timers.push(createTimerObject(timerId, 60, 1)); 

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
        renderTabs();
    }
}

// --- TIMER LOGIC ---
function createTimerObject(id, duration, countNumber) {
    return {
        id: id,
        name: `Timer ${countNumber}`,
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
    
    const nextNum = tab.timers.length + 1;
    
    tab.timers.push(createTimerObject(Date.now(), 60, nextNum)); 
    saveData();
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
                        <option value="none" ${timer.sound === 'none' ? 'selected' : ''}>Silent</option>
                        <option value="beep" ${timer.sound === 'beep' ? 'selected' : ''}>Beep</option>
                        <option value="beep2" ${timer.sound === 'beep2' ? 'selected' : ''}>Beep 2</option>
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
                <button class="btn btn-icon" onclick="toggleEdit(${timer.id})">
                    <i class="fa-solid fa-pen"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
        updateTimerDOM(timer);
    });
}

function updateTimerDOM(timer) {
    const card = document.getElementById(`card-${timer.id}`);
    if (!card) return;

    const display = card.querySelector('.timer-display');
    if(display) display.textContent = formatTime(timer.remaining);

    const progress = card.querySelector('.progress-bar');
    if(progress) {
        const percent = timer.totalDuration > 0 ? (timer.remaining / timer.totalDuration) * 100 : 0;
        progress.style.width = `${percent}%`;
        const rootStyles = getComputedStyle(document.body);
        if(percent < 10) progress.style.backgroundColor = rootStyles.getPropertyValue('--accent-paused');
        else progress.style.backgroundColor = rootStyles.getPropertyValue('--accent-primary');
    }
}

// --- HELPERS ---
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

function applyLayout(mode) {
    appData.layout = mode;
    const container = document.getElementById('timers-list');
    if (mode === 'grid') {
        container.classList.add('grid-view');
    } else {
        container.classList.remove('grid-view');
    }
    saveData();
}

function toggleLayout() {
    if (appData.layout === 'list') applyLayout('grid');
    else applyLayout('list');
}

// --- EVENT LISTENERS ---
document.getElementById('add-timer-btn').addEventListener('click', addTimerToCurrentTab);
document.getElementById('add-tab-btn').addEventListener('click', () => createTab(`Tab ${appData.tabs.length + 1}`));
document.getElementById('delete-tab-btn').addEventListener('click', deleteCurrentTab);
document.getElementById('current-tab-name').addEventListener('input', (e) => renameCurrentTab(e.target.value));
document.getElementById('theme-select').addEventListener('change', (e) => applyTheme(e.target.value));
document.getElementById('layout-toggle-btn').addEventListener('click', toggleLayout);

document.getElementById('clear-data-btn').addEventListener('click', () => {
    if(confirm('Reset ALL tabs and settings?')) {
        localStorage.removeItem('proTimerData');
        location.reload();
    }
});

// Run
init();
