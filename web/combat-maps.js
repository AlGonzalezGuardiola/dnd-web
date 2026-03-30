// ============================================
// Combat Maps — gestión de mapas de combate
// Depends on: globals.js (API_BASE), view.js (setView)
// ============================================

let _combatMapsCache = null;

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

    grid.innerHTML = maps.map(m => `
        <div class="cm-card">
            <img class="cm-thumb" src="${m.url}" alt="${m.name}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="cm-thumb-placeholder" style="display:none">🗺️</div>
            <div class="cm-info">
                <div class="cm-name">${m.name}</div>
                <div class="cm-filename">${m.filename}</div>
            </div>
            <button class="cm-delete-btn" onclick="deleteCombatMap('${m._id}', '${m.name}')" title="Eliminar mapa">🗑</button>
        </div>
    `).join('');
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
    document.getElementById('uploadMapPreview').style.display = 'none';
    document.getElementById('uploadMapPreview').src = '';
    document.getElementById('uploadMapError').textContent = '';
    modal.style.display = 'flex';
}

function closeUploadMapModal() {
    const modal = document.getElementById('uploadMapModal');
    if (modal) modal.style.display = 'none';
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

    // Show preview
    const reader = new FileReader();
    reader.onload = e => {
        const preview = document.getElementById('uploadMapPreview');
        preview.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function submitUploadMap() {
    const nameInput  = document.getElementById('uploadMapName');
    const fileInput  = document.getElementById('uploadMapFile');
    const errorEl    = document.getElementById('uploadMapError');
    const submitBtn  = document.getElementById('uploadMapSubmitBtn');

    errorEl.textContent = '';

    const name = nameInput.value.trim();
    const file = fileInput.files[0];

    if (!name) { errorEl.textContent = 'Introduce un nombre para el mapa.'; return; }
    if (!file) { errorEl.textContent = 'Selecciona una imagen.'; return; }
    if (file.size > 15 * 1024 * 1024) { errorEl.textContent = 'La imagen supera los 15 MB.'; return; }

    submitBtn.disabled = true;
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
        // Also invalidate the combat-setup map cache so new map appears in "Crear Partida"
        if (typeof _cachedServerMaps !== 'undefined') window._cachedServerMaps = null;

        closeUploadMapModal();
        renderCombatMaps();
        showNotification('✅ Mapa subido correctamente', 2000);
    } catch (err) {
        errorEl.textContent = err.message;
    } finally {
        submitBtn.disabled = false;
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
