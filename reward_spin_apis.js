// Daily Reward & Spin System APIs - Fixed Sequential Collection
const db = require('./database');

// ==================== DAILY REWARD OPERATIONS ====================

function getDailyRewardData(telegramId) {
    try {
        const data = db.getDailyReward(telegramId);
        
        if (!data) return null;
        
        // Check if we need to reset (more than 1 day gap)
        checkAndResetRewards(telegramId, data);
        
        // Return fresh data after potential reset
        return db.getDailyReward(telegramId);
    } catch (error) {
        console.error('[REWARD_API] Error getting daily reward:', error);
        return null;
    }
}

function checkAndResetRewards(telegramId, data) {
    if (!data.lastCollectDate) return;
    
    const lastDate = new Date(data.lastCollectDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    
    // If more than 1 day gap, reset all rewards
    if (daysDiff > 1) {
        console.log(`[REWARD_API] Resetting rewards for ${telegramId} (${daysDiff} days gap)`);
        db.resetExpiredDailyRewards(telegramId);
    }
    
    // If Day 7 was collected and it's a new day, reset
    if (data.day7 && daysDiff >= 1) {
        console.log(`[REWARD_API] Day 7 completed, resetting for ${telegramId}`);
        db.resetExpiredDailyRewards(telegramId);
    }
}

function collectDailyReward(telegramId, dayIndex) {
    try {
        const rewardData = db.getDailyReward(telegramId);
        
        if (!rewardData) {
            return { success: false, message: 'Reward data not found' };
        }
        
        // Check if this is the next collectible day
        const nextDay = getNextCollectibleDay(rewardData);
        
        if (dayIndex !== nextDay) {
            return { success: false, message: 'You must collect rewards in order' };
        }
        
        // Check if already collected today
        const today = new Date().toISOString().split('T')[0];
        if (rewardData.lastCollectDate === today) {
            return { success: false, message: 'Already collected today. Come back tomorrow!' };
        }
        
        // Collect the reward
        const result = db.collectDailyReward(telegramId, dayIndex);
        
        if (result.success) {
            // Add coins to user
            const { addCoinsToUser } = require('./apis');
            const rewardAmount = getRewardAmount(dayIndex);
            
            addCoinsToUser(telegramId, rewardAmount, 0);
            
            console.log(`[REWARD_API] ✅ Day ${dayIndex + 1} collected: ${rewardAmount} coins`);
        }
        
        return result;
    } catch (error) {
        console.error('[REWARD_API] Error collecting reward:', error);
        return { success: false, message: 'Failed to collect reward' };
    }
}

function getNextCollectibleDay(rewardData) {
    // Check all days in order and return first uncollected
    const days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
    
    for (let i = 0; i < days.length; i++) {
        if (!rewardData[days[i]]) {
            return i;
        }
    }
    
    return -1; // All collected
}

function resetExpiredDailyRewards(telegramId) {
    try {
        const result = db.resetExpiredDailyRewards(telegramId);
        console.log(`[REWARD_API] ✅ Daily rewards reset for ${telegramId}`);
        return result;
    } catch (error) {
        console.error('[REWARD_API] Error resetting rewards:', error);
        return { success: false, message: 'Failed to reset rewards' };
    }
}

function getRewardAmount(dayIndex) {
    const rewards = [100, 150, 200, 250, 300, 350, 500];
    return rewards[dayIndex] || 100;
}

function getDailyRewardSchedule() {
    return [
        { day: 1, coins: 100, icon: '📅' },
        { day: 2, coins: 150, icon: '📅' },
        { day: 3, coins: 200, icon: '📅' },
        { day: 4, coins: 250, icon: '📅' },
        { day: 5, coins: 300, icon: '📅' },
        { day: 6, coins: 350, icon: '📅' },
        { day: 7, coins: 500, icon: '🎁' }
    ];
}

// ==================== DAILY SPIN OPERATIONS ====================

function getDailySpinData(telegramId) {
    try {
        const data = db.getDailySpin(telegramId);
        return data;
    } catch (error) {
        console.error('[SPIN_API] Error getting daily spin:', error);
        return null;
    }
}

function collectFreeSpinTicket(telegramId) {
    try {
        const result = db.collectFreeSpinTicket(telegramId);
        
        if (result.success) {
            console.log(`[SPIN_API] ✅ Free spin ticket collected for ${telegramId}`);
        }
        
        return result;
    } catch (error) {
        console.error('[SPIN_API] Error collecting spin ticket:', error);
        return { success: false, message: 'Failed to collect spin ticket' };
    }
}

function performSpin(telegramId) {
    try {
        const spinData = db.getDailySpin(telegramId);
        
        if (spinData.tickets <= 0) {
            return { success: false, message: 'No spin tickets available' };
        }
        
        // Get random reward
        const rewards = getSpinRewards();
        const selectedReward = rewards[Math.floor(Math.random() * rewards.length)];
        
        // Deduct ticket
        const result = db.performSpin(telegramId, selectedReward);
        
        if (result.success) {
            const { addCoinsToUser } = require('./apis');
            addCoinsToUser(telegramId, selectedReward, 0);
            
            console.log(`[SPIN_API] ✅ Spin performed: Won ${selectedReward} coins`);
        }
        
        return { ...result, wonAmount: selectedReward };
    } catch (error) {
        console.error('[SPIN_API] Error performing spin:', error);
        return { success: false, message: 'Spin failed' };
    }
}

function getSpinRewards() {
    return [100, 200, 400, 700];
}

function getSpinRewardConfig() {
    return {
        rewards: [100, 200, 400, 700],
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3']
    };
}

// ==================== EXPORTS ====================

module.exports = {
    // Daily Reward
    getDailyRewardData,
    collectDailyReward,
    resetExpiredDailyRewards,
    getRewardAmount,
    getDailyRewardSchedule,
    getNextCollectibleDay,
    
    // Daily Spin
    getDailySpinData,
    collectFreeSpinTicket,
    performSpin,
    getSpinRewards,
    getSpinRewardConfig
};