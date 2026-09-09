// FILE: database/task.js  (REPLACES existing)
// Tasks + social timers only. Level system removed → database/level.js
class TaskDB {
    constructor(db) {
        this.db = db;
        this.createTables();
        this.prepareStatements();
    }

    createTables() {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS user_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    task_id TEXT NOT NULL,
                    task_date TEXT NOT NULL,
                    task_category TEXT NOT NULL,
                    completed INTEGER DEFAULT 0,
                    claimed INTEGER DEFAULT 0,
                    progress INTEGER DEFAULT 0,
                    completed_at DATETIME,
                    claimed_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(telegram_id, task_id, task_date)
                );
                CREATE INDEX IF NOT EXISTS idx_user_tasks_lookup ON user_tasks(telegram_id, task_date);
                CREATE INDEX IF NOT EXISTS idx_user_tasks_completion ON user_tasks(telegram_id, completed, claimed);

                CREATE TABLE IF NOT EXISTS task_social_timers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    task_id TEXT NOT NULL,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    claim_available_at DATETIME NOT NULL,
                    UNIQUE(telegram_id, task_id)
                );
                CREATE INDEX IF NOT EXISTS idx_social_timers ON task_social_timers(telegram_id, task_id);
            `);
            console.log('[TaskDB] ✅ Tables ready');
        } catch (e) { console.error('[TaskDB] createTables:', e); throw e; }
    }

    prepareStatements() {
        this.stmts = {
            getUserTask: this.db.prepare(`
                SELECT * FROM user_tasks WHERE telegram_id = ? AND task_id = ? AND task_date = ?
            `),
            createUserTask: this.db.prepare(`
                INSERT OR IGNORE INTO user_tasks (telegram_id, task_id, task_date, task_category, progress)
                VALUES (?, ?, ?, ?, 0)
            `),
            updateTaskProgress: this.db.prepare(`
                UPDATE user_tasks
                SET progress = ?,
                    completed = CASE WHEN ? >= ? THEN 1 ELSE 0 END,
                    completed_at = CASE WHEN ? >= ? AND completed = 0 THEN CURRENT_TIMESTAMP ELSE completed_at END
                WHERE telegram_id = ? AND task_id = ? AND task_date = ? AND claimed = 0
            `),
            claimTask: this.db.prepare(`
                UPDATE user_tasks SET claimed = 1, claimed_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ? AND task_id = ? AND task_date = ? AND completed = 1 AND claimed = 0
            `),
            getTodayTasks: this.db.prepare(`SELECT * FROM user_tasks WHERE telegram_id = ? AND task_date = ?`),
            startSocialTimer: this.db.prepare(`
                INSERT OR REPLACE INTO task_social_timers
                    (telegram_id, task_id, started_at, claim_available_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', '+' || ? || ' seconds'))
            `),
            getSocialTimer:    this.db.prepare(`SELECT * FROM task_social_timers WHERE telegram_id = ? AND task_id = ?`),
            deleteSocialTimer: this.db.prepare(`DELETE FROM task_social_timers WHERE telegram_id = ? AND task_id = ?`),
            cleanOldTimers:    this.db.prepare(`DELETE FROM task_social_timers WHERE claim_available_at < datetime('now', '-1 day')`),
            cleanOldTasks:     this.db.prepare(`DELETE FROM user_tasks WHERE task_date < date('now', '-3 days')`)
        };
    }

    getUserTask(telegramId, taskId, taskDate) {
        try { return this.stmts.getUserTask.get(telegramId, taskId, taskDate); }
        catch (e) { console.error('[TaskDB] getUserTask:', e); return null; }
    }

    createUserTask(telegramId, taskId, taskDate, category) {
        try {
            this.stmts.createUserTask.run(telegramId, taskId, taskDate, category);
            return this.getUserTask(telegramId, taskId, taskDate);
        } catch (e) { console.error('[TaskDB] createUserTask:', e); return null; }
    }

    updateTaskProgress(telegramId, taskId, taskDate, progress, goal) {
        try {
            this.stmts.updateTaskProgress.run(
                progress, progress, goal, progress, goal,
                telegramId, taskId, taskDate
            );
            return this.getUserTask(telegramId, taskId, taskDate);
        } catch (e) { console.error('[TaskDB] updateTaskProgress:', e); return null; }
    }

    claimTask(telegramId, taskId, taskDate) {
        try {
            const task = this.getUserTask(telegramId, taskId, taskDate);
            if (!task || task.completed !== 1 || task.claimed === 1)
                return { success: false, message: 'Task not eligible for claim' };
            const info = this.stmts.claimTask.run(telegramId, taskId, taskDate);
            if (info.changes === 0) return { success: false, message: 'Claim failed' };
            console.log(`[TaskDB] ✅ Claimed ${taskId}`);
            return { success: true };
        } catch (e) { console.error('[TaskDB] claimTask:', e); return { success: false, message: e.message }; }
    }

    getTodayTasks(telegramId, date) {
        try { return this.stmts.getTodayTasks.all(telegramId, date); }
        catch (e) { console.error('[TaskDB] getTodayTasks:', e); return []; }
    }

    startSocialTimer(telegramId, taskId, timerSeconds) {
        try { this.stmts.startSocialTimer.run(telegramId, taskId, timerSeconds); return true; }
        catch (e) { console.error('[TaskDB] startSocialTimer:', e); return false; }
    }

    getSocialTimer(telegramId, taskId) {
        try { return this.stmts.getSocialTimer.get(telegramId, taskId); }
        catch (e) { return null; }
    }

    deleteSocialTimer(telegramId, taskId) {
        try { this.stmts.deleteSocialTimer.run(telegramId, taskId); return true; }
        catch (e) { return false; }
    }

    cleanupOldData() {
        try {
            const t = this.stmts.cleanOldTimers.run();
            const d = this.stmts.cleanOldTasks.run();
            console.log(`[TaskDB] 🗑️ Cleaned ${t.changes} timers, ${d.changes} old tasks`);
        } catch (e) { console.error('[TaskDB] cleanupOldData:', e); }
    }
}

module.exports = TaskDB;
