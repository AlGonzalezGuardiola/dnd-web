'use strict';
/* ─── Character Equipment Panel ─────────────────────────────────────────────
 *  Armadura: slots by body part (Cabeza×1, Cuello×1, Torso×1, Brazos×2,
 *            Piernas×1, Pies×1, Dedos×3) — only items with matching subclase
 *  Armas:    8 generic slots — any item
 * ─────────────────────────────────────────────────────────────────────────── */

const ARMOR_SLOTS = [
    { id: 'cabeza',  label: 'Cabeza',  icon: '🪖', max: 1 },
    { id: 'cuello',  label: 'Cuello',  icon: '📿', max: 1 },
    { id: 'torso',   label: 'Torso',   icon: '👕', max: 1 },
    { id: 'brazos',  label: 'Brazos',  icon: '💪', max: 2 },
    { id: 'piernas', label: 'Piernas', icon: '🦵', max: 1 },
    { id: 'pies',    label: 'Pies',    icon: '👟', max: 1 },
    { id: 'dedos',   label: 'Dedos',   icon: '💍', max: 3 },
];

let _equipDialog    = null;
let _equipCharId    = null;
let _equipItems     = [];
let _equip          = _freshEquip();
let _equipSaveTimer = null;
let _pickerTarget   = null;   // { section:'armadura'|'armas', partId?:'cabeza'…, index:0… }

function _freshEquip() {
    const armadura = {};
    ARMOR_SLOTS.forEach(s => { armadura[s.id] = Array(s.max).fill(null); });
    return { armadura, armas: Array(8).fill(null) };
}

// ── Public entry point ────────────────────────────────────────────────────
function openEquipPanel(charId, charName) {
    _equipCharId = `inv_${charId}`;
    _ensureDialog(charName);
    _equipDialog.showModal();
    _loadData();
}

// ── Dialog bootstrap ──────────────────────────────────────────────────────
function _ensureDialog(charName) {
    if (_equipDialog) {
        _equipDialog.querySelector('.eq-title').textContent = charName;
        return;
    }
    const dlg = document.createElement('dialog');
    dlg.id = 'equipDialog';
    dlg.className = 'equip-dialog';
    dlg.innerHTML = `
        <div class="eq-inner">
            <div class="eq-hdr">
                <div class="eq-hdr-left">
                    <span class="eq-hdr-icon">⚔️</span>
                    <div>
                        <div class="eq-label">Equipamiento</div>
                        <div class="eq-title">${_esc(charName)}</div>
                    </div>
                </div>
                <button class="eq-close" onclick="document.getElementById('equipDialog').close()">✕</button>
            </div>
            <div class="eq-body" id="equipBody"></div>
        </div>`;
    dlg.addEventListener('click', e => {
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            dlg.close();
    });
    document.body.appendChild(dlg);
    _equipDialog = dlg;
}

// ── Data loading ──────────────────────────────────────────────────────────
async function _loadData() {
    document.getElementById('equipBody').innerHTML = '<div class="eq-loading">Cargando inventario…</div>';
    try {
        const res   = await fetch(`${API_BASE}/api/player-characters`);
        const json  = await res.json();
        const entry = (json.characters || []).find(c => c.charId === _equipCharId);
        _equipItems = entry?.data?.items ?? [];
        _equip = _normalizeEquip(entry?.data?.equip);
    } catch (e) {
        _equipItems = [];
        _equip = _freshEquip();
    }
    _render();
}

function _normalizeEquip(saved) {
    const out = _freshEquip();
    // Armadura — new keyed format
    if (saved?.armadura && !Array.isArray(saved.armadura)) {
        ARMOR_SLOTS.forEach(s => {
            const src = saved.armadura[s.id];
            if (Array.isArray(src)) {
                src.slice(0, s.max).forEach((v, i) => { out.armadura[s.id][i] = v || null; });
            }
        });
    }
    // Armas
    if (Array.isArray(saved?.armas)) {
        saved.armas.slice(0, 8).forEach((v, i) => { out.armas[i] = v || null; });
    }
    return out;
}

// ── Render ────────────────────────────────────────────────────────────────
function _render() {
    document.getElementById('equipBody').innerHTML =
        _renderArmorSection() +
        _renderWeaponsSection() +
        `<div class="eq-detail-bar" id="equipDetailBar" style="display:none">
            <div class="eq-detail-thumb" id="equipDetailThumb"></div>
            <div class="eq-detail-info">
                <div class="eq-detail-name" id="equipDetailName"></div>
                <div class="eq-detail-desc" id="equipDetailDesc"></div>
            </div>
            <button class="eq-detail-close" onclick="closeEquipDetail()">✕</button>
        </div>`;
}

// ── Armor section (body-part rows) ────────────────────────────────────────
function _renderArmorSection() {
    const rows = ARMOR_SLOTS.map(s => {
        const slots = _equip.armadura[s.id];
        const cards = slots.map((itemId, idx) => _renderBodySlot(s.id, idx, itemId)).join('');
        return `
        <div class="eq-body-row">
            <div class="eq-body-label">
                <span class="eq-body-icon">${s.icon}</span>
                <span>${s.label}</span>
            </div>
            <div class="eq-body-slots">${cards}</div>
        </div>`;
    }).join('');

    return `
    <div class="eq-section">
        <div class="eq-section-hdr">
            <span class="eq-section-label">🛡️ Armadura</span>
        </div>
        <div class="eq-armor-grid">${rows}</div>
    </div>`;
}

function _renderBodySlot(partId, index, itemId) {
    if (!itemId) {
        return `<div class="eq-slot empty" onclick="openSlotPicker('armadura','${partId}',${index})" title="Asignar objeto">
            <div class="eq-slot-plus">+</div>
        </div>`;
    }
    return _renderFilledSlot('armadura', partId, index, itemId);
}

// ── Weapons section (4×2 grid) ────────────────────────────────────────────
function _renderWeaponsSection() {
    const cards = _equip.armas.map((itemId, idx) =>
        itemId
            ? _renderFilledSlot('armas', null, idx, itemId)
            : `<div class="eq-slot empty" onclick="openSlotPicker('armas',null,${idx})" title="Asignar objeto">
                <div class="eq-slot-plus">+</div>
                <div class="eq-slot-num">${idx + 1}</div>
               </div>`
    ).join('');

    return `
    <div class="eq-section">
        <div class="eq-section-hdr">
            <span class="eq-section-label">⚔️ Armas</span>
        </div>
        <div class="eq-slots-grid">${cards}</div>
    </div>`;
}

// ── Shared: filled slot card ──────────────────────────────────────────────
function _renderFilledSlot(section, partId, index, itemId) {
    const it = _equipItems.find(x => x.id === itemId);
    // if item was deleted from inventory, show as empty
    if (!it) {
        const onclick = section === 'armas'
            ? `openSlotPicker('armas',null,${index})`
            : `openSlotPicker('armadura','${partId}',${index})`;
        return `<div class="eq-slot empty" onclick="${onclick}" title="Asignar objeto">
            <div class="eq-slot-plus">+</div>
        </div>`;
    }

    let thumb;
    if (it.img)        thumb = `<img src="${it.img}" alt="" class="eq-slot-img">`;
    else if (it.emoji) thumb = `<span class="eq-slot-emoji">${_esc(it.emoji)}</span>`;
    else               thumb = `<span class="eq-slot-emoji">📦</span>`;

    const clearFn = section === 'armas'
        ? `clearSlot('armas',null,${index},event)`
        : `clearSlot('armadura','${partId}',${index},event)`;
    const changeFn = section === 'armas'
        ? `openSlotPicker('armas',null,${index})`
        : `openSlotPicker('armadura','${partId}',${index})`;
    const infoBtn = it.desc
        ? `<button class="eq-slot-btn eq-slot-info" onclick="showEquipDetail('${itemId}',event)" title="Ver descripción">i</button>`
        : '';

    return `
    <div class="eq-slot filled" title="${_esc(it.nombre)}">
        <div class="eq-slot-thumb-wrap" onclick="${changeFn}">${thumb}</div>
        <div class="eq-slot-name">${_esc(it.nombre)}</div>
        <div class="eq-slot-actions">
            ${infoBtn}
            <button class="eq-slot-btn eq-slot-del" onclick="${clearFn}" title="Quitar">✕</button>
        </div>
    </div>`;
}

// ── Slot interactions ─────────────────────────────────────────────────────
function clearSlot(section, partId, index, event) {
    event.stopPropagation();
    if (section === 'armas') _equip.armas[index] = null;
    else _equip.armadura[partId][index] = null;
    _render();
    _scheduleSave();
}

function showEquipDetail(itemId, event) {
    event.stopPropagation();
    const it = _equipItems.find(x => x.id === itemId);
    if (!it) return;
    let thumb;
    if (it.img)        thumb = `<img src="${it.img}" alt="" class="eq-detail-img">`;
    else if (it.emoji) thumb = `<span class="eq-detail-emoji">${_esc(it.emoji)}</span>`;
    else               thumb = `<span class="eq-detail-emoji">📦</span>`;
    document.getElementById('equipDetailThumb').innerHTML = thumb;
    document.getElementById('equipDetailName').textContent = it.nombre;
    document.getElementById('equipDetailDesc').textContent = it.desc || '';
    document.getElementById('equipDetailBar').style.display = 'flex';
}

function closeEquipDetail() {
    const bar = document.getElementById('equipDetailBar');
    if (bar) bar.style.display = 'none';
}

// ── Picker ────────────────────────────────────────────────────────────────
function openSlotPicker(section, partId, index) {
    _pickerTarget = { section, partId, index };
    closeEquipDetail();
    document.getElementById('equipBody').querySelector('.eq-picker')?.remove();

    // Filter inventory: armor slots only show matching armadura+subclase items;
    // weapon slots show all items (excluding armadura if you prefer, but allow all)
    let eligible;
    if (section === 'armadura') {
        eligible = _equipItems.filter(it => it.categoria === 'armadura' && it.subclase === partId);
    } else {
        eligible = [..._equipItems];
    }

    const title = section === 'armadura'
        ? `${ARMOR_SLOTS.find(s => s.id === partId)?.icon || ''} ${ARMOR_SLOTS.find(s => s.id === partId)?.label || ''}`
        : '⚔️ Arma';

    const picker = document.createElement('div');
    picker.className = 'eq-picker';
    picker.id = 'equipPicker';
    picker.innerHTML = `
        <div class="eq-picker-hdr">
            <span class="eq-picker-title">${title}</span>
            <input class="eq-picker-search" type="search" placeholder="Buscar…"
                oninput="filterEquipPicker(this.value)" autocomplete="off">
            <button class="eq-picker-close" onclick="closeEquipPicker()">✕</button>
        </div>
        <div class="eq-picker-list" id="equipPickerList"></div>
    `;
    document.getElementById('equipBody').appendChild(picker);
    _renderPickerList(eligible, '');
    picker.querySelector('.eq-picker-search').focus();

    // store eligible for filtering
    picker._eligible = eligible;
}

function filterEquipPicker(query) {
    const picker = document.getElementById('equipPicker');
    if (!picker) return;
    const eligible = picker._eligible || _equipItems;
    const q = query.toLowerCase();
    _renderPickerList(q ? eligible.filter(it => it.nombre.toLowerCase().includes(q)) : eligible, q);
}

function _renderPickerList(items, query) {
    const list = document.getElementById('equipPickerList');
    if (!list) return;
    if (!items.length) {
        const msg = query
            ? 'Sin resultados'
            : (_pickerTarget?.section === 'armadura'
                ? 'No hay objetos de armadura con este subtipo en tu inventario.<br><span style="font-size:11px;opacity:.7">Añade objetos con categoría Armadura y el subtipo correspondiente en tu inventario personal.</span>'
                : 'El inventario está vacío');
        list.innerHTML = `<div class="eq-picker-empty">${msg}</div>`;
        return;
    }
    list.innerHTML = items.map(it => {
        let thumb;
        if (it.img)        thumb = `<img src="${it.img}" alt="" class="eq-picker-img">`;
        else if (it.emoji) thumb = `<span class="eq-picker-emoji">${_esc(it.emoji)}</span>`;
        else               thumb = `<span class="eq-picker-emoji">📦</span>`;
        const qty  = it.cantidad > 1 ? ` <span class="eq-picker-qty">×${it.cantidad}</span>` : '';
        const desc = it.desc ? `<div class="eq-picker-desc">${_esc(it.desc)}</div>` : '';
        return `
        <div class="eq-picker-item" onclick="assignSlot('${it.id}')">
            <div class="eq-picker-thumb">${thumb}</div>
            <div class="eq-picker-info">
                <div class="eq-picker-name">${_esc(it.nombre)}${qty}</div>
                ${desc}
            </div>
        </div>`;
    }).join('');
}

function assignSlot(itemId) {
    if (!_pickerTarget) return;
    const { section, partId, index } = _pickerTarget;
    if (section === 'armas') _equip.armas[index] = itemId;
    else _equip.armadura[partId][index] = itemId;
    closeEquipPicker();
    _render();
    _scheduleSave();
}

function closeEquipPicker() {
    document.getElementById('equipPicker')?.remove();
    _pickerTarget = null;
}

// ── Persistence ───────────────────────────────────────────────────────────
function _scheduleSave() {
    clearTimeout(_equipSaveTimer);
    _equipSaveTimer = setTimeout(_save, 800);
}

async function _save() {
    try {
        await fetch(`${API_BASE}/api/player-characters/${_equipCharId}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ data: { items: _equipItems, equip: _equip } }),
        });
    } catch (e) {
        console.error('Error guardando equipamiento:', e);
    }
}

function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
