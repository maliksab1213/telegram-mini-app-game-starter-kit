// Memory Game Client
class MemoryGameClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.isActive = false;
        this.session = null;
        this.timerInterval = null;
        this.flippedCards = [];
        this.canFlip = true;
        this.isMuted = false;
        this.cardImages = [];
        
        // Load card images
        for (let i = 1; i <= 16; i++) {
            this.cardImages.push(`/locations/games/memory-game_assets/image${i}.png`);
        }
        
        console.log('[MemoryGame] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('memorygame-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="memorygame-back-btn">← Back</button>
                <div class="game-title">🧠 PICTURE MATCH 🧠</div>
            </div>
            <div id="memorygame-content" class="game-area"></div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[MemoryGame] Initializing...');
        this.isActive = true;
        
        this.setupEventListeners();
        await this.checkGameState();
        
        console.log('[MemoryGame] ✅ Ready');
    }

    cleanup() {
        console.log('[MemoryGame] Cleaning up...');
        this.stopTimer();
        this.isActive = false;
        this.session = null;
    }

    setupEventListeners() {
        const backBtn = document.getElementById('memorygame-back-btn');
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
                console.error(`[MemoryGame] Attempt ${i + 1} failed:`, error);
                
                if (i === maxRetries - 1) throw error;
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async checkGameState() {
        const content = document.getElementById('memorygame-content');
        if (!content) return;

        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px; font-size: 1.1rem;">Loading game...</div>
            </div>
        `;

        try {
            const canPlayData = await this.fetchWithRetry(
                `/api/games/memorygame/can-play?uid=${this.uid}&token=${this.token}`
            );

            if (!canPlayData.canPlay) {
                this.showCooldown(canPlayData.minutesLeft);
                return;
            }

            const sessionData = await this.fetchWithRetry(
                `/api/games/memorygame/session?uid=${this.uid}&token=${this.token}`
            );

            if (sessionData.session) {
                this.session = sessionData.session;
                this.showGameInterface();
                this.startTimer();
            } else {
                this.showChallengeSelect(canPlayData.matchesRemaining);
            }
        } catch (error) {
            console.error('[MemoryGame] Error checking state:', error);
            this.showRetryScreen('Failed to load game');
        }
    }

    showChallengeSelect(matchesRemaining) {
        const content = document.getElementById('memorygame-content');
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
                <p>Match all pairs before time runs out!</p>
            </div>

            <div class="challenges-grid">
                <div class="challenge-card" data-challenge="easy">
                    <div class="challenge-icon">😊</div>
                    <div class="challenge-name">Easy</div>
                    <div class="challenge-desc">60 seconds</div>
                    <button class="challenge-btn">Play Easy</button>
                </div>
                <div class="challenge-card" data-challenge="medium">
                    <div class="challenge-icon">😐</div>
                    <div class="challenge-name">Medium</div>
                    <div class="challenge-desc">45 seconds</div>
                    <button class="challenge-btn">Play Medium</button>
                </div>
                <div class="challenge-card" data-challenge="hard">
                    <div class="challenge-icon">😤</div>
                    <div class="challenge-name">Hard</div>
                    <div class="challenge-desc">30 seconds</div>
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
        const content = document.getElementById('memorygame-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Starting game...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/memorygame/start?uid=${this.uid}&token=${this.token}`,
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
            this.startTimer();
        } catch (error) {
            console.error('[MemoryGame] Error starting game:', error);
            this.showRetryScreen('Failed to start game');
        }
    }

    showGameInterface() {
        const content = document.getElementById('memorygame-content');
        if (!content) return;

        const challenges = {
            easy: { icon: '😊', name: 'Easy', color: '#00ff88' },
            medium: { icon: '😐', name: 'Medium', color: '#ffeb3b' },
            hard: { icon: '😤', name: 'Hard', color: '#ff5252' }
        };

        const ch = challenges[this.session.challenge];

        content.innerHTML = `
            <div class="memory-header">
                <div class="memory-info">
                    <div class="challenge-badge" style="background: ${ch.color};">
                        ${ch.icon} ${ch.name}
                    </div>
                </div>
                <div class="memory-stats">
                    <div class="stat-box">
                        <div class="stat-label">Moves</div>
                        <div class="stat-value" id="moves">${this.session.moves}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Time</div>
                        <div class="stat-value" id="timer">${this.session.timeLimit}</div>
                    </div>
                </div>
                <button class="icon-btn" onclick="window.memoryGameClient.toggleMute()" id="muteBtn">🔊</button>
            </div>

            <div class="memory-grid" id="memory-grid">
                ${this.session.cards.map((cardValue, index) => `
                    <div class="memory-card ${this.session.matched.includes(index) ? 'matched' : ''}" 
                         data-index="${index}" 
                         data-value="${cardValue}">
                        <div class="card-face card-back">?</div>
                        <div class="card-face card-front">${this.getCardDisplay(cardValue)}</div>
                    </div>
                `).join('')}
            </div>
        `;

        this.attachGameListeners();
    }

    getCardDisplay(value) {
        // Try to load image, fallback to emoji if image fails
        const imageUrl = this.cardImages[value];
        if (imageUrl) {
            return `<img src="${imageUrl}" alt="card" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" 
                    onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <span style="display:none;font-size:3.5rem;">🎴</span>`;
        }
        return `<span style="font-size:3.5rem;">🎴</span>`;
    }

    attachGameListeners() {
        document.querySelectorAll('.memory-card').forEach(card => {
            card.addEventListener('click', () => this.handleCardClick(card));
        });
    }

    async handleCardClick(cardEl) {
        if (!this.canFlip) return;
        if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;
        if (this.flippedCards.length >= 2) return;

        const cardIndex = parseInt(cardEl.dataset.index);

        cardEl.classList.add('flipped');
        this.flippedCards.push({ element: cardEl, index: cardIndex });

        if (this.flippedCards.length === 2) {
            this.canFlip = false;

            try {
                const result = await this.fetchWithRetry(
                    `/api/games/memorygame/flip?uid=${this.uid}&token=${this.token}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            cardIndex: this.flippedCards[1].index,
                            timestamp: Date.now() 
                        })
                    }
                );

                if (result.success) {
                    const movesEl = document.getElementById('moves');
                    if (movesEl) movesEl.textContent = result.moves;
                    this.session.moves = result.moves;

                    if (result.matchResult === 'match') {
                        this.handleMatch();
                    } else if (result.matchResult === 'no_match') {
                        this.handleNoMatch();
                    }

                    // Check if game won
                    if (result.matched.length === this.session.cards.length) {
                        this.stopTimer();
                        setTimeout(() => this.endGame(true), 500);
                    }
                } else {
                    this.resetFlippedCards();
                }
            } catch (error) {
                console.error('[MemoryGame] Error flipping card:', error);
                this.resetFlippedCards();
            }
        } else {
            // First card flipped, send to server
            try {
                await this.fetchWithRetry(
                    `/api/games/memorygame/flip?uid=${this.uid}&token=${this.token}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            cardIndex,
                            timestamp: Date.now() 
                        })
                    }
                );
            } catch (error) {
                console.error('[MemoryGame] Error flipping first card:', error);
            }
        }
    }

    handleMatch() {
        if (!this.isMuted) this.playCorrectSound();

        this.flippedCards.forEach(card => {
            card.element.classList.add('matched', 'correct-match');
        });

        setTimeout(() => {
            this.flippedCards.forEach(card => {
                card.element.classList.remove('correct-match');
            });
            this.flippedCards = [];
            this.canFlip = true;
        }, 600);
    }

    handleNoMatch() {
        if (!this.isMuted) this.playWrongSound();

        this.flippedCards.forEach(card => {
            card.element.classList.add('wrong-match');
        });

        setTimeout(() => {
            this.flippedCards.forEach(card => {
                card.element.classList.remove('flipped', 'wrong-match');
            });
            this.flippedCards = [];
            this.canFlip = true;
        }, 1000);
    }

    resetFlippedCards() {
        this.flippedCards.forEach(card => {
            card.element.classList.remove('flipped');
        });
        this.flippedCards = [];
        this.canFlip = true;
    }

    startTimer() {
        const startTime = Date.now();
        
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
                this.stopTimer();
                this.endGame(false);
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    async endGame(won) {
        this.canFlip = false;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/memorygame/end?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ won })
                }
            );

            if (result.success) {
                this.showResult(result);
            }
        } catch (error) {
            console.error('[MemoryGame] Error ending game:', error);
            this.showRetryScreen('Failed to save results');
        }
    }

    showResult(result) {
        const content = document.getElementById('memorygame-content');
        if (!content) return;

        const won = result.won;

        content.innerHTML = `
            <div class="result-display">
                <div class="result-text ${won ? 'win' : 'lose'}">
                    ${won ? '🎉 YOU WON!' : '⏰ TIME\'S UP!'}
                </div>
                <div class="result-stats">
                    <div class="result-stat">
                        <div class="result-label">Total Moves</div>
                        <div class="result-value">${result.moves}</div>
                    </div>
                </div>
            </div>
            <button class="action-btn" onclick="window.memoryGameClient.checkGameState()">
                Play Again
            </button>
        `;
    }

    showCooldown(minutesLeft) {
        const content = document.getElementById('memorygame-content');
        if (!content) return;

        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⏰ Cooldown Active</h3>
                <p>You've played 3 matches. Come back in ${minutesLeft} minutes!</p>
            </div>
        `;
    }

    showRetryScreen(message) {
        const content = document.getElementById('memorygame-content');
        if (!content) return;

        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⚠️ Error</h3>
                <p>${message}</p>
                <button class="action-btn" onclick="window.memoryGameClient.checkGameState()">
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

    playCorrectSound() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    }

    playWrongSound() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 200;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.memoryGameClient = new MemoryGameClient();
});