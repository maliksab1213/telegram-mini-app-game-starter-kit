// Advanced Trading Chart System - Realistic Market Patterns
const fs = require('fs');
const path = require('path');

class ChartPatternEngine {
    constructor() {
        this.chartPath = path.join(__dirname, 'control', 'chart.json');
        this.patterns = {
            // Market phases
            BULL_MARKET: 'bull',      // Strong uptrend (days/weeks)
            BEAR_MARKET: 'bear',      // Strong downtrend (days/weeks)
            SIDEWAYS: 'sideways',     // Consolidation
            VOLATILE: 'volatile',     // High volatility
            RECOVERY: 'recovery',     // After crash
            CRASH: 'crash'            // Sudden drop
        };
        
        this.init();
    }

    init() {
        this.ensureChartConfig();
    }

    ensureChartConfig() {
        const controlDir = path.dirname(this.chartPath);
        if (!fs.existsSync(controlDir)) {
            fs.mkdirSync(controlDir, { recursive: true });
        }

        if (!fs.existsSync(this.chartPath)) {
            this.createDefaultChartConfig();
        }
    }

    createDefaultChartConfig() {
        const config = {
            lastUpdate: new Date().toISOString(),
            assets: {
                tech_corp: this.createAssetChart('tech_corp', 'BULL_MARKET'),
                auto_motors: this.createAssetChart('auto_motors', 'SIDEWAYS'),
                energy_plus: this.createAssetChart('energy_plus', 'VOLATILE'),
                food_chain: this.createAssetChart('food_chain', 'BEAR_MARKET'),
                pharma_med: this.createAssetChart('pharma_med', 'RECOVERY'),
                retail_store: this.createAssetChart('retail_store', 'SIDEWAYS'),
                bank_finance: this.createAssetChart('bank_finance', 'BULL_MARKET'),
                travel_air: this.createAssetChart('travel_air', 'VOLATILE')
            }
        };

        fs.writeFileSync(this.chartPath, JSON.stringify(config, null, 2));
        console.log('[ChartEngine] ✅ Created default chart config with realistic patterns');
    }

    createAssetChart(assetId, initialPhase) {
        const now = Date.now();
        
        return {
            assetId: assetId,
            currentPhase: initialPhase,
            phaseStartTime: now,
            phaseDuration: this.getRandomPhaseDuration(initialPhase), // milliseconds
            phaseProgress: 0,
            
            // Market sentiment (affects all movements)
            sentiment: this.getInitialSentiment(initialPhase), // -1.0 to 1.0
            sentimentMomentum: 0,
            
            // Volatility level
            volatility: this.getPhaseVolatility(initialPhase), // 0.0 to 1.0
            
            // Trend strength
            trendStrength: this.getTrendStrength(initialPhase), // 0.0 to 1.0
            
            // Support and resistance levels
            supportLevel: null,
            resistanceLevel: null,
            
            // Pattern tracking
            consecutiveUps: 0,
            consecutiveDowns: 0,
            lastMajorMove: 0,
            
            // News events (random market shocks)
            nextNewsEvent: now + this.getRandomNewsInterval(),
            newsImpact: 0,
            
            // Technical indicators
            rsi: 50, // Relative Strength Index (0-100)
            macd: 0, // Moving Average Convergence Divergence
            
            lastUpdate: new Date().toISOString()
        };
    }

    getRandomPhaseDuration(phase) {
        const durations = {
            BULL_MARKET: { min: 2, max: 7 },      // 2-7 days
            BEAR_MARKET: { min: 2, max: 5 },      // 2-5 days
            SIDEWAYS: { min: 1, max: 3 },         // 1-3 days
            VOLATILE: { min: 0.5, max: 2 },       // 12 hours - 2 days
            RECOVERY: { min: 1, max: 4 },         // 1-4 days
            CRASH: { min: 0.1, max: 0.5 }         // 2-12 hours
        };

        const range = durations[phase] || { min: 1, max: 3 };
        const days = range.min + Math.random() * (range.max - range.min);
        return days * 24 * 60 * 60 * 1000; // Convert to milliseconds
    }

    getInitialSentiment(phase) {
        const sentiments = {
            BULL_MARKET: 0.6 + Math.random() * 0.3,    // 0.6 to 0.9
            BEAR_MARKET: -0.6 - Math.random() * 0.3,   // -0.9 to -0.6
            SIDEWAYS: -0.2 + Math.random() * 0.4,      // -0.2 to 0.2
            VOLATILE: -0.5 + Math.random() * 1.0,      // -0.5 to 0.5
            RECOVERY: 0.3 + Math.random() * 0.4,       // 0.3 to 0.7
            CRASH: -0.9 + Math.random() * 0.1          // -1.0 to -0.9
        };

        return sentiments[phase] || 0;
    }

    getPhaseVolatility(phase) {
        const volatilities = {
            BULL_MARKET: 0.3 + Math.random() * 0.2,    // 0.3 to 0.5
            BEAR_MARKET: 0.4 + Math.random() * 0.3,    // 0.4 to 0.7
            SIDEWAYS: 0.1 + Math.random() * 0.2,       // 0.1 to 0.3
            VOLATILE: 0.7 + Math.random() * 0.3,       // 0.7 to 1.0
            RECOVERY: 0.5 + Math.random() * 0.2,       // 0.5 to 0.7
            CRASH: 0.9 + Math.random() * 0.1           // 0.9 to 1.0
        };

        return volatilities[phase] || 0.5;
    }

    getTrendStrength(phase) {
        const strengths = {
            BULL_MARKET: 0.7 + Math.random() * 0.2,    // 0.7 to 0.9
            BEAR_MARKET: 0.7 + Math.random() * 0.2,    // 0.7 to 0.9
            SIDEWAYS: 0.1 + Math.random() * 0.2,       // 0.1 to 0.3
            VOLATILE: 0.3 + Math.random() * 0.3,       // 0.3 to 0.6
            RECOVERY: 0.5 + Math.random() * 0.3,       // 0.5 to 0.8
            CRASH: 0.9 + Math.random() * 0.1           // 0.9 to 1.0
        };

        return strengths[phase] || 0.5;
    }

    getRandomNewsInterval() {
        // Random news event every 4-12 hours
        const hours = 4 + Math.random() * 8;
        return hours * 60 * 60 * 1000;
    }

    // Main function to calculate next price movement
    calculateNextMove(assetId, currentPrice, assetData) {
        const now = Date.now();
        const chart = this.loadChart();
        const assetChart = chart.assets[assetId];

        if (!assetChart) {
            return this.basicMove(currentPrice);
        }

        // Update phase progress
        const phaseElapsed = now - assetChart.phaseStartTime;
        assetChart.phaseProgress = Math.min(1.0, phaseElapsed / assetChart.phaseDuration);

        // Check if phase should end
        if (assetChart.phaseProgress >= 1.0) {
            this.transitionPhase(assetChart);
        }

        // Check for news events
        if (now >= assetChart.nextNewsEvent) {
            this.triggerNewsEvent(assetChart);
        }

        // Calculate price change based on current phase
        let priceChange = this.calculatePhaseBasedMove(assetChart, currentPrice);

        // Apply news impact
        priceChange += assetChart.newsImpact;
        assetChart.newsImpact *= 0.7; // Decay news impact

        // Update technical indicators
        this.updateTechnicalIndicators(assetChart, priceChange);

        // Update sentiment momentum
        this.updateSentiment(assetChart, priceChange);

        // Track consecutive moves
        if (priceChange > 0) {
            assetChart.consecutiveUps++;
            assetChart.consecutiveDowns = 0;
        } else if (priceChange < 0) {
            assetChart.consecutiveDowns++;
            assetChart.consecutiveUps = 0;
        }

        // Prevent extreme consecutive moves (mean reversion)
        if (assetChart.consecutiveUps > 5) {
            priceChange *= (1 - (assetChart.consecutiveUps - 5) * 0.15);
        } else if (assetChart.consecutiveDowns > 5) {
            priceChange *= (1 - (assetChart.consecutiveDowns - 5) * 0.15);
        }

        assetChart.lastUpdate = new Date().toISOString();
        this.saveChart(chart);

        return priceChange;
    }

    calculatePhaseBasedMove(assetChart, currentPrice) {
        const phase = assetChart.currentPhase;
        let baseMove = 0;

        switch (phase) {
            case 'BULL_MARKET':
                // Steady upward trend with occasional pullbacks
                baseMove = assetChart.sentiment * assetChart.trendStrength * 2.0;
                baseMove += (Math.random() - 0.3) * assetChart.volatility * 1.5;
                
                // Occasional profit-taking
                if (Math.random() < 0.15) {
                    baseMove -= Math.random() * 1.5;
                }
                break;

            case 'BEAR_MARKET':
                // Steady downward trend with occasional rallies
                baseMove = assetChart.sentiment * assetChart.trendStrength * 2.0;
                baseMove += (Math.random() - 0.7) * assetChart.volatility * 1.5;
                
                // Occasional dead cat bounce
                if (Math.random() < 0.15) {
                    baseMove += Math.random() * 1.5;
                }
                break;

            case 'SIDEWAYS':
                // Range-bound movement
                baseMove = (Math.random() - 0.5) * assetChart.volatility * 0.8;
                
                // Stay within range
                if (assetChart.supportLevel && currentPrice < assetChart.supportLevel * 1.02) {
                    baseMove += Math.random() * 1.0; // Bounce from support
                }
                if (assetChart.resistanceLevel && currentPrice > assetChart.resistanceLevel * 0.98) {
                    baseMove -= Math.random() * 1.0; // Reject at resistance
                }
                break;

            case 'VOLATILE':
                // High volatility, large swings
                const direction = Math.random() > 0.5 ? 1 : -1;
                baseMove = direction * (2 + Math.random() * 4) * assetChart.volatility;
                
                // Occasionally extreme moves
                if (Math.random() < 0.1) {
                    baseMove *= (1.5 + Math.random());
                }
                break;

            case 'RECOVERY':
                // Gradual recovery with volatility
                baseMove = Math.abs(assetChart.sentiment) * assetChart.trendStrength * 1.5;
                baseMove += (Math.random() - 0.4) * assetChart.volatility * 2.0;
                
                // Two steps forward, one step back
                if (Math.random() < 0.25) {
                    baseMove -= Math.random() * 2.0;
                }
                break;

            case 'CRASH':
                // Rapid decline
                baseMove = assetChart.sentiment * assetChart.trendStrength * 3.0;
                baseMove -= Math.random() * 3.0;
                
                // Panic selling
                if (Math.random() < 0.3) {
                    baseMove -= Math.random() * 4.0;
                }
                break;
        }

        // Apply RSI-based adjustments
        if (assetChart.rsi > 70) {
            // Overbought - likely reversal
            baseMove -= (assetChart.rsi - 70) * 0.1;
        } else if (assetChart.rsi < 30) {
            // Oversold - likely bounce
            baseMove += (30 - assetChart.rsi) * 0.1;
        }

        // Limit extreme moves
        baseMove = Math.max(-8, Math.min(8, baseMove));

        return baseMove;
    }

    transitionPhase(assetChart) {
        const currentPhase = assetChart.currentPhase;
        const now = Date.now();

        // Determine next phase based on current phase and probabilities
        const transitions = {
            BULL_MARKET: [
                { phase: 'BULL_MARKET', probability: 0.3 },
                { phase: 'SIDEWAYS', probability: 0.4 },
                { phase: 'VOLATILE', probability: 0.2 },
                { phase: 'BEAR_MARKET', probability: 0.1 }
            ],
            BEAR_MARKET: [
                { phase: 'BEAR_MARKET', probability: 0.3 },
                { phase: 'SIDEWAYS', probability: 0.3 },
                { phase: 'RECOVERY', probability: 0.25 },
                { phase: 'CRASH', probability: 0.15 }
            ],
            SIDEWAYS: [
                { phase: 'SIDEWAYS', probability: 0.3 },
                { phase: 'BULL_MARKET', probability: 0.25 },
                { phase: 'BEAR_MARKET', probability: 0.25 },
                { phase: 'VOLATILE', probability: 0.2 }
            ],
            VOLATILE: [
                { phase: 'VOLATILE', probability: 0.2 },
                { phase: 'SIDEWAYS', probability: 0.3 },
                { phase: 'BULL_MARKET', probability: 0.25 },
                { phase: 'BEAR_MARKET', probability: 0.25 }
            ],
            RECOVERY: [
                { phase: 'RECOVERY', probability: 0.2 },
                { phase: 'BULL_MARKET', probability: 0.4 },
                { phase: 'SIDEWAYS', probability: 0.3 },
                { phase: 'VOLATILE', probability: 0.1 }
            ],
            CRASH: [
                { phase: 'RECOVERY', probability: 0.5 },
                { phase: 'BEAR_MARKET', probability: 0.3 },
                { phase: 'VOLATILE', probability: 0.2 }
            ]
        };

        const possibleTransitions = transitions[currentPhase] || transitions.SIDEWAYS;
        const random = Math.random();
        let cumulative = 0;
        let nextPhase = 'SIDEWAYS';

        for (const transition of possibleTransitions) {
            cumulative += transition.probability;
            if (random <= cumulative) {
                nextPhase = transition.phase;
                break;
            }
        }

        console.log(`[ChartEngine] 🔄 ${assetChart.assetId}: ${currentPhase} → ${nextPhase}`);

        assetChart.currentPhase = nextPhase;
        assetChart.phaseStartTime = now;
        assetChart.phaseDuration = this.getRandomPhaseDuration(nextPhase);
        assetChart.phaseProgress = 0;
        assetChart.sentiment = this.getInitialSentiment(nextPhase);
        assetChart.volatility = this.getPhaseVolatility(nextPhase);
        assetChart.trendStrength = this.getTrendStrength(nextPhase);
    }

    triggerNewsEvent(assetChart) {
        const now = Date.now();
        
        // Random news impact (-5% to +5%)
        const impact = (Math.random() - 0.5) * 10;
        assetChart.newsImpact = impact;
        assetChart.nextNewsEvent = now + this.getRandomNewsInterval();

        const newsType = impact > 0 ? 'POSITIVE' : 'NEGATIVE';
        console.log(`[ChartEngine] 📰 ${assetChart.assetId}: ${newsType} news (${impact.toFixed(2)}%)`);
    }

    updateTechnicalIndicators(assetChart, priceChange) {
        // Update RSI (simplified)
        const rsiChange = priceChange > 0 ? 2 : -2;
        assetChart.rsi = Math.max(0, Math.min(100, assetChart.rsi + rsiChange));
        
        // Decay towards 50 (neutral)
        assetChart.rsi += (50 - assetChart.rsi) * 0.1;

        // Update MACD (simplified)
        assetChart.macd = (assetChart.macd * 0.8) + (priceChange * 0.2);
    }

    updateSentiment(assetChart, priceChange) {
        // Sentiment follows price with momentum
        const sentimentChange = priceChange * 0.05;
        assetChart.sentimentMomentum = (assetChart.sentimentMomentum * 0.7) + (sentimentChange * 0.3);
        assetChart.sentiment = Math.max(-1, Math.min(1, assetChart.sentiment + assetChart.sentimentMomentum));
    }

    basicMove(currentPrice) {
        // Fallback to basic random movement
        return (Math.random() - 0.5) * 3;
    }

    loadChart() {
        try {
            const data = fs.readFileSync(this.chartPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('[ChartEngine] Error loading chart:', error);
            this.createDefaultChartConfig();
            return this.loadChart();
        }
    }

    saveChart(chart) {
        try {
            chart.lastUpdate = new Date().toISOString();
            fs.writeFileSync(this.chartPath, JSON.stringify(chart, null, 2));
        } catch (error) {
            console.error('[ChartEngine] Error saving chart:', error);
        }
    }
}

module.exports = new ChartPatternEngine();