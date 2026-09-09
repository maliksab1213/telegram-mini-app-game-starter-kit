// Phone System API - Database Operations (FIXED)
const dbManager = require('./database');

// ==================== PHONE WALLET OPERATIONS ====================

function getWalletData(telegramId) {
    try {
        const wallet = dbManager.getWallet(telegramId);
        
        if (!wallet) {
            return {
                wallet_active: false,
                wallet_balance: 0,
                wallet_level: 1,
                wallet_max_capacity: 10000
            };
        }
        
        // Convert INTEGER to boolean and ensure numbers
        return {
            wallet_active: wallet.wallet_active === 1,
            wallet_balance: parseInt(wallet.wallet_balance) || 0,
            wallet_level: parseInt(wallet.wallet_level) || 1,
            wallet_max_capacity: parseInt(wallet.wallet_max_capacity) || 10000
        };
    } catch (error) {
        console.error('[PHONE_API] Error getting wallet:', error);
        return {
            wallet_active: false,
            wallet_balance: 0,
            wallet_level: 1,
            wallet_max_capacity: 10000
        };
    }
}

function activateWallet(telegramId) {
    try {
        const ACTIVATION_COST = 100;
        const { getUserCoins, updateUserCoins } = require('./apis');
        
        const coinData = getUserCoins(telegramId);
        
        if (coinData.coins < ACTIVATION_COST) {
            return { 
                success: false, 
                message: 'Not enough coins. You need 100 coins to open a wallet.' 
            };
        }
        
        // Deduct coins
        updateUserCoins(telegramId, {
            coins: coinData.coins - ACTIVATION_COST,
            total_words: coinData.total_words
        });
        
        // Activate wallet using dbManager
        const result = dbManager.activateWallet(telegramId);
        
        if (result) {
            console.log(`[PHONE_API] ✅ Wallet activated for ${telegramId}`);
            
            return { 
                success: true, 
                message: 'Wallet activated successfully!',
                newBalance: coinData.coins - ACTIVATION_COST
            };
        } else {
            return { success: false, message: 'Failed to activate wallet' };
        }
    } catch (error) {
        console.error('[PHONE_API] Error activating wallet:', error);
        return { success: false, message: 'Failed to activate wallet' };
    }
}

function depositToWallet(telegramId, amount) {
    try {
        const { getUserCoins, updateUserCoins } = require('./apis');
        
        const coinData = getUserCoins(telegramId);
        const walletData = getWalletData(telegramId);
        
        if (!walletData.wallet_active) {
            return { success: false, message: 'Wallet not active' };
        }
        
        if (coinData.coins < amount) {
            return { success: false, message: 'Not enough coins' };
        }
        
        if (walletData.wallet_balance + amount > walletData.wallet_max_capacity) {
            return { 
                success: false, 
                message: `Wallet capacity exceeded. Max: ${walletData.wallet_max_capacity}` 
            };
        }
        
        // Deduct from coins
        updateUserCoins(telegramId, {
            coins: coinData.coins - amount,
            total_words: coinData.total_words
        });
        
        // Add to wallet using dbManager
        const result = dbManager.depositToWallet(telegramId, amount);
        
        if (result.success) {
            return { 
                success: true, 
                message: `Deposited ${amount} coins to wallet`,
                newCoinBalance: coinData.coins - amount,
                newWalletBalance: walletData.wallet_balance + amount
            };
        } else {
            return result;
        }
    } catch (error) {
        console.error('[PHONE_API] Error depositing:', error);
        return { success: false, message: 'Deposit failed' };
    }
}

function withdrawFromWallet(telegramId, amount) {
    try {
        const WITHDRAWAL_FEE_PERCENT = 1; // 1% fee
        const { getUserCoins, updateUserCoins } = require('./apis');
        
        const walletData = getWalletData(telegramId);
        const coinData = getUserCoins(telegramId);
        
        if (!walletData.wallet_active) {
            return { success: false, message: 'Wallet not active' };
        }
        
        if (walletData.wallet_balance < amount) {
            return { success: false, message: 'Insufficient wallet balance' };
        }
        
        const fee = Math.ceil(amount * WITHDRAWAL_FEE_PERCENT / 100);
        const amountAfterFee = amount - fee;
        
        if (amountAfterFee <= 0) {
            return { success: false, message: 'Amount too small after fee deduction' };
        }
        
        // Withdraw using dbManager
        const result = dbManager.withdrawFromWallet(telegramId, amount);
        
        if (result.success) {
            // Add to coins (minus fee)
            updateUserCoins(telegramId, {
                coins: coinData.coins + amountAfterFee,
                total_words: coinData.total_words
            });
            
            return { 
                success: true, 
                message: `Withdrawn ${amountAfterFee} coins (Fee: ${fee})`,
                fee: fee,
                amountReceived: amountAfterFee,
                newCoinBalance: coinData.coins + amountAfterFee,
                newWalletBalance: walletData.wallet_balance - amount
            };
        } else {
            return result;
        }
    } catch (error) {
        console.error('[PHONE_API] Error withdrawing:', error);
        return { success: false, message: 'Withdrawal failed' };
    }
}

function upgradeWallet(telegramId) {
    try {
        const walletData = getWalletData(telegramId);
        
        if (!walletData.wallet_active) {
            return { success: false, message: 'Wallet not active' };
        }
        
        const UPGRADE_COSTS = {
            1: 500,   // Level 1 -> 2
            2: 1000,  // Level 2 -> 3
            3: 2000,  // Level 3 -> 4
            4: 5000   // Level 4 -> 5
        };
        
        const CAPACITY_LEVELS = {
            1: 10000,
            2: 25000,
            3: 50000,
            4: 100000,
            5: 250000
        };
        
        if (walletData.wallet_level >= 5) {
            return { success: false, message: 'Wallet already at max level' };
        }
        
        const upgradeCost = UPGRADE_COSTS[walletData.wallet_level];
        
        if (walletData.wallet_balance < upgradeCost) {
            return { 
                success: false, 
                message: `Not enough balance. Required: ${upgradeCost}` 
            };
        }
        
        const newLevel = walletData.wallet_level + 1;
        const newCapacity = CAPACITY_LEVELS[newLevel];
        
        // Upgrade using dbManager
        const result = dbManager.upgradeWallet(telegramId, newLevel, newCapacity, upgradeCost);
        
        if (result.success) {
            return { 
                success: true, 
                message: `Wallet upgraded to Level ${newLevel}!`,
                newLevel: newLevel,
                newCapacity: newCapacity,
                newBalance: walletData.wallet_balance - upgradeCost
            };
        } else {
            return result;
        }
    } catch (error) {
        console.error('[PHONE_API] Error upgrading wallet:', error);
        return { success: false, message: 'Upgrade failed' };
    }
}

// ==================== EXPORTS ====================

module.exports = {
    getWalletData,
    activateWallet,
    depositToWallet,
    withdrawFromWallet,
    upgradeWallet
};