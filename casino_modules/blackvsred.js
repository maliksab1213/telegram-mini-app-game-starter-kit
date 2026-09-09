// Black vs Red Game Module - casino_modules/blackvsred.js
const EventEmitter = require('events');

class BlackVsRedGame extends EventEmitter {
    constructor(db, coinsAPI) {
        super();
        this.db = db;
        this.coinsAPI = coinsAPI;
        this.isRunning = false;
        this.currentRound = null;
        this.bets = new Map(); // telegram_id => { black: 0, red: 0, tie: 0, golden: 0 }
        
        // Cards setup - 3 cards each
        this.suits = {
            black: ['♠', '♣'],
            red: ['♥', '♦']
        };
        this.cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        console.log('[BlackVsRed] Module initialized');
    }

    start() {
        if (this.isRunning) {
            console.log('[BlackVsRed] Already running');
            return;
        }

        this.isRunning = true;
        console.log('[BlackVsRed] ✅ Game started');
        
        this.waitForNextMinute();
    }

    waitForNextMinute() {
        const now = new Date();
        const seconds = now.getSeconds();
        
        if (seconds > 0) {
            const waitTime = (60 - seconds) * 1000;
            console.log(`[BlackVsRed] ⏳ Waiting ${60 - seconds}s for next minute`);
            
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
            blackCards: [],
            redCards: [],
            result: null,
            isGolden: false
        };

        this.bets.clear();
        
        console.log(`[BlackVsRed] 🎮 Round ${roundId} started`);
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
        console.log(`[BlackVsRed] ⏱️ Betting closed for round ${this.currentRound.id}`);
        this.emit('bettingClosed', { roundId: this.currentRound.id });
    }

    drawCard(color) {
        const suit = this.suits[color][Math.floor(Math.random() * this.suits[color].length)];
        const card = this.cards[Math.floor(Math.random() * this.cards.length)];
        return `${card}${suit}`;
    }

    getCardValue(card) {
        const value = card.slice(0, -1);
        if (value === 'A') return 1;
        if (value === 'J') return 11;
        if (value === 'Q') return 12;
        if (value === 'K') return 13;
        return parseInt(value);
    }

    showResults() {
        if (!this.currentRound || this.currentRound.phase !== 'waiting') return;

        // Draw 3 cards for each side
        this.currentRound.blackCards = [
            this.drawCard('black'),
            this.drawCard('black'),
            this.drawCard('black')
        ];
        
        this.currentRound.redCards = [
            this.drawCard('red'),
            this.drawCard('red'),
            this.drawCard('red')
        ];
        
        // Calculate totals
        const blackTotal = this.currentRound.blackCards.reduce((sum, card) => sum + this.getCardValue(card), 0);
        const redTotal = this.currentRound.redCards.reduce((sum, card) => sum + this.getCardValue(card), 0);
        
        // Determine winner
        let result;
        if (blackTotal > redTotal) {
            result = 'black';
        } else if (redTotal > blackTotal) {
            result = 'red';
        } else {
            result = 'tie';
        }
        
        // Check for Golden (all cards same value)
        const blackValues = this.currentRound.blackCards.map(c => this.getCardValue(c));
        const redValues = this.currentRound.redCards.map(c => this.getCardValue(c));
        
        const blackGolden = blackValues[0] === blackValues[1] && blackValues[1] === blackValues[2];
        const redGolden = redValues[0] === redValues[1] && redValues[1] === redValues[2];
        
        this.currentRound.isGolden = blackGolden || redGolden;
        this.currentRound.result = result;
        this.currentRound.phase = 'results';
        
        console.log(`[BlackVsRed] 🎴 Results: Black=${blackTotal} vs Red=${redTotal} = ${result.toUpperCase()}${this.currentRound.isGolden ? ' (GOLDEN!)' : ''}`);
        
        this.processBets();
        
        this.emit('results', {
            roundId: this.currentRound.id,
            blackCards: this.currentRound.blackCards,
            redCards: this.currentRound.redCards,
            blackTotal,
            redTotal,
            result,
            isGolden: this.currentRound.isGolden
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

        if (!['black', 'red', 'tie', 'golden'].includes(position)) {
            return { success: false, message: 'Invalid position' };
        }

        const coinData = this.coinsAPI.getUserCoins(telegramId);
        if (coinData.coins < amount) {
            return { success: false, message: 'Not enough coins' };
        }

        const existingBet = this.bets.get(telegramId) || { black: 0, red: 0, tie: 0, golden: 0 };
        existingBet[position] = (existingBet[position] || 0) + amount;
        this.bets.set(telegramId, existingBet);

        this.coinsAPI.updateUserCoins(telegramId, {
            coins: coinData.coins - amount,
            total_words: coinData.total_words
        });

        console.log(`[BlackVsRed] 💰 Bet: User ${telegramId} - ${position.toUpperCase()} - ${amount} coins`);

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
                
                if (position === 'golden' && this.currentRound.isGolden) {
                    payout = amount * 10; // Golden pays 10x
                    result = 'win';
                } else if (this.currentRound.result === position) {
                    if (position === 'tie') {
                        payout = amount * 8; // Tie pays 8x
                    } else {
                        payout = amount * 2; // Black/Red pays 2x
                    }
                    result = 'win';
                }
                
                if (payout > 0) {
                    userWon += payout;
                }
                
                this.db.casino.saveBet(
                    telegramId,
                    'blackvsred',
                    this.currentRound.id,
                    position,
                    amount,
                    result,
                    payout
                );
            }
            
            if (userWon > 0) {
                this.coinsAPI.addCoinsToUser(telegramId, userWon, 0);
                totalWinners++;
                totalPayout += userWon;
                console.log(`[BlackVsRed] 🎉 Winner: User ${telegramId} won ${userWon} coins`);
            }
        }

        console.log(`[BlackVsRed] 📊 Round complete: ${totalWinners} winners, ${totalPayout} coins paid`);
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
            blackCards: this.currentRound.blackCards,
            redCards: this.currentRound.redCards,
            result: this.currentRound.result,
            isGolden: this.currentRound.isGolden
        };
    }

    getUserBets(telegramId) {
        return this.bets.get(telegramId) || { black: 0, red: 0, tie: 0, golden: 0 };
    }

    stop() {
        this.isRunning = false;
        console.log('[BlackVsRed] ❌ Game stopped');
    }
}

module.exports = BlackVsRedGame;