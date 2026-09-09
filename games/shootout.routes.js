// Shootout Game Routes
const { checkUserAccess } = require('../apis');

async function handleShootoutRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const shootoutGame = global.gamesManager?.getGame('shootout');

    if (!shootoutGame) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Game not available" }));
    }

    // Check if user can play
    if (pathname === "/api/games/shootout/can-play" && req.method === "GET") {
        try {
            const result = shootoutGame.canPlay(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, ...result }));
        } catch (error) {
            console.error("[Shootout] Error checking can play:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Start game
    if (pathname === "/api/games/shootout/start" && req.method === "POST") {
        try {
            const result = shootoutGame.startGame(uid);
            
            if (!result.success) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(result));
            }
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(result));
        } catch (error) {
            console.error("[Shootout] Error starting game:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, error: "Server error" }));
        }
    }

    // Get session
    if (pathname === "/api/games/shootout/session" && req.method === "GET") {
        try {
            const session = shootoutGame.getSession(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, session }));
        } catch (error) {
            console.error("[Shootout] Error getting session:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Play round
    if (pathname === "/api/games/shootout/play" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { choice } = JSON.parse(body);
                
                if (!choice) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Choice required" }));
                }

                const result = shootoutGame.playRound(uid, choice);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[Shootout] Error playing round:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Get stats
    if (pathname === "/api/games/shootout/stats" && req.method === "GET") {
        try {
            const stats = shootoutGame.getUserStats(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, stats }));
        } catch (error) {
            console.error("[Shootout] Error getting stats:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    return false;
}

module.exports = handleShootoutRoutes;