// Tournament API - Fixed time checking and status updates
const fs = require('fs').promises;
const path = require('path');

class TournamentAPI {
    constructor() {
        this.configPath = path.join(__dirname, 'control', 'tournament.json');
        this.config = null;
    }

    async loadConfig() {
        try {
            // Always read from file for fresh data
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            return this.config;
        } catch (error) {
            return null;
        }
    }

    async saveConfig(config) {
        try {
            const dir = path.dirname(this.configPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
            this.config = config;
        } catch (error) {
            console.error('[TournamentAPI] Error saving config:', error);
        }
    }

    async getTournamentData(date = null) {
        // Always load fresh from file
        const config = await this.loadConfig();
        if (!config) return null;

        const targetDate = date || this.getCurrentDate();
        
        if (config.date !== targetDate) {
            return null;
        }

        return config;
    }

    async getActiveTournament(date = null) {
        const config = await this.loadConfig();
        if (!config) return null;

        const targetDate = date || this.getCurrentDate();
        
        if (config.date !== targetDate) {
            return null;
        }

        return config.available_tournament;
    }

    async getTournamentByLocation(locationId) {
        // Always load fresh from file
        const config = await this.loadConfig();
        if (!config) return { available: false, message: 'Today is Off! Come back tomorrow.' };

        const currentDate = this.getCurrentDate();
        
        if (config.date !== currentDate) {
            return { available: false, message: 'Today is Off! Come back tomorrow.' };
        }

        const locationMap = {
            'stadium': 'horseRace',
            'boxing': 'boxing',
            'carrace': 'carRace'
        };

        const tournamentType = locationMap[locationId];
        if (!tournamentType) {
            return { available: false, message: 'Invalid location' };
        }

        if (config.available_tournament !== tournamentType) {
            return { available: false, message: 'Today is Off! Come back tomorrow.' };
        }

        return {
            available: true,
            type: tournamentType,
            data: config[tournamentType],
            date: config.date
        };
    }

    getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getCurrentTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    isTimePast(targetTime) {
        const current = this.getCurrentTime();
        return current >= targetTime;
    }

    getRoundStatus(tournament, roundNumber) {
        const currentTime = this.getCurrentTime();
        
        const roundKey = roundNumber === 3 && tournament.final ? 'final' : `round${roundNumber}`;
        const round = tournament[roundKey];
        if (!round) return 'not_available';

        const roundTime = round.time;
        
        // Check if time has passed by at least 1 minute
        if (this.isTimePastByMinutes(roundTime, currentTime, 1)) {
            return 'completed';
        } else if (currentTime >= roundTime) {
            return 'in_progress';
        } else {
            return 'waiting';
        }
    }

    isTimePastByMinutes(roundTime, currentTime, minutes) {
        const [roundHour, roundMin] = roundTime.split(':').map(Number);
        const [currHour, currMin] = currentTime.split(':').map(Number);
        
        const roundTotalMin = roundHour * 60 + roundMin;
        const currTotalMin = currHour * 60 + currMin;
        
        return currTotalMin >= (roundTotalMin + minutes);
    }

    addMinutesToTime(time, minutes) {
        const [hours, mins] = time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours);
        date.setMinutes(mins + minutes);
        
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    async cleanOldData() {
        try {
            const config = await this.loadConfig();
            if (!config) return;

            const currentDate = new Date();
            const configDate = new Date(config.date);
            const daysDiff = Math.floor((currentDate - configDate) / (1000 * 60 * 60 * 24));

            if (daysDiff > 3) {
                return null;
            }

            return config;
        } catch (error) {
            console.error('[TournamentAPI] Error cleaning old data:', error);
            return null;
        }
    }
}

module.exports = new TournamentAPI();