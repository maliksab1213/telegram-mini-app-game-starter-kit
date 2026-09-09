// Inventory & Selected Items Routes
const { 
    checkUserAccess, 
    getUserInventory,
    updateUserInventory,
    getSelectedItems,
    updateSelectedItems
} = require('../apis');

async function handleInventoryRoutes(req, res, parsed, botHandler) {
    const pathname = parsed.pathname;
    const { uid, token } = parsed.query;

    // Authentication check
    if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Access denied" }));
    }

    // GET /api/inventory - Get user inventory
    if (pathname === "/api/inventory" && req.method === "GET") {
        try {
            const inventory = await getUserInventory(uid);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(inventory));
        } catch (error) {
            console.error("Error getting inventory:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get inventory" }));
        }
    }

    // POST /api/inventory - Update inventory
    if (pathname === "/api/inventory" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const inventoryData = JSON.parse(body);
                const updatedInventory = await updateUserInventory(uid, inventoryData);
                
                if (updatedInventory) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true, inventory: updatedInventory }));
                } else {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Failed to save inventory" }));
                }
            } catch (error) {
                console.error("Error saving inventory:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return true;
    }

    // GET /api/user/selected - Get selected items
    if (pathname === "/api/user/selected" && req.method === "GET") {
        try {
            const selected = await getSelectedItems(uid);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(selected));
        } catch (error) {
            console.error("Error getting selected items:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Failed to get selected items" }));
        }
    }

    // POST /api/user/selected - Update selected items
    if (pathname === "/api/user/selected" && req.method === "POST") {
        let body = '';
        req.on('data', chunk => body += chunk.toString());

        req.on('end', async () => {
            try {
                const selectedData = JSON.parse(body);
                const updated = await updateSelectedItems(uid, selectedData);
                
                if (updated) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true, selected: updated }));
                } else {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Failed to update selected items" }));
                }
            } catch (error) {
                console.error("Error updating selected items:", error);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return true;
    }

    return false;
}

module.exports = handleInventoryRoutes;