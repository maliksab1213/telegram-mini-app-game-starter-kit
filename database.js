// Main Database Manager - Fixed Version
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Import modular database components
const UsersDB = require('./database/users');
const CoinsDB = require('./database/coins');
const InventoryDB = require('./database/inventory');
const SelectedDB = require('./database/selected');
const RewardsDB = require('./database/rewards');
const SpinsDB = require('./database/spins');
const WriteStoryDB = require('./database/writestory');
const WalletDB = require('./database/wallet');
const TransactionsDB = require('./database/transactions');
const TravelSystemDB = require('./database/travelsystem');
const CasinoDB = require('./database/casino');
const TournamentDB = require('./database/tournament');
const TournamentRewardsDB = require('./database/tournament_rewards');
const TradingDB = require('./database/trading');
const GamesDB = require('./database/games');
const FriendsDB = require('./database/friends');
const TaskDB = require('./database/task');
const LevelDB = require('./database/level');

class DatabaseManager {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'game.db');
        this.db = null;
        
        // Modular components
        this.users = null;
        this.coins = null;
        this.inventory = null;
        this.selected = null;
        this.rewards = null;
        this.spins = null;
        this.writeStory = null;
        this.wallet = null;
        this.transactions = null;
        this.travelSystem = null;
        this.casino = null;
        this.tournament = null;
        this.tournamentRewards = null;
        this.trading = null;
        this.games = null;
        this.friends = null;
        this.tasks = null;
        this.level = null;
        
        this.init();
    }

    init() {
        try {
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new Database(this.dbPath);
            
            // Performance optimizations
            this.db.pragma('foreign_keys = OFF');
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 10000');
            this.db.pragma('temp_store = MEMORY');
            this.db.pragma('page_size = 4096');

            this.createTables();
            this.initializeModules();
            
            this.db.pragma('foreign_keys = ON');
            
            console.log('[DB] ✅ Database initialized successfully');
        } catch (error) {
            console.error('[DB] ❌ Init failed:', error);
            throw error;
        }
    }

    createTables() {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS users (
                    telegram_id INTEGER PRIMARY KEY,
                    unique_code TEXT UNIQUE NOT NULL,
                    name TEXT,
                    referred_by TEXT,
                    new_user INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_unique_code ON users(unique_code);
                CREATE INDEX IF NOT EXISTS idx_last_active ON users(last_active);
                
                CREATE TABLE IF NOT EXISTS user_coins (
                    telegram_id INTEGER PRIMARY KEY,
                    coins INTEGER DEFAULT 0,
                    total_words INTEGER DEFAULT 0,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_coins ON user_coins(coins DESC);
                
                CREATE TABLE IF NOT EXISTS user_inventory (
                    telegram_id INTEGER PRIMARY KEY,
                    level INTEGER DEFAULT 1,
                    max_slots INTEGER DEFAULT 10,
                    slots TEXT NOT NULL DEFAULT '[]',
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS user_selected (
                    telegram_id INTEGER PRIMARY KEY,
                    pen_id TEXT,
                    book_id TEXT,
                    ink_id TEXT,
                    book_words INTEGER DEFAULT 0,
                    ink_remaining INTEGER DEFAULT 0,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS daily_rewards (
                    telegram_id INTEGER PRIMARY KEY,
                    day_1_collected INTEGER DEFAULT 0,
                    day_2_collected INTEGER DEFAULT 0,
                    day_3_collected INTEGER DEFAULT 0,
                    day_4_collected INTEGER DEFAULT 0,
                    day_5_collected INTEGER DEFAULT 0,
                    day_6_collected INTEGER DEFAULT 0,
                    day_7_collected INTEGER DEFAULT 0,
                    last_collect_date TEXT,
                    streak_active INTEGER DEFAULT 0,
                    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_daily_rewards ON daily_rewards(telegram_id);
                
                CREATE TABLE IF NOT EXISTS daily_spins (
                    telegram_id INTEGER PRIMARY KEY,
                    tickets INTEGER DEFAULT 0,
                    free_ticket_collected INTEGER DEFAULT 0,
                    last_free_ticket_date TEXT,
                    total_spins INTEGER DEFAULT 0,
                    last_spin_date TEXT,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_daily_spins ON daily_spins(telegram_id);
                
                CREATE TABLE IF NOT EXISTS user_wallet (
                    telegram_id INTEGER PRIMARY KEY,
                    wallet_active INTEGER DEFAULT 0,
                    wallet_balance INTEGER DEFAULT 0,
                    wallet_level INTEGER DEFAULT 1,
                    wallet_max_capacity INTEGER DEFAULT 10000,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_wallet_active ON user_wallet(wallet_active);
                CREATE INDEX IF NOT EXISTS idx_wallet_balance ON user_wallet(wallet_balance DESC);
                
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    transaction_id TEXT UNIQUE NOT NULL,
                    item_name TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    delivery_fee INTEGER NOT NULL,
                    total_amount INTEGER NOT NULL,
                    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(telegram_id);
                CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
                CREATE INDEX IF NOT EXISTS idx_transactions_id ON transactions(transaction_id);
                
                CREATE TABLE IF NOT EXISTS user_travel_system (
                    telegram_id INTEGER PRIMARY KEY,
                    travelEnergy INTEGER DEFAULT 0,
                    vehicleMap TEXT,
                    last_travel_update DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_travel_energy ON user_travel_system(travelEnergy);
                CREATE INDEX IF NOT EXISTS idx_vehicle_map ON user_travel_system(vehicleMap);
                
                CREATE TABLE IF NOT EXISTS user_casino_stats (
                    telegram_id INTEGER PRIMARY KEY,
                    total_bets INTEGER DEFAULT 0,
                    total_wins INTEGER DEFAULT 0,
                    total_losses INTEGER DEFAULT 0,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_casino_stats ON user_casino_stats(telegram_id);

                CREATE TABLE IF NOT EXISTS casino_bets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    game_type TEXT NOT NULL,
                    round_id TEXT NOT NULL,
                    bet_position TEXT NOT NULL,
                    bet_amount INTEGER NOT NULL,
                    result TEXT NOT NULL,
                    payout INTEGER DEFAULT 0,
                    bet_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_casino_bets_user ON casino_bets(telegram_id);
                CREATE INDEX IF NOT EXISTS idx_casino_bets_round ON casino_bets(round_id);
                CREATE INDEX IF NOT EXISTS idx_casino_bets_date ON casino_bets(bet_date);

                CREATE TABLE IF NOT EXISTS user_tournament_selections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    tournament_date TEXT NOT NULL,
                    tournament_type TEXT NOT NULL,
                    round_number INTEGER NOT NULL,
                    selected_option TEXT NOT NULL,
                    result TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(telegram_id, tournament_date, tournament_type, round_number),
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_tournament_user ON user_tournament_selections(telegram_id);
                CREATE INDEX IF NOT EXISTS idx_tournament_date ON user_tournament_selections(tournament_date);
                CREATE INDEX IF NOT EXISTS idx_tournament_type ON user_tournament_selections(tournament_type);

                CREATE TABLE IF NOT EXISTS user_tournament_rewards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    tournament_date TEXT NOT NULL,
                    tournament_type TEXT NOT NULL,
                    round1_status TEXT DEFAULT 'pending',
                    round1_collected INTEGER DEFAULT 0,
                    round2_status TEXT DEFAULT 'pending',
                    round2_collected INTEGER DEFAULT 0,
                    round3_status TEXT DEFAULT 'pending',
                    round3_collected INTEGER DEFAULT 0,
                    bonus_collected INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(telegram_id, tournament_date, tournament_type),
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_tournament_rewards_user ON user_tournament_rewards(telegram_id);
                CREATE INDEX IF NOT EXISTS idx_tournament_rewards_date ON user_tournament_rewards(tournament_date);

                CREATE TABLE IF NOT EXISTS user_tournament_tickets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    tournament_date TEXT NOT NULL,
                    has_ticket INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(telegram_id, tournament_date),
                    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
                );

                CREATE INDEX IF NOT EXISTS idx_tournament_tickets_user ON user_tournament_tickets(telegram_id);
                CREATE INDEX IF NOT EXISTS idx_tournament_tickets_date ON user_tournament_tickets(tournament_date);
            `);
            
            console.log('[DB] ✅ Core tables created');
        } catch (error) {
            console.error('[DB] ❌ Table creation error:', error);
            throw error;
        }
    }

    initializeModules() {
        this.users = new UsersDB(this.db);
        this.coins = new CoinsDB(this.db);
        this.inventory = new InventoryDB(this.db);
        this.selected = new SelectedDB(this.db);
        this.rewards = new RewardsDB(this.db);
        this.spins = new SpinsDB(this.db);
        this.writeStory = new WriteStoryDB(this.db, this.inventory, this.selected, this.coins);
        this.wallet = new WalletDB(this.db);
        this.transactions = new TransactionsDB(this.db);
        this.travelSystem = new TravelSystemDB(this.db);
        this.casino = new CasinoDB(this.db);
        this.tournament = new TournamentDB(this.db);
        this.tournamentRewards = new TournamentRewardsDB(this.db);
        this.trading = new TradingDB(this.db);
        this.games = new GamesDB(this.db);
        this.friends = new FriendsDB(this.db);
        this.tasks = new TaskDB(this.db);
        this.level = new LevelDB(this.db);
        
        console.log('[DB] ✅ All modules initialized');
    }

    // ==================== USER OPERATIONS ====================
    
    getUser(telegramId) {
        return this.users.getUser(telegramId);
    }

    getUserByUniqueCode(uniqueCode) {
        return this.users.getUserByUniqueCode(uniqueCode);
    }

    createUser(telegramId, uniqueCode, name = null, referredBy = null) {
        const transaction = this.db.transaction(() => {
            try {
                this.users.createUser(telegramId, uniqueCode, name, referredBy);
                this.coins.setCoins(telegramId, 0, 0);
                this.inventory.createStarterInventoryWithEnergyDrink(telegramId);
                this.selected.createEmptySelected(telegramId);
                this.rewards.createDailyReward(telegramId);
                this.spins.createDailySpin(telegramId);
                this.wallet.createWallet(telegramId);
                this.travelSystem.initializeForNewUser(telegramId);
                this.level.getOrCreate(telegramId);
                
                console.log(`[DB] ✅ Created user: ${telegramId}`);
            } catch (error) {
                console.error('[DB] Error in createUser:', error);
                throw error;
            }
        });
        
        transaction();
        return this.getUser(telegramId);
    }

    updateUserName(telegramId, name) {
        return this.users.updateUserName(telegramId, name);
    }
    // ==================== NEW USERSS ====================
    
    addFriend(telegramId, friendTelegramId, friendName) {
    	return this.friends.addFriend(telegramId, friendTelegramId, friendName);
    }
    
    getFriends(telegramId) {
    	return this.friends.getFriends(telegramId);
    }
    
    getFriendCount(telegramId) {
    	return this.friends.getFriendCount(telegramId);
    }
    
    getReferrals(telegramId) {
    	return this.friends.getReferrals(telegramId);
    }
    // ==================== COINS OPERATIONS ====================
    
    getCoins(telegramId) {
        return this.coins.getCoins(telegramId);
    }

    setCoins(telegramId, coins, totalWords) {
        return this.coins.setCoins(telegramId, coins, totalWords);
    }

    addCoins(telegramId, amount, words = 0) {
        return this.coins.addCoins(telegramId, amount, words);
    }

    getLeaderboard(limit = 100) {
        return this.coins.getLeaderboard(limit);
    }

    // ==================== INVENTORY OPERATIONS ====================
    
    getInventory(telegramId) {
        return this.inventory.getInventory(telegramId);
    }

    updateInventory(telegramId, inventory) {
        return this.inventory.updateInventory(telegramId, inventory);
    }

    // ==================== SELECTED ITEMS ====================
    
    getSelected(telegramId) {
        return this.selected.getSelected(telegramId);
    }

    updateSelected(telegramId, selected) {
        return this.selected.updateSelected(telegramId, selected);
    }

    // ==================== WRITE STORY ====================
    
    performWrite(telegramId, wordsToWrite) {
        return this.writeStory.performWrite(telegramId, wordsToWrite);
    }

    // ==================== DAILY REWARDS ====================
    
    getDailyReward(telegramId) {
        return this.rewards.getDailyReward(telegramId);
    }

    collectDailyReward(telegramId, dayIndex) {
        return this.rewards.collectDailyReward(telegramId, dayIndex);
    }

    resetExpiredDailyRewards(telegramId) {
        return this.rewards.resetExpiredDailyRewards(telegramId);
    }

    // ==================== DAILY SPINS ====================
    
    getDailySpin(telegramId) {
        return this.spins.getDailySpin(telegramId);
    }

    collectFreeSpinTicket(telegramId) {
        return this.spins.collectFreeSpinTicket(telegramId);
    }

    performSpin(telegramId, rewardAmount) {
        return this.spins.performSpin(telegramId, rewardAmount);
    }

    // ==================== WALLET OPERATIONS ====================
    
    getWallet(telegramId) {
        return this.wallet.getWallet(telegramId);
    }

    activateWallet(telegramId) {
        return this.wallet.activateWallet(telegramId);
    }

    depositToWallet(telegramId, amount) {
        return this.wallet.deposit(telegramId, amount);
    }

    withdrawFromWallet(telegramId, amount) {
        return this.wallet.withdraw(telegramId, amount);
    }

    upgradeWallet(telegramId, newLevel, newCapacity, cost) {
        return this.wallet.upgrade(telegramId, newLevel, newCapacity, cost);
    }

    isWalletActive(telegramId) {
        return this.wallet.isWalletActive(telegramId);
    }

    getWalletBalance(telegramId) {
        return this.wallet.getWalletBalance(telegramId);
    }

    // ==================== TRANSACTION OPERATIONS ====================
    
    createTransaction(telegramId, transactionId, itemName, amount, deliveryFee) {
        return this.transactions.createTransaction(telegramId, transactionId, itemName, amount, deliveryFee);
    }

    getTransactions(telegramId) {
        return this.transactions.getTransactions(telegramId);
    }

    getTransactionById(transactionId) {
        return this.transactions.getTransactionById(transactionId);
    }

    // ==================== TRAVEL SYSTEM OPERATIONS ====================

    getTravelSystemInfo(telegramId) {
        return this.travelSystem.getTravelInfo(telegramId);
    }

    setTravelEnergy(telegramId, newEnergy) {
        return this.travelSystem.setTravelEnergy(telegramId, newEnergy);
    }

    addTravelEnergy(telegramId, energyAmount) {
        return this.travelSystem.addTravelEnergy(telegramId, energyAmount);
    }

    setVehicleMap(telegramId, vehicleId) {
        return this.travelSystem.setVehicleMap(telegramId, vehicleId);
    }

    deductEnergyForTravel(telegramId, energyRequired) {
        return this.travelSystem.deductEnergyForTravel(telegramId, energyRequired);
    }

    resetTravelEnergy(telegramId) {
        return this.travelSystem.resetTravelEnergy(telegramId);
    }

    // ================ CASINO OPERATIONS ====================

    getCasinoStats(telegramId) {
        return this.casino.getUserStats(telegramId);
    }

    saveCasinoBet(telegramId, gameType, roundId, betPosition, betAmount, result, payout) {
        return this.casino.saveBet(telegramId, gameType, roundId, betPosition, betAmount, result, payout);
    }

    getCasinoUserBets(telegramId, limit = 50) {
        return this.casino.getUserBets(telegramId, limit);
    }

    getCasinoTotalBetsByGame() {
        return this.casino.getTotalBetsByGame();
    }

    getCasinoDateWiseStats() {
        return this.casino.getDateWiseStats();
    }

    getCasinoDateWiseStatsByGame() {
        return this.casino.getDateWiseStatsByGame();
    }

    getCasinoTodayTotalBets() {
        return this.casino.getTodayTotalBets();
    }

    getCasinoTodayBetsByGame() {
        return this.casino.getTodayBetsByGame();
    }

    getTigerVsDragonToday() {
        return this.casino.getTigerVsDragonToday();
    }

    getTigerVsDragonDateWise() {
        return this.casino.getTigerVsDragonDateWise();
    }

    getRouletteToday() {
        return this.casino.getRouletteToday();
    }

    getRouletteDateWise() {
        return this.casino.getRouletteDateWise();
    }

    getBlackVsRedToday() {
        return this.casino.getBlackVsRedToday();
    }

    getBlackVsRedDateWise() {
        return this.casino.getBlackVsRedDateWise();
    }

    getBankerVsToday() {
        return this.casino.getBankerVsToday();
    }

    getBankerVsDateWise() {
        return this.casino.getBankerVsDateWise();
    }

    getCasinoOverview() {
        return this.casino.getCasinoOverview();
    }

    cleanOldCasinoBets() {
        return this.casino.cleanOldBets();
    }

    // ==================== TOURNAMENT OPERATIONS ====================

    saveTournamentSelection(telegramId, date, tournamentType, roundNumber, selection) {
        return this.tournament.saveTournamentSelection(telegramId, date, tournamentType, roundNumber, selection);
    }

    getTournamentSelection(telegramId, date, tournamentType, roundNumber) {
        return this.tournament.getTournamentSelection(telegramId, date, tournamentType, roundNumber);
    }

    getUserTournamentSelections(telegramId, date) {
        return this.tournament.getUserTournamentSelections(telegramId, date);
    }

    updateTournamentUserResult(telegramId, date, tournamentType, roundNumber, isWinner) {
        return this.tournament.updateTournamentUserResult(telegramId, date, tournamentType, roundNumber, isWinner);
    }

    getAllTournamentUsers(date, tournamentType, roundNumber) {
        return this.tournament.getAllTournamentUsers(date, tournamentType, roundNumber);
    }

    cleanOldTournamentData() {
        return this.tournament.cleanOldTournamentData();
    }

    getUserTournamentStats(telegramId) {
        return this.tournament.getUserTournamentStats(telegramId);
    }

    // ==================== TOURNAMENT REWARDS OPERATIONS ====================

    getUserTournamentRewards(telegramId, date, tournamentType) {
        return this.tournamentRewards.getUserTournamentRewards(telegramId, date, tournamentType);
    }

    updateRoundRewardStatus(telegramId, date, tournamentType, roundNumber, status) {
        return this.tournamentRewards.updateRoundRewardStatus(telegramId, date, tournamentType, roundNumber, status);
    }

    collectRoundReward(telegramId, date, tournamentType, roundNumber) {
        return this.tournamentRewards.collectRoundReward(telegramId, date, tournamentType, roundNumber);
    }

    collectTournamentBonus(telegramId, date, tournamentType) {
        try {
            const query = `
                UPDATE user_tournament_rewards
                SET bonus_collected = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ? AND tournament_date = ? AND tournament_type = ?
            `;
            
            const stmt = this.db.prepare(query);
            stmt.run(telegramId, date, tournamentType);
            
            console.log('[DB] ✅ Tournament bonus collected');
            return true;
        } catch (error) {
            console.error('[DB] Error collecting bonus:', error);
            return false;
        }
    }

    getAllUserTournamentRewards(telegramId) {
        return this.tournamentRewards.getAllUserRewardsHistory(telegramId);
    }

    cleanOldTournamentRewards() {
        return this.tournamentRewards.cleanOldRewards();
    }

    saveTournamentTicket(telegramId, date) {
        return this.tournament.saveTournamentTicket(telegramId, date);
    }

    getUserTicket(telegramId, date) {
        return this.tournament.getUserTicket(telegramId, date);
    }

    cleanOldTickets() {
        return this.tournament.cleanOldTickets();
    }

    // ==================== TRADING OPERATIONS ====================

    getTradingWallet(telegramId) {
        return this.trading.getTradingWallet(telegramId);
    }

    depositToTradingWallet(telegramId, amount) {
        return this.trading.depositToTradingWallet(telegramId, amount);
    }

    withdrawFromTradingWallet(telegramId, amount) {
        return this.trading.withdrawFromTradingWallet(telegramId, amount);
    }

    createTradingPosition(telegramId, assetId, assetName, investedAmount, entryPrice, expireDate) {
        return this.trading.createTradingPosition(telegramId, assetId, assetName, investedAmount, entryPrice, expireDate);
    }

    getTradingPosition(positionId) {
        return this.trading.getTradingPosition(positionId);
    }

    getUserTradingPositions(telegramId) {
        return this.trading.getUserTradingPositions(telegramId);
    }

    getAllActiveTradingPositions(assetId) {
        return this.trading.getAllActiveTradingPositions(assetId);
    }

    closeTradingPosition(positionId, exitPrice, profitLoss) {
        return this.trading.closeTradingPosition(positionId, exitPrice, profitLoss);
    }

    createTradingTransaction(telegramId, type, amount, fee, description) {
        return this.trading.createTradingTransaction(telegramId, type, amount, fee, description);
    }

    getTradingTransactions(telegramId) {
        return this.trading.getTradingTransactions(telegramId);
    }

    cleanOldTradingPositions() {
        return this.trading.cleanOldPositions();
    }

    cleanOldTradingTransactions() {
        return this.trading.cleanOldTransactions();
    }

    getUserDailyProfits(telegramId) {
        return this.trading.getUserDailyProfits(telegramId);
    }

    cleanOldDailyProfits() {
        return this.trading.cleanOldDailyProfits();
    }

    // ==================== UTILITY ====================
    
    close() {
        if (this.db) {
            this.db.close();
            console.log('[DB] Database closed');
        }
    }
}

module.exports = new DatabaseManager();