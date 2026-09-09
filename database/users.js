// User Management Database Operations
class UsersDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            getUser: this.db.prepare('SELECT * FROM users WHERE telegram_id = ?'),
            getUserByCode: this.db.prepare('SELECT * FROM users WHERE unique_code = ?'),
            insertUser: this.db.prepare(`
                INSERT INTO users (telegram_id, unique_code, name, referred_by, new_user)
                VALUES (?, ?, ?, ?, 1)
            `),
            updateUserName: this.db.prepare(`
                UPDATE users SET name = ?, new_user = 0, last_active = CURRENT_TIMESTAMP 
                WHERE telegram_id = ?
            `)
        };
    }

    getUser(telegramId) {
        try {
            return this.preparedStatements.getUser.get(telegramId);
        } catch (error) {
            console.error('[UsersDB] Error getting user:', error);
            return null;
        }
    }

    getUserByUniqueCode(uniqueCode) {
        try {
            return this.preparedStatements.getUserByCode.get(uniqueCode);
        } catch (error) {
            console.error('[UsersDB] Error getting user by code:', error);
            return null;
        }
    }

    createUser(telegramId, uniqueCode, name = null, referredBy = null) {
        try {
            this.preparedStatements.insertUser.run(telegramId, uniqueCode, name, referredBy);
            console.log(`[UsersDB] ✅ Created user ${telegramId}`);
            return this.getUser(telegramId);
        } catch (error) {
            console.error('[UsersDB] Error creating user:', error);
            throw error;
        }
    }

    updateUserName(telegramId, name) {
        try {
            this.preparedStatements.updateUserName.run(name, telegramId);
            return this.getUser(telegramId);
        } catch (error) {
            console.error('[UsersDB] Error updating name:', error);
            return null;
        }
    }
}

module.exports = UsersDB;