// FILE: task_apis.js  (root)
// ─────────────────────────────────────────────────────────────────
//  LOGIC SUMMARY
//  Social tasks:  timer runs 100% in frontend.
//                 When timer ends, frontend calls POST /api/tasks/social/complete
//                 which sets completed=1. Then user clicks Claim → POST /api/tasks/claim
//  Game/Casino:   progress is read live from game_daily_stats / casino_bets.
//                 When progress >= goal, completed=1 is auto-written to DB.
//                 User clicks Claim → POST /api/tasks/claim
//
//  GET /api/tasks always returns per-task:
//    { taskId, completed (0/1), claimed (0/1), progress, goal, ... }
//  Frontend renders button based solely on those two flags.
// ─────────────────────────────────────────────────────────────────
const fs       = require('fs').promises;
const path     = require('path');
const db       = require('./database');
const levelAPI = require('./level_apis');

const TASKS_PATH = path.join(__dirname, 'control', 'tasks.json');

class TaskAPI {

    async _cfg() {
        try { return JSON.parse(await fs.readFile(TASKS_PATH, 'utf8')); }
        catch (e) { console.error('[TaskAPI] cfg load:', e.message); return null; }
    }

    _today() { return new Date().toISOString().split('T')[0]; }

    // ── Live progress (games / casino) ────────────────────────────

    _gameWins(telegramId, gameName) {
        try {
            const r = db.db.prepare(`
                SELECT COALESCE(SUM(wins),0) AS v
                FROM game_daily_stats
                WHERE telegram_id=? AND game_type=? AND date=?
            `).get(telegramId, gameName, this._today());
            return r ? r.v : 0;
        } catch { return 0; }
    }

    _casinoBet(telegramId) {
        try {
            const r = db.db.prepare(`
                SELECT COALESCE(SUM(bet_amount),0) AS v
                FROM casino_bets WHERE telegram_id=? AND date(bet_date)=date('now')
            `).get(telegramId);
            return r ? r.v : 0;
        } catch { return 0; }
    }

    _casinoRounds(telegramId, gameType) {
        try {
            const r = db.db.prepare(`
                SELECT COUNT(*) AS v FROM casino_bets
                WHERE telegram_id=? AND game_type=? AND date(bet_date)=date('now')
            `).get(telegramId, gameType);
            return r ? r.v : 0;
        } catch { return 0; }
    }

    _liveProgress(telegramId, task) {
        let progress = 0;
        if (task.type === 'game') {
            progress = this._gameWins(telegramId, task.game);
        } else if (task.type === 'casino') {
            progress = task.metric === 'total_bet'
                ? this._casinoBet(telegramId)
                : this._casinoRounds(telegramId, task.game);
        }
        progress = Math.min(progress, task.goal);
        return { progress, completed: progress >= task.goal };
    }

    // ── Ensure DB row exists ───────────────────────────────────────

    _ensureRow(telegramId, task, today) {
        if (!db.tasks.getUserTask(telegramId, task.taskId, today))
            db.tasks.createUserTask(telegramId, task.taskId, today, task.category);
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/tasks  →  build full task list with DB state
    // ─────────────────────────────────────────────────────────────
    async getUserTasks(telegramId) {
        try {
            const cfg  = await this._cfg();
            if (!cfg) return null;
            const today  = this._today();
            const dbRows = db.tasks.getTodayTasks(telegramId, today);

            const build = (configTasks, isLive) =>
                Object.values(configTasks || {}).map(task => {
                    const row = dbRows.find(r => r.task_id === task.taskId);

                    // Already claimed — always show "Collected" regardless
                    if (row && row.claimed === 1) {
                        return { ...task, progress: task.goal || 0, completed: true, claimed: true };
                    }

                    if (isLive) {
                        // ── Games / Casino: live read from play DBs ──
                        const live = this._liveProgress(telegramId, task);
                        // Auto-write completed=1 to DB when goal reached
                        if (live.completed && (!row || row.completed !== 1)) {
                            this._ensureRow(telegramId, task, today);
                            db.tasks.updateTaskProgress(
                                telegramId, task.taskId, today, task.goal, task.goal
                            );
                        }
                        return {
                            ...task,
                            progress:  live.progress,
                            completed: live.completed,
                            claimed:   false
                        };
                    } else {
                        // ── Social: completed flag lives purely in DB ──
                        // completed=1 is written by POST /api/tasks/social/complete
                        const completed = !!(row && row.completed === 1);
                        return {
                            ...task,
                            progress:  completed ? (task.goal || 1) : 0,
                            completed,
                            claimed: false
                        };
                    }
                });

            return {
                tasks: {
                    social: build(cfg.socialTasks  || {}, false),
                    games:  build(cfg.gamesTasks   || {}, true),
                    casino: build(cfg.casinoTasks  || {}, true)
                },
                currentDate: today
            };
        } catch (e) {
            console.error('[TaskAPI] getUserTasks:', e.message);
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  POST /api/tasks/social/complete
    //  Called by frontend when its countdown timer reaches 0.
    //  Sets completed=1 so Claim button appears.
    // ─────────────────────────────────────────────────────────────
    async markSocialCompleted(telegramId, taskId) {
        try {
            const cfg  = await this._cfg();
            const task = this._findById(cfg, taskId);
            if (!task || task.type !== 'social')
                return { success: false, message: 'Invalid task' };

            const today = this._today();

            // Idempotent — if already completed or claimed, that's fine
            const row = db.tasks.getUserTask(telegramId, taskId, today);
            if (row && row.claimed === 1)
                return { success: false, message: 'Already claimed' };
            if (row && row.completed === 1)
                return { success: true, alreadyDone: true };

            this._ensureRow(telegramId, task, today);
            db.tasks.updateTaskProgress(telegramId, taskId, today, task.goal || 1, task.goal || 1);

            console.log(`[TaskAPI] ✅ Social completed: ${telegramId} → ${taskId}`);
            return { success: true };
        } catch (e) {
            console.error('[TaskAPI] markSocialCompleted:', e.message);
            return { success: false, message: e.message };
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  POST /api/tasks/claim
    //  Works for ALL task types. Requires completed=1 in DB.
    // ─────────────────────────────────────────────────────────────
    async claimTaskReward(telegramId, taskId) {
        try {
            const cfg  = await this._cfg();
            const task = this._findById(cfg, taskId);
            if (!task) return { success: false, message: 'Task not found' };

            const today = this._today();

            // Hard duplicate guard
            const existing = db.tasks.getUserTask(telegramId, taskId, today);
            if (existing && existing.claimed === 1)
                return { success: false, message: 'Already claimed' };

            // For game/casino: verify live completion and write DB row if needed
            if (task.type === 'game' || task.type === 'casino') {
                const live = this._liveProgress(telegramId, task);
                if (!live.completed)
                    return { success: false, message: 'Task not completed yet' };
                this._ensureRow(telegramId, task, today);
                db.tasks.updateTaskProgress(telegramId, taskId, today, task.goal, task.goal);
            }

            // For social: completed=1 must already be in DB (set by markSocialCompleted)
            if (task.type === 'social') {
                const row = db.tasks.getUserTask(telegramId, taskId, today);
                if (!row || row.completed !== 1)
                    return { success: false, message: 'Task not completed yet' };
            }

            // Claim
            const result = db.tasks.claimTask(telegramId, taskId, today);
            if (result.success) {
                db.coins.addCoins(telegramId, task.coins, 0);
                levelAPI.addTaskCompleted(telegramId);
                console.log(`[TaskAPI] 💰 ${telegramId} claimed ${taskId} +${task.coins}`);
                return { success: true, coins: task.coins };
            }
            return result;
        } catch (e) {
            console.error('[TaskAPI] claimTaskReward:', e.message);
            return { success: false, message: e.message };
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  POST /api/tasks/social/start  (kept for opening URL only)
    //  No DB timer logic here — just returns the URL and timer seconds.
    // ─────────────────────────────────────────────────────────────
    async startSocialTask(telegramId, taskId) {
        try {
            const cfg  = await this._cfg();
            const task = this._findById(cfg, taskId);
            if (!task || task.type !== 'social')
                return { success: false, message: 'Invalid social task' };

            const today = this._today();
            const row   = db.tasks.getUserTask(telegramId, taskId, today);

            if (row && row.claimed === 1)
                return { success: false, message: 'Already claimed' };
            if (row && row.completed === 1)
                return { success: false, message: 'Already completed — click Claim Reward' };

            // Just return the URL and timer — no server-side timer stored
            return { success: true, url: task.url, timer: task.timer };
        } catch (e) {
            console.error('[TaskAPI] startSocialTask:', e.message);
            return { success: false, message: e.message };
        }
    }

    _findById(cfg, taskId) {
        for (const cat of ['socialTasks', 'gamesTasks', 'casinoTasks']) {
            const found = Object.values(cfg?.[cat] || {}).find(t => t.taskId === taskId);
            if (found) return found;
        }
        return null;
    }
}

module.exports = new TaskAPI();
