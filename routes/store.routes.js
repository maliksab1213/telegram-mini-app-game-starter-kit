// ✅ FIXED: Store Routes - NO COINS INCREASE ON PURCHASE
const { 
    checkUserAccess, 
    getUserInventory,
    addToInventory
} = require('../apis');

const {
    getWalletData,
    withdrawFromWallet
} = require('../phone_api');

async function handleStoreRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // GET /api/store - Get store items
    if (pathname === "/api/store" && req.method === "GET") {
        try {
            const { getStore } = require('../apis');
            const store = await getStore();
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(store));
        } catch (error) {
            console.error("Error getting store:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get store" }));
        }
    }

    // ✅ FIXED: POST /api/purchase/wallet - Purchase item ONLY from wallet
    if (pathname === "/api/purchase/wallet" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { itemId, itemPrice, deliveryFee, totalPrice } = JSON.parse(body);
                const dbManager = require('../database');
                const { getStore } = require('../apis');
                
                // Get store data
                const store = await getStore();
                let item = null;
                let category = null;
                
                // Find item in store
                for (const [catKey, catData] of Object.entries(store.categories)) {
                    if (catData.items[itemId]) {
                        item = catData.items[itemId];
                        category = catKey.slice(0, -1);
                        break;
                    }
                }
                
                if (!item) {
                    res.writeHead(404, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: 'Item not found' }));
                }
                
                // Check wallet balance
                const walletData = await getWalletData(uid);
                
                if (!walletData.wallet_active) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false, 
                        message: 'Wallet not activated. Please activate your wallet first.' 
                    }));
                }
                
                if (walletData.wallet_balance < totalPrice) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false, 
                        message: `Insufficient wallet balance. You need ${totalPrice} coins.` 
                    }));
                }
                
                // Handle bagpack purchases
                if (category === 'bagpack') {
                    const inventory = await getUserInventory(uid);
                    const newMaxSlots = item.slots || 20;
                    
                    if (newMaxSlots > inventory.maxSlots) {
                        // ✅ ONLY withdraw from wallet - NO COINS OPERATIONS
                        const withdrawResult = await withdrawFromWallet(uid, totalPrice);
                        
                        if (!withdrawResult.success) {
                            res.writeHead(400, { "Content-Type": "application/json" });
                            return res.end(JSON.stringify(withdrawResult));
                        }
                        
                        // Upgrade inventory
                        inventory.maxSlots = newMaxSlots;
                        inventory.level = inventory.level + 1;
                        
                        while (inventory.slots.length < inventory.maxSlots) {
                            inventory.slots.push(null);
                        }
                        
                        const { updateUserInventory } = require('../apis');
                        await updateUserInventory(uid, inventory);
                        
                        // Create transaction record
                        const transactionId = generateTransactionId();
                        dbManager.createTransaction(uid, transactionId, item.name, totalPrice, deliveryFee);
                        
                        console.log(`[STORE] ✅ Bagpack purchased - Wallet: ${walletData.wallet_balance} → ${withdrawResult.newWalletBalance} (NO COINS CHANGE)`);
                        
                        res.writeHead(200, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({
                            success: true,
                            message: `Bagpack upgraded to ${newMaxSlots} slots!`,
                            walletBalance: withdrawResult.newWalletBalance,
                            inventory: inventory,
                            transactionId
                        }));
                    } else {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ 
                            success: false, 
                            message: 'This bagpack doesn\'t increase your inventory' 
                        }));
                    }
                }
                
                // ✅ FIXED: Create item with CORRECT properties
                let itemToAdd = {
                    id: `${item.id}_${Date.now()}`,
                    name: item.name,
                    icon: item.icon,
                    type: item.type,
                    description: item.description,
                    quality: item.quality
                };
                
                // Add type-specific properties
                if (item.type === 'pen') {
                    itemToAdd.wordsPerTap = item.wordsPerTap || 1;
                } else if (item.type === 'book') {
                    itemToAdd.capacity = item.capacity || 50;
                    itemToAdd.currentWords = 0;
                } else if (item.type === 'ink') {
                    itemToAdd.wordCapacity = item.wordCapacity || 30;
                    itemToAdd.wordsRemaining = item.wordCapacity || 30;
                } else if (item.type === 'powerDrink') {
                    itemToAdd.energyRestore = item.energyRestore || 10;
                } else if (item.type === 'transportVehicle') {
                    itemToAdd.energyConsumption = item.energyConsumption || 100;
                }
                
                // Add to inventory
                const inventoryResult = await addToInventory(uid, itemToAdd);
                
                if (!inventoryResult.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(inventoryResult));
                }
                
                // ✅ CRITICAL FIX: ONLY withdraw from wallet - NO COINS INCREASE
                const withdrawResult = await withdrawFromWallet(uid, totalPrice);
                
                if (!withdrawResult.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(withdrawResult));
                }
                
                // Create transaction record
                const transactionId = generateTransactionId();
                dbManager.createTransaction(uid, transactionId, item.name, totalPrice, deliveryFee);
                
                console.log(`[STORE] ✅ Purchase: ${item.name} | Wallet: ${walletData.wallet_balance} → ${withdrawResult.newWalletBalance} | COINS: NO CHANGE`);
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: `${item.name} purchased successfully!`,
                    walletBalance: withdrawResult.newWalletBalance,
                    inventory: inventoryResult.inventory,
                    transactionId
                }));
                
            } catch (error) {
                console.error("Error purchasing item:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return true;
    }

    return false;
}

function generateTransactionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `TXN${timestamp}${random}`;
}

module.exports = handleStoreRoutes;