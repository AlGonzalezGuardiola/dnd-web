/* ============================================
   world-map.js — Mapa del mundo con edición
   visual y zoom cinemático
   ============================================ */

// ── State ─────────────────────────────────────────────────────────────────────

const _wm = {
    hotspots:   [],   // loaded from / saved to API
    pending:    [],   // unsaved changes during edit session
    editMode:   false,
    zoomed:     false,
    inited:     false,
};

// ── Config ────────────────────────────────────────────────────────────────────

const WM_ZOOM_SCALE  = 3.5;
const WM_HOTSPOT_PCT = 2.8;   // default hotspot diameter as % of canvas width
const WM_ZOOM_MS     = 1100;  // must match CSS transition duration

// ── Public API ────────────────────────────────────────────────────────────────

function openWorldMapView() {
    setView('worldMap');
    _wmInit();
}

async function _wmInit() {
    const section = document.getElementById('worldMapSection');
    if (!section) return;

    if (!_wm.inited) {
        _wm.inited = true;
        _wmBindStaticElements(section);
    }

    // Always reload hotspots from server when opening the view
    await _wmLoadHotspots();
    _wmRenderHotspots();
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function _wmEl(id) { return document.getElementById(id); }

function _wmBindStaticElements(section) {
    const stage    = section.querySelector('.wm-stage');
    const btnEdit  = section.querySelector('.wm-btn-edit');
    const btnSave  = section.querySelector('.wm-btn-save');
    const btnCancel = section.querySelector('.wm-btn-cancel');

    btnEdit.addEventListener('click',   _wmEnterEditMode);
    btnSave.addEventListener('click',   _wmSave);
    btnCancel.addEventListener('click', _wmCancelEdit);

    // Click on stage while in edit mode → place hotspot
    stage.addEventListener('click', _wmOnStageClick);

    // Reset state when navigating away
    new MutationObserver(() => {
        if (section.style.display === 'none') _wmReset();
    }).observe(section, { attributes: true, attributeFilter: ['style'] });
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
}

function _wmExitEditMode() {
    _wm.editMode = false;
    document.getElementById('worldMapSection').classList.remove('wm-edit-mode');
    _wmRenderHotspots();
}

function _wmCancelEdit() {
    _wm.pending = _wm.hotspots.map(h => ({ ...h }));
    _wmExitEditMode();
}

// ── Stage click → place hotspot (edit mode only) ──────────────────────────────

function _wmOnStageClick(e) {
    if (!_wm.editMode) return;

    // Ignore clicks that originate from delete buttons
    if (e.target.closest('.wm-hotspot-delete')) return;

    const canvas = document.querySelector('#worldMapSection .wm-canvas');
    const rect   = canvas.getBoundingClientRect();

    // Convert to percentage relative to the canvas (= rendered image size)
    const x = ((e.clientX - rect.left)  / rect.width)  * 100;
    const y = ((e.clientY - rect.top)   / rect.height) * 100;

    // Clamp to [2, 98] so the circle never overflows the image
    const cx = Math.min(98, Math.max(2, x));
    const cy = Math.min(98, Math.max(2, y));

    _wmOpenAddModal(cx, cy);
}

// ── Render hotspots ───────────────────────────────────────────────────────────

function _wmRenderHotspots() {
    const canvas   = document.querySelector('#worldMapSection .wm-canvas');
    const emptyHint = document.querySelector('#worldMapSection .wm-empty-hint');
    if (!canvas) return;

    // Remove existing dynamic hotspots
    canvas.querySelectorAll('.wm-hotspot').forEach(el => el.remove());

    const list = _wm.editMode ? _wm.pending : _wm.hotspots;

    list.forEach(hs => {
        const el = _wmBuildHotspotEl(hs);
        canvas.appendChild(el);
    });

    // Empty state hint (only visible via CSS when in edit mode)
    if (emptyHint) {
        emptyHint.style.display = (list.length === 0 && _wm.editMode) ? 'flex' : 'none';
    }
}

function _wmBuildHotspotEl(hs) {
    const el = document.createElement('div');
    el.className = 'wm-hotspot';
    el.dataset.id    = hs.id;
    el.dataset.label = hs.label;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', hs.label);

    const size = WM_HOTSPOT_PCT;
    el.style.left   = `${hs.x}%`;
    el.style.top    = `${hs.y}%`;
    el.style.width  = `${size}%`;
    el.style.height = `${size}%`;
    // transform: translate(-50%,-50%) is in CSS so the x/y is the circle centre

    // Delete button (visible only in edit mode via CSS)
    const delBtn = document.createElement('button');
    delBtn.className = 'wm-hotspot-delete';
    delBtn.innerHTML = '✕';
    delBtn.setAttribute('aria-label', `Eliminar ${hs.label}`);
    delBtn.addEventListener('click', e => {
        e.stopPropagation();
        _wmDeleteHotspot(hs.id);
    });
    el.appendChild(delBtn);

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

function _wmDeleteHotspot(id) {
    _wm.pending = _wm.pending.filter(h => h.id !== id);
    _wmRenderHotspots();
}

// ── Add-hotspot modal ─────────────────────────────────────────────────────────

function _wmOpenAddModal(x, y) {
    // Remove any existing modal
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

    // File preview
    overlay.querySelector('#wmHsFile').addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const preview   = overlay.querySelector('#wmHsPreview');
        const previewImg = overlay.querySelector('#wmHsPreviewImg');
        const reader = new FileReader();
        reader.onload = e => {
            previewImg.src = e.target.result;
            preview.classList.add('visible');
        };
        reader.readAsDataURL(file);
    });

    // Close on backdrop click
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('#wmModalCancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#wmModalConfirm').addEventListener('click', () =>
        _wmConfirmAddHotspot(x, y, overlay)
    );

    // Focus name input
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

    const file = fileInput.files[0];

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Añadiendo…';

    let detailUrl      = '';
    let detailFilename = '';

    if (file) {
        // Upload image first
        progress.classList.add('visible');
        try {
            const fileData = await _wmReadFileAsDataURL(file);
            const res = await fetch(`${API_BASE}/api/world-map/upload`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ filename: file.name, fileData }),
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

    // Add hotspot to pending list
    _wm.pending.push({
        id:             `hs_${Date.now()}`,
        label,
        x,
        y,
        detailUrl,
        detailFilename,
    });

    overlay.remove();
    _wmRenderHotspots();
}

function _wmReadFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Error leyendo el archivo'));
        reader.readAsDataURL(file);
    });
}

// ── Cinematic zoom ────────────────────────────────────────────────────────────

function _wmZoomIn(hs) {
    if (_wm.zoomed || _wm.editMode) return;
    if (!hs.detailUrl) {
        showNotification('Este punto aún no tiene mapa detallado', 2500);
        return;
    }

    _wm.zoomed = true;

    const section    = document.getElementById('worldMapSection');
    const canvas     = section.querySelector('.wm-canvas');
    const vignette   = section.querySelector('.wm-vignette');
    const regionLabel = section.querySelector('.wm-region-label');
    const labelSpan  = regionLabel.querySelector('span');

    // Set zoom origin to the hotspot centre
    canvas.style.transformOrigin = `${hs.x}% ${hs.y}%`;

    // Hide hotspots
    canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.add('wm-hidden'));

    // Vignette + zoom
    vignette.classList.add('wm-active');
    canvas.style.transform = `scale(${WM_ZOOM_SCALE})`;

    // Region label at ~400ms
    labelSpan.textContent = hs.label;
    setTimeout(() => regionLabel.classList.add('wm-active'), 400);

    // After zoom completes: show detail map
    setTimeout(() => {
        let layer = canvas.querySelector(`.wm-detail-layer[data-hs-id="${hs.id}"]`);
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'wm-detail-layer';
            layer.dataset.hsId = hs.id;
            const img = document.createElement('img');
            img.src = hs.detailUrl;
            img.alt = `Mapa de ${hs.label}`;
            img.draggable = false;
            layer.appendChild(img);
            canvas.appendChild(layer);
        }

        layer.classList.add('wm-visible');
        setTimeout(() => regionLabel.classList.remove('wm-active'), 500);

        section.classList.add('wm-detail-open');
        vignette.classList.remove('wm-active');
    }, WM_ZOOM_MS + 200);
}

function _wmZoomOut() {
    const section    = document.getElementById('worldMapSection');
    const canvas     = section.querySelector('.wm-canvas');
    const vignette   = section.querySelector('.wm-vignette');
    const regionLabel = section.querySelector('.wm-region-label');

    // Fade out detail layer fast
    const layer = canvas.querySelector('.wm-detail-layer.wm-visible');
    if (layer) {
        layer.style.transition = 'opacity 0.3s ease';
        layer.style.opacity = '0';
    }

    vignette.classList.add('wm-active');
    section.classList.remove('wm-detail-open');

    setTimeout(() => {
        canvas.style.transform = 'scale(1)';
        vignette.classList.remove('wm-active');
    }, 350);

    setTimeout(() => {
        if (layer) {
            layer.classList.remove('wm-visible');
            layer.style.transition = '';
            layer.style.opacity = '';
        }
        canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.remove('wm-hidden'));
        _wm.zoomed = false;
    }, 350 + WM_ZOOM_MS);
}

// ── Reset on navigate away ────────────────────────────────────────────────────

function _wmReset() {
    const section = document.getElementById('worldMapSection');
    if (!section) return;
    const canvas = section.querySelector('.wm-canvas');

    if (canvas) {
        canvas.style.transition   = 'none';
        canvas.style.transform    = 'scale(1)';
        canvas.style.transformOrigin = 'center center';
        canvas.querySelectorAll('.wm-detail-layer').forEach(l => l.classList.remove('wm-visible'));
        canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.remove('wm-hidden'));
        requestAnimationFrame(() => { canvas.style.transition = ''; });
    }

    section.querySelector('.wm-vignette')?.classList.remove('wm-active');
    section.querySelector('.wm-region-label')?.classList.remove('wm-active');
    section.classList.remove('wm-detail-open', 'wm-edit-mode');

    _wm.zoomed   = false;
    _wm.editMode = false;
    document.getElementById('wmAddModal')?.remove();
}

// view.js calls this as the back button handler:
function wmGoBack() {
    if (_wm.zoomed) _wmZoomOut();
}
