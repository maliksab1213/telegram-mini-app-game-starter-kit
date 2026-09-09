// Shootout Game Module
class ShootoutGame {
    constructor(db) {
        this.db = db;
        this.CHOICES = ['left', 'right', 'up'];
        this.MAX_MATCHES = 3;
        this.COOLDOWN_HOURS = 1;
        
        console.log('[Shootout] Module initialized');
    }

    canPlay(telegramId) {
        try {
            const cooldown = this.db.games.getCooldown(telegramId, 'shootout');
            
            if (!cooldown) {
                return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
            }

            if (cooldown.cooldown_until) {
                const cooldownTime = new Date(cooldown.cooldown_until);
                const currentTime = new Date();
                
                if (currentTime > cooldownTime) {
                    this.db.games.resetCooldown(telegramId, 'shootout');
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
                    'shootout', 
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
            console.error('[Shootout] Error checking canPlay:', error);
            return { canPlay: false, reason: 'error' };
        }
    }

    startGame(telegramId) {
        try {
            const canPlayResult = this.canPlay(telegramId);
            if (!canPlayResult.canPlay) {
                return { 
                    success: false, 
                    reason: canPlayResult.reason,
                    minutesLeft: canPlayResult.minutesLeft 
                };
            }

            const existingSession = this.db.games.getSession(telegramId, 'shootout');
            if (existingSession) {
                return {
                    success: true,
                    session: existingSession.session_data,
                    resumed: true,
                    matchesRemaining: canPlayResult.matchesRemaining
                };
            }

            const session = {
                rounds: [],
                currentRound: 1,
                playerGoals: 0,
                computerSaves: 0,
                status: 'playing'
            };

            this.db.games.createSession(telegramId, 'shootout', session);

            return {
                success: true,
                session,
                resumed: false,
                matchesRemaining: canPlayResult.matchesRemaining
            };
        } catch (error) {
            console.error('[Shootout] Error starting game:', error);
            return { success: false, reason: 'error' };
        }
    }

    getSession(telegramId) {
        try {
            const session = this.db.games.getSession(telegramId, 'shootout');
            return session ? session.session_data : null;
        } catch (error) {
            console.error('[Shootout] Error getting session:', error);
            return null;
        }
    }

    playRound(telegramId, playerChoice) {
        try {
            if (!this.CHOICES.includes(playerChoice)) {
                return { success: false, error: 'Invalid choice' };
            }

            const session = this.db.games.getSession(telegramId, 'shootout');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            
            if (sessionData.status !== 'playing') {
                return { success: false, error: 'Game already finished' };
            }

            // Computer makes random choice
            const computerChoice = this.CHOICES[Math.floor(Math.random() * 3)];

            // Determine result
            const isGoal = playerChoice !== computerChoice;

            if (isGoal) {
                sessionData.playerGoals++;
            } else {
                sessionData.computerSaves++;
            }

            sessionData.rounds.push({
                round: sessionData.currentRound,
                playerChoice,
                computerChoice,
                result: isGoal ? 'goal' : 'saved'
            });

            // Check if game is over
            const gameOver = this.checkGameOver(sessionData);

            if (gameOver) {
                sessionData.status = sessionData.playerGoals >= 2 ? 'won' : 'lost';
                
                // Update stats
                this.db.games.updateShootoutStats(
                    telegramId, 
                    sessionData.status === 'won'
                );

                this.db.games.incrementPlays(telegramId, 'shootout');
                
                const cooldown = this.db.games.getCooldown(telegramId, 'shootout');
                if (cooldown && cooldown.plays_count >= this.MAX_MATCHES) {
                    const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                    this.db.games.setCooldown(
                        telegramId, 
                        'shootout', 
                        cooldown.plays_count, 
                        cooldownUntil.toISOString()
                    );
                }

                this.db.games.deleteSession(telegramId, 'shootout');
            } else {
                sessionData.currentRound++;
                this.db.games.updateSession(telegramId, 'shootout', sessionData);
            }

            return {
                success: true,
                round: {
                    playerChoice,
                    computerChoice,
                    result: isGoal ? 'goal' : 'saved'
                },
                session: sessionData,
                gameOver
            };
        } catch (error) {
            console.error('[Shootout] Error playing round:', error);
            return { success: false, error: 'Server error' };
        }
    }

    checkGameOver(session) {
        return session.playerGoals >= 2 || session.computerSaves >= 2;
    }

    getUserStats(telegramId) {
        try {
            const stats = this.db.games.getUserStats(telegramId);
            const cooldown = this.db.games.getCooldown(telegramId, 'shootout');

            return {
                wins: stats?.shootout_wins || 0,
                losses: stats?.shootout_losses || 0,
                matchesRemaining: cooldown ? Math.max(0, this.MAX_MATCHES - cooldown.plays_count) : this.MAX_MATCHES,
                cooldown: cooldown?.cooldown_until || null
            };
        } catch (error) {
            console.error('[Shootout] Error getting stats:', error);
            return null;
        }
    }
}

module.exports = ShootoutGame;