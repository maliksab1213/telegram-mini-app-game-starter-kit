// New User Registration Routes
const db = require('../database');

async function handleNewUserRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // GET /api/new/check - Check if user is new
    if (pathname === "/api/new/check" && req.method === "GET") {
        if (!uid || !token || !botHandler.checkToken(uid, token)) {
            res.writeHead(403, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Access denied" }));
        }

        try {
            const user = db.getUser(uid);
            
            if (!user) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ isNew: true }));
            }

            // Check if user has a name and new_user is 0
            const isNew = !user.name || user.new_user === 1;
            
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                isNew: isNew,
                hasName: !!user.name
            }));
        } catch (error) {
            console.error("Error checking user status:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to check user status" }));
        }
        return true;
    }

    // POST /api/new/register - Register new user with name
    if (pathname === "/api/new/register" && req.method === "POST") {
        if (!uid || !token || !botHandler.checkToken(uid, token)) {
            res.writeHead(403, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Access denied" }));
        }

        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const { name, referredBy } = JSON.parse(body);
                
                if (!name || name.trim().length < 3 || name.trim().length > 15) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false, 
                        error: "Name must be between 3-15 characters" 
                    }));
                }

                // Check if name contains only letters and spaces
                if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false, 
                        error: "Name can only contain letters and spaces" 
                    }));
                }

                // Update user name (this also sets new_user to 0)
                const user = db.updateUserName(uid, name.trim());
                
                if (!user) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false, 
                        error: "Failed to update user" 
                    }));
                }
                
                // Verify user was updated
                console.log(`[NewUser] Updated user:`, user);

                // If referred by someone, add to their friends list
                if (referredBy) {
                    const referrer = db.getUser(referredBy);
                    
                    if (referrer) {
                        // Add this new user to referrer's friends
                        db.addFriend(referredBy, uid, name.trim());
                        console.log(`[NewUser] Added ${uid} to ${referredBy}'s friends`);
                    } else {
                        console.log(`[NewUser] Referrer ${referredBy} not found in database`);
                    }
                }

                console.log(`[NewUser] ✅ Registered: ${uid} - ${name.trim()}`);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    success: true, 
                    name: user.name 
                }));

            } catch (error) {
                console.error("Error registering new user:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: "Invalid request" 
                }));
            }
        });
        return true;
    }

    // GET /api/friends - Get user's friends list
    if (pathname === "/api/friends" && req.method === "GET") {
        if (!uid || !token || !botHandler.checkToken(uid, token)) {
            res.writeHead(403, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Access denied" }));
        }

        try {
            const friends = db.getFriends(uid);
            const referrals = db.getReferrals(uid);
            const friendCount = db.getFriendCount(uid);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                friends: friends,
                referrals: referrals,
                total: friendCount
            }));
        } catch (error) {
            console.error("Error getting friends:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to get friends" }));
        }
        return true;
    }

    return false;
}

module.exports = handleNewUserRoutes;