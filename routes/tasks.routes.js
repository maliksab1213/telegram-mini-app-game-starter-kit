// FILE: tasks_routes.js  (root)
const taskAPI = require('../task_apis');
const { checkUserAccess } = require('../apis');

async function handleTaskRoutes(req, res, parsed, bot) {
    const { pathname } = parsed;
    if (!pathname.startsWith('/api/tasks')) return false;

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

    // GET /api/tasks — full task list with completed/claimed flags
    if (pathname === '/api/tasks' && req.method === 'GET') {
        const data = await taskAPI.getUserTasks(telegramId);
        if (!data) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to load tasks' }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        }
        return true;
    }

    // POST /api/tasks/claim — claim reward for any completed task
    if (pathname === '/api/tasks/claim' && req.method === 'POST') {
        const body = await readBody(req);
        if (!body.taskId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing taskId' }));
            return true;
        }
        const result = await taskAPI.claimTaskReward(telegramId, body.taskId);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return true;
    }

    // POST /api/tasks/social/start — returns URL + timer seconds (no server timer stored)
    if (pathname === '/api/tasks/social/start' && req.method === 'POST') {
        const body   = await readBody(req);
        const result = await taskAPI.startSocialTask(telegramId, body.taskId);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return true;
    }

    // POST /api/tasks/social/complete — frontend calls this when countdown reaches 0
    if (pathname === '/api/tasks/social/complete' && req.method === 'POST') {
        const body   = await readBody(req);
        const result = await taskAPI.markSocialCompleted(telegramId, body.taskId);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return true;
    }

    return false;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
        req.on('error', reject);
    });
}

module.exports = handleTaskRoutes;
