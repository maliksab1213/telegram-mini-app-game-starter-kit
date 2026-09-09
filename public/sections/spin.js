// Daily Spin System - FIXED with Immediate Refresh
class DailySpinInterface {
    constructor() {
        this.isOpen = false;
        this.isSpinning = false;
        this.spinData = null;
        this.rewards = [100, 200, 400, 700];
        this.colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3'];
        this.wheelRotation = 0;
        
        this.init();
    }

    init() {
        this.createModal();
        this.createCongratulations();
        this.setupEventListeners();
        console.log('[DAILY_SPIN] Initialized');
    }

    createModal() {
        if (document.getElementById('daily-spin-modal')) return;
        
        const modal = document.createElement('div');
        modal.id = 'daily-spin-modal';
        modal.className = 'daily-spin-modal d-none';
        modal.innerHTML = `
            <div class="spin-overlay" id="spin-overlay-close">
                <div class="spin-container">
                    <div class="spin-header">
                        <h2>🎡 Daily Spin</h2>
                        <button class="spin-close-btn" id="spin-close-btn">✕</button>
                    </div>
                    
                    <div class="spin-tickets-display">
                        <span class="spin-tickets-icon">🎫</span>
                        <span class="spin-tickets-count" id="spin-tickets">0</span>
                        <span class="spin-tickets-text">Tickets</span>
                    </div>
                    
                    <div class="spin-wheel-container">
                        <canvas id="spin-wheel" width="300" height="300"></canvas>
                        <div class="spin-pointer"></div>
                    </div>
                    
                    <div class="spin-controls">
                        <button class="spin-button" id="spin-button" disabled>
                            <span>SPIN NOW!</span>
                        </button>
                        
                        <button class="collect-ticket-btn" id="collect-ticket-btn">
                            <span>🎫 Collect Free Ticket</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('spin-close-btn').addEventListener('click', () => {
            this.close();
        });
        
        // Close when clicking overlay
        document.getElementById('spin-overlay-close').addEventListener('click', (e) => {
            if (e.target.id === 'spin-overlay-close') {
                this.close();
            }
        });
        
        document.getElementById('spin-button').addEventListener('click', () => {
            this.spin();
        });
        
        document.getElementById('collect-ticket-btn').addEventListener('click', () => {
            this.collectFreeTicket();
        });
        
        this.drawWheel();
    }

    createCongratulations() {
        if (document.getElementById('spin-congratulations')) return;
        
        const congrats = document.createElement('div');
        congrats.id = 'spin-congratulations';
        congrats.className = 'spin-congratulations';
        congrats.innerHTML = `
            <div class="congratulations-content">
                <div class="congrats-icon">🎉</div>
                <div class="congrats-title">Congratulations!</div>
                <div class="congrats-amount" id="congrats-amount">+0</div>
                <div class="congrats-text">Coins Won!</div>
                <button class="congrats-close-btn" id="congrats-close-btn">Continue</button>
            </div>
        `;
        
        document.body.appendChild(congrats);
        
        document.getElementById('congrats-close-btn').addEventListener('click', () => {
            this.hideCongratulations();
        });
    }

    drawWheel() {
        const canvas = document.getElementById('spin-wheel');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 130;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const segmentAngle = (2 * Math.PI) / this.rewards.length;
        
        this.rewards.forEach((reward, index) => {
            const startAngle = index * segmentAngle + this.wheelRotation;
            const endAngle = (index + 1) * segmentAngle + this.wheelRotation;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = this.colors[index];
            ctx.fill();
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            const textAngle = startAngle + segmentAngle / 2;
            const textX = centerX + Math.cos(textAngle) * (radius * 0.65);
            const textY = centerY + Math.sin(textAngle) * (radius * 0.65);
            
            ctx.save();
            ctx.translate(textX, textY);
            ctx.rotate(textAngle + Math.PI / 2);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${reward}`, 0, 5);
            ctx.restore();
        });
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SPIN', centerX, centerY);
    }

    setupEventListeners() {
        // Event listeners in home.js
    }

    async open() {
        console.log('[DAILY_SPIN] Opening...');
        
        try {
            const data = await this.loadSpinData();
            if (data) {
                this.spinData = data;
                this.updateUI();
                this.showModal();
                this.isOpen = true;
            }
        } catch (error) {
            console.error('[DAILY_SPIN] Error opening:', error);
            this.showNotification('error', 'Error', 'Failed to load spin data');
        }
    }

    async loadSpinData() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) return null;
            
            const response = await fetch(`/api/daily-spin?uid=${uid}&token=${token}`);
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('[DAILY_SPIN] Error loading data:', error);
        }
        
        return null;
    }

    updateUI() {
        if (!this.spinData) return;
        
        const ticketsDisplay = document.getElementById('spin-tickets');
        const spinButton = document.getElementById('spin-button');
        const collectBtn = document.getElementById('collect-ticket-btn');
        
        if (ticketsDisplay) {
            ticketsDisplay.textContent = this.spinData.tickets || 0;
        }
        
        if (spinButton) {
            spinButton.disabled = (this.spinData.tickets || 0) <= 0;
            spinButton.style.opacity = spinButton.disabled ? '0.5' : '1';
        }
        
        if (collectBtn) {
            if (this.spinData.freeTicketCollected) {
                collectBtn.disabled = true;
                collectBtn.innerHTML = '<span>✓ Collected Today</span>';
            } else {
                collectBtn.disabled = false;
                collectBtn.innerHTML = '<span>🎫 Collect Free Ticket</span>';
            }
        }
    }

    async spin() {
        if (this.isSpinning || !this.spinData || this.spinData.tickets <= 0) {
            return;
        }
        
        this.isSpinning = true;
        
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) return;
            
            const response = await fetch(`/api/daily-spin/perform?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success) {
                    const wonAmount = result.wonAmount;
                    const rewardIndex = this.rewards.indexOf(wonAmount);
                    
                    // Animate spin
                    await this.animateSpin(rewardIndex);
                    
                    // Update tickets
                    this.spinData.tickets = result.ticketsRemaining;
                    this.updateUI();
                    
                    // 🔥 REFRESH HOME COINS IMMEDIATELY (before congrats)
                    console.log('[DAILY_SPIN] Refreshing home coins immediately...');
                    if (window.homeInstance) {
                        await window.homeInstance.refreshData();
                    }
                    
                    // Show congratulations
                    this.showCongratulations(wonAmount);
                    
                } else {
                    this.showNotification('error', 'Error', result.message);
                }
            }
        } catch (error) {
            console.error('[DAILY_SPIN] Error spinning:', error);
            this.showNotification('error', 'Error', 'Spin failed');
        } finally {
            this.isSpinning = false;
        }
    }

    async animateSpin(targetRewardIndex) {
        return new Promise((resolve) => {
            const segmentAngle = (2 * Math.PI) / this.rewards.length;
            const targetAngle = segmentAngle * targetRewardIndex;
            const totalRotation = (Math.random() * Math.PI * 2) + (Math.PI * 8);
            const finalRotation = totalRotation - targetAngle;
            
            const duration = 3000;
            const startTime = Date.now();
            const spinButton = document.getElementById('spin-button');
            
            if (spinButton) spinButton.disabled = true;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                this.wheelRotation = finalRotation * easeProgress;
                
                this.drawWheel();
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.wheelRotation = finalRotation;
                    this.drawWheel();
                    if (spinButton) spinButton.disabled = false;
                    resolve();
                }
            };
            
            animate();
        });
    }

    showCongratulations(amount) {
        const congratsDiv = document.getElementById('spin-congratulations');
        const amountDiv = document.getElementById('congrats-amount');
        
        if (congratsDiv && amountDiv) {
            amountDiv.textContent = `+${amount}`;
            congratsDiv.classList.add('show');
        }
    }

    hideCongratulations() {
        const congratsDiv = document.getElementById('spin-congratulations');
        if (congratsDiv) {
            congratsDiv.classList.remove('show');
        }
    }

    async collectFreeTicket() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const uid = urlParams.get('uid');
            const token = urlParams.get('token');
            
            if (!uid || !token) return;
            
            const response = await fetch(`/api/daily-spin/collect-ticket?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success) {
                    this.showNotification('success', 'Success!', result.message);
                    const data = await this.loadSpinData();
                    if (data) {
                        this.spinData = data;
                        this.updateUI();
                    }
                } else {
                    this.showNotification('info', 'Info', result.message);
                }
            }
        } catch (error) {
            console.error('[DAILY_SPIN] Error collecting ticket:', error);
            this.showNotification('error', 'Error', 'Failed to collect ticket');
        }
    }

    showModal() {
        const modal = document.getElementById('daily-spin-modal');
        if (modal) {
            modal.classList.remove('d-none');
        }
    }

    async close() {
        const modal = document.getElementById('daily-spin-modal');
        if (modal) {
            modal.classList.add('d-none');
        }
        this.isOpen = false;
        
        // 🔥 FINAL REFRESH ON CLOSE (double safety)
        console.log('[DAILY_SPIN] Final refresh on close...');
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

window.DailySpinInterface = DailySpinInterface;