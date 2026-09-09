// Tiger vs Dragon Game Module - Runs in background
const EventEmitter = require('events');

class TigerVsDragonGame extends EventEmitter {
    constructor(db, coinsAPI) {
        super();
        this.db = db;
        this.coinsAPI = coinsAPI;
        this.isRunning = false;
        this.currentRound = null;
        this.bets = new Map(); // telegram_id => { tiger: 0, dragon: 0, tie: 0 }
        
        // Card values
        this.cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        console.log('[TigerVsDragon] Module initialized');
    }

    start() {
        if (this.isRunning) {
            console.log('[TigerVsDragon] Already running');
            return;
        }

        this.isRunning = true;
        console.log('[TigerVsDragon] ✅ Game started');
        
        // Wait for next full minute
        this.waitForNextMinute();
    }

    waitForNextMinute() {
        const now = new Date();
        const seconds = now.getSeconds();
        
        if (seconds > 0) {
            const waitTime = (60 - seconds) * 1000;
            console.log(`[TigerVsDragon] ⏳ Waiting ${60 - seconds}s for next minute (${now.getHours()}:${String(now.getMinutes() + 1).padStart(2, '0')}:00)`);
            
            setTimeout(() => {
                this.startNewRound();
            }, waitTime);
        } else {
            this.startNewRound();
        }
    }

    startNewRound() {
        if (!this.isRunning) return;

        const now = new Date();
        const roundId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        
        this.currentRound = {
            id: roundId,
            startTime: now.getTime(),
            bettingEndTime: now.getTime() + 35000, // 35 seconds for betting
            resultsTime: now.getTime() + 40000, // 40 seconds total
            phase: 'betting',
            tigerCard: null,
            dragonCard: null,
            result: null
        };

        this.bets.clear();
        
        console.log(`[TigerVsDragon] 🎮 Round ${roundId} started at ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
        this.emit('roundStart', this.getRoundInfo());

        // End betting after 35 seconds
        setTimeout(() => {
            if (this.currentRound && this.currentRound.id === roundId) {
                this.endBetting();
            }
        }, 35000);
        
        // Show results after 40 seconds
        setTimeout(() => {
            if (this.currentRound && this.currentRound.id === roundId) {
                this.showResults();
            }
        }, 40000);
        
        // Start next round after 60 seconds
        setTimeout(() => {
            this.startNewRound();
        }, 60000);
    }

    endBetting() {
        if (!this.currentRound || this.currentRound.phase !== 'betting') return;
        
        this.currentRound.phase = 'waiting';
        console.log(`[TigerVsDragon] ⏱️ Betting closed for round ${this.currentRound.id}`);
        this.emit('bettingClosed', { roundId: this.currentRound.id });
    }

    showResults() {
        if (!this.currentRound || this.currentRound.phase !== 'waiting') return;

        // Draw cards
        const tigerCard = this.drawCard();
        const dragonCard = this.drawCard();
        
        this.currentRound.tigerCard = tigerCard;
        this.currentRound.dragonCard = dragonCard;
        
        // Determine winner
        const tigerValue = this.getCardValue(tigerCard);
        const dragonValue = this.getCardValue(dragonCard);
        
        let result;
        if (tigerValue > dragonValue) {
            result = 'tiger';
        } else if (dragonValue > tigerValue) {
            result = 'dragon';
        } else {
            result = 'tie';
        }
        
        this.currentRound.result = result;
        this.currentRound.phase = 'results';
        
        console.log(`[TigerVsDragon] 🎴 Results: Tiger=${tigerCard}(${tigerValue}) vs Dragon=${dragonCard}(${dragonValue}) = ${result.toUpperCase()}`);
        
        // Process bets
        this.processBets();
        
        this.emit('results', {
            roundId: this.currentRound.id,
            tigerCard,
            dragonCard,
            result
        });
    }

    drawCard() {
        return this.cards[Math.floor(Math.random() * this.cards.length)];
    }

    getCardValue(card) {
        if (card === 'A') return 1;
        if (card === 'J') return 11;
        if (card === 'Q') return 12;
        if (card === 'K') return 13;
        return parseInt(card);
    }

    placeBet(telegramId, position, amount) {
        if (!this.currentRound) {
            return { success: false, message: 'No active round' };
        }

        if (this.currentRound.phase !== 'betting') {
            return { success: false, message: 'Betting is closed' };
        }

        const now = Date.now();
        if (now > this.currentRound.bettingEndTime) {
            return { success: false, message: 'Time is up!' };
        }

        // Validate position
        if (!['tiger', 'dragon', 'tie'].includes(position)) {
            return { success: false, message: 'Invalid position' };
        }

        // Check coins
        const coinData = this.coinsAPI.getUserCoins(telegramId);
        if (coinData.coins < amount) {
            return { success: false, message: 'Not enough coins' };
        }

        // Get existing bets
        const existingBet = this.bets.get(telegramId) || { tiger: 0, dragon: 0, tie: 0 };
        existingBet[position] = (existingBet[position] || 0) + amount;
        this.bets.set(telegramId, existingBet);

        // Deduct coins
        this.coinsAPI.updateUserCoins(telegramId, {
            coins: coinData.coins - amount,
            total_words: coinData.total_words
        });

        console.log(`[TigerVsDragon] 💰 Bet: User ${telegramId} - ${position.toUpperCase()} - ${amount} coins`);

        return {
            success: true,
            roundId: this.currentRound.id,
            position,
            amount,
            timeRemaining: Math.max(0, Math.floor((this.currentRound.bettingEndTime - now) / 1000))
        };
    }

    processBets() {
        if (!this.currentRound || !this.currentRound.result) return;

        let totalWinners = 0;
        let totalPayout = 0;
        
        for (const [telegramId, userBets] of this.bets.entries()) {
            let userWon = 0;
            
            for (const [position, amount] of Object.entries(userBets)) {
                if (amount === 0) continue;
                
                let payout = 0;
                let result = 'loss';
                
                if (this.currentRound.result === position) {
                    if (position === 'tie') {
                        payout = amount * 5; // Tie pays 5x
                        result = 'win';
                    } else {
                        payout = amount * 2; // Tiger/Dragon pays 2x
                        result = 'win';
                    }
                    userWon += payout;
                }
                
                // Save bet to database
                this.db.casino.saveBet(
                    telegramId,
                    'tigervsdragon',
                    this.currentRound.id,
                    position,
                    amount,
                    result,
                    payout
                );
            }
            
            if (userWon > 0) {
                // Add winnings
                this.coinsAPI.addCoinsToUser(telegramId, userWon, 0);
                totalWinners++;
                totalPayout += userWon;
                console.log(`[TigerVsDragon] 🎉 Winner: User ${telegramId} won ${userWon} coins`);
            }
        }

        console.log(`[TigerVsDragon] 📊 Round complete: ${totalWinners} winners, ${totalPayout} coins paid`);
    }

    getRoundInfo() {
        if (!this.currentRound) return null;

        const now = Date.now();
        let timeRemaining = 0;
        
        if (this.currentRound.phase === 'betting') {
            timeRemaining = Math.max(0, Math.floor((this.currentRound.bettingEndTime - now) / 1000));
        } else if (this.currentRound.phase === 'waiting') {
            timeRemaining = Math.max(0, Math.floor((this.currentRound.resultsTime - now) / 1000));
        }

        return {
            roundId: this.currentRound.id,
            phase: this.currentRound.phase,
            timeRemaining,
            tigerCard: this.currentRound.tigerCard,
            dragonCard: this.currentRound.dragonCard,
            result: this.currentRound.result
        };
    }

    getUserBets(telegramId) {
        return this.bets.get(telegramId) || { tiger: 0, dragon: 0, tie: 0 };
    }

    stop() {
        this.isRunning = false;
        console.log('[TigerVsDragon] ❌ Game stopped');
    }
}

module.exports = TigerVsDragonGame;