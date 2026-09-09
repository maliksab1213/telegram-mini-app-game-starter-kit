// Daily Reward System - FIXED with Auto Refresh + Congratulations
class DailyRewardInterface {
    constructor() {
        this.isOpen = false;
        this.rewardData = null;
        this.rewardSchedule = [
            { day: 1, coins: 100, icon: '📅' },
            { day: 2, coins: 150, icon: '📅' },
            { day: 3, coins: 200, icon: '📅' },
            { day: 4, coins: 250, icon: '📅' },
            { day: 5, coins: 300, icon: '📅' },
            { day: 6, coins: 350, icon: '📅' },
            { day: 7, coins: 500, icon: '🎁' }
        ];
        
        this.init();
    }

    init() {
        this.createModal();
        this.createCongratulations();
        this.setupEventListeners();
        console.log('[DAILY_REWARD] Initialized');
    }

    createModal() {
        if (document.getElementById('daily-reward-modal')) return;
        
        const modal = document.createElement('div');
        modal.id = 'daily-reward-modal';
        modal.className = 'daily-reward-modal d-none';
        modal.innerHTML = `
            <div class="reward-overlay" id="reward-overlay-close">
                <div class="reward-container">
                    <div class="reward-header">
                        <h2>🎁 Daily Rewards</h2>
                        <button class="reward-close-btn" id="reward-close-btn">✕</button>
                    </div>
                    
                    <div class="reward-info">
                        <p id="reward-message">Collect your daily rewards!</p>
                    </div>
                    
                    <div class="reward-grid" id="reward-grid">
                        <!-- Reward boxes populated by JS -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('reward-close-btn').addEventListener('click', () => {
            this.close();
        });
        
        // Close when clicking outside
        document.getElementById('reward-overlay-close').addEventListener('click', (e) => {
            if (e.target.id === 'reward-overlay-close') {
                this.close();
            }
        });
    }

    createCongratulations() {
        if (document.getElementById('reward-congratulations')) return;
        
        const congrats = document.createElement('div');
        congrats.id = 'reward-congratulations';
        congrats.className = 'spin-congratulations';
        congrats.innerHTML = `
            <div class="congratulations-content">
                <div class="congrats-icon">🎉</div>
                <div class="congrats-title">Reward Collected!</div>
                <div class="congrats-amount" id="reward-congrats-amount">+0</div>
                <div class="congrats-text">Coins Earned!</div>
                <button class="congrats-close-btn" id="reward-congrats-close-btn">Continue</button>
            </div>
        `;
        
        document.body.appendChild(congrats);
        
        document.getElementById('reward-congrats-close-btn').addEventListener('click', () => {
            this.hideCongratulations();
        });
    }

    setupEventListeners() {
        // Event listeners for buttons are in home.js
    }

    async open() {
        console.log('[DAILY_REWARD] Opening...');
        
        try {
            const data = await this.loadRewardData();
            if (data) {
                this.renderRewardInterface(data);
                this.showModal();
                this.isOpen = true;
            }
        } catch (error) {
            console.error('[DAILY_REWARD] Error opening:', error);
            this.showNotification('error', 'Error', 'Failed to load daily rewards');
        }
    }

    async loadRewardData() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) return null;
            
            const response = await fetch(`/api/daily-reward?uid=${uid}&token=${token}`);
            if (response.ok) {
                const data = await response.json();
                this.rewardData = data;
                return data;
            }
        } catch (error) {
            console.error('[DAILY_REWARD] Error loading data:', error);
        }
        
        return null;
    }

    renderRewardInterface(data) {
        const grid = document.getElementById('reward-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Find next collectible day
        const nextDay = this.getNextCollectibleDay(data);
        
        this.rewardSchedule.forEach((reward, index) => {
            const dayKey = `day${index + 1}`;
            const isCollected = data[dayKey] || false;
            const isAvailable = index === nextDay;
            const isUnavailable = !isCollected && !isAvailable;
            
            const box = document.createElement('div');
            let boxClass = 'reward-box';
            if (isCollected) {
                boxClass += ' collected';
            } else if (isAvailable) {
                boxClass += ' available';
            } else {
                boxClass += ' unavailable';
            }
            
            box.className = boxClass;
            
            box.innerHTML = `
                <div class="reward-box-content">
                    <div class="reward-day-label">Day ${reward.day}</div>
                    <div class="reward-icon">${reward.icon}</div>
                    <div class="reward-amount">${reward.coins}</div>
                    <div class="reward-unit">coins</div>
                    ${isCollected ? 
                        `<div class="reward-status">✓ Collected</div>` : 
                        (isAvailable ? 
                            `<button class="reward-collect-btn" data-day="${index}">Collect</button>` : 
                            `<button class="reward-collect-btn" disabled>Locked</button>`
                        )
                    }
                </div>
            `;
            
            if (isAvailable && !isCollected) {
                const btn = box.querySelector('.reward-collect-btn');
                btn.addEventListener('click', () => this.collectReward(index));
            }
            
            grid.appendChild(box);
        });
    }

    getNextCollectibleDay(data) {
        // Check all days in order
        for (let i = 0; i < 7; i++) {
            const dayKey = `day${i + 1}`;
            if (!data[dayKey]) {
                return i; // Return first uncollected day
            }
        }
        return -1; // All collected
    }

    async collectReward(dayIndex) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) return;
            
            const response = await fetch(`/api/daily-reward/collect?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dayIndex })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success) {
                    // 🔥 FIRST: Refresh home coins IMMEDIATELY
                    console.log('[DAILY_REWARD] Refreshing home coins with amount:', result.coinsAwarded);
                    
                    if (window.homeInstance) {
                        await window.homeInstance.refreshData();
                        console.log('[DAILY_REWARD] Home coins refreshed successfully');
                    } else {
                        console.error('[DAILY_REWARD] window.homeInstance not found!');
                    }
                    
                    // THEN: Show congratulations popup
                    this.showCongratulations(result.coinsAwarded);
                    
                    // FINALLY: Refresh reward UI
                    const data = await this.loadRewardData();
                    this.renderRewardInterface(data);
                    
                } else {
                    this.showNotification('error', 'Error', result.message);
                }
            }
        } catch (error) {
            console.error('[DAILY_REWARD] Error collecting:', error);
            this.showNotification('error', 'Error', 'Failed to collect reward');
        }
    }

    showCongratulations(amount) {
        const congratsDiv = document.getElementById('reward-congratulations');
        const amountDiv = document.getElementById('reward-congrats-amount');
        
        if (congratsDiv && amountDiv) {
            amountDiv.textContent = `+${amount}`;
            congratsDiv.classList.add('show');
        }
    }

    hideCongratulations() {
        const congratsDiv = document.getElementById('reward-congratulations');
        if (congratsDiv) {
            congratsDiv.classList.remove('show');
        }
    }

    showModal() {
        const modal = document.getElementById('daily-reward-modal');
        if (modal) {
            modal.classList.remove('d-none');
        }
    }

    async close() {
        const modal = document.getElementById('daily-reward-modal');
        if (modal) {
            modal.classList.add('d-none');
        }
        this.isOpen = false;
        
        // 🔥 FINAL REFRESH ON CLOSE (double safety)
        console.log('[DAILY_REWARD] Final refresh on close...');
        if (window.homeInstance) {
            await window.homeInstance.refreshData();
        }
    }

    showNotification(type, title, message) {
        if (window.NotificationSystem) {
            window.NotificationSystem.show(type, title, message, 3000);
        }
    }
}

window.DailyRewardInterface = DailyRewardInterface;