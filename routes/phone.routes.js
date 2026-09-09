// Phone System Routes
const { checkUserAccess } = require('../apis');
const {
    getWalletData,
    activateWallet,
    depositToWallet,
    withdrawFromWallet,
    upgradeWallet
} = require('../phone_api');

async function handlePhoneRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // GET /api/wallet - Get wallet data
    if (pathname === "/api/wallet" && req.method === "GET") {
        try {
            const walletData = await getWalletData(uid);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(walletData));
        } catch (error) {
            console.error("Error getting wallet:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get wallet data" }));
        }
    }

    // POST /api/wallet/activate - Activate wallet
    if (pathname === "/api/wallet/activate" && req.method === "POST") {
        try {
            const result = await activateWallet(uid);
            
            const statusCode = result.success ? 200 : 400;
            res.writeHead(statusCode, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(result));
        } catch (error) {
            console.error("Error activating wallet:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Activation failed" }));
        }
    }

    // POST /api/wallet/deposit - Deposit to wallet
    if (pathname === "/api/wallet/deposit" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { amount } = JSON.parse(body);
                
                if (!amount || amount <= 0) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Invalid amount" }));
                }
                
                const result = await depositToWallet(uid, amount);
                
                const statusCode = result.success ? 200 : 400;
                res.writeHead(statusCode, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("Error depositing:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Deposit failed" }));
            }
        });
        return true;
    }

    // POST /api/wallet/withdraw - Withdraw from wallet
    if (pathname === "/api/wallet/withdraw" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { amount } = JSON.parse(body);
                
                if (!amount || amount <= 0) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Invalid amount" }));
                }
                
                const result = await withdrawFromWallet(uid, amount);
                
                const statusCode = result.success ? 200 : 400;
                res.writeHead(statusCode, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("Error withdrawing:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Withdrawal failed" }));
            }
        });
        return true;
    }

    // POST /api/wallet/upgrade - Upgrade wallet
    if (pathname === "/api/wallet/upgrade" && req.method === "POST") {
        try {
            const result = await upgradeWallet(uid);
            
            const statusCode = result.success ? 200 : 400;
            res.writeHead(statusCode, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(result));
        } catch (error) {
            console.error("Error upgrading wallet:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Upgrade failed" }));
        }
    }

    return false;
}

module.exports = handlePhoneRoutes;