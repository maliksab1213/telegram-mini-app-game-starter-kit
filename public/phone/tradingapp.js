// Trading App Frontend - RECREATED WITH FIXES
class TradingApp {
    constructor(phoneInterface) {
        this.phone = phoneInterface;
        this.config = null;
        this.wallet = null;
        this.positions = [];
        this.currentAsset = null;
        this.currentView = 'chart';
        this.updateInterval = null;
        this.chartData = [];
    }

    async open() {
        console.log('[TRADING] Opening trading app...');
        await this.loadData();
        this.render();
        this.startAutoUpdate();
    }

    async loadData() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            // Load fresh data from API (no cache)
            const response = await fetch(`/api/trading/config?uid=${uid}&token=${token}&t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.config = data;
                this.wallet = data.wallet;
                this.positions = data.positions || [];
                
                // Keep current asset if set, otherwise use first
                if (!this.currentAsset && data.assets && data.assets.length > 0) {
                    this.currentAsset = data.assets[0];
                } else if (this.currentAsset) {
                    // Update current asset with latest data
                    this.currentAsset = data.assets.find(a => a.id === this.currentAsset.id) || data.assets[0];
                }
                
                console.log('[TRADING] ✅ Fresh data loaded at', new Date().toLocaleTimeString());
            } else {
                throw new Error('Failed to load trading data');
            }
        } catch (error) {
            console.error('[TRADING] Error loading:', error);
            this.config = { enabled: false };
        }
    }

    render() {
        const content = this.phone.getAppContent();
        if (!content) return;

        if (!this.config.enabled) {
            content.innerHTML = this.renderMaintenance();
        } else if (this.currentView === 'chart') {
            content.innerHTML = this.renderChart();
        } else if (this.currentView === 'tradingWallet') {
            content.innerHTML = this.renderTradingWallet();
        } else if (this.currentView === 'allPositions') {
            content.innerHTML = this.renderAllPositions();
        }

        this.setupEventListeners();
    }

    renderMaintenance() {
        return `
            <div class="trading-maintenance">
                <button class="trading-back-btn" id="trading-back-btn">← Back</button>
                
                <div class="maintenance-content">
                    <div class="maintenance-icon">🛠️</div>
                    <h2>Under Maintenance</h2>
                    <p>Trading system is currently under maintenance. Please check back later.</p>
                    
                    <div class="trading-wallet-info">
                        <h3>💰 Your Trading Wallet</h3>
                        <div class="wallet-balance">${this.formatNumber(this.wallet.balance)}</div>
                        <div class="wallet-actions-mini">
                            <button class="wallet-mini-btn" id="deposit-mini-btn">Deposit</button>
                            <button class="wallet-mini-btn" id="withdraw-mini-btn">Withdraw</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderChart() {
        if (!this.currentAsset) {
            return '<div class="trading-error">No trading data available</div>';
        }

        const currentPrice = parseFloat(this.currentAsset.currentPosition);
        const previousPrice = parseFloat(this.currentAsset.previousPosition);
        const change = currentPrice - previousPrice;
        const changePercent = ((change / previousPrice) * 100).toFixed(2);
        const isPositive = change >= 0;

        // Get user position for this asset
        const userPosition = this.positions.find(p => 
            p.asset_id === this.currentAsset.id && p.status === 'active'
        );

        return `
            <div class="trading-chart-view">
                <!-- Header -->
                <div class="trading-header">
                    <button class="trading-back-btn" id="trading-back-btn">← Back</button>
                    <button class="trading-menu-btn" id="trading-menu-btn">☰</button>
                </div>

                <!-- Asset Info -->
                <div class="trading-info-card">
                    <div class="asset-name">${this.currentAsset.name}</div>
                    <div class="asset-price">${this.formatNumber(currentPrice)}</div>
                    <div class="asset-change ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '▲' : '▼'} ${Math.abs(changePercent)}%
                        <span class="change-value">(${isPositive ? '+' : ''}${this.formatNumber(change)})</span>
                    </div>
                </div>

                <!-- Chart Area -->
                <div class="trading-chart">
                    <canvas id="trading-canvas" width="300" height="180"></canvas>
                </div>

                ${userPosition ? `
                    <!-- User Position Indicator -->
                    <div class="position-indicator">
                        <div class="position-badge">
                            <div class="badge-row">
                                <span class="badge-label">Your Position</span>
                                <span class="badge-entry">Entry: ${this.formatNumber(userPosition.entry_price)}</span>
                            </div>
                            <div class="badge-row">
                                <span class="badge-amount">Invested: ${this.formatNumber(userPosition.invested_amount)}</span>
                            </div>
                            ${this.calculatePositionDisplay(userPosition, currentPrice)}
                        </div>
                    </div>
                ` : ''}

                <!-- Buy Amount Input -->
                <div class="buy-amount-section">
                    <label class="amount-label">Buy Amount (Balance: ${this.formatNumber(this.wallet.balance)})</label>
                    <div class="amount-input-group">
                        <button class="amount-btn" id="decrease-amount">-</button>
                        <input type="number" 
                               id="buy-amount-input" 
                               class="amount-input" 
                               value="100" 
                               min="10" 
                               max="${this.wallet.balance}"
                               step="10">
                        <button class="amount-btn" id="increase-amount">+</button>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="trading-actions">
                    <button class="trading-action-btn buy-btn" id="buy-asset-btn">
                        📈 Buy Asset
                    </button>
                    ${userPosition ? `
                        <button class="trading-action-btn sell-btn" id="sell-position-btn" data-position-id="${userPosition.id}">
                            📉 Sell Position
                        </button>
                    ` : ''}
                </div>

                <!-- Bottom Navigation -->
                <div class="trading-bottom-nav">
                    <button class="nav-tab active" data-view="chart">📊</button>
                    <button class="nav-tab" data-view="allPositions">📋</button>
                    <button class="nav-tab" data-view="tradingWallet">💰</button>
                </div>
            </div>

            <!-- Asset Menu Sidebar -->
            <div class="trading-menu-sidebar" id="trading-menu-sidebar">
                <div class="sidebar-header">
                    <h3>Assets</h3>
                    <button class="sidebar-close" id="sidebar-close">✕</button>
                </div>
                <div class="sidebar-assets">
                    ${this.config.assets.map(asset => {
                        const price = parseFloat(asset.currentPosition);
                        const prevPrice = parseFloat(asset.previousPosition);
                        const chg = ((price - prevPrice) / prevPrice * 100).toFixed(2);
                        const pos = chg >= 0;
                        
                        return `
                            <div class="sidebar-asset-item ${asset.id === this.currentAsset.id ? 'active' : ''}" 
                                 data-asset-id="${asset.id}">
                                <div class="sidebar-asset-name">${asset.name}</div>
                                <div class="sidebar-asset-price">${this.formatNumber(price)}</div>
                                <div class="sidebar-asset-change ${pos ? 'positive' : 'negative'}">
                                    ${pos ? '▲' : '▼'} ${Math.abs(chg)}%
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    renderTradingWallet() {
        return `
            <div class="trading-wallet-view">
                <button class="trading-back-btn" id="wallet-back-btn">← Back to Chart</button>
                
                <div class="wallet-header">
                    <h2>💰 Trading Wallet</h2>
                </div>

                <div class="wallet-balance-card">
                    <div class="balance-label">Available Balance</div>
                    <div class="balance-amount">${this.formatNumber(this.wallet.balance)}</div>
                </div>

                <div class="wallet-stats">
                    <div class="stat-item">
                        <div class="stat-label">Total Invested</div>
                        <div class="stat-value">${this.formatNumber(this.wallet.total_invested || 0)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Total Profit</div>
                        <div class="stat-value positive">+${this.formatNumber(this.wallet.total_profit || 0)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Total Loss</div>
                        <div class="stat-value negative">-${this.formatNumber(this.wallet.total_loss || 0)}</div>
                    </div>
                </div>

                <div class="wallet-actions-full">
                    <button class="wallet-action-btn deposit" id="deposit-btn">
                        💵 Deposit
                    </button>
                    <button class="wallet-action-btn withdraw" id="withdraw-btn">
                        💸 Withdraw
                    </button>
                </div>

                <div class="wallet-note">
                    ℹ️ 1% fee applies on both deposit and withdraw
                </div>

                <!-- Bottom Navigation -->
                <div class="trading-bottom-nav">
                    <button class="nav-tab" data-view="chart">📊</button>
                    <button class="nav-tab" data-view="allPositions">📋</button>
                    <button class="nav-tab active" data-view="tradingWallet">💰</button>
                </div>
            </div>
        `;
    }

    renderAllPositions() {
        const activePositions = this.positions.filter(p => p.status === 'active');
        
        return `
            <div class="all-positions-view">
                <button class="trading-back-btn" id="positions-back-btn">← Back to Chart</button>
                
                <div class="positions-header">
                    <h2>📋 Your Positions</h2>
                    <p class="positions-count">${activePositions.length} Active Positions</p>
                </div>

                <div class="positions-list">
                    ${activePositions.length === 0 ? `
                        <div class="no-positions">
                            <div class="empty-icon">📊</div>
                            <p>No active positions</p>
                            <p class="empty-hint">Buy assets to start trading!</p>
                        </div>
                    ` : activePositions.map(position => {
                        const currentAsset = this.config.assets.find(a => a.id === position.asset_id);
                        const currentPrice = currentAsset ? parseFloat(currentAsset.currentPosition) : position.entry_price;
                        const entryPrice = position.entry_price;
                        const investedAmount = position.invested_amount;
                        
                        // Calculate P/L
                        const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;
                        const pl = Math.floor((investedAmount * priceChangePercent) / 100);
                        const currentValue = investedAmount + pl;
                        const plPercent = ((pl / investedAmount) * 100).toFixed(2);
                        const isProfit = pl >= 0;

                        return `
                            <div class="position-card">
                                <div class="position-header">
                                    <div class="position-asset-name">${position.asset_name}</div>
                                    <button class="position-sell-btn" data-position-id="${position.id}">
                                        Sell
                                    </button>
                                </div>
                                <div class="position-details">
                                    <div class="detail-row">
                                        <span>Entry Price:</span>
                                        <span>${this.formatNumber(entryPrice)}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span>Invested:</span>
                                        <span>${this.formatNumber(investedAmount)}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span>Current Price:</span>
                                        <span>${this.formatNumber(currentPrice)}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span>Current Value:</span>
                                        <span class="${isProfit ? 'positive' : 'negative'}">${this.formatNumber(currentValue)}</span>
                                    </div>
                                    <div class="detail-row pl-row ${isProfit ? 'positive' : 'negative'}">
                                        <span>Profit/Loss:</span>
                                        <span>${isProfit ? '+' : ''}${this.formatNumber(pl)} (${isProfit ? '+' : ''}${plPercent}%)</span>
                                    </div>
                                    <div class="detail-row">
                                        <span>Buy Date:</span>
                                        <span>${this.formatDateTime(position.buy_date)}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span>Expires:</span>
                                        <span>${this.formatDateTime(position.expire_date)}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Bottom Navigation -->
                <div class="trading-bottom-nav">
                    <button class="nav-tab" data-view="chart">📊</button>
                    <button class="nav-tab active" data-view="allPositions">📋</button>
                    <button class="nav-tab" data-view="tradingWallet">💰</button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Back buttons
        const backBtn = document.getElementById('trading-back-btn');
        const walletBackBtn = document.getElementById('wallet-back-btn');
        const positionsBackBtn = document.getElementById('positions-back-btn');
        
        if (backBtn) backBtn.addEventListener('click', () => this.close());
        if (walletBackBtn) walletBackBtn.addEventListener('click', () => this.switchView('chart'));
        if (positionsBackBtn) positionsBackBtn.addEventListener('click', () => this.switchView('chart'));

        // Menu sidebar
        const menuBtn = document.getElementById('trading-menu-btn');
        const sidebar = document.getElementById('trading-menu-sidebar');
        const sidebarClose = document.getElementById('sidebar-close');
        
        if (menuBtn && sidebar) {
            menuBtn.addEventListener('click', () => sidebar.classList.add('open'));
        }
        if (sidebarClose && sidebar) {
            sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));
        }

        // Asset selection in sidebar
        document.querySelectorAll('.sidebar-asset-item').forEach(item => {
            item.addEventListener('click', () => {
                const assetId = item.dataset.assetId;
                this.switchAsset(assetId);
                if (sidebar) sidebar.classList.remove('open');
            });
        });

        // Amount buttons
        const decreaseBtn = document.getElementById('decrease-amount');
        const increaseBtn = document.getElementById('increase-amount');
        const amountInput = document.getElementById('buy-amount-input');
        
        if (decreaseBtn && amountInput) {
            decreaseBtn.addEventListener('click', () => {
                const current = parseInt(amountInput.value) || 0;
                amountInput.value = Math.max(10, current - 10);
            });
        }
        if (increaseBtn && amountInput) {
            increaseBtn.addEventListener('click', () => {
                const current = parseInt(amountInput.value) || 0;
                amountInput.value = Math.min(this.wallet.balance, current + 10);
            });
        }

        // Buy button
        const buyBtn = document.getElementById('buy-asset-btn');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => this.buyAsset());
        }

        // Sell buttons (chart view and all positions view)
        document.querySelectorAll('[id="sell-position-btn"], .position-sell-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const positionId = e.target.dataset.positionId;
                if (positionId) {
                    this.sellPosition(parseInt(positionId));
                }
            });
        });

        // Wallet buttons
        const depositBtn = document.getElementById('deposit-btn');
        const withdrawBtn = document.getElementById('withdraw-btn');
        const depositMiniBtn = document.getElementById('deposit-mini-btn');
        const withdrawMiniBtn = document.getElementById('withdraw-mini-btn');
        
        if (depositBtn) depositBtn.addEventListener('click', () => this.showDepositModal());
        if (withdrawBtn) withdrawBtn.addEventListener('click', () => this.showWithdrawModal());
        if (depositMiniBtn) depositMiniBtn.addEventListener('click', () => this.showDepositModal());
        if (withdrawMiniBtn) withdrawMiniBtn.addEventListener('click', () => this.showWithdrawModal());

        // Bottom navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                this.switchView(view);
            });
        });

        // Draw chart if in chart view
        if (this.currentView === 'chart') {
            setTimeout(() => this.drawChart(), 100);
        }
    }

    calculatePositionDisplay(position, currentPrice) {
        const entryPrice = position.entry_price;
        const investedAmount = position.invested_amount;
        
        // Calculate P/L
        const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        const pl = Math.floor((investedAmount * priceChangePercent) / 100);
        const currentValue = investedAmount + pl;
        const plPercent = ((pl / investedAmount) * 100).toFixed(2);
        const isProfit = pl >= 0;

        return `
            <div class="badge-row">
                <span class="badge-label">Current Value:</span>
                <span class="badge-current ${isProfit ? 'positive' : 'negative'}">${this.formatNumber(currentValue)}</span>
            </div>
            <div class="badge-row pl-row ${isProfit ? 'positive' : 'negative'}">
                <span class="badge-label">P/L:</span>
                <span>${isProfit ? '+' : ''}${this.formatNumber(pl)} (${isProfit ? '+' : ''}${plPercent}%)</span>
            </div>
        `;
    }

    switchAsset(assetId) {
        this.currentAsset = this.config.assets.find(a => a.id === assetId);
        this.render();
    }

    switchView(view) {
        this.currentView = view;
        this.render();
    }

    async buyAsset() {
        const amountInput = document.getElementById('buy-amount-input');
        const amount = parseInt(amountInput?.value) || 0;

        if (amount <= 0) {
            this.showNotification('Please enter a valid amount', 'error');
            return;
        }

        if (amount > this.wallet.balance) {
            this.showNotification('Insufficient balance. Please deposit first.', 'error');
            return;
        }

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            const response = await fetch(`/api/trading/buy?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assetId: this.currentAsset.id,
                    amount: amount
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(result.message, 'success');
                await this.loadData();
                this.render();
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('[TRADING] Buy error:', error);
            this.showNotification('Failed to buy asset', 'error');
        }
    }

    async sellPosition(positionId) {
        if (!positionId) {
            this.showNotification('No position selected', 'error');
            return;
        }

        const position = this.positions.find(p => p.id === positionId);
        if (!position) {
            this.showNotification('Position not found', 'error');
            return;
        }

        // Create confirmation modal
        const currentAsset = this.config.assets.find(a => a.id === position.asset_id);
        const currentPrice = currentAsset ? parseFloat(currentAsset.currentPosition) : position.entry_price;
        const entryPrice = position.entry_price;
        const investedAmount = position.invested_amount;
        
        const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        const pl = Math.floor((investedAmount * priceChangePercent) / 100);
        const currentValue = investedAmount + pl;
        const plPercent = ((pl / investedAmount) * 100).toFixed(2);

        const modal = document.createElement('div');
        modal.className = 'trading-modal';
        modal.innerHTML = `
            <div class="trading-modal-content">
                <h3>📉 Sell Position</h3>
                <div class="sell-details">
                    <p><strong>${position.asset_name}</strong></p>
                    <p>Entry Price: ${this.formatNumber(entryPrice)}</p>
                    <p>Current Price: ${this.formatNumber(currentPrice)}</p>
                    <p>Invested: ${this.formatNumber(investedAmount)}</p>
                    <p>Current Value: ${this.formatNumber(currentValue)}</p>
                    <p class="${pl >= 0 ? 'positive' : 'negative'}">
                        ${pl >= 0 ? 'Profit' : 'Loss'}: ${pl >= 0 ? '+' : ''}${this.formatNumber(pl)} (${pl >= 0 ? '+' : ''}${plPercent}%)
                    </p>
                </div>
                <p class="modal-note">Are you sure you want to sell this position?</p>
                <div class="modal-buttons">
                    <button class="modal-btn cancel" id="cancel-sell">Cancel</button>
                    <button class="modal-btn confirm sell" id="confirm-sell">Sell Now</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('cancel-sell').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('confirm-sell').addEventListener('click', async () => {
            modal.remove();
            await this.executeSell(positionId);
        });
    }

    async executeSell(positionId) {
        try {
            console.log('[TRADING] 🔍 Executing sell for position:', positionId);
            
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            if (!uid || !token) {
                this.showNotification('Authentication error', 'error');
                return;
            }

            if (!positionId) {
                this.showNotification('Invalid position ID', 'error');
                return;
            }

            console.log('[TRADING] 📤 Sending sell request...', { uid, positionId });

            const response = await fetch(`/api/trading/sell?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    positionId: parseInt(positionId)
                })
            });

            console.log('[TRADING] 📥 Response status:', response.status);

            let result;
            try {
                result = await response.json();
                console.log('[TRADING] 📊 Response data:', result);
            } catch (e) {
                console.error('[TRADING] ❌ Failed to parse response:', e);
                this.showNotification('Invalid server response', 'error');
                return;
            }

            if (result.success) {
                console.log('[TRADING] ✅ Sell successful');
                this.showNotification(result.message, 'success');
                
                // Reload data
                await this.loadData();
                this.render();
            } else {
                console.error('[TRADING] ❌ Sell failed:', result.message);
                this.showNotification(result.message || 'Failed to sell position', 'error');
            }
        } catch (error) {
            console.error('[TRADING] ❌ Sell error:', error);
            console.error('[TRADING] Error stack:', error.stack);
            this.showNotification('Network error: ' + error.message, 'error');
        }
    }

    showDepositModal() {
        const modal = document.createElement('div');
        modal.className = 'trading-modal';
        modal.innerHTML = `
            <div class="trading-modal-content">
                <h3>💵 Deposit to Trading Wallet</h3>
                <p class="modal-note">From Online Wallet (1% fee applies)</p>
                <div class="modal-input-group">
                    <label>Amount:</label>
                    <input type="number" id="deposit-amount" class="modal-input" value="100" min="10" step="10">
                </div>
                <div class="modal-buttons">
                    <button class="modal-btn cancel" id="cancel-deposit">Cancel</button>
                    <button class="modal-btn confirm" id="confirm-deposit">Deposit</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('cancel-deposit').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('confirm-deposit').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('deposit-amount').value);
            if (amount && amount > 0) {
                this.depositToWallet(amount);
            }
            modal.remove();
        });
    }

    showWithdrawModal() {
        const modal = document.createElement('div');
        modal.className = 'trading-modal';
        modal.innerHTML = `
            <div class="trading-modal-content">
                <h3>💸 Withdraw from Trading Wallet</h3>
                <p class="modal-note">To Online Wallet (1% fee applies)</p>
                <div class="modal-input-group">
                    <label>Amount:</label>
                    <input type="number" id="withdraw-amount" class="modal-input" value="100" min="10" step="10" max="${this.wallet.balance}">
                </div>
                <div class="modal-buttons">
                    <button class="modal-btn cancel" id="cancel-withdraw">Cancel</button>
                    <button class="modal-btn confirm" id="confirm-withdraw">Withdraw</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('cancel-withdraw').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('confirm-withdraw').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('withdraw-amount').value);
            if (amount && amount > 0) {
                this.withdrawFromWallet(amount);
            }
            modal.remove();
        });
    }

    async depositToWallet(amount) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            const response = await fetch(`/api/trading/wallet/deposit?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(result.message, 'success');
                await this.loadData();
                this.render();
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('[TRADING] Deposit error:', error);
            this.showNotification('Deposit failed', 'error');
        }
    }

    async withdrawFromWallet(amount) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            const response = await fetch(`/api/trading/wallet/withdraw?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(result.message, 'success');
                await this.loadData();
                this.render();
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('[TRADING] Withdraw error:', error);
            this.showNotification('Withdrawal failed', 'error');
        }
    }

    drawChart() {
        const canvas = document.getElementById('trading-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        // Build chart data from 5 previous values
        const currentPrice = parseFloat(this.currentAsset.currentPosition);
        const previousPrice = parseFloat(this.currentAsset.previousPosition);
        
        // Create chart with historical data
        this.chartData = [];
        
        // Add previous 5 values if available
        if (this.currentAsset.previous5) this.chartData.push(parseFloat(this.currentAsset.previous5));
        if (this.currentAsset.previous4) this.chartData.push(parseFloat(this.currentAsset.previous4));
        if (this.currentAsset.previous3) this.chartData.push(parseFloat(this.currentAsset.previous3));
        if (this.currentAsset.previous2) this.chartData.push(parseFloat(this.currentAsset.previous2));
        if (this.currentAsset.previous1) this.chartData.push(parseFloat(this.currentAsset.previous1));
        if (previousPrice) this.chartData.push(previousPrice);
        this.chartData.push(currentPrice);
        
        // If no previous data, create smooth interpolation
        if (this.chartData.length < 7) {
            const points = 20;
            this.chartData = [];
            let price = previousPrice;
            
            for (let i = 0; i < points; i++) {
                const targetDiff = currentPrice - price;
                const stepSize = targetDiff / (points - i);
                const randomness = (Math.random() - 0.5) * (price * 0.01);
                
                price += stepSize + randomness;
                this.chartData.push(price);
            }
            this.chartData[this.chartData.length - 1] = currentPrice;
        }

        const minPrice = Math.min(...this.chartData);
        const maxPrice = Math.max(...this.chartData);
        const priceRange = maxPrice - minPrice || 1;

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Chart line
        ctx.strokeStyle = currentPrice >= previousPrice ? '#4ade80' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();

        this.chartData.forEach((price, i) => {
            const x = (width / (this.chartData.length - 1)) * i;
            const y = height - ((price - minPrice) / priceRange) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Fill area under line
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, currentPrice >= previousPrice 
            ? 'rgba(74, 222, 128, 0.2)' 
            : 'rgba(239, 68, 68, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fill();

        // Entry price line for active position
        const userPosition = this.positions.find(p => 
            p.asset_id === this.currentAsset.id && p.status === 'active'
        );

        if (userPosition) {
            const entryPrice = userPosition.entry_price;
            const y = height - ((entryPrice - minPrice) / priceRange) * height;

            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(20, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    startAutoUpdate() {
        // Reload every 5 minutes (300000 ms)
        this.updateInterval = setInterval(async () => {
            console.log('[TRADING] ⏰ 5-minute reload triggered');
            const previousView = this.currentView;
            const previousAssetId = this.currentAsset?.id;
            
            await this.loadData();
            
            // Only re-render if view hasn't changed
            if (this.currentView === previousView) {
                // Keep the same asset if still in chart view
                if (previousView === 'chart' && previousAssetId) {
                    this.currentAsset = this.config.assets.find(a => a.id === previousAssetId) || this.config.assets[0];
                }
                this.render();
            }
        }, 5 * 60 * 1000); // 5 minutes
        
        console.log('[TRADING] ⏰ Auto-reload enabled (every 5 minutes)');
    }

    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    showNotification(message, type = 'info') {
        if (window.NotificationSystem) {
            window.NotificationSystem.show(message, type);
        } else {
            alert(message);
        }
    }

    formatNumber(num) {
        return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = date - now;
        const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));

        if (hours < 24 && diff > 0) {
            return `in ${hours}h`;
        }

        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    close() {
        this.stopAutoUpdate();
        this.currentView = 'chart';
        this.phone.hideAppContent();
    }
}

window.TradingApp = TradingApp;