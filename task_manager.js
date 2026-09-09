// Task Manager – auto-rotates task IDs daily & cleans old data
const fs   = require('fs').promises;
const path = require('path');

class TaskManager {
    constructor() {
        this.tasksPath      = path.join(__dirname, 'control', 'tasks.json');
        this.forcePath      = path.join(__dirname, 'control', 'force_tasks.json');
        this.isRunning      = false;
        this.checkInterval  = null;
    }

    // ── Lifecycle ──────────────────────────────────────────────────

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[TaskManager] 🚀 Starting…');
        await this.checkAndUpdate();
        this.checkInterval = setInterval(() => this.checkAndUpdate(), 60 * 60 * 1000);
        console.log('[TaskManager] ✅ Running');
    }

    stop() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.checkInterval = null;
        this.isRunning = false;
        console.log('[TaskManager] 🛑 Stopped');
    }

    // ── Main check ─────────────────────────────────────────────────

    async checkAndUpdate() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const data  = await this.loadTasks();

            if (data.currentDate !== today) {
                console.log(`[TaskManager] 📅 New day: ${data.currentDate} → ${today}`);
                await this.rotateTasks(data, today);
                this.triggerCleanup();
            }

            await this.applyForcedTasks(today);
        } catch (err) {
            console.error('[TaskManager] ❌ checkAndUpdate error:', err);
        }
    }

    // ── Task ID rotation ───────────────────────────────────────────

    async rotateTasks(data, newDate) {
        const suffix = newDate.replace(/-/g, '');
        for (const category of ['socialTasks', 'gamesTasks', 'casinoTasks']) {
            if (!data[category]) continue;
            for (const key of Object.keys(data[category])) {
                const task = data[category][key];
                if (task.taskId) {
                    // strip old date suffix (8 digits) and replace
                    task.taskId = task.taskId.replace(/_\d{8}$/, '') + '_' + suffix;
                }
            }
        }
        data.currentDate = newDate;
        await this.saveTasks(data);
        console.log(`[TaskManager] ✅ Task IDs rotated for ${newDate}`);
    }

    // ── Forced task override ───────────────────────────────────────

    async applyForcedTasks(today) {
        const exists = await this.fileExists(this.forcePath);
        if (!exists) return;

        let force;
        try {
            const raw = await fs.readFile(this.forcePath, 'utf8');
            force = JSON.parse(raw);
        } catch { return; }

        if (!force || force.forceDate !== today) return;

        console.log(`[TaskManager] 🔄 Applying forced tasks for ${today}`);
        const data = await this.loadTasks();
        for (const cat of ['socialTasks', 'gamesTasks', 'casinoTasks']) {
            if (force[cat]) data[cat] = { ...data[cat], ...force[cat] };
        }
        data.currentDate = today;
        await this.saveTasks(data);
        await fs.writeFile(this.forcePath,
            JSON.stringify({ forceDate: null }, null, 2), 'utf8');
        console.log('[TaskManager] ✅ Forced tasks applied & cleared');
    }

    // ── IO helpers ─────────────────────────────────────────────────

    async loadTasks() {
        const raw = await fs.readFile(this.tasksPath, 'utf8');
        return JSON.parse(raw);
    }

    async saveTasks(data) {
        await fs.writeFile(this.tasksPath, JSON.stringify(data, null, 2), 'utf8');
    }

    async fileExists(fp) {
        try { await fs.access(fp); return true; } catch { return false; }
    }

    // ── DB cleanup hook ────────────────────────────────────────────

    triggerCleanup() {
        try {
            const db = require('./database');
            if (db?.tasks?.cleanupOldData) db.tasks.cleanupOldData();
        } catch (e) {
            console.error('[TaskManager] ❌ cleanup error:', e);
        }
    }

    // ── Manual trigger (admin / testing) ──────────────────────────

    async manualUpdate(date) {
        const data = await this.loadTasks();
        await this.rotateTasks(data, date);
    }
}

module.exports = new TaskManager();
