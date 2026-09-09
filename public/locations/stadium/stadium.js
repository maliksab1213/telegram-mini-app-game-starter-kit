// Stadium Horse Racing Script - SERVER STATUS BASED (Fixed)
class StadiumManager {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.locToken = this.urlParams.get('loc_token');
        
        this.tournamentData = null;
        this.currentRound = null;
        this.selectedHorse = null;
        this.updateInterval = null;
        this.hasTicket = false;
        this.tournamentType = null;
        
        this.TICKET_PRICE = 10;
    }

    async init() {
        try {
            await this.loadUserCoins();
            await this.checkTicketAndTournament();
            this.setupEventListeners();
            this.startAutoRefresh();
        } catch (error) {
            console.error('[Stadium] Init failed:', error);
            this.showError('Failed to load stadium');
        }
    }

    async loadUserCoins() {
        try {
            const response = await fetch(
                `/api/user/coins?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            document.getElementById('user-coins').textContent = data.coins || 0;
        } catch (error) {
            console.error('[Stadium] Error loading coins:', error);
        }
    }

    async checkTicketAndTournament() {
        try {
            // Check ticket
            const ticketResponse = await fetch(
                `/api/tournament/my-ticket?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!ticketResponse.ok) throw new Error(`HTTP ${ticketResponse.status}`);
            
            const ticketData = await ticketResponse.json();
            this.hasTicket = ticketData.hasTicket || false;
            this.tournamentType = ticketData.tournamentType;
            
            if (!this.hasTicket) {
                this.showTicketPurchase();
                return;
            }
            
            if (this.tournamentType !== 'horseRace') {
                this.showWrongLocation();
                return;
            }
            
            await this.loadTournamentData();
            
        } catch (error) {
            console.error('[Stadium] Error checking tournament:', error);
            this.showError('Failed to load tournament');
        }
    }

    async loadTournamentData() {
        try {
            const response = await fetch(
                `/api/tournament/data?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) {
                if (response.status === 403) {
                    this.showTicketPurchase();
                } else {
                    this.showTournamentOff('No tournament today');
                }
                return;
            }
            
            const result = await response.json();
            this.tournamentData = result.data;
            
            this.showRoundsView();
            
        } catch (error) {
            console.error('[Stadium] Error loading tournament data:', error);
            this.showError('Failed to load tournament');
        }
    }

    showTicketPurchase() {
        document.getElementById('tournament-off').style.display = 'none';
        document.getElementById('rounds-container').style.display = 'none';
        document.getElementById('race-view').style.display = 'none';
        
        const container = document.querySelector('.stadium-container');
        let ticketView = document.getElementById('ticket-purchase-view');
        
        if (!ticketView) {
            ticketView = document.createElement('div');
            ticketView.id = 'ticket-purchase-view';
            ticketView.className = 'ticket-purchase-view';
            ticketView.innerHTML = `
                <div class="ticket-card" style="max-width: 500px; margin: 50px auto; padding: 40px; background: rgba(0,0,0,0.4); border-radius: 20px; border: 2px solid rgba(139,69,19,0.3); text-align: center;">
                    <div class="ticket-icon" style="font-size: 5rem; margin-bottom: 20px;">🎫</div>
                    <h2 style="color: #ffd700; margin-bottom: 20px;">Tournament Entry Ticket</h2>
                    <p class="ticket-description" style="color: #ccc; margin-bottom: 30px;">A tournament is happening somewhere today! Purchase a ticket to find out where and participate.</p>
                    <div class="ticket-price" style="background: rgba(255,215,0,0.1); padding: 15px; border-radius: 15px; margin-bottom: 30px;">
                        <span class="price-label" style="color: #aaa;">Price: </span>
                        <span class="price-amount" style="color: #ffd700; font-size: 1.5rem; font-weight: 700;">${this.TICKET_PRICE} 💰</span>
                    </div>
                    <button id="buy-ticket-btn" style="background: linear-gradient(135deg, #ffd700, #ff8c00); border: none; border-radius: 12px; padding: 15px 40px; font-size: 1.1rem; font-weight: 700; color: #000; cursor: pointer;">Buy Ticket</button>
                    <p class="ticket-hint" style="color: #888; margin-top: 20px; font-size: 0.9rem;">💡 Visit different locations to find today's tournament</p>
                </div>
            `;
            container.appendChild(ticketView);
            
            document.getElementById('buy-ticket-btn').addEventListener('click', () => {
                this.buyTicket();
            });
        }
        
        ticketView.style.display = 'block';
    }

    showWrongLocation() {
        document.getElementById('tournament-off').style.display = 'none';
        document.getElementById('rounds-container').style.display = 'none';
        document.getElementById('race-view').style.display = 'none';
        
        const container = document.querySelector('.stadium-container');
        let wrongView = document.getElementById('wrong-location-view');
        
        if (!wrongView) {
            wrongView = document.createElement('div');
            wrongView.id = 'wrong-location-view';
            wrongView.className = 'ticket-purchase-view';
            
            const locationNames = {
                'horseRace': '🏇 Horse Racing Stadium',
                'boxing': '🥊 Boxing Arena',
                'carRace': '🏎️ Racing Track'
            };
            
            wrongView.innerHTML = `
                <div class="ticket-card" style="max-width: 500px; margin: 50px auto; padding: 40px; background: rgba(0,0,0,0.4); border-radius: 20px; border: 2px solid rgba(139,69,19,0.3); text-align: center;">
                    <div class="ticket-icon" style="font-size: 5rem; margin-bottom: 20px;">❌</div>
                    <h2 style="color: #ffd700; margin-bottom: 20px;">Wrong Location!</h2>
                    <p class="ticket-description" style="color: #ccc; margin-bottom: 20px;">You have a ticket, but today's tournament is at:</p>
                    <div class="correct-location" style="background: rgba(255,215,0,0.1); padding: 20px; border-radius: 15px; margin-bottom: 30px; font-size: 1.3rem; color: #ffd700; font-weight: 700;">
                        ${locationNames[this.tournamentType] || 'Unknown Location'}
                    </div>
                    <button id="go-back-map-btn" style="background: linear-gradient(135deg, #ffd700, #ff8c00); border: none; border-radius: 12px; padding: 15px 40px; font-size: 1.1rem; font-weight: 700; color: #000; cursor: pointer;">Back to Map</button>
                </div>
            `;
            container.appendChild(wrongView);
            
            document.getElementById('go-back-map-btn').addEventListener('click', () => {
                this.goHome();
            });
        }
        
        wrongView.style.display = 'block';
    }

    async buyTicket() {
        try {
            const btn = document.getElementById('buy-ticket-btn');
            btn.disabled = true;
            btn.textContent = 'Purchasing...';
            
            const response = await fetch(
                `/api/tournament/buy-ticket?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            
            const result = await response.json();
            
            if (!response.ok) {
                this.showNotification(result.error || 'Failed to buy ticket', 'error');
                btn.disabled = false;
                btn.textContent = 'Buy Ticket';
                return;
            }
            
            this.showNotification('Ticket purchased! 🎫', 'success');
            this.hasTicket = true;
            this.tournamentType = result.tournamentType;
            
            await this.loadUserCoins();
            
            if (this.tournamentType !== 'horseRace') {
                document.getElementById('ticket-purchase-view').style.display = 'none';
                this.showWrongLocation();
            } else {
                document.getElementById('ticket-purchase-view').style.display = 'none';
                await this.loadTournamentData();
            }
            
        } catch (error) {
            console.error('[Stadium] Error buying ticket:', error);
            this.showNotification('Failed to purchase ticket', 'error');
            const btn = document.getElementById('buy-ticket-btn');
            btn.disabled = false;
            btn.textContent = 'Buy Ticket';
        }
    }

    showTournamentOff(message) {
        document.getElementById('tournament-off').style.display = 'block';
        document.getElementById('rounds-container').style.display = 'none';
        document.getElementById('race-view').style.display = 'none';
        
        const ticketView = document.getElementById('ticket-purchase-view');
        if (ticketView) ticketView.style.display = 'none';
        
        const wrongView = document.getElementById('wrong-location-view');
        if (wrongView) wrongView.style.display = 'none';
    }

    showRoundsView() {
        document.getElementById('tournament-off').style.display = 'none';
        document.getElementById('rounds-container').style.display = 'block';
        document.getElementById('race-view').style.display = 'none';
        
        const ticketView = document.getElementById('ticket-purchase-view');
        if (ticketView) ticketView.style.display = 'none';
        
        const wrongView = document.getElementById('wrong-location-view');
        if (wrongView) wrongView.style.display = 'none';
        
        document.getElementById('current-date').textContent = this.tournamentData.date;
        
        for (let i = 1; i <= 3; i++) {
            this.updateRoundCard(i);
        }
    }

    async updateRoundCard(roundNumber) {
        const round = this.tournamentData[`round${roundNumber}`];
        if (!round) return;
        
        const timeEl = document.getElementById(`round${roundNumber}-time`);
        const statusEl = document.getElementById(`round${roundNumber}-status`);
        const btnEl = document.getElementById(`enter-round${roundNumber}`);
        
        timeEl.textContent = round.time;
        
        // ✅ Get status from server
        const statusData = await this.getRoundStatusFromServer(roundNumber);
        
        statusEl.textContent = statusData.statusText;
        statusEl.className = `round-status ${statusData.statusClass}`;
        
        btnEl.textContent = statusData.buttonText;
        btnEl.disabled = false;
        btnEl.className = `enter-round-btn ${statusData.buttonClass}`;
    }

    async getRoundStatusFromServer(roundNumber) {
        try {
            const response = await fetch(
                `/api/tournament/round-status/horseRace/${roundNumber}?uid=${this.uid}&token=${this.token}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) {
                return {
                    statusText: 'Error',
                    statusClass: '',
                    buttonText: 'Try Again',
                    buttonClass: '',
                    completed: false
                };
            }
            
            const data = await response.json();
            
            let statusText = '';
            let statusClass = '';
            let buttonText = '';
            let buttonClass = '';
            
            if (data.completed) {
                if (data.userSelection) {
                    if (data.userSelection.result === 'win') {
                        statusText = '✅ You Won!';
                        statusClass = 'completed win';
                        buttonText = '🎉 You Won!';
                        buttonClass = 'win';
                    } else {
                        statusText = '❌ You Lost';
                        statusClass = 'completed loss';
                        buttonText = '😢 You Lost';
                        buttonClass = 'loss';
                    }
                } else {
                    statusText = '✓ Completed';
                    statusClass = 'completed';
                    buttonText = 'View Results';
                    buttonClass = '';
                }
            } else {
                // ✅ Use server's remaining minutes
                if (data.remainingMinutes !== undefined) {
                    if (data.remainingMinutes <= 0) {
                        statusText = '🏇 Starting Soon...';
                        statusClass = 'in-progress';
                        buttonText = 'Enter Race';
                        buttonClass = 'pending';
                    } else if (data.remainingMinutes < 60) {
                        statusText = `⏰ ${data.remainingMinutes}m remaining`;
                        statusClass = 'pending';
                        buttonText = 'Enter Race';
                        buttonClass = 'pending';
                    } else {
                        const hours = Math.floor(data.remainingMinutes / 60);
                        const mins = data.remainingMinutes % 60;
                        statusText = `⏰ ${hours}h ${mins}m remaining`;
                        statusClass = 'pending';
                        buttonText = 'Enter Race';
                        buttonClass = 'pending';
                    }
                } else {
                    statusText = `⏰ Starts at ${data.round.time}`;
                    statusClass = 'pending';
                    buttonText = 'Enter Race';
                    buttonClass = 'pending';
                }
            }
            
            return {
                statusText,
                statusClass,
                buttonText,
                buttonClass,
                completed: data.completed,
                data
            };
            
        } catch (error) {
            console.error('[Stadium] Error getting status:', error);
            return {
                statusText: 'Loading...',
                statusClass: '',
                buttonText: 'Enter Race',
                buttonClass: '',
                completed: false
            };
        }
    }

    async enterRound(roundNumber) {
        this.currentRound = roundNumber;
        const statusInfo = await this.getRoundStatusFromServer(roundNumber);
        
        // ✅ Show results directly if completed
        if (statusInfo.completed) {
            await this.showResults(roundNumber, statusInfo.data);
        } else {
            await this.showSelection(roundNumber, statusInfo.data);
        }
    }

    async showSelection(roundNumber, statusData) {
        document.getElementById('rounds-container').style.display = 'none';
        document.getElementById('race-view').style.display = 'block';
        
        document.getElementById('race-title').textContent = `Race ${roundNumber}`;
        
        const round = this.tournamentData[`round${roundNumber}`];
        
        // ✅ Show server's remaining time
        const countdownEl = document.getElementById('race-countdown');
        if (statusData.remainingMinutes !== undefined) {
            if (statusData.remainingMinutes <= 0) {
                countdownEl.textContent = 'Starting Soon...';
            } else if (statusData.remainingMinutes < 60) {
                countdownEl.textContent = `${statusData.remainingMinutes}m remaining`;
            } else {
                const hours = Math.floor(statusData.remainingMinutes / 60);
                const mins = statusData.remainingMinutes % 60;
                countdownEl.textContent = `${hours}h ${mins}m remaining`;
            }
        } else {
            countdownEl.textContent = `Starts at ${round.time}`;
        }
        
        document.getElementById('selection-phase').style.display = 'block';
        document.getElementById('race-track').style.display = 'none';
        document.getElementById('race-results').style.display = 'none';
        
        const horsesGrid = document.getElementById('horses-grid');
        horsesGrid.innerHTML = '';
        
        round.horses.forEach(horse => {
            const card = document.createElement('div');
            card.className = 'horse-card';
            card.dataset.number = horse.number;
            
            card.innerHTML = `
                <div class="horse-icon">🏇</div>
                <div class="horse-number">#${horse.number}</div>
                <div class="horse-rider">${horse.rider}</div>
            `;
            
            card.addEventListener('click', () => this.selectHorse(horse.number));
            
            horsesGrid.appendChild(card);
        });
        
        // Load existing selection
        if (statusData.userSelection) {
            this.selectedHorse = parseInt(statusData.userSelection.selected_option);
            this.highlightSelectedHorse();
            document.getElementById('confirm-selection').disabled = true;
            document.getElementById('confirm-selection').textContent = '✓ Selection Saved';
        } else {
            this.selectedHorse = null;
            document.getElementById('confirm-selection').disabled = true;
            document.getElementById('confirm-selection').textContent = 'Select a Horse';
        }
    }

    selectHorse(number) {
        this.selectedHorse = number;
        this.highlightSelectedHorse();
        document.getElementById('confirm-selection').disabled = false;
        document.getElementById('confirm-selection').textContent = 'Confirm Selection';
    }

    highlightSelectedHorse() {
        document.querySelectorAll('.horse-card').forEach(card => {
            if (parseInt(card.dataset.number) === this.selectedHorse) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    async confirmSelection() {
        if (!this.selectedHorse) return;
        
        try {
            const response = await fetch(
                `/api/tournament/select?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tournamentType: 'horseRace',
                        roundNumber: this.currentRound,
                        selection: this.selectedHorse.toString()
                    })
                }
            );
            
            if (!response.ok) {
                const error = await response.json();
                this.showNotification(error.error || 'Selection failed', 'error');
                return;
            }
            
            this.showNotification('Selection saved! Wait for race...', 'success');
            document.getElementById('confirm-selection').disabled = true;
            document.getElementById('confirm-selection').textContent = '✓ Selection Saved';
            
        } catch (error) {
            console.error('[Stadium] Error saving selection:', error);
            this.showNotification('Failed to save selection', 'error');
        }
    }

    async showResults(roundNumber, statusData) {
        document.getElementById('selection-phase').style.display = 'none';
        document.getElementById('race-track').style.display = 'none';
        document.getElementById('race-results').style.display = 'block';
        
        const round = this.tournamentData[`round${roundNumber}`];
        const winnerHorse = round.horses.find(h => h.number === round.winner);
        
        const userSelection = statusData?.userSelection;
        let isWinner = false;
        
        if (userSelection) {
            isWinner = parseInt(userSelection.selected_option) === round.winner;
        }
        
        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        
        if (isWinner) {
            resultIcon.textContent = '🎉';
            resultTitle.textContent = 'You Win!';
            resultTitle.style.color = '#4ecdc4';
        } else if (userSelection) {
            resultIcon.textContent = '😢';
            resultTitle.textContent = 'You Lose';
            resultTitle.style.color = '#ff6b6b';
        } else {
            resultIcon.textContent = '🏁';
            resultTitle.textContent = 'Race Completed';
            resultTitle.style.color = '#ffd700';
        }
        
        document.getElementById('winner-name').textContent = winnerHorse.rider;
        document.getElementById('winner-number').textContent = `#${round.winner}`;
        
        if (userSelection) {
            const selectedHorse = round.horses.find(
                h => h.number === parseInt(userSelection.selected_option)
            );
            document.getElementById('user-selection-display').textContent = 
                `#${userSelection.selected_option} - ${selectedHorse?.rider || 'Unknown'}`;
        } else {
            document.getElementById('user-selection-display').textContent = 'No selection made';
        }
        
        const nextBtn = document.getElementById('next-round-btn');
        if (roundNumber < 3) {
            nextBtn.textContent = 'Next Race';
            nextBtn.onclick = () => this.showRoundsView();
        } else {
            nextBtn.textContent = 'Back to Races';
            nextBtn.onclick = () => this.showRoundsView();
        }
    }

    startAutoRefresh() {
        this.updateInterval = setInterval(() => {
            if (document.getElementById('rounds-container').style.display !== 'none') {
                for (let i = 1; i <= 3; i++) {
                    this.updateRoundCard(i);
                }
            }
        }, 30000);
    }

    setupEventListeners() {
        document.getElementById('back-to-game')?.addEventListener('click', () => {
            this.goHome();
        });
        
        document.getElementById('back-to-rounds')?.addEventListener('click', () => {
            this.showRoundsView();
        });
        
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`enter-round${i}`)?.addEventListener('click', () => {
                this.enterRound(i);
            });
        }
        
        document.getElementById('confirm-selection')?.addEventListener('click', () => {
            this.confirmSelection();
        });
    }

    goHome() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        
        this.showNotification('Returning to game...', 'info');
        setTimeout(() => {
            window.location.href = `/game?uid=${this.uid}&token=${this.token}`;
        }, 500);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${
                type === 'success' ? 'rgba(78, 205, 196, 0.9)' : 
                type === 'warning' ? 'rgba(255, 193, 7, 0.9)' :
                type === 'error' ? 'rgba(255, 107, 107, 0.9)' : 
                'rgba(52, 152, 219, 0.9)'
            };
            color: #fff;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.stadiumManager = new StadiumManager();
    window.stadiumManager.init();
});