// Black vs Red Client - public/locations/casino/blackvsredscript.js
class BlackVsRedClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.selectedChip = 10;
        this.currentRound = null;
        this.userBets = { black: 0, red: 0, tie: 0, golden: 0 };
        this.pollInterval = null;
        this.isActive = false;
        
        console.log('[BlackVsRed] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('blackvsred-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="blackvsred-back-btn">← Back</button>
                <div class="game-title">⚫ Black vs Red 🔴</div>
                <div class="coins-display">
                    <span id="blackvsred-user-coins">0</span>
                    <span>💰</span>
                </div>
            </div>

            <div class="timer-section">
                <div class="timer-label">Time Remaining</div>
                <div class="timer-value" id="blackvsred-timer">35</div>
                <div class="phase-label" id="blackvsred-phase">Place Your Bets!</div>
            </div>

            <div class="cards-section">
                <div class="card-slot black-slot">
                    <div class="slot-label">⚫ BLACK</div>
                    <div class="cards-display" id="black-cards">
                        <div class="card-display"><div class="card-back">?</div></div>
                        <div class="card-display"><div class="card-back">?</div></div>
                        <div class="card-display"><div class="card-back">?</div></div>
                    </div>
                    <div class="total-display" id="black-total" style="visibility: hidden;">0</div>
                </div>

                <div class="vs-divider">VS</div>

                <div class="card-slot red-slot">
                    <div class="slot-label">🔴 RED</div>
                    <div class="cards-display" id="red-cards">
                        <div class="card-display"><div class="card-back">?</div></div>
                        <div class="card-display"><div class="card-back">?</div></div>
                        <div class="card-display"><div class="card-back">?</div></div>
                    </div>
                    <div class="total-display" id="red-total" style="visibility: hidden;">0</div>
                </div>
            </div>

            <div class="result-section d-none" id="blackvsred-result">
                <div class="result-text" id="blackvsred-result-text"></div>
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
                    <div class="bet-position black-position" data-position="black">
                        <div class="position-icon">⚫</div>
                        <div class="position-name">BLACK</div>
                        <div class="position-odds">2x</div>
                        <div class="position-bet" id="black-bet">0</div>
                    </div>

                    <div class="bet-position red-position" data-position="red">
                        <div class="position-icon">🔴</div>
                        <div class="position-name">RED</div>
                        <div class="position-odds">2x</div>
                        <div class="position-bet" id="red-bet">0</div>
                    </div>

                    <div class="bet-position tie-position" data-position="tie">
                        <div class="position-icon">🤝</div>
                        <div class="position-name">TIE</div>
                        <div class="position-odds">8x</div>
                        <div class="position-bet" id="tie-bet">0</div>
                    </div>

                    <div class="bet-position golden-position" data-position="golden">
                        <div class="position-icon">⭐</div>
                        <div class="position-name">GOLDEN</div>
                        <div class="position-odds">10x</div>
                        <div class="position-bet" id="golden-bet">0</div>
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[BlackVsRed] Initializing...');
        this.isActive = true;
        
        await this.loadUserCoins();
        this.setupEventListeners();
        await this.loadRoundInfo();
        this.startPolling();
        
        console.log('[BlackVsRed] ✅ Ready');
    }

    cleanup() {
        console.log('[BlackVsRed] Cleaning up...');
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
            
            const coinsEl = document.getElementById('blackvsred-user-coins');
            if (coinsEl) coinsEl.textContent = data.coins || 0;
            
        } catch (error) {
            console.error('[BlackVsRed] Error loading coins:', error);
        }
    }

    setupEventListeners() {
        const backBtn = document.getElementById('blackvsred-back-btn');
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
                `/api/casino/blackvsred/round?uid=${this.uid}&token=${this.token}`,
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
            console.error('[BlackVsRed] Error loading round:', error);
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

        const timerEl = document.getElementById('blackvsred-timer');
        if (timerEl) {
            timerEl.textContent = this.currentRound.timeRemaining;
            
            if (this.currentRound.timeRemaining <= 10) {
                timerEl.classList.add('warning');
            } else {
                timerEl.classList.remove('warning');
            }
        }

        const phaseEl = document.getElementById('blackvsred-phase');
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

        ['black', 'red', 'tie', 'golden'].forEach(pos => {
            const betEl = document.getElementById(`${pos}-bet`);
            if (betEl) betEl.textContent = this.userBets[pos] || 0;
        });

        if (this.currentRound.blackCards && this.currentRound.blackCards.length > 0) {
            this.showCards('black', this.currentRound.blackCards);
        } else {
            this.hideCards('black');
        }

        if (this.currentRound.redCards && this.currentRound.redCards.length > 0) {
            this.showCards('red', this.currentRound.redCards);
        } else {
            this.hideCards('red');
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
                `/api/casino/blackvsred/bet?uid=${this.uid}&token=${this.token}`,
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
            console.error('[BlackVsRed] Error placing bet:', error);
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

    showCards(side, cards) {
        const container = document.getElementById(`${side}-cards`);
        if (!container) return;

        container.innerHTML = '';
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card-display';
            
            const isRed = card.includes('♥') || card.includes('♦');
            cardEl.innerHTML = `<div class="card-value ${isRed ? 'red-card' : 'black-card'}">${card}</div>`;
            
            container.appendChild(cardEl);
        });

        const total = this.calculateTotal(cards);
        const totalEl = document.getElementById(`${side}-total`);
        if (totalEl) {
            totalEl.textContent = total;
            totalEl.style.visibility = 'visible';
            
            if (this.currentRound.isGolden) {
                totalEl.classList.add('golden');
            }
        }
    }

    hideCards(side) {
        const container = document.getElementById(`${side}-cards`);
        if (!container) return;

        container.innerHTML = `
            <div class="card-display"><div class="card-back">?</div></div>
            <div class="card-display"><div class="card-back">?</div></div>
            <div class="card-display"><div class="card-back">?</div></div>
        `;

        const totalEl = document.getElementById(`${side}-total`);
        if (totalEl) {
            totalEl.style.visibility = 'hidden';
            totalEl.classList.remove('golden');
        }
    }

    calculateTotal(cards) {
        return cards.reduce((sum, card) => {
            const value = card.slice(0, -1);
            if (value === 'A') return sum + 1;
            if (['J', 'Q', 'K'].includes(value)) return sum + (value === 'J' ? 11 : value === 'Q' ? 12 : 13);
            return sum + parseInt(value);
        }, 0);
    }

    showResults() {
        if (!this.currentRound || !this.currentRound.result) return;

        const resultSection = document.getElementById('blackvsred-result');
        const resultText = document.getElementById('blackvsred-result-text');

        if (!resultSection || !resultText) return;

        resultSection.classList.remove('d-none');

        const result = this.currentRound.result.toUpperCase();
        const userWon = this.userBets[this.currentRound.result] > 0 || 
                        (this.currentRound.isGolden && this.userBets.golden > 0);
        
        if (this.currentRound.isGolden) {
            resultText.textContent = `⭐ GOLDEN! ${result} WINS!`;
            resultText.className = 'result-text golden';
        } else if (userWon) {
            resultText.textContent = `🎉 ${result} WINS! YOU WON!`;
            resultText.className = 'result-text winner';
        } else if (this.userBets.black + this.userBets.red + this.userBets.tie + this.userBets.golden > 0) {
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
    window.blackVsRedClient = new BlackVsRedClient();
});