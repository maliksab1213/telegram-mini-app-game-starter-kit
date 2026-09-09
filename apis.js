// COMPLETELY FIXED API Layer - Smart Database Management
const db = require('./database');
const config = require('./botconfig.json');

// Smart cache with TTL
class SmartCache {
    constructor() {
        this.cache = new Map();
        this.TTL = 5000; // 5 seconds for faster refresh
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.TTL) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    delete(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }
}

const cache = new SmartCache();

// ==================== USER OPERATIONS ====================

function getUserByTelegramId(telegramId) {
    const cacheKey = `user_${telegramId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const user = db.getUser(telegramId);
    if (user) {
        cache.set(cacheKey, user);
    }
    
    return user;
}

function getUserByUniqueCode(uniqueCode) {
    const cacheKey = `user_code_${uniqueCode}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const user = db.getUserByUniqueCode(uniqueCode);
    if (user) {
        cache.set(cacheKey, user);
    }
    
    return user;
}

function saveUser(userData) {
    try {
        const user = db.createUser(
            userData.telegramId,
            userData.uniqueCode,
            userData.name,
            userData.referredBy
        );
        
        // Clear all related caches
        cache.delete(`user_${userData.telegramId}`);
        cache.delete(`user_code_${userData.uniqueCode}`);
        cache.delete(`coins_${userData.telegramId}`);
        cache.delete(`inventory_${userData.telegramId}`);
        cache.delete(`selected_${userData.telegramId}`);
        
        console.log(`[API] ✅ Created new user: ${userData.telegramId}`);
        
        return user;
    } catch (error) {
        console.error('[API] ❌ Error creating user:', error);
        return null;
    }
}

function updateUserName(telegramId, name) {
    const validation = validateUserName(name);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }
    
    const user = db.updateUserName(telegramId, name);
    cache.delete(`user_${telegramId}`);
    
    return { success: true, user };
}

function validateUserName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Name is required' };
    }
    
    if (name.length > (config.game?.max_name_length || 20)) {
        return { valid: false, error: 'Name too long' };
    }
    
    const pattern = new RegExp(config.game?.allowed_name_pattern || '^[a-zA-Z\\s]+$');
    if (!pattern.test(name)) {
        return { valid: false, error: 'Only letters and spaces allowed' };
    }
    
    return { valid: true };
}

// ==================== COINS OPERATIONS ====================

function getUserCoins(telegramId) {
    const cacheKey = `coins_${telegramId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const coins = db.getCoins(telegramId);
    cache.set(cacheKey, coins);
    
    return coins;
}

function updateUserCoins(telegramId, coinData) {
    db.setCoins(telegramId, coinData.coins, coinData.total_words || 0);
    cache.delete(`coins_${telegramId}`);
    
    return getUserCoins(telegramId);
}

function addCoinsToUser(telegramId, amount, words = 0) {
    const result = db.addCoins(telegramId, amount, words);
    cache.delete(`coins_${telegramId}`);
    
    return result;
}

// ==================== INVENTORY OPERATIONS ====================

function getUserInventory(telegramId) {
    const cacheKey = `inventory_${telegramId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const inventory = db.getInventory(telegramId);
    if (inventory) {
        cache.set(cacheKey, inventory);
    }
    
    return inventory;
}

function updateUserInventory(telegramId, inventoryData) {
    const updated = db.updateInventory(telegramId, inventoryData);
    cache.delete(`inventory_${telegramId}`);
    
    return updated;
}

function addToInventory(telegramId, item) {
    const inventory = getUserInventory(telegramId);
    
    if (!inventory) {
        console.error('[API] No inventory found for user:', telegramId);
        return { success: false, message: 'Inventory not found' };
    }
    
    const emptySlotIndex = inventory.slots.findIndex(slot => slot === null);
    
    if (emptySlotIndex === -1) {
        return { success: false, message: 'Inventory is full!' };
    }
    
    const itemToAdd = {
        id: item.id || `${item.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: item.name,
        type: item.type,
        icon: item.icon,
        description: item.description,
        addedAt: new Date().toISOString(),
        ...item
    };
    
    inventory.slots[emptySlotIndex] = itemToAdd;
    const updated = updateUserInventory(telegramId, inventory);
    
    return { success: true, inventory: updated, slot: emptySlotIndex };
}

function removeFromInventory(telegramId, slotIndex) {
    const inventory = getUserInventory(telegramId);
    
    if (!inventory) {
        return { success: false, message: 'Inventory not found' };
    }
    
    if (slotIndex < 0 || slotIndex >= inventory.slots.length || !inventory.slots[slotIndex]) {
        return { success: false, message: 'Invalid slot' };
    }
    
    const removedItem = inventory.slots[slotIndex];
    inventory.slots[slotIndex] = null;
    
    const updated = updateUserInventory(telegramId, inventory);
    
    return { success: true, inventory: updated, removedItem };
}

// ==================== SELECTED ITEMS ====================

function getSelectedItems(telegramId) {
    const cacheKey = `selected_${telegramId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const selected = db.getSelected(telegramId);
    const result = {
        pen: selected.pen_id,
        book: selected.book_id,
        ink: selected.ink_id,
        bookWords: selected.book_words || 0,
        inkRemaining: selected.ink_remaining || 0
    };
    
    cache.set(cacheKey, result);
    return result;
}

function updateSelectedItems(telegramId, selectedData) {
    const dbData = {
        pen_id: selectedData.pen || null,
        book_id: selectedData.book || null,
        ink_id: selectedData.ink || null,
        book_words: selectedData.bookWords || 0,
        ink_remaining: selectedData.inkRemaining || 0
    };
    
    db.updateSelected(telegramId, dbData);
    cache.delete(`selected_${telegramId}`);
    
    console.log(`[API] ✅ Updated selected items for ${telegramId}`);
    
    return getSelectedItems(telegramId);
}

// ==================== SMART WRITE OPERATION ====================

function performWrite(telegramId, wordsToWrite) {
    try {
        const result = db.performWrite(telegramId, wordsToWrite);
        
        // Clear all relevant caches
        cache.delete(`coins_${telegramId}`);
        cache.delete(`inventory_${telegramId}`);
        cache.delete(`selected_${telegramId}`);
        
        console.log(`[API] ✅ Write completed for ${telegramId}:`, result);
        
        return result;
    } catch (error) {
        console.error('[API] ❌ Write error:', error);
        return { success: false, message: error.message };
    }
}

// ==================== STORE OPERATIONS ====================

async function getStore() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
        const storeFile = path.join(__dirname, 'control', 'store.json');
        const data = await fs.readFile(storeFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[API] Error loading store:', error);
        return { categories: {} };
    }
}

async function purchaseItem(telegramId, itemId) {
    try {
        const store = await getStore();
        const coinData = getUserCoins(telegramId);
        
        let item = null;
        let category = null;
        
        // Find item in store
        for (const [catKey, catData] of Object.entries(store.categories)) {
            if (catData.items[itemId]) {
                item = catData.items[itemId];
                category = catKey.slice(0, -1); // Remove 's' from category name
                break;
            }
        }
        
        if (!item) {
            return { success: false, message: 'Item not found' };
        }
        
        if (coinData.coins < item.price) {
            return { success: false, message: 'Not enough coins' };
        }
        
        // Deduct coins
        const newCoins = coinData.coins - item.price;
        updateUserCoins(telegramId, { 
            coins: newCoins, 
            total_words: coinData.total_words 
        });
        
        // Handle different item types
        if (category === 'bagpack') {
            const inventory = getUserInventory(telegramId);
            const newMaxSlots = item.slots || 20;
            
            if (newMaxSlots > inventory.maxSlots) {
                inventory.maxSlots = newMaxSlots;
                inventory.level = inventory.level + 1;
                
                // Add new empty slots
                while (inventory.slots.length < inventory.maxSlots) {
                    inventory.slots.push(null);
                }
                
                updateUserInventory(telegramId, inventory);
                
                return {
                    success: true,
                    message: `Bagpack upgraded to ${newMaxSlots} slots!`,
                    coins: newCoins,
                    inventory: inventory
                };
            } else {
                // Refund coins if no upgrade
                updateUserCoins(telegramId, { 
                    coins: coinData.coins, 
                    total_words: coinData.total_words 
                });
                return { 
                    success: false, 
                    message: 'This bagpack doesn\'t increase your inventory' 
                };
            }
        }
        
        // Create item for inventory
        let itemToAdd = {
            id: `${item.id}_${Date.now()}`,
            name: item.name,
            icon: item.icon,
            type: item.type,
            description: item.description,
            quality: item.quality,
            wordsPerTap: item.wordsPerTap
        };
        
        // Add type-specific properties
        if (item.type === 'book') {
            itemToAdd.capacity = item.capacity || 50;
            itemToAdd.currentWords = 0;
        } else if (item.type === 'ink') {
            itemToAdd.wordCapacity = item.wordCapacity || 30;
            itemToAdd.wordsRemaining = item.wordCapacity || 30;
        }
        
        // Add to inventory
        const inventoryResult = addToInventory(telegramId, itemToAdd);
        
        if (!inventoryResult.success) {
            // Refund coins if inventory full
            updateUserCoins(telegramId, { 
                coins: coinData.coins, 
                total_words: coinData.total_words 
            });
            return inventoryResult;
        }
        
        return { 
            success: true, 
            message: `${item.name} added to inventory!`,
            coins: newCoins,
            inventory: inventoryResult.inventory
        };
        
    } catch (error) {
        console.error('[API] Purchase error:', error);
        return { success: false, message: 'Purchase failed' };
    }
}

// ==================== PUBLIC DATA ====================

function getUserPublicData(telegramId) {
    const user = getUserByTelegramId(telegramId);
    if (!user) return null;
    
    const coinData = getUserCoins(telegramId);
    const inventory = getUserInventory(telegramId);
    const selected = getSelectedItems(telegramId);
    
    return {
        name: user.name,
        newUser: user.new_user === 1,
        uniqueCode: user.unique_code,
        coins: coinData.coins || 0,
        totalWords: coinData.total_words || 0,
        inventory: inventory,
        selected: selected
    };
}

// ==================== LEADERBOARD ====================

function getLeaderboard(limit = 100) {
    return db.getLeaderboard(limit);
}

// ==================== ACCESS CHECK ====================

function checkUserAccess(telegramId, token, botHandler) {
    const user = getUserByTelegramId(telegramId);
    if (!user) return false;
    return botHandler.checkToken(telegramId, token);
}

// ==================== EXPORTS ====================

module.exports = {
    // User operations
    getUserByTelegramId,
    getUserByUniqueCode,
    saveUser,
    updateUserName,
    validateUserName,
    checkUserAccess,
    getUserPublicData,
    
    // Coins operations
    getUserCoins,
    updateUserCoins,
    addCoinsToUser,
    
    // Inventory operations
    getUserInventory,
    updateUserInventory,
    addToInventory,
    removeFromInventory,
    
    // Selected items
    getSelectedItems,
    updateSelectedItems,
    
    // Write operations
    performWrite,
    
    // Store operations
    getStore,
    purchaseItem,
    
    // Leaderboard
    getLeaderboard,
    
    // Cache control
    clearCache: () => cache.clear()
};