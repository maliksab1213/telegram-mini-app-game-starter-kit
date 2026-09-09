// FILE: level_apis.js  (root)
const fs   = require('fs').promises;
const path = require('path');
const db   = require('./database');

const LEVELS_PATH = path.join(__dirname, 'control', 'levels.json');

async function _loadLevels() {
    try { return JSON.parse(await fs.readFile(LEVELS_PATH, 'utf8')); }
    catch (e) { console.error('[LevelAPI] loadLevels:', e.message); return null; }
}

async function getUserLevelInfo(telegramId) {
    try {
        const row      = db.level.getOrCreate(telegramId);
        const coinData = db.coins.getCoins(telegramId);   // real wallet coins
        const cfg      = await _loadLevels();
        if (!row || !cfg) return null;

        const lvl     = row.current_level;
        const lvlCfg  = cfg.levels[String(lvl)];
        const nextCfg = cfg.levels[String(lvl + 1)] || null;

        const reqTasks = nextCfg ? nextCfg.requiredTasks : (lvlCfg ? lvlCfg.requiredTasks : 0);
        const reqCoins = nextCfg ? nextCfg.requiredCoins : (lvlCfg ? lvlCfg.requiredCoins : 0);

        const userCoins = coinData ? (coinData.coins || 0) : 0;

        const canUp = nextCfg
            ? row.total_tasks_completed >= nextCfg.requiredTasks &&
              userCoins                 >= nextCfg.requiredCoins
            : false;

        return {
            currentLevel:        lvl,
            levelName:           lvlCfg ? lvlCfg.levelName : 'Unknown',
            firstTime:           row.first_time === 1,
            totalTasksCompleted: row.total_tasks_completed,
            totalCoins:          userCoins,        // real wallet coins
            requiredTasks:       reqTasks,
            requiredCoins:       reqCoins,
            canLevelUp:          canUp,
            isMaxLevel:          !nextCfg,
            rewards:             nextCfg ? nextCfg.rewards : null
        };
    } catch (e) {
        console.error('[LevelAPI] getUserLevelInfo:', e.message);
        return null;
    }
}

async function levelUpUser(telegramId) {
    try {
        const row      = db.level.getOrCreate(telegramId);
        const coinData = db.coins.getCoins(telegramId);   // real wallet coins
        const cfg      = await _loadLevels();
        if (!row || !cfg) return { success: false, message: 'Data error' };

        const lvl     = row.current_level;
        const nextLvl = lvl + 1;
        const nextCfg = cfg.levels[String(nextLvl)];
        if (!nextCfg) return { success: false, message: 'Max level reached' };

        const userCoins = coinData ? (coinData.coins || 0) : 0;

        if (row.total_tasks_completed < nextCfg.requiredTasks ||
            userCoins                 < nextCfg.requiredCoins) {
            return {
                success: false,
                message: `Need ${nextCfg.requiredTasks} tasks & ${nextCfg.requiredCoins.toLocaleString()} coins`
            };
        }

        db.level.setLevel(telegramId, nextLvl);

        const { coins = 0, spinTickets = 0 } = nextCfg.rewards || {};
        if (coins > 0) db.coins.addCoins(telegramId, coins, 0);
        if (spinTickets > 0) {
            try {
                db.db.prepare(
                    `UPDATE daily_spins SET tickets = tickets + ? WHERE telegram_id = ?`
                ).run(spinTickets, telegramId);
            } catch (_) {}
        }

        console.log(`[LevelAPI] 🎉 ${telegramId} → Level ${nextLvl}`);
        return { success: true, newLevel: nextLvl, rewards: nextCfg.rewards };
    } catch (e) {
        console.error('[LevelAPI] levelUpUser:', e.message);
        return { success: false, message: e.message };
    }
}

function addTaskCompleted(telegramId) {
    try { db.level.addTaskCompleted(telegramId); } catch (_) {}
}

// No longer needed (coins come from user_coins directly) but keep for compat
function addCoinsEarned(telegramId, amount) {}

module.exports = { getUserLevelInfo, levelUpUser, addTaskCompleted, addCoinsEarned };
