// Rock Paper Scissors Game Module - FIXED
class RockPaperGame {
    constructor(db) {
        this.db = db;
        this.CHOICES = ['rock', 'paper', 'scissors'];
        this.MAX_MATCHES = 3; // ✅ Changed from MAX_PLAYS to MAX_MATCHES
        this.COOLDOWN_HOURS = 1;
        
        console.log('[RockPaper] Module initialized');
    }

    // Check if user can play
    canPlay(telegramId) {
        try {
            const cooldown = this.db.games.getCooldown(telegramId, 'rockpaper');
            
            if (!cooldown) {
                return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
            }

            // Check if cooldown expired
            if (cooldown.cooldown_until) {
                const cooldownTime = new Date(cooldown.cooldown_until);
                const currentTime = new Date();
                
                if (currentTime > cooldownTime) {
                    // Cooldown expired, reset
                    this.db.games.resetCooldown(telegramId, 'rockpaper');
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

            // ✅ Check matches count instead of plays
            const matchesRemaining = Math.max(0, this.MAX_MATCHES - cooldown.plays_count);
            
            if (cooldown.plays_count >= this.MAX_MATCHES) {
                // Set cooldown
                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                this.db.games.setCooldown(
                    telegramId, 
                    'rockpaper', 
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
            console.error('[RockPaper] Error checking canPlay:', error);
            return { canPlay: false, reason: 'error' };
        }
    }

    // Start new game
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
            const existingSession = this.db.games.getSession(telegramId, 'rockpaper');
            if (existingSession) {
                return {
                    success: true,
                    session: existingSession.session_data,
                    resumed: true,
                    matchesRemaining: canPlayResult.matchesRemaining
                };
            }

            // Create new session
            const session = {
                rounds: [],
                currentRound: 1,
                playerWins: 0,
                computerWins: 0,
                status: 'playing'
            };

            this.db.games.createSession(telegramId, 'rockpaper', session);

            return {
                success: true,
                session,
                resumed: false,
                matchesRemaining: canPlayResult.matchesRemaining
            };
        } catch (error) {
            console.error('[RockPaper] Error starting game:', error);
            return { success: false, reason: 'error' };
        }
    }

    // Get current session
    getSession(telegramId) {
        try {
            const session = this.db.games.getSession(telegramId, 'rockpaper');
            return session ? session.session_data : null;
        } catch (error) {
            console.error('[RockPaper] Error getting session:', error);
            return null;
        }
    }

    // Play round
    playRound(telegramId, playerChoice) {
        try {
            if (!this.CHOICES.includes(playerChoice)) {
                return { success: false, error: 'Invalid choice' };
            }

            const session = this.db.games.getSession(telegramId, 'rockpaper');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            
            if (sessionData.status !== 'playing') {
                return { success: false, error: 'Game already finished' };
            }

            // Computer makes random choice
            const computerChoice = this.CHOICES[Math.floor(Math.random() * 3)];

            // Determine winner
            const result = this.determineWinner(playerChoice, computerChoice);

            // ✅ Only update wins if NOT a tie
            if (result === 'player') {
                sessionData.playerWins++;
            } else if (result === 'computer') {
                sessionData.computerWins++;
            }
            // ✅ Tie ke case mein kuch update nahi hoga

            sessionData.rounds.push({
                round: sessionData.currentRound,
                playerChoice,
                computerChoice,
                result
            });

            // ✅ Check if game is over (only count non-tie rounds)
            const gameOver = this.checkGameOver(sessionData);

            if (gameOver) {
                sessionData.status = sessionData.playerWins >= 2 ? 'won' : 'lost';
                
                // Update stats
                this.db.games.updateRockPaperStats(
                    telegramId, 
                    sessionData.status === 'won'
                );

                // ✅ Increment MATCHES (not rounds)
                this.db.games.incrementPlays(telegramId, 'rockpaper');
                
                const cooldown = this.db.games.getCooldown(telegramId, 'rockpaper');
                if (cooldown && cooldown.plays_count >= this.MAX_MATCHES) {
                    const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                    this.db.games.setCooldown(
                        telegramId, 
                        'rockpaper', 
                        cooldown.plays_count, 
                        cooldownUntil.toISOString()
                    );
                }

                // Delete session
                this.db.games.deleteSession(telegramId, 'rockpaper');
            } else {
                // ✅ Only increment round if not a tie or if we need to continue
                if (result !== 'tie' || sessionData.rounds.length >= 5) {
                    sessionData.currentRound++;
                }
                this.db.games.updateSession(telegramId, 'rockpaper', sessionData);
            }

            return {
                success: true,
                round: {
                    playerChoice,
                    computerChoice,
                    result
                },
                session: sessionData,
                gameOver
            };
        } catch (error) {
            console.error('[RockPaper] Error playing round:', error);
            return { success: false, error: 'Server error' };
        }
    }

    // Determine winner of a round
    determineWinner(player, computer) {
        if (player === computer) return 'tie';
        
        if (
            (player === 'rock' && computer === 'scissors') ||
            (player === 'paper' && computer === 'rock') ||
            (player === 'scissors' && computer === 'paper')
        ) {
            return 'player';
        }
        
        return 'computer';
    }

    // ✅ Check if game is over - only based on wins, not total rounds
    checkGameOver(session) {
        // Game ends when someone wins 2 rounds
        // OR if we've played too many rounds (safety: max 5 rounds with ties)
        return session.playerWins >= 2 || 
               session.computerWins >= 2 || 
               session.rounds.length >= 5; // Safety limit
    }

    // Get user stats
    getUserStats(telegramId) {
        try {
            const stats = this.db.games.getUserStats(telegramId);
            const cooldown = this.db.games.getCooldown(telegramId, 'rockpaper');

            return {
                wins: stats?.rockpaper_wins || 0,
                losses: stats?.rockpaper_losses || 0,
                matchesRemaining: cooldown ? Math.max(0, this.MAX_MATCHES - cooldown.plays_count) : this.MAX_MATCHES,
                cooldown: cooldown?.cooldown_until || null
            };
        } catch (error) {
            console.error('[RockPaper] Error getting stats:', error);
            return null;
        }
    }
}

module.exports = RockPaperGame;