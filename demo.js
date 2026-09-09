// demo.js
// Route: GET /demo
// If demomode: true in botconfig.json — opens game as demo user directly in browser
// No Telegram needed. Serves game HTML itself so no auth redirect loop.

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const DEMO_TELEGRAM_ID = '0000000001';
const DEMO_NAME        = 'Demo Player';
const DEMO_UNIQUE_CODE = 'DEMO0001';

function getConfig() {
    delete require.cache[require.resolve('./botconfig.json')];
    return require('./botconfig.json');
}

function generateDemoToken() {
    const config = getConfig();
    return crypto
        .createHmac('sha256', config.server.secret_key)
        .update(String(DEMO_TELEGRAM_ID))
        .digest('hex');
}

function ensureDemoUser() {
    try {
        const db = require('./database');
        const existing = db.getUser(DEMO_TELEGRAM_ID);
        if (!existing) {
            db.createUser(DEMO_TELEGRAM_ID, DEMO_UNIQUE_CODE, DEMO_NAME, null);
            db.updateUserName(DEMO_TELEGRAM_ID, DEMO_NAME);
            console.log('[Demo] ✅ Demo user created');
        } else if (!existing.name || existing.new_user === 1) {
            db.updateUserName(DEMO_TELEGRAM_ID, DEMO_NAME);
            console.log('[Demo] ✅ Demo user name fixed');
        }
    } catch (err) {
        console.error('[Demo] ensureDemoUser error:', err.message);
    }
}

async function handleDemoRoute(req, res, parsed) {
    if (req.method !== 'GET') return false;
    const pathname = parsed.pathname;

    const config = getConfig();
    if (!config.demomode) return false;

    // GET /demo — serve game HTML directly with uid+token in URL
    if (pathname === '/demo') {
        try {
            ensureDemoUser();

            const uid   = DEMO_TELEGRAM_ID;
            const token = generateDemoToken();

            // Read game HTML and serve it directly — no redirect, no auth check
            const htmlPath = path.join(__dirname, 'public', 'index.html');
            const html = fs.readFileSync(htmlPath, 'utf8');

            // Push uid+token into the page via a small inline script injected into <head>
            // so window.location.search works as if the URL had ?uid=...&token=...
            const injection = `<script>
(function(){
    var params = new URLSearchParams(window.location.search);
    if (!params.get('uid')) {
        var newUrl = window.location.pathname + '?uid=${uid}&token=${token}';
        window.history.replaceState(null, '', newUrl);
    }
})();
</script>`;
            const patched = html.replace('</head>', injection + '</head>');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(patched);
            return true;

        } catch (err) {
            console.error('[Demo] handleDemoRoute error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Demo error: ' + err.message);
            return true;
        }
    }

    return false;
}

// Patch botHandler.checkToken to accept demo token on all API calls
function patchBotHandlerForDemo(botHandler) {
    const config = getConfig();
    if (!config.demomode) return;

    const demoToken     = generateDemoToken();
    const originalCheck = botHandler.checkToken.bind(botHandler);

    botHandler.checkToken = function(telegramId, token) {
        if (String(telegramId) === String(DEMO_TELEGRAM_ID) && token === demoToken) {
            return true;
        }
        return originalCheck(telegramId, token);
    };

    console.log('[Demo] ✅ botHandler patched for demo token');
}

module.exports = { handleDemoRoute, patchBotHandlerForDemo, DEMO_TELEGRAM_ID };
