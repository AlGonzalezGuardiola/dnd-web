// ============================================
// Character Sheet Tabs — combat planner, actions, trait/inventory/spell tabs
// Depends on: globals.js, utils.js, storage.js, character-sheet.js
// ============================================

function renderCombatInline(data) {
    const html = renderCombatTab(data);
    const inline = document.getElementById('combatInline');
    if (inline) inline.innerHTML = html;
    const tab = document.getElementById('tabCombat');
    if (tab) tab.innerHTML = html;
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

    // Group by type (invocacion items are handled by separate buttons, skip them here)
    const groups = { accion: [], adicional: [], reaccion: [], modificador: [], invocacion: [] };
    allItems.forEach(item => {
        const tipo = inferActionType(item);
        if (groups[tipo] !== undefined) groups[tipo].push(item);
        else groups.accion.push(item);
    });

    // Spell slots
    const slotsHTML = renderSlotTracker(charId, data, 'combat-slots');

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

    // Init modifier state
    if (!modifierState[charId]) modifierState[charId] = {};
    if (!modifierUsedState[charId]) modifierUsedState[charId] = {};

    // Active modifiers for dice panel
    const activeModifiers = groups.modificador.filter(m => modifierState[charId][m.nombre] === true);

    // Dice panel — includes selected planner actions + active modifiers
    const selectedActions = [planner.accion, planner.adicional, planner.reaccion].filter(Boolean);
    let diceHTML = '';
    if (selectedActions.length > 0 || activeModifiers.length > 0) {
        const actionRows = selectedActions.map(action => {
            const badges = getDiceBadges(action);
            return `<div class="dice-row">
                <span class="dice-name">${action.nombre}</span>
                <div class="dice-values">${badges || '<span class="dice-utility">Sin tirada</span>'}</div>
            </div>`;
        }).join('');
        const modRows = activeModifiers.map(mod => {
            const badges = getDiceBadges(mod);
            return `<div class="dice-row dice-row-modifier">
                <span class="dice-name">✦ ${mod.nombre}</span>
                <div class="dice-values">${badges || '<span class="dice-utility modifier-active-badge">Activo</span>'}</div>
            </div>`;
        }).join('');
        diceHTML = `<div class="dice-panel-combat">
            <div class="dice-panel-title">🎲 Dados del Turno</div>
            ${actionRows}${modRows}
        </div>`;
    }

    // Modifier section (interactive, placed after acciones)
    const modifierSectionHTML = groups.modificador.length ? (() => {
        const cards = groups.modificador.map(item => {
            const isActive  = modifierState[charId][item.nombre] === true;
            const isUsed    = modifierUsedState[charId][item.nombre] === true;
            const isDepleted = item.descansoLargo && isUsed && !isActive;
            const diceStr   = item.dado && item.dado !== '—' ? `DMG ${item.dado}` : '';
            const safeName  = item.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const safeDescMod = (item.desc || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
            const infoBtnMod  = item.desc
                ? `<button class="chip-info-btn" onclick="event.stopPropagation();showActionDetail('${safeName}','','','${safeDescMod}')" title="Ver descripción">ℹ️</button>`
                : '';
            return `<div class="combat-action-card modifier-card${isActive ? ' selected' : ''}${isDepleted ? ' depleted' : ''}"
                     onclick="selectModifier('${charId}','${safeName}')">
                <div class="combat-action-header">
                    <span class="combat-action-name">${item.nombre}</span>
                    ${diceStr ? `<span class="combat-action-dice">${diceStr}</span>` : ''}
                    ${infoBtnMod}
                    ${isDepleted ? '<span class="modifier-depleted-badge">Gastado · 🌙</span>' : ''}
                </div>
            </div>`;
        }).join('');
        return `<div class="combat-section modifier-section">
            <div class="combat-section-title">✦ Modificadores</div>
            <div class="combat-action-list">${cards}</div>
        </div>`;
    })() : '';

    // Action lists
    const sections = [
        { key: 'accion', icon: '🎯', label: 'Acciones' },
        { key: 'adicional', icon: '⚡', label: 'Adicionales' },
        { key: 'reaccion', icon: '↩️', label: 'Reacciones' }
    ];

    function renderActionCard(item, sectionKey) {
        const sel = planner[sectionKey];
        const isSelected = sel && sel.nombre === item.nombre;
        const diceStr = item.atk
            ? `ATK ${item.atk}${item.dado && item.dado !== '—' ? ` | DMG ${item.dado}` : ''}`
            : (item.dado && item.dado !== '—' ? `DMG ${item.dado}`
                : (extractDiceFromDesc(item.desc) || ''));
        const safeName    = item.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeAtk     = (item.atk || '').replace(/'/g, "\\'");
        const safeDadoItem = (item.dado && item.dado !== '—' ? item.dado : '').replace(/'/g, "\\'");
        const safeDesc    = (item.desc || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
        const infoBtn     = item.desc
            ? `<button class="chip-info-btn" onclick="event.stopPropagation();showActionDetail('${safeName}','${safeAtk}','${safeDadoItem}','${safeDesc}')" title="Ver descripción">ℹ️</button>`
            : '';
        return `<div class="combat-action-card${isSelected ? ' selected' : ''}"
                 onclick="selectCombatAction('${charId}','${sectionKey}','${safeName}')">
            <div class="combat-action-header">
                <span class="combat-action-name">${item.nombre}</span>
                ${diceStr ? `<span class="combat-action-dice">${diceStr}</span>` : ''}
                ${infoBtn}
            </div>
        </div>`;
    }

    // Helper: render leveled spells block for a section key
    function renderHechizosBlock(hechizos, sectionKey) {
        if (!hechizos.length) return '';
        initSpellSlotsForChar(charId);
        const byLevel = {};
        hechizos.forEach(sp => { const lv = sp.nivel; if (!byLevel[lv]) byLevel[lv] = []; byLevel[lv].push(sp); });
        return Object.keys(byLevel).sort((a, b) => a - b).map(lv => {
            const slotDef = _findSlotDef(data.ranuras, parseInt(lv));
            const slotName = slotDef?.nombre || `Nv${lv}`;
            const remaining = slotDef ? (spellSlotState[charId]?.[slotName] ?? slotDef.total) : null;
            const slotBadge = remaining !== null
                ? `<span class="slot-badge${remaining === 0 ? ' slot-empty' : ''}" data-slot="${slotName}">${remaining}/${slotDef.total} ranuras</span>`
                : '';
            return `<div class="hechizo-level-group">
                <div class="hechizo-level-header">Nv${lv} ${slotBadge}</div>
                ${byLevel[lv].map(item => renderActionCard(item, sectionKey)).join('')}
            </div>`;
        }).join('');
    }

    const sectionHTMLs = [];
    sections.forEach(section => {
        const items = groups[section.key];
        const trucos  = items.filter(i => !i.nivel || typeof i.nivel !== 'number');
        const hechizos = items.filter(i => i.nivel && typeof i.nivel === 'number');

        // For acciones: render attacks → modifiers → spells (each as own block)
        if (section.key === 'accion') {
            if (trucos.length > 0) {
                sectionHTMLs.push(`<div class="combat-section">
                    <div class="combat-section-title">${section.icon} ${section.label}</div>
                    <div class="combat-action-list">${trucos.map(item => renderActionCard(item, section.key)).join('')}</div>
                </div>`);
            }
            if (modifierSectionHTML) sectionHTMLs.push(modifierSectionHTML);
            const hechizosHTML = renderHechizosBlock(hechizos, section.key);
            if (hechizosHTML) {
                sectionHTMLs.push(`<div class="combat-section">
                    <div class="combat-section-title">✨ Hechizos</div>
                    <div class="combat-action-list">${hechizosHTML}</div>
                </div>`);
            }
            return;
        }

        // Adicionales / Reacciones
        if (items.length === 0) return;
        let cardsHTML = trucos.map(item => renderActionCard(item, section.key)).join('');
        cardsHTML += renderHechizosBlock(hechizos, section.key);
        sectionHTMLs.push(`<div class="combat-section">
            <div class="combat-section-title">${section.icon} ${section.label}</div>
            <div class="combat-action-list">${cardsHTML}</div>
        </div>`);
    });

    return `<div class="turn-planner">
        <div class="turn-planner-title">⚡ Planificador de Turno</div>
        <div class="planner-slots">${plannerSlotsHTML}</div>
        ${diceHTML}
    </div>
    ${slotsHTML}
    ${sectionHTMLs.join('')}`;
}

// Toggle a modifier (Divine Smite, Aura Necrótica, etc.)
function selectModifier(charId, nombre) {
    const data = window.characterData[charId];
    if (!data) return;
    if (!modifierState[charId]) modifierState[charId] = {};
    if (!modifierUsedState[charId]) modifierUsedState[charId] = {};

    const allItems = [...(data.combateExtra || []), ...(data.conjuros || [])];
    const item = allItems.find(i => i.nombre === nombre);
    if (!item) return;

    const isActive = modifierState[charId][nombre] === true;
    const isUsed   = modifierUsedState[charId][nombre] === true;

    // If 1/rest, already used, and currently inactive → can't re-activate
    if (item.descansoLargo && isUsed && !isActive) {
        showNotification('⚠️ Ya gastado. Requiere descanso largo (🌙).', 2500);
        return;
    }

    // Toggle active state
    modifierState[charId][nombre] = !isActive;

    // Mark as used when first activated (1/rest items)
    if (item.descansoLargo && !isActive) {
        modifierUsedState[charId][nombre] = true;
    }

    saveStateToStorage();
    renderCombatInline(data);
}

// Finds a slot definition by spell level, supporting both "Nv3" and warlock-style "Pacto (Nv3)"
function _findSlotDef(ranuras, nivel) {
    if (!ranuras || nivel == null) return null;
    const exact = `Nv${nivel}`;
    return ranuras.find(s => s.nombre === exact || s.nombre.includes(`(${exact})`));
}

function _restoreSpellSlot(charId, item, data) {
    if (!item?.nivel || typeof item.nivel !== 'number') return;
    initSpellSlotsForChar(charId);
    const slotDef = _findSlotDef(data.ranuras, item.nivel);
    if (slotDef) {
        const key = slotDef.nombre;
        spellSlotState[charId][key] = Math.min(slotDef.total, (spellSlotState[charId][key] ?? slotDef.total) + 1);
        saveStateToStorage();
    }
}

function selectCombatAction(charId, tipo, nombre) {
    const data = window.characterData[charId];
    if (!data) return;
    const allItems = [...(data.combateExtra || []), ...(data.conjuros || [])];
    const item = allItems.find(i => i.nombre === nombre);
    if (!item) return;
    if (!turnPlannerState[charId]) turnPlannerState[charId] = { accion: null, adicional: null, reaccion: null };
    const planner = turnPlannerState[charId];
    const wasSelected = planner[tipo] && planner[tipo].nombre === nombre;
    const prevItem = planner[tipo];

    // Restore slot of the PREVIOUS item in this slot (if switching spells)
    if (!wasSelected && prevItem && prevItem.nombre !== nombre) {
        _restoreSpellSlot(charId, prevItem, data);
    }

    planner[tipo] = wasSelected ? null : item;

    // Auto spell slot deduction for leveled spells
    if (item.nivel && typeof item.nivel === 'number') {
        initSpellSlotsForChar(charId);
        const slotDef = _findSlotDef(data.ranuras, item.nivel);
        if (slotDef) {
            const key = slotDef.nombre;
            if (wasSelected) {
                spellSlotState[charId][key] = Math.min(slotDef.total, (spellSlotState[charId][key] ?? slotDef.total) + 1);
                showNotification(`🔄 Ranura ${slotDef.nombre} restaurada`, 1500);
                saveStateToStorage();
            } else {
                const cur = spellSlotState[charId][key] ?? slotDef.total;
                if (cur <= 0) {
                    showNotification(`❌ Sin ranuras ${slotDef.nombre} disponibles`, 2000);
                    planner[tipo] = null;
                    refreshCombatSections(data);
                    return;
                }
                spellSlotState[charId][key] = cur - 1;
                showNotification(`✨ Ranura ${slotDef.nombre} gastada`, 1500);
                saveStateToStorage();
            }
        }
    }

    refreshCombatSections(data);
}

function clearPlannerSlot(charId, tipo) {
    if (!turnPlannerState[charId]) return;
    const data = window.characterData[charId];
    _restoreSpellSlot(charId, turnPlannerState[charId][tipo], data);
    turnPlannerState[charId][tipo] = null;
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
