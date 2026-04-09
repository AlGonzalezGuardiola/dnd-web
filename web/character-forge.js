'use strict';
/* ─── Sistema de Forja (solo Asthor) ─────────────────────────────────────────
 *  Página completa — dos paneles:
 *    🪨 Almacén        — materiales (draggables)
 *    🔨 Herrería       — sub-tabs:
 *         📖 Libro de Creaciones  — gestión de recetas
 *         ⚒️  Forjar              — crafting drag-and-drop estilo Minecraft
 * ─────────────────────────────────────────────────────────────────────────── */

const FORGE_CHARS = ['Asthor'];

// ── Estado interno ────────────────────────────────────────────────────────
let _forgeCharId    = null;
let _forgeCharName  = null;
let _forgeMats      = [];
let _forgeRecetas   = [];
let _forgeInventory = [];   // Bolso de Hermione
let _forgeSaveTimer = null;
let _forgeTab       = 'almacen';   // 'almacen' | 'herreria'

// Picker del Bolso de Hermione
let _pickerSelected  = new Set();
let _pickerCatFilter = 'todas';

// Sub-tabs de Herrería
let _herreriaSubTab = 'libro';     // 'libro' | 'forjar'

// Estado del Forjar
let _forjarRecetaId = null;
let _forjarSlots    = {};          // { slotIdx: { matId, nombre, emoji } }

const BOLSO_KEY = '__bolso_hermione__';

const BOLSO_CATS = [
    { id: 'todas',      label: 'Todas',       icon: '✦'  },
    { id: 'materiales', label: 'Materiales',  icon: '⛏️' },
    { id: 'oro',        label: 'Oro',         icon: '🪙' },
    { id: 'comida',     label: 'Comida',      icon: '🍖' },
    { id: 'armas',      label: 'Armas',       icon: '⚔️' },
    { id: 'armadura',   label: 'Armadura',    icon: '🛡️' },
    { id: 'importante', label: 'Importantes', icon: '💎' },
    { id: 'pociones',   label: 'Pociones',    icon: '🧪' },
    { id: 'pergaminos', label: 'Pergaminos',  icon: '📜' },
    { id: 'otras',      label: 'Otras',       icon: '📦' },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function _fEsc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
    _forgeTab      = 'almacen';
    _herreriaSubTab = 'libro';
    forjaSetTab('almacen');
    setView('forja');
    _forgeLoadAndRender();
}

// ── Tab principal ─────────────────────────────────────────────────────────
function forjaSetTab(tab) {
    _forgeTab = tab;
    document.getElementById('fgTabAlmacen')?.classList.toggle('active', tab === 'almacen');
    document.getElementById('fgTabHerreria')?.classList.toggle('active', tab === 'herreria');
    document.getElementById('forjaAlmacenPanel')?.classList.toggle('fg-tab-active', tab === 'almacen');
    document.getElementById('forjaHerreriaPanel')?.classList.toggle('fg-tab-active', tab === 'herreria');
}

// ── Carga y guardado ──────────────────────────────────────────────────────
async function _forgeLoadAndRender() {
    const ap = document.getElementById('forjaAlmacenPanel');
    const hp = document.getElementById('forjaHerreriaPanel');
    if (ap) ap.innerHTML  = '<div class="forja-panel-hdr"><span class="forja-panel-hdr-icon">🪨</span><span class="forja-panel-hdr-title">Almacén de Materiales</span></div><div class="fg-loading">Cargando…</div>';
    if (hp) hp.innerHTML  = '<div class="forja-panel-hdr"><span class="forja-panel-hdr-icon">🔨</span><span class="forja-panel-hdr-title">Herrería</span></div><div class="fg-loading">Cargando…</div>';
    try {
        const res   = await fetch(`${API_BASE}/api/player-characters`);
        const json  = await res.json();
        const key   = `inv_${_forgeCharId}`;
        const entry = (json.characters || []).find(c => c.charId === key);
        const forge = entry?.data?.forge || {};
        _forgeMats    = Array.isArray(forge.materiales) ? forge.materiales : [];
        _forgeRecetas = Array.isArray(forge.recetas)    ? forge.recetas    : [];
        const bolso   = (json.characters || []).find(c => c.charId === BOLSO_KEY);
        _forgeInventory = Array.isArray(bolso?.data?.items) ? bolso.data.items : [];
    } catch {
        _forgeMats = []; _forgeRecetas = []; _forgeInventory = [];
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
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: { ...cur, forge: { materiales: _forgeMats, recetas: _forgeRecetas } } }),
            });
        } catch(e) { console.error('Error guardando forja:', e); }
    }, 800);
}

async function _forgePickerSave() {
    try {
        const res  = await fetch(`${API_BASE}/api/player-characters`);
        const json = await res.json();
        const bolso    = (json.characters || []).find(c => c.charId === BOLSO_KEY);
        const bolsoCur = bolso?.data || {};
        await fetch(`${API_BASE}/api/player-characters/${BOLSO_KEY}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { ...bolsoCur, items: _forgeInventory } }),
        });
        const forjaKey   = `inv_${_forgeCharId}`;
        const forjaEntry = (json.characters || []).find(c => c.charId === forjaKey);
        const forjaCur   = forjaEntry?.data || {};
        await fetch(`${API_BASE}/api/player-characters/${forjaKey}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { ...forjaCur, forge: { materiales: _forgeMats, recetas: _forgeRecetas } } }),
        });
    } catch(e) { console.error('Error guardando picker:', e); }
}

// ── Render principal ──────────────────────────────────────────────────────
function _forgeRender() {
    const ap = document.getElementById('forjaAlmacenPanel');
    const hp = document.getElementById('forjaHerreriaPanel');
    if (ap) _renderAlmacen(ap);
    if (hp) _renderHerreria(hp);
}

// ══════════════════════════════════════════════════════════════════════════
// PANEL: ALMACÉN (con materiales draggables)
// ══════════════════════════════════════════════════════════════════════════
function _renderAlmacen(panel) {
    const rows = _forgeMats.map(m => `
        <div class="fg-mat-row" draggable="true"
             ondragstart="onMatDragStart(event,'${m.id}')"
             ondragend="onMatDragEnd(event)"
             id="fgMat_${m.id}">
            <span class="fg-mat-drag-handle" title="Arrastra al Forjar">⠿</span>
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
                <button class="fg-row-btn fg-btn-return" onclick="almacenReturn('${m.id}')" title="Devolver al Bolso de Hermione">🎒</button>
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

// ── Drag desde el Almacén ─────────────────────────────────────────────────
function onMatDragStart(event, matId) {
    event.dataTransfer.setData('text/plain', matId);
    event.dataTransfer.effectAllowed = 'copy';
    event.currentTarget.classList.add('fg-dragging');
}
function onMatDragEnd(event) {
    event.currentTarget.classList.remove('fg-dragging');
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
    const catTabs = BOLSO_CATS
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
            <button class="fg-btn-confirm" id="almacenPickerConfirmBtn" onclick="almacenPickerConfirm()">Añadir seleccionados</button>
            <button class="fg-btn-cancel" onclick="almacenPickerCancel()">Cancelar</button>
        </div>`;
    picker._available = _forgeInventory.filter(it => it.nombre);
    panel.appendChild(picker);
    _refreshPickerList();
    picker.querySelector('.fg-inv-search')?.focus();
}

function almacenSetCat(catId) {
    _pickerCatFilter = catId;
    document.querySelectorAll('#almacenCatTabs .fg-cat-tab').forEach(btn => {
        const m = btn.getAttribute('onclick')?.match(/almacenSetCat\('([^']+)'\)/);
        if (m) btn.classList.toggle('active', m[1] === catId);
    });
    _refreshPickerList();
}

function filterAlmacenPicker() { _refreshPickerList(); }

function _refreshPickerList() {
    const search = document.getElementById('almacenPickerSearch')?.value ?? '';
    const picker = document.getElementById('forjaAlmacenPanel')?.querySelector('.fg-inv-picker');
    if (!picker) return;
    const q = search.toLowerCase();
    let items = picker._available;
    if (_pickerCatFilter !== 'todas') items = items.filter(it => (it.categoria || 'otras') === _pickerCatFilter);
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
        let thumb = it.img
            ? `<img src="${_fEsc(it.img)}" alt="" class="fg-inv-thumb-img">`
            : `<span class="fg-inv-thumb-emoji">${_fEsc(it.emoji || '📦')}</span>`;
        const qty = it.cantidad > 1 ? `<span class="fg-inv-qty">×${it.cantidad}</span>` : '';
        return `
        <div class="fg-inv-item${sel ? ' selected' : ''}" data-iid="${_fEsc(it.id)}" onclick="toggleAlmacenPick('${it.id}')">
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
    const el = document.querySelector(`[data-iid="${itemId}"]`);
    if (el) {
        const sel = _pickerSelected.has(itemId);
        el.classList.toggle('selected', sel);
        const icon = el.querySelector('.fg-inv-check-icon');
        if (icon) icon.textContent = sel ? '☑' : '☐';
    }
    const btn = document.getElementById('almacenPickerConfirmBtn');
    if (btn) {
        const n = _pickerSelected.size;
        btn.textContent = n > 0 ? `Añadir ${n} objeto${n > 1 ? 's' : ''}` : 'Añadir seleccionados';
    }
}

async function almacenPickerConfirm() {
    if (_pickerSelected.size === 0) { almacenPickerCancel(); return; }
    const selected = _forgeInventory.filter(it => _pickerSelected.has(it.id));
    _forgeMats      = [..._forgeMats, ...selected.map(it => ({
        id: _fId(), emoji: it.emoji || '📦', nombre: it.nombre, cantidad: it.cantidad || 1, desc: it.desc || '',
    }))];
    _forgeInventory = _forgeInventory.filter(it => !_pickerSelected.has(it.id));
    _pickerSelected = new Set();
    await _forgePickerSave();
    _renderAlmacen(document.getElementById('forjaAlmacenPanel'));
}

function almacenPickerCancel() {
    _pickerSelected = new Set();
    _renderAlmacen(document.getElementById('forjaAlmacenPanel'));
}

function almacenQty(id, delta) {
    _forgeMats = _forgeMats.map(m => m.id === id ? { ...m, cantidad: Math.max(0, (m.cantidad||0) + delta) } : m);
    _forgeSched();
    _renderAlmacen(document.getElementById('forjaAlmacenPanel'));
}

async function almacenReturn(id) {
    const mat = _forgeMats.find(m => m.id === id);
    if (!mat) return;
    _forgeInventory = [..._forgeInventory, { id: _fId(), nombre: mat.nombre, emoji: mat.emoji || '📦', cantidad: mat.cantidad || 1, desc: mat.desc || null, categoria: 'materiales', ts: Date.now() }];
    _forgeMats = _forgeMats.filter(m => m.id !== id);
    await _forgePickerSave();
    _renderAlmacen(document.getElementById('forjaAlmacenPanel'));
}

// ══════════════════════════════════════════════════════════════════════════
// PANEL: HERRERÍA (con sub-tabs Libro / Forjar)
// ══════════════════════════════════════════════════════════════════════════
function herreriaSetSubTab(tab) {
    _herreriaSubTab = tab;
    _renderHerreria(document.getElementById('forjaHerreriaPanel'));
}

function _renderHerreria(panel) {
    const subTabs = `
    <div class="fg-sub-tabs">
        <button class="fg-sub-tab${_herreriaSubTab==='libro'?' active':''}" onclick="herreriaSetSubTab('libro')">📖 Libro de Creaciones</button>
        <button class="fg-sub-tab${_herreriaSubTab==='forjar'?' active':''}" onclick="herreriaSetSubTab('forjar')">⚒️ Forjar</button>
    </div>`;

    panel.innerHTML = `
        <div class="forja-panel-hdr">
            <span class="forja-panel-hdr-icon">🔨</span>
            <span class="forja-panel-hdr-title">Herrería</span>
        </div>
        ${subTabs}
        <div id="herreriaSubContent" class="fg-herreria-sub"></div>`;

    if (_herreriaSubTab === 'libro') _renderLibro();
    else                              _renderForjar();

    panel.classList.toggle('fg-tab-active', _forgeTab === 'herreria');
}

// ── Sub-tab: Libro de Creaciones ──────────────────────────────────────────
function _renderLibro() {
    const sub = document.getElementById('herreriaSubContent');
    if (!sub) return;
    const cards = _forgeRecetas.map(r => {
        const ingHtml = (r.ingredientes || []).map(i =>
            `<span class="fg-rec-ing">${_fEsc(i.nombre)} ×${i.cantidad}</span>`).join('');
        const cdBadge = r.cd ? `<span class="fg-rec-cd">CD ${r.cd}</span>` : '';
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
            ${cdBadge ? `<div class="fg-rec-footer">${cdBadge}<span class="fg-rec-count">Forjado ${r.forjadas||0}×</span></div>` : ''}
        </div>`;
    }).join('');

    sub.innerHTML = `
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

let _herreriaIngCount = 0;

function herreriaShowForm() {
    _herreriaIngCount = 0;
    document.getElementById('herreriaForm').style.display = 'flex';
    document.getElementById('herreriaAddWrap').style.display = 'none';
    document.getElementById('herreriaIngs').innerHTML = '';
    document.getElementById('herreriaEmoji').value  = '';
    document.getElementById('herreriaNombre').value = '';
    document.getElementById('herreriaCd').value     = '';
    document.getElementById('herreriaDesc').value   = '';
    document.getElementById('herreriaEditId').value = '';
    document.getElementById('herreriaNombre').focus();
}

function herreriaEdit(id) {
    const r = _forgeRecetas.find(x => x.id === id);
    if (!r) return;
    _herreriaIngCount = 0;
    document.getElementById('herreriaForm').style.display = 'flex';
    document.getElementById('herreriaAddWrap').style.display = 'none';
    document.getElementById('herreriaIngs').innerHTML = '';
    document.getElementById('herreriaEmoji').value    = r.emoji  || '';
    document.getElementById('herreriaNombre').value   = r.nombre || '';
    document.getElementById('herreriaCd').value       = r.cd     || '';
    document.getElementById('herreriaDesc').value     = r.desc   || '';
    document.getElementById('herreriaEditId').value   = id;
    (r.ingredientes || []).forEach(i => herreriaAddIng(i.nombre, i.cantidad));
    document.getElementById('herreriaNombre').focus();
}

function herreriaAddIng(nombre = '', cantidad = 1) {
    const idx = _herreriaIngCount++;
    const div = document.createElement('div');
    div.className = 'fg-ing-row'; div.id = `fgIng${idx}`;
    div.innerHTML = `
        <input class="fg-input" data-ing-nombre placeholder="Material" value="${_fEsc(nombre)}">
        <input class="fg-input fg-input-sm" data-ing-cant type="number" min="1" value="${cantidad}">
        <button class="fg-row-btn fg-btn-del" onclick="herreriaRemIng(${idx})">✕</button>`;
    document.getElementById('herreriaIngs').appendChild(div);
}

function herreriaRemIng(idx) { document.getElementById(`fgIng${idx}`)?.remove(); }

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
        _forgeRecetas = _forgeRecetas.map(r => r.id === editId ? { ...r, emoji, nombre, cd, desc, ingredientes: ings } : r);
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
    if (_forjarRecetaId === id) { _forjarRecetaId = null; _forjarSlots = {}; }
    _forgeSched();
    _renderHerreria(document.getElementById('forjaHerreriaPanel'));
}

// ── Sub-tab: Forjar ───────────────────────────────────────────────────────
function _renderForjar() {
    const sub = document.getElementById('herreriaSubContent');
    if (!sub) return;

    if (_forgeRecetas.length === 0) {
        sub.innerHTML = '<div class="fg-empty">Aún no tienes recetas.<br><span style="font-size:11px;opacity:.6">Añádelas en el Libro de Creaciones.</span></div>';
        return;
    }

    const options = _forgeRecetas.map(r =>
        `<option value="${r.id}"${r.id === _forjarRecetaId ? ' selected' : ''}>${_fEsc(r.emoji||'⚒️')} ${_fEsc(r.nombre)}</option>`
    ).join('');

    sub.innerHTML = `
        <div class="fg-forjar-top">
            <label class="fg-forjar-label">Receta</label>
            <select class="fg-input fg-forjar-select" onchange="forjarSelectReceta(this.value)">
                <option value="">— Elige una receta —</option>
                ${options}
            </select>
        </div>
        <div id="forjarArea"></div>`;

    _renderForjarArea();
}

function forjarSelectReceta(id) {
    _forjarRecetaId = id || null;
    _forjarSlots    = {};
    _renderForjarArea();
}

function _renderForjarArea() {
    const area = document.getElementById('forjarArea');
    if (!area) return;
    if (!_forjarRecetaId) { area.innerHTML = ''; return; }
    const r = _forgeRecetas.find(x => x.id === _forjarRecetaId);
    if (!r) { area.innerHTML = ''; return; }

    const ings = r.ingredientes || [];
    const slots = ings.map((ing, i) => {
        const slot = _forjarSlots[i];
        const mat  = slot ? _forgeMats.find(m => m.id === slot.matId) : null;
        const enough = mat && mat.cantidad >= ing.cantidad;
        let filledHtml = '';
        if (slot) {
            filledHtml = `
            <div class="fg-slot-placed">
                <span class="fg-slot-placed-emoji">${_fEsc(slot.emoji)}</span>
                <span class="fg-slot-placed-name">${_fEsc(slot.nombre)}</span>
                ${!enough ? `<span class="fg-slot-warn" title="Cantidad insuficiente">⚠️ ×${mat?.cantidad??0}/${ing.cantidad}</span>` : `<span class="fg-slot-ok">✓ ×${ing.cantidad}</span>`}
            </div>
            <button class="fg-slot-clear" onclick="clearForjarSlot(${i})" title="Quitar">✕</button>`;
        }
        return `
        <div class="fg-ing-slot${slot ? (enough ? ' filled' : ' filled insufficient') : ''}"
             ondragover="forjarDragOver(event)"
             ondragleave="forjarDragLeave(event)"
             ondrop="forjarDrop(event,${i})">
            <div class="fg-slot-req">
                <span class="fg-slot-req-name">${_fEsc(ing.nombre)}</span>
                <span class="fg-slot-req-qty">×${ing.cantidad}</span>
            </div>
            ${slot ? filledHtml : '<div class="fg-slot-hint">⬇ Arrastra</div>'}
        </div>`;
    }).join('');

    const allReady = ings.length > 0 && ings.every((ing, i) => {
        const slot = _forjarSlots[i];
        const mat  = slot ? _forgeMats.find(m => m.id === slot.matId) : null;
        return mat && mat.cantidad >= ing.cantidad;
    });
    const cdBadge = r.cd ? `<span class="fg-rec-cd">CD ${r.cd}</span>` : '';

    area.innerHTML = `
        <div class="fg-forjar-recipe-hdr">
            <span class="fg-forjar-rec-emoji">${_fEsc(r.emoji||'⚒️')}</span>
            <div class="fg-forjar-rec-info">
                <div class="fg-forjar-rec-name">${_fEsc(r.nombre)}</div>
                ${r.desc ? `<div class="fg-rec-desc">${_fEsc(r.desc)}</div>` : ''}
            </div>
            ${cdBadge}
        </div>
        ${ings.length === 0
            ? '<div class="fg-empty" style="padding:16px">Esta receta no tiene ingredientes.</div>'
            : `<div class="fg-forjar-slots">${slots}</div>`}
        <div class="fg-forjar-footer">
            <span class="fg-rec-count">Forjado ${r.forjadas||0}×</span>
            <button class="fg-forge-btn${allReady ? '' : ' fg-forge-disabled'}"
                ${allReady ? 'onclick="doForjar()"' : 'disabled'}
                title="${allReady ? '¡Forjar!' : 'Arrastra todos los ingredientes'}">
                ⚒️ Forjar
            </button>
        </div>`;
}

// ── Drag & drop sobre slots de ingrediente ────────────────────────────────
function forjarDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    event.currentTarget.classList.add('fg-slot-dragover');
}
function forjarDragLeave(event) {
    event.currentTarget.classList.remove('fg-slot-dragover');
}
function forjarDrop(event, slotIdx) {
    event.preventDefault();
    event.currentTarget.classList.remove('fg-slot-dragover');
    const matId = event.dataTransfer.getData('text/plain');
    const mat   = _forgeMats.find(m => m.id === matId);
    if (!mat) return;
    _forjarSlots[slotIdx] = { matId, nombre: mat.nombre, emoji: mat.emoji || '📦' };
    _renderForjarArea();
}
function clearForjarSlot(idx) {
    delete _forjarSlots[idx];
    _renderForjarArea();
}

async function doForjar() {
    const r = _forgeRecetas.find(x => x.id === _forjarRecetaId);
    if (!r) return;

    // Calcular consumo (varios slots pueden usar el mismo material)
    const consume = {};
    (r.ingredientes || []).forEach((ing, i) => {
        const slot = _forjarSlots[i];
        if (!slot) return;
        consume[slot.matId] = (consume[slot.matId] || 0) + ing.cantidad;
    });

    _forgeMats = _forgeMats
        .map(m => m.id in consume ? { ...m, cantidad: m.cantidad - consume[m.id] } : m)
        .filter(m => m.cantidad > 0);

    _forgeRecetas = _forgeRecetas.map(r2 =>
        r2.id === _forjarRecetaId ? { ...r2, forjadas: (r2.forjadas || 0) + 1 } : r2
    );

    // Añadir el objeto forjado al Bolso de Hermione
    _forgeInventory = [..._forgeInventory, {
        id:        _fId(),
        nombre:    r.nombre,
        emoji:     r.emoji || '⚒️',
        cantidad:  1,
        desc:      r.desc || null,
        categoria: 'otras',
        ts:        Date.now(),
    }];

    _forjarSlots = {};
    await _forgePickerSave();  // guarda Bolso + forge en una sola pasada
    _forgeRender();
}
