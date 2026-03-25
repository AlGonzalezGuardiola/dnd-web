// ============================================
// Character Sheet — HP, spells, conditions, demonic form, notes
// Depends on: globals.js, utils.js, storage.js
// Runtime deps: renderCharacterSheet (character-edit.js)
// ============================================

function setHp(value) {
    if (!currentCharacterId) return;
    initHpForChar(currentCharacterId);
    const hp = hpState[currentCharacterId];
    const wasAlive = hp.current > 0;
    hp.current = Math.max(0, Math.min(hp.max, value));

    const pct = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
    const currentEl = document.getElementById('hpCurrent');
    const sliderEl  = document.getElementById('hpSlider');
    const sectionEl = document.querySelector('.hp-bar-section');
    const deathEl   = document.getElementById('deathSavesSection');

    if (currentEl) currentEl.textContent = hp.current;
    if (sliderEl)  { sliderEl.value = hp.current; sliderEl.style.background = getSliderGradient(pct); }
    if (sectionEl) {
        sectionEl.classList.toggle('unconscious', hp.current === 0);
        sectionEl.classList.toggle('critical', pct <= 25 && hp.current > 0);
    }
    if (deathEl) deathEl.style.display = hp.current === 0 ? 'flex' : 'none';
    // Reset death saves when HP restored from 0
    if (!wasAlive && hp.current > 0 && deathSaveState[currentCharacterId]) {
        deathSaveState[currentCharacterId] = { successes: 0, failures: 0 };
    }

    saveStateToStorage();
    if (hp.current === 0) showNotification('💀 ¡Sin puntos de golpe!', 3000);
    else if (hp.current <= Math.floor(hp.max * 0.25)) showNotification('⚠️ HP crítico', 2000);
}

function renderHpSection(charId) {
    initHpForChar(charId);
    initDeathSavesForChar(charId);
    const hp = hpState[charId];
    const ds = deathSaveState[charId];
    const pct = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
    const isCritical = pct <= 25 && hp.current > 0;
    const isUnconscious = hp.current === 0;
    const hasInspiration = inspirationState[charId] || false;

    const makeDsPips = (type, count) =>
        [0,1,2].map(i => `<button class="ds-pip ${type}${i < count ? ' filled' : ''}"
            onclick="toggleDeathSave('${charId}','${type}',${i})" title="${type === 'success' ? 'Éxito' : 'Fallo'}"></button>`).join('');

    return `
        <div class="hp-bar-section${isUnconscious ? ' unconscious' : ''}${isCritical ? ' critical' : ''}">
            <div class="hp-bar-header">
                <div class="hp-info">
                    <div class="pill-label">❤️ Puntos de Golpe</div>
                    <div class="hp-display">
                        <span id="hpCurrent">${hp.current}</span><span class="hp-max"> / ${hp.max}</span>
                    </div>
                </div>
                <button class="inspiration-btn${hasInspiration ? ' active' : ''}"
                        onclick="toggleInspiration('${charId}')" title="Inspiración">⭐</button>
            </div>
            <input type="range" class="hp-slider" id="hpSlider"
                   min="0" max="${hp.max}" value="${hp.current}"
                   oninput="setHp(parseInt(this.value))"
                   style="background: ${getSliderGradient(pct)}"
                   aria-label="Puntos de golpe">
            <div class="death-saves-section" id="deathSavesSection" style="display:${isUnconscious ? 'flex' : 'none'}">
                <div class="ds-title">💀 Salvaciones de Muerte</div>
                <div class="ds-row"><span class="ds-label success">Éxitos</span>
                    <div class="ds-pips">${makeDsPips('success', ds.successes)}</div></div>
                <div class="ds-row"><span class="ds-label failure">Fallos</span>
                    <div class="ds-pips">${makeDsPips('failure', ds.failures)}</div></div>
            </div>
        </div>
    `;
}

function toggleDeathSave(charId, type, index) {
    initDeathSavesForChar(charId);
    const ds = deathSaveState[charId];
    const key = type + 's';
    ds[key] = (index < ds[key]) ? index : Math.min(3, index + 1);
    // Update pips
    document.querySelectorAll(`#deathSavesSection .ds-pip.${type}`).forEach((pip, i) => {
        pip.classList.toggle('filled', i < ds[key]);
    });
    saveStateToStorage();
    if (ds.successes >= 3) showNotification('✅ ¡Estabilizado!', 3000);
    if (ds.failures  >= 3) showNotification('💀 ¡Has muerto!', 5000);
}

function toggleInspiration(charId) {
    inspirationState[charId] = !inspirationState[charId];
    const btn = document.querySelector('.inspiration-btn');
    if (btn) btn.classList.toggle('active', inspirationState[charId]);
    saveStateToStorage();
    showNotification(inspirationState[charId] ? '⭐ ¡Inspiración!' : '⭐ Inspiración usada', 2000);
}

function toggleSpellSlot(charId, slotName, index) {
    initSpellSlotsForChar(charId);
    const data = window.characterData[charId];
    const slotDef = data.ranuras?.find(s => s.nombre === slotName);
    if (!slotDef) return;
    const cur = spellSlotState[charId][slotName];
    spellSlotState[charId][slotName] = Math.max(0, Math.min(slotDef.total, index < cur ? index : index + 1));
    const remaining = spellSlotState[charId][slotName];
    document.querySelectorAll(`.slot-track[data-slot="${slotName}"] .slot-pip`).forEach((pip, i) => {
        pip.classList.toggle('used', i >= remaining);
    });
    const countEl = document.querySelector(`.slot-count[data-slot="${slotName}"]`);
    if (countEl) countEl.textContent = `${remaining}/${slotDef.total}`;
    saveStateToStorage();
}

function resetSpellSlots(charId) {
    const data = window.characterData[charId];
    if (!data?.ranuras) return;
    data.ranuras.forEach(s => { spellSlotState[charId][s.nombre] = s.total; });
    renderSpellsWithFilters(data);
    saveStateToStorage();
    showNotification('🌙 Descanso largo: slots restaurados', 2500);
}

function renderSpellsWithFilters(data) {
    const container = document.getElementById('tabSpells');
    if (!data.conjuros || data.conjuros.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px;">Este personaje no posee conjuros.</div>';
        return;
    }

    // Collect unique spell levels
    const levels = ['Todos'];
    data.conjuros.forEach(s => {
        const lv = s.nivel === 'Truco' ? 'Truco' :
            (s.nivel === 'Esp' || s.nivel === 'Especial') ? 'Esp' :
            `Nv${s.nivel}`;
        if (!levels.includes(lv)) levels.push(lv);
    });

    const filterBtns = levels.map((lv, i) =>
        `<button class="spell-filter-btn${i === 0 ? ' active' : ''}" data-level="${lv}">${lv}</button>`
    ).join('');

    // Slot tracker
    let slotHTML = '';
    const charId = currentCharacterId;
    if (charId && data.ranuras && data.ranuras.length > 0) {
        initSpellSlotsForChar(charId);
        slotHTML = `<div class="slot-tracker">
            <div class="slot-tracker-header">
                <span class="slot-tracker-title">✨ Ranuras de Conjuro</span>
                <button class="slot-reset-btn" onclick="resetSpellSlots('${charId}')" title="Descanso largo">🌙 Descanso</button>
            </div>
            ${data.ranuras.map(slot => {
                const remaining = spellSlotState[charId]?.[slot.nombre] ?? slot.total;
                const pips = Array.from({ length: slot.total }, (_, i) =>
                    `<button class="slot-pip${i >= remaining ? ' used' : ''}"
                        onclick="toggleSpellSlot('${charId}','${slot.nombre}',${i})"></button>`
                ).join('');
                return `<div class="slot-row">
                    <span class="slot-name">${slot.nombre}</span>
                    <div class="slot-track" data-slot="${slot.nombre}">${pips}</div>
                    <span class="slot-count" data-slot="${slot.nombre}">${remaining}/${slot.total}</span>
                </div>`;
            }).join('')}
        </div>`;
    }

    let html = `
        ${slotHTML}
        <div class="spell-level-filters" id="spellFilters">${filterBtns}</div>
        <div class="spell-filters" style="margin-bottom:14px; display:flex; gap:10px;">
            <input type="text" id="spellSearch" placeholder="Buscar conjuro..." class="sheet-input" style="flex:1">
        </div>
        <div class="feature-grid" id="spellsGrid">
    `;

    data.conjuros.forEach((spell, index) => {
        const levelKey = spell.nivel === 'Truco' ? 'Truco' :
            (spell.nivel === 'Esp' || spell.nivel === 'Especial') ? 'Esp' :
            `Nv${spell.nivel}`;
        const type = spell.desc.toLowerCase().includes("daño") ? "DAÑO" :
            spell.desc.toLowerCase().includes("cur") ? "CURACIÓN" :
            spell.desc.toLowerCase().includes("control") ? "CONTROL" : "UTILIDAD";

        html += `
            <div class="spell-item" data-name="${spell.nombre.toLowerCase()}" data-level="${levelKey}">
                <div class="feature-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                    <h3 style="margin:0; flex:1">${spell.nombre}</h3>
                    ${isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteSpell(${index})">×</button>` : '<span class="feature-chevron">▼</span>'}
                </div>
                <div class="item-meta">${spell.nivel === "Truco" ? "Truco" : "Nivel " + spell.nivel} • ${type}</div>
                <div class="item-desc collapsible">${spell.desc}</div>
            </div>
        `;
    });

    html += '</div>';
    if (isCharacterEditing) {
        html += `<button class="btn-add-item" onclick="addSpell()">+ Añadir Conjuro</button>`;
    }
    container.innerHTML = html;

    // Level filter logic
    let activeLevel = 'Todos';
    let activeSearch = '';

    function applySpellFilters() {
        document.querySelectorAll('#spellsGrid .spell-item').forEach(item => {
            const levelMatch = activeLevel === 'Todos' || item.dataset.level === activeLevel;
            const searchMatch = !activeSearch || item.dataset.name.includes(activeSearch);
            item.style.display = (levelMatch && searchMatch) ? '' : 'none';
        });
    }

    document.querySelectorAll('#spellFilters .spell-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#spellFilters .spell-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeLevel = btn.dataset.level;
            applySpellFilters();
        });
    });

    const search = document.getElementById('spellSearch');
    if (search) {
        search.addEventListener('input', (e) => {
            activeSearch = e.target.value.toLowerCase();
            applySpellFilters();
        });
    }
}

function renderConditionsBar(charId) {
    if (!conditionsState[charId]) conditionsState[charId] = [];
    const active = conditionsState[charId];
    return `<div class="conditions-bar" id="conditionsBar">
        ${CONDITIONS.map(c => `<button class="condition-btn${active.includes(c.id) ? ' active' : ''}"
            onclick="toggleCondition('${charId}','${c.id}')" title="${c.title}">${c.label} ${c.title}</button>`).join('')}
    </div>`;
}

function toggleCondition(charId, condId) {
    if (!conditionsState[charId]) conditionsState[charId] = [];
    const idx = conditionsState[charId].indexOf(condId);
    if (idx >= 0) conditionsState[charId].splice(idx, 1);
    else conditionsState[charId].push(condId);
    document.querySelectorAll(`#conditionsBar .condition-btn`).forEach(btn => {
        const id = btn.getAttribute('onclick').match(/'([^']+)'\)$/)?.[1];
        if (id) btn.classList.toggle('active', conditionsState[charId].includes(id));
    });
    saveStateToStorage();
}

function renderDemonicSection(charId) {
    const section = document.getElementById('sheetResources');
    if (!section) return;
    section.style.display = 'flex';
    let html = renderConditionsBar(charId);
    if (charId === 'Vel') {
        const ds = demonicFormState[charId] || { active: false, turnsLeft: 0 };
        const btnCls = 'btn-demonic' + (ds.active ? ' active' : '');
        const label  = ds.active ? `😈 Demoníaca — ${ds.turnsLeft}🔥` : '😈 Forma Demoníaca';
        html += `<button class="${btnCls}" onclick="toggleDemonicForm('Vel')">${label}</button>`;
        if (ds.active) {
            html += `<button class="btn-demonic-turn" onclick="advanceDemonicTurn('Vel')">⏭️ Siguiente turno</button>`;
        }
        html += `<button class="btn-entity-sheet" onclick="showEntitySheet('sirviente')">👻 Sirviente Invisible</button>`;
    }
    if (charId === 'Zero') {
        const invs = window.characterData['Zero']?.invocaciones || [];
        invs.forEach(inv => {
            html += `<button class="btn-entity-sheet" onclick="showEntitySheet('invocacion','${inv.id}')">${inv.emoji} ${inv.nombre}</button>`;
        });
    }
    section.innerHTML = html;
}

function showEntitySheet(tipo, invId) {
    let overlay = document.getElementById('entitySheetOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'entitySheetOverlay';
        overlay.className = 'entity-sheet-overlay';
        document.getElementById('characterSheetContainer').appendChild(overlay);
    }

    let contentHTML = '';
    if (tipo === 'sirviente') {
        const sirvData = typeof buildSirvienteCharData === 'function' ? buildSirvienteCharData('?') : null;
        const acciones = sirvData?.combateExtra || [];
        const groups = { accion: [], adicional: [], reaccion: [] };
        acciones.forEach(a => { groups[a.tipo || 'accion'].push(a); });
        const sectionLabels = [
            { key: 'accion', icon: '🎯', label: 'Acciones' },
            { key: 'adicional', icon: '⚡', label: 'Adicionales' },
            { key: 'reaccion', icon: '↩️', label: 'Reacciones' }
        ];
        const actionsHTML = sectionLabels.map(s => {
            const items = groups[s.key];
            if (!items.length) return '';
            return `<div class="entity-action-group">
                <div class="entity-action-group-title">${s.icon} ${s.label}</div>
                ${items.map(a => `<div class="entity-action-card">
                    <div class="entity-action-name">${a.nombre}
                        ${a.atk ? `<span class="entity-action-dice">ATK ${a.atk}${a.dado ? ' | DMG ' + a.dado : ''}</span>` : ''}
                    </div>
                    <div class="entity-action-desc">${a.desc}</div>
                </div>`).join('')}
            </div>`;
        }).join('');
        contentHTML = `
            <div class="entity-sheet-header">
                <span class="entity-sheet-emoji">👻</span>
                <div>
                    <div class="entity-sheet-name">Sirviente Invisible</div>
                    <div class="entity-sheet-meta">Familiar · CA = Vel · Vel. 30ft</div>
                </div>
            </div>
            <div class="entity-sheet-stats">
                <div class="entity-stat"><span>❤️</span><span>1 PG</span></div>
                <div class="entity-stat"><span>👁️</span><span>Siempre invisible</span></div>
                <div class="entity-stat"><span>⚔️</span><span>Ventaja en ataques</span></div>
            </div>
            ${actionsHTML}`;
    } else if (tipo === 'invocacion') {
        const inv = window.characterData['Zero']?.invocaciones?.find(i => i.id === invId);
        if (!inv) { overlay.remove(); return; }
        const habilidadesHTML = inv.habilidades.map(h =>
            `<div class="entity-habilidad">${h}</div>`
        ).join('');
        contentHTML = `
            <div class="entity-sheet-header">
                <span class="entity-sheet-emoji">${inv.emoji}</span>
                <div>
                    <div class="entity-sheet-name">${inv.nombre}</div>
                    <div class="entity-sheet-meta">Invocación de Zero · Vel. ${inv.velocidad}</div>
                </div>
            </div>
            <div class="entity-sheet-stats">
                <div class="entity-stat"><span>❤️</span><span>${inv.hp} PG</span></div>
                <div class="entity-stat"><span>🛡️</span><span>CA ${inv.ca}</span></div>
                <div class="entity-stat"><span>⚔️</span><span>${inv.ataque}</span></div>
            </div>
            <div class="entity-action-group">
                <div class="entity-action-group-title">✨ Habilidades</div>
                ${habilidadesHTML}
            </div>`;
    }

    overlay.innerHTML = `
        <button class="entity-sheet-back" onclick="closeEntitySheet()">← Volver</button>
        <div class="entity-sheet-body">${contentHTML}</div>`;
    overlay.style.display = 'flex';
}

function closeEntitySheet() {
    document.getElementById('entitySheetOverlay')?.remove();
}

function toggleDemonicForm(charId) {
    if (!demonicFormState[charId]) demonicFormState[charId] = { active: false, turnsLeft: 0 };
    const ds = demonicFormState[charId];
    ds.active = !ds.active;
    ds.turnsLeft = ds.active ? 6 : 0;
    updateDemonicFormDisplay(charId);
    saveStateToStorage();
    showNotification(ds.active ? '😈 ¡Forma Demoníaca activa!' : '💔 Forma Demoníaca terminada', 2200);
}

function advanceDemonicTurn(charId) {
    const ds = demonicFormState[charId];
    if (!ds?.active) return;
    ds.turnsLeft = Math.max(0, ds.turnsLeft - 1);
    if (ds.turnsLeft === 0) {
        ds.active = false;
        showNotification('💀 Forma Demoníaca terminada', 2500);
    }
    updateDemonicFormDisplay(charId);
    saveStateToStorage();
}

function updateDemonicFormDisplay(charId) {
    const ds  = demonicFormState[charId] || { active: false };
    const data = window.characterData[charId];
    if (!data) return;

    // Update CA pill
    const pillCA = document.getElementById('pillCA');
    if (pillCA) {
        const v = pillCA.querySelector('.pill-value');
        if (v) v.textContent = ds.active ? String((parseInt(data.resumen?.CA) || 0) + 2) : (data.resumen?.CA ?? '?');
        pillCA.classList.toggle('demonic-active', ds.active);
        pillCA.style.borderLeftColor = ds.active ? '#ff2222' : '#4488ff';
    }
    // Update Speed pill
    const pillSpeed = document.getElementById('pillSpeed');
    if (pillSpeed) {
        const v = pillSpeed.querySelector('.pill-value');
        if (v) v.textContent = ds.active ? '50ft' : data.resumen.Velocidad;
        pillSpeed.classList.toggle('demonic-active', ds.active);
        pillSpeed.style.borderLeftColor = ds.active ? '#ff2222' : '#ffcc44';
    }
    // Re-render button section
    renderDemonicSection(charId);
}

function saveNote(charId, text) {
    notesState[charId] = text;
    saveStateToStorage();
}

function getModifier(value) {
    return Math.floor((value - 10) / 2);
}

function extractDiceFromDesc(desc) {
    if (!desc) return null;
    const plain = desc.replace(/<[^>]+>/g, ' '); // strip HTML tags
    const matches = plain.match(/\d+d\d+(?:[+-]\d+)?/gi);
    if (!matches || matches.length === 0) return null;
    return matches.join(' + ');
}

function getDiceBadges(action) {
    let parts = [];
    if (action.atk) parts.push(`<span class="dice-atk">ATK ${action.atk}</span>`);
    if (action.dado && action.dado !== '—') {
        parts.push(`<span class="dice-dmg">DMG ${action.dado}</span>`);
    } else if (!action.atk) {
        // Try to extract from description
        const extracted = extractDiceFromDesc(action.desc);
        if (extracted) parts.push(`<span class="dice-dmg">${extracted}</span>`);
    }
    return parts.join('');
}

function renderCombatInline(data) {
    const html = renderCombatTab(data);
    const inline = document.getElementById('combatInline');
    if (inline) inline.innerHTML = html;
    const tab = document.getElementById('tabCombat');
    if (tab) tab.innerHTML = html;
}

function inferActionType(item) {
    if (item.tipo) return item.tipo;
    const nivel = String(item.nivel ?? '');
    const nombre = item.nombre || '';
    const desc = item.desc || '';
    // Reaction
    if (nivel === 'Reac' || /\(Reacci[oó]n\)/i.test(nombre) || /\(Reacci[oó]n\)/i.test(desc)) {
        return 'reaccion';
    }
    // Bonus action – capital-B "Bonus" word, or "(Bonus)" in name
    if (/\(Bonus\)/i.test(nombre) || /\bBonus\b/.test(desc)) {
        return 'adicional';
    }
    return 'accion';
}

function renderCombatTab(data) {
    const charId = data.id;
    if (!turnPlannerState[charId]) {
        turnPlannerState[charId] = { accion: null, adicional: null, reaccion: null };
    }
    const planner = turnPlannerState[charId];

    // Collect all combat items
    const allItems = [
        ...(data.combateExtra || []),
        ...(data.conjuros || [])
    ];

    // Group by type
    const groups = { accion: [], adicional: [], reaccion: [] };
    allItems.forEach(item => {
        const tipo = inferActionType(item);
        groups[tipo].push(item);
    });

    // Spell slots
    let slotsHTML = '';
    if (data.ranuras && data.ranuras.length > 0) {
        initSpellSlotsForChar(charId);
        slotsHTML = `<div class="slot-tracker combat-slots">
            <div class="slot-tracker-header">
                <span class="slot-tracker-title">✨ Ranuras</span>
                <button class="slot-reset-btn" onclick="resetSpellSlots('${charId}')" title="Descanso largo">🌙</button>
            </div>
            ${data.ranuras.map(slot => {
                const remaining = spellSlotState[charId]?.[slot.nombre] ?? slot.total;
                const pips = Array.from({ length: slot.total }, (_, i) =>
                    `<button class="slot-pip${i >= remaining ? ' used' : ''}"
                        onclick="toggleSpellSlot('${charId}','${slot.nombre}',${i})"></button>`
                ).join('');
                return `<div class="slot-row">
                    <span class="slot-name">${slot.nombre}</span>
                    <div class="slot-track" data-slot="${slot.nombre}">${pips}</div>
                    <span class="slot-count" data-slot="${slot.nombre}">${remaining}/${slot.total}</span>
                </div>`;
            }).join('')}
        </div>`;
    }

    // Turn planner
    const plannerSlots = [
        { key: 'accion', icon: '🎯', label: 'Acción' },
        { key: 'adicional', icon: '⚡', label: 'Adicional' },
        { key: 'reaccion', icon: '↩️', label: 'Reacción' }
    ];
    const plannerSlotsHTML = plannerSlots.map(s => {
        const sel = planner[s.key];
        if (sel) {
            return `<div class="planner-slot filled">
                <span class="planner-slot-icon">${s.icon}</span>
                <span class="planner-slot-label">${s.label}:</span>
                <span class="planner-slot-value">${sel.nombre}</span>
                <button class="planner-slot-clear" onclick="clearPlannerSlot('${charId}','${s.key}')">×</button>
            </div>`;
        }
        return `<div class="planner-slot empty">
            <span class="planner-slot-icon">${s.icon}</span>
            <span class="planner-slot-label">${s.label}:</span>
            <span class="planner-slot-empty">— selecciona abajo</span>
        </div>`;
    }).join('');

    // Dice panel — uses getDiceBadges for consistent display incl. extracted dice
    const selectedActions = [planner.accion, planner.adicional, planner.reaccion].filter(Boolean);
    let diceHTML = '';
    if (selectedActions.length > 0) {
        const rows = selectedActions.map(action => {
            const badges = getDiceBadges(action);
            return `<div class="dice-row">
                <span class="dice-name">${action.nombre}</span>
                <div class="dice-values">${badges || '<span class="dice-utility">Sin tirada</span>'}</div>
            </div>`;
        }).join('');
        diceHTML = `<div class="dice-panel-combat">
            <div class="dice-panel-title">🎲 Dados del Turno</div>
            ${rows}
        </div>`;
    }

    // Action lists
    const sections = [
        { key: 'accion', icon: '🎯', label: 'Acciones' },
        { key: 'adicional', icon: '⚡', label: 'Adicionales' },
        { key: 'reaccion', icon: '↩️', label: 'Reacciones' }
    ];
    const actionListHTML = sections.map(section => {
        const items = groups[section.key];
        if (items.length === 0) return '';
        const cardsHTML = items.map(item => {
            const sel = planner[section.key];
            const isSelected = sel && sel.nombre === item.nombre;
            // Dice badge: explicit fields first, then extracted from desc
            const diceStr = item.atk
                ? `ATK ${item.atk}${item.dado && item.dado !== '—' ? ` | DMG ${item.dado}` : ''}`
                : (item.dado && item.dado !== '—' ? `DMG ${item.dado}`
                    : (extractDiceFromDesc(item.desc) || ''));
            const safeName = item.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `<div class="combat-action-card${isSelected ? ' selected' : ''}"
                     onclick="selectCombatAction('${charId}','${section.key}','${safeName}')">
                <div class="combat-action-header">
                    <span class="combat-action-name">${item.nombre}</span>
                    ${diceStr ? `<span class="combat-action-dice">${diceStr}</span>` : ''}
                </div>
                <div class="combat-action-desc">${item.desc}</div>
            </div>`;
        }).join('');
        return `<div class="combat-section">
            <div class="combat-section-title">${section.icon} ${section.label}</div>
            <div class="combat-action-list">${cardsHTML}</div>
        </div>`;
    }).join('');

    return `<div class="turn-planner">
        <div class="turn-planner-title">⚡ Planificador de Turno</div>
        <div class="planner-slots">${plannerSlotsHTML}</div>
        ${diceHTML}
    </div>
    ${slotsHTML}
    ${actionListHTML}`;
}

function selectCombatAction(charId, tipo, nombre) {
    const data = window.characterData[charId];
    if (!data) return;
    const allItems = [...(data.combateExtra || []), ...(data.conjuros || [])];
    const item = allItems.find(i => i.nombre === nombre);
    if (!item) return;
    if (!turnPlannerState[charId]) turnPlannerState[charId] = { accion: null, adicional: null, reaccion: null };
    const planner = turnPlannerState[charId];
    planner[tipo] = (planner[tipo] && planner[tipo].nombre === nombre) ? null : item;
    refreshCombatSections(data);
}

function clearPlannerSlot(charId, tipo) {
    if (!turnPlannerState[charId]) return;
    turnPlannerState[charId][tipo] = null;
    const data = window.characterData[charId];
    if (data) refreshCombatSections(data);
}

function refreshCombatSections(data) {
    const html = renderCombatTab(data);
    const inline = document.getElementById('combatInline');
    if (inline) inline.innerHTML = html;
    const tab = document.getElementById('tabCombat');
    if (tab) tab.innerHTML = html;
}

function renderTraitItem(trait, index, tab) {
    return `
        <div class="feature-item" data-index="${index}">
            <div class="feature-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                <h3 style="margin:0; flex:1">${trait.nombre}</h3>
                ${isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteFeature(${index})">×</button>` : '<span class="feature-chevron">▼</span>'}
            </div>
            <div class="item-desc collapsible">${trait.desc}</div>
        </div>
    `;
}

function renderCategorizedInventory(data, filter = "") {
    const resultsContainer = document.getElementById('inventoryResults');
    if (!resultsContainer) return;

    const categories = {
        "Equipado": [],
        "Objetos Mágicos": [],
        "Consumibles": [],
        "Mochila": []
    };

    if (data.inventario) {
        data.inventario.forEach((item, index) => {
            if (filter && !item.nombre.toLowerCase().includes(filter) && !item.desc.toLowerCase().includes(filter)) return;

            const desc = item.desc.toLowerCase();
            if (desc.includes("arma") || desc.includes("armadura") || desc.includes("escudo")) categories["Equipado"].push({ item, index });
            else if (desc.includes("mágico") || desc.includes("anillo") || desc.includes("capa")) categories["Objetos Mágicos"].push({ item, index });
            else if (desc.includes("poción") || desc.includes("pergamino") || desc.includes("comida")) categories["Consumibles"].push({ item, index });
            else categories["Mochila"].push({ item, index });
        });
    }

    let html = '';
    for (const [catName, items] of Object.entries(categories)) {
        if (items.length === 0 && filter) continue;
        html += `<h3 class="feature-section-title">${catName}</h3><div class="feature-grid">`;
        if (items.length === 0) {
            html += `<div style="color:var(--text-secondary); font-size:12px; padding:10px;">Nada en esta categoría.</div>`;
        } else {
            items.forEach(({ item, index }) => {
                html += `
                    <div class="feature-item">
                        <div class="feature-header" style="display:flex; justify-content:space-between; cursor:pointer;">
                            <h3 style="margin:0">${item.nombre}</h3>
                            ${isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteInventoryItem(${index})">×</button>` : ''}
                        </div>
                        <div class="item-desc collapsible expanded">${item.desc}</div>
                    </div>
                `;
            });
        }
        html += '</div>';
    }

    if (isCharacterEditing) {
        html += `<button class="btn-add-item" onclick="addInventoryItem()">+ Añadir Objeto</button>`;
    }

    resultsContainer.innerHTML = html;
}

function updateTabs(data) {
    const tabCombat = document.getElementById('tabCombat');
    const tabFeatures = document.getElementById('tabFeatures');
    const tabInventory = document.getElementById('tabInventory');
    const tabSpells = document.getElementById('tabSpells');

    // 1. Tab Combat: on mobile this mirrors the inline combat section
    if (tabCombat) tabCombat.innerHTML = renderCombatTab(data);

    // 2. Tab Narrative: Social, background, and passive traits
    let narrativeHTML = '<div class="feature-grid">';
    data.rasgos.forEach((trait, index) => {
        if (!trait.nombre.includes("🗡️") && !trait.nombre.includes("⚔️") && !trait.nombre.includes("Combate")) {
            narrativeHTML += renderTraitItem(trait, index, 'features');
        }
    });
    narrativeHTML += '</div>';
    tabFeatures.innerHTML = narrativeHTML;

    // 3. Tab Inventory: Categorized
    let inventorySearchHTML = `
        <div class="inventory-filters" style="margin-bottom:20px;">
            <input type="text" id="inventorySearch" placeholder="Buscar en equipo..." class="sheet-input" style="width:100%">
        </div>
        <div id="inventoryResults">
    `;
    tabInventory.innerHTML = inventorySearchHTML + '</div>';
    renderCategorizedInventory(data, "");

    // Search logic for inventory
    const invSearch = document.getElementById('inventorySearch');
    if (invSearch) {
        invSearch.addEventListener('input', (e) => {
            renderCategorizedInventory(data, e.target.value.toLowerCase());
        });
    }

    // 4. Tab Spells: With quick filters
    renderSpellsWithFilters(data);

    // Re-attach expand events
    setupCollapsibleEvents();
}

function setupCollapsibleEvents() {
    const sheet = document.getElementById('characterSheetContainer');
    if (!sheet || sheet._collapsibleSetup) return;
    sheet._collapsibleSetup = true;
    sheet.addEventListener('click', (e) => {
        const header = e.target.closest('.feature-header');
        if (!header || e.target.closest('button')) return;
        const desc = header.nextElementSibling;
        if (desc?.classList.contains('collapsible')) {
            const expanding = !desc.classList.contains('expanded');
            desc.classList.toggle('expanded', expanding);
            const chevron = header.querySelector('.feature-chevron');
            if (chevron) chevron.textContent = expanding ? '▲' : '▼';
        }
    });
}
