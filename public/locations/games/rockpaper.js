// Rock Paper Scissors Client - FIXED with Retry System
class RockPaperClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.selectedChoice = null;
        this.session = null;
        this.isActive = false;
        this.matchesRemaining = 3;
        
        console.log('[RockPaper] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('rockpaper-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="rockpaper-back-btn">← Back</button>
                <div class="game-title">✊✋✌️ Rock Paper Scissors</div>
            </div>

            <div id="rockpaper-content" class="game-area">
                <!-- Content will be dynamically loaded -->
            </div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[RockPaper] Initializing...');
        this.isActive = true;
        
        this.setupEventListeners();
        await this.checkGameState();
        
        console.log('[RockPaper] ✅ Ready');
    }

    cleanup() {
        console.log('[RockPaper] Cleaning up...');
        this.isActive = false;
        this.selectedChoice = null;
        this.session = null;
    }

    setupEventListeners() {
        const backBtn = document.getElementById('rockpaper-back-btn');
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
                console.error(`[RockPaper] Attempt ${i + 1} failed:`, error);
                
                if (i === maxRetries - 1) {
                    throw error;
                }
                
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async checkGameState() {
        const content = document.getElementById('rockpaper-content');
        if (!content) return;

        // Show loading
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px; font-size: 1.1rem;">Loading game...</div>
            </div>
        `;

        try {
            // Check if user can play
            const canPlayData = await this.fetchWithRetry(
                `/api/games/rockpaper/can-play?uid=${this.uid}&token=${this.token}`
            );
            
            this.matchesRemaining = canPlayData.matchesRemaining || 0;

            if (!canPlayData.canPlay) {
                this.showCooldown(canPlayData.minutesLeft);
                return;
            }

            // Check for existing session
            const sessionData = await this.fetchWithRetry(
                `/api/games/rockpaper/session?uid=${this.uid}&token=${this.token}`
            );
            
            if (sessionData.session) {
                this.session = sessionData.session;
                this.showGameInterface();
            } else {
                this.showStartScreen();
            }
        } catch (error) {
            console.error('[RockPaper] Error checking state:', error);
            this.showRetryScreen('Failed to load game. Check your connection.');
        }
    }

    showStartScreen() {
        const content = document.getElementById('rockpaper-content');
        if (!content) return;

        content.innerHTML = `
            <div class="game-stats">
                <h3>🎯 Matches Remaining</h3>
                <div class="stat-value" style="font-size: 3rem; color: #4ecdc4; margin: 15px 0;">
                    ${this.matchesRemaining}
                </div>
            </div>

            <div class="instructions">
                <h3>🎮 How to Play</h3>
                <ul>
                    <li>🎯 Win 2 out of 3 rounds to win ONE match</li>
                    <li>✊ Rock beats Scissors</li>
                    <li>✋ Paper beats Rock</li>
                    <li>✌️ Scissors beats Paper</li>
                    <li>🔄 Ties don't count - keep playing!</li>
                    <li>⚠️ You can play ${this.matchesRemaining} matches, then 1 hour cooldown</li>
                </ul>
            </div>
            <button class="action-btn" id="start-game-btn">Start Match</button>
        `;

        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.startGame();
        });
    }

    async startGame() {
        const content = document.getElementById('rockpaper-content');
        
        // Show loading
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Starting match...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/rockpaper/start?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (!result.success) {
                if (result.reason === 'cooldown') {
                    this.showCooldown(result.minutesLeft);
                } else {
                    this.showRetryScreen('Failed to start match.');
                }
                return;
            }

            this.session = result.session;
            this.matchesRemaining = result.matchesRemaining || this.matchesRemaining;
            
            if (result.resumed) {
                this.showNotification('Match resumed!', 'info');
            }
            
            this.showGameInterface();
        } catch (error) {
            console.error('[RockPaper] Error starting game:', error);
            this.showRetryScreen('Failed to start match.');
        }
    }

    showGameInterface() {
        const content = document.getElementById('rockpaper-content');
        if (!content) return;

        content.innerHTML = `
            <div class="round-info">
                <div class="round-label">Round ${this.session.currentRound}</div>
                <div class="score-display">
                    <div class="score-item">
                        <div class="score-label">You</div>
                        <div class="score-value">${this.session.playerWins}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Computer</div>
                        <div class="score-value">${this.session.computerWins}</div>
                    </div>
                </div>
                <div style="margin-top: 10px; font-size: 0.9rem; color: #aaa;">
                    Matches Remaining: ${this.matchesRemaining}
                </div>
            </div>

            <div id="battle-area"></div>

            <div class="choices-area">
                <div class="choice-btn" data-choice="rock">
                    <div class="choice-icon">✊</div>
                    <div class="choice-label">Rock</div>
                </div>
                <div class="choice-btn" data-choice="paper">
                    <div class="choice-icon">✋</div>
                    <div class="choice-label">Paper</div>
                </div>
                <div class="choice-btn" data-choice="scissors">
                    <div class="choice-icon">✌️</div>
                    <div class="choice-label">Scissors</div>
                </div>
            </div>

            <button class="action-btn" id="ready-btn" disabled>Ready</button>
        `;

        this.attachGameListeners();
    }

    attachGameListeners() {
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectChoice(btn.dataset.choice);
            });
        });

        document.getElementById('ready-btn').addEventListener('click', () => {
            this.playRound();
        });
    }

    selectChoice(choice) {
        this.selectedChoice = choice;

        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        document.querySelector(`[data-choice="${choice}"]`).classList.add('selected');
        document.getElementById('ready-btn').disabled = false;
    }

    async playRound() {
        if (!this.selectedChoice) {
            this.showNotification('Please select a choice!', 'warning');
            return;
        }

        // Disable buttons
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
        const readyBtn = document.getElementById('ready-btn');
        readyBtn.disabled = true;
        readyBtn.textContent = 'Playing...';

        try {
            const result = await this.fetchWithRetry(
                `/api/games/rockpaper/play?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ choice: this.selectedChoice })
                }
            );

            if (!result.success) {
                this.showNotification(result.error || 'Failed to play round', 'error');
                this.selectedChoice = null;
                this.showGameInterface();
                return;
            }

            this.session = result.session;
            this.showBattle(result.round);

            setTimeout(() => {
                if (result.gameOver) {
                    this.matchesRemaining = Math.max(0, this.matchesRemaining - 1);
                    this.showGameResult();
                } else {
                    this.selectedChoice = null;
                    this.showGameInterface();
                }
            }, 3000);
        } catch (error) {
            console.error('[RockPaper] Error playing round:', error);
            this.showNotification('Network error! Retrying...', 'error');
            
            // Retry after 2 seconds
            setTimeout(() => {
                this.selectedChoice = null;
                this.checkGameState();
            }, 2000);
        }
    }

    showBattle(round) {
        const battleArea = document.getElementById('battle-area');
        if (!battleArea) return;

        const choiceEmojis = {
            rock: '✊',
            paper: '✋',
            scissors: '✌️'
        };

        battleArea.innerHTML = `
            <div class="battle-area">
                <div class="hand-display">
                    <div class="hand-label">You</div>
                    <div class="hand-icon">${choiceEmojis[round.playerChoice]}</div>
                </div>
                <div class="vs-text">VS</div>
                <div class="hand-display">
                    <div class="hand-label">Computer</div>
                    <div class="hand-icon">${choiceEmojis[round.computerChoice]}</div>
                </div>
            </div>
            <div class="result-display">
                <div class="result-text ${round.result}">
                    ${round.result === 'player' ? '🎉 You Win This Round!' : 
                      round.result === 'computer' ? '😢 You Lose This Round!' : 
                      '🔄 Tie! Play Again!'}
                </div>
            </div>
        `;
    }

    showGameResult() {
        const content = document.getElementById('rockpaper-content');
        if (!content) return;

        const won = this.session.status === 'won';

        content.innerHTML = `
            <div class="result-display">
                <div class="result-text ${won ? 'win' : 'lose'}">
                    ${won ? '🎉 YOU WON THE MATCH!' : '😢 YOU LOST THE MATCH!'}
                </div>
                <div class="score-display">
                    <div class="score-item">
                        <div class="score-label">You</div>
                        <div class="score-value">${this.session.playerWins}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Computer</div>
                        <div class="score-value">${this.session.computerWins}</div>
                    </div>
                </div>
                <div style="margin-top: 20px; font-size: 1.1rem; color: #4ecdc4;">
                    Matches Remaining: ${this.matchesRemaining}
                </div>
            </div>
            <button class="action-btn" id="play-again-btn">
                ${this.matchesRemaining > 0 ? 'Play Another Match' : 'Check Cooldown'}
            </button>
        `;

        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.session = null;
            this.selectedChoice = null;
            this.checkGameState();
        });
    }

    showCooldown(minutesLeft) {
        const content = document.getElementById('rockpaper-content');
        if (!content) return;

        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⏰ Cooldown Active</h3>
                <p>You've played 3 matches. Come back in ${minutesLeft} minutes!</p>
            </div>
        `;
    }

    // ✅ Retry screen for network errors
    showRetryScreen(message) {
        const content = document.getElementById('rockpaper-content');
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
            this.checkGameState();
        });
    }

    showError(message) {
        const content = document.getElementById('rockpaper-content');
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
    window.rockPaperClient = new RockPaperClient();
});