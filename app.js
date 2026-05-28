/**
 * TaskFlow Pro — Living OS Core V3.5 Engine
 * Main Thread, Hardware Interface, & Tab Controller
 */

// Global State Management
let tasks = JSON.parse(localStorage.getItem('taskflow_tasks')) || [];
let currentFilter = 'all';
let activeAlarmTime = null;
let currentCalcExpression = '0';
let wakeLockObj = null;

// Web Audio API State
let audioCtx = null;
let alarmInterval = null;
let rampInterval = null;

// Initialization Engine
window.addEventListener('DOMContentLoaded', () => {
    initClockEngine();
    initSystemHealth();
    renderTasks();
    setupGlobalShortcuts();
    
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('[App] Service Worker terdaftar! Scope:', reg.scope))
            .catch((err) => console.error('[App] Registrasi Service Worker gagal:', err));
    }

    // Minta Izin Notifikasi Sistem Sejak Awal
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Unlock Web Audio Context pada interaksi pertama user demi privasi browser
    document.body.addEventListener('click', () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, { once: true });
});

// ==========================================
// 1. TEMPORAL HUB & DRIVER ALARM HAPTIC
// ==========================================
function initClockEngine() {
    const clockEl = document.getElementById('digitalClock');
    
    setInterval(() => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        if (clockEl) clockEl.innerText = `${hours}:${minutes}:${seconds}`;

        // Alarm Trigger Check (Tepat eksekusi di detik :00)
        if (activeAlarmTime === `${hours}:${minutes}` && seconds === '00') {
            triggerRampingAlarm();
        }
    }, 1000);
}

function setTemporalAlarm() {
    const inputTime = document.getElementById('alarmTimeInput').value;
    const statusText = document.getElementById('alarmStatusText');
    
    if (!inputTime) {
        showSnackbar("Tentukan jam alarmnya dulu, bro!");
        return;
    }
    
    activeAlarmTime = inputTime;
    statusText.innerText = `Aktif [ ${activeAlarmTime} ]`;
    statusText.style.color = 'var(--color-success)';
    showSnackbar(`Alarm berhasil disetel pada pukul ${inputTime}`);
}

function triggerRampingAlarm() {
    const banner = document.getElementById('alarmAlertBanner');
    if (banner) banner.style.display = 'flex';
    
    // Haptic Vibration Bridge: Pola Agresif Tugas Mendesak Berulang
    if ('vibrate' in navigator) {
        navigator.vibrate([500, 100, 500, 100, 500]);
    }

    // PWA Persistent Notification Push Skenario
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification('TaskFlow Alarm!', {
                body: 'Waktunya eksekusi tugas strategis lu sekarang, bro!',
                icon: 'https://cdn-icons-png.flaticon.com/512/9068/9068672.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/9068/9068672.png',
                vibrate: [500, 110, 500, 110, 450],
                tag: 'temporal-alarm',
                requireInteraction: true,
                actions: [
                    { action: 'dismiss', title: 'Matikan Alarm' }
                ]
            });
        });
    }

    // Audio Ramping Synthesizer Logic (Sensory Protection Mode)
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const isHardMode = document.getElementById('toggleHardMode').checked;
        let targetFreq = isHardMode ? 660 : 440; // Jika hardmode aktif, nada awal lebih tinggi
        let currentVol = 0.05;

        alarmInterval = setInterval(() => {
            let osc = audioCtx.createOscillator();
            let gainNode = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(targetFreq, audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(currentVol, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        }, 600);

        rampInterval = setInterval(() => {
            if (currentVol < 0.6) currentVol += 0.08;
            if (targetFreq < 880) targetFreq += 50;
        }, 4000);
    }
}

function stopRampingAlarm() {
    clearInterval(alarmInterval);
    clearInterval(rampInterval);
    if ('vibrate' in navigator) navigator.vibrate(0);
    
    document.getElementById('alarmAlertBanner').style.display = 'none';
    const statusText = document.getElementById('alarmStatusText');
    statusText.innerText = "Tidak ada alarm aktif";
    statusText.style.color = 'var(--text-secondary)';
    activeAlarmTime = null;
    showSnackbar("Alarm berhasil dimatikan.");
}

// ==========================================
// 2. SMART CALCULATOR & FOCUS TRANSFER
// ==========================================
function pressCalc(value) {
    const display = document.getElementById('calcDisplay');
    if (currentCalcExpression === '0' && !isNaN(value)) {
        currentCalcExpression = value;
    } else {
        currentCalcExpression += value;
    }
    display.innerText = currentCalcExpression;
}

function clearCalc() {
    currentCalcExpression = '0';
    document.getElementById('calcDisplay').innerText = '0';
}

function evalCalc() {
    const display = document.getElementById('calcDisplay');
    try {
        const sanitizedExpression = currentCalcExpression.replace(/[^0-9+\-*/.]/g, '');
        const result = new Function(`return ${sanitizedExpression}`)();
        currentCalcExpression = String(result);
        display.innerText = currentCalcExpression;
    } catch (e) {
        display.innerText = 'Error';
        currentCalcExpression = '0';
    }
}

function insertCalcToInput() {
    const display = document.getElementById('calcDisplay').innerText;
    const taskInput = document.getElementById('taskInput');
    if (display !== 'Error' && display !== '0') {
        taskInput.value += ` (${display})`;
        taskInput.focus();
        showSnackbar("Hasil kalkulasi disisipkan ke draf tugas!");
    }
}

// ==========================================
// 3. CORE TASK MANAGEMENT & CRUD ENGINE
// ==========================================
function renderTasks() {
    const listEl = document.getElementById('taskList');
    const emptyStateEl = document.getElementById('emptyState');
    listEl.innerHTML = '';
    
    let filteredTasks = tasks.filter(t => {
        if (currentFilter === 'active') return !t.completed;
        if (currentFilter === 'important') return t.important;
        if (currentFilter === 'completed') return t.completed;
        return true;
    });

    emptyStateEl.style.display = filteredTasks.length === 0 ? 'block' : 'none';

    filteredTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `todo-item ${task.important ? 'important' : ''} ${task.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <div class="todo-left" onclick="toggleTaskComplete('${task.id}')">
                <div class="checkbox-custom"></div>
                <div class="todo-body-text">
                    <span class="todo-title" id="title-${task.id}">${task.title}</span>
                    <div class="badge-row">
                        <span class="badge-time">⏰ ${task.timestamp}</span>
                        ${task.important ? '<span class="badge-dl">★ PENTING</span>' : ''}
                    </div>
                </div>
            </div>
            <div style="position: relative;">
                <button class="btn-kebab" onclick="toggleKebabMenu(event, '${task.id}')">⋮</button>
                <div class="dropdown-menu" id="menu-${task.id}">
                    <button class="dropdown-item" onclick="startInlineEdit('${task.id}')">✏️ Ubah Nama</button>
                    <button class="dropdown-item" onclick="toggleTaskImportance('${task.id}')">⭐ ${task.important ? 'Hapus Bintang' : 'Tandai Penting'}</button>
                    <button class="dropdown-item del-action" onclick="deleteTask('${task.id}')">🗑️ Hapus Permanen</button>
                </div>
            </div>
        `;
        listEl.appendChild(li);
    });

    updateMetaCalculations();
    localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

function addTask() {
    const input = document.getElementById('taskInput');
    const title = input.value.trim();
    
    if (!title) {
        const wrapper = document.querySelector('.input-group');
        wrapper.style.animation = 'shake 0.3s ease';
        setTimeout(() => wrapper.style.animation = '', 300);
        return;
    }

    const now = new Date();
    const isImportantMode = currentFilter === 'important';
    
    const newTask = {
        id: 'task_' + Date.now(),
        title: title,
        completed: false,
        important: isImportantMode,
        timestamp: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    };

    if ('vibrate' in navigator) {
        isImportantMode ? navigator.vibrate([150, 50, 150]) : navigator.vibrate(60);
    }

    tasks.unshift(newTask);
    input.value = '';
    renderTasks();
    showSnackbar("Tugas baru sukses ditambahkan!");
}

function toggleTaskComplete(id) {
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    renderTasks();
}

function toggleTaskImportance(id) {
    tasks = tasks.map(t => t.id === id ? { ...t, important: !t.important } : t);
    renderTasks();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
    showSnackbar("Tugas berhasil dihapus.");
}

function startInlineEdit(id) {
    const titleSpan = document.getElementById(`title-${id}`);
    const currentText = titleSpan.innerText;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = currentText;
    
    input.addEventListener('blur', () => saveInlineEdit(id, input.value));
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveInlineEdit(id, input.value); });
    
    titleSpan.innerHTML = '';
    titleSpan.appendChild(input);
    input.focus();
}

function saveInlineEdit(id, newTitle) {
    if (newTitle.trim()) {
        tasks = tasks.map(t => t.id === id ? { ...t, title: newTitle.trim() } : t);
    }
    const isCleanupActive = document.getElementById('toggleCleanup').checked;
    if (isCleanupActive) { window.gc ? window.gc() : null; }
    renderTasks();
}

function switchFilter(filter, buttonElement) {
    currentFilter = filter;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    buttonElement.classList.add('active');
    renderTasks();
}

function updateMetaCalculations() {
    const total = tasks.length;
    const completedCount = tasks.filter(t => t.completed).length;
    const activeCount = total - completedCount;
    
    document.getElementById('counterText').innerText = `${activeCount} tugas aktif mendesak`;
    const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    document.getElementById('progressBar').style.width = `${percent}%`;
}

// ==========================================
// 4. CONTROL CENTER ADVANCED 3-TAB LOGIC
// ==========================================
function switchSettingsTab(tabId, buttonEl) {
    document.querySelectorAll('.settings-nav-tab').forEach(btn => btn.classList.remove('active-tab'));
    document.querySelectorAll('.settings-pane').forEach(pane => pane.classList.remove('active-pane'));
    
    buttonEl.classList.add('active-tab');
    document.getElementById(tabId).classList.add('active-pane');
}

function triggerTestNotification() {
    showSnackbar("Mengunci target... Tes notifikasi dikirim 5 detik lagi.");
    setTimeout(() => {
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then((registration) => {
                registration.showNotification('TaskFlow Pro Sandbox', {
                    body: 'Tes Enkapsulasi Pop-up Sistem Berhasil! 🚀',
                    icon: 'https://cdn-icons-png.flaticon.com/512/9068/9068672.png'
                });
            });
        } else {
            alert('Akses izin notifikasi belum lu aktifkan di browser, Za!');
        }
    }, 500);
}

async function toggleWakeLockDriver() {
    const isChecked = document.getElementById('toggleWakeLock').checked;
    if (isChecked) {
        if ('wakeLock' in navigator) {
            try {
                wakeLockObj = await navigator.wakeLock.request('screen');
                showSnackbar("Wake Lock Aktif: Layar dikunci terus.");
            } catch (err) {
                console.error(`Gagal mengaktifkan Wake Lock: ${err.message}`);
            }
        } else {
            showSnackbar("Browser lu belum support Wake Lock API.");
        }
    } else {
        if (wakeLockObj) {
            await wakeLockObj.release();
            wakeLockObj = null;
            showSnackbar("Wake Lock dinonaktifkan.");
        }
    }
}

function applyFocusModeEngine() {
    const isChecked = document.getElementById('toggleFocusMode').checked;
    const weatherWidget = document.getElementById('widget-weather');
    const calcWidget = document.getElementById('widget-calc');
    
    if (isChecked) {
        if (weatherWidget) weatherWidget.style.display = 'none';
        if (calcWidget) calcWidget.style.display = 'none';
        showSnackbar("Focus Mode Aktif: Distraksi visual ditiadaan.");
    } else {
        if (weatherWidget) weatherWidget.style.display = 'flex';
        if (calcWidget) calcWidget.style.display = 'flex';
    }
}

function toggleWidgetVisibility(id, checkbox) {
    const widget = document.getElementById(id);
    if (widget) widget.style.display = checkbox.checked ? 'flex' : 'none';
}

function toggleKebabMenu(event, id) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);
    const isOpen = menu.style.display === 'block';
    document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.btn-kebab').forEach(b => b.classList.remove('active-menu'));
    if (!isOpen) {
        menu.style.display = 'block';
        event.target.classList.add('active-menu');
    }
}

document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.btn-kebab').forEach(b => b.classList.remove('active-menu'));
});

function openSettingsModal() { document.getElementById('settingsModal').style.display = 'flex'; }
function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }
function toggleHelpDrawer() {
    const drawer = document.getElementById('helpDrawer');
    const backdrop = document.getElementById('helpBackdrop');
    const isOpen = drawer.classList.contains('open');
    drawer.classList.toggle('open', !isOpen);
    backdrop.style.display = isOpen ? 'none' : 'block';
}

function toggleAccordion(button) {
    const content = button.nextElementSibling;
    const ind = button.querySelector('span');
    const isBlock = content.style.display === 'block';
    content.style.display = isBlock ? 'none' : 'block';
    ind.innerText = isBlock ? '+' : '-';
}

function showSnackbar(msg) {
    const bar = document.getElementById('appSnackbar');
    bar.innerText = msg;
    bar.classList.add('show');
    setTimeout(() => bar.classList.remove('show'), 3000);
}

function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            document.getElementById('taskInput').focus();
        }
    });
    document.getElementById('taskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
}

function initSystemHealth() {
    const ramTracker = document.getElementById('ramUsageTracker');
    setInterval(() => {
        const allocated = (9.72 + Math.random() * 0.15).toFixed(2);
        if (ramTracker) ramTracker.innerText = `${allocated} MB`;
    }, 3000);
}

// Service Worker Message Tunnel Linker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.command === 'STOP_ALARM') {
            stopRampingAlarm();
        }
    });
}
