// Roulette Game Module - Runs in background
const EventEmitter = require('events');

class RouletteGame extends EventEmitter {
    constructor(db, coinsAPI) {
        super();
        this.db = db;
        this.coinsAPI = coinsAPI;
        this.isRunning = false;
        this.currentRound = null;
        this.bets = new Map(); // telegram_id => [{type, value, amount}]
        
        // Roulette numbers with colors (European/American with double zero)
        this.numbers = {
            0: 'green',
            '00': 'green',
            1: 'red', 2: 'black', 3: 'red', 4: 'black', 5: 'red', 6: 'black',
            7: 'red', 8: 'black', 9: 'red', 10: 'black', 11: 'black', 12: 'red',
            13: 'black', 14: 'red', 15: 'black', 16: 'red', 17: 'black', 18: 'red',
            19: 'red', 20: 'black', 21: 'red', 22: 'black', 23: 'red', 24: 'black',
            25: 'red', 26: 'black', 27: 'red', 28: 'black', 29: 'black', 30: 'red',
            31: 'black', 32: 'red', 33: 'black', 34: 'red', 35: 'black', 36: 'red'
        };
        
        this.wheel = [0, '00', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 
                      16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 
                      31, 32, 33, 34, 35, 36];
        
        console.log('[Roulette] Module initialized');
    }

    start() {
        if (this.isRunning) {
            console.log('[Roulette] Already running');
            return;
        }

        this.isRunning = true;
        console.log('[Roulette] ✅ Game started');
        
        this.waitForNextMinute();
    }

    waitForNextMinute() {
        const now = new Date();
        const seconds = now.getSeconds();
        
        if (seconds > 0) {
            const waitTime = (60 - seconds) * 1000;
            console.log(`[Roulette] ⏳ Waiting ${60 - seconds}s for next minute (${now.getHours()}:${String(now.getMinutes() + 1).padStart(2, '0')}:00)`);
            
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
            winningNumber: null
        };

        this.bets.clear();
        
        console.log(`[Roulette] 🎰 Round ${roundId} started at ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
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
        
        this.currentRound.phase = 'spinning';
        console.log(`[Roulette] ⏱️ Betting closed for round ${this.currentRound.id}`);
        this.emit('bettingClosed', { roundId: this.currentRound.id });
    }

    showResults() {
        if (!this.currentRound || this.currentRound.phase !== 'spinning') return;

        // Spin wheel
        const winningNumber = this.spin();
        this.currentRound.winningNumber = winningNumber;
        this.currentRound.phase = 'results';
        
        const color = this.numbers[winningNumber];
        console.log(`[Roulette] 🎡 Result: ${winningNumber} (${color.toUpperCase()})`);
        
        // Process bets
        this.processBets();
        
        this.emit('results', {
            roundId: this.currentRound.id,
            winningNumber,
            color
        });
    }

    spin() {
        return this.wheel[Math.floor(Math.random() * this.wheel.length)];
    }

    placeBet(telegramId, betType, betValue, amount) {
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

        // Validate bet
        if (!this.validateBet(betType, betValue)) {
            return { success: false, message: 'Invalid bet' };
        }

        // Check coins
        const coinData = this.coinsAPI.getUserCoins(telegramId);
        if (coinData.coins < amount) {
            return { success: false, message: 'Not enough coins' };
        }

        // Store bet
        const userBets = this.bets.get(telegramId) || [];
        userBets.push({ type: betType, value: betValue, amount });
        this.bets.set(telegramId, userBets);

        // Deduct coins
        this.coinsAPI.updateUserCoins(telegramId, {
            coins: coinData.coins - amount,
            total_words: coinData.total_words
        });

        console.log(`[Roulette] 💰 Bet: User ${telegramId} - ${betType}:${betValue} - ${amount} coins`);

        return {
            success: true,
            roundId: this.currentRound.id,
            betType,
            betValue,
            amount,
            timeRemaining: Math.max(0, Math.floor((this.currentRound.bettingEndTime - now) / 1000))
        };
    }

    validateBet(betType, betValue) {
        const validTypes = ['straight', 'red', 'black', 'odd', 'even', 'low', 'high', 'dozen1', 'dozen2', 'dozen3', 'column1', 'column2', 'column3'];
        
        if (!validTypes.includes(betType)) return false;
        
        if (betType === 'straight') {
            return this.wheel.includes(betValue);
        }
        
        return true;
    }

    processBets() {
        if (!this.currentRound || this.currentRound.winningNumber === null) return;

        const winningNumber = this.currentRound.winningNumber;
        const winningColor = this.numbers[winningNumber];
        
        let totalWinners = 0;
        let totalPayout = 0;
        
        for (const [telegramId, userBets] of this.bets.entries()) {
            let userTotalWon = 0;
            
            for (const bet of userBets) {
                const { type, value, amount } = bet;
                let payout = 0;
                let result = 'loss';
                
                const isWinner = this.checkWin(type, value, winningNumber, winningColor);
                
                if (isWinner) {
                    const multiplier = this.getPayoutMultiplier(type);
                    payout = amount * multiplier;
                    result = 'win';
                    userTotalWon += payout;
                }
                
                // Save bet to database
                this.db.casino.saveBet(
                    telegramId,
                    'roulette',
                    this.currentRound.id,
                    `${type}:${value}`,
                    amount,
                    result,
                    payout
                );
            }
            
            if (userTotalWon > 0) {
                // Add winnings
                this.coinsAPI.addCoinsToUser(telegramId, userTotalWon, 0);
                totalWinners++;
                totalPayout += userTotalWon;
                console.log(`[Roulette] 🎉 Winner: User ${telegramId} won ${userTotalWon} coins`);
            }
        }

        console.log(`[Roulette] 📊 Round complete: ${totalWinners} winners, ${totalPayout} coins paid`);
    }

    checkWin(betType, betValue, winningNumber, winningColor) {
        const numValue = typeof winningNumber === 'string' ? (winningNumber === '00' ? -1 : parseInt(winningNumber)) : winningNumber;
        
        switch(betType) {
            case 'straight':
                return betValue === winningNumber;
            case 'red':
                return winningColor === 'red';
            case 'black':
                return winningColor === 'black';
            case 'odd':
                return numValue > 0 && numValue % 2 === 1;
            case 'even':
                return numValue > 0 && numValue % 2 === 0;
            case 'low':
                return numValue >= 1 && numValue <= 18;
            case 'high':
                return numValue >= 19 && numValue <= 36;
            case 'dozen1':
                return numValue >= 1 && numValue <= 12;
            case 'dozen2':
                return numValue >= 13 && numValue <= 24;
            case 'dozen3':
                return numValue >= 25 && numValue <= 36;
            case 'column1':
                return numValue > 0 && (numValue - 1) % 3 === 0;
            case 'column2':
                return numValue > 0 && (numValue - 2) % 3 === 0;
            case 'column3':
                return numValue > 0 && numValue % 3 === 0;
            default:
                return false;
        }
    }

    getPayoutMultiplier(betType) {
        const payouts = {
            'straight': 36,      // Single number
            'red': 2,           // Red
            'black': 2,         // Black
            'odd': 2,           // Odd
            'even': 2,          // Even
            'low': 2,           // 1-18
            'high': 2,          // 19-36
            'dozen1': 3,        // 1st dozen
            'dozen2': 3,        // 2nd dozen
            'dozen3': 3,        // 3rd dozen
            'column1': 3,       // 1st column
            'column2': 3,       // 2nd column
            'column3': 3        // 3rd column
        };
        
        return payouts[betType] || 1;
    }

    getRoundInfo() {
        if (!this.currentRound) return null;

        const now = Date.now();
        let timeRemaining = 0;
        
        if (this.currentRound.phase === 'betting') {
            timeRemaining = Math.max(0, Math.floor((this.currentRound.bettingEndTime - now) / 1000));
        } else if (this.currentRound.phase === 'spinning') {
            timeRemaining = Math.max(0, Math.floor((this.currentRound.resultsTime - now) / 1000));
        }

        return {
            roundId: this.currentRound.id,
            phase: this.currentRound.phase,
            timeRemaining,
            winningNumber: this.currentRound.winningNumber,
            winningColor: this.currentRound.winningNumber !== null ? this.numbers[this.currentRound.winningNumber] : null
        };
    }

    getUserBets(telegramId) {
        return this.bets.get(telegramId) || [];
    }

    stop() {
        this.isRunning = false;
        console.log('[Roulette] ❌ Game stopped');
    }
}

module.exports = RouletteGame;