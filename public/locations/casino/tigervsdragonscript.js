// Tiger vs Dragon Client
class TigerVsDragonClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.selectedChip = 10;
        this.currentRound = null;
        this.userBets = { tiger: 0, dragon: 0, tie: 0 };
        this.pollInterval = null;
        this.isActive = false;
        
        console.log('[TigerVsDragon] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('tigervsdragon-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="game-back-btn">← Back</button>
                <div class="game-title">🐯 Tiger vs Dragon 🐲</div>
                <div class="coins-display">
                    <span id="game-user-coins">0</span>
                    <span>💰</span>
                </div>
            </div>

            <div class="timer-section">
                <div class="timer-label">Time Remaining</div>
                <div class="timer-value" id="timer-countdown">35</div>
                <div class="phase-label" id="phase-label">Place Your Bets!</div>
            </div>

            <div class="cards-section">
                <div class="card-slot tiger-slot">
                    <div class="slot-label">🐯 TIGER</div>
                    <div class="card-display" id="tiger-card">
                        <div class="card-back">?</div>
                    </div>
                </div>

                <div class="vs-divider">VS</div>

                <div class="card-slot dragon-slot">
                    <div class="slot-label">🐲 DRAGON</div>
                    <div class="card-display" id="dragon-card">
                        <div class="card-back">?</div>
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

                <div class="positions-grid">
                    <div class="bet-position tiger-position" data-position="tiger">
                        <div class="position-icon">🐯</div>
                        <div class="position-name">TIGER</div>
                        <div class="position-odds">2x</div>
                        <div class="position-bet" id="tiger-bet">0</div>
                    </div>

                    <div class="bet-position tie-position" data-position="tie">
                        <div class="position-icon">🤝</div>
                        <div class="position-name">TIE</div>
                        <div class="position-odds">5x</div>
                        <div class="position-bet" id="tie-bet">0</div>
                    </div>

                    <div class="bet-position dragon-position" data-position="dragon">
                        <div class="position-icon">🐲</div>
                        <div class="position-name">DRAGON</div>
                        <div class="position-odds">2x</div>
                        <div class="position-bet" id="dragon-bet">0</div>
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[TigerVsDragon] Initializing...');
        this.isActive = true;
        
        await this.loadUserCoins();
        this.setupEventListeners();
        await this.loadRoundInfo();
        this.startPolling();
        
        console.log('[TigerVsDragon] ✅ Ready');
    }

    cleanup() {
        console.log('[TigerVsDragon] Cleaning up...');
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
            
            const gameCoins = document.getElementById('game-user-coins');
            if (gameCoins) gameCoins.textContent = data.coins || 0;
            
        } catch (error) {
            console.error('[TigerVsDragon] Error loading coins:', error);
        }
    }

    setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('game-back-btn');
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

        // Betting positions
        document.querySelectorAll('.bet-position').forEach(pos => {
            pos.addEventListener('click', async () => {
                const position = pos.dataset.position;
                await this.placeBet(position);
            });
        });
    }

    async loadRoundInfo() {
        if (!this.isActive) return;

        try {
            const response = await fetch(
                `/api/casino/tigervsdragon/round?uid=${this.uid}&token=${this.token}`,
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
            console.error('[TigerVsDragon] Error loading round:', error);
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
            } else if (this.currentRound.phase === 'waiting') {
                phaseLabel.textContent = 'Betting Closed - Drawing Cards...';
                phaseLabel.style.color = '#ffd700';
                this.disableBetting();
            } else if (this.currentRound.phase === 'results') {
                phaseLabel.textContent = 'Results!';
                phaseLabel.style.color = '#ff6b35';
                this.showResults();
            }
        }

        // User bets
        const tigerBet = document.getElementById('tiger-bet');
        const dragonBet = document.getElementById('dragon-bet');
        const tieBet = document.getElementById('tie-bet');
        
        if (tigerBet) tigerBet.textContent = this.userBets.tiger || 0;
        if (dragonBet) dragonBet.textContent = this.userBets.dragon || 0;
        if (tieBet) tieBet.textContent = this.userBets.tie || 0;

        // Cards
        if (this.currentRound.tigerCard) {
            this.showCard('tiger', this.currentRound.tigerCard);
        } else {
            this.hideCard('tiger');
        }

        if (this.currentRound.dragonCard) {
            this.showCard('dragon', this.currentRound.dragonCard);
        } else {
            this.hideCard('dragon');
        }
    }

    enableBetting() {
        document.querySelectorAll('.bet-position').forEach(pos => {
            pos.classList.remove('disabled');
        });
    }

    disableBetting() {
        document.querySelectorAll('.bet-position').forEach(pos => {
            pos.classList.add('disabled');
        });
    }

    async placeBet(position) {
        if (this.currentRound?.phase !== 'betting') {
            this.showNotification('Betting is closed!', 'error');
            return;
        }

        try {
            const response = await fetch(
                `/api/casino/tigervsdragon/bet?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        position,
                        amount: this.selectedChip
                    })
                }
            );

            const result = await response.json();

            if (result.success) {
                this.userBets[position] = (this.userBets[position] || 0) + this.selectedChip;
                
                const betEl = document.getElementById(`${position}-bet`);
                if (betEl) betEl.textContent = this.userBets[position];
                
                await this.loadUserCoins();
                
                this.showBetAnimation(position);
                this.showNotification(`Bet placed: ${this.selectedChip} on ${position.toUpperCase()}`, 'success');
            } else {
                this.showNotification(result.message || 'Bet failed', 'error');
            }
        } catch (error) {
            console.error('[TigerVsDragon] Error placing bet:', error);
            this.showNotification('Failed to place bet', 'error');
        }
    }

    showBetAnimation(position) {
        const posEl = document.querySelector(`[data-position="${position}"]`);
        if (posEl) {
            posEl.style.transform = 'scale(1.1)';
            setTimeout(() => {
                posEl.style.transform = 'scale(1)';
            }, 200);
        }
    }

    showCard(side, card) {
        const cardEl = document.getElementById(`${side}-card`);
        if (cardEl) {
            cardEl.innerHTML = `<div class="card-value">${card}</div>`;
        }
    }

    hideCard(side) {
        const cardEl = document.getElementById(`${side}-card`);
        if (cardEl) {
            cardEl.innerHTML = '<div class="card-back">?</div>';
        }
    }

    showResults() {
        if (!this.currentRound || !this.currentRound.result) return;

        const resultSection = document.getElementById('result-section');
        const resultText = document.getElementById('result-text');

        if (!resultSection || !resultText) return;

        resultSection.classList.remove('d-none');

        const result = this.currentRound.result.toUpperCase();
        const userWon = this.userBets[this.currentRound.result] > 0;
        
        if (userWon) {
            resultText.textContent = `🎉 ${result} WINS! YOU WON!`;
            resultText.className = 'result-text winner';
        } else if (this.userBets.tiger + this.userBets.dragon + this.userBets.tie > 0) {
            resultText.textContent = `${result} WINS`;
            resultText.className = 'result-text loser';
        } else {
            resultText.textContent = `${result} WINS`;
            resultText.className = 'result-text';
        }

        setTimeout(() => {
            resultSection.classList.add('d-none');
        }, 5000);

        setTimeout(() => {
            this.loadUserCoins();
        }, 1000);
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
    window.tigerVsDragonClient = new TigerVsDragonClient();
});