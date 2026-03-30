// ============================================================
// narrative-images.js — Galería de imágenes narrativas
// ============================================================

let _narrativeImagesCache = null;

function openNarrativeImages() {
    _narrativeImagesCache = null;
    setView('narrativeImages');
    renderNarrativeImages();
}

async function renderNarrativeImages() {
    const grid = document.getElementById('narrativeImagesGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="ni-loading">🔄 Cargando imágenes…</div>';

    try {
        if (!_narrativeImagesCache) {
            const res = await fetch(`${API_BASE}/api/narrative-images`);
            _narrativeImagesCache = res.ok ? await res.json() : [];
        }
    } catch (_) {
        _narrativeImagesCache = [];
    }

    const images = _narrativeImagesCache;

    if (!images.length) {
        grid.innerHTML = `
            <div class="ni-empty">
                <div class="ni-empty-icon">🖼️</div>
                <div class="ni-empty-text">Aún no hay imágenes. Pulsa <strong>Añadir imagen</strong> para subir la primera.</div>
            </div>`;
        return;
    }

    grid.innerHTML = images.map(img => `
        <div class="ni-card" onclick="openNarrativeImageLightbox('${img._id}')">
            <img class="ni-thumb" src="${img.url}" alt="${img.name}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="ni-thumb-placeholder" style="display:none">🖼️</div>
            <div class="ni-info">
                <div class="ni-name">${img.name}</div>
                ${img.description ? `<div class="ni-desc">${img.description}</div>` : ''}
            </div>
            <button class="ni-delete-btn" onclick="event.stopPropagation();deleteNarrativeImage('${img._id}','${img.name.replace(/'/g,"\\'")}')">🗑</button>
        </div>
    `).join('');
}

function openNarrativeImageLightbox(id) {
    const img = _narrativeImagesCache?.find(i => i._id === id);
    if (!img) return;

    document.getElementById('niLightboxOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'niLightboxOverlay';
    overlay.className = 'ni-lightbox-overlay';
    overlay.innerHTML = `
        <div class="ni-lightbox">
            <button class="ni-lightbox-close" onclick="document.getElementById('niLightboxOverlay').remove()">✕</button>
            <img class="ni-lightbox-img" src="${img.url}" alt="${img.name}">
            <div class="ni-lightbox-caption">
                <div class="ni-lightbox-name">${img.name}</div>
                ${img.description ? `<div class="ni-lightbox-desc">${img.description}</div>` : ''}
            </div>
        </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

async function deleteNarrativeImage(id, name) {
    if (!confirm(`¿Eliminar la imagen "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
        const res = await fetch(`${API_BASE}/api/narrative-images/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Error al eliminar');
        _narrativeImagesCache = null;
        renderNarrativeImages();
        showNotification('🗑 Imagen eliminada', 1800);
    } catch (err) {
        showNotification('❌ ' + err.message, 3000);
    }
}

// ── Upload modal ─────────────────────────────────────────────

function openUploadNarrativeImageModal() {
    const modal = document.getElementById('uploadNarrativeImageModal');
    if (!modal) return;
    document.getElementById('niUploadName').value = '';
    document.getElementById('niUploadDesc').value = '';
    document.getElementById('niUploadFile').value = '';
    document.getElementById('niUploadError').textContent = '';
    const prev = document.getElementById('niUploadPreview');
    if (prev) { prev.style.display = 'none'; prev.src = ''; }
    modal.style.display = 'flex';
}

function closeUploadNarrativeImageModal() {
    const modal = document.getElementById('uploadNarrativeImageModal');
    if (modal) modal.style.display = 'none';
    const prev = document.getElementById('niUploadPreview');
    if (prev) { prev.style.display = 'none'; prev.src = ''; }
}

function onNarrativeImageFileChange(input) {
    const file = input.files[0];
    if (!file) return;

    const nameInput = document.getElementById('niUploadName');
    if (!nameInput.value.trim()) {
        nameInput.value = file.name
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    const reader = new FileReader();
    reader.onload = e => {
        const prev = document.getElementById('niUploadPreview');
        if (prev) { prev.src = e.target.result; prev.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
}

async function submitUploadNarrativeImage() {
    const nameInput  = document.getElementById('niUploadName');
    const descInput  = document.getElementById('niUploadDesc');
    const fileInput  = document.getElementById('niUploadFile');
    const errorEl    = document.getElementById('niUploadError');
    const submitBtn  = document.getElementById('niUploadSubmitBtn');

    errorEl.textContent = '';

    const name = nameInput.value.trim();
    const desc = descInput.value.trim();
    const file = fileInput.files[0];

    if (!name) { errorEl.textContent = 'Introduce un nombre para la imagen.'; return; }
    if (!file) { errorEl.textContent = 'Selecciona un archivo.'; return; }
    if (file.size > 15 * 1024 * 1024) { errorEl.textContent = 'La imagen supera los 15 MB.'; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Subiendo…';

    try {
        const fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Error leyendo el archivo'));
            reader.readAsDataURL(file);
        });

        const res = await fetch(`${API_BASE}/api/narrative-images`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, filename: file.name, fileData, description: desc }),
        });

        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Error al subir la imagen');

        _narrativeImagesCache = null;
        closeUploadNarrativeImageModal();
        renderNarrativeImages();
        showNotification('✅ Imagen subida correctamente', 2000);
    } catch (err) {
        errorEl.textContent = err.message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Subir imagen';
    }
}
