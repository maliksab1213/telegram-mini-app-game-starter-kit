// Sequence Match Game Routes
const { checkUserAccess } = require('../apis');

async function handleSequenceMatchRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    const sequenceMatchGame = global.gamesManager?.getGame('sequencematch');

    if (!sequenceMatchGame) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Game not available" }));
    }

    // Check if user can play
    if (pathname === "/api/games/sequencematch/can-play" && req.method === "GET") {
        try {
            const result = sequenceMatchGame.canPlay(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, ...result }));
        } catch (error) {
            console.error("[SequenceMatch] Error checking can play:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Start game
    if (pathname === "/api/games/sequencematch/start" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { challenge } = JSON.parse(body);
                
                if (!challenge) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Challenge required" }));
                }

                const result = sequenceMatchGame.startGame(uid, challenge);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[SequenceMatch] Error starting game:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Get session
    if (pathname === "/api/games/sequencematch/session" && req.method === "GET") {
        try {
            const session = sequenceMatchGame.getSession(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, session }));
        } catch (error) {
            console.error("[SequenceMatch] Error getting session:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    // Generate sequence for level
    if (pathname === "/api/games/sequencematch/generate" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { level } = JSON.parse(body);
                
                if (!level) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Level required" }));
                }

                const result = sequenceMatchGame.generateSequence(uid, level);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[SequenceMatch] Error generating sequence:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Validate player sequence
    if (pathname === "/api/games/sequencematch/validate" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { sequence } = JSON.parse(body);
                
                if (!sequence || !Array.isArray(sequence)) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Valid sequence required" }));
                }

                const result = sequenceMatchGame.validateSequence(uid, sequence);
                
                if (!result.success) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify(result));
                }
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error("[SequenceMatch] Error validating sequence:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return true;
    }

    // Get stats
    if (pathname === "/api/games/sequencematch/stats" && req.method === "GET") {
        try {
            const stats = sequenceMatchGame.getUserStats(uid);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, stats }));
        } catch (error) {
            console.error("[SequenceMatch] Error getting stats:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Server error" }));
        }
    }

    return false;
}

module.exports = handleSequenceMatchRoutes;