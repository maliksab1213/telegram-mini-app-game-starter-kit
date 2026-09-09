// Tournament Rewards Interface - SERVER STATUS BASED
class TournamentRewardsInterface {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        
        this.tournamentData = null;
        this.rewardConfig = null;
        this.hasTicket = false;
        this.tournamentType = null;
        
        this.modal = null;
        this.refreshInterval = null;
    }

    async open() {
        try {
            if (!this.modal) {
                this.createModal();
            }
            
            this.modal.classList.remove('d-none');
            await this.loadAllData();
            this.startAutoRefresh();
        } catch (error) {
            console.error('[TournamentRewards] Error opening:', error);
            this.showNotification('Failed to load rewards', 'error');
        }
    }

    close() {
        if (this.modal) {
            this.modal.classList.add('d-none');
        }
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.id = 'tournament-rewards-modal';
        this.modal.className = 'tournament-rewards-modal d-none';
        
        this.modal.innerHTML = `
            <div class="tournament-rewards-header">
                <button class="tournament-rewards-close" id="tournament-rewards-close">← Back</button>
                <div class="tournament-rewards-title">🏆 Tournament Rewards</div>
                <div class="tournament-rewards-coins">
                    <span id="tournament-rewards-coins">0</span>
                    <span>💰</span>
                </div>
            </div>
            
            <div class="tournament-rewards-content">
                <div id="tournament-rewards-container">
                    <div class="tournament-rewards-empty">
                        <div class="tournament-rewards-empty-icon">⏳</div>
                        <h3>Loading...</h3>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        
        document.getElementById('tournament-rewards-close').addEventListener('click', () => {
            this.close();
        });
    }

    async loadAllData() {
        try {
            await this.loadRewardConfig();
            await this.loadUserCoins();
            await this.checkUserTicket();
            
            if (this.hasTicket) {
                await this.loadTournamentData();
            }
            
            this.render();
        } catch (error) {
            console.error('[TournamentRewards] Error loading data:', error);
            this.showEmptyState('Failed to load data');
        }
    }

    async loadRewardConfig() {
        try {
            const response = await fetch(`/api/tournament/reward-config?uid=${this.uid}&token=${this.token}`, {
                cache: 'no-store'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.rewardConfig = await response.json();
        } catch (error) {
            console.error('[TournamentRewards] Error loading config:', error);
            this.rewardConfig = {
                rewards: { round1: 1000, round2: 2000, round3: 3000 },
                bonus: { all_wins: 2000 }
            };
        }
    }

    async loadUserCoins() {
        try {
            const response = await fetch(`/api/user/coins?uid=${this.uid}&token=${this.token}`, {
                cache: 'no-store'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            document.getElementById('tournament-rewards-coins').textContent = data.coins || 0;
        } catch (error) {
            console.error('[TournamentRewards] Error loading coins:', error);
        }
    }

    async checkUserTicket() {
        try {
            const response = await fetch(`/api/tournament/my-ticket?uid=${this.uid}&token=${this.token}`, {
                cache: 'no-store'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.hasTicket = data.hasTicket || false;
            this.tournamentType = data.tournamentType;
        } catch (error) {
            console.error('[TournamentRewards] Error checking ticket:', error);
            this.hasTicket = false;
        }
    }

    async loadTournamentData() {
        try {
            const response = await fetch(`/api/tournament/data?uid=${this.uid}&token=${this.token}`, {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                this.tournamentData = null;
                return;
            }
            
            const result = await response.json();
            this.tournamentData = result.data;
        } catch (error) {
            console.error('[TournamentRewards] Error loading tournament:', error);
            this.tournamentData = null;
        }
    }

    render() {
        const container = document.getElementById('tournament-rewards-container');
        
        if (!this.hasTicket) {
            container.innerHTML = `
                <div class="tournament-rewards-empty">
                    <div class="tournament-rewards-empty-icon">🎫</div>
                    <h3>No Tournament Ticket</h3>
                    <p>Purchase a ticket at one of the tournament locations to participate and view rewards!</p>
                    <div class="location-hints">
                        <div class="location-hint">🏇 Horse Racing Stadium</div>
                        <div class="location-hint">🥊 Boxing Arena</div>
                        <div class="location-hint">🏎️ Racing Track</div>
                    </div>
                </div>
            `;
            return;
        }
        
        if (!this.tournamentData) {
            this.showEmptyState('No tournament today. Come back tomorrow!');
            return;
        }
        
        const tournamentType = this.tournamentData.available_tournament;
        const tournament = this.tournamentData[tournamentType];
        
        container.innerHTML = `
            <div class="tournament-info">
                <div class="tournament-info-type">${this.getTournamentIcon(tournamentType)}</div>
                <div class="tournament-info-name">${this.getTournamentName(tournamentType)}</div>
                <div class="tournament-info-date">${this.tournamentData.date}</div>
            </div>
            
            <div class="ticket-active">
                <div class="ticket-active-icon">✅</div>
                <div class="ticket-active-text">You have an active ticket for today's tournament!</div>
            </div>
            
            <div class="tournament-rewards-grid" id="rewards-grid"></div>
            
            <div class="bonus-section" id="bonus-section" style="display: none;">
                <div class="bonus-icon">🎊</div>
                <div class="bonus-title">Perfect Score Bonus!</div>
                <div class="bonus-amount">+${this.rewardConfig.bonus.all_wins} 💰</div>
                <div class="bonus-description">${this.rewardConfig.bonus.description}</div>
                <button class="bonus-collect-btn" id="bonus-collect-btn">Collect Bonus</button>
            </div>
        `;
        
        this.renderRewardBoxes(tournamentType, tournament);
        this.checkBonusEligibility();
    }

    async renderRewardBoxes(tournamentType, tournament) {
        const grid = document.getElementById('rewards-grid');
        grid.innerHTML = '';
        
        for (let i = 1; i <= 3; i++) {
            const roundKey = (tournamentType === 'boxing' && i === 3) ? 'final' : `round${i}`;
            const round = tournament[roundKey];
            
            if (!round) continue;
            
            const box = await this.createRewardBox(tournamentType, i, round);
            grid.appendChild(box);
        }
    }

    async createRewardBox(tournamentType, roundNumber, round) {
        const box = document.createElement('div');
        box.className = 'reward-box';
        
        // ✅ Get status from server (includes remaining minutes)
        const statusData = await this.getRoundStatusFromServer(tournamentType, roundNumber);
        
        let status = 'pending';
        let statusText = 'Waiting for tournament start';
        let buttonText = 'Wait for Start';
        let buttonClass = 'waiting';
        let canCollect = false;
        
        if (statusData.completed && statusData.userSelection) {
            if (statusData.userSelection.result === 'win') {
                status = 'win';
                statusText = '✅ You Won!';
                
                const collectedKey = `round${roundNumber}_collected`;
                const rewardsStatus = await this.getUserRewardsStatus(tournamentType);
                
                if (rewardsStatus && rewardsStatus[collectedKey] === 1) {
                    buttonText = '✓ Reward Collected';
                    buttonClass = 'collected';
                } else {
                    buttonText = 'Collect Reward';
                    buttonClass = 'can-collect';
                    canCollect = true;
                }
                
                box.classList.add('win');
            } else if (statusData.userSelection.result === 'lose') {
                status = 'loss';
                statusText = '❌ You Lost';
                buttonText = '✗ No Reward';
                buttonClass = 'loss';
                box.classList.add('loss');
            }
        } else if (statusData.completed && !statusData.userSelection) {
            status = 'miss';
            statusText = '⊘ Missed';
            buttonText = '⊘ Didn\'t Participate';
            buttonClass = 'miss';
            box.classList.add('miss');
        } else if (!statusData.completed) {
            // ✅ Use server's remaining minutes calculation
            if (statusData.remainingMinutes !== undefined) {
                if (statusData.remainingMinutes <= 0) {
                    statusText = '🏁 Starting Soon...';
                } else if (statusData.remainingMinutes < 60) {
                    statusText = `⏰ ${statusData.remainingMinutes}m remaining`;
                } else {
                    const hours = Math.floor(statusData.remainingMinutes / 60);
                    const mins = statusData.remainingMinutes % 60;
                    statusText = `⏰ ${hours}h ${mins}m remaining`;
                }
            } else {
                statusText = `⏰ Starts at ${round.time}`;
            }
            buttonText = 'Wait for Results';
            buttonClass = 'waiting';
        }
        
        const roundLabel = this.getRoundLabel(tournamentType, roundNumber);
        const prize = this.rewardConfig.rewards[`round${roundNumber}`] || 0;
        
        box.innerHTML = `
            <div class="reward-box-header">
                <div class="reward-round-name">${roundLabel}</div>
                <div class="reward-prize">${prize} 💰</div>
            </div>
            
            <div class="reward-status ${status}">${statusText}</div>
            
            ${statusData.userSelection ? `
                <div class="reward-user-choice">
                    <div class="reward-user-choice-label">Your Choice:</div>
                    <div class="reward-user-choice-value">${statusData.userSelection.selected_option}</div>
                </div>
            ` : ''}
            
            <button class="reward-collect-btn ${buttonClass}" 
                    data-round="${roundNumber}" 
                    data-type="${tournamentType}"
                    data-prize="${prize}"
                    ${!canCollect ? 'disabled' : ''}>
                ${buttonText}
            </button>
        `;
        
        if (canCollect) {
            const btn = box.querySelector('.reward-collect-btn');
            btn.addEventListener('click', () => this.collectReward(tournamentType, roundNumber, prize));
        }
        
        return box;
    }

    // ✅ Get status with remaining minutes from server
    async getRoundStatusFromServer(tournamentType, roundNumber) {
        try {
            const response = await fetch(
                `/api/tournament/round-status/${tournamentType}/${roundNumber}?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) return { completed: false, remainingMinutes: null };
            
            const data = await response.json();
            
            return {
                completed: data.completed,
                userSelection: data.userSelection || null,
                remainingMinutes: data.remainingMinutes, // ✅ From server
                round: data.round
            };
        } catch (error) {
            console.error('[TournamentRewards] Error getting status:', error);
            return { completed: false, remainingMinutes: null };
        }
    }

    async getUserRewardsStatus(tournamentType) {
        try {
            const response = await fetch(
                `/api/tournament/my-rewards?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) return null;
            
            return await response.json();
        } catch (error) {
            console.error('[TournamentRewards] Error getting rewards status:', error);
            return null;
        }
    }

    async collectReward(tournamentType, roundNumber, amount) {
        try {
            const response = await fetch(`/api/tournament/collect-reward?uid=${this.uid}&token=${this.token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tournamentType,
                    roundNumber,
                    amount
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to collect reward', 'error');
                return;
            }
            
            this.showNotification(`Reward collected! +${amount} coins`, 'success');
            
            await this.loadUserCoins();
            this.render();
            
            if (window.homeInstance) {
                window.homeInstance.refreshData();
            }
            
        } catch (error) {
            console.error('[TournamentRewards] Error collecting reward:', error);
            this.showNotification('Failed to collect reward', 'error');
        }
    }

    async checkBonusEligibility() {
        try {
            const response = await fetch(`/api/tournament/check-bonus?uid=${this.uid}&token=${this.token}`, {
                cache: 'no-store'
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            
            if (data.eligible) {
                const bonusSection = document.getElementById('bonus-section');
                const bonusBtn = document.getElementById('bonus-collect-btn');
                
                bonusSection.style.display = 'block';
                
                if (data.collected) {
                    bonusBtn.textContent = '✓ Bonus Collected';
                    bonusBtn.disabled = true;
                } else {
                    bonusBtn.addEventListener('click', () => this.collectBonus());
                }
            }
        } catch (error) {
            console.error('[TournamentRewards] Error checking bonus:', error);
        }
    }

    async collectBonus() {
        try {
            const response = await fetch(`/api/tournament/collect-bonus?uid=${this.uid}&token=${this.token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to collect bonus', 'error');
                return;
            }
            
            this.showNotification(`Bonus collected! +${this.rewardConfig.bonus.all_wins} coins`, 'success');
            
            await this.loadUserCoins();
            this.render();
            
            if (window.homeInstance) {
                window.homeInstance.refreshData();
            }
            
        } catch (error) {
            console.error('[TournamentRewards] Error collecting bonus:', error);
            this.showNotification('Failed to collect bonus', 'error');
        }
    }

    getTournamentIcon(type) {
        const icons = {
            'horseRace': '🏇',
            'boxing': '🥊',
            'carRace': '🏎️'
        };
        return icons[type] || '🏆';
    }

    getTournamentName(type) {
        const names = {
            'horseRace': 'Horse Racing Stadium',
            'boxing': 'Boxing Arena',
            'carRace': 'Racing Track'
        };
        return names[type] || 'Tournament';
    }

    getRoundLabel(type, roundNumber) {
        if (type === 'boxing' && roundNumber === 3) {
            return 'Final';
        }
        return `Round ${roundNumber}`;
    }

    showEmptyState(message) {
        const container = document.getElementById('tournament-rewards-container');
        container.innerHTML = `
            <div class="tournament-rewards-empty">
                <div class="tournament-rewards-empty-icon">🏆</div>
                <h3>No Active Tournament</h3>
                <p>${message}</p>
            </div>
        `;
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(async () => {
            await this.loadAllData();
        }, 30000); // 30 seconds
    }

    showNotification(message, type = 'info') {
        if (window.NotificationSystem) {
            window.NotificationSystem.show(type, 'Tournament Rewards', message);
        } else {
            alert(message);
        }
    }
}

window.TournamentRewardsInterface = TournamentRewardsInterface;
window.tournamentRewardsInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[TournamentRewards] Script loaded - server time based');
});

// Additional CSS
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
.location-hints {
    display: grid;
    gap: 15px;
    margin-top: 30px;
}

.location-hint {
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 215, 0, 0.3);
    border-radius: 15px;
    padding: 15px;
    font-size: 1.2rem;
    font-weight: 600;
    color: #ffd700;
    text-align: center;
}

.ticket-active {
    background: rgba(78, 205, 196, 0.1);
    border: 2px solid rgba(78, 205, 196, 0.4);
    border-radius: 15px;
    padding: 20px;
    margin: 20px 0;
    display: flex;
    align-items: center;
    gap: 15px;
}

.ticket-active-icon {
    font-size: 2rem;
}

.ticket-active-text {
    color: #4ecdc4;
    font-size: 1.1rem;
    font-weight: 600;
}
`;
document.head.appendChild(additionalStyles);