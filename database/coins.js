// Coins Management Database Operations
class CoinsDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            getCoins: this.db.prepare('SELECT coins, total_words FROM user_coins WHERE telegram_id = ?'),
            insertCoins: this.db.prepare(`
                INSERT INTO user_coins (telegram_id, coins, total_words) VALUES (?, ?, ?)
            `),
            updateCoins: this.db.prepare(`
                UPDATE user_coins 
                SET coins = ?, total_words = ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            incrementCoins: this.db.prepare(`
                UPDATE user_coins 
                SET coins = coins + ?, total_words = total_words + ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `)
        };
    }

    getCoins(telegramId) {
        try {
            const result = this.preparedStatements.getCoins.get(telegramId);
            if (!result) {
                this.preparedStatements.insertCoins.run(telegramId, 0, 0);
                return { coins: 0, total_words: 0 };
            }
            return result;
        } catch (error) {
            console.error('[CoinsDB] Error getting coins:', error);
            return { coins: 0, total_words: 0 };
        }
    }

    setCoins(telegramId, coins, totalWords) {
        try {
            const existing = this.preparedStatements.getCoins.get(telegramId);
            if (existing) {
                this.preparedStatements.updateCoins.run(coins, totalWords, telegramId);
            } else {
                this.preparedStatements.insertCoins.run(telegramId, coins, totalWords);
            }
            return this.getCoins(telegramId);
        } catch (error) {
            console.error('[CoinsDB] Error setting coins:', error);
            return { coins: 0, total_words: 0 };
        }
    }

    addCoins(telegramId, amount, words = 0) {
        try {
            const existing = this.preparedStatements.getCoins.get(telegramId);
            if (existing) {
                this.preparedStatements.incrementCoins.run(amount, words, telegramId);
            } else {
                this.preparedStatements.insertCoins.run(telegramId, amount, words);
            }
            return this.getCoins(telegramId);
        } catch (error) {
            console.error('[CoinsDB] Error adding coins:', error);
            return { coins: 0, total_words: 0 };
        }
    }

    getLeaderboard(limit = 100) {
        try {
            return this.db.prepare(`
                SELECT u.telegram_id, u.name, u.unique_code, uc.coins, uc.total_words
                FROM users u
                JOIN user_coins uc ON u.telegram_id = uc.telegram_id
                ORDER BY uc.coins DESC
                LIMIT ?
            `).all(limit);
        } catch (error) {
            console.error('[CoinsDB] Error getting leaderboard:', error);
            return [];
        }
    }
}

module.exports = CoinsDB;