// Sequence Match Game Module
class SequenceMatchGame {
    constructor(db) {
        this.db = db;
        this.MAX_MATCHES = 3;
        this.COOLDOWN_HOURS = 1;
        this.CHALLENGES = {
            easy: { levels: 5, speeds: { 1: 800, 2: 750, 3: 700, 4: 650, 5: 600 } },
            medium: { levels: 5, speeds: { 1: 600, 2: 550, 3: 500, 4: 450, 5: 400 } },
            hard: { levels: 5, speeds: { 1: 400, 2: 350, 3: 300, 4: 250, 5: 200 } }
        };
        
        console.log('[SequenceMatch] Module initialized');
    }

    canPlay(telegramId) {
        try {
            const cooldown = this.db.games.getCooldown(telegramId, 'sequencematch');
            
            if (!cooldown) {
                return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
            }

            if (cooldown.cooldown_until) {
                const cooldownTime = new Date(cooldown.cooldown_until);
                const currentTime = new Date();
                
                if (currentTime > cooldownTime) {
                    this.db.games.resetCooldown(telegramId, 'sequencematch');
                    return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
                }
                
                const minutesLeft = Math.ceil((cooldownTime - currentTime) / 60000);
                return { 
                    canPlay: false, 
                    reason: 'cooldown',
                    minutesLeft,
                    matchesRemaining: 0
                };
            }

            const matchesRemaining = Math.max(0, this.MAX_MATCHES - cooldown.plays_count);
            
            if (cooldown.plays_count >= this.MAX_MATCHES) {
                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                this.db.games.setCooldown(
                    telegramId, 
                    'sequencematch', 
                    cooldown.plays_count, 
                    cooldownUntil.toISOString()
                );
                
                return { 
                    canPlay: false, 
                    reason: 'cooldown',
                    minutesLeft: this.COOLDOWN_HOURS * 60,
                    matchesRemaining: 0
                };
            }

            return { canPlay: true, matchesRemaining };
        } catch (error) {
            console.error('[SequenceMatch] Error checking canPlay:', error);
            return { canPlay: false, reason: 'error' };
        }
    }

    startGame(telegramId, challenge) {
        try {
            if (!['easy', 'medium', 'hard'].includes(challenge)) {
                return { success: false, error: 'Invalid challenge' };
            }

            const canPlayResult = this.canPlay(telegramId);
            if (!canPlayResult.canPlay) {
                return { 
                    success: false, 
                    reason: canPlayResult.reason,
                    minutesLeft: canPlayResult.minutesLeft 
                };
            }

            const existingSession = this.db.games.getSession(telegramId, 'sequencematch');
            if (existingSession) {
                this.db.games.deleteSession(telegramId, 'sequencematch');
            }

            const challengeData = this.CHALLENGES[challenge];
            const session = {
                challenge,
                currentLevel: 1,
                maxLevels: challengeData.levels,
                score: 0,
                sequence: [],
                speeds: challengeData.speeds,
                status: 'playing'
            };

            this.db.games.createSession(telegramId, 'sequencematch', session);

            return {
                success: true,
                session,
                matchesRemaining: canPlayResult.matchesRemaining
            };
        } catch (error) {
            console.error('[SequenceMatch] Error starting game:', error);
            return { success: false, reason: 'error' };
        }
    }

    getSession(telegramId) {
        try {
            const session = this.db.games.getSession(telegramId, 'sequencematch');
            return session ? session.session_data : null;
        } catch (error) {
            console.error('[SequenceMatch] Error getting session:', error);
            return null;
        }
    }

    generateSequence(telegramId, level) {
        try {
            const session = this.db.games.getSession(telegramId, 'sequencematch');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            
            if (sessionData.status !== 'playing') {
                return { success: false, error: 'Game already finished' };
            }

            const colors = ['red', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            
            sessionData.sequence.push(randomColor);
            sessionData.currentLevel = level;

            this.db.games.updateSession(telegramId, 'sequencematch', sessionData);

            return {
                success: true,
                sequence: sessionData.sequence,
                speed: sessionData.speeds[level]
            };
        } catch (error) {
            console.error('[SequenceMatch] Error generating sequence:', error);
            return { success: false, error: 'Server error' };
        }
    }

    validateSequence(telegramId, playerSequence) {
        try {
            const session = this.db.games.getSession(telegramId, 'sequencematch');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            
            if (sessionData.status !== 'playing') {
                return { success: false, error: 'Game already finished' };
            }

            // Anti-cheat: Check sequence length
            if (playerSequence.length !== sessionData.sequence.length) {
                console.warn('[SequenceMatch] Invalid sequence length');
                return { success: false, correct: false };
            }

            // Validate each color
            const correct = playerSequence.every((color, index) => {
                return color === sessionData.sequence[index];
            });

            if (!correct) {
                // Game Over
                sessionData.status = 'lost';
                this.db.games.updateSequenceMatchStats(telegramId, sessionData.challenge, false);
                this.db.games.incrementPlays(telegramId, 'sequencematch');
                
                const cooldown = this.db.games.getCooldown(telegramId, 'sequencematch');
                if (cooldown && cooldown.plays_count >= this.MAX_MATCHES) {
                    const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                    this.db.games.setCooldown(
                        telegramId, 
                        'sequencematch', 
                        cooldown.plays_count, 
                        cooldownUntil.toISOString()
                    );
                }

                this.db.games.deleteSession(telegramId, 'sequencematch');

                return {
                    success: true,
                    correct: false,
                    gameOver: true,
                    won: false,
                    finalScore: sessionData.score
                };
            }

            // Correct sequence
            sessionData.score += 10;

            if (sessionData.currentLevel >= sessionData.maxLevels) {
                // Won the game
                sessionData.status = 'won';
                this.db.games.updateSequenceMatchStats(telegramId, sessionData.challenge, true);
                this.db.games.incrementPlays(telegramId, 'sequencematch');
                
                const cooldown = this.db.games.getCooldown(telegramId, 'sequencematch');
                if (cooldown && cooldown.plays_count >= this.MAX_MATCHES) {
                    const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                    this.db.games.setCooldown(
                        telegramId, 
                        'sequencematch', 
                        cooldown.plays_count, 
                        cooldownUntil.toISOString()
                    );
                }

                this.db.games.deleteSession(telegramId, 'sequencematch');

                return {
                    success: true,
                    correct: true,
                    gameOver: true,
                    won: true,
                    finalScore: sessionData.score
                };
            }

            // Continue to next level
            this.db.games.updateSession(telegramId, 'sequencematch', sessionData);

            return {
                success: true,
                correct: true,
                gameOver: false,
                score: sessionData.score,
                nextLevel: sessionData.currentLevel + 1
            };
        } catch (error) {
            console.error('[SequenceMatch] Error validating sequence:', error);
            return { success: false, error: 'Server error' };
        }
    }

    getUserStats(telegramId) {
        try {
            const stats = this.db.games.getUserStats(telegramId);
            const cooldown = this.db.games.getCooldown(telegramId, 'sequencematch');

            return {
                easy_wins: stats?.sequencematch_easy_wins || 0,
                easy_losses: stats?.sequencematch_easy_losses || 0,
                medium_wins: stats?.sequencematch_medium_wins || 0,
                medium_losses: stats?.sequencematch_medium_losses || 0,
                hard_wins: stats?.sequencematch_hard_wins || 0,
                hard_losses: stats?.sequencematch_hard_losses || 0,
                matchesRemaining: cooldown ? Math.max(0, this.MAX_MATCHES - cooldown.plays_count) : this.MAX_MATCHES,
                cooldown: cooldown?.cooldown_until || null
            };
        } catch (error) {
            console.error('[SequenceMatch] Error getting stats:', error);
            return null;
        }
    }
}

module.exports = SequenceMatchGame;