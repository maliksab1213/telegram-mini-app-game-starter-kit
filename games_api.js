// Games Main API - Updated with Sequence Match & Shootout
const fs = require('fs').promises;
const path = require('path');

class GamesAPI {
    constructor() {
        this.configPath = path.join(__dirname, 'control', 'games.json');
        this.config = null;
    }

    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            return this.config;
        } catch (error) {
            console.error('[GamesAPI] Error loading config:', error);
            this.config = {
                rockpaper: true,
                coinflip: true,
                headtails: true,
                glassball: true,
                football: true,
                holemole: true,
                memorygame: true,
                sequencematch: true,
                shootout: true
            };
            await this.saveConfig();
            return this.config;
        }
    }

    async saveConfig() {
        try {
            const dir = path.dirname(this.configPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('[GamesAPI] Error saving config:', error);
        }
    }

    async getAvailableGames() {
        if (!this.config) {
            await this.loadConfig();
        }

        const games = [];

        // Rock Paper Scissors
        games.push({
            id: 'rockpaper',
            name: 'Rock Paper Scissors',
            icon: '✊✋✌️',
            status: this.config.rockpaper !== false ? 'active' : 'maintenance',
            available: this.config.rockpaper !== false
        });

        // Coin Flip
        games.push({
            id: 'coinflip',
            name: 'Coin Flip',
            icon: '🪙💫',
            status: this.config.coinflip !== false ? 'active' : 'maintenance',
            available: this.config.coinflip !== false
        });

        // Head & Tails
        games.push({
            id: 'headtails',
            name: 'Head & Tails Cricket',
            icon: '🏏🪙',
            status: this.config.headtails !== false ? 'active' : 'maintenance',
            available: this.config.headtails !== false
        });

        // Glass Ball
        games.push({
            id: 'glassball',
            name: 'Glass Ball',
            icon: '🥛✨',
            status: this.config.glassball !== false ? 'active' : 'maintenance',
            available: this.config.glassball !== false
        });

        // Football
        games.push({
            id: 'football',
            name: 'Football Match',
            icon: '⚽🥅',
            status: this.config.football !== false ? 'active' : 'maintenance',
            available: this.config.football !== false
        });

        // Hole Mole
        games.push({
            id: 'holemole',
            name: 'Smash Hit',
            icon: '🎯🔨',
            status: this.config.holemole !== false ? 'active' : 'maintenance',
            available: this.config.holemole !== false
        });

        // Memory Game
        games.push({
            id: 'memorygame',
            name: 'Picture Match',
            icon: '🧠🎴',
            status: this.config.memorygame !== false ? 'active' : 'maintenance',
            available: this.config.memorygame !== false
        });

        // Sequence Match
        games.push({
            id: 'sequencematch',
            name: 'Color Sequence',
            icon: '🌈🧩',
            status: this.config.sequencematch !== false ? 'active' : 'maintenance',
            available: this.config.sequencematch !== false
        });

        // Shootout
        games.push({
            id: 'shootout',
            name: 'Penalty Shootout',
            icon: '⚽🥅',
            status: this.config.shootout !== false ? 'active' : 'maintenance',
            available: this.config.shootout !== false
        });

        return games;
    }

    async isGameAvailable(gameId) {
        if (!this.config) {
            await this.loadConfig();
        }

        const validGames = ['rockpaper', 'coinflip', 'headtails', 'glassball', 'football', 'holemole', 'memorygame', 'sequencematch', 'shootout'];
        
        if (validGames.includes(gameId)) {
            return this.config[gameId] !== false;
        }

        return false;
    }

    async toggleGame(gameId, status) {
        if (!this.config) {
            await this.loadConfig();
        }

        const validGames = ['rockpaper', 'coinflip', 'headtails', 'glassball', 'football', 'holemole', 'memorygame', 'sequencematch', 'shootout'];
        
        if (validGames.includes(gameId)) {
            this.config[gameId] = status;
            await this.saveConfig();
            return true;
        }

        return false;
    }
}

module.exports = new GamesAPI();