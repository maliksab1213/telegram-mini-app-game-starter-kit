// Casino Database Operations - database/casino.js (UPDATED)
class CasinoDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            // User stats
            getUserStats: this.db.prepare(`
                SELECT * FROM user_casino_stats WHERE telegram_id = ?
            `),
            createUserStats: this.db.prepare(`
                INSERT INTO user_casino_stats (telegram_id, total_bets, total_wins, total_losses)
                VALUES (?, 0, 0, 0)
            `),
            updateStats: this.db.prepare(`
                UPDATE user_casino_stats 
                SET total_bets = total_bets + ?, 
                    total_wins = total_wins + ?,
                    total_losses = total_losses + ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),

            // Bet operations
            saveBet: this.db.prepare(`
                INSERT INTO casino_bets 
                (telegram_id, game_type, round_id, bet_position, bet_amount, result, payout, bet_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `),
            getUserBets: this.db.prepare(`
                SELECT * FROM casino_bets 
                WHERE telegram_id = ? 
                ORDER BY bet_date DESC 
                LIMIT ?
            `),

            // Total bets by game (all time)
            getTotalBetsByGame: this.db.prepare(`
                SELECT 
                    game_type,
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                GROUP BY game_type
            `),

            // Date-wise stats for all games (last 3 days)
            getDateWiseStats: this.db.prepare(`
                SELECT 
                    date(bet_date) as date,
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered
                FROM casino_bets
                WHERE date(bet_date) >= date('now', '-3 days')
                GROUP BY date(bet_date)
                ORDER BY date DESC
            `),

            // Date-wise stats by game (last 3 days)
            getDateWiseStatsByGame: this.db.prepare(`
                SELECT 
                    date(bet_date) as date,
                    game_type,
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE date(bet_date) >= date('now', '-3 days')
                GROUP BY date(bet_date), game_type
                ORDER BY date DESC, game_type
            `),

            // Today's total bets (all games)
            getTodayTotalBets: this.db.prepare(`
                SELECT 
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE date(bet_date) = date('now')
            `),

            // Today's bets by game
            getTodayBetsByGame: this.db.prepare(`
                SELECT 
                    game_type,
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE date(bet_date) = date('now')
                GROUP BY game_type
            `),

            // Tiger vs Dragon today's total
            getTigerVsDragonToday: this.db.prepare(`
                SELECT 
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE game_type = 'tigervsdragon' 
                AND date(bet_date) = date('now')
            `),

            // Roulette today's total
            getRouletteToday: this.db.prepare(`
                SELECT 
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE game_type = 'roulette' 
                AND date(bet_date) = date('now')
            `),

            // Black vs Red today's total
            getBlackVsRedToday: this.db.prepare(`
                SELECT 
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE game_type = 'blackvsred' 
                AND date(bet_date) = date('now')
            `),

            // Banker vs Player today's total
            getBankerVsToday: this.db.prepare(`
                SELECT 
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE game_type = 'bankervs' 
                AND date(bet_date) = date('now')
            `),

            // Tiger vs Dragon date-wise (last 3 days)
            getTigerVsDragonDateWise: this.db.prepare(`
                SELECT 
                    date(bet_date) as date,
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE game_type = 'tigervsdragon'
                AND date(bet_date) >= date('now', '-3 days')
                GROUP BY date(bet_date)
                ORDER BY date DESC
            `),

            // Roulette date-wise (last 3 days)
            getRouletteDateWise: this.db.prepare(`
                SELECT 
                    date(bet_date) as date,
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE game_type = 'roulette'
                AND date(bet_date) >= date('now', '-3 days')
                GROUP BY date(bet_date)
                ORDER BY date DESC
            `),

            // Black vs Red date-wise (last 3 days)
            getBlackVsRedDateWise: this.db.prepare(`
                SELECT 
                    date(bet_date) as date,
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE game_type = 'blackvsred'
                AND date(bet_date) >= date('now', '-3 days')
                GROUP BY date(bet_date)
                ORDER BY date DESC
            `),

            // Banker vs Player date-wise (last 3 days)
            getBankerVsDateWise: this.db.prepare(`
                SELECT 
                    date(bet_date) as date,
                    COUNT(*) as total_bets,
                    SUM(bet_amount) as total_wagered,
                    SUM(CASE WHEN result = 'win' THEN payout ELSE 0 END) as total_won
                FROM casino_bets
                WHERE game_type = 'bankervs'
                AND date(bet_date) >= date('now', '-3 days')
                GROUP BY date(bet_date)
                ORDER BY date DESC
            `),

            // Clean old bets (older than 3 days)
            cleanOldBets: this.db.prepare(`
                DELETE FROM casino_bets 
                WHERE date(bet_date) < date('now', '-3 days')
            `)
        };
    }

    getUserStats(telegramId) {
        try {
            let stats = this.preparedStatements.getUserStats.get(telegramId);
            if (!stats) {
                this.preparedStatements.createUserStats.run(telegramId);
                stats = this.preparedStatements.getUserStats.get(telegramId);
            }
            return stats;
        } catch (error) {
            console.error('[CasinoDB] Error getting user stats:', error);
            return null;
        }
    }

    saveBet(telegramId, gameType, roundId, betPosition, betAmount, result, payout) {
        try {
            this.preparedStatements.saveBet.run(
                telegramId, gameType, roundId, betPosition, betAmount, result, payout
            );
            
            // Update user stats
            const wins = result === 'win' ? 1 : 0;
            const losses = result === 'loss' ? 1 : 0;
            this.preparedStatements.updateStats.run(betAmount, wins, losses, telegramId);
            
            // Auto-cleanup old bets
            this.cleanOldBets();
            
            return true;
        } catch (error) {
            console.error('[CasinoDB] Error saving bet:', error);
            return false;
        }
    }

    getUserBets(telegramId, limit = 50) {
        try {
            return this.preparedStatements.getUserBets.all(telegramId, limit);
        } catch (error) {
            console.error('[CasinoDB] Error getting user bets:', error);
            return [];
        }
    }

    getTotalBetsByGame() {
        try {
            return this.preparedStatements.getTotalBetsByGame.all();
        } catch (error) {
            console.error('[CasinoDB] Error getting total bets:', error);
            return [];
        }
    }

    getDateWiseStats() {
        try {
            return this.preparedStatements.getDateWiseStats.all();
        } catch (error) {
            console.error('[CasinoDB] Error getting date-wise stats:', error);
            return [];
        }
    }

    getDateWiseStatsByGame() {
        try {
            return this.preparedStatements.getDateWiseStatsByGame.all();
        } catch (error) {
            console.error('[CasinoDB] Error getting date-wise stats by game:', error);
            return [];
        }
    }

    getTodayTotalBets() {
        try {
            const result = this.preparedStatements.getTodayTotalBets.get();
            return result || { total_bets: 0, total_wagered: 0, total_won: 0 };
        } catch (error) {
            console.error('[CasinoDB] Error getting today total bets:', error);
            return { total_bets: 0, total_wagered: 0, total_won: 0 };
        }
    }

    getTodayBetsByGame() {
        try {
            return this.preparedStatements.getTodayBetsByGame.all();
        } catch (error) {
            console.error('[CasinoDB] Error getting today bets by game:', error);
            return [];
        }
    }

    getTigerVsDragonToday() {
        try {
            const result = this.preparedStatements.getTigerVsDragonToday.get();
            return result || { total_bets: 0, total_wagered: 0, total_won: 0 };
        } catch (error) {
            console.error('[CasinoDB] Error getting Tiger vs Dragon today:', error);
            return { total_bets: 0, total_wagered: 0, total_won: 0 };
        }
    }

    getRouletteToday() {
        try {
            const result = this.preparedStatements.getRouletteToday.get();
            return result || { total_bets: 0, total_wagered: 0, total_won: 0 };
        } catch (error) {
            console.error('[CasinoDB] Error getting Roulette today:', error);
            return { total_bets: 0, total_wagered: 0, total_won: 0 };
        }
    }

    getBlackVsRedToday() {
        try {
            const result = this.preparedStatements.getBlackVsRedToday.get();
            return result || { total_bets: 0, total_wagered: 0, total_won: 0 };
        } catch (error) {
            console.error('[CasinoDB] Error getting Black vs Red today:', error);
            return { total_bets: 0, total_wagered: 0, total_won: 0 };
        }
    }

    getBankerVsToday() {
        try {
            const result = this.preparedStatements.getBankerVsToday.get();
            return result || { total_bets: 0, total_wagered: 0, total_won: 0 };
        } catch (error) {
            console.error('[CasinoDB] Error getting Banker vs Player today:', error);
            return { total_bets: 0, total_wagered: 0, total_won: 0 };
        }
    }

    getTigerVsDragonDateWise() {
        try {
            return this.preparedStatements.getTigerVsDragonDateWise.all();
        } catch (error) {
            console.error('[CasinoDB] Error getting Tiger vs Dragon date-wise:', error);
            return [];
        }
    }

    getRouletteDateWise() {
        try {
            return this.preparedStatements.getRouletteDateWise.all();
        } catch (error) {
            console.error('[CasinoDB] Error getting Roulette date-wise:', error);
            return [];
        }
    }

    getBlackVsRedDateWise() {
        try {
            return this.preparedStatements.getBlackVsRedDateWise.all();
        } catch (error) {
            console.error('[CasinoDB] Error getting Black vs Red date-wise:', error);
            return [];
        }
    }

    getBankerVsDateWise() {
        try {
            return this.preparedStatements.getBankerVsDateWise.all();
        } catch (error) {
            console.error('[CasinoDB] Error getting Banker vs Player date-wise:', error);
            return [];
        }
    }

    cleanOldBets() {
        try {
            const result = this.preparedStatements.cleanOldBets.run();
            if (result.changes > 0) {
                console.log(`[CasinoDB] 🗑️ Cleaned ${result.changes} old bets (>3 days)`);
            }
            return result.changes;
        } catch (error) {
            console.error('[CasinoDB] Error cleaning old bets:', error);
            return 0;
        }
    }

    getCasinoOverview() {
        try {
            // All time stats by game
            const totalStats = this.getTotalBetsByGame();
            
            // Today's overall stats
            const todayTotal = this.getTodayTotalBets();
            
            // Today's stats by game
            const todayByGame = this.getTodayBetsByGame();
            
            // Date-wise stats (last 3 days) - overall
            const dateWiseStats = this.getDateWiseStats();
            
            // Date-wise stats by game (last 3 days)
            const dateWiseByGame = this.getDateWiseStatsByGame();
            
            // Individual game stats
            const tigerVsDragonToday = this.getTigerVsDragonToday();
            const tigerVsDragonDateWise = this.getTigerVsDragonDateWise();
            
            const rouletteToday = this.getRouletteToday();
            const rouletteDateWise = this.getRouletteDateWise();
            
            const blackVsRedToday = this.getBlackVsRedToday();
            const blackVsRedDateWise = this.getBlackVsRedDateWise();
            
            const bankerVsToday = this.getBankerVsToday();
            const bankerVsDateWise = this.getBankerVsDateWise();
            
            return {
                // All time
                totalStats,
                
                // Today
                todayTotal,
                todayByGame,
                tigerVsDragonToday,
                rouletteToday,
                blackVsRedToday,
                bankerVsToday,
                
                // Date-wise (3 days)
                dateWiseStats,
                dateWiseByGame,
                tigerVsDragonDateWise,
                rouletteDateWise,
                blackVsRedDateWise,
                bankerVsDateWise
            };
        } catch (error) {
            console.error('[CasinoDB] Error getting overview:', error);
            return {
                totalStats: [],
                todayTotal: { total_bets: 0, total_wagered: 0, total_won: 0 },
                todayByGame: [],
                tigerVsDragonToday: { total_bets: 0, total_wagered: 0, total_won: 0 },
                rouletteToday: { total_bets: 0, total_wagered: 0, total_won: 0 },
                blackVsRedToday: { total_bets: 0, total_wagered: 0, total_won: 0 },
                bankerVsToday: { total_bets: 0, total_wagered: 0, total_won: 0 },
                dateWiseStats: [],
                dateWiseByGame: [],
                tigerVsDragonDateWise: [],
                rouletteDateWise: [],
                blackVsRedDateWise: [],
                bankerVsDateWise: []
            };
        }
    }
}

module.exports = CasinoDB;