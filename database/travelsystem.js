// ðŸš— COMPLETELY NEW TRAVEL SYSTEM DATABASE MODULE
// Fresh implementation with new naming conventions

class TravelSystemDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            // Get user's travel energy and selected vehicle
            getTravelInfo: this.db.prepare(`
                SELECT travelEnergy, vehicleMap, last_travel_update
                FROM user_travel_system
                WHERE telegram_id = ?
            `),
            
            // Create new user travel record with 0 energy
            createTravelInfo: this.db.prepare(`
                INSERT OR IGNORE INTO user_travel_system 
                (telegram_id, travelEnergy, vehicleMap, last_travel_update)
                VALUES (?, 0, NULL, CURRENT_TIMESTAMP)
            `),
            
            // Update travel energy
            setTravelEnergy: this.db.prepare(`
                UPDATE user_travel_system
                SET travelEnergy = ?, last_travel_update = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            
            // Select vehicle
            setVehicleMap: this.db.prepare(`
                UPDATE user_travel_system
                SET vehicleMap = ?, last_travel_update = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `),
            
            // Deduct energy for travel (atomic operation)
            deductTravelEnergy: this.db.prepare(`
                UPDATE user_travel_system
                SET travelEnergy = travelEnergy - ?, last_travel_update = CURRENT_TIMESTAMP
                WHERE telegram_id = ? AND travelEnergy >= ?
            `)
        };
    }

    // Get user's current travel information
    getTravelInfo(telegramId) {
        try {
            let travelInfo = this.preparedStatements.getTravelInfo.get(telegramId);
            
            if (!travelInfo) {
                // Create if doesn't exist (with 0 energy)
                this.preparedStatements.createTravelInfo.run(telegramId);
                travelInfo = { travelEnergy: 0, vehicleMap: null };
            }
            
            return {
                travelEnergy: parseInt(travelInfo.travelEnergy) || 0,
                vehicleMap: travelInfo.vehicleMap,
                lastUpdate: travelInfo.last_travel_update
            };
        } catch (error) {
            console.error('[TravelSystemDB] ❌ Error getting travel info:', error);
            return { travelEnergy: 0, vehicleMap: null };
        }
    }

    // Set travel energy (used when consuming energy drinks)
    setTravelEnergy(telegramId, newEnergy) {
        try {
            // Ensure energy is between 0 and 100
            const cappedEnergy = Math.max(0, Math.min(100, Math.floor(newEnergy)));
            
            const result = this.preparedStatements.setTravelEnergy.run(cappedEnergy, telegramId);
            
            console.log(`[TravelSystemDB] âœ… Energy set: ${telegramId} -> ${cappedEnergy}% (changes: ${result.changes})`);
            
            if (result.changes === 0) {
                console.warn('[TravelSystemDB] ⚠️ No rows updated - user may not exist');
                return { success: false, message: 'Failed to update energy' };
            }
            
            return { success: true, travelEnergy: cappedEnergy };
        } catch (error) {
            console.error('[TravelSystemDB] ❌ Error setting energy:', error);
            return { success: false, message: error.message };
        }
    }

    // Add energy (from energy drinks)
    addTravelEnergy(telegramId, energyAmount) {
        try {
            const current = this.getTravelInfo(telegramId);
            const newTotal = current.travelEnergy + energyAmount;
            const finalEnergy = Math.min(100, newTotal);
            const wastedEnergy = Math.max(0, newTotal - 100);
            
            const result = this.setTravelEnergy(telegramId, finalEnergy);
            
            if (result.success) {
                console.log(`[TravelSystemDB] ⚡ Added ${energyAmount}% energy (wasted: ${wastedEnergy}%)`);
                return {
                    success: true,
                    travelEnergy: finalEnergy,
                    energyAdded: finalEnergy - current.travelEnergy,
                    energyWasted: wastedEnergy
                };
            } else {
                return result;
            }
        } catch (error) {
            console.error('[TravelSystemDB] ❌ Error adding energy:', error);
            return { success: false, message: error.message };
        }
    }

    // Select/change vehicle
    setVehicleMap(telegramId, vehicleId) {
        try {
            this.preparedStatements.setVehicleMap.run(vehicleId, telegramId);
            console.log(`[TravelSystemDB] ðŸš— Vehicle selected: ${telegramId} -> ${vehicleId || 'Walking'}`);
            return { success: true, vehicleMap: vehicleId };
        } catch (error) {
            console.error('[TravelSystemDB] ❌ Error selecting vehicle:', error);
            return { success: false, message: error.message };
        }
    }

    // ðŸš¨ CRITICAL: Deduct energy for travel (ATOMIC TRANSACTION)
    deductEnergyForTravel(telegramId, energyRequired) {
        try {
            console.log(`[TravelSystemDB] ðŸ"¥ Attempting to deduct ${energyRequired}% energy for ${telegramId}`);
            
            // Get current energy first
            const current = this.getTravelInfo(telegramId);
            console.log(`[TravelSystemDB] 📊 Current energy: ${current.travelEnergy}%`);
            
            // Check if enough energy
            if (current.travelEnergy < energyRequired) {
                console.log(`[TravelSystemDB] ❌ Not enough energy!`);
                return {
                    success: false,
                    message: `Not enough travel energy. Need ${energyRequired}%, have ${current.travelEnergy}%`
                };
            }
            
            // Perform atomic deduction
            const result = this.preparedStatements.deductTravelEnergy.run(
                energyRequired, // Amount to deduct
                telegramId,     // User ID
                energyRequired  // Minimum required (safety check)
            );
            
            console.log(`[TravelSystemDB] 📝 Deduction result: ${result.changes} rows affected`);
            
            if (result.changes === 0) {
                console.log(`[TravelSystemDB] ❌ Deduction failed - concurrent modification or insufficient energy`);
                return {
                    success: false,
                    message: 'Travel energy deduction failed. Please try again.'
                };
            }
            
            // Verify the deduction
            const updated = this.getTravelInfo(telegramId);
            console.log(`[TravelSystemDB] ðŸ" Verified new energy: ${updated.travelEnergy}%`);
            
            console.log(`[TravelSystemDB] âœ… Energy deducted successfully!`);
            return {
                success: true,
                energyDeducted: energyRequired,
                travelEnergyRemaining: updated.travelEnergy
            };
        } catch (error) {
            console.error('[TravelSystemDB] ❌ Error deducting energy:', error);
            return { success: false, message: error.message };
        }
    }

    // Initialize travel system for new user (0 energy)
    initializeForNewUser(telegramId) {
        try {
            this.preparedStatements.createTravelInfo.run(telegramId);
            console.log(`[TravelSystemDB] âœ… Initialized travel system for ${telegramId} with 0% energy`);
        } catch (error) {
            if (!error.message.includes('UNIQUE constraint failed')) {
                console.error('[TravelSystemDB] ❌ Error initializing:', error);
            }
        }
    }

    // Reset energy (admin/testing only)
    resetTravelEnergy(telegramId) {
        try {
            this.setTravelEnergy(telegramId, 0);
            console.log(`[TravelSystemDB] 🔄 Reset energy for ${telegramId} to 0%`);
            return { success: true };
        } catch (error) {
            console.error('[TravelSystemDB] ❌ Error resetting energy:', error);
            return { success: false, message: error.message };
        }
    }
}

module.exports = TravelSystemDB;