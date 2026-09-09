// Car Racing Track Script - SERVER STATUS BASED (No Client Time Calculations)
class CarRaceManager {
    constructor() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.uid = this.urlParams.get('uid');
        this.token = this.urlParams.get('token');
        this.locToken = this.urlParams.get('loc_token');
        
        this.tournamentData = null;
        this.currentRound = null;
        this.selectedCar = null;
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
            console.error('[CarRace] Init failed:', error);
            this.showError('Failed to load racing track');
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
            console.error('[CarRace] Error loading coins:', error);
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
            
            if (this.tournamentType !== 'carRace') {
                this.showWrongLocation();
                return;
            }
            
            await this.loadTournamentData();
            
        } catch (error) {
            console.error('[CarRace] Error checking tournament:', error);
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
            
            this.showRacesView();
            
        } catch (error) {
            console.error('[CarRace] Error loading tournament data:', error);
            this.showError('Failed to load tournament');
        }
    }

    showTicketPurchase() {
        document.getElementById('tournament-off').style.display = 'none';
        document.getElementById('races-container').style.display = 'none';
        document.getElementById('race-view').style.display = 'none';
        
        const container = document.querySelector('.racing-container');
        let ticketView = document.getElementById('ticket-purchase-view');
        
        if (!ticketView) {
            ticketView = document.createElement('div');
            ticketView.id = 'ticket-purchase-view';
            ticketView.className = 'ticket-purchase-view';
            ticketView.innerHTML = `
                <div class="ticket-card">
                    <div class="ticket-icon">🎫</div>
                    <h2>Tournament Entry Ticket</h2>
                    <p class="ticket-description">A tournament is happening somewhere today! Purchase a ticket to find out where and participate.</p>
                    <div class="ticket-price">
                        <span class="price-label">Price:</span>
                        <span class="price-amount">${this.TICKET_PRICE} 💰</span>
                    </div>
                    <button id="buy-ticket-btn" class="buy-ticket-btn">Buy Ticket</button>
                    <p class="ticket-hint">💡 Visit different locations to find today's tournament</p>
                </div>
            `;
            container.appendChild(ticketView);
            
            document.getElementById('buy-ticket-btn').addEventListener('click', () => {
                this.buyTicket();
            });
        }
        
        ticketView.style.display = 'flex';
    }

    showWrongLocation() {
        document.getElementById('tournament-off').style.display = 'none';
        document.getElementById('races-container').style.display = 'none';
        document.getElementById('race-view').style.display = 'none';
        
        const container = document.querySelector('.racing-container');
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
                <div class="ticket-card">
                    <div class="ticket-icon">❌</div>
                    <h2>Wrong Location!</h2>
                    <p class="ticket-description">You have a ticket, but today's tournament is at:</p>
                    <div class="correct-location">
                        ${locationNames[this.tournamentType] || 'Unknown Location'}
                    </div>
                    <button id="go-back-map-btn" class="buy-ticket-btn">Back to Map</button>
                </div>
            `;
            container.appendChild(wrongView);
            
            document.getElementById('go-back-map-btn').addEventListener('click', () => {
                this.goHome();
            });
        }
        
        wrongView.style.display = 'flex';
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
            
            if (this.tournamentType !== 'carRace') {
                document.getElementById('ticket-purchase-view').style.display = 'none';
                this.showWrongLocation();
            } else {
                document.getElementById('ticket-purchase-view').style.display = 'none';
                await this.loadTournamentData();
            }
            
        } catch (error) {
            console.error('[CarRace] Error buying ticket:', error);
            this.showNotification('Failed to purchase ticket', 'error');
            const btn = document.getElementById('buy-ticket-btn');
            btn.disabled = false;
            btn.textContent = 'Buy Ticket';
        }
    }

    showTournamentOff(message) {
        document.getElementById('tournament-off').style.display = 'block';
        document.getElementById('races-container').style.display = 'none';
        document.getElementById('race-view').style.display = 'none';
        
        const ticketView = document.getElementById('ticket-purchase-view');
        if (ticketView) ticketView.style.display = 'none';
        
        const wrongView = document.getElementById('wrong-location-view');
        if (wrongView) wrongView.style.display = 'none';
    }

    showRacesView() {
        document.getElementById('tournament-off').style.display = 'none';
        document.getElementById('races-container').style.display = 'block';
        document.getElementById('race-view').style.display = 'none';
        
        const ticketView = document.getElementById('ticket-purchase-view');
        if (ticketView) ticketView.style.display = 'none';
        
        const wrongView = document.getElementById('wrong-location-view');
        if (wrongView) wrongView.style.display = 'none';
        
        document.getElementById('current-date').textContent = this.tournamentData.date;
        
        // Update all race cards
        for (let i = 1; i <= 3; i++) {
            this.updateRaceCard(i);
        }
    }

    // ✅ KEY FIX: Get status directly from server
    async updateRaceCard(roundNumber) {
        const round = this.tournamentData.carRace[`round${roundNumber}`];
        if (!round) return;
        
        const timeEl = document.getElementById(`round${roundNumber}-time`);
        const statusEl = document.getElementById(`round${roundNumber}-status`);
        const btnEl = document.getElementById(`enter-round${roundNumber}`);
        
        // Show round scheduled time
        timeEl.textContent = round.time;
        
        // Get REAL status from server (with remaining time calculation done on server)
        const statusData = await this.getRoundStatusFromServer(roundNumber);
        
        // ✅ Use server's status directly
        statusEl.textContent = statusData.statusText;
        statusEl.className = `race-status ${statusData.statusClass}`;
        
        btnEl.textContent = statusData.buttonText;
        btnEl.disabled = false;
        btnEl.className = `enter-race-btn ${statusData.buttonClass}`;
    }

    // ✅ Get complete status from server (server calculates everything)
    async getRoundStatusFromServer(roundNumber) {
        try {
            const response = await fetch(
                `/api/tournament/round-status/carRace/${roundNumber}?uid=${this.uid}&token=${this.token}`,
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
            
            // Server already calculated if completed
            if (data.completed) {
                // Race finished - show result
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
                // Race not completed yet
                // Server sends remaining minutes in response (calculated server-side)
                if (data.remainingMinutes !== undefined) {
                    if (data.remainingMinutes <= 0) {
                        statusText = '🏁 Starting Soon...';
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
            console.error('[CarRace] Error getting status:', error);
            return {
                statusText: 'Loading...',
                statusClass: '',
                buttonText: 'Enter Race',
                buttonClass: '',
                completed: false
            };
        }
    }

    async enterRace(roundNumber) {
        this.currentRound = roundNumber;
        const statusInfo = await this.getRoundStatusFromServer(roundNumber);
        
        // ✅ If completed, show results directly
        if (statusInfo.completed) {
            await this.showResults(roundNumber, statusInfo.data);
        } else {
            // Show selection screen
            await this.showSelection(roundNumber, statusInfo.data);
        }
    }

    async showSelection(roundNumber, statusData) {
        document.getElementById('races-container').style.display = 'none';
        document.getElementById('race-view').style.display = 'block';
        
        document.getElementById('race-title').textContent = `Race ${roundNumber}`;
        
        const round = this.tournamentData.carRace[`round${roundNumber}`];
        
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
        
        const carsGrid = document.getElementById('cars-grid');
        carsGrid.innerHTML = '';
        
        round.cars.forEach(car => {
            const card = document.createElement('div');
            card.className = 'car-card';
            card.dataset.number = car.number;
            
            card.innerHTML = `
                <div class="car-icon">🏎️</div>
                <div class="car-number">#${car.number}</div>
                <div class="car-name">${car.name}</div>
                <div class="car-color">${car.color}</div>
            `;
            
            card.addEventListener('click', () => this.selectCar(car.number));
            
            carsGrid.appendChild(card);
        });
        
        // Load existing selection
        if (statusData.userSelection) {
            this.selectedCar = parseInt(statusData.userSelection.selected_option);
            this.highlightSelectedCar();
            document.getElementById('confirm-selection').disabled = true;
            document.getElementById('confirm-selection').textContent = '✓ Selection Saved';
        } else {
            this.selectedCar = null;
            document.getElementById('confirm-selection').disabled = true;
            document.getElementById('confirm-selection').textContent = 'Select a Car';
        }
    }

    selectCar(number) {
        this.selectedCar = number;
        this.highlightSelectedCar();
        document.getElementById('confirm-selection').disabled = false;
        document.getElementById('confirm-selection').textContent = 'Confirm Selection';
    }

    highlightSelectedCar() {
        document.querySelectorAll('.car-card').forEach(card => {
            if (parseInt(card.dataset.number) === this.selectedCar) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    async confirmSelection() {
        if (!this.selectedCar) return;
        
        try {
            const response = await fetch(
                `/api/tournament/select?uid=${this.uid}&token=${this.token}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tournamentType: 'carRace',
                        roundNumber: this.currentRound,
                        selection: this.selectedCar.toString()
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
            console.error('[CarRace] Error saving selection:', error);
            this.showNotification('Failed to save selection', 'error');
        }
    }

    async showResults(roundNumber, statusData) {
        document.getElementById('selection-phase').style.display = 'none';
        document.getElementById('race-track').style.display = 'none';
        document.getElementById('race-results').style.display = 'block';
        
        const round = this.tournamentData.carRace[`round${roundNumber}`];
        const winnerCar = round.cars.find(c => c.number === round.winner);
        
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
            resultTitle.style.color = '#ff9f43';
        }
        
        document.getElementById('winner-name').textContent = winnerCar.name;
        document.getElementById('winner-number').textContent = `#${round.winner}`;
        document.getElementById('winner-color').textContent = winnerCar.color;
        
        if (userSelection) {
            const selectedCar = round.cars.find(
                c => c.number === parseInt(userSelection.selected_option)
            );
            document.getElementById('user-selection-display').textContent = 
                `#${userSelection.selected_option} - ${selectedCar?.name || 'Unknown'} (${selectedCar?.color || ''})`;
        } else {
            document.getElementById('user-selection-display').textContent = 'No selection made';
        }
        
        const nextBtn = document.getElementById('next-race-btn');
        if (roundNumber < 3) {
            nextBtn.textContent = 'Next Race';
            nextBtn.onclick = () => this.showRacesView();
        } else {
            nextBtn.textContent = 'Back to Races';
            nextBtn.onclick = () => this.showRacesView();
        }
    }

    startAutoRefresh() {
        // Refresh every 30 seconds
        this.updateInterval = setInterval(() => {
            if (document.getElementById('races-container').style.display !== 'none') {
                for (let i = 1; i <= 3; i++) {
                    this.updateRaceCard(i);
                }
            }
        }, 30000);
    }

    setupEventListeners() {
        document.getElementById('back-to-game')?.addEventListener('click', () => {
            this.goHome();
        });
        
        document.getElementById('back-to-races')?.addEventListener('click', () => {
            this.showRacesView();
        });
        
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`enter-round${i}`)?.addEventListener('click', () => {
                this.enterRace(i);
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
    window.carRaceManager = new CarRaceManager();
    window.carRaceManager.init();
});