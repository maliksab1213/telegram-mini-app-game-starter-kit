// Tournament Database Operations with Ticket System
class TournamentDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            saveSelection: this.db.prepare(`
                INSERT OR REPLACE INTO user_tournament_selections 
                (telegram_id, tournament_date, tournament_type, round_number, selected_option, result, created_at)
                VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
            `),

            getSelection: this.db.prepare(`
                SELECT * FROM user_tournament_selections
                WHERE telegram_id = ? AND tournament_date = ? AND tournament_type = ? AND round_number = ?
            `),

            getUserSelections: this.db.prepare(`
                SELECT * FROM user_tournament_selections
                WHERE telegram_id = ? AND tournament_date = ?
                ORDER BY round_number
            `),

            updateResult: this.db.prepare(`
                UPDATE user_tournament_selections
                SET result = ?, updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ? AND tournament_date = ? AND tournament_type = ? AND round_number = ?
            `),

            getAllUsersForRound: this.db.prepare(`
                SELECT * FROM user_tournament_selections
                WHERE tournament_date = ? AND tournament_type = ? AND round_number = ?
            `),

            cleanOldData: this.db.prepare(`
                DELETE FROM user_tournament_selections
                WHERE tournament_date < date('now', '-3 days')
            `),

            getUserStats: this.db.prepare(`
                SELECT 
                    COUNT(*) as total_plays,
                    SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN result = 'lose' THEN 1 ELSE 0 END) as losses
                FROM user_tournament_selections
                WHERE telegram_id = ?
            `),

            // Ticket System
            saveTicket: this.db.prepare(`
                INSERT OR REPLACE INTO user_tournament_tickets 
                (telegram_id, tournament_date, has_ticket, created_at)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP)
            `),

            getTicket: this.db.prepare(`
                SELECT * FROM user_tournament_tickets
                WHERE telegram_id = ? AND tournament_date = ?
            `),

            cleanOldTickets: this.db.prepare(`
                DELETE FROM user_tournament_tickets
                WHERE tournament_date < date('now', '-3 days')
            `)
        };
    }

    saveTournamentSelection(telegramId, date, tournamentType, roundNumber, selection) {
        try {
            this.preparedStatements.saveSelection.run(
                telegramId, 
                date, 
                tournamentType, 
                roundNumber, 
                selection
            );
            return true;
        } catch (error) {
            console.error('[TournamentDB] Error saving selection:', error);
            return false;
        }
    }

    getTournamentSelection(telegramId, date, tournamentType, roundNumber) {
        try {
            return this.preparedStatements.getSelection.get(
                telegramId, 
                date, 
                tournamentType, 
                roundNumber
            );
        } catch (error) {
            console.error('[TournamentDB] Error getting selection:', error);
            return null;
        }
    }

    getUserTournamentSelections(telegramId, date) {
        try {
            return this.preparedStatements.getUserSelections.all(telegramId, date);
        } catch (error) {
            console.error('[TournamentDB] Error getting user selections:', error);
            return [];
        }
    }

    updateTournamentUserResult(telegramId, date, tournamentType, roundNumber, isWinner) {
        try {
            const result = isWinner ? 'win' : 'lose';
            this.preparedStatements.updateResult.run(
                result,
                telegramId,
                date,
                tournamentType,
                roundNumber
            );
            return true;
        } catch (error) {
            console.error('[TournamentDB] Error updating result:', error);
            return false;
        }
    }

    getAllTournamentUsers(date, tournamentType, roundNumber) {
        try {
            return this.preparedStatements.getAllUsersForRound.all(
                date,
                tournamentType,
                roundNumber
            );
        } catch (error) {
            console.error('[TournamentDB] Error getting all users:', error);
            return [];
        }
    }

    cleanOldTournamentData() {
        try {
            const result = this.preparedStatements.cleanOldData.run();
            if (result.changes > 0) {
                console.log(`[TournamentDB] Cleaned ${result.changes} old records`);
            }
            return result.changes;
        } catch (error) {
            console.error('[TournamentDB] Error cleaning old data:', error);
            return 0;
        }
    }

    getUserTournamentStats(telegramId) {
        try {
            const stats = this.preparedStatements.getUserStats.get(telegramId);
            return stats || { total_plays: 0, wins: 0, losses: 0 };
        } catch (error) {
            console.error('[TournamentDB] Error getting stats:', error);
            return { total_plays: 0, wins: 0, losses: 0 };
        }
    }

    // Ticket System Methods
    saveTournamentTicket(telegramId, date) {
        try {
            this.preparedStatements.saveTicket.run(telegramId, date);
            return true;
        } catch (error) {
            console.error('[TournamentDB] Error saving ticket:', error);
            return false;
        }
    }

    getUserTicket(telegramId, date) {
        try {
            const ticket = this.preparedStatements.getTicket.get(telegramId, date);
            return ticket ? ticket.has_ticket === 1 : false;
        } catch (error) {
            console.error('[TournamentDB] Error getting ticket:', error);
            return false;
        }
    }

    cleanOldTickets() {
        try {
            const result = this.preparedStatements.cleanOldTickets.run();
            if (result.changes > 0) {
                console.log(`[TournamentDB] Cleaned ${result.changes} old tickets`);
            }
            return result.changes;
        } catch (error) {
            console.error('[TournamentDB] Error cleaning old tickets:', error);
            return 0;
        }
    }
}

module.exports = TournamentDB;