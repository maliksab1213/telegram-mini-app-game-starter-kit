const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const config = require("./botconfig.json");
const TelegramBotHandler = require("./telegram-bot");
const NgrokManager = require("./ngrok-manager");
const { generateStructure } = require('./structure_maker');

// Import all route handlers
const handleUserRoutes = require("./routes/user.routes");
const handleNewUserRoutes = require('./routes/new.routes');
const handleCoinsRoutes = require("./routes/coins.routes");
const handleInventoryRoutes = require("./routes/inventory.routes");
const handleTransactionsRoutes = require("./routes/transactions.routes");
const handleStoreRoutes = require("./routes/store.routes");
const handleRewardsRoutes = require("./routes/rewards.routes");
const handleLeaderboardRoutes = require("./routes/leaderboard.routes");
const handlePhoneRoutes = require("./routes/phone.routes");
const handleMapSystemRoutes = require("./routes/mapsystem.routes"); 
const handleTravelSystemRoutes = require("./routes/travelsystem.routes"); 
const handleCasinoRoutes = require("./routes/casino.routes");
const handleTigerVsDragonRoutes = require("./casino_games/tigervsdragon.routes");
const handleRouletteRoutes = require("./casino_games/roulette.routes");
const handleBlackVsRedRoutes = require("./casino_games/blackvsred.routes");
const handleBankerVsRoutes = require("./casino_games/bankervs.routes");
const handleTournamentRoutes = require("./routes/tournament.routes");
const handleTradingRoutes = require("./routes/trading.routes");
const handleGamesRoutes = require("./routes/games.routes");
const handleRockPaperRoutes = require("./games/rockpaper.routes");
const handleCoinFlipRoutes = require("./games/coinflip.routes");
const handleHeadTailsRoutes = require("./games/headtails.routes");
const handleGlassBallRoutes = require("./games/glassball.routes");
const handleFootballRoutes = require("./games/football.routes");
const handleHoleMoleRoutes = require("./games/holemole.routes");
const handleMemoryGameRoutes = require("./games/memorygame.routes");
const handleSequenceMatchRoutes = require("./games/sequencematch.routes");
const handleShootoutRoutes = require("./games/shootout.routes");
const handleTaskRoutes = require('./routes/tasks.routes');
const handleLevelRoutes = require('./routes/level.routes');
const handleNewDomainRoutes = require('./newdomain');
const { handleDemoRoute, patchBotHandlerForDemo } = require('./demo');

// Import game modules
const TigerVsDragonGame = require("./casino_modules/tigervsdragon");
const RouletteGame = require("./casino_modules/roulette");
const BlackVsRedGame = require("./casino_modules/blackvsred");
const BankerVsGame = require("./casino_modules/bankervs");
const tournamentModule = require("./tournament_module");
const tradingEngine = require('./trading_engine');
const casinoAPI = require("./casino_api");
const GamesManager = require('./games_manager');
const taskManager = require('./task_manager');

const ngrokManager = new NgrokManager();
const botHandler = new TelegramBotHandler();
patchBotHandlerForDemo(botHandler);
let tigerVsDragonGame = null;
let rouletteGame = null;
let blackVsRedGame = null;
let bankerVsGame = null;
let gamesManager = null;

// ==================== HELPER FUNCTIONS ====================

async function initializeTournamentSystem() {
    try {
        console.log('[Tournament] Initializing system...');
        tournamentModule.start();
        console.log('[Tournament] ✅ System started');
    } catch (error) {
        console.error('[Tournament] ❌ Failed to initialize:', error);
    }
}

async function initializeGamesSystem() {
    try {
        console.log('[Games] Initializing system...');
        const db = require('./database');
        gamesManager = new GamesManager(db);
        global.gamesManager = gamesManager;
        console.log('[Games] ✅ System started');
    } catch (error) {
        console.error('[Games] ❌ Failed to initialize:', error);
    }
}

async function initializeTradingSystem() {
    try {
        console.log('[Trading] Initializing system...');
        await tradingEngine.start();
        console.log('[Trading] ✅ System started');
    } catch (error) {
        console.error('[Trading] ❌ Failed to initialize:', error);
    }
}

async function initializeCasinoSystem() {
    try {
        console.log('[Casino] Initializing system...');
        
        const config = await casinoAPI.loadConfig();
        console.log('[Casino] Config loaded:', config);
        
        const db = require('./database');
        const { getUserCoins, updateUserCoins, addCoinsToUser } = require('./apis');
        
        if (config.tigervsdragon !== false) {
            tigerVsDragonGame = new TigerVsDragonGame(db, {
                getUserCoins,
                updateUserCoins,
                addCoinsToUser
            });
            
            tigerVsDragonGame.start();
            global.tigerVsDragonGame = tigerVsDragonGame;
            
            console.log('[Casino] ✅ Tiger vs Dragon game started');
        } else {
            console.log('[Casino] ⏸️ Tiger vs Dragon is disabled');
        }
        
        if (config.roulette !== false) {
            rouletteGame = new RouletteGame(db, {
                getUserCoins,
                updateUserCoins,
                addCoinsToUser
            });
            
            rouletteGame.start();
            global.rouletteGame = rouletteGame;
            
            console.log('[Casino] ✅ Roulette game started');
        } else {
            console.log('[Casino] ⏸️ Roulette is disabled');
        }
        
        if (config.blackvsred !== false) {
            blackVsRedGame = new BlackVsRedGame(db, {
                getUserCoins,
                updateUserCoins,
                addCoinsToUser
            });
            
            blackVsRedGame.start();
            global.blackVsRedGame = blackVsRedGame;
            
            console.log('[Casino] ✅ Black vs Red game started');
        } else {
            console.log('[Casino] ⏸️ Black vs Red is disabled');
        }
        
        if (config.bankervs !== false) {
            bankerVsGame = new BankerVsGame(db, {
                getUserCoins,
                updateUserCoins,
                addCoinsToUser
            });
            
            bankerVsGame.start();
            global.bankerVsGame = bankerVsGame;
            
            console.log('[Casino] ✅ Banker vs Player game started');
        } else {
            console.log('[Casino] ⏸️ Banker vs Player is disabled');
        }
    } catch (error) {
        console.error('[Casino] ❌ Failed to initialize:', error);
    }
}

async function initializeTaskSystem() {
    try {
        console.log('[Tasks] Initializing system...');
        await taskManager.start();
        console.log('[Tasks] ✅ System started');
    } catch (error) {
        console.error('[Tasks] ❌ Failed to initialize:', error);
    }
}

async function serveNewUserPage(req, res, parsed) {
    const { uid, token, ref } = parsed.query;
    const { checkUserAccess } = require("./apis");

    if (!uid || !token) {
        await serveWarningPage(res);
        return;
    }

    const hasAccess = await checkUserAccess(uid, token, botHandler);
    if (!hasAccess) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        return res.end("Access denied");
    }

    // Check if user already has name - if yes, redirect to /game
    try {
        const db = require('./database');
        const user = db.getUser(uid);
        
        if (user && user.name && user.new_user === 0) {
            console.log(`[Server] User already registered, redirecting to /game`);
            res.writeHead(302, { 
                'Location': `/game?uid=${uid}&token=${token}` 
            });
            return res.end();
        }
    } catch (error) {
        console.error('[Server] Error checking user status:', error);
    }

    try {
        const htmlPath = path.join(__dirname, "public", "new.html");
        const data = await fs.promises.readFile(htmlPath, "utf8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
    } catch (err) {
        console.error("Error loading new user page:", err);
        res.writeHead(500);
        res.end("Error loading page");
    }
}

async function serveWarningPage(res) {
  try {
    const warningPath = path.join(__dirname, "others", "warning.html");
    let warningData = await fs.promises.readFile(warningPath, "utf8");
    
    warningData = warningData.replace(/\{\{BOT_NAME\}\}/g, config.bot.name);
    warningData = warningData.replace(/\{\{BOT_USERNAME\}\}/g, config.bot.username);
    
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(warningData);
  } catch (err) {
    console.error("Error serving warning page:", err);
    const fallbackHtml = `<!DOCTYPE html><html><head><title>Access Restricted</title></head><body><h1>Access Restricted</h1><p>This game can only be accessed through our official Telegram bot.</p></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fallbackHtml);
  }
}

async function serveWebappPage(res) {
  try {
    const webappPath = path.join(__dirname, "others", "webapp.html");
    let webappData = await fs.promises.readFile(webappPath, "utf8");
    
    webappData = webappData.replace(/\{\{BOT_NAME\}\}/g, config.bot.name);
    webappData = webappData.replace(/\{\{BOT_USERNAME\}\}/g, config.bot.username);
    
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(webappData);
  } catch (err) {
    console.error("Error serving webapp page:", err);
    const fallbackHtml = `<!DOCTYPE html><html><head><title>Welcome</title></head><body><h1>Welcome to ${config.bot.name}</h1></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fallbackHtml);
  }
}

async function serveGamePage(req, res, parsed) {
  const { uid, token } = parsed.query;
  const { checkUserAccess } = require("./apis");

  if (!uid || !token) {
    await serveWarningPage(res);
    return;
  }

  const hasAccess = await checkUserAccess(uid, token, botHandler);
  if (!hasAccess) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    return res.end(config.messages.access_denied);
  }

  // Check if user is new - if yes, redirect to /new
  try {
    const db = require('./database');
    const user = db.getUser(uid);
    
    if (!user || !user.name || user.new_user === 1) {
      console.log(`[Server] New user detected, redirecting to /new`);
      res.writeHead(302, { 
        'Location': `/new?uid=${uid}&token=${token}` 
      });
      return res.end();
    }
  } catch (error) {
    console.error('[Server] Error checking user status:', error);
  }

  try {
    const htmlPath = path.join(__dirname, "public", "index.html");
    const data = await fs.promises.readFile(htmlPath, "utf8");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  } catch (err) {
    console.error("Error loading game:", err);
    res.writeHead(500);
    res.end(config.messages.server_error);
  }
}

async function serveStaticFile(pathname, res) {
  const filePath = path.join(__dirname, pathname);
  
  try {
    await fs.promises.access(filePath);
    const data = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    const contentTypes = {
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.html': 'text/html',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    
    const contentType = contentTypes[ext] || 'text/plain';
    
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
    
  } catch (err) {
    console.error(`File not found: ${pathname}`);
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("File not found");
  }
}

// ==================== MAIN SERVER ====================

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // ==================== SPECIAL ROUTES ====================

  // Demo mode route
  if (pathname === "/demo") {
    const handled = await handleDemoRoute(req, res, parsed);
    if (handled) return;
  }

  if (pathname === "/webapp") {
    await serveWebappPage(res);
    return;
  }

  if (pathname === "/game") {
    await serveGamePage(req, res, parsed);
    return;
  }
  
  if (pathname === "/new") {
    await serveNewUserPage(req, res, parsed);
    return;
}

  if (pathname.startsWith('/public/') || pathname === '/styles.css') {
    await serveStaticFile(pathname === '/styles.css' ? 'public/styles.css' : pathname, res);
    return;
  }

  // ==================== LOCATION ROUTES ====================

  if (pathname.startsWith('/locations/')) {
    const pathParts = pathname.replace('/locations/', '').split('/');
    const locationName = pathParts[0];
    const fileName = pathParts.slice(1).join('/') || 'index.html';
    
    console.log(`[Server] 📂 Location: ${locationName}, File: ${fileName}`);
    
    const { uid, token, loc_token } = parsed.query;
    
    const isHtmlFile = fileName.endsWith('.html') || fileName === 'index.html' || pathParts.length === 1;
    
    if (isHtmlFile) {
        if (!uid || !token || !loc_token) {
            console.log('[Server] ❌ Missing auth params');
            await serveWarningPage(res);
            return;
        }
        
        const { checkUserAccess } = require("./apis");
        const hasAccess = await checkUserAccess(uid, token, botHandler);
        
        if (!hasAccess) {
            console.log('[Server] ❌ Access denied');
            res.writeHead(403, { "Content-Type": "text/plain" });
            return res.end("Access Denied");
        }
    }
    
    try {
        const locationFilePath = path.join(__dirname, 'public', 'locations', locationName, fileName);
        
        console.log(`[Server] 📂 Serving: ${locationFilePath}`);
        
        await fs.promises.access(locationFilePath);
        
        const data = await fs.promises.readFile(locationFilePath);
        const ext = path.extname(locationFilePath).toLowerCase();
        
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        
        console.log(`[Server] ✅ Serving ${fileName} as ${contentType}`);
        
        res.writeHead(200, { 
            "Content-Type": contentType,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        });
        res.end(data);
        return;
        
    } catch (err) {
        console.error(`[Server] ❌ File not found: ${fileName}`, err.message);
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("File not found: " + fileName);
        return;
    }
  }

  // ==================== DOMAIN SWITCHER ====================
  if (pathname.startsWith("/ajxdtx/")) {
    const handled = await handleNewDomainRoutes(req, res, parsed, ngrokManager, botHandler);
    if (handled) return;
  }

  // ==================== API ROUTES ====================

  if (pathname.startsWith('/api/')) {
    try {
      // ✅ FIXED: Added handleHoleMoleRoutes and handleMemoryGameRoutes
      const handlers = [
        handleUserRoutes,
        handleCoinsRoutes,
        handleNewUserRoutes,
        handleUserRoutes,
        handleInventoryRoutes,
        handleStoreRoutes,
        handleRewardsRoutes,
        handleLeaderboardRoutes,
        handlePhoneRoutes,
        handleMapSystemRoutes,
        handleTravelSystemRoutes,
        handleTransactionsRoutes,
        handleCasinoRoutes,
        handleTigerVsDragonRoutes,
        handleRouletteRoutes,
        handleBlackVsRedRoutes,
        handleBankerVsRoutes,
        handleTournamentRoutes,
        handleTradingRoutes,
        handleGamesRoutes,
        handleRockPaperRoutes,
        handleCoinFlipRoutes,
        handleHeadTailsRoutes,
        handleGlassBallRoutes,
        handleFootballRoutes,
        handleHoleMoleRoutes,
        handleMemoryGameRoutes,
        handleSequenceMatchRoutes,
        handleShootoutRoutes,
        handleLevelRoutes,
        handleTaskRoutes,
      ];

      for (const handler of handlers) {
        const handled = await handler(req, res, parsed, botHandler);
        if (handled) return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "API endpoint not found" }));
      return;

    } catch (error) {
      console.error("API Error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
      return;
    }
  }

  // ==================== DEFAULT ====================
  
  await serveWarningPage(res);
});

// ==================== SERVER STARTUP ====================

const PORT = process.env.PORT || config.server.port;

async function startServer() {
  try {
    server.listen(PORT, async () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Bot: ${config.bot.name}`);
      console.log(`Local URL: http://localhost:${PORT}`);
      
      await initializeTournamentSystem();
      await initializeTradingSystem();
      await initializeCasinoSystem();
      await initializeGamesSystem();
      await initializeTaskSystem();
      generateStructure(__dirname);
      
      const ngrokSuccess = await ngrokManager.initialize(PORT);
      
      if (ngrokSuccess) {
        console.log('\nApplication started successfully with ngrok tunnel!');
        ngrokManager.printStatus();
      } else {
        console.log('\nApplication started successfully (ngrok disabled/failed)');
        console.log(`Using configured domain: ${config.server.domain}`);
      }
    });

    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT. Graceful shutdown...');
      tradingEngine.stop();
      tournamentModule.stop();
      taskManager.stop();
      if (tigerVsDragonGame) tigerVsDragonGame.stop();
      if (rouletteGame) rouletteGame.stop();
      if (blackVsRedGame) blackVsRedGame.stop();
      if (bankerVsGame) bankerVsGame.stop();
      if (gamesManager) gamesManager.cleanOldData();
      await ngrokManager.stop();
      server.close(() => {
          console.log('Server closed');
          process.exit(0);
      });
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM. Graceful shutdown...');
      tradingEngine.stop();
      tournamentModule.stop();
      taskManager.stop();
      if (tigerVsDragonGame) tigerVsDragonGame.stop();
      if (rouletteGame) rouletteGame.stop();
      if (blackVsRedGame) blackVsRedGame.stop();
      if (bankerVsGame) bankerVsGame.stop();
      if (gamesManager) gamesManager.cleanOldData();
      await ngrokManager.stop();
      server.close(() => {
          console.log('Server closed');
          process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();