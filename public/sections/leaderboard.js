// FILE: public/sections/leaderboard.js
class LeaderboardSection {
    constructor() {
        this.isActive  = false;
        this.top20     = [];
        this.userInfo  = null;
        this.loading   = false;
        this.init();
    }

    init() {
        this.el = {
            list: document.getElementById('leaderboard-list')
        };
        console.log('[LEADERBOARD] Initialized');
    }

    _params() {
        const p = new URLSearchParams(window.location.search);
        return { uid: p.get('uid'), token: p.get('token') };
    }

    // ── Lifecycle ─────────────────────────────────────────────────

    async activate() {
        this.isActive = true;
        this._renderSkeleton();
        await this.loadData();
        console.log('[LEADERBOARD] Activated');
    }

    deactivate() {
        this.isActive = false;
    }

    // ── Data ──────────────────────────────────────────────────────

    async loadData() {
        const { uid, token } = this._params();
        if (!uid) return;

        this.loading = true;
        try {
            const res = await fetch(`/api/leaderboard?uid=${uid}&token=${token}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();

            if (data.success) {
                this.top20    = data.top20    || [];
                this.userInfo = data.userInfo || null;
            }
        } catch (e) {
            console.error('[LEADERBOARD] loadData:', e);
            this.top20    = [];
            this.userInfo = null;
        }
        this.loading = false;
        this._render();
    }

    async refreshData() {
        await this.loadData();
    }

    // ── Render ────────────────────────────────────────────────────

    _renderSkeleton() {
        if (!this.el.list) return;
        this.el.list.innerHTML = `
            <div class="lb-loading">
                <div class="lb-spinner"></div>
                <p>Loading rankings…</p>
            </div>`;
    }

    _render() {
        if (!this.el.list) return;

        const { uid } = this._params();
        const myId    = parseInt(uid);

        // Check if current user is already in top20
        const userInTop20 = this.top20.some(p => p.telegramId === myId);

        this.el.list.innerHTML = `
            <!-- Header -->
            <div class="lb-header">
                <div class="lb-title">🏆 Top Writers</div>
                <div class="lb-subtitle">Ranked by Level &amp; Coins</div>
            </div>

            <!-- Podium (top 3) -->
            ${this.top20.length >= 3 ? this._renderPodium() : ''}

            <!-- List (rank 4 onward) -->
            <div class="lb-list">
                ${this.top20.slice(3).map(p => this._renderRow(p, p.telegramId === myId)).join('')}
            </div>

            <!-- Divider + user card if not in top20 -->
            ${!userInTop20 && this.userInfo ? this._renderUserCard() : ''}
        `;
    }

    _renderPodium() {
        const [first, second, third] = this.top20;
        const { uid } = this._params();
        const myId = parseInt(uid);

        return `
        <div class="lb-podium">
            <!-- 2nd -->
            <div class="lb-podium-item lb-podium-second ${second?.telegramId === myId ? 'lb-me' : ''}">
                <div class="lb-podium-avatar">${this._avatar(second)}</div>
                <div class="lb-podium-name">${this._short(second?.name)}</div>
                <div class="lb-podium-level">Lv.${second?.level || 1}</div>
                <div class="lb-podium-coins">💰 ${this._fmt(second?.coins)}</div>
                <div class="lb-podium-base lb-podium-base-2">
                    <span class="lb-medal">🥈</span>
                </div>
            </div>

            <!-- 1st -->
            <div class="lb-podium-item lb-podium-first ${first?.telegramId === myId ? 'lb-me' : ''}">
                <div class="lb-crown">👑</div>
                <div class="lb-podium-avatar lb-podium-avatar-first">${this._avatar(first)}</div>
                <div class="lb-podium-name">${this._short(first?.name)}</div>
                <div class="lb-podium-level">Lv.${first?.level || 1}</div>
                <div class="lb-podium-coins">💰 ${this._fmt(first?.coins)}</div>
                <div class="lb-podium-base lb-podium-base-1">
                    <span class="lb-medal">🥇</span>
                </div>
            </div>

            <!-- 3rd -->
            <div class="lb-podium-item lb-podium-third ${third?.telegramId === myId ? 'lb-me' : ''}">
                <div class="lb-podium-avatar">${this._avatar(third)}</div>
                <div class="lb-podium-name">${this._short(third?.name)}</div>
                <div class="lb-podium-level">Lv.${third?.level || 1}</div>
                <div class="lb-podium-coins">💰 ${this._fmt(third?.coins)}</div>
                <div class="lb-podium-base lb-podium-base-3">
                    <span class="lb-medal">🥉</span>
                </div>
            </div>
        </div>`;
    }

    _renderRow(player, isMe) {
        return `
        <div class="lb-row ${isMe ? 'lb-me' : ''}">
            <div class="lb-row-rank">#${player.rank}</div>
            <div class="lb-row-avatar">${this._avatar(player)}</div>
            <div class="lb-row-info">
                <div class="lb-row-name">${player.name}${isMe ? ' <span class="lb-you-tag">You</span>' : ''}</div>
                <div class="lb-row-meta">
                    <span class="lb-row-level">⭐ Lv.${player.level}</span>
                    <span class="lb-row-coins">💰 ${this._fmt(player.coins)}</span>
                </div>
            </div>
        </div>`;
    }

    _renderUserCard() {
        const u = this.userInfo;
        return `
        <div class="lb-user-divider">
            <span>Your Position</span>
        </div>
        <div class="lb-row lb-me lb-user-card">
            <div class="lb-row-rank">#${u.rank}</div>
            <div class="lb-row-avatar">${this._avatarFromName(u.name)}</div>
            <div class="lb-row-info">
                <div class="lb-row-name">${u.name} <span class="lb-you-tag">You</span></div>
                <div class="lb-row-meta">
                    <span class="lb-row-level">⭐ Lv.${u.level}</span>
                    <span class="lb-row-coins">💰 ${this._fmt(u.coins)}</span>
                </div>
            </div>
        </div>`;
    }

    // ── Helpers ───────────────────────────────────────────────────

    _avatar(player) {
        if (!player?.name) return '?';
        return this._avatarFromName(player.name);
    }

    _avatarFromName(name) {
        const colors = ['#ff6b6b','#ffd700','#4ecdc4','#a29bfe','#fd79a8','#6bcb77','#74b9ff'];
        const idx    = (name?.charCodeAt(0) || 0) % colors.length;
        const letter = (name || '?')[0].toUpperCase();
        return `<span class="lb-avatar-letter" style="background:${colors[idx]}">${letter}</span>`;
    }

    _short(name, max = 10) {
        if (!name) return '—';
        return name.length > max ? name.slice(0, max - 1) + '…' : name;
    }

    _fmt(n) {
        if (n === undefined || n === null) return '0';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
        return n.toLocaleString();
    }

    getData() {
        return { top20: this.top20, userInfo: this.userInfo };
    }
}

window.LeaderboardSection = LeaderboardSection;
