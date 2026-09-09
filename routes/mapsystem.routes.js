// ðŸ—ºï¸ NEW MAP SYSTEM ROUTES - Complete Rewrite
const { checkUserAccess, getUserInventory } = require('../apis');
const crypto = require('crypto');
const config = require('../botconfig.json');

// Available locations configuration
// Available locations configuration
const CITY_LOCATIONS = {
    cityBank: {
        id: 'cityBank',
        name: 'City Bank',
        icon: '🏦',
        description: 'Open wallet account and manage your finances',
        path: '/locations/bank',
        htmlFile: 'bank.html'
    },
    casino: {
        id: 'casino',
        name: 'Casino',
        icon: '🎰',
        description: 'Try your luck at casino games and win big!',
        path: '/locations/casino',
        htmlFile: 'index.html'
    },
    stadium: {
        id: 'stadium',
        name: 'Horse Racing Stadium',
        icon: '🏇',
        description: 'Bet on thrilling horse races and win rewards!',
        path: '/locations/stadium',
        htmlFile: 'index.html'
    },
    boxing: {
        id: 'boxing',
        name: 'Boxing Arena',
        icon: '🥊',
        description: 'Watch intense boxing matches and predict winners!',
        path: '/locations/boxing',
        htmlFile: 'index.html'
    },
    carrace: {
        id: 'carrace',
        name: 'Racing Track',
        icon: '🏎️',
        description: 'Experience high-speed car racing tournaments!',
        path: '/locations/carrace',
        htmlFile: 'index.html'
    },
        games: {
        id: 'games',
        name: 'Games Zone',
        icon: '🎮',
        description: 'Playe Multiple Games And Complete Tasks!',
        path: '/locations/games',
        htmlFile: 'index.html'
    }
    // Add more locations here in future
};

// Generate location access token
function generateLocationAccessToken(uid, locationId) {
    const timestamp = Date.now();
    const data = `${uid}:${locationId}:${timestamp}`;
    return crypto.createHmac("sha256", config.server.secret_key)
        .update(data)
        .digest("hex");
}

async function handleMapSystemRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const dbManager = require('../database');

    // ==================== GET ALL LOCATIONS ====================
    // GET /api/mapsystem/locations - Get all available locations
    if (pathname === "/api/mapsystem/locations" && req.method === "GET") {
        try {
            const locations = Object.values(CITY_LOCATIONS).map(loc => ({
                id: loc.id,
                name: loc.name,
                icon: loc.icon,
                description: loc.description,
                available: true
            }));
            
            console.log(`[MapRoutes] 📍 Sending ${locations.length} locations`);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, locations }));
        } catch (error) {
            console.error("[MapRoutes] ❌ Error getting locations:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to load locations" }));
        }
    }

    // ==================== CALCULATE ENERGY REQUIRED ====================
    // POST /api/mapsystem/calculate-cost - Calculate energy required for travel
    if (pathname === "/api/mapsystem/calculate-cost" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { locationId } = JSON.parse(body);
                
                console.log(`[MapRoutes] ðŸ'° Calculating cost for location: ${locationId}`);
                
                // Get user's travel data
                const travelInfo = dbManager.getTravelSystemInfo(uid);
                console.log(`[MapRoutes] 📊 Travel info:`, travelInfo);
                
                // Get user's inventory
                const inventory = await getUserInventory(uid);
                
                let energyCost = 100; // Default: walking uses 100%
                let transportMode = 'Walking';
                
                if (travelInfo.vehicleMap && inventory) {
                    const vehicle = inventory.slots.find(
                        slot => slot && slot.id === travelInfo.vehicleMap
                    );
                    
                    if (vehicle && vehicle.type === 'transportVehicle') {
                        energyCost = vehicle.energyConsumption || 100;
                        transportMode = vehicle.name;
                        console.log(`[MapRoutes] ðŸš— Using vehicle: ${transportMode} (${energyCost}%)`);
                    } else {
                        // Vehicle not found or invalid, reset to walking
                        dbManager.setVehicleMap(uid, null);
                        console.log(`[MapRoutes] ⚠️ Vehicle not found, reset to walking`);
                    }
                }
                
                const canAfford = travelInfo.travelEnergy >= energyCost;
                
                console.log(`[MapRoutes] ✅ Calculation: ${travelInfo.travelEnergy}% / ${energyCost}% = ${canAfford ? 'YES' : 'NO'}`);
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    energyCost,
                    currentEnergy: travelInfo.travelEnergy,
                    canAfford,
                    transportMode,
                    message: canAfford 
                        ? `Travel using ${transportMode} (${energyCost}% energy)`
                        : `Not enough energy! Need ${energyCost}%, you have ${travelInfo.travelEnergy}%`
                }));
            } catch (error) {
                console.error("[MapRoutes] ❌ Error calculating cost:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Failed to calculate travel cost" }));
            }
        });
        return true;
    }

    // ==================== EXECUTE TRAVEL ====================
    // POST /api/mapsystem/execute-travel - Execute travel to location
    if (pathname === "/api/mapsystem/execute-travel" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { locationId, useCash } = JSON.parse(body);
                
                console.log(`[MapRoutes] 🚀 Travel request: User ${uid} -> ${locationId} (Cash: ${useCash})`);
                
                // Validate location
                const location = CITY_LOCATIONS[locationId];
                if (!location) {
                    res.writeHead(404, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Location not found" }));
                }
                
                // Get FRESH travel data from database
                const travelInfo = dbManager.getTravelSystemInfo(uid);
                console.log(`[MapRoutes] 📊 Current travel energy: ${travelInfo.travelEnergy}%`);
                
                const inventory = await getUserInventory(uid);
                
                // Calculate energy cost
                let energyCost = 100;
                if (travelInfo.vehicleMap && inventory) {
                    const vehicle = inventory.slots.find(
                        slot => slot && slot.id === travelInfo.vehicleMap
                    );
                    if (vehicle && vehicle.type === 'transportVehicle') {
                        energyCost = vehicle.energyConsumption || 100;
                    }
                }
                
                console.log(`[MapRoutes] ⚡ Energy cost: ${energyCost}%`);
                
                // ðŸš¨ NEW: Cash travel option
                if (useCash === true) {
                    const CASH_TRAVEL_COST = 450; // Fixed cost for cash travel
                    
                    console.log(`[MapRoutes] ðŸ'° Cash travel requested: ${CASH_TRAVEL_COST} coins`);
                    
                    // Get user coins
                    const { getUserCoins } = require('../apis');
                    const coinData = getUserCoins(uid);
                    
                    if (coinData.coins < CASH_TRAVEL_COST) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        return res.end(JSON.stringify({ 
                            error: `Not enough coins! Need ${CASH_TRAVEL_COST}, you have ${coinData.coins}`,
                            cashRequired: CASH_TRAVEL_COST,
                            currentCoins: coinData.coins
                        }));
                    }
                    
                    // Deduct coins
                    const { updateUserCoins } = require('../apis');
                    updateUserCoins(uid, {
                        coins: coinData.coins - CASH_TRAVEL_COST,
                        total_words: coinData.total_words
                    });
                    
                    console.log(`[MapRoutes] ✅ Cash travel paid: ${CASH_TRAVEL_COST} coins deducted`);
                    
                    // Generate location token
                    const locationToken = generateLocationAccessToken(uid, locationId);
                    
                    // Build location URL
                    const locationUrl = `${config.server.domain}${location.path}?uid=${uid}&token=${token}&loc_token=${locationToken}`;
                    
                    console.log(`[MapRoutes] ✅ Cash travel successful! Redirecting to: ${location.path}`);
                    
                    res.writeHead(200, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({
                        success: true,
                        locationUrl,
                        cashPaid: CASH_TRAVEL_COST,
                        coinsRemaining: coinData.coins - CASH_TRAVEL_COST,
                        travelMethod: 'cash'
                    }));
                }
                
                // ðŸš¨ ENERGY TRAVEL (Original method)
                console.log(`[MapRoutes] ðŸ"¥ Attempting to deduct ${energyCost}% energy...`);
                const deductResult = dbManager.deductEnergyForTravel(uid, energyCost);
                
                if (!deductResult.success) {
                    console.log(`[MapRoutes] ❌ Energy deduction failed:`, deductResult.message);
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        error: deductResult.message,
                        energyCost,
                        currentEnergy: travelInfo.travelEnergy
                    }));
                }
                
                console.log(`[MapRoutes] ✅ Energy deducted! Remaining: ${deductResult.travelEnergyRemaining}%`);
                
                // Verify energy was actually updated
                const verifyInfo = dbManager.getTravelSystemInfo(uid);
                console.log(`[MapRoutes] ðŸ" Verified energy after deduction: ${verifyInfo.travelEnergy}%`);
                
                // Generate location token
                const locationToken = generateLocationAccessToken(uid, locationId);
                
                // Build location URL
                const locationUrl = `${config.server.domain}${location.path}?uid=${uid}&token=${token}&loc_token=${locationToken}`;
                
                console.log(`[MapRoutes] ✅ Travel successful! Redirecting to: ${location.path}`);
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    locationUrl,
                    energyDeducted: energyCost,
                    travelEnergyRemaining: verifyInfo.travelEnergy,
                    travelMethod: 'energy'
                }));
            } catch (error) {
                console.error("[MapRoutes] ❌ Travel error:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Travel failed", details: error.message }));
            }
        });
        return true;
    }

    return false;
}

module.exports = handleMapSystemRoutes;