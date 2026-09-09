// New User Registration Handler
class NewUserRegistration {
    constructor() {
        this.urlParams = null;
        this.referredBy = null;
        this.playerName = '';
        this.isSubmitting = false;
        
        this.init();
    }

    async init() {
        try {
            console.log('[NewUser] Initializing...');
            
            if (!this.validateAccess()) {
                this.showError('Invalid access. Please use the Telegram bot.');
                return;
            }

            this.showScreen('new-welcome');
            this.setupEventListeners();
            
            console.log('[NewUser] ✅ Initialized');
        } catch (error) {
            console.error('[NewUser] Init failed:', error);
            this.showError('Failed to initialize. Please try again.');
        }
    }

    validateAccess() {
        const urlParams = new URLSearchParams(window.location.search);
        this.urlParams = {
            uid: urlParams.get('uid'),
            token: urlParams.get('token'),
            ref: urlParams.get('ref')
        };

        this.referredBy = this.urlParams.ref || null;

        return this.urlParams.uid && this.urlParams.token;
    }

    setupEventListeners() {
        const nameInput = document.getElementById('player-name-input');
        const continueBtn = document.getElementById('continue-btn');
        
        if (!nameInput || !continueBtn) return;

        // Real-time validation
        nameInput.addEventListener('input', (e) => {
            this.validateAndCleanInput(e.target);
        });

        // Submit on button click
        continueBtn.addEventListener('click', () => {
            this.submitName();
        });

        // Submit on Enter key
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !continueBtn.disabled) {
                this.submitName();
            }
        });
    }

    validateAndCleanInput(input) {
        let value = input.value;
        
        // Remove non-letter and non-space characters
        value = value.replace(/[^a-zA-Z\s]/g, '');
        
        // Limit to 15 characters
        if (value.length > 15) {
            value = value.substring(0, 15);
        }
        
        input.value = value;
        
        const continueBtn = document.getElementById('continue-btn');
        const errorDiv = document.getElementById('name-error');
        
        // Clear error
        if (errorDiv) {
            errorDiv.classList.add('d-none');
        }
        
        // Reset border
        input.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        
        const trimmed = value.trim();
        
        if (trimmed.length === 0) {
            continueBtn.disabled = true;
            return false;
        }
        
        if (trimmed.length < 3) {
            this.showInputError('Name must be at least 3 letters');
            input.style.borderColor = '#ff6b6b';
            continueBtn.disabled = true;
            return false;
        }
        
        // Valid name
        input.style.borderColor = '#4caf50';
        continueBtn.disabled = false;
        this.playerName = trimmed;
        return true;
    }

    showInputError(message) {
        const errorDiv = document.getElementById('name-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('d-none');
        }
    }

    async submitName() {
        if (this.isSubmitting || !this.playerName) return;
        
        this.isSubmitting = true;
        const continueBtn = document.getElementById('continue-btn');
        const nameInput = document.getElementById('player-name-input');
        
        // Disable inputs
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.innerHTML = '<span class="btn-text">Processing...</span>';
        }
        if (nameInput) nameInput.disabled = true;
        
        try {
            console.log('[NewUser] Submitting name:', this.playerName);
            
            const response = await fetch(`/api/new/register?uid=${this.urlParams.uid}&token=${this.urlParams.token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.playerName,
                    referredBy: this.referredBy
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                console.log('[NewUser] ✅ Registration successful');
                this.redirectToGame();
            } else {
                throw new Error(result.error || 'Registration failed');
            }
            
        } catch (error) {
            console.error('[NewUser] Submit error:', error);
            this.showInputError('Failed to save name. Please try again.');
            
            // Re-enable inputs
            if (continueBtn) {
                continueBtn.disabled = false;
                continueBtn.innerHTML = '<span class="btn-text">Start Writing</span><span class="btn-arrow">→</span>';
            }
            if (nameInput) nameInput.disabled = false;
            this.isSubmitting = false;
        }
    }

    redirectToGame() {
        console.log('[NewUser] Redirecting to game...');
        
        // Direct redirect without showing loading
        const gameUrl = `/game?uid=${this.urlParams.uid}&token=${this.urlParams.token}`;
        window.location.replace(gameUrl);
    }

    showScreen(screenId) {
        document.querySelectorAll('.new-screen').forEach(screen => {
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
        this.showScreen('new-error');
        const errorMsg = document.getElementById('new-error-message');
        if (errorMsg) {
            errorMsg.textContent = message;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('[NewUser] DOM loaded, initializing...');
    window.newUserRegistration = new NewUserRegistration();
});