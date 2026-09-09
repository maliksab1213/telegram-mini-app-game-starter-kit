// Glass Ball Game Module - games_modules/glassball.js
class GlassBallGame {
    constructor(db) {
        this.db = db;
        this.MAX_MATCHES = 3;
        this.COOLDOWN_HOURS = 1;
        
        console.log('[GlassBall] Module initialized');
    }

    // Check if user can play
    canPlay(telegramId) {
        try {
            const cooldown = this.db.games.getCooldown(telegramId, 'glassball');
            
            if (!cooldown) {
                return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
            }

            // Check if cooldown expired
            if (cooldown.cooldown_until) {
                const cooldownTime = new Date(cooldown.cooldown_until);
                const currentTime = new Date();
                
                if (currentTime > cooldownTime) {
                    // Cooldown expired, reset
                    this.db.games.resetCooldown(telegramId, 'glassball');
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

            // Check matches count
            const matchesRemaining = Math.max(0, this.MAX_MATCHES - cooldown.plays_count);
            
            if (cooldown.plays_count >= this.MAX_MATCHES) {
                // Set cooldown
                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                this.db.games.setCooldown(
                    telegramId, 
                    'glassball', 
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
            console.error('[GlassBall] Error checking canPlay:', error);
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

            // Generate random ball position (0, 1, or 2)
            const ballPosition = Math.floor(Math.random() * 3);

            // Create session with ball position
            const session = {
                ballPosition,
                status: 'playing',
                createdAt: Date.now()
            };

            this.db.games.createSession(telegramId, 'glassball', session);

            return {
                success: true,
                sessionReady: true,
                matchesRemaining: canPlayResult.matchesRemaining
            };
        } catch (error) {
            console.error('[GlassBall] Error starting game:', error);
            return { success: false, reason: 'error' };
        }
    }

    // Get current session
    getSession(telegramId) {
        try {
            const session = this.db.games.getSession(telegramId, 'glassball');
            return session ? session.session_data : null;
        } catch (error) {
            console.error('[GlassBall] Error getting session:', error);
            return null;
        }
    }

    // Make guess
    makeGuess(telegramId, guessedPosition) {
        try {
            if (![0, 1, 2].includes(guessedPosition)) {
                return { success: false, error: 'Invalid position' };
            }

            const session = this.db.games.getSession(telegramId, 'glassball');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            
            if (sessionData.status !== 'playing') {
                return { success: false, error: 'Game already finished' };
            }

            // Check if guess is correct
            const won = guessedPosition === sessionData.ballPosition;
            
            sessionData.status = won ? 'won' : 'lost';
            sessionData.guessedPosition = guessedPosition;

            // Update stats
            this.db.games.updateGlassBallStats(telegramId, won);

            // Increment matches played
            this.db.games.incrementPlays(telegramId, 'glassball');
            
            const cooldown = this.db.games.getCooldown(telegramId, 'glassball');
            if (cooldown && cooldown.plays_count >= this.MAX_MATCHES) {
                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                this.db.games.setCooldown(
                    telegramId, 
                    'glassball', 
                    cooldown.plays_count, 
                    cooldownUntil.toISOString()
                );
            }

            // Delete session
            this.db.games.deleteSession(telegramId, 'glassball');

            return {
                success: true,
                won,
                correctPosition: sessionData.ballPosition,
                guessedPosition
            };
        } catch (error) {
            console.error('[GlassBall] Error making guess:', error);
            return { success: false, error: 'Server error' };
        }
    }

    // Get user stats
    getUserStats(telegramId) {
        try {
            const stats = this.db.games.getUserStats(telegramId);
            const cooldown = this.db.games.getCooldown(telegramId, 'glassball');

            return {
                wins: stats?.glassball_wins || 0,
                losses: stats?.glassball_losses || 0,
                matchesRemaining: cooldown ? Math.max(0, this.MAX_MATCHES - cooldown.plays_count) : this.MAX_MATCHES,
                cooldown: cooldown?.cooldown_until || null
            };
        } catch (error) {
            console.error('[GlassBall] Error getting stats:', error);
            return null;
        }
    }
}

module.exports = GlassBallGame;