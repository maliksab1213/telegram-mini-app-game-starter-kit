// Memory Game Module
class MemoryGame {
    constructor(db) {
        this.db = db;
        this.MAX_MATCHES = 3;
        this.COOLDOWN_HOURS = 1;
        this.CHALLENGES = {
            easy: { time: 60, pairs: 8 },
            medium: { time: 45, pairs: 8 },
            hard: { time: 30, pairs: 8 }
        };
        
        console.log('[MemoryGame] Module initialized');
    }

    canPlay(telegramId) {
        try {
            const cooldown = this.db.games.getCooldown(telegramId, 'memorygame');
            
            if (!cooldown) {
                return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
            }

            if (cooldown.cooldown_until) {
                const cooldownTime = new Date(cooldown.cooldown_until);
                const currentTime = new Date();
                
                if (currentTime > cooldownTime) {
                    this.db.games.resetCooldown(telegramId, 'memorygame');
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
                    'memorygame', 
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
            console.error('[MemoryGame] Error checking canPlay:', error);
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

            const existingSession = this.db.games.getSession(telegramId, 'memorygame');
            if (existingSession) {
                this.db.games.deleteSession(telegramId, 'memorygame');
            }

            const challengeData = this.CHALLENGES[challenge];
            
            // Generate random card pairs
            const totalCards = challengeData.pairs * 2;
            const cards = [];
            for (let i = 0; i < challengeData.pairs; i++) {
                cards.push(i, i);
            }
            
            // Shuffle cards
            for (let i = cards.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [cards[i], cards[j]] = [cards[j], cards[i]];
            }

            const session = {
                challenge,
                timeLimit: challengeData.time,
                cards,
                flipped: [],
                matched: [],
                startTime: Date.now(),
                moves: 0,
                status: 'playing'
            };

            this.db.games.createSession(telegramId, 'memorygame', session);

            return {
                success: true,
                session,
                matchesRemaining: canPlayResult.matchesRemaining
            };
        } catch (error) {
            console.error('[MemoryGame] Error starting game:', error);
            return { success: false, reason: 'error' };
        }
    }

    getSession(telegramId) {
        try {
            const session = this.db.games.getSession(telegramId, 'memorygame');
            return session ? session.session_data : null;
        } catch (error) {
            console.error('[MemoryGame] Error getting session:', error);
            return null;
        }
    }

    flipCard(telegramId, cardIndex, timestamp) {
        try {
            const session = this.db.games.getSession(telegramId, 'memorygame');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            
            if (sessionData.status !== 'playing') {
                return { success: false, error: 'Game already finished' };
            }

            // Check time limit
            const timePassed = (timestamp - sessionData.startTime) / 1000;
            if (timePassed > sessionData.timeLimit) {
                return { success: false, error: 'Time expired' };
            }

            // Validate card index
            if (cardIndex < 0 || cardIndex >= sessionData.cards.length) {
                return { success: false, error: 'Invalid card index' };
            }

            // Check if card already matched or flipped
            if (sessionData.matched.includes(cardIndex) || sessionData.flipped.includes(cardIndex)) {
                return { success: false, error: 'Card already flipped or matched' };
            }

            sessionData.flipped.push(cardIndex);

            // Check for match when 2 cards flipped
            let matchResult = null;
            if (sessionData.flipped.length === 2) {
                const [idx1, idx2] = sessionData.flipped;
                const card1 = sessionData.cards[idx1];
                const card2 = sessionData.cards[idx2];

                sessionData.moves++;

                if (card1 === card2) {
                    // Match found
                    sessionData.matched.push(idx1, idx2);
                    sessionData.flipped = [];
                    matchResult = 'match';
                } else {
                    // No match
                    matchResult = 'no_match';
                    sessionData.flipped = [];
                }
            }

            this.db.games.updateSession(telegramId, 'memorygame', sessionData);

            return {
                success: true,
                cardValue: sessionData.cards[cardIndex],
                flipped: sessionData.flipped,
                matched: sessionData.matched,
                matchResult,
                moves: sessionData.moves,
                timeRemaining: sessionData.timeLimit - timePassed
            };
        } catch (error) {
            console.error('[MemoryGame] Error flipping card:', error);
            return { success: false, error: 'Server error' };
        }
    }

    endGame(telegramId, won) {
        try {
            const session = this.db.games.getSession(telegramId, 'memorygame');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            sessionData.status = won ? 'won' : 'lost';

            this.db.games.updateMemoryGameStats(
                telegramId,
                sessionData.challenge,
                won
            );

            this.db.games.incrementPlays(telegramId, 'memorygame');
            
            const cooldown = this.db.games.getCooldown(telegramId, 'memorygame');
            if (cooldown && cooldown.plays_count >= this.MAX_MATCHES) {
                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                this.db.games.setCooldown(
                    telegramId, 
                    'memorygame', 
                    cooldown.plays_count, 
                    cooldownUntil.toISOString()
                );
            }

            this.db.games.deleteSession(telegramId, 'memorygame');

            return {
                success: true,
                won,
                moves: sessionData.moves,
                challenge: sessionData.challenge
            };
        } catch (error) {
            console.error('[MemoryGame] Error ending game:', error);
            return { success: false, error: 'Server error' };
        }
    }

    getUserStats(telegramId) {
        try {
            const stats = this.db.games.getUserStats(telegramId);
            const cooldown = this.db.games.getCooldown(telegramId, 'memorygame');

            return {
                easy_wins: stats?.memorygame_easy_wins || 0,
                easy_losses: stats?.memorygame_easy_losses || 0,
                medium_wins: stats?.memorygame_medium_wins || 0,
                medium_losses: stats?.memorygame_medium_losses || 0,
                hard_wins: stats?.memorygame_hard_wins || 0,
                hard_losses: stats?.memorygame_hard_losses || 0,
                matchesRemaining: cooldown ? Math.max(0, this.MAX_MATCHES - cooldown.plays_count) : this.MAX_MATCHES,
                cooldown: cooldown?.cooldown_until || null
            };
        } catch (error) {
            console.error('[MemoryGame] Error getting stats:', error);
            return null;
        }
    }
}

module.exports = MemoryGame;