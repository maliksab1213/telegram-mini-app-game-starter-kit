// Games Database Operations - Updated with Sequence Match & Shootout
class GamesDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.createTables();
        this.ensureHeadTailsColumns();
        this.ensureGlassBallColumns();
        this.ensureFootballColumns();
        this.ensureHoleMoleColumns();
        this.ensureMemoryGameColumns();
        this.ensureSequenceMatchColumns();
        this.ensureShootoutColumns();
        this.prepareStatements();
    }

    createTables() {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS user_game_stats (
                    telegram_id INTEGER PRIMARY KEY,
                    rockpaper_wins INTEGER DEFAULT 0,
                    rockpaper_losses INTEGER DEFAULT 0,
                    coinflip_wins INTEGER DEFAULT 0,
                    coinflip_losses INTEGER DEFAULT 0,
                    total_games INTEGER DEFAULT 0,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_game_stats ON user_game_stats(telegram_id);

                CREATE TABLE IF NOT EXISTS game_cooldowns (
                    telegram_id INTEGER NOT NULL,
                    game_type TEXT NOT NULL,
                    plays_count INTEGER DEFAULT 0,
                    cooldown_until DATETIME,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (telegram_id, game_type),
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_game_cooldowns ON game_cooldowns(telegram_id, game_type);

                CREATE TABLE IF NOT EXISTS game_sessions (
                    telegram_id INTEGER NOT NULL,
                    game_type TEXT NOT NULL,
                    session_data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (telegram_id, game_type),
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_game_sessions ON game_sessions(telegram_id, game_type);
                
                CREATE TABLE IF NOT EXISTS game_daily_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    game_type TEXT NOT NULL,
                    date TEXT NOT NULL,
                    challenge TEXT DEFAULT NULL,
                    wins INTEGER DEFAULT 0,
                    losses INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_game_daily_stats ON game_daily_stats(telegram_id, game_type, date);
                CREATE INDEX IF NOT EXISTS idx_game_daily_date ON game_daily_stats(date);
            `);
            
            console.log('[GamesDB] ✅ Tables created');
        } catch (error) {
            console.error('[GamesDB] ❌ Table creation error:', error);
            throw error;
        }
    }

    ensureHeadTailsColumns() {
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(user_game_stats)").all();
            const columnNames = tableInfo.map(col => col.name);
            
            if (!columnNames.includes('headtails_wins')) {
                this.db.exec('ALTER TABLE user_game_stats ADD COLUMN headtails_wins INTEGER DEFAULT 0');
            }
            
            if (!columnNames.includes('headtails_losses')) {
                this.db.exec('ALTER TABLE user_game_stats ADD COLUMN headtails_losses INTEGER DEFAULT 0');
            }
            
            console.log('[GamesDB] ✅ HeadTails columns verified');
        } catch (error) {
            console.error('[GamesDB] ❌ Error ensuring HeadTails columns:', error);
        }
    }

    ensureGlassBallColumns() {
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(user_game_stats)").all();
            const columnNames = tableInfo.map(col => col.name);
            
            if (!columnNames.includes('glassball_wins')) {
                this.db.exec('ALTER TABLE user_game_stats ADD COLUMN glassball_wins INTEGER DEFAULT 0');
            }
            
            if (!columnNames.includes('glassball_losses')) {
                this.db.exec('ALTER TABLE user_game_stats ADD COLUMN glassball_losses INTEGER DEFAULT 0');
            }
            
            console.log('[GamesDB] ✅ GlassBall columns verified');
        } catch (error) {
            console.error('[GamesDB] ❌ Error ensuring GlassBall columns:', error);
        }
    }

    ensureFootballColumns() {
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(user_game_stats)").all();
            const columnNames = tableInfo.map(col => col.name);
            
            if (!columnNames.includes('football_wins')) {
                this.db.exec('ALTER TABLE user_game_stats ADD COLUMN football_wins INTEGER DEFAULT 0');
            }
            
            if (!columnNames.includes('football_losses')) {
                this.db.exec('ALTER TABLE user_game_stats ADD COLUMN football_losses INTEGER DEFAULT 0');
            }
            
            console.log('[GamesDB] ✅ Football columns verified');
        } catch (error) {
            console.error('[GamesDB] ❌ Error ensuring Football columns:', error);
        }
    }

    ensureHoleMoleColumns() {
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(user_game_stats)").all();
            const columnNames = tableInfo.map(col => col.name);
            
            const holeMoleCols = [
                'holemole_easy_wins', 'holemole_easy_losses',
                'holemole_medium_wins', 'holemole_medium_losses',
                'holemole_hard_wins', 'holemole_hard_losses'
            ];
            
            holeMoleCols.forEach(col => {
                if (!columnNames.includes(col)) {
                    this.db.exec(`ALTER TABLE user_game_stats ADD COLUMN ${col} INTEGER DEFAULT 0`);
                }
            });
            
            console.log('[GamesDB] ✅ HoleMole columns verified');
        } catch (error) {
            console.error('[GamesDB] ❌ Error ensuring HoleMole columns:', error);
        }
    }

    ensureMemoryGameColumns() {
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(user_game_stats)").all();
            const columnNames = tableInfo.map(col => col.name);
            
            const memoryGameCols = [
                'memorygame_easy_wins', 'memorygame_easy_losses',
                'memorygame_medium_wins', 'memorygame_medium_losses',
                'memorygame_hard_wins', 'memorygame_hard_losses'
            ];
            
            memoryGameCols.forEach(col => {
                if (!columnNames.includes(col)) {
                    this.db.exec(`ALTER TABLE user_game_stats ADD COLUMN ${col} INTEGER DEFAULT 0`);
                }
            });
            
            console.log('[GamesDB] ✅ MemoryGame columns verified');
        } catch (error) {
            console.error('[GamesDB] ❌ Error ensuring MemoryGame columns:', error);
        }
    }

    ensureSequenceMatchColumns() {
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(user_game_stats)").all();
            const columnNames = tableInfo.map(col => col.name);
            
            const sequenceMatchCols = [
                'sequencematch_easy_wins', 'sequencematch_easy_losses',
                'sequencematch_medium_wins', 'sequencematch_medium_losses',
                'sequencematch_hard_wins', 'sequencematch_hard_losses'
            ];
            
            sequenceMatchCols.forEach(col => {
                if (!columnNames.includes(col)) {
                    this.db.exec(`ALTER TABLE user_game_stats ADD COLUMN ${col} INTEGER DEFAULT 0`);
                }
            });
            
            console.log('[GamesDB] ✅ SequenceMatch columns verified');
        } catch (error) {
            console.error('[GamesDB] ❌ Error ensuring SequenceMatch columns:', error);
        }
    }

    ensureShootoutColumns() {
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(user_game_stats)").all();
            const columnNames = tableInfo.map(col => col.name);
            
            if (!columnNames.includes('shootout_wins')) {
                this.db.exec('ALTER TABLE user_game_stats ADD COLUMN shootout_wins INTEGER DEFAULT 0');
            }
            
            if (!columnNames.includes('shootout_losses')) {
                this.db.exec('ALTER TABLE user_game_stats ADD COLUMN shootout_losses INTEGER DEFAULT 0');
            }
            
            console.log('[GamesDB] ✅ Shootout columns verified');
        } catch (error) {
            console.error('[GamesDB] ❌ Error ensuring Shootout columns:', error);
        }
    }

    prepareStatements() {
        this.preparedStatements = {
            getUserStats: this.db.prepare('SELECT * FROM user_game_stats WHERE telegram_id = ?'),
            createUserStats: this.db.prepare('INSERT INTO user_game_stats (telegram_id) VALUES (?)'),
            
            updateRockPaperStats: this.db.prepare(`
                UPDATE user_game_stats 
                SET rockpaper_wins = rockpaper_wins + ?,
                    rockpaper_losses = rockpaper_losses + ?,
                    total_games = total_games + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            
            updateCoinFlipStats: this.db.prepare(`
                UPDATE user_game_stats 
                SET coinflip_wins = coinflip_wins + ?,
                    coinflip_losses = coinflip_losses + ?,
                    total_games = total_games + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            
            updateHeadTailsStats: this.db.prepare(`
                UPDATE user_game_stats 
                SET headtails_wins = headtails_wins + ?,
                    headtails_losses = headtails_losses + ?,
                    total_games = total_games + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            
            updateGlassBallStats: this.db.prepare(`
                UPDATE user_game_stats 
                SET glassball_wins = glassball_wins + ?,
                    glassball_losses = glassball_losses + ?,
                    total_games = total_games + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            
            updateFootballStats: this.db.prepare(`
                UPDATE user_game_stats 
                SET football_wins = football_wins + ?,
                    football_losses = football_losses + ?,
                    total_games = total_games + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            
            getCooldown: this.db.prepare('SELECT * FROM game_cooldowns WHERE telegram_id = ? AND game_type = ?'),
            
            setCooldown: this.db.prepare(`
                INSERT OR REPLACE INTO game_cooldowns 
                (telegram_id, game_type, plays_count, cooldown_until, last_updated)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `),
            
            incrementPlays: this.db.prepare(`
                INSERT INTO game_cooldowns (telegram_id, game_type, plays_count)
                VALUES (?, ?, 1)
                ON CONFLICT(telegram_id, game_type) 
                DO UPDATE SET 
                    plays_count = plays_count + 1,
                    last_updated = CURRENT_TIMESTAMP
            `),
            
            resetCooldown: this.db.prepare('DELETE FROM game_cooldowns WHERE telegram_id = ? AND game_type = ?'),
            
            getSession: this.db.prepare('SELECT * FROM game_sessions WHERE telegram_id = ? AND game_type = ?'),
            
            createSession: this.db.prepare(`
                INSERT OR REPLACE INTO game_sessions 
                (telegram_id, game_type, session_data, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `),
            
            updateSession: this.db.prepare(`
                UPDATE game_sessions 
                SET session_data = ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ? AND game_type = ?
            `),
            
            deleteSession: this.db.prepare('DELETE FROM game_sessions WHERE telegram_id = ? AND game_type = ?'),
            
            cleanOldSessions: this.db.prepare("DELETE FROM game_sessions WHERE updated_at < datetime('now', '-1 day')"),
            cleanOldCooldowns: this.db.prepare("DELETE FROM game_cooldowns WHERE cooldown_until < datetime('now') AND cooldown_until IS NOT NULL"),
            cleanOldDailyStats: this.db.prepare("DELETE FROM game_daily_stats WHERE date < date('now', '-3 days')")
        };
    }

    getUserStats(telegramId) {
        try {
            let stats = this.preparedStatements.getUserStats.get(telegramId);
            if (!stats) {
                this.preparedStatements.createUserStats.run(telegramId);
                stats = this.preparedStatements.getUserStats.get(telegramId);
            }
            return stats;
        } catch (error) {
            console.error('[GamesDB] Error getting user stats:', error);
            return null;
        }
    }

    updateRockPaperStats(telegramId, won) {
        try {
            const wins = won ? 1 : 0;
            const losses = won ? 0 : 1;
            
            this.getUserStats(telegramId);
            this.preparedStatements.updateRockPaperStats.run(wins, losses, telegramId);
            this.saveDailyStats(telegramId, 'rockpaper', null, wins, losses);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error updating rock paper stats:', error);
            return false;
        }
    }

    updateCoinFlipStats(telegramId, won) {
        try {
            const wins = won ? 1 : 0;
            const losses = won ? 0 : 1;
            
            this.getUserStats(telegramId);
            this.preparedStatements.updateCoinFlipStats.run(wins, losses, telegramId);
            this.saveDailyStats(telegramId, 'coinflip', null, wins, losses);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error updating coin flip stats:', error);
            return false;
        }
    }

    updateHeadTailsStats(telegramId, won) {
        try {
            const wins = won ? 1 : 0;
            const losses = won ? 0 : 1;
            
            this.getUserStats(telegramId);
            this.preparedStatements.updateHeadTailsStats.run(wins, losses, telegramId);
            this.saveDailyStats(telegramId, 'headtails', null, wins, losses);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error updating headtails stats:', error);
            return false;
        }
    }

    updateGlassBallStats(telegramId, won) {
        try {
            const wins = won ? 1 : 0;
            const losses = won ? 0 : 1;
            
            this.getUserStats(telegramId);
            this.preparedStatements.updateGlassBallStats.run(wins, losses, telegramId);
            this.saveDailyStats(telegramId, 'glassball', null, wins, losses);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error updating glassball stats:', error);
            return false;
        }
    }

    updateFootballStats(telegramId, won) {
        try {
            const wins = won ? 1 : 0;
            const losses = won ? 0 : 1;
            
            this.getUserStats(telegramId);
            this.preparedStatements.updateFootballStats.run(wins, losses, telegramId);
            this.saveDailyStats(telegramId, 'football', null, wins, losses);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error updating football stats:', error);
            return false;
        }
    }

    updateHoleMoleStats(telegramId, challenge, won) {
        try {
            const wins = won ? 1 : 0;
            const losses = won ? 0 : 1;
            
            this.getUserStats(telegramId);
            
            const query = `
                UPDATE user_game_stats 
                SET holemole_${challenge}_wins = holemole_${challenge}_wins + ?,
                    holemole_${challenge}_losses = holemole_${challenge}_losses + ?,
                    total_games = total_games + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `;
            
            this.db.prepare(query).run(wins, losses, telegramId);
            this.saveDailyStats(telegramId, 'holemole', challenge, wins, losses);
            
            console.log(`[GamesDB] ✅ HoleMole ${challenge} updated: W:${wins} L:${losses}`);
            return true;
        } catch (error) {
            console.error('[GamesDB] ❌ Error updating holemole stats:', error);
            return false;
        }
    }

    updateMemoryGameStats(telegramId, challenge, won) {
        try {
            const wins = won ? 1 : 0;
            const losses = won ? 0 : 1;
            
            this.getUserStats(telegramId);
            
            const query = `
                UPDATE user_game_stats 
                SET memorygame_${challenge}_wins = memorygame_${challenge}_wins + ?,
                    memorygame_${challenge}_losses = memorygame_${challenge}_losses + ?,
                    total_games = total_games + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `;
            
            this.db.prepare(query).run(wins, losses, telegramId);
            this.saveDailyStats(telegramId, 'memorygame', challenge, wins, losses);
            
            console.log(`[GamesDB] ✅ MemoryGame ${challenge} updated: W:${wins} L:${losses}`);
            return true;
        } catch (error) {
            console.error('[GamesDB] ❌ Error updating memorygame stats:', error);
            return false;
        }
    }

    updateSequenceMatchStats(telegramId, challenge, won) {
        try {
            const wins = won ? 1 : 0;
            const losses = won ? 0 : 1;
            
            this.getUserStats(telegramId);
            
            const query = `
                UPDATE user_game_stats 
                SET sequencematch_${challenge}_wins = sequencematch_${challenge}_wins + ?,
                    sequencematch_${challenge}_losses = sequencematch_${challenge}_losses + ?,
                    total_games = total_games + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `;
            
            this.db.prepare(query).run(wins, losses, telegramId);
            this.saveDailyStats(telegramId, 'sequencematch', challenge, wins, losses);
            
            console.log(`[GamesDB] ✅ SequenceMatch ${challenge} updated: W:${wins} L:${losses}`);
            return true;
        } catch (error) {
            console.error('[GamesDB] ❌ Error updating sequencematch stats:', error);
            return false;
        }
    }

    updateShootoutStats(telegramId, won) {
        try {
            const wins = won ? 1 : 0;
            const losses = won ? 0 : 1;
            
            this.getUserStats(telegramId);
            
            const query = `
                UPDATE user_game_stats 
                SET shootout_wins = shootout_wins + ?,
                    shootout_losses = shootout_losses + ?,
                    total_games = total_games + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `;
            
            this.db.prepare(query).run(wins, losses, telegramId);
            this.saveDailyStats(telegramId, 'shootout', null, wins, losses);
            
            console.log(`[GamesDB] ✅ Shootout updated: W:${wins} L:${losses}`);
            return true;
        } catch (error) {
            console.error('[GamesDB] ❌ Error updating shootout stats:', error);
            return false;
        }
    }

    saveDailyStats(telegramId, gameType, challenge, wins, losses) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const challengeVal = challenge || null;
            
            const existing = this.db.prepare(`
                SELECT id FROM game_daily_stats 
                WHERE telegram_id = ? AND game_type = ? AND date = ? 
                AND (challenge = ? OR (challenge IS NULL AND ? IS NULL))
            `).get(telegramId, gameType, today, challengeVal, challengeVal);
            
            if (existing) {
                this.db.prepare(`
                    UPDATE game_daily_stats 
                    SET wins = wins + ?, losses = losses + ?
                    WHERE id = ?
                `).run(wins, losses, existing.id);
            } else {
                this.db.prepare(`
                    INSERT INTO game_daily_stats (telegram_id, game_type, date, challenge, wins, losses)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(telegramId, gameType, today, challengeVal, wins, losses);
            }
        } catch (error) {
            console.error('[GamesDB] Error saving daily stats:', error);
        }
    }

    getCooldown(telegramId, gameType) {
        try {
            return this.preparedStatements.getCooldown.get(telegramId, gameType);
        } catch (error) {
            console.error('[GamesDB] Error getting cooldown:', error);
            return null;
        }
    }

    setCooldown(telegramId, gameType, playsCount, cooldownUntil) {
        try {
            this.preparedStatements.setCooldown.run(telegramId, gameType, playsCount, cooldownUntil);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error setting cooldown:', error);
            return false;
        }
    }

    incrementPlays(telegramId, gameType) {
        try {
            this.preparedStatements.incrementPlays.run(telegramId, gameType);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error incrementing plays:', error);
            return false;
        }
    }

    resetCooldown(telegramId, gameType) {
        try {
            this.preparedStatements.resetCooldown.run(telegramId, gameType);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error resetting cooldown:', error);
            return false;
        }
    }

    getSession(telegramId, gameType) {
        try {
            const session = this.preparedStatements.getSession.get(telegramId, gameType);
            if (session && session.session_data) {
                session.session_data = JSON.parse(session.session_data);
            }
            return session;
        } catch (error) {
            console.error('[GamesDB] Error getting session:', error);
            return null;
        }
    }

    createSession(telegramId, gameType, sessionData) {
        try {
            const jsonData = JSON.stringify(sessionData);
            this.preparedStatements.createSession.run(telegramId, gameType, jsonData);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error creating session:', error);
            return false;
        }
    }

    updateSession(telegramId, gameType, sessionData) {
        try {
            const jsonData = JSON.stringify(sessionData);
            this.preparedStatements.updateSession.run(jsonData, telegramId, gameType);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error updating session:', error);
            return false;
        }
    }

    deleteSession(telegramId, gameType) {
        try {
            this.preparedStatements.deleteSession.run(telegramId, gameType);
            return true;
        } catch (error) {
            console.error('[GamesDB] Error deleting session:', error);
            return false;
        }
    }

    cleanOldData() {
        try {
            const sessions = this.preparedStatements.cleanOldSessions.run();
            const cooldowns = this.preparedStatements.cleanOldCooldowns.run();
            const dailyStats = this.preparedStatements.cleanOldDailyStats.run();
            
            console.log(`[GamesDB] 🗑️ Cleaned ${sessions.changes} sessions, ${cooldowns.changes} cooldowns, ${dailyStats.changes} old daily stats`);
            return sessions.changes + cooldowns.changes + dailyStats.changes;
        } catch (error) {
            console.error('[GamesDB] Error cleaning old data:', error);
            return 0;
        }
    }

    getGamesOverview() {
        try {
            const totalStats = this.db.prepare(`
                SELECT 
                    SUM(rockpaper_wins + rockpaper_losses + coinflip_wins + coinflip_losses + 
                        COALESCE(headtails_wins, 0) + COALESCE(headtails_losses, 0) +
                        COALESCE(glassball_wins, 0) + COALESCE(glassball_losses, 0) +
                        COALESCE(football_wins, 0) + COALESCE(football_losses, 0) +
                        COALESCE(holemole_easy_wins, 0) + COALESCE(holemole_easy_losses, 0) +
                        COALESCE(holemole_medium_wins, 0) + COALESCE(holemole_medium_losses, 0) +
                        COALESCE(holemole_hard_wins, 0) + COALESCE(holemole_hard_losses, 0) +
                        COALESCE(memorygame_easy_wins, 0) + COALESCE(memorygame_easy_losses, 0) +
                        COALESCE(memorygame_medium_wins, 0) + COALESCE(memorygame_medium_losses, 0) +
                        COALESCE(memorygame_hard_wins, 0) + COALESCE(memorygame_hard_losses, 0) +
                        COALESCE(sequencematch_easy_wins, 0) + COALESCE(sequencematch_easy_losses, 0) +
                        COALESCE(sequencematch_medium_wins, 0) + COALESCE(sequencematch_medium_losses, 0) +
                        COALESCE(sequencematch_hard_wins, 0) + COALESCE(sequencematch_hard_losses, 0) +
                        COALESCE(shootout_wins, 0) + COALESCE(shootout_losses, 0)) as total_games,
                    COUNT(DISTINCT telegram_id) as total_players
                FROM user_game_stats
            `).get();

            return {
                totalStats: totalStats || {},
                activePlayers: this.db.prepare(`
                    SELECT COUNT(DISTINCT telegram_id) as count
                    FROM game_cooldowns
                    WHERE date(last_updated) = date('now')
                `).get()?.count || 0
            };
        } catch (error) {
            console.error('[GamesDB] Error getting overview:', error);
            return { totalStats: {}, activePlayers: 0 };
        }
    }
}

module.exports = GamesDB;