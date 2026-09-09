// FIXED Inventory Manager - Database Only, No Defaults
class InventoryManager {
    constructor() {
        this.inventory = {
            level: 1,
            maxSlots: 10,
            slots: []
        };
        this.isModalOpen = false;
        this.selectedSlot = null;
        this.selectedItem = null;
        this.elements = {};
        
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setup();
            });
        } else {
            this.setup();
        }
    }

    setup() {
        this.bindElements();
        this.setupEventListeners();
        this.loadInventory();
    }

    bindElements() {
        this.elements = {
            inventoryBtn: document.getElementById('inventory-btn'),
            inventoryCount: document.getElementById('inventory-count'),
            inventoryModal: document.getElementById('inventory-modal'),
            closeInventory: document.getElementById('close-inventory'),
            inventoryLevel: document.getElementById('inventory-level'),
            inventorySlots: document.getElementById('inventory-slots'),
            inventoryGrid: document.getElementById('inventory-grid'),
            itemModal: document.getElementById('item-description-modal'),
            itemModalIcon: document.getElementById('item-modal-icon'),
            itemModalName: document.getElementById('item-modal-name'),
            itemModalDescription: document.getElementById('item-modal-description'),
            closeItemModal: document.getElementById('close-item-modal')
        };
    }

    setupEventListeners() {
        if (this.elements.inventoryBtn) {
            this.elements.inventoryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openInventory();
            });
        }

        if (this.elements.closeInventory) {
            this.elements.closeInventory.addEventListener('click', () => this.closeInventory());
        }

        if (this.elements.closeItemModal) {
            this.elements.closeItemModal.addEventListener('click', () => this.closeItemModal());
        }

        if (this.elements.inventoryModal) {
            this.elements.inventoryModal.addEventListener('click', (e) => {
                if (e.target === this.elements.inventoryModal) {
                    this.closeInventory();
                }
            });
        }

        if (this.elements.itemModal) {
            this.elements.itemModal.addEventListener('click', (e) => {
                if (e.target === this.elements.itemModal) {
                    this.closeItemModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    async loadInventory() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) {
                console.warn('[Inventory] No credentials');
                this.inventory = { level: 1, maxSlots: 10, slots: [] };
                this.updateUI();
                return;
            }
            
            const response = await fetch(`/api/inventory?uid=${uid}&token=${token}`);
            if (response.ok) {
                const serverInventory = await response.json();
                this.inventory = serverInventory;
                this.updateUI();
                this.notifyHomeSection();
                console.log('[Inventory] Loaded from database');
            } else {
                console.warn('[Inventory] Failed to load, using empty');
                this.inventory = { level: 1, maxSlots: 10, slots: [] };
                this.updateUI();
            }
        } catch (error) {
            console.error('[Inventory] Error loading:', error);
            this.inventory = { level: 1, maxSlots: 10, slots: [] };
            this.updateUI();
        }
    }

    notifyHomeSection() {
        if (window.GameManager && window.GameManager.getSectionInstance) {
            const homeSection = window.GameManager.getSectionInstance('home');
            if (homeSection && homeSection.refreshInventory) {
                homeSection.refreshInventory();
            }
        }
    }

    updateUI() {
        this.updateInventoryButton();
        this.updateInventoryInfo();
        if (this.isModalOpen) {
            this.renderInventoryGrid();
        }
    }

    updateInventoryButton() {
        if (!this.elements.inventoryCount) return;

        const occupiedSlots = this.inventory.slots.filter(slot => slot !== null).length;
        this.elements.inventoryCount.textContent = occupiedSlots;
        this.elements.inventoryCount.style.display = occupiedSlots > 0 ? 'flex' : 'none';
    }

    updateInventoryInfo() {
        if (this.elements.inventoryLevel) {
            this.elements.inventoryLevel.textContent = `Level ${this.inventory.level} Bagpack`;
        }

        if (this.elements.inventorySlots) {
            const occupiedSlots = this.inventory.slots.filter(slot => slot !== null).length;
            this.elements.inventorySlots.textContent = `${occupiedSlots}/${this.inventory.maxSlots} slots used`;
        }
    }

    renderInventoryGrid() {
        if (!this.elements.inventoryGrid) return;

        this.elements.inventoryGrid.innerHTML = '';

        while (this.inventory.slots.length < this.inventory.maxSlots) {
            this.inventory.slots.push(null);
        }

        for (let i = 0; i < this.inventory.maxSlots; i++) {
            const slot = this.inventory.slots[i];
            const slotElement = document.createElement('div');
            slotElement.className = `inventory-slot ${slot ? 'occupied' : 'empty'}`;
            
            if (slot) {
                slotElement.innerHTML = `
                    <div class="slot-icon">${slot.icon || '📦'}</div>
                    <div class="slot-name">${slot.name || 'Unknown'}</div>
                `;
                slotElement.addEventListener('click', () => this.showItemDetails(slot, i));
            } else {
                slotElement.innerHTML = `
                    <div class="slot-icon" style="opacity: 0.3;">📦</div>
                    <div class="slot-name">Empty</div>
                `;
            }
            
            this.elements.inventoryGrid.appendChild(slotElement);
        }
    }

    showItemDetails(item, slotIndex) {
        if (!item) return;

        this.selectedSlot = slotIndex;
        this.selectedItem = item;
        
        if (this.elements.itemModalIcon) {
            this.elements.itemModalIcon.textContent = item.icon || '📦';
        }
        
        if (this.elements.itemModalName) {
            this.elements.itemModalName.textContent = item.name || 'Unknown Item';
        }
        
        if (this.elements.itemModalDescription) {
            let description = item.description || 'No description available.';
            
            if (item.type === 'book') {
                description += `\n\nCapacity: ${item.capacity || 50} words`;
                if (item.currentWords !== undefined) {
                    description += `\nCurrent: ${item.currentWords} words written`;
                    if (item.currentWords >= item.capacity) {
                        description += '\n✅ This book is completed and ready to sell!';
                    }
                }
            }
            
            if (item.type === 'ink') {
                description += `\n\nInk capacity: ${item.wordCapacity || 30} words`;
                if (item.wordsRemaining !== undefined) {
                    description += `\nRemaining: ${item.wordsRemaining} words`;
                }
            }

            if (item.type === 'bagpack') {
                description += `\n\nUpgrades inventory to ${item.slots || 20} slots`;
            }
            
            if (item.quality) {
                description += `\n\nQuality: ${item.quality}`;
            }
            
            this.elements.itemModalDescription.textContent = description;
        }

        this.createActionButtons();
        this.openItemModal();
    }

    createActionButtons() {
        const actionsDiv = document.querySelector('.item-modal-actions');
        if (!actionsDiv || !this.selectedItem) return;

        const canUse = this.canUseItem(this.selectedItem);
        
        actionsDiv.innerHTML = `
            ${canUse ? `<button id="use-item-btn" class="btn use-btn">
                ${this.getUseButtonText(this.selectedItem)}
            </button>` : ''}
            <button id="discard-item-btn" class="btn discard-btn">Discard</button>
            <button id="close-item-modal-2" class="btn btn-secondary">Close</button>
        `;

        const useBtn = actionsDiv.querySelector('#use-item-btn');
        const discardBtn = actionsDiv.querySelector('#discard-item-btn');
        const closeBtn = actionsDiv.querySelector('#close-item-modal-2');

        if (useBtn) {
            useBtn.addEventListener('click', () => this.useSelectedItem());
        }

        if (discardBtn) {
            discardBtn.addEventListener('click', () => this.showDiscardConfirmation());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeItemModal());
        }
    }

    canUseItem(item) {
        if (!item || !item.type) return false;
        const usableTypes = ['pen', 'book', 'ink', 'bagpack'];
        return usableTypes.includes(item.type);
    }

    getUseButtonText(item) {
        switch (item.type) {
            case 'pen': return 'Select Pen';
            case 'book': return 'Select Book';
            case 'ink': return 'Select Ink';
            case 'bagpack': return 'Use Bagpack';
            default: return 'Use Item';
        }
    }

    async useSelectedItem() {
        if (this.selectedSlot === null || !this.selectedItem) return;
        
        try {
            switch (this.selectedItem.type) {
                case 'bagpack':
                    await this.upgradeBagpack(this.selectedItem, this.selectedSlot);
                    break;
                case 'pen':
                case 'book':
                case 'ink':
                    this.showNotification('success', 'Item Selected', `You selected ${this.selectedItem.name} for writing`);
                    break;
                default:
                    this.showNotification('info', 'Item Used', `You used ${this.selectedItem.name}`);
                    break;
            }
            
            this.closeItemModal();
        } catch (error) {
            console.error('[Inventory] Error using item:', error);
            this.showNotification('error', 'Error', 'Failed to use item');
        }
    }

    async upgradeBagpack(bagpack, slotIndex) {
        const newSlots = bagpack.slots || 20;
        const oldMaxSlots = this.inventory.maxSlots;
        
        if (newSlots > oldMaxSlots) {
            this.inventory.maxSlots = newSlots;
            this.inventory.level++;
            
            while (this.inventory.slots.length < this.inventory.maxSlots) {
                this.inventory.slots.push(null);
            }
            
            this.inventory.slots[slotIndex] = null;
            
            await this.saveInventoryToServer();
            this.updateUI();
            this.notifyHomeSection();
            
            this.showNotification('success', 'Inventory Upgraded!', 
                `Your bagpack now has ${this.inventory.maxSlots} slots!`);
        } else {
            this.showNotification('warning', 'No Upgrade Needed', 
                'This bagpack doesn\'t increase your inventory size.');
        }
    }

    async showDiscardConfirmation() {
        if (!this.selectedItem) return;

        const confirmed = await window.ConfirmationModal.confirmDiscard(this.selectedItem.name);
        
        if (confirmed) {
            await this.discardSelectedItem();
        }
    }

    async discardSelectedItem() {
        if (this.selectedSlot === null || !this.selectedItem) return;

        try {
            const itemName = this.selectedItem.name;
            const itemId = this.selectedItem.id;
            
            this.inventory.slots[this.selectedSlot] = null;
            
            const saveResult = await this.saveInventoryToServer();
            
            if (!saveResult) {
                this.showNotification('error', 'Failed', 'Could not discard item');
                await this.loadInventory();
                return;
            }
            
            await this.clearFromSelected(itemId);
            
            this.updateUI();
            this.notifyHomeSection();
            
            this.showNotification('info', 'Item Discarded', `${itemName} has been discarded`);
            this.closeItemModal();
            
        } catch (error) {
            console.error('[Inventory] Error discarding item:', error);
            this.showNotification('error', 'Error', 'Failed to discard item');
        }
    }

    async saveInventoryToServer() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) {
                console.warn('[Inventory] No credentials, cannot save to server');
                return false;
            }
            
            const response = await fetch(`/api/inventory?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.inventory),
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                console.log('[Inventory] ✅ Saved to server');
                return true;
            } else {
                console.error('[Inventory] ❌ Save failed');
                return false;
            }
            
        } catch (error) {
            console.error('[Inventory] Save error:', error);
            return false;
        }
    }

    async clearFromSelected(itemId) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) return;
            
            const selectedResponse = await fetch(`/api/user/selected?uid=${uid}&token=${token}`);
            if (!selectedResponse.ok) return;
            
            const selected = await selectedResponse.json();
            
            let needsUpdate = false;
            const updates = {};
            
            if (selected.pen === itemId) {
                updates.pen = null;
                needsUpdate = true;
            }
            if (selected.book === itemId) {
                updates.book = null;
                updates.bookWords = 0;
                needsUpdate = true;
            }
            if (selected.ink === itemId) {
                updates.ink = null;
                updates.inkRemaining = 0;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await fetch(`/api/user/selected?uid=${uid}&token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pen: updates.pen !== undefined ? updates.pen : selected.pen,
                        book: updates.book !== undefined ? updates.book : selected.book,
                        ink: updates.ink !== undefined ? updates.ink : selected.ink,
                        bookWords: updates.bookWords !== undefined ? updates.bookWords : selected.bookWords,
                        inkRemaining: updates.inkRemaining !== undefined ? updates.inkRemaining : selected.inkRemaining
                    })
                });
                
                console.log('[Inventory] ✅ Cleared from selected items');
            }
            
        } catch (error) {
            console.error('[Inventory] Error clearing selected:', error);
        }
    }

    async addItem(item) {
        try {
            const emptySlotIndex = this.inventory.slots.findIndex(slot => slot === null);
            
            if (emptySlotIndex === -1) {
                return { 
                    success: false, 
                    message: 'Inventory is full! Upgrade your bagpack or discard some items first.' 
                };
            }
            
            if (!item.id) {
                item.id = `${item.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
            
            this.inventory.slots[emptySlotIndex] = item;
            
            await this.saveInventoryToServer();
            this.updateUI();
            this.notifyHomeSection();
            
            return { 
                success: true, 
                slot: emptySlotIndex,
                message: `${item.name} added to your inventory!`
            };
        } catch (error) {
            console.error('[Inventory] Error adding item:', error);
            return { 
                success: false, 
                message: 'Failed to add item to inventory' 
            };
        }
    }

    openInventory() {
        if (this.elements.inventoryModal) {
            this.elements.inventoryModal.classList.remove('d-none');
            this.isModalOpen = true;
            this.renderInventoryGrid();
        }
    }

    closeInventory() {
        if (this.elements.inventoryModal) {
            this.elements.inventoryModal.classList.add('d-none');
            this.isModalOpen = false;
        }
    }

    openItemModal() {
        if (this.elements.itemModal) {
            this.elements.itemModal.classList.remove('d-none');
        }
    }

    closeItemModal() {
        if (this.elements.itemModal) {
            this.elements.itemModal.classList.add('d-none');
        }
        this.selectedSlot = null;
        this.selectedItem = null;
    }

    closeAllModals() {
        this.closeInventory();
        this.closeItemModal();
    }

    showNotification(type, title, message) {
        if (window.NotificationSystem) {
            window.NotificationSystem.show(type, title, message);
        } else {
            console.log(`${type.toUpperCase()}: ${title} - ${message}`);
        }
    }

    getInventoryData() {
        return JSON.parse(JSON.stringify(this.inventory));
    }

    hasItem(itemId) {
        return this.inventory.slots.some(slot => slot && slot.id === itemId);
    }

    isFull() {
        const occupiedSlots = this.inventory.slots.filter(slot => slot !== null).length;
        return occupiedSlots >= this.inventory.maxSlots;
    }

    getFirstEmptySlot() {
        return this.inventory.slots.findIndex(slot => slot === null);
    }

    forceRefresh() {
        this.loadInventory();
    }
}

if (typeof window !== 'undefined') {
    window.InventoryManager = InventoryManager;
    
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.inventoryManagerInstance) {
            window.inventoryManagerInstance = new InventoryManager();
            window.InventoryManager = window.inventoryManagerInstance;
        }
    });
}