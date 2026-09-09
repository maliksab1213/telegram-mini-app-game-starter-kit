// Wallet Management Database Operations
class WalletDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            getWallet: this.db.prepare(`
                SELECT wallet_active, wallet_balance, wallet_level, wallet_max_capacity
                FROM user_wallet
                WHERE telegram_id = ?
            `),
            createWallet: this.db.prepare(`
                INSERT INTO user_wallet (telegram_id, wallet_active, wallet_balance, wallet_level, wallet_max_capacity)
                VALUES (?, 0, 0, 1, 10000)
            `),
            activateWallet: this.db.prepare(`
                UPDATE user_wallet 
                SET wallet_active = 1, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            updateBalance: this.db.prepare(`
                UPDATE user_wallet 
                SET wallet_balance = ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            depositToWallet: this.db.prepare(`
                UPDATE user_wallet 
                SET wallet_balance = wallet_balance + ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            withdrawFromWallet: this.db.prepare(`
                UPDATE user_wallet 
                SET wallet_balance = wallet_balance - ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            upgradeWallet: this.db.prepare(`
                UPDATE user_wallet 
                SET wallet_level = ?, wallet_max_capacity = ?, wallet_balance = wallet_balance - ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `)
        };
    }

    getWallet(telegramId) {
        try {
            const wallet = this.preparedStatements.getWallet.get(telegramId);
            
            if (!wallet) {
                // Create default wallet if doesn't exist
                this.preparedStatements.createWallet.run(telegramId);
                return {
                    wallet_active: 0,
                    wallet_balance: 0,
                    wallet_level: 1,
                    wallet_max_capacity: 10000
                };
            }
            
            return wallet;
        } catch (error) {
            console.error('[WalletDB] Error getting wallet:', error);
            return {
                wallet_active: 0,
                wallet_balance: 0,
                wallet_level: 1,
                wallet_max_capacity: 10000
            };
        }
    }

    createWallet(telegramId) {
        try {
            this.preparedStatements.createWallet.run(telegramId);
            console.log(`[WalletDB] ✅ Created wallet for ${telegramId}`);
            return this.getWallet(telegramId);
        } catch (error) {
            console.error('[WalletDB] Error creating wallet:', error);
            return null;
        }
    }

    activateWallet(telegramId) {
        try {
            this.preparedStatements.activateWallet.run(telegramId);
            console.log(`[WalletDB] ✅ Activated wallet for ${telegramId}`);
            return this.getWallet(telegramId);
        } catch (error) {
            console.error('[WalletDB] Error activating wallet:', error);
            return null;
        }
    }

    updateBalance(telegramId, newBalance) {
        try {
            this.preparedStatements.updateBalance.run(newBalance, telegramId);
            return this.getWallet(telegramId);
        } catch (error) {
            console.error('[WalletDB] Error updating balance:', error);
            return null;
        }
    }

    deposit(telegramId, amount) {
        try {
            const wallet = this.getWallet(telegramId);
            
            if (!wallet || wallet.wallet_active === 0) {
                return { success: false, message: 'Wallet not active' };
            }
            
            if (wallet.wallet_balance + amount > wallet.wallet_max_capacity) {
                return { 
                    success: false, 
                    message: `Exceeds capacity limit of ${wallet.wallet_max_capacity}` 
                };
            }
            
            this.preparedStatements.depositToWallet.run(amount, telegramId);
            
            return { 
                success: true, 
                newBalance: wallet.wallet_balance + amount 
            };
        } catch (error) {
            console.error('[WalletDB] Error depositing:', error);
            return { success: false, message: 'Deposit failed' };
        }
    }

    withdraw(telegramId, amount) {
        try {
            const wallet = this.getWallet(telegramId);
            
            if (!wallet || wallet.wallet_active === 0) {
                return { success: false, message: 'Wallet not active' };
            }
            
            if (wallet.wallet_balance < amount) {
                return { success: false, message: 'Insufficient wallet balance' };
            }
            
            this.preparedStatements.withdrawFromWallet.run(amount, telegramId);
            
            return { 
                success: true, 
                newBalance: wallet.wallet_balance - amount 
            };
        } catch (error) {
            console.error('[WalletDB] Error withdrawing:', error);
            return { success: false, message: 'Withdrawal failed' };
        }
    }

    upgrade(telegramId, newLevel, newCapacity, cost) {
        try {
            const wallet = this.getWallet(telegramId);
            
            if (!wallet || wallet.wallet_active === 0) {
                return { success: false, message: 'Wallet not active' };
            }
            
            if (wallet.wallet_balance < cost) {
                return { success: false, message: 'Insufficient balance' };
            }
            
            if (wallet.wallet_level >= 5) {
                return { success: false, message: 'Already at max level' };
            }
            
            this.preparedStatements.upgradeWallet.run(
                newLevel, 
                newCapacity, 
                cost, 
                telegramId
            );
            
            console.log(`[WalletDB] ✅ Upgraded wallet for ${telegramId} to Level ${newLevel}`);
            
            return { 
                success: true, 
                newLevel: newLevel,
                newCapacity: newCapacity,
                newBalance: wallet.wallet_balance - cost
            };
        } catch (error) {
            console.error('[WalletDB] Error upgrading:', error);
            return { success: false, message: 'Upgrade failed' };
        }
    }

    isWalletActive(telegramId) {
        try {
            const wallet = this.getWallet(telegramId);
            return wallet && wallet.wallet_active === 1;
        } catch (error) {
            console.error('[WalletDB] Error checking wallet status:', error);
            return false;
        }
    }

    getWalletBalance(telegramId) {
        try {
            const wallet = this.getWallet(telegramId);
            return wallet ? wallet.wallet_balance : 0;
        } catch (error) {
            console.error('[WalletDB] Error getting balance:', error);
            return 0;
        }
    }
}

module.exports = WalletDB;