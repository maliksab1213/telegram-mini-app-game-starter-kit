// Shootout Client - Penalty Shootout Game
class ShootoutClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.isActive = false;
        this.session = null;
        this.images = {};
        this.assetsLoaded = false;
        this.isPlaying = false;
        
        console.log('[Shootout] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('shootout-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="shootout-back-btn">← Back</button>
                <div class="game-title">⚽ Penalty Shootout 🥅</div>
            </div>
            <div id="shootout-content" class="game-area"></div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[Shootout] Initializing...');
        this.isActive = true;
        
        this.setupEventListeners();
        await this.checkGameState();
        
        console.log('[Shootout] ✅ Ready');
    }

    cleanup() {
        console.log('[Shootout] Cleaning up...');
        this.isActive = false;
        this.session = null;
    }

    setupEventListeners() {
        const backBtn = document.getElementById('shootout-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (window.gamesManager) {
                    window.gamesManager.showMainView();
                }
            });
        }
    }

    async fetchWithRetry(url, options = {}, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    cache: 'no-store',
                    signal: AbortSignal.timeout(10000)
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                return await response.json();
            } catch (error) {
                console.error(`[Shootout] Attempt ${i + 1} failed:`, error);
                
                if (i === maxRetries - 1) throw error;
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async checkGameState() {
        const content = document.getElementById('shootout-content');
        if (!content) return;

        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px; font-size: 1.1rem;">Loading game...</div>
            </div>
        `;

        try {
            const canPlayData = await this.fetchWithRetry(
                `/api/games/shootout/can-play?uid=${this.uid}&token=${this.token}`
            );

            if (!canPlayData.canPlay) {
                this.showCooldown(canPlayData.minutesLeft);
                return;
            }

            const sessionData = await this.fetchWithRetry(
                `/api/games/shootout/session?uid=${this.uid}&token=${this.token}`
            );

            if (sessionData.session) {
                this.session = sessionData.session;
                await this.preloadAssets();
            } else {
                this.showStartScreen(canPlayData.matchesRemaining);
            }
        } catch (error) {
            console.error('[Shootout] Error checking state:', error);
            this.showRetryScreen('Failed to load game');
        }
    }

    showStartScreen(matchesRemaining) {
        const content = document.getElementById('shootout-content');
        
        content.innerHTML = `
            <div class="game-stats">
                <h3>🎯 Matches Remaining</h3>
                <div class="stat-value" style="font-size: 3rem; color: #4ecdc4; margin: 15px 0;">
                    ${matchesRemaining}
                </div>
            </div>

            <div class="instructions">
                <h3>🎮 How to Play</h3>
                <ul>
                    <li>🎯 Score 2 goals to win the match!</li>
                    <li>⚽ Choose your direction: Left, Up, or Right</li>
                    <li>🥅 Goalkeeper will try to save your shot</li>
                    <li>🏆 Win 2 out of 3 rounds to win the match</li>
                    <li>⏱️ You can play ${matchesRemaining} matches, then 1 hour cooldown</li>
                </ul>
            </div>
            <button class="action-btn" id="start-match-btn">Start Match</button>
        `;

        document.getElementById('start-match-btn').addEventListener('click', () => {
            this.startGame();
        });
    }

    async startGame() {
        const content = document.getElementById('shootout-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Starting match...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/shootout/start?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (!result.success) {
                if (result.reason === 'cooldown') {
                    this.showCooldown(result.minutesLeft);
                } else {
                    this.showRetryScreen('Failed to start match');
                }
                return;
            }

            this.session = result.session;
            await this.preloadAssets();
        } catch (error) {
            console.error('[Shootout] Error starting game:', error);
            this.showRetryScreen('Failed to start match');
        }
    }

    async preloadAssets() {
        const content = document.getElementById('shootout-content');
        
        content.innerHTML = `
            <div class="loading-screen">
                <h2>Loading Assets...</h2>
                <div class="loading-bar">
                    <div class="loading-progress" id="loadingProgress"></div>
                </div>
                <div id="loadingPercent">0%</div>
            </div>
        `;

        const assetList = [
            'ground.png', 'football.png', 'standing.png',
            'ready_left.png', 'fly_left.png', 'ground_left.png',
            'ready_right.png', 'fly_right.png', 'ground_right.png',
            'ready_jump.png', 'fly_jump.png', 'ground_jump.png'
        ];

        let loaded = 0;
        const total = assetList.length;

        const updateProgress = () => {
            const percent = Math.round((loaded / total) * 100);
            const progressBar = document.getElementById('loadingProgress');
            const percentText = document.getElementById('loadingPercent');
            
            if (progressBar) progressBar.style.width = percent + '%';
            if (percentText) percentText.textContent = percent + '%';
        };

        const loadPromises = assetList.map(asset => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = `/locations/games/shotout/${asset}`;
                img.onload = () => {
                    this.images[asset.replace('.png', '')] = img;
                    loaded++;
                    updateProgress();
                    resolve();
                };
                img.onerror = () => reject(new Error(`Failed to load ${asset}`));
            });
        });

        try {
            await Promise.all(loadPromises);
            this.assetsLoaded = true;
            
            setTimeout(() => {
                this.showReadyScreen();
            }, 500);
        } catch (error) {
            console.error('[Shootout] Asset loading failed:', error);
            this.showRetryScreen('Failed to load game assets');
        }
    }

    showReadyScreen() {
        const content = document.getElementById('shootout-content');
        
        content.innerHTML = `
            <div class="ready-screen">
                <h2>✅ Ready to Play!</h2>
                <p>Assets loaded successfully!<br>Click Ready when you're prepared.</p>
                <button class="action-btn" id="readyBtn">Ready!</button>
            </div>
        `;

        document.getElementById('readyBtn').addEventListener('click', () => {
            this.showGameInterface();
        });
    }

    showGameInterface() {
        const content = document.getElementById('shootout-content');
        
        content.innerHTML = `
            <div class="shootout-header">
                <div class="score-display">
                    <div class="score-item">
                        <div class="score-label">⚽ Goals</div>
                        <div class="score-value" id="goalsDisplay">${this.session.playerGoals}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Round</div>
                        <div class="score-value" id="roundDisplay">${this.session.currentRound}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">🧤 Saves</div>
                        <div class="score-value" id="savesDisplay">${this.session.computerSaves}</div>
                    </div>
                </div>
            </div>

            <div class="shootout-field">
                <img id="fieldGround" src="/locations/games/shotout/ground.png" alt="Ground">
                <img id="goalkeeper" src="/locations/games/shotout/standing.png" alt="Goalkeeper">
                <img id="ball" src="/locations/games/shotout/football.png" alt="Ball">
            </div>

            <div class="message-box" id="messageBox">Where do you want to shoot?</div>

            <div class="shootout-controls">
                <button class="control-btn" data-direction="left" id="leftBtn">← LEFT</button>
                <button class="control-btn" data-direction="up" id="upBtn">↑ UP</button>
                <button class="control-btn" data-direction="right" id="rightBtn">→ RIGHT</button>
            </div>
        `;

        this.attachControlListeners();
    }

    attachControlListeners() {
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isPlaying) return;
                
                const direction = btn.dataset.direction;
                this.playRound(direction);
            });
        });
    }

    async playRound(playerChoice) {
        this.isPlaying = true;
        
        // Disable buttons
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.disabled = true;
        });

        const messageBox = document.getElementById('messageBox');
        if (messageBox) messageBox.textContent = 'Shooting...';

        try {
            const result = await this.fetchWithRetry(
                `/api/games/shootout/play?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ choice: playerChoice })
                }
            );

            if (!result.success) {
                this.showNotification(result.error || 'Failed to play', 'error');
                this.isPlaying = false;
                this.showGameInterface();
                return;
            }

            this.session = result.session;
            await this.animateShot(result.round);

            setTimeout(() => {
                if (result.gameOver) {
                    this.showGameResult();
                } else {
                    this.isPlaying = false;
                    this.showGameInterface();
                }
            }, 3000);
        } catch (error) {
            console.error('[Shootout] Error playing round:', error);
            this.showNotification('Network error!', 'error');
            this.isPlaying = false;
            this.showGameInterface();
        }
    }

    async animateShot(round) {
        const goalkeeper = document.getElementById('goalkeeper');
        const ball = document.getElementById('ball');
        const messageBox = document.getElementById('messageBox');
        
        if (!goalkeeper || !ball) return;

        // Reset positions
        goalkeeper.className = '';
        goalkeeper.style.left = '50%';
        goalkeeper.style.bottom = '30%';
        goalkeeper.style.transform = 'translateX(-50%)';
        
        ball.style.left = '50%';
        ball.style.bottom = '8%';
        ball.style.opacity = '1';
        ball.style.transform = 'translateX(-50%)';

        // Show ready position
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (round.computerChoice === 'left') {
            goalkeeper.src = '/locations/games/shotout/ready_left.png';
        } else if (round.computerChoice === 'right') {
            goalkeeper.src = '/locations/games/shotout/ready_right.png';
        } else {
            goalkeeper.src = '/locations/games/shotout/ready_jump.png';
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        // Ball movement
        if (round.playerChoice === 'left') {
            ball.style.left = '18%';
            ball.style.bottom = '38%';
            ball.style.transform = 'translateX(-50%) scale(1.3)';
        } else if (round.playerChoice === 'right') {
            ball.style.left = '82%';
            ball.style.bottom = '38%';
            ball.style.transform = 'translateX(-50%) scale(1.3)';
        } else {
            ball.style.left = '50%';
            ball.style.bottom = '60%';
            ball.style.transform = 'translateX(-50%) scale(1.2)';
        }

        // Goalkeeper fly
        if (round.computerChoice === 'left') {
            goalkeeper.className = 'flying';
            goalkeeper.src = '/locations/games/shotout/fly_left.png';
            goalkeeper.style.left = '28%';
            goalkeeper.style.bottom = '28%';
        } else if (round.computerChoice === 'right') {
            goalkeeper.className = 'flying';
            goalkeeper.src = '/locations/games/shotout/fly_right.png';
            goalkeeper.style.left = '72%';
            goalkeeper.style.bottom = '28%';
        } else {
            goalkeeper.className = 'jumping-fly';
            goalkeeper.src = '/locations/games/shotout/fly_jump.png';
            goalkeeper.style.bottom = '38%';
        }

        await new Promise(resolve => setTimeout(resolve, 700));

        // Goalkeeper ground
        if (round.computerChoice === 'left') {
            goalkeeper.className = 'grounded';
            goalkeeper.src = '/locations/games/shotout/ground_left.png';
            goalkeeper.style.bottom = '24%';
        } else if (round.computerChoice === 'right') {
            goalkeeper.className = 'grounded';
            goalkeeper.src = '/locations/games/shotout/ground_right.png';
            goalkeeper.style.bottom = '24%';
        } else {
            goalkeeper.className = 'jumping-ground';
            goalkeeper.src = '/locations/games/shotout/ground_jump.png';
            goalkeeper.style.bottom = '30%';
        }

        // Result
        if (round.result === 'goal') {
            if (messageBox) messageBox.textContent = '⚽ GOAL! ⚽';
            
            if (round.playerChoice === 'left') {
                ball.style.left = '-15%';
            } else if (round.playerChoice === 'right') {
                ball.style.left = '115%';
            } else {
                ball.style.bottom = '150%';
            }
        } else {
            if (messageBox) messageBox.textContent = '🧤 SAVED! 🧤';
            
            if (round.computerChoice === 'left') {
                ball.style.left = '-15%';
                ball.style.bottom = '32%';
                ball.style.opacity = '0.7';
            } else if (round.computerChoice === 'right') {
                ball.style.left = '115%';
                ball.style.bottom = '32%';
                ball.style.opacity = '0.7';
            } else {
                ball.style.left = '50%';
                ball.style.bottom = '150%';
                ball.style.opacity = '0.7';
            }
        }
    }

    showGameResult() {
        const content = document.getElementById('shootout-content');
        const won = this.session.status === 'won';

        content.innerHTML = `
            <div class="result-display">
                <div class="result-text ${won ? 'win' : 'lose'}">
                    ${won ? '🎉 YOU WON!' : '😢 YOU LOST!'}
                </div>
                <div class="score-display">
                    <div class="score-item">
                        <div class="score-label">⚽ Goals</div>
                        <div class="score-value">${this.session.playerGoals}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">🧤 Saves</div>
                        <div class="score-value">${this.session.computerSaves}</div>
                    </div>
                </div>
            </div>
            <button class="action-btn" onclick="window.shootoutClient.checkGameState()">
                Play Again
            </button>
        `;
    }

    showCooldown(minutesLeft) {
        const content = document.getElementById('shootout-content');
        
        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⏰ Cooldown Active</h3>
                <p>You've played 3 matches. Come back in ${minutesLeft} minutes!</p>
            </div>
        `;
    }

    showRetryScreen(message) {
        const content = document.getElementById('shootout-content');
        
        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⚠️ Error</h3>
                <p>${message}</p>
                <button class="action-btn" onclick="window.shootoutClient.checkGameState()">
                    🔄 Retry
                </button>
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
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.shootoutClient = new ShootoutClient();
});