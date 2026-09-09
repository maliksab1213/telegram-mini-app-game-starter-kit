// Head & Tails Cricket Game Module - WITH COMPLETE STATS TRACKING
class HeadTailsGame {
    constructor(db) {
        this.db = db;
        this.CHOICES = ['head', 'tail'];
        this.NUMBERS = [1, 2, 3, 4, 5, 6];
        this.MAX_MATCHES = 3;
        this.COOLDOWN_HOURS = 1;
        this.MAX_WICKETS = 5;
        this.MAX_OVERS = 7;
        this.BALLS_PER_OVER = 6;
        this.MAX_BALLS = this.MAX_OVERS * this.BALLS_PER_OVER; // 42
        this.SESSION_TIMEOUT_MINUTES = 20;
        
        console.log('[HeadTails] Module initialized');
    }

    canPlay(telegramId) {
        try {
            const cooldown = this.db.games.getCooldown(telegramId, 'headtails');
            
            if (!cooldown) {
                return { canPlay: true, matchesRemaining: this.MAX_MATCHES };
            }

            if (cooldown.cooldown_until) {
                const cooldownTime = new Date(cooldown.cooldown_until);
                const currentTime = new Date();
                
                if (currentTime > cooldownTime) {
                    this.db.games.resetCooldown(telegramId, 'headtails');
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
                    'headtails', 
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
            console.error('[HeadTails] Error checking canPlay:', error);
            return { canPlay: false, reason: 'error' };
        }
    }

    isSessionExpired(session) {
        if (!session || !session.updated_at) return false;
        
        const sessionTime = new Date(session.updated_at);
        const currentTime = new Date();
        const minutesPassed = (currentTime - sessionTime) / 60000;
        
        return minutesPassed > this.SESSION_TIMEOUT_MINUTES;
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

            const existingSession = this.db.games.getSession(telegramId, 'headtails');
            
            if (existingSession && this.isSessionExpired(existingSession)) {
                console.log('[HeadTails] Session expired, deleting...');
                this.db.games.deleteSession(telegramId, 'headtails');
            }
            
            const validSession = this.db.games.getSession(telegramId, 'headtails');
            if (validSession) {
                return {
                    success: true,
                    session: validSession.session_data,
                    resumed: true,
                    matchesRemaining: canPlayResult.matchesRemaining
                };
            }

            // Create new session
            const session = {
                phase: 'toss',
                tossWinner: null,
                userChoice: null,
                currentInning: 1,
                innings: {
                    inning1: {
                        batting: null,
                        runs: 0,
                        wickets: 0,
                        balls: 0,
                        ballHistory: []
                    },
                    inning2: {
                        batting: null,
                        runs: 0,
                        wickets: 0,
                        balls: 0,
                        ballHistory: [],
                        target: 0
                    }
                },
                result: null,
                matchCounted: false
            };

            this.db.games.createSession(telegramId, 'headtails', session);

            return {
                success: true,
                session,
                resumed: false,
                matchesRemaining: canPlayResult.matchesRemaining
            };
        } catch (error) {
            console.error('[HeadTails] Error starting game:', error);
            return { success: false, reason: 'error' };
        }
    }

    getSession(telegramId) {
        try {
            const session = this.db.games.getSession(telegramId, 'headtails');
            
            if (session && this.isSessionExpired(session)) {
                console.log('[HeadTails] Session expired during get');
                this.db.games.deleteSession(telegramId, 'headtails');
                return null;
            }
            
            return session ? session.session_data : null;
        } catch (error) {
            console.error('[HeadTails] Error getting session:', error);
            return null;
        }
    }

    performToss(telegramId, userChoice) {
        try {
            if (!this.CHOICES.includes(userChoice)) {
                return { success: false, error: 'Invalid choice' };
            }

            const session = this.db.games.getSession(telegramId, 'headtails');
            if (!session || session.session_data.phase !== 'toss') {
                return { success: false, error: 'Invalid game phase' };
            }

            const sessionData = session.session_data;
            
            const tossResult = this.CHOICES[Math.floor(Math.random() * 2)];
            const userWon = tossResult === userChoice;
            
            sessionData.tossWinner = userWon ? 'user' : 'computer';
            sessionData.phase = 'choose_action';
            
            this.db.games.updateSession(telegramId, 'headtails', sessionData);

            return {
                success: true,
                tossResult,
                userWon,
                session: sessionData
            };
        } catch (error) {
            console.error('[HeadTails] Error performing toss:', error);
            return { success: false, error: 'Server error' };
        }
    }

    chooseAction(telegramId, action) {
        try {
            if (!['batting', 'bowling'].includes(action)) {
                return { success: false, error: 'Invalid action' };
            }

            const session = this.db.games.getSession(telegramId, 'headtails');
            if (!session || session.session_data.phase !== 'choose_action') {
                return { success: false, error: 'Invalid game phase' };
            }

            const sessionData = session.session_data;
            
            let userAction, computerAction;
            
            if (sessionData.tossWinner === 'user') {
                userAction = action;
                computerAction = action === 'batting' ? 'bowling' : 'batting';
            } else {
                computerAction = Math.random() > 0.5 ? 'batting' : 'bowling';
                userAction = computerAction === 'batting' ? 'bowling' : 'batting';
            }
            
            sessionData.userChoice = userAction;
            sessionData.innings.inning1.batting = userAction === 'batting' ? 'user' : 'computer';
            sessionData.innings.inning2.batting = userAction === 'batting' ? 'computer' : 'user';
            sessionData.phase = 'inning1';
            
            this.db.games.updateSession(telegramId, 'headtails', sessionData);

            return {
                success: true,
                userAction,
                computerAction,
                session: sessionData
            };
        } catch (error) {
            console.error('[HeadTails] Error choosing action:', error);
            return { success: false, error: 'Server error' };
        }
    }

    playBall(telegramId, userNumber) {
        try {
            if (!this.NUMBERS.includes(userNumber)) {
                return { success: false, error: 'Invalid number' };
            }

            const session = this.db.games.getSession(telegramId, 'headtails');
            if (!session) {
                return { success: false, error: 'No active session' };
            }

            const sessionData = session.session_data;
            
            if (!['inning1', 'inning2'].includes(sessionData.phase)) {
                return { success: false, error: 'Invalid game phase' };
            }

            const currentInning = sessionData.innings[sessionData.phase];
            const computerNumber = this.NUMBERS[Math.floor(Math.random() * 6)];
            
            const isBatting = currentInning.batting === 'user';
            let isOut = false;
            let runsScored = 0;
            
            if (userNumber === computerNumber) {
                isOut = true;
                currentInning.wickets++;
            } else {
                runsScored = isBatting ? userNumber : computerNumber;
                currentInning.runs += runsScored;
            }
            
            currentInning.balls++;
            currentInning.ballHistory.push({
                ball: currentInning.balls,
                userNumber,
                computerNumber,
                isOut,
                runsScored
            });
            
            let inningEnded = false;
            let reason = null;
            
            if (currentInning.wickets >= this.MAX_WICKETS) {
                inningEnded = true;
                reason = 'all_out';
            } else if (currentInning.balls >= this.MAX_BALLS) {
                inningEnded = true;
                reason = 'overs_complete';
            } else if (sessionData.phase === 'inning2') {
                const target = currentInning.target;
                if (currentInning.runs >= target) {
                    inningEnded = true;
                    reason = 'target_achieved';
                } else {
                    const ballsLeft = this.MAX_BALLS - currentInning.balls;
                    const runsNeeded = target - currentInning.runs;
                    if (runsNeeded > ballsLeft * 6) {
                        inningEnded = true;
                        reason = 'target_impossible';
                    }
                }
            }
            
            if (inningEnded) {
                if (sessionData.phase === 'inning1') {
                    sessionData.innings.inning2.target = currentInning.runs + 1;
                    sessionData.phase = 'inning2';
                } else {
                    // ✅ Match finished - determine result and update stats
                    this.determineResult(sessionData);
                    sessionData.phase = 'result';
                    
                    if (!sessionData.matchCounted) {
                        // ✅ Update user stats (total wins/losses)
                        this.db.games.updateHeadTailsStats(
                            telegramId,
                            sessionData.result === 'win'
                        );
                        
                        // ✅ Only increment matches if NOT a tie
                        if (sessionData.result !== 'tie') {
                            this.db.games.incrementPlays(telegramId, 'headtails');
                            
                            const cooldown = this.db.games.getCooldown(telegramId, 'headtails');
                            if (cooldown && cooldown.plays_count >= this.MAX_MATCHES) {
                                const cooldownUntil = new Date(Date.now() + (this.COOLDOWN_HOURS * 60 * 60 * 1000));
                                this.db.games.setCooldown(
                                    telegramId,
                                    'headtails',
                                    cooldown.plays_count,
                                    cooldownUntil.toISOString()
                                );
                            }
                        }
                        
                        sessionData.matchCounted = true;
                        
                        console.log(`[HeadTails] ✅ Match completed - Result: ${sessionData.result}`);
                    }
                }
            }
            
            this.db.games.updateSession(telegramId, 'headtails', sessionData);

            return {
                success: true,
                ball: {
                    userNumber,
                    computerNumber,
                    isOut,
                    runsScored
                },
                inningEnded,
                reason,
                session: sessionData
            };
        } catch (error) {
            console.error('[HeadTails] Error playing ball:', error);
            return { success: false, error: 'Server error' };
        }
    }

    determineResult(sessionData) {
        const inning1Runs = sessionData.innings.inning1.runs;
        const inning2Runs = sessionData.innings.inning2.runs;
        
        const userBattedFirst = sessionData.innings.inning1.batting === 'user';
        
        if (inning1Runs === inning2Runs) {
            sessionData.result = 'tie';
        } else if (userBattedFirst) {
            sessionData.result = inning2Runs < inning1Runs ? 'win' : 'lose';
        } else {
            sessionData.result = inning2Runs >= inning1Runs ? 'win' : 'lose';
        }
    }

    // ✅ Get user stats with date-wise breakdown
    getUserStats(telegramId) {
        try {
            // Get overall stats
            const stats = this.db.games.getUserStats(telegramId);
            const cooldown = this.db.games.getCooldown(telegramId, 'headtails');
            
            // Get date-wise stats (last 3 days)
            const dateWiseStats = this.db.games.getUserDateWiseStats(telegramId, 'headtails', 3);

            return {
                wins: stats?.headtails_wins || 0,
                losses: stats?.headtails_losses || 0,
                totalMatches: (stats?.headtails_wins || 0) + (stats?.headtails_losses || 0),
                matchesRemaining: cooldown ? Math.max(0, this.MAX_MATCHES - cooldown.plays_count) : this.MAX_MATCHES,
                cooldown: cooldown?.cooldown_until || null,
                dateWiseStats: dateWiseStats || [] // ✅ Date-wise stats
            };
        } catch (error) {
            console.error('[HeadTails] Error getting stats:', error);
            return null;
        }
    }

    // ✅ Get global game stats
    getGameStats() {
        try {
            return this.db.games.getDateWiseStats('headtails', 3);
        } catch (error) {
            console.error('[HeadTails] Error getting game stats:', error);
            return [];
        }
    }
}

module.exports = HeadTailsGame;