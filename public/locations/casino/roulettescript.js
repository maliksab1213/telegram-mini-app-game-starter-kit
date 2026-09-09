// Roulette Client
class RouletteClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.selectedChip = 10;
        this.currentRound = null;
        this.userBets = [];
        this.pollInterval = null;
        this.isActive = false;
        
        // Roulette numbers and colors
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
        
        console.log('[Roulette] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('roulette-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="roulette-back-btn">← Back</button>
                <div class="game-title">🎰 Roulette 🎡</div>
                <div class="coins-display">
                    <span id="roulette-user-coins">0</span>
                    <span>💰</span>
                </div>
            </div>

            <div class="timer-section">
                <div class="timer-label">Time Remaining</div>
                <div class="timer-value" id="timer-countdown">35</div>
                <div class="phase-label" id="phase-label">Place Your Bets!</div>
            </div>

            <div class="wheel-section">
                <div class="wheel-container">
                    <div class="wheel-display" id="wheel-display">
                        <div class="wheel-waiting">Waiting...</div>
                    </div>
                </div>
            </div>

            <div class="result-section d-none" id="result-section">
                <div class="result-text" id="result-text"></div>
            </div>

            <div class="betting-area">
                <div class="chips-section">
                    <div class="chips-label">Select Chip</div>
                    <div class="chips-scroll">
                        <button class="chip-btn active" data-value="10">
                            <span class="chip-icon">🔴</span>
                            <span class="chip-value">10</span>
                        </button>
                        <button class="chip-btn" data-value="20">
                            <span class="chip-icon">🟠</span>
                            <span class="chip-value">20</span>
                        </button>
                        <button class="chip-btn" data-value="100">
                            <span class="chip-icon">🟡</span>
                            <span class="chip-value">100</span>
                        </button>
                        <button class="chip-btn" data-value="200">
                            <span class="chip-icon">🟢</span>
                            <span class="chip-value">200</span>
                        </button>
                        <button class="chip-btn" data-value="500">
                            <span class="chip-icon">🔵</span>
                            <span class="chip-value">500</span>
                        </button>
                        <button class="chip-btn" data-value="1000">
                            <span class="chip-icon">🟣</span>
                            <span class="chip-value">1K</span>
                        </button>
                        <button class="chip-btn" data-value="2000">
                            <span class="chip-icon">⚫</span>
                            <span class="chip-value">2K</span>
                        </button>
                        <button class="chip-btn" data-value="5000">
                            <span class="chip-icon">⚪</span>
                            <span class="chip-value">5K</span>
                        </button>
                    </div>
                </div>

                <div class="bet-options">
                    <!-- Outside Bets -->
                    <div class="bet-category">
                        <div class="category-title">Outside Bets (2x Payout)</div>
                        <div class="bet-buttons">
                            <div class="bet-btn red" data-type="red" data-value="red">
                                <div class="bet-label">RED</div>
                                <div class="bet-payout">Pays 2:1</div>
                                <div class="bet-amount" data-bet="red">0</div>
                            </div>
                            <div class="bet-btn black" data-type="black" data-value="black">
                                <div class="bet-label">BLACK</div>
                                <div class="bet-payout">Pays 2:1</div>
                                <div class="bet-amount" data-bet="black">0</div>
                            </div>
                            <div class="bet-btn" data-type="odd" data-value="odd">
                                <div class="bet-label">ODD</div>
                                <div class="bet-payout">Pays 2:1</div>
                                <div class="bet-amount" data-bet="odd">0</div>
                            </div>
                            <div class="bet-btn" data-type="even" data-value="even">
                                <div class="bet-label">EVEN</div>
                                <div class="bet-payout">Pays 2:1</div>
                                <div class="bet-amount" data-bet="even">0</div>
                            </div>
                            <div class="bet-btn" data-type="low" data-value="low">
                                <div class="bet-label">1-18</div>
                                <div class="bet-payout">Pays 2:1</div>
                                <div class="bet-amount" data-bet="low">0</div>
                            </div>
                            <div class="bet-btn" data-type="high" data-value="high">
                                <div class="bet-label">19-36</div>
                                <div class="bet-payout">Pays 2:1</div>
                                <div class="bet-amount" data-bet="high">0</div>
                            </div>
                        </div>
                    </div>

                    <!-- Dozens -->
                    <div class="bet-category">
                        <div class="category-title">Dozens (3x Payout)</div>
                        <div class="bet-buttons">
                            <div class="bet-btn" data-type="dozen1" data-value="dozen1">
                                <div class="bet-label">1-12</div>
                                <div class="bet-payout">Pays 3:1</div>
                                <div class="bet-amount" data-bet="dozen1">0</div>
                            </div>
                            <div class="bet-btn" data-type="dozen2" data-value="dozen2">
                                <div class="bet-label">13-24</div>
                                <div class="bet-payout">Pays 3:1</div>
                                <div class="bet-amount" data-bet="dozen2">0</div>
                            </div>
                            <div class="bet-btn" data-type="dozen3" data-value="dozen3">
                                <div class="bet-label">25-36</div>
                                <div class="bet-payout">Pays 3:1</div>
                                <div class="bet-amount" data-bet="dozen3">0</div>
                            </div>
                        </div>
                    </div>

                    <!-- Columns -->
                    <div class="bet-category">
                        <div class="category-title">Columns (3x Payout)</div>
                        <div class="bet-buttons">
                            <div class="bet-btn" data-type="column1" data-value="column1">
                                <div class="bet-label">COL 1</div>
                                <div class="bet-payout">Pays 3:1</div>
                                <div class="bet-amount" data-bet="column1">0</div>
                            </div>
                            <div class="bet-btn" data-type="column2" data-value="column2">
                                <div class="bet-label">COL 2</div>
                                <div class="bet-payout">Pays 3:1</div>
                                <div class="bet-amount" data-bet="column2">0</div>
                            </div>
                            <div class="bet-btn" data-type="column3" data-value="column3">
                                <div class="bet-label">COL 3</div>
                                <div class="bet-payout">Pays 3:1</div>
                                <div class="bet-amount" data-bet="column3">0</div>
                            </div>
                        </div>
                    </div>

                    <!-- Straight Numbers -->
                    <div class="bet-category">
                        <div class="category-title">Straight Numbers (36x Payout)</div>
                        <div class="numbers-grid" id="numbers-grid"></div>
                    </div>
                </div>

                <div class="bets-summary">
                    <div class="summary-title">Total Bet</div>
                    <div class="summary-content">
                        <span class="summary-label">You bet:</span>
                        <span class="summary-value" id="total-bet">0</span>
                    </div>
                </div>
            </div>
        `;

        this.createNumbersGrid();
    }

    createNumbersGrid() {
        const grid = document.getElementById('numbers-grid');
        if (!grid) return;

        // Add 0 and 00
        const special = [0, '00'];
        special.forEach(num => {
            const btn = document.createElement('div');
            btn.className = `number-btn green`;
            btn.dataset.type = 'straight';
            btn.dataset.value = num;
            btn.innerHTML = `
                <div class="number-value">${num}</div>
                <div class="number-amount" data-bet="straight-${num}">0</div>
            `;
            grid.appendChild(btn);
        });

        // Add 1-36
        for (let i = 1; i <= 36; i++) {
            const color = this.numbers[i];
            const btn = document.createElement('div');
            btn.className = `number-btn ${color}`;
            btn.dataset.type = 'straight';
            btn.dataset.value = i;
            btn.innerHTML = `
                <div class="number-value">${i}</div>
                <div class="number-amount" data-bet="straight-${i}">0</div>
            `;
            grid.appendChild(btn);
        }
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[Roulette] Initializing...');
        this.isActive = true;
        
        await this.loadUserCoins();
        this.setupEventListeners();
        await this.loadRoundInfo();
        this.startPolling();
        
        console.log('[Roulette] ✅ Ready');
    }

    cleanup() {
        console.log('[Roulette] Cleaning up...');
        this.isActive = false;
        
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async loadUserCoins() {
        try {
            const response = await fetch(
                `/api/user/coins?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            const rouletteCoins = document.getElementById('roulette-user-coins');
            if (rouletteCoins) rouletteCoins.textContent = data.coins || 0;
            
        } catch (error) {
            console.error('[Roulette] Error loading coins:', error);
        }
    }

    setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('roulette-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (window.casinoManager) {
                    window.casinoManager.showMainView();
                }
            });
        }

        // Chip selection
        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedChip = parseInt(btn.dataset.value);
            });
        });

        // Betting buttons
        document.querySelectorAll('.bet-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const betType = btn.dataset.type;
                const betValue = btn.dataset.value;
                await this.placeBet(betType, betValue);
            });
        });

        // Number buttons
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const betType = btn.dataset.type;
                const betValue = btn.dataset.value;
                await this.placeBet(betType, betValue);
            });
        });
    }

    async loadRoundInfo() {
        if (!this.isActive) return;

        try {
            const response = await fetch(
                `/api/casino/roulette/round?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );

            if (response.status === 503) {
                this.showMaintenance();
                return;
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            
            if (data.success) {
                this.currentRound = data.round;
                this.userBets = data.userBets;
                this.updateUI();
            }
        } catch (error) {
            console.error('[Roulette] Error loading round:', error);
        }
    }

    startPolling() {
        this.pollInterval = setInterval(() => {
            if (this.isActive) {
                this.loadRoundInfo();
            }
        }, 1000);
    }

    updateUI() {
        if (!this.currentRound) return;

        // Timer
        const timerValue = document.getElementById('timer-countdown');
        if (timerValue) {
            timerValue.textContent = this.currentRound.timeRemaining;
            
            if (this.currentRound.timeRemaining <= 10) {
                timerValue.classList.add('warning');
            } else {
                timerValue.classList.remove('warning');
            }
        }

        // Phase
        const phaseLabel = document.getElementById('phase-label');
        if (phaseLabel) {
            if (this.currentRound.phase === 'betting') {
                phaseLabel.textContent = 'Place Your Bets!';
                phaseLabel.style.color = '#4ecdc4';
                this.enableBetting();
            } else if (this.currentRound.phase === 'spinning') {
                phaseLabel.textContent = 'No More Bets - Spinning...';
                phaseLabel.style.color = '#ffd700';
                this.disableBetting();
                this.spinWheel();
            } else if (this.currentRound.phase === 'results') {
                phaseLabel.textContent = 'Results!';
                phaseLabel.style.color = '#ff6b35';
                this.showResults();
            }
        }

        // Update bet amounts
        this.updateBetAmounts();
    }

    updateBetAmounts() {
        // Reset all displays
        document.querySelectorAll('[data-bet]').forEach(el => {
            el.textContent = '0';
            const parent = el.closest('.bet-btn, .number-btn');
            if (parent) parent.classList.remove('has-bet');
        });

        // Update with user bets
        let totalBet = 0;
        this.userBets.forEach(bet => {
            const { type, value, amount } = bet;
            totalBet += amount;

            if (type === 'straight') {
                const el = document.querySelector(`[data-bet="straight-${value}"]`);
                if (el) {
                    const current = parseInt(el.textContent) || 0;
                    el.textContent = current + amount;
                    const parent = el.closest('.number-btn');
                    if (parent) parent.classList.add('has-bet');
                }
            } else {
                const el = document.querySelector(`[data-bet="${type}"]`);
                if (el) {
                    const current = parseInt(el.textContent) || 0;
                    el.textContent = current + amount;
                    const parent = el.closest('.bet-btn');
                    if (parent) parent.classList.add('has-bet');
                }
            }
        });

        // Update total
        const totalEl = document.getElementById('total-bet');
        if (totalEl) totalEl.textContent = totalBet;
    }

    enableBetting() {
        document.querySelectorAll('.bet-btn, .number-btn').forEach(btn => {
            btn.classList.remove('disabled');
        });
    }

    disableBetting() {
        document.querySelectorAll('.bet-btn, .number-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
    }

    async placeBet(betType, betValue) {
        if (this.currentRound?.phase !== 'betting') {
            this.showNotification('Betting is closed!', 'error');
            return;
        }

        try {
            const response = await fetch(
                `/api/casino/roulette/bet?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        betType,
                        betValue,
                        amount: this.selectedChip
                    })
                }
            );

            const result = await response.json();

            if (result.success) {
                this.userBets.push({ type: betType, value: betValue, amount: this.selectedChip });
                this.updateBetAmounts();
                await this.loadUserCoins();
                this.showBetAnimation(betType, betValue);
                this.showNotification(`Bet placed: ${this.selectedChip} on ${betValue}`, 'success');
            } else {
                this.showNotification(result.message || 'Bet failed', 'error');
            }
        } catch (error) {
            console.error('[Roulette] Error placing bet:', error);
            this.showNotification('Failed to place bet', 'error');
        }
    }

    showBetAnimation(betType, betValue) {
        let selector;
        if (betType === 'straight') {
            selector = `.number-btn[data-value="${betValue}"]`;
        } else {
            selector = `.bet-btn[data-value="${betValue}"]`;
        }

        const el = document.querySelector(selector);
        if (el) {
            el.style.transform = 'scale(1.1)';
            setTimeout(() => {
                el.style.transform = 'scale(1)';
            }, 200);
        }
    }

    spinWheel() {
        const wheel = document.getElementById('wheel-display');
        if (wheel) {
            wheel.classList.add('wheel-spinning');
            wheel.innerHTML = '<div class="wheel-waiting">Spinning...</div>';
        }
    }

    showResults() {
        if (!this.currentRound || this.currentRound.winningNumber === null) return;

        const wheel = document.getElementById('wheel-display');
        const resultSection = document.getElementById('result-section');
        const resultText = document.getElementById('result-text');

        if (wheel) {
            wheel.classList.remove('wheel-spinning');
            const num = this.currentRound.winningNumber;
            const color = this.currentRound.winningColor;
            wheel.innerHTML = `<div class="wheel-number ${color}">${num}</div>`;
        }

        if (resultSection && resultText) {
            resultSection.classList.remove('d-none');

            const userWon = this.userBets.some(bet => this.checkIfWon(bet));
            
            if (userWon) {
                resultText.textContent = `🎉 ${this.currentRound.winningNumber} ${this.currentRound.winningColor.toUpperCase()}! YOU WON!`;
                resultText.className = 'result-text winner';
            } else if (this.userBets.length > 0) {
                resultText.textContent = `${this.currentRound.winningNumber} ${this.currentRound.winningColor.toUpperCase()}`;
                resultText.className = 'result-text';
            } else {
                resultText.textContent = `${this.currentRound.winningNumber} ${this.currentRound.winningColor.toUpperCase()}`;
                resultText.className = 'result-text';
            }

            setTimeout(() => {
                resultSection.classList.add('d-none');
            }, 5000);

            setTimeout(() => {
                this.loadUserCoins();
            }, 1000);
        }
    }

    checkIfWon(bet) {
        const { type, value } = bet;
        const winNum = this.currentRound.winningNumber;
        const winColor = this.currentRound.winningColor;
        const numValue = typeof winNum === 'string' ? (winNum === '00' ? -1 : parseInt(winNum)) : winNum;

        switch(type) {
            case 'straight':
                return value == winNum;
            case 'red':
                return winColor === 'red';
            case 'black':
                return winColor === 'black';
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

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'rgba(78, 205, 196, 0.9)' : 'rgba(255, 107, 107, 0.9)'};
            color: #fff;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showMaintenance() {
        if (window.casinoManager) {
            window.casinoManager.showMainView();
        }
        
        setTimeout(() => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            overlay.innerHTML = `
                <div style="text-align: center; padding: 40px; background: rgba(255, 255, 255, 0.1); border-radius: 20px; border: 2px solid rgba(255, 215, 0, 0.3);">
                    <h2 style="color: #ffd700; font-size: 2rem; margin-bottom: 15px;">⚠️ Game Maintenance</h2>
                    <p style="color: #ccc; font-size: 1.1rem; margin-bottom: 20px;">This game is currently under maintenance.</p>
                    <button onclick="this.parentElement.parentElement.remove()" style="background: linear-gradient(135deg, #ffd700, #ff8c00); border: none; border-radius: 10px; padding: 12px 30px; font-size: 1rem; font-weight: 700; color: #000; cursor: pointer;">
                        OK
                    </button>
                </div>
            `;

            document.body.appendChild(overlay);
        }, 100);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.rouletteClient = new RouletteClient();
});