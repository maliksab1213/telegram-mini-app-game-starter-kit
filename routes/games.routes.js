// Games Main Routes
const { checkUserAccess } = require('../apis');
const gamesAPI = require('../games_api');

async function handleGamesRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Auth check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // Get available games
    if (pathname === "/api/games/list" && req.method === "GET") {
        try {
            const games = await gamesAPI.getAvailableGames();
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, games }));
        } catch (error) {
            console.error("[GamesRoutes] Error getting games:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to load games" }));
        }
    }

    // Get games overview stats
    if (pathname === "/api/games/overview" && req.method === "GET") {
        try {
            const db = require('../database');
            const overview = db.games.getGamesOverview();
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, overview }));
        } catch (error) {
            console.error("[GamesRoutes] Error getting overview:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get overview" }));
        }
    }

    return false;
}

module.exports = handleGamesRoutes;