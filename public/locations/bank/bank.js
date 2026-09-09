// Bank Location Interface - FIXED
class BankInterface {
    constructor() {
        this.userData = null;
        this.walletData = null;
        this.coinsData = null;
        this.urlParams = null;
        this.currentView = 'menu';
        
        this.init();
    }

    async init() {
        try {
            console.log('[BANK] Initializing...');
            
            if (!this.validateAccess()) {
                this.showError('Invalid access. Please use the map to visit the bank.');
                return;
            }

            await this.loadAllData();
            this.showScreen('bank-interface');
            this.updateTime();
            setInterval(() => this.updateTime(), 1000);
            this.setupEventListeners();
            this.renderMainMenu();
            
            console.log('[BANK] ✅ Initialized');
        } catch (error) {
            console.error('[BANK] Initialization error:', error);
            this.showError('Failed to connect to bank system');
        }
    }

    validateAccess() {
        const urlParams = new URLSearchParams(window.location.search);
        this.urlParams = {
            uid: urlParams.get('uid'),
            token: urlParams.get('token'),
            loc_token: urlParams.get('loc_token')
        };

        return this.urlParams.uid && this.urlParams.token && this.urlParams.loc_token;
    }

    async loadAllData() {
        try {
            const coinsResponse = await fetch(`/api/user/coins?uid=${this.urlParams.uid}&token=${this.urlParams.token}`);
            if (coinsResponse.ok) {
                this.coinsData = await coinsResponse.json();
            }

            const walletResponse = await fetch(`/api/wallet?uid=${this.urlParams.uid}&token=${this.urlParams.token}`);
            if (walletResponse.ok) {
                this.walletData = await walletResponse.json();
            }

            console.log('[BANK] Data loaded:', { coins: this.coinsData, wallet: this.walletData });
        } catch (error) {
            console.error('[BANK] Error loading data:', error);
            throw error;
        }
    }

    setupEventListeners() {
        const homeBtn = document.getElementById('bank-home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => this.goHome());
        }
    }

    renderMainMenu() {
        const content = document.getElementById('screen-content');
        if (!content) return;

        const walletActive = this.walletData?.wallet_active;

        content.innerHTML = `
            <div class="bank-menu">
                <div class="bank-welcome">
                    <h2>Welcome to City Bank</h2>
                    <p>Your trusted financial partner</p>
                </div>

                <div class="account-status">
                    <div class="status-item">
                        <span class="status-label">💰 Cash Balance:</span>
                        <span class="status-value">${this.formatNumber(this.coinsData?.coins || 0)}</span>
                    </div>
                    ${walletActive ? `
                        <div class="status-item">
                            <span class="status-label">💳 Wallet Balance:</span>
                            <span class="status-value">${this.formatNumber(this.walletData?.wallet_balance || 0)}</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">📊 Wallet Level:</span>
                            <span class="status-value">Level ${this.walletData?.wallet_level || 1}</span>
                        </div>
                    ` : `
                        <div class="status-item inactive">
                            <span class="status-label">💳 Wallet Status:</span>
                            <span class="status-value">Not Active</span>
                        </div>
                    `}
                </div>

                <div class="bank-actions">
                    ${!walletActive ? `
                        <button class="bank-action-btn primary" id="open-wallet-btn">
                            <span class="btn-icon">💳</span>
                            <span class="btn-text">Open Wallet Account</span>
                            <span class="btn-detail">Cost: 100 Coins</span>
                        </button>
                    ` : `
                        <button class="bank-action-btn" id="deposit-btn">
                            <span class="btn-icon">💰</span>
                            <span class="btn-text">Deposit to Wallet</span>
                        </button>
                        
                        <button class="bank-action-btn" id="withdraw-btn">
                            <span class="btn-icon">💵</span>
                            <span class="btn-text">Withdraw from Wallet</span>
                        </button>
                        
                        <button class="bank-action-btn" id="upgrade-btn">
                            <span class="btn-icon">⬆️</span>
                            <span class="btn-text">Upgrade Wallet</span>
                        </button>
                    `}
                </div>
            </div>
        `;

        this.attachMenuListeners();
    }

    attachMenuListeners() {
        const openWalletBtn = document.getElementById('open-wallet-btn');
        if (openWalletBtn) {
            openWalletBtn.addEventListener('click', () => this.openWallet());
        }

        const depositBtn = document.getElementById('deposit-btn');
        if (depositBtn) {
            depositBtn.addEventListener('click', () => this.showDeposit());
        }

        const withdrawBtn = document.getElementById('withdraw-btn');
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', () => this.showWithdraw());
        }

        const upgradeBtn = document.getElementById('upgrade-btn');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => this.showUpgrade());
        }
    }

    async openWallet() {
        const COST = 100;

        if (this.coinsData.coins < COST) {
            this.showNotification('error', 'Insufficient Balance', `You need ${COST} coins to open a wallet account`);
            return;
        }

        const confirmed = await this.showConfirmation(
            'Open Wallet Account?',
            `Opening a wallet account costs ${COST} coins.\n\nStarting capacity: 10,000 coins\n\nDo you want to proceed?`,
            '💳'
        );
        
        if (!confirmed) {
            console.log('[BANK] User cancelled wallet opening');
            return;
        }

        console.log('[BANK] Opening wallet...');
        this.showLoading('Opening wallet account...');

        try {
            const response = await fetch(`/api/wallet/activate?uid=${this.urlParams.uid}&token=${this.urlParams.token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            console.log('[BANK] Wallet activation response:', result);

            if (result.success) {
                this.showNotification('success', 'Success!', 'Wallet account opened successfully!');
                await this.loadAllData();
                this.renderMainMenu();
            } else {
                this.showNotification('error', 'Failed', result.message || 'Failed to open wallet');
            }
        } catch (error) {
            console.error('[BANK] Error opening wallet:', error);
            this.showNotification('error', 'Error', 'Failed to open wallet. Please try again.');
        }

        this.hideLoading();
    }

    showDeposit() {
        const content = document.getElementById('screen-content');
        if (!content) return;

        content.innerHTML = `
            <div class="bank-transaction">
                <button class="transaction-back" id="back-to-menu">← Back</button>
                
                <h3>💰 Deposit to Wallet</h3>
                
                <div class="transaction-info">
                    <div class="info-row">
                        <span>Cash Balance:</span>
                        <span class="info-value">${this.formatNumber(this.coinsData.coins)}</span>
                    </div>
                    <div class="info-row">
                        <span>Wallet Balance:</span>
                        <span class="info-value">${this.formatNumber(this.walletData.wallet_balance)}</span>
                    </div>
                    <div class="info-row">
                        <span>Wallet Capacity:</span>
                        <span class="info-value">${this.formatNumber(this.walletData.wallet_max_capacity)}</span>
                    </div>
                </div>

                <div class="transaction-form">
                    <label>Amount to Deposit:</label>
                    <input type="number" id="deposit-amount" class="transaction-input" placeholder="0" min="1" max="${this.coinsData.coins}">
                    
                    <div class="quick-amounts">
                        <button class="quick-amt-btn" data-amount="100">100</button>
                        <button class="quick-amt-btn" data-amount="500">500</button>
                        <button class="quick-amt-btn" data-amount="1000">1000</button>
                        <button class="quick-amt-btn" data-amount="${this.coinsData.coins}">All</button>
                    </div>

                    <button class="transaction-submit" id="deposit-submit-btn">
                        Deposit Now
                    </button>
                </div>
            </div>
        `;

        document.getElementById('back-to-menu').addEventListener('click', () => this.renderMainMenu());
        
        document.querySelectorAll('.quick-amt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('deposit-amount').value = btn.dataset.amount;
            });
        });

        document.getElementById('deposit-submit-btn').addEventListener('click', () => this.executeDeposit());
    }

    async executeDeposit() {
        const amountInput = document.getElementById('deposit-amount');
        const amount = parseInt(amountInput.value);

        if (!amount || amount <= 0) {
            this.showNotification('error', 'Invalid Amount', 'Please enter a valid amount');
            return;
        }

        if (amount > this.coinsData.coins) {
            this.showNotification('error', 'Insufficient Balance', 'Not enough coins');
            return;
        }

        const availableSpace = this.walletData.wallet_max_capacity - this.walletData.wallet_balance;
        if (amount > availableSpace) {
            this.showNotification('error', 'Capacity Exceeded', `Only ${this.formatNumber(availableSpace)} coins can be deposited`);
            return;
        }

        this.showLoading('Processing deposit...');

        try {
            const response = await fetch(`/api/wallet/deposit?uid=${this.urlParams.uid}&token=${this.urlParams.token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('success', 'Success', result.message);
                await this.loadAllData();
                this.renderMainMenu();
            } else {
                this.showNotification('error', 'Failed', result.message);
            }
        } catch (error) {
            console.error('[BANK] Deposit error:', error);
            this.showNotification('error', 'Error', 'Deposit failed');
        }

        this.hideLoading();
    }

    showWithdraw() {
        const content = document.getElementById('screen-content');
        if (!content) return;

        const FEE_PERCENT = 1;

        content.innerHTML = `
            <div class="bank-transaction">
                <button class="transaction-back" id="back-to-menu">← Back</button>
                
                <h3>💵 Withdraw from Wallet</h3>
                
                <div class="transaction-info">
                    <div class="info-row">
                        <span>Wallet Balance:</span>
                        <span class="info-value">${this.formatNumber(this.walletData.wallet_balance)}</span>
                    </div>
                    <div class="info-row warning">
                        <span>Withdrawal Fee:</span>
                        <span class="info-value">${FEE_PERCENT}%</span>
                    </div>
                </div>

                <div class="transaction-form">
                    <label>Amount to Withdraw:</label>
                    <input type="number" id="withdraw-amount" class="transaction-input" placeholder="0" min="1" max="${this.walletData.wallet_balance}">
                    
                    <div class="quick-amounts">
                        <button class="quick-amt-btn" data-amount="100">100</button>
                        <button class="quick-amt-btn" data-amount="500">500</button>
                        <button class="quick-amt-btn" data-amount="1000">1000</button>
                        <button class="quick-amt-btn" data-amount="${this.walletData.wallet_balance}">All</button>
                    </div>

                    <div class="fee-preview" id="fee-preview">
                        <p>You will receive: <strong>0</strong> coins (after ${FEE_PERCENT}% fee)</p>
                    </div>

                    <button class="transaction-submit" id="withdraw-submit-btn">
                        Withdraw Now
                    </button>
                </div>
            </div>
        `;

        document.getElementById('back-to-menu').addEventListener('click', () => this.renderMainMenu());
        
        document.querySelectorAll('.quick-amt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = btn.dataset.amount;
                document.getElementById('withdraw-amount').value = amount;
                this.updateWithdrawPreview(parseInt(amount), FEE_PERCENT);
            });
        });

        const input = document.getElementById('withdraw-amount');
        input.addEventListener('input', (e) => {
            const amount = parseInt(e.target.value) || 0;
            this.updateWithdrawPreview(amount, FEE_PERCENT);
        });

        document.getElementById('withdraw-submit-btn').addEventListener('click', () => this.executeWithdraw());
    }

    updateWithdrawPreview(amount, feePercent) {
        const fee = Math.ceil(amount * feePercent / 100);
        const received = amount - fee;
        const preview = document.getElementById('fee-preview');
        if (preview) {
            preview.innerHTML = `<p>You will receive: <strong>${this.formatNumber(Math.max(0, received))}</strong> coins (Fee: ${fee})</p>`;
        }
    }

    async executeWithdraw() {
        const amountInput = document.getElementById('withdraw-amount');
        const amount = parseInt(amountInput.value);

        if (!amount || amount <= 0) {
            this.showNotification('error', 'Invalid Amount', 'Please enter a valid amount');
            return;
        }

        if (amount > this.walletData.wallet_balance) {
            this.showNotification('error', 'Insufficient Balance', 'Not enough wallet balance');
            return;
        }

        this.showLoading('Processing withdrawal...');

        try {
            const response = await fetch(`/api/wallet/withdraw?uid=${this.urlParams.uid}&token=${this.urlParams.token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('success', 'Success', result.message);
                await this.loadAllData();
                this.renderMainMenu();
            } else {
                this.showNotification('error', 'Failed', result.message);
            }
        } catch (error) {
            console.error('[BANK] Withdrawal error:', error);
            this.showNotification('error', 'Error', 'Withdrawal failed');
        }

        this.hideLoading();
    }

    showUpgrade() {
        const content = document.getElementById('screen-content');
        if (!content) return;

        const UPGRADE_COSTS = {
            1: 500, 2: 1000, 3: 2000, 4: 5000
        };
        
        const CAPACITY_LEVELS = {
            1: 10000, 2: 25000, 3: 50000, 4: 100000, 5: 250000
        };

        const currentLevel = this.walletData.wallet_level;
        const upgradeCost = UPGRADE_COSTS[currentLevel];
        const newCapacity = CAPACITY_LEVELS[currentLevel + 1];

        if (currentLevel >= 5) {
            content.innerHTML = `
                <div class="bank-transaction">
                    <button class="transaction-back" id="back-to-menu">← Back</button>
                    <h3>⬆️ Upgrade Wallet</h3>
                    <div class="upgrade-maxed">
                        <p>🎉 Your wallet is already at maximum level!</p>
                        <p>Level ${currentLevel} - Capacity: ${this.formatNumber(this.walletData.wallet_max_capacity)}</p>
                    </div>
                </div>
            `;
            document.getElementById('back-to-menu').addEventListener('click', () => this.renderMainMenu());
            return;
        }

        content.innerHTML = `
            <div class="bank-transaction">
                <button class="transaction-back" id="back-to-menu">← Back</button>
                
                <h3>⬆️ Upgrade Wallet</h3>
                
                <div class="upgrade-info-box">
                    <div class="upgrade-current">
                        <p class="upgrade-label">Current Level</p>
                        <p class="upgrade-value">Level ${currentLevel}</p>
                        <p class="upgrade-capacity">Capacity: ${this.formatNumber(this.walletData.wallet_max_capacity)}</p>
                    </div>
                    
                    <div class="upgrade-arrow">→</div>
                    
                    <div class="upgrade-next">
                        <p class="upgrade-label">Next Level</p>
                        <p class="upgrade-value">Level ${currentLevel + 1}</p>
                        <p class="upgrade-capacity">Capacity: ${this.formatNumber(newCapacity)}</p>
                    </div>
                </div>

                <div class="transaction-info">
                    <div class="info-row">
                        <span>Wallet Balance:</span>
                        <span class="info-value">${this.formatNumber(this.walletData.wallet_balance)}</span>
                    </div>
                    <div class="info-row ${this.walletData.wallet_balance < upgradeCost ? 'warning' : ''}">
                        <span>Upgrade Cost:</span>
                        <span class="info-value">${this.formatNumber(upgradeCost)}</span>
                    </div>
                </div>

                <button class="transaction-submit ${this.walletData.wallet_balance < upgradeCost ? 'disabled' : ''}" 
                        id="upgrade-submit-btn"
                        ${this.walletData.wallet_balance < upgradeCost ? 'disabled' : ''}>
                    ${this.walletData.wallet_balance < upgradeCost ? 'Insufficient Balance' : 'Upgrade Now'}
                </button>
            </div>
        `;

        document.getElementById('back-to-menu').addEventListener('click', () => this.renderMainMenu());
        
        const upgradeBtn = document.getElementById('upgrade-submit-btn');
        if (upgradeBtn && !upgradeBtn.disabled) {
            upgradeBtn.addEventListener('click', () => this.executeUpgrade());
        }
    }

    async executeUpgrade() {
        const confirmed = await this.showConfirmation(
            'Upgrade Wallet?',
            'The upgrade cost will be deducted from your wallet balance.\n\nDo you want to proceed?',
            '⬆️'
        );
        
        if (!confirmed) return;

        this.showLoading('Upgrading wallet...');

        try {
            const response = await fetch(`/api/wallet/upgrade?uid=${this.urlParams.uid}&token=${this.urlParams.token}`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('success', 'Success', result.message);
                await this.loadAllData();
                this.renderMainMenu();
            } else {
                this.showNotification('error', 'Failed', result.message);
            }
        } catch (error) {
            console.error('[BANK] Upgrade error:', error);
            this.showNotification('error', 'Error', 'Upgrade failed');
        }

        this.hideLoading();
    }

    goHome() {
        console.log('[BANK] Returning to game...');
        this.showLoading('Returning to game...');
        
        setTimeout(() => {
            const gameUrl = `/game?uid=${this.urlParams.uid}&token=${this.urlParams.token}`;
            window.location.href = gameUrl;
        }, 500);
    }

    async showConfirmation(title, message, icon = '❓') {
        let modal = document.getElementById('bank-confirm-modal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'bank-confirm-modal';
            modal.className = 'bank-confirm-modal';
            modal.innerHTML = `
                <div class="bank-confirm-content">
                    <div class="bank-confirm-icon" id="bank-confirm-icon">❓</div>
                    <h3 class="bank-confirm-title" id="bank-confirm-title">Confirm</h3>
                    <p class="bank-confirm-message" id="bank-confirm-message">Are you sure?</p>
                    <div class="bank-confirm-buttons">
                        <button class="bank-confirm-btn cancel" id="bank-confirm-cancel">Cancel</button>
                        <button class="bank-confirm-btn ok" id="bank-confirm-ok">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        return new Promise((resolve) => {
            document.getElementById('bank-confirm-icon').textContent = icon;
            document.getElementById('bank-confirm-title').textContent = title;
            document.getElementById('bank-confirm-message').textContent = message;
            
            const okBtn = document.getElementById('bank-confirm-ok');
            const cancelBtn = document.getElementById('bank-confirm-cancel');
            
            modal.style.display = 'flex';

            const handleOk = () => {
                modal.style.display = 'none';
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                modal.style.display = 'none';
                cleanup();
                resolve(false);
            };

            const cleanup = () => {
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
            };

            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
        });
    }

    showNotification(type, title, message) {
        const notification = document.createElement('div');
        notification.className = `bank-notification ${type}`;
        notification.innerHTML = `
            <div class="bank-notif-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</div>
            <div class="bank-notif-content">
                <div class="bank-notif-title">${title}</div>
                <div class="bank-notif-message">${message}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    updateTime() {
        const timeEl = document.getElementById('screen-time');
        if (timeEl) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            timeEl.textContent = `${hours}:${minutes}:${seconds}`;
        }
    }

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    showScreen(screenId) {
        document.querySelectorAll('.bank-screen').forEach(screen => {
            screen.classList.remove('active');
            screen.classList.add('d-none');
        });

        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.remove('d-none');
            screen.classList.add('active');
        }
    }

    showError(message) {
        this.showScreen('bank-error');
        const errorMsg = document.getElementById('error-message');
        if (errorMsg) {
            errorMsg.textContent = message;
        }
    }

    showLoading(message = 'Processing...') {
        const loading = document.getElementById('bank-loading');
        if (loading) {
            loading.querySelector('h3').textContent = message;
            loading.classList.remove('d-none');
            loading.style.display = 'flex';
        }
    }

    hideLoading() {
        const loading = document.getElementById('bank-loading');
        if (loading) {
            loading.classList.add('d-none');
            loading.style.display = 'none';
        }
    }
}

let bankInstance;
document.addEventListener('DOMContentLoaded', () => {
    bankInstance = new BankInterface();
    window.bankInstance = bankInstance;
});