// FILE: routes/leaderboard_routes.js
const { checkUserAccess } = require('../apis');
const { getTopLeaderboard, getUserRankInfo } = require('../leaderboard_api');

async function handleLeaderboardRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Access denied' }));
    }

    // GET /api/leaderboard  — top 20 + current user rank
    if (pathname === '/api/leaderboard' && req.method === 'GET') {
        try {
            const top20   = getTopLeaderboard(20);
            const userInfo = getUserRankInfo(parseInt(uid));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                success:  true,
                top20,
                userInfo: userInfo || { rank: '?', name: 'You', level: 1, coins: 0 }
            }));
        } catch (e) {
            console.error('[LeaderboardRoutes]', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Server error' }));
        }
    }

    return false;
}

module.exports = handleLeaderboardRoutes;
