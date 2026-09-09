// Casino Main API - Handles all casino operations
const fs = require('fs').promises;
const path = require('path');

class CasinoAPI {
    constructor() {
        this.configPath = path.join(__dirname, 'control', 'casino.json');
        this.config = null;
    }

    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            return this.config;
        } catch (error) {
            console.error('[CasinoAPI] Error loading config:', error);
            // Create default config if not exists
            this.config = {
                tigervsdragon: true,
                roulette: true,
                blackvsred: true,
                bankervs: true
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
            console.error('[CasinoAPI] Error saving config:', error);
        }
    }

    async getAvailableGames() {
        if (!this.config) {
            await this.loadConfig();
        }

        const games = [];

        // Tiger vs Dragon
        if (this.config.tigervsdragon !== false) {
            games.push({
                id: 'tigervsdragon',
                name: 'Tiger vs Dragon',
                icon: '🐯🐲',
                status: 'active',
                available: true
            });
        } else {
            games.push({
                id: 'tigervsdragon',
                name: 'Tiger vs Dragon',
                icon: '🐯🐲',
                status: 'maintenance',
                available: false
            });
        }

        // Roulette
        if (this.config.roulette !== false) {
            games.push({
                id: 'roulette',
                name: 'Roulette',
                icon: '🎰🎡',
                status: 'active',
                available: true
            });
        } else {
            games.push({
                id: 'roulette',
                name: 'Roulette',
                icon: '🎰🎡',
                status: 'maintenance',
                available: false
            });
        }

        // Black vs Red
        if (this.config.blackvsred !== false) {
            games.push({
                id: 'blackvsred',
                name: 'Black vs Red',
                icon: '⚫🔴',
                status: 'active',
                available: true
            });
        } else {
            games.push({
                id: 'blackvsred',
                name: 'Black vs Red',
                icon: '⚫🔴',
                status: 'maintenance',
                available: false
            });
        }

        // Banker vs Player
        if (this.config.bankervs !== false) {
            games.push({
                id: 'bankervs',
                name: 'Banker vs Player',
                icon: '🏦👤',
                status: 'active',
                available: true
            });
        } else {
            games.push({
                id: 'bankervs',
                name: 'Banker vs Player',
                icon: '🏦👤',
                status: 'maintenance',
                available: false
            });
        }

        return games;
    }

    async isGameAvailable(gameId) {
        if (!this.config) {
            await this.loadConfig();
        }

        if (gameId === 'tigervsdragon') {
            return this.config.tigervsdragon !== false;
        }

        if (gameId === 'roulette') {
            return this.config.roulette !== false;
        }

        if (gameId === 'blackvsred') {
            return this.config.blackvsred !== false;
        }

        if (gameId === 'bankervs') {
            return this.config.bankervs !== false;
        }

        return false;
    }

    async toggleGame(gameId, status) {
        if (!this.config) {
            await this.loadConfig();
        }

        if (['tigervsdragon', 'roulette', 'blackvsred', 'bankervs'].includes(gameId)) {
            this.config[gameId] = status;
            await this.saveConfig();
            return true;
        }

        return false;
    }
}

module.exports = new CasinoAPI();