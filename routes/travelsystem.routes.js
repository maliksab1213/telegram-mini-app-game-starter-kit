// ðŸš— NEW TRAVEL SYSTEM ROUTES - Complete Rewrite
const { checkUserAccess, getUserInventory, removeFromInventory } = require('../apis');

async function handleTravelSystemRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const dbManager = require('../database');

    // ==================== GET TRAVEL INFO ====================
    // GET /api/travelsystem/info - Get user's travel energy & vehicle
    if (pathname === "/api/travelsystem/info" && req.method === "GET") {
        try {
            const travelInfo = dbManager.getTravelSystemInfo(uid);
            
            console.log(`[TravelRoutes] 📊 Travel info for ${uid}:`, travelInfo);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({
                success: true,
                travelEnergy: travelInfo.travelEnergy,
                vehicleMap: travelInfo.vehicleMap
            }));
        } catch (error) {
            console.error("[TravelRoutes] ❌ Error getting travel info:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get travel info" }));
        }
    }

    // ==================== USE ENERGY DRINK ====================
    // POST /api/travelsystem/use-drink - Use energy drink to restore travel energy
    if (pathname === "/api/travelsystem/use-drink" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { itemId, energyRestore } = JSON.parse(body);
                
                console.log(`[TravelRoutes] ⚡ Using energy drink: ${itemId} (${energyRestore}%)`);
                
                // Get inventory
                const inventory = await getUserInventory(uid);
                if (!inventory) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: 'Inventory not found' }));
                }
                
                // Find item in inventory
                const slotIndex = inventory.slots.findIndex(slot => slot && slot.id === itemId);
                
                if (slotIndex === -1) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: 'Energy drink not found in inventory' }));
                }
                
                const item = inventory.slots[slotIndex];
                
                if (item.type !== 'powerDrink') {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: 'Item is not an energy drink' }));
                }
                
                // Add energy to travel system
                const result = dbManager.addTravelEnergy(uid, energyRestore);
                
                if (result.success) {
                    // Remove item from inventory
                    await removeFromInventory(uid, slotIndex);
                    
                    console.log(`[TravelRoutes] ✅ Energy drink consumed: +${result.energyAdded}% (wasted: ${result.energyWasted}%)`);
                    
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        success: true,
                        travelEnergy: result.travelEnergy,
                        energyAdded: result.energyAdded,
                        energyWasted: result.energyWasted,
                        message: `Travel energy restored! Added ${result.energyAdded}%${result.energyWasted > 0 ? `, wasted ${result.energyWasted}%` : ''}`
                    }));
                } else {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, message: 'Failed to add energy' }));
                }
            } catch (error) {
                console.error("[TravelRoutes] ❌ Error using energy drink:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return true;
    }

    // ==================== SELECT VEHICLE ====================
    // POST /api/travelsystem/select-vehicle - Select vehicle for travel
    if (pathname === "/api/travelsystem/select-vehicle" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { vehicleId } = JSON.parse(body);
                
                console.log(`[TravelRoutes] ðŸš— Selecting vehicle: ${vehicleId || 'Walking'}`);
                
                // If vehicleId is null, user wants to walk (no vehicle)
                if (vehicleId !== null) {
                    // Verify vehicle exists in inventory
                    const inventory = await getUserInventory(uid);
                    if (!inventory) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ success: false, message: 'Inventory not found' }));
                    }
                    
                    const vehicle = inventory.slots.find(slot => slot && slot.id === vehicleId);
                    
                    if (!vehicle) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ success: false, message: 'Vehicle not found in inventory' }));
                    }
                    
                    if (vehicle.type !== 'transportVehicle') {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ success: false, message: 'Item is not a vehicle' }));
                    }
                }
                
                // Select vehicle in database
                const result = dbManager.setVehicleMap(uid, vehicleId);
                
                if (result.success) {
                    console.log(`[TravelRoutes] ✅ Vehicle selected: ${vehicleId || 'Walking'}`);
                    
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        success: true,
                        vehicleMap: vehicleId,
                        message: vehicleId ? 'Vehicle selected successfully' : 'Walking mode selected'
                    }));
                } else {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, message: 'Failed to select vehicle' }));
                }
            } catch (error) {
                console.error("[TravelRoutes] ❌ Error selecting vehicle:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return true;
    }

    return false;
}

module.exports = handleTravelSystemRoutes;