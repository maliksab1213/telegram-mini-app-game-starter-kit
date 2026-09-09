// Games System Manager - Updated with Sequence Match & Shootout
const RockPaperGame = require('./games_modules/rockpaper');
const CoinFlipGame = require('./games_modules/coinflip');
const HeadTailsGame = require('./games_modules/headtails'); 
const GlassBallGame = require('./games_modules/glassball');
const FootballGame = require('./games_modules/football');
const HoleMoleGame = require('./games_modules/holemole');
const MemoryGame = require('./games_modules/memorygame');
const SequenceMatchGame = require('./games_modules/sequencematch');
const ShootoutGame = require('./games_modules/shootout');

class GamesManager {
    constructor(db) {
        this.db = db;
        this.games = {};
        
        console.log('[GamesManager] Initializing...');
        this.initializeGames();
    }

    initializeGames() {
        try {
            // Initialize Rock Paper Scissors
            this.games.rockpaper = new RockPaperGame(this.db);
            console.log('[GamesManager] ✅ Rock Paper Scissors initialized');

            // Initialize Coin Flip
            this.games.coinflip = new CoinFlipGame(this.db);
            console.log('[GamesManager] ✅ Coin Flip initialized');
            
            // Initialize Head & Tails
            this.games.headtails = new HeadTailsGame(this.db);
            console.log('[GamesManager] ✅ Head & Tails initialized');
            
            // Initialize Glass Ball
            this.games.glassball = new GlassBallGame(this.db);
            console.log('[GamesManager] ✅ Glass Ball initialized');

            // Initialize Football
            this.games.football = new FootballGame(this.db);
            console.log('[GamesManager] ✅ Football initialized');

            // Initialize Hole Mole
            this.games.holemole = new HoleMoleGame(this.db);
            console.log('[GamesManager] ✅ Hole Mole initialized');

            // Initialize Memory Game
            this.games.memorygame = new MemoryGame(this.db);
            console.log('[GamesManager] ✅ Memory Game initialized');

            // Initialize Sequence Match
            this.games.sequencematch = new SequenceMatchGame(this.db);
            console.log('[GamesManager] ✅ Sequence Match initialized');

            // Initialize Shootout
            this.games.shootout = new ShootoutGame(this.db);
            console.log('[GamesManager] ✅ Shootout initialized');

            console.log('[GamesManager] ✅ All games initialized');
        } catch (error) {
            console.error('[GamesManager] ❌ Initialization failed:', error);
            throw error;
        }
    }

    getGame(gameType) {
        return this.games[gameType] || null;
    }

    hasGame(gameType) {
        return !!this.games[gameType];
    }

    getAvailableGames() {
        return Object.keys(this.games);
    }

    cleanOldData() {
        try {
            this.db.games.cleanOldData();
            console.log('[GamesManager] 🗑️ Cleaned old data');
        } catch (error) {
            console.error('[GamesManager] Error cleaning old data:', error);
        }
    }
}

module.exports = GamesManager;