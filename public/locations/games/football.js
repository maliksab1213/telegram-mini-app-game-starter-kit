// Football Client - Complete Foosball Game with Match System
class FootballClient {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.session = null;
        this.isActive = false;
        this.matchesRemaining = 3;
        this.gameStarted = false;
        this.gameOver = false;
        this.canvas = null;
        this.ctx = null;
        this.homeScore = 0;
        this.awayScore = 0;
        this.timerInterval = null;
        this.cleanupGame = null;
        this.assetsLoaded = false;
        this.homePlayer = new Image();
        this.awayPlayer = new Image();
        this.ballImg = new Image();
        
        console.log('[Football] Client created');
    }

    async init() {
        if (this.isActive) return;
        console.log('[Football] Initializing...');
        this.isActive = true;
        this.createGameHTML();
        this.setupEventListeners();
        await this.checkGameState();
        console.log('[Football] ✅ Ready');
    }

    cleanup() {
        console.log('[Football] Cleaning up...');
        this.isActive = false;
        this.session = null;
        this.gameStarted = false;
        this.gameOver = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.cleanupGame) {
            this.cleanupGame();
            this.cleanupGame = null;
        }
        this.canvas = null;
        this.ctx = null;
        this.homeScore = 0;
        this.awayScore = 0;
    }

    createGameHTML() {
        const container = document.getElementById('football-game-view');
        if (!container) return;

        container.innerHTML = `
            <div class="game-header">
                <button class="back-btn" id="football-back-btn">← Back</button>
                <div class="game-title">⚽ Football Match</div>
            </div>
            <div id="football-content" class="game-area"></div>
        `;
    }

    setupEventListeners() {
        const backBtn = document.getElementById('football-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.cleanup();
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
                console.error(`[Football] Attempt ${i + 1} failed:`, error);
                
                if (i === maxRetries - 1) throw error;
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async checkGameState() {
        const content = document.getElementById('football-content');
        if (!content) return;

        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px; font-size: 1.1rem;">Loading game...</div>
            </div>
        `;

        try {
            const canPlayData = await this.fetchWithRetry(
                `/api/games/football/can-play?uid=${this.uid}&token=${this.token}`
            );
            
            this.matchesRemaining = canPlayData.matchesRemaining || 0;

            if (!canPlayData.canPlay) {
                this.showCooldown(canPlayData.minutesLeft);
                return;
            }

            const sessionData = await this.fetchWithRetry(
                `/api/games/football/session?uid=${this.uid}&token=${this.token}`
            );
            
            if (sessionData.session) {
                this.session = sessionData.session;
                this.showMatchStatus();
            } else {
                this.showStartScreen();
            }
        } catch (error) {
            console.error('[Football] Error checking state:', error);
            this.showRetryScreen('Failed to load game.');
        }
    }

    showStartScreen() {
        const content = document.getElementById('football-content');
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
                    <li>⚽ Win 2 out of 3 games to win ONE match</li>
                    <li>🎯 Score more goals than computer</li>
                    <li>🔄 Draws don't count - replay!</li>
                    <li>⏱️ 2 minutes per game</li>
                    <li>⚠️ You can play ${this.matchesRemaining} matches, then 1 hour cooldown</li>
                    <li>🕹️ Use arrow keys (← →) or buttons to move</li>
                </ul>
            </div>
            <button class="action-btn" id="start-match-btn">Start Match</button>
        `;

        document.getElementById('start-match-btn').addEventListener('click', () => {
            this.startMatch();
        });
    }

    async startMatch() {
        const content = document.getElementById('football-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Starting match...</div>
            </div>
        `;

        try {
            const result = await this.fetchWithRetry(
                `/api/games/football/start?uid=${this.uid}&token=${this.token}`,
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
            
            this.showMatchStatus();
        } catch (error) {
            console.error('[Football] Error starting match:', error);
            this.showRetryScreen('Failed to start match.');
        }
    }

    showMatchStatus() {
        const content = document.getElementById('football-content');
        if (!content) return;

        content.innerHTML = `
            <div class="match-info">
                <h3>Match Progress</h3>
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
                <div style="margin-top: 15px; color: #aaa;">
                    Game ${this.session.currentGame} of 3<br>
                    Matches Remaining: ${this.matchesRemaining}
                </div>
            </div>
            <button class="action-btn" id="play-game-btn">Play Game ${this.session.currentGame}</button>
        `;

        document.getElementById('play-game-btn').addEventListener('click', () => {
            this.loadAssetsAndStart();
        });
    }

    async loadAssetsAndStart() {
        const content = document.getElementById('football-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem;">⏳</div>
                <div style="margin-top: 15px;">Loading game assets...</div>
                <div id="asset-status" style="margin-top: 10px; font-size: 0.9rem; color: #aaa;"></div>
            </div>
        `;

        const statusEl = document.getElementById('asset-status');
        
        try {
            statusEl.textContent = 'Loading player...';
            await this.loadImage(this.homePlayer, '/locations/games/footballassets/player.png');
            
            statusEl.textContent = 'Loading opponent...';
            await this.loadImage(this.awayPlayer, '/locations/games/footballassets/opponent.png');
            
            try {
                statusEl.textContent = 'Loading ball...';
                await this.loadImage(this.ballImg, '/locations/games/footballassets/ball.png');
            } catch (e) {
                console.log('[Football] Ball image not found, using default');
            }
            
            this.assetsLoaded = true;
            statusEl.textContent = 'Assets loaded! Starting game...';
            
            setTimeout(() => {
                this.startFootballGame();
            }, 500);
            
        } catch (error) {
            console.error('[Football] Asset loading error:', error);
            statusEl.textContent = 'Some assets failed to load, starting anyway...';
            
            setTimeout(() => {
                this.startFootballGame();
            }, 1000);
        }
    }

    loadImage(img, src) {
        return new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to load ${src}`));
            img.src = src;
        });
    }

    startFootballGame() {
        const content = document.getElementById('football-content');
        if (!content) return;

        content.innerHTML = `
            <div id="football-game-container">
                <div class="game-scoreboard">
                    <div class="score-compact">
                        <span id="timer-display">02:00</span>
                        <span>Computer <strong id="away-score">0</strong></span>
                        <span>You <strong id="home-score">0</strong></span>
                    </div>
                    <div id="game-status"></div>
                </div>
                <canvas id="football-canvas" width="480" height="720"></canvas>
                <div class="control-buttons">
                    <button id="left-control">◄</button>
                    <button id="right-control">►</button>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('football-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.initializeFootballGame();
    }

    initializeFootballGame() {
        let x = this.canvas.width / 2;
        let y = this.canvas.height / 2;
        const ballRadius = 8;
        let dx = 3;
        let dy = -3;
        let m = 0;
        let j = 0;
        const aiSpeed = 2.5;

        const paddleHeight = 10;
        const paddleWidth = 30;
        const paddleX = this.canvas.width - paddleWidth;

        let rightPressed = false;
        let leftPressed = false;

        const goalpostWidth = 150;
        const goalpostHeight = 10;

        this.homeScore = 0;
        this.awayScore = 0;

        const playerHeight = 50;
        const playerWidth = 35;

        this.gameOver = false;
        let flag1 = 1;
        let flag2 = 1;
        let drawFlag = true;

        const canvas = this.canvas;
        const ctx = this.ctx;

        // Vector class
        function Vector(vx, vy) {
            this.x = vx || 0;
            this.y = vy || 0;
        }
        Vector.prototype.copy = function(other) {
            this.x = other.x;
            this.y = other.y;
            return this;
        };
        Vector.prototype.sub = function(other) {
            this.x -= other.x;
            this.y -= other.y;
            return this;
        };
        Vector.prototype.dot = function(other) {
            return this.x * other.x + this.y * other.y;
        };
        Vector.prototype.len2 = function() {
            return this.dot(this);
        };
        Vector.prototype.len = function() {
            return Math.sqrt(this.len2());
        };
        Vector.prototype.normalize = function() {
            var d = this.len();
            if (d > 0) {
                this.x /= d;
                this.y /= d;
            }
            return this;
        };
        Vector.prototype.perp = function() {
            var vx = this.x;
            this.x = this.y;
            this.y = -vx;
            return this;
        };

        // Collision shapes
        function Circle(pos, r) {
            this.pos = pos || new Vector();
            this.r = r || 0;
        }

        function Box(pos, w, h) {
            this.pos = pos || new Vector();
            this.w = w || 0;
            this.h = h || 0;
        }

        Box.prototype.toPolygon = function() {
            var pos = this.pos, w = this.w, h = this.h;
            return new Polygon(new Vector(pos.x, pos.y), [
                new Vector(),
                new Vector(w, 0),
                new Vector(w, h),
                new Vector(0, h)
            ]);
        };

        function Polygon(pos, points) {
            this.pos = pos || new Vector();
            this.points = points || [];
            this.calcPoints = [];
            this.edges = [];
            this.normals = [];
            
            for (var i = 0; i < this.points.length; i++) {
                this.calcPoints.push(new Vector());
                this.edges.push(new Vector());
                this.normals.push(new Vector());
            }
            this._recalc();
        }

        Polygon.prototype._recalc = function() {
            var calcPoints = this.calcPoints;
            var edges = this.edges;
            var normals = this.normals;
            var points = this.points;
            var len = points.length;
            
            for (var i = 0; i < len; i++) {
                calcPoints[i].copy(points[i]);
            }
            
            for (var i = 0; i < len; i++) {
                var p1 = calcPoints[i];
                var p2 = i < len - 1 ? calcPoints[i + 1] : calcPoints[0];
                var e = edges[i].copy(p2).sub(p1);
                normals[i].copy(e).perp().normalize();
            }
            
            return this;
        };

        var T_VECTORS = [];
        for (var i = 0; i < 10; i++) {
            T_VECTORS.push(new Vector());
        }

        function voronoiRegion(line, point) {
            var len2 = line.len2();
            var dp = point.dot(line);
            
            if (dp < 0) {
                return -1;
            } else if (dp > len2) {
                return 1;
            } else {
                return 0;
            }
        }

        function testPolygonCircle(polygon, circle) {
            var circlePos = T_VECTORS.pop().copy(circle.pos).sub(polygon.pos);
            var radius = circle.r;
            var points = polygon.calcPoints;
            var len = points.length;
            var edge = T_VECTORS.pop();
            var point = T_VECTORS.pop();
            
            for (var i = 0; i < len; i++) {
                var next = i === len - 1 ? 0 : i + 1;
                var prev = i === 0 ? len - 1 : i - 1;
                
                edge.copy(polygon.edges[i]);
                point.copy(circlePos).sub(points[i]);
                
                var region = voronoiRegion(edge, point);
                
                if (region === -1) {
                    edge.copy(polygon.edges[prev]);
                    var point2 = T_VECTORS.pop().copy(circlePos).sub(points[prev]);
                    region = voronoiRegion(edge, point2);
                    
                    if (region === 1) {
                        var dist = point.len();
                        if (dist > radius) {
                            T_VECTORS.push(circlePos);
                            T_VECTORS.push(edge);
                            T_VECTORS.push(point);
                            T_VECTORS.push(point2);
                            return false;
                        }
                    }
                    T_VECTORS.push(point2);
                } else if (region === 1) {
                    edge.copy(polygon.edges[next]);
                    point.copy(circlePos).sub(points[next]);
                    region = voronoiRegion(edge, point);
                    
                    if (region === -1) {
                        var dist = point.len();
                        if (dist > radius) {
                            T_VECTORS.push(circlePos);
                            T_VECTORS.push(edge);
                            T_VECTORS.push(point);
                            return false;
                        }
                    }
                } else {
                    var normal = edge.perp().normalize();
                    var dist = point.dot(normal);
                    var distAbs = Math.abs(dist);
                    
                    if (dist > 0 && distAbs > radius) {
                        T_VECTORS.push(circlePos);
                        T_VECTORS.push(normal);
                        T_VECTORS.push(point);
                        return false;
                    }
                }
            }
            
            T_VECTORS.push(circlePos);
            T_VECTORS.push(edge);
            T_VECTORS.push(point);
            return true;
        }

        var circle, box;

        // Input handlers
        const handleKeyDown = (e) => {
            if (e.keyCode == 39) {
                rightPressed = true;
            } else if (e.keyCode == 37) {
                leftPressed = true;
            }
        };

        const handleKeyUp = (e) => {
            if (e.keyCode == 39) {
                rightPressed = false;
            } else if (e.keyCode == 37) {
                leftPressed = false;
            }
        };

        const leftBtn = document.getElementById('left-control');
        const rightBtn = document.getElementById('right-control');

        const leftBtnDown = (e) => {
            e.preventDefault();
            leftPressed = true;
        };
        
        const leftBtnUp = (e) => {
            e.preventDefault();
            leftPressed = false;
        };
        
        const rightBtnDown = (e) => {
            e.preventDefault();
            rightPressed = true;
        };
        
        const rightBtnUp = (e) => {
            e.preventDefault();
            rightPressed = false;
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
        
        leftBtn.addEventListener('touchstart', leftBtnDown);
        leftBtn.addEventListener('touchend', leftBtnUp);
        leftBtn.addEventListener('mousedown', leftBtnDown);
        leftBtn.addEventListener('mouseup', leftBtnUp);
        
        rightBtn.addEventListener('touchstart', rightBtnDown);
        rightBtn.addEventListener('touchend', rightBtnUp);
        rightBtn.addEventListener('mousedown', rightBtnDown);
        rightBtn.addEventListener('mouseup', rightBtnUp);

        const updateScoreDisplay = () => {
            document.getElementById('home-score').textContent = this.homeScore;
            document.getElementById('away-score').textContent = this.awayScore;
        };

        const updateStatus = (message) => {
            document.getElementById('game-status').innerHTML = message;
        };

        // Timer
        let timer = 120;
        this.timerInterval = setInterval(() => {
            if (--timer <= 0) {
                clearInterval(this.timerInterval);
                this.gameOver = true;
                drawFlag = false;
                this.handleGameEnd(this.homeScore, this.awayScore);
            }
            const minutes = Math.floor(timer / 60).toString().padStart(2, '0');
            const seconds = (timer % 60).toString().padStart(2, '0');
            document.getElementById('timer-display').textContent = `${minutes}:${seconds}`;
        }, 1000);

        const drawBall = () => {
            if (this.assetsLoaded && this.ballImg.complete && this.ballImg.naturalWidth > 0) {
                ctx.drawImage(this.ballImg, x - ballRadius, y - ballRadius, ballRadius * 2, ballRadius * 2);
            } else {
                ctx.beginPath();
                ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
                ctx.fillStyle = "#fff";
                ctx.fill();
                ctx.closePath();
            }

            circle = new Circle(new Vector(x, y), ballRadius);

            const margin = ballRadius + 2;
            
            if (x + dx > canvas.width - margin) {
                dx = -Math.abs(dx);
                x = canvas.width - margin;
            } else if (x + dx < margin) {
                dx = Math.abs(dx);
                x = margin;
            }
            
            if (y + dy > canvas.height - margin) {
                dy = -Math.abs(dy);
                y = canvas.height - margin;
            } else if (y + dy < margin) {
                dy = Math.abs(dy);
                y = margin;
            }
        };

        const drawPlayer = (px, py, img, color) => {
            if (this.assetsLoaded && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, px - playerWidth/2, py - playerHeight + 10, playerWidth, playerHeight);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(px - playerWidth/2, py - playerHeight, playerWidth, playerHeight);
            }
        };

        const drawRods = (yAxis) => {
            ctx.beginPath();
            ctx.rect(0, yAxis + 2, canvas.width, paddleHeight - 5);
            ctx.fillStyle = "#BDBDBD";
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.closePath();
        };

        const collisionDetection = (box, pX) => {
            if (testPolygonCircle(box, circle)) {
                var speed = (x + ballRadius - pX + (playerWidth/2)) / (playerWidth/2) * 5;
                
                if (flag1 == 1) {
                    if (dy > 0) {
                        dy = -dy;
                        y = y - speed;
                        if (dx > 0) x = x + speed;
                        else x = x - speed;
                    } else {
                        y = y - speed;
                        if (dx > 0) x = x - speed;
                        else x = x + speed;
                    }
                    flag1 = 0;
                }
            } else {
                flag1 = 1;
            }
        };

        const collisionDetectionAway = (box, pX) => {
            if (testPolygonCircle(box, circle)) {
                var speed = (x + ballRadius - pX + (playerWidth/2)) / (playerWidth/2) * 5;
                
                if (flag2 == 1) {
                    if (dy < 0) {
                        dy = -dy;
                        y = y + speed;
                        if (dx > 0) x = x + speed;
                        else x = x - speed;
                    } else {
                        y = y + speed;
                        if (dx > 0) x = x + speed;
                        else x = x - speed;
                    }
                    flag2 = 0;
                }
            } else {
                flag2 = 1;
            }
        };

        const drawGoalPost = () => {
            // Home goal (bottom)
            const gphX = (canvas.width - goalpostWidth) / 2;
            const gphY = canvas.height - goalpostHeight;
            ctx.fillStyle = "#9C9C9C";
            ctx.fillRect(gphX, gphY, goalpostWidth, goalpostHeight);
            
            box = new Box(new Vector(gphX, gphY), goalpostWidth, goalpostHeight).toPolygon();
            if (testPolygonCircle(box, circle)) {
                drawFlag = false;
                this.awayScore += 1;
                updateScoreDisplay();
                updateStatus('GOAL! Computer!');
                setTimeout(() => {
                    updateStatus('');
                    x = canvas.width / 2;
                    y = canvas.height / 2;
                    dx = 3;
                    dy = -3;
                    setTimeout(() => {
                        drawFlag = true;
                        draw();
                    }, 1000);
                }, 1500);
                return;
            }

            // Away goal (top)
            const gpaX = (canvas.width - goalpostWidth) / 2;
            const gpaY = paddleHeight - goalpostHeight;
            ctx.fillRect(gpaX, gpaY, goalpostWidth, goalpostHeight);

            box = new Box(new Vector(gpaX, gpaY), goalpostWidth, goalpostHeight).toPolygon();
            if (testPolygonCircle(box, circle)) {
                drawFlag = false;
                this.homeScore += 1;
                updateScoreDisplay();
                updateStatus('GOAL! You!');
                setTimeout(() => {
                    updateStatus('');
                    x = canvas.width / 2;
                    y = canvas.height / 2;
                    dx = 3;
                    dy = 3;
                    setTimeout(() => {
                        drawFlag = true;
                        draw();
                    }, 1000);
                }, 1500);
                return;
            }
        };

        const drawHomeTeam = () => {
            // Goalkeeper
            const gkX = paddleX / 2 + m;
            const gkY = canvas.height * 7 / 8 - paddleHeight;
            drawRods(gkY);
            drawPlayer(gkX, gkY, this.homePlayer, '#e74c3c');
            box = new Box(new Vector(gkX - playerWidth/2, gkY), playerWidth, paddleHeight).toPolygon();
            collisionDetection(box, gkX);

            // Defenders
            const defY = canvas.height * 13 / 16 - paddleHeight;
            drawRods(defY);
            [paddleX / 4 + m, paddleX * 3 / 4 + m].forEach(px => {
                drawPlayer(px, defY, this.homePlayer, '#e74c3c');
                box = new Box(new Vector(px - playerWidth/2, defY), playerWidth, paddleHeight).toPolygon();
                collisionDetection(box, px);
            });

            // Midfielders
            const midY = canvas.height * 5/8 - paddleHeight;
            drawRods(midY);
            [paddleX * 1/8 + m, paddleX * 3/8 + m, paddleX * 5/8 + m, paddleX * 7/8 + m].forEach(px => {
                drawPlayer(px, midY, this.homePlayer, '#e74c3c');
                box = new Box(new Vector(px - playerWidth/2, midY), playerWidth, paddleHeight).toPolygon();
                collisionDetection(box, px);
            });

            // Strikers
            const strY = canvas.height * 9/32 - paddleHeight;
            drawRods(strY);
            [paddleX / 4 + m, paddleX / 2 + m, paddleX * 3/4 + m].forEach(px => {
                drawPlayer(px, strY, this.homePlayer, '#e74c3c');
                box = new Box(new Vector(px - playerWidth/2, strY), playerWidth, paddleHeight).toPolygon();
                collisionDetection(box, px);
            });
        };

        const maxJ = (paddleX / 2) - 30;
        const minJ = -(paddleX / 4) + 30;

        const drawAwayTeam = () => {
            // Goalkeeper
            const gkX = paddleX / 2 + j;
            const gkY = canvas.height * 1/8 - paddleHeight;
            drawRods(gkY);
            drawPlayer(gkX, gkY, this.awayPlayer, '#3498db');
            box = new Box(new Vector(gkX - playerWidth/2, gkY), playerWidth, paddleHeight).toPolygon();
            collisionDetectionAway(box, gkX);
            
            if (x > gkX && j < maxJ) j += aiSpeed;
            else if (x < gkX && j > minJ) j -= aiSpeed;
            j = Math.max(minJ, Math.min(maxJ, j));

            // Defenders
            const defY = canvas.height * 3/16 - paddleHeight;
            drawRods(defY);
            [paddleX / 4 + j, paddleX * 3/4 + j].forEach(px => {
                drawPlayer(px, defY, this.awayPlayer, '#3498db');
                box = new Box(new Vector(px - playerWidth/2, defY), playerWidth, paddleHeight).toPolygon();
                collisionDetectionAway(box, px);
            });
            if (x > paddleX / 4 + j && j < maxJ) j += aiSpeed;
            else if (j > minJ) j -= aiSpeed;

            // Midfielders
            const midY = canvas.height * 3/8 - paddleHeight;
            drawRods(midY);
            [paddleX * 1/8 + j, paddleX * 3/8 + j, paddleX * 5/8 + j, paddleX * 7/8 + j].forEach(px => {
                drawPlayer(px, midY, this.awayPlayer, '#3498db');
                box = new Box(new Vector(px - playerWidth/2, midY), playerWidth, paddleHeight).toPolygon();
                collisionDetectionAway(box, px);
            });

            // Strikers
            const strY = canvas.height * 23/32 - paddleHeight;
            drawRods(strY);
            [paddleX / 4 + j, paddleX / 2 + j, paddleX * 3/4 + j].forEach(px => {
                drawPlayer(px, strY, this.awayPlayer, '#3498db');
                box = new Box(new Vector(px - playerWidth/2, strY), playerWidth, paddleHeight).toPolygon();
                collisionDetectionAway(box, px);
            });
        };

        const draw = () => {
            if (!drawFlag || this.gameOver) return;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw field
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
            ctx.beginPath();
            ctx.moveTo(10, canvas.height/2);
            ctx.lineTo(canvas.width - 10, canvas.height/2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(canvas.width/2, canvas.height/2, 50, 0, Math.PI * 2);
            ctx.stroke();
            
            drawBall();
            drawGoalPost();
            drawHomeTeam();
            drawAwayTeam();
            
            x += dx;
            y += dy;
            
            const maxM = (paddleX / 2) - 30;
            const minM = -(paddleX / 4) + 30;
            
            if (rightPressed && m < maxM) {
                m += 4;
            } else if (leftPressed && m > minM) {
                m -= 4;
            }
            
            m = Math.max(minM, Math.min(maxM, m));
            
            requestAnimationFrame(draw);
        };

        updateStatus('You are <span style="color:#e74c3c">RED</span>');
        setTimeout(() => {
            updateStatus('');
        }, 1500);

        this.gameStarted = true;
        draw();

        this.cleanupGame = () => {
            clearInterval(this.timerInterval);
            drawFlag = false;
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
            leftBtn.removeEventListener('touchstart', leftBtnDown);
            leftBtn.removeEventListener('touchend', leftBtnUp);
            leftBtn.removeEventListener('mousedown', leftBtnDown);
            leftBtn.removeEventListener('mouseup', leftBtnUp);
            rightBtn.removeEventListener('touchstart', rightBtnDown);
            rightBtn.removeEventListener('touchend', rightBtnUp);
            rightBtn.removeEventListener('mousedown', rightBtnDown);
            rightBtn.removeEventListener('mouseup', rightBtnUp);
        };
    }

    async handleGameEnd(playerScore, computerScore) {
        if (this.cleanupGame) {
            this.cleanupGame();
        }

        const content = document.getElementById('football-content');
        
        const isDraw = playerScore === computerScore;
        
        if (isDraw) {
            content.innerHTML = `
                <div class="result-display">
                    <div class="result-text" style="color: #ffd700;">
                        🔄 IT'S A DRAW!
                    </div>
                    <div style="margin: 20px 0; font-size: 1.5rem;">
                        ${playerScore} - ${computerScore}
                    </div>
                    <p>This game doesn't count. Play again!</p>
                </div>
                <button class="action-btn" id="replay-btn">Replay Game</button>
            `;
            
            document.getElementById('replay-btn').addEventListener('click', () => {
                this.startFootballGame();
            });
            return;
        }

        try {
            const result = await this.fetchWithRetry(
                `/api/games/football/record?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerScore, computerScore })
                }
            );

            if (!result.success) {
                this.showRetryScreen('Failed to save result.');
                return;
            }

            this.session = result.session;

            if (result.gameOver) {
                this.matchesRemaining = Math.max(0, this.matchesRemaining - 1);
                this.showMatchResult(playerScore, computerScore);
            } else {
                this.showGameResult(playerScore, computerScore);
            }
        } catch (error) {
            console.error('[Football] Error saving result:', error);
            this.showRetryScreen('Failed to save result.');
        }
    }

    showGameResult(playerScore, computerScore) {
        const content = document.getElementById('football-content');
        const won = playerScore > computerScore;

        content.innerHTML = `
            <div class="result-display">
                <div class="result-text ${won ? 'win' : 'lose'}">
                    ${won ? '🎉 YOU WON THIS GAME!' : '😢 YOU LOST THIS GAME!'}
                </div>
                <div style="margin: 20px 0; font-size: 1.5rem;">
                    ${playerScore} - ${computerScore}
                </div>
                <div class="score-display">
                    <div class="score-item">
                        <div class="score-label">Match Score</div>
                        <div style="font-size: 2rem; margin-top: 10px;">
                            ${this.session.playerWins} - ${this.session.computerWins}
                        </div>
                    </div>
                </div>
            </div>
            <button class="action-btn" id="next-game-btn">Play Next Game</button>
        `;

        document.getElementById('next-game-btn').addEventListener('click', () => {
            this.showMatchStatus();
        });
    }

    showMatchResult(playerScore, computerScore) {
        const content = document.getElementById('football-content');
        const won = this.session.status === 'won';

        content.innerHTML = `
            <div class="result-display">
                <div class="result-text ${won ? 'win' : 'lose'}">
                    ${won ? '🏆 YOU WON THE MATCH!' : '💔 YOU LOST THE MATCH!'}
                </div>
                <div style="margin: 20px 0; font-size: 1.5rem;">
                    Final Game: ${playerScore} - ${computerScore}
                </div>
                <div class="score-display">
                    <div class="score-item">
                        <div class="score-label">Match Score</div>
                        <div style="font-size: 2rem; margin-top: 10px;">
                            ${this.session.playerWins} - ${this.session.computerWins}
                        </div>
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
            this.checkGameState();
        });
    }

    showCooldown(minutesLeft) {
        const content = document.getElementById('football-content');
        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⏰ Cooldown Active</h3>
                <p>You've played 3 matches. Come back in ${minutesLeft} minutes!</p>
            </div>
        `;
    }

    showRetryScreen(message) {
        const content = document.getElementById('football-content');
        content.innerHTML = `
            <div class="cooldown-notice">
                <h3>⚠️ Error</h3>
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
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.footballClient = new FootballClient();
});