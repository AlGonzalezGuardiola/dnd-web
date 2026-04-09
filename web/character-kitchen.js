'use strict';
/* ─── Sistema de Cocina (solo Vel Rhazal) ──────────────────────────────────────
 *  Página completa — dos paneles:
 *    🥕 Despensa        — ingredientes (draggables)
 *    🍳 Cocina          — sub-tabs:
 *         📖 Libro de Recetas   — gestión de recetas
 *         🍳 Cocinar            — crafting drag-and-drop estilo Minecraft
 * ─────────────────────────────────────────────────────────────────────────── */

const COOK_CHARS = ['Vel'];

// ── Estado interno ────────────────────────────────────────────────────────
let _cookCharId       = null;
let _cookCharName     = null;
let _cookIngredientes = [];
let _cookRecetas      = [];
let _cookInventory    = [];   // Bolso de Hermione
let _cookSaveTimer    = null;
let _cookTab          = 'despensa';   // 'despensa' | 'cocina'

// Picker del Bolso de Hermione
let _ckPickerSelected  = new Set();
let _ckPickerCatFilter = 'todas';

// Sub-tabs de Cocina
let _cocinaSubTab = 'libro';     // 'libro' | 'cocinar'

// Estado del Cocinar
let _cocinarRecetaId = null;
let _cocinarSlots    = {};       // { slotIdx: { ingId, nombre, emoji } }

const COOK_BOLSO_KEY = '__bolso_hermione__';

const COOK_BOLSO_CATS = [
    { id: 'todas',        label: 'Todas',        icon: '✦'  },
    { id: 'ingredientes', label: 'Ingredientes',  icon: '🥕' },
    { id: 'comida',       label: 'Comida',        icon: '🍖' },
    { id: 'materiales',   label: 'Materiales',    icon: '⛏️' },
    { id: 'oro',          label: 'Oro',           icon: '🪙' },
    { id: 'armas',        label: 'Armas',         icon: '⚔️' },
    { id: 'armadura',     label: 'Armadura',      icon: '🛡️' },
    { id: 'importante',   label: 'Importantes',   icon: '💎' },
    { id: 'pociones',     label: 'Pociones',      icon: '🧪' },
    { id: 'pergaminos',   label: 'Pergaminos',    icon: '📜' },
    { id: 'cocinado',     label: 'Cocinado',      icon: '🍽️' },
    { id: 'componentes',  label: 'Componentes',   icon: '💎' },
    { id: 'forjado',      label: 'Forjado',       icon: '⚒️' },
    { id: 'conjurado',    label: 'Conjurado',     icon: '✨' },
    { id: 'otras',        label: 'Otras',         icon: '📦' },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function _ckEsc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _ckId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Entrada pública ───────────────────────────────────────────────────────
function openCocinaPanel(charId, charName) {
    if (!COOK_CHARS.includes(charId)) return;
    _cookCharId   = charId;
    _cookCharName = charName;
    const titleEl = document.getElementById('cocinaPageTitle');
    if (titleEl) titleEl.textContent = charName;
    _cookTab      = 'despensa';
    _cocinaSubTab = 'libro';
    cocinaSetTab('despensa');
    setView('cocina');
    _cookLoadAndRender();
}

// ── Tab principal ─────────────────────────────────────────────────────────
function cocinaSetTab(tab) {
    _cookTab = tab;
    document.getElementById('ckTabDespensa')?.classList.toggle('active', tab === 'despensa');
    document.getElementById('ckTabCocina')?.classList.toggle('active', tab === 'cocina');
    document.getElementById('cocinaDespensaPanel')?.classList.toggle('ck-tab-active', tab === 'despensa');
    document.getElementById('cocinaCocinasPanel')?.classList.toggle('ck-tab-active', tab === 'cocina');
}

// ── Carga y guardado ──────────────────────────────────────────────────────
async function _cookLoadAndRender() {
    const dp = document.getElementById('cocinaDespensaPanel');
    const cp = document.getElementById('cocinaCocinasPanel');
    if (dp) dp.innerHTML  = '<div class="cocina-panel-hdr"><span class="cocina-panel-hdr-icon">🥕</span><span class="cocina-panel-hdr-title">Despensa de Ingredientes</span></div><div class="fg-loading">Cargando…</div>';
    if (cp) cp.innerHTML  = '<div class="cocina-panel-hdr"><span class="cocina-panel-hdr-icon">🍳</span><span class="cocina-panel-hdr-title">Cocina</span></div><div class="fg-loading">Cargando…</div>';
    try {
        const res   = await fetch(`${API_BASE}/api/player-characters`);
        const json  = await res.json();
        const key   = `inv_${_cookCharId}`;
        const entry = (json.characters || []).find(c => c.charId === key);
        const cocina = entry?.data?.cocina || {};
        _cookIngredientes = Array.isArray(cocina.ingredientes) ? cocina.ingredientes : [];
        _cookRecetas      = Array.isArray(cocina.recetas)      ? cocina.recetas      : [];
        const bolso       = (json.characters || []).find(c => c.charId === COOK_BOLSO_KEY);
        _cookInventory    = Array.isArray(bolso?.data?.items)  ? bolso.data.items    : [];
    } catch {
        _cookIngredientes = []; _cookRecetas = []; _cookInventory = [];
    }
    _cookRender();
}

function _cookSched() {
    clearTimeout(_cookSaveTimer);
    _cookSaveTimer = setTimeout(async () => {
        try {
            const key   = `inv_${_cookCharId}`;
            const res   = await fetch(`${API_BASE}/api/player-characters`);
            const json  = await res.json();
            const entry = (json.characters || []).find(c => c.charId === key);
            const cur   = entry?.data || {};
            await fetch(`${API_BASE}/api/player-characters/${key}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: { ...cur, cocina: { ingredientes: _cookIngredientes, recetas: _cookRecetas } } }),
            });
        } catch(e) { console.error('Error guardando cocina:', e); }
    }, 800);
}

async function _cookPickerSave() {
    try {
        const res  = await fetch(`${API_BASE}/api/player-characters`);
        const json = await res.json();
        const bolso    = (json.characters || []).find(c => c.charId === COOK_BOLSO_KEY);
        const bolsoCur = bolso?.data || {};
        await fetch(`${API_BASE}/api/player-characters/${COOK_BOLSO_KEY}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { ...bolsoCur, items: _cookInventory } }),
        });
        const cocinaKey   = `inv_${_cookCharId}`;
        const cocinaEntry = (json.characters || []).find(c => c.charId === cocinaKey);
        const cocinaCur   = cocinaEntry?.data || {};
        await fetch(`${API_BASE}/api/player-characters/${cocinaKey}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { ...cocinaCur, cocina: { ingredientes: _cookIngredientes, recetas: _cookRecetas } } }),
        });
    } catch(e) { console.error('Error guardando cocina picker:', e); }
}

// ── Render principal ──────────────────────────────────────────────────────
function _cookRender() {
    const dp = document.getElementById('cocinaDespensaPanel');
    const cp = document.getElementById('cocinaCocinasPanel');
    if (dp) _renderDespensa(dp);
    if (cp) _renderCocinas(cp);
}

// ══════════════════════════════════════════════════════════════════════════
// PANEL: DESPENSA (con ingredientes draggables)
// ══════════════════════════════════════════════════════════════════════════
function _renderDespensa(panel) {
    const rows = _cookIngredientes.map(m => `
        <div class="fg-mat-row" draggable="true"
             ondragstart="onCookIngDragStart(event,'${m.id}')"
             ondragend="onCookIngDragEnd(event)"
             id="ckIng_${m.id}">
            <span class="fg-mat-drag-handle" title="Arrastra al Cocinar">⠿</span>
            <span class="fg-mat-emoji">${_ckEsc(m.emoji || '🥕')}</span>
            <div class="fg-mat-info">
                <span class="fg-mat-name">${_ckEsc(m.nombre)}</span>
                ${m.desc ? `<span class="fg-mat-desc">${_ckEsc(m.desc)}</span>` : ''}
            </div>
            <div class="fg-mat-qty-wrap">
                <button class="fg-qty-btn" onclick="despensaQty('${m.id}',-1)">−</button>
                <span class="fg-mat-qty">${m.cantidad}</span>
                <button class="fg-qty-btn" onclick="despensaQty('${m.id}',+1)">+</button>
            </div>
            <div class="fg-mat-actions">
                <button class="fg-row-btn fg-btn-return" onclick="despensaReturn('${m.id}')" title="Devolver al Bolso de Hermione">🎒</button>
            </div>
        </div>`).join('');

    panel.innerHTML = `
        <div class="cocina-panel-hdr">
            <span class="cocina-panel-hdr-icon">🥕</span>
            <span class="cocina-panel-hdr-title">Despensa de Ingredientes</span>
        </div>
        <div class="fg-section">
            ${_cookIngredientes.length === 0
                ? '<div class="fg-empty">Sin ingredientes. Añade desde el inventario.</div>'
                : `<div class="fg-mat-list">${rows}</div>`}
        </div>
        <div class="fg-add-wrap" id="despensaAddWrap">
            <button class="fg-add-btn ck-add-btn" onclick="despensaOpenPicker()">🎒 Añadir desde inventario</button>
        </div>`;

    panel.classList.toggle('ck-tab-active', _cookTab === 'despensa');
}

// ── Drag desde la Despensa ────────────────────────────────────────────────
function onCookIngDragStart(event, ingId) {
    event.dataTransfer.setData('text/plain', ingId);
    event.dataTransfer.effectAllowed = 'copy';
    event.currentTarget.classList.add('fg-dragging');
}
function onCookIngDragEnd(event) {
    event.currentTarget.classList.remove('fg-dragging');
}

// ── Picker del Bolso de Hermione ──────────────────────────────────────────
function despensaOpenPicker() {
    _ckPickerSelected  = new Set();
    _ckPickerCatFilter = 'todas';
    const panel = document.getElementById('cocinaDespensaPanel');
    if (!panel) return;
    panel.querySelector('#despensaAddWrap')?.remove();
    _appendDespensaPicker(panel);
}

function _appendDespensaPicker(panel) {
    panel.querySelector('.fg-inv-picker')?.remove();
    const catTabs = COOK_BOLSO_CATS
        .map(c => `<button class="fg-cat-tab${_ckPickerCatFilter === c.id ? ' active' : ''}"
            onclick="despensaSetCat('${c.id}')">${c.icon} ${c.label}</button>`)
        .join('');
    const picker = document.createElement('div');
    picker.className = 'fg-inv-picker';
    picker.innerHTML = `
        <div class="fg-inv-picker-hdr">
            <span class="fg-inv-picker-title">🎒 Bolso de Hermione</span>
            <input class="fg-input fg-inv-search" id="despensaPickerSearch" type="search"
                placeholder="Buscar…" oninput="filterDespensaPicker(this.value)" autocomplete="off">
        </div>
        <div class="fg-cat-tabs" id="despensaCatTabs">${catTabs}</div>
        <div class="fg-inv-picker-list" id="despensaPickerList"></div>
        <div class="fg-inv-picker-footer">
            <button class="fg-btn-confirm" id="despensaPickerConfirmBtn" onclick="despensaPickerConfirm()">Añadir seleccionados</button>
            <button class="fg-btn-cancel" onclick="despensaPickerCancel()">Cancelar</button>
        </div>`;
    picker._available = _cookInventory.filter(it => it.nombre);
    panel.appendChild(picker);
    _refreshCookPickerList();
    picker.querySelector('.fg-inv-search')?.focus();
}

function despensaSetCat(catId) {
    _ckPickerCatFilter = catId;
    document.querySelectorAll('#despensaCatTabs .fg-cat-tab').forEach(btn => {
        const m = btn.getAttribute('onclick')?.match(/despensaSetCat\('([^']+)'\)/);
        if (m) btn.classList.toggle('active', m[1] === catId);
    });
    _refreshCookPickerList();
}

function filterDespensaPicker() { _refreshCookPickerList(); }

function _refreshCookPickerList() {
    const search = document.getElementById('despensaPickerSearch')?.value ?? '';
    const picker = document.getElementById('cocinaDespensaPanel')?.querySelector('.fg-inv-picker');
    if (!picker) return;
    const q = search.toLowerCase();
    let items = picker._available;
    if (_ckPickerCatFilter !== 'todas') items = items.filter(it => (it.categoria || 'otras') === _ckPickerCatFilter);
    if (q) items = items.filter(it => it.nombre.toLowerCase().includes(q));
    _renderDespensaPickerList(items, q);
}

function _renderDespensaPickerList(items, query) {
    const list = document.getElementById('despensaPickerList');
    if (!list) return;
    if (!items.length) {
        list.innerHTML = `<div class="fg-picker-empty">${query ? 'Sin resultados' : 'El inventario está vacío'}</div>`;
        return;
    }
    list.innerHTML = items.map(it => {
        const sel = _ckPickerSelected.has(it.id);
        let thumb = it.img
            ? `<img src="${_ckEsc(it.img)}" alt="" class="fg-inv-thumb-img">`
            : `<span class="fg-inv-thumb-emoji">${_ckEsc(it.emoji || '🥕')}</span>`;
        const qty = it.cantidad > 1 ? `<span class="fg-inv-qty">×${it.cantidad}</span>` : '';
        return `
        <div class="fg-inv-item${sel ? ' selected' : ''}" data-ckiid="${_ckEsc(it.id)}" onclick="toggleDespensaPick('${it.id}')">
            <span class="fg-inv-check-icon">${sel ? '☑' : '☐'}</span>
            <div class="fg-inv-thumb">${thumb}</div>
            <div class="fg-inv-info">
                <span class="fg-inv-name">${_ckEsc(it.nombre)}${qty}</span>
                ${it.desc ? `<span class="fg-inv-desc">${_ckEsc(it.desc)}</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

function toggleDespensaPick(itemId) {
    if (_ckPickerSelected.has(itemId)) _ckPickerSelected.delete(itemId);
    else                                _ckPickerSelected.add(itemId);
    const el = document.querySelector(`[data-ckiid="${itemId}"]`);
    if (el) {
        const sel = _ckPickerSelected.has(itemId);
        el.classList.toggle('selected', sel);
        const icon = el.querySelector('.fg-inv-check-icon');
        if (icon) icon.textContent = sel ? '☑' : '☐';
    }
    const btn = document.getElementById('despensaPickerConfirmBtn');
    if (btn) {
        const n = _ckPickerSelected.size;
        btn.textContent = n > 0 ? `Añadir ${n} objeto${n > 1 ? 's' : ''}` : 'Añadir seleccionados';
    }
}

async function despensaPickerConfirm() {
    if (_ckPickerSelected.size === 0) { despensaPickerCancel(); return; }
    const selected = _cookInventory.filter(it => _ckPickerSelected.has(it.id));
    _cookIngredientes = [..._cookIngredientes, ...selected.map(it => ({
        id: _ckId(), emoji: it.emoji || '🥕', nombre: it.nombre, cantidad: it.cantidad || 1, desc: it.desc || '',
    }))];
    _cookInventory = _cookInventory.filter(it => !_ckPickerSelected.has(it.id));
    _ckPickerSelected = new Set();
    await _cookPickerSave();
    _renderDespensa(document.getElementById('cocinaDespensaPanel'));
}

function despensaPickerCancel() {
    _ckPickerSelected = new Set();
    _renderDespensa(document.getElementById('cocinaDespensaPanel'));
}

function despensaQty(id, delta) {
    _cookIngredientes = _cookIngredientes.map(m => m.id === id ? { ...m, cantidad: Math.max(0, (m.cantidad||0) + delta) } : m);
    _cookSched();
    _renderDespensa(document.getElementById('cocinaDespensaPanel'));
}

async function despensaReturn(id) {
    const ing = _cookIngredientes.find(m => m.id === id);
    if (!ing) return;
    _cookInventory = [..._cookInventory, { id: _ckId(), nombre: ing.nombre, emoji: ing.emoji || '🥕', cantidad: ing.cantidad || 1, desc: ing.desc || null, categoria: 'ingredientes', ts: Date.now() }];
    _cookIngredientes = _cookIngredientes.filter(m => m.id !== id);
    await _cookPickerSave();
    _renderDespensa(document.getElementById('cocinaDespensaPanel'));
}

// ══════════════════════════════════════════════════════════════════════════
// PANEL: COCINA (con sub-tabs Libro / Cocinar)
// ══════════════════════════════════════════════════════════════════════════
function cocinaSetSubTab(tab) {
    _cocinaSubTab = tab;
    _renderCocinas(document.getElementById('cocinaCocinasPanel'));
}

function _renderCocinas(panel) {
    const subTabs = `
    <div class="fg-sub-tabs ck-sub-tabs">
        <button class="fg-sub-tab${_cocinaSubTab==='libro'?' active':''}" onclick="cocinaSetSubTab('libro')">📖 Libro de Recetas</button>
        <button class="fg-sub-tab${_cocinaSubTab==='cocinar'?' active':''}" onclick="cocinaSetSubTab('cocinar')">🍳 Cocinar</button>
    </div>`;

    panel.innerHTML = `
        <div class="cocina-panel-hdr">
            <span class="cocina-panel-hdr-icon">🍳</span>
            <span class="cocina-panel-hdr-title">Cocina</span>
        </div>
        ${subTabs}
        <div id="cocinaSubContent" class="fg-herreria-sub"></div>`;

    if (_cocinaSubTab === 'libro') _renderLibroRecetas();
    else                            _renderCocinar();

    panel.classList.toggle('ck-tab-active', _cookTab === 'cocina');
}

// ── Sub-tab: Libro de Recetas ─────────────────────────────────────────────
function _renderLibroRecetas() {
    const sub = document.getElementById('cocinaSubContent');
    if (!sub) return;
    const cards = _cookRecetas.map(r => {
        const ingHtml = (r.ingredientes || []).map(i =>
            `<span class="fg-rec-ing">${_ckEsc(i.nombre)} ×${i.cantidad}</span>`).join('');
        const cdBadge = r.cd ? `<span class="fg-rec-cd">CD ${r.cd}</span>` : '';
        return `
        <div class="fg-rec-card">
            <div class="fg-rec-hdr">
                <span class="fg-rec-emoji">${_ckEsc(r.emoji || '🍽️')}</span>
                <div class="fg-rec-info">
                    <div class="fg-rec-name">${_ckEsc(r.nombre)}</div>
                    ${r.desc ? `<div class="fg-rec-desc">${_ckEsc(r.desc)}</div>` : ''}
                </div>
                <div class="fg-rec-actions">
                    <button class="fg-row-btn fg-btn-edit" onclick="cocinaRecetaEdit('${r.id}')" title="Editar">✏️</button>
                    <button class="fg-row-btn fg-btn-del"  onclick="cocinaRecetaDel('${r.id}')"  title="Eliminar">✕</button>
                </div>
            </div>
            ${ingHtml ? `<div class="fg-rec-ings">${ingHtml}</div>` : ''}
            ${cdBadge ? `<div class="fg-rec-footer">${cdBadge}<span class="fg-rec-count">Cocinado ${r.cocinadas||0}×</span></div>` : ''}
        </div>`;
    }).join('');

    sub.innerHTML = `
        <div class="fg-section">
            ${_cookRecetas.length === 0
                ? '<div class="fg-empty">Sin recetas. Añade la primera.</div>'
                : `<div class="fg-rec-list">${cards}</div>`}
        </div>
        <div class="fg-add-wrap" id="cocinaAddWrap">
            <button class="fg-add-btn ck-add-btn" onclick="cocinaRecetaShowForm()">+ Añadir receta</button>
        </div>
        <div class="fg-form fg-rec-form" id="cocinaRecetaForm" style="display:none">
            <div class="fg-form-row">
                <input class="fg-input fg-input-sm" id="cocinaEmoji" placeholder="Emoji" maxlength="4">
                <input class="fg-input" id="cocinaNombre" placeholder="Nombre del plato">
                <input class="fg-input fg-input-sm" id="cocinaCd" type="number" min="1" max="30" placeholder="CD">
            </div>
            <input class="fg-input" id="cocinaDesc" placeholder="Descripción (opcional)">
            <div class="fg-ing-section">
                <div class="fg-ing-label">Ingredientes</div>
                <div id="cocinaIngs"></div>
                <button class="fg-add-ing-btn ck-add-ing-btn" onclick="cocinaAddIng()">+ Ingrediente</button>
            </div>
            <input type="hidden" id="cocinaEditId">
            <div class="fg-form-btns">
                <button class="fg-btn-confirm" onclick="cocinaRecetaSaveForm()">Guardar</button>
                <button class="fg-btn-cancel"  onclick="cocinaRecetaCancelForm()">Cancelar</button>
            </div>
        </div>`;
}

let _cocinaIngCount = 0;

function cocinaRecetaShowForm() {
    _cocinaIngCount = 0;
    document.getElementById('cocinaRecetaForm').style.display = 'flex';
    document.getElementById('cocinaAddWrap').style.display = 'none';
    document.getElementById('cocinaIngs').innerHTML = '';
    document.getElementById('cocinaEmoji').value  = '';
    document.getElementById('cocinaNombre').value = '';
    document.getElementById('cocinaCd').value     = '';
    document.getElementById('cocinaDesc').value   = '';
    document.getElementById('cocinaEditId').value = '';
    document.getElementById('cocinaNombre').focus();
}

function cocinaRecetaEdit(id) {
    const r = _cookRecetas.find(x => x.id === id);
    if (!r) return;
    _cocinaIngCount = 0;
    document.getElementById('cocinaRecetaForm').style.display = 'flex';
    document.getElementById('cocinaAddWrap').style.display = 'none';
    document.getElementById('cocinaIngs').innerHTML = '';
    document.getElementById('cocinaEmoji').value    = r.emoji  || '';
    document.getElementById('cocinaNombre').value   = r.nombre || '';
    document.getElementById('cocinaCd').value       = r.cd     || '';
    document.getElementById('cocinaDesc').value     = r.desc   || '';
    document.getElementById('cocinaEditId').value   = id;
    (r.ingredientes || []).forEach(i => cocinaAddIng(i.nombre, i.cantidad));
    document.getElementById('cocinaNombre').focus();
}

function cocinaAddIng(nombre = '', cantidad = 1) {
    const idx = _cocinaIngCount++;
    const div = document.createElement('div');
    div.className = 'fg-ing-row'; div.id = `ckIng${idx}`;
    div.innerHTML = `
        <input class="fg-input" data-ing-nombre placeholder="Ingrediente" value="${_ckEsc(nombre)}">
        <input class="fg-input fg-input-sm" data-ing-cant type="number" min="1" value="${cantidad}">
        <button class="fg-row-btn fg-btn-del" onclick="cocinaRemIng(${idx})">✕</button>`;
    document.getElementById('cocinaIngs').appendChild(div);
}

function cocinaRemIng(idx) { document.getElementById(`ckIng${idx}`)?.remove(); }

function cocinaRecetaSaveForm() {
    const nombre = document.getElementById('cocinaNombre').value.trim();
    if (!nombre) { document.getElementById('cocinaNombre').focus(); return; }
    const emoji  = document.getElementById('cocinaEmoji').value.trim() || '🍽️';
    const cd     = parseInt(document.getElementById('cocinaCd').value) || null;
    const desc   = document.getElementById('cocinaDesc').value.trim();
    const editId = document.getElementById('cocinaEditId').value;
    const ings = [...document.querySelectorAll('#cocinaIngs .fg-ing-row')].map(row => ({
        nombre:   row.querySelector('[data-ing-nombre]').value.trim(),
        cantidad: Math.max(1, parseInt(row.querySelector('[data-ing-cant]').value) || 1),
    })).filter(x => x.nombre);
    if (editId) {
        _cookRecetas = _cookRecetas.map(r => r.id === editId ? { ...r, emoji, nombre, cd, desc, ingredientes: ings } : r);
    } else {
        _cookRecetas = [..._cookRecetas, { id: _ckId(), emoji, nombre, cd, desc, ingredientes: ings, cocinadas: 0 }];
    }
    _cookSched();
    _renderCocinas(document.getElementById('cocinaCocinasPanel'));
}

function cocinaRecetaCancelForm() {
    document.getElementById('cocinaRecetaForm').style.display = 'none';
    document.getElementById('cocinaAddWrap').style.display = 'flex';
}

function cocinaRecetaDel(id) {
    _cookRecetas = _cookRecetas.filter(r => r.id !== id);
    if (_cocinarRecetaId === id) { _cocinarRecetaId = null; _cocinarSlots = {}; }
    _cookSched();
    _renderCocinas(document.getElementById('cocinaCocinasPanel'));
}

// ── Sub-tab: Cocinar ──────────────────────────────────────────────────────
function _renderCocinar() {
    const sub = document.getElementById('cocinaSubContent');
    if (!sub) return;

    if (_cookRecetas.length === 0) {
        sub.innerHTML = '<div class="fg-empty">Aún no tienes recetas.<br><span style="font-size:11px;opacity:.6">Añádelas en el Libro de Recetas.</span></div>';
        return;
    }

    const options = _cookRecetas.map(r =>
        `<option value="${r.id}"${r.id === _cocinarRecetaId ? ' selected' : ''}>${_ckEsc(r.emoji||'🍽️')} ${_ckEsc(r.nombre)}</option>`
    ).join('');

    sub.innerHTML = `
        <div class="fg-forjar-top">
            <label class="fg-forjar-label">Receta</label>
            <select class="fg-input fg-forjar-select" onchange="cocinarSelectReceta(this.value)">
                <option value="">— Elige una receta —</option>
                ${options}
            </select>
        </div>
        <div id="cocinarArea"></div>`;

    _renderCocinarArea();
}

function cocinarSelectReceta(id) {
    _cocinarRecetaId = id || null;
    _cocinarSlots    = {};
    _renderCocinarArea();
}

function _renderCocinarArea() {
    const area = document.getElementById('cocinarArea');
    if (!area) return;
    if (!_cocinarRecetaId) { area.innerHTML = ''; return; }
    const r = _cookRecetas.find(x => x.id === _cocinarRecetaId);
    if (!r) { area.innerHTML = ''; return; }

    const ings = r.ingredientes || [];
    const slots = ings.map((ing, i) => {
        const slot = _cocinarSlots[i];
        const mat  = slot ? _cookIngredientes.find(m => m.id === slot.ingId) : null;
        const enough = mat && mat.cantidad >= ing.cantidad;
        let filledHtml = '';
        if (slot) {
            filledHtml = `
            <div class="fg-slot-placed">
                <span class="fg-slot-placed-emoji">${_ckEsc(slot.emoji)}</span>
                <span class="fg-slot-placed-name">${_ckEsc(slot.nombre)}</span>
                ${!enough ? `<span class="fg-slot-warn" title="Cantidad insuficiente">⚠️ ×${mat?.cantidad??0}/${ing.cantidad}</span>` : `<span class="fg-slot-ok">✓ ×${ing.cantidad}</span>`}
            </div>
            <button class="fg-slot-clear" onclick="clearCocinarSlot(${i})" title="Quitar">✕</button>`;
        }
        return `
        <div class="fg-ing-slot${slot ? (enough ? ' filled' : ' filled insufficient') : ''}"
             ondragover="cocinarDragOver(event)"
             ondragleave="cocinarDragLeave(event)"
             ondrop="cocinarDrop(event,${i})">
            <div class="fg-slot-req">
                <span class="fg-slot-req-name">${_ckEsc(ing.nombre)}</span>
                <span class="fg-slot-req-qty">×${ing.cantidad}</span>
            </div>
            ${slot ? filledHtml : '<div class="fg-slot-hint">⬇ Arrastra</div>'}
        </div>`;
    }).join('');

    const allReady = ings.length > 0 && ings.every((ing, i) => {
        const slot = _cocinarSlots[i];
        const mat  = slot ? _cookIngredientes.find(m => m.id === slot.ingId) : null;
        return mat && mat.cantidad >= ing.cantidad;
    });
    const cdBadge = r.cd ? `<span class="fg-rec-cd">CD ${r.cd}</span>` : '';

    area.innerHTML = `
        <div class="fg-forjar-recipe-hdr">
            <span class="fg-forjar-rec-emoji">${_ckEsc(r.emoji||'🍽️')}</span>
            <div class="fg-forjar-rec-info">
                <div class="fg-forjar-rec-name">${_ckEsc(r.nombre)}</div>
                ${r.desc ? `<div class="fg-rec-desc">${_ckEsc(r.desc)}</div>` : ''}
            </div>
            ${cdBadge}
        </div>
        ${ings.length === 0
            ? '<div class="fg-empty" style="padding:16px">Esta receta no tiene ingredientes.</div>'
            : `<div class="fg-forjar-slots">${slots}</div>`}
        <div class="fg-forjar-footer">
            <span class="fg-rec-count">Cocinado ${r.cocinadas||0}×</span>
            <button class="fg-forge-btn ck-cook-btn${allReady ? '' : ' fg-forge-disabled'}"
                ${allReady ? 'onclick="doCocinar()"' : 'disabled'}
                title="${allReady ? '¡Cocinar!' : 'Arrastra todos los ingredientes'}">
                🍳 Cocinar
            </button>
        </div>`;
}

// ── Drag & drop sobre slots de ingrediente ────────────────────────────────
function cocinarDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    event.currentTarget.classList.add('fg-slot-dragover');
}
function cocinarDragLeave(event) {
    event.currentTarget.classList.remove('fg-slot-dragover');
}
function cocinarDrop(event, slotIdx) {
    event.preventDefault();
    event.currentTarget.classList.remove('fg-slot-dragover');
    const ingId = event.dataTransfer.getData('text/plain');
    const ing   = _cookIngredientes.find(m => m.id === ingId);
    if (!ing) return;
    _cocinarSlots[slotIdx] = { ingId, nombre: ing.nombre, emoji: ing.emoji || '🥕' };
    _renderCocinarArea();
}
function clearCocinarSlot(idx) {
    delete _cocinarSlots[idx];
    _renderCocinarArea();
}

async function doCocinar() {
    const r = _cookRecetas.find(x => x.id === _cocinarRecetaId);
    if (!r) return;

    // Calcular consumo (varios slots pueden usar el mismo ingrediente)
    const consume = {};
    (r.ingredientes || []).forEach((ing, i) => {
        const slot = _cocinarSlots[i];
        if (!slot) return;
        consume[slot.ingId] = (consume[slot.ingId] || 0) + ing.cantidad;
    });

    _cookIngredientes = _cookIngredientes
        .map(m => m.id in consume ? { ...m, cantidad: m.cantidad - consume[m.id] } : m)
        .filter(m => m.cantidad > 0);

    _cookRecetas = _cookRecetas.map(r2 =>
        r2.id === _cocinarRecetaId ? { ...r2, cocinadas: (r2.cocinadas || 0) + 1 } : r2
    );

    // Añadir el plato cocinado al Bolso de Hermione
    const cookedItem = {
        id:        _ckId(),
        nombre:    r.nombre,
        emoji:     r.emoji || '🍽️',
        cantidad:  1,
        desc:      r.desc || null,
        categoria: 'cocinado',
        ts:        Date.now(),
    };
    _cookInventory = [..._cookInventory, cookedItem];

    _cocinarSlots = {};
    await _cookPickerSave();
    _cookRender();

    // Animación de cocina → popup de obtención
    _playCocinaAnimation(cookedItem);
}

// ── Animación de cocina + popup de obtención ──────────────────────────────
function _playCocinaAnimation(item) {
    const overlay = document.createElement('div');
    overlay.id = 'cocinaVideoOverlay';
    overlay.className = 'cook-video-overlay';
    overlay.innerHTML = `
        <video class="cook-video" id="cocinaVideo" autoplay playsinline muted>
            <source src="assets/videos/cooking-animation.mp4" type="video/mp4">
        </video>`;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('cook-video-overlay--visible'));

    const video = document.getElementById('cocinaVideo');

    const finish = () => {
        clearTimeout(fallback);
        overlay.remove();
        _showCocinaObtainedPopup(item);
    };

    const fallback = setTimeout(finish, 12000);

    video.addEventListener('ended', finish, { once: true });
    overlay.addEventListener('click', finish);
}

function _showCocinaObtainedPopup(item) {
    document.getElementById('cocinaObtainedPopup')?.remove();

    const popup = document.createElement('div');
    popup.id = 'cocinaObtainedPopup';
    popup.className = 'cook-obtained-popup';
    popup.innerHTML = `
        <div class="cook-obtained-inner">
            <div class="cook-obtained-sparks" aria-hidden="true">
                ${Array.from({ length: 12 }, (_, i) =>
                    `<span class="co-spark co-spark-${i}" style="--i:${i}"></span>`
                ).join('')}
            </div>
            <div class="cook-obtained-icon">${_ckEsc(item.emoji)}</div>
            <div class="cook-obtained-label">¡Has preparado!</div>
            <div class="cook-obtained-name">${_ckEsc(item.nombre)}</div>
            <button class="cook-obtained-btn" onclick="document.getElementById('cocinaObtainedPopup').remove()">
                ¡Buen provecho!
            </button>
        </div>`;
    document.body.appendChild(popup);

    requestAnimationFrame(() => popup.classList.add('cook-obtained-popup--visible'));

    setTimeout(() => {
        popup.classList.remove('cook-obtained-popup--visible');
        setTimeout(() => popup.remove(), 400);
    }, 6000);
}
