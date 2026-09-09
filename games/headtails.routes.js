// Head & Tails Game Routes - WITH STATS ENDPOINTS
const { checkUserAccess } = require('../apis');

async function handleHeadTailsRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const headtailsGame = global.gamesManager?.getGame('headtails');

    if (!headtailsGame) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Game not available" }));
    }

    // Check if user can play
    if (pathname === "/api/games/headtails/can-play" && req.method === "GET") {
        try {
            const result = headtailsGame.canPlay(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, ...result }));
        } catch (error) {
            console.error("[HeadTails] Error checking can play:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Start game
    if (pathname === "/api/games/headtails/start" && req.method === "POST") {
        try {
            const result = headtailsGame.startGame(uid);
            
            if (!result.success) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(result));
            }
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(result));
        } catch (error) {
            console.error("[HeadTails] Error starting game:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, error: "Server error" }));
        }
    }

    // Get session
    if (pathname === "/api/games/headtails/session" && req.method === "GET") {
        try {
            const session = headtailsGame.getSession(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, session }));
        } catch (error) {
            console.error("[HeadTails] Error getting session:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Perform toss
    if (pathname === "/api/games/headtails/toss" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { choice } = JSON.parse(body);
                
                if (!choice) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Choice required" }));
                }

                const result = headtailsGame.performToss(uid, choice);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[HeadTails] Error performing toss:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Choose action (batting/bowling)
    if (pathname === "/api/games/headtails/choose" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { action } = JSON.parse(body);
                
                if (!action) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Action required" }));
                }

                const result = headtailsGame.chooseAction(uid, action);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[HeadTails] Error choosing action:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Play ball
    if (pathname === "/api/games/headtails/play" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { number } = JSON.parse(body);
                
                if (!number) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Number required" }));
                }

                const result = headtailsGame.playBall(uid, number);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[HeadTails] Error playing ball:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // ✅ Get user stats (includes date-wise stats)
    if (pathname === "/api/games/headtails/stats" && req.method === "GET") {
        try {
            const stats = headtailsGame.getUserStats(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, stats }));
        } catch (error) {
            console.error("[HeadTails] Error getting stats:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // ✅ Get global game stats (date-wise)
    if (pathname === "/api/games/headtails/game-stats" && req.method === "GET") {
        try {
            const gameStats = headtailsGame.getGameStats();
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, stats: gameStats }));
        } catch (error) {
            console.error("[HeadTails] Error getting game stats:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    return false;
}

module.exports = handleHeadTailsRoutes;