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
};

// ─── Entry point ─────────────────────────────────

function openTvMode() {
    setView('tvMode');
}

function initTvMode() {
    if (!document.getElementById('tvModeSection')) return;
    _buildTvGrid();
    _setupTvMapInteraction();
    refreshTvMode();
}

// Called externally after any combat state change
function refreshTvMode() {
    if (state.currentView !== 'tvMode') return;
    renderTvInitiative();
    renderTvTokens();
    _updateTvEmptyState();
}

// ─── Grid / Map setup ────────────────────────────

function _buildTvGrid() {
    const canvas = document.getElementById('tvMapCanvas');
    if (!canvas) return;

    const mapUrl = combatState.combatMap?.url || '';
    const hasMap = !!mapUrl;

    if (hasMap) {
        _buildTvGridWithMap(canvas, mapUrl);
    } else {
        _buildTvGridEmpty(canvas);
    }
}

// Map image loaded: size canvas to image, fit zoom, hide grid lines
function _buildTvGridWithMap(canvas, mapUrl) {
    const img = new Image();
    img.onload = () => {
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;

        // Size canvas to natural image dimensions
        canvas.style.width  = natW + 'px';
        canvas.style.height = natH + 'px';

        // Adjust grid dimensions so token snap grid covers the image
        tvState.gridCols = Math.ceil(natW / tvState.cellSize);
        tvState.gridRows = Math.ceil(natH / tvState.cellSize);

        // Hide CSS grid lines (map already has its own grid)
        _setGridLinesVisible(canvas, false);

        // Set image as background (full canvas size)
        let mapImg = canvas.querySelector('.tv-map-image');
        if (!mapImg) {
            mapImg = document.createElement('img');
            mapImg.className = 'tv-map-image';
            mapImg.alt = 'Mapa de combate';
            canvas.insertBefore(mapImg, canvas.firstChild);
        }
        mapImg.src = mapUrl;
        mapImg.style.display  = 'block';
        mapImg.style.position = 'absolute';
        mapImg.style.top      = '0';
        mapImg.style.left     = '0';
        mapImg.style.width    = natW + 'px';
        mapImg.style.height   = natH + 'px';

        // Tokens layer
        _ensureTokensLayer(canvas, natW, natH);

        // Auto-fit: zoom so the map fills the available area
        _autoFitMap(natW, natH);

        // Distance rings SVG
        _ensureDistanceRingsSvg(canvas, natW, natH);
    };
    img.onerror = () => {
        console.warn('[TV] No se pudo cargar el mapa:', mapUrl);
        _buildTvGridEmpty(canvas);
    };
    img.src = mapUrl;
}

// No map: show default placeholder grid
function _buildTvGridEmpty(canvas) {
    const cs = tvState.cellSize;
    const w  = tvState.gridCols * cs;
    const h  = tvState.gridRows * cs;

    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';

    // Show CSS grid lines
    _setGridLinesVisible(canvas, true, w, h, cs);

    // Remove map image if present
    const mapImg = canvas.querySelector('.tv-map-image');
    if (mapImg) mapImg.style.display = 'none';

    _ensureTokensLayer(canvas, w, h);
    _ensureDistanceRingsSvg(canvas, w, h);

    // Center
    const mapArea = document.getElementById('tvMapArea');
    if (mapArea) {
        const areaW = mapArea.offsetWidth;
        const areaH = mapArea.offsetHeight;
        tvState.zoom  = 1;
        tvState.pan.x = Math.max(0, (areaW - w) / 2);
        tvState.pan.y = Math.max(0, (areaH - h) / 2);
        _applyTvTransform();
    }
}

function _setGridLinesVisible(canvas, visible, w, h, cs) {
    ['tv-grid-bg', 'tv-grid-major'].forEach((cls, i) => {
        let el = canvas.querySelector('.' + cls);
        if (visible) {
            if (!el) {
                el = document.createElement('div');
                el.className = cls;
                canvas.insertBefore(el, canvas.firstChild);
            }
            el.style.display = 'block';
            el.style.width   = w + 'px';
            el.style.height  = h + 'px';
            el.style.setProperty('--tv-cell-size', cs + 'px');
        } else if (el) {
            el.style.display = 'none';
        }
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

// Auto-fit: zoom to show the full map in the available area
function _autoFitMap(imgW, imgH) {
    const mapArea = document.getElementById('tvMapArea');
    if (!mapArea) return;

    // Wait one tick for the area to have correct dimensions
    requestAnimationFrame(() => {
        const areaW = mapArea.offsetWidth;
        const areaH = mapArea.offsetHeight;

        const scaleX = areaW / imgW;
        const scaleY = areaH / imgH;
        tvState.zoom  = Math.min(scaleX, scaleY);

        // Center the image
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

    participants.forEach((p, i) => {
        const isActive = i === currentIndex;
        const isDead = (p.hp?.current ?? 1) <= 0;
        const hpPct = p.hp?.max > 0 ? Math.max(0, Math.round((p.hp.current / p.hp.max) * 100)) : 100;
        const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 25 ? '#ffaa00' : '#ef5350';
        const tipo = p.tipo || 'jugador';

        // Assign default position if new
        if (!tvState.tokenPositions[p.id]) {
            tvState.tokenPositions[p.id] = _defaultTokenPos(i, participants.length);
        }

        const pos = tvState.tokenPositions[p.id];
        const { px, py } = _cellToPixel(pos.col, pos.row);
        const abbrev = _tokenAbbrev(p.name);

        let tokenEl = layer.querySelector(`.tv-token[data-pid="${p.id}"]`);
        if (!tokenEl) {
            tokenEl = document.createElement('div');
            tokenEl.className = `tv-token ${tipo}`;
            tokenEl.dataset.pid = p.id;
            tokenEl.innerHTML = `
                <span class="tv-token-label">${p.name}</span>
                <span class="tv-token-abbrev">${abbrev}</span>
                <div class="tv-token-hp-wrap">
                    <div class="tv-token-hp-fill"></div>
                </div>`;
            tokenEl.addEventListener('mousedown', _tvTokenMouseDown);
            tokenEl.addEventListener('click', _tvTokenClick);
            layer.appendChild(tokenEl);
        }

        // Update position & classes
        tokenEl.style.left = px + 'px';
        tokenEl.style.top = py + 'px';
        tokenEl.classList.toggle('active-turn', isActive && !isDead);
        tokenEl.classList.toggle('dead', isDead);

        // Update abbrev & label in case name changed
        tokenEl.querySelector('.tv-token-abbrev').textContent = abbrev;
        tokenEl.querySelector('.tv-token-label').textContent = p.name;

        // HP bar
        const fill = tokenEl.querySelector('.tv-token-hp-fill');
        fill.style.width = hpPct + '%';
        fill.style.background = hpColor;
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

// ─── Token Click / Focus ──────────────────────────

function _tvTokenClick(e) {
    e.stopPropagation();
    const pid = e.currentTarget.dataset.pid;

    // Toggle rings: show if different token or rings hidden, hide if same
    if (tvState.activeRingsPid === pid) {
        hideDistanceRings();
    } else {
        showDistanceRings(pid);
        tvOpenTokenPopup(pid, e.clientX, e.clientY);
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
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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

    popup.innerHTML = `
        <div class="tv-popup-header">
            <div>
                <span class="tv-popup-name">${p.name}</span>
                <span class="tv-popup-tipo">${tipoLabel} · Init ${p.initiative ?? '–'}</span>
            </div>
            <button class="tv-popup-close" onclick="tvCloseTokenPopup()">×</button>
        </div>
        <div class="tv-popup-hp-block">
            <div class="tv-popup-hp-label">Puntos de vida</div>
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
        <div class="tv-popup-cond-section">
            <div class="tv-popup-cond-title">Condiciones</div>
            <div class="tv-popup-cond-btns">${condButtons}</div>
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

    const newHp = Math.max(0, (p.hp?.current ?? 0) - amount);
    setParticipantHp(pid, newHp);
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
    const canvas = document.getElementById('tvMapCanvas');
    if (!mapArea || !canvas) return;

    const areaW = mapArea.offsetWidth;
    const areaH = mapArea.offsetHeight;
    const w = tvState.gridCols * tvState.cellSize;
    const h = tvState.gridRows * tvState.cellSize;

    // Fit grid in viewport
    const scaleX = areaW / w;
    const scaleY = areaH / h;
    tvState.zoom = Math.min(scaleX, scaleY, 1);
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
