'use strict';
/* ─── Sistema de Forja (solo Asthor) ─────────────────────────────────────────
 *  Un único panel con dos pestañas:
 *    🪨 Almacén — materiales de forja
 *    🔨 Herrería — recetas y forjado
 * ─────────────────────────────────────────────────────────────────────────── */

const FORGE_CHARS = ['Asthor'];

// ── Estado interno ────────────────────────────────────────────────────────
let _forgeCharId    = null;
let _forgeCharName  = null;
let _forgeMats      = [];   // { id, emoji, nombre, cantidad, desc }
let _forgeRecetas   = [];   // { id, emoji, nombre, ingredientes, desc, cd, forjadas }
let _forgeSaveTimer = null;
let _forgeTab       = 'almacen'; // 'almacen' | 'herreria'
let _forgeDialog    = null;

// ── Helpers ───────────────────────────────────────────────────────────────
function _fEsc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _fId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Entrada pública ───────────────────────────────────────────────────────
function openForjaPanel(charId, charName) {
    if (!FORGE_CHARS.includes(charId)) return;
    _forgeCharId   = charId;
    _forgeCharName = charName;
    _ensureForjaDialog(charName);
    _forgeDialog.showModal();
    _forgeLoadAndRender();
}

// ── Dialog bootstrap ──────────────────────────────────────────────────────
function _ensureForjaDialog(charName) {
    if (_forgeDialog) {
        _forgeDialog.querySelector('.fg-title').textContent = charName;
        return;
    }
    const dlg = document.createElement('dialog');
    dlg.id = 'forjaDialog';
    dlg.className = 'forge-dialog';
    dlg.innerHTML = `
        <div class="fg-inner">
            <div class="fg-hdr">
                <div class="fg-hdr-left">
                    <span class="fg-hdr-icon">⚒️</span>
                    <div>
                        <div class="fg-label">Forja</div>
                        <div class="fg-title">${_fEsc(charName)}</div>
                    </div>
                </div>
                <button class="fg-close" onclick="document.getElementById('forjaDialog').close()">✕</button>
            </div>
            <div class="fg-tabs">
                <button class="fg-tab active" id="fgTabAlmacen" onclick="forjaSetTab('almacen')">🪨 Almacén</button>
                <button class="fg-tab" id="fgTabHerreria" onclick="forjaSetTab('herreria')">🔨 Herrería</button>
            </div>
            <div class="fg-body" id="forjaBody"></div>
        </div>`;
    dlg.addEventListener('click', e => {
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            dlg.close();
    });
    document.body.appendChild(dlg);
    _forgeDialog = dlg;
}

function forjaSetTab(tab) {
    _forgeTab = tab;
    document.getElementById('fgTabAlmacen').classList.toggle('active', tab === 'almacen');
    document.getElementById('fgTabHerreria').classList.toggle('active', tab === 'herreria');
    _forgeRender();
}

// ── Carga / guardado ──────────────────────────────────────────────────────
async function _forgeLoadAndRender() {
    document.getElementById('forjaBody').innerHTML = '<div class="fg-loading">Cargando…</div>';
    try {
        const res   = await fetch(`${API_BASE}/api/player-characters`);
        const json  = await res.json();
        const key   = `inv_${_forgeCharId}`;
        const entry = (json.characters || []).find(c => c.charId === key);
        const forge = entry?.data?.forge || {};
        _forgeMats    = Array.isArray(forge.materiales) ? forge.materiales : [];
        _forgeRecetas = Array.isArray(forge.recetas)    ? forge.recetas    : [];
    } catch {
        _forgeMats    = [];
        _forgeRecetas = [];
    }
    _forgeRender();
}

function _forgeSched() {
    clearTimeout(_forgeSaveTimer);
    _forgeSaveTimer = setTimeout(async () => {
        try {
            const key   = `inv_${_forgeCharId}`;
            const res   = await fetch(`${API_BASE}/api/player-characters`);
            const json  = await res.json();
            const entry = (json.characters || []).find(c => c.charId === key);
            const cur   = entry?.data || {};
            await fetch(`${API_BASE}/api/player-characters/${key}`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    data: { ...cur, forge: { materiales: _forgeMats, recetas: _forgeRecetas } }
                }),
            });
        } catch (e) {
            console.error('Error guardando forja:', e);
        }
    }, 800);
}

// ── Render principal ──────────────────────────────────────────────────────
function _forgeRender() {
    const body = document.getElementById('forjaBody');
    if (!body) return;
    if (_forgeTab === 'almacen') _renderAlmacen(body);
    else                         _renderHerreria(body);
}

// ══════════════════════════════════════════════════════════════════════════
// PESTAÑA: ALMACÉN DE MATERIALES
// ══════════════════════════════════════════════════════════════════════════
function _renderAlmacen(body) {
    const rows = _forgeMats.map(m => `
        <div class="fg-mat-row">
            <span class="fg-mat-emoji">${_fEsc(m.emoji || '📦')}</span>
            <div class="fg-mat-info">
                <span class="fg-mat-name">${_fEsc(m.nombre)}</span>
                ${m.desc ? `<span class="fg-mat-desc">${_fEsc(m.desc)}</span>` : ''}
            </div>
            <div class="fg-mat-qty-wrap">
                <button class="fg-qty-btn" onclick="almacenQty('${m.id}',-1)">−</button>
                <span class="fg-mat-qty">${m.cantidad}</span>
                <button class="fg-qty-btn" onclick="almacenQty('${m.id}',+1)">+</button>
            </div>
            <div class="fg-mat-actions">
                <button class="fg-row-btn fg-btn-edit" onclick="almacenEdit('${m.id}')" title="Editar">✏️</button>
                <button class="fg-row-btn fg-btn-del"  onclick="almacenDel('${m.id}')"  title="Eliminar">✕</button>
            </div>
        </div>`).join('');

    body.innerHTML = `
        <div class="fg-section">
            ${_forgeMats.length === 0
                ? '<div class="fg-empty">Sin materiales. Añade el primero.</div>'
                : `<div class="fg-mat-list">${rows}</div>`}
        </div>
        <div class="fg-add-wrap" id="almacenAddWrap">
            <button class="fg-add-btn" onclick="almacenShowForm()">+ Añadir material</button>
        </div>
        <div class="fg-form" id="almacenForm" style="display:none">
            <div class="fg-form-row">
                <input class="fg-input fg-input-sm" id="almacenEmoji" placeholder="Emoji" maxlength="4">
                <input class="fg-input" id="almacenNombre" placeholder="Nombre del material">
                <input class="fg-input fg-input-sm" id="almacenCantidad" type="number" min="0" value="1" placeholder="Cant.">
            </div>
            <input class="fg-input" id="almacenDesc" placeholder="Descripción (opcional)">
            <input type="hidden" id="almacenEditId">
            <div class="fg-form-btns">
                <button class="fg-btn-confirm" onclick="almacenSaveForm()">Guardar</button>
                <button class="fg-btn-cancel"  onclick="almacenCancelForm()">Cancelar</button>
            </div>
        </div>`;
}

function almacenShowForm() {
    document.getElementById('almacenForm').style.display = 'flex';
    document.getElementById('almacenAddWrap').style.display = 'none';
    document.getElementById('almacenEmoji').value    = '';
    document.getElementById('almacenNombre').value   = '';
    document.getElementById('almacenCantidad').value = '1';
    document.getElementById('almacenDesc').value     = '';
    document.getElementById('almacenEditId').value   = '';
    document.getElementById('almacenNombre').focus();
}

function almacenEdit(id) {
    const m = _forgeMats.find(x => x.id === id);
    if (!m) return;
    document.getElementById('almacenForm').style.display = 'flex';
    document.getElementById('almacenAddWrap').style.display = 'none';
    document.getElementById('almacenEmoji').value    = m.emoji    || '';
    document.getElementById('almacenNombre').value   = m.nombre   || '';
    document.getElementById('almacenCantidad').value = m.cantidad ?? 1;
    document.getElementById('almacenDesc').value     = m.desc     || '';
    document.getElementById('almacenEditId').value   = id;
    document.getElementById('almacenNombre').focus();
}

function almacenSaveForm() {
    const nombre   = document.getElementById('almacenNombre').value.trim();
    if (!nombre) { document.getElementById('almacenNombre').focus(); return; }
    const emoji    = document.getElementById('almacenEmoji').value.trim() || '📦';
    const cantidad = Math.max(0, parseInt(document.getElementById('almacenCantidad').value) || 0);
    const desc     = document.getElementById('almacenDesc').value.trim();
    const editId   = document.getElementById('almacenEditId').value;

    if (editId) {
        _forgeMats = _forgeMats.map(m =>
            m.id === editId ? { ...m, emoji, nombre, cantidad, desc } : m
        );
    } else {
        _forgeMats = [..._forgeMats, { id: _fId(), emoji, nombre, cantidad, desc }];
    }
    _forgeSched();
    _renderAlmacen(document.getElementById('forjaBody'));
}

function almacenCancelForm() {
    document.getElementById('almacenForm').style.display = 'none';
    document.getElementById('almacenAddWrap').style.display = 'flex';
}

function almacenQty(id, delta) {
    _forgeMats = _forgeMats.map(m =>
        m.id === id ? { ...m, cantidad: Math.max(0, (m.cantidad || 0) + delta) } : m
    );
    _forgeSched();
    _renderAlmacen(document.getElementById('forjaBody'));
}

function almacenDel(id) {
    _forgeMats = _forgeMats.filter(m => m.id !== id);
    _forgeSched();
    _renderAlmacen(document.getElementById('forjaBody'));
}

// ══════════════════════════════════════════════════════════════════════════
// PESTAÑA: HERRERÍA
// ══════════════════════════════════════════════════════════════════════════
let _herreriaIngCount = 0;

function _renderHerreria(body) {
    const cards = _forgeRecetas.map(r => {
        const ingHtml  = (r.ingredientes || []).map(i =>
            `<span class="fg-rec-ing">${_fEsc(i.nombre)} ×${i.cantidad}</span>`
        ).join('');
        const cdBadge  = r.cd ? `<span class="fg-rec-cd">CD ${r.cd}</span>` : '';
        const forjadas = r.forjadas || 0;
        return `
        <div class="fg-rec-card">
            <div class="fg-rec-hdr">
                <span class="fg-rec-emoji">${_fEsc(r.emoji || '⚒️')}</span>
                <div class="fg-rec-info">
                    <div class="fg-rec-name">${_fEsc(r.nombre)}</div>
                    ${r.desc ? `<div class="fg-rec-desc">${_fEsc(r.desc)}</div>` : ''}
                </div>
                <div class="fg-rec-actions">
                    <button class="fg-row-btn fg-btn-edit" onclick="herreriaEdit('${r.id}')" title="Editar">✏️</button>
                    <button class="fg-row-btn fg-btn-del"  onclick="herreriaDel('${r.id}')"  title="Eliminar">✕</button>
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
                : `<div class="fg-rec-list">${cards}</div>`}
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
                <button class="fg-btn-cancel"  onclick="herreriaCancelForm()">Cancelar</button>
            </div>
        </div>`;
}

function herreriaShowForm() {
    _herreriaIngCount = 0;
    document.getElementById('herreriaForm').style.display = 'flex';
    document.getElementById('herreriaAddWrap').style.display = 'none';
    document.getElementById('herreriaIngs').innerHTML = '';
    document.getElementById('herreriaEmoji').value   = '';
    document.getElementById('herreriaNombre').value  = '';
    document.getElementById('herreriaCd').value      = '';
    document.getElementById('herreriaDesc').value    = '';
    document.getElementById('herreriaEditId').value  = '';
    document.getElementById('herreriaNombre').focus();
}

function herreriaEdit(id) {
    const r = _forgeRecetas.find(x => x.id === id);
    if (!r) return;
    _herreriaIngCount = 0;
    document.getElementById('herreriaForm').style.display = 'flex';
    document.getElementById('herreriaAddWrap').style.display = 'none';
    document.getElementById('herreriaIngs').innerHTML  = '';
    document.getElementById('herreriaEmoji').value     = r.emoji  || '';
    document.getElementById('herreriaNombre').value    = r.nombre || '';
    document.getElementById('herreriaCd').value        = r.cd     || '';
    document.getElementById('herreriaDesc').value      = r.desc   || '';
    document.getElementById('herreriaEditId').value    = id;
    (r.ingredientes || []).forEach(i => herreriaAddIng(i.nombre, i.cantidad));
    document.getElementById('herreriaNombre').focus();
}

function herreriaAddIng(nombre = '', cantidad = 1) {
    const idx = _herreriaIngCount++;
    const div = document.createElement('div');
    div.className = 'fg-ing-row';
    div.id = `fgIng${idx}`;
    div.innerHTML = `
        <input class="fg-input" data-ing-nombre placeholder="Material" value="${_fEsc(nombre)}">
        <input class="fg-input fg-input-sm" data-ing-cant type="number" min="1" value="${cantidad}">
        <button class="fg-row-btn fg-btn-del" onclick="herreriaRemIng(${idx})">✕</button>`;
    document.getElementById('herreriaIngs').appendChild(div);
}

function herreriaRemIng(idx) {
    document.getElementById(`fgIng${idx}`)?.remove();
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
        _forgeRecetas = [..._forgeRecetas, { id: _fId(), emoji, nombre, cd, desc, ingredientes: ings, forjadas: 0 }];
    }
    _forgeSched();
    _renderHerreria(document.getElementById('forjaBody'));
}

function herreriaCancelForm() {
    document.getElementById('herreriaForm').style.display = 'none';
    document.getElementById('herreriaAddWrap').style.display = 'flex';
}

function herreriaDel(id) {
    _forgeRecetas = _forgeRecetas.filter(r => r.id !== id);
    _forgeSched();
    _renderHerreria(document.getElementById('forjaBody'));
}

function herreriaForjar(id) {
    _forgeRecetas = _forgeRecetas.map(r =>
        r.id === id ? { ...r, forjadas: (r.forjadas || 0) + 1 } : r
    );
    _forgeSched();
    _renderHerreria(document.getElementById('forjaBody'));
}
