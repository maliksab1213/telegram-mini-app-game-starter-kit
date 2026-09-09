// Main Application Controller - FIXED VERSION
class App {
    constructor() {
        this.currentSection = 'home';
        this.sections = {};
        this.userData = null;
        this.isLoaded = false;
        this.initTimeout = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing StoryVibe App...');
            
            // Add timeout to prevent infinite loading
            this.initTimeout = setTimeout(() => {
                if (!this.isLoaded) {
                    console.warn('Init taking too long, forcing game interface');
                    this.showGameInterface();
                }
            }, 5000);
            
            this.bindElements();
            this.setupNavigation();
            
            // Wait for all dependencies to load
            await this.waitForDependencies();
            
            await this.loadUserData();
            this.initializeSections();
            this.showGameInterface();
            
            if (this.initTimeout) {
                clearTimeout(this.initTimeout);
            }
            
            this.isLoaded = true;
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
            // Don't show error, just show game interface
            this.showGameInterface();
        }
    }

    async waitForDependencies() {
        // Wait for essential dependencies to load
        const maxWait = 3000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (window.NotificationSystem && window.InventoryManager) {
                console.log('Dependencies loaded successfully');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.warn('Some dependencies not loaded, continuing anyway');
    }

    bindElements() {
        this.elements = {
            loadingScreen: document.getElementById('loading-screen'),
            welcomeScreen: document.getElementById('welcome-screen'),
            explanationScreen: document.getElementById('explanation-screen'),
            gameInterface: document.getElementById('game-interface'),
            errorScreen: document.getElementById('error-screen'),
            navItems: document.querySelectorAll('.nav-item'),
            sections: document.querySelectorAll('.section')
        };
    }

    setupNavigation() {
        this.elements.navItems.forEach(navItem => {
            navItem.addEventListener('click', (e) => {
                const sectionName = navItem.dataset.section;
                if (sectionName) {
                    this.switchSection(sectionName);
                }
            });
        });
    }

    switchSection(sectionName) {
        console.log(`Switching to section: ${sectionName}`);
        
        // Update navigation state
        this.elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionName);
        });

        // Hide all sections
        this.elements.sections.forEach(section => {
            section.classList.remove('active');
            section.classList.add('d-none');
        });

        // Show target section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.classList.remove('d-none');
            
            // Activate section controller if available
            this.activateSection(sectionName);
            this.currentSection = sectionName;
        } else {
            console.error(`Section not found: ${sectionName}-section`);
        }
    }

    activateSection(sectionName) {
        // Deactivate previous section
        if (this.sections[this.currentSection] && this.sections[this.currentSection].deactivate) {
            this.sections[this.currentSection].deactivate();
        }

        // Activate new section
        if (this.sections[sectionName] && this.sections[sectionName].activate) {
            this.sections[sectionName].activate();
        }
    }

    initializeSections() {
        console.log('Initializing sections...');
        
        // Initialize Home Section
        if (window.HomeSection) {
            this.sections.home = new window.HomeSection();
            window.homeInstance = this.sections.home;
            console.log('Home section initialized');
        }

        // Initialize Tasks Section (if exists)
        if (window.TasksSection) {
            this.sections.tasks = new window.TasksSection();
            console.log('Tasks section initialized');
        }

        // Initialize Shopping Section (replaces games)
        if (window.ShoppingSection) {
            this.sections.shopping = new window.ShoppingSection();
            console.log('Shopping section initialized');
        }

        // Initialize Leaderboard Section (if exists)
        if (window.LeaderboardSection) {
            this.sections.leaderboard = new window.LeaderboardSection();
            console.log('Leaderboard section initialized');
        }

        // Initialize Settings Section (if exists)
        if (window.SettingsSection) {
            this.sections.settings = new window.SettingsSection();
            console.log('Settings section initialized');
        }

        // Activate home section by default
        this.switchSection('home');
    }

    async loadUserData() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            if (!uid || !token) {
                // Use default data for development/testing
                this.userData = {
                    name: 'Writer',
                    coins: 0,
                    totalWords: 0,
                    newUser: false
                };
                console.warn('No access parameters, using default data');
                this.updateUserUI();
                return;
            }

            const response = await fetch(`/api/user?uid=${uid}&token=${token}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load user data');
            }

            this.userData = data;
            console.log('User data loaded:', this.userData);

            // Update UI with user data
            this.updateUserUI();

            // Check if new user
            if (this.userData.newUser) {
                this.showWelcomeScreen();
                return;
            }

        } catch (error) {
            console.error('Error loading user data:', error);
            // Use fallback data instead of throwing error
            this.userData = {
                name: 'Writer',
                coins: 0,
                totalWords: 0,
                newUser: false
            };
            this.updateUserUI();
        }
    }

    updateUserUI() {
        if (!this.userData) return;

        // Update user name - safe check
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = this.userData.name || 'Writer';
        }

        // Update coins display - safe check
        const headerCoinsEl = document.getElementById('header-coins');
        if (headerCoinsEl) {
            headerCoinsEl.textContent = this.formatNumber(this.userData.coins || 0);
        }

        // FIXED: Safe inventory update - only call if InventoryManager exists and has updateUI method
        if (window.InventoryManager && typeof window.InventoryManager.updateUI === 'function') {
            try {
                window.InventoryManager.updateUI();
            } catch (error) {
                console.warn('Error updating inventory UI:', error);
            }
        }
    }

    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    showWelcomeScreen() {
        this.hideAllScreens();
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.classList.remove('d-none');
            this.setupWelcomeFlow();
        } else {
            // Fallback to game interface
            this.showGameInterface();
        }
    }

    setupWelcomeFlow() {
        const nameInput = document.getElementById('new-player-name');
        const continueBtn = document.getElementById('continue-btn');
        const errorMsg = document.getElementById('new-name-error');

        if (!nameInput || !continueBtn) {
            this.showGameInterface();
            return;
        }

        // Enable continue button when name is entered
        nameInput.addEventListener('input', () => {
            const name = nameInput.value.trim();
            continueBtn.disabled = name.length === 0;
            if (errorMsg) {
                errorMsg.classList.add('d-none');
            }
        });

        // Handle continue button
        continueBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) return;

            try {
                await this.submitUserName(name);
                this.showGameInterface();
            } catch (error) {
                if (errorMsg) {
                    errorMsg.textContent = error.message;
                    errorMsg.classList.remove('d-none');
                } else {
                    // Fallback: just continue to game
                    this.userData.name = name;
                    this.showGameInterface();
                }
            }
        });
    }

    async submitUserName(name) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');

            if (!uid || !token) {
                // Just update local data
                this.userData.name = name;
                this.userData.newUser = false;
                this.updateUserUI();
                return;
            }

            const response = await fetch(`/api/user/name?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save name');
            }

            this.userData.name = name;
            this.userData.newUser = false;
            this.updateUserUI();

        } catch (error) {
            console.error('Error saving name:', error);
            // Don't throw error, just update locally
            this.userData.name = name;
            this.userData.newUser = false;
            this.updateUserUI();
        }
    }

    showGameInterface() {
        console.log('Showing game interface');
        this.hideAllScreens();
        
        if (this.elements.gameInterface) {
            this.elements.gameInterface.classList.remove('d-none');
        }
        
        // Initialize sections if not already done
        if (!this.isLoaded) {
            try {
                this.initializeSections();
            } catch (error) {
                console.error('Error initializing sections:', error);
            }
        }

        // Show welcome notification
        if (window.NotificationSystem && this.userData) {
            setTimeout(() => {
                if (typeof window.NotificationSystem.showWelcomeBack === 'function') {
                    window.NotificationSystem.showWelcomeBack(this.userData.name || 'Writer');
                }
            }, 1000);
        }
    }

    hideAllScreens() {
        const screens = [
            this.elements.loadingScreen,
            this.elements.welcomeScreen,
            this.elements.explanationScreen,
            this.elements.gameInterface,
            this.elements.errorScreen
        ];
        
        screens.forEach(screen => {
            if (screen) {
                screen.classList.add('d-none');
            }
        });
    }

    showError(message) {
        console.log('Error occurred:', message);
        // Instead of showing error screen, just show game interface
        this.showGameInterface();
    }

    // Public methods for other modules
    getUserData() {
        return this.userData || { name: 'Writer', coins: 0, totalWords: 0 };
    }

    updateUserData(newData) {
        this.userData = { ...this.userData, ...newData };
        this.updateUserUI();
    }

    async refreshUserData() {
        try {
            await this.loadUserData();
        } catch (error) {
            console.error('Error refreshing user data:', error);
        }
    }

    addCoins(amount) {
        if (this.userData) {
            this.userData.coins = (this.userData.coins || 0) + amount;
            this.updateUserUI();
        }
    }

    getCurrentSection() {
        return this.currentSection;
    }

    getSectionInstance(sectionName) {
        return this.sections[sectionName] || null;
    }

    // Handle writing progress
    onWrite(words) {
        if (this.userData) {
            this.userData.coins = (this.userData.coins || 0) + words;
            this.userData.totalWords = (this.userData.totalWords || 0) + words;
            this.updateUserUI();
        }
    }
}

// Initialize app when DOM is loaded - with error handling
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    try {
        window.GameManager = new App();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        // Show game interface anyway
        setTimeout(() => {
            const gameInterface = document.getElementById('game-interface');
            const loadingScreen = document.getElementById('loading-screen');
            
            if (loadingScreen) loadingScreen.classList.add('d-none');
            if (gameInterface) gameInterface.classList.remove('d-none');
        }, 1000);
    }
});

// Handle app visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.GameManager) {
        // Refresh data when user returns to the game
        try {
            window.GameManager.refreshUserData();
        } catch (error) {
            console.warn('Error refreshing data on visibility change:', error);
        }
    }
});

// Export for global access
window.App = App;