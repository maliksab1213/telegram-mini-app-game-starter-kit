// Trading System Routes - FIXED
const { checkUserAccess } = require('../apis');
const tradingHandler = require('../trading_handler');

async function handleTradingRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // GET /api/trading/config - Get trading system status and data
    if (pathname === "/api/trading/config" && req.method === "GET") {
        try {
            const config = tradingHandler.loadTradingConfig();
            const wallet = tradingHandler.getTradingWallet(uid);
            const positions = tradingHandler.getUserPositions(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({
                enabled: config.tradingApp,
                assets: config.assets,
                wallet: wallet,
                positions: positions
            }));
        } catch (error) {
            console.error("Error getting trading config:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get config" }));
        }
    }

    // GET /api/trading/wallet - Get trading wallet
    if (pathname === "/api/trading/wallet" && req.method === "GET") {
        try {
            const wallet = tradingHandler.getTradingWallet(uid);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(wallet));
        } catch (error) {
            console.error("Error getting trading wallet:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get wallet" }));
        }
    }

    // POST /api/trading/wallet/deposit - Deposit to trading wallet
    if (pathname === "/api/trading/wallet/deposit" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { amount } = JSON.parse(body);
                
                if (!amount || amount <= 0) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Invalid amount" }));
                }
                
                const result = tradingHandler.depositToTradingWallet(uid, amount);
                
                const statusCode = result.success ? 200 : 400;
                res.writeHead(statusCode, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("Error depositing to trading wallet:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Deposit failed" }));
            }
        });
        return true;
    }

    // POST /api/trading/wallet/withdraw - Withdraw from trading wallet
    if (pathname === "/api/trading/wallet/withdraw" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { amount } = JSON.parse(body);
                
                if (!amount || amount <= 0) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Invalid amount" }));
                }
                
                const result = tradingHandler.withdrawFromTradingWallet(uid, amount);
                
                const statusCode = result.success ? 200 : 400;
                res.writeHead(statusCode, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("Error withdrawing from trading wallet:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Withdrawal failed" }));
            }
        });
        return true;
    }

    // POST /api/trading/buy - Buy trading position
    if (pathname === "/api/trading/buy" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { assetId, amount } = JSON.parse(body);
                
                if (!assetId || !amount || amount <= 0) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Invalid data" }));
                }
                
                const result = tradingHandler.buyAsset(uid, assetId, amount);
                
                const statusCode = result.success ? 200 : 400;
                res.writeHead(statusCode, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("Error buying asset:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Failed to buy asset" }));
            }
        });
        return true;
    }

    // POST /api/trading/sell - Sell trading position
    if (pathname === "/api/trading/sell" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                console.log('[Route] 📥 Sell request received from user:', uid);
                
                const data = JSON.parse(body);
                const positionId = data.positionId;
                
                console.log('[Route] 📊 Request data:', { uid, positionId, body });
                
                // Validate positionId
                if (!positionId) {
                    console.error('[Route] ❌ Missing positionId');
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false,
                        message: "Position ID is required" 
                    }));
                }

                // Validate positionId is a number
                const posId = parseInt(positionId);
                if (isNaN(posId) || posId <= 0) {
                    console.error('[Route] ❌ Invalid positionId:', positionId);
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false,
                        message: "Invalid position ID" 
                    }));
                }

                console.log('[Route] ✅ Validation passed, calling sellPosition...');
                
                // Call sell function
                const result = tradingHandler.sellPosition(uid, posId);
                
                console.log('[Route] 📤 Sell result:', result);
                
                // Return response
                const statusCode = result.success ? 200 : 400;
                res.writeHead(statusCode, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
                
            } catch (error) {
                console.error("[Route] ❌ Error in sell route:", error);
                console.error("[Route] Error stack:", error.stack);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    success: false,
                    message: "Server error: " + error.message
                }));
            }
        });
        return true;
    }

    // GET /api/trading/positions - Get user positions
    if (pathname === "/api/trading/positions" && req.method === "GET") {
        try {
            const positions = tradingHandler.getUserPositions(uid);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(positions));
        } catch (error) {
            console.error("Error getting positions:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get positions" }));
        }
    }

    // GET /api/trading/transactions - Get trading transactions
    if (pathname === "/api/trading/transactions" && req.method === "GET") {
        try {
            const transactions = tradingHandler.getTradingTransactions(uid);
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

module.exports = handleTradingRoutes;