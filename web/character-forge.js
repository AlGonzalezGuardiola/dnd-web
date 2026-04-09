'use strict';
/* ─── Sistema de Forja ───────────────────────────────────────────────────────
 *  Almacén de materiales: todos los personajes principales
 *  Herrería: solo Asthor
 * ─────────────────────────────────────────────────────────────────────────── */

const FORGE_HERRERIA_CHARS = ['Asthor'];

// ── Estado interno ────────────────────────────────────────────────────────
let _forgeCharId    = null;
let _forgeCharName  = null;
let _forgeMats      = [];   // { id, emoji, nombre, cantidad, desc }
let _forgeRecetas   = [];   // { id, emoji, nombre, ingredientes:[{nombre,cantidad}], desc, cd, forjadas }
let _forgeSaveTimer = null;

// ── Helpers ───────────────────────────────────────────────────────────────
function _forgeEsc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _forgeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Carga / guardado ──────────────────────────────────────────────────────
async function _forgeLoad() {
    try {
        const res  = await fetch(`${API_BASE}/api/player-characters`);
        const json = await res.json();
        const key  = `inv_${_forgeCharId}`;
        const entry = (json.characters || []).find(c => c.charId === key);
        const forge = entry?.data?.forge || {};
        _forgeMats    = Array.isArray(forge.materiales) ? forge.materiales : [];
        _forgeRecetas = Array.isArray(forge.recetas)    ? forge.recetas    : [];
    } catch {
        _forgeMats    = [];
        _forgeRecetas = [];
    }
}

function _forgeSave() {
    clearTimeout(_forgeSaveTimer);
    _forgeSaveTimer = setTimeout(async () => {
        try {
            const key = `inv_${_forgeCharId}`;
            // Fetch current data to merge (don't overwrite items/equip)
            const res   = await fetch(`${API_BASE}/api/player-characters`);
            const json  = await res.json();
            const entry = (json.characters || []).find(c => c.charId === key);
            const current = entry?.data || {};
            await fetch(`${API_BASE}/api/player-characters/${key}`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    data: { ...current, forge: { materiales: _forgeMats, recetas: _forgeRecetas } }
                }),
            });
        } catch (e) {
            console.error('Error guardando forja:', e);
        }
    }, 800);
}

// ══════════════════════════════════════════════════════════════════════════
// ALMACÉN DE MATERIALES
// ══════════════════════════════════════════════════════════════════════════

let _almacenDialog = null;

function openAlmacenPanel(charId, charName) {
    _forgeCharId   = charId;
    _forgeCharName = charName;
    _ensureAlmacenDialog(charName);
    _almacenDialog.showModal();
    _almacenLoadAndRender();
}

function _ensureAlmacenDialog(charName) {
    if (_almacenDialog) {
        _almacenDialog.querySelector('.fg-title').textContent = charName;
        return;
    }
    const dlg = document.createElement('dialog');
    dlg.id = 'almacenDialog';
    dlg.className = 'forge-dialog';
    dlg.innerHTML = `
        <div class="fg-inner">
            <div class="fg-hdr">
                <div class="fg-hdr-left">
                    <span class="fg-hdr-icon">🪨</span>
                    <div>
                        <div class="fg-label">Almacén de Materiales</div>
                        <div class="fg-title">${_forgeEsc(charName)}</div>
                    </div>
                </div>
                <button class="fg-close" onclick="document.getElementById('almacenDialog').close()">✕</button>
            </div>
            <div class="fg-body" id="almacenBody"></div>
        </div>`;
    dlg.addEventListener('click', e => {
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            dlg.close();
    });
    document.body.appendChild(dlg);
    _almacenDialog = dlg;
}

async function _almacenLoadAndRender() {
    document.getElementById('almacenBody').innerHTML = '<div class="fg-loading">Cargando materiales…</div>';
    await _forgeLoad();
    _renderAlmacen();
}

function _renderAlmacen() {
    const body = document.getElementById('almacenBody');
    if (!body) return;

    const rows = _forgeMats.map((m, i) => `
        <div class="fg-mat-row" id="fgmat-${m.id}">
            <span class="fg-mat-emoji">${_forgeEsc(m.emoji || '📦')}</span>
            <div class="fg-mat-info">
                <span class="fg-mat-name">${_forgeEsc(m.nombre)}</span>
                ${m.desc ? `<span class="fg-mat-desc">${_forgeEsc(m.desc)}</span>` : ''}
            </div>
            <div class="fg-mat-qty-wrap">
                <button class="fg-qty-btn" onclick="almacenQty('${m.id}',-1)">−</button>
                <span class="fg-mat-qty">${m.cantidad}</span>
                <button class="fg-qty-btn" onclick="almacenQty('${m.id}',+1)">+</button>
            </div>
            <div class="fg-mat-actions">
                <button class="fg-row-btn fg-btn-edit" onclick="almacenEdit('${m.id}')" title="Editar">✏️</button>
                <button class="fg-row-btn fg-btn-del" onclick="almacenDel('${m.id}')" title="Eliminar">✕</button>
            </div>
        </div>`).join('');

    body.innerHTML = `
        <div class="fg-section">
            ${_forgeMats.length === 0
                ? '<div class="fg-empty">Sin materiales. Añade el primero.</div>'
                : `<div class="fg-mat-list">${rows}</div>`
            }
        </div>
        <div class="fg-add-wrap" id="almacenAddWrap">
            <button class="fg-add-btn" onclick="almacenShowForm()">+ Añadir material</button>
        </div>
        <div class="fg-form" id="almacenForm" style="display:none">
            <input class="fg-input fg-input-sm" id="almacenEmoji" placeholder="Emoji (ej: 🪨)" maxlength="4">
            <input class="fg-input" id="almacenNombre" placeholder="Nombre del material">
            <input class="fg-input fg-input-sm" id="almacenCantidad" type="number" min="0" value="1" placeholder="Cant.">
            <input class="fg-input" id="almacenDesc" placeholder="Descripción (opcional)">
            <input type="hidden" id="almacenEditId">
            <div class="fg-form-btns">
                <button class="fg-btn-confirm" onclick="almacenSaveForm()">Guardar</button>
                <button class="fg-btn-cancel" onclick="almacenCancelForm()">Cancelar</button>
            </div>
        </div>`;
}

function almacenShowForm(id) {
    document.getElementById('almacenForm').style.display = 'flex';
    document.getElementById('almacenAddWrap').style.display = 'none';
    if (!id) {
        document.getElementById('almacenEmoji').value    = '';
        document.getElementById('almacenNombre').value   = '';
        document.getElementById('almacenCantidad').value = '1';
        document.getElementById('almacenDesc').value     = '';
        document.getElementById('almacenEditId').value   = '';
    }
    document.getElementById('almacenNombre').focus();
}

function almacenEdit(id) {
    const m = _forgeMats.find(x => x.id === id);
    if (!m) return;
    almacenShowForm(id);
    document.getElementById('almacenEmoji').value    = m.emoji    || '';
    document.getElementById('almacenNombre').value   = m.nombre   || '';
    document.getElementById('almacenCantidad').value = m.cantidad ?? 1;
    document.getElementById('almacenDesc').value     = m.desc     || '';
    document.getElementById('almacenEditId').value   = id;
}

function almacenSaveForm() {
    const nombre   = document.getElementById('almacenNombre').value.trim();
    if (!nombre) { document.getElementById('almacenNombre').focus(); return; }
    const emoji    = document.getElementById('almacenEmoji').value.trim() || '📦';
    const cantidad = Math.max(0, parseInt(document.getElementById('almacenCantidad').value) || 0);
    const desc     = document.getElementById('almacenDesc').value.trim();
    const editId   = document.getElementById('almacenEditId').value;

    if (editId) {
        const idx = _forgeMats.findIndex(x => x.id === editId);
        if (idx !== -1) {
            _forgeMats = _forgeMats.map((m, i) =>
                i === idx ? { ...m, emoji, nombre, cantidad, desc } : m
            );
        }
    } else {
        _forgeMats = [..._forgeMats, { id: _forgeId(), emoji, nombre, cantidad, desc }];
    }
    _forgeSave();
    _renderAlmacen();
}

function almacenCancelForm() {
    document.getElementById('almacenForm').style.display = 'none';
    document.getElementById('almacenAddWrap').style.display = 'flex';
}

function almacenQty(id, delta) {
    _forgeMats = _forgeMats.map(m =>
        m.id === id ? { ...m, cantidad: Math.max(0, (m.cantidad || 0) + delta) } : m
    );
    _forgeSave();
    _renderAlmacen();
}

function almacenDel(id) {
    _forgeMats = _forgeMats.filter(m => m.id !== id);
    _forgeSave();
    _renderAlmacen();
}

// ══════════════════════════════════════════════════════════════════════════
// HERRERÍA
// ══════════════════════════════════════════════════════════════════════════

let _herreriaDialog = null;

function openHerreriaPanel(charId, charName) {
    if (!FORGE_HERRERIA_CHARS.includes(charId)) return;
    _forgeCharId   = charId;
    _forgeCharName = charName;
    _ensureHerreriaDialog(charName);
    _herreriaDialog.showModal();
    _herreriaLoadAndRender();
}

function _ensureHerreriaDialog(charName) {
    if (_herreriaDialog) {
        _herreriaDialog.querySelector('.fg-title').textContent = charName;
        return;
    }
    const dlg = document.createElement('dialog');
    dlg.id = 'herreriaDialog';
    dlg.className = 'forge-dialog';
    dlg.innerHTML = `
        <div class="fg-inner">
            <div class="fg-hdr fg-hdr-herreria">
                <div class="fg-hdr-left">
                    <span class="fg-hdr-icon">🔨</span>
                    <div>
                        <div class="fg-label">Herrería</div>
                        <div class="fg-title">${_forgeEsc(charName)}</div>
                    </div>
                </div>
                <button class="fg-close" onclick="document.getElementById('herreriaDialog').close()">✕</button>
            </div>
            <div class="fg-body" id="herreriaBody"></div>
        </div>`;
    dlg.addEventListener('click', e => {
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            dlg.close();
    });
    document.body.appendChild(dlg);
    _herreriaDialog = dlg;
}

async function _herreriaLoadAndRender() {
    document.getElementById('herreriaBody').innerHTML = '<div class="fg-loading">Cargando recetas…</div>';
    await _forgeLoad();
    _renderHerreria();
}

function _renderHerreria() {
    const body = document.getElementById('herreriaBody');
    if (!body) return;

    const cards = _forgeRecetas.map(r => {
        const ingHtml = (r.ingredientes || []).map(ing =>
            `<span class="fg-rec-ing">${_forgeEsc(ing.nombre)} ×${ing.cantidad}</span>`
        ).join('');
        const cdBadge  = r.cd   ? `<span class="fg-rec-cd">CD ${r.cd}</span>` : '';
        const forjadas = r.forjadas || 0;

        return `
        <div class="fg-rec-card">
            <div class="fg-rec-hdr">
                <span class="fg-rec-emoji">${_forgeEsc(r.emoji || '⚒️')}</span>
                <div class="fg-rec-info">
                    <div class="fg-rec-name">${_forgeEsc(r.nombre)}</div>
                    ${r.desc ? `<div class="fg-rec-desc">${_forgeEsc(r.desc)}</div>` : ''}
                </div>
                <div class="fg-rec-actions">
                    <button class="fg-row-btn fg-btn-edit" onclick="herreriaEdit('${r.id}')" title="Editar">✏️</button>
                    <button class="fg-row-btn fg-btn-del" onclick="herreriaDel('${r.id}')" title="Eliminar">✕</button>
                </div>
            </div>
            ${ingHtml ? `<div class="fg-rec-ings">${ingHtml}</div>` : ''}
            <div class="fg-rec-footer">
                ${cdBadge}
                <span class="fg-rec-count">Forjado ${forjadas}×</span>
                <button class="fg-forge-btn" onclick="herreriaForjar('${r.id}')">⚒️ Forjar</button>
            </div>
        </div>`;
    }).join('');

    body.innerHTML = `
        <div class="fg-section">
            ${_forgeRecetas.length === 0
                ? '<div class="fg-empty">Sin recetas. Añade la primera.</div>'
                : `<div class="fg-rec-list">${cards}</div>`
            }
        </div>
        <div class="fg-add-wrap" id="herreriaAddWrap">
            <button class="fg-add-btn" onclick="herreriaShowForm()">+ Añadir receta</button>
        </div>
        <div class="fg-form fg-rec-form" id="herreriaForm" style="display:none">
            <div class="fg-form-row">
                <input class="fg-input fg-input-sm" id="herreriaEmoji" placeholder="Emoji" maxlength="4">
                <input class="fg-input" id="herreriaNombre" placeholder="Nombre del objeto">
                <input class="fg-input fg-input-sm" id="herreriaCd" type="number" min="1" max="30" placeholder="CD">
            </div>
            <input class="fg-input" id="herreriaDesc" placeholder="Descripción (opcional)">
            <div class="fg-ing-section">
                <div class="fg-ing-label">Ingredientes</div>
                <div id="herreriaIngs"></div>
                <button class="fg-add-ing-btn" onclick="herreriaAddIng()">+ Ingrediente</button>
            </div>
            <input type="hidden" id="herreriaEditId">
            <div class="fg-form-btns">
                <button class="fg-btn-confirm" onclick="herreriaSaveForm()">Guardar</button>
                <button class="fg-btn-cancel" onclick="herreriaCancelForm()">Cancelar</button>
            </div>
        </div>`;
}

let _herreriaIngCount = 0;

function herreriaShowForm(id) {
    _herreriaIngCount = 0;
    document.getElementById('herreriaForm').style.display = 'flex';
    document.getElementById('herreriaAddWrap').style.display = 'none';
    document.getElementById('herreriaIngs').innerHTML = '';
    if (!id) {
        document.getElementById('herreriaEmoji').value  = '';
        document.getElementById('herreriaNombre').value = '';
        document.getElementById('herreriaCd').value     = '';
        document.getElementById('herreriaDesc').value   = '';
        document.getElementById('herreriaEditId').value = '';
    }
    document.getElementById('herreriaNombre').focus();
}

function herreriaEdit(id) {
    const r = _forgeRecetas.find(x => x.id === id);
    if (!r) return;
    herreriaShowForm(id);
    document.getElementById('herreriaEmoji').value  = r.emoji  || '';
    document.getElementById('herreriaNombre').value = r.nombre || '';
    document.getElementById('herreriaCd').value     = r.cd     || '';
    document.getElementById('herreriaDesc').value   = r.desc   || '';
    document.getElementById('herreriaEditId').value = id;
    (r.ingredientes || []).forEach(ing => herreriaAddIng(ing.nombre, ing.cantidad));
}

function herreriaAddIng(nombre = '', cantidad = 1) {
    const idx = _herreriaIngCount++;
    const div = document.createElement('div');
    div.className = 'fg-ing-row';
    div.id = `fg-ing-${idx}`;
    div.innerHTML = `
        <input class="fg-input" data-ing-nombre placeholder="Material" value="${_forgeEsc(nombre)}">
        <input class="fg-input fg-input-sm" data-ing-cant type="number" min="1" value="${cantidad}" placeholder="Cant.">
        <button class="fg-row-btn fg-btn-del" onclick="herreriaRemIng(${idx})">✕</button>`;
    document.getElementById('herreriaIngs').appendChild(div);
}

function herreriaRemIng(idx) {
    document.getElementById(`fg-ing-${idx}`)?.remove();
}

function herreriaSaveForm() {
    const nombre = document.getElementById('herreriaNombre').value.trim();
    if (!nombre) { document.getElementById('herreriaNombre').focus(); return; }
    const emoji  = document.getElementById('herreriaEmoji').value.trim() || '⚒️';
    const cd     = parseInt(document.getElementById('herreriaCd').value) || null;
    const desc   = document.getElementById('herreriaDesc').value.trim();
    const editId = document.getElementById('herreriaEditId').value;

    const ings = [...document.querySelectorAll('#herreriaIngs .fg-ing-row')].map(row => ({
        nombre:   row.querySelector('[data-ing-nombre]').value.trim(),
        cantidad: Math.max(1, parseInt(row.querySelector('[data-ing-cant]').value) || 1),
    })).filter(x => x.nombre);

    if (editId) {
        _forgeRecetas = _forgeRecetas.map(r =>
            r.id === editId ? { ...r, emoji, nombre, cd, desc, ingredientes: ings } : r
        );
    } else {
        _forgeRecetas = [..._forgeRecetas, {
            id: _forgeId(), emoji, nombre, cd, desc, ingredientes: ings, forjadas: 0
        }];
    }
    _forgeSave();
    _renderHerreria();
}

function herreriaCancelForm() {
    document.getElementById('herreriaForm').style.display = 'none';
    document.getElementById('herreriaAddWrap').style.display = 'flex';
}

function herreriaDel(id) {
    _forgeRecetas = _forgeRecetas.filter(r => r.id !== id);
    _forgeSave();
    _renderHerreria();
}

function herreriaForjar(id) {
    _forgeRecetas = _forgeRecetas.map(r =>
        r.id === id ? { ...r, forjadas: (r.forjadas || 0) + 1 } : r
    );
    _forgeSave();
    _renderHerreria();
}
