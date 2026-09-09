// Coin Flip Game Module - FIXED
class CoinFlipGame {
    constructor(db) {
        this.db = db;
        this.CHOICES = ['heads', 'tails'];
        this.MAX_FLIPS = 3; // ✅ 3 flips allowed
        this.COOLDOWN_HOURS = 1;
        
        console.log('[CoinFlip] Module initialized');
    }

    // Check if user can play
    canPlay(telegramId) {
        try {
            const cooldown = this.db.games.getCooldown(telegramId, 'coinflip');
            
            if (!cooldown) {
                return { canPlay: true, flipsRemaining: this.MAX_FLIPS };
            }

            // Check if cooldown expired
            if (cooldown.cooldown_until) {
                const cooldownTime = new Date(cooldown.cooldown_until);
                const currentTime = new Date();
                
                if (currentTime > cooldownTime) {
                    this.db.games.resetCooldown(telegramId, 'coinflip');
                    return { canPlay: true, flipsRemaining: this.MAX_FLIPS };
                }
                
                const minutesLeft = Math.ceil((cooldownTime - currentTime) / 60000);
                return { 
                    canPlay: false, 
                    reason: 'cooldown',
                    minutesLeft,
                    flipsRemaining: 0
                };
            }

            const flipsRemaining = Math.max(0, this.MAX_FLIPS - cooldown.plays_count);

            if (cooldown.plays_count >= this.MAX_FLIPS) {
                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                this.db.games.setCooldown(
                    telegramId, 
                    'coinflip', 
                    cooldown.plays_count, 
                    cooldownUntil.toISOString()
                );
                
                return { 
                    canPlay: false, 
                    reason: 'cooldown',
                    minutesLeft: this.COOLDOWN_HOURS * 60,
                    flipsRemaining: 0
                };
            }

            return { canPlay: true, flipsRemaining };
        } catch (error) {
            console.error('[CoinFlip] Error checking canPlay:', error);
            return { canPlay: false, reason: 'error' };
        }
    }

    // Play game (single flip)
    playGame(telegramId, playerChoice) {
        try {
            if (!this.CHOICES.includes(playerChoice)) {
                return { success: false, error: 'Invalid choice' };
            }

            const canPlayResult = this.canPlay(telegramId);
            if (!canPlayResult.canPlay) {
                return { 
                    success: false, 
                    reason: canPlayResult.reason,
                    minutesLeft: canPlayResult.minutesLeft 
                };
            }

            // Flip coin
            const coinResult = this.CHOICES[Math.floor(Math.random() * 2)];
            const won = playerChoice === coinResult;

            // Update stats
            this.db.games.updateCoinFlipStats(telegramId, won);

            // Increment flips
            this.db.games.incrementPlays(telegramId, 'coinflip');
            
            const cooldown = this.db.games.getCooldown(telegramId, 'coinflip');
            if (cooldown && cooldown.plays_count >= this.MAX_FLIPS) {
                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                this.db.games.setCooldown(
                    telegramId, 
                    'coinflip', 
                    cooldown.plays_count, 
                    cooldownUntil.toISOString()
                );
            }

            return {
                success: true,
                playerChoice,
                coinResult,
                won,
                flipsRemaining: cooldown ? Math.max(0, this.MAX_FLIPS - cooldown.plays_count) : this.MAX_FLIPS - 1
            };
        } catch (error) {
            console.error('[CoinFlip] Error playing game:', error);
            return { success: false, error: 'Server error' };
        }
    }

    // Get user stats
    getUserStats(telegramId) {
        try {
            const stats = this.db.games.getUserStats(telegramId);
            const cooldown = this.db.games.getCooldown(telegramId, 'coinflip');

            return {
                wins: stats?.coinflip_wins || 0,
                losses: stats?.coinflip_losses || 0,
                flipsRemaining: cooldown ? Math.max(0, this.MAX_FLIPS - cooldown.plays_count) : this.MAX_FLIPS,
                cooldown: cooldown?.cooldown_until || null
            };
        } catch (error) {
            console.error('[CoinFlip] Error getting stats:', error);
            return null;
        }
    }
}

module.exports = CoinFlipGame;