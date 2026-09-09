// Head & Tails Cricket Game Client - FIXED NETWORK ERROR & SESSION
class HeadTailsClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.session = null;
        this.isActive = false;
        this.matchesRemaining = 3;
        this.selectedNumber = null;
        
        console.log('[HeadTails] Client created');
        this.createGameHTML();
    }

    createGameHTML() {
        const container = document.getElementById('headtails-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="headtails-back-btn">← Back</button>
                <div class="game-title">🏏 Head & Tails Cricket</div>
            </div>

            <div id="headtails-content" class="game-area">
                <!-- Content will be dynamically loaded -->
            </div>
        `;
    }

    async init() {
        if (this.isActive) return;
        
        console.log('[HeadTails] Initializing...');
        this.isActive = true;
        
        this.setupEventListeners();
        await this.checkGameState();
        
        console.log('[HeadTails] ✅ Ready');
    }

    cleanup() {
        console.log('[HeadTails] Cleaning up...');
        this.isActive = false;
        this.selectedNumber = null;
        // ✅ Don't clear session - it will resume if exists
    }

    setupEventListeners() {
        const backBtn = document.getElementById('headtails-back-btn');
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
                console.error(`[HeadTails] Attempt ${i + 1} failed:`, error);
                
                if (i === maxRetries - 1) throw error;
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async checkGameState() {
        const content = document.getElementById('headtails-content');
        if (!content) return;

        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px; font-size: 1.1rem;">Loading game...</div>
            </div>
        `;

        try {
            const canPlayData = await this.fetchWithRetry(
                `/api/games/headtails/can-play?uid=${this.uid}&token=${this.token}`
            );
            
            this.matchesRemaining = canPlayData.matchesRemaining || 0;

            if (!canPlayData.canPlay) {
                this.showCooldown(canPlayData.minutesLeft);
                return;
            }

            const sessionData = await this.fetchWithRetry(
                `/api/games/headtails/session?uid=${this.uid}&token=${this.token}`
            );
            
            if (sessionData.session) {
                this.session = sessionData.session;
                console.log('[HeadTails] ✅ Session resumed:', this.session.phase);
                this.handlePhase();
            } else {
                this.showStartScreen();
            }
        } catch (error) {
            console.error('[HeadTails] Error checking state:', error);
            // ✅ Show retry but DON'T show error notification at top
            this.showRetryScreen('Failed to load game. Check your connection.');
        }
    }

    showStartScreen() {
        const content = document.getElementById('headtails-content');
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
                    <li>🪙 Win the toss to choose Batting or Bowling</li>
                    <li>🎯 Score runs (1-6) or get OUT if numbers match</li>
                    <li>🏏 5 wickets or 7 overs (42 balls) per inning</li>
                    <li>🎊 Win by scoring more runs than opponent</li>
                    <li>🔄 Session auto-expires after 20 minutes</li>
                    <li>⏱️ Play ${this.matchesRemaining} matches, then 1 hour cooldown</li>
                </ul>
            </div>
            <button class="action-btn" id="start-game-btn">Start Match</button>
        `;

        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.startGame();
        });
    }

    async startGame() {
        const content = document.getElementById('headtails-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Starting match...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/headtails/start?uid=${this.uid}&token=${this.token}`,
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
                console.log('[HeadTails] ✅ Match resumed from:', this.session.phase);
            }
            
            this.handlePhase();
        } catch (error) {
            console.error('[HeadTails] Error starting game:', error);
            this.showRetryScreen('Failed to start match. Check your connection.');
        }
    }

    handlePhase() {
        switch (this.session.phase) {
            case 'toss':
                this.showTossScreen();
                break;
            case 'choose_action':
                this.showChooseActionScreen();
                break;
            case 'inning1':
            case 'inning2':
                this.showGameplayScreen();
                break;
            case 'result':
                this.showResultScreen();
                break;
        }
    }

    showTossScreen() {
        const content = document.getElementById('headtails-content');
        
        content.innerHTML = `
            <div class="toss-screen">
                <h3>🪙 Toss Time!</h3>
                <p>Choose Head or Tail</p>
                
                <div class="toss-choices">
                    <div class="toss-btn" data-choice="head">
                        <div class="toss-icon">🟡</div>
                        <div class="toss-label">HEAD</div>
                    </div>
                    <div class="toss-btn" data-choice="tail">
                        <div class="toss-icon">⚫</div>
                        <div class="toss-label">TAIL</div>
                    </div>
                </div>
            </div>
        `;

        document.querySelectorAll('.toss-btn').forEach(btn => {
            btn.addEventListener('click', () => this.performToss(btn.dataset.choice));
        });
    }

    async performToss(choice) {
        const content = document.getElementById('headtails-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 4rem; animation: spin 1s linear;">🪙</div>
                <div style="margin-top: 15px;">Tossing...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/headtails/toss?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ choice })
                }
            );

            if (!result.success) {
                console.error('[HeadTails] Toss failed:', result.error);
                this.checkGameState(); // ✅ Just reload, no error message
                return;
            }

            this.session = result.session;
            
            // Show toss result
            content.innerHTML = `
                <div class="toss-result">
                    <h3>Toss Result: ${result.tossResult.toUpperCase()}</h3>
                    <div style="font-size: 3rem; margin: 20px 0;">
                        ${result.tossResult === 'head' ? '🟡' : '⚫'}
                    </div>
                    <div style="font-size: 1.3rem; color: ${result.userWon ? '#4ecdc4' : '#ff6b6b'};">
                        ${result.userWon ? '🎉 You Won the Toss!' : '😔 Computer Won the Toss'}
                    </div>
                </div>
            `;

            setTimeout(() => this.handlePhase(), 2000);
        } catch (error) {
            console.error('[HeadTails] Network error during toss:', error);
            // ✅ Just retry silently
            setTimeout(() => this.checkGameState(), 2000);
        }
    }

    showChooseActionScreen() {
        const content = document.getElementById('headtails-content');
        const userWonToss = this.session.tossWinner === 'user';
        
        content.innerHTML = `
            <div class="choose-action-screen">
                <h3>${userWonToss ? '🎯 Choose Your Action' : '⏳ Computer is Choosing...'}</h3>
                
                ${userWonToss ? `
                <div class="action-choices">
                    <div class="action-btn-choice" data-action="batting">
                        <div class="action-icon">🏏</div>
                        <div class="action-label">BATTING</div>
                    </div>
                    <div class="action-btn-choice" data-action="bowling">
                        <div class="action-icon">⚾</div>
                        <div class="action-label">BOWLING</div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        if (userWonToss) {
            document.querySelectorAll('.action-btn-choice').forEach(btn => {
                btn.addEventListener('click', () => this.chooseAction(btn.dataset.action));
            });
        } else {
            setTimeout(() => this.chooseAction(''), 2000);
        }
    }

    async chooseAction(action) {
        const content = document.getElementById('headtails-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Setting up match...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/headtails/choose?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: action || 'batting' })
                }
            );

            if (!result.success) {
                console.error('[HeadTails] Choose action failed:', result.error);
                this.checkGameState(); // ✅ Just reload
                return;
            }

            this.session = result.session;
            
            // Show chosen actions
            content.innerHTML = `
                <div class="action-result">
                    <h3>Match Setup</h3>
                    <div class="action-display">
                        <div class="action-item">
                            <div>You: ${result.userAction.toUpperCase()}</div>
                        </div>
                        <div class="action-item">
                            <div>Computer: ${result.computerAction.toUpperCase()}</div>
                        </div>
                    </div>
                </div>
            `;

            setTimeout(() => this.handlePhase(), 2000);
        } catch (error) {
            console.error('[HeadTails] Network error during choose:', error);
            setTimeout(() => this.checkGameState(), 2000);
        }
    }

    showGameplayScreen() {
        const content = document.getElementById('headtails-content');
        const inning = this.session.innings[this.session.phase];
        const isBatting = inning.batting === 'user';
        const isInning2 = this.session.phase === 'inning2';
        
        const overs = Math.floor(inning.balls / 6);
        const ballsInOver = inning.balls % 6;
        const ballsLeft = 42 - inning.balls;
        
        content.innerHTML = `
            <div class="gameplay-screen">
                <div class="inning-header">
                    <h3>Inning ${this.session.phase === 'inning1' ? '1' : '2'}</h3>
                    ${isInning2 ? `<div class="target-display">Target: ${inning.target}</div>` : ''}
                </div>
                
                <div class="scoreboard">
                    <div class="score-side">
                        <div class="team-label">${isBatting ? 'You (Batting)' : 'Computer (Batting)'}</div>
                        <div class="score-big">${inning.runs}/${inning.wickets}</div>
                    </div>
                    <div class="over-info">
                        <div class="over-label">Overs</div>
                        <div class="over-value">${overs}.${ballsInOver}/7</div>
                        <div class="balls-left">${ballsLeft} balls left</div>
                    </div>
                </div>
                
                <div id="ball-result-area"></div>
                
                <div class="game-instruction">
                    ${isBatting ? '🏏 Throw Your Ball' : '⚾ Select Number to Bowl'}
                </div>
                
                <div class="number-grid">
                    <div class="number-box" data-number="1">1</div>
                    <div class="number-box" data-number="2">2</div>
                    <div class="number-box" data-number="3">3</div>
                    <div class="number-box" data-number="4">4</div>
                    <div class="number-box" data-number="5">5</div>
                    <div class="number-box" data-number="6">6</div>
                </div>
                
                <button class="action-btn" id="ready-play-btn" disabled>Ready</button>
            </div>
        `;

        this.attachGameplayListeners();
    }

    attachGameplayListeners() {
        document.querySelectorAll('.number-box').forEach(box => {
            box.addEventListener('click', () => {
                this.selectNumber(parseInt(box.dataset.number));
            });
        });

        document.getElementById('ready-play-btn').addEventListener('click', () => {
            this.playBall();
        });
    }

    selectNumber(number) {
        this.selectedNumber = number;

        document.querySelectorAll('.number-box').forEach(box => {
            box.classList.remove('selected');
        });

        document.querySelector(`[data-number="${number}"]`).classList.add('selected');
        document.getElementById('ready-play-btn').disabled = false;
    }

    async playBall() {
        if (!this.selectedNumber) {
            return;
        }

        document.querySelectorAll('.number-box').forEach(box => {
            box.classList.add('disabled');
        });
        const readyBtn = document.getElementById('ready-play-btn');
        readyBtn.disabled = true;
        readyBtn.textContent = 'Playing...';

        try {
            const result = await this.fetchWithRetry(
                `/api/games/headtails/play?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number: this.selectedNumber })
                }
            );

            if (!result.success) {
                console.error('[HeadTails] Play ball failed:', result.error);
                this.selectedNumber = null;
                this.checkGameState(); // ✅ Just reload
                return;
            }

            this.session = result.session;
            this.showBallResult(result.ball);

            setTimeout(() => {
                if (result.inningEnded) {
                    if (this.session.phase === 'result') {
                        // ✅ Update matches remaining from session
                        const canPlayResult = this.canPlay(this.uid);
                        this.showResultScreen();
                    } else {
                        this.showInningEnd(result.reason);
                    }
                } else {
                    this.selectedNumber = null;
                    this.showGameplayScreen();
                }
            }, 2500);
        } catch (error) {
            console.error('[HeadTails] Network error during play:', error);
            // ✅ Just reload game state silently
            this.selectedNumber = null;
            setTimeout(() => this.checkGameState(), 2000);
        }
    }

    showBallResult(ball) {
        const resultArea = document.getElementById('ball-result-area');
        if (!resultArea) return;

        const inning = this.session.innings[this.session.phase];
        const isBatting = inning.batting === 'user';

        resultArea.innerHTML = `
            <div class="ball-result">
                <div class="ball-numbers">
                    <div class="ball-number-display">
                        <div class="ball-label">You</div>
                        <div class="ball-value">${ball.userNumber}</div>
                    </div>
                    <div class="vs-ball">VS</div>
                    <div class="ball-number-display">
                        <div class="ball-label">Computer</div>
                        <div class="ball-value">${ball.computerNumber}</div>
                    </div>
                </div>
                <div class="ball-outcome ${ball.isOut ? 'out' : 'runs'}">
                    ${ball.isOut ? '❌ OUT!' : `✅ ${ball.runsScored} ${ball.runsScored === 1 ? 'Run' : 'Runs'}`}
                </div>
            </div>
        `;
    }

    showInningEnd(reason) {
        const content = document.getElementById('headtails-content');
        const inning1 = this.session.innings.inning1;
        
        content.innerHTML = `
            <div class="inning-end">
                <h3>✅ Inning 1 Complete</h3>
                <div class="final-score">${inning1.runs}/${inning1.wickets}</div>
                <div class="reason-text">
                    ${reason === 'all_out' ? 'All Out!' : 'Overs Complete!'}
                </div>
                <div class="target-info">
                    Target for Inning 2: <strong>${inning1.runs + 1}</strong>
                </div>
            </div>
        `;

        setTimeout(() => this.showGameplayScreen(), 3000);
    }

    showResultScreen() {
        const content = document.getElementById('headtails-content');
        const inning1 = this.session.innings.inning1;
        const inning2 = this.session.innings.inning2;
        const result = this.session.result;

        // ✅ Update matches remaining after result
        this.matchesRemaining = result === 'tie' ? this.matchesRemaining : Math.max(0, this.matchesRemaining - 1);

        content.innerHTML = `
            <div class="result-screen">
                <div class="result-header ${result}">
                    ${result === 'win' ? '🎉 YOU WON!' : result === 'lose' ? '😔 YOU LOST!' : '🤝 TIE!'}
                </div>
                
                <div class="final-scores">
                    <div class="final-score-item">
                        <div class="final-label">Inning 1</div>
                        <div class="final-value">${inning1.runs}/${inning1.wickets}</div>
                        <div class="final-team">${inning1.batting === 'user' ? 'You' : 'Computer'}</div>
                    </div>
                    <div class="final-score-item">
                        <div class="final-label">Inning 2</div>
                        <div class="final-value">${inning2.runs}/${inning2.wickets}</div>
                        <div class="final-team">${inning2.batting === 'user' ? 'You' : 'Computer'}</div>
                    </div>
                </div>
                
                ${result === 'tie' ? `
                <div style="margin: 20px 0; padding: 15px; background: rgba(255, 215, 0, 0.2); border-radius: 10px; font-size: 1rem; color: #ffd700;">
                    ⚠️ Tie matches don't count toward your limit
                </div>
                ` : ''}
                
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
            this.selectedNumber = null;
            this.checkGameState();
        });
    }

    showCooldown(minutesLeft) {
        const content = document.getElementById('headtails-content');
        
        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⏰ Cooldown Active</h3>
                <p>You've played 3 matches. Come back in ${minutesLeft} minutes!</p>
            </div>
        `;
    }

    showRetryScreen(message) {
        const content = document.getElementById('headtails-content');
        
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

    // ✅ Removed showNotification - no more top notifications
}

document.addEventListener('DOMContentLoaded', () => {
    window.headTailsClient = new HeadTailsClient();
});