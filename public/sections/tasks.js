// FILE: public/sections/tasks.js
// ─────────────────────────────────────────────────────────────────
//  BUTTON STATE LOGIC (per task):
//
//  claimed  = true  →  "✅ Collected"  (grey, disabled) — never changes
//  completed= true  →  "🎁 Collect Coins" (gold, pulsing)
//  social + timer running  →  "⏳ Wait Xs…"  (grey countdown)
//  game/casino in progress →  "🎮 Play to Progress" (grey, disabled)
//  social not started      →  "🔗 Start Task" (purple)
// ─────────────────────────────────────────────────────────────────
class TasksSection {
    constructor() {
        this.isActive     = false;
        this.tasks        = null;
        this.activeTab    = 'social';
        // timers: taskId → { endsAt (ms), intervalId }
        this.timers       = new Map();
        this.pollInterval = null;
        this.init();
    }

    init() {
        this.el = {
            tasksList: document.getElementById('tasks-list')
        };
    }

    // ── Lifecycle ─────────────────────────────────────────────────

    async activate() {
        this.isActive = true;
        await this._load();
        this.render();
        this._startPoll();
    }

    deactivate() {
        this.isActive = false;
        this._stopPoll();
        // Keep timers running in background — they must still fire even if tab is hidden
    }

    _startPoll() {
        this._stopPoll();
        this.pollInterval = setInterval(async () => {
            if (!this.isActive) return;
            await this._load();
            this.render();
        }, 15000);
    }

    _stopPoll() {
        if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    }

    // ── Data ──────────────────────────────────────────────────────

    async _load() {
        try {
            const { uid, token } = this._params();
            const res = await fetch(`/api/tasks?uid=${uid}&token=${token}`, { cache: 'no-store' });
            if (res.ok) this.tasks = await res.json();
        } catch (e) { console.error('[Tasks] load:', e); }
    }

    // ── Render ────────────────────────────────────────────────────

    render() {
        if (!this.el.tasksList) return;
        if (!this.tasks) {
            this.el.tasksList.innerHTML = this._empty('⚠️', 'Could not load tasks', 'Check your connection.');
            return;
        }
        this.el.tasksList.innerHTML = `
            <div class="tasks-container">
                ${this._tabs()}
                ${this._list()}
            </div>`;
        this._bind();
        this._tickCountdowns(); // start/resume any running timers
    }

    _tabs() {
        return `<div class="task-categories">
            ${[['social','👥 Social'],['games','🎮 Games'],['casino','🎰 Casino']].map(([id,label]) => `
                <button class="task-category ${this.activeTab===id?'active':''}" data-tab="${id}">${label}</button>
            `).join('')}
        </div>`;
    }

    _list() {
        const list = (this.tasks.tasks || {})[this.activeTab] || [];
        if (!list.length)
            return this._empty('📭', 'No Tasks Today', 'Check another category or come back tomorrow!');
        return `<div class="tasks-grid">${list.map(t => this._card(t)).join('')}</div>`;
    }

    _card(task) {
        const pct = task.goal
            ? Math.min(Math.round((task.progress / task.goal) * 100), 100) : 0;

        return `
        <div class="task-card ${task.completed && !task.claimed ? 'completed' : ''} ${task.claimed ? 'claimed' : ''}"
             data-task-id="${task.taskId}">
            <div class="task-header">
                <div class="task-icon">${task.icon || '📌'}</div>
                <div class="task-reward">💰 ${task.coins}</div>
            </div>
            <div class="task-content">
                <h4 class="task-title">${task.name}</h4>
                <p class="task-description">${task.description}</p>
                ${task.type !== 'social' ? `
                <div class="task-progress">
                    <div class="task-progress-bar">
                        <div class="task-progress-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="task-status">
                        <span>${task.progress} / ${task.goal}</span>
                        <span>${pct}%</span>
                    </div>
                </div>` : ''}
            </div>
            ${this._btn(task)}
        </div>`;
    }

    _btn(task) {
        // ── Priority 1: Already collected ────────────────────────
        if (task.claimed) {
            return `<button class="task-button btn-collected" disabled>✅ Collected</button>`;
        }

        // ── Priority 2: Completed — show Collect Coins ───────────
        if (task.completed) {
            return `<button class="task-button btn-collect" data-task-id="${task.taskId}">
                        🎁 Collect Coins
                    </button>`;
        }

        // ── Priority 3: Social tasks ──────────────────────────────
        if (task.type === 'social') {
            const t = this.timers.get(task.taskId);
            if (t) {
                // Timer is running locally
                const secs = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
                return `<button class="task-button btn-waiting" disabled
                                data-timer-id="${task.taskId}">
                            ⏳ Wait ${secs}s…
                        </button>`;
            }
            return `<button class="task-button btn-start" data-task-id="${task.taskId}">
                        🔗 Start Task
                    </button>`;
        }

        // ── Priority 4: Game / Casino ─────────────────────────────
        if (task.type === 'game')
            return `<button class="task-button btn-waiting" disabled>🎮 Play to Progress</button>`;
        if (task.type === 'casino')
            return `<button class="task-button btn-waiting" disabled>🎰 Play Casino to Progress</button>`;

        return `<button class="task-button btn-waiting" disabled>In Progress</button>`;
    }

    // ── Countdown tick (updates button text every second) ─────────

    _tickCountdowns() {
        this.timers.forEach((info, taskId) => {
            // Clear old interval for this task if it exists
            if (info.intervalId) clearInterval(info.intervalId);

            info.intervalId = setInterval(() => {
                const btn = document.querySelector(`[data-timer-id="${taskId}"]`);
                const secsLeft = Math.max(0, Math.ceil((info.endsAt - Date.now()) / 1000));

                if (btn) btn.textContent = `⏳ Wait ${secsLeft}s…`;

                if (secsLeft <= 0) {
                    clearInterval(info.intervalId);
                    info.intervalId = null;
                    this._onTimerDone(taskId);
                }
            }, 500); // 500ms for smoother countdown
        });
    }

    // Timer reached 0 — tell server, then show Collect button
    async _onTimerDone(taskId) {
        // Remove from local timer map
        this.timers.delete(taskId);

        // Tell server: mark this task completed=1
        try {
            const { uid, token } = this._params();
            await fetch(`/api/tasks/social/complete?uid=${uid}&token=${token}`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ taskId })
            });
        } catch (e) { console.error('[Tasks] complete call failed:', e); }

        // Reload task list — completed=1 now, so Collect button appears
        await this._load();
        this.render();
        this._notify('success', '✅ Task Complete!', 'Tap Collect Coins to get your reward!');
    }

    // ── Event binding ─────────────────────────────────────────────

    _bind() {
        document.querySelectorAll('.task-category').forEach(b =>
            b.addEventListener('click', () => { this.activeTab = b.dataset.tab; this.render(); })
        );
        document.querySelectorAll('.btn-collect').forEach(b =>
            b.addEventListener('click', () => this._collect(b.dataset.taskId))
        );
        document.querySelectorAll('.btn-start').forEach(b =>
            b.addEventListener('click', () => this._start(b.dataset.taskId))
        );
    }

    // ── Actions ───────────────────────────────────────────────────

    async _collect(taskId) {
        // Instantly disable to prevent double-tap
        const btn = document.querySelector(`.btn-collect[data-task-id="${taskId}"]`);
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Collecting…'; }

        try {
            const { uid, token } = this._params();
            const res  = await fetch(`/api/tasks/claim?uid=${uid}&token=${token}`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ taskId })
            });
            const data = await res.json();

            if (data.success) {
                this._notify('success', '🎉 Coins Collected!', `+${data.coins} coins added to your wallet!`);
                if (window.homeInstance) window.homeInstance.refreshData();
                await this._load();
                this.render();
            } else {
                this._notify('error', 'Could not collect', data.message || 'Try again');
                await this._load();
                this.render();
            }
        } catch (e) {
            console.error('[Tasks] collect:', e);
            if (btn) { btn.disabled = false; btn.textContent = '🎁 Collect Coins'; }
        }
    }

    async _start(taskId) {
        const btn = document.querySelector(`.btn-start[data-task-id="${taskId}"]`);
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Opening…'; }

        try {
            const { uid, token } = this._params();
            const res  = await fetch(`/api/tasks/social/start?uid=${uid}&token=${token}`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ taskId })
            });
            const data = await res.json();

            if (data.success) {
                // Open the social URL
                window.open(data.url, '_blank');

                // Register frontend-only timer
                const endsAt = Date.now() + (data.timer * 1000);
                const existing = this.timers.get(taskId);
                if (existing && existing.intervalId) clearInterval(existing.intervalId);
                this.timers.set(taskId, { endsAt, intervalId: null });

                this._notify('info', '⏳ Timer Started', `Come back in ${data.timer}s to collect!`);
                this.render(); // show countdown immediately
            } else {
                // Server says already completed or claimed — reload to show correct button
                this._notify('info', 'Info', data.message || 'Could not start');
                await this._load();
                this.render();
            }
        } catch (e) {
            console.error('[Tasks] start:', e);
            if (btn) { btn.disabled = false; btn.textContent = '🔗 Start Task'; }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    _params() {
        const p = new URLSearchParams(window.location.search);
        return { uid: p.get('uid'), token: p.get('token') };
    }

    _notify(type, title, msg) {
        if (window.NotificationSystem) window.NotificationSystem.show(type, title, msg, 3500);
    }

    _empty(icon, title, sub) {
        return `<div class="tasks-container">
                    <div class="tasks-empty">
                        <div style="font-size:3rem">${icon}</div>
                        <h3>${title}</h3><p>${sub}</p>
                    </div>
                </div>`;
    }

    getData() { return this.tasks; }
}

window.TasksSection = TasksSection;
