// Daily Rewards & Spin Routes
const { checkUserAccess } = require('../apis');
const { 
    getDailyRewardData,
    collectDailyReward,
    getDailySpinData,
    collectFreeSpinTicket,
    performSpin,
    getRewardAmount
} = require('../reward_spin_apis');

async function handleRewardsRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // GET /api/daily-reward - Get daily reward data
    if (pathname === "/api/daily-reward" && req.method === "GET") {
        try {
            const rewardData = getDailyRewardData(uid);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(rewardData || {}));
        } catch (error) {
            console.error("Error getting daily reward:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get daily reward" }));
        }
    }

    // POST /api/daily-reward/collect - Collect daily reward
    if (pathname === "/api/daily-reward/collect" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { dayIndex } = JSON.parse(body);
                const result = collectDailyReward(uid, dayIndex);
                
                if (result.success) {
                    const coinsAwarded = getRewardAmount(dayIndex);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: "Reward collected!",
                        coinsAwarded: coinsAwarded
                    }));
                } else {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, message: result.message }));
                }
            } catch (error) {
                console.error("Error collecting reward:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return true;
    }

    // GET /api/daily-spin - Get daily spin data
    if (pathname === "/api/daily-spin" && req.method === "GET") {
        try {
            const spinData = getDailySpinData(uid);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(spinData || {}));
        } catch (error) {
            console.error("Error getting daily spin:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get daily spin data" }));
        }
    }

    // POST /api/daily-spin/collect-ticket - Collect free spin ticket
    if (pathname === "/api/daily-spin/collect-ticket" && req.method === "POST") {
        try {
            const result = collectFreeSpinTicket(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                success: result.success, 
                message: result.message
            }));
            return true;
        } catch (error) {
            console.error("Error collecting spin ticket:", error);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to collect ticket" }));
            return true;
        }
    }

    // POST /api/daily-spin/perform - Perform spin
    if (pathname === "/api/daily-spin/perform" && req.method === "POST") {
        try {
            const result = performSpin(uid);
            
            if (result.success) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    wonAmount: result.wonAmount,
                    ticketsRemaining: result.ticketsRemaining,
                    totalSpins: result.totalSpins,
                    message: "Spin successful!"
                }));
            } else {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, message: result.message }));
            }
            return true;
        } catch (error) {
            console.error("Error performing spin:", error);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Spin failed" }));
            return true;
        }
    }

    return false;
}

module.exports = handleRewardsRoutes;