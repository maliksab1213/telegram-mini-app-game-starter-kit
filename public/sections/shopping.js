// ✅ FIXED: Shopping Section - WALLET ONLY, NO COINS INCREASE
class ShoppingSection {
    constructor() {
        this.isActive = false;
        this.elements = {};
        this.storeData = null;
        this.currentMode = 'buy';
        this.selectedCategory = null;
        this.currentWalletBalance = 0;
        this.isStoreLoaded = false;
        
        this.init();
        this.preloadStore();
    }

    init() {
        this.bindElements();
        this.setupEventListeners();
    }

    bindElements() {
        this.elements = {
            section: document.getElementById('shopping-section'),
            buyInterface: document.getElementById('buy-interface'),
            categoriesList: document.getElementById('categories-list'),
            itemsGrid: document.getElementById('items-grid'),
            walletDisplay: document.getElementById('shopping-coins')
        };
    }

    setupEventListeners() {
        // No sell tab - feature disabled
    }

    async preloadStore() {
        if (this.isStoreLoaded) return;
        
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            if (!uid || !token) {
                console.warn('[Shopping] No credentials for store');
                this.storeData = {};
                return;
            }

            const response = await fetch(`/api/store?uid=${uid}&token=${token}`);
            if (response.ok) {
                const store = await response.json();
                this.storeData = store.categories || {};
                this.isStoreLoaded = true;
                console.log('[Shopping] Store preloaded:', Object.keys(this.storeData).length, 'categories');
            } else {
                console.warn('[Shopping] Store API failed');
                this.storeData = {};
            }
        } catch (error) {
            console.error('[Shopping] Preload error:', error);
            this.storeData = {};
        }
    }

    async activate() {
        this.isActive = true;
        console.log('[Shopping] Activating...');
        
        // Load wallet balance instantly
        await this.loadWalletBalance();
        this.updateWalletDisplay();
        
        // Ensure store is loaded
        if (!this.isStoreLoaded) {
            await this.preloadStore();
        }
        
        // Render immediately with cached data
        this.renderInterface();
        
        console.log('[Shopping] ✅ Activated with wallet balance:', this.currentWalletBalance);
    }

    deactivate() {
        this.isActive = false;
    }

    async loadWalletBalance() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            if (!uid || !token) {
                this.currentWalletBalance = 0;
                return;
            }

            const response = await fetch(`/api/wallet?uid=${uid}&token=${token}`, {
                cache: 'no-store'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentWalletBalance = data.wallet_balance || 0;
                console.log('[Shopping] 💰 Wallet balance loaded:', this.currentWalletBalance);
            } else {
                this.currentWalletBalance = 0;
            }
        } catch (error) {
            console.error('[Shopping] Error loading wallet:', error);
            this.currentWalletBalance = 0;
        }
    }

    updateWalletDisplay() {
        if (this.elements.walletDisplay) {
            this.elements.walletDisplay.textContent = this.formatNumber(this.currentWalletBalance);
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        } else if (num >= 1000) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
        return num.toString();
    }

    renderInterface() {
        this.renderBuyInterface();
    }

    renderBuyInterface() {
        if (!this.storeData || Object.keys(this.storeData).length === 0) {
            if (this.elements.categoriesList) {
                this.elements.categoriesList.innerHTML = '<p class="text-muted text-center">Loading store...</p>';
            }
            return;
        }

        this.renderCategories();
        
        if (!this.selectedCategory) {
            const firstCategory = Object.keys(this.storeData)[0];
            this.selectedCategory = firstCategory;
        }
        
        this.renderItems();
    }

    renderCategories() {
        if (!this.elements.categoriesList || !this.storeData) return;

        const categories = Object.entries(this.storeData)
            .sort(([, a], [, b]) => (a.position || 999) - (b.position || 999));

        if (categories.length === 0) {
            this.elements.categoriesList.innerHTML = '<p class="text-muted text-center">No categories</p>';
            return;
        }

        this.elements.categoriesList.innerHTML = categories.map(([key, category]) => `
            <div class="category-item ${this.selectedCategory === key ? 'active' : ''}" 
                 data-category="${key}">
                <div class="category-icon">${category.icon || '📦'}</div>
                <div class="category-name">${category.name}</div>
            </div>
        `).join('');

        this.elements.categoriesList.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectCategory(item.dataset.category);
            });
        });
    }

    selectCategory(categoryKey) {
        this.selectedCategory = categoryKey;
        this.renderCategories();
        this.renderItems();
    }

    renderItems() {
        if (!this.elements.itemsGrid || !this.storeData || !this.selectedCategory) return;

        const category = this.storeData[this.selectedCategory];
        if (!category || !category.items || Object.keys(category.items).length === 0) {
            this.elements.itemsGrid.innerHTML = '<p class="text-muted text-center">No items available.</p>';
            return;
        }

        const items = Object.entries(category.items);
        
        this.elements.itemsGrid.innerHTML = items.map(([itemId, item]) => {
            const deliveryFee = Math.ceil(item.price * 0.02); // 2% delivery fee
            const totalPrice = item.price + deliveryFee;
            
            return `
                <div class="shop-item" data-item-id="${itemId}">
                    <div class="item-icon">${item.icon || '📦'}</div>
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-description">${item.description || ''}</div>
                        <div class="item-price">
                            <span class="price-value">${item.price}</span>
                            <span class="price-currency">💰</span>
                        </div>
                        <div class="delivery-fee">
                            + ${deliveryFee} 💰 Delivery Fee (2%)
                        </div>
                        <div class="total-price">
                            Total: <strong>${totalPrice} 💰</strong>
                        </div>
                    </div>
                    <button class="buy-btn" data-item-id="${itemId}" data-price="${item.price}" data-fee="${deliveryFee}">Buy</button>
                </div>
            `;
        }).join('');

        this.elements.itemsGrid.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemPrice = parseInt(btn.dataset.price);
                const deliveryFee = parseInt(btn.dataset.fee);
                this.purchaseItem(btn.dataset.itemId, itemPrice, deliveryFee);
            });
        });
    }

    async purchaseItem(itemId, itemPrice, deliveryFee) {
        if (!this.storeData || !this.selectedCategory) return;

        const category = this.storeData[this.selectedCategory];
        const item = category.items[itemId];
        
        if (!item) {
            this.showNotification('error', 'Not Found', 'Item not available.');
            return;
        }

        const totalPrice = itemPrice + deliveryFee;

        // Check wallet balance
        if (this.currentWalletBalance < totalPrice) {
            this.showNotification('error', 'Insufficient Funds', 
                `You need ${this.formatNumber(totalPrice)} coins in your wallet. Current balance: ${this.formatNumber(this.currentWalletBalance)}. Please deposit money to your wallet.`);
            return;
        }

        const confirmed = await this.confirmPurchase(item.name, itemPrice, deliveryFee, totalPrice);
        if (!confirmed) return;

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            if (!uid || !token) return;

            const response = await fetch(`/api/purchase/wallet?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    itemId,
                    itemPrice,
                    deliveryFee,
                    totalPrice
                })
            });

            const result = await response.json();
            
            if (result.success) {
                // ✅ FIX: Update wallet balance (decreased by purchase)
                this.currentWalletBalance = result.walletBalance;
                this.updateWalletDisplay();
                
                this.showNotification('success', 'Purchased!', 
                    `${item.name} purchased for ${this.formatNumber(totalPrice)} coins (including ${deliveryFee} delivery fee)`);
                
                // ✅ IMPORTANT: Reload wallet from server to confirm
                await this.loadWalletBalance();
                this.updateWalletDisplay();
                
                // Refresh inventory
                if (window.inventoryManagerInstance) {
                    window.inventoryManagerInstance.forceRefresh();
                }
                
                // ✅ DO NOT refresh home coins - coins should NOT change!
                console.log('[Shopping] ✅ Purchase complete - Wallet decreased, coins unchanged');
            } else {
                this.showNotification('error', 'Purchase Failed', result.message || result.error);
            }
        } catch (error) {
            console.error('[Shopping] Error purchasing item:', error);
            this.showNotification('error', 'Error', 'Failed to complete purchase');
        }
    }

    async confirmPurchase(itemName, itemPrice, deliveryFee, totalPrice) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'confirmation-modal';
            modal.innerHTML = `
                <div class="confirmation-content">
                    <h3>Confirm Purchase</h3>
                    <p><strong>${itemName}</strong></p>
                    <div class="price-breakdown">
                        <div>Item Price: ${this.formatNumber(itemPrice)} 💰</div>
                        <div>Delivery Fee (2%): ${this.formatNumber(deliveryFee)} 💰</div>
                        <div class="total-line">Total: <strong>${this.formatNumber(totalPrice)} 💰</strong></div>
                    </div>
                    <p style="color: #ffd700; font-size: 0.9rem; margin-top: 10px;">
                        Payment from wallet only. Your coins will NOT change.
                    </p>
                    <div class="confirmation-buttons">
                        <button class="btn-cancel">Cancel</button>
                        <button class="btn-confirm">Confirm</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const btnCancel = modal.querySelector('.btn-cancel');
            const btnConfirm = modal.querySelector('.btn-confirm');

            btnCancel.addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            btnConfirm.addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
        });
    }

    showNotification(type, title, message) {
        if (window.NotificationSystem) {
            window.NotificationSystem.show(type, title, message);
        } else {
            console.log(`${type.toUpperCase()}: ${title} - ${message}`);
        }
    }

    getData() {
        return {
            mode: this.currentMode,
            selectedCategory: this.selectedCategory,
            storeData: this.storeData,
            currentWalletBalance: this.currentWalletBalance
        };
    }
}

window.ShoppingSection = ShoppingSection;