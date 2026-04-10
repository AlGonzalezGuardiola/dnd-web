/* ============================================
   world-map.js — Mapa del mundo multi-nivel
   Cada mapa (world + detalle) tiene sus propios
   hotspots guardados por mapId en MongoDB.
   ============================================ */

// ── State ─────────────────────────────────────────────────────────────────────

const _wm = {
    // Mapa actualmente visible
    currentMapId: 'world',
    hotspots:     [],   // cargados del servidor para currentMapId
    pending:      [],   // cambios no guardados (modo edición)

    // Pila de navegación: [{mapId, hotspots, label}]
    mapStack: [],

    editMode:       false,
    zoomed:         false,   // true cuando se está viendo un mapa de detalle
    inited:         false,
    currentHs:      null,    // hotspot que provocó el zoom actual
    _dragJustEnded: false,
};

// ── Config ────────────────────────────────────────────────────────────────────

const WM_ZOOM_SCALE  = 3.5;
const WM_ZOOM_MS     = 600;
const WM_HOTSPOT_PCT = 2.8;

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

    // Carga hotspots del mapa raíz
    _wm.currentMapId = 'world';
    _wm.mapStack     = [];
    await _wmLoadHotspots('world');
    _wmRenderHotspots();
    _wmUpdateButtons();
    _wmShowEditHint(false);
}

// ── Botones (en #wmHudControls del HUD) ──────────────────────────────────────

function _wmBindButtons(section) {
    document.getElementById('wmBtnEdit')  .addEventListener('click', _wmEnterEditMode);
    document.getElementById('wmBtnSave')  .addEventListener('click', _wmSave);
    document.getElementById('wmBtnCancel').addEventListener('click', _wmCancelEdit);
    document.getElementById('wmBtnBack')  .addEventListener('click', wmGoBack);

    section.querySelector('.wm-stage').addEventListener('click', _wmOnStageClick);

    new MutationObserver(() => {
        if (section.style.display === 'none') _wmReset();
    }).observe(section, { attributes: true, attributeFilter: ['style'] });
}

function _wmUpdateButtons() {
    const btnBack   = document.getElementById('wmBtnBack');
    const btnEdit   = document.getElementById('wmBtnEdit');
    const btnCancel = document.getElementById('wmBtnCancel');
    const btnSave   = document.getElementById('wmBtnSave');
    if (!btnBack) return;

    const show = el => { el.style.display = 'inline-flex'; };
    const hide = el => { el.style.display = 'none'; };

    if (_wm.editMode) {
        _wm.zoomed ? show(btnBack) : hide(btnBack);
        hide(btnEdit);
        show(btnCancel);
        show(btnSave);
    } else {
        _wm.zoomed ? show(btnBack) : hide(btnBack);
        show(btnEdit);
        hide(btnCancel);
        hide(btnSave);
    }
}

// ── Cargar / Guardar ──────────────────────────────────────────────────────────

async function _wmLoadHotspots(mapId) {
    _wm.currentMapId = mapId;
    try {
        const res = await fetch(`${API_BASE}/api/world-map?mapId=${encodeURIComponent(mapId)}`);
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
    const btn = document.getElementById('wmBtnSave');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        const res = await fetch(`${API_BASE}/api/world-map`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ mapId: _wm.currentMapId, hotspots: _wm.pending }),
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

// ── Modo edición ──────────────────────────────────────────────────────────────

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

function _wmShowEditHint(visible) {
    const hint = document.getElementById('wmEditHint');
    if (hint) hint.style.display = visible ? 'block' : 'none';
}

// ── Canvas activo (world o detail) ────────────────────────────────────────────
// Los hotspots siempre se renderizan sobre el canvas del mapa visible.

function _wmActiveCanvas() {
    if (_wm.zoomed) {
        return document.querySelector(
            '#worldMapSection .wm-detail-layer.wm-visible .wm-detail-canvas'
        );
    }
    return document.querySelector('#worldMapSection .wm-canvas');
}

// ── Render hotspots ───────────────────────────────────────────────────────────

function _wmRenderHotspots() {
    const canvas    = _wmActiveCanvas();
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

    const del = document.createElement('button');
    del.className = 'wm-hotspot-delete';
    del.innerHTML = '✕';
    del.setAttribute('aria-label', `Eliminar ${hs.label}`);
    del.addEventListener('click', e => { e.stopPropagation(); _wmDeleteHotspot(hs.id); });
    el.appendChild(del);

    _wmBindDrag(el, hs);

    el.addEventListener('click', () => {
        if (_wm.editMode) return;
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

// ── Stage click → añadir hotspot ─────────────────────────────────────────────

function _wmOnStageClick(e) {
    if (!_wm.editMode) return;
    if (e.target.closest('.wm-hotspot')) return;
    if (_wm._dragJustEnded) { _wm._dragJustEnded = false; return; }

    const canvas = _wmActiveCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Ignorar clicks fuera del canvas (zona letterbox)
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom) return;

    const x = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width)  * 100));
    const y = Math.min(98, Math.max(2, ((e.clientY - rect.top)  / rect.height) * 100));

    _wmOpenAddModal(x, y);
}

// ── Modal añadir hotspot ──────────────────────────────────────────────────────

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
                <input type="text" id="wmHsLabel" placeholder="Ej: La Ciudadela" autocomplete="off" maxlength="60">
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
    overlay.querySelector('#wmModalConfirm').addEventListener('click',
        () => _wmConfirmAddHotspot(x, y, overlay)
    );

    setTimeout(() => overlay.querySelector('#wmHsLabel')?.focus(), 50);
}

async function _wmConfirmAddHotspot(x, y, overlay) {
    const labelInput = overlay.querySelector('#wmHsLabel');
    const fileInput  = overlay.querySelector('#wmHsFile');
    const confirmBtn = overlay.querySelector('#wmModalConfirm');
    const progress   = overlay.querySelector('#wmHsProgress');

    const label = labelInput.value.trim();
    if (!label) { labelInput.focus(); labelInput.style.borderColor = 'var(--accent-blood)'; return; }

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

// ── Drag para mover hotspot ───────────────────────────────────────────────────

function _wmBindDrag(el, hs) {
    let dragging = false, hasMoved = false, startPx, startPct;

    el.addEventListener('pointerdown', e => {
        if (!_wm.editMode) return;
        if (e.target.closest('.wm-hotspot-delete')) return;
        e.preventDefault();
        e.stopPropagation();

        dragging = true; hasMoved = false;
        el.setPointerCapture(e.pointerId);
        el.classList.add('wm-dragging');

        const canvas = _wmActiveCanvas();
        el._dragRect = canvas.getBoundingClientRect();
        startPx  = { x: e.clientX, y: e.clientY };
        startPct = { x: hs.x, y: hs.y };
    });

    el.addEventListener('pointermove', e => {
        if (!dragging) return;
        e.preventDefault();
        const dx = e.clientX - startPx.x, dy = e.clientY - startPx.y;
        if (!hasMoved && Math.hypot(dx, dy) < 4) return;
        hasMoved = true;
        const rect = el._dragRect;
        el.style.left = `${Math.min(98, Math.max(2, startPct.x + (dx / rect.width)  * 100))}%`;
        el.style.top  = `${Math.min(98, Math.max(2, startPct.y + (dy / rect.height) * 100))}%`;
    });

    el.addEventListener('pointerup', e => {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('wm-dragging');
        el.releasePointerCapture(e.pointerId);
        if (!hasMoved) return;

        const rect = el._dragRect;
        const newX = Math.min(98, Math.max(2, startPct.x + ((e.clientX - startPx.x) / rect.width)  * 100));
        const newY = Math.min(98, Math.max(2, startPct.y + ((e.clientY - startPx.y) / rect.height) * 100));

        const pending = _wm.pending.find(h => h.id === hs.id);
        if (pending) { pending.x = newX; pending.y = newY; }
        hs.x = newX; hs.y = newY;

        _wm._dragJustEnded = true;
        setTimeout(() => { _wm._dragJustEnded = false; }, 50);
    });

    el.addEventListener('pointercancel', () => {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('wm-dragging');
        el.style.left = `${hs.x}%`;
        el.style.top  = `${hs.y}%`;
    });
}

// ── Zoom cinemático (mapa raíz → detalle) ────────────────────────────────────
//
// Estructura en DOM:
//   .wm-stage
//     .wm-canvas          ← se escala (solo mapa raíz / nivel actual)
//     .wm-detail-layer    ← hermano del canvas, cubre todo el stage
//       .wm-detail-canvas ← mismo patrón que .wm-canvas (imagen + hotspots)
//     .wm-vignette
//     .wm-region-label

function _wmZoomIn(hs) {
    if (_wm.editMode) return;
    if (!hs.detailUrl) {
        showNotification('Este punto aún no tiene mapa detallado', 2500);
        return;
    }

    // Si ya estamos en un detalle, navegación simple (cross-fade)
    if (_wm.zoomed) {
        _wmNavigateDeeper(hs);
        return;
    }

    // Primera vez: animación cinemática desde el mapa raíz
    _wm.zoomed    = true;
    _wm.currentHs = hs;
    _wmUpdateButtons();

    const section     = document.getElementById('worldMapSection');
    const stage       = section.querySelector('.wm-stage');
    const canvas      = section.querySelector('.wm-canvas');
    const vignette    = section.querySelector('.wm-vignette');
    const regionLabel = section.querySelector('.wm-region-label');

    canvas.style.transformOrigin = `${hs.x}% ${hs.y}%`;
    canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.add('wm-hidden'));
    vignette.classList.add('wm-active');
    canvas.style.transform = `scale(${WM_ZOOM_SCALE})`;

    regionLabel.querySelector('span').textContent = hs.label;
    setTimeout(() => regionLabel.classList.add('wm-active'), WM_ZOOM_MS * 0.4);

    setTimeout(async () => {
        // Crear / reutilizar detail layer con .wm-detail-canvas dentro
        let layer = stage.querySelector(`.wm-detail-layer[data-hs-id="${hs.id}"]`);
        if (!layer) {
            layer = _wmCreateDetailLayer(hs);
            stage.insertBefore(layer, vignette);
        }
        layer.classList.add('wm-visible');

        // Resetear canvas base en silencio (oculto detrás del detail)
        setTimeout(async () => {
            canvas.style.transition      = 'none';
            canvas.style.transform       = 'scale(1)';
            canvas.style.transformOrigin = 'center center';
            requestAnimationFrame(() => { canvas.style.transition = ''; });

            regionLabel.classList.remove('wm-active');
            vignette.classList.remove('wm-active');
            section.classList.add('wm-detail-open');

            // Empujar mapa actual a la pila y cargar hotspots del detalle
            _wm.mapStack.push({
                mapId:    _wm.currentMapId,
                hotspots: _wm.hotspots.map(h => ({ ...h })),
            });
            await _wmLoadHotspots(hs.detailUrl);

            const detailCanvas = layer.querySelector('.wm-detail-canvas');
            if (detailCanvas) _wmRenderHotspots();
            _wmUpdateButtons();
        }, 420);

    }, WM_ZOOM_MS + 50);
}

// Navegación más profunda (ya en un detalle): cross-fade sin animación de zoom
async function _wmNavigateDeeper(hs) {
    const section  = document.getElementById('worldMapSection');
    const stage    = section.querySelector('.wm-stage');
    const vignette = section.querySelector('.wm-vignette');

    // Fade out de hotspots actuales
    const currentLayer = stage.querySelector('.wm-detail-layer.wm-visible');
    if (currentLayer) {
        currentLayer.style.transition = 'opacity 0.3s ease';
        currentLayer.style.opacity    = '0';
    }
    vignette.classList.add('wm-active');

    setTimeout(async () => {
        if (currentLayer) {
            currentLayer.classList.remove('wm-visible');
            currentLayer.style.transition = '';
            currentLayer.style.opacity    = '';
        }

        _wm.mapStack.push({
            mapId:    _wm.currentMapId,
            hotspots: _wm.hotspots.map(h => ({ ...h })),
            layerId:  currentLayer?.dataset.hsId,
        });
        _wm.currentHs = hs;

        let layer = stage.querySelector(`.wm-detail-layer[data-hs-id="${hs.id}"]`);
        if (!layer) {
            layer = _wmCreateDetailLayer(hs);
            stage.insertBefore(layer, vignette);
        }
        layer.classList.add('wm-visible');
        vignette.classList.remove('wm-active');

        await _wmLoadHotspots(hs.detailUrl);
        _wmRenderHotspots();
        _wmUpdateButtons();
    }, 350);
}

function _wmCreateDetailLayer(hs) {
    const layer = document.createElement('div');
    layer.className   = 'wm-detail-layer';
    layer.dataset.hsId = hs.id;

    const detailCanvas = document.createElement('div');
    detailCanvas.className = 'wm-detail-canvas';

    const img = document.createElement('img');
    img.src      = hs.detailUrl;
    img.alt      = `Mapa de ${hs.label}`;
    img.draggable = false;

    detailCanvas.appendChild(img);
    layer.appendChild(detailCanvas);
    return layer;
}

// ── Volver (zoom-out o retroceso en la pila) ──────────────────────────────────

function wmGoBack() {
    if (!_wm.zoomed) return;

    if (_wm.mapStack.length > 1) {
        // Hay más de un nivel: retroceder un nivel sin animación de zoom
        _wmNavigateBack();
    } else {
        // Último nivel: zoom-out cinematográfico al mapa raíz
        _wmZoomOut();
    }
}

async function _wmNavigateBack() {
    const section  = document.getElementById('worldMapSection');
    const stage    = section.querySelector('.wm-stage');
    const vignette = section.querySelector('.wm-vignette');

    const currentLayer = stage.querySelector('.wm-detail-layer.wm-visible');
    if (currentLayer) {
        currentLayer.style.transition = 'opacity 0.3s ease';
        currentLayer.style.opacity    = '0';
    }
    vignette.classList.add('wm-active');

    setTimeout(async () => {
        if (currentLayer) {
            currentLayer.classList.remove('wm-visible');
            currentLayer.style.transition = '';
            currentLayer.style.opacity    = '';
        }

        const parent = _wm.mapStack.pop();
        if (!parent) { _wmZoomOut(); return; }

        // Si quedan más niveles, mostrar el layer del nivel anterior
        if (_wm.mapStack.length >= 1) {
            const prevHsId = parent.layerId;
            const prevLayer = prevHsId
                ? stage.querySelector(`.wm-detail-layer[data-hs-id="${prevHsId}"]`)
                : null;

            if (prevLayer) {
                prevLayer.classList.add('wm-visible');
            }
        }

        _wm.currentMapId = parent.mapId;
        _wm.hotspots     = parent.hotspots;
        _wm.pending      = parent.hotspots.map(h => ({ ...h }));

        // Si ya no hay más niveles en el stack, significa que volvemos al mapa raíz
        if (_wm.mapStack.length === 0) {
            _wm.zoomed    = false;
            _wm.currentHs = null;
            section.classList.remove('wm-detail-open');
            vignette.classList.remove('wm-active');
            _wmRenderHotspots(); // re-render en .wm-canvas
        } else {
            _wm.currentHs = null;
            vignette.classList.remove('wm-active');
            _wmRenderHotspots(); // re-render en el detail-canvas visible
        }
        _wmUpdateButtons();
    }, 350);
}

function _wmZoomOut() {
    const hs = _wm.currentHs;
    const section  = document.getElementById('worldMapSection');
    const stage    = section.querySelector('.wm-stage');
    const canvas   = section.querySelector('.wm-canvas');
    const vignette = section.querySelector('.wm-vignette');

    const layer = stage.querySelector('.wm-detail-layer.wm-visible');

    // Limpiar hotspots del detail canvas antes de que aparezca el canvas base
    layer?.querySelectorAll('.wm-hotspot').forEach(h => h.remove());

    // Teleportar canvas base al estado zoom (instantáneo)
    canvas.style.transition      = 'none';
    canvas.style.transformOrigin = hs ? `${hs.x}% ${hs.y}%` : 'center center';
    canvas.style.transform       = `scale(${WM_ZOOM_SCALE})`;
    section.classList.remove('wm-detail-open');

    // Fade out del mapa de detalle
    if (layer) {
        layer.style.transition = 'opacity 0.35s ease';
        layer.style.opacity    = '0';
    }

    setTimeout(() => {
        // Restaurar hotspots en el canvas base
        _wmRenderHotspots();
        // Ahora sí hacer zoom-out con animación
        canvas.style.transition = '';
        vignette.classList.add('wm-active');
        canvas.style.transform  = 'scale(1)';

        setTimeout(() => {
            if (layer) {
                layer.classList.remove('wm-visible');
                layer.style.transition = '';
                layer.style.opacity    = '';
            }
            canvas.style.transformOrigin = 'center center';
            canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.remove('wm-hidden'));
            vignette.classList.remove('wm-active');

            // Restaurar estado del mapa padre
            const parent = _wm.mapStack.pop() ?? { mapId: 'world', hotspots: [] };
            _wm.currentMapId = parent.mapId;
            _wm.hotspots     = parent.hotspots;
            _wm.pending      = parent.hotspots.map(h => ({ ...h }));
            _wm.zoomed       = false;
            _wm.currentHs    = null;
            _wmUpdateButtons();
        }, WM_ZOOM_MS + 100);
    }, 360);
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

    _wm.zoomed        = false;
    _wm.editMode      = false;
    _wm.currentHs     = null;
    _wm.mapStack      = [];
    _wm.currentMapId  = 'world';
    document.getElementById('wmAddModal')?.remove();
    _wmShowEditHint(false);
}
