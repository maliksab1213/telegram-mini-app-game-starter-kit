// Casino Routes - Main casino page
const { checkUserAccess } = require('../apis');
const casinoAPI = require('../casino_api');

async function handleCasinoRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Auth check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // Get available games
    if (pathname === "/api/casino/games" && req.method === "GET") {
        try {
            const games = await casinoAPI.getAvailableGames();
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, games }));
        } catch (error) {
            console.error("[CasinoRoutes] Error getting games:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to load games" }));
        }
    }

    // Get casino overview stats
    if (pathname === "/api/casino/overview" && req.method === "GET") {
        try {
            const db = require('../database');
            const overview = db.casino.getCasinoOverview();
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, overview }));
        } catch (error) {
            console.error("[CasinoRoutes] Error getting overview:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get overview" }));
        }
    }

    return false;
}

module.exports = handleCasinoRoutes;