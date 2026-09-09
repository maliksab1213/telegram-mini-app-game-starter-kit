// Memory Game Routes
const { checkUserAccess } = require('../apis');

async function handleMemoryGameRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const memoryGame = global.gamesManager?.getGame('memorygame');

    if (!memoryGame) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Game not available" }));
    }

    // Check if user can play
    if (pathname === "/api/games/memorygame/can-play" && req.method === "GET") {
        try {
            const result = memoryGame.canPlay(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, ...result }));
        } catch (error) {
            console.error("[MemoryGame] Error checking can play:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Start game
    if (pathname === "/api/games/memorygame/start" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { challenge } = JSON.parse(body);
                
                if (!challenge) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Challenge required" }));
                }

                const result = memoryGame.startGame(uid, challenge);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[MemoryGame] Error starting game:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Get session
    if (pathname === "/api/games/memorygame/session" && req.method === "GET") {
        try {
            const session = memoryGame.getSession(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, session }));
        } catch (error) {
            console.error("[MemoryGame] Error getting session:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Flip card
    if (pathname === "/api/games/memorygame/flip" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { cardIndex, timestamp } = JSON.parse(body);
                
                if (cardIndex === undefined || !timestamp) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Card index and timestamp required" }));
                }

                const result = memoryGame.flipCard(uid, cardIndex, timestamp);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[MemoryGame] Error flipping card:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // End game
    if (pathname === "/api/games/memorygame/end" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { won } = JSON.parse(body);
                
                const result = memoryGame.endGame(uid, won);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[MemoryGame] Error ending game:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Get stats
    if (pathname === "/api/games/memorygame/stats" && req.method === "GET") {
        try {
            const stats = memoryGame.getUserStats(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, stats }));
        } catch (error) {
            console.error("[MemoryGame] Error getting stats:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    return false;
}

module.exports = handleMemoryGameRoutes;