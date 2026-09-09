// Friends Management Database Operations
class FriendsDB {
    constructor(db) {
        this.db = db;
        this.createTable();
        this.prepareStatements();
    }

    createTable() {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS user_friends (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    friend_telegram_id INTEGER NOT NULL,
                    friend_name TEXT,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(telegram_id, friend_telegram_id),
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),
                    FOREIGN KEY (friend_telegram_id) REFERENCES users(telegram_id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_friends_user ON user_friends(telegram_id);
                CREATE INDEX IF NOT EXISTS idx_friends_friend ON user_friends(friend_telegram_id);
            `);
            console.log('[FriendsDB] ✅ Table created');
        } catch (error) {
            console.error('[FriendsDB] ❌ Table creation error:', error);
        }
    }

    prepareStatements() {
        this.preparedStatements = {
            addFriend: this.db.prepare(`
                INSERT OR IGNORE INTO user_friends (telegram_id, friend_telegram_id, friend_name)
                VALUES (?, ?, ?)
            `),
            getFriends: this.db.prepare(`
                SELECT uf.friend_telegram_id, uf.friend_name, uf.added_at, u.name as current_name
                FROM user_friends uf
                LEFT JOIN users u ON uf.friend_telegram_id = u.telegram_id
                WHERE uf.telegram_id = ?
                ORDER BY uf.added_at DESC
            `),
            getFriendCount: this.db.prepare(`
                SELECT COUNT(*) as count
                FROM user_friends
                WHERE telegram_id = ?
            `),
            getReferrals: this.db.prepare(`
                SELECT u.telegram_id, u.name, u.created_at
                FROM users u
                WHERE u.referred_by = ?
                ORDER BY u.created_at DESC
            `)
        };
    }

    addFriend(telegramId, friendTelegramId, friendName) {
        try {
            this.preparedStatements.addFriend.run(telegramId, friendTelegramId, friendName);
            console.log(`[FriendsDB] ✅ Friend added: ${friendTelegramId} to ${telegramId}`);
            return true;
        } catch (error) {
            console.error('[FriendsDB] Error adding friend:', error);
            return false;
        }
    }

    getFriends(telegramId) {
        try {
            return this.preparedStatements.getFriends.all(telegramId);
        } catch (error) {
            console.error('[FriendsDB] Error getting friends:', error);
            return [];
        }
    }

    getFriendCount(telegramId) {
        try {
            const result = this.preparedStatements.getFriendCount.get(telegramId);
            return result ? result.count : 0;
        } catch (error) {
            console.error('[FriendsDB] Error getting friend count:', error);
            return 0;
        }
    }

    getReferrals(telegramId) {
        try {
            return this.preparedStatements.getReferrals.all(telegramId);
        } catch (error) {
            console.error('[FriendsDB] Error getting referrals:', error);
            return [];
        }
    }
}

module.exports = FriendsDB;