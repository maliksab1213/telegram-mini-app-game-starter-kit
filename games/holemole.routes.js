// Hole Mole Game Routes
const { checkUserAccess } = require('../apis');

async function handleHoleMoleRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const holeMoleGame = global.gamesManager?.getGame('holemole');

    if (!holeMoleGame) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Game not available" }));
    }

    // Check if user can play
    if (pathname === "/api/games/holemole/can-play" && req.method === "GET") {
        try {
            const result = holeMoleGame.canPlay(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, ...result }));
        } catch (error) {
            console.error("[HoleMole] Error checking can play:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Start game
    if (pathname === "/api/games/holemole/start" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { challenge } = JSON.parse(body);
                
                if (!challenge) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Challenge required" }));
                }

                const result = holeMoleGame.startGame(uid, challenge);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[HoleMole] Error starting game:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Get session
    if (pathname === "/api/games/holemole/session" && req.method === "GET") {
        try {
            const session = holeMoleGame.getSession(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, session }));
        } catch (error) {
            console.error("[HoleMole] Error getting session:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Record hit
    if (pathname === "/api/games/holemole/hit" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { timestamp } = JSON.parse(body);
                
                const result = holeMoleGame.recordHit(uid, timestamp);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[HoleMole] Error recording hit:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // End game
    if (pathname === "/api/games/holemole/end" && req.method === "POST") {
        try {
            const result = holeMoleGame.endGame(uid);
            
            if (!result.success) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(result));
            }
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(result));
        } catch (error) {
            console.error("[HoleMole] Error ending game:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, error: "Server error" }));
        }
    }

    // Get stats
    if (pathname === "/api/games/holemole/stats" && req.method === "GET") {
        try {
            const stats = holeMoleGame.getUserStats(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, stats }));
        } catch (error) {
            console.error("[HoleMole] Error getting stats:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    return false;
}

module.exports = handleHoleMoleRoutes;