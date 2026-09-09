// Hole Mole Game Module
class HoleMoleGame {
    constructor(db) {
        this.db = db;
        this.MAX_MATCHES = 3;
        this.COOLDOWN_HOURS = 1;
        this.CHALLENGES = {
            easy: { time: 30, targetScore: 15 },
            medium: { time: 30, targetScore: 20 },
            hard: { time: 30, targetScore: 25 }
        };
        
        console.log('[HoleMole] Module initialized');
    }

    canPlay(telegramId) {
        try {
            const cooldown = this.db.games.getCooldown(telegramId, 'holemole');
            
            if (!cooldown) {
                return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
            }

            if (cooldown.cooldown_until) {
                const cooldownTime = new Date(cooldown.cooldown_until);
                const currentTime = new Date();
                
                if (currentTime > cooldownTime) {
                    this.db.games.resetCooldown(telegramId, 'holemole');
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
                    'holemole', 
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
            console.error('[HoleMole] Error checking canPlay:', error);
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

            const existingSession = this.db.games.getSession(telegramId, 'holemole');
            if (existingSession) {
                this.db.games.deleteSession(telegramId, 'holemole');
            }

            const challengeData = this.CHALLENGES[challenge];
            const session = {
                challenge,
                timeLimit: challengeData.time,
                targetScore: challengeData.targetScore,
                score: 0,
                startTime: Date.now(),
                hits: [],
                status: 'playing'
            };

            this.db.games.createSession(telegramId, 'holemole', session);

            return {
                success: true,
                session,
                matchesRemaining: canPlayResult.matchesRemaining
            };
        } catch (error) {
            console.error('[HoleMole] Error starting game:', error);
            return { success: false, reason: 'error' };
        }
    }

    getSession(telegramId) {
        try {
            const session = this.db.games.getSession(telegramId, 'holemole');
            return session ? session.session_data : null;
        } catch (error) {
            console.error('[HoleMole] Error getting session:', error);
            return null;
        }
    }

    recordHit(telegramId, timestamp) {
        try {
            const session = this.db.games.getSession(telegramId, 'holemole');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            
            if (sessionData.status !== 'playing') {
                return { success: false, error: 'Game already finished' };
            }

            const timePassed = (timestamp - sessionData.startTime) / 1000;
            if (timePassed > sessionData.timeLimit) {
                return { success: false, error: 'Time expired' };
            }

            // Anti-cheat: Check hit timing
            if (sessionData.hits.length > 0) {
                const lastHit = sessionData.hits[sessionData.hits.length - 1];
                const timeDiff = timestamp - lastHit;
                
                if (timeDiff < 100) {
                    console.warn('[HoleMole] Suspicious hit timing detected');
                    return { success: false, error: 'Invalid hit timing' };
                }
            }

            sessionData.score++;
            sessionData.hits.push(timestamp);

            this.db.games.updateSession(telegramId, 'holemole', sessionData);

            return {
                success: true,
                score: sessionData.score,
                timeRemaining: sessionData.timeLimit - timePassed
            };
        } catch (error) {
            console.error('[HoleMole] Error recording hit:', error);
            return { success: false, error: 'Server error' };
        }
    }

    endGame(telegramId) {
        try {
            const session = this.db.games.getSession(telegramId, 'holemole');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            const won = sessionData.score >= sessionData.targetScore;
            
            sessionData.status = won ? 'won' : 'lost';

            this.db.games.updateHoleMoleStats(
                telegramId,
                sessionData.challenge,
                won
            );

            this.db.games.incrementPlays(telegramId, 'holemole');
            
            const cooldown = this.db.games.getCooldown(telegramId, 'holemole');
            if (cooldown && cooldown.plays_count >= this.MAX_MATCHES) {
                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                this.db.games.setCooldown(
                    telegramId, 
                    'holemole', 
                    cooldown.plays_count, 
                    cooldownUntil.toISOString()
                );
            }

            this.db.games.deleteSession(telegramId, 'holemole');

            return {
                success: true,
                won,
                score: sessionData.score,
                targetScore: sessionData.targetScore,
                challenge: sessionData.challenge
            };
        } catch (error) {
            console.error('[HoleMole] Error ending game:', error);
            return { success: false, error: 'Server error' };
        }
    }

    getUserStats(telegramId) {
        try {
            const stats = this.db.games.getUserStats(telegramId);
            const cooldown = this.db.games.getCooldown(telegramId, 'holemole');

            return {
                easy_wins: stats?.holemole_easy_wins || 0,
                easy_losses: stats?.holemole_easy_losses || 0,
                medium_wins: stats?.holemole_medium_wins || 0,
                medium_losses: stats?.holemole_medium_losses || 0,
                hard_wins: stats?.holemole_hard_wins || 0,
                hard_losses: stats?.holemole_hard_losses || 0,
                matchesRemaining: cooldown ? Math.max(0, this.MAX_MATCHES - cooldown.plays_count) : this.MAX_MATCHES,
                cooldown: cooldown?.cooldown_until || null
            };
        } catch (error) {
            console.error('[HoleMole] Error getting stats:', error);
            return null;
        }
    }
}

module.exports = HoleMoleGame;