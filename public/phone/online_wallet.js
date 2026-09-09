// Online Wallet App - With Transaction History
class OnlineWalletApp {
    constructor(phoneInterface) {
        this.phone = phoneInterface;
        this.walletData = null;
        this.transactions = [];
        this.showingTransactions = false;
    }

    async open() {
        console.log('[WALLET] Opening wallet app...');
        await this.loadWalletData();
        await this.loadTransactions();
        this.render();
    }

    async loadWalletData() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            const response = await fetch(`/api/wallet?uid=${uid}&token=${token}`);
            
            if (response.ok) {
                this.walletData = await response.json();
                console.log('[WALLET] Data loaded:', this.walletData);
            } else {
                throw new Error('Failed to load wallet');
            }
        } catch (error) {
            console.error('[WALLET] Error loading:', error);
            this.walletData = { wallet_active: false };
        }
    }

    async loadTransactions() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            const response = await fetch(`/api/transactions?uid=${uid}&token=${token}`);
            
            if (response.ok) {
                this.transactions = await response.json();
                console.log('[WALLET] Transactions loaded:', this.transactions.length);
            } else {
                this.transactions = [];
            }
        } catch (error) {
            console.error('[WALLET] Error loading transactions:', error);
            this.transactions = [];
        }
    }

    render() {
        const content = this.phone.getAppContent();
        if (!content) return;

        if (this.showingTransactions) {
            content.innerHTML = this.renderTransactions();
        } else if (!this.walletData.wallet_active) {
            content.innerHTML = this.renderInactiveWallet();
        } else {
            content.innerHTML = this.renderActiveWallet();
        }

        this.setupEventListeners();
    }

    renderInactiveWallet() {
        return `
            <div class="wallet-inactive">
                <button class="wallet-back-btn" id="wallet-back-btn">← Back</button>
                
                <div class="wallet-inactive-content">
                    <div class="wallet-icon-large">💳</div>
                    <h2>No Wallet Account</h2>
                    <p class="wallet-message">
                        You don't have an online wallet yet. 
                        Go to the bank to open your account.
                    </p>
                    
                    <div class="wallet-info-box">
                        <p><strong>💰 Opening Cost:</strong> 100 Coins</p>
                        <p><strong>📦 Starting Capacity:</strong> 10,000 Coins</p>
                    </div>
                    
                    <button class="wallet-action-btn" id="open-map-btn">
                        🗺️ Open Map & Go to Bank
                    </button>
                </div>
            </div>
        `;
    }

    renderActiveWallet() {
        const { wallet_balance, wallet_level, wallet_max_capacity } = this.walletData;
        const usagePercent = (wallet_balance / wallet_max_capacity * 100).toFixed(1);

        return `
            <div class="wallet-active">
                <button class="wallet-back-btn" id="wallet-back-btn">← Back</button>
                
                <div class="wallet-header">
                    <h2>💳 Online Wallet</h2>
                    <div class="wallet-level">Level ${wallet_level}</div>
                </div>

                <div class="wallet-balance-card">
                    <div class="balance-label">Current Balance</div>
                    <div class="balance-amount">${this.formatNumber(wallet_balance)}</div>
                    <div class="balance-capacity">
                        ${this.formatNumber(wallet_balance)} / ${this.formatNumber(wallet_max_capacity)}
                        <span class="capacity-percent">(${usagePercent}%)</span>
                    </div>
                    <div class="capacity-bar">
                        <div class="capacity-fill" style="width: ${usagePercent}%"></div>
                    </div>
                </div>

                <div class="wallet-actions">
                    <button class="wallet-btn" id="view-transactions-btn">
                        📋 Transaction History
                    </button>
                    
                    <button class="wallet-btn" id="go-to-bank-btn">
                        🏦 Go to Bank
                    </button>
                </div>

                <div class="wallet-info">
                    <p class="wallet-note">
                        💡 <strong>Note:</strong> All transactions are managed at the bank.
                        Use the map to visit the bank for deposits, withdrawals, and upgrades.
                    </p>
                </div>

                ${wallet_level < 5 ? `
                    <div class="upgrade-info">
                        <p><strong>🔓 Upgrade Available</strong></p>
                        <p>Visit the bank to upgrade your wallet capacity</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderTransactions() {
        return `
            <div class="wallet-transactions">
                <button class="wallet-back-btn" id="transactions-back-btn">← Back to Wallet</button>
                
                <div class="transactions-header">
                    <h2>📋 Transaction History</h2>
                    <p class="transactions-count">Recent ${this.transactions.length} Transactions</p>
                </div>

                <div class="transactions-list">
                    ${this.transactions.length === 0 ? `
                        <div class="no-transactions">
                            <div class="empty-icon">📭</div>
                            <p>No transactions yet</p>
                        </div>
                    ` : this.transactions.map(txn => `
                        <div class="transaction-item">
                            <div class="txn-icon">🛒</div>
                            <div class="txn-details">
                                <div class="txn-name">${txn.item_name}</div>
                                <div class="txn-id">ID: ${txn.transaction_id}</div>
                                <div class="txn-date">${this.formatDate(txn.transaction_date)}</div>
                            </div>
                            <div class="txn-amounts">
                                <div class="txn-price">-${this.formatNumber(txn.amount)} 💰</div>
                                <div class="txn-fee">Fee: ${this.formatNumber(txn.delivery_fee)} 💰</div>
                                <div class="txn-total">Total: ${this.formatNumber(txn.total_amount)} 💰</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const backBtn = document.getElementById('wallet-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.close());
        }

        const transactionsBackBtn = document.getElementById('transactions-back-btn');
        if (transactionsBackBtn) {
            transactionsBackBtn.addEventListener('click', () => {
                this.showingTransactions = false;
                this.render();
            });
        }

        const viewTransactionsBtn = document.getElementById('view-transactions-btn');
        if (viewTransactionsBtn) {
            viewTransactionsBtn.addEventListener('click', () => {
                this.showingTransactions = true;
                this.render();
            });
        }

        const openMapBtn = document.getElementById('open-map-btn');
        if (openMapBtn) {
            openMapBtn.addEventListener('click', () => this.openMap());
        }

        const goToBankBtn = document.getElementById('go-to-bank-btn');
        if (goToBankBtn) {
            goToBankBtn.addEventListener('click', () => this.openMap());
        }
    }

    openMap() {
        console.log('[WALLET] Opening map...');
        this.phone.close();
        
        setTimeout(() => {
            if (window.mapInstance) {
                window.mapInstance.open('bank');
            } else if (window.MapInterface) {
                window.mapInstance = new window.MapInterface();
                window.mapInstance.open('bank');
            }
        }, 300);
    }

    close() {
        this.showingTransactions = false;
        this.phone.hideAppContent();
    }

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

window.OnlineWalletApp = OnlineWalletApp;