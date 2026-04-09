'use strict';
/* ─── Sistema de Forja (solo Asthor) ─────────────────────────────────────────
 *  Página completa con dos paneles:
 *    🪨 Almacén — materiales (se añaden desde el Bolso de Hermione)
 *    🔨 Herrería — recetas y forjado
 * ─────────────────────────────────────────────────────────────────────────── */

const FORGE_CHARS = ['Asthor'];

// ── Estado interno ────────────────────────────────────────────────────────
let _forgeCharId    = null;
let _forgeCharName  = null;
let _forgeMats      = [];   // { id, emoji, nombre, cantidad, desc }
let _forgeRecetas   = [];   // { id, emoji, nombre, ingredientes, desc, cd, forjadas }
let _forgeInventory = [];   // copia del Bolso de Hermione (inventario compartido)
let _forgeSaveTimer = null;
let _forgeTab       = 'almacen'; // 'almacen' | 'herreria'

// El Bolso de Hermione es el inventario general (inventario.html sin ?char=)
const BOLSO_KEY = '__bolso_hermione__';

// Estado del picker de inventario
let _pickerSelected = new Set();  // IDs de items seleccionados en el picker
let _pickerCatFilter = 'todas';   // filtro de categoría activo en el picker

const BOLSO_CATS = [
    { id: 'todas',      label: 'Todas',            icon: '✦'  },
    { id: 'materiales', label: 'Materiales',        icon: '⛏️' },
    { id: 'oro',        label: 'Oro',              icon: '🪙' },
    { id: 'comida',     label: 'Comida',            icon: '🍖' },
    { id: 'armas',      label: 'Armas',             icon: '⚔️' },
    { id: 'armadura',   label: 'Armadura',          icon: '🛡️' },
    { id: 'importante', label: 'Importantes',       icon: '💎' },
    { id: 'pociones',   label: 'Pociones',          icon: '🧪' },
    { id: 'pergaminos', label: 'Pergaminos',        icon: '📜' },
    { id: 'otras',      label: 'Otras',             icon: '📦' },
];

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
    const titleEl = document.getElementById('forjaPageTitle');
    if (titleEl) titleEl.textContent = charName;
    _forgeTab = 'almacen';
    forjaSetTab('almacen');
    setView('forja');
    _forgeLoadAndRender();
}

// ── Tab switching ─────────────────────────────────────────────────────────
function forjaSetTab(tab) {
    _forgeTab = tab;
    document.getElementById('fgTabAlmacen')?.classList.toggle('active', tab === 'almacen');
    document.getElementById('fgTabHerreria')?.classList.toggle('active', tab === 'herreria');
    document.getElementById('forjaAlmacenPanel')?.classList.toggle('fg-tab-active', tab === 'almacen');
    document.getElementById('forjaHerreriaPanel')?.classList.toggle('fg-tab-active', tab === 'herreria');
}

// ── Carga y guardado ──────────────────────────────────────────────────────
async function _forgeLoadAndRender() {
    const almacenPanel  = document.getElementById('forjaAlmacenPanel');
    const herreriaPanel = document.getElementById('forjaHerreriaPanel');
    if (almacenPanel)  almacenPanel.innerHTML  = '<div class="forja-panel-hdr"><span class="forja-panel-hdr-icon">🪨</span><span class="forja-panel-hdr-title">Almacén de Materiales</span></div><div class="fg-loading">Cargando…</div>';
    if (herreriaPanel) herreriaPanel.innerHTML = '<div class="forja-panel-hdr"><span class="forja-panel-hdr-icon">🔨</span><span class="forja-panel-hdr-title">Herrería</span></div><div class="fg-loading">Cargando…</div>';
    try {
        const res   = await fetch(`${API_BASE}/api/player-characters`);
        const json  = await res.json();
        const key   = `inv_${_forgeCharId}`;
        const entry = (json.characters || []).find(c => c.charId === key);
        const forge = entry?.data?.forge || {};
        _forgeMats    = Array.isArray(forge.materiales) ? forge.materiales : [];
        _forgeRecetas = Array.isArray(forge.recetas)    ? forge.recetas    : [];

        // El inventario del picker es el Bolso de Hermione (clave fija)
        const bolso = (json.characters || []).find(c => c.charId === BOLSO_KEY);
        _forgeInventory = Array.isArray(bolso?.data?.items) ? bolso.data.items : [];
    } catch {
        _forgeMats      = [];
        _forgeRecetas   = [];
        _forgeInventory = [];
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

// Guarda el Bolso de Hermione (items actualizados) y la forja de Asthor por separado
async function _forgePickerSave() {
    try {
        const res  = await fetch(`${API_BASE}/api/player-characters`);
        const json = await res.json();

        // 1. Actualizar Bolso de Hermione (quitar items transferidos)
        const bolso    = (json.characters || []).find(c => c.charId === BOLSO_KEY);
        const bolsoCur = bolso?.data || {};
        await fetch(`${API_BASE}/api/player-characters/${BOLSO_KEY}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ data: { ...bolsoCur, items: _forgeInventory } }),
        });

        // 2. Guardar materiales de forja en inv_Asthor
        const forjaKey   = `inv_${_forgeCharId}`;
        const forjaEntry = (json.characters || []).find(c => c.charId === forjaKey);
        const forjaCur   = forjaEntry?.data || {};
        await fetch(`${API_BASE}/api/player-characters/${forjaKey}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                data: { ...forjaCur, forge: { materiales: _forgeMats, recetas: _forgeRecetas } }
            }),
        });
    } catch (e) {
        console.error('Error guardando picker:', e);
    }
}

// ── Render principal (ambos paneles siempre) ──────────────────────────────
function _forgeRender() {
    const almacenPanel  = document.getElementById('forjaAlmacenPanel');
    const herreriaPanel = document.getElementById('forjaHerreriaPanel');
    if (almacenPanel)  _renderAlmacen(almacenPanel);
    if (herreriaPanel) _renderHerreria(herreriaPanel);
}

// ══════════════════════════════════════════════════════════════════════════
// PANEL: ALMACÉN DE MATERIALES
// ══════════════════════════════════════════════════════════════════════════
function _renderAlmacen(panel) {
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
                <button class="fg-row-btn fg-btn-del" onclick="almacenDel('${m.id}')" title="Eliminar">✕</button>
            </div>
        </div>`).join('');

    panel.innerHTML = `
        <div class="forja-panel-hdr">
            <span class="forja-panel-hdr-icon">🪨</span>
            <span class="forja-panel-hdr-title">Almacén de Materiales</span>
        </div>
        <div class="fg-section">
            ${_forgeMats.length === 0
                ? '<div class="fg-empty">Sin materiales. Añade desde el inventario.</div>'
                : `<div class="fg-mat-list">${rows}</div>`}
        </div>
        <div class="fg-add-wrap" id="almacenAddWrap">
            <button class="fg-add-btn" onclick="almacenOpenPicker()">🎒 Añadir desde inventario</button>
        </div>`;

    panel.classList.toggle('fg-tab-active', _forgeTab === 'almacen');
}

// ── Picker del Bolso de Hermione ──────────────────────────────────────────
function almacenOpenPicker() {
    _pickerSelected  = new Set();
    _pickerCatFilter = 'todas';
    const panel = document.getElementById('forjaAlmacenPanel');
    if (!panel) return;
    panel.querySelector('#almacenAddWrap')?.remove();
    _appendAlmacenPicker(panel);
}

function _appendAlmacenPicker(panel) {
    panel.querySelector('.fg-inv-picker')?.remove();

    // Solo mostrar pestañas de categorías que existan en el inventario
    const presentCats = new Set(_forgeInventory.map(it => it.categoria || 'otras'));
    const catTabs = BOLSO_CATS
        .filter(c => c.id === 'todas' || presentCats.has(c.id))
        .map(c => `<button class="fg-cat-tab${_pickerCatFilter === c.id ? ' active' : ''}"
            onclick="almacenSetCat('${c.id}')">${c.icon} ${c.label}</button>`)
        .join('');

    const picker = document.createElement('div');
    picker.className = 'fg-inv-picker';
    picker.innerHTML = `
        <div class="fg-inv-picker-hdr">
            <span class="fg-inv-picker-title">🎒 Bolso de Hermione</span>
            <input class="fg-input fg-inv-search" id="almacenPickerSearch" type="search"
                placeholder="Buscar…" oninput="filterAlmacenPicker(this.value)" autocomplete="off">
        </div>
        <div class="fg-cat-tabs" id="almacenCatTabs">${catTabs}</div>
        <div class="fg-inv-picker-list" id="almacenPickerList"></div>
        <div class="fg-inv-picker-footer">
            <button class="fg-btn-confirm" id="almacenPickerConfirmBtn"
                onclick="almacenPickerConfirm()">Añadir seleccionados</button>
            <button class="fg-btn-cancel" onclick="almacenPickerCancel()">Cancelar</button>
        </div>`;

    picker._available = _forgeInventory.filter(it => it.nombre);
    panel.appendChild(picker);
    _refreshPickerList();
    picker.querySelector('.fg-inv-search')?.focus();
}

function almacenSetCat(catId) {
    _pickerCatFilter = catId;
    // Actualizar estado activo de las pestañas
    document.querySelectorAll('#almacenCatTabs .fg-cat-tab').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim().startsWith(
            BOLSO_CATS.find(c => c.id === catId)?.icon || ''
        ));
    });
    // Re-render usando onclick para identificar la tab activa correctamente
    document.querySelectorAll('#almacenCatTabs .fg-cat-tab').forEach(btn => {
        const match = btn.getAttribute('onclick')?.match(/almacenSetCat\('([^']+)'\)/);
        if (match) btn.classList.toggle('active', match[1] === catId);
    });
    _refreshPickerList();
}

function filterAlmacenPicker(query) {
    _refreshPickerList(query);
}

function _refreshPickerList(query) {
    const search = query ?? document.getElementById('almacenPickerSearch')?.value ?? '';
    const picker = document.getElementById('forjaAlmacenPanel')?.querySelector('.fg-inv-picker');
    if (!picker) return;
    const q = search.toLowerCase();
    let items = picker._available;
    if (_pickerCatFilter !== 'todas') {
        items = items.filter(it => (it.categoria || 'otras') === _pickerCatFilter);
    }
    if (q) items = items.filter(it => it.nombre.toLowerCase().includes(q));
    _renderAlmacenPickerList(items, q);
}

function _renderAlmacenPickerList(items, query) {
    const list = document.getElementById('almacenPickerList');
    if (!list) return;
    if (!items.length) {
        list.innerHTML = `<div class="fg-picker-empty">${query ? 'Sin resultados' : 'El inventario está vacío'}</div>`;
        return;
    }
    list.innerHTML = items.map(it => {
        const sel = _pickerSelected.has(it.id);
        let thumb;
        if (it.img)        thumb = `<img src="${_fEsc(it.img)}" alt="" class="fg-inv-thumb-img">`;
        else if (it.emoji) thumb = `<span class="fg-inv-thumb-emoji">${_fEsc(it.emoji)}</span>`;
        else               thumb = `<span class="fg-inv-thumb-emoji">📦</span>`;
        const qty = it.cantidad > 1 ? `<span class="fg-inv-qty">×${it.cantidad}</span>` : '';
        return `
        <div class="fg-inv-item${sel ? ' selected' : ''}" data-iid="${_fEsc(it.id)}"
             onclick="toggleAlmacenPick('${it.id}')">
            <span class="fg-inv-check-icon">${sel ? '☑' : '☐'}</span>
            <div class="fg-inv-thumb">${thumb}</div>
            <div class="fg-inv-info">
                <span class="fg-inv-name">${_fEsc(it.nombre)}${qty}</span>
                ${it.desc ? `<span class="fg-inv-desc">${_fEsc(it.desc)}</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

function toggleAlmacenPick(itemId) {
    if (_pickerSelected.has(itemId)) _pickerSelected.delete(itemId);
    else                              _pickerSelected.add(itemId);

    const panel = document.getElementById('forjaAlmacenPanel');
    const list  = document.getElementById('almacenPickerList');
    if (!list) return;

    // Actualizar solo el item tocado (sin re-render completo)
    const el = list.querySelector(`[data-iid="${itemId}"]`);
    if (el) {
        const sel = _pickerSelected.has(itemId);
        el.classList.toggle('selected', sel);
        const icon = el.querySelector('.fg-inv-check-icon');
        if (icon) icon.textContent = sel ? '☑' : '☐';
    }

    // Actualizar label del botón confirmar
    const btn = panel?.querySelector('#almacenPickerConfirmBtn');
    if (btn) {
        const n = _pickerSelected.size;
        btn.textContent = n > 0 ? `Añadir ${n} objeto${n > 1 ? 's' : ''}` : 'Añadir seleccionados';
    }
}

async function almacenPickerConfirm() {
    if (_pickerSelected.size === 0) { almacenPickerCancel(); return; }

    const selected = _forgeInventory.filter(it => _pickerSelected.has(it.id));

    // Mover al almacén
    const newMats = selected.map(it => ({
        id:       _fId(),
        emoji:    it.emoji || '📦',
        nombre:   it.nombre,
        cantidad: it.cantidad || 1,
        desc:     it.desc || '',
    }));
    _forgeMats = [..._forgeMats, ...newMats];

    // Quitar del inventario local
    _forgeInventory = _forgeInventory.filter(it => !_pickerSelected.has(it.id));
    _pickerSelected = new Set();

    // Guardar ambos de una sola vez
    await _forgePickerSave();

    _renderAlmacen(document.getElementById('forjaAlmacenPanel'));
}

function almacenPickerCancel() {
    _pickerSelected = new Set();
    _renderAlmacen(document.getElementById('forjaAlmacenPanel'));
}

// ── Operaciones sobre el almacén ──────────────────────────────────────────
function almacenQty(id, delta) {
    _forgeMats = _forgeMats.map(m =>
        m.id === id ? { ...m, cantidad: Math.max(0, (m.cantidad || 0) + delta) } : m
    );
    _forgeSched();
    _renderAlmacen(document.getElementById('forjaAlmacenPanel'));
}

function almacenDel(id) {
    _forgeMats = _forgeMats.filter(m => m.id !== id);
    _forgeSched();
    _renderAlmacen(document.getElementById('forjaAlmacenPanel'));
}

// ══════════════════════════════════════════════════════════════════════════
// PANEL: HERRERÍA
// ══════════════════════════════════════════════════════════════════════════
let _herreriaIngCount = 0;

function _renderHerreria(panel) {
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

    panel.innerHTML = `
        <div class="forja-panel-hdr">
            <span class="forja-panel-hdr-icon">🔨</span>
            <span class="forja-panel-hdr-title">Herrería</span>
        </div>
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

    panel.classList.toggle('fg-tab-active', _forgeTab === 'herreria');
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
    _renderHerreria(document.getElementById('forjaHerreriaPanel'));
}

function herreriaCancelForm() {
    document.getElementById('herreriaForm').style.display = 'none';
    document.getElementById('herreriaAddWrap').style.display = 'flex';
}

function herreriaDel(id) {
    _forgeRecetas = _forgeRecetas.filter(r => r.id !== id);
    _forgeSched();
    _renderHerreria(document.getElementById('forjaHerreriaPanel'));
}

function herreriaForjar(id) {
    _forgeRecetas = _forgeRecetas.map(r =>
        r.id === id ? { ...r, forjadas: (r.forjadas || 0) + 1 } : r
    );
    _forgeSched();
    _renderHerreria(document.getElementById('forjaHerreriaPanel'));
}
