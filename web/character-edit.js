// ============================================
// Character Edit — sheet rendering, editing, templates
// Depends on: globals.js, utils.js, storage.js, character-sheet.js
// ============================================

const skillMapping = {
    "Fuerza": ["Atletismo"],
    "Destreza": ["Acrobacias", "Juego de Manos", "Sigilo"],
    "Constitución": [],
    "Inteligencia": ["Arcanos", "Historia", "Investigación", "Naturaleza", "Religión"],
    "Sabiduría": ["Manejo de Animales", "Perspicacia", "Medicina", "Percepción", "Supervivencia"],
    "Carisma": ["Engaño", "Intimidación", "Persuación", "Interpretación"]
};

function renderCharacterSheet(charId) {
    if (!window.characterData || !window.characterData[charId]) {
        console.error('Data not found for character:', charId);
        showNotification('Datos de personaje no encontrados', 3000);
        return;
    }

    currentCharacterId = charId;
    const data = window.characterData[charId];

    // Sidebar: Portrait + Stats (Enhanced)
    const statsContainer = document.getElementById('sheetStats');
    statsContainer.innerHTML = '';

    // Portrait
    const imgUrl = data.imagen || 'assets/imagenes/placeholder.jpg';
    const imgScale = data.imagenScale || 1;
    let portraitHTML = `
        <div class="sheet-portrait-container">
            <img id="portraitImg" src="${imgUrl}" class="sheet-portrait-img" style="transform: scale(${imgScale})" onerror="this.src='https://placehold.co/400x500/1e2536/d4af37?text=Sin+Imagen'">
            ${isCharacterEditing ? `
                <div class="portrait-edit-overlay">
                    <input class="sheet-input" id="editImage" value="${data.imagen || ''}" placeholder="URL Imagen...">
                    <input type="range" id="editImageScale" min="1.0" max="3.0" step="0.1" value="${imgScale}">
                </div>` : ''}
        </div>
    `;
    statsContainer.innerHTML += portraitHTML;

    // Attributes with Skills and Saves
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stat-grid';

    for (const [stat, value] of Object.entries(data.stats)) {
        const mod = getModifier(value);
        const signedMod = mod >= 0 ? `+${mod}` : mod;

        let statHTML = `
            <div class="stat-box">
                <div class="stat-details">
                    <span class="stat-label">${stat}</span>
                    ${isCharacterEditing
                ? `<input type="number" class="sheet-input" value="${value}" data-stat="${stat}">`
                : `<span class="stat-value">${value}</span>`}
                </div>
                <div class="stat-mod">${signedMod}</div>

                <div class="stat-sublist">
                    <div class="sub-item ${data.competencias_salvacion?.includes(stat) ? 'proficient' : ''}">
                        <span>Salvación</span>
                        <span>${data.competencias_salvacion?.includes(stat) ? `+${mod + (data.resumen.Competencia || 2)}` : signedMod}</span>
                    </div>
                    ${(skillMapping[stat] || []).map(skill => {
                    const isProf = data.habilidades?.includes(skill);
                    const bonus = isProf ? mod + parseInt(data.resumen.Competencia || 2) : mod;
                    return `
                        <div class="sub-item ${isProf ? 'proficient' : ''}">
                            <span>${skill}</span>
                            <span>${bonus >= 0 ? '+' : ''}${bonus}</span>
                            ${isProf ? '<div class="prof-dot"></div>' : ''}
                        </div>`;
                }).join('')}
                </div>
            </div>
        `;
        statsGrid.innerHTML += statHTML;
    }
    statsContainer.appendChild(statsGrid);


    // Header
    if (isCharacterEditing) {
        document.getElementById('sheetName').innerHTML = `<input class="sheet-input" value="${data.nombre}" id="editName">`;
        document.getElementById('sheetRace').innerHTML = `<input class="sheet-input" value="${data.raza}" id="editRace" style="width:120px">`;
        document.getElementById('sheetClass').innerHTML = `<input class="sheet-input" value="${data.clase}" id="editClass" style="width:140px">`;
        document.getElementById('sheetLevel').innerHTML = `<input type="number" class="sheet-input" value="${data.nivel}" id="editLevel" style="width:60px">`;
    } else {
        document.getElementById('sheetName').textContent = data.nombre;
        document.getElementById('sheetRace').textContent = data.raza;
        document.getElementById('sheetClass').textContent = data.clase;
        document.getElementById('sheetLevel').textContent = data.nivel;
    }

    // HP Bar (replaces HP pill)
    const combatVitals = document.getElementById('sheetCombatVitals');
    const v = (vital, value) => isCharacterEditing
        ? `<input class="pill-edit-input" data-vital="${vital}" value="${value}" type="text">`
        : `<div class="pill-value">${value}</div>`;
    combatVitals.innerHTML = renderHpSection(charId) + `
        ${isCharacterEditing ? `
        <div class="combat-pill" style="border-left-color: #ff6666">
            <span class="pill-icon">❤️</span>
            <div>
                <div class="pill-label">HP Máx</div>
                <input class="pill-edit-input" data-vital="HP" value="${data.resumen.HP}" type="number" min="1">
            </div>
        </div>` : ''}
        <div class="combat-pill" id="pillCA" style="border-left-color: #4488ff">
            <span class="pill-icon">🛡️</span>
            <div>
                <div class="pill-label">CA</div>
                ${v('CA', data.resumen.CA)}
            </div>
        </div>
        <div class="combat-pill" style="border-left-color: #44ff88">
            <span class="pill-icon">⚡</span>
            <div>
                <div class="pill-label">Iniciativa</div>
                ${v('Iniciativa', data.resumen.Iniciativa)}
            </div>
        </div>
        <div class="combat-pill" id="pillSpeed" style="border-left-color: #ffcc44">
            <span class="pill-icon">🏃</span>
            <div>
                <div class="pill-label">Velocidad</div>
                ${v('Velocidad', data.resumen.Velocidad)}
            </div>
        </div>
        <div class="combat-pill" style="border-left-color: #aa88ff">
            <span class="pill-icon">⚔️</span>
            <div>
                <div class="pill-label">Competencia</div>
                ${v('Competencia', data.resumen.Competencia || '+2')}
            </div>
        </div>
    `;

    // Combat Planner (inline on desktop, in tab on mobile)
    renderCombatInline(data);

    // Conditions bar + character-specific buttons
    const resourcesSection = document.getElementById('sheetResources');
    resourcesSection.style.display = 'flex';
    renderDemonicSection(charId);

    // Restore demonic form visual state if active
    if (charId === 'Vel' && demonicFormState[charId]?.active) {
        updateDemonicFormDisplay(charId);
    }

    // Tab Navigation Management
    updateTabs(data);

    // Features Tab
    let featuresHTML = '<h3 class="feature-section-title">Rasgos de Clase y Raza</h3><div class="feature-grid">';

    // Skills
    if (isCharacterEditing) {
        featuresHTML += `
            <div class="feature-item" style="grid-column: 1/-1">
                <h3>Competencias (Habilidades)</h3>
                <input class="sheet-input" value="${data.habilidades.join(', ')}" id="editSkills">
                <small style="color:var(--text-secondary)">Separar por comas</small>
            </div>
        `;
    } else {
        featuresHTML += `
            <div class="feature-item">
                <h3>Competencias</h3>
                <div class="item-desc"><strong>Habilidades:</strong> ${data.habilidades.join(', ')}</div>
            </div>
        `;
    }

    // Traits
    data.rasgos.forEach((feat, index) => {
        if (isCharacterEditing) {
            featuresHTML += `
                <div class="feature-item">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                        <input class="sheet-input" value="${feat.nombre}" onchange="updateFeature(${index}, 'nombre', this.value)" style="font-weight:bold; color:var(--accent-gold)">
                        <button class="btn-delete-item" onclick="deleteFeature(${index})">×</button>
                    </div>
                    <textarea class="sheet-textarea" onchange="updateFeature(${index}, 'desc', this.value)">${feat.desc}</textarea>
                </div>
            `;
        } else {
            featuresHTML += `
                <div class="feature-item">
                    <h3>${feat.nombre}</h3>
                    <div class="item-desc">${feat.desc}</div>
                </div>
            `;
        }
    });

    if (isCharacterEditing) {
        featuresHTML += `<button class="btn-add-item" onclick="addFeature()">+ Añadir Rasgo</button>`;
    }
    featuresHTML += '</div>';
    document.getElementById('tabFeatures').innerHTML = featuresHTML;

    // Spells Tab - use rich filter view when not editing
    if (isCharacterEditing) {
        let spellsHTML = '<div class="feature-grid">';
        if (data.conjuros && data.conjuros.length > 0) {
            data.conjuros.forEach((spell, index) => {
                spellsHTML += `
                    <div class="spell-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                            <input class="sheet-input" value="${spell.nombre}" onchange="updateSpell(${index}, 'nombre', this.value)" style="font-weight:bold; color:var(--accent-gold)">
                            <button class="btn-delete-item" onclick="deleteSpell(${index})">×</button>
                        </div>
                        <input class="sheet-input" value="${spell.nivel}" onchange="updateSpell(${index}, 'nivel', this.value)" style="margin-bottom:5px; width:100px" placeholder="Nivel">
                        <textarea class="sheet-textarea" onchange="updateSpell(${index}, 'desc', this.value)">${spell.desc}</textarea>
                    </div>
                `;
            });
        }
        spellsHTML += `<button class="btn-add-item" onclick="addSpell()">+ Añadir Conjuro</button></div>`;
        document.getElementById('tabSpells').innerHTML = spellsHTML;
    } else {
        renderSpellsWithFilters(data); // includes level filters + search
    }

    // Inventory Tab - use categorized view when not editing
    if (isCharacterEditing) {
        let inventoryHTML = '<div class="feature-grid">';
        if (data.inventario && data.inventario.length > 0) {
            data.inventario.forEach((item, index) => {
                inventoryHTML += `
                    <div class="feature-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                            <input class="sheet-input" value="${item.nombre}" onchange="updateInventoryItem(${index}, 'nombre', this.value)" style="font-weight:bold; color:var(--accent-gold)">
                            <button class="btn-delete-item" onclick="deleteInventoryItem(${index})">×</button>
                        </div>
                        <textarea class="sheet-textarea" onchange="updateInventoryItem(${index}, 'desc', this.value)">${item.desc}</textarea>
                    </div>
                `;
            });
        } else {
            inventoryHTML += '<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px">El inventario está vacío.</div>';
        }
        inventoryHTML += `<button class="btn-add-item" onclick="addInventoryItem()">+ Añadir Objeto</button></div>`;
        document.getElementById('tabInventory').innerHTML = inventoryHTML;
    } else {
        renderCategorizedInventory(data, ''); // includes search + categories
    }

    // Notes tab
    const tabNotes = document.getElementById('tabNotes');
    if (tabNotes) {
        const savedNote = notesState[charId] || '';
        tabNotes.innerHTML = `
            <div class="notes-container">
                <h3 class="section-label">📝 Notas de Sesión</h3>
                <textarea class="notes-textarea" id="sessionNotesArea"
                    placeholder="Apuntes de la sesión, objetivos, cosas importantes..."
                    oninput="saveNote('${charId}', this.value)">${savedNote}</textarea>
                <div class="notes-hint">Guardado automáticamente</div>
            </div>`;
    }

    // Reset Tabs — combat is default on mobile (inline on desktop), features on desktop
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const isMobile = window.innerWidth <= 768;
    const defaultTabKey = isMobile ? 'combat' : 'features';
    const defaultBtn = document.querySelector(`.tab-btn[data-tab="${defaultTabKey}"]`);
    const defaultId = 'tab' + defaultTabKey.charAt(0).toUpperCase() + defaultTabKey.slice(1);
    if (defaultBtn) defaultBtn.classList.add('active');
    const defaultContent = document.getElementById(defaultId);
    if (defaultContent) defaultContent.classList.add('active');

    // Show Container (remove any leftover entity overlay from previous character)
    document.getElementById('entitySheetOverlay')?.remove();
    document.getElementById('characterSheetContainer').style.display = 'flex';

    // Update HUD breadcrumbs based on navigation context
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'flex';
    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.style.display = 'flex';
    const breadcrumbs = document.getElementById('breadcrumbs');
    if (breadcrumbs) {
        const shortName = data.nombre.split(' ')[0];
        if (combatModeActive) {
            breadcrumbs.textContent = `⚔️ Combate › Jugador › ${shortName}`;
        } else {
            breadcrumbs.textContent = shortName;
        }
    }
}

function setupCharacterSheetListeners() {
    // Buttons — edit only available to master
    const editBtn = document.getElementById('editCharBtn');
    const controlsBar = document.querySelector('.sheet-controls-bar');
    if (editBtn) {
        if (!isMaster()) {
            editBtn.style.display = 'none';
            if (controlsBar) controlsBar.style.display = 'none';
        } else {
            editBtn.addEventListener('click', toggleCharacterEditMode);
        }
    }

    const saveBtn = document.getElementById('saveCharBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveCharacterChanges);

    // Close Button
    document.getElementById('closeSheetBtn').addEventListener('click', () => {
        document.getElementById('characterSheetContainer').style.display = 'none';
        isCharacterEditing = false;
        // Combat mode no longer opens character sheets, so just go to characters view
    });

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            const targetId = `tab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`;

            // Toggle Buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Toggle Content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(targetId);
            if (content) content.classList.add('active');
        });
    });

    // Character Card Click Handlers
    Object.keys(window.characterData).forEach(id => {
        const card = document.getElementById(`charCard${id}`);
        if (card) {
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);

            newCard.addEventListener('click', () => {
                isCharacterEditing = false;
                renderCharacterSheet(id);
            });
        }
    });
}

function openPersonajesSection() {
    setView('characters');
    switchPersonajesTab('principales');
    loadPersonajesTemplates('aliado');
    loadPersonajesTemplates('enemigo');
}

function switchPersonajesTab(tab) {
    ['principales', 'aliados', 'enemigos', 'npcgen'].forEach(t => {
        const panel = document.getElementById(`charTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
        const btn = document.querySelector(`.char-tab-btn[data-char-tab="${t}"]`);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'principales') renderCharacterSelectionMenu();
}

function renderCharacterSelectionMenu() {
    const container = document.getElementById('characterListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!window.characterData) return;

    Object.values(window.characterData).filter(char => char.tipo === 'jugador').forEach(char => {
        const card = document.createElement('div');
        card.className = 'card character-card'; // Added class for specific styling
        card.onclick = () => {
            isCharacterEditing = false;
            renderCharacterSheet(char.id);
        };

        const imgUrl = char.imagen || 'assets/imagenes/placeholder.jpg';

        // Custom styling for image card
        card.innerHTML = `
            <div class="card-img-wrapper" style="width: 72px; height: 72px; border-radius: 50%; overflow: hidden; border: 2px solid var(--accent-gold); margin-bottom: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.5); flex-shrink: 0;">
                <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; object-position: top center;" onerror="this.src='https://placehold.co/100x100/1e2536/d4af37?text=?'">
            </div>
            <div class="card-title">${char.nombre}</div>
            <div class="char-card-meta">${char.raza} · ${char.clase}</div>
        `;
        container.appendChild(card);
    });
}

async function initPlayerCharactersFromDB() {
    try {
        const res = await fetch(`${API_BASE}/api/player-characters`);
        const data = await res.json();
        if (!data.success || !window.characterData) return;
        data.characters.forEach(c => {
            if (window.characterData[c.charId]) {
                const fresh = window.characterData[c.charId];
                // Preserve game-mechanic fields from characters.js (source of truth)
                // Only let MongoDB override user-editable display fields
                const gameFields = {
                    conjuros:     fresh.conjuros,
                    combateExtra: fresh.combateExtra,
                    ranuras:      fresh.ranuras,
                    stats:        fresh.stats,
                    resumen:      fresh.resumen,
                    rasgos:       fresh.rasgos,
                };
                Object.assign(fresh, c.data);
                Object.assign(fresh, gameFields);
            }
        });
        renderCharacterSelectionMenu();
    } catch (e) {
        // Server not available — use local defaults silently
    }
}

async function loadPersonajesTemplates(tipo) {
    const apiType = tipo === 'aliado' ? 'ALLY' : 'ENEMY';
    try {
        const res = await fetch(`${API_BASE}/api/entity-templates?type=${apiType}`);
        const data = await res.json();
        if (data.success) {
            savedTemplates[apiType] = data.templates;
            renderPersonajesTemplatesList(tipo);
        }
    } catch (e) {
        console.warn('[personajes] load failed:', e.message);
    }
}

// renderSavedTemplatesSection is defined in combat-setup.js for the combat-setup UI.
// Calls within character-edit.js use renderPersonajesTemplatesList directly.

function renderPersonajesTemplatesList(tipo) {
    const container = document.getElementById(`char${tipo.charAt(0).toUpperCase() + tipo.slice(1)}TemplatesList`);
    if (!container) return;
    const apiType = tipo === 'aliado' ? 'ALLY' : 'ENEMY';
    const templates = savedTemplates[apiType];
    if (!templates.length) {
        container.innerHTML = `<div class="npc-list-empty">No hay ${tipo}s guardados todavía</div>`;
        return;
    }
    container.innerHTML = `
        <div class="npc-existing-label">📋 ${tipo === 'aliado' ? 'Aliados' : 'Enemigos'} guardados</div>
        ${templates.map(t => {
            const badges = [
                t.isGroup && t.groupSize >= 2 ? `👥 ×${t.groupSize}` : '',
                t.isSummon ? `✨ ${t.summoner}` : '',
            ].filter(Boolean).join(' · ');
            const actStr = [t.actionsText?.acciones, t.actionsText?.adicionales, t.actionsText?.reacciones]
                .filter(Boolean).join(' | ');
            return `<div class="npc-builder-item">
                <div class="npc-item-info">
                    <span class="npc-item-name">${t.name}</span>
                    <span class="npc-item-stats">❤️ ${t.stats.hp} · 🛡️ ${t.stats.ac}${badges ? ' · ' + badges : ''}</span>
                    ${actStr ? `<span class="npc-item-actions">⚔️ ${actStr}</span>` : ''}
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="template-edit-btn" onclick="editCharTemplate('${t._id}','${tipo}')">✎</button>
                    <button class="template-faction-btn" title="${tipo === 'aliado' ? 'Mover a Enemigos' : 'Mover a Aliados'}" onclick="changeTemplateType('${t._id}','${tipo}')">${tipo === 'aliado' ? '💀' : '💙'}</button>
                    <button class="npc-remove-btn"    onclick="deletePersonajesTemplate('${t._id}','${tipo}')">🗑</button>
                </div>
            </div>`;
        }).join('')}`;
}

async function createCharTemplate(tipo) {
    const p = `char${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`;
    const nombre     = document.getElementById(`${p}Nombre`)?.value?.trim();
    const pg         = parseInt(document.getElementById(`${p}Pg`)?.value)    || 10;
    const ca         = parseInt(document.getElementById(`${p}Ca`)?.value)    || 10;
    const acciones    = document.getElementById(`${p}Acciones`)?.value?.trim()    || '';
    const adicionales = document.getElementById(`${p}Adicionales`)?.value?.trim() || '';
    const reacciones  = document.getElementById(`${p}Reacciones`)?.value?.trim()  || '';

    if (!nombre) { showNotification('⚠️ Introduce un nombre', 2000); return; }

    const rawGroupSize = parseInt(document.getElementById('charEnemigoGroupSize')?.value) || 1;
    const isGroup  = tipo === 'enemigo' && rawGroupSize >= 2;
    const groupSize = isGroup ? rawGroupSize : 1;

    const isSummon = tipo === 'aliado' && !!(document.getElementById('charAliadoEsInvocacion')?.checked);
    const summoner = isSummon ? (document.getElementById('charAliadoSumoner')?.value || '') : '';

    await fetch(`${API_BASE}/api/entity-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: nombre,
            type: tipo === 'aliado' ? 'ALLY' : 'ENEMY',
            stats: { hp: pg, ac: ca },
            actions: [],
            isGroup, groupSize, isSummon, summoner,
            actionsText: { acciones, adicionales, reacciones },
        }),
    }).catch(e => console.warn('[personajes] save failed:', e.message));

    // Clear form
    [`${p}Nombre`, `${p}Pg`, `${p}Ca`, `${p}Acciones`, `${p}Adicionales`, `${p}Reacciones`].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    if (tipo === 'enemigo') { const gs = document.getElementById('charEnemigoGroupSize'); if (gs) gs.value = ''; }
    if (tipo === 'aliado')  { const chk = document.getElementById('charAliadoEsInvocacion'); if (chk) { chk.checked = false; toggleCharSummonFields('aliado'); } }

    showNotification(`${tipo === 'aliado' ? '💙' : '💀'} ${nombre} guardado`, 1500);
    await loadPersonajesTemplates(tipo);
    // Also refresh saved templates in combat setup section if it's open
    renderPersonajesTemplatesList(tipo);
}

async function deletePersonajesTemplate(templateId, tipo) {
    try {
        await fetch(`${API_BASE}/api/entity-templates/${templateId}`, { method: 'DELETE' });
        await loadPersonajesTemplates(tipo);
    } catch (e) {
        showNotification('⚠️ Error al eliminar', 2000);
    }
}

async function changeTemplateType(templateId, currentTipo) {
    const newTipo   = currentTipo === 'aliado' ? 'enemigo' : 'aliado';
    const newApiType = newTipo === 'aliado' ? 'ALLY' : 'ENEMY';
    try {
        await fetch(`${API_BASE}/api/entity-templates/${templateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: newApiType }),
        });
        await Promise.all([loadPersonajesTemplates('aliado'), loadPersonajesTemplates('enemigo')]);
        showNotification(`${newTipo === 'aliado' ? '💙' : '💀'} Movido a ${newTipo}s`, 1500);
    } catch (e) {
        showNotification('⚠️ Error al cambiar facción', 2000);
    }
}

function editCharTemplate(templateId, tipo) {
    const apiType = tipo === 'aliado' ? 'ALLY' : 'ENEMY';
    const t = savedTemplates[apiType].find(x => x._id === templateId);
    if (!t) return;

    document.getElementById('editTemplateOverlay')?.remove();

    const groupField = tipo === 'enemigo'
        ? `<input id="etGroupSize" class="npc-input npc-input-sm" type="number" value="${t.groupSize || 1}" placeholder="Grupo (nº)" min="1" title="2+ para grupo">`
        : '';

    const overlay = document.createElement('div');
    overlay.id = 'editTemplateOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.innerHTML = `
        <div class="combat-summary-modal" style="max-width:540px;">
            <div class="combat-summary-title">${tipo === 'aliado' ? '💙' : '💀'} Editar ${tipo === 'aliado' ? 'Aliado' : 'Enemigo'}</div>
            <div class="npc-builder-row" style="margin-bottom:10px;">
                <input id="etNombre"    class="npc-input" type="text"   value="${t.name}"          placeholder="Nombre">
                <input id="etPg"        class="npc-input npc-input-sm" type="number" value="${t.stats.hp}" placeholder="PG">
                <input id="etCa"        class="npc-input npc-input-sm" type="number" value="${t.stats.ac}" placeholder="CA">
                ${groupField}
            </div>
            <div class="npc-builder-row npc-actions-row" style="margin-bottom:14px;">
                <div class="npc-action-group">
                    <label class="npc-action-label">⚔️ Acciones</label>
                    <input id="etAcciones"    class="npc-input" type="text" value="${t.actionsText?.acciones    || ''}">
                </div>
                <div class="npc-action-group">
                    <label class="npc-action-label">✚ Adicionales</label>
                    <input id="etAdicionales" class="npc-input" type="text" value="${t.actionsText?.adicionales || ''}">
                </div>
                <div class="npc-action-group">
                    <label class="npc-action-label">↩ Reacciones</label>
                    <input id="etReacciones"  class="npc-input" type="text" value="${t.actionsText?.reacciones  || ''}">
                </div>
            </div>
            <div class="combat-summary-btns">
                <button class="btn-combat-primary"   onclick="saveEditedTemplate('${templateId}','${tipo}')">💾 Guardar</button>
                <button class="btn-combat-secondary" onclick="document.getElementById('editTemplateOverlay').remove()">Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

async function saveEditedTemplate(templateId, tipo) {
    const nombre     = document.getElementById('etNombre')?.value?.trim();
    const pg         = parseInt(document.getElementById('etPg')?.value)    || 10;
    const ca         = parseInt(document.getElementById('etCa')?.value)    || 10;
    const acciones    = document.getElementById('etAcciones')?.value?.trim()    || '';
    const adicionales = document.getElementById('etAdicionales')?.value?.trim() || '';
    const reacciones  = document.getElementById('etReacciones')?.value?.trim()  || '';

    if (!nombre) { showNotification('⚠️ Introduce un nombre', 2000); return; }

    const rawGroupSize = parseInt(document.getElementById('etGroupSize')?.value) || 1;
    const isGroup  = tipo === 'enemigo' && rawGroupSize >= 2;
    const groupSize = isGroup ? rawGroupSize : 1;

    const apiType = tipo === 'aliado' ? 'ALLY' : 'ENEMY';
    const t = savedTemplates[apiType].find(x => x._id === templateId);

    try {
        const res = await fetch(`${API_BASE}/api/entity-templates/${templateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nombre, type: apiType,
                stats: { hp: pg, ac: ca },
                isGroup, groupSize,
                isSummon: !!t?.isSummon, summoner: t?.summoner || '',
                actionsText: { acciones, adicionales, reacciones },
            }),
        });
        if (!res.ok) throw new Error('Server error');
        document.getElementById('editTemplateOverlay')?.remove();
        showNotification(`💾 ${nombre} actualizado`, 1500);
        await loadPersonajesTemplates(tipo);
        renderPersonajesTemplatesList(tipo);
    } catch (e) {
        showNotification('⚠️ Error al guardar', 2000);
    }
}

function toggleCharSummonFields(tipo) {
    const checked = document.getElementById(`char${tipo.charAt(0).toUpperCase() + tipo.slice(1)}EsInvocacion`)?.checked;
    const fields  = document.getElementById(`char${tipo.charAt(0).toUpperCase() + tipo.slice(1)}SummonFields`);
    if (fields) fields.style.display = checked ? 'block' : 'none';
}

// === Edit Actions ===
function toggleCharacterEditMode() {
    isCharacterEditing = !isCharacterEditing;
    const saveBtn = document.getElementById('saveCharBtn');
    const editBtn = document.getElementById('editCharBtn');
    if (saveBtn) saveBtn.style.display = isCharacterEditing ? 'inline-flex' : 'none';
    if (editBtn) editBtn.textContent = isCharacterEditing ? '✕ Cancelar' : '✎ Editar Hoja';
    renderCharacterSheet(currentCharacterId);
}

function saveCharacterChanges() {
    const char = window.characterData[currentCharacterId];

    // Portrait
    const imageInput = document.getElementById('editImage');
    if (imageInput) char.imagen = imageInput.value;

    const scaleInput = document.getElementById('editImageScale');
    if (scaleInput) char.imagenScale = parseFloat(scaleInput.value);

    // Header
    const nameInput = document.getElementById('editName');
    if (nameInput) char.nombre = nameInput.value;

    const raceInput = document.getElementById('editRace');
    if (raceInput) char.raza = raceInput.value;

    const classInput = document.getElementById('editClass');
    if (classInput) char.clase = classInput.value;

    const levelInput = document.getElementById('editLevel');
    if (levelInput) char.nivel = parseInt(levelInput.value) || 1;

    // Stats
    document.querySelectorAll('[data-stat]').forEach(input => {
        char.stats[input.dataset.stat] = parseInt(input.value) || 10;
    });

    // Vitals
    document.querySelectorAll('[data-vital]').forEach(input => {
        char.resumen[input.dataset.vital] = input.value;
    });

    // Sync hpState.max if HP max changed
    const newMaxHp = parseInt(char.resumen.HP);
    if (hpState[currentCharacterId] && newMaxHp > 0) {
        hpState[currentCharacterId].max = newMaxHp;
        if (hpState[currentCharacterId].current > newMaxHp) {
            hpState[currentCharacterId].current = newMaxHp;
        }
        saveStateToStorage();
    }

    // Inventory is updated in real-time via updateInventoryItem, no need to gather here
    // unless we change the strategy, but for consistency with traits/spells:
    // traits/spells are also updated in real-time.

    // Skills
    const skillsInput = document.getElementById('editSkills');
    if (skillsInput) {
        char.habilidades = skillsInput.value.split(',').map(s => s.trim()).filter(s => s);
    }

    isCharacterEditing = false;
    const saveBtn = document.getElementById('saveCharBtn');
    const editBtn = document.getElementById('editCharBtn');
    if (saveBtn) saveBtn.style.display = 'none';
    if (editBtn) editBtn.textContent = '✎ Editar Hoja';
    renderCharacterSheet(currentCharacterId);
    renderCharacterSelectionMenu();

    // Persist to DB
    fetch(`${API_BASE}/api/player-characters/${currentCharacterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: window.characterData[currentCharacterId] }),
    }).then(() => showNotification('💾 Cambios guardados', 2000))
      .catch(() => showNotification('💾 Guardado localmente (sin conexión al servidor)', 2500));
}

function updateFeature(index, field, value) {
    if (window.characterData[currentCharacterId].rasgos[index])
        window.characterData[currentCharacterId].rasgos[index][field] = value;
}

function deleteFeature(index) {
    if (confirm('¿Borrar rasgo?')) {
        window.characterData[currentCharacterId].rasgos.splice(index, 1);
        renderCharacterSheet(currentCharacterId);
    }
}

function addFeature() {
    window.characterData[currentCharacterId].rasgos.push({ nombre: 'Nuevo Rasgo', desc: 'Descripción' });
    renderCharacterSheet(currentCharacterId);
}

function updateSpell(index, field, value) {
    if (window.characterData[currentCharacterId].conjuros[index])
        window.characterData[currentCharacterId].conjuros[index][field] = value;
}

function deleteSpell(index) {
    if (confirm('¿Borrar conjuro?')) {
        window.characterData[currentCharacterId].conjuros.splice(index, 1);
        renderCharacterSheet(currentCharacterId);
    }
}

function addSpell() {
    if (!window.characterData[currentCharacterId].conjuros) window.characterData[currentCharacterId].conjuros = [];
    window.characterData[currentCharacterId].conjuros.push({ nombre: 'Nuevo Conjuro', nivel: '1', desc: 'Descripción' });
    renderCharacterSheet(currentCharacterId);
}

function updateInventoryItem(index, field, value) {
    if (window.characterData[currentCharacterId].inventario[index])
        window.characterData[currentCharacterId].inventario[index][field] = value;
}

function deleteInventoryItem(index) {
    if (confirm('¿Borrar objeto del inventario?')) {
        window.characterData[currentCharacterId].inventario.splice(index, 1);
        renderCharacterSheet(currentCharacterId);
    }
}

function addInventoryItem() {
    if (!window.characterData[currentCharacterId].inventario) window.characterData[currentCharacterId].inventario = [];
    window.characterData[currentCharacterId].inventario.push({ nombre: 'Nuevo Objeto', desc: 'Descripción' });
    renderCharacterSheet(currentCharacterId);
}

function exportCharacters() {
    const dataStr = "window.characterData = " + JSON.stringify(window.characterData, null, 4) + ";";
    const blob = new Blob([dataStr], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'characters.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Archivo characters.js descargado. Guárdalo en la carpeta del proyecto.', 5000);
}
