// Selected Items Management Database Operations
class SelectedDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            getSelected: this.db.prepare('SELECT * FROM user_selected WHERE telegram_id = ?'),
            insertSelected: this.db.prepare(`
                INSERT INTO user_selected (telegram_id, pen_id, book_id, ink_id, book_words, ink_remaining)
                VALUES (?, ?, ?, ?, ?, ?)
            `),
            updateSelected: this.db.prepare(`
                UPDATE user_selected 
                SET pen_id = ?, book_id = ?, ink_id = ?, book_words = ?, ink_remaining = ?, 
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `)
        };
    }

    getSelected(telegramId) {
        try {
            const result = this.preparedStatements.getSelected.get(telegramId);
            if (!result) {
                this.preparedStatements.insertSelected.run(telegramId, null, null, null, 0, 0);
                return {
                    pen_id: null,
                    book_id: null,
                    ink_id: null,
                    book_words: 0,
                    ink_remaining: 0
                };
            }
            return result;
        } catch (error) {
            console.error('[SelectedDB] Error getting selected:', error);
            return {
                pen_id: null,
                book_id: null,
                ink_id: null,
                book_words: 0,
                ink_remaining: 0
            };
        }
    }

    updateSelected(telegramId, selected) {
        try {
            const existing = this.preparedStatements.getSelected.get(telegramId);
            
            if (existing) {
                this.preparedStatements.updateSelected.run(
                    selected.pen_id,
                    selected.book_id,
                    selected.ink_id,
                    selected.book_words || 0,
                    selected.ink_remaining || 0,
                    telegramId
                );
            } else {
                this.preparedStatements.insertSelected.run(
                    telegramId,
                    selected.pen_id,
                    selected.book_id,
                    selected.ink_id,
                    selected.book_words || 0,
                    selected.ink_remaining || 0
                );
            }
            
            console.log(`[SelectedDB] ✅ Updated selected for ${telegramId}`);
        } catch (error) {
            console.error('[SelectedDB] Error updating selected:', error);
        }
    }

    createEmptySelected(telegramId) {
        try {
            this.preparedStatements.insertSelected.run(
                telegramId, null, null, null, 0, 0
            );
            console.log(`[SelectedDB] ✅ Created empty selected for ${telegramId}`);
        } catch (error) {
            console.error('[SelectedDB] Error creating selected:', error);
            throw error;
        }
    }
}

module.exports = SelectedDB;