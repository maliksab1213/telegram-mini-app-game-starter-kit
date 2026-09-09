// Banker vs Player Game Module - casino_modules/bankervs.js
const EventEmitter = require('events');

class BankerVsGame extends EventEmitter {
    constructor(db, coinsAPI) {
        super();
        this.db = db;
        this.coinsAPI = coinsAPI;
        this.isRunning = false;
        this.currentRound = null;
        this.bets = new Map(); // telegram_id => { banker: 0, player: 0, tie: 0 }
        
        // Standard deck of cards
        this.suits = ['♠', '♥', '♦', '♣'];
        this.cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        console.log('[BankerVs] Module initialized');
    }

    start() {
        if (this.isRunning) {
            console.log('[BankerVs] Already running');
            return;
        }

        this.isRunning = true;
        console.log('[BankerVs] ✅ Game started');
        
        this.waitForNextMinute();
    }

    waitForNextMinute() {
        const now = new Date();
        const seconds = now.getSeconds();
        
        if (seconds > 0) {
            const waitTime = (60 - seconds) * 1000;
            console.log(`[BankerVs] ⏳ Waiting ${60 - seconds}s for next minute`);
            
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
            bettingEndTime: now.getTime() + 35000,
            resultsTime: now.getTime() + 40000,
            phase: 'betting',
            bankerCards: [],
            playerCards: [],
            result: null,
            bankerTotal: 0,
            playerTotal: 0
        };

        this.bets.clear();
        
        console.log(`[BankerVs] 🎮 Round ${roundId} started`);
        this.emit('roundStart', this.getRoundInfo());

        setTimeout(() => {
            if (this.currentRound && this.currentRound.id === roundId) {
                this.endBetting();
            }
        }, 35000);
        
        setTimeout(() => {
            if (this.currentRound && this.currentRound.id === roundId) {
                this.showResults();
            }
        }, 40000);
        
        setTimeout(() => {
            this.startNewRound();
        }, 60000);
    }

    endBetting() {
        if (!this.currentRound || this.currentRound.phase !== 'betting') return;
        
        this.currentRound.phase = 'waiting';
        console.log(`[BankerVs] ⏱️ Betting closed for round ${this.currentRound.id}`);
        this.emit('bettingClosed', { roundId: this.currentRound.id });
    }

    drawCard() {
        const suit = this.suits[Math.floor(Math.random() * this.suits.length)];
        const card = this.cards[Math.floor(Math.random() * this.cards.length)];
        return `${card}${suit}`;
    }

    getCardValue(card) {
        const value = card.slice(0, -1);
        if (value === 'A') return 1;
        if (['J', 'Q', 'K'].includes(value)) return 0; // Baccarat rules
        return parseInt(value);
    }

    calculateTotal(cards) {
        const sum = cards.reduce((total, card) => total + this.getCardValue(card), 0);
        return sum % 10; // Baccarat rules - only last digit counts
    }

    showResults() {
        if (!this.currentRound || this.currentRound.phase !== 'waiting') return;

        // Deal initial 2 cards to each
        this.currentRound.bankerCards = [this.drawCard(), this.drawCard()];
        this.currentRound.playerCards = [this.drawCard(), this.drawCard()];
        
        let bankerTotal = this.calculateTotal(this.currentRound.bankerCards);
        let playerTotal = this.calculateTotal(this.currentRound.playerCards);
        
        // Third card rules (simplified Baccarat)
        if (playerTotal <= 5 && bankerTotal < 8) {
            this.currentRound.playerCards.push(this.drawCard());
            playerTotal = this.calculateTotal(this.currentRound.playerCards);
        }
        
        if (bankerTotal <= 5 && playerTotal < 8) {
            this.currentRound.bankerCards.push(this.drawCard());
            bankerTotal = this.calculateTotal(this.currentRound.bankerCards);
        }
        
        this.currentRound.bankerTotal = bankerTotal;
        this.currentRound.playerTotal = playerTotal;
        
        // Determine winner
        let result;
        if (bankerTotal > playerTotal) {
            result = 'banker';
        } else if (playerTotal > bankerTotal) {
            result = 'player';
        } else {
            result = 'tie';
        }
        
        this.currentRound.result = result;
        this.currentRound.phase = 'results';
        
        console.log(`[BankerVs] 🎴 Results: Banker=${bankerTotal} vs Player=${playerTotal} = ${result.toUpperCase()}`);
        
        this.processBets();
        
        this.emit('results', {
            roundId: this.currentRound.id,
            bankerCards: this.currentRound.bankerCards,
            playerCards: this.currentRound.playerCards,
            bankerTotal,
            playerTotal,
            result
        });
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

        if (!['banker', 'player', 'tie'].includes(position)) {
            return { success: false, message: 'Invalid position' };
        }

        const coinData = this.coinsAPI.getUserCoins(telegramId);
        if (coinData.coins < amount) {
            return { success: false, message: 'Not enough coins' };
        }

        const existingBet = this.bets.get(telegramId) || { banker: 0, player: 0, tie: 0 };
        existingBet[position] = (existingBet[position] || 0) + amount;
        this.bets.set(telegramId, existingBet);

        this.coinsAPI.updateUserCoins(telegramId, {
            coins: coinData.coins - amount,
            total_words: coinData.total_words
        });

        console.log(`[BankerVs] 💰 Bet: User ${telegramId} - ${position.toUpperCase()} - ${amount} coins`);

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
                        payout = amount * 8; // Tie pays 8x
                    } else if (position === 'banker') {
                        payout = amount * 1.95; // Banker pays 1.95x (5% commission)
                    } else {
                        payout = amount * 2; // Player pays 2x
                    }
                    result = 'win';
                }
                
                if (payout > 0) {
                    userWon += Math.floor(payout);
                }
                
                this.db.casino.saveBet(
                    telegramId,
                    'bankervs',
                    this.currentRound.id,
                    position,
                    amount,
                    result,
                    Math.floor(payout)
                );
            }
            
            if (userWon > 0) {
                this.coinsAPI.addCoinsToUser(telegramId, userWon, 0);
                totalWinners++;
                totalPayout += userWon;
                console.log(`[BankerVs] 🎉 Winner: User ${telegramId} won ${userWon} coins`);
            }
        }

        console.log(`[BankerVs] 📊 Round complete: ${totalWinners} winners, ${totalPayout} coins paid`);
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
            bankerCards: this.currentRound.bankerCards,
            playerCards: this.currentRound.playerCards,
            bankerTotal: this.currentRound.bankerTotal,
            playerTotal: this.currentRound.playerTotal,
            result: this.currentRound.result
        };
    }

    getUserBets(telegramId) {
        return this.bets.get(telegramId) || { banker: 0, player: 0, tie: 0 };
    }

    stop() {
        this.isRunning = false;
        console.log('[BankerVs] ❌ Game stopped');
    }
}

module.exports = BankerVsGame;