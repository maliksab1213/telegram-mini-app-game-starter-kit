// Leaderboard Routes
const { checkUserAccess } = require('../apis');
const db = require('../database');

async function handleLeaderboardRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // GET /api/leaderboard - Get leaderboard
    if (pathname === "/api/leaderboard" && req.method === "GET") {
        try {
            const leaderboard = db.getLeaderboard(100);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(leaderboard));
        } catch (error) {
            console.error("Error getting leaderboard:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get leaderboard" }));
        }
    }

    return false;
}

module.exports = handleLeaderboardRoutes;