// ============================================
// Combat Maps — gestión de mapas de combate
// Depends on: globals.js (API_BASE), view.js (setView)
// ============================================

let _combatMapsCache = null;

function _isVideoFilename(filename) {
    return /\.(mp4|webm|ogg)$/i.test(filename);
}

function openCombatMaps() {
    _combatMapsCache = null;
    setView('combatMaps');
    renderCombatMaps();
}

// Invalida la caché cuando se sube un nuevo mapa (también usada desde combat-setup.js)
function invalidateCombatMapsCache() {
    _combatMapsCache = null;
}

async function renderCombatMaps() {
    const grid = document.getElementById('combatMapsGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="cm-loading">🔄 Cargando mapas…</div>';

    try {
        if (!_combatMapsCache) {
            const res = await fetch(`${API_BASE}/api/combat-maps`);
            _combatMapsCache = res.ok ? await res.json() : [];
        }
    } catch (_) {
        _combatMapsCache = [];
    }

    const maps = _combatMapsCache;

    if (!maps.length) {
        grid.innerHTML = `<div class="cm-empty">
            <div class="cm-empty-icon">🗺️</div>
            <div class="cm-empty-text">Aún no hay mapas. Pulsa <strong>Añadir mapa</strong> para subir el primero.</div>
        </div>`;
        return;
    }

    grid.innerHTML = maps.map(m => {
        const isVid = m.isVideo || _isVideoFilename(m.filename);
        const thumb = isVid
            ? `<video class="cm-thumb cm-thumb-video" src="${m.url}" muted loop autoplay playsinline
                      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"></video>`
            : `<img class="cm-thumb" src="${m.url}" alt="${m.name}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`;
        const videoBadge = isVid ? '<span class="cm-video-badge">▶ vídeo</span>' : '';
        return `<div class="cm-card">
            ${thumb}
            <div class="cm-thumb-placeholder" style="display:none">🗺️</div>
            <div class="cm-info">
                <div class="cm-name">${m.name} ${videoBadge}</div>
                <div class="cm-filename">${m.filename || '—'}</div>
            </div>
            <button class="cm-view-btn" onclick="openCombatMapLightbox('${m._id}')" title="Ver en grande">🔍</button>
            <button class="cm-delete-btn" onclick="deleteCombatMap('${m._id}', '${m.name}')" title="Eliminar mapa">🗑</button>
        </div>`;
    }).join('');
}

async function deleteCombatMap(id, name) {
    if (!confirm(`¿Eliminar el mapa "${name}"? Esta acción no se puede deshacer.`)) return;

    try {
        const res = await fetch(`${API_BASE}/api/combat-maps/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Error al eliminar');
        _combatMapsCache = null;
        renderCombatMaps();
        showNotification('🗑 Mapa eliminado', 1800);
    } catch (err) {
        showNotification('❌ ' + err.message, 3000);
    }
}

// ─── Upload modal ─────────────────────────────────

function openUploadMapModal() {
    const modal = document.getElementById('uploadMapModal');
    if (!modal) return;
    document.getElementById('uploadMapName').value = '';
    document.getElementById('uploadMapFile').value = '';
    _resetUploadPreview();
    document.getElementById('uploadMapError').textContent = '';
    modal.style.display = 'flex';
}

function closeUploadMapModal() {
    const modal = document.getElementById('uploadMapModal');
    if (modal) modal.style.display = 'none';
    _resetUploadPreview();
}

function _resetUploadPreview() {
    const img = document.getElementById('uploadMapPreview');
    const vid = document.getElementById('uploadMapVideoPreview');
    if (img) { img.style.display = 'none'; img.src = ''; }
    if (vid) { vid.style.display = 'none'; vid.src = ''; vid.pause?.(); }
}

function onUploadMapFileChange(input) {
    const file = input.files[0];
    if (!file) return;

    // Auto-fill name from filename if empty
    const nameInput = document.getElementById('uploadMapName');
    if (!nameInput.value.trim()) {
        nameInput.value = file.name
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    const isVid = file.type.startsWith('video/');

    // Show preview
    const reader = new FileReader();
    reader.onload = e => {
        const img = document.getElementById('uploadMapPreview');
        const vid = document.getElementById('uploadMapVideoPreview');
        if (isVid) {
            if (img) { img.style.display = 'none'; img.src = ''; }
            if (vid) { vid.src = e.target.result; vid.style.display = 'block'; vid.load(); vid.play().catch(() => {}); }
        } else {
            if (vid) { vid.style.display = 'none'; vid.src = ''; }
            if (img) { img.src = e.target.result; img.style.display = 'block'; }
        }
    };
    reader.readAsDataURL(file);
}

async function submitUploadMap() {
    const nameInput = document.getElementById('uploadMapName');
    const fileInput = document.getElementById('uploadMapFile');
    const errorEl   = document.getElementById('uploadMapError');
    const submitBtn = document.getElementById('uploadMapSubmitBtn');

    errorEl.textContent = '';

    const name = nameInput.value.trim();
    const file = fileInput.files[0];

    if (!name) { errorEl.textContent = 'Introduce un nombre para el mapa.'; return; }
    if (!file) { errorEl.textContent = 'Selecciona un archivo.'; return; }

    const isVid  = file.type.startsWith('video/');
    const maxMB  = isVid ? 100 : 15;
    const maxBytes = maxMB * 1024 * 1024;

    if (file.size > maxBytes) {
        errorEl.textContent = `El archivo supera los ${maxMB} MB.`;
        return;
    }

    submitBtn.disabled   = true;
    submitBtn.textContent = 'Subiendo…';

    try {
        const fileData = await _readFileAsDataURL(file);
        const res = await fetch(`${API_BASE}/api/combat-maps`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, filename: file.name, fileData }),
        });

        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Error al subir el mapa');

        _combatMapsCache = null;
        invalidateCombatMapsCache();
        if (typeof _cachedServerMaps !== 'undefined') window._cachedServerMaps = null;

        closeUploadMapModal();
        renderCombatMaps();
        showNotification('✅ Mapa subido correctamente', 2000);
    } catch (err) {
        errorEl.textContent = err.message;
    } finally {
        submitBtn.disabled   = false;
        submitBtn.textContent = 'Subir mapa';
    }
}

function _readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Error leyendo el archivo'));
        reader.readAsDataURL(file);
    });
}

// ─── Lightbox ─────────────────────────────────────

function openCombatMapLightbox(id) {
    const maps = _combatMapsCache || [];
    const m = maps.find(x => x._id === id);
    if (!m) return;

    const isVid = m.isVideo || _isVideoFilename(m.filename);

    const overlay = document.createElement('div');
    overlay.className = 'cm-lightbox-overlay';
    overlay.addEventListener('click', e => {
        if (e.target === overlay) _closeCombatMapLightbox(overlay);
    });

    const media = isVid
        ? `<video class="cm-lightbox-media" src="${m.url}" controls autoplay loop playsinline></video>`
        : `<img class="cm-lightbox-media" src="${m.url}" alt="${m.name}">`;

    overlay.innerHTML = `
        <div class="cm-lightbox">
            <button class="cm-lightbox-close" onclick="_closeCombatMapLightbox(this.closest('.cm-lightbox-overlay'))" title="Cerrar">✕</button>
            ${media}
            <div class="cm-lightbox-caption">${m.name}</div>
        </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('cm-lightbox-visible'));

    const onKey = e => {
        if (e.key === 'Escape') { _closeCombatMapLightbox(overlay); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
    overlay._removeKey = onKey;
}

function _closeCombatMapLightbox(overlay) {
    if (!overlay) return;
    if (overlay._removeKey) document.removeEventListener('keydown', overlay._removeKey);
    overlay.classList.remove('cm-lightbox-visible');
    setTimeout(() => overlay.remove(), 250);
}
