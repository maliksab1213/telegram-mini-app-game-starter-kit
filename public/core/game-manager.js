// Game Manager - Core System - FIXED VERSION
class GameManager {
    constructor() {
        this.userData = null;
        this.urlParams = null;
        this.currentSection = 'home';
        this.sections = {};
        this.syncInterval = null;
        this.isInitialized = false;
        this.loadingStartTime = Date.now();
        
        this.init();
    }

    async init() {
    try {
        console.log('GameManager initializing...');
        
        // Show loading screen immediately
        this.showScreen('loading-screen');
        
        // Add artificial minimum loading time for better UX
        const minLoadingTime = 1000; // Reduced to 1 second
        
        // Parse URL parameters first
        this.parseUrlParams();
        
        // Load user data FIRST
        await this.loadUserData();
        
        // Ensure minimum loading time has passed
        const elapsedTime = Date.now() - this.loadingStartTime;
        if (elapsedTime < minLoadingTime) {
            await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
        }
        
        // Initialize sections AFTER user data is loaded
        this.initializeSections();
        this.setupNavigation();
        this.startSyncInterval();
        
        console.log('User data loaded:', this.userData);
        
        // ALWAYS show game interface - no newUser check needed here
        // Because /game route means registration is complete
        console.log('Showing game interface');
        this.showGameInterface();
        
        this.isInitialized = true;
        console.log('GameManager initialized successfully');
        
    } catch (error) {
        console.error('GameManager initialization error:', error);
        this.userData = {
            name: 'Writer',
            coins: 0,
            totalWords: 0,
            newUser: false
        };
        this.initializeSections();
        this.showGameInterface();
    }
}

    parseUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        this.urlParams = {
            uid: urlParams.get('uid'),
            token: urlParams.get('token')
        };

        // Don't throw error if params are missing - use fallback mode
        if (!this.urlParams.uid || !this.urlParams.token) {
            console.warn('Missing URL parameters, using fallback mode');
            this.urlParams = { uid: 'guest', token: 'fallback' };
        }
    }

    async loadUserData() {
    try {
        if (this.urlParams.uid === 'guest') {
            this.userData = {
                name: 'Writer',
                coins: 0,
                totalWords: 0,
                newUser: false
            };
            return;
        }

        const response = await fetch(`/api/user?uid=${this.urlParams.uid}&token=${this.urlParams.token}`);
        
        if (!response.ok) {
            throw new Error('Access denied');
        }
        
        this.userData = await response.json();
        
        // IMPORTANT FIX: Force newUser to false when loading in game
        // Because if user reached /game, registration is complete
        this.userData.newUser = false;
        
        console.log('User data loaded successfully:', this.userData);
    } catch (error) {
        console.error('Failed to load user data, using fallback:', error);
        this.userData = {
            name: 'Writer',
            coins: 0,
            totalWords: 0,
            newUser: false
        };
    }
}

    initializeSections() {
        console.log('Initializing sections...');
        
        // Initialize Home Section - 🔥 SET GLOBAL INSTANCE
        if (window.HomeSection) {
            this.sections.home = new window.HomeSection();
            window.homeInstance = this.sections.home; // 🔥 CRITICAL FIX
            
            console.log('✅ Home section initialized and set as window.homeInstance');
        } else {
            console.warn('HomeSection not found');
        }
        
        // Initialize other sections with null checks
        if (window.TasksSection) {
            this.sections.tasks = new window.TasksSection();
            console.log('Tasks section initialized');
        } else {
            this.sections.tasks = null;
            console.warn('TasksSection not found');
        }
        
        if (window.ShoppingSection) {
            this.sections.shopping = new window.ShoppingSection();
            console.log('Shopping section initialized');
        } else {
            this.sections.shopping = null;
            console.warn('ShoppingSection not found');
        }
        
        if (window.LeaderboardSection) {
            this.sections.leaderboard = new window.LeaderboardSection();
            console.log('Leaderboard section initialized');
        } else {
            this.sections.leaderboard = null;
            console.warn('LeaderboardSection not found');
        }
        
        if (window.SettingsSection) {
            this.sections.settings = new window.SettingsSection();
            console.log('Settings section initialized');
        } else {
            this.sections.settings = null;
            console.warn('SettingsSection not found');
        }
        
        console.log('Sections initialized:', Object.keys(this.sections));
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                if (section && section !== this.currentSection) {
                    this.switchSection(section);
                }
            });
        });
    }

    switchSection(sectionName) {
        // Check if section exists before switching
        if (!this.sections[sectionName]) {
            console.warn(`Section ${sectionName} not available`);
            return;
        }
        
        if (sectionName === this.currentSection) return;
        
        console.log(`Switching from ${this.currentSection} to ${sectionName}`);
        
        // Hide current section
        const currentSectionEl = document.getElementById(`${this.currentSection}-section`);
        const currentNavItem = document.querySelector(`.nav-item[data-section="${this.currentSection}"]`);
        
        if (currentSectionEl) {
            currentSectionEl.classList.remove('active');
        }
        
        if (currentNavItem) {
            currentNavItem.classList.remove('active');
        }
        
        // Deactivate current section safely
        if (this.sections[this.currentSection] && this.sections[this.currentSection].deactivate) {
            try {
                this.sections[this.currentSection].deactivate();
            } catch (error) {
                console.warn(`Error deactivating ${this.currentSection}:`, error);
            }
        }
        
        // Show new section
        const newSectionEl = document.getElementById(`${sectionName}-section`);
        const newNavItem = document.querySelector(`.nav-item[data-section="${sectionName}"]`);
        
        if (newSectionEl) {
            newSectionEl.classList.add('active');
        }
        
        if (newNavItem) {
            newNavItem.classList.add('active');
        }
        
        // Activate new section safely
        if (this.sections[sectionName] && this.sections[sectionName].activate) {
            try {
                this.sections[sectionName].activate();
            } catch (error) {
                console.warn(`Error activating ${sectionName}:`, error);
            }
        }
        
        this.currentSection = sectionName;
        this.loadSectionData(sectionName);
    }

    async loadSectionData(sectionName) {
        const section = this.sections[sectionName];
        
        if (section && section.loadData && typeof section.loadData === 'function') {
            try {
                await section.loadData();
            } catch (error) {
                console.error(`Failed to load data for ${sectionName}:`, error);
            }
        }
    }

    // FIXED: Centralized screen management
    showScreen(screenId) {
        console.log(`Showing screen: ${screenId}`);
        
        // Hide all screens first
        const allScreens = [
            'loading-screen',
            'welcome-screen', 
            'explanation-screen',
            'game-interface',
            'error-screen'
        ];
        
        allScreens.forEach(id => {
            const screen = document.getElementById(id);
            if (screen) {
                screen.classList.add('d-none');
                screen.style.display = 'none';
            }
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.remove('d-none');
            targetScreen.style.display = 'flex';
            
            // For game interface, use flex-column
            if (screenId === 'game-interface') {
                targetScreen.style.flexDirection = 'column';
            }
        } else {
            console.error(`Screen not found: ${screenId}`);
        }
    }

    showGameInterface() {
        console.log('Showing game interface');
        this.showScreen('game-interface');
        
        // Update user info after showing interface
        setTimeout(() => {
            this.updateUserInfo();
            this.switchSection('home');
        }, 100);
    }

    showError(message) {
        console.log('Showing error:', message);
        this.showScreen('error-screen');
        
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }

    updateUserInfo() {
        const userName = document.getElementById('user-name');
        const userLevel = document.getElementById('user-level');
        
        if (userName && this.userData?.name) {
            userName.textContent = this.userData.name;
        }
        
        if (userLevel) {
            const level = this.calculateLevel(this.userData?.coins || 0);
            userLevel.textContent = `Level ${level}`;
        }
    }

    calculateLevel(coins) {
        return Math.floor(coins / 100) + 1;
    }

    startSyncInterval() {
        // Only start sync if we have valid params
        if (this.urlParams.uid === 'guest') return;
        
        this.syncInterval = setInterval(async () => {
            await this.syncWithServer();
        }, 3000);
    }

    async syncWithServer() {
        if (!this.sections.home || this.urlParams.uid === 'guest') return;
        
        const homeData = this.sections.home.getData();
        
        if (homeData.pendingTaps > 0) {
            try {
                const tapsToSync = this.sections.home.syncPendingTaps();
                
                const response = await fetch(`/api/user/tap?uid=${this.urlParams.uid}&token=${this.urlParams.token}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ taps: tapsToSync })
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    this.userData.coins = result.coins;
                    this.userData.totalTaps = result.totalTaps;
                    
                    if (result.achievements && this.sections.home.onAchievement) {
                        this.sections.home.onAchievement(result.achievements);
                    }
                    
                    console.log(`Synced ${tapsToSync} taps successfully`);
                } else {
                    console.error('Failed to sync taps with server');
                    this.sections.home.pendingTaps += tapsToSync;
                }
            } catch (error) {
                console.error('Error syncing with server:', error);
            }
        }
    }

    onTap(pendingTaps) {
        this.userData.coins = (this.userData.coins || 0) + 1;
        this.userData.totalTaps = (this.userData.totalTaps || 0) + 1;
        this.updateUserInfo();
    }

    // FIXED: Handle new user setup with proper screen transitions
    async completeNewUserSetup(name) {
        try {
            console.log('Completing new user setup for:', name);
            this.showScreen('loading-screen');
            
            if (this.urlParams.uid === 'guest') {
                // Fallback mode
                this.userData.name = name;
                this.userData.newUser = false;
                this.showGameInterface();
                return true;
            }
            
            const response = await fetch(`/api/user/name?uid=${this.urlParams.uid}&token=${this.urlParams.token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.userData.name = result.name;
                this.userData.newUser = false;
                
                console.log('Name saved, proceeding to explanation screen');
                
                // Show explanation screen for new users
                setTimeout(() => {
                    this.showScreen('explanation-screen');
                    
                    // Initialize explanation dialogue if available
                    if (window.NewUserExperience && window.NewUserExperience.startExplanation) {
                        window.NewUserExperience.startExplanation(name);
                    }
                }, 500);
                
                return true;
            } else {
                throw new Error(result.error || 'Failed to save name');
            }
        } catch (error) {
            console.error('Error saving user name:', error);
            // Continue to game anyway
            this.userData.name = name;
            this.userData.newUser = false;
            this.showGameInterface();
            return true;
        }
    }

    // Method for explanation screen to call when done
    finishExplanation() {
        console.log('Explanation finished, showing game interface');
        this.showGameInterface();
    }

    getUserData() {
        return this.userData;
    }

    getApiParams() {
        return `uid=${this.urlParams.uid}&token=${this.urlParams.token}`;
    }

    // FIXED: Safe method to get section instance
    getSectionInstance(sectionName) {
        return this.sections[sectionName] || null;
    }

    // FIXED: Safe method to update user data
    updateUserData(newData) {
        if (this.userData) {
            this.userData = { ...this.userData, ...newData };
            this.updateUserInfo();
        }
    }

    // FIXED: Safe method for writing
    onWrite(words) {
        if (this.userData) {
            this.userData.coins = (this.userData.coins || 0) + words;
            this.userData.totalWords = (this.userData.totalWords || 0) + words;
            this.updateUserInfo();
        }
    }

    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        if (this.urlParams.uid !== 'guest') {
            this.syncWithServer().catch(console.error);
        }
    }
}

// Initialize GameManager globally with better error handling
window.GameManager = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing GameManager...');
    try {
        window.GameManager = new GameManager();
    } catch (error) {
        console.error('Critical error initializing GameManager:', error);
        // Emergency fallback - show game interface
        setTimeout(() => {
            const gameInterface = document.getElementById('game-interface');
            const loadingScreen = document.getElementById('loading-screen');
            
            if (loadingScreen) loadingScreen.classList.add('d-none');
            if (gameInterface) {
                gameInterface.classList.remove('d-none');
                gameInterface.style.display = 'flex';
                gameInterface.style.flexDirection = 'column';
            }
        }, 1000);
    }
});

window.addEventListener('beforeunload', () => {
    if (window.GameManager) {
        window.GameManager.destroy();
    }
});