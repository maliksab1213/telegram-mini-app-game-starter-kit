// newdomain.js
// Routes:
//   GET  /ajxdtx/button  — HTML page with switch button
//   POST /ajxdtx/switch  — stops current tunnel, starts new one, updates botconfig.json

const ngrokconfig = require('./ngrokconfig.json');

const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Domain Switcher</title>
</head>
<body>
<h2>Domain Switcher</h2>
<p>Click the button to disconnect current ngrok tunnel and get a new domain.</p>
<button id="btn" onclick="switchDomain()">Get New Domain</button>
<p id="result"></p>
<script>
async function switchDomain() {
    const btn = document.getElementById('btn');
    const result = document.getElementById('result');
    btn.disabled = true;
    btn.textContent = 'Switching...';
    result.textContent = '';
    try {
        const res = await fetch('/ajxdtx/switch', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            result.textContent = 'New domain: ' + data.newDomain;
            btn.textContent = 'Done';
        } else {
            result.textContent = 'Error: ' + data.error;
            btn.disabled = false;
            btn.textContent = 'Try Again';
        }
    } catch (e) {
        result.textContent = 'Request failed: ' + e.message;
        btn.disabled = false;
        btn.textContent = 'Try Again';
    }
}
</script>
</body>
</html>`;

async function handleNewDomainRoutes(req, res, parsed, ngrokManager, botHandler) {
    const pathname = parsed.pathname;

    // Only active if switchdomain: true in ngrokconfig.json
    if (!ngrokconfig.switchdomain) return false;

    // GET /ajxdtx/button — serve the HTML page
    if (pathname === '/ajxdtx/button' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(PAGE_HTML);
        return true;
    }

    // POST /ajxdtx/switch — do the switch
    if (pathname === '/ajxdtx/switch' && req.method === 'POST') {
        try {
            console.log('[NewDomain] Stopping current tunnel...');

            // Stop current tunnel + monitoring (uses ngrokManager.stop())
            await ngrokManager.stop();

            console.log('[NewDomain] Starting new tunnel...');

            // Re-initialize with same port (ngrokManager.port is saved from first initialize call)
            const success = await ngrokManager.initialize(ngrokManager.port);

            if (!success) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Failed to start new ngrok tunnel' }));
                return true;
            }

            // ngrokManager.tunnel holds the new public URL (set inside startTunnel)
            const newDomain = ngrokManager.tunnel;
            console.log('[NewDomain] New domain:', newDomain);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, newDomain }));
            return true;

        } catch (err) {
            console.error('[NewDomain] Switch error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
            return true;
        }
    }

    return false;
}

module.exports = handleNewDomainRoutes;
