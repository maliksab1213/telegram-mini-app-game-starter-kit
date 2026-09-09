// Coins & Write Related Routes
const { 
    checkUserAccess, 
    getUserCoins,
    performWrite
} = require('../apis');

async function handleCoinsRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // GET /api/user/coins - Get user coins
    if (pathname === "/api/user/coins" && req.method === "GET") {
        try {
            const coinData = await getUserCoins(uid);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(coinData));
        } catch (error) {
            console.error("Error getting user coins:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get coins" }));
        }
    }

    // POST /api/user/write - Perform write operation
    if (pathname === "/api/user/write" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { wordsToWrite } = JSON.parse(body);
                const result = await performWrite(uid, wordsToWrite);
                
                if (result.success) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        success: true,
                        wordsWritten: result.wordsWritten,
                        coins: result.coins,
                        totalWords: result.totalWords,
                        bookCompleted: result.bookCompleted,
                        inkEmpty: result.inkEmpty,
                        newBookWords: result.newBookWords,
                        newInkWords: result.newInkWords
                    }));
                } else {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: result.message }));
                }
            } catch (error) {
                console.error("Error processing write:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return true;
    }

    return false;
}

module.exports = handleCoinsRoutes;