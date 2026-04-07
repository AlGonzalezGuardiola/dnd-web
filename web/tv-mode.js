// ============================================
// TV Mode — Mesa de Juego
// Diseñado para pantalla grande (TV horizontal)
// Depends on: globals.js, combat-manager.js, storage.js
// ============================================

const tvState = {
    // Grid config (cells)
    cellSize: 60,
    gridCols: 30,
    gridRows: 20,

    // Viewport
    pan: { x: 0, y: 0 },
    zoom: 1,

    // Token positions: { participantId: { col, row } }
    tokenPositions: {},

    // Interaction
    isPanningMap: false,
    panStart: { x: 0, y: 0 },
    panOrigin: { x: 0, y: 0 },
    activePopupId: null,
    activeRingsPid: null, // token with distance rings shown
    cellHighlight: null,  // { col, row } — used during drag

    // Display toggles (local, not synced)
    showTokenNames: true,
    showTokenHp: false,
};

// ─── Entry point ─────────────────────────────────

function openTvMode() {
    setView('tvMode');
}

function initTvMode() {
    if (!document.getElementById('tvModeSection')) return;
    _buildTvGrid();
    _setupTvMapInteraction();
    // Sync toolbar button states with tvState
    const namesBtn = document.getElementById('tvNamesBtn');
    if (namesBtn) namesBtn.classList.toggle('active', tvState.showTokenNames);
    const hpBtn = document.getElementById('tvHpBtn');
    if (hpBtn) hpBtn.classList.toggle('active', tvState.showTokenHp);
    refreshTvMode();
    _applyGridColor();
    _initAoeDragListeners();
}

// Called externally after any combat state change
function refreshTvMode() {
    if (state.currentView !== 'tvMode') return;
    renderTvInitiative();
    renderTvTokens();
    _updateTvTurnBanner();
    _updateTvEmptyState();
}

// ─── Turn Banner ──────────────────────────────────

let _lastBannerTurnKey = '';

function _updateTvTurnBanner() {
    const banner = document.getElementById('tvTurnBanner');
    if (!banner) return;

    if (!combatState.isActive || !combatState.participants.length) {
        banner.style.display = 'none';
        return;
    }

    const p = combatState.participants[combatState.currentIndex];
    if (!p) return;

    const turnKey = `${combatState.round}-${combatState.currentIndex}`;
    const imagen  = p.charData?.imagen || '';
    const hpPct   = p.hp?.max > 0 ? Math.max(0, Math.round((p.hp.current / p.hp.max) * 100)) : 100;
    const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 25 ? '#ffaa00' : '#ef5350';
    const tipoIcon = { jugador: '🎮', aliado: '💙', enemigo: '💀' }[p.tipo] || '⚔️';

    banner.style.display = 'flex';
    banner.innerHTML = `
        ${imagen
            ? `<img class="tv-banner-portrait" src="${imagen}" alt="">`
            : `<div class="tv-banner-icon">${tipoIcon}</div>`}
        <div class="tv-banner-info">
            <div class="tv-banner-name">${p.name}</div>
            <div class="tv-banner-sub">
                <span style="color:${hpColor}">❤️ ${p.hp?.current ?? '?'} / ${p.hp?.max ?? '?'}</span>
                <span class="tv-banner-sep">·</span>
                <span>Init ${p.initiative ?? '–'}</span>
                <span class="tv-banner-sep">·</span>
                <span>Ronda ${combatState.round}</span>
            </div>
        </div>`;

    if (turnKey !== _lastBannerTurnKey) {
        _lastBannerTurnKey = turnKey;
        banner.classList.remove('tv-turn-banner--flash');
        void banner.offsetWidth; // force reflow
        banner.classList.add('tv-turn-banner--flash');
    }
}

// ─── Grid / Map setup ────────────────────────────

function _isVideoUrl(url) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

function _buildTvGrid() {
    const canvas = document.getElementById('tvMapCanvas');
    if (!canvas) return;

    const mapUrl = combatState.combatMap?.url || '';
    const hasMap = !!mapUrl;

    if (hasMap) {
        if (_isVideoUrl(mapUrl)) {
            _buildTvGridWithVideo(canvas, mapUrl);
        } else {
            _buildTvGridWithMap(canvas, mapUrl);
        }
    } else {
        _buildTvGridEmpty(canvas);
    }
}

// Map image loaded: orient to landscape, show grid overlay, auto-fit zoom
function _buildTvGridWithMap(canvas, mapUrl) {
    const img = new Image();
    img.onload = () => {
        // ── 1. Force landscape orientation ──────────────────────────────────
        // If the image is portrait (H > W), rotate it 90° CW to landscape.
        const { src: finalSrc, w: effW, h: effH } = _ensureLandscape(img);

        // ── 2. Size canvas to effective (landscape) image dimensions ─────────
        canvas.style.width  = effW + 'px';
        canvas.style.height = effH + 'px';

        // Update grid cell count so the snap grid covers the whole image
        tvState.gridCols = Math.ceil(effW / tvState.cellSize);
        tvState.gridRows = Math.ceil(effH / tvState.cellSize);

        // ── 3. Map image (first child — below everything) ────────────────────
        let mapImg = canvas.querySelector('.tv-map-image');
        if (!mapImg) {
            mapImg = document.createElement('img');
            mapImg.className = 'tv-map-image';
            mapImg.alt = 'Mapa de combate';
            canvas.insertBefore(mapImg, canvas.firstChild);
        }
        mapImg.src              = finalSrc;
        mapImg.style.display    = 'block';
        mapImg.style.position   = 'absolute';
        mapImg.style.top        = '0';
        mapImg.style.left       = '0';
        mapImg.style.width      = effW + 'px';
        mapImg.style.height     = effH + 'px';

        // ── 4. Tokens & rings layers ─────────────────────────────────────────
        _ensureTokensLayer(canvas, effW, effH);
        _ensureDistanceRingsSvg(canvas, effW, effH);

        // ── 6. Auto-fit zoom so the full map fills the play area ─────────────
        _autoFitMap(effW, effH);
        renderTvTokens();
    };
    img.onerror = () => {
        console.warn('[TV] No se pudo cargar el mapa:', mapUrl);
        _buildTvGridEmpty(canvas);
    };
    img.src = mapUrl;
}

// Video map: use <video> element instead of <img>, no orientation rotation needed
function _buildTvGridWithVideo(canvas, mapUrl) {
    // Remove stale image if present
    canvas.querySelector('.tv-map-image')?.remove();

    let videoEl = canvas.querySelector('.tv-map-video');
    if (!videoEl) {
        videoEl = document.createElement('video');
        videoEl.className   = 'tv-map-video';
        videoEl.autoplay    = true;
        videoEl.loop        = true;
        videoEl.muted       = true;
        videoEl.playsInline = true;
        videoEl.style.cssText = 'position:absolute;top:0;left:0;display:block;';
        canvas.insertBefore(videoEl, canvas.firstChild);
    }

    // Only reload if URL changed
    if (videoEl.dataset.src === mapUrl) return;
    videoEl.dataset.src = mapUrl;

    videoEl.oncanplay = () => {
        const effW = videoEl.videoWidth  || 1920;
        const effH = videoEl.videoHeight || 1080;

        canvas.style.width  = effW + 'px';
        canvas.style.height = effH + 'px';
        videoEl.style.width  = effW + 'px';
        videoEl.style.height = effH + 'px';

        tvState.gridCols = Math.ceil(effW / tvState.cellSize);
        tvState.gridRows = Math.ceil(effH / tvState.cellSize);

        _ensureTokensLayer(canvas, effW, effH);
        _ensureDistanceRingsSvg(canvas, effW, effH);
        _autoFitMap(effW, effH);
        renderTvTokens();
    };
    videoEl.onerror = () => {
        console.warn('[TV] No se pudo cargar el vídeo:', mapUrl);
        _buildTvGridEmpty(canvas);
    };
    videoEl.src = mapUrl;
    videoEl.load();
    videoEl.play().catch(() => {});
}

// Returns { src, w, h } — rotates portrait images 90° CW via offscreen canvas
function _ensureLandscape(img) {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    if (nh <= nw) {
        // Already landscape (or square)
        return { src: img.src, w: nw, h: nh };
    }

    // Portrait → rotate 90° clockwise
    // After rotation: new width = nh, new height = nw
    const oc  = document.createElement('canvas');
    oc.width  = nh;
    oc.height = nw;
    const ctx = oc.getContext('2d');
    // translate to new width (=nh), rotate CW, draw image at origin
    ctx.translate(nh, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0, nw, nh);
    return { src: oc.toDataURL('image/jpeg', 0.92), w: nh, h: nw };
}

// No map selected: size canvas to map area and center
function _buildTvGridEmpty(canvas) {
    const mapArea = document.getElementById('tvMapArea');
    if (!mapArea) return;

    requestAnimationFrame(() => {
        const cs = tvState.cellSize;
        const w  = mapArea.offsetWidth  || tvState.gridCols * cs;
        const h  = mapArea.offsetHeight || tvState.gridRows * cs;

        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';

        const mapImg = canvas.querySelector('.tv-map-image');
        if (mapImg) mapImg.style.display = 'none';

        _ensureTokensLayer(canvas, w, h);
        _ensureDistanceRingsSvg(canvas, w, h);

        tvState.zoom  = 1;
        tvState.pan.x = 0;
        tvState.pan.y = 0;
        _applyTvTransform();
        renderTvTokens();
    });
}

function _ensureTokensLayer(canvas, w, h) {
    let layer = document.getElementById('tvTokensLayer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id        = 'tvTokensLayer';
        layer.className = 'tv-tokens-layer';
        canvas.appendChild(layer);
    }
    layer.style.width  = w + 'px';
    layer.style.height = h + 'px';
}

// Auto-fit: zoom so the full map fills the available play area
function _autoFitMap(imgW, imgH) {
    const mapArea = document.getElementById('tvMapArea');
    if (!mapArea) return;

    requestAnimationFrame(() => {
        const areaW = mapArea.offsetWidth;
        const areaH = mapArea.offsetHeight;

        // Use min (contain) so the whole map is always visible
        const scaleX = areaW / imgW;
        const scaleY = areaH / imgH;
        tvState.zoom = Math.min(scaleX, scaleY);

        // Center within the play area
        tvState.pan.x = (areaW - imgW * tvState.zoom) / 2;
        tvState.pan.y = (areaH - imgH * tvState.zoom) / 2;

        _applyTvTransform();
    });
}

// ─── Initiative Sidebar ───────────────────────────

function renderTvInitiative() {
    const list = document.getElementById('tvTurnList');
    const roundBadge = document.getElementById('tvRoundBadge');
    if (!list) return;

    if (!combatState.isActive || !combatState.participants.length) {
        list.innerHTML = '<div style="padding:14px 10px; font-size:11px; color:rgba(168,144,112,0.5); text-align:center;">Sin combate activo</div>';
        if (roundBadge) roundBadge.textContent = 'Ronda 1';
        return;
    }

    if (roundBadge) roundBadge.textContent = `Ronda ${combatState.round}`;

    list.innerHTML = combatState.participants.map((p, i) => {
        const isActive = i === combatState.currentIndex;
        const isDead = (p.hp?.current ?? 1) <= 0;
        const hpPct = p.hp?.max > 0 ? Math.max(0, Math.round((p.hp.current / p.hp.max) * 100)) : 100;
        const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 25 ? '#ffaa00' : '#ef5350';
        const initNum = p.initiative != null ? p.initiative : '–';
        const name = (p.name || '?').slice(0, 14);
        const condDots = (p.conditions || []).slice(0, 6).map(
            () => '<div class="tv-cond-dot"></div>'
        ).join('');

        return `<div class="tv-turn-item${isActive ? ' active' : ''}${isDead ? ' dead' : ''}"
                     onclick="tvFocusToken('${p.id}')"
                     data-pid="${p.id}">
            <div class="tv-turn-item-top">
                <span class="tv-turn-init">${initNum}</span>
                <span class="tv-turn-name">${name}</span>
            </div>
            <div class="tv-turn-hp-bar">
                <div class="tv-turn-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div>
            </div>
            ${condDots ? `<div class="tv-turn-conditions">${condDots}</div>` : ''}
        </div>`;
    }).join('');

    // Scroll active item into view
    const activeItem = list.querySelector('.tv-turn-item.active');
    if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
}

// ─── Token Rendering ──────────────────────────────

function renderTvTokens() {
    const layer = document.getElementById('tvTokensLayer');
    if (!layer) return;

    if (!combatState.isActive || !combatState.participants.length) {
        layer.innerHTML = '';
        return;
    }

    const { participants, currentIndex } = combatState;
    const existingIds = new Set(participants.map(p => p.id));

    // Remove tokens for participants that no longer exist
    layer.querySelectorAll('.tv-token').forEach(el => {
        if (!existingIds.has(el.dataset.pid)) el.remove();
    });

    const COND_ICONS = {
        envenenado: '🤢', paralizado: '⛓️', aturdido: '💫', concentracion: '🧠',
        caido: '🔻', asustado: '😱', invisible: '👁️', encantado: '💜', cegado: '🚫',
    };

    participants.forEach((p, i) => {
        const isActive = i === currentIndex;
        const isDead = (p.hp?.current ?? 1) <= 0;
        const hpPct = p.hp?.max > 0 ? Math.max(0, Math.round((p.hp.current / p.hp.max) * 100)) : 100;
        const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 25 ? '#ffaa00' : '#ef5350';
        const tipo = p.tipo || 'jugador';
        const tokenSize = p.tokenSize || 1;
        const sizePx = tokenSize * tvState.cellSize;

        // Assign default position if new
        if (!tvState.tokenPositions[p.id]) {
            tvState.tokenPositions[p.id] = _defaultTokenPos(i, participants.length);
        }

        const pos = tvState.tokenPositions[p.id];
        // For tokens bigger than 1 cell, shift so they're centered on their grid anchor
        const cellOffsetPx = (tokenSize - 1) * tvState.cellSize / 2;
        const rawPx = _cellToPixel(pos.col, pos.row);
        const px = rawPx.px + cellOffsetPx;
        const py = rawPx.py + cellOffsetPx;
        const abbrev = _tokenAbbrev(p.name);
        const imagen = p.charData?.imagen || '';

        let tokenEl = layer.querySelector(`.tv-token[data-pid="${p.id}"]`);
        if (!tokenEl) {
            tokenEl = document.createElement('div');
            tokenEl.className = `tv-token ${tipo}`;
            tokenEl.dataset.pid = p.id;
            tokenEl.innerHTML = `
                <div class="tv-token-conds-ring"></div>
                <span class="tv-token-label">${p.name}</span>
                <img class="tv-token-photo" alt="" style="display:none">
                <span class="tv-token-abbrev">${abbrev}</span>
                <span class="tv-token-hp-num" style="display:none"></span>
                <div class="tv-token-hp-wrap">
                    <div class="tv-token-hp-fill"></div>
                    <div class="tv-token-temphp-fill"></div>
                </div>`;
            tokenEl.addEventListener('mousedown', _tvTokenMouseDown);
            tokenEl.addEventListener('touchstart', _tvTokenTouchStart, { passive: false });
            tokenEl.addEventListener('click', _tvTokenClick);
            layer.appendChild(tokenEl);
        }

        // Token size
        tokenEl.style.width  = sizePx + 'px';
        tokenEl.style.height = sizePx + 'px';

        // Update position & classes
        tokenEl.style.left = px + 'px';
        tokenEl.style.top  = py + 'px';
        tokenEl.classList.toggle('active-turn', isActive && !isDead);
        tokenEl.classList.toggle('dead', isDead);
        tokenEl.classList.toggle('tv-token-mine', _canPlayerControlToken(p.id));
        tokenEl.classList.toggle('demonic', !!p.demonicForm);
        tokenEl.classList.toggle('tv-names-always', tvState.showTokenNames);

        // Aura Necrótica circle: 20ft radius = 4 cells
        const auraId = `tv-aura-${p.id}`;
        let auraEl = layer.querySelector(`[data-aura-id="${auraId}"]`);
        if (p.auraNecroticActive) {
            const radiusPx = 4 * tvState.cellSize; // 20ft = 4 cells
            if (!auraEl) {
                auraEl = document.createElement('div');
                auraEl.className = 'tv-aura-circle';
                auraEl.dataset.auraId = auraId;
                layer.appendChild(auraEl);
            }
            auraEl.style.left   = px + 'px';
            auraEl.style.top    = py + 'px';
            auraEl.style.width  = (radiusPx * 2) + 'px';
            auraEl.style.height = (radiusPx * 2) + 'px';
        } else if (auraEl) {
            auraEl.remove();
        }

        // Portrait photo
        const photoEl = tokenEl.querySelector('.tv-token-photo');
        if (photoEl) {
            if (imagen) { photoEl.src = imagen; photoEl.style.display = ''; }
            else { photoEl.src = ''; photoEl.style.display = 'none'; }
        }
        tokenEl.classList.toggle('tv-token-has-photo', !!imagen);

        // Abbrev & label
        tokenEl.querySelector('.tv-token-abbrev').textContent = abbrev;
        tokenEl.querySelector('.tv-token-label').textContent  = p.name;

        // HP number overlay
        const hpNumEl = tokenEl.querySelector('.tv-token-hp-num');
        if (hpNumEl) {
            const tempHp = p.tempHp || 0;
            hpNumEl.style.display = tvState.showTokenHp ? '' : 'none';
            hpNumEl.textContent = tempHp > 0
                ? `${p.hp?.current}+${tempHp}`
                : `${p.hp?.current ?? '?'}`;
            hpNumEl.style.color = hpColor;
        }

        // HP bar + temp HP bar
        const fill    = tokenEl.querySelector('.tv-token-hp-fill');
        const tempFill = tokenEl.querySelector('.tv-token-temphp-fill');
        if (fill)     { fill.style.width = hpPct + '%'; fill.style.background = hpColor; }
        if (tempFill) {
            const tempPct = (p.tempHp && p.hp?.max > 0) ? Math.min(100, (p.tempHp / p.hp.max) * 100) : 0;
            tempFill.style.width   = tempPct + '%';
            tempFill.style.display = tempPct > 0 ? '' : 'none';
        }

        // Condition icons ring
        const condsRing = tokenEl.querySelector('.tv-token-conds-ring');
        if (condsRing) {
            const activeConds = (p.conditions || []).filter(c => COND_ICONS[c]).slice(0, 6);
            condsRing.innerHTML = activeConds.map(c =>
                `<span class="tv-cond-badge" title="${c}">${COND_ICONS[c]}</span>`
            ).join('');
            condsRing.style.display = activeConds.length ? '' : 'none';
        }
    });
}

function _tokenAbbrev(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

function _defaultTokenPos(index, total) {
    // Spread tokens across a few rows at the top-left area
    const perRow = 4;
    const col = 2 + (index % perRow) * 2;
    const row = 2 + Math.floor(index / perRow) * 2;
    return { col, row };
}

function _cellToPixel(col, row) {
    const cs = tvState.cellSize;
    return { px: col * cs + cs / 2, py: row * cs + cs / 2 };
}

function _pixelToCell(px, py) {
    const cs = tvState.cellSize;
    return {
        col: Math.floor(px / cs),
        row: Math.floor(py / cs),
    };
}

// ─── Distance Rings SVG ───────────────────────────

function _ensureDistanceRingsSvg(canvas, w, h) {
    let svg = document.getElementById('tvDistanceRings');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'tvDistanceRings';
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.style.position   = 'absolute';
        svg.style.top        = '0';
        svg.style.left       = '0';
        svg.style.pointerEvents = 'none';
        svg.style.display    = 'none';
        svg.style.overflow   = 'visible';
        canvas.appendChild(svg);
    }
    svg.setAttribute('width',  w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    return svg;
}

const TV_RINGS = [
    { cells: 1, feet: 5,  color: '#4caf50', opacity: 0.7 },
    { cells: 2, feet: 10, color: '#ffaa00', opacity: 0.65 },
    { cells: 3, feet: 15, color: '#ef5350', opacity: 0.6 },
];

function showDistanceRings(pid) {
    const pos = tvState.tokenPositions[pid];
    if (!pos) return;

    const svg = document.getElementById('tvDistanceRings');
    if (!svg) return;

    const cs = tvState.cellSize;
    const { px: cx, py: cy } = _cellToPixel(pos.col, pos.row);

    svg.style.display = 'block';
    svg.innerHTML = TV_RINGS.map(ring => {
        const r = ring.cells * cs;
        return `<g>
            <circle cx="${cx}" cy="${cy}" r="${r}"
                fill="none"
                stroke="${ring.color}"
                stroke-width="2.5"
                stroke-dasharray="10 6"
                stroke-opacity="${ring.opacity}"/>
            <text x="${cx}" y="${cy - r - 6}"
                fill="${ring.color}"
                font-size="${Math.round(cs * 0.22)}px"
                font-family="Cinzel, serif"
                text-anchor="middle"
                fill-opacity="${ring.opacity + 0.1}">${ring.feet} pies</text>
        </g>`;
    }).join('');

    tvState.activeRingsPid = pid;
}

function hideDistanceRings() {
    const svg = document.getElementById('tvDistanceRings');
    if (svg) { svg.style.display = 'none'; svg.innerHTML = ''; }
    tvState.activeRingsPid = null;
}

// ─── Player permission helper ─────────────────────

// Returns true if the current user can control (drag/popup) this token.
// Master can control everything; players only control their own char + summoned allies.
function _canPlayerControlToken(pid) {
    if (isMaster()) return true;
    const charId = gameRole.characterId;
    if (!charId) return false;
    if (pid === charId) return true;
    const p = combatState.participants?.find(p => p.id === pid);
    return p?.ownerCharId === charId;
}

// ─── Token Click / Focus ──────────────────────────

function _tvTokenClick(e) {
    e.stopPropagation();
    const pid = e.currentTarget.dataset.pid;

    // Toggle rings: show if different token or rings hidden, hide if same
    if (tvState.activeRingsPid === pid) {
        hideDistanceRings();
    } else {
        showDistanceRings(pid);
        // Players only see the action popup for their own token(s)
        if (_canPlayerControlToken(pid)) {
            tvOpenTokenPopup(pid, e.clientX, e.clientY);
        }
    }
}

function toggleTokenNames() {
    tvState.showTokenNames = !tvState.showTokenNames;
    const btn = document.getElementById('tvNamesBtn');
    if (btn) btn.classList.toggle('active', tvState.showTokenNames);
    renderTvTokens();
}

function toggleTokenHp() {
    tvState.showTokenHp = !tvState.showTokenHp;
    const btn = document.getElementById('tvHpBtn');
    if (btn) btn.classList.toggle('active', tvState.showTokenHp);
    renderTvTokens();
}

function tvSetTokenSize(pid, size) {
    const p = combatState.participants.find(x => x.id === pid);
    if (!p) return;
    p.tokenSize = parseInt(size) || 1;
    saveCombatState({ immediate: isOnlineCombat });
    renderTvTokens();
    // Reopen popup with updated state
    const popup = document.getElementById('tvTokenPopup');
    if (popup && tvState.activePopupId === pid) {
        tvOpenTokenPopup(pid, parseInt(popup.style.left), parseInt(popup.style.top));
    }
}

function tvFocusToken(pid) {
    // Scroll initiative item and pan map toward the token
    const item = document.querySelector(`.tv-turn-item[data-pid="${pid}"]`);
    if (item) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    const pos = tvState.tokenPositions[pid];
    if (pos) {
        const mapArea = document.getElementById('tvMapArea');
        if (mapArea) {
            const { px, py } = _cellToPixel(pos.col, pos.row);
            const areaW = mapArea.offsetWidth;
            const areaH = mapArea.offsetHeight;
            tvState.pan.x = areaW / 2 - px * tvState.zoom;
            tvState.pan.y = areaH / 2 - py * tvState.zoom;
            _applyTvTransform();
        }
    }
}

// ─── Token Drag ───────────────────────────────────

let _tvDrag = null;

function _tvTokenMouseDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation(); // Prevent map pan

    const tokenEl = e.currentTarget;
    const pid = tokenEl.dataset.pid;

    // Players can only drag their own token(s)
    if (!_canPlayerControlToken(pid)) return;
    const mapArea = document.getElementById('tvMapArea');
    const mapRect = mapArea.getBoundingClientRect();

    _tvDrag = { pid, tokenEl, mapRect };
    tokenEl.classList.add('dragging');

    // Cell highlight element
    let hl = document.getElementById('tvCellHighlight');
    if (!hl) {
        hl = document.createElement('div');
        hl.id = 'tvCellHighlight';
        hl.className = 'tv-cell-highlight';
        document.getElementById('tvMapCanvas').appendChild(hl);
    }

    function onMouseMove(me) {
        if (!_tvDrag) return;
        const rawX = (me.clientX - _tvDrag.mapRect.left - tvState.pan.x) / tvState.zoom;
        const rawY = (me.clientY - _tvDrag.mapRect.top - tvState.pan.y) / tvState.zoom;
        const { col, row } = _pixelToCell(rawX, rawY);
        const cs = tvState.cellSize;
        // Move token visually
        const { px, py } = _cellToPixel(col, row);
        _tvDrag.tokenEl.style.left = px + 'px';
        _tvDrag.tokenEl.style.top = py + 'px';
        // Show cell highlight
        hl.style.display = 'block';
        hl.style.left = (col * cs) + 'px';
        hl.style.top = (row * cs) + 'px';
        hl.style.width = cs + 'px';
        hl.style.height = cs + 'px';
    }

    function onMouseUp(me) {
        if (!_tvDrag) return;
        const rawX = (me.clientX - _tvDrag.mapRect.left - tvState.pan.x) / tvState.zoom;
        const rawY = (me.clientY - _tvDrag.mapRect.top - tvState.pan.y) / tvState.zoom;
        const { col, row } = _pixelToCell(rawX, rawY);
        const clampedCol = Math.max(0, Math.min(tvState.gridCols - 1, col));
        const clampedRow = Math.max(0, Math.min(tvState.gridRows - 1, row));
        tvState.tokenPositions[_tvDrag.pid] = { col: clampedCol, row: clampedRow };
        _tvDrag.tokenEl.classList.remove('dragging');
        hl.style.display = 'none';
        const movedPid = _tvDrag.pid;
        _tvDrag = null;
        renderTvTokens();
        // Refresh rings if the moved token had them
        if (tvState.activeRingsPid === movedPid) showDistanceRings(movedPid);
        // Sync new position to server so all devices see the move
        if (typeof saveToApiNow === 'function') saveToApiNow();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function _tvTokenTouchStart(e) {
    if (e.touches.length !== 1) return;
    const tokenEl = e.currentTarget;
    const pid = tokenEl.dataset.pid;
    if (!_canPlayerControlToken(pid)) return;

    e.stopPropagation(); // Prevent map pan from starting
    e.preventDefault();  // Prevent scroll

    const mapArea = document.getElementById('tvMapArea');
    const mapRect = mapArea.getBoundingClientRect();

    _tvDrag = { pid, tokenEl, mapRect };
    tokenEl.classList.add('dragging');

    let hl = document.getElementById('tvCellHighlight');
    if (!hl) {
        hl = document.createElement('div');
        hl.id = 'tvCellHighlight';
        hl.className = 'tv-cell-highlight';
        document.getElementById('tvMapCanvas').appendChild(hl);
    }

    function onTouchMove(te) {
        if (!_tvDrag || te.touches.length !== 1) return;
        te.preventDefault();
        const touch = te.touches[0];
        const rawX = (touch.clientX - _tvDrag.mapRect.left - tvState.pan.x) / tvState.zoom;
        const rawY = (touch.clientY - _tvDrag.mapRect.top - tvState.pan.y) / tvState.zoom;
        const { col, row } = _pixelToCell(rawX, rawY);
        const cs = tvState.cellSize;
        const { px, py } = _cellToPixel(col, row);
        _tvDrag.tokenEl.style.left = px + 'px';
        _tvDrag.tokenEl.style.top = py + 'px';
        hl.style.display = 'block';
        hl.style.left = (col * cs) + 'px';
        hl.style.top = (row * cs) + 'px';
        hl.style.width = cs + 'px';
        hl.style.height = cs + 'px';
    }

    function onTouchEnd(te) {
        if (!_tvDrag) return;
        const touch = te.changedTouches[0];
        const rawX = (touch.clientX - _tvDrag.mapRect.left - tvState.pan.x) / tvState.zoom;
        const rawY = (touch.clientY - _tvDrag.mapRect.top - tvState.pan.y) / tvState.zoom;
        const { col, row } = _pixelToCell(rawX, rawY);
        const clampedCol = Math.max(0, Math.min(tvState.gridCols - 1, col));
        const clampedRow = Math.max(0, Math.min(tvState.gridRows - 1, row));
        tvState.tokenPositions[_tvDrag.pid] = { col: clampedCol, row: clampedRow };
        _tvDrag.tokenEl.classList.remove('dragging');
        hl.style.display = 'none';
        const movedPid = _tvDrag.pid;
        _tvDrag = null;
        renderTvTokens();
        if (tvState.activeRingsPid === movedPid) showDistanceRings(movedPid);
        if (typeof saveToApiNow === 'function') saveToApiNow();
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
}

// ─── Token Popup ──────────────────────────────────

const TV_CONDITIONS = [
    { id: 'envenenado',    label: 'Veneno' },
    { id: 'paralizado',    label: 'Parálisis' },
    { id: 'aturdido',      label: 'Aturdido' },
    { id: 'concentracion', label: 'Conc.' },
    { id: 'caido',         label: 'Caído' },
    { id: 'asustado',      label: 'Asustado' },
    { id: 'invisible',     label: 'Invisible' },
    { id: 'encantado',     label: 'Encantado' },
];

function tvOpenTokenPopup(pid, clientX, clientY) {
    const p = combatState.participants.find(x => x.id === pid);
    if (!p) return;

    tvState.activePopupId = pid;

    const hpPct = p.hp?.max > 0 ? Math.max(0, Math.round((p.hp.current / p.hp.max) * 100)) : 100;
    const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 25 ? '#ffaa00' : '#ef5350';
    const tipoLabel = { jugador: 'Jugador', aliado: 'Aliado', enemigo: 'Enemigo' }[p.tipo] || p.tipo;

    const condButtons = TV_CONDITIONS.map(c => {
        const isActive = (p.conditions || []).includes(c.id);
        return `<button class="tv-popup-cond-btn${isActive ? ' active' : ''}"
            onclick="tvToggleCondition('${pid}','${c.id}')">${c.label}</button>`;
    }).join('');

    let popup = document.getElementById('tvTokenPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'tvTokenPopup';
        popup.className = 'tv-token-popup';
        document.body.appendChild(popup);
    }

    const tempHp    = p.tempHp || 0;
    const tokenSize = p.tokenSize || 1;
    const sizeLabels = { 1: 'Med.', 2: 'Grande', 3: 'Enorme', 4: 'Garg.' };

    popup.innerHTML = `
        <div class="tv-popup-header">
            <div>
                <span class="tv-popup-name">${p.name}</span>
                <span class="tv-popup-tipo">${tipoLabel} · Init ${p.initiative ?? '–'}</span>
            </div>
            <button class="tv-popup-close" onclick="tvCloseTokenPopup()">×</button>
        </div>
        <div class="tv-popup-hp-block">
            <div class="tv-popup-hp-label">Puntos de vida${tempHp > 0 ? ` <span style="color:#f9c74f">+${tempHp} temp</span>` : ''}</div>
            <div class="tv-popup-hp-display" style="color:${hpColor}">
                ${p.hp?.current ?? '?'}<span style="font-size:14px;opacity:0.5"> / ${p.hp?.max ?? '?'}</span>
            </div>
            <div class="tv-popup-hp-bar">
                <div class="tv-popup-hp-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div>
            </div>
        </div>
        <div class="tv-popup-dmg-row">
            <input class="tv-popup-dmg-input" id="tvDmgInput" type="number" min="0" max="999" placeholder="Cant." title="Cantidad">
            <button class="tv-popup-btn dmg" onclick="tvApplyDamage('${pid}')">Daño</button>
            <button class="tv-popup-btn heal" onclick="tvApplyHeal('${pid}')">Curar</button>
        </div>
        <div class="tv-popup-dmg-row" style="margin-top:4px">
            <input class="tv-popup-dmg-input" id="tvTempHpInput" type="number" min="0" max="999" placeholder="Temp HP" title="HP Temporal" style="flex:1">
            <button class="tv-popup-btn" style="background:rgba(249,199,63,0.2);border-color:rgba(249,199,63,0.5);color:#f9c74f" onclick="tvSetTempHp('${pid}')">+Temp</button>
        </div>
        <div class="tv-popup-cond-section">
            <div class="tv-popup-cond-title">Condiciones</div>
            <div class="tv-popup-cond-btns">${condButtons}</div>
        </div>
        <div class="tv-popup-size-row">
            <span class="tv-popup-cond-title">Tamaño token</span>
            <select class="tv-popup-size-select" onchange="tvSetTokenSize('${pid}',this.value)">
                <option value="1" ${tokenSize===1?'selected':''}>S/M (1 celda)</option>
                <option value="2" ${tokenSize===2?'selected':''}>Grande (2)</option>
                <option value="3" ${tokenSize===3?'selected':''}>Enorme (3)</option>
                <option value="4" ${tokenSize===4?'selected':''}>Gargantuesco (4)</option>
            </select>
        </div>`;

    // Position popup: avoid going off-screen
    const popupW = 260;
    const popupH = 280;
    const margin = 14;
    let left = clientX + margin;
    let top = clientY + margin;
    if (left + popupW > window.innerWidth - margin) left = clientX - popupW - margin;
    if (top + popupH > window.innerHeight - margin) top = clientY - popupH - margin;
    left = Math.max(margin, left);
    top = Math.max(margin, top);

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    popup.style.display = 'block';

    // Focus input
    setTimeout(() => { const inp = document.getElementById('tvDmgInput'); if (inp) inp.focus(); }, 50);
}

function tvCloseTokenPopup() {
    const popup = document.getElementById('tvTokenPopup');
    if (popup) popup.style.display = 'none';
    tvState.activePopupId = null;
}

function tvApplyDamage(pid) {
    const input = document.getElementById('tvDmgInput');
    const amount = parseInt(input?.value || '0', 10);
    if (!amount || amount <= 0) return;

    const p = combatState.participants.find(x => x.id === pid);
    if (!p) return;

    // Absorb damage with temp HP first
    const tempHp = p.tempHp || 0;
    const tempAbsorbed = Math.min(tempHp, amount);
    p.tempHp = tempHp - tempAbsorbed;
    const remainder = amount - tempAbsorbed;
    const newHp = Math.max(0, (p.hp?.current ?? 0) - remainder);
    setParticipantHp(pid, newHp);
    if (isOnlineCombat) saveCombatState({ immediate: true });
    if (input) input.value = '';

    renderTvInitiative();
    renderTvTokens();
    // Reopen popup in-place with updated values
    const popup = document.getElementById('tvTokenPopup');
    if (popup && tvState.activePopupId === pid) {
        tvOpenTokenPopup(pid, parseInt(popup.style.left), parseInt(popup.style.top));
    }
}

function tvApplyHeal(pid) {
    const input = document.getElementById('tvDmgInput');
    const amount = parseInt(input?.value || '0', 10);
    if (!amount || amount <= 0) return;

    const p = combatState.participants.find(x => x.id === pid);
    if (!p) return;

    const newHp = Math.min(p.hp?.max ?? 9999, (p.hp?.current ?? 0) + amount);
    setParticipantHp(pid, newHp);
    if (isOnlineCombat) saveCombatState({ immediate: true });
    if (input) input.value = '';

    renderTvInitiative();
    renderTvTokens();
    const popup = document.getElementById('tvTokenPopup');
    if (popup && tvState.activePopupId === pid) {
        tvOpenTokenPopup(pid, parseInt(popup.style.left), parseInt(popup.style.top));
    }
}

function tvSetTempHp(pid) {
    const input = document.getElementById('tvTempHpInput');
    const amount = parseInt(input?.value || '0', 10);
    if (isNaN(amount) || amount < 0) return;
    const p = combatState.participants.find(x => x.id === pid);
    if (!p) return;
    p.tempHp = amount;
    if (isOnlineCombat) saveCombatState({ immediate: true });
    if (input) input.value = '';
    renderTvInitiative();
    renderTvTokens();
    const popup = document.getElementById('tvTokenPopup');
    if (popup && tvState.activePopupId === pid) {
        tvOpenTokenPopup(pid, parseInt(popup.style.left), parseInt(popup.style.top));
    }
}

function tvToggleCondition(pid, condId) {
    toggleParticipantCondition(pid, condId);
    if (isOnlineCombat) saveCombatState({ immediate: true });
    renderTvInitiative();
    renderTvTokens();
    const popup = document.getElementById('tvTokenPopup');
    if (popup && tvState.activePopupId === pid) {
        tvOpenTokenPopup(pid, parseInt(popup.style.left), parseInt(popup.style.top));
    }
}

// ─── Turn Navigation ──────────────────────────────

function tvNextTurn() {
    nextCombatTurn();
    refreshTvMode();
}

function tvPrevTurn() {
    previousCombatTurn();
    refreshTvMode();
}

// ─── Pan / Zoom ───────────────────────────────────

function _setupTvMapInteraction() {
    const mapArea = document.getElementById('tvMapArea');
    if (!mapArea || mapArea._tvInteractionSet) return;
    mapArea._tvInteractionSet = true;

    // Wheel zoom
    mapArea.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(5, Math.max(0.25, tvState.zoom * factor));
        const rect = mapArea.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        tvState.pan.x = mx - (mx - tvState.pan.x) * (newZoom / tvState.zoom);
        tvState.pan.y = my - (my - tvState.pan.y) * (newZoom / tvState.zoom);
        tvState.zoom = newZoom;
        _applyTvTransform();
    }, { passive: false });

    // Mouse pan
    mapArea.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('.tv-token')) return;
        tvState.isPanningMap = true;
        tvState.panStart = { x: e.clientX, y: e.clientY };
        tvState.panOrigin = { ...tvState.pan };
        mapArea.classList.add('panning');
    });

    document.addEventListener('mousemove', (e) => {
        if (!tvState.isPanningMap) return;
        tvState.pan.x = tvState.panOrigin.x + (e.clientX - tvState.panStart.x);
        tvState.pan.y = tvState.panOrigin.y + (e.clientY - tvState.panStart.y);
        _applyTvTransform();
    });

    document.addEventListener('mouseup', () => {
        if (tvState.isPanningMap) {
            tvState.isPanningMap = false;
            mapArea.classList.remove('panning');
        }
    });

    // Click on map background → close popup and rings
    mapArea.addEventListener('click', (e) => {
        if (!e.target.closest('.tv-token') && !e.target.closest('#tvTokenPopup')) {
            tvCloseTokenPopup();
            hideDistanceRings();
        }
    });

    // Touch pan support
    let lastTouchDist = 0;
    let lastTouchCenter = { x: 0, y: 0 };

    mapArea.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1 && !e.target.closest('.tv-token')) {
            tvState.isPanningMap = true;
            tvState.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            tvState.panOrigin = { ...tvState.pan };
        } else if (e.touches.length === 2) {
            tvState.isPanningMap = false;
            lastTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            lastTouchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            };
        }
    }, { passive: true });

    mapArea.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && tvState.isPanningMap) {
            tvState.pan.x = tvState.panOrigin.x + (e.touches[0].clientX - tvState.panStart.x);
            tvState.pan.y = tvState.panOrigin.y + (e.touches[0].clientY - tvState.panStart.y);
            _applyTvTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const center = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            };
            const rect = mapArea.getBoundingClientRect();
            const factor = dist / (lastTouchDist || dist);
            const newZoom = Math.min(5, Math.max(0.25, tvState.zoom * factor));
            const mx = center.x - rect.left;
            const my = center.y - rect.top;
            tvState.pan.x = mx - (mx - tvState.pan.x) * (newZoom / tvState.zoom);
            tvState.pan.y = my - (my - tvState.pan.y) * (newZoom / tvState.zoom);
            tvState.zoom = newZoom;
            lastTouchDist = dist;
            lastTouchCenter = center;
            _applyTvTransform();
        }
    }, { passive: false });

    mapArea.addEventListener('touchend', () => {
        tvState.isPanningMap = false;
    });
}

function _applyTvTransform() {
    const canvas = document.getElementById('tvMapCanvas');
    if (canvas) {
        canvas.style.transform = `translate(${tvState.pan.x}px, ${tvState.pan.y}px) scale(${tvState.zoom})`;
    }

    // Update grid overlay. transform-origin is 0 0, so:
    //   screen_x = canvas_x * zoom + pan.x  →  phase = pan.x mod (cellSize * zoom)
    const grid = document.getElementById('tvGridOverlay');
    if (grid) {
        const cellSizePx = tvState.cellSize * tvState.zoom;
        const offsetX = ((tvState.pan.x % cellSizePx) + cellSizePx) % cellSizePx;
        const offsetY = ((tvState.pan.y % cellSizePx) + cellSizePx) % cellSizePx;
        grid.style.backgroundSize     = `${cellSizePx}px ${cellSizePx}px`;
        grid.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    }
}

function tvZoomIn() {
    tvState.zoom = Math.min(5, tvState.zoom * 1.25);
    _applyTvTransform();
}

function tvZoomOut() {
    tvState.zoom = Math.max(0.25, tvState.zoom / 1.25);
    _applyTvTransform();
}

function tvResetZoom() {
    const mapArea = document.getElementById('tvMapArea');
    const canvas  = document.getElementById('tvMapCanvas');
    if (!mapArea || !canvas) return;

    const areaW = mapArea.offsetWidth;
    const areaH = mapArea.offsetHeight;
    const w = parseInt(canvas.style.width)  || tvState.gridCols * tvState.cellSize;
    const h = parseInt(canvas.style.height) || tvState.gridRows * tvState.cellSize;

    tvState.zoom  = Math.min(areaW / w, areaH / h);
    tvState.pan.x = (areaW - w * tvState.zoom) / 2;
    tvState.pan.y = (areaH - h * tvState.zoom) / 2;
    _applyTvTransform();
}

// ─── Empty state ──────────────────────────────────

function _updateTvEmptyState() {
    const overlay = document.getElementById('tvEmptyOverlay');
    if (!overlay) return;
    const hasCombat = combatState.isActive && combatState.participants.length > 0;
    overlay.style.display = hasCombat ? 'none' : 'flex';
}

// ─── Grid configuration ───────────────────────────

function tvSetCellSize(size) {
    tvState.cellSize = Math.max(20, Math.min(120, parseInt(size)));
    _buildTvGrid();
    renderTvTokens();
}

function tvSetGridSize(cols, rows) {
    tvState.gridCols = Math.max(10, Math.min(80, parseInt(cols)));
    tvState.gridRows = Math.max(8, Math.min(60, parseInt(rows)));
    _buildTvGrid();
    renderTvTokens();
}

// ─── AoE Tool — Multiple circles / shapes ────────────────────────────────────

let _aoeCircles     = []; // [{ id, radiusFt, centerX, centerY, shape, rotation }]
let _selectedAoeId  = null;
let _activeDragAoeId = null;
let _aoeDragOffset   = { x: 0, y: 0 };
let _aoeRotateDragId = null;
let _aoeRotateOrigin = null; // { cx, cy } canvas px at drag start
let _aoeRotateStartAngle = 0;
let _aoeIdCounter   = 0;
let _aoeDragListenersAdded = false;

const AOE_SHAPES = ['circle', 'square', 'cone', 'line'];
const AOE_COLORS = ['rgba(100,180,255,0.25)', 'rgba(255,120,80,0.25)', 'rgba(120,255,120,0.25)', 'rgba(255,220,0,0.25)'];
// Each circle gets a stable color based on its id index
function _aoeColor(id) { return AOE_COLORS[id % AOE_COLORS.length]; }

// Called once from initTvMode
function _initAoeDragListeners() {
    if (_aoeDragListenersAdded) return;
    _aoeDragListenersAdded = true;

    const getXY = e => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                                 : { x: e.clientX,             y: e.clientY             };

    document.addEventListener('mousemove', e => _aoeOnMove(getXY(e)));
    document.addEventListener('touchmove', e => { if (_activeDragAoeId !== null || _aoeRotateDragId !== null) { e.preventDefault(); _aoeOnMove(getXY(e)); } }, { passive: false });
    document.addEventListener('mouseup',  () => { _activeDragAoeId = null; _aoeRotateDragId = null; });
    document.addEventListener('touchend', () => { _activeDragAoeId = null; _aoeRotateDragId = null; });
}

function _aoeOnMove({ x, y }) {
    const mapArea = document.getElementById('tvMapArea');
    if (!mapArea) return;
    const rect = mapArea.getBoundingClientRect();

    if (_activeDragAoeId !== null) {
        const circle = _aoeCircles.find(c => c.id === _activeDragAoeId);
        if (!circle) return;
        const screenX = x - rect.left - _aoeDragOffset.x;
        const screenY = y - rect.top  - _aoeDragOffset.y;
        circle.centerX = (screenX - tvState.pan.x) / tvState.zoom;
        circle.centerY = (screenY - tvState.pan.y) / tvState.zoom;
        _renderAllAoeCircles();
    }

    if (_aoeRotateDragId !== null) {
        const circle = _aoeCircles.find(c => c.id === _aoeRotateDragId);
        if (!circle || !_aoeRotateOrigin) return;
        const dx = x - rect.left - (_aoeRotateOrigin.cx * tvState.zoom + tvState.pan.x);
        const dy = y - rect.top  - (_aoeRotateOrigin.cy * tvState.zoom + tvState.pan.y);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        circle.rotation = angle - _aoeRotateStartAngle;
        _renderAllAoeCircles();
    }
}

function addAoeCircle() {
    const mapArea = document.getElementById('tvMapArea');
    const radiusFt = parseInt(document.getElementById('tvAoeRadius')?.value) || 20;
    const shape    = document.getElementById('tvAoeShape')?.value   || 'circle';
    const centerX  = mapArea ? (mapArea.offsetWidth  / 2 - tvState.pan.x) / tvState.zoom : 400;
    const centerY  = mapArea ? (mapArea.offsetHeight / 2 - tvState.pan.y) / tvState.zoom : 300;

    const circle = { id: _aoeIdCounter++, radiusFt, centerX, centerY, shape, rotation: 0 };
    _aoeCircles.push(circle);
    _selectedAoeId = circle.id;
    _renderAllAoeCircles();
}

function clearAllAoeCircles() {
    _aoeCircles = [];
    _selectedAoeId = null;
    _renderAllAoeCircles();
}

function setAoeRadius(ft) {
    if (_selectedAoeId === null && _aoeCircles.length) {
        _selectedAoeId = _aoeCircles[_aoeCircles.length - 1].id;
    }
    const circle = _aoeCircles.find(c => c.id === _selectedAoeId);
    if (circle) { circle.radiusFt = parseInt(ft) || 20; _renderAllAoeCircles(); }
}

function _renderAllAoeCircles() {
    const canvas = document.getElementById('tvMapCanvas');
    if (!canvas) return;

    // Remove stale elements
    const activeIds = new Set(_aoeCircles.map(c => String(c.id)));
    canvas.querySelectorAll('.tv-aoe-shape').forEach(el => {
        if (!activeIds.has(el.dataset.aoeId)) el.remove();
    });

    _aoeCircles.forEach(circle => {
        const radiusPx = (circle.radiusFt / 5) * tvState.cellSize;
        const color    = _aoeColor(circle.id);

        let el = canvas.querySelector(`.tv-aoe-shape[data-aoe-id="${circle.id}"]`);
        if (!el) {
            el = document.createElement('div');
            el.className      = 'tv-aoe-shape';
            el.dataset.aoeId  = circle.id;
            // Delete button
            const del = document.createElement('button');
            del.className = 'tv-aoe-delete-btn';
            del.textContent = '✕';
            del.title = 'Eliminar';
            del.addEventListener('mousedown', e => e.stopPropagation());
            del.addEventListener('click', e => {
                e.stopPropagation();
                _aoeCircles = _aoeCircles.filter(c => c.id !== circle.id);
                if (_selectedAoeId === circle.id) _selectedAoeId = null;
                _renderAllAoeCircles();
            });
            // Rotate handle
            const rotHandle = document.createElement('div');
            rotHandle.className = 'tv-aoe-rotate-handle';
            rotHandle.title = 'Rotar';
            rotHandle.addEventListener('mousedown', e => {
                e.stopPropagation();
                _aoeRotateDragId = circle.id;
                _aoeRotateOrigin = { cx: circle.centerX, cy: circle.centerY };
                const mapArea = document.getElementById('tvMapArea');
                const rect = mapArea?.getBoundingClientRect();
                if (rect) {
                    const dx = e.clientX - rect.left - (circle.centerX * tvState.zoom + tvState.pan.x);
                    const dy = e.clientY - rect.top  - (circle.centerY * tvState.zoom + tvState.pan.y);
                    _aoeRotateStartAngle = Math.atan2(dy, dx) * (180 / Math.PI) - (circle.rotation || 0);
                }
            });

            const startDrag = e => {
                if (_aoeRotateDragId !== null) return;
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
                _activeDragAoeId = circle.id;
                _selectedAoeId   = circle.id;
                const mapArea = document.getElementById('tvMapArea');
                const rect    = mapArea?.getBoundingClientRect();
                if (rect) {
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    const screenCX = circle.centerX * tvState.zoom + tvState.pan.x;
                    const screenCY = circle.centerY * tvState.zoom + tvState.pan.y;
                    _aoeDragOffset.x = clientX - rect.left - screenCX;
                    _aoeDragOffset.y = clientY - rect.top  - screenCY;
                }
            };
            el.addEventListener('mousedown',  startDrag);
            el.addEventListener('touchstart', startDrag, { passive: false });
            el.appendChild(del);
            el.appendChild(rotHandle);
            canvas.appendChild(el);
        }

        // Apply shape-specific sizing and styles
        el.style.position      = 'absolute';
        el.style.pointerEvents = 'all';
        el.style.cursor        = 'grab';
        el.style.background    = color;
        el.style.borderColor   = color.replace('0.25', '0.8');
        el.style.borderWidth   = '2px';
        el.style.borderStyle   = 'dashed';
        el.style.boxSizing     = 'border-box';

        const rot = circle.rotation || 0;
        const shape = circle.shape || 'circle';

        if (shape === 'circle') {
            const d = radiusPx * 2;
            el.style.width           = d + 'px';
            el.style.height          = d + 'px';
            el.style.borderRadius    = '50%';
            el.style.left            = (circle.centerX - radiusPx) + 'px';
            el.style.top             = (circle.centerY - radiusPx) + 'px';
            el.style.clipPath        = '';
            el.style.transform       = `rotate(${rot}deg)`;
            el.style.transformOrigin = 'center center';
        } else if (shape === 'square') {
            const d = radiusPx * 2;
            el.style.width           = d + 'px';
            el.style.height          = d + 'px';
            el.style.borderRadius    = '4px';
            el.style.left            = (circle.centerX - radiusPx) + 'px';
            el.style.top             = (circle.centerY - radiusPx) + 'px';
            el.style.clipPath        = '';
            el.style.transform       = `rotate(${rot}deg)`;
            el.style.transformOrigin = 'center center';
        } else if (shape === 'cone') {
            const d = radiusPx * 2;
            el.style.width           = d + 'px';
            el.style.height          = d + 'px';
            el.style.borderRadius    = '0';
            el.style.borderStyle     = 'none';
            el.style.left            = (circle.centerX - radiusPx) + 'px';
            el.style.top             = (circle.centerY - radiusPx) + 'px';
            el.style.clipPath        = 'polygon(50% 100%, 0% 0%, 100% 0%)';
            el.style.transform       = `rotate(${rot}deg)`;
            el.style.transformOrigin = '50% 100%';
        } else if (shape === 'line') {
            const lineW = tvState.cellSize;
            el.style.width           = lineW + 'px';
            el.style.height          = (radiusPx * 2) + 'px';
            el.style.borderRadius    = '2px';
            el.style.left            = (circle.centerX - lineW / 2) + 'px';
            el.style.top             = (circle.centerY - radiusPx) + 'px';
            el.style.clipPath        = '';
            el.style.transform       = `rotate(${rot}deg)`;
            el.style.transformOrigin = 'center center';
        }

        el.classList.toggle('tv-aoe-selected', circle.id === _selectedAoeId);
    });
}

// Keep backward-compat — the button in HTML still calls toggleAoeTool
function toggleAoeTool() { addAoeCircle(); }
