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
    const currentEl = document.getElementById('hpCurrentInput');
    const sliderEl  = document.getElementById('hpSlider');
    const sectionEl = document.querySelector('.hp-bar-section');
    const deathEl   = document.getElementById('deathSavesSection');

    if (currentEl) currentEl.value = hp.current;
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
                        <input type="number" id="hpCurrentInput" class="hp-number-input"
                               min="0" max="${hp.max}" value="${hp.current}"
                               onchange="setHp(parseInt(this.value)||0)"
                               inputmode="numeric" aria-label="HP actual">
                        <span class="hp-max"> / ${hp.max}</span>
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
    initSpellSlotsForChar(charId);
    data.ranuras.forEach(s => { spellSlotState[charId][s.nombre] = s.total; });
    data.ranuras.forEach(s => _refreshSlotDisplay(charId, s.nombre, s.total));
    // Reset 1/long-rest modifiers
    if (modifierUsedState[charId]) modifierUsedState[charId] = {};
    renderSpellsWithFilters(data);
    renderCombatInline(data);
    saveStateToStorage();
    showNotification('🌙 Descanso largo: slots y habilidades restaurados', 2500);
}

function spendSpellSlot(charId, slotName) {
    initSpellSlotsForChar(charId);
    const slotDef = window.characterData[charId]?.ranuras?.find(s => s.nombre === slotName);
    if (!slotDef) return;
    const cur = spellSlotState[charId][slotName] ?? slotDef.total;
    if (cur <= 0) { showNotification(`❌ Sin ranuras ${slotName}`, 1500); return; }
    spellSlotState[charId][slotName] = cur - 1;
    saveStateToStorage();
    _refreshSlotDisplay(charId, slotName, slotDef.total);
}

function recoverSpellSlot(charId, slotName) {
    initSpellSlotsForChar(charId);
    const slotDef = window.characterData[charId]?.ranuras?.find(s => s.nombre === slotName);
    if (!slotDef) return;
    const cur = spellSlotState[charId][slotName] ?? slotDef.total;
    if (cur >= slotDef.total) return;
    spellSlotState[charId][slotName] = cur + 1;
    saveStateToStorage();
    _refreshSlotDisplay(charId, slotName, slotDef.total);
}

function _refreshSlotDisplay(charId, slotName, total) {
    const remaining = spellSlotState[charId]?.[slotName] ?? total;
    const isEmpty = remaining === 0;
    document.querySelectorAll(`.slot-count[data-slot="${slotName}"]`).forEach(el => {
        el.textContent = `${remaining}/${total}`;
        el.classList.toggle('slot-empty', isEmpty);
    });
    document.querySelectorAll(`.slot-badge[data-slot="${slotName}"]`).forEach(el => {
        el.textContent = `${remaining}/${total} ranuras`;
        el.classList.toggle('slot-empty', isEmpty);
    });
    document.querySelectorAll(`.slot-btn-minus[data-slot="${slotName}"]`).forEach(btn => {
        btn.disabled = isEmpty;
    });
    document.querySelectorAll(`.slot-btn-plus[data-slot="${slotName}"]`).forEach(btn => {
        btn.disabled = remaining >= total;
    });
}

// Shared slot tracker renderer — +/- buttons, used in character sheet and combat panel
function renderSlotTracker(charId, data, extraClass) {
    if (!data?.ranuras?.length) return '';
    initSpellSlotsForChar(charId);
    const cls = extraClass ? ` ${extraClass}` : '';
    return `<div class="slot-tracker${cls}">
        <div class="slot-tracker-header">
            <span class="slot-tracker-title">✨ Ranuras</span>
            <button class="slot-reset-btn" onclick="resetSpellSlots('${charId}')" title="Descanso largo">🌙</button>
        </div>
        ${data.ranuras.map(slot => {
            const remaining = spellSlotState[charId]?.[slot.nombre] ?? slot.total;
            const isEmpty = remaining === 0;
            return `<div class="slot-row">
                <span class="slot-name">${slot.nombre}</span>
                <div class="slot-controls">
                    <button class="slot-btn slot-btn-minus" data-slot="${slot.nombre}"
                            onclick="spendSpellSlot('${charId}','${slot.nombre}')"
                            title="Gastar ranura"${isEmpty ? ' disabled' : ''}>−</button>
                    <span class="slot-count${isEmpty ? ' slot-empty' : ''}" data-slot="${slot.nombre}">${remaining}/${slot.total}</span>
                    <button class="slot-btn slot-btn-plus" data-slot="${slot.nombre}"
                            onclick="recoverSpellSlot('${charId}','${slot.nombre}')"
                            title="Recuperar ranura"${remaining >= slot.total ? ' disabled' : ''}>+</button>
                </div>
            </div>`;
        }).join('')}
    </div>`;
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

    const charId = currentCharacterId;
    const slotHTML = charId ? renderSlotTracker(charId, data) : '';

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
    // Conditions bar stays in sheetResources
    const section = document.getElementById('sheetResources');
    if (!section) return;
    section.style.display = 'flex';
    section.innerHTML = renderConditionsBar(charId);

    // Special action buttons go above the turn planner
    const btnSection = document.getElementById('sheetCharButtons');
    if (!btnSection) return;
    let btns = '';
    if (charId === 'Vel') {
        const ds = demonicFormState[charId] || { active: false, turnsLeft: 0 };
        const btnCls = 'btn-demonic' + (ds.active ? ' active' : '');
        const label  = ds.active ? `😈 Demoníaca — ${ds.turnsLeft}🔥` : '😈 Forma Demoníaca';
        btns += `<button class="${btnCls}" onclick="toggleDemonicForm('Vel')">${label}</button>`;
        if (ds.active) {
            btns += `<button class="btn-demonic-turn" onclick="advanceDemonicTurn('Vel')">⏭️ Siguiente turno</button>`;
        }
        btns += `<button class="btn-entity-sheet" onclick="showEntitySheet('sirviente')">👻 Sirviente Invisible</button>`;
    }
    if (charId === 'Zero') {
        const invs = window.characterData['Zero']?.invocaciones || [];
        invs.forEach(inv => {
            btns += `<button class="btn-entity-sheet" onclick="showEntitySheet('invocacion','${inv.id}')">${inv.emoji} ${inv.nombre}</button>`;
        });
    }
    btnSection.innerHTML = btns;
    btnSection.style.display = btns ? 'flex' : 'none';
}

function showEntitySheet(tipo, invId) {
    document.getElementById('editCharBtn')?.style.setProperty('display', 'none');
    document.getElementById('saveCharBtn')?.style.setProperty('display', 'none');

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
    const editBtn = document.getElementById('editCharBtn');
    if (editBtn) editBtn.style.removeProperty('display');
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
