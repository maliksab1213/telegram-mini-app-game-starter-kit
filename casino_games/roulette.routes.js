// casino_games/roulette.routes.js - Roulette Game Routes
const { checkUserAccess } = require('../apis');

async function handleRouletteRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Auth check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const gameInstance = global.rouletteGame;

    // Get round info
    if (pathname === "/api/casino/roulette/round" && req.method === "GET") {
        try {
            if (!gameInstance || !gameInstance.isRunning) {
                res.writeHead(503, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ 
                    error: "Game maintenance",
                    maintenance: true
                }));
            }

            const roundInfo = gameInstance.getRoundInfo();
            const userBets = gameInstance.getUserBets(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({
                success: true,
                round: roundInfo,
                userBets
            }));
        } catch (error) {
            console.error("[Roulette] Error getting round:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get round info" }));
        }
    }

    // Place bet
    if (pathname === "/api/casino/roulette/bet" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { betType, betValue, amount } = JSON.parse(body);

                if (!gameInstance || !gameInstance.isRunning) {
                    res.writeHead(503, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false,
                        message: "Game is in maintenance"
                    }));
                }

                // Validate amount
                const validAmounts = [10, 20, 100, 200, 500, 1000, 2000, 5000];
                if (!validAmounts.includes(amount)) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false,
                        message: "Invalid bet amount"
                    }));
                }

                const result = gameInstance.placeBet(uid, betType, betValue, amount);

                if (result.success) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(result));
                } else {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(result));
                }
            } catch (error) {
                console.error("[Roulette] Error placing bet:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    success: false,
                    message: "Invalid request"
                }));
            }
        });
        return true;
    }

    // Get user stats
    if (pathname === "/api/casino/roulette/stats" && req.method === "GET") {
        try {
            const db = require('../database');
            const stats = db.casino.getUserStats(uid);
            const recentBets = db.casino.getUserBets(uid, 20);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({
                success: true,
                stats,
                recentBets
            }));
        } catch (error) {
            console.error("[Roulette] Error getting stats:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get stats" }));
        }
    }

    return false;
}

module.exports = handleRouletteRoutes;