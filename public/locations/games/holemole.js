// Hole Mole Client
class HoleMoleClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.isActive = false;
        this.session = null;
        this.gameInterval = null;
        this.timerInterval = null;
        this.activeSpots = new Set();
        this.isMuted = false;
        
        console.log('[HoleMole] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('holemole-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="holemole-back-btn">← Back</button>
                <div class="game-title">🎯 SMASH HIT 🎯</div>
            </div>
            <div id="holemole-content" class="game-area"></div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[HoleMole] Initializing...');
        this.isActive = true;
        
        this.setupEventListeners();
        await this.checkGameState();
        
        console.log('[HoleMole] ✅ Ready');
    }

    cleanup() {
        console.log('[HoleMole] Cleaning up...');
        this.stopGame();
        this.isActive = false;
        this.session = null;
    }

    setupEventListeners() {
        const backBtn = document.getElementById('holemole-back-btn');
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
                console.error(`[HoleMole] Attempt ${i + 1} failed:`, error);
                
                if (i === maxRetries - 1) throw error;
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async checkGameState() {
        const content = document.getElementById('holemole-content');
        if (!content) return;

        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px; font-size: 1.1rem;">Loading game...</div>
            </div>
        `;

        try {
            const canPlayData = await this.fetchWithRetry(
                `/api/games/holemole/can-play?uid=${this.uid}&token=${this.token}`
            );

            if (!canPlayData.canPlay) {
                this.showCooldown(canPlayData.minutesLeft);
                return;
            }

            const sessionData = await this.fetchWithRetry(
                `/api/games/holemole/session?uid=${this.uid}&token=${this.token}`
            );

            if (sessionData.session) {
                this.session = sessionData.session;
                this.showGameInterface();
            } else {
                this.showChallengeSelect(canPlayData.matchesRemaining);
            }
        } catch (error) {
            console.error('[HoleMole] Error checking state:', error);
            this.showRetryScreen('Failed to load game');
        }
    }

    showChallengeSelect(matchesRemaining) {
        const content = document.getElementById('holemole-content');
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
                <p>You have 30 seconds in all modes. Hit the targets to score!</p>
            </div>

            <div class="challenges-grid">
                <div class="challenge-card" data-challenge="easy">
                    <div class="challenge-icon">😊</div>
                    <div class="challenge-name">Easy</div>
                    <div class="challenge-desc">Score 15 points</div>
                    <button class="challenge-btn">Play Easy</button>
                </div>
                <div class="challenge-card" data-challenge="medium">
                    <div class="challenge-icon">😐</div>
                    <div class="challenge-name">Medium</div>
                    <div class="challenge-desc">Score 20 points</div>
                    <button class="challenge-btn">Play Medium</button>
                </div>
                <div class="challenge-card" data-challenge="hard">
                    <div class="challenge-icon">😤</div>
                    <div class="challenge-name">Hard</div>
                    <div class="challenge-desc">Score 25 points</div>
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
        const content = document.getElementById('holemole-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Starting game...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/holemole/start?uid=${this.uid}&token=${this.token}`,
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
            this.showGameInterface();
            this.startGameLoop();
        } catch (error) {
            console.error('[HoleMole] Error starting game:', error);
            this.showRetryScreen('Failed to start game');
        }
    }

    showGameInterface() {
        const content = document.getElementById('holemole-content');
        if (!content) return;

        const challenges = {
            easy: { icon: '😊', name: 'Easy', color: '#00ff88' },
            medium: { icon: '😐', name: 'Medium', color: '#ffeb3b' },
            hard: { icon: '😤', name: 'Hard', color: '#ff5252' }
        };

        const ch = challenges[this.session.challenge];

        content.innerHTML = `
            <div class="holemole-header">
                <div class="holemole-info">
                    <div class="challenge-badge" style="background: ${ch.color};">
                        ${ch.icon} ${ch.name}
                    </div>
                    <div class="target-score">Target: ${this.session.targetScore}</div>
                </div>
                <div class="holemole-stats">
                    <div class="stat-box">
                        <div class="stat-label">Score</div>
                        <div class="stat-value" id="score">${this.session.score}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Time</div>
                        <div class="stat-value" id="timer">${this.session.timeLimit}</div>
                    </div>
                </div>
                <button class="icon-btn" onclick="window.holeMoleClient.toggleMute()" id="muteBtn">🔊</button>
            </div>

            <div class="play-area" id="play-area">
                ${Array(6).fill(0).map((_, i) => `
                    <div class="target-spot spot${i + 1}" data-index="${i}">
                        <div class="character"></div>
                    </div>
                `).join('')}
            </div>

            <div class="hammer" id="hammer"></div>
        `;

        this.attachGameListeners();
    }

    attachGameListeners() {
        const playArea = document.getElementById('play-area');
        if (!playArea) return;

        playArea.addEventListener('click', (e) => {
            const spot = e.target.closest('.target-spot');
            if (spot && spot.classList.contains('active')) {
                this.handleHit(spot);
            }
        });

        // Hammer animation
        document.addEventListener('mousemove', (e) => {
            const hammer = document.getElementById('hammer');
            if (hammer && this.session?.status === 'playing') {
                hammer.style.left = (e.pageX - 45) + 'px';
                hammer.style.top = (e.pageY - 45) + 'px';
                hammer.classList.add('visible');
            }
        });
    }

    startGameLoop() {
        const startTime = Date.now();
        
        // Timer
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, this.session.timeLimit - elapsed);
            
            const timerEl = document.getElementById('timer');
            if (timerEl) {
                timerEl.textContent = remaining;
                if (remaining <= 10) {
                    timerEl.style.color = '#ff4757';
                }
            }

            if (remaining <= 0) {
                this.stopGame();
                this.endGame();
            }
        }, 100);

        // Spawn moles
        this.gameInterval = setInterval(() => {
            this.spawnMole();
        }, this.getMoleSpeed());
    }

    getMoleSpeed() {
        const speeds = {
            easy: 1300,
            medium: 1100,
            hard: 850
        };
        return speeds[this.session.challenge] || 1300;
    }

    spawnMole() {
        const spots = document.querySelectorAll('.target-spot');
        const availableSpots = Array.from(spots).filter(s => !s.classList.contains('active'));
        
        if (availableSpots.length === 0) return;

        const spot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
        spot.classList.add('active');
        this.activeSpots.add(spot);

        setTimeout(() => {
            spot.classList.remove('active');
            this.activeSpots.delete(spot);
            const char = spot.querySelector('.character');
            if (char) char.classList.remove('smashed');
        }, this.getMoleSpeed() - 200);
    }

    async handleHit(spot) {
        const char = spot.querySelector('.character');
        if (!char || char.classList.contains('smashed')) return;

        char.classList.add('smashed');
        
        // Show hammer animation
        const hammer = document.getElementById('hammer');
        if (hammer) {
            hammer.classList.add('smashing');
            setTimeout(() => hammer.classList.remove('smashing'), 250);
        }

        // Play sound
        if (!this.isMuted) this.playHitSound();

        try {
            const result = await this.fetchWithRetry(
                `/api/games/holemole/hit?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ timestamp: Date.now() })
                }
            );

            if (result.success) {
                const scoreEl = document.getElementById('score');
                if (scoreEl) scoreEl.textContent = result.score;
                this.session.score = result.score;
            }
        } catch (error) {
            console.error('[HoleMole] Error recording hit:', error);
        }
    }

    stopGame() {
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            this.gameInterval = null;
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        document.querySelectorAll('.target-spot').forEach(spot => {
            spot.classList.remove('active');
        });
        this.activeSpots.clear();
    }

    async endGame() {
        try {
            const result = await this.fetchWithRetry(
                `/api/games/holemole/end?uid=${this.uid}&token=${this.token}`,
                { method: 'POST' }
            );

            if (result.success) {
                this.showResult(result);
            }
        } catch (error) {
            console.error('[HoleMole] Error ending game:', error);
            this.showRetryScreen('Failed to save results');
        }
    }

    showResult(result) {
        const content = document.getElementById('holemole-content');
        if (!content) return;

        const won = result.won;

        content.innerHTML = `
            <div class="result-display">
                <div class="result-text ${won ? 'win' : 'lose'}">
                    ${won ? '🎉 YOU WON!' : '😢 TRY AGAIN!'}
                </div>
                <div class="result-stats">
                    <div class="result-stat">
                        <div class="result-label">Your Score</div>
                        <div class="result-value">${result.score}</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-label">Target</div>
                        <div class="result-value">${result.targetScore}</div>
                    </div>
                </div>
            </div>
            <button class="action-btn" onclick="window.holeMoleClient.checkGameState()">
                Play Again
            </button>
        `;
    }

    showCooldown(minutesLeft) {
        const content = document.getElementById('holemole-content');
        if (!content) return;

        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⏰ Cooldown Active</h3>
                <p>You've played 3 matches. Come back in ${minutesLeft} minutes!</p>
            </div>
        `;
    }

    showRetryScreen(message) {
        const content = document.getElementById('holemole-content');
        if (!content) return;

        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⚠️ Error</h3>
                <p>${message}</p>
                <button class="action-btn" onclick="window.holeMoleClient.checkGameState()">
                    🔄 Retry
                </button>
            </div>
        `;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const btn = document.getElementById('muteBtn');
        if (btn) btn.textContent = this.isMuted ? '🔇' : '🔊';
    }

    playHitSound() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 900;
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.holeMoleClient = new HoleMoleClient();
});