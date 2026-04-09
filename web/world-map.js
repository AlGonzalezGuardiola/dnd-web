/* ============================================
   world-map.js — Mapa del mundo con edición
   visual y zoom cinemático
   ============================================ */

// ── State ─────────────────────────────────────────────────────────────────────

const _wm = {
    hotspots:      [],
    pending:       [],
    editMode:      false,
    zoomed:        false,
    inited:        false,
    currentHs:     null,  // hotspot activo durante el zoom
    _dragJustEnded: false, // evita que pointerup→click abra el modal
};

// ── Config ────────────────────────────────────────────────────────────────────

const WM_ZOOM_SCALE  = 3.5;
const WM_ZOOM_MS     = 600;   // duración zoom in/out (debe coincidir con CSS)
const WM_HOTSPOT_PCT = 2.8;   // diámetro del hotspot como % del ancho del canvas

// ── Entry point ───────────────────────────────────────────────────────────────

function openWorldMapView() {
    setView('worldMap');
    _wmInit();
}

async function _wmInit() {
    const section = document.getElementById('worldMapSection');
    if (!section) return;

    if (!_wm.inited) {
        _wm.inited = true;
        _wmBindButtons(section);
    }

    await _wmLoadHotspots();
    _wmRenderHotspots();
    _wmUpdateButtons();
    _wmShowEditHint(false);
}

// ── Button wiring (buttons live in #wmHudControls inside the HUD) ────────────

function _wmBindButtons(section) {
    document.getElementById('wmBtnEdit')  .addEventListener('click', _wmEnterEditMode);
    document.getElementById('wmBtnSave')  .addEventListener('click', _wmSave);
    document.getElementById('wmBtnCancel').addEventListener('click', _wmCancelEdit);
    document.getElementById('wmBtnBack')  .addEventListener('click', wmGoBack);

    // Stage click in edit mode → place hotspot
    section.querySelector('.wm-stage').addEventListener('click', _wmOnStageClick);

    // Reset when navigating away
    new MutationObserver(() => {
        if (section.style.display === 'none') _wmReset();
    }).observe(section, { attributes: true, attributeFilter: ['style'] });
}

// Show/hide HUD buttons based on current state
function _wmUpdateButtons() {
    const btnBack   = document.getElementById('wmBtnBack');
    const btnEdit   = document.getElementById('wmBtnEdit');
    const btnCancel = document.getElementById('wmBtnCancel');
    const btnSave   = document.getElementById('wmBtnSave');
    if (!btnBack) return;

    const show = el => { el.style.display = 'inline-flex'; };
    const hide = el => { el.style.display = 'none'; };

    if (_wm.editMode) {
        // Edit mode: Volver (if zoomed) + Cancelar + Guardar
        _wm.zoomed ? show(btnBack) : hide(btnBack);
        hide(btnEdit);
        show(btnCancel);
        show(btnSave);
    } else {
        // Normal mode: Volver (if zoomed) + Editar
        _wm.zoomed ? show(btnBack) : hide(btnBack);
        show(btnEdit);
        hide(btnCancel);
        hide(btnSave);
    }
}

// ── Load / Save ───────────────────────────────────────────────────────────────

async function _wmLoadHotspots() {
    try {
        const res = await fetch(`${API_BASE}/api/world-map`);
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        _wm.hotspots = data.hotspots ?? [];
        _wm.pending  = _wm.hotspots.map(h => ({ ...h }));
    } catch (err) {
        console.warn('[world-map] load error', err);
        _wm.hotspots = [];
        _wm.pending  = [];
    }
}

async function _wmSave() {
    const btn = document.querySelector('#worldMapSection .wm-btn-save');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        const res = await fetch(`${API_BASE}/api/world-map`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ hotspots: _wm.pending }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const data = await res.json();
        _wm.hotspots = data.hotspots;
        _wm.pending  = _wm.hotspots.map(h => ({ ...h }));
        showNotification('Mapa guardado', 2500);
        _wmExitEditMode();
    } catch (err) {
        showNotification(`Error guardando: ${err.message}`, 4000);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
    }
}

// ── Edit mode ─────────────────────────────────────────────────────────────────

function _wmEnterEditMode() {
    _wm.editMode = true;
    _wm.pending  = _wm.hotspots.map(h => ({ ...h }));
    document.getElementById('worldMapSection').classList.add('wm-edit-mode');
    _wmRenderHotspots();
    _wmUpdateButtons();
    _wmShowEditHint(true);
}

function _wmExitEditMode() {
    _wm.editMode = false;
    document.getElementById('worldMapSection').classList.remove('wm-edit-mode');
    _wmRenderHotspots();
    _wmUpdateButtons();
    _wmShowEditHint(false);
}

function _wmCancelEdit() {
    _wm.pending = _wm.hotspots.map(h => ({ ...h }));
    _wmExitEditMode();
}

// ── Stage click → place hotspot ───────────────────────────────────────────────

function _wmOnStageClick(e) {
    if (!_wm.editMode) return;
    // Ignore if click originated from a hotspot (drag or normal click on it)
    if (e.target.closest('.wm-hotspot')) return;
    // Ignore if a drag just finished (pointerup sets this flag)
    if (_wm._dragJustEnded) { _wm._dragJustEnded = false; return; }

    // Coordinates relative to the canvas (= rendered image dimensions)
    const canvas = document.querySelector('#worldMapSection .wm-canvas');
    const rect   = canvas.getBoundingClientRect();
    const x = Math.min(98, Math.max(2, ((e.clientX - rect.left)  / rect.width)  * 100));
    const y = Math.min(98, Math.max(2, ((e.clientY - rect.top)   / rect.height) * 100));

    _wmOpenAddModal(x, y);
}

// ── Render ────────────────────────────────────────────────────────────────────

function _wmRenderHotspots() {
    const canvas    = document.querySelector('#worldMapSection .wm-canvas');
    const emptyHint = document.getElementById('wmEmptyHint');
    if (!canvas) return;

    canvas.querySelectorAll('.wm-hotspot').forEach(el => el.remove());

    const list = _wm.editMode ? _wm.pending : _wm.hotspots;
    list.forEach(hs => canvas.appendChild(_wmBuildHotspotEl(hs)));

    if (emptyHint) {
        emptyHint.style.display = (list.length === 0 && _wm.editMode) ? 'flex' : 'none';
    }
}

function _wmBuildHotspotEl(hs) {
    const el = document.createElement('div');
    el.className = 'wm-hotspot';
    el.dataset.id = hs.id;
    el.setAttribute('data-label', hs.label);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', hs.label);

    el.style.left   = `${hs.x}%`;
    el.style.top    = `${hs.y}%`;
    el.style.width  = `${WM_HOTSPOT_PCT}%`;
    el.style.height = `${WM_HOTSPOT_PCT}%`;

    // Delete button (visible only in edit mode via CSS)
    const del = document.createElement('button');
    del.className = 'wm-hotspot-delete';
    del.innerHTML = '✕';
    del.setAttribute('aria-label', `Eliminar ${hs.label}`);
    del.addEventListener('click', e => { e.stopPropagation(); _wmDeleteHotspot(hs.id); });
    el.appendChild(del);

    // Drag to reposition in edit mode
    _wmBindDrag(el, hs);

    // Normal-mode click → zoom
    el.addEventListener('click', () => {
        if (_wm.editMode || _wm.zoomed) return;
        _wmZoomIn(hs);
    });
    el.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && !_wm.editMode) _wmZoomIn(hs);
    });

    return el;
}

// ── Drag to reposition (edit mode only) ──────────────────────────────────────

function _wmBindDrag(el, hs) {
    let dragging  = false;
    let hasMoved  = false;
    let startPx   = null; // pointer position at drag start
    let startPct  = null; // hotspot % position at drag start

    el.addEventListener('pointerdown', e => {
        if (!_wm.editMode) return;
        if (e.target.closest('.wm-hotspot-delete')) return;

        e.preventDefault();
        e.stopPropagation(); // don't trigger stage-click (add hotspot)

        dragging = true;
        hasMoved = false;
        el.setPointerCapture(e.pointerId);
        el.classList.add('wm-dragging');

        const canvas = document.querySelector('#worldMapSection .wm-canvas');
        const rect   = canvas.getBoundingClientRect();

        startPx  = { x: e.clientX, y: e.clientY };
        startPct = { x: hs.x, y: hs.y };
        // store rect so we don't requery during move
        el._dragRect = rect;
    });

    el.addEventListener('pointermove', e => {
        if (!dragging) return;
        e.preventDefault();

        const rect = el._dragRect;
        const dx = e.clientX - startPx.x;
        const dy = e.clientY - startPx.y;

        // Only start visual move after a few px (avoids jitter on click)
        if (!hasMoved && Math.hypot(dx, dy) < 4) return;
        hasMoved = true;

        const newX = Math.min(98, Math.max(2, startPct.x + (dx / rect.width)  * 100));
        const newY = Math.min(98, Math.max(2, startPct.y + (dy / rect.height) * 100));

        el.style.left = `${newX}%`;
        el.style.top  = `${newY}%`;
    });

    el.addEventListener('pointerup', e => {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('wm-dragging');
        el.releasePointerCapture(e.pointerId);

        if (!hasMoved) return; // was just a click, don't update coords

        const rect = el._dragRect;
        const dx = e.clientX - startPx.x;
        const dy = e.clientY - startPx.y;
        const newX = Math.min(98, Math.max(2, startPct.x + (dx / rect.width)  * 100));
        const newY = Math.min(98, Math.max(2, startPct.y + (dy / rect.height) * 100));

        // Update the pending hotspot in place (no re-render needed)
        const pending = _wm.pending.find(h => h.id === hs.id);
        if (pending) {
            pending.x = newX;
            pending.y = newY;
            hs.x = newX;
            hs.y = newY;
        }

        // Tell stage-click handler to ignore the synthetic click that follows
        _wm._dragJustEnded = true;
        setTimeout(() => { _wm._dragJustEnded = false; }, 50);
    });

    // Cancel drag if pointer leaves window
    el.addEventListener('pointercancel', () => {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('wm-dragging');
        // Restore original position
        el.style.left = `${hs.x}%`;
        el.style.top  = `${hs.y}%`;
    });
}

function _wmDeleteHotspot(id) {
    _wm.pending = _wm.pending.filter(h => h.id !== id);
    _wmRenderHotspots();
}

// ── Add-hotspot modal ─────────────────────────────────────────────────────────

function _wmOpenAddModal(x, y) {
    document.getElementById('wmAddModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'wmAddModal';
    overlay.className = 'wm-modal-overlay';
    overlay.innerHTML = `
        <div class="wm-modal" role="dialog" aria-modal="true" aria-labelledby="wmModalTitle">
            <h3 id="wmModalTitle">📍 Nuevo punto de interés</h3>
            <div class="wm-modal-field">
                <label for="wmHsLabel">Nombre del lugar</label>
                <input type="text" id="wmHsLabel" placeholder="Ej: Grumak'thar" autocomplete="off" maxlength="60">
            </div>
            <div class="wm-modal-field">
                <label for="wmHsFile">Mapa detallado (JPG · PNG · WebP · máx 20 MB)</label>
                <input type="file" id="wmHsFile" accept="image/jpeg,image/png,image/webp">
                <div class="wm-modal-preview" id="wmHsPreview">
                    <img id="wmHsPreviewImg" src="" alt="Vista previa">
                </div>
                <div class="wm-modal-progress" id="wmHsProgress">Subiendo imagen…</div>
            </div>
            <div class="wm-modal-actions">
                <button class="wm-btn-dismiss" id="wmModalCancel">Cancelar</button>
                <button class="wm-btn-confirm" id="wmModalConfirm">Añadir</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('#wmHsFile').addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            overlay.querySelector('#wmHsPreviewImg').src = e.target.result;
            overlay.querySelector('#wmHsPreview').classList.add('visible');
        };
        reader.readAsDataURL(file);
    });

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#wmModalCancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#wmModalConfirm').addEventListener('click', () =>
        _wmConfirmAddHotspot(x, y, overlay)
    );

    setTimeout(() => overlay.querySelector('#wmHsLabel')?.focus(), 50);
}

async function _wmConfirmAddHotspot(x, y, overlay) {
    const labelInput = overlay.querySelector('#wmHsLabel');
    const fileInput  = overlay.querySelector('#wmHsFile');
    const confirmBtn = overlay.querySelector('#wmModalConfirm');
    const progress   = overlay.querySelector('#wmHsProgress');

    const label = labelInput.value.trim();
    if (!label) {
        labelInput.focus();
        labelInput.style.borderColor = 'var(--accent-blood)';
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Añadiendo…';

    let detailUrl = '', detailFilename = '';

    if (fileInput.files[0]) {
        progress.classList.add('visible');
        try {
            const fileData = await _wmReadFileAsDataURL(fileInput.files[0]);
            const res = await fetch(`${API_BASE}/api/world-map/upload`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ filename: fileInput.files[0].name, fileData }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const data = await res.json();
            detailUrl      = data.url;
            detailFilename = data.filename;
        } catch (err) {
            showNotification(`Error subiendo imagen: ${err.message}`, 4000);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Añadir';
            progress.classList.remove('visible');
            return;
        }
        progress.classList.remove('visible');
    }

    _wm.pending.push({ id: `hs_${Date.now()}`, label, x, y, detailUrl, detailFilename });
    overlay.remove();
    _wmRenderHotspots();
}

function _wmReadFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = e => resolve(e.target.result);
        r.onerror = () => reject(new Error('Error leyendo archivo'));
        r.readAsDataURL(file);
    });
}

// ── Cinematic zoom ────────────────────────────────────────────────────────────
//
// Arquitectura:
//   .wm-stage
//     .wm-canvas  ← solo esto se escala (solo contiene mapa base + hotspots)
//     .wm-detail-layer  ← fuera del canvas, cubre todo el stage sin escala
//     .wm-vignette
//     .wm-region-label
//
// Así el detail map siempre se ve al 100%, nunca ampliado x3.5.

function _wmZoomIn(hs) {
    if (_wm.zoomed || _wm.editMode) return;
    if (!hs.detailUrl) {
        showNotification('Este punto aún no tiene mapa detallado', 2500);
        return;
    }

    _wm.zoomed    = true;
    _wm.currentHs = hs;

    const section     = document.getElementById('worldMapSection');
    const stage       = section.querySelector('.wm-stage');
    const canvas      = section.querySelector('.wm-canvas');
    const vignette    = section.querySelector('.wm-vignette');
    const regionLabel = section.querySelector('.wm-region-label');

    // Zoom origin = centro del hotspot
    canvas.style.transformOrigin = `${hs.x}% ${hs.y}%`;

    // Ocultar hotspots, activar vignette, arrancar zoom
    canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.add('wm-hidden'));
    vignette.classList.add('wm-active');
    canvas.style.transform = `scale(${WM_ZOOM_SCALE})`;

    // Nombre de la región a mitad del zoom
    regionLabel.querySelector('span').textContent = hs.label;
    setTimeout(() => regionLabel.classList.add('wm-active'), WM_ZOOM_MS * 0.4);

    _wmUpdateButtons();

    // Al terminar el zoom → mostrar mapa detallado (en stage, sin escala)
    setTimeout(() => {
        let layer = stage.querySelector(`.wm-detail-layer[data-hs-id="${hs.id}"]`);
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'wm-detail-layer';
            layer.dataset.hsId = hs.id;
            const img = document.createElement('img');
            img.src      = hs.detailUrl;
            img.alt      = `Mapa de ${hs.label}`;
            img.draggable = false;
            layer.appendChild(img);
            // Insertar antes de la vignette para no tapar la UI
            stage.insertBefore(layer, vignette);
        }

        layer.classList.add('wm-visible');

        // Resetear escala del canvas en silencio (está oculto detrás del detail)
        setTimeout(() => {
            canvas.style.transition = 'none';
            canvas.style.transform  = 'scale(1)';
            canvas.style.transformOrigin = 'center center';
            requestAnimationFrame(() => { canvas.style.transition = ''; });

            regionLabel.classList.remove('wm-active');
            vignette.classList.remove('wm-active');
            section.classList.add('wm-detail-open');
            _wmUpdateButtons();
        }, 420);

    }, WM_ZOOM_MS + 50);
}

function wmGoBack() {
    if (!_wm.zoomed) return;
    _wmZoomOut();
}

function _wmZoomOut() {
    const hs = _wm.currentHs;
    const section  = document.getElementById('worldMapSection');
    const stage    = section.querySelector('.wm-stage');
    const canvas   = section.querySelector('.wm-canvas');
    const vignette = section.querySelector('.wm-vignette');

    const layer = stage.querySelector('.wm-detail-layer.wm-visible');

    // 1. Teleportar canvas al estado zoom (sin transición) para que al revelar
    //    el mapa base se vea ya ampliado → zoom out desde ahí
    canvas.style.transition      = 'none';
    canvas.style.transformOrigin = hs ? `${hs.x}% ${hs.y}%` : 'center center';
    canvas.style.transform       = `scale(${WM_ZOOM_SCALE})`;

    section.classList.remove('wm-detail-open');

    // 2. Fade out del mapa detallado (revela el mapa base ampliado)
    if (layer) {
        layer.style.transition = 'opacity 0.35s ease';
        layer.style.opacity    = '0';
    }

    // 3. Tras el fade, restaurar transición y hacer zoom out
    setTimeout(() => {
        canvas.style.transition = '';
        vignette.classList.add('wm-active');
        canvas.style.transform = 'scale(1)';

        setTimeout(() => {
            // Limpiar
            if (layer) {
                layer.classList.remove('wm-visible');
                layer.style.transition = '';
                layer.style.opacity    = '';
            }
            canvas.style.transformOrigin = 'center center';
            canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.remove('wm-hidden'));
            vignette.classList.remove('wm-active');
            _wm.zoomed    = false;
            _wm.currentHs = null;
            section.classList.remove('wm-detail-open');
            _wmUpdateButtons();
        }, WM_ZOOM_MS + 100);
    }, 360);
}

// ── Edit hint helper ──────────────────────────────────────────────────────────

function _wmShowEditHint(visible) {
    const hint = document.getElementById('wmEditHint');
    if (hint) hint.style.display = visible ? 'block' : 'none';
}

// ── Reset al navegar fuera ────────────────────────────────────────────────────

function _wmReset() {
    const section = document.getElementById('worldMapSection');
    if (!section) return;
    const canvas = section.querySelector('.wm-canvas');
    const stage  = section.querySelector('.wm-stage');

    if (canvas) {
        canvas.style.transition      = 'none';
        canvas.style.transform       = 'scale(1)';
        canvas.style.transformOrigin = 'center center';
        canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.remove('wm-hidden'));
        requestAnimationFrame(() => { canvas.style.transition = ''; });
    }
    if (stage) {
        stage.querySelectorAll('.wm-detail-layer').forEach(l => {
            l.classList.remove('wm-visible');
            l.style.transition = '';
            l.style.opacity    = '';
        });
    }

    section.querySelector('.wm-vignette')?.classList.remove('wm-active');
    section.querySelector('.wm-region-label')?.classList.remove('wm-active');
    section.classList.remove('wm-detail-open', 'wm-edit-mode');

    _wm.zoomed    = false;
    _wm.editMode  = false;
    _wm.currentHs = null;
    document.getElementById('wmAddModal')?.remove();
    _wmShowEditHint(false);
}
