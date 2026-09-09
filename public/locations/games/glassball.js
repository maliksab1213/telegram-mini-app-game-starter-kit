// Glass Ball Game Client - public/locations/games/glassball.js
class GlassBallClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.isActive = false;
        this.matchesRemaining = 3;
        this.game = null;
        this.gameStarted = false;
        this.timerInterval = null;
        
        console.log('[GlassBall] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('glassball-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="glassball-back-btn">← Back</button>
                <div class="game-title">🥛 Glass Ball Game</div>
            </div>

            <div id="glassball-content" class="game-area">
                <!-- Content will be dynamically loaded -->
            </div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[GlassBall] Initializing...');
        this.isActive = true;
        
        this.setupEventListeners();
        await this.checkGameState();
        
        console.log('[GlassBall] ✅ Ready');
    }

    cleanup() {
        console.log('[GlassBall] Cleaning up...');
        this.isActive = false;
        this.gameStarted = false;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        if (this.game) {
            this.game.destroy(true);
            this.game = null;
        }
    }

    setupEventListeners() {
        const backBtn = document.getElementById('glassball-back-btn');
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
                console.error(`[GlassBall] Attempt ${i + 1} failed:`, error);
                
                if (i === maxRetries - 1) {
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async checkGameState() {
        const content = document.getElementById('glassball-content');
        if (!content) return;

        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px; font-size: 1.1rem;">Loading game...</div>
            </div>
        `;

        try {
            const canPlayData = await this.fetchWithRetry(
                `/api/games/glassball/can-play?uid=${this.uid}&token=${this.token}`
            );
            
            this.matchesRemaining = canPlayData.matchesRemaining || 0;

            if (!canPlayData.canPlay) {
                this.showCooldown(canPlayData.minutesLeft);
                return;
            }

            this.showStartScreen();
        } catch (error) {
            console.error('[GlassBall] Error checking state:', error);
            this.showRetryScreen('Failed to load game. Check your connection.');
        }
    }

    showStartScreen() {
        const content = document.getElementById('glassball-content');
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
                    <li>🥛 Watch the ball under one of 3 glasses</li>
                    <li>🔄 Glasses will shuffle for a few seconds</li>
                    <li>⏱️ You have 15 seconds to guess after shuffling stops</li>
                    <li>🎯 Find the correct glass to win!</li>
                    <li>⚠️ You can play ${this.matchesRemaining} matches, then 1 hour cooldown</li>
                </ul>
            </div>
            <button class="action-btn" id="start-game-btn">Start Game</button>
        `;

        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.startGame();
        });
    }

    async startGame() {
        const content = document.getElementById('glassball-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Starting game...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/glassball/start?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (!result.success) {
                if (result.reason === 'cooldown') {
                    this.showCooldown(result.minutesLeft);
                } else {
                    this.showRetryScreen('Failed to start game.');
                }
                return;
            }

            this.matchesRemaining = result.matchesRemaining || this.matchesRemaining;
            this.initPhaserGame();
        } catch (error) {
            console.error('[GlassBall] Error starting game:', error);
            this.showRetryScreen('Failed to start game.');
        }
    }

    initPhaserGame() {
        const content = document.getElementById('glassball-content');
        if (!content) return;

        content.innerHTML = `
            <div id="phaser-game-container"></div>
            <div id="game-timer" style="text-align: center; font-size: 1.5rem; color: #4ecdc4; margin-top: 20px; display: none;">
                Time: <span id="timer-value">15</span>s
            </div>
        `;

        const config = {
            type: Phaser.AUTO,
            width: 800,
            height: 600,
            parent: 'phaser-game-container',
            backgroundColor: '#1a1a2e',
            scene: {
                preload: this.preload.bind(this),
                create: this.create.bind(this),
                update: this.update.bind(this)
            }
        };

        this.game = new Phaser.Game(config);
        this.gameStarted = true;
    }

    preload() {
        // No external assets needed - we'll draw everything
    }

    create() {
        const scene = this.game.scene.scenes[0];
        
        // Add title
        scene.add.text(400, 50, 'Find the Ball!', {
            fontSize: '32px',
            color: '#4ecdc4',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Create glasses
        this.glasses = [];
        const startX = 200;
        const spacing = 200;
        
        for (let i = 0; i < 3; i++) {
            const x = startX + (i * spacing);
            const y = 400;
            
            // Glass base (inverted triangle)
            const glass = scene.add.graphics();
            glass.lineStyle(4, 0x4ecdc4);
            glass.fillStyle(0x1a1a2e, 0.5);
            glass.beginPath();
            glass.moveTo(x - 40, y);
            glass.lineTo(x + 40, y);
            glass.lineTo(x + 30, y - 80);
            glass.lineTo(x - 30, y - 80);
            glass.closePath();
            glass.strokePath();
            glass.fillPath();
            
            // Store glass info
            this.glasses.push({
                graphics: glass,
                x: x,
                y: y,
                index: i,
                originalX: x
            });
        }

        // Create ball (hidden initially)
        this.ball = scene.add.circle(this.glasses[0].x, this.glasses[0].y + 30, 15, 0xff6b6b);
        this.ballPosition = 0; // Will be set by server
        
        // Show ball initially
        scene.add.text(400, 150, 'Watch the ball!', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Start animation sequence
        scene.time.delayedCall(2000, () => {
            this.hideBall(scene);
            this.startShuffling(scene);
        });
    }

    hideBall(scene) {
        this.ball.setVisible(false);
        
        scene.add.text(400, 150, 'Shuffling...', {
            fontSize: '24px',
            color: '#ffd700'
        }).setOrigin(0.5);
    }

    startShuffling(scene) {
        let shuffleCount = 0;
        const maxShuffles = 10;
        
        const shuffleInterval = setInterval(() => {
            if (shuffleCount >= maxShuffles) {
                clearInterval(shuffleInterval);
                this.enableSelection(scene);
                return;
            }
            
            // Random shuffle
            const idx1 = Math.floor(Math.random() * 3);
            const idx2 = (idx1 + 1 + Math.floor(Math.random() * 2)) % 3;
            
            this.swapGlasses(scene, idx1, idx2);
            shuffleCount++;
        }, 500);
    }

    swapGlasses(scene, idx1, idx2) {
        const glass1 = this.glasses[idx1];
        const glass2 = this.glasses[idx2];
        
        // Animate swap
        scene.tweens.add({
            targets: glass1.graphics,
            x: glass2.x,
            duration: 400,
            ease: 'Power2'
        });
        
        scene.tweens.add({
            targets: glass2.graphics,
            x: glass1.x,
            duration: 400,
            ease: 'Power2'
        });
        
        // Update positions
        const tempX = glass1.x;
        glass1.x = glass2.x;
        glass2.x = tempX;
        
        // Swap in array
        [this.glasses[idx1], this.glasses[idx2]] = [this.glasses[idx2], this.glasses[idx1]];
    }

    enableSelection(scene) {
        scene.add.text(400, 150, 'Click a glass!', {
            fontSize: '24px',
            color: '#4ecdc4'
        }).setOrigin(0.5);
        
        // Show timer
        document.getElementById('game-timer').style.display = 'block';
        this.startTimer();
        
        // Make glasses clickable
        this.glasses.forEach((glass, index) => {
            const hitArea = scene.add.rectangle(
                glass.x, 
                glass.y - 40, 
                80, 
                80, 
                0xffffff, 
                0
            );
            hitArea.setInteractive();
            
            hitArea.on('pointerdown', () => {
                this.makeGuess(index);
            });
            
            hitArea.on('pointerover', () => {
                glass.graphics.setAlpha(0.7);
            });
            
            hitArea.on('pointerout', () => {
                glass.graphics.setAlpha(1);
            });
        });
    }

    startTimer() {
        let timeLeft = 15;
        const timerValue = document.getElementById('timer-value');
        
        this.timerInterval = setInterval(() => {
            timeLeft--;
            timerValue.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.timeUp();
            }
        }, 1000);
    }

    async timeUp() {
        this.showNotification('⏰ Time Up!', 'warning');
        
        // Auto submit random guess
        const randomGuess = Math.floor(Math.random() * 3);
        await this.makeGuess(randomGuess);
    }

    async makeGuess(position) {
        if (!this.gameStarted) return;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        document.getElementById('game-timer').style.display = 'none';
        
        try {
            const result = await this.fetchWithRetry(
                `/api/games/glassball/guess?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ position })
                }
            );

            if (!result.success) {
                this.showNotification(result.error || 'Failed to make guess', 'error');
                return;
            }

            this.showResult(result.won, result.correctPosition, result.guessedPosition);
        } catch (error) {
            console.error('[GlassBall] Error making guess:', error);
            this.showNotification('Network error!', 'error');
        }
    }

    showResult(won, correctPosition, guessedPosition) {
        const scene = this.game.scene.scenes[0];
        
        // Show ball at correct position
        const correctGlass = this.glasses.find(g => g.index === correctPosition);
        if (correctGlass) {
            this.ball.setPosition(correctGlass.x, correctGlass.y + 30);
            this.ball.setVisible(true);
            
            // Lift correct glass
            scene.tweens.add({
                targets: correctGlass.graphics,
                y: correctGlass.y - 100,
                duration: 500,
                ease: 'Back.easeOut'
            });
        }
        
        // Show result text
        setTimeout(() => {
            this.matchesRemaining = Math.max(0, this.matchesRemaining - 1);
            this.showGameResult(won);
        }, 2000);
    }

    showGameResult(won) {
        const content = document.getElementById('glassball-content');
        if (!content) return;

        content.innerHTML = `
            <div class="result-display">
                <div class="result-text ${won ? 'win' : 'lose'}">
                    ${won ? '🎉 YOU WON!' : '😢 YOU LOST!'}
                </div>
                <div style="margin-top: 20px; font-size: 1.1rem; color: #4ecdc4;">
                    Matches Remaining: ${this.matchesRemaining}
                </div>
            </div>
            <button class="action-btn" id="play-again-btn">
                ${this.matchesRemaining > 0 ? 'Play Again' : 'Check Cooldown'}
            </button>
        `;

        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.gameStarted = false;
            if (this.game) {
                this.game.destroy(true);
                this.game = null;
            }
            this.checkGameState();
        });
    }

    showCooldown(minutesLeft) {
        const content = document.getElementById('glassball-content');
        if (!content) return;

        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⏰ Cooldown Active</h3>
                <p>You've played 3 matches. Come back in ${minutesLeft} minutes!</p>
            </div>
        `;
    }

    showRetryScreen(message) {
        const content = document.getElementById('glassball-content');
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

    update() {
        // Game loop - not needed for this game
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.glassBallClient = new GlassBallClient();
});