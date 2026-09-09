// Trading System Database Operations - ADVANCED WITH PROFIT TRACKING
class TradingDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.createTables();
        this.prepareStatements();
    }

    createTables() {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS user_trading_wallet (
                    telegram_id INTEGER PRIMARY KEY,
                    balance INTEGER DEFAULT 0,
                    total_invested INTEGER DEFAULT 0,
                    total_profit INTEGER DEFAULT 0,
                    total_loss INTEGER DEFAULT 0,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_trading_wallet ON user_trading_wallet(telegram_id);

                CREATE TABLE IF NOT EXISTS user_trading_positions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    asset_id TEXT NOT NULL,
                    asset_name TEXT NOT NULL,
                    invested_amount INTEGER NOT NULL,
                    entry_price REAL NOT NULL,
                    exit_price REAL DEFAULT 0,
                    profit_loss INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'active',
                    buy_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expire_date DATETIME NOT NULL,
                    sell_date DATETIME,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_trading_positions_user ON user_trading_positions(telegram_id);
                CREATE INDEX IF NOT EXISTS idx_trading_positions_status ON user_trading_positions(status);
                CREATE INDEX IF NOT EXISTS idx_trading_positions_asset ON user_trading_positions(asset_id);

                CREATE TABLE IF NOT EXISTS trading_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    transaction_type TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    fee INTEGER DEFAULT 0,
                    description TEXT,
                    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_trading_transactions_user ON trading_transactions(telegram_id);
                CREATE INDEX IF NOT EXISTS idx_trading_transactions_date ON trading_transactions(transaction_date DESC);

                -- 🔥 NEW: Daily Profit Tracking Table
                CREATE TABLE IF NOT EXISTS trading_daily_profits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    profit_date DATE NOT NULL,
                    total_profit INTEGER DEFAULT 0,
                    trades_count INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(telegram_id, profit_date),
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_daily_profits_user ON trading_daily_profits(telegram_id);
                CREATE INDEX IF NOT EXISTS idx_daily_profits_date ON trading_daily_profits(profit_date DESC);
            `);

            console.log('[TradingDB] ✅ Tables created');
        } catch (error) {
            console.error('[TradingDB] Error creating tables:', error);
        }
    }

    prepareStatements() {
        this.preparedStatements = {
            getWallet: this.db.prepare(`
                SELECT * FROM user_trading_wallet WHERE telegram_id = ?
            `),
            createWallet: this.db.prepare(`
                INSERT INTO user_trading_wallet (telegram_id, balance) VALUES (?, 0)
            `),
            updateBalance: this.db.prepare(`
                UPDATE user_trading_wallet 
                SET balance = ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            depositToWallet: this.db.prepare(`
                UPDATE user_trading_wallet 
                SET balance = balance + ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            withdrawFromWallet: this.db.prepare(`
                UPDATE user_trading_wallet 
                SET balance = balance - ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            updateTotalProfit: this.db.prepare(`
                UPDATE user_trading_wallet 
                SET total_profit = total_profit + ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            updateTotalLoss: this.db.prepare(`
                UPDATE user_trading_wallet 
                SET total_loss = total_loss + ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            createPosition: this.db.prepare(`
                INSERT INTO user_trading_positions (
                    telegram_id, asset_id, asset_name, invested_amount, 
                    entry_price, expire_date
                ) VALUES (?, ?, ?, ?, ?, ?)
            `),
            getPosition: this.db.prepare(`
                SELECT * FROM user_trading_positions WHERE id = ?
            `),
            getUserPositions: this.db.prepare(`
                SELECT * FROM user_trading_positions 
                WHERE telegram_id = ? 
                ORDER BY buy_date DESC
                LIMIT 50
            `),
            getActivePositions: this.db.prepare(`
                SELECT * FROM user_trading_positions 
                WHERE asset_id = ? AND status = 'active'
            `),
            getAllActivePositions: this.db.prepare(`
                SELECT * FROM user_trading_positions 
                WHERE status = 'active'
            `),
            closePosition: this.db.prepare(`
                UPDATE user_trading_positions 
                SET status = 'closed', exit_price = ?, profit_loss = ?, 
                    sell_date = CURRENT_TIMESTAMP
                WHERE id = ?
            `),
            createTransaction: this.db.prepare(`
                INSERT INTO trading_transactions (
                    telegram_id, transaction_type, amount, fee, description
                ) VALUES (?, ?, ?, ?, ?)
            `),
            getTransactions: this.db.prepare(`
                SELECT * FROM trading_transactions 
                WHERE telegram_id = ? 
                ORDER BY transaction_date DESC 
                LIMIT 20
            `),
            // 🔥 NEW: Daily Profit Statements
            getDailyProfit: this.db.prepare(`
                SELECT * FROM trading_daily_profits 
                WHERE telegram_id = ? AND profit_date = ?
            `),
            createDailyProfit: this.db.prepare(`
                INSERT INTO trading_daily_profits (telegram_id, profit_date, total_profit, trades_count)
                VALUES (?, ?, ?, 1)
            `),
            updateDailyProfit: this.db.prepare(`
                UPDATE trading_daily_profits 
                SET total_profit = total_profit + ?, 
                    trades_count = trades_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ? AND profit_date = ?
            `),
            getUserDailyProfits: this.db.prepare(`
                SELECT * FROM trading_daily_profits 
                WHERE telegram_id = ? 
                ORDER BY profit_date DESC 
                LIMIT 7
            `),
            deleteOldDailyProfits: this.db.prepare(`
                DELETE FROM trading_daily_profits 
                WHERE profit_date < date('now', '-3 days')
            `)
        };
    }

    // ==================== WALLET OPERATIONS ====================

    getTradingWallet(telegramId) {
        try {
            let wallet = this.preparedStatements.getWallet.get(telegramId);
            
            if (!wallet) {
                this.preparedStatements.createWallet.run(telegramId);
                wallet = this.preparedStatements.getWallet.get(telegramId);
            }
            
            return wallet;
        } catch (error) {
            console.error('[TradingDB] Error getting wallet:', error);
            return { balance: 0 };
        }
    }

    depositToTradingWallet(telegramId, amount) {
        try {
            const wallet = this.getTradingWallet(telegramId);
            this.preparedStatements.depositToWallet.run(amount, telegramId);
            
            return { 
                success: true, 
                newBalance: wallet.balance + amount 
            };
        } catch (error) {
            console.error('[TradingDB] Error depositing:', error);
            return { success: false, message: 'Deposit failed' };
        }
    }

    withdrawFromTradingWallet(telegramId, amount) {
        try {
            const wallet = this.getTradingWallet(telegramId);
            
            if (wallet.balance < amount) {
                return { success: false, message: 'Insufficient balance' };
            }
            
            this.preparedStatements.withdrawFromWallet.run(amount, telegramId);
            
            return { 
                success: true, 
                newBalance: wallet.balance - amount 
            };
        } catch (error) {
            console.error('[TradingDB] Error withdrawing:', error);
            return { success: false, message: 'Withdrawal failed' };
        }
    }

    // ==================== POSITION OPERATIONS ====================

    createTradingPosition(telegramId, assetId, assetName, investedAmount, entryPrice, expireDate) {
        try {
            const result = this.preparedStatements.createPosition.run(
                telegramId,
                assetId,
                assetName,
                investedAmount,
                entryPrice,
                expireDate.toISOString()
            );

            const position = this.preparedStatements.getPosition.get(result.lastInsertRowid);

            console.log(`[TradingDB] ✅ Position created: ${assetName} for ${telegramId}`);
            
            return { success: true, position };
        } catch (error) {
            console.error('[TradingDB] Error creating position:', error);
            return { success: false, message: 'Failed to create position' };
        }
    }

    getTradingPosition(positionId) {
        try {
            return this.preparedStatements.getPosition.get(positionId);
        } catch (error) {
            console.error('[TradingDB] Error getting position:', error);
            return null;
        }
    }

    getUserTradingPositions(telegramId) {
        try {
            return this.preparedStatements.getUserPositions.all(telegramId);
        } catch (error) {
            console.error('[TradingDB] Error getting user positions:', error);
            return [];
        }
    }

    getAllActiveTradingPositions(assetId) {
        try {
            if (assetId) {
                return this.preparedStatements.getActivePositions.all(assetId);
            } else {
                return this.preparedStatements.getAllActivePositions.all();
            }
        } catch (error) {
            console.error('[TradingDB] Error getting active positions:', error);
            return [];
        }
    }

    closeTradingPosition(positionId, exitPrice, profitLoss) {
        try {
            console.log(`[TradingDB] 🔍 Closing position ${positionId}`);
            
            const position = this.getTradingPosition(positionId);
            
            if (!position) {
                console.error('[TradingDB] ❌ Position not found');
                return { success: false, message: 'Position not found' };
            }

            const investedAmount = parseInt(position.invested_amount);
            const finalAmount = investedAmount + profitLoss;

            // Update position status
            this.preparedStatements.closePosition.run(exitPrice, profitLoss, positionId);

            // Add final amount back to wallet
            this.preparedStatements.depositToWallet.run(finalAmount, position.telegram_id);

            // 🔥 NEW: Update total profit/loss in wallet
            if (profitLoss > 0) {
                this.preparedStatements.updateTotalProfit.run(profitLoss, position.telegram_id);
            } else if (profitLoss < 0) {
                this.preparedStatements.updateTotalLoss.run(Math.abs(profitLoss), position.telegram_id);
            }

            // 🔥 NEW: Update daily profit (ONLY if profit > 0)
            if (profitLoss > 0) {
                this.updateDailyProfit(position.telegram_id, profitLoss);
            }

            const newWallet = this.getTradingWallet(position.telegram_id);

            console.log(`[TradingDB] ✅ Position ${positionId} closed successfully`);

            return { 
                success: true,
                finalAmount: finalAmount,
                newBalance: newWallet.balance
            };
        } catch (error) {
            console.error('[TradingDB] ❌ Error closing position:', error);
            return { success: false, message: 'Failed to close position: ' + error.message };
        }
    }

    // ==================== DAILY PROFIT TRACKING ====================

    updateDailyProfit(telegramId, profitAmount) {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            
            const existing = this.preparedStatements.getDailyProfit.get(telegramId, today);
            
            if (existing) {
                // Update existing record
                this.preparedStatements.updateDailyProfit.run(profitAmount, telegramId, today);
                console.log(`[TradingDB] 📈 Updated daily profit: +${profitAmount} for ${today}`);
            } else {
                // Create new record
                this.preparedStatements.createDailyProfit.run(telegramId, today, profitAmount);
                console.log(`[TradingDB] 📈 Created daily profit: ${profitAmount} for ${today}`);
            }
        } catch (error) {
            console.error('[TradingDB] Error updating daily profit:', error);
        }
    }

    getUserDailyProfits(telegramId) {
        try {
            return this.preparedStatements.getUserDailyProfits.all(telegramId);
        } catch (error) {
            console.error('[TradingDB] Error getting daily profits:', error);
            return [];
        }
    }

    // ==================== DAILY PROFIT TRACKING ====================

    updateDailyProfit(telegramId, profitAmount) {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            
            const existing = this.preparedStatements.getDailyProfit.get(telegramId, today);
            
            if (existing) {
                // Update existing record
                this.preparedStatements.updateDailyProfit.run(profitAmount, telegramId, today);
                console.log(`[TradingDB] 📈 Updated daily profit: +${profitAmount} for ${today}`);
            } else {
                // Create new record
                this.preparedStatements.createDailyProfit.run(telegramId, today, profitAmount);
                console.log(`[TradingDB] 📈 Created daily profit: ${profitAmount} for ${today}`);
            }
        } catch (error) {
            console.error('[TradingDB] Error updating daily profit:', error);
        }
    }

    getUserDailyProfits(telegramId) {
        try {
            return this.preparedStatements.getUserDailyProfits.all(telegramId);
        } catch (error) {
            console.error('[TradingDB] Error getting daily profits:', error);
            return [];
        }
    }

    // ==================== TRANSACTION OPERATIONS ====================

    createTradingTransaction(telegramId, type, amount, fee, description) {
        try {
            this.preparedStatements.createTransaction.run(
                telegramId,
                type,
                amount,
                fee,
                description
            );

            return { success: true };
        } catch (error) {
            console.error('[TradingDB] Error creating transaction:', error);
            return { success: false };
        }
    }

    getTradingTransactions(telegramId) {
        try {
            return this.preparedStatements.getTransactions.all(telegramId);
        } catch (error) {
            console.error('[TradingDB] Error getting transactions:', error);
            return [];
        }
    }

    // ==================== CLEANUP ====================

    cleanOldPositions() {
        try {
            const query = `
                DELETE FROM user_trading_positions
                WHERE status = 'closed' 
                AND sell_date < datetime('now', '-30 days')
            `;
            
            this.db.prepare(query).run();
            console.log('[TradingDB] 🗑️ Cleaned old positions');
        } catch (error) {
            console.error('[TradingDB] Error cleaning positions:', error);
        }
    }

    cleanOldTransactions() {
        try {
            const query = `
                DELETE FROM trading_transactions
                WHERE transaction_date < datetime('now', '-90 days')
            `;
            
            this.db.prepare(query).run();
            console.log('[TradingDB] 🗑️ Cleaned old transactions');
        } catch (error) {
            console.error('[TradingDB] Error cleaning transactions:', error);
        }
    }

    cleanOldDailyProfits() {
        try {
            this.preparedStatements.deleteOldDailyProfits.run();
            console.log('[TradingDB] 🗑️ Cleaned old daily profits (>3 days)');
        } catch (error) {
            console.error('[TradingDB] Error cleaning daily profits:', error);
        }
    }
}

module.exports = TradingDB;