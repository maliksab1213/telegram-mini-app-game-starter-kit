// Transaction History Database Operations
class TransactionsDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            createTransaction: this.db.prepare(`
                INSERT INTO transactions (
                    telegram_id, 
                    transaction_id, 
                    item_name, 
                    amount, 
                    delivery_fee,
                    total_amount,
                    transaction_date
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `),
            getTransactions: this.db.prepare(`
                SELECT * FROM transactions
                WHERE telegram_id = ?
                ORDER BY transaction_date DESC
                LIMIT 20
            `),
            getAllTransactions: this.db.prepare(`
                SELECT * FROM transactions
                WHERE telegram_id = ?
                ORDER BY transaction_date DESC
            `),
            getTransactionCount: this.db.prepare(`
                SELECT COUNT(*) as count FROM transactions
                WHERE telegram_id = ?
            `)
        };
    }

    createTransaction(telegramId, transactionId, itemName, amount, deliveryFee) {
        try {
            const totalAmount = amount + deliveryFee;
            
            this.preparedStatements.createTransaction.run(
                telegramId,
                transactionId,
                itemName,
                amount,
                deliveryFee,
                totalAmount
            );
            
            console.log(`[TransactionsDB] ✅ Transaction created: ${transactionId}`);
            
            // Clean up old transactions if more than 20
            this.cleanupOldTransactions(telegramId);
            
            return { success: true, transactionId };
        } catch (error) {
            console.error('[TransactionsDB] Error creating transaction:', error);
            return { success: false, error: error.message };
        }
    }

    getTransactions(telegramId) {
        try {
            const transactions = this.preparedStatements.getTransactions.all(telegramId);
            return transactions || [];
        } catch (error) {
            console.error('[TransactionsDB] Error getting transactions:', error);
            return [];
        }
    }

    cleanupOldTransactions(telegramId) {
        try {
            const count = this.preparedStatements.getTransactionCount.get(telegramId);
            
            if (count.count > 20) {
                // Delete oldest transactions beyond 20
                this.db.prepare(`
                    DELETE FROM transactions
                    WHERE telegram_id = ?
                    AND transaction_id NOT IN (
                        SELECT transaction_id FROM transactions
                        WHERE telegram_id = ?
                        ORDER BY transaction_date DESC
                        LIMIT 20
                    )
                `).run(telegramId, telegramId);
                
                console.log(`[TransactionsDB] 🗑️ Cleaned up old transactions for ${telegramId}`);
            }
        } catch (error) {
            console.error('[TransactionsDB] Error cleaning up transactions:', error);
        }
    }

    getTransactionById(transactionId) {
        try {
            return this.db.prepare(`
                SELECT * FROM transactions
                WHERE transaction_id = ?
            `).get(transactionId);
        } catch (error) {
            console.error('[TransactionsDB] Error getting transaction:', error);
            return null;
        }
    }
}

module.exports = TransactionsDB;