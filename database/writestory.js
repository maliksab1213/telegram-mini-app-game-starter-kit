// Write Story Operations Database Module
class WriteStoryDB {
    constructor(db, inventoryDB, selectedDB, coinsDB) {
        this.db = db;
        this.inventoryDB = inventoryDB;
        this.selectedDB = selectedDB;
        this.coinsDB = coinsDB;
    }

    performWrite(telegramId, wordsToWrite) {
        const transaction = this.db.transaction(() => {
            try {
                const selected = this.selectedDB.getSelected(telegramId);
                const inventory = this.inventoryDB.getInventory(telegramId);
                
                if (!selected.book_id || !selected.ink_id) {
                    return { success: false, message: 'Missing supplies' };
                }

                // Find items in inventory
                const book = inventory.slots.find(s => s && s.id === selected.book_id);
                const ink = inventory.slots.find(s => s && s.id === selected.ink_id);
                
                if (!book || !ink) {
                    return { success: false, message: 'Items not found' };
                }

                // Calculate limits
                const bookCapacity = book.capacity || 50;
                const currentBookWords = selected.book_words || 0;
                const currentInkWords = selected.ink_remaining || 0;

                // Calculate actual writable words
                const spaceInBook = bookCapacity - currentBookWords;
                const actualWords = Math.min(wordsToWrite, spaceInBook, currentInkWords);

                if (actualWords <= 0) {
                    return { success: false, message: 'Cannot write more' };
                }

                // Update progress
                const newBookWords = currentBookWords + actualWords;
                const newInkWords = currentInkWords - actualWords;
                
                // Update coins
                this.coinsDB.addCoins(telegramId, actualWords, actualWords);

                // Check completion states
                const bookCompleted = newBookWords >= bookCapacity;
                const inkEmpty = newInkWords <= 0;

                // Update inventory items
                book.currentWords = newBookWords;
                ink.wordsRemaining = newInkWords;
                
                // Auto-cleanup: Remove empty ink
                if (inkEmpty) {
                    const inkIndex = inventory.slots.findIndex(s => s && s.id === selected.ink_id);
                    if (inkIndex !== -1) {
                        inventory.slots[inkIndex] = null;
                    }
                    selected.ink_id = null;
                    selected.ink_remaining = 0;
                }
                
                // If book completed, deselect it
                if (bookCompleted) {
                    selected.book_id = null;
                    selected.book_words = 0;
                } else {
                    selected.book_words = newBookWords;
                }
                
                // If ink still available but not empty
                if (!inkEmpty) {
                    selected.ink_remaining = newInkWords;
                }
                
                // Save updates
                this.inventoryDB.updateInventory(telegramId, inventory);
                this.selectedDB.updateSelected(telegramId, selected);

                const coinData = this.coinsDB.getCoins(telegramId);

                return {
                    success: true,
                    wordsWritten: actualWords,
                    coins: coinData.coins,
                    totalWords: coinData.total_words,
                    bookCompleted,
                    inkEmpty,
                    newBookWords,
                    newInkWords
                };
            } catch (error) {
                console.error('[WriteStoryDB] Error in performWrite:', error);
                return { success: false, message: error.message };
            }
        });

        return transaction();
    }
}

module.exports = WriteStoryDB;