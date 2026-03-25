// ============================================================
// encounters.js — Gestor de Encuentros de Combate
// ============================================================
// localStorage key: 'dnd_encounters'
// Data shape: [{ id, name, creatures, roundIndex, turnIndex }]
// Creature shape: { id, name, type, hp, maxHp, initiative, conditions, notes }

(function () {
    'use strict';

    const STORAGE_KEY = 'dnd_encounters';
    const CONDITIONS = ['Aturdido', 'Envenenado', 'Paralizado', 'Asustado', 'Encantado', 'Cegado', 'Derribado', 'Incapacitado', 'Concentración'];

    let encounters = [];      // full list
    let currentEncId = null;  // currently open encounter id

    // ── Persistence ──────────────────────────────────────────
    function load() {
        try {
            encounters = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            encounters = [];
        }
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(encounters));
    }

    // ── Helpers ───────────────────────────────────────────────
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function getEncounter(id) {
        return encounters.find(e => e.id === id) || null;
    }

    function hpClass(hp, max) {
        if (hp <= 0) return 'low';
        if (hp / max <= 0.4) return 'low';
        if (hp / max <= 0.65) return 'mid';
        return '';
    }

    // ── Public entry point ────────────────────────────────────
    window.openEncounters = function () {
        load();
        setView('encounters');
        encShowList();
    };

    // ── List view ─────────────────────────────────────────────
    window.encShowList = function () {
        document.getElementById('encListView').style.display = 'block';
        document.getElementById('encDetailView').style.display = 'none';
        currentEncId = null;
        renderList();
        if (typeof renderCombatTemplatesList === 'function') renderCombatTemplatesList();
    };

    function renderList() {
        const container = document.getElementById('encList');
        const empty = document.getElementById('encListEmpty');
        if (!container) return;

        // Remove old items (keep the empty placeholder)
        [...container.querySelectorAll('.encounter-list-item')].forEach(el => el.remove());

        if (encounters.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';

        encounters.forEach(enc => {
            const div = document.createElement('div');
            div.className = 'encounter-list-item';
            div.dataset.id = enc.id;
            div.innerHTML = `
                <span class="enc-name">${enc.name}</span>
                <span class="enc-meta">${enc.creatures.length} criaturas · Ronda ${enc.roundIndex || 1}</span>
                <div class="enc-actions">
                    <button class="btn-combat-secondary" style="padding:6px 12px;font-size:13px" title="Abrir" onclick="encOpenDetail('${enc.id}')">Abrir</button>
                    <button class="btn-danger" style="padding:6px 12px;font-size:13px" title="Eliminar" onclick="encDeleteById(event,'${enc.id}')">🗑</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    window.encCreateSubmit = function (e) {
        e.preventDefault();
        const input = document.getElementById('encNewName');
        const name = (input.value || '').trim();
        if (!name) return;
        const enc = { id: uid(), name, creatures: [], roundIndex: 1, turnIndex: 0 };
        encounters.unshift(enc);
        save();
        input.value = '';
        encOpenDetail(enc.id);
    };

    window.encDeleteById = function (e, id) {
        e.stopPropagation();
        encounters = encounters.filter(enc => enc.id !== id);
        save();
        renderList();
    };

    // ── Detail view ───────────────────────────────────────────
    window.encOpenDetail = function (id) {
        load(); // refresh in case of external change
        const enc = getEncounter(id);
        if (!enc) return;
        currentEncId = id;
        document.getElementById('encListView').style.display = 'none';
        document.getElementById('encDetailView').style.display = 'block';
        renderDetail();
    };

    function renderDetail() {
        const enc = getEncounter(currentEncId);
        if (!enc) return;

        document.getElementById('encDetailTitle').textContent = enc.name;
        document.getElementById('encRoundCounter').textContent = `Ronda ${enc.roundIndex || 1}`;

        const turnBadge = document.getElementById('encTurnBadge');
        turnBadge.style.display = enc.creatures.length > 0 ? 'inline' : 'none';

        renderCreatures(enc);
    }

    function renderCreatures(enc) {
        const list = document.getElementById('encCreatureList');
        if (!list) return;
        list.innerHTML = '';

        if (enc.creatures.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px 0;">Sin criaturas. Añade la primera arriba.</p>';
            return;
        }

        enc.creatures.forEach((c, idx) => {
            const isCurrent = idx === enc.turnIndex;
            const div = document.createElement('div');
            div.className = 'creature-card' + (isCurrent ? ' current-turn' : '') + ` type-${c.type}`;
            div.dataset.cid = c.id;

            const conditions = CONDITIONS.map(cond => {
                const active = (c.conditions || []).includes(cond);
                return `<span class="condition-tag${active ? ' active' : ''}" onclick="encToggleCondition('${c.id}','${cond}')">${cond}</span>`;
            }).join('');

            const hpCls = hpClass(c.hp, c.maxHp);
            const typeBadge = { player: 'Jugador', ally: 'Aliado', enemy: 'Enemigo' }[c.type] || c.type;
            const typeClass = { player: 'player', ally: 'ally', enemy: 'enemy' }[c.type] || 'enemy';

            div.innerHTML = `
                <div class="creature-card-top">
                    <div class="creature-initiative">${c.initiative ?? '—'}</div>
                    <span class="creature-name">${c.name}</span>
                    <span class="creature-type-badge ${typeClass}">${typeBadge}</span>
                    <button class="btn-danger" style="padding:4px 10px;font-size:12px;margin-left:auto" onclick="encRemoveCreature('${c.id}')">✕</button>
                </div>
                <div class="creature-hp-row">
                    <span class="hp-label">PV</span>
                    <span class="hp-display ${hpCls}" id="hpDisplay_${c.id}">${c.hp} / ${c.maxHp}</span>
                    <input class="hp-input-delta" id="hpDelta_${c.id}" type="number" placeholder="±" style="width:52px" aria-label="Cantidad de daño o curación">
                    <button class="hp-btn" onclick="encApplyHp('${c.id}', -1)" title="Daño">−</button>
                    <button class="hp-btn" onclick="encApplyHp('${c.id}', 1)" title="Curar">+</button>
                </div>
                <div class="creature-conditions">${conditions}</div>
                <div class="creature-notes-row">
                    <textarea class="creature-notes-input" rows="1" placeholder="Notas…" oninput="encSaveNotes('${c.id}', this.value)">${c.notes || ''}</textarea>
                </div>
            `;
            list.appendChild(div);
        });
    }

    // ── Creature management ───────────────────────────────────
    window.encAddCreature = function () {
        const enc = getEncounter(currentEncId);
        if (!enc) return;
        const name = (document.getElementById('encCreatureName').value || '').trim();
        if (!name) { showNotification('Escribe un nombre para la criatura', 2000); return; }
        const type = document.getElementById('encCreatureType').value;
        const maxHp = parseInt(document.getElementById('encCreatureHp').value) || 10;
        const initiative = document.getElementById('encCreatureInit').value !== ''
            ? parseInt(document.getElementById('encCreatureInit').value)
            : null;
        enc.creatures.push({ id: uid(), name, type, hp: maxHp, maxHp, initiative, conditions: [], notes: '' });
        // Sort by initiative descending (nulls last)
        enc.creatures.sort((a, b) => {
            if (a.initiative === null && b.initiative === null) return 0;
            if (a.initiative === null) return 1;
            if (b.initiative === null) return -1;
            return b.initiative - a.initiative;
        });
        save();
        // Clear inputs
        document.getElementById('encCreatureName').value = '';
        document.getElementById('encCreatureHp').value = '';
        document.getElementById('encCreatureInit').value = '';
        renderDetail();
    };

    window.encRemoveCreature = function (cid) {
        const enc = getEncounter(currentEncId);
        if (!enc) return;
        const idx = enc.creatures.findIndex(c => c.id === cid);
        if (idx === -1) return;
        enc.creatures.splice(idx, 1);
        // Adjust turnIndex if needed
        if (enc.turnIndex >= enc.creatures.length) enc.turnIndex = 0;
        save();
        renderDetail();
    };

    window.encRollAllInit = function () {
        const enc = getEncounter(currentEncId);
        if (!enc) return;
        enc.creatures.forEach(c => {
            if (c.initiative === null || c.initiative === undefined) {
                c.initiative = Math.floor(Math.random() * 20) + 1;
            }
        });
        enc.creatures.sort((a, b) => b.initiative - a.initiative);
        enc.turnIndex = 0;
        save();
        renderDetail();
        showNotification('🎲 Iniciativas tiradas', 1500);
    };

    // ── HP ────────────────────────────────────────────────────
    window.encApplyHp = function (cid, sign) {
        const enc = getEncounter(currentEncId);
        if (!enc) return;
        const c = enc.creatures.find(cr => cr.id === cid);
        if (!c) return;
        const delta = parseInt(document.getElementById('hpDelta_' + cid)?.value) || 1;
        c.hp = Math.max(0, Math.min(c.maxHp, c.hp + sign * delta));
        save();
        // Update just the HP display without full re-render
        const hpEl = document.getElementById('hpDisplay_' + cid);
        if (hpEl) {
            hpEl.textContent = `${c.hp} / ${c.maxHp}`;
            hpEl.className = 'hp-display ' + hpClass(c.hp, c.maxHp);
        }
    };

    // ── Conditions ────────────────────────────────────────────
    window.encToggleCondition = function (cid, cond) {
        const enc = getEncounter(currentEncId);
        if (!enc) return;
        const c = enc.creatures.find(cr => cr.id === cid);
        if (!c) return;
        c.conditions = c.conditions || [];
        const idx = c.conditions.indexOf(cond);
        if (idx === -1) c.conditions.push(cond);
        else c.conditions.splice(idx, 1);
        save();
        renderDetail();
    };

    // ── Notes ─────────────────────────────────────────────────
    window.encSaveNotes = function (cid, value) {
        const enc = getEncounter(currentEncId);
        if (!enc) return;
        const c = enc.creatures.find(cr => cr.id === cid);
        if (!c) return;
        c.notes = value;
        save();
    };

    // ── Turn management ───────────────────────────────────────
    window.encNextTurn = function () {
        const enc = getEncounter(currentEncId);
        if (!enc || enc.creatures.length === 0) return;
        enc.turnIndex = (enc.turnIndex + 1) % enc.creatures.length;
        if (enc.turnIndex === 0) enc.roundIndex = (enc.roundIndex || 1) + 1;
        save();
        renderDetail();
        // Scroll current turn into view
        setTimeout(() => {
            const currentCard = document.querySelector('.creature-card.current-turn');
            if (currentCard) currentCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    };

    window.encResetCombat = function () {
        const enc = getEncounter(currentEncId);
        if (!enc) return;
        enc.turnIndex = 0;
        enc.roundIndex = 1;
        save();
        renderDetail();
        showNotification('↺ Combate reiniciado', 1500);
    };

    window.encDeleteCurrent = function () {
        if (!currentEncId) return;
        encounters = encounters.filter(e => e.id !== currentEncId);
        save();
        encShowList();
        showNotification('Encuentro eliminado', 1500);
    };

}());
