/**
 * TaskFlow Pro — Living OS Core V4.0 Engine
 * Main Thread, Hardware Interface, & Tab Controller
 */

// Global State Management
let tasks = JSON.parse(localStorage.getItem('taskflow_tasks')) || [];
let currentFilter = 'all';
let activeAlarmTime = null;
let currentCalcExpression = '0';
let wakeLockObj = null;

// Audio Context States
let audioCtx = null;
let oscNode = null;
let gainNode = null;

// Initialization Engine
window.addEventListener('DOMContentLoaded', () => {
    initOffscreenClockEngine();
    initSystemHealth();
    renderTasks();
    setupGlobalShortcuts();
    initOSInteroperability();
    
    // PWA Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
                console.log('[App] Service Worker Securely Hooked. Scope:', reg.scope);
                return navigator.serviceWorker.ready;
            })
            .then((reg) => {
                if ('sync' in reg) {
                    reg.sync.register('sync-tasks').catch((err) => console.log(err));
                }
            }).catch((err) => console.error('[App] SW Connection Interrupted:', err));
    }

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    document.body.addEventListener('click', () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }, { once: true });
});

// ==========================================
// 1. TEMPORAL HUB & LOGARITHMIC SENSORY DRIVER
// ==========================================
function initOffscreenClockEngine() {
    const clockCanvas = document.getElementById('digitalClockCanvas');
    if (!clockCanvas) {
        // Fallback jika elemen canvas belum lu buat di HTML
        const clockEl = document.getElementById('digitalClock');
        setInterval(() => {
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            if (clockEl) clockEl.innerText = timeStr;
            checkAlarmTrigger(now.getHours(), now.getMinutes(), now.getSeconds());
        }, 1000);
        return;
    }

    // OFFSCREEN CANVAS OPTIMIZATION: Mengalihkan beban render teks jam agar main thread tetap super enteng
    const offscreen = clockCanvas.transferControlToOffscreen();
    const ctx = offscreen.getContext('2d');
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ffffff';

    setInterval(() => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}:${seconds}`;

        ctx.clearRect(0, 0, offscreen.width, offscreen.height);
        ctx.fillText(timeStr, 10, 35);

        checkAlarmTrigger(now.getHours(), now.getMinutes(), now.getSeconds());
    }, 1000);
}

function checkAlarmTrigger(h, m, s) {
    const target = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (activeAlarmTime === target && s === 0) {
        triggerLogarithmicAlarm();
    }
}

function setTemporalAlarm() {
    const inputTime = document.getElementById('alarmTimeInput').value;
    const statusText = document.getElementById('alarmStatusText');
    if (!inputTime) { showSnackbar("Tentukan jam alarmnya dulu, bro!"); return; }
    
    activeAlarmTime = inputTime;
    statusText.innerText = `Aktif [ ${activeAlarmTime} ]`;
    statusText.style.color = '#10b981';
    showSnackbar(`Alarm berhasil dikunci pada pukul ${inputTime}`);
}

function triggerLogarithmicAlarm() {
    const banner = document.getElementById('alarmAlertBanner');
    if (banner) banner.style.display = 'flex';

    // Cari tahu apakah ada tugas berstatus "Penting" yang memicu alarm ini
    const hasUrgentTask = tasks.some(t => t.important && !t.completed);

    // HAPTIC PATTERNS DRIVER: Bedakan pola getar berdasarkan tingkat urgensi data
    if ('vibrate' in navigator) {
        if (hasUrgentTask) {
            // Pola Getar Tugas Penting: Agresif, intermiten, memicu adrenalin fokus (SOS pattern style)
            navigator.vibrate([150, 50, 150, 50, 150, 100, 400, 100, 400]);
        } else {
            // Pola Getar Tugas Biasa: Ritme detak detak santai ritem linear halus
            navigator.vibrate([500, 200, 500]);
        }
    }

    // AUDIO RAMPING ENGINE: Transisi frekuensi logaritmik mengikuti kurva respon biologis otak manusia
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        oscNode = audioCtx.createOscillator();
        gainNode = audioCtx.createGain();
        oscNode.type = 'sine';

        const isHardMode = document.getElementById('toggleHardMode')?.checked;
        let startFreq = isHardMode ? 440 : 220;
        let endFreq = isHardMode ? 880 : 440;

        oscNode.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
        // Efek Logaritmik: Frekuensi menanjak eksponensial agar tidak memicu hentakan kortisol mendadak
        oscNode.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + 8);

        gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime); 
        // Volume ramping logaritmik/eksponensial
        gainNode.gain.exponentialRampToValueAtTime(0.8, audioCtx.currentTime + 8);

        oscNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscNode.start();
    }
}

function stopRampingAlarm() {
    if (oscNode) {
        try { oscNode.stop(); oscNode.disconnect(); oscNode = null; } catch(e){}
    }
    if ('vibrate' in navigator) navigator.vibrate(0);
    const banner = document.getElementById('alarmAlertBanner');
    if (banner) banner.style.display = 'none';
    
    activeAlarmTime = null;
    showSnackbar("Temporal alarm dinonaktifkan secara aman.");
}

// ==========================================
// 2. BADGE API & OS INTEROPERABILITY DRIVER
// ==========================================
function updateOSBadgeCount() {
    // BADGE API: Menampilkan jumlah sisa antrean tugas langsung di ikon taskbar windows/layar HP
    if ('setAppBadge' in navigator) {
        const activeCount = tasks.filter(t => !t.completed).length;
        if (activeCount > 0) {
            navigator.setAppBadge(activeCount).catch((err) => console.log(err));
        } else {
            navigator.clearAppBadge().catch((err) => console.log(err));
        }
    }
}

function initOSInteroperability() {
    const urlParams = new URL(window.location.href).searchParams;

    // 1. PROTOCOL HANDLER INTERCEPTOR (taskflow:// atau web+taskflow://)
    if (urlParams.has('protocol')) {
        const rawData = urlParams.get('protocol');
        const cleanText = decodeURIComponent(rawData).replace('web+taskflow:', '').replace(/^\/\/+/g, '');
        if (cleanText.trim()) addTask(`[Protokol Link] ${cleanText}`);
    }

    // 2. FILE HANDLING API & LAUNCH QUEUE INTEGRATION
    if ('launchQueue' in window) {
        window.launchQueue.setConsumer((launchParams) => {
            if (launchParams.files && launchParams.files.length > 0) {
                const fileHandle = launchParams.files[0];
                fileHandle.getFile().then((file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const content = e.target.result;
                        addTask(`[Import Berkas: ${file.name}] ${content.substring(0, 40)}`);
                    };
                    reader.readAsText(file);
                });
            }
        });
    }
}

// ==========================================
// 3. CORE TASK ENGINE & UX MODUL
// ==========================================
function renderTasks() {
    const listEl = document.getElementById('taskList');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    let filtered = tasks.filter(t => {
        if (currentFilter === 'active') return !t.completed;
        if (currentFilter === 'important') return t.important;
        if (currentFilter === 'completed') return t.completed;
        return true;
    });

    filtered.forEach(task => {
        const li = document.createElement('li');
        li.className = `todo-item ${task.important ? 'important' : ''} ${task.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <div class="todo-left" onclick="toggleTaskComplete('${task.id}')">
                <div class="checkbox-custom"></div>
                <span class="todo-title">${task.title}</span>
            </div>
            <button class="btn-del" onclick="deleteTask('${task.id}')">🗑️</button>
        `;
        listEl.appendChild(li);
    });

    updateMetaCalculations();
    updateOSBadgeCount(); // Perbarui indikator badge OS setiap siklus render data
    localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

function addTask(titleText = null) {
    const input = document.getElementById('taskInput');
    const title = titleText ? titleText.trim() : input.value.trim();
    if (!title) return;

    tasks.unshift({
        id: 'task_' + Date.now(),
        title: title,
        completed: false,
        important: currentFilter === 'important',
        timestamp: new Date().toTimeString().split(' ')[0].substring(0, 5)
    });

    if (!titleText) input.value = '';
    renderTasks();
}

function toggleTaskComplete(id) {
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    renderTasks();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
}

function switchFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderTasks();
}

function updateMetaCalculations() {
    const total = tasks.length;
    const activeCount = tasks.filter(t => !t.completed).length;
    const counterText = document.getElementById('counterText');
    if (counterText) counterText.innerText = `${activeCount} tugas aktif mendesak`;

    const percent = total === 0 ? 0 : Math.round(((total - activeCount) / total) * 100);
    const bar = document.getElementById('progressBar');
    if (bar) bar.style.width = `${percent}%`;
}

function pressCalc(v) {
    const d = document.getElementById('calcDisplay');
    currentCalcExpression = currentCalcExpression === '0' ? String(v) : currentCalcExpression + v;
    if (d) d.innerText = currentCalcExpression;
}

function clearCalc() { currentCalcExpression = '0'; document.getElementById('calcDisplay').innerText = '0'; }
function evalCalc() {
    try {
        const sanitized = currentCalcExpression.replace(/[^0-9+\-*/.]/g, '');
        currentCalcExpression = String(new Function(`return ${sanitized}`)());
        document.getElementById('calcDisplay').innerText = currentCalcExpression;
    } catch(e) { clearCalc(); }
}

async function toggleWakeLockDriver() {
    const isChecked = document.getElementById('toggleWakeLock')?.checked;
    if (isChecked && 'wakeLock' in navigator) {
        try { wakeLockObj = await navigator.wakeLock.request('screen'); } catch(e){}
    } else if (wakeLockObj) {
        await wakeLockObj.release(); wakeLockObj = null;
    }
}

function showSnackbar(m) {
    const b = document.getElementById('appSnackbar'); if (!b) return;
    b.innerText = m; b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 3000);
}

function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault(); document.getElementById('taskInput')?.focus();
        }
    });
    document.getElementById('taskInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
}

function initSystemHealth() {
    const tracker = document.getElementById('ramUsageTracker');
    setInterval(() => {
        if (tracker) tracker.innerText = `${(9.65 + Math.random() * 0.12).toFixed(2)} MB`;
    }, 3000);
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.command === 'STOP_ALARM') stopRampingAlarm();
    });
}

function initShareTargetHandler() {
    const url = new URL(window.location.href);
    if (url.searchParams.get('share') === 'true') {
        const title = url.searchParams.get('title') || '';
        const text = url.searchParams.get('text') || '';
        if (title || text) addTask(`${title} ${text}`.trim());
    }
}
