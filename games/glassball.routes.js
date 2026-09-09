// Glass Ball Game Routes - games/glassball.routes.js
const { checkUserAccess } = require('../apis');

async function handleGlassBallRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Auth check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const db = require('../database');
    const glassBallGame = global.gamesManager?.getGame('glassball');

    if (!glassBallGame) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Game not available" }));
    }

    // Check if user can play
    if (pathname === "/api/games/glassball/can-play" && req.method === "GET") {
        try {
            const result = glassBallGame.canPlay(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, ...result }));
        } catch (error) {
            console.error("[GlassBall] Error checking can play:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Start game
    if (pathname === "/api/games/glassball/start" && req.method === "POST") {
        try {
            const result = glassBallGame.startGame(uid);
            
            if (!result.success) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(result));
            }
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(result));
        } catch (error) {
            console.error("[GlassBall] Error starting game:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, error: "Server error" }));
        }
    }

    // Get session
    if (pathname === "/api/games/glassball/session" && req.method === "GET") {
        try {
            const session = glassBallGame.getSession(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, session }));
        } catch (error) {
            console.error("[GlassBall] Error getting session:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Make guess
    if (pathname === "/api/games/glassball/guess" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { position } = JSON.parse(body);
                
                if (position === undefined) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Position required" }));
                }

                const result = glassBallGame.makeGuess(uid, position);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[GlassBall] Error making guess:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Get stats
    if (pathname === "/api/games/glassball/stats" && req.method === "GET") {
        try {
            const stats = glassBallGame.getUserStats(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, stats }));
        } catch (error) {
            console.error("[GlassBall] Error getting stats:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    return false;
}

module.exports = handleGlassBallRoutes;