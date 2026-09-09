// Games Main Script - Updated with Sequence Match & Shootout
class GamesManager {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.locToken = this.urlParams.get('loc_token');
        this.games = [];
        this.currentView = 'main';
        
        console.log('[Games] Initialized');
    }

    async init() {
        try {
            console.log('[Games] Loading...');
            await this.loadGames();
            this.setupEventListeners();
            console.log('[Games] ✅ Ready');
        } catch (error) {
            console.error('[Games] ❌ Init failed:', error);
            this.showError('Failed to load games');
        }
    }

    async loadGames() {
        try {
            const response = await fetch(
                `/api/games/list?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.games = data.games || [];
            
            console.log('[Games] Games loaded:', this.games.length);
            this.renderGames();
        } catch (error) {
            console.error('[Games] Error loading games:', error);
            this.showError('Failed to load games');
        }
    }

    renderGames() {
        const grid = document.getElementById('games-grid');
        if (!grid) return;

        grid.innerHTML = '';

        this.games.forEach(game => {
            const card = document.createElement('div');
            card.className = `game-card ${!game.available ? 'disabled' : ''}`;
            
            card.innerHTML = `
                <div class="game-icon">${game.icon}</div>
                <div class="game-name">${game.name}</div>
                <div class="game-status">${game.status === 'active' ? 'Active' : 'Maintenance'}</div>
                <button class="play-btn" data-game="${game.id}" ${!game.available ? 'disabled' : ''}>
                    ${game.available ? 'Play Now' : 'Maintenance'}
                </button>
            `;
            
            grid.appendChild(card);
        });

        console.log('[Games] Games rendered');
    }

    setupEventListeners() {
        const backBtn = document.getElementById('main-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goHome());
        }

        const grid = document.getElementById('games-grid');
        if (grid) {
            grid.addEventListener('click', (e) => {
                if (e.target.classList.contains('play-btn')) {
                    const gameId = e.target.dataset.game;
                    const isDisabled = e.target.disabled;
                    
                    if (!isDisabled) {
                        this.openGame(gameId);
                    } else {
                        this.showMaintenance(gameId);
                    }
                }
            });
        }

        console.log('[Games] Event listeners ready');
    }

    openGame(gameId) {
        console.log('[Games] Opening game:', gameId);
        
        const gameClients = {
            'rockpaper': { view: 'rockpaper-game-view', client: 'rockPaperClient' },
            'coinflip': { view: 'coinflip-game-view', client: 'coinFlipClient' },
            'headtails': { view: 'headtails-game-view', client: 'headTailsClient' },
            'glassball': { view: 'glassball-game-view', client: 'glassBallClient' },
            'football': { view: 'football-game-view', client: 'footballClient' },
            'holemole': { view: 'holemole-game-view', client: 'holeMoleClient' },
            'memorygame': { view: 'memorygame-game-view', client: 'memoryGameClient' },
            'sequencematch': { view: 'sequencematch-game-view', client: 'sequenceMatchClient' },
            'shootout': { view: 'shootout-game-view', client: 'shootoutClient' }
        };

        const gameInfo = gameClients[gameId];
        if (!gameInfo) {
            console.error('[Games] Unknown game:', gameId);
            return;
        }

        this.showGameView(gameInfo.view);
        
        if (window[gameInfo.client]) {
            window[gameInfo.client].init();
        } else {
            console.error(`[Games] ${gameInfo.client} not found!`);
        }
    }

    showGameView(viewId) {
        const mainView = document.getElementById('games-main-view');
        const gameView = document.getElementById(viewId);
        
        if (mainView) mainView.classList.add('d-none');
        if (gameView) gameView.classList.remove('d-none');
        
        this.currentView = viewId;
        console.log('[Games] View:', viewId);
    }

    showMainView() {
        const mainView = document.getElementById('games-main-view');
        const gameViews = document.querySelectorAll('.game-container');
        
        if (mainView) mainView.classList.remove('d-none');
        gameViews.forEach(view => view.classList.add('d-none'));
        
        this.currentView = 'main';
        
        // Stop all game clients
        const clients = [
            'rockPaperClient', 'coinFlipClient', 'headTailsClient',
            'glassBallClient', 'footballClient', 'holeMoleClient', 
            'memoryGameClient', 'sequenceMatchClient', 'shootoutClient'
        ];
        
        clients.forEach(clientName => {
            if (window[clientName] && typeof window[clientName].cleanup === 'function') {
                window[clientName].cleanup();
            }
        });
        
        console.log('[Games] Main view');
    }

    goHome() {
        console.log('[Games] Going home...');
        this.showNotification('Returning to game...', 'info');
        
        setTimeout(() => {
            const gameUrl = `/game?uid=${this.uid}&token=${this.token}`;
            window.location.href = gameUrl;
        }, 500);
    }

    showMaintenance(gameId) {
        this.showNotification('⚠️ This game is under maintenance', 'warning');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'games-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${
                type === 'success' ? 'rgba(78, 205, 196, 0.9)' : 
                type === 'warning' ? 'rgba(255, 193, 7, 0.9)' :
                type === 'error' ? 'rgba(255, 107, 107, 0.9)' : 
                'rgba(52, 152, 219, 0.9)'
            };
            color: #fff;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Games] DOM ready');
    window.gamesManager = new GamesManager();
    window.gamesManager.init();
});