// FILE: leaderboard_api.js
const db = require('./database');

/**
 * Get top 20 users sorted by level DESC, then coins DESC
 * Returns each user's: telegram_id, name, level, levelName, coins, rank
 */
function getTopLeaderboard(limit = 20) {
    try {
        const rows = db.db.prepare(`
            SELECT
                u.telegram_id,
                u.name,
                ul.current_level,
                ul.total_tasks_completed,
                ul.total_coins_earned,
                uc.coins
            FROM users u
            LEFT JOIN user_levels ul ON u.telegram_id = ul.telegram_id
            LEFT JOIN user_coins  uc ON u.telegram_id = uc.telegram_id
            WHERE u.name IS NOT NULL
            ORDER BY
                COALESCE(ul.current_level, 1) DESC,
                COALESCE(uc.coins, 0) DESC
            LIMIT ?
        `).all(limit);

        return rows.map((row, i) => ({
            rank:              i + 1,
            telegramId:        row.telegram_id,
            name:              row.name || 'Unknown',
            level:             row.current_level    || 1,
            coins:             row.coins            || 0,
            tasksCompleted:    row.total_tasks_completed || 0
        }));
    } catch (e) {
        console.error('[LeaderboardAPI] getTopLeaderboard:', e);
        return [];
    }
}

/**
 * Get a single user's rank + stats
 */
function getUserRankInfo(telegramId) {
    try {
        // Rank = number of users with higher level, or same level but more coins
        const rankRow = db.db.prepare(`
            SELECT COUNT(*) as rank_above
            FROM users u
            LEFT JOIN user_levels ul ON u.telegram_id = ul.telegram_id
            LEFT JOIN user_coins  uc ON u.telegram_id = uc.telegram_id
            WHERE u.name IS NOT NULL
              AND (
                COALESCE(ul.current_level, 1) > (
                    SELECT COALESCE(current_level, 1) FROM user_levels WHERE telegram_id = ?
                )
                OR (
                    COALESCE(ul.current_level, 1) = (
                        SELECT COALESCE(current_level, 1) FROM user_levels WHERE telegram_id = ?
                    )
                    AND COALESCE(uc.coins, 0) > (
                        SELECT COALESCE(coins, 0) FROM user_coins WHERE telegram_id = ?
                    )
                )
              )
        `).get(telegramId, telegramId, telegramId);

        const statsRow = db.db.prepare(`
            SELECT
                u.name,
                COALESCE(ul.current_level, 1) as level,
                COALESCE(uc.coins, 0)         as coins,
                COALESCE(ul.total_tasks_completed, 0) as tasks
            FROM users u
            LEFT JOIN user_levels ul ON u.telegram_id = ul.telegram_id
            LEFT JOIN user_coins  uc ON u.telegram_id = uc.telegram_id
            WHERE u.telegram_id = ?
        `).get(telegramId);

        if (!statsRow) return null;

        return {
            rank:   (rankRow?.rank_above || 0) + 1,
            name:   statsRow.name  || 'Unknown',
            level:  statsRow.level || 1,
            coins:  statsRow.coins || 0,
            tasks:  statsRow.tasks || 0
        };
    } catch (e) {
        console.error('[LeaderboardAPI] getUserRankInfo:', e);
        return null;
    }
}

module.exports = { getTopLeaderboard, getUserRankInfo };
