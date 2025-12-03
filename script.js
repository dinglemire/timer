// State
let timers = [];
const savedData = localStorage.getItem('multiTimerData');

// Audio Context for generating sounds (No MP3 files needed!)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'alarm') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

// Initialization
if (savedData) {
    timers = JSON.parse(savedData);
} else {
    // Default starting timer if none exist
    addTimerObj(12 * 60); // 12 minutes
}

renderTimers();

// Global Loop (Updates every 100ms)
setInterval(() => {
    timers.forEach(timer => {
        if (timer.isRunning) {
            if (timer.remaining > 0) {
                timer.remaining--;
            } else {
                timer.isRunning = false;
                timer.remaining = 0;
                if (timer.sound !== 'none') playSound(timer.sound);
                renderTimers(); // Force re-render to show finished state
            }
            updateTimerDOM(timer.id);
        }
    });
    saveData();
}, 1000);

// --- Functions ---

function addTimerObj(durationSeconds = 60) {
    const id = Date.now();
    timers.push({
        id: id,
        name: `Timer ${timers.length + 1}`,
        totalDuration: durationSeconds,
        remaining: durationSeconds,
        isRunning: false,
        isEditing: false,
        sound: 'none'
    });
    renderTimers();
    saveData();
}

function deleteTimer(id) {
    timers = timers.filter(t => t.id !== id);
    renderTimers();
    saveData();
}

function toggleTimer(id) {
    const timer = timers.find(t => t.id === id);
    if (!timer) return;
    
    // If finished, reset before starting
    if (timer.remaining === 0) {
        timer.remaining = timer.totalDuration;
    }
    
    timer.isRunning = !timer.isRunning;
    renderTimers();
}

function resetTimer(id) {
    const timer = timers.find(t => t.id === id);
    timer.isRunning = false;
    timer.remaining = timer.totalDuration;
    renderTimers();
}

function toggleEdit(id) {
    const timer = timers.find(t => t.id === id);
    timer.isEditing = !timer.isEditing;
    // If saving (switching off edit), update duration
    if (!timer.isEditing) {
        const h = parseInt(document.getElementById(`h-${id}`).value) || 0;
        const m = parseInt(document.getElementById(`m-${id}`).value) || 0;
        const s = parseInt(document.getElementById(`s-${id}`).value) || 0;
        timer.totalDuration = (h * 3600) + (m * 60) + s;
        timer.remaining = timer.totalDuration;
    }
    renderTimers();
}

function updateName(id, newName) {
    const timer = timers.find(t => t.id === id);
    timer.name = newName;
    saveData();
}

function updateSound(id, newSound) {
    const timer = timers.find(t => t.id === id);
    timer.sound = newSound;
    saveData();
}

function saveData() {
    localStorage.setItem('multiTimerData', JSON.stringify(timers));
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- DOM Manipulation ---

function updateTimerDOM(id) {
    const timer = timers.find(t => t.id === id);
    const card = document.getElementById(`card-${id}`);
    if (!card) return;

    // Update Display
    const display = card.querySelector('.timer-display');
    display.textContent = formatTime(timer.remaining);

    // Update Progress Bar
    const progress = card.querySelector('.progress-bar');
    const percent = timer.totalDuration > 0 ? (timer.remaining / timer.totalDuration) * 100 : 0;
    progress.style.width = `${percent}%`;
    
    // Change color based on remaining
    if(percent < 10) progress.style.backgroundColor = '#ff7675'; // Red at end
    else progress.style.backgroundColor = '#00b894';
}

function renderTimers() {
    const container = document.getElementById('timers-list');
    container.innerHTML = '';

    timers.forEach(timer => {
        const h = Math.floor(timer.totalDuration / 3600);
        const m = Math.floor((timer.totalDuration % 3600) / 60);
        const s = timer.totalDuration % 60;

        const div = document.createElement('div');
        div.id = `card-${timer.id}`;
        div.className = `timer-card ${timer.isRunning ? 'running' : ''} ${timer.isEditing ? 'editing' : ''}`;
        
        div.innerHTML = `
            <div class="timer-header">
                <input type="text" class="timer-name" value="${timer.name}" onchange="updateName(${timer.id}, this.value)">
                <div>
                    <select onchange="updateSound(${timer.id}, this.value)">
                        <option value="none" ${timer.sound === 'none' ? 'selected' : ''}>No Sound</option>
                        <option value="beep" ${timer.sound === 'beep' ? 'selected' : ''}>Beep</option>
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
    });
}

// Event Listeners
document.getElementById('add-timer-btn').addEventListener('click', () => {
    // Default adds 45 seconds as per your request example
    addTimerObj(45); 
});

document.getElementById('clear-all-btn').addEventListener('click', () => {
    if(confirm('Delete all timers?')) {
        timers = [];
        localStorage.removeItem('multiTimerData');
        addTimerObj(12 * 60); // Reset to one 12 min timer
    }
});
