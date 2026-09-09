// Coin Flip Game Routes
const { checkUserAccess } = require('../apis');

async function handleCoinFlipRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Auth check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const coinflipGame = global.gamesManager?.getGame('coinflip');

    if (!coinflipGame) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Game not available" }));
    }

    // Check if user can play
    if (pathname === "/api/games/coinflip/can-play" && req.method === "GET") {
        try {
            const result = coinflipGame.canPlay(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, ...result }));
        } catch (error) {
            console.error("[CoinFlip] Error checking can play:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Play game
    if (pathname === "/api/games/coinflip/play" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { choice } = JSON.parse(body);
                
                if (!choice) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Choice required" }));
                }

                const result = coinflipGame.playGame(uid, choice);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[CoinFlip] Error playing game:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Get stats
    if (pathname === "/api/games/coinflip/stats" && req.method === "GET") {
        try {
            const stats = coinflipGame.getUserStats(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, stats }));
        } catch (error) {
            console.error("[CoinFlip] Error getting stats:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    return false;
}

module.exports = handleCoinFlipRoutes;