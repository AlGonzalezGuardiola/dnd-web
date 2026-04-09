'use strict';
/* ─── Sistema de Biblioteca de Hechizos (solo Zero) ───────────────────────────
 *  Página completa — dos paneles:
 *    💎 Componentes     — componentes mágicos (draggables)
 *    🔮 Arcano          — sub-tabs:
 *         📖 Catálogo de Hechizos  — gestión de hechizos
 *         🔮 Conjurar              — lanzamiento drag-and-drop estilo Minecraft
 * ─────────────────────────────────────────────────────────────────────────── */

const SPELL_CHARS = ['Zero'];

// ── Estado interno ────────────────────────────────────────────────────────
let _spellCharId      = null;
let _spellCharName    = null;
let _spellComponentes = [];
let _spellHechizos    = [];
let _spellInventory   = [];   // Bolso de Hermione
let _spellSaveTimer   = null;
let _spellTab         = 'componentes';   // 'componentes' | 'arcano'

// Picker del Bolso de Hermione
let _spPickerSelected  = new Set();
let _spPickerCatFilter = 'todas';

// Sub-tabs del Arcano
let _arcanoSubTab = 'catalogo';     // 'catalogo' | 'conjurar'

// Estado del Conjurar
let _conjurarHechizoId = null;
let _conjurarSlots     = {};        // { slotIdx: { compId, nombre, emoji } }

const SPELL_BOLSO_KEY = '__bolso_hermione__';

const SPELL_BOLSO_CATS = [
    { id: 'todas',        label: 'Todas',        icon: '✦'  },
    { id: 'componentes',  label: 'Componentes',  icon: '💎' },
    { id: 'pergaminos',   label: 'Pergaminos',   icon: '📜' },
    { id: 'pociones',     label: 'Pociones',     icon: '🧪' },
    { id: 'materiales',   label: 'Materiales',   icon: '⛏️' },
    { id: 'ingredientes', label: 'Ingredientes', icon: '🥕' },
    { id: 'oro',          label: 'Oro',          icon: '🪙' },
    { id: 'armas',        label: 'Armas',        icon: '⚔️' },
    { id: 'armadura',     label: 'Armadura',     icon: '🛡️' },
    { id: 'importante',   label: 'Importantes',  icon: '💎' },
    { id: 'comida',       label: 'Comida',       icon: '🍖' },
    { id: 'conjurado',    label: 'Conjurado',    icon: '✨' },
    { id: 'forjado',      label: 'Forjado',      icon: '⚒️' },
    { id: 'cocinado',     label: 'Cocinado',     icon: '🍽️' },
    { id: 'otras',        label: 'Otras',        icon: '📦' },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function _spEsc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _spId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Entrada pública ───────────────────────────────────────────────────────
function openBibliotecaPanel(charId, charName) {
    if (!SPELL_CHARS.includes(charId)) return;
    _spellCharId   = charId;
    _spellCharName = charName;
    const titleEl = document.getElementById('bibliotecaPageTitle');
    if (titleEl) titleEl.textContent = charName;
    _spellTab    = 'componentes';
    _arcanoSubTab = 'catalogo';
    bibliotecaSetTab('componentes');
    setView('biblioteca');
    _spellLoadAndRender();
}

// ── Tab principal ─────────────────────────────────────────────────────────
function bibliotecaSetTab(tab) {
    _spellTab = tab;
    document.getElementById('spTabComponentes')?.classList.toggle('active', tab === 'componentes');
    document.getElementById('spTabArcano')?.classList.toggle('active', tab === 'arcano');
    document.getElementById('bibliotecaComponentesPanel')?.classList.toggle('sp-tab-active', tab === 'componentes');
    document.getElementById('bibliotecaArcanoPanel')?.classList.toggle('sp-tab-active', tab === 'arcano');
}

// ── Carga y guardado ──────────────────────────────────────────────────────
async function _spellLoadAndRender() {
    const cp = document.getElementById('bibliotecaComponentesPanel');
    const ap = document.getElementById('bibliotecaArcanoPanel');
    if (cp) cp.innerHTML = '<div class="biblio-panel-hdr"><span class="biblio-panel-hdr-icon">💎</span><span class="biblio-panel-hdr-title">Componentes Mágicos</span></div><div class="fg-loading">Cargando…</div>';
    if (ap) ap.innerHTML = '<div class="biblio-panel-hdr"><span class="biblio-panel-hdr-icon">🔮</span><span class="biblio-panel-hdr-title">Arcano</span></div><div class="fg-loading">Cargando…</div>';
    try {
        const res   = await fetch(`${API_BASE}/api/player-characters`);
        const json  = await res.json();
        const key   = `inv_${_spellCharId}`;
        const entry = (json.characters || []).find(c => c.charId === key);
        const bib   = entry?.data?.biblioteca || {};
        _spellComponentes = Array.isArray(bib.componentes) ? bib.componentes : [];
        _spellHechizos    = Array.isArray(bib.hechizos)    ? bib.hechizos    : [];
        const bolso       = (json.characters || []).find(c => c.charId === SPELL_BOLSO_KEY);
        _spellInventory   = Array.isArray(bolso?.data?.items) ? bolso.data.items : [];
    } catch {
        _spellComponentes = []; _spellHechizos = []; _spellInventory = [];
    }
    _spellRender();
}

function _spellSched() {
    clearTimeout(_spellSaveTimer);
    _spellSaveTimer = setTimeout(async () => {
        try {
            const key   = `inv_${_spellCharId}`;
            const res   = await fetch(`${API_BASE}/api/player-characters`);
            const json  = await res.json();
            const entry = (json.characters || []).find(c => c.charId === key);
            const cur   = entry?.data || {};
            await fetch(`${API_BASE}/api/player-characters/${key}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: { ...cur, biblioteca: { componentes: _spellComponentes, hechizos: _spellHechizos } } }),
            });
        } catch(e) { console.error('Error guardando biblioteca:', e); }
    }, 800);
}

async function _spellPickerSave() {
    try {
        const res  = await fetch(`${API_BASE}/api/player-characters`);
        const json = await res.json();
        const bolso    = (json.characters || []).find(c => c.charId === SPELL_BOLSO_KEY);
        const bolsoCur = bolso?.data || {};
        await fetch(`${API_BASE}/api/player-characters/${SPELL_BOLSO_KEY}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { ...bolsoCur, items: _spellInventory } }),
        });
        const bibKey   = `inv_${_spellCharId}`;
        const bibEntry = (json.characters || []).find(c => c.charId === bibKey);
        const bibCur   = bibEntry?.data || {};
        await fetch(`${API_BASE}/api/player-characters/${bibKey}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { ...bibCur, biblioteca: { componentes: _spellComponentes, hechizos: _spellHechizos } } }),
        });
    } catch(e) { console.error('Error guardando biblioteca picker:', e); }
}

// ── Render principal ──────────────────────────────────────────────────────
function _spellRender() {
    const cp = document.getElementById('bibliotecaComponentesPanel');
    const ap = document.getElementById('bibliotecaArcanoPanel');
    if (cp) _renderComponentes(cp);
    if (ap) _renderArcano(ap);
}

// ══════════════════════════════════════════════════════════════════════════
// PANEL: COMPONENTES (con componentes draggables)
// ══════════════════════════════════════════════════════════════════════════
function _renderComponentes(panel) {
    const rows = _spellComponentes.map(m => `
        <div class="fg-mat-row" draggable="true"
             ondragstart="onSpellCompDragStart(event,'${m.id}')"
             ondragend="onSpellCompDragEnd(event)"
             id="spComp_${m.id}">
            <span class="fg-mat-drag-handle" title="Arrastra al Conjurar">⠿</span>
            <span class="fg-mat-emoji">${_spEsc(m.emoji || '💎')}</span>
            <div class="fg-mat-info">
                <span class="fg-mat-name">${_spEsc(m.nombre)}</span>
                ${m.desc ? `<span class="fg-mat-desc">${_spEsc(m.desc)}</span>` : ''}
            </div>
            <div class="fg-mat-qty-wrap">
                <button class="fg-qty-btn" onclick="componentesQty('${m.id}',-1)">−</button>
                <span class="fg-mat-qty">${m.cantidad}</span>
                <button class="fg-qty-btn" onclick="componentesQty('${m.id}',+1)">+</button>
            </div>
            <div class="fg-mat-actions">
                <button class="fg-row-btn fg-btn-return" onclick="componentesReturn('${m.id}')" title="Devolver al Bolso de Hermione">🎒</button>
            </div>
        </div>`).join('');

    panel.innerHTML = `
        <div class="biblio-panel-hdr">
            <span class="biblio-panel-hdr-icon">💎</span>
            <span class="biblio-panel-hdr-title">Componentes Mágicos</span>
        </div>
        <div class="fg-section">
            ${_spellComponentes.length === 0
                ? '<div class="fg-empty">Sin componentes. Añade desde el inventario.</div>'
                : `<div class="fg-mat-list">${rows}</div>`}
        </div>
        <div class="fg-add-wrap" id="componentesAddWrap">
            <button class="fg-add-btn sp-add-btn" onclick="componentesOpenPicker()">🎒 Añadir desde inventario</button>
        </div>`;

    panel.classList.toggle('sp-tab-active', _spellTab === 'componentes');
}

// ── Drag desde Componentes ────────────────────────────────────────────────
function onSpellCompDragStart(event, compId) {
    event.dataTransfer.setData('text/plain', compId);
    event.dataTransfer.effectAllowed = 'copy';
    event.currentTarget.classList.add('fg-dragging');
}
function onSpellCompDragEnd(event) {
    event.currentTarget.classList.remove('fg-dragging');
}

// ── Picker del Bolso de Hermione ──────────────────────────────────────────
function componentesOpenPicker() {
    _spPickerSelected  = new Set();
    _spPickerCatFilter = 'todas';
    const panel = document.getElementById('bibliotecaComponentesPanel');
    if (!panel) return;
    panel.querySelector('#componentesAddWrap')?.remove();
    _appendComponentesPicker(panel);
}

function _appendComponentesPicker(panel) {
    panel.querySelector('.fg-inv-picker')?.remove();
    const catTabs = SPELL_BOLSO_CATS
        .map(c => `<button class="fg-cat-tab${_spPickerCatFilter === c.id ? ' active' : ''}"
            onclick="componentesSetCat('${c.id}')">${c.icon} ${c.label}</button>`)
        .join('');
    const picker = document.createElement('div');
    picker.className = 'fg-inv-picker';
    picker.innerHTML = `
        <div class="fg-inv-picker-hdr">
            <span class="fg-inv-picker-title">🎒 Bolso de Hermione</span>
            <input class="fg-input fg-inv-search" id="componentesPickerSearch" type="search"
                placeholder="Buscar…" oninput="filterComponentesPicker(this.value)" autocomplete="off">
        </div>
        <div class="fg-cat-tabs" id="componentesCatTabs">${catTabs}</div>
        <div class="fg-inv-picker-list" id="componentesPickerList"></div>
        <div class="fg-inv-picker-footer">
            <button class="fg-btn-confirm" id="componentesPickerConfirmBtn" onclick="componentesPickerConfirm()">Añadir seleccionados</button>
            <button class="fg-btn-cancel" onclick="componentesPickerCancel()">Cancelar</button>
        </div>`;
    picker._available = _spellInventory.filter(it => it.nombre);
    panel.appendChild(picker);
    _refreshSpellPickerList();
    picker.querySelector('.fg-inv-search')?.focus();
}

function componentesSetCat(catId) {
    _spPickerCatFilter = catId;
    document.querySelectorAll('#componentesCatTabs .fg-cat-tab').forEach(btn => {
        const m = btn.getAttribute('onclick')?.match(/componentesSetCat\('([^']+)'\)/);
        if (m) btn.classList.toggle('active', m[1] === catId);
    });
    _refreshSpellPickerList();
}

function filterComponentesPicker() { _refreshSpellPickerList(); }

function _refreshSpellPickerList() {
    const search = document.getElementById('componentesPickerSearch')?.value ?? '';
    const picker = document.getElementById('bibliotecaComponentesPanel')?.querySelector('.fg-inv-picker');
    if (!picker) return;
    const q = search.toLowerCase();
    let items = picker._available;
    if (_spPickerCatFilter !== 'todas') items = items.filter(it => (it.categoria || 'otras') === _spPickerCatFilter);
    if (q) items = items.filter(it => it.nombre.toLowerCase().includes(q));
    _renderComponentesPickerList(items, q);
}

function _renderComponentesPickerList(items, query) {
    const list = document.getElementById('componentesPickerList');
    if (!list) return;
    if (!items.length) {
        list.innerHTML = `<div class="fg-picker-empty">${query ? 'Sin resultados' : 'El inventario está vacío'}</div>`;
        return;
    }
    list.innerHTML = items.map(it => {
        const sel = _spPickerSelected.has(it.id);
        let thumb = it.img
            ? `<img src="${_spEsc(it.img)}" alt="" class="fg-inv-thumb-img">`
            : `<span class="fg-inv-thumb-emoji">${_spEsc(it.emoji || '💎')}</span>`;
        const qty = it.cantidad > 1 ? `<span class="fg-inv-qty">×${it.cantidad}</span>` : '';
        return `
        <div class="fg-inv-item${sel ? ' selected' : ''}" data-spiid="${_spEsc(it.id)}" onclick="toggleComponentesPick('${it.id}')">
            <span class="fg-inv-check-icon">${sel ? '☑' : '☐'}</span>
            <div class="fg-inv-thumb">${thumb}</div>
            <div class="fg-inv-info">
                <span class="fg-inv-name">${_spEsc(it.nombre)}${qty}</span>
                ${it.desc ? `<span class="fg-inv-desc">${_spEsc(it.desc)}</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

function toggleComponentesPick(itemId) {
    if (_spPickerSelected.has(itemId)) _spPickerSelected.delete(itemId);
    else                                _spPickerSelected.add(itemId);
    const el = document.querySelector(`[data-spiid="${itemId}"]`);
    if (el) {
        const sel = _spPickerSelected.has(itemId);
        el.classList.toggle('selected', sel);
        const icon = el.querySelector('.fg-inv-check-icon');
        if (icon) icon.textContent = sel ? '☑' : '☐';
    }
    const btn = document.getElementById('componentesPickerConfirmBtn');
    if (btn) {
        const n = _spPickerSelected.size;
        btn.textContent = n > 0 ? `Añadir ${n} objeto${n > 1 ? 's' : ''}` : 'Añadir seleccionados';
    }
}

async function componentesPickerConfirm() {
    if (_spPickerSelected.size === 0) { componentesPickerCancel(); return; }
    const selected = _spellInventory.filter(it => _spPickerSelected.has(it.id));
    _spellComponentes = [..._spellComponentes, ...selected.map(it => ({
        id: _spId(), emoji: it.emoji || '💎', nombre: it.nombre, cantidad: it.cantidad || 1, desc: it.desc || '',
    }))];
    _spellInventory = _spellInventory.filter(it => !_spPickerSelected.has(it.id));
    _spPickerSelected = new Set();
    await _spellPickerSave();
    _renderComponentes(document.getElementById('bibliotecaComponentesPanel'));
}

function componentesPickerCancel() {
    _spPickerSelected = new Set();
    _renderComponentes(document.getElementById('bibliotecaComponentesPanel'));
}

function componentesQty(id, delta) {
    _spellComponentes = _spellComponentes.map(m => m.id === id ? { ...m, cantidad: Math.max(0, (m.cantidad||0) + delta) } : m);
    _spellSched();
    _renderComponentes(document.getElementById('bibliotecaComponentesPanel'));
}

async function componentesReturn(id) {
    const comp = _spellComponentes.find(m => m.id === id);
    if (!comp) return;
    _spellInventory = [..._spellInventory, { id: _spId(), nombre: comp.nombre, emoji: comp.emoji || '💎', cantidad: comp.cantidad || 1, desc: comp.desc || null, categoria: 'componentes', ts: Date.now() }];
    _spellComponentes = _spellComponentes.filter(m => m.id !== id);
    await _spellPickerSave();
    _renderComponentes(document.getElementById('bibliotecaComponentesPanel'));
}

// ══════════════════════════════════════════════════════════════════════════
// PANEL: ARCANO (con sub-tabs Catálogo / Conjurar)
// ══════════════════════════════════════════════════════════════════════════
function arcanoSetSubTab(tab) {
    _arcanoSubTab = tab;
    _renderArcano(document.getElementById('bibliotecaArcanoPanel'));
}

function _renderArcano(panel) {
    const aprendidosCount = _spellInventory.filter(it => it.categoria === 'conjurado').length;
    const badge = aprendidosCount > 0
        ? ` <span class="sp-aprendidos-badge">${aprendidosCount}</span>`
        : '';
    const subTabs = `
    <div class="fg-sub-tabs sp-sub-tabs">
        <button class="fg-sub-tab${_arcanoSubTab==='catalogo'?' active':''}" onclick="arcanoSetSubTab('catalogo')">📖 Catálogo de Hechizos</button>
        <button class="fg-sub-tab${_arcanoSubTab==='conjurar'?' active':''}" onclick="arcanoSetSubTab('conjurar')">🔮 Conjurar</button>
        <button class="fg-sub-tab${_arcanoSubTab==='aprendidos'?' active':''}  sp-aprendidos-tab" onclick="arcanoSetSubTab('aprendidos')">✨ Aprendidos${badge}</button>
    </div>`;

    panel.innerHTML = `
        <div class="biblio-panel-hdr">
            <span class="biblio-panel-hdr-icon">🔮</span>
            <span class="biblio-panel-hdr-title">Arcano</span>
        </div>
        ${subTabs}
        <div id="arcanoSubContent" class="fg-herreria-sub"></div>`;

    if (_arcanoSubTab === 'catalogo')     _renderCatalogoHechizos();
    else if (_arcanoSubTab === 'conjurar') _renderConjurar();
    else                                   _renderAprendidos();

    panel.classList.toggle('sp-tab-active', _spellTab === 'arcano');
}

// ── Sub-tab: Catálogo de Hechizos ─────────────────────────────────────────
function _renderCatalogoHechizos() {
    const sub = document.getElementById('arcanoSubContent');
    if (!sub) return;
    const cards = _spellHechizos.map(h => {
        const compHtml = (h.componentes || []).map(c =>
            `<span class="fg-rec-ing">${_spEsc(c.nombre)} ×${c.cantidad}</span>`).join('');
        const nivelBadge = h.nivel ? `<span class="fg-rec-cd sp-nivel-badge">Nivel ${h.nivel}</span>` : '';
        const escuelaBadge = h.escuela ? `<span class="sp-escuela-badge">${_spEsc(h.escuela)}</span>` : '';
        return `
        <div class="fg-rec-card sp-hechizo-card">
            <div class="fg-rec-hdr">
                <span class="fg-rec-emoji">${_spEsc(h.emoji || '✨')}</span>
                <div class="fg-rec-info">
                    <div class="fg-rec-name">${_spEsc(h.nombre)}</div>
                    ${escuelaBadge}
                    ${h.desc ? `<div class="fg-rec-desc">${_spEsc(h.desc)}</div>` : ''}
                </div>
                <div class="fg-rec-actions">
                    <button class="fg-row-btn fg-btn-edit" onclick="catalogoEdit('${h.id}')" title="Editar">✏️</button>
                    <button class="fg-row-btn fg-btn-del"  onclick="catalogoDel('${h.id}')"  title="Eliminar">✕</button>
                </div>
            </div>
            ${compHtml ? `<div class="fg-rec-ings">${compHtml}</div>` : ''}
            ${nivelBadge ? `<div class="fg-rec-footer">${nivelBadge}<span class="fg-rec-count">Conjurado ${h.conjuradas||0}×</span></div>` : ''}
        </div>`;
    }).join('');

    sub.innerHTML = `
        <div class="fg-section">
            ${_spellHechizos.length === 0
                ? '<div class="fg-empty">Sin hechizos. Añade el primero.</div>'
                : `<div class="fg-rec-list">${cards}</div>`}
        </div>
        <div class="fg-add-wrap" id="catalogoAddWrap">
            <button class="fg-add-btn sp-add-btn" onclick="catalogoShowForm()">+ Añadir hechizo</button>
        </div>
        <div class="fg-form fg-rec-form" id="catalogoForm" style="display:none">
            <div class="fg-form-row">
                <input class="fg-input fg-input-sm" id="catalogoEmoji" placeholder="Emoji" maxlength="4">
                <input class="fg-input" id="catalogoNombre" placeholder="Nombre del hechizo">
                <input class="fg-input fg-input-sm" id="catalogoNivel" type="number" min="0" max="9" placeholder="Nivel">
            </div>
            <div class="fg-form-row">
                <input class="fg-input" id="catalogoEscuela" placeholder="Escuela (Evocación, Ilusión…)">
            </div>
            <input class="fg-input" id="catalogoDesc" placeholder="Descripción (opcional)">
            <div class="fg-ing-section">
                <div class="fg-ing-label">Componentes materiales</div>
                <div id="catalogoComps"></div>
                <button class="fg-add-ing-btn sp-add-ing-btn" onclick="catalogoAddComp()">+ Componente</button>
            </div>
            <input type="hidden" id="catalogoEditId">
            <div class="fg-form-btns">
                <button class="fg-btn-confirm" onclick="catalogoSaveForm()">Guardar</button>
                <button class="fg-btn-cancel"  onclick="catalogoCancelForm()">Cancelar</button>
            </div>
        </div>`;
}

let _catalogoCompCount = 0;

function catalogoShowForm() {
    _catalogoCompCount = 0;
    document.getElementById('catalogoForm').style.display = 'flex';
    document.getElementById('catalogoAddWrap').style.display = 'none';
    document.getElementById('catalogoComps').innerHTML = '';
    document.getElementById('catalogoEmoji').value   = '';
    document.getElementById('catalogoNombre').value  = '';
    document.getElementById('catalogoNivel').value   = '';
    document.getElementById('catalogoEscuela').value = '';
    document.getElementById('catalogoDesc').value    = '';
    document.getElementById('catalogoEditId').value  = '';
    document.getElementById('catalogoNombre').focus();
}

function catalogoEdit(id) {
    const h = _spellHechizos.find(x => x.id === id);
    if (!h) return;
    _catalogoCompCount = 0;
    document.getElementById('catalogoForm').style.display = 'flex';
    document.getElementById('catalogoAddWrap').style.display = 'none';
    document.getElementById('catalogoComps').innerHTML = '';
    document.getElementById('catalogoEmoji').value    = h.emoji   || '';
    document.getElementById('catalogoNombre').value   = h.nombre  || '';
    document.getElementById('catalogoNivel').value    = h.nivel   ?? '';
    document.getElementById('catalogoEscuela').value  = h.escuela || '';
    document.getElementById('catalogoDesc').value     = h.desc    || '';
    document.getElementById('catalogoEditId').value   = id;
    (h.componentes || []).forEach(c => catalogoAddComp(c.nombre, c.cantidad));
    document.getElementById('catalogoNombre').focus();
}

function catalogoAddComp(nombre = '', cantidad = 1) {
    const idx = _catalogoCompCount++;
    const div = document.createElement('div');
    div.className = 'fg-ing-row'; div.id = `spComp${idx}`;
    div.innerHTML = `
        <input class="fg-input" data-ing-nombre placeholder="Componente" value="${_spEsc(nombre)}">
        <input class="fg-input fg-input-sm" data-ing-cant type="number" min="1" value="${cantidad}">
        <button class="fg-row-btn fg-btn-del" onclick="catalogoRemComp(${idx})">✕</button>`;
    document.getElementById('catalogoComps').appendChild(div);
}

function catalogoRemComp(idx) { document.getElementById(`spComp${idx}`)?.remove(); }

function catalogoSaveForm() {
    const nombre = document.getElementById('catalogoNombre').value.trim();
    if (!nombre) { document.getElementById('catalogoNombre').focus(); return; }
    const emoji   = document.getElementById('catalogoEmoji').value.trim() || '✨';
    const nivel   = parseInt(document.getElementById('catalogoNivel').value) ?? null;
    const escuela = document.getElementById('catalogoEscuela').value.trim();
    const desc    = document.getElementById('catalogoDesc').value.trim();
    const editId  = document.getElementById('catalogoEditId').value;
    const comps = [...document.querySelectorAll('#catalogoComps .fg-ing-row')].map(row => ({
        nombre:   row.querySelector('[data-ing-nombre]').value.trim(),
        cantidad: Math.max(1, parseInt(row.querySelector('[data-ing-cant]').value) || 1),
    })).filter(x => x.nombre);
    if (editId) {
        _spellHechizos = _spellHechizos.map(h => h.id === editId ? { ...h, emoji, nombre, nivel, escuela, desc, componentes: comps } : h);
    } else {
        _spellHechizos = [..._spellHechizos, { id: _spId(), emoji, nombre, nivel, escuela, desc, componentes: comps, conjuradas: 0 }];
    }
    _spellSched();
    _renderArcano(document.getElementById('bibliotecaArcanoPanel'));
}

function catalogoCancelForm() {
    document.getElementById('catalogoForm').style.display = 'none';
    document.getElementById('catalogoAddWrap').style.display = 'flex';
}

function catalogoDel(id) {
    _spellHechizos = _spellHechizos.filter(h => h.id !== id);
    if (_conjurarHechizoId === id) { _conjurarHechizoId = null; _conjurarSlots = {}; }
    _spellSched();
    _renderArcano(document.getElementById('bibliotecaArcanoPanel'));
}

// ── Sub-tab: Conjurar ─────────────────────────────────────────────────────
function _renderConjurar() {
    const sub = document.getElementById('arcanoSubContent');
    if (!sub) return;

    if (_spellHechizos.length === 0) {
        sub.innerHTML = '<div class="fg-empty">Aún no tienes hechizos.<br><span style="font-size:11px;opacity:.6">Añádelos en el Catálogo de Hechizos.</span></div>';
        return;
    }

    const options = _spellHechizos.map(h =>
        `<option value="${h.id}"${h.id === _conjurarHechizoId ? ' selected' : ''}>${_spEsc(h.emoji||'✨')} ${_spEsc(h.nombre)}</option>`
    ).join('');

    sub.innerHTML = `
        <div class="fg-forjar-top">
            <label class="fg-forjar-label">Hechizo</label>
            <select class="fg-input fg-forjar-select" onchange="conjurarSelectHechizo(this.value)">
                <option value="">— Elige un hechizo —</option>
                ${options}
            </select>
        </div>
        <div id="conjurarArea"></div>`;

    _renderConjurarArea();
}

function conjurarSelectHechizo(id) {
    _conjurarHechizoId = id || null;
    _conjurarSlots     = {};
    _renderConjurarArea();
}

function _renderConjurarArea() {
    const area = document.getElementById('conjurarArea');
    if (!area) return;
    if (!_conjurarHechizoId) { area.innerHTML = ''; return; }
    const h = _spellHechizos.find(x => x.id === _conjurarHechizoId);
    if (!h) { area.innerHTML = ''; return; }

    const comps = h.componentes || [];
    const slots = comps.map((comp, i) => {
        const slot    = _conjurarSlots[i];
        const mat     = slot ? _spellComponentes.find(m => m.id === slot.compId) : null;
        const enough  = mat && mat.cantidad >= comp.cantidad;
        let filledHtml = '';
        if (slot) {
            filledHtml = `
            <div class="fg-slot-placed">
                <span class="fg-slot-placed-emoji">${_spEsc(slot.emoji)}</span>
                <span class="fg-slot-placed-name">${_spEsc(slot.nombre)}</span>
                ${!enough ? `<span class="fg-slot-warn" title="Cantidad insuficiente">⚠️ ×${mat?.cantidad??0}/${comp.cantidad}</span>` : `<span class="fg-slot-ok">✓ ×${comp.cantidad}</span>`}
            </div>
            <button class="fg-slot-clear" onclick="clearConjurarSlot(${i})" title="Quitar">✕</button>`;
        }
        return `
        <div class="fg-ing-slot${slot ? (enough ? ' filled' : ' filled insufficient') : ''}"
             ondragover="conjurarDragOver(event)"
             ondragleave="conjurarDragLeave(event)"
             ondrop="conjurarDrop(event,${i})">
            <div class="fg-slot-req">
                <span class="fg-slot-req-name">${_spEsc(comp.nombre)}</span>
                <span class="fg-slot-req-qty">×${comp.cantidad}</span>
            </div>
            ${slot ? filledHtml : '<div class="fg-slot-hint">⬇ Arrastra</div>'}
        </div>`;
    }).join('');

    const allReady = comps.length > 0 && comps.every((comp, i) => {
        const slot = _conjurarSlots[i];
        const mat  = slot ? _spellComponentes.find(m => m.id === slot.compId) : null;
        return mat && mat.cantidad >= comp.cantidad;
    });
    const nivelBadge = h.nivel != null ? `<span class="fg-rec-cd sp-nivel-badge">Nivel ${h.nivel}</span>` : '';

    area.innerHTML = `
        <div class="fg-forjar-recipe-hdr">
            <span class="fg-forjar-rec-emoji">${_spEsc(h.emoji||'✨')}</span>
            <div class="fg-forjar-rec-info">
                <div class="fg-forjar-rec-name">${_spEsc(h.nombre)}</div>
                ${h.escuela ? `<div class="fg-rec-desc sp-escuela-inline">${_spEsc(h.escuela)}</div>` : ''}
                ${h.desc ? `<div class="fg-rec-desc">${_spEsc(h.desc)}</div>` : ''}
            </div>
            ${nivelBadge}
        </div>
        ${comps.length === 0
            ? '<div class="fg-empty" style="padding:16px">Este hechizo no requiere componentes materiales.</div>'
            : `<div class="fg-forjar-slots">${slots}</div>`}
        <div class="fg-forjar-footer">
            <span class="fg-rec-count">Conjurado ${h.conjuradas||0}×</span>
            <button class="fg-forge-btn sp-cast-btn${allReady || comps.length === 0 ? '' : ' fg-forge-disabled'}"
                ${allReady || comps.length === 0 ? 'onclick="doConjurar()"' : 'disabled'}
                title="${allReady || comps.length === 0 ? '¡Conjurar!' : 'Arrastra todos los componentes'}">
                🔮 Conjurar
            </button>
        </div>`;
}

// ── Drag & drop sobre slots de componente ─────────────────────────────────
function conjurarDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    event.currentTarget.classList.add('fg-slot-dragover');
}
function conjurarDragLeave(event) {
    event.currentTarget.classList.remove('fg-slot-dragover');
}
function conjurarDrop(event, slotIdx) {
    event.preventDefault();
    event.currentTarget.classList.remove('fg-slot-dragover');
    const compId = event.dataTransfer.getData('text/plain');
    const comp   = _spellComponentes.find(m => m.id === compId);
    if (!comp) return;
    _conjurarSlots[slotIdx] = { compId, nombre: comp.nombre, emoji: comp.emoji || '💎' };
    _renderConjurarArea();
}
function clearConjurarSlot(idx) {
    delete _conjurarSlots[idx];
    _renderConjurarArea();
}

async function doConjurar() {
    const h = _spellHechizos.find(x => x.id === _conjurarHechizoId);
    if (!h) return;

    // Calcular consumo (varios slots pueden usar el mismo componente)
    const consume = {};
    (h.componentes || []).forEach((comp, i) => {
        const slot = _conjurarSlots[i];
        if (!slot) return;
        consume[slot.compId] = (consume[slot.compId] || 0) + comp.cantidad;
    });

    _spellComponentes = _spellComponentes
        .map(m => m.id in consume ? { ...m, cantidad: m.cantidad - consume[m.id] } : m)
        .filter(m => m.cantidad > 0);

    _spellHechizos = _spellHechizos.map(h2 =>
        h2.id === _conjurarHechizoId ? { ...h2, conjuradas: (h2.conjuradas || 0) + 1 } : h2
    );

    // Añadir el hechizo conjurado al Bolso de Hermione
    const conjuredItem = {
        id:        _spId(),
        nombre:    h.nombre,
        emoji:     h.emoji || '✨',
        cantidad:  1,
        desc:      h.desc || null,
        categoria: 'conjurado',
        ts:        Date.now(),
    };
    _spellInventory = [..._spellInventory, conjuredItem];

    _conjurarSlots = {};
    await _spellPickerSave();
    _spellRender();

    // Animación de conjuro → popup de obtención
    _playConjurarAnimation(conjuredItem);
}

// ── Animación de conjuro + popup de obtención ─────────────────────────────
function _playConjurarAnimation(item) {
    const overlay = document.createElement('div');
    overlay.id = 'conjurarVideoOverlay';
    overlay.className = 'spell-video-overlay';
    overlay.innerHTML = `
        <video class="spell-video" id="conjurarVideo" autoplay playsinline muted>
            <source src="assets/videos/spell-cast-animation.mp4" type="video/mp4">
        </video>`;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('spell-video-overlay--visible'));

    const video = document.getElementById('conjurarVideo');

    const finish = () => {
        clearTimeout(fallback);
        overlay.remove();
        _showConjurarObtainedPopup(item);
    };

    const fallback = setTimeout(finish, 12000);

    video.addEventListener('ended', finish, { once: true });
    overlay.addEventListener('click', finish);
}

function _showConjurarObtainedPopup(item) {
    document.getElementById('conjurarObtainedPopup')?.remove();

    const popup = document.createElement('div');
    popup.id = 'conjurarObtainedPopup';
    popup.className = 'spell-obtained-popup';
    popup.innerHTML = `
        <div class="spell-obtained-inner">
            <div class="spell-obtained-sparks" aria-hidden="true">
                ${Array.from({ length: 12 }, (_, i) =>
                    `<span class="sp-spark sp-spark-${i}" style="--i:${i}"></span>`
                ).join('')}
            </div>
            <div class="spell-obtained-icon">${_spEsc(item.emoji)}</div>
            <div class="spell-obtained-label">¡Has conjurado!</div>
            <div class="spell-obtained-name">${_spEsc(item.nombre)}</div>
            <button class="spell-obtained-btn" onclick="document.getElementById('conjurarObtainedPopup').remove()">
                ¡Magnífico!
            </button>
        </div>`;
    document.body.appendChild(popup);

    requestAnimationFrame(() => popup.classList.add('spell-obtained-popup--visible'));

    setTimeout(() => {
        popup.classList.remove('spell-obtained-popup--visible');
        setTimeout(() => popup.remove(), 400);
    }, 6000);
}

// ══════════════════════════════════════════════════════════════════════════
// SUB-TAB: APRENDIDOS — conjuros del Bolso listos para usar en la hoja
// ══════════════════════════════════════════════════════════════════════════
function _renderAprendidos() {
    const sub = document.getElementById('arcanoSubContent');
    if (!sub) return;

    const aprendidos = _spellInventory.filter(it => it.categoria === 'conjurado');

    if (aprendidos.length === 0) {
        sub.innerHTML = `
            <div class="fg-empty">
                Sin conjuros aprendidos en el inventario.<br>
                <span style="font-size:11px;opacity:.6">Conjura hechizos en la pestaña "Conjurar" para que aparezcan aquí.</span>
            </div>`;
        return;
    }

    const cards = aprendidos.map(item => {
        const h          = _spellHechizos.find(x => x.nombre === item.nombre);
        const nivelText  = h?.nivel != null
            ? (h.nivel === 'Truco' ? 'Truco' : h.nivel === 'Esp' ? 'Especial' : `Nivel ${h.nivel}`)
            : '';
        const escuela    = h?.escuela ? ` · ${_spEsc(h.escuela)}` : '';
        const meta       = nivelText ? `<div class="fg-rec-desc sp-aprendido-meta">${nivelText}${escuela}</div>` : '';
        return `
        <div class="fg-rec-card sp-aprendido-card">
            <div class="fg-rec-hdr">
                <span class="fg-rec-emoji">${_spEsc(item.emoji || '✨')}</span>
                <div class="fg-rec-info">
                    <div class="fg-rec-name">${_spEsc(item.nombre)}</div>
                    ${meta}
                    ${item.desc ? `<div class="fg-rec-desc" style="opacity:.6;font-size:11px">${_spEsc(item.desc)}</div>` : ''}
                </div>
                <button class="fg-forge-btn sp-usar-btn" onclick="conjuradoAbrirModal('${_spEsc(item.id)}')">✨ Usar</button>
            </div>
        </div>`;
    }).join('');

    sub.innerHTML = `
        <div class="sp-aprendidos-hint">
            Pulsa <strong>Usar</strong> para añadir el conjuro a la hoja de personaje de Zero.
        </div>
        <div class="fg-section"><div class="fg-rec-list">${cards}</div></div>`;
}

// ── Modal "Usar conjuro" ───────────────────────────────────────────────────
let _conjuradoModalItemId = null;

function conjuradoAbrirModal(itemId) {
    _conjuradoModalItemId = itemId;
    const item = _spellInventory.find(it => it.id === itemId);
    if (!item) return;

    // Pre-fill from hechizo catalog if available
    const h = _spellHechizos.find(x => x.nombre === item.nombre);

    const nivelOptions = ['Truco', 1, 2, 3, 4, 5, 6, 7, 8, 9, 'Esp', 'Reac'].map(v => {
        const label    = v === 'Truco' ? 'Truco' : v === 'Esp' ? 'Especial' : v === 'Reac' ? 'Reacción' : `Nivel ${v}`;
        const selected = (String(h?.nivel) === String(v) || (!h?.nivel && v === 1)) ? ' selected' : '';
        return `<option value="${v}"${selected}>${label}</option>`;
    }).join('');

    document.getElementById('conjuradoUsarModal')?.remove();
    const modal = document.createElement('div');
    modal.id        = 'conjuradoUsarModal';
    modal.className = 'conjurado-modal-overlay';
    modal.innerHTML = `
        <div class="conjurado-modal">
            <div class="conjurado-modal-hdr">
                <span>${_spEsc(item.emoji || '✨')} Añadir a la hoja de Zero</span>
                <button class="conjurado-close-btn" onclick="document.getElementById('conjuradoUsarModal').remove()">✕</button>
            </div>
            <div class="conjurado-modal-body">
                <div class="conjurado-row">
                    <div class="conjurado-field" style="flex:1">
                        <label class="conjurado-label">Nombre</label>
                        <input id="cuNombre" class="fg-input" value="${_spEsc(item.nombre)}" placeholder="Nombre del conjuro">
                    </div>
                    <div class="conjurado-field" style="flex:0 0 148px">
                        <label class="conjurado-label">Nivel</label>
                        <select id="cuNivel" class="fg-input">${nivelOptions}</select>
                    </div>
                </div>
                <div class="conjurado-row">
                    <div class="conjurado-field">
                        <label class="conjurado-label">Tirada de ataque <span class="conjurado-hint">(opcional)</span></label>
                        <input id="cuAtk" class="fg-input fg-input-sm" placeholder="ej: 1d20+7">
                    </div>
                    <div class="conjurado-field">
                        <label class="conjurado-label">Dado de daño <span class="conjurado-hint">(opcional)</span></label>
                        <input id="cuDado" class="fg-input fg-input-sm" placeholder="ej: 2d6">
                    </div>
                    <div class="conjurado-field">
                        <label class="conjurado-label">Tipo de daño <span class="conjurado-hint">(opcional)</span></label>
                        <input id="cuTipoDano" class="fg-input fg-input-sm" placeholder="ej: necrótico">
                    </div>
                </div>
                <div class="conjurado-field">
                    <label class="conjurado-label">Descripción</label>
                    <textarea id="cuDesc" class="fg-input conjurado-textarea" rows="4"
                        placeholder="Descripción del conjuro, efectos, alcance…">${_spEsc(item.desc || h?.desc || '')}</textarea>
                </div>
                ${h?.escuela ? `<div class="conjurado-escuela">📚 Escuela: ${_spEsc(h.escuela)}</div>` : ''}
                <div class="conjurado-note">Este conjuro se eliminará del inventario y quedará en la hoja de personaje.</div>
            </div>
            <div class="conjurado-modal-footer">
                <button class="fg-btn-confirm" onclick="_conjuradoConfirmar()">✨ Añadir a hoja de personaje</button>
                <button class="fg-btn-cancel" onclick="document.getElementById('conjuradoUsarModal').remove()">Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('conjurado-modal-overlay--visible'));
}

async function _conjuradoConfirmar() {
    const nombre   = document.getElementById('cuNombre')?.value.trim();
    const nivelRaw = document.getElementById('cuNivel')?.value;
    const atk      = document.getElementById('cuAtk')?.value.trim();
    const dado     = document.getElementById('cuDado')?.value.trim();
    const tipoDano = document.getElementById('cuTipoDano')?.value.trim();
    const desc     = document.getElementById('cuDesc')?.value.trim();

    if (!nombre) { document.getElementById('cuNombre')?.focus(); return; }

    const nivel = (nivelRaw === 'Truco' || nivelRaw === 'Esp' || nivelRaw === 'Reac')
        ? nivelRaw
        : parseInt(nivelRaw) || 1;

    // Attach a stable ID so we can deduplicate on page reload
    const spell = { nombre, nivel, desc: desc || '', _extraId: _conjuradoModalItemId };
    if (atk)      spell.atk       = atk;
    if (dado)     spell.dado      = dado;
    if (tipoDano) spell.tipo_dano = tipoDano;

    // Add to Zero's character sheet in memory (immediate effect)
    const charData = window.characterData?.['Zero'];
    if (!charData) { showNotification('❌ Datos de Zero no disponibles', 2500); return; }
    if (!Array.isArray(charData.conjuros)) charData.conjuros = [];
    charData.conjuros = [...charData.conjuros, spell];

    // Remove from Bolso de Hermione
    const usedItemId = _conjuradoModalItemId;
    _spellInventory  = _spellInventory.filter(it => it.id !== usedItemId);
    _conjuradoModalItemId = null;

    // Close modal
    document.getElementById('conjuradoUsarModal')?.remove();

    // Persist: extraConjuros in DB + bolso
    await Promise.all([
        _conjuradoSaveExtraConjuro(spell),
        _spellPickerSave(),
    ]);

    _renderArcano(document.getElementById('bibliotecaArcanoPanel'));
    showNotification(`✨ ${nombre} añadido a la hoja de Zero`, 2500);
}

async function _conjuradoSaveExtraConjuro(spell) {
    try {
        const res   = await fetch(`${API_BASE}/api/player-characters`);
        const json  = await res.json();
        const entry = (json.characters || []).find(c => c.charId === 'Zero');
        const cur   = entry?.data || {};
        const extra = Array.isArray(cur.extraConjuros) ? [...cur.extraConjuros] : [];
        if (!extra.find(e => e._extraId === spell._extraId)) extra.push(spell);
        await fetch(`${API_BASE}/api/player-characters/Zero`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ data: { ...cur, extraConjuros: extra } }),
        });
    } catch (e) {
        console.error('[biblioteca] Error guardando extraConjuro de Zero:', e);
    }
}
