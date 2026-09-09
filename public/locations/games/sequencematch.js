// Sequence Match Client - Color Sequence Game
class SequenceMatchClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.isActive = false;
        this.session = null;
        this.colors = ['red', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'];
        this.images = {};
        this.assetsLoaded = false;
        this.playerSequence = [];
        this.isPlaying = false;
        this.canClick = false;
        
        console.log('[SequenceMatch] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('sequencematch-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="sequencematch-back-btn">← Back</button>
                <div class="game-title">🌈 Color Sequence 🧩</div>
            </div>
            <div id="sequencematch-content" class="game-area"></div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[SequenceMatch] Initializing...');
        this.isActive = true;
        
        this.setupEventListeners();
        await this.checkGameState();
        
        console.log('[SequenceMatch] ✅ Ready');
    }

    cleanup() {
        console.log('[SequenceMatch] Cleaning up...');
        this.isActive = false;
        this.session = null;
        this.playerSequence = [];
    }

    setupEventListeners() {
        const backBtn = document.getElementById('sequencematch-back-btn');
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
                console.error(`[SequenceMatch] Attempt ${i + 1} failed:`, error);
                
                if (i === maxRetries - 1) throw error;
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async checkGameState() {
        const content = document.getElementById('sequencematch-content');
        if (!content) return;

        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px; font-size: 1.1rem;">Loading game...</div>
            </div>
        `;

        try {
            const canPlayData = await this.fetchWithRetry(
                `/api/games/sequencematch/can-play?uid=${this.uid}&token=${this.token}`
            );

            if (!canPlayData.canPlay) {
                this.showCooldown(canPlayData.minutesLeft);
                return;
            }

            const sessionData = await this.fetchWithRetry(
                `/api/games/sequencematch/session?uid=${this.uid}&token=${this.token}`
            );

            if (sessionData.session) {
                this.session = sessionData.session;
                await this.preloadAssets();
            } else {
                this.showChallengeSelect(canPlayData.matchesRemaining);
            }
        } catch (error) {
            console.error('[SequenceMatch] Error checking state:', error);
            this.showRetryScreen('Failed to load game');
        }
    }

    showChallengeSelect(matchesRemaining) {
        const content = document.getElementById('sequencematch-content');
        if (!content) return;

        content.innerHTML = `
            <div class="game-stats">
                <h3>🎯 Matches Remaining</h3>
                <div class="stat-value" style="font-size: 3rem; color: #4ecdc4; margin: 15px 0;">
                    ${matchesRemaining}
                </div>
            </div>

            <div class="instructions">
                <h3>🎮 Select Challenge</h3>
                <p>Watch the color sequence, then repeat it! Complete 5 levels to win.</p>
            </div>

            <div class="challenges-grid">
                <div class="challenge-card" data-challenge="easy">
                    <div class="challenge-icon">😊</div>
                    <div class="challenge-name">Easy</div>
                    <div class="challenge-desc">Slower Speed</div>
                    <button class="challenge-btn">Play Easy</button>
                </div>
                <div class="challenge-card" data-challenge="medium">
                    <div class="challenge-icon">😎</div>
                    <div class="challenge-name">Medium</div>
                    <div class="challenge-desc">Medium Speed</div>
                    <button class="challenge-btn">Play Medium</button>
                </div>
                <div class="challenge-card" data-challenge="hard">
                    <div class="challenge-icon">😤</div>
                    <div class="challenge-name">Hard</div>
                    <div class="challenge-desc">Fast Speed</div>
                    <button class="challenge-btn">Play Hard</button>
                </div>
            </div>
        `;

        document.querySelectorAll('.challenge-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.challenge-card');
                const challenge = card.dataset.challenge;
                this.startGame(challenge);
            });
        });
    }

    async startGame(challenge) {
        const content = document.getElementById('sequencematch-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Starting game...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/sequencematch/start?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ challenge })
                }
            );

            if (!result.success) {
                if (result.reason === 'cooldown') {
                    this.showCooldown(result.minutesLeft);
                } else {
                    this.showRetryScreen('Failed to start game');
                }
                return;
            }

            this.session = result.session;
            await this.preloadAssets();
        } catch (error) {
            console.error('[SequenceMatch] Error starting game:', error);
            this.showRetryScreen('Failed to start game');
        }
    }

    async preloadAssets() {
        const content = document.getElementById('sequencematch-content');
        
        content.innerHTML = `
            <div class="loading-screen">
                <h2>Loading Assets...</h2>
                <div class="loading-bar">
                    <div class="loading-progress" id="loadingProgress"></div>
                </div>
                <div id="loadingPercent">0%</div>
            </div>
        `;

        let loaded = 0;
        const total = this.colors.length * 2;

        const updateProgress = () => {
            const percent = Math.round((loaded / total) * 100);
            const progressBar = document.getElementById('loadingProgress');
            const percentText = document.getElementById('loadingPercent');
            
            if (progressBar) progressBar.style.width = percent + '%';
            if (percentText) percentText.textContent = percent + '%';
        };

        const loadPromises = this.colors.map(color => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = `/locations/games/semsons_assets/${color}.png`;
                img.onload = () => {
                    this.images[color] = img;
                    loaded++;
                    updateProgress();
                    resolve();
                };
                img.onerror = () => reject(new Error(`Failed to load ${color}.png`));
            });
        });

        const loadGlowPromises = this.colors.map(color => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = `/locations/games/semsons_assets/${color}_glow.png`;
                img.onload = () => {
                    this.images[`${color}_glow`] = img;
                    loaded++;
                    updateProgress();
                    resolve();
                };
                img.onerror = () => reject(new Error(`Failed to load ${color}_glow.png`));
            });
        });

        try {
            await Promise.all([...loadPromises, ...loadGlowPromises]);
            this.assetsLoaded = true;
            
            setTimeout(() => {
                this.showReadyScreen();
            }, 500);
        } catch (error) {
            console.error('[SequenceMatch] Asset loading failed:', error);
            this.showRetryScreen('Failed to load game assets');
        }
    }

    showReadyScreen() {
        const content = document.getElementById('sequencematch-content');
        
        content.innerHTML = `
            <div class="ready-screen">
                <h2>✅ Ready to Play!</h2>
                <p>Assets loaded successfully!<br>Click Ready when you're prepared.</p>
                <button class="action-btn" id="readyBtn">Ready!</button>
            </div>
        `;

        document.getElementById('readyBtn').addEventListener('click', () => {
            this.startLevel();
        });
    }

    async startLevel() {
        this.showGameInterface();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
            const result = await this.fetchWithRetry(
                `/api/games/sequencematch/generate?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ level: this.session.currentLevel })
                }
            );

            if (result.success) {
                this.session.sequence = result.sequence;
                this.playSequence(result.speed);
            }
        } catch (error) {
            console.error('[SequenceMatch] Error generating sequence:', error);
            this.showRetryScreen('Failed to generate sequence');
        }
    }

    showGameInterface() {
        const content = document.getElementById('sequencematch-content');
        
        const challenges = {
            easy: { icon: '😊', name: 'Easy', color: '#4ade80' },
            medium: { icon: '😎', name: 'Medium', color: '#fbbf24' },
            hard: { icon: '😤', name: 'Hard', color: '#ef4444' }
        };

        const ch = challenges[this.session.challenge];

        content.innerHTML = `
            <div class="game-info-header">
                <div class="info-item">
                    <div class="challenge-badge" style="background: ${ch.color};">
                        ${ch.icon} ${ch.name}
                    </div>
                </div>
                <div class="info-item">
                    <div class="stat-label">Level</div>
                    <div class="stat-value" id="levelDisplay">${this.session.currentLevel}/5</div>
                </div>
                <div class="info-item">
                    <div class="stat-label">Score</div>
                    <div class="stat-value" id="scoreDisplay">${this.session.score}</div>
                </div>
            </div>

            <div class="message-box" id="messageBox">Watch carefully!</div>

            <div class="color-grid" id="colorGrid">
                ${this.colors.map(color => `
                    <div class="color-box" data-color="${color}">
                        <img src="/locations/games/semsons_assets/${color}.png" alt="${color}">
                    </div>
                `).join('')}
            </div>
        `;
    }

    playSequence(speed) {
        this.isPlaying = true;
        this.canClick = false;
        this.playerSequence = [];
        
        const messageBox = document.getElementById('messageBox');
        if (messageBox) messageBox.textContent = 'Watch carefully!';

        let i = 0;
        const interval = setInterval(() => {
            if (i < this.session.sequence.length) {
                this.glowBox(this.session.sequence[i], speed);
                i++;
            } else {
                clearInterval(interval);
                setTimeout(() => {
                    this.isPlaying = false;
                    this.canClick = true;
                    if (messageBox) messageBox.textContent = 'Your turn!';
                    this.attachClickListeners();
                }, speed);
            }
        }, speed * 1.5);
    }

    glowBox(color, duration) {
        const box = document.querySelector(`[data-color="${color}"]`);
        if (!box) return;

        box.classList.add('glowing');

        setTimeout(() => {
            box.classList.remove('glowing');
        }, duration * 0.7);
    }

    attachClickListeners() {
        document.querySelectorAll('.color-box').forEach(box => {
            box.addEventListener('click', () => {
                if (!this.canClick || this.isPlaying) return;
                
                const color = box.dataset.color;
                this.handleColorClick(color);
            });
        });
    }

    async handleColorClick(color) {
        this.glowBox(color, 200);
        this.playerSequence.push(color);

        const messageBox = document.getElementById('messageBox');
        
        // Check if sequence matches so far
        const currentIndex = this.playerSequence.length - 1;
        
        if (this.playerSequence[currentIndex] !== this.session.sequence[currentIndex]) {
            // Wrong color
            this.canClick = false;
            if (messageBox) messageBox.textContent = '❌ Wrong!';
            
            setTimeout(() => {
                this.validateSequence();
            }, 1000);
            return;
        }

        // Check if completed
        if (this.playerSequence.length === this.session.sequence.length) {
            this.canClick = false;
            if (messageBox) messageBox.textContent = '✅ Correct!';
            
            setTimeout(() => {
                this.validateSequence();
            }, 1000);
        }
    }

    async validateSequence() {
        try {
            const result = await this.fetchWithRetry(
                `/api/games/sequencematch/validate?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sequence: this.playerSequence })
                }
            );

            if (!result.success) {
                this.showRetryScreen('Failed to validate sequence');
                return;
            }

            if (result.gameOver) {
                this.showResult(result.won, result.finalScore);
            } else {
                // Next level
                this.session.score = result.score;
                this.session.currentLevel = result.nextLevel;
                
                const scoreDisplay = document.getElementById('scoreDisplay');
                const levelDisplay = document.getElementById('levelDisplay');
                
                if (scoreDisplay) scoreDisplay.textContent = this.session.score;
                if (levelDisplay) levelDisplay.textContent = `${this.session.currentLevel}/5`;
                
                setTimeout(() => {
                    this.startLevel();
                }, 1500);
            }
        } catch (error) {
            console.error('[SequenceMatch] Error validating:', error);
            this.showRetryScreen('Network error');
        }
    }

    showResult(won, finalScore) {
        const content = document.getElementById('sequencematch-content');
        
        content.innerHTML = `
            <div class="result-display">
                <div class="result-text ${won ? 'win' : 'lose'}">
                    ${won ? '🎉 YOU WON!' : '😢 TRY AGAIN!'}
                </div>
                <div class="result-stats">
                    <div class="result-stat">
                        <div class="result-label">Final Score</div>
                        <div class="result-value">${finalScore}</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-label">Challenge</div>
                        <div class="result-value">${this.session.challenge}</div>
                    </div>
                </div>
            </div>
            <button class="action-btn" onclick="window.sequenceMatchClient.checkGameState()">
                Play Again
            </button>
        `;
    }

    showCooldown(minutesLeft) {
        const content = document.getElementById('sequencematch-content');
        
        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⏰ Cooldown Active</h3>
                <p>You've played 3 matches. Come back in ${minutesLeft} minutes!</p>
            </div>
        `;
    }

    showRetryScreen(message) {
        const content = document.getElementById('sequencematch-content');
        
        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⚠️ Error</h3>
                <p>${message}</p>
                <button class="action-btn" onclick="window.sequenceMatchClient.checkGameState()">
                    🔄 Retry
                </button>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.sequenceMatchClient = new SequenceMatchClient();
});