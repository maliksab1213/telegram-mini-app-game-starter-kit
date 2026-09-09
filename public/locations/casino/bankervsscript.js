// Banker vs Player Client - public/locations/casino/bankervsscript.js
class BankerVsClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.selectedChip = 10;
        this.currentRound = null;
        this.userBets = { banker: 0, player: 0, tie: 0 };
        this.pollInterval = null;
        this.isActive = false;
        
        console.log('[BankerVs] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('bankervs-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="bankervs-back-btn">← Back</button>
                <div class="game-title">🏦 Banker vs Player 👤</div>
                <div class="coins-display">
                    <span id="bankervs-user-coins">0</span>
                    <span>💰</span>
                </div>
            </div>

            <div class="timer-section">
                <div class="timer-label">Time Remaining</div>
                <div class="timer-value" id="bankervs-timer">35</div>
                <div class="phase-label" id="bankervs-phase">Place Your Bets!</div>
            </div>

            <div class="cards-section">
                <div class="card-slot banker-slot">
                    <div class="slot-label">🏦 BANKER</div>
                    <div class="cards-display" id="banker-cards">
                        <div class="card-display"><div class="card-back">?</div></div>
                        <div class="card-display"><div class="card-back">?</div></div>
                    </div>
                    <div class="total-display" id="banker-total" style="visibility: hidden;">0</div>
                </div>

                <div class="vs-divider">VS</div>

                <div class="card-slot player-slot">
                    <div class="slot-label">👤 PLAYER</div>
                    <div class="cards-display" id="player-cards">
                        <div class="card-display"><div class="card-back">?</div></div>
                        <div class="card-display"><div class="card-back">?</div></div>
                    </div>
                    <div class="total-display" id="player-total" style="visibility: hidden;">0</div>
                </div>
            </div>

            <div class="result-section d-none" id="bankervs-result">
                <div class="result-text" id="bankervs-result-text"></div>
            </div>

            <div class="game-info">
                <h3>📖 Baccarat Rules</h3>
                <p>• Banker pays 1.95x (5% commission)</p>
                <p>• Player pays 2x</p>
                <p>• Tie pays 8x</p>
                <p>• Cards: A=1, 2-9=face value, 10/J/Q/K=0</p>
                <p>• Total is last digit only (e.g., 15 = 5)</p>
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
                    <div class="bet-position banker-position" data-position="banker">
                        <div class="position-icon">🏦</div>
                        <div class="position-name">BANKER</div>
                        <div class="position-odds">1.95x</div>
                        <div class="position-bet" id="banker-bet">0</div>
                    </div>

                    <div class="bet-position player-position" data-position="player">
                        <div class="position-icon">👤</div>
                        <div class="position-name">PLAYER</div>
                        <div class="position-odds">2x</div>
                        <div class="position-bet" id="player-bet">0</div>
                    </div>

                    <div class="bet-position tie-position" data-position="tie">
                        <div class="position-icon">🤝</div>
                        <div class="position-name">TIE</div>
                        <div class="position-odds">8x</div>
                        <div class="position-bet" id="tie-bet">0</div>
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[BankerVs] Initializing...');
        this.isActive = true;
        
        await this.loadUserCoins();
        this.setupEventListeners();
        await this.loadRoundInfo();
        this.startPolling();
        
        console.log('[BankerVs] ✅ Ready');
    }

    cleanup() {
        console.log('[BankerVs] Cleaning up...');
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
            
            const coinsEl = document.getElementById('bankervs-user-coins');
            if (coinsEl) coinsEl.textContent = data.coins || 0;
            
        } catch (error) {
            console.error('[BankerVs] Error loading coins:', error);
        }
    }

    setupEventListeners() {
        const backBtn = document.getElementById('bankervs-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (window.casinoManager) {
                    window.casinoManager.showMainView();
                }
            });
        }

        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedChip = parseInt(btn.dataset.value);
            });
        });

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
                `/api/casino/bankervs/round?uid=${this.uid}&token=${this.token}`,
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
            console.error('[BankerVs] Error loading round:', error);
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

        const timerEl = document.getElementById('bankervs-timer');
        if (timerEl) {
            timerEl.textContent = this.currentRound.timeRemaining;
            
            if (this.currentRound.timeRemaining <= 10) {
                timerEl.classList.add('warning');
            } else {
                timerEl.classList.remove('warning');
            }
        }

        const phaseEl = document.getElementById('bankervs-phase');
        if (phaseEl) {
            if (this.currentRound.phase === 'betting') {
                phaseEl.textContent = 'Place Your Bets!';
                phaseEl.style.color = '#4ecdc4';
                this.enableBetting();
            } else if (this.currentRound.phase === 'waiting') {
                phaseEl.textContent = 'Betting Closed - Drawing Cards...';
                phaseEl.style.color = '#ffd700';
                this.disableBetting();
            } else if (this.currentRound.phase === 'results') {
                phaseEl.textContent = 'Results!';
                phaseEl.style.color = '#ff6b35';
                this.showResults();
            }
        }

        ['banker', 'player', 'tie'].forEach(pos => {
            const betEl = document.getElementById(`${pos}-bet`);
            if (betEl) betEl.textContent = this.userBets[pos] || 0;
        });

        if (this.currentRound.bankerCards && this.currentRound.bankerCards.length > 0) {
            this.showCards('banker', this.currentRound.bankerCards, this.currentRound.bankerTotal);
        } else {
            this.hideCards('banker');
        }

        if (this.currentRound.playerCards && this.currentRound.playerCards.length > 0) {
            this.showCards('player', this.currentRound.playerCards, this.currentRound.playerTotal);
        } else {
            this.hideCards('player');
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
                `/api/casino/bankervs/bet?uid=${this.uid}&token=${this.token}`,
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
            console.error('[BankerVs] Error placing bet:', error);
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

    showCards(side, cards, total) {
        const container = document.getElementById(`${side}-cards`);
        if (!container) return;

        container.innerHTML = '';
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card-display';
            
            const isRed = card.includes('♥') || card.includes('♦');
            cardEl.innerHTML = `<div class="card-value" style="color: ${isRed ? '#dc143c' : '#000'}">${card}</div>`;
            
            container.appendChild(cardEl);
        });

        const totalEl = document.getElementById(`${side}-total`);
        if (totalEl) {
            totalEl.textContent = total;
            totalEl.style.visibility = 'visible';
        }
    }

    hideCards(side) {
        const container = document.getElementById(`${side}-cards`);
        if (!container) return;

        container.innerHTML = `
            <div class="card-display"><div class="card-back">?</div></div>
            <div class="card-display"><div class="card-back">?</div></div>
        `;

        const totalEl = document.getElementById(`${side}-total`);
        if (totalEl) {
            totalEl.style.visibility = 'hidden';
        }
    }

    showResults() {
        if (!this.currentRound || !this.currentRound.result) return;

        const resultSection = document.getElementById('bankervs-result');
        const resultText = document.getElementById('bankervs-result-text');

        if (!resultSection || !resultText) return;

        resultSection.classList.remove('d-none');

        const result = this.currentRound.result.toUpperCase();
        const userWon = this.userBets[this.currentRound.result] > 0;
        
        if (userWon) {
            resultText.textContent = `🎉 ${result} WINS! YOU WON!`;
            resultText.className = 'result-text winner';
        } else if (this.userBets.banker + this.userBets.player + this.userBets.tie > 0) {
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

document.addEventListener('DOMContentLoaded', () => {
    window.bankerVsClient = new BankerVsClient();
});