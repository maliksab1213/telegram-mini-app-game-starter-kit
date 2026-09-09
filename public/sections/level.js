// FILE: public/sections/level.js
class LevelInterface {
    constructor() {
        this.levelData = null;
        this.isOpen    = false;
        this._createModal();
    }

    _createModal() {
        if (document.getElementById('level-modal')) return;
        const el = document.createElement('div');
        el.id        = 'level-modal';
        el.className = 'level-modal d-none';
        el.innerHTML = `
        <div class="level-overlay" id="level-overlay">
          <div class="level-container">
            <div class="level-modal-header">
              <h2>⭐ Level Progress</h2>
              <button class="level-close-btn" id="level-close-btn">✕</button>
            </div>

            <div class="level-badge-row">
              <div class="level-badge"><span id="lm-number">1</span></div>
              <div class="level-badge-info">
                <div class="level-badge-name" id="lm-name">Bronze Writer</div>
                <div class="level-badge-sub">Your current rank</div>
              </div>
            </div>

            <div class="level-detail-bars">
              <div class="level-bar-row">
                <div class="level-bar-label">
                  <span>✅ Tasks Completed</span>
                  <span id="lm-tasks-val">0 / 10</span>
                </div>
                <div class="level-bar-track">
                  <div class="level-bar-fill tasks-fill" id="lm-tasks-fill" style="width:0%"></div>
                </div>
              </div>
              <div class="level-bar-row">
                <div class="level-bar-label">
                  <span>💰 Coins</span>
                  <span id="lm-coins-val">0 / 5,000</span>
                </div>
                <div class="level-bar-track">
                  <div class="level-bar-fill coins-fill" id="lm-coins-fill" style="width:0%"></div>
                </div>
              </div>
            </div>

            <div class="level-rewards-box" id="lm-rewards">
              <div class="level-rewards-title">🎁 Next Level Rewards</div>
              <div class="level-rewards-list" id="lm-rewards-list"></div>
            </div>

            <button class="level-up-btn" id="lm-levelup-btn" disabled>🚀 Level Up</button>
            <div class="level-msg" id="lm-msg"></div>
          </div>
        </div>`;
        document.body.appendChild(el);

        document.getElementById('level-close-btn').addEventListener('click', () => this.close());
        document.getElementById('level-overlay').addEventListener('click', e => {
            if (e.target.id === 'level-overlay') this.close();
        });
        document.getElementById('lm-levelup-btn').addEventListener('click', () => this._doLevelUp());
    }

    async open() {
        await this._loadData();
        this._populateModal();
        document.getElementById('level-modal').classList.remove('d-none');
        this.isOpen = true;
    }

    close() {
        document.getElementById('level-modal').classList.add('d-none');
        this.isOpen = false;
    }

    async _loadData() {
        try {
            const { uid, token } = this._params();
            const res = await fetch(`/api/level?uid=${uid}&token=${token}`, { cache: 'no-store' });
            if (res.ok) this.levelData = await res.json();
        } catch (e) { console.error('[Level] loadData:', e); }
    }

    _populateModal() {
        const d = this.levelData;
        if (!d) return;

        document.getElementById('lm-number').textContent = d.currentLevel;
        document.getElementById('lm-name').textContent   = d.levelName;

        // Tasks bar
        const tDone  = d.totalTasksCompleted || 0;
        const tTotal = d.requiredTasks       || 1;
        const tPct   = Math.min((tDone / tTotal) * 100, 100);
        document.getElementById('lm-tasks-val').textContent  = `${tDone} / ${tTotal}`;
        document.getElementById('lm-tasks-fill').style.width = `${tPct}%`;

        // Coins bar — uses real wallet coins (d.totalCoins)
        const cDone  = d.totalCoins   || 0;
        const cTotal = d.requiredCoins || 1;
        const cPct   = Math.min((cDone / cTotal) * 100, 100);
        document.getElementById('lm-coins-val').textContent  =
            `${cDone.toLocaleString()} / ${cTotal.toLocaleString()}`;
        document.getElementById('lm-coins-fill').style.width = `${cPct}%`;

        // Rewards
        const rewardsBox  = document.getElementById('lm-rewards');
        const rewardsList = document.getElementById('lm-rewards-list');
        if (d.isMaxLevel) {
            rewardsBox.innerHTML = '<div class="level-max-msg">🏆 Maximum level reached!</div>';
        } else if (d.rewards) {
            rewardsList.innerHTML = `
                <div class="reward-chip">💰 ${(d.rewards.coins || 0).toLocaleString()} Coins</div>
                <div class="reward-chip">🎫 ${d.rewards.spinTickets || 0} Spin Tickets</div>`;
        }

        // Level up button
        const btn = document.getElementById('lm-levelup-btn');
        const msg = document.getElementById('lm-msg');
        msg.textContent = '';

        if (d.isMaxLevel) {
            btn.disabled    = true;
            btn.textContent = '🏆 Max Level';
        } else if (d.canLevelUp) {
            btn.disabled    = false;
            btn.textContent = '🚀 Level Up!';
        } else {
            btn.disabled    = true;
            btn.textContent = '🔒 Requirements Not Met';
            const taskLeft = Math.max(0, tTotal - tDone);
            const coinLeft = Math.max(0, cTotal - cDone);
            if (taskLeft > 0)
                msg.textContent = `Need ${taskLeft} more task${taskLeft !== 1 ? 's' : ''}`;
            else
                msg.textContent = `Need ${coinLeft.toLocaleString()} more coins`;
        }
    }

    async _doLevelUp() {
        const btn = document.getElementById('lm-levelup-btn');
        btn.disabled    = true;
        btn.textContent = '⏳ Processing…';
        try {
            const { uid, token } = this._params();
            const res  = await fetch(`/api/level/up?uid=${uid}&token=${token}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            const msg  = document.getElementById('lm-msg');

            if (data.success) {
                if (window.NotificationSystem)
                    window.NotificationSystem.show('success', '🎉 Level Up!',
                        `You are now Level ${data.newLevel}! Rewards added.`, 4000);
                await this._loadData();
                this._populateModal();
                if (window.homeInstance) window.homeInstance.refreshData();
            } else {
                msg.textContent = data.message || 'Could not level up';
                btn.disabled    = false;
                btn.textContent = '🚀 Level Up';
            }
        } catch (e) { console.error('[Level] levelUp:', e); }
    }

    // Called by HomeSection to sync bar without reopening modal
    updateHomeBar(data) {
        if (!data) return;
        const numEl  = document.getElementById('level-number-text');
        const nameEl = document.getElementById('level-name-text');
        const fill   = document.getElementById('level-progress-fill');
        const left   = document.getElementById('level-stats-left');
        const right  = document.getElementById('level-stats-right');
        if (!numEl) return;

        const tDone  = data.totalTasksCompleted || 0;
        const tTotal = data.requiredTasks       || 1;
        const cDone  = data.totalCoins          || 0;   // real wallet coins
        const cTotal = data.requiredCoins       || 1;

        numEl.textContent  = `Level ${data.currentLevel}`;
        nameEl.textContent = data.levelName || '';

        const tPct = (tDone / tTotal) * 100;
        const cPct = (cDone / cTotal) * 100;
        fill.style.width = `${Math.min((tPct + cPct) / 2, 100)}%`;

        left.textContent  = `${tDone}/${tTotal} Tasks`;
        right.textContent = `${cDone.toLocaleString()}/${cTotal.toLocaleString()} Coins`;
    }

    _params() {
        const p = new URLSearchParams(window.location.search);
        return { uid: p.get('uid'), token: p.get('token') };
    }
}

window.LevelInterface = LevelInterface;
