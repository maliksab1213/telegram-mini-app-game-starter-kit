// FILE: routes/level.routes.js  (NEW FILE)
// Register in index.js:
//   const handleLevelRoutes = require('./routes/level.routes');
//   add handleLevelRoutes to the handlers array (before handleTaskRoutes)
const levelAPI = require('../level_apis');
const { checkUserAccess } = require('../apis');

async function handleLevelRoutes(req, res, parsed, bot) {
    const { pathname } = parsed;
    if (!pathname.startsWith('/api/level')) return false;

    const { uid, token } = parsed.query || {};
    if (!uid || !token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing auth' }));
        return true;
    }

    if (!await checkUserAccess(uid, token, bot)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return true;
    }

    const telegramId = parseInt(uid);

    // GET /api/level
    if (pathname === '/api/level' && req.method === 'GET') {
        const data = await levelAPI.getUserLevelInfo(telegramId);
        if (!data) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to load level' }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        }
        return true;
    }

    // POST /api/level/up
    if (pathname === '/api/level/up' && req.method === 'POST') {
        const result = await levelAPI.levelUpUser(telegramId);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return true;
    }

    return false;
}

module.exports = handleLevelRoutes;
