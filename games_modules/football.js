// Football Game Module - games_modules/football.js
class FootballGame {
    constructor(db) {
        this.db = db;
        this.MAX_MATCHES = 3; // 3 matches allowed
        this.COOLDOWN_HOURS = 1; // 1 hour cooldown after 3 matches
        
        console.log('[Football] Module initialized');
    }

    canPlay(telegramId) {
        try {
            const cooldown = this.db.games.getCooldown(telegramId, 'football');
            
            if (!cooldown) {
                return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
            }

            // Check if cooldown expired
            if (cooldown.cooldown_until) {
                const cooldownTime = new Date(cooldown.cooldown_until);
                const currentTime = new Date();
                
                if (currentTime > cooldownTime) {
                    // Cooldown expired, reset
                    this.db.games.resetCooldown(telegramId, 'football');
                    return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
                }
                
                // Still in cooldown
                const minutesLeft = Math.ceil((cooldownTime - currentTime) / 60000);
                return { 
                    canPlay: false, 
                    reason: 'cooldown',
                    minutesLeft,
                    matchesRemaining: 0
                };
            }

            // Check matches remaining
            const matchesRemaining = Math.max(0, this.MAX_MATCHES - cooldown.plays_count);
            
            if (cooldown.plays_count >= this.MAX_MATCHES) {
                // Set cooldown
                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                this.db.games.setCooldown(
                    telegramId, 
                    'football', 
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
            console.error('[Football] Error checking canPlay:', error);
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

            // Check for existing session
            const existingSession = this.db.games.getSession(telegramId, 'football');
            if (existingSession) {
                return {
                    success: true,
                    session: existingSession.session_data,
                    resumed: true,
                    matchesRemaining: canPlayResult.matchesRemaining
                };
            }

            // Create new session - 3 games per match
            const session = {
                games: [],
                currentGame: 1,
                playerWins: 0,
                computerWins: 0,
                status: 'playing'
            };

            this.db.games.createSession(telegramId, 'football', session);

            return {
                success: true,
                session,
                resumed: false,
                matchesRemaining: canPlayResult.matchesRemaining
            };
        } catch (error) {
            console.error('[Football] Error starting game:', error);
            return { success: false, reason: 'error' };
        }
    }

    getSession(telegramId) {
        try {
            const session = this.db.games.getSession(telegramId, 'football');
            return session ? session.session_data : null;
        } catch (error) {
            console.error('[Football] Error getting session:', error);
            return null;
        }
    }

    recordGameResult(telegramId, playerScore, computerScore) {
        try {
            const session = this.db.games.getSession(telegramId, 'football');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            
            if (sessionData.status !== 'playing') {
                return { success: false, error: 'Match already finished' };
            }

            const playerWon = playerScore > computerScore;
            const isDraw = playerScore === computerScore;

            // Only count wins, not draws
            if (!isDraw) {
                if (playerWon) {
                    sessionData.playerWins++;
                } else {
                    sessionData.computerWins++;
                }
            }

            // Save game result
            sessionData.games.push({
                game: sessionData.currentGame,
                playerScore,
                computerScore,
                result: isDraw ? 'draw' : (playerWon ? 'player' : 'computer')
            });

            // Check if match is over (someone won 2 games)
            const gameOver = sessionData.playerWins >= 2 || sessionData.computerWins >= 2;

            if (gameOver) {
                sessionData.status = sessionData.playerWins >= 2 ? 'won' : 'lost';
                
                // Update stats in database
                this.db.games.updateFootballStats(
                    telegramId, 
                    sessionData.status === 'won'
                );

                // Increment match count
                this.db.games.incrementPlays(telegramId, 'football');
                
                // Check if cooldown should be set
                const cooldown = this.db.games.getCooldown(telegramId, 'football');
                if (cooldown && cooldown.plays_count >= this.MAX_MATCHES) {
                    const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                    this.db.games.setCooldown(
                        telegramId, 
                        'football', 
                        cooldown.plays_count, 
                        cooldownUntil.toISOString()
                    );
                }

                // Delete session
                this.db.games.deleteSession(telegramId, 'football');
            } else {
                // Continue to next game only if not a draw or safety limit
                if (!isDraw || sessionData.games.length >= 5) {
                    sessionData.currentGame++;
                }
                this.db.games.updateSession(telegramId, 'football', sessionData);
            }

            return {
                success: true,
                session: sessionData,
                gameOver,
                isDraw
            };
        } catch (error) {
            console.error('[Football] Error recording result:', error);
            return { success: false, error: 'Server error' };
        }
    }

    getUserStats(telegramId) {
        try {
            const stats = this.db.games.getUserStats(telegramId);
            const cooldown = this.db.games.getCooldown(telegramId, 'football');

            return {
                wins: stats?.football_wins || 0,
                losses: stats?.football_losses || 0,
                matchesRemaining: cooldown ? Math.max(0, this.MAX_MATCHES - cooldown.plays_count) : this.MAX_MATCHES,
                cooldown: cooldown?.cooldown_until || null
            };
        } catch (error) {
            console.error('[Football] Error getting stats:', error);
            return null;
        }
    }
}

module.exports = FootballGame;