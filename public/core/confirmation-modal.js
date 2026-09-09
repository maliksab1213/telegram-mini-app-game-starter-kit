// Beautiful Confirmation Modal System
class ConfirmationModal {
    constructor() {
        this.modal = null;
        this.resolveCallback = null;
        this.init();
    }

    init() {
        // Create modal HTML structure
        this.createModalHTML();
        this.bindEvents();
    }

    createModalHTML() {
        // Check if modal already exists
        let modal = document.getElementById('confirm-modal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'confirm-modal';
            modal.className = 'confirm-modal d-none';
            modal.innerHTML = `
                <div class="confirm-content">
                    <div class="confirm-icon" id="confirm-icon">⚠️</div>
                    <div class="confirm-title" id="confirm-title">Confirm Action</div>
                    <div class="confirm-message" id="confirm-message">Are you sure?</div>
                    <div class="confirm-buttons">
                        <button class="confirm-btn confirm-btn-cancel" id="confirm-cancel">Cancel</button>
                        <button class="confirm-btn confirm-btn-ok" id="confirm-ok">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        this.modal = modal;
    }

    bindEvents() {
        const cancelBtn = document.getElementById('confirm-cancel');
        const okBtn = document.getElementById('confirm-ok');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close(false));
        }

        if (okBtn) {
            okBtn.addEventListener('click', () => this.close(true));
        }

        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close(false);
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('d-none')) {
                this.close(false);
            }
        });
    }

    show(options = {}) {
        return new Promise((resolve) => {
            this.resolveCallback = resolve;

            const {
                title = 'Confirm Action',
                message = 'Are you sure?',
                icon = '⚠️',
                type = 'warning', // warning, danger, info, success
                okText = 'OK',
                cancelText = 'Cancel'
            } = options;

            // Update modal content
            const iconEl = document.getElementById('confirm-icon');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            const okBtn = document.getElementById('confirm-ok');
            const cancelBtn = document.getElementById('confirm-cancel');

            if (iconEl) {
                iconEl.textContent = icon;
                iconEl.className = `confirm-icon ${type}`;
            }

            if (titleEl) {
                titleEl.textContent = title;
            }

            if (messageEl) {
                messageEl.textContent = message;
            }

            if (okBtn) {
                okBtn.textContent = okText;
                okBtn.className = `confirm-btn confirm-btn-ok ${type}`;
            }

            if (cancelBtn) {
                cancelBtn.textContent = cancelText;
            }

            // Show modal
            this.modal.classList.remove('d-none');
        });
    }

    close(result) {
        this.modal.classList.add('d-none');
        
        if (this.resolveCallback) {
            this.resolveCallback(result);
            this.resolveCallback = null;
        }
    }

    // Shorthand methods for common confirmations
    async confirmDiscard(itemName) {
        return this.show({
            title: 'Discard Item?',
            message: `Are you sure you want to discard "${itemName}"? This action cannot be undone.`,
            icon: '🗑️',
            type: 'danger',
            okText: 'Discard',
            cancelText: 'Cancel'
        });
    }

    async confirmPurchase(itemName, price) {
        return this.show({
            title: 'Purchase Item?',
            message: `Do you want to buy "${itemName}" for ${price} coins?`,
            icon: '🛒',
            type: 'info',
            okText: 'Buy',
            cancelText: 'Cancel'
        });
    }

    async confirmSell(itemName, price) {
        return this.show({
            title: 'Sell Item?',
            message: `Sell "${itemName}" for ${price} coins?`,
            icon: '💰',
            type: 'warning',
            okText: 'Sell',
            cancelText: 'Cancel'
        });
    }

    async confirmUse(itemName) {
        return this.show({
            title: 'Use Item?',
            message: `Do you want to use "${itemName}"?`,
            icon: '✨',
            type: 'success',
            okText: 'Use',
            cancelText: 'Cancel'
        });
    }
}

// Initialize globally
if (typeof window !== 'undefined') {
    window.ConfirmationModal = new ConfirmationModal();
}