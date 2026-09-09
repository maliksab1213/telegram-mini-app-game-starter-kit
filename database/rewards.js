// Daily Rewards Management Database Operations
class RewardsDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            getDailyReward: this.db.prepare('SELECT * FROM daily_rewards WHERE telegram_id = ?'),
            insertDailyReward: this.db.prepare(`
                INSERT INTO daily_rewards (telegram_id) VALUES (?)
            `),
            resetDailyRewards: this.db.prepare(`
                UPDATE daily_rewards 
                SET day_1_collected = 0, day_2_collected = 0, day_3_collected = 0, 
                    day_4_collected = 0, day_5_collected = 0, day_6_collected = 0, 
                    day_7_collected = 0, streak_active = 0, last_active = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `)
        };
    }

    getDailyReward(telegramId) {
        try {
            let reward = this.preparedStatements.getDailyReward.get(telegramId);
            
            if (!reward) {
                this.preparedStatements.insertDailyReward.run(telegramId);
                reward = this.preparedStatements.getDailyReward.get(telegramId);
            }
            
            // Check if rewards need reset (1+ day gap)
            if (reward.last_collect_date) {
                const lastDate = new Date(reward.last_collect_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                lastDate.setHours(0, 0, 0, 0);
                
                const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff > 1) {
                    this.preparedStatements.resetDailyRewards.run(telegramId);
                    reward = this.preparedStatements.getDailyReward.get(telegramId);
                }
            }
            
            return {
                day1: reward.day_1_collected === 1,
                day2: reward.day_2_collected === 1,
                day3: reward.day_3_collected === 1,
                day4: reward.day_4_collected === 1,
                day5: reward.day_5_collected === 1,
                day6: reward.day_6_collected === 1,
                day7: reward.day_7_collected === 1,
                lastCollectDate: reward.last_collect_date,
                streakActive: reward.streak_active === 1
            };
        } catch (error) {
            console.error('[RewardsDB] Error getting daily reward:', error);
            return null;
        }
    }

    collectDailyReward(telegramId, dayIndex) {
        try {
            const days = ['day_1_collected', 'day_2_collected', 'day_3_collected', 
                         'day_4_collected', 'day_5_collected', 'day_6_collected', 'day_7_collected'];
            const dayColumn = days[dayIndex];
            
            if (!dayColumn) {
                return { success: false, message: 'Invalid day index' };
            }
            
            // Use raw SQL since prepared statement can't have dynamic column names
            this.db.exec(`
                UPDATE daily_rewards 
                SET ${dayColumn} = 1, last_collect_date = DATE('now')
                WHERE telegram_id = ${telegramId}
            `);
            
            return { success: true, message: 'Reward collected' };
        } catch (error) {
            console.error('[RewardsDB] Error collecting reward:', error);
            return { success: false, message: 'Failed to collect reward' };
        }
    }

    resetExpiredDailyRewards(telegramId) {
        try {
            const reward = this.preparedStatements.getDailyReward.get(telegramId);
            
            if (reward && reward.last_collect_date) {
                const lastDate = new Date(reward.last_collect_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                lastDate.setHours(0, 0, 0, 0);
                
                const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff > 1) {
                    this.preparedStatements.resetDailyRewards.run(telegramId);
                    return { success: true, reset: true };
                }
            }
            
            return { success: true, reset: false };
        } catch (error) {
            console.error('[RewardsDB] Error resetting rewards:', error);
            return { success: false, reset: false };
        }
    }

    createDailyReward(telegramId) {
        try {
            this.preparedStatements.insertDailyReward.run(telegramId);
            console.log(`[RewardsDB] ✅ Created daily reward for ${telegramId}`);
        } catch (error) {
            console.error('[RewardsDB] Error creating daily reward:', error);
            throw error;
        }
    }
}

module.exports = RewardsDB;