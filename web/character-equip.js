'use strict';
/* ─── Character Equipment Panel ─────────────────────────────────────────────
 *  8 fixed armadura slots + 8 fixed armas slots.
 *  Click empty slot → inventory picker.  Click item → assign.
 *  State: equip.armadura / equip.armas  =  string[8]  (item id or null)
 * ─────────────────────────────────────────────────────────────────────────── */

let _equipDialog    = null;
let _equipCharId    = null;
let _equipItems     = [];
let _equip          = { armadura: _emptySlots(), armas: _emptySlots() };
let _equipSaveTimer = null;
let _pickerTarget   = null;   // { slot, index }

function _emptySlots() { return Array(8).fill(null); }

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
            <div class="eq-body" id="equipBody">
                <div class="eq-loading">Cargando inventario…</div>
            </div>
        </div>
    `;
    dlg.addEventListener('click', e => {
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
            dlg.close();
        }
    });
    document.body.appendChild(dlg);
    _equipDialog = dlg;
}

// ── Data loading ──────────────────────────────────────────────────────────
async function _loadData() {
    document.getElementById('equipBody').innerHTML = '<div class="eq-loading">Cargando…</div>';
    try {
        const res   = await fetch(`${API_BASE}/api/player-characters`);
        const json  = await res.json();
        const entry = (json.characters || []).find(c => c.charId === _equipCharId);
        _equipItems = entry?.data?.items ?? [];
        const saved = entry?.data?.equip ?? {};
        _equip = {
            armadura: _normalizeSlots(saved.armadura),
            armas:    _normalizeSlots(saved.armas),
        };
    } catch (e) {
        _equipItems = [];
        _equip = { armadura: _emptySlots(), armas: _emptySlots() };
    }
    _render();
}

function _normalizeSlots(arr) {
    const out = _emptySlots();
    if (!Array.isArray(arr)) return out;
    // support old flat-id format (pre-slot migration): just fill from index 0
    arr.slice(0, 8).forEach((v, i) => { out[i] = v || null; });
    return out;
}

// ── Render ────────────────────────────────────────────────────────────────
function _render() {
    document.getElementById('equipBody').innerHTML =
        _renderSection('armadura', '🛡️ Armadura') +
        _renderSection('armas',    '⚔️ Armas') +
        `<div class="eq-detail-bar" id="equipDetailBar" style="display:none">
            <div class="eq-detail-thumb" id="equipDetailThumb"></div>
            <div class="eq-detail-info">
                <div class="eq-detail-name" id="equipDetailName"></div>
                <div class="eq-detail-desc" id="equipDetailDesc"></div>
            </div>
            <button class="eq-detail-close" onclick="closeEquipDetail()">✕</button>
        </div>`;
}

function _renderSection(slot, label) {
    const slots = _equip[slot];
    const filled = slots.filter(Boolean).length;
    const grid = slots.map((itemId, i) => _renderSlot(slot, i, itemId)).join('');
    return `
    <div class="eq-section">
        <div class="eq-section-hdr">
            <span class="eq-section-label">${label}</span>
            <span class="eq-section-count${filled >= 8 ? ' full' : ''}">${filled} / 8</span>
        </div>
        <div class="eq-slots-grid" id="eq-grid-${slot}">${grid}</div>
    </div>`;
}

function _renderSlot(slot, index, itemId) {
    if (!itemId) {
        return `
        <div class="eq-slot empty" onclick="openSlotPicker('${slot}',${index})" title="Asignar objeto">
            <div class="eq-slot-plus">+</div>
            <div class="eq-slot-num">${index + 1}</div>
        </div>`;
    }
    const it = _equipItems.find(x => x.id === itemId);
    if (!it) {
        // item was deleted from inventory — render as empty
        return `
        <div class="eq-slot empty" onclick="openSlotPicker('${slot}',${index})" title="Asignar objeto">
            <div class="eq-slot-plus">+</div>
            <div class="eq-slot-num">${index + 1}</div>
        </div>`;
    }

    let thumb;
    if (it.img)        thumb = `<img src="${it.img}" alt="" class="eq-slot-img">`;
    else if (it.emoji) thumb = `<span class="eq-slot-emoji">${_esc(it.emoji)}</span>`;
    else               thumb = `<span class="eq-slot-emoji">📦</span>`;

    const hasDesc = !!it.desc;

    return `
    <div class="eq-slot filled" title="${_esc(it.nombre)}">
        <div class="eq-slot-thumb-wrap" onclick="openSlotPicker('${slot}',${index})">${thumb}</div>
        <div class="eq-slot-name">${_esc(it.nombre)}</div>
        <div class="eq-slot-actions">
            ${hasDesc ? `<button class="eq-slot-btn eq-slot-info" onclick="showEquipDetail('${itemId}',event)" title="Ver descripción">i</button>` : ''}
            <button class="eq-slot-btn eq-slot-del" onclick="clearSlot('${slot}',${index},event)" title="Quitar">✕</button>
        </div>
    </div>`;
}

// ── Slot interactions ─────────────────────────────────────────────────────
function clearSlot(slot, index, event) {
    event.stopPropagation();
    _equip[slot][index] = null;
    _refreshSection(slot);
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

function _refreshSection(slot) {
    const grid = document.getElementById(`eq-grid-${slot}`);
    if (!grid) { _render(); return; }
    grid.innerHTML = _equip[slot].map((id, i) => _renderSlot(slot, i, id)).join('');
    // update count label
    const filled = _equip[slot].filter(Boolean).length;
    const hdr = grid.closest('.eq-section')?.querySelector('.eq-section-count');
    if (hdr) { hdr.textContent = `${filled} / 8`; hdr.classList.toggle('full', filled >= 8); }
}

// ── Picker ────────────────────────────────────────────────────────────────
function openSlotPicker(slot, index) {
    _pickerTarget = { slot, index };
    closeEquipDetail();

    const body = document.getElementById('equipBody');
    // remove existing picker if any
    body.querySelector('.eq-picker')?.remove();

    const picker = document.createElement('div');
    picker.className = 'eq-picker';
    picker.id = 'equipPicker';
    picker.innerHTML = `
        <div class="eq-picker-hdr">
            <span class="eq-picker-title">Seleccionar objeto</span>
            <input class="eq-picker-search" type="search" placeholder="Buscar…"
                oninput="filterEquipPicker(this.value)" autocomplete="off">
            <button class="eq-picker-close" onclick="closeEquipPicker()">✕</button>
        </div>
        <div class="eq-picker-list" id="equipPickerList"></div>
    `;
    body.appendChild(picker);
    filterEquipPicker('');
    picker.querySelector('.eq-picker-search').focus();
}

function filterEquipPicker(query) {
    const q   = query.toLowerCase();
    const list = document.getElementById('equipPickerList');
    if (!list) return;

    const filtered = q
        ? _equipItems.filter(it => it.nombre.toLowerCase().includes(q))
        : [..._equipItems];

    if (!filtered.length) {
        list.innerHTML = `<div class="eq-picker-empty">${q ? 'Sin resultados' : 'El inventario está vacío'}</div>`;
        return;
    }

    list.innerHTML = filtered.map(it => {
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
    const { slot, index } = _pickerTarget;
    _equip[slot][index] = itemId;
    closeEquipPicker();
    _refreshSection(slot);
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
