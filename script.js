/* --- STATE MANAGEMENT --- */
let session = {
    isRunning: false,
    currentMode: 'none', // 'work', 'rest', 'stopped'
    currentSessionTime: 0,
    totalTime: 0,
    currentSet: 1,
    splits: [],
    breakWarning: 0,
    theme: 'theme-dark'
};

let lastActionTime = 0;
const INPUT_COOLDOWN = 1000;
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// --- SOUND ENGINE ---
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'beep') {
        osc.type = 'square'; osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.05, now); osc.start(); osc.stop(now + 0.1);
    } else if (type === 'warning') {
        osc.frequency.setValueAtTime(800, now); gain.gain.setValueAtTime(0.1, now);
        osc.start(); osc.stop(now + 0.15);
        const osc2 = audioCtx.createOscillator(); const gain2 = audioCtx.createGain();
        osc2.connect(gain2); gain2.connect(audioCtx.destination);
        osc2.frequency.setValueAtTime(800, now + 0.2); gain2.gain.setValueAtTime(0.1, now + 0.2);
        osc2.start(now + 0.2); osc2.stop(now + 0.35);
    } else if (type === 'finish') {
        osc.frequency.setValueAtTime(600, now); osc.frequency.linearRampToValueAtTime(900, now + 0.4);
        gain.gain.setValueAtTime(0.1, now); osc.start(); osc.stop(now + 0.4);
    }
}

// --- INITIALIZATION ---
function init() {
    const saved = localStorage.getItem('trainingSessionData');
    if (saved) session = JSON.parse(saved);
    applyTheme(session.theme || 'theme-dark');
    render();
}

// --- GLOBAL TICKER ---
setInterval(() => {
    if (session.isRunning) {
        session.currentSessionTime++;
        session.totalTime++;
        if (session.currentMode === 'rest' && session.breakWarning > 0) {
            if (session.currentSessionTime === parseInt(session.breakWarning)) playSound('warning');
        }
        save();
        updateDisplay();
    }
}, 1000);

// --- CORE LOGIC ---
function setMode(newMode) {
    if (session.currentMode === newMode && session.isRunning) return;

    if (session.currentMode !== 'none' && session.currentMode !== 'stopped' && session.currentSessionTime > 0) {
        session.splits.push({ mode: session.currentMode, set: session.currentSet, duration: session.currentSessionTime });
        if (session.currentMode === 'rest' && newMode === 'work') session.currentSet++;
    }

    if (newMode === 'stopped') {
        playSound('finish');
        session.isRunning = false;
        session.currentMode = 'stopped';
    } else {
        playSound('beep');
        session.currentMode = newMode;
        session.currentSessionTime = 0;
        session.isRunning = true;
    }
    save(); render();
}

function exportData() {
    const now = new Date();
    const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
    
    let strokeSec = 0, restSec = 0, breaks = 0, longBreak = false;
    session.splits.forEach(s => {
        if (s.mode === 'work') strokeSec += s.duration;
        else { 
            restSec += s.duration; 
            breaks++; 
            if(s.duration > 50) longBreak = true; 
        }
    });

    const isElite = (session.totalTime >= 1200 && breaks <= 5 && !longBreak);

    let t = `=== STROKE / BREAK TRAINING LOG ===\n`;
    t += `Date: ${dateStr} (${weekday})\n`;
    if (isElite) t += `RANK: ⭐ ELITE PERFORMANCE ⭐\n`;
    t += `Total Session Time: ${formatTime(session.totalTime)}\n`;
    t += `Total Stroke Time: ${formatTime(strokeSec)}\n`;
    t += `Total Rest Time: ${formatTime(restSec)}\n`;
    t += `Total Breaks Taken: ${breaks}\n`;
    t += `------------------------------------------\n\n`;
    
    session.splits.forEach(s => {
        const modeLabel = s.mode === 'work' ? 'STROKE' : 'BREAK';
        t += `Phase ${s.set} [${modeLabel}] - Duration: ${formatTime(s.duration)}\n`;
    });

    const blob = new Blob([t], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Training_Log_${dateStr.replace(/\//g, '-')}_${timeStr}.txt`;
    a.click();
}

// --- DOM RENDERING ---
function render() {
    const container = document.getElementById('main-timer-container');
    const breaksUsed = session.splits.filter(s => s.mode === 'rest').length + (session.currentMode === 'rest' ? 1 : 0);
    const modeColor = session.currentMode === 'work' ? 'var(--accent-primary)' : (session.currentMode === 'rest' ? 'var(--accent-running)' : 'var(--text-secondary)');
    const displayMode = session.currentMode === 'work' ? 'STROKE' : (session.currentMode === 'rest' ? 'BREAK #' + session.currentSet : (session.currentMode === 'stopped' ? 'FINISHED' : 'READY'));

    container.innerHTML = `
        <div class="timer-card ${session.isRunning && session.currentMode === 'work' ? 'running' : (session.isRunning && session.currentMode === 'rest' ? 'resting' : '')}">
            <div style="display:flex; justify-content: space-between; align-items:center;">
                <div style="font-weight:bold; color: var(--accent-paused); font-size: 1.3rem;">BREAKS USED: ${breaksUsed}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    Warning: 
                    <select onchange="updateWarn(this.value)">
                        <option value="0" ${session.breakWarning == 0 ? 'selected' : ''}>Off</option>
                        <option value="40" ${session.breakWarning == 40 ? 'selected' : ''}>40s</option>
                        <option value="60" ${session.breakWarning == 60 ? 'selected' : ''}>60s</option>
                        <option value="90" ${session.breakWarning == 90 ? 'selected' : ''}>90s</option>
                    </select>
                </div>
            </div>
            
            <div style="color: var(--text-secondary); margin-top:10px;">Session: <span id="total-clock">${formatTime(session.totalTime)}</span></div>
            <div class="timer-display" id="main-clock" style="color: ${modeColor}">${formatTime(session.currentSessionTime)}</div>
            <div class="mode-indicator" style="color: ${modeColor}; font-weight:800; font-size: 1.4rem;">${displayMode}</div>

            <div class="timer-controls">
                <button class="btn" style="background:var(--accent-primary);" onclick="setMode('work')"><i class="fa-solid fa-fire"></i> Stroke</button>
                <button class="btn" style="background:var(--accent-running);" onclick="setMode('rest')"><i class="fa-solid fa-bed"></i> Break</button>
                <button class="btn" style="background:#6c5ce7;" onclick="setMode('stopped')"><i class="fa-solid fa-check"></i> Finish Session</button>
                <button class="btn btn-reset" onclick="exportData()"><i class="fa-solid fa-file-export"></i></button>
                <button class="btn btn-reset" onclick="resetAll()"><i class="fa-solid fa-rotate-right"></i></button>
            </div>
            
            <div class="splits-list" style="margin-top:20px; max-height:200px; overflow-y:auto;">
                ${session.splits.map(s => `
                    <div class="split-item">
                        <b style="color:${s.mode==='work'?'var(--accent-primary)':'var(--accent-running)'}">${s.mode==='work'?'Stroke':'Break #'+s.set}</b> 
                        <span>${formatTime(s.duration)}</span>
                    </div>
                `).reverse().join('')}
            </div>
        </div>
    `;
}

function updateDisplay() {
    const main = document.getElementById('main-clock');
    const total = document.getElementById('total-clock');
    if(main) main.textContent = formatTime(session.currentSessionTime);
    if(total) total.textContent = formatTime(session.totalTime);
}

// --- HELPERS ---
function updateWarn(val) { session.breakWarning = val; save(); }
function formatTime(s) { 
    const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const sec = s%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function save() { localStorage.setItem('trainingSessionData', JSON.stringify(session)); }
function applyTheme(t) { document.body.className = t; session.theme = t; document.getElementById('theme-select').value = t; save(); }
function resetAll() { if(confirm("Reset everything?")) { localStorage.removeItem('trainingSessionData'); location.reload(); } }

// --- KEYBOARD & MOUSE CONTROLS ---
window.addEventListener('keydown', (e) => {
    if (Date.now() - lastActionTime < INPUT_COOLDOWN) return;
    if (e.code === 'Space') { 
        e.preventDefault(); 
        lastActionTime = Date.now(); 
        setMode(session.currentMode === 'work' ? 'rest' : 'work'); 
    }
    else if (e.code === 'Enter' || e.code === 'Escape') { 
        lastActionTime = Date.now(); 
        setMode('stopped'); 
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 1 && Date.now() - lastActionTime > INPUT_COOLDOWN) { 
        lastActionTime = Date.now(); setMode(session.currentMode === 'work' ? 'rest' : 'work'); 
    }
});

document.getElementById('theme-select').onchange = (e) => applyTheme(e.target.value);
document.getElementById('clear-data-btn').onclick = resetAll;

init();
