// Transaction History Routes
const { checkUserAccess } = require('../apis');

async function handleTransactionsRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // GET /api/transactions - Get user transactions
    if (pathname === "/api/transactions" && req.method === "GET") {
        try {
            const dbManager = require('../database');
            const transactions = dbManager.getTransactions(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(transactions));
        } catch (error) {
            console.error("Error getting transactions:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get transactions" }));
        }
    }

    return false;
}

module.exports = handleTransactionsRoutes;