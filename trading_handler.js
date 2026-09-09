// Trading System API Handler - COMPLETE WITH DAILY PROFIT TRACKING
const fs = require('fs');
const path = require('path');
const dbManager = require('./database');

const TRADING_CONFIG_PATH = path.join(__dirname, 'control', 'trading.json');

// ==================== CONFIG MANAGEMENT ====================

function loadTradingConfig() {
    try {
        if (!fs.existsSync(TRADING_CONFIG_PATH)) {
            console.error('[TradingHandler] Config not found');
            return { tradingApp: false, assets: [] };
        }

        const data = fs.readFileSync(TRADING_CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[TradingHandler] Error loading config:', error);
        return { tradingApp: false, assets: [] };
    }
}

// ==================== WALLET OPERATIONS ====================

function getTradingWallet(telegramId) {
    try {
        const wallet = dbManager.getTradingWallet(telegramId);
        
        // 🔥 Add daily profits to response (safely)
        let dailyProfits = [];
        try {
            if (dbManager.getUserDailyProfits) {
                dailyProfits = dbManager.getUserDailyProfits(telegramId) || [];
            }
        } catch (dailyError) {
            console.log('[TradingHandler] Daily profits not available yet');
        }
        
        return {
            ...wallet,
            dailyProfits: dailyProfits
        };
    } catch (error) {
        console.error('[TradingHandler] Error getting wallet:', error);
        return { balance: 0, dailyProfits: [] };
    }
}

function depositToTradingWallet(telegramId, amount) {
    try {
        const depositAmount = parseInt(amount);
        
        console.log('[TradingHandler] 📥 Deposit request:', {
            telegramId,
            rawAmount: amount,
            parsedAmount: depositAmount
        });
        
        if (isNaN(depositAmount) || depositAmount <= 0) {
            console.error('[TradingHandler] ❌ Invalid deposit amount:', amount);
            return { 
                success: false, 
                message: 'Invalid amount. Please enter a valid number.' 
            };
        }
        
        const { getWalletData } = require('./phone_api');
        
        const onlineWallet = getWalletData(telegramId);
        const FEE_PERCENT = 1;
        const fee = Math.ceil(depositAmount * FEE_PERCENT / 100);
        const totalRequired = depositAmount + fee;

        console.log('[TradingHandler] 💰 Deposit calculation:', {
            depositAmount,
            fee,
            totalRequired,
            onlineWalletBalance: onlineWallet.wallet_balance
        });

        if (!onlineWallet.wallet_active) {
            return { 
                success: false, 
                message: 'Online wallet not activated. Please activate from bank first.' 
            };
        }

        if (onlineWallet.wallet_balance < totalRequired) {
            return { 
                success: false, 
                message: `Not enough balance. Need ${totalRequired} (${depositAmount} + ${fee} fee)` 
            };
        }

        const withdrawResult = dbManager.withdrawFromWallet(telegramId, totalRequired);
        
        if (!withdrawResult.success) {
            return { success: false, message: 'Failed to deduct from online wallet' };
        }

        const result = dbManager.depositToTradingWallet(telegramId, depositAmount);

        if (result.success) {
            dbManager.createTradingTransaction(
                telegramId,
                'deposit',
                depositAmount,
                fee,
                `Deposit to Trading Wallet`
            );

            console.log('[TradingHandler] ✅ Deposit successful:', {
                amount: depositAmount,
                fee,
                newBalance: result.newBalance
            });

            return {
                success: true,
                message: `Deposited ${depositAmount} to trading wallet (Fee: ${fee})`,
                newBalance: result.newBalance,
                fee: fee
            };
        }

        dbManager.depositToWallet(telegramId, totalRequired);
        return { success: false, message: 'Deposit failed' };
    } catch (error) {
        console.error('[TradingHandler] Error depositing:', error);
        return { success: false, message: 'Deposit failed: ' + error.message };
    }
}

function withdrawFromTradingWallet(telegramId, amount) {
    try {
        const withdrawAmount = parseInt(amount);
        
        console.log('[TradingHandler] 📤 Withdraw request:', {
            telegramId,
            rawAmount: amount,
            parsedAmount: withdrawAmount
        });
        
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
            return { 
                success: false, 
                message: 'Invalid amount. Please enter a valid number.' 
            };
        }
        
        const { getWalletData } = require('./phone_api');
        
        const wallet = dbManager.getTradingWallet(telegramId);
        const onlineWallet = getWalletData(telegramId);
        const FEE_PERCENT = 1;
        const fee = Math.ceil(withdrawAmount * FEE_PERCENT / 100);
        const amountAfterFee = withdrawAmount - fee;

        if (!onlineWallet.wallet_active) {
            return { 
                success: false, 
                message: 'Online wallet not activated.' 
            };
        }

        if (wallet.balance < withdrawAmount) {
            return { success: false, message: 'Insufficient balance' };
        }

        if (amountAfterFee <= 0) {
            return { success: false, message: 'Amount too small after fee' };
        }

        const result = dbManager.withdrawFromTradingWallet(telegramId, withdrawAmount);

        if (result.success) {
            dbManager.depositToWallet(telegramId, amountAfterFee);

            dbManager.createTradingTransaction(
                telegramId,
                'withdraw',
                withdrawAmount,
                fee,
                `Withdraw from Trading Wallet`
            );

            return {
                success: true,
                message: `Withdrawn ${amountAfterFee} to online wallet (Fee: ${fee})`,
                newBalance: result.newBalance,
                amountReceived: amountAfterFee,
                fee: fee
            };
        }

        return result;
    } catch (error) {
        console.error('[TradingHandler] Error withdrawing:', error);
        return { success: false, message: 'Withdrawal failed' };
    }
}

// ==================== TRADING OPERATIONS ====================

function buyAsset(telegramId, assetId, investedAmount) {
    try {
        const wallet = dbManager.getTradingWallet(telegramId);
        
        if (wallet.balance < investedAmount) {
            return { 
                success: false, 
                message: 'Insufficient balance. Please deposit first.' 
            };
        }

        const config = loadTradingConfig();
        const asset = config.assets.find(a => a.id === assetId);

        if (!asset) {
            return { success: false, message: 'Asset not found' };
        }

        const entryPrice = parseFloat(asset.currentPosition);
        
        const expireDate = new Date();
        expireDate.setHours(expireDate.getHours() + 24);

        const deductResult = dbManager.withdrawFromTradingWallet(telegramId, investedAmount);
        
        if (!deductResult.success) {
            return { success: false, message: 'Failed to deduct from wallet' };
        }

        const result = dbManager.createTradingPosition(
            telegramId,
            assetId,
            asset.name,
            investedAmount,
            entryPrice,
            expireDate
        );

        if (result.success) {
            console.log(`[TradingHandler] ✅ Position created: ${asset.name} at ${entryPrice} for ${investedAmount} | User: ${telegramId}`);
            
            return {
                success: true,
                message: `Bought ${asset.name} for ${investedAmount} coins`,
                position: result.position
            };
        } else {
            dbManager.depositToTradingWallet(telegramId, investedAmount);
            return result;
        }
    } catch (error) {
        console.error('[TradingHandler] Error buying asset:', error);
        return { success: false, message: 'Failed to buy asset' };
    }
}

function sellPosition(telegramId, positionId) {
    try {
        console.log(`[TradingHandler] 🔍 Selling position ${positionId} for user ${telegramId}`);
        
        const normalizedTelegramId = parseInt(telegramId);
        const normalizedPositionId = parseInt(positionId);
        
        const position = dbManager.getTradingPosition(normalizedPositionId);

        if (!position) {
            console.error('[TradingHandler] ❌ Position not found');
            return { success: false, message: 'Position not found' };
        }

        console.log('[TradingHandler] 📊 Position found:', {
            id: position.id,
            telegram_id: position.telegram_id,
            asset_name: position.asset_name,
            status: position.status
        });

        if (position.telegram_id != normalizedTelegramId) {
            console.error('[TradingHandler] ❌ User mismatch');
            return { success: false, message: 'This position does not belong to you' };
        }

        if (position.status === 'closed') {
            console.error('[TradingHandler] ❌ Position already closed');
            return { success: false, message: 'Position already closed' };
        }

        const config = loadTradingConfig();
        const asset = config.assets.find(a => a.id === position.asset_id);

        if (!asset) {
            console.error('[TradingHandler] ❌ Asset not found');
            return { success: false, message: 'Asset not found' };
        }

        const exitPrice = parseFloat(asset.currentPosition);
        const entryPrice = parseFloat(position.entry_price);
        const investedAmount = parseInt(position.invested_amount);

        console.log('[TradingHandler] 💰 Price calculation:', {
            entryPrice,
            exitPrice,
            investedAmount
        });

        const priceChangePercent = ((exitPrice - entryPrice) / entryPrice) * 100;
        const profitLoss = Math.floor((investedAmount * priceChangePercent) / 100);
        const currentValue = investedAmount + profitLoss;

        console.log('[TradingHandler] 📈 P/L calculation:', {
            priceChangePercent: priceChangePercent.toFixed(2) + '%',
            profitLoss,
            currentValue
        });

        const wallet = dbManager.getTradingWallet(normalizedTelegramId);
        console.log('[TradingHandler] 💳 Current wallet balance:', wallet.balance);

        // 🔥 Close position (this will update wallet and daily profits automatically)
        const closeResult = dbManager.closeTradingPosition(
            normalizedPositionId,
            exitPrice,
            profitLoss
        );

        if (!closeResult.success) {
            console.error('[TradingHandler] ❌ Failed to close position');
            return { success: false, message: 'Failed to close position' };
        }

        console.log('[TradingHandler] ✅ Position closed successfully');

        const newWallet = dbManager.getTradingWallet(normalizedTelegramId);
        console.log('[TradingHandler] 💳 New wallet balance:', newWallet.balance);

        // Save transaction
        dbManager.createTradingTransaction(
            normalizedTelegramId,
            profitLoss >= 0 ? 'profit' : 'loss',
            Math.abs(profitLoss),
            0,
            `Sold ${position.asset_name} | Entry: ${entryPrice} | Exit: ${exitPrice}`
        );

        let message;
        if (profitLoss > 0) {
            message = `✅ Sold with profit of +${profitLoss} coins! (${priceChangePercent.toFixed(2)}%)`;
        } else if (profitLoss < 0) {
            message = `✅ Sold with loss of ${profitLoss} coins. (${priceChangePercent.toFixed(2)}%)`;
        } else {
            message = `✅ Sold at break-even.`;
        }

        console.log(`[TradingHandler] ${message}`);

        // Get daily profits safely
        let dailyProfits = [];
        try {
            if (dbManager.getUserDailyProfits) {
                dailyProfits = dbManager.getUserDailyProfits(normalizedTelegramId) || [];
            }
        } catch (dailyError) {
            console.log('[TradingHandler] Daily profits not available');
        }

        return {
            success: true,
            message: message,
            profitLoss: profitLoss,
            currentValue: currentValue,
            newBalance: newWallet.balance,
            dailyProfits: dailyProfits
        };

    } catch (error) {
        console.error('[TradingHandler] ❌ Error selling position:', error);
        console.error('[TradingHandler] Error stack:', error.stack);
        return { 
            success: false, 
            message: 'Failed to sell position: ' + error.message 
        };
    }
}

function getUserPositions(telegramId) {
    try {
        return dbManager.getUserTradingPositions(telegramId);
    } catch (error) {
        console.error('[TradingHandler] Error getting positions:', error);
        return [];
    }
}

function getTradingTransactions(telegramId) {
    try {
        return dbManager.getTradingTransactions(telegramId);
    } catch (error) {
        console.error('[TradingHandler] Error getting transactions:', error);
        return [];
    }
}

// 🔥 NEW: Get daily profits
function getDailyProfits(telegramId) {
    try {
        // Check if method exists
        if (dbManager.getUserDailyProfits) {
            return dbManager.getUserDailyProfits(telegramId) || [];
        }
        return [];
    } catch (error) {
        console.error('[TradingHandler] Error getting daily profits:', error);
        return [];
    }
}

// ==================== EXPORTS ====================

module.exports = {
    loadTradingConfig,
    getTradingWallet,
    depositToTradingWallet,
    withdrawFromTradingWallet,
    buyAsset,
    sellPosition,
    getUserPositions,
    getTradingTransactions,
    getDailyProfits  // 🔥 NEW export
};