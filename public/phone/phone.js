// Phone Interface System
class PhoneInterface {
    constructor() {
        this.isOpen = false;
        this.currentApp = null;
        this.apps = [];
        this.init();
    }

    init() {
        this.createPhoneHTML();
        this.setupEventListeners();
        this.loadApps();
        console.log('[PHONE] Initialized');
    }

    createPhoneHTML() {
        const phoneHTML = `
            <div id="phone-modal" class="phone-modal d-none">
                <div class="phone-device">
                    <!-- Phone Status Bar -->
                    <div class="phone-status-bar">
                        <div class="status-left">
                            <span class="status-time" id="phone-time">12:00</span>
                        </div>
                        <div class="status-right">
                            <span class="status-signal">📶</span>
                            <span class="status-battery">🔋</span>
                        </div>
                    </div>

                    <!-- Phone Screen -->
                    <div class="phone-screen" id="phone-screen">
                        <!-- Close Button -->
                        <button class="phone-close-btn" id="phone-close-btn">×</button>
                        
                        <!-- App Icons Grid -->
                        <div id="phone-apps-grid" class="phone-apps-grid">
                            <!-- Apps will be loaded here -->
                        </div>

                        <!-- App Content Area (for opened apps) -->
                        <div id="phone-app-content" class="phone-app-content d-none">
                            <!-- App content loads here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', phoneHTML);
    }

    setupEventListeners() {
        const closeBtn = document.getElementById('phone-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Update time every minute
        this.updateTime();
        setInterval(() => this.updateTime(), 60000);
    }

    loadApps() {
    // Define available apps
    this.apps = [
        {
            id: 'online-wallet',
            name: 'Online Wallet',
            icon: '💳',
            instance: null
        },
        {
            id: 'trading-market',
            name: 'Trading',
            icon: '📈',
            instance: null
        }
    ];

    this.renderApps();
}

    renderApps() {
        const appsGrid = document.getElementById('phone-apps-grid');
        if (!appsGrid) return;

        appsGrid.innerHTML = this.apps.map(app => `
            <div class="phone-app-icon" data-app-id="${app.id}">
                <div class="app-icon">${app.icon}</div>
                <div class="app-name">${app.name}</div>
            </div>
        `).join('');

        // Add click listeners
        appsGrid.querySelectorAll('.phone-app-icon').forEach(icon => {
            icon.addEventListener('click', () => {
                const appId = icon.dataset.appId;
                this.openApp(appId);
            });
        });
    }

    async openApp(appId) {
    const app = this.apps.find(a => a.id === appId);
    if (!app) return;

    console.log(`[PHONE] Opening app: ${appId}`);

    // Initialize app instance if not exists
    if (!app.instance) {
        switch (appId) {
            case 'online-wallet':
                if (window.OnlineWalletApp) {
                    app.instance = new window.OnlineWalletApp(this);
                }
                break;
            case 'trading-market':
                if (window.TradingApp) {
                    app.instance = new window.TradingApp(this);
                }
                break;
        }
    }

    if (app.instance && app.instance.open) {
        this.currentApp = app;
        await app.instance.open();
        this.showAppContent();
    }
}

    showAppContent() {
        const appsGrid = document.getElementById('phone-apps-grid');
        const appContent = document.getElementById('phone-app-content');
        
        if (appsGrid) appsGrid.classList.add('d-none');
        if (appContent) appContent.classList.remove('d-none');
    }

    hideAppContent() {
        const appsGrid = document.getElementById('phone-apps-grid');
        const appContent = document.getElementById('phone-app-content');
        
        if (appsGrid) appsGrid.classList.remove('d-none');
        if (appContent) {
            appContent.classList.add('d-none');
            appContent.innerHTML = '';
        }
        
        this.currentApp = null;
    }

    updateTime() {
        const timeEl = document.getElementById('phone-time');
        if (timeEl) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            timeEl.textContent = `${hours}:${minutes}`;
        }
    }

    open() {
        const modal = document.getElementById('phone-modal');
        if (modal) {
            modal.classList.remove('d-none');
            this.isOpen = true;
            this.updateTime();
            console.log('[PHONE] Opened');
        }
    }

    close() {
        const modal = document.getElementById('phone-modal');
        if (modal) {
            modal.classList.add('d-none');
            this.isOpen = false;
            this.hideAppContent();
            console.log('[PHONE] Closed');
        }
    }

    getAppContent() {
        return document.getElementById('phone-app-content');
    }
}

// Initialize phone interface
window.PhoneInterface = PhoneInterface;
window.phoneInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.phoneInstance) {
        window.phoneInstance = new PhoneInterface();
    }
});