// Trading Price Update Engine - ADVANCED WITH CHART PATTERNS
const fs = require('fs');
const path = require('path');
const chartEngine = require('./chart_engine');

class TradingEngine {
    constructor() {
        this.isRunning = false;
        this.configPath = path.join(__dirname, 'control', 'trading.json');
        this.checkInterval = null;
        this.cleanupInterval = null;
    }

    start() {
        try {
            console.log('[TradingEngine] Starting...');
            
            this.ensureConfigExists();
            this.initializeAllAssets();

            this.isRunning = true;
            
            // Check every 5 minutes
            this.checkInterval = setInterval(() => {
                this.checkAndUpdatePrices();
            }, 5 * 60 * 1000);
            
            // Cleanup old data every hour
            this.cleanupInterval = setInterval(() => {
                this.cleanupOldData();
            }, 60 * 60 * 1000);
            
            // Initial check after 10 seconds
            setTimeout(() => {
                this.checkAndUpdatePrices();
            }, 10000);
            
            console.log('[TradingEngine] ✅ Started - checking every 5 minutes');
        } catch (error) {
            console.error('[TradingEngine] Failed to start:', error);
        }
    }

    stop() {
        this.isRunning = false;
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        console.log('[TradingEngine] Stopped');
    }

    ensureConfigExists() {
        const controlDir = path.dirname(this.configPath);
        if (!fs.existsSync(controlDir)) {
            fs.mkdirSync(controlDir, { recursive: true });
        }

        if (!fs.existsSync(this.configPath)) {
            this.createDefaultConfig();
        }
    }

    createDefaultConfig() {
        try {
            console.log('[TradingEngine] Creating default config...');
            
            const now = new Date().toISOString();
            
            const assets = [
                this.createAssetData('tech_corp', 'Tech Corp', 25000.00),
                this.createAssetData('auto_motors', 'Auto Motors', 18500.50),
                this.createAssetData('energy_plus', 'Energy Plus', 32100.75),
                this.createAssetData('food_chain', 'Food Chain', 12300.25),
                this.createAssetData('pharma_med', 'Pharma Med', 45600.00),
                this.createAssetData('retail_store', 'Retail Store', 9800.50),
                this.createAssetData('bank_finance', 'Bank Finance', 38900.25),
                this.createAssetData('travel_air', 'Travel Air', 15700.75)
            ];

            const config = {
                tradingApp: true,
                assets: assets
            };

            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
            console.log('[TradingEngine] ✅ Created default config with realistic values');
        } catch (error) {
            console.error('[TradingEngine] Error creating config:', error);
        }
    }

    createAssetData(id, name, basePrice) {
        const now = Date.now();
        
        // Generate realistic historical data
        const trendDirection = Math.random() > 0.5 ? 1 : -1;
        const volatility = 0.5 + (Math.random() * 2);
        
        const previous5 = basePrice * (1 + (trendDirection * (volatility * 5 / 100)));
        const previous4 = basePrice * (1 + (trendDirection * (volatility * 4 / 100)));
        const previous3 = basePrice * (1 + (trendDirection * (volatility * 3 / 100)));
        const previous2 = basePrice * (1 + (trendDirection * (volatility * 2 / 100)));
        const previous1 = basePrice * (1 + (trendDirection * (volatility * 1 / 100)));
        const previousPosition = basePrice;
        const currentPosition = basePrice * (1 + (trendDirection * (volatility * 0.5 / 100)));
        
        // 🔥 Use chart engine for next position
        const changePercent = chartEngine.calculateNextMove(id, currentPosition, {
            currentPosition: currentPosition.toFixed(2),
            previousPosition: previousPosition.toFixed(2),
            previous1: previous1.toFixed(2)
        });
        
        const nextPosition = currentPosition * (1 + changePercent / 100);
        
        // Next update: random 5-60 minutes
        const randomMinutes = 5 + Math.floor(Math.random() * 56);
        const nextUpdateTime = now + (randomMinutes * 60 * 1000);

        return {
            id: id,
            name: name,
            currentPosition: currentPosition.toFixed(2),
            previousPosition: previousPosition.toFixed(2),
            previous1: previous1.toFixed(2),
            previous2: previous2.toFixed(2),
            previous3: previous3.toFixed(2),
            previous4: previous4.toFixed(2),
            previous5: previous5.toFixed(2),
            nextPosition: Math.max(1, nextPosition).toFixed(2),
            lastUpdate: new Date().toISOString(),
            nextUpdate: new Date(nextUpdateTime).toISOString()
        };
    }

    initializeAllAssets() {
        try {
            const config = this.loadConfigFresh();
            if (!config || !config.assets) return;

            let needsSave = false;

            for (const asset of config.assets) {
                if (!asset.nextUpdate) {
                    const randomMinutes = 5 + Math.floor(Math.random() * 56);
                    const nextUpdateTime = Date.now() + (randomMinutes * 60 * 1000);
                    asset.nextUpdate = new Date(nextUpdateTime).toISOString();
                    needsSave = true;
                    console.log(`[TradingEngine] 🔧 Initialized ${asset.name} with next update in ${randomMinutes} minutes`);
                }

                if (!asset.previous1 || !asset.previous2) {
                    const current = parseFloat(asset.currentPosition);
                    asset.previous5 = asset.previous5 || current.toFixed(2);
                    asset.previous4 = asset.previous4 || current.toFixed(2);
                    asset.previous3 = asset.previous3 || current.toFixed(2);
                    asset.previous2 = asset.previous2 || current.toFixed(2);
                    asset.previous1 = asset.previous1 || current.toFixed(2);
                    asset.previousPosition = asset.previousPosition || current.toFixed(2);
                    needsSave = true;
                    console.log(`[TradingEngine] 🔧 Initialized previous values for ${asset.name}`);
                }

                if (!asset.nextPosition || asset.nextPosition === asset.currentPosition) {
                    // 🔥 Use chart engine
                    const changePercent = chartEngine.calculateNextMove(asset.id, parseFloat(asset.currentPosition), asset);
                    const nextPos = parseFloat(asset.currentPosition) * (1 + changePercent / 100);
                    asset.nextPosition = Math.max(1, nextPos).toFixed(2);
                    needsSave = true;
                    console.log(`[TradingEngine] 🔧 Calculated next position for ${asset.name}: ${asset.nextPosition}`);
                }
            }

            if (needsSave) {
                this.saveConfig(config);
                console.log('[TradingEngine] ✅ All assets initialized');
            }
        } catch (error) {
            console.error('[TradingEngine] Error initializing assets:', error);
        }
    }

    checkAndUpdatePrices() {
        if (!this.isRunning) return;

        try {
            console.log('[TradingEngine] 🔄 Running 5-minute check...');
            
            const config = this.loadConfigFresh();
            
            if (!config || !config.tradingApp || !config.assets) {
                console.log('[TradingEngine] Trading system disabled or no assets');
                return;
            }

            const now = Date.now();
            let updated = false;

            for (const asset of config.assets) {
                if (!asset.nextUpdate) {
                    const randomMinutes = 5 + Math.floor(Math.random() * 56);
                    asset.nextUpdate = new Date(now + (randomMinutes * 60 * 1000)).toISOString();
                    updated = true;
                    continue;
                }

                const nextUpdateTime = new Date(asset.nextUpdate).getTime();
                const overdueMs = now - nextUpdateTime;
                const overdueMinutes = Math.floor(overdueMs / (1000 * 60));

                if (overdueMinutes >= 1) {
                    console.log(`[TradingEngine] ⚡ Updating ${asset.name} (overdue by ${overdueMinutes} min)`);
                    this.updateAssetPrice(asset);
                    updated = true;
                }
            }

            if (updated) {
                this.saveConfig(config);
                console.log('[TradingEngine] ✅ Config saved');
            } else {
                console.log('[TradingEngine] ⏰ No updates needed yet');
            }

        } catch (error) {
            console.error('[TradingEngine] Error during check:', error);
        }
    }

    updateAssetPrice(asset) {
        try {
            const currentPosition = parseFloat(asset.currentPosition);
            const nextPosition = parseFloat(asset.nextPosition);

            // Shift previous positions
            asset.previous5 = asset.previous4 || asset.previous3 || currentPosition.toFixed(2);
            asset.previous4 = asset.previous3 || asset.previous2 || currentPosition.toFixed(2);
            asset.previous3 = asset.previous2 || asset.previous1 || currentPosition.toFixed(2);
            asset.previous2 = asset.previous1 || asset.previousPosition || currentPosition.toFixed(2);
            asset.previous1 = asset.previousPosition || currentPosition.toFixed(2);
            asset.previousPosition = asset.currentPosition;
            asset.currentPosition = nextPosition.toFixed(2);
            asset.lastUpdate = new Date().toISOString();

            // 🔥 Calculate NEW next position using chart engine
            const changePercent = chartEngine.calculateNextMove(asset.id, parseFloat(asset.currentPosition), asset);
            const newNextPosition = parseFloat(asset.currentPosition) * (1 + changePercent / 100);
            asset.nextPosition = Math.max(1, newNextPosition).toFixed(2);

            // Schedule next update
            const randomMinutes = 5 + Math.floor(Math.random() * 56);
            const nextUpdateTime = Date.now() + (randomMinutes * 60 * 1000);
            asset.nextUpdate = new Date(nextUpdateTime).toISOString();

            // Log change
            const change = ((parseFloat(asset.currentPosition) - parseFloat(asset.previousPosition)) / parseFloat(asset.previousPosition) * 100).toFixed(2);
            
            console.log(`[TradingEngine] 📊 ${asset.name}: ${asset.previousPosition} → ${asset.currentPosition} (${change > 0 ? '+' : ''}${change}%) | Next: ${asset.nextPosition} in ${randomMinutes}m`);
        } catch (error) {
            console.error(`[TradingEngine] Error updating ${asset.name}:`, error);
        }
    }

    cleanupOldData() {
        try {
            console.log('[TradingEngine] 🗑️ Running cleanup...');
            
            const db = require('./database');
            
            // Clean old positions (30+ days)
            db.cleanOldTradingPositions();
            
            // Clean old transactions (90+ days)
            db.cleanOldTradingTransactions();
            
            // 🔥 Clean old daily profits (3+ days)
            db.cleanOldDailyProfits();
            
            console.log('[TradingEngine] ✅ Cleanup completed');
        } catch (error) {
            console.error('[TradingEngine] Error during cleanup:', error);
        }
    }

    loadConfigFresh() {
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('[TradingEngine] Error loading config:', error);
            return null;
        }
    }

    saveConfig(config) {
        try {
            const controlDir = path.dirname(this.configPath);
            if (!fs.existsSync(controlDir)) {
                fs.mkdirSync(controlDir, { recursive: true });
            }

            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
        } catch (error) {
            console.error('[TradingEngine] Error saving config:', error);
        }
    }
}

module.exports = new TradingEngine();