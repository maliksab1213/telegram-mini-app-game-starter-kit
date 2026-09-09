// Casino Main Script - Updated with new games
class CasinoManager {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.locToken = this.urlParams.get('loc_token');
        this.games = [];
        this.currentView = 'main';
        
        console.log('[Casino] Initialized');
    }

    async init() {
        try {
            console.log('[Casino] Loading...');
            await this.loadUserCoins();
            await this.loadGames();
            this.setupEventListeners();
            console.log('[Casino] ✅ Ready');
        } catch (error) {
            console.error('[Casino] ❌ Init failed:', error);
            this.showError('Failed to load casino');
        }
    }

    async loadUserCoins() {
        try {
            const response = await fetch(
                `/api/user/coins?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            const casinoCoins = document.getElementById('casino-user-coins');
            if (casinoCoins) casinoCoins.textContent = data.coins || 0;
            
            console.log('[Casino] Coins loaded:', data.coins);
        } catch (error) {
            console.error('[Casino] Error loading coins:', error);
        }
    }

    async loadGames() {
        try {
            const response = await fetch(
                `/api/casino/games?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.games = data.games || [];
            
            console.log('[Casino] Games loaded:', this.games.length);
            this.renderGames();
        } catch (error) {
            console.error('[Casino] Error loading games:', error);
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

        console.log('[Casino] Games rendered');
    }

    setupEventListeners() {
        // Back to map button
        const backBtn = document.getElementById('main-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goHome());
        }

        // Play buttons (using event delegation)
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

        console.log('[Casino] Event listeners ready');
    }

    openGame(gameId) {
        console.log('[Casino] Opening game:', gameId);
        
        if (gameId === 'tigervsdragon') {
            this.showGameView('tigervsdragon-game-view');
            
            if (window.tigerVsDragonClient) {
                window.tigerVsDragonClient.init();
            } else {
                console.error('[Casino] Tiger vs Dragon client not found!');
            }
        } else if (gameId === 'roulette') {
            this.showGameView('roulette-game-view');
            
            if (window.rouletteClient) {
                window.rouletteClient.init();
            } else {
                console.error('[Casino] Roulette client not found!');
            }
        } else if (gameId === 'blackvsred') {
            this.showGameView('blackvsred-game-view');
            
            if (window.blackVsRedClient) {
                window.blackVsRedClient.init();
            } else {
                console.error('[Casino] Black vs Red client not found!');
            }
        } else if (gameId === 'bankervs') {
            this.showGameView('bankervs-game-view');
            
            if (window.bankerVsClient) {
                window.bankerVsClient.init();
            } else {
                console.error('[Casino] Banker vs Player client not found!');
            }
        }
    }

    showGameView(viewId) {
        const mainView = document.getElementById('casino-main-view');
        const gameView = document.getElementById(viewId);
        
        if (mainView) mainView.classList.add('d-none');
        if (gameView) gameView.classList.remove('d-none');
        
        this.currentView = viewId;
        console.log('[Casino] View:', viewId);
    }

    showMainView() {
        const mainView = document.getElementById('casino-main-view');
        const gameViews = document.querySelectorAll('.game-container');
        
        if (mainView) mainView.classList.remove('d-none');
        gameViews.forEach(view => view.classList.add('d-none'));
        
        this.currentView = 'main';
        
        // Stop all game clients
        if (window.tigerVsDragonClient) {
            window.tigerVsDragonClient.cleanup();
        }
        if (window.rouletteClient) {
            window.rouletteClient.cleanup();
        }
        if (window.blackVsRedClient) {
            window.blackVsRedClient.cleanup();
        }
        if (window.bankerVsClient) {
            window.bankerVsClient.cleanup();
        }
        
        // Reload coins
        this.loadUserCoins();
        
        console.log('[Casino] Main view');
    }

    goHome() {
        console.log('[Casino] Going home...');
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
        notification.className = 'casino-notification';
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

// Add animations
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Casino] DOM ready');
    window.casinoManager = new CasinoManager();
    window.casinoManager.init();
});