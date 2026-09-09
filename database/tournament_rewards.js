// Tournament Rewards Database Operations
class TournamentRewardsDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            // Get user rewards for a specific date and tournament
            getUserRewards: this.db.prepare(`
                SELECT * FROM user_tournament_rewards
                WHERE telegram_id = ? AND tournament_date = ? AND tournament_type = ?
            `),

            // Create initial rewards entry
            createRewards: this.db.prepare(`
                INSERT INTO user_tournament_rewards 
                (telegram_id, tournament_date, tournament_type, round1_status, round2_status, round3_status)
                VALUES (?, ?, ?, 'pending', 'pending', 'pending')
            `),

            // Get all rewards for user (for history)
            getAllUserRewards: this.db.prepare(`
                SELECT * FROM user_tournament_rewards
                WHERE telegram_id = ?
                ORDER BY tournament_date DESC
                LIMIT 30
            `),

            // Clean old rewards (older than 7 days)
            cleanOldRewards: this.db.prepare(`
                DELETE FROM user_tournament_rewards
                WHERE tournament_date < date('now', '-7 days')
            `)
        };
    }

    getUserTournamentRewards(telegramId, date, tournamentType) {
        try {
            let rewards = this.preparedStatements.getUserRewards.get(
                telegramId, date, tournamentType
            );

            // If no entry exists, create one
            if (!rewards) {
                this.preparedStatements.createRewards.run(
                    telegramId, date, tournamentType
                );
                rewards = this.preparedStatements.getUserRewards.get(
                    telegramId, date, tournamentType
                );
            }

            return rewards;
        } catch (error) {
            console.error('[TournamentRewardsDB] Error getting rewards:', error);
            return null;
        }
    }

    updateRoundRewardStatus(telegramId, date, tournamentType, roundNumber, status) {
        try {
            const query = `
                UPDATE user_tournament_rewards
                SET round${roundNumber}_status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ? AND tournament_date = ? AND tournament_type = ?
            `;
            
            const stmt = this.db.prepare(query);
            stmt.run(status, telegramId, date, tournamentType);
            
            console.log(`[TournamentRewardsDB] Updated round ${roundNumber} status to: ${status}`);
            return true;
        } catch (error) {
            console.error('[TournamentRewardsDB] Error updating status:', error);
            return false;
        }
    }

    collectRoundReward(telegramId, date, tournamentType, roundNumber) {
        try {
            const query = `
                UPDATE user_tournament_rewards
                SET round${roundNumber}_collected = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ? AND tournament_date = ? AND tournament_type = ?
            `;
            
            const stmt = this.db.prepare(query);
            stmt.run(telegramId, date, tournamentType);
            
            console.log(`[TournamentRewardsDB] Collected round ${roundNumber} reward`);
            return true;
        } catch (error) {
            console.error('[TournamentRewardsDB] Error collecting reward:', error);
            return false;
        }
    }

    getAllUserRewardsHistory(telegramId) {
        try {
            return this.preparedStatements.getAllUserRewards.all(telegramId);
        } catch (error) {
            console.error('[TournamentRewardsDB] Error getting history:', error);
            return [];
        }
    }

    cleanOldRewards() {
        try {
            const result = this.preparedStatements.cleanOldRewards.run();
            if (result.changes > 0) {
                console.log(`[TournamentRewardsDB] 🗑️ Cleaned ${result.changes} old reward records`);
            }
            return result.changes;
        } catch (error) {
            console.error('[TournamentRewardsDB] Error cleaning old rewards:', error);
            return 0;
        }
    }
}

module.exports = TournamentRewardsDB;