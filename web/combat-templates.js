// ============================================
// Combat Templates — entity templates, combat presets, buildSirvienteCharData
// Depends on: globals.js, utils.js, storage.js, combat-setup.js
// ============================================

// ---- One-time migration: CombatTemplate NPCs → EntityTemplate ----

const _shouldMigrateNpc = n => !n.isSummon && !n._useExistingCharData && n.nombre;

function _npcToEntityTemplateBody(n) {
    return JSON.stringify({
        name:       n.nombre,
        type:       n.tipo === 'aliado' ? 'ALLY' : 'ENEMY',
        stats:      { hp: n.pg || 10, ac: n.ca || 10 },
        actions:    [],
        isGroup:    !!n.isGroup,
        groupSize:  n.groupSize || 1,
        isSummon:   false,
        summoner:   '',
        actionsText: {
            acciones:    n.acciones    || '',
            adicionales: n.adicionales || '',
            reacciones:  n.reacciones  || '',
        },
        imagen: n.imagen || '',
    });
}

let _npcMigrationDone = false;

async function migrateEncounterNpcsToTemplates() {
    if (_npcMigrationDone) return;
    _npcMigrationDone = true;
    try {
        const res = await fetch(`${API_BASE}/api/combat-templates`);
        if (!res.ok) return;
        const { templates } = await res.json();
        const allNpcs = (templates || []).flatMap(t => (t.npcs || []).filter(_shouldMigrateNpc));
        if (!allNpcs.length) return;
        await Promise.all(allNpcs.map(n =>
            fetch(`${API_BASE}/api/entity-templates`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    _npcToEntityTemplateBody(n),
            }).catch(() => {})
        ));
    } catch (e) {
        console.warn('[migrate encounters]', e.message);
    }
}

// ---- Saved Templates (DB) ----

async function loadSavedTemplates(tipo) {
    const apiType = tipo === 'aliado' ? 'ALLY' : 'ENEMY';
    try {
        const res = await fetch(`${API_BASE}/api/entity-templates?type=${apiType}`);
        const data = await res.json();
        if (data.success) {
            savedTemplates[apiType] = data.templates;
            renderSavedTemplatesSection(tipo);
            renderPersonajesTemplatesList(tipo);
        }
    } catch (e) {
        console.warn('[entity-templates] load failed:', e.message);
    }
}

function _renderTemplateCard(t, tipo) {
    const selectedNpc = setupNpcs.find(n => n._templateId === t._id);
    const isSelected = !!selectedNpc;
    const initVal = selectedNpc?.initiative ?? '';
    const badges = [
        t.isGroup && t.groupSize >= 2 ? `👥 ×${t.groupSize}` : '',
        t.isSummon ? `✨ ${t.summoner}` : '',
    ].filter(Boolean).join(' · ');
    const actStr = [t.actionsText?.acciones, t.actionsText?.adicionales, t.actionsText?.reacciones]
        .filter(Boolean).join(' | ');
    return `<div class="template-card${isSelected ? ' template-card--selected' : ''}"
                 onclick="toggleTemplateInCombat('${t._id}','${tipo}')">
        <div class="template-card-info">
            <span class="template-card-name">${t.name}</span>
            <span class="template-card-stats">❤️ ${t.stats.hp} · 🛡️ ${t.stats.ac}${badges ? ' · ' + badges : ''}</span>
            ${actStr ? `<span class="template-card-acts">⚔️ ${actStr}</span>` : ''}
        </div>
        <div class="template-card-controls" onclick="event.stopPropagation()">
            <input type="number" class="setup-init-input" placeholder="Init"
                   id="tInit_${t._id}" min="-5" max="30" value="${initVal}"
                   oninput="updateTemplateInitiative('${t._id}', this.value)">
            ${isSelected
                ? `<span class="template-selected-badge">✓</span>`
                : `<span class="template-unselected-hint">＋</span>`}
            <button class="template-delete-btn"
                    onclick="event.stopPropagation();deleteEntityTemplate('${t._id}','${tipo}')">🗑</button>
        </div>
    </div>`;
}

function renderSavedTemplatesSection(tipo) {
    const container = document.getElementById(`${tipo}SavedTemplates`);
    if (!container) return;
    const apiType = tipo === 'aliado' ? 'ALLY' : 'ENEMY';
    const templates = savedTemplates[apiType];
    if (!templates.length) {
        container.innerHTML = `<div class="setup-empty-hint">No hay plantillas. Crea una desde Personajes → ${tipo === 'aliado' ? 'Aliados' : 'Enemigos'}.</div>`;
        return;
    }
    container.innerHTML = `
        <div class="saved-templates-grid">
            ${templates.map(t => _renderTemplateCard(t, tipo)).join('')}
        </div>`;
}

function toggleTemplateInCombat(templateId, tipo) {
    const apiType = tipo === 'aliado' ? 'ALLY' : 'ENEMY';
    const t = savedTemplates[apiType].find(x => x._id === templateId);
    if (!t) return;

    const existingIdx = setupNpcs.findIndex(n => n._templateId === templateId);
    if (existingIdx >= 0) {
        setupNpcs.splice(existingIdx, 1);
    } else {
        const initEl = document.getElementById(`tInit_${templateId}`);
        const initiative = parseInt(initEl?.value) || 0;
        setupNpcs.push({
            _templateId: templateId,
            tipo,
            nombre:      t.name,
            pg:          t.stats.hp,
            ca:          t.stats.ac,
            initiative,
            acciones:    t.actionsText?.acciones    || '',
            adicionales: t.actionsText?.adicionales || '',
            reacciones:  t.actionsText?.reacciones  || '',
            isGroup:   !!t.isGroup,
            groupSize: t.groupSize || 1,
            isSummon:  !!t.isSummon,
            summoner:  t.summoner || '',
            summonedBeforeCombat: !!t.isSummon,
            imagen:    t.imagen || '',
        });
    }
    renderSavedTemplatesSection(tipo);
    _updateSetupCount();
}

function updateTemplateInitiative(templateId, value) {
    const npc = setupNpcs.find(n => n._templateId === templateId);
    if (npc) npc.initiative = parseInt(value) || 0;
}

async function deleteEntityTemplate(templateId, tipo) {
    try {
        await fetch(`${API_BASE}/api/entity-templates/${templateId}`, { method: 'DELETE' });
        await loadSavedTemplates(tipo);
    } catch (e) {
        showNotification('⚠️ Error al eliminar plantilla', 2000);
    }
}

function toggleSetupGroupFields(tipo) {
    const checked = document.getElementById(`${tipo}EsGrupo`)?.checked;
    const fields  = document.getElementById(`${tipo}GroupFields`);
    if (fields) fields.style.display = checked ? 'flex' : 'none';
}

function toggleSetupSummonFields(tipo) {
    const checked = document.getElementById(`${tipo}EsInvocacion`)?.checked;
    const fields  = document.getElementById(`${tipo}SummonFields`);
    if (fields) fields.style.display = checked ? 'block' : 'none';
}

// ── Entity Template: save to backend catalog ─────────────────────────────────
async function _saveEntityTemplate({ name, type, stats, actions, isGroup, groupSize, isSummon, summoner, actionsText, imagen }) {
    try {
        await fetch(`${API_BASE}/api/entity-templates`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, stats, actions, isGroup, groupSize, isSummon, summoner, actionsText, imagen: imagen || '' }),
        });
        const tipo = type === 'ALLY' ? 'aliado' : 'enemigo';
        await loadSavedTemplates(tipo);
    } catch (e) {
        console.warn('[entity-templates] save failed:', e.message);
    }
}

function buildSirvienteCharData(ac) {
    return {
        nombre: 'Sirviente Invisible',
        clase: 'Familiar',
        nivel: 1,
        tipo: 'aliado',
        imagen: null,
        combateExtra: [
            {
                nombre: 'Hacha de mano',
                tipo: 'accion',
                atk: '+7',
                dado: '1d8+5',
                desc: 'Daño divino. Siempre ataca con ventaja (invisible).'
            },
            {
                nombre: 'Hacha de mano',
                tipo: 'adicional',
                atk: '+5',
                dado: '1d8+5',
                desc: 'Acción adicional. Daño divino.'
            },
            {
                nombre: 'Daga',
                tipo: 'accion',
                atk: '+7',
                dado: '1d4',
                desc: 'El próximo aliado ataca con ventaja contra ese objetivo.'
            },
            {
                nombre: 'Ventaja / Desventaja',
                tipo: 'accion',
                atk: '',
                dado: '',
                desc: 'Genera ventaja o desventaja en un objetivo (sin tirada).'
            }
        ],
        conjuros: []
    };
}

// ── Combat Templates (saved encounter presets, persisted in DB) ──────────────

window.saveCombatTemplate = async function () {
    const total = combatState.selectedIds.length + setupNpcs.length;
    if (total < 1) {
        showNotification('Selecciona al menos 1 participante para guardar', 2500);
        return;
    }
    const name = prompt('Nombre de la plantilla de combate:');
    if (!name?.trim()) return;

    try {
        const res = await fetch(`${API_BASE}/api/combat-templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name.trim(),
                selectedIds: [...combatState.selectedIds],
                npcs: setupNpcs.map(n => {
                    const { charData, ...rest } = n;
                    const isKnown = charData && window.characterData[n.id];
                    return isKnown ? rest : { ...rest, charData: charData ? { ...charData } : null };
                }),
                initiatives: { ...setupInitiatives },
            }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        showNotification('💾 Plantilla guardada en Encuentros', 2000);
    } catch (err) {
        showNotification('Error al guardar plantilla: ' + err.message, 3000);
    }
};

window.loadCombatTemplate = async function (id) {
    try {
        const res = await fetch(`${API_BASE}/api/combat-templates/${id}`);
        if (!res.ok) throw new Error('Plantilla no encontrada');
        const { template: tpl } = await res.json();

        combatState.selectedIds = [...(tpl.selectedIds || [])];
        setupInitiatives = { ...(tpl.initiatives || {}) };
        setupNpcs = (tpl.npcs || []).map(n => ({
            ...n,
            charData: n.charData || window.characterData[n.id] || { combateExtra: [], conjuros: [] },
        }));

        // Migrate combat template NPCs into EntityTemplate so they appear in both sections
        const npcsToMigrate = (tpl.npcs || []).filter(_shouldMigrateNpc);
        if (npcsToMigrate.length) {
            await Promise.all(npcsToMigrate.map(n =>
                fetch(`${API_BASE}/api/entity-templates`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    _npcToEntityTemplateBody(n),
                }).catch(e => console.warn('[migrate npc]', e.message))
            ));
        }

        // Always start a fresh online session when launching from a saved template
        clearOnlineSession();
        isOnlineCombat = true;
        gameRole = { type: 'master', characterId: null };
        localStorage.setItem(ROLE_KEY, JSON.stringify(gameRole));
        updateRoleIndicator();

        combatModeActive = true;
        setView('combatSetup');
        switchCombatSetupTab('jugadores');
        renderCombatSetup();
        loadSavedTemplates('aliado');
        loadSavedTemplates('enemigo');
        showNotification(`📋 Plantilla "${tpl.name}" cargada`, 2000);
    } catch (err) {
        showNotification('Error al cargar plantilla: ' + err.message, 3000);
    }
};

window.deleteCombatTemplate = async function (id) {
    try {
        const res = await fetch(`${API_BASE}/api/combat-templates/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error);
        window.renderCombatTemplatesList();
    } catch (err) {
        showNotification('Error al eliminar plantilla: ' + err.message, 3000);
    }
};

window.renderCombatTemplatesList = async function () {
    const section = document.getElementById('combatTemplatesSection');
    const container = document.getElementById('combatTemplatesContainer');
    if (!section || !container) return;

    try {
        const res = await fetch(`${API_BASE}/api/combat-templates`);
        const { templates } = await res.json();

        section.style.display = templates.length ? 'block' : 'none';
        if (!templates.length) return;

        container.innerHTML = templates.map(tpl => {
            const date = new Date(tpl.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            const count = (tpl.selectedIds?.length || 0) + (tpl.npcs?.length || 0);
            return `<div class="combat-template-item">
                <div class="tpl-info">
                    <span class="tpl-name">${tpl.name}</span>
                    <span class="tpl-meta">${count} participantes · ${date}</span>
                </div>
                <div class="tpl-actions">
                    <button class="btn-combat-primary" style="padding:6px 14px;font-size:13px" onclick="loadCombatTemplate('${tpl._id}')">▶ Jugar</button>
                    <button class="btn-danger" style="padding:6px 10px;font-size:13px" onclick="deleteCombatTemplate('${tpl._id}')">🗑</button>
                </div>
            </div>`;
        }).join('');
    } catch {
        section.style.display = 'none';
    }
};
