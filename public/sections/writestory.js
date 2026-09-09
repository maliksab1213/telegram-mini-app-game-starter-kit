// WRITE STORY INTERFACE - FINAL FIX - NO DUPLICATE NOTIFICATIONS
class WriteStoryInterface {
    constructor() {
        this.isOpen = false;
        
        this.state = {
            coins: 0,
            totalWords: 0,
            bookWords: 0,
            bookCapacity: 50,
            inkRemaining: 0,
            wordsPerTap: 1,
            pendingWords: 0
        };
        
        this.selected = {
            pen: null,
            book: null,
            ink: null
        };
        
        this.inventory = { slots: [], maxSlots: 10 };
        
        this.syncTimer = null;
        this.SYNC_DELAY = 1500;
        this.isSyncing = false;
        this.lastSyncTime = 0;
        
        this.activeTouches = new Set();
        this.lastTapTime = 0;
        this.tapCount = 0;
        
        // 🔥 SINGLE FLAG PER NOTIFICATION TYPE
        this.hasShownNotification = {
            bookComplete: false,
            inkEmpty: false
        };
        
        this.init();
    }

    init() {
        this.createInterface();
        this.bindElements();
        this.setupEventListeners();
        console.log('[WriteStory] Initialized');
    }

    createInterface() {
        if (document.getElementById('write-story-modal')) return;

        const modalHTML = `
            <div id="write-story-modal" class="write-story-modal">
                <div class="write-header">
                    <button class="write-close-btn" id="write-close-btn">← Back</button>
                    <div class="write-coins-display">
                        <span class="write-coins-amount" id="write-coins">0</span>
                        <span>💰</span>
                    </div>
                </div>

                <div class="write-content">
                    <div class="write-supplies">
                        <div class="supply-category">
                            <div class="supply-title">🖊 Select Pen</div>
                            <div id="write-pens-container" class="supply-items">
                                <div class="no-supplies">Loading...</div>
                            </div>
                        </div>
                        
                        <div class="supply-category">
                            <div class="supply-title">📚 Select Book</div>
                            <div id="write-books-container" class="supply-items">
                                <div class="no-supplies">Loading...</div>
                            </div>
                        </div>
                        
                        <div class="supply-category">
                            <div class="supply-title">🖋️ Select Ink</div>
                            <div id="write-inks-container" class="supply-items">
                                <div class="no-supplies">Loading...</div>
                            </div>
                        </div>
                    </div>

                    <div class="write-tap-area">
                        <div class="write-status-info">
                            <div class="write-status-item" id="write-status-book">
                                <span class="write-status-label">Book</span>
                                <span class="write-status-value">0/0</span>
                            </div>
                            <div class="write-status-item" id="write-status-ink">
                                <span class="write-status-label">Ink</span>
                                <span class="write-status-value">0w</span>
                            </div>
                        </div>

                        <button id="write-tap-button" class="write-tap-button" disabled>
                            <div class="write-tap-icon">✖</div>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    bindElements() {
        this.elements = {
            modal: document.getElementById('write-story-modal'),
            closeBtn: document.getElementById('write-close-btn'),
            coinsDisplay: document.getElementById('write-coins'),
            
            pensContainer: document.getElementById('write-pens-container'),
            booksContainer: document.getElementById('write-books-container'),
            inksContainer: document.getElementById('write-inks-container'),
            
            tapButton: document.getElementById('write-tap-button'),
            statusBook: document.getElementById('write-status-book'),
            statusInk: document.getElementById('write-status-ink')
        };
    }

    setupEventListeners() {
        if (this.elements.closeBtn) {
            this.elements.closeBtn.addEventListener('click', () => this.close());
        }

        if (this.elements.tapButton) {
            this.elements.tapButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleMultiTouch(e);
            }, { passive: false });
            
            this.elements.tapButton.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handleTouchEnd(e);
            }, { passive: false });
            
            this.elements.tapButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.activeTouches.size === 0) {
                    this.handleSingleTap();
                }
            });
        }
    }

    async open() {
        if (this.isOpen) return;
        
        console.log('[WriteStory] Opening...');
        this.isOpen = true;
        
        // 🔥 RESET NOTIFICATION FLAGS ON OPEN
        this.hasShownNotification.bookComplete = false;
        this.hasShownNotification.inkEmpty = false;
        
        // Get instant coins from home
        if (window.homeInstance) {
            const homeData = window.homeInstance.getData();
            this.state.coins = homeData.coins || 0;
            this.state.totalWords = homeData.totalWords || 0;
        }
        
        if (this.elements.modal) {
            this.elements.modal.classList.add('active');
            this.elements.modal.style.display = 'flex';
            this.updateCoinsDisplay();
        }
        
        await this.loadData();
        console.log('[WriteStory] Opened');
    }

    close() {
        if (!this.isOpen) return;
        
        console.log('[WriteStory] Closing...');
        
        if (this.state.pendingWords > 0) {
            this.syncToServer();
        }
        
        if (this.elements.modal) {
            this.elements.modal.classList.remove('active');
        }
        
        this.isOpen = false;
        
        // 🔥 RESET FLAGS ON CLOSE
        this.hasShownNotification.bookComplete = false;
        this.hasShownNotification.inkEmpty = false;
        
        // Sync home coins
        if (window.homeInstance) {
            window.homeInstance.userData.coins = this.state.coins;
            window.homeInstance.userData.totalWords = this.state.totalWords;
            window.homeInstance.updateUI();
        }
        
        console.log('[WriteStory] Closed');
    }

    handleMultiTouch(e) {
        // 🔥 NO NOTIFICATION ON MISSING SUPPLIES
        if (!this.canWrite()) {
            return;
        }

        for (let i = 0; i < e.touches.length; i++) {
            this.activeTouches.add(e.touches[i].identifier);
        }

        const touchCount = this.activeTouches.size;
        this.processTaps(touchCount);
        this.animateTapButton();
    }

    handleTouchEnd(e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            this.activeTouches.delete(e.changedTouches[i].identifier);
        }
    }

    handleSingleTap() {
        // 🔥 NO NOTIFICATION ON MISSING SUPPLIES
        if (!this.canWrite()) {
            return;
        }

        this.processTaps(1);
        this.animateTapButton();
    }

    processTaps(tapCount) {
        const wordsPerTap = this.state.wordsPerTap;
        const totalWords = tapCount * wordsPerTap;
        
        const spaceInBook = this.state.bookCapacity - this.state.bookWords;
        const actualWords = Math.min(totalWords, spaceInBook, this.state.inkRemaining);
        
        if (actualWords <= 0) {
            this.updateTapButtonState();
            return;
        }

        // Instant UI update
        this.state.coins += actualWords;
        this.state.totalWords += actualWords;
        this.state.bookWords += actualWords;
        this.state.inkRemaining -= actualWords;
        this.state.pendingWords += actualWords;
        
        this.updateCoinsDisplay();
        this.updateStatusDisplays();
        
        const bookCompleted = this.state.bookWords >= this.state.bookCapacity;
        const inkEmpty = this.state.inkRemaining <= 0;
        
        // 🔥 ONLY ONE NOTIFICATION - HIGHEST PRIORITY
        if (bookCompleted || inkEmpty) {
            this.updateTapButtonState();
            
            // Priority 1: Book Complete (only once per session)
            if (bookCompleted && !this.hasShownNotification.bookComplete) {
                this.showNotification('success', 'Book Complete!', 'Sell it in shop to earn coins!', 3000);
                this.hasShownNotification.bookComplete = true;
            }
            // Priority 2: Ink Empty (only if book NOT complete, only once)
            else if (inkEmpty && !bookCompleted && !this.hasShownNotification.inkEmpty) {
                this.showNotification('warning', 'Ink Empty', 'Buy more ink from shop!', 2500);
                this.hasShownNotification.inkEmpty = true;
            }
            
            this.scheduleSyncNow();
        } else {
            this.scheduleSync();
        }
        
        this.tapCount++;
        this.lastTapTime = Date.now();
    }

    scheduleSync() {
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        
        this.syncTimer = setTimeout(() => {
            this.syncToServer();
        }, this.SYNC_DELAY);
    }

    scheduleSyncNow() {
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        this.syncToServer();
    }

    async syncToServer() {
        if (this.isSyncing || this.state.pendingWords === 0) return;
        
        this.isSyncing = true;
        const wordsToSync = this.state.pendingWords;
        
        console.log(`[WriteStory] ⬆️ Syncing ${wordsToSync} words...`);
        
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            if (!uid || !token) {
                console.warn('[WriteStory] No credentials');
                this.isSyncing = false;
                return;
            }

            const response = await fetch(`/api/user/write?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordsToWrite: wordsToSync }),
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const result = await response.json();
                
                this.state.pendingWords = 0;
                this.state.coins = result.coins;
                this.state.totalWords = result.totalWords;
                this.updateCoinsDisplay();
                
                if (result.bookCompleted || result.inkEmpty) {
                    await this.refreshData();
                }
                
                console.log(`[WriteStory] ✅ Synced ${wordsToSync} words`);
                this.lastSyncTime = Date.now();
            }
        } catch (error) {
            console.error('[WriteStory] Sync error:', error);
        }
        
        this.isSyncing = false;
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadUserCoins(),
                this.loadInventory(),
                this.loadSelectedItems()
            ]);
            
            this.updateUI();
            console.log('[WriteStory] ✅ Data loaded');
            
        } catch (error) {
            console.error('[WriteStory] Load error:', error);
            this.setupFallbackData();
        }
    }

    async loadUserCoins() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) return;
            
            const response = await fetch(`/api/user/coins?uid=${uid}&token=${token}`);
            if (response.ok) {
                const data = await response.json();
                this.state.coins = data.coins || 0;
                this.state.totalWords = data.total_words || 0;
            }
        } catch (error) {
            console.error('[WriteStory] Error loading coins:', error);
        }
    }

    async loadInventory() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) return;
            
            const response = await fetch(`/api/inventory?uid=${uid}&token=${token}`);
            if (response.ok) {
                this.inventory = await response.json();
            }
        } catch (error) {
            console.error('[WriteStory] Error loading inventory:', error);
        }
    }

    async loadSelectedItems() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) return;
            
            const response = await fetch(`/api/user/selected?uid=${uid}&token=${token}`);
            if (response.ok) {
                const selected = await response.json();
                
                if (selected.pen) {
                    this.selected.pen = this.findItemById(selected.pen);
                    if (this.selected.pen) {
                        this.state.wordsPerTap = this.selected.pen.wordsPerTap || 1;
                    }
                }
                
                if (selected.book) {
                    this.selected.book = this.findItemById(selected.book);
                    if (this.selected.book) {
                        this.state.bookCapacity = this.selected.book.capacity || 50;
                        this.state.bookWords = selected.bookWords || 0;
                    }
                }
                
                if (selected.ink) {
                    this.selected.ink = this.findItemById(selected.ink);
                    if (this.selected.ink) {
                        this.state.inkRemaining = selected.inkRemaining || 0;
                    }
                }
            }
        } catch (error) {
            console.error('[WriteStory] Error loading selected:', error);
        }
    }

    findItemById(itemId) {
        if (!this.inventory.slots || !itemId) return null;
        return this.inventory.slots.find(slot => slot && slot.id === itemId) || null;
    }

    setupFallbackData() {
        this.state.coins = 0;
        this.state.totalWords = 0;
        this.updateUI();
    }

    updateUI() {
        this.displaySupplies();
        this.updateStatusDisplays();
        this.updateTapButtonState();
        this.updateCoinsDisplay();
    }

    displaySupplies() {
        this.displayPens();
        this.displayBooks();
        this.displayInks();
    }

    displayPens() {
        if (!this.elements.pensContainer) return;

        const pens = this.inventory.slots.filter(slot => slot && slot.type === 'pen');
        
        if (pens.length === 0) {
            this.elements.pensContainer.innerHTML = '<div class="no-supplies">No pens. Buy from shop!</div>';
            return;
        }

        this.elements.pensContainer.innerHTML = pens.map(pen => `
            <div class="supply-item ${this.selected.pen?.id === pen.id ? 'selected' : ''}" 
                 data-type="pen" data-id="${pen.id}">
                <div class="item-icon">${pen.icon}</div>
                <div class="item-name">${pen.name}</div>
                <div class="item-details">${pen.wordsPerTap || 1}w/tap</div>
            </div>
        `).join('');

        this.elements.pensContainer.querySelectorAll('.supply-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectSupply('pen', item.dataset.id);
            });
        });
    }

    displayBooks() {
        if (!this.elements.booksContainer) return;

        const books = this.inventory.slots.filter(slot => {
            if (!slot || slot.type !== 'book') return false;
            const words = slot.currentWords || 0;
            const capacity = slot.capacity || 50;
            return words < capacity;
        });
        
        if (books.length === 0) {
            this.elements.booksContainer.innerHTML = '<div class="no-supplies">No books. Buy from shop!</div>';
            return;
        }

        this.elements.booksContainer.innerHTML = books.map(book => {
            let displayWords;
            if (this.selected.book?.id === book.id) {
                displayWords = this.state.bookWords;
            } else {
                displayWords = book.currentWords || 0;
            }
            
            const capacity = book.capacity || 50;
            
            return `
                <div class="supply-item ${this.selected.book?.id === book.id ? 'selected' : ''}" 
                     data-type="book" data-id="${book.id}">
                    <div class="item-icon">${book.icon}</div>
                    <div class="item-name">${book.name}</div>
                    <div class="item-details">${displayWords}/${capacity}</div>
                </div>
            `;
        }).join('');

        this.elements.booksContainer.querySelectorAll('.supply-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectSupply('book', item.dataset.id);
            });
        });
    }

    displayInks() {
        if (!this.elements.inksContainer) return;

        const inks = this.inventory.slots.filter(slot => {
            if (!slot || slot.type !== 'ink') return false;
            return (slot.wordsRemaining || 0) > 0;
        });
        
        if (inks.length === 0) {
            this.elements.inksContainer.innerHTML = '<div class="no-supplies">No ink. Buy from shop!</div>';
            return;
        }

        this.elements.inksContainer.innerHTML = inks.map(ink => {
            let displayWords;
            if (this.selected.ink?.id === ink.id) {
                displayWords = this.state.inkRemaining;
            } else {
                displayWords = ink.wordsRemaining || 0;
            }
            
            return `
                <div class="supply-item ${this.selected.ink?.id === ink.id ? 'selected' : ''}" 
                     data-type="ink" data-id="${ink.id}">
                    <div class="item-icon">${ink.icon}</div>
                    <div class="item-name">${ink.name}</div>
                    <div class="item-details">${displayWords} left</div>
                </div>
            `;
        }).join('');

        this.elements.inksContainer.querySelectorAll('.supply-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectSupply('ink', item.dataset.id);
            });
        });
    }

    async selectSupply(type, itemId) {
        const item = this.findItemById(itemId);
        if (!item) return;

        // 🔥 NO NOTIFICATION ON SELECTION
        this.selected[type] = item;
        
        if (type === 'pen') {
            this.state.wordsPerTap = item.wordsPerTap || 1;
        }
        if (type === 'book') {
            this.state.bookWords = item.currentWords || 0;
            this.state.bookCapacity = item.capacity || 50;
            // Reset flag for new book
            this.hasShownNotification.bookComplete = false;
        }
        if (type === 'ink') {
            this.state.inkRemaining = item.wordsRemaining || 0;
            // Reset flag for new ink
            this.hasShownNotification.inkEmpty = false;
        }

        this.displaySupplies();
        this.updateStatusDisplays();
        this.updateTapButtonState();
        
        this.saveSelections();
    }

    async saveSelections() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            if (!uid || !token) return;

            const data = {
                pen: this.selected.pen?.id || null,
                book: this.selected.book?.id || null,
                ink: this.selected.ink?.id || null,
                bookWords: this.state.bookWords,
                inkRemaining: this.state.inkRemaining
            };

            await fetch(`/api/user/selected?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

        } catch (error) {
            console.error('[WriteStory] Error saving selections:', error);
        }
    }

    updateStatusDisplays() {
        if (this.elements.statusBook) {
            if (this.selected.book) {
                this.elements.statusBook.innerHTML = `
                    <span class="write-status-label">Book</span>
                    <span class="write-status-value">${this.state.bookWords}/${this.state.bookCapacity}</span>
                `;
            } else {
                this.elements.statusBook.innerHTML = `
                    <span class="write-status-label">Book</span>
                    <span class="write-status-value">None</span>
                `;
            }
        }

        if (this.elements.statusInk) {
            if (this.selected.ink) {
                this.elements.statusInk.innerHTML = `
                    <span class="write-status-label">Ink</span>
                    <span class="write-status-value">${this.state.inkRemaining}w</span>
                `;
            } else {
                this.elements.statusInk.innerHTML = `
                    <span class="write-status-label">Ink</span>
                    <span class="write-status-value">None</span>
                `;
            }
        }
    }

    updateTapButtonState() {
        if (!this.elements.tapButton) return;

        const canTap = this.canWrite();
        this.elements.tapButton.disabled = !canTap;
        
        if (canTap) {
            this.elements.tapButton.innerHTML = '<div class="write-tap-icon">✏️</div>';
        } else {
            this.elements.tapButton.innerHTML = '<div class="write-tap-icon">✖</div>';
        }
    }

    canWrite() {
        if (!this.selected.pen || !this.selected.book || !this.selected.ink) {
            return false;
        }
        if (this.state.inkRemaining <= 0) {
            return false;
        }
        if (this.state.bookWords >= this.state.bookCapacity) {
            return false;
        }
        return true;
    }

    updateCoinsDisplay() {
        const formatted = this.formatNumber(this.state.coins);
        
        if (this.elements.coinsDisplay) {
            this.elements.coinsDisplay.textContent = formatted;
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

    animateTapButton() {
        if (!this.elements.tapButton) return;
        
        this.elements.tapButton.style.transform = 'scale(0.92)';
        setTimeout(() => {
            if (this.elements.tapButton) {
                this.elements.tapButton.style.transform = 'scale(1)';
            }
        }, 100);
    }

    async refreshData() {
        await this.loadData();
    }

    showNotification(type, title, message, duration) {
        if (window.NotificationSystem && window.NotificationSystem.prototype) {
            const notifSystem = new window.NotificationSystem();
            notifSystem.show(type, title, message, duration);
        } else if (window.NotificationSystem) {
            window.NotificationSystem.show(type, title, message, duration);
        }
    }
}

window.WriteStoryInterface = WriteStoryInterface;