// FILE: database/level.js  (NEW FILE)
class LevelDB {
    constructor(db) {
        this.db = db;
        this.createTables();
        this.prepareStatements();
    }

    createTables() {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS user_levels (
                    telegram_id INTEGER PRIMARY KEY,
                    current_level INTEGER DEFAULT 1,
                    first_time INTEGER DEFAULT 0,
                    total_tasks_completed INTEGER DEFAULT 0,
                    total_coins_earned INTEGER DEFAULT 0,
                    last_level_up DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_user_levels ON user_levels(telegram_id);
            `);
            // Add first_time column if upgrading from old schema
            try { this.db.exec(`ALTER TABLE user_levels ADD COLUMN first_time INTEGER DEFAULT 0`); } catch (_) {}
            console.log('[LevelDB] ✅ Tables ready');
        } catch (e) { console.error('[LevelDB] createTables:', e); throw e; }
    }

    prepareStatements() {
        this.stmts = {
            get:    this.db.prepare(`SELECT * FROM user_levels WHERE telegram_id = ?`),
            create: this.db.prepare(`INSERT OR IGNORE INTO user_levels (telegram_id, current_level, first_time) VALUES (?, 1, 0)`),
            setLevel: this.db.prepare(`
                UPDATE user_levels SET current_level = ?, last_level_up = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
            `),
            addTask: this.db.prepare(`
                UPDATE user_levels SET total_tasks_completed = total_tasks_completed + 1,
                updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
            `),
            addCoins: this.db.prepare(`
                UPDATE user_levels SET total_coins_earned = total_coins_earned + ?,
                updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
            `)
        };
    }

    getOrCreate(telegramId) {
        try {
            this.stmts.create.run(telegramId);
            return this.stmts.get.get(telegramId);
        } catch (e) { console.error('[LevelDB] getOrCreate:', e); return null; }
    }

    setLevel(telegramId, newLevel) {
        try { this.stmts.setLevel.run(newLevel, telegramId); return true; }
        catch (e) { console.error('[LevelDB] setLevel:', e); return false; }
    }

    addTaskCompleted(telegramId) {
        try { this.stmts.addTask.run(telegramId); } catch (_) {}
    }

    addCoinsEarned(telegramId, amount) {
        try { this.stmts.addCoins.run(amount, telegramId); } catch (_) {}
    }
}

module.exports = LevelDB;
