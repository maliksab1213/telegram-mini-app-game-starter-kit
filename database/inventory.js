// Inventory Management Database Operations - WITH STARTER ENERGY DRINK
class InventoryDB {
    constructor(db) {
        this.db = db;
        this.preparedStatements = {};
        this.prepareStatements();
    }

    prepareStatements() {
        this.preparedStatements = {
            getInventory: this.db.prepare('SELECT * FROM user_inventory WHERE telegram_id = ?'),
            insertInventory: this.db.prepare(`
                INSERT INTO user_inventory (telegram_id, level, max_slots, slots)
                VALUES (?, ?, ?, ?)
            `),
            updateInventory: this.db.prepare(`
                UPDATE user_inventory 
                SET level = ?, max_slots = ?, slots = ?, last_updated = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            `)
        };
    }

    getInventory(telegramId) {
        try {
            const result = this.preparedStatements.getInventory.get(telegramId);
            if (!result) return null;
            
            return {
                level: result.level,
                maxSlots: result.max_slots,
                slots: JSON.parse(result.slots || '[]'),
                lastUpdated: result.last_updated
            };
        } catch (error) {
            console.error('[InventoryDB] Error getting inventory:', error);
            return null;
        }
    }

    updateInventory(telegramId, inventory) {
        try {
            const existing = this.preparedStatements.getInventory.get(telegramId);
            const slotsJson = JSON.stringify(inventory.slots || []);
            
            if (existing) {
                this.preparedStatements.updateInventory.run(
                    inventory.level,
                    inventory.maxSlots,
                    slotsJson,
                    telegramId
                );
            } else {
                this.preparedStatements.insertInventory.run(
                    telegramId,
                    inventory.level,
                    inventory.maxSlots,
                    slotsJson
                );
            }
            
            return this.getInventory(telegramId);
        } catch (error) {
            console.error('[InventoryDB] Error updating inventory:', error);
            return null;
        }
    }

    // ðŸš¨ NEW: Create starter inventory WITH 1 full energy drink
    createStarterInventoryWithEnergyDrink(telegramId) {
        try {
            const starterSlots = [
                // Basic writing tools
                {
                    id: `PEN001_${telegramId}_${Date.now()}`,
                    name: 'Basic Pen',
                    type: 'pen',
                    icon: '✏️',
                    quality: 'basic',
                    wordsPerTap: 1
                },
                {
                    id: `BOOK001_${telegramId}_${Date.now() + 1}`,
                    name: 'Basic Notebook',
                    type: 'book',
                    icon: '📘',
                    capacity: 50,
                    currentWords: 0
                },
                {
                    id: `INK001_${telegramId}_${Date.now() + 2}`,
                    name: 'Basic Black Ink',
                    type: 'ink',
                    icon: '🖤',
                    wordCapacity: 30,
                    wordsRemaining: 30
                },
                // ðŸš¨ NEW: Starter energy drink (100% full restore)
                {
                    id: `STARTERENERGY_${telegramId}_${Date.now() + 3}`,
                    name: 'Starter Energy Bottle',
                    type: 'powerDrink', // NEW TYPE
                    icon: '🐢',
                    description: 'Welcome gift! Restores 100% travel energy.',
                    energyRestore: 100
                },
                // Empty slots
                ...Array(6).fill(null)
            ];
            
            this.preparedStatements.insertInventory.run(
                telegramId,
                1,
                10,
                JSON.stringify(starterSlots)
            );
            
            console.log(`[InventoryDB] âœ… Created starter inventory with energy drink for ${telegramId}`);
        } catch (error) {
            console.error('[InventoryDB] Error creating starter inventory:', error);
            throw error;
        }
    }

    // Keep old method for backward compatibility if needed
    createStarterInventory(telegramId) {
        this.createStarterInventoryWithEnergyDrink(telegramId);
    }
}

module.exports = InventoryDB;