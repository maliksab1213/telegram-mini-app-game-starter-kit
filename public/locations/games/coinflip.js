// Coin Flip Client - FIXED with Retry System
class CoinFlipClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.selectedChoice = null;
        this.isActive = false;
        this.stats = null;
        
        console.log('[CoinFlip] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('coinflip-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="coinflip-back-btn">← Back</button>
                <div class="game-title">🪙 Coin Flip</div>
            </div>

            <div id="coinflip-content" class="game-area">
                <!-- Content will be dynamically loaded -->
            </div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[CoinFlip] Initializing...');
        this.isActive = true;
        
        this.setupEventListeners();
        await this.loadStats();
        await this.checkGameState();
        
        console.log('[CoinFlip] ✅ Ready');
    }

    cleanup() {
        console.log('[CoinFlip] Cleaning up...');
        this.isActive = false;
        this.selectedChoice = null;
        this.stats = null;
    }

    setupEventListeners() {
        const backBtn = document.getElementById('coinflip-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (window.gamesManager) {
                    window.gamesManager.showMainView();
                }
            });
        }
    }

    // ✅ Retry wrapper for API calls
    async fetchWithRetry(url, options = {}, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    cache: 'no-store',
                    signal: AbortSignal.timeout(10000) // 10s timeout
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                return await response.json();
            } catch (error) {
                console.error(`[CoinFlip] Attempt ${i + 1} failed:`, error);
                
                if (i === maxRetries - 1) {
                    throw error;
                }
                
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async loadStats() {
        try {
            const data = await this.fetchWithRetry(
                `/api/games/coinflip/stats?uid=${this.uid}&token=${this.token}`
            );
            
            this.stats = data.stats;
            
        } catch (error) {
            console.error('[CoinFlip] Error loading stats:', error);
            this.stats = { wins: 0, losses: 0, flipsRemaining: 3 };
        }
    }

    async checkGameState() {
        const content = document.getElementById('coinflip-content');
        if (!content) return;

        // Show loading
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px; font-size: 1.1rem;">Loading game...</div>
            </div>
        `;

        try {
            const data = await this.fetchWithRetry(
                `/api/games/coinflip/can-play?uid=${this.uid}&token=${this.token}`
            );
            
            if (!data.canPlay) {
                this.showCooldown(data.minutesLeft);
                return;
            }

            this.showGameInterface();
        } catch (error) {
            console.error('[CoinFlip] Error checking state:', error);
            this.showRetryScreen('Failed to load game. Check your connection.');
        }
    }

    showGameInterface() {
        const content = document.getElementById('coinflip-content');
        if (!content) return;

        content.innerHTML = `
            <div class="game-stats">
                <h3>📊 Your Stats</h3>
                <div class="coinflip-stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Wins</div>
                        <div class="stat-value">${this.stats?.wins || 0}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Losses</div>
                        <div class="stat-value">${this.stats?.losses || 0}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Flips Left</div>
                        <div class="stat-value">${this.stats?.flipsRemaining || 0}</div>
                    </div>
                </div>
            </div>

            <div class="instructions">
                <h3>🎯 How to Play</h3>
                <ul>
                    <li>🪙 Choose Heads or Tails</li>
                    <li>💫 Flip the coin</li>
                    <li>🎉 Match your choice to win!</li>
                    <li>⚠️ You can flip 3 times, then 1 hour cooldown</li>
                </ul>
            </div>

            <div class="coin-area">
                <div class="coin" id="coin-display">
                    <span>?</span>
                </div>
            </div>

            <div class="choice-buttons">
                <div class="coin-choice-btn" data-choice="heads">
                    <div class="coin-choice-icon">👤</div>
                    <div class="coin-choice-label">Heads</div>
                </div>
                <div class="coin-choice-btn" data-choice="tails">
                    <div class="coin-choice-icon">🦅</div>
                    <div class="coin-choice-label">Tails</div>
                </div>
            </div>

            <button class="flip-action-btn" id="flip-btn" disabled>
                🪙 Flip Coin
            </button>
        `;

        this.attachGameListeners();
    }

    attachGameListeners() {
        document.querySelectorAll('.coin-choice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectChoice(btn.dataset.choice);
            });
        });

        document.getElementById('flip-btn').addEventListener('click', () => {
            this.flipCoin();
        });
    }

    selectChoice(choice) {
        this.selectedChoice = choice;

        document.querySelectorAll('.coin-choice-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        document.querySelector(`[data-choice="${choice}"]`).classList.add('selected');
        document.getElementById('flip-btn').disabled = false;
    }

    async flipCoin() {
        if (!this.selectedChoice) {
            this.showNotification('Please select Heads or Tails!', 'warning');
            return;
        }

        // Disable buttons
        document.querySelectorAll('.coin-choice-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
        const flipBtn = document.getElementById('flip-btn');
        flipBtn.disabled = true;
        flipBtn.textContent = '🔄 Flipping...';

        // Start coin flip animation
        const coin = document.getElementById('coin-display');
        coin.classList.add('flipping');
        coin.innerHTML = '<span>🪙</span>';

        try {
            const result = await this.fetchWithRetry(
                `/api/games/coinflip/play?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ choice: this.selectedChoice })
                }
            );

            if (!result.success) {
                coin.classList.remove('flipping');
                
                if (result.reason === 'cooldown') {
                    setTimeout(() => {
                        this.showCooldown(result.minutesLeft);
                    }, 1000);
                } else {
                    this.showNotification(result.error || 'Failed to flip coin', 'error');
                    this.selectedChoice = null;
                    this.loadStats().then(() => this.showGameInterface());
                }
                return;
            }

            // Update stats from result
            if (this.stats) {
                this.stats.flipsRemaining = result.flipsRemaining;
            }

            // Show result after animation
            setTimeout(() => {
                coin.classList.remove('flipping');
                this.showResult(result);
            }, 1000);
        } catch (error) {
            console.error('[CoinFlip] Error flipping coin:', error);
            coin.classList.remove('flipping');
            
            this.showNotification('Network error! Retrying...', 'error');
            
            // Retry after 2 seconds
            setTimeout(() => {
                this.selectedChoice = null;
                this.loadStats().then(() => this.checkGameState());
            }, 2000);
        }
    }

    showResult(result) {
        const content = document.getElementById('coinflip-content');
        if (!content) return;

        const resultIcon = result.coinResult === 'heads' ? '👤' : '🦅';
        const won = result.won;

        content.innerHTML = `
            <div class="flip-result">
                <div class="flip-result-icon">${resultIcon}</div>
                <div class="flip-result-text ${won ? 'win' : 'lose'}">
                    ${won ? '🎉 YOU WON!' : '😢 YOU LOST!'}
                </div>
                <div class="flip-result-subtext">
                    Coin landed on: ${result.coinResult.toUpperCase()}
                </div>
                <div style="margin-top: 15px; font-size: 1.1rem; color: #4ecdc4;">
                    Flips Remaining: ${result.flipsRemaining || 0}
                </div>
            </div>

            <button class="action-btn" id="play-again-btn">
                ${result.flipsRemaining > 0 ? 'Flip Again' : 'Check Cooldown'}
            </button>
        `;

        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.selectedChoice = null;
            this.loadStats().then(() => this.checkGameState());
        });
    }

    showCooldown(minutesLeft) {
        const content = document.getElementById('coinflip-content');
        if (!content) return;

        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⏰ Cooldown Active</h3>
                <p>You've flipped 3 times. Come back in ${minutesLeft} minutes!</p>
            </div>
            
            <div class="game-stats">
                <h3>📊 Your Stats</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Total Wins</div>
                        <div class="stat-value">${this.stats?.wins || 0}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Total Losses</div>
                        <div class="stat-value">${this.stats?.losses || 0}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ✅ Retry screen for network errors
    showRetryScreen(message) {
        const content = document.getElementById('coinflip-content');
        if (!content) return;

        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⚠️ Connection Error</h3>
                <p>${message}</p>
                <button class="action-btn" id="retry-btn" style="margin-top: 20px;">
                    🔄 Retry
                </button>
            </div>
        `;

        document.getElementById('retry-btn').addEventListener('click', () => {
            this.loadStats().then(() => this.checkGameState());
        });
    }

    showError(message) {
        const content = document.getElementById('coinflip-content');
        if (!content) return;

        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>❌ Error</h3>
                <p>${message}</p>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${
                type === 'success' ? 'rgba(78, 205, 196, 0.9)' : 
                type === 'warning' ? 'rgba(255, 193, 7, 0.9)' :
                type === 'error' ? 'rgba(255, 107, 107, 0.9)' : 
                'rgba(52, 152, 219, 0.9)'
            };
            color: #fff;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.coinFlipClient = new CoinFlipClient();
});