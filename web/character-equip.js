'use strict';
/* ─── Character Equipment Panel ─────────────────────────────────────────────
 *  Opens a modal from the character sheet to mark inventory items as equipped
 *  in one of two slots:  armadura (max 8)  |  armas (max 8)
 *  State is persisted to /api/player-characters/inv_<charId> as data.equip
 * ─────────────────────────────────────────────────────────────────────────── */

let _equipDialog    = null;
let _equipCharId    = null;   // "inv_<charId>" — key in player-characters API
let _equipItems     = [];     // current inventory items loaded from API
let _equip          = { armadura: [], armas: [] };
let _equipSaveTimer = null;

// ── Public entry point ────────────────────────────────────────────────────
function openEquipPanel(charId, charName) {
    _equipCharId = `inv_${charId}`;
    _ensureDialog(charName);
    _equipDialog.showModal();
    _loadData();
}

// ── Dialog bootstrap (created once, reused) ───────────────────────────────
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
    // close on backdrop click
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
        _equip = {
            armadura: [...(entry?.data?.equip?.armadura ?? [])],
            armas:    [...(entry?.data?.equip?.armas    ?? [])],
        };
    } catch (e) {
        _equipItems = [];
        _equip = { armadura: [], armas: [] };
    }
    _render();
}

// ── Render ────────────────────────────────────────────────────────────────
function _render() {
    const body = document.getElementById('equipBody');
    if (!_equipItems.length) {
        body.innerHTML = `
            <div class="eq-empty">
                <div class="eq-empty-ico">🎒</div>
                <div>El inventario está vacío.</div>
                <div class="eq-empty-hint">Añade objetos en tu inventario personal primero.</div>
            </div>`;
        return;
    }
    body.innerHTML =
        _renderSection('armadura', '🛡️ Armadura') +
        _renderSection('armas',    '⚔️ Armas');
}

function _renderSection(slot, label) {
    const MAX     = 8;
    const equipped = _equip[slot];
    const count   = equipped.length;

    // Sort: equipped first, then rest alphabetically
    const sorted = [..._equipItems].sort((a, b) => {
        const aE = equipped.includes(a.id);
        const bE = equipped.includes(b.id);
        if (aE && !bE) return -1;
        if (!aE && bE) return  1;
        return a.nombre.localeCompare(b.nombre);
    });

    const rows = sorted.map(it => {
        const isEquipped = equipped.includes(it.id);
        const maxReached = !isEquipped && count >= MAX;

        let thumb;
        if (it.img)   thumb = `<img src="${it.img}" alt="" class="eq-item-img">`;
        else if (it.emoji) thumb = `<span class="eq-item-emoji">${_esc(it.emoji)}</span>`;
        else               thumb = `<span class="eq-item-emoji">📦</span>`;

        const qtyLabel = it.cantidad > 1 ? `<span class="eq-item-qty">×${it.cantidad}</span>` : '';

        return `
        <div class="eq-item${isEquipped ? ' equipped' : ''}${maxReached ? ' maxed' : ''}"
             onclick="${maxReached ? '' : `toggleEquipSlot('${it.id}','${slot}')`}"
             title="${maxReached ? `Máximo ${MAX} objetos` : (isEquipped ? 'Quitar del equipamiento' : 'Equipar')}">
            <div class="eq-item-thumb">${thumb}</div>
            <div class="eq-item-name">${_esc(it.nombre)}${qtyLabel}</div>
            <div class="eq-check">${isEquipped ? '✓' : maxReached ? '—' : '+'}</div>
        </div>`;
    }).join('');

    return `
    <div class="eq-section">
        <div class="eq-section-hdr">
            <span class="eq-section-label">${label}</span>
            <span class="eq-section-count${count >= MAX ? ' full' : ''}">${count} / ${MAX}</span>
        </div>
        <div class="eq-list">${rows}</div>
    </div>`;
}

// ── Toggle ────────────────────────────────────────────────────────────────
function toggleEquipSlot(itemId, slot) {
    const arr = _equip[slot];
    const idx = arr.indexOf(itemId);
    if (idx >= 0) {
        arr.splice(idx, 1);
    } else {
        if (arr.length >= 8) return;
        arr.push(itemId);
    }
    _render();
    _scheduleSave();
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

// ── Util ──────────────────────────────────────────────────────────────────
function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
