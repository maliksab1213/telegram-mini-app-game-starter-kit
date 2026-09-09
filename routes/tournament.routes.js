// Tournament Routes with Time Sync API
const { checkUserAccess, getUserCoins, updateUserCoins, addCoinsToUser } = require('../apis');
const tournamentAPI = require('../tournament_api');
const db = require('../database');
const fs = require('fs').promises;
const path = require('path');

const TICKET_PRICE = 10;
const TIMEZONE = 'America/New_York';

// Helper function to get US Eastern Time
function getCurrentUSTime() {
    const now = new Date();
    const usDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
    
    return {
        date: usDate.toISOString().split('T')[0],
        time: `${String(usDate.getHours()).padStart(2, '0')}:${String(usDate.getMinutes()).padStart(2, '0')}`,
        timestamp: usDate.getTime(),
        timezone: TIMEZONE
    };
}
function calculateRemainingMinutes(targetTime) {
    const { time: currentTime } = getCurrentUSTime();
    
    const [targetHour, targetMin] = targetTime.split(':').map(Number);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    
    const targetTotalMin = targetHour * 60 + targetMin;
    const currentTotalMin = currentHour * 60 + currentMin;
    
    return targetTotalMin - currentTotalMin;
}
async function handleTournamentRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // NEW: GET /api/tournament/server-time - Get server's US Eastern Time
    if (pathname === "/api/tournament/server-time" && req.method === "GET") {
        try {
            const serverTime = getCurrentUSTime();
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(serverTime));
        } catch (error) {
            console.error("[TournamentRoutes] Error getting server time:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get server time" }));
        }
    }

    // GET /api/tournament/check/:location - Check if tournament is available (NO REVEAL)
    if (pathname.startsWith("/api/tournament/check/") && req.method === "GET") {
        const locationId = pathname.split('/').pop();
        
        try {
            const { date: currentDate } = getCurrentUSTime();
            const config = await tournamentAPI.loadConfig();
            
            // Check if tournament exists for today
            if (!config || config.date !== currentDate) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    available: false, 
                    message: 'No tournament today. Come back tomorrow!',
                    serverTime: getCurrentUSTime()
                }));
            }
            
            // Check if user has ticket
            const hasTicket = db.getUserTicket(uid, currentDate);
            
            // Map location to tournament type
            const locationMap = {
                'stadium': 'horseRace',
                'boxing': 'boxing',
                'carrace': 'carRace'
            };
            
            const tournamentType = locationMap[locationId];
            
            // If user doesn't have ticket, don't reveal tournament type
            if (!hasTicket) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    available: false,
                    hasTicket: false,
                    message: 'Purchase a ticket to view tournament details',
                    serverTime: getCurrentUSTime()
                }));
            }
            
            // User has ticket, check if this location has tournament
            if (config.available_tournament !== tournamentType) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    available: false,
                    hasTicket: true,
                    message: 'No tournament at this location today',
                    serverTime: getCurrentUSTime()
                }));
            }
            
            // Show tournament data with server time
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({
                available: true,
                hasTicket: true,
                type: tournamentType,
                data: config[tournamentType],
                date: config.date,
                serverTime: getCurrentUSTime()
            }));
            
        } catch (error) {
            console.error("[TournamentRoutes] Error checking tournament:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to check tournament" }));
        }
    }

    // POST /api/tournament/buy-ticket
    if (pathname === "/api/tournament/buy-ticket" && req.method === "POST") {
        try {
            const { date: currentDate } = getCurrentUSTime();
            
            // Check if tournament exists today
            const config = await tournamentAPI.loadConfig();
            if (!config || config.date !== currentDate) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    error: "No tournament available today!" 
                }));
            }
            
            // Check if already has ticket
            const hasTicket = db.getUserTicket(uid, currentDate);
            if (hasTicket) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    error: "You already have a ticket for today!" 
                }));
            }
            
            // Check coins
            const coinData = getUserCoins(uid);
            if (coinData.coins < TICKET_PRICE) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    error: `Not enough coins! Need ${TICKET_PRICE}, you have ${coinData.coins}` 
                }));
            }
            
            // Deduct coins
            updateUserCoins(uid, {
                coins: coinData.coins - TICKET_PRICE,
                total_words: coinData.total_words
            });
            
            // Give ticket
            db.saveTournamentTicket(uid, currentDate);
            
            console.log(`[TournamentRoutes] Ticket purchased: ${uid} - Date: ${currentDate}`);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                success: true,
                message: `Ticket purchased! -${TICKET_PRICE} coins`,
                coinsRemaining: coinData.coins - TICKET_PRICE,
                tournamentType: config.available_tournament,
                serverTime: getCurrentUSTime()
            }));
        } catch (error) {
            console.error("[TournamentRoutes] Error buying ticket:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to buy ticket" }));
        }
        return true;
    }

    // GET /api/tournament/my-ticket
    if (pathname === "/api/tournament/my-ticket" && req.method === "GET") {
        try {
            const { date: currentDate } = getCurrentUSTime();
            const hasTicket = db.getUserTicket(uid, currentDate);
            
            // If has ticket, also return tournament type
            let tournamentType = null;
            if (hasTicket) {
                const config = await tournamentAPI.loadConfig();
                if (config && config.date === currentDate) {
                    tournamentType = config.available_tournament;
                }
            }
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ 
                hasTicket,
                tournamentType,
                serverTime: getCurrentUSTime()
            }));
        } catch (error) {
            console.error("[TournamentRoutes] Error checking ticket:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to check ticket" }));
        }
    }

    // GET /api/tournament/data - Get tournament data (only if has ticket)
    if (pathname === "/api/tournament/data" && req.method === "GET") {
        try {
            const { date: currentDate } = getCurrentUSTime();
            const hasTicket = db.getUserTicket(uid, currentDate);
            
            if (!hasTicket) {
                res.writeHead(403, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    error: "No ticket",
                    message: "Purchase a ticket to view tournament"
                }));
            }
            
            const data = await tournamentAPI.getTournamentData();
            
            if (!data) {
                res.writeHead(404, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    error: "No tournament today"
                }));
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ 
                success: true, 
                data,
                serverTime: getCurrentUSTime()
            }));
        } catch (error) {
            console.error("[TournamentRoutes] Error getting data:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get tournament data" }));
        }
    }

    // POST /api/tournament/select - Save user selection
    if (pathname === "/api/tournament/select" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { tournamentType, roundNumber, selection } = JSON.parse(body);
                const { date: currentDate } = getCurrentUSTime();
                
                // Check ticket
                const hasTicket = db.getUserTicket(uid, currentDate);
                if (!hasTicket) {
                    res.writeHead(403, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        error: "No ticket! Purchase a ticket first." 
                    }));
                }
                
                // Verify tournament
                const config = await tournamentAPI.loadConfig();
                if (!config || config.date !== currentDate || config.available_tournament !== tournamentType) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        error: "Invalid tournament"
                    }));
                }

                const roundKey = tournamentType === 'boxing' && roundNumber === 3 ? 'final' : `round${roundNumber}`;
                const round = config[tournamentType][roundKey];
                
                if (!round) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Invalid round" }));
                }

                // Check if round already completed
                if (round.completed === true) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        error: "Round already completed! Selection closed." 
                    }));
                }

                // Save selection
                const saved = db.saveTournamentSelection(uid, currentDate, tournamentType, roundNumber, selection);

                if (saved) {
                    console.log(`[TournamentRoutes] Selection saved: ${uid} - ${tournamentType} - R${roundNumber} - ${selection}`);
                    
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ 
                        success: true,
                        message: "Selection saved!",
                        selection: selection,
                        serverTime: getCurrentUSTime()
                    }));
                } else {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Failed to save selection" }));
                }
            } catch (error) {
                console.error("[TournamentRoutes] Error saving selection:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Failed to save selection" }));
            }
        });
        return true;
    }

    // GET /api/tournament/my-selections
    if (pathname === "/api/tournament/my-selections" && req.method === "GET") {
        try {
            const { date: currentDate } = getCurrentUSTime();
            const selections = db.getUserTournamentSelections(uid, currentDate);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ 
                success: true, 
                selections,
                serverTime: getCurrentUSTime()
            }));
        } catch (error) {
            console.error("[TournamentRoutes] Error getting selections:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get selections" }));
        }
    }

    // GET /api/tournament/round-status/:type/:round
if (pathname.startsWith("/api/tournament/round-status/") && req.method === "GET") {
    try {
        const parts = pathname.split('/');
        const tournamentType = parts[4];
        const roundNumber = parseInt(parts[5]);

        const { date: currentDate } = getCurrentUSTime();
        const config = await tournamentAPI.getTournamentData();
        
        if (!config || config.available_tournament !== tournamentType) {
            res.writeHead(404, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Tournament not available" }));
        }

        const roundKey = tournamentType === 'boxing' && roundNumber === 3 ? 'final' : `round${roundNumber}`;
        const round = config[tournamentType][roundKey];

        // Get user's selection
        const userSelection = db.getTournamentSelection(uid, currentDate, tournamentType, roundNumber);

        // Check winner status if round completed
        if (round.completed && userSelection) {
            const isWinner = userSelection.selected_option === round.winner.toString() || 
                            userSelection.selected_option === round.winner;
            
            // Update result in database if not already set
            if (userSelection.result === 'pending') {
                db.updateTournamentUserResult(uid, currentDate, tournamentType, roundNumber, isWinner);
                userSelection.result = isWinner ? 'win' : 'lose';
            }
        }

        // ✅ CRITICAL FIX: Calculate remaining minutes on server
        const remainingMinutes = calculateRemainingMinutes(round.time);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
            success: true,
            completed: round.completed,
            round,
            userSelection: userSelection || null,
            remainingMinutes: remainingMinutes, // ✅ ADD THIS
            serverTime: getCurrentUSTime()
        }));
    } catch (error) {
        console.error("[TournamentRoutes] Error getting round status:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Failed to get round status" }));
    }
}

    // Remaining routes stay the same but add serverTime to responses...
    // (I'll include the critical ones)

    // GET /api/tournament/reward-config
    if (pathname === "/api/tournament/reward-config" && req.method === "GET") {
        try {
            const configPath = path.join(__dirname, '..', 'control', 'tournament_reward.json');
            const data = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(data);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(config));
        } catch (error) {
            console.error("[TournamentRoutes] Error loading reward config:", error);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({
                rewards: { round1: 1000, round2: 2000, round3: 3000 },
                bonus: { all_wins: 2000 }
            }));
        }
    }

    // GET /api/tournament/my-rewards
    if (pathname === "/api/tournament/my-rewards" && req.method === "GET") {
        try {
            const { date: currentDate } = getCurrentUSTime();
            
            // Check ticket first
            const hasTicket = db.getUserTicket(uid, currentDate);
            if (!hasTicket) {
                res.writeHead(403, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    error: "No ticket",
                    hasTicket: false
                }));
            }
            
            const config = await tournamentAPI.getTournamentData();
            
            if (!config) {
                res.writeHead(404, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "No tournament today" }));
            }
            
            const tournamentType = config.available_tournament;
            const rewards = db.getUserTournamentRewards(uid, currentDate, tournamentType);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({
                ...rewards,
                hasTicket: true,
                serverTime: getCurrentUSTime()
            }));
        } catch (error) {
            console.error("[TournamentRoutes] Error getting rewards:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get rewards" }));
        }
    }

    // POST /api/tournament/collect-reward
    if (pathname === "/api/tournament/collect-reward" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { tournamentType, roundNumber, amount } = JSON.parse(body);
                const { date: currentDate } = getCurrentUSTime();
                
                // Get user selection
                const selection = db.getTournamentSelection(uid, currentDate, tournamentType, roundNumber);
                
                if (!selection || selection.result !== 'win') {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "You didn't win this round" }));
                }
                
                // Check if already collected
                const rewards = db.getUserTournamentRewards(uid, currentDate, tournamentType);
                const collectedKey = `round${roundNumber}_collected`;
                
                if (rewards && rewards[collectedKey] === 1) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Reward already collected" }));
                }
                
                // Add coins
                addCoinsToUser(uid, amount, 0);
                
                // Mark as collected
                db.collectRoundReward(uid, currentDate, tournamentType, roundNumber);
                
                console.log(`[TournamentRoutes] ✅ Reward collected: ${uid} - R${roundNumber} - ${amount} coins`);
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    success: true,
                    message: `Reward collected! +${amount} coins`,
                    amount,
                    serverTime: getCurrentUSTime()
                }));
            } catch (error) {
                console.error("[TournamentRoutes] Error collecting reward:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Failed to collect reward" }));
            }
        });
        return true;
    }

    // GET /api/tournament/check-bonus
    if (pathname === "/api/tournament/check-bonus" && req.method === "GET") {
        try {
            const { date: currentDate } = getCurrentUSTime();
            const config = await tournamentAPI.getTournamentData();
            
            if (!config) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ eligible: false }));
            }
            
            const tournamentType = config.available_tournament;
            const selections = db.getUserTournamentSelections(uid, currentDate);
            
            // Check if won all 3 rounds
            const wonAll = selections.filter(s => 
                s.tournament_type === tournamentType && s.result === 'win'
            ).length === 3;
            
            if (!wonAll) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ eligible: false }));
            }
            
            // Check if bonus already collected
            const rewards = db.getUserTournamentRewards(uid, currentDate, tournamentType);
            const bonusCollected = rewards && rewards.bonus_collected === 1;
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ 
                eligible: true,
                collected: bonusCollected,
                serverTime: getCurrentUSTime()
            }));
        } catch (error) {
            console.error("[TournamentRoutes] Error checking bonus:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to check bonus" }));
        }
    }

    // POST /api/tournament/collect-bonus
    if (pathname === "/api/tournament/collect-bonus" && req.method === "POST") {
        try {
            const { date: currentDate } = getCurrentUSTime();
            const config = await tournamentAPI.getTournamentData();
            
            if (!config) {
                res.writeHead(404, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "No tournament today" }));
            }
            
            const tournamentType = config.available_tournament;
            const selections = db.getUserTournamentSelections(uid, currentDate);
            
            // Verify won all 3 rounds
            const wonAll = selections.filter(s => 
                s.tournament_type === tournamentType && s.result === 'win'
            ).length === 3;
            
            if (!wonAll) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Must win all 3 rounds for bonus" }));
            }
            
            // Check if already collected
            const rewards = db.getUserTournamentRewards(uid, currentDate, tournamentType);
            if (rewards && rewards.bonus_collected === 1) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Bonus already collected" }));
            }
            
            // Load bonus amount
            const configPath = path.join(__dirname, '..', 'control', 'tournament_reward.json');
            const rewardData = await fs.readFile(configPath, 'utf8');
            const rewardConfig = JSON.parse(rewardData);
            const bonusAmount = rewardConfig.bonus.all_wins || 2000;
            
            // Add bonus coins
            addCoinsToUser(uid, bonusAmount, 0);
            
            // Mark bonus as collected
            db.collectTournamentBonus(uid, currentDate, tournamentType);
            
            console.log(`[TournamentRoutes] ✅ Bonus collected: ${uid} - ${bonusAmount} coins`);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                success: true,
                message: `Bonus collected! +${bonusAmount} coins`,
                amount: bonusAmount,
                serverTime: getCurrentUSTime()
            }));
        } catch (error) {
            console.error("[TournamentRoutes] Error collecting bonus:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to collect bonus" }));
        }
        return true;
    }

    // GET /api/tournament/has-uncollected
    if (pathname === "/api/tournament/has-uncollected" && req.method === "GET") {
        try {
            const { date: currentDate } = getCurrentUSTime();
            
            // Check ticket
            const hasTicket = db.getUserTicket(uid, currentDate);
            if (!hasTicket) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ hasUncollected: false, count: 0 }));
            }
            
            const config = await tournamentAPI.getTournamentData();
            
            if (!config) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ hasUncollected: false, count: 0 }));
            }
            
            const tournamentType = config.available_tournament;
            const selections = db.getUserTournamentSelections(uid, currentDate);
            const rewards = db.getUserTournamentRewards(uid, currentDate, tournamentType);
            
            // Count uncollected wins
            let uncollectedCount = 0;
            
            for (let i = 1; i <= 3; i++) {
                const selection = selections.find(s => 
                    s.tournament_type === tournamentType && 
                    s.round_number === i
                );
                
                const collectedKey = `round${i}_collected`;
                
                if (selection && selection.result === 'win' && 
                    (!rewards || rewards[collectedKey] !== 1)) {
                    uncollectedCount++;
                }
            }
            
            // Check bonus
            const wonAll = selections.filter(s => 
                s.tournament_type === tournamentType && s.result === 'win'
            ).length === 3;
            
            if (wonAll && (!rewards || rewards.bonus_collected !== 1)) {
                uncollectedCount++;
            }
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ 
                hasUncollected: uncollectedCount > 0,
                count: uncollectedCount,
                serverTime: getCurrentUSTime()
            }));
        } catch (error) {
            console.error("[TournamentRoutes] Error checking uncollected:", error);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ hasUncollected: false, count: 0 }));
        }
    }

    return false;
}

module.exports = handleTournamentRoutes;