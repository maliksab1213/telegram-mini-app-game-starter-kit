// Daily Spins Management Database Operations
class SpinsDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            getDailySpin: this.db.prepare('SELECT * FROM daily_spins WHERE telegram_id = ?'),
            insertDailySpin: this.db.prepare(`
                INSERT INTO daily_spins (telegram_id, tickets) VALUES (?, 0)
            `),
            updateSpinTickets: this.db.prepare(`
                UPDATE daily_spins 
                SET tickets = tickets - 1, total_spins = total_spins + 1, 
                    last_spin_date = CURRENT_DATE, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            collectFreeTicket: this.db.prepare(`
                UPDATE daily_spins 
                SET tickets = tickets + 3, free_ticket_collected = 1, 
                    last_free_ticket_date = CURRENT_DATE, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            resetFreeTicket: this.db.prepare(`
                UPDATE daily_spins 
                SET free_ticket_collected = 0, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `)
        };
    }

    getDailySpin(telegramId) {
        try {
            let spin = this.preparedStatements.getDailySpin.get(telegramId);
            
            if (!spin) {
                this.preparedStatements.insertDailySpin.run(telegramId);
                spin = this.preparedStatements.getDailySpin.get(telegramId);
            }
            
            // Check if free ticket can be collected again
            const today = new Date().toISOString().split('T')[0];
            const lastFreeDate = spin.last_free_ticket_date;
            
            if (lastFreeDate !== today && spin.free_ticket_collected === 1) {
                this.preparedStatements.resetFreeTicket.run(telegramId);
                spin = this.preparedStatements.getDailySpin.get(telegramId);
            }
            
            return {
                tickets: spin.tickets || 0,
                freeTicketCollected: spin.free_ticket_collected === 1,
                lastFreeTicketDate: spin.last_free_ticket_date,
                totalSpins: spin.total_spins || 0,
                lastSpinDate: spin.last_spin_date
            };
        } catch (error) {
            console.error('[SpinsDB] Error getting daily spin:', error);
            return null;
        }
    }

    collectFreeSpinTicket(telegramId) {
        try {
            const spin = this.preparedStatements.getDailySpin.get(telegramId);
            const today = new Date().toISOString().split('T')[0];
            
            if (spin.free_ticket_collected === 1 && spin.last_free_ticket_date === today) {
                return { success: false, message: 'Already collected today. Come back tomorrow!' };
            }
            
            this.preparedStatements.collectFreeTicket.run(telegramId);
            
            return { success: true, message: 'Collected 3 free spin tickets!' };
        } catch (error) {
            console.error('[SpinsDB] Error collecting free ticket:', error);
            return { success: false, message: 'Failed to collect ticket' };
        }
    }

    performSpin(telegramId, rewardAmount) {
        try {
            const spin = this.preparedStatements.getDailySpin.get(telegramId);
            
            if (spin.tickets <= 0) {
                return { success: false, message: 'No tickets available' };
            }
            
            this.preparedStatements.updateSpinTickets.run(telegramId);
            const updated = this.preparedStatements.getDailySpin.get(telegramId);
            
            return { 
                success: true, 
                ticketsRemaining: updated.tickets,
                totalSpins: updated.total_spins
            };
        } catch (error) {
            console.error('[SpinsDB] Error performing spin:', error);
            return { success: false, message: 'Spin failed' };
        }
    }

    createDailySpin(telegramId) {
        try {
            this.preparedStatements.insertDailySpin.run(telegramId);
            console.log(`[SpinsDB] ✅ Created daily spin for ${telegramId}`);
        } catch (error) {
            console.error('[SpinsDB] Error creating daily spin:', error);
            throw error;
        }
    }
}

module.exports = SpinsDB;