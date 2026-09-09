// FILE: public/sections/home.js
class HomeSection {
    constructor() {
        this.isActive  = false;
        this.userData  = { coins: 0, totalWords: 0 };
        this.levelData = null;

        this.writeStoryInterface  = null;
        this.levelInterface       = null;
        this.dailyRewardInterface = null;
        this.dailySpinInterface   = null;

        this.init();
    }

    init() {
        this._bindElements();
        this._setupNav();
        console.log('[HOME] Initialized');
    }

    _bindElements() {
        this.el = {
            inventoryBtn:   document.querySelector('.home-inventory-btn'),
            inventoryCount: document.getElementById('home-inventory-count'),
            coinsDisplay:   document.getElementById('home-coins'),
            writeStoryBtn:  document.getElementById('write-story-btn'),
            rewardBtn:      document.getElementById('daily-reward-btn'),
            spinBtn:        document.getElementById('daily-spin-btn')
        };
    }

    _setupNav() {
        this.el.inventoryBtn?.addEventListener('click', () => {
            window.inventoryManagerInstance?.openInventory();
        });
        this.el.writeStoryBtn?.addEventListener('click', () => this._openWriteStory());
        this.el.rewardBtn?.addEventListener('click', () => this._openDailyReward());
        this.el.spinBtn?.addEventListener('click', () => this._openDailySpin());
    }

    // ── Lazy inits ────────────────────────────────────────────────

    _initLevel() {
        if (!this.levelInterface && window.LevelInterface)
            this.levelInterface = new window.LevelInterface();
    }

    _initWriteStory() {
        if (!this.writeStoryInterface && window.WriteStoryInterface)
            this.writeStoryInterface = new window.WriteStoryInterface();
    }

    _initReward() {
        if (!this.dailyRewardInterface && window.DailyRewardInterface)
            this.dailyRewardInterface = new window.DailyRewardInterface();
    }

    _initSpin() {
        if (!this.dailySpinInterface && window.DailySpinInterface)
            this.dailySpinInterface = new window.DailySpinInterface();
    }

    async _openWriteStory() {
        this._initWriteStory();
        await this.writeStoryInterface?.open();
    }

    async openLevelInterface() {
        this._initLevel();
        await this.levelInterface?.open();
    }

    async _openDailyReward() {
        this._initReward();
        await this.dailyRewardInterface?.open();
    }

    async _openDailySpin() {
        this._initSpin();
        await this.dailySpinInterface?.open();
    }

    // ── Level bar ─────────────────────────────────────────────────

    _createLevelBar() {
        const homeContent = document.querySelector('.home-content');
        if (!homeContent) return;
        document.querySelector('.level-bar-container')?.remove();

        const bar = document.createElement('div');
        bar.className = 'level-bar-container';
        bar.innerHTML = `
            <div class="level-info-top">
                <div class="level-number">
                    <span>⭐</span>
                    <span id="level-number-text">Level 1</span>
                </div>
                <div class="level-name" id="level-name-text">Loading…</div>
            </div>
            <div class="level-progress-bar">
                <div class="level-progress-fill" id="level-progress-fill" style="width:0%"></div>
            </div>
            <div class="level-stats-text">
                <span id="level-stats-left">0/10 Tasks</span>
                <span id="level-stats-right">0/5,000 Coins</span>
            </div>`;
        homeContent.insertBefore(bar, homeContent.firstChild);
        bar.addEventListener('click', () => this.openLevelInterface());
    }

    _updateLevelBar() {
        const d = this.levelData;
        if (!d) return;

        const numEl  = document.getElementById('level-number-text');
        const nameEl = document.getElementById('level-name-text');
        const fill   = document.getElementById('level-progress-fill');
        const left   = document.getElementById('level-stats-left');
        const right  = document.getElementById('level-stats-right');
        if (!numEl) return;

        numEl.textContent  = `Level ${d.currentLevel}`;
        nameEl.textContent = d.levelName || '';

        const tDone  = d.totalTasksCompleted || 0;
        const tTotal = d.requiredTasks       || 1;
        const cDone  = d.totalCoins          || 0;   // real wallet coins from user_coins table
        const cTotal = d.requiredCoins       || 1;

        const tPct = (tDone / tTotal) * 100;
        const cPct = (cDone / cTotal) * 100;
        fill.style.width = `${Math.min((tPct + cPct) / 2, 100)}%`;

        left.textContent  = `${tDone}/${tTotal} Tasks`;
        right.textContent = `${cDone.toLocaleString()}/${cTotal.toLocaleString()} Coins`;

        // Push data to open level modal if it's visible
        this.levelInterface?.updateHomeBar?.(d);
    }

    // ── Lifecycle ─────────────────────────────────────────────────

    async activate() {
        this.isActive = true;
        document.body.setAttribute('data-section', 'home');
        this._createLevelBar();
        this._updateCoinsDisplay();
        await this.loadData();
        console.log('[HOME] Activated');
    }

    deactivate() {
        this.isActive = false;
        document.body.removeAttribute('data-section');
    }

    // ── Data loading ──────────────────────────────────────────────

    async loadData() {
        await Promise.allSettled([
            this._loadCoins(),
            this._loadInventoryCount(),
            this._loadLevel()
        ]);
        this._updateCoinsDisplay();
        this._updateLevelBar();
    }

    async _loadCoins() {
        const { uid, token } = this._params();
        if (!uid) return;
        try {
            const res = await fetch(`/api/user/coins?uid=${uid}&token=${token}`, { cache: 'no-store' });
            if (res.ok) {
                const d = await res.json();
                this.userData.coins      = d.coins      || 0;
                this.userData.totalWords = d.total_words || 0;
            }
        } catch (e) { console.error('[HOME] _loadCoins:', e); }
    }

    async _loadInventoryCount() {
        const { uid, token } = this._params();
        if (!uid) return;
        try {
            const res = await fetch(`/api/inventory?uid=${uid}&token=${token}`, { cache: 'no-store' });
            if (res.ok) {
                const inv   = await res.json();
                const count = inv.slots.filter(s => s !== null).length;
                this._setInventoryCount(count);
            }
        } catch (e) { console.error('[HOME] _loadInventoryCount:', e); }
    }

    async _loadLevel() {
        const { uid, token } = this._params();
        if (!uid) return;
        try {
            const res = await fetch(`/api/level?uid=${uid}&token=${token}`, { cache: 'no-store' });
            if (res.ok) this.levelData = await res.json();
        } catch (e) { console.error('[HOME] _loadLevel:', e); }
    }

    // ── UI updates ────────────────────────────────────────────────

    _updateCoinsDisplay() {
        if (this.el.coinsDisplay)
            this.el.coinsDisplay.textContent = (this.userData.coins || 0).toLocaleString();
    }

    _setInventoryCount(count) {
        if (!this.el.inventoryCount) return;
        this.el.inventoryCount.textContent    = count;
        this.el.inventoryCount.style.display  = count > 0 ? 'flex' : 'none';
    }

    // ── Public refresh ────────────────────────────────────────────

    async refreshData() { await this.loadData(); }
    refreshInventory()   { this._loadInventoryCount(); }

    _params() {
        const p = new URLSearchParams(window.location.search);
        return { uid: p.get('uid'), token: p.get('token') };
    }

    getData() {
        return { coins: this.userData.coins, totalWords: this.userData.totalWords, level: this.levelData };
    }
}

window.homeInstance = null;
window.HomeSection  = HomeSection;
