// Tournament Background Module - UTC/US Time Fixed
const tournamentAPI = require('./tournament_api');
const fs = require('fs').promises;
const path = require('path');

class TournamentModule {
    constructor() {
        this.isRunning = false;
        this.checkInterval = null;
        
        // Set timezone to US Eastern Time
        this.TIMEZONE = 'America/New_York';
        
        // Horse names pool
        this.horseRiders = [
            'Thunder Storm', 'Lightning Bolt', 'Wild Wind', 'Fire Spirit', 'Silver Arrow',
            'Golden Flash', 'Night Runner', 'Storm Chaser', 'Speed Demon', 'Royal Knight',
            'Dark Shadow', 'Brave Heart', 'Swift Eagle', 'Iron Horse', 'Desert Storm'
        ];

        // Boxing characters
        this.boxers = [
            'Iron Mike', 'Thunder Fist', 'Rocky Steel', 'Dragon Punch', 'Cobra Strike',
            'Lightning Jack', 'Titan Fury', 'Shadow Boxer', 'Storm Fighter', 'Steel Jaw'
        ];

        // Car colors and names
        this.carColors = [
            { color: 'Red', name: 'Ferrari Blaze' },
            { color: 'Blue', name: 'Ocean Racer' },
            { color: 'Green', name: 'Emerald Storm' },
            { color: 'Yellow', name: 'Golden Flash' },
            { color: 'Black', name: 'Shadow Bullet' },
            { color: 'White', name: 'Ice Lightning' },
            { color: 'Orange', name: 'Fire Phoenix' }
        ];
    }

    start() {
        if (this.isRunning) {
            console.log('[Tournament] ⚠️ System already running');
            return;
        }

        this.isRunning = true;
        console.log('[Tournament] ✅ System started (Timezone: US Eastern Time)');

        // Initial check
        this.checkAndManageTournament();

        // Check every 1 minute
        this.checkInterval = setInterval(() => {
            this.checkAndManageTournament();
        }, 1 * 60 * 1000); // 1 minute
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        console.log('[Tournament] 🛑 System stopped');
    }

    // Get current US Eastern Time
    getCurrentUSDate() {
        const now = new Date();
        const usDate = new Date(now.toLocaleString('en-US', { timeZone: this.TIMEZONE }));
        
        const year = usDate.getFullYear();
        const month = String(usDate.getMonth() + 1).padStart(2, '0');
        const day = String(usDate.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }

    getCurrentUSTime() {
        const now = new Date();
        const usDate = new Date(now.toLocaleString('en-US', { timeZone: this.TIMEZONE }));
        
        const hours = String(usDate.getHours()).padStart(2, '0');
        const minutes = String(usDate.getMinutes()).padStart(2, '0');
        
        return `${hours}:${minutes}`;
    }

    async checkAndManageTournament() {
        try {
            const currentDate = this.getCurrentUSDate();
            const currentTime = this.getCurrentUSTime();
            
            console.log('\n========================================');
            console.log('[Tournament] 🔍 Checking tournament status');
            console.log(`[Tournament] 📅 Current US Date: ${currentDate}`);
            console.log(`[Tournament] 🕐 Current US Time: ${currentTime}`);
            console.log('========================================');
            
            // Always load fresh config from file
            const existingConfig = await tournamentAPI.loadConfig();

            // Check if we need to generate new tournament
            if (!existingConfig || existingConfig.date !== currentDate) {
                console.log(`[Tournament] 🆕 No tournament for today or date mismatch`);
                console.log(`[Tournament] Existing date: ${existingConfig?.date || 'None'}`);
                console.log(`[Tournament] Generating new tournament for: ${currentDate}`);
                await this.generateNewTournament(currentDate);
            } else {
                console.log(`[Tournament] ✅ Tournament exists for today (${currentDate})`);
                // Update round statuses based on time
                await this.updateRoundStatuses(existingConfig, currentTime);
            }
            
        } catch (error) {
            console.error('[Tournament] ❌ Error:', error);
        }
    }

    async generateNewTournament(date) {
        // Randomly select tournament type
        const tournaments = ['horseRace', 'boxing', 'carRace'];
        const selectedTournament = tournaments[Math.floor(Math.random() * tournaments.length)];

        let config = {
            date: date,
            available_tournament: selectedTournament,
            timezone: this.TIMEZONE,
            created_at: new Date().toISOString()
        };

        // Generate tournament data based on type
        if (selectedTournament === 'horseRace') {
            config.horseRace = this.generateHorseRace();
        } else if (selectedTournament === 'boxing') {
            config.boxing = this.generateBoxing();
        } else if (selectedTournament === 'carRace') {
            config.carRace = this.generateCarRace();
        }

        await tournamentAPI.saveConfig(config);
        
        console.log('\n========================================');
        console.log(`[Tournament] 🎉 NEW TOURNAMENT GENERATED`);
        console.log(`[Tournament] Type: ${selectedTournament}`);
        console.log(`[Tournament] Date: ${date}`);
        console.log(`[Tournament] Timezone: ${this.TIMEZONE}`);
        console.log(`[Tournament] Tournament Data:`, JSON.stringify(config[selectedTournament], null, 2));
        console.log('========================================\n');
    }

    async updateRoundStatuses(config, currentTime) {
        const tournamentType = config.available_tournament;
        const tournament = config[tournamentType];
        
        if (!tournament) {
            console.log('[Tournament] ⚠️ No tournament data found');
            return;
        }

        console.log(`\n[Tournament] 🎮 Checking ${tournamentType} rounds:`);
        console.log('----------------------------------------');

        let updated = false;

        // Check each round
        for (let i = 1; i <= 3; i++) {
            const roundKey = tournamentType === 'boxing' && i === 3 ? 'final' : `round${i}`;
            const round = tournament[roundKey];
            
            if (!round) {
                console.log(`[Tournament] ⚠️ Round ${i} (${roundKey}) not found`);
                continue;
            }

            const roundTime = round.time;
            const completed = round.completed;
            
            console.log(`\n[Tournament] Round ${i} (${roundKey}):`);
            console.log(`  ⏰ Scheduled Time: ${roundTime}`);
            console.log(`  🕐 Current Time: ${currentTime}`);
            console.log(`  📊 Status: ${completed ? '✅ COMPLETED' : '⏳ PENDING'}`);

            // Only check if not already completed
            if (completed === false) {
                const timePassed = this.isTimePastByMinute(roundTime, currentTime);
                const timeDiff = this.getTimeDifferenceInMinutes(roundTime, currentTime);
                
                console.log(`  🔍 Time passed check: ${timePassed ? 'YES ✅' : 'NO ❌'}`);
                console.log(`  ⏱️ Time difference: ${timeDiff > 0 ? `+${timeDiff}` : timeDiff} minutes`);
                
                if (timePassed) {
                    round.completed = true;
                    updated = true;
                    console.log(`  ✅ MARKING AS COMPLETED (time passed by ${timeDiff} minute(s))`);
                } else {
                    const remaining = Math.abs(timeDiff);
                    console.log(`  ⏳ Still pending (${remaining} minute(s) remaining)`);
                }
            } else {
                console.log(`  ℹ️ Already completed, skipping`);
            }
        }

        console.log('----------------------------------------');

        if (updated) {
            // Always load fresh data before saving
            const freshConfig = await tournamentAPI.loadConfig();
            if (freshConfig && freshConfig.date === config.date) {
                // Update the fresh config with new completion statuses
                const freshTournament = freshConfig[tournamentType];
                if (freshTournament) {
                    for (let i = 1; i <= 3; i++) {
                        const roundKey = tournamentType === 'boxing' && i === 3 ? 'final' : `round${i}`;
                        if (tournament[roundKey] && freshTournament[roundKey]) {
                            freshTournament[roundKey].completed = tournament[roundKey].completed;
                        }
                    }
                    await tournamentAPI.saveConfig(freshConfig);
                    console.log('\n[Tournament] 💾 Tournament config updated with completion statuses');
                    console.log('[Tournament] Updated tournament data:', JSON.stringify(freshTournament, null, 2));
                }
            }
        } else {
            console.log('\n[Tournament] ℹ️ No updates needed - all rounds checked');
        }
    }

    isTimePastByMinute(roundTime, currentTime) {
        const [roundHour, roundMin] = roundTime.split(':').map(Number);
        const [currHour, currMin] = currentTime.split(':').map(Number);
        
        const roundTotalMin = roundHour * 60 + roundMin;
        const currTotalMin = currHour * 60 + currMin;
        
        // Current time must be at least 1 minute past round time
        return currTotalMin >= (roundTotalMin + 1);
    }

    getTimeDifferenceInMinutes(roundTime, currentTime) {
        const [roundHour, roundMin] = roundTime.split(':').map(Number);
        const [currHour, currMin] = currentTime.split(':').map(Number);
        
        const roundTotalMin = roundHour * 60 + roundMin;
        const currTotalMin = currHour * 60 + currMin;
        
        return currTotalMin - roundTotalMin;
    }

    generateHorseRace() {
        const getRandomTime = (minHour = 9, maxHour = 21) => {
            const hour = Math.floor(Math.random() * (maxHour - minHour + 1)) + minHour;
            const minute = Math.floor(Math.random() * 60);
            return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        };

        const getUniqueHorses = (count) => {
            const shuffled = [...this.horseRiders].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, count).map((rider, index) => ({
                number: Math.floor(Math.random() * 100) + 1,
                rider: rider,
                position: index + 1
            }));
        };

        const selectWinner = (horses) => {
            return horses[Math.floor(Math.random() * horses.length)].number;
        };

        // Round 1
        const round1Horses = getUniqueHorses(5);
        const round1Time = getRandomTime(9, 13);

        // Round 2
        const round2Horses = getUniqueHorses(5);
        const round2Time = getRandomTime(14, 17);

        // Round 3
        const round3Horses = getUniqueHorses(5);
        const round3Time = getRandomTime(18, 21);

        return {
            round1: {
                time: round1Time,
                horses: round1Horses,
                winner: selectWinner(round1Horses),
                completed: false
            },
            round2: {
                time: round2Time,
                horses: round2Horses,
                winner: selectWinner(round2Horses),
                completed: false
            },
            round3: {
                time: round3Time,
                horses: round3Horses,
                winner: selectWinner(round3Horses),
                completed: false
            }
        };
    }

    generateBoxing() {
        const getRandomTime = (minHour = 9, maxHour = 21) => {
            const hour = Math.floor(Math.random() * (maxHour - minHour + 1)) + minHour;
            const minute = Math.floor(Math.random() * 60);
            return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        };

        const getUniqueFighters = (count) => {
            const shuffled = [...this.boxers].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, count);
        };

        const fighters = getUniqueFighters(4);

        const round1Time = getRandomTime(9, 13);
        const round1Fighter1 = fighters[0];
        const round1Fighter2 = fighters[1];
        const round1Winner = Math.random() < 0.5 ? round1Fighter1 : round1Fighter2;

        const round2Time = getRandomTime(14, 17);
        const round2Fighter1 = fighters[2];
        const round2Fighter2 = fighters[3];
        const round2Winner = Math.random() < 0.5 ? round2Fighter1 : round2Fighter2;

        const finalTime = getRandomTime(18, 21);
        const finalWinner = Math.random() < 0.5 ? round1Winner : round2Winner;

        return {
            round1: {
                time: round1Time,
                fighter1: round1Fighter1,
                fighter2: round1Fighter2,
                winner: round1Winner,
                completed: false
            },
            round2: {
                time: round2Time,
                fighter1: round2Fighter1,
                fighter2: round2Fighter2,
                winner: round2Winner,
                completed: false
            },
            final: {
                time: finalTime,
                fighter1: round1Winner,
                fighter2: round2Winner,
                winner: finalWinner,
                completed: false
            }
        };
    }

    generateCarRace() {
        const getRandomTime = (minHour = 9, maxHour = 21) => {
            const hour = Math.floor(Math.random() * (maxHour - minHour + 1)) + minHour;
            const minute = Math.floor(Math.random() * 60);
            return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        };

        const getUniqueCars = (count) => {
            const shuffled = [...this.carColors].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, count).map((car, index) => ({
                number: Math.floor(Math.random() * 100) + 1,
                color: car.color,
                name: car.name,
                position: index + 1
            }));
        };

        const selectWinner = (cars) => {
            return cars[Math.floor(Math.random() * cars.length)].number;
        };

        const round1Cars = getUniqueCars(5);
        const round1Time = getRandomTime(9, 13);

        const round2Cars = getUniqueCars(5);
        const round2Time = getRandomTime(14, 17);

        const round3Cars = getUniqueCars(5);
        const round3Time = getRandomTime(18, 21);

        return {
            round1: {
                time: round1Time,
                cars: round1Cars,
                winner: selectWinner(round1Cars),
                completed: false
            },
            round2: {
                time: round2Time,
                cars: round2Cars,
                winner: selectWinner(round2Cars),
                completed: false
            },
            round3: {
                time: round3Time,
                cars: round3Cars,
                winner: selectWinner(round3Cars),
                completed: false
            }
        };
    }
}

module.exports = new TournamentModule();