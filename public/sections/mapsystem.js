// public/sections/mapsystem.js

class MapSystemInterface {
    constructor() {
        this.isOpen = false;
        this.cityLocations = [];
        this.travelInfo = { travelEnergy: 0, vehicleMap: null };
        this.inventory = null;
        this.urlParams = null;
        this.userCoins = 0;
        this._imageLoaded = false;
        this.init();
    }

    init() {
        this.urlParams = new URLSearchParams(window.location.search);
        this.createMapHTML();
        this.setupEventListeners();
        this._preloadMapImage();
        console.log('[MapSystem] Initialized');
    }

    _preloadMapImage() {
        if (this._imageLoaded) return;
        const img = new Image();
        img.onload = () => {
            this._imageLoaded = true;
            const bg     = document.getElementById('map-city-bg');
            const pins   = document.getElementById('map-pins-layer');
            const atmos  = document.getElementById('map-atmosphere');
            const loader = document.getElementById('map-img-loader');
            if (bg)     { bg.src = img.src; bg.style.opacity = '1'; }
            if (loader) loader.style.display = 'none';
            if (pins)   pins.style.display = 'block';
            if (atmos)  atmos.classList.add('visible');
        };
        img.fetchPriority = 'high';
        img.decoding = 'async';
        img.src = '/public/sections/city_map.webp';
    }

    // ── Location config ───────────────────────────────────────────────────
    // x, y       : position on image as % (left, top)
    // iconClass  : CSS class for the icon shape (see map.css)
    // color      : pin border/accent color
    // bg         : pin background color
    // size       : pin circle size in px
    // label      : text shown below pin
    // labelSize  : font size of label (e.g. '0.6rem')
    // labelGap   : gap between pin and label (e.g. '2px')
    _getLocationConfig() {
        return {
            cityBank: {
                id: 'cityBank', name: 'City Bank',
                iconClass: 'icon-bank',
                color: '#ffd700', bg: '#1a1500',
                x: 20, y: 55, size: 25,
                label: 'BANK', labelSize: '0.58rem', labelGap: '2px'
            },
            casino: {
                id: 'casino', name: 'Casino',
                iconClass: 'icon-casino',
                color: '#ff4757', bg: '#1a0000',
                x: 73, y: 38, size: 25,
                label: 'CASINO', labelSize: '0.58rem', labelGap: '2px'
            },
            stadium: {
                id: 'stadium', name: 'Stadium',
                iconClass: 'icon-stadium',
                color: '#2ed573', bg: '#001a08',
                x: 12, y: 65, size: 20,
                label: 'STADIUM', labelSize: '0.58rem', labelGap: '2px'
            },
            games: {
                id: 'games', name: 'Game Zone',
                iconClass: 'icon-games',
                color: '#1e90ff', bg: '#00091a',
                x: 85, y: 69, size: 25,
                label: 'GAMES', labelSize: '0.58rem', labelGap: '2px'
            },
            carrace: {
                id: 'carrace', name: 'Car Race',
                iconClass: 'icon-carrace',
                color: '#ff6b35', bg: '#1a0800',
                x: 13, y: 78, size: 25,
                label: 'RACING', labelSize: '0.58rem', labelGap: '2px'
            },
            boxing: {
                id: 'boxing', name: 'Boxing Arena',
                iconClass: 'icon-boxing',
                color: '#ff4757', bg: '#1a0004',
                x: 63, y: 77, size: 25,
                label: 'BOXING', labelSize: '0.58rem', labelGap: '2px'
            },
        };
    }

    createMapHTML() {
        const mapHTML = `
        <div id="map-system-modal" class="map-modal d-none">

            <div class="map-area">

                <!-- Spinner until image loads -->
                <div id="map-img-loader" class="map-img-loader">
                    <div class="map-spinner"></div>
                    <p>Loading map...</p>
                </div>

                <!-- City image -->
                <img id="map-city-bg" class="map-city-bg" alt="City Map" style="opacity:0" />

                <!-- Wind/atmosphere layer — hidden until image loaded -->
                <div id="map-atmosphere" class="map-atmosphere" style="display:none">
                    <div class="wind-streak"></div>
                    <div class="wind-streak"></div>
                    <div class="wind-streak"></div>
                    <div class="wind-streak"></div>
                    <div class="wind-streak"></div>
                    <div class="wind-streak"></div>
                    <div class="wind-streak"></div>
                    <div class="wind-streak"></div>
                    <div class="dust-particle"></div>
                    <div class="dust-particle"></div>
                    <div class="dust-particle"></div>
                    <div class="dust-particle"></div>
                    <div class="dust-particle"></div>
                </div>

                <!-- Pins layer — hidden until image loaded -->
                <div id="map-pins-layer" class="map-pins-layer" style="display:none"></div>

            </div>

            <!-- HUD bottom bar -->
            <div class="map-hud">
                <button class="map-hud-close" id="map-system-close-btn">✕</button>

                <div class="map-hud-energy" id="use-power-drink-btn">
                    <span class="hud-icon">⚡</span>
                    <div class="hud-track">
                        <div class="hud-fill" id="map-travel-energy-fill" style="width:0%"></div>
                    </div>
                    <span class="hud-pct" id="map-travel-energy-percent">0%</span>
                </div>

                <div class="map-hud-vehicle" id="select-transport-btn">
                    <span class="hud-icon">🚗</span>
                    <span id="selected-transport-name">Walking</span>
                </div>
            </div>

            <!-- Energy drink sheet -->
            <div id="power-drink-modal" class="sheet-modal d-none">
                <div class="sheet-box">
                    <div class="sheet-head">
                        <span>⚡ Energy Drinks</span>
                        <button id="close-power-drink-modal" class="sheet-close">✕</button>
                    </div>
                    <div id="power-drinks-list" class="sheet-list"></div>
                </div>
            </div>

            <!-- Vehicle sheet -->
            <div id="transport-select-modal" class="sheet-modal d-none">
                <div class="sheet-box">
                    <div class="sheet-head">
                        <span>🚗 Select Vehicle</span>
                        <button id="close-transport-modal" class="sheet-close">✕</button>
                    </div>
                    <div id="transport-vehicles-list" class="sheet-list"></div>
                </div>
            </div>

            <!-- Travel confirm -->
            <div id="travel-confirm-modal" class="travel-confirm-modal d-none">
                <div class="travel-confirm-content">
                    <div class="travel-icon">🌍</div>
                    <h3 id="travel-dest-name">Destination</h3>
                    <div class="travel-details">
                        <p id="travel-energy-cost-info"></p>
                        <p id="travel-transport-info"></p>
                    </div>
                    <div class="travel-buttons">
                        <button class="travel-cancel-btn" id="travel-cancel-action">Cancel</button>
                        <button class="travel-go-btn" id="travel-execute-action">Travel</button>
                    </div>
                </div>
            </div>

        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', mapHTML);
    }

    setupEventListeners() {
        document.getElementById('map-system-close-btn')?.addEventListener('click', () => this.close());
        document.getElementById('use-power-drink-btn')?.addEventListener('click', () => this.openPowerDrinkModal());
        document.getElementById('select-transport-btn')?.addEventListener('click', () => this.openTransportModal());
        document.getElementById('close-power-drink-modal')?.addEventListener('click', () => this.closePowerDrinkModal());
        document.getElementById('close-transport-modal')?.addEventListener('click', () => this.closeTransportModal());
    }

    async open() {
        const modal = document.getElementById('map-system-modal');
        if (!modal) return;
        modal.classList.remove('d-none');
        this.isOpen = true;

        await Promise.all([
            this.loadCityLocations(),
            this.loadTravelInfo(),
            this.loadInventory(),
            this.loadUserCoins()
        ]);

        this.updateEnergyDisplay();
        this.updateTransportDisplay();
        this.renderPins();
    }

    close() {
        document.getElementById('map-system-modal')?.classList.add('d-none');
        this.isOpen = false;
    }

    renderPins() {
        const layer = document.getElementById('map-pins-layer');
        if (!layer) return;
        const config = this._getLocationConfig();

        const toRender = this.cityLocations.length > 0
            ? this.cityLocations.map(loc => ({ ...config[loc.id], ...loc })).filter(l => l.x !== undefined)
            : Object.values(config);

        layer.innerHTML = toRender.map(loc => {
            let iconContent = '';
            
            // Bank icon needs special child elements
            if (loc.iconClass === 'icon-bank') {
                iconContent = `
                    <div class="icon-bank-roof"></div>
                    <div class="icon-bank-body"></div>
                `;
            }
            // Casino icon needs "7" text
            else if (loc.iconClass === 'icon-casino') {
                iconContent = '7';
            }
            
            return `
            <button class="map-pin" data-location-id="${loc.id}"
                style="
                    left:${loc.x}%;
                    top:${loc.y}%;
                    --pin-color:${loc.color};
                    --pin-bg:${loc.bg};
                    --pin-size:${loc.size}px;
                    --label-size:${loc.labelSize};
                    --label-gap:${loc.labelGap};
                "
                title="${loc.name}">
                <div class="pin-icon">
                    <div class="pin-icon-inner ${loc.iconClass}">${iconContent}</div>
                </div>
                <div class="pin-needle"></div>
                <span class="pin-label">${loc.label}</span>
            </button>`;
        }).join('');

        layer.querySelectorAll('.map-pin').forEach(btn =>
            btn.addEventListener('click', () => this.showTravelConfirm(btn.dataset.locationId))
        );

        if (this._imageLoaded) layer.style.display = 'block';
    }

    // ── Data loaders ──────────────────────────────────────────────────────

    async loadUserCoins() {
        try {
            const { uid, token } = this._params();
            const res = await fetch(`/api/user/coins?uid=${uid}&token=${token}`, { cache: 'no-store' });
            if (res.ok) { const d = await res.json(); this.userCoins = d.coins || 0; }
        } catch (e) { this.userCoins = 0; }
    }

    async loadCityLocations() {
        try {
            const { uid, token } = this._params();
            const res = await fetch(`/api/mapsystem/locations?uid=${uid}&token=${token}`);
            if (res.ok) { const d = await res.json(); this.cityLocations = d.locations || []; }
        } catch (e) { this.cityLocations = []; }
    }

    async loadTravelInfo() {
        try {
            const { uid, token } = this._params();
            const res = await fetch(`/api/travelsystem/info?uid=${uid}&token=${token}`, { cache: 'no-store' });
            if (res.ok) {
                const d = await res.json();
                this.travelInfo = { travelEnergy: d.travelEnergy || 0, vehicleMap: d.vehicleMap };
            }
        } catch (e) { console.error('[MapSystem] loadTravelInfo:', e); }
    }

    async loadInventory() {
        try {
            const { uid, token } = this._params();
            const res = await fetch(`/api/inventory?uid=${uid}&token=${token}`, { cache: 'no-store' });
            if (res.ok) this.inventory = await res.json();
        } catch (e) { console.error('[MapSystem] loadInventory:', e); }
    }

    // ── HUD ───────────────────────────────────────────────────────────────

    updateEnergyDisplay() {
        const pct  = this.travelInfo.travelEnergy;
        const fill = document.getElementById('map-travel-energy-fill');
        const text = document.getElementById('map-travel-energy-percent');
        if (fill) {
            fill.style.width = `${pct}%`;
            fill.style.background = pct > 60 ? '#2ed573' : pct > 30 ? '#ffd700' : '#ff4757';
        }
        if (text) text.textContent = `${pct}%`;
    }

    updateTransportDisplay() {
        const el = document.getElementById('selected-transport-name');
        if (!el) return;
        if (this.travelInfo.vehicleMap && this.inventory) {
            const v = this.inventory.slots.find(s => s && s.id === this.travelInfo.vehicleMap);
            el.textContent = v ? v.name : 'Walking';
        } else {
            el.textContent = 'Walking';
        }
    }

    // ── Travel confirm ────────────────────────────────────────────────────

    async showTravelConfirm(locationId) {
        const config   = this._getLocationConfig();
        const location = this.cityLocations.find(l => l.id === locationId) || config[locationId];
        if (!location) return;

        await this.loadUserCoins();
        const { uid, token } = this._params();

        try {
            const res = await fetch(`/api/mapsystem/calculate-cost?uid=${uid}&token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationId })
            });
            const data = await res.json();

            const modal     = document.getElementById('travel-confirm-modal');
            const nameEl    = document.getElementById('travel-dest-name');
            const costEl    = document.getElementById('travel-energy-cost-info');
            const transEl   = document.getElementById('travel-transport-info');
            const cancelBtn = document.getElementById('travel-cancel-action');
            const goBtn     = document.getElementById('travel-execute-action');

            if (nameEl) nameEl.textContent = location.name;
            cancelBtn.onclick = () => modal.classList.add('d-none');

            if (!data.canAfford) {
                const CASH_COST = 450;
                const canAffordCash = this.userCoins >= CASH_COST;
                if (costEl) costEl.innerHTML = `<strong style="color:#ff6b6b">Not enough energy!</strong><br>Need ${data.energyCost}%, have ${data.currentEnergy}%<br><span style="color:#ffd700">Cash: ${CASH_COST} coins</span>`;
                if (transEl) transEl.innerHTML = canAffordCash
                    ? `<span style="color:#4ecdc4">You have ${this.userCoins} coins ✓</span>`
                    : `<span style="color:#ff6b6b">Need ${CASH_COST}, have ${this.userCoins}</span>`;
                modal.classList.remove('d-none');
                if (canAffordCash) {
                    goBtn.textContent = `Pay ${CASH_COST} Coins`; goBtn.disabled = false;
                    goBtn.style.opacity = '1'; goBtn.style.cursor = 'pointer';
                    goBtn.onclick = () => { modal.classList.add('d-none'); this.executeTravelWithCash(locationId); };
                } else {
                    goBtn.textContent = 'Cannot Travel'; goBtn.disabled = true;
                    goBtn.style.opacity = '0.5'; goBtn.style.cursor = 'not-allowed'; goBtn.onclick = null;
                }
                return;
            }

            if (costEl)  costEl.textContent  = `Energy cost: ${data.energyCost}%`;
            if (transEl) transEl.textContent  = `Using: ${data.transportMode}`;
            modal.classList.remove('d-none');
            goBtn.textContent = 'Travel'; goBtn.disabled = false;
            goBtn.style.opacity = '1'; goBtn.style.cursor = 'pointer';
            goBtn.onclick = () => { modal.classList.add('d-none'); this.executeTravel(locationId); };

        } catch (e) {
            console.error('[MapSystem] showTravelConfirm:', e);
            this.showNotification('error', 'Error', 'Failed to calculate travel cost');
        }
    }

    async executeTravelWithCash(locationId) {
        const { uid, token } = this._params();
        this.showLoading('Traveling...');
        try {
            const res = await fetch(`/api/mapsystem/execute-travel?uid=${uid}&token=${token}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationId, useCash: true })
            });
            const result = await res.json();
            if (result.success) setTimeout(() => { window.location.href = result.locationUrl; }, 500);
            else { this.hideLoading(); this.showNotification('error', 'Travel Failed', result.error); }
        } catch (e) { this.hideLoading(); this.showNotification('error', 'Error', 'Failed to travel'); }
    }

    async executeTravel(locationId) {
        const { uid, token } = this._params();
        this.showLoading('Traveling...');
        try {
            const res = await fetch(`/api/mapsystem/execute-travel?uid=${uid}&token=${token}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationId })
            });
            const result = await res.json();
            if (result.success) setTimeout(() => { window.location.href = result.locationUrl; }, 500);
            else { this.hideLoading(); this.showNotification('error', 'Travel Failed', result.error); }
        } catch (e) { this.hideLoading(); this.showNotification('error', 'Error', 'Failed to travel'); }
    }

    // ── Energy drink modal ────────────────────────────────────────────────

    openPowerDrinkModal() {
        const modal = document.getElementById('power-drink-modal');
        const list  = document.getElementById('power-drinks-list');
        if (!this.inventory) {
            list.innerHTML = '<p style="text-align:center;color:#888;padding:20px">Loading...</p>';
            modal.classList.remove('d-none'); return;
        }
        const drinks = this.inventory.slots.filter(s => s && s.type === 'powerDrink');
        if (!drinks.length) {
            list.innerHTML = '<div style="text-align:center;color:#666;padding:30px"><p>No energy drinks</p><p style="font-size:0.8rem;margin-top:6px">Buy from the shop</p></div>';
        } else {
            list.innerHTML = drinks.map(d => `
                <div class="sheet-item">
                    <span class="sheet-icon">${d.icon}</span>
                    <div class="sheet-info">
                        <div class="sheet-name">${d.name}</div>
                        <div class="sheet-sub">+${d.energyRestore}% Energy</div>
                    </div>
                    <button class="sheet-btn" data-item-id="${d.id}" data-energy="${d.energyRestore}">Use</button>
                </div>`).join('');
            list.querySelectorAll('.sheet-btn').forEach(btn =>
                btn.addEventListener('click', () => this.usePowerDrink(btn.dataset.itemId, parseInt(btn.dataset.energy)))
            );
        }
        modal.classList.remove('d-none');
    }

    closePowerDrinkModal() {
        document.getElementById('power-drink-modal')?.classList.add('d-none');
    }

    async usePowerDrink(itemId, energyRestore) {
        const { uid, token } = this._params();
        try {
            const res = await fetch(`/api/travelsystem/use-drink?uid=${uid}&token=${token}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, energyRestore })
            });
            const result = await res.json();
            if (result.success) {
                this.travelInfo.travelEnergy = result.travelEnergy;
                this.updateEnergyDisplay();
                await this.loadInventory();
                if (window.inventoryManagerInstance) await window.inventoryManagerInstance.forceRefresh();
                this.closePowerDrinkModal();
                let msg = `Energy restored to ${result.travelEnergy}%`;
                if (result.energyWasted > 0) msg += ` (${result.energyWasted}% wasted)`;
                this.showNotification('success', 'Energy Restored', msg);
                setTimeout(() => this.openPowerDrinkModal(), 300);
            } else {
                this.showNotification('error', 'Failed', result.message);
            }
        } catch (e) { this.showNotification('error', 'Error', 'Failed to use energy drink'); }
    }

    // ── Vehicle modal ─────────────────────────────────────────────────────

    openTransportModal() {
        const modal = document.getElementById('transport-select-modal');
        const list  = document.getElementById('transport-vehicles-list');
        if (!this.inventory) {
            list.innerHTML = '<p style="text-align:center;color:#888;padding:20px">Loading...</p>';
            modal.classList.remove('d-none'); return;
        }
        const vehicles = this.inventory.slots.filter(s => s && s.type === 'transportVehicle');
        const walkSel  = !this.travelInfo.vehicleMap;
        list.innerHTML = `
            <div class="sheet-item ${walkSel ? 'sheet-item-active' : ''}">
                <span class="sheet-icon">🚶</span>
                <div class="sheet-info">
                    <div class="sheet-name">Walking</div>
                    <div class="sheet-sub">100% Energy</div>
                </div>
                <button class="sheet-btn" data-vehicle-id="null">${walkSel ? '✓ Active' : 'Select'}</button>
            </div>` +
            vehicles.map(v => {
                const sel = this.travelInfo.vehicleMap === v.id;
                return `
                <div class="sheet-item ${sel ? 'sheet-item-active' : ''}">
                    <span class="sheet-icon">${v.icon}</span>
                    <div class="sheet-info">
                        <div class="sheet-name">${v.name}</div>
                        <div class="sheet-sub">${v.energyConsumption}% Energy</div>
                    </div>
                    <button class="sheet-btn" data-vehicle-id="${v.id}">${sel ? '✓ Active' : 'Select'}</button>
                </div>`;
            }).join('');

        list.querySelectorAll('.sheet-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const vid = btn.dataset.vehicleId === 'null' ? null : btn.dataset.vehicleId;
                this.selectTransport(vid);
            });
        });
        modal.classList.remove('d-none');
    }

    closeTransportModal() {
        document.getElementById('transport-select-modal')?.classList.add('d-none');
    }

    async selectTransport(vehicleId) {
        const { uid, token } = this._params();
        try {
            const res = await fetch(`/api/travelsystem/select-vehicle?uid=${uid}&token=${token}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId })
            });
            const result = await res.json();
            if (result.success) {
                this.travelInfo.vehicleMap = vehicleId;
                this.updateTransportDisplay();
                this.closeTransportModal();
                const name = vehicleId
                    ? this.inventory?.slots.find(s => s && s.id === vehicleId)?.name || 'Vehicle'
                    : 'Walking';
                this.showNotification('success', 'Vehicle Selected', `Now using: ${name}`);
            } else {
                this.showNotification('error', 'Failed', result.message);
            }
        } catch (e) { this.showNotification('error', 'Error', 'Failed to select vehicle'); }
    }

    // ── Util ──────────────────────────────────────────────────────────────

    showLoading(message = 'Loading...') {
        const el = document.createElement('div');
        el.id = 'map-loading-overlay'; el.className = 'map-loading-overlay';
        el.innerHTML = `<div class="loading-content"><div class="spinner"></div><p>${message}</p></div>`;
        document.body.appendChild(el);
    }

    hideLoading() { document.getElementById('map-loading-overlay')?.remove(); }

    showNotification(type, title, message) {
        if (window.NotificationSystem) window.NotificationSystem.show(type, title, message);
        else alert(`${title}: ${message}`);
    }

    _params() {
        return { uid: this.urlParams.get('uid'), token: this.urlParams.get('token') };
    }
}

window.MapSystemInterface = MapSystemInterface;
window.mapInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.mapInstance) window.mapInstance = new MapSystemInterface();
});
