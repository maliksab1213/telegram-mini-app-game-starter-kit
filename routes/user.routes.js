// User Related Routes
const { 
    checkUserAccess, 
    getUserPublicData, 
    updateUserName
} = require('../apis');

async function handleUserRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // GET /api/user - Get user data
    if (pathname === "/api/user" && req.method === "GET") {
        const userData = await getUserPublicData(uid);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(userData));
    }

    // POST /api/user/name - Update user name
    if (pathname === "/api/user/name" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { name } = JSON.parse(body);
                const result = await updateUserName(uid, name.trim());
                
                if (result.success) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true, name: result.user.name }));
                } else {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: result.error }));
                }
            } catch (error) {
                console.error("Error updating name:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return true;
    }

    return false;
}

module.exports = handleUserRoutes;