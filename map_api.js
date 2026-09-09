// Map & Location Management API
const crypto = require("crypto");
const config = require("./botconfig.json");

// Available locations
const LOCATIONS = {
    bank: {
        id: 'bank',
        name: 'City Bank',
        icon: '🏦',
        description: 'Open wallet account and manage your finances',
        available: true,
        url: '/locations/bank'
    },
    // Future locations can be added here
    // market: { ... },
    // casino: { ... }
};

function getAvailableLocations() {
    return Object.values(LOCATIONS).filter(loc => loc.available);
}

function getLocationById(locationId) {
    return LOCATIONS[locationId] || null;
}

function validateLocationAccess(locationId, uid, token) {
    // Check if location exists
    const location = getLocationById(locationId);
    if (!location) {
        return { valid: false, error: 'Location not found' };
    }
    
    // Check if location is available
    if (!location.available) {
        return { valid: false, error: 'Location not available' };
    }
    
    // Validate user token
    const expectedToken = crypto.createHmac("sha256", config.server.secret_key)
        .update(String(uid))
        .digest("hex");
    
    if (expectedToken !== token) {
        return { valid: false, error: 'Invalid access token' };
    }
    
    return { valid: true, location };
}

function createLocationToken(uid, locationId) {
    const timestamp = Date.now();
    const data = `${uid}:${locationId}:${timestamp}`;
    
    return crypto.createHmac("sha256", config.server.secret_key)
        .update(data)
        .digest("hex");
}

function getLocationUrl(locationId, uid, token) {
    const location = getLocationById(locationId);
    if (!location) return null;
    
    const locationToken = createLocationToken(uid, locationId);
    return `${location.url}?uid=${uid}&token=${token}&loc_token=${locationToken}`;
}

module.exports = {
    getAvailableLocations,
    getLocationById,
    validateLocationAccess,
    createLocationToken,
    getLocationUrl,
    LOCATIONS
};