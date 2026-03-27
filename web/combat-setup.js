// ============================================
// Combat Setup — participant selection, initiative, NPC setup
// Depends on: globals.js, utils.js, storage.js
// Runtime deps: setView, renderCombatManager, renderCombatLog,
//   renderCombatShareLink, isMaster
// ============================================

function showCombatSetup() {
    combatModeActive = true;
    if (!isMaster()) {
        showPlayerCombat();
        return;
    }
    setupNpcs = [];
    setupInitiatives = {};
    combatState.selectedIds = [];
    combatState.combatMap = { id: null, name: '', url: '' };
    _cachedServerMaps = null; // force re-fetch on next map tab visit
    setView('combatSetup');
    switchCombatSetupTab('jugadores');
    renderCombatSetup();
    loadSavedTemplates('aliado');
    loadSavedTemplates('enemigo');
}

// Jugador personal turn manager — completely independent from master
function showPlayerCombat() {
    const myId = gameRole.characterId;
    const cd = window.characterData?.[myId];
    if (!cd) { showNotification('Personaje no encontrado', 2000); return; }

    const maxHp = parseInt(cd.resumen?.HP) || 10;
    combatState.participants = [{
        id: myId,
        name: cd.nombre,
        tipo: cd.tipo || 'jugador',
        initiative: 0,
        hp: { current: maxHp, max: maxHp },
        ac: cd.resumen?.CA || '10',
        baseAc: cd.resumen?.CA || '10',
        speed: cd.resumen?.Velocidad || '30ft',
        baseSpeed: cd.resumen?.Velocidad || '30ft',
        conditions: [],
        note: '',
        charData: cd,
        customActions: [],
        demonicForm: false,
    }];
    combatState.currentIndex = 0;
    combatState.round = 1;
    combatState.isActive = true;
    combatState.segundaAccionTurn = false;
    combatState.log = [];
    combatState.nextLogId = 1;
    createCurrentTurnEntry();
    setView('combatManager');
    renderCombatManager();
}

function showCombatMode() {
    // Keep alias for landing card listener
    showCombatSetup();
}

function goToCombatInitiative() {
    if (combatState.selectedIds.length < 2) {
        showNotification('Selecciona al menos 2 participantes', 2500);
        return;
    }
    // Build participant list from selectedIds
    combatState.participants = combatState.selectedIds.map(id => {
        const char = window.characterData[id];
        const maxHp = parseInt(char.resumen?.HP) || 10;
        return {
            id,
            name: char.nombre,
            initiative: null,
            hp: { current: maxHp, max: maxHp },
            ac: char.resumen?.CA || '10',
            baseAc: char.resumen?.CA || '10',
            speed: char.resumen?.Velocidad || '30ft',
            baseSpeed: char.resumen?.Velocidad || '30ft',
            conditions: [],
            note: '',
            charData: char,
            demonicForm: false,
            tipo: char.tipo || 'jugador',
            customActions: [],
        };
    });
    setView('combatInit');
    renderCombatInitiative();
}

function beginCombat() {
    const missing = combatState.participants.filter(p => p.initiative === null);
    if (missing.length > 0) {
        showNotification(`Faltan iniciativas: ${missing.map(p => p.name.split(' ')[0]).join(', ')}`, 3000);
        return;
    }
    // Sort descending by initiative
    combatState.participants.sort((a, b) => b.initiative - a.initiative);
    combatState.currentIndex = 0;
    combatState.round = 1;
    combatState.isActive = true;
    combatState.log = [];
    combatState.nextLogId = 0;
    createCurrentTurnEntry();
    saveCombatState();
    setView('combatManager');
    renderCombatManager();
    if (isOnlineCombat) startCombatSession(); // solo en modo online: crear sesión en BD
}

function parseSetupActions(str, tipo) {
    if (!str?.trim()) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
        // Format: "Name +hit/dado" | "Name +hit" | "Name 1d6+2" | "Name"
        const m1 = s.match(/^(.+?)\s+([+-]\d+)(?:\/(\S+))?$/);
        if (m1) return { nombre: m1[1].trim(), tipo, atk: m1[2], dado: m1[3] || '', desc: '' };
        const m2 = s.match(/^(.+?)\s+(\d+d\d+\S*)$/);
        if (m2) return { nombre: m2[1].trim(), tipo, atk: '', dado: m2[2], desc: '' };
        return { nombre: s.trim(), tipo, atk: '', dado: '', desc: '' };
    });
}

function beginCombatFromSetup() {
    const total = combatState.selectedIds.length + setupNpcs.length;
    if (total < 1) {
        showNotification('Selecciona o añade al menos 1 participante', 2500);
        return;
    }

    // Validate: selected jugadores/aliados/enemigos need initiatives
    const missingInit = combatState.selectedIds.filter(id => {
        const val = setupInitiatives[id];
        return val === null || val === undefined || isNaN(val);
    });
    if (missingInit.length > 0) {
        const names = missingInit.map(id => window.characterData[id]?.nombre || id).join(', ');
        showNotification(`⚠️ Falta iniciativa para: ${names}`, 3000);
        return;
    }

    // Build participants from selected existing characters
    const participants = combatState.selectedIds.map(id => {
        const char = window.characterData[id];
        const maxHp = parseInt(char.resumen?.HP) || 10;
        return {
            id,
            name: char.nombre,
            initiative: setupInitiatives[id] || 0,
            hp: { current: maxHp, max: maxHp },
            ac: char.resumen?.CA || '10',
            baseAc: char.resumen?.CA || '10',
            speed: char.resumen?.Velocidad || '30ft',
            baseSpeed: char.resumen?.Velocidad || '30ft',
            conditions: [],
            note: '',
            charData: char,
            demonicForm: false,
            tipo: char.tipo || 'jugador',
            customActions: [],
        };
    });

    // Add setup NPCs
    setupNpcs.forEach(npc => {
        const uid     = npc._uid || `setup_${npc.tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const isGroup   = !!npc.isGroup;
        const groupSize = isGroup ? (npc.groupSize || 2) : 1;
        const totalHp   = isGroup ? npc.pg * groupSize : npc.pg;

        // Special summons (sirviente, invocaciones) pre-register their charData
        // in window.characterData; re-use it directly instead of building from text fields.
        let charData;
        if (npc._useExistingCharData && window.characterData[uid]) {
            charData = window.characterData[uid];
        } else {
            const combateExtra = [
                ...parseSetupActions(npc.acciones    || '', 'accion'),
                ...parseSetupActions(npc.adicionales || '', 'adicional'),
                ...parseSetupActions(npc.reacciones  || '', 'reaccion'),
            ];
            charData = {
                id: uid, tipo: npc.tipo, nombre: npc.nombre,
                clase: npc.tipo === 'aliado' ? 'Aliado' : 'Enemigo',
                nivel: '—', imagen: '',
                resumen: { HP: String(totalHp), CA: String(npc.ca), Velocidad: '30ft' },
                combateExtra, conjuros: [],
            };
            window.characterData[uid] = charData;
        }

        participants.push({
            id: uid, name: npc.nombre,
            initiative: npc.initiative,
            hp: { current: totalHp, max: totalHp },
            ac: String(npc.ca), baseAc: String(npc.ca),
            speed: '30ft', baseSpeed: '30ft',
            conditions: [], note: '', charData,
            demonicForm: false, tipo: npc.tipo, customActions: [],
            // Group fields
            isGroup, groupSize,
            membersRemaining: groupSize,
            hpPerMember:      npc.pg,
            totalHp,
            currentMemberHp:  npc.pg,
            // Summon fields
            isSummon:             !!npc.isSummon,
            summoner:             npc.summoner || '',
            summonedBeforeCombat: !!npc.summonedBeforeCombat,
            // Special flags (sirviente invisible)
            ...(npc._isSirvienteInvisible ? { _isSirvienteInvisible: true } : {}),
        });
    });

    // Sort by initiative descending
    participants.sort((a, b) => b.initiative - a.initiative);

    // Reposition pre-combat summons right after their summoner
    _insertPreCombatSummons(participants);

    // Capture final map name from input (user may have typed it after selecting)
    const mapNameInput = document.getElementById('setupMapNameInput');
    if (mapNameInput && mapNameInput.value.trim()) {
        combatState.combatMap = { ...combatState.combatMap, name: mapNameInput.value.trim() };
    }

    // Start combat
    Object.assign(combatState, {
        participants,
        selectedIds: [],
        currentIndex: 0,
        round: 1,
        isActive: true,
        log: [],
        nextLogId: 0,
        segundaAccionTurn: false,
    });

    // Clear setup state
    setupNpcs = [];
    setupInitiatives = {};

    createCurrentTurnEntry();
    saveCombatState();
    setView('combatManager');
    renderCombatManager();
    if (isOnlineCombat) startCombatSession(); // solo en modo online: crear sesión en BD
}

// ── Pre-combat summon positioning ─────────────────────────────────────────────
// Repositions pre-combat summons right after their summoner in the initiative order.
// Must be called AFTER participants are sorted by initiative.
function _insertPreCombatSummons(participants) {
    const summons = participants.filter(p => p.isSummon && p.summonedBeforeCombat);
    if (!summons.length) return;

    summons.forEach(summon => {
        const idx = participants.indexOf(summon);
        if (idx === -1) return;
        participants.splice(idx, 1); // remove from current position

        // Find the summoner participant
        const summonerP = participants.find(p => {
            if (summon.summoner === 'ASTHOR') {
                return p.id === 'Vel'  || p.charData?.id === 'Vel'  || p.name === 'Vel';
            }
            if (summon.summoner === 'ZERO') {
                return p.id === 'Zero' || p.charData?.id === 'Zero' || p.name === 'Zero';
            }
            return false;
        });

        if (summonerP) {
            const summonerIdx = participants.indexOf(summonerP);
            participants.splice(summonerIdx + 1, 0, summon);
        } else {
            // Summoner not found in combat → push at end
            participants.push(summon);
        }
    });
}

// ---- Setup Screen ----
const COMBAT_CATEGORIES = [
    { tipo: 'jugador', icon: '🗡️', label: 'Jugadores Principales', color: 'var(--accent-gold)' },
    { tipo: 'aliado',  icon: '🤝', label: 'Aliados y NPCs',         color: '#4488ff'            },
    { tipo: 'enemigo', icon: '💀', label: 'Enemigos',                color: '#cc3333'            },
];

function renderCombatSelectCard(char) {
    // Legacy card (still used in some paths) — delegates to new version
    return renderCombatSetupCard(char);
}

function renderCombatSetupCard(char) {
    const isSelected = combatState.selectedIds.includes(char.id);
    const initVal = setupInitiatives[char.id] ?? '';
    return `<div class="combat-select-card setup-char-card${isSelected ? ' selected' : ''}"
                 onclick="toggleCombatParticipant('${char.id}')">
        <div class="combat-select-portrait">
            <img src="${char.imagen || ''}" onerror="this.style.display='none'">
        </div>
        <div class="combat-select-info">
            <div class="combat-select-name">${char.nombre}</div>
            <div class="combat-select-meta">${char.clase || ''} · Nv ${char.nivel || '?'}</div>
            <div class="combat-select-vitals">❤️ ${char.resumen?.HP || '?'} · 🛡️ ${char.resumen?.CA || '?'}</div>
        </div>
        <div class="setup-card-right" onclick="event.stopPropagation()">
            <div class="combat-select-check">${isSelected ? '✓' : ''}</div>
            <div class="setup-init-wrap">
                <label class="setup-init-label">Init</label>
                <input type="number" class="setup-init-input"
                       placeholder="—" min="-5" max="30"
                       value="${initVal}"
                       oninput="setSetupJugadorInitiative('${char.id}', this.value)">
            </div>
        </div>
    </div>`;
}

function renderCombatSetup() {
    if (!window.characterData) return;
    const chars = Object.values(window.characterData);

    // --- Jugadores tab ---
    const grid = document.getElementById('combatParticipantGrid');
    if (grid) {
        const jugadores = chars.filter(c => c.tipo === 'jugador');
        grid.innerHTML = jugadores.length
            ? jugadores.map(renderCombatSetupCard).join('')
            : `<div class="combat-category-empty">No hay jugadores disponibles</div>`;
    }

    // --- Existing aliados / enemigos in their tabs ---
    const aliadoGrid = document.getElementById('aliadoExistingGrid');
    if (aliadoGrid) {
        const aliados = chars.filter(c => c.tipo === 'aliado');
        aliadoGrid.style.display = aliados.length ? 'flex' : 'none';
        aliadoGrid.innerHTML = aliados.length
            ? `<div class="npc-existing-label">📋 Personajes existentes</div>` +
              aliados.map(renderCombatSetupCard).join('')
            : '';
    }
    renderSpecialSummonsSection();
    const enemigoGrid = document.getElementById('enemigoExistingGrid');
    if (enemigoGrid) {
        const enemigos = chars.filter(c => c.tipo === 'enemigo');
        enemigoGrid.style.display = enemigos.length ? 'flex' : 'none';
        enemigoGrid.innerHTML = enemigos.length
            ? `<div class="npc-existing-label">📋 Personajes existentes</div>` +
              enemigos.map(renderCombatSetupCard).join('')
            : '';
    }

    _updateSetupCount();
}

function toggleCombatParticipant(charId) {
    const idx = combatState.selectedIds.indexOf(charId);
    if (idx >= 0) combatState.selectedIds.splice(idx, 1);
    else combatState.selectedIds.push(charId);
    renderCombatSetup();
}

// ── Special Summons Section (Setup screen — Aliados tab) ──────────────────────
// Renders the Sirviente Invisible (if Vel selected) and Zero's invocaciones
// (if Zero selected) as selectable cards above the NPC list.

function _buildInvocacionActions(inv) {
    const atkStr  = inv.ataque || '';
    const atkMatch  = atkStr.match(/([+-]\d+)/);
    const dadoMatch = atkStr.match(/\(([^)]+)\)/);
    return [{
        nombre: inv.nombre,
        tipo:   'accion',
        atk:    atkMatch  ? atkMatch[1]  : '',
        dado:   dadoMatch ? dadoMatch[1] : atkStr,
        desc:   (inv.habilidades || []).join(' / '),
    }];
}

function renderSpecialSummonsSection() {
    const el = document.getElementById('specialSummonsSection');
    if (!el) return;

    const velSelected  = combatState.selectedIds.includes('Vel');
    const zeroSelected = combatState.selectedIds.includes('Zero');
    if (!velSelected && !zeroSelected) { el.innerHTML = ''; return; }

    const hasZeroSummon = setupNpcs.some(n => n.isSummon && n.summoner === 'ZERO');
    const hasSirviente  = setupNpcs.some(n => n.isSummon && n.summoner === 'ASTHOR');

    let cards = '';

    // ── Sirviente Invisible (Vel) ─────────────────────────────────────────────
    if (velSelected) {
        const velAc = parseInt(window.characterData['Vel']?.resumen?.CA) || 16;
        if (hasSirviente) {
            cards += `
            <div class="special-summon-card summon-card-done">
                <div class="ssc-header">
                    <span class="ssc-emoji">👻</span>
                    <div class="ssc-info">
                        <div class="ssc-name">Sirviente Invisible</div>
                        <div class="ssc-stats">PG 1 · CA ${velAc} · Familiar de Vel</div>
                    </div>
                </div>
                <span class="ssc-badge">✓ Añadido</span>
            </div>`;
        } else {
            cards += `
            <div class="special-summon-card">
                <div class="ssc-header">
                    <span class="ssc-emoji">👻</span>
                    <div class="ssc-info">
                        <div class="ssc-name">Sirviente Invisible</div>
                        <div class="ssc-stats">PG 1 · CA ${velAc} · Familiar de Vel</div>
                        <div class="ssc-atq">⚔️ Hacha de mano +7/1d8+5 · Daga +7/1d4</div>
                    </div>
                </div>
                <div class="ssc-footer">
                    <input type="number" id="sirvienteInit" class="npc-input npc-input-sm"
                           value="0" style="width:64px" placeholder="Init">
                    <button class="btn-combat-secondary ssc-add-btn"
                            onclick="addSpecialSummonToSetup('sirviente', null)">+ Añadir</button>
                </div>
            </div>`;
        }
    }

    // ── Zero's invocaciones ───────────────────────────────────────────────────
    if (zeroSelected) {
        const invocaciones = window.characterData['Zero']?.invocaciones || [];
        invocaciones.forEach(inv => {
            const thisAdded = setupNpcs.some(n => n.isSummon && n.summoner === 'ZERO' && n._invId === inv.id);
            if (thisAdded) {
                cards += `
                <div class="special-summon-card summon-card-done">
                    <div class="ssc-header">
                        <span class="ssc-emoji">${inv.emoji}</span>
                        <div class="ssc-info">
                            <div class="ssc-name">${inv.nombre}</div>
                            <div class="ssc-stats">PG ${inv.hp} · CA ${inv.ca} · ${inv.velocidad}</div>
                            <div class="ssc-atq">⚔️ ${inv.ataque}</div>
                        </div>
                    </div>
                    <span class="ssc-badge">✓ Añadido</span>
                </div>`;
            } else if (hasZeroSummon) {
                cards += `
                <div class="special-summon-card summon-card-locked">
                    <div class="ssc-header">
                        <span class="ssc-emoji">${inv.emoji}</span>
                        <div class="ssc-info">
                            <div class="ssc-name">${inv.nombre}</div>
                            <div class="ssc-stats">PG ${inv.hp} · CA ${inv.ca} · ${inv.velocidad}</div>
                            <div class="ssc-atq">⚔️ ${inv.ataque}</div>
                        </div>
                    </div>
                    <span class="ssc-badge ssc-badge-locked">🔒 Ocupado</span>
                </div>`;
            } else {
                cards += `
                <div class="special-summon-card">
                    <div class="ssc-header">
                        <span class="ssc-emoji">${inv.emoji}</span>
                        <div class="ssc-info">
                            <div class="ssc-name">${inv.nombre}</div>
                            <div class="ssc-stats">PG ${inv.hp} · CA ${inv.ca} · ${inv.velocidad}</div>
                            <div class="ssc-atq">⚔️ ${inv.ataque}</div>
                        </div>
                    </div>
                    <div class="ssc-footer">
                        <input type="number" id="inv_init_${inv.id}" class="npc-input npc-input-sm"
                               value="0" style="width:64px" placeholder="Init">
                        <button class="btn-combat-secondary ssc-add-btn"
                                onclick="addSpecialSummonToSetup('invocacion', '${inv.id}')">+ Añadir</button>
                    </div>
                </div>`;
            }
        });
    }

    el.innerHTML = `
    <div class="special-summons-section">
        <div class="npc-existing-label">✨ Invocaciones especiales</div>
        <div class="special-summons-grid">${cards}</div>
    </div>`;
}

function addSpecialSummonToSetup(type, invId) {
    if (type === 'sirviente') {
        if (setupNpcs.some(n => n.isSummon && n.summoner === 'ASTHOR')) {
            showNotification('El Sirviente ya está añadido', 2000);
            return;
        }
        const velAc     = parseInt(window.characterData['Vel']?.resumen?.CA) || 16;
        const initiative = parseInt(document.getElementById('sirvienteInit')?.value) || 0;
        const uid       = 'sirviente_invisible_vel';
        const charData  = buildSirvienteCharData(velAc);
        // Register with full charData so beginCombatFromSetup uses pre-built actions
        window.characterData[uid] = {
            ...charData,
            id:     uid,
            resumen: { HP: '1', CA: String(velAc), Velocidad: '30ft' },
        };
        setupNpcs.push({
            tipo: 'aliado', nombre: 'Sirviente Invisible',
            pg: 1, ca: velAc, initiative,
            acciones: '', adicionales: '', reacciones: '',
            isGroup: false, groupSize: 1,
            isSummon: true, summoner: 'ASTHOR', summonedBeforeCombat: true,
            _uid: uid,
            _useExistingCharData: true,
            _isSirvienteInvisible: true,
        });

    } else if (type === 'invocacion') {
        if (setupNpcs.some(n => n.isSummon && n.summoner === 'ZERO')) {
            showNotification('⚠️ Zero ya tiene una invocación activa', 2500);
            return;
        }
        const inv = window.characterData['Zero']?.invocaciones?.find(i => i.id === invId);
        if (!inv) return;
        const initiative = parseInt(document.getElementById(`inv_init_${invId}`)?.value) || 0;
        const uid        = `invocacion_zero_${invId}`;
        const combateExtra = _buildInvocacionActions(inv);
        const charData = {
            id: uid, tipo: 'aliado', nombre: inv.nombre,
            clase: 'Invocación de Zero', nivel: '—', imagen: null,
            resumen: { HP: String(inv.hp), CA: String(inv.ca), Velocidad: inv.velocidad },
            combateExtra, conjuros: [],
        };
        window.characterData[uid] = charData;
        setupNpcs.push({
            tipo: 'aliado', nombre: inv.nombre,
            pg: inv.hp, ca: inv.ca, initiative,
            acciones: '', adicionales: '', reacciones: '',
            isGroup: false, groupSize: 1,
            isSummon: true, summoner: 'ZERO', summonedBeforeCombat: true,
            _uid: uid,
            _useExistingCharData: true,
            _invId: invId,
        });
    }

    renderSetupNpcList('aliado');
    renderSpecialSummonsSection();
    _updateSetupCount();
    showNotification('💙 Invocación añadida', 2000);
}

function setSetupJugadorInitiative(charId, value) {
    setupInitiatives[charId] = value === '' ? null : parseInt(value);
}

function setInitiative(charId, value) {
    setSetupJugadorInitiative(charId, value);
}

function switchCombatSetupTab(tabName) {
    document.querySelectorAll('.combat-setup-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.setupTab === tabName);
    });
    const panels = {
        jugadores: document.getElementById('setupTabJugadores'),
        aliados:   document.getElementById('setupTabAliados'),
        enemigos:  document.getElementById('setupTabEnemigos'),
        mapa:      document.getElementById('setupTabMapa'),
    };
    Object.entries(panels).forEach(([key, el]) => {
        if (el) el.style.display = key === tabName ? 'block' : 'none';
    });
    if (tabName === 'mapa') renderMapSetupTab();
}

// ── Map selection tab ────────────────────────────────────────────────────────

// Cache para no repetir el fetch en cada visita al tab
let _cachedServerMaps = null;

async function renderMapSetupTab() {
    const grid = document.getElementById('setupMapGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="setup-map-loading">🔄 Cargando mapas…</div>';

    // Fetch server maps (cached after first load)
    if (!_cachedServerMaps) {
        try {
            const res = await fetch(`${API_BASE}/api/maps`);
            _cachedServerMaps = res.ok ? await res.json() : [];
        } catch (_) {
            _cachedServerMaps = [];
        }
    }

    const serverMaps = _cachedServerMaps;
    const noMapSelected = !combatState.combatMap?.id;

    let html = `<div class="setup-map-card no-map${noMapSelected ? ' selected' : ''}"
                     onclick="selectSetupMap(null, null, null)">
        ${noMapSelected ? '✓ ' : ''}Sin mapa
    </div>`;

    if (!serverMaps.length) {
        html += `<div class="setup-map-empty-hint">
            No hay mapas en <code>assets/mapas/</code>. Añade imágenes JPG o PNG a esa carpeta y reinicia el servidor.
        </div>`;
    } else {
        html += serverMaps.map(m => {
            const isSelected = combatState.combatMap?.id === m.filename;
            return `<div class="setup-map-card${isSelected ? ' selected' : ''}"
                         onclick="selectSetupMap('${m.filename}', '${m.name}', '${m.url}')">
                ${isSelected ? '<span class="setup-map-selected-badge">✓ SELECCIONADO</span>' : ''}
                <img class="setup-map-thumb" src="${m.url}" alt="${m.name}"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                <div class="setup-map-thumb-placeholder" style="display:none">🗺️</div>
                <div class="setup-map-info">
                    <div class="setup-map-name">${m.name}</div>
                    <div class="setup-map-key">${m.filename}</div>
                </div>
            </div>`;
        }).join('');
    }

    grid.innerHTML = html;
}

function selectSetupMap(id, defaultName, url) {
    if (!id) {
        combatState.combatMap = { id: null, name: '', url: '' };
        const nameInput = document.getElementById('setupMapNameInput');
        if (nameInput) nameInput.value = '';
    } else {
        combatState.combatMap = { id, name: defaultName || id, url: url || '' };
        const nameInput = document.getElementById('setupMapNameInput');
        if (nameInput && !nameInput.value.trim()) nameInput.value = defaultName || id;
    }
    renderMapSetupTab();
}

function updateSetupMapName(value) {
    combatState.combatMap = { ...combatState.combatMap, name: value.trim() };
}

function _capitalizeMapKey(key) {
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

function _updateSetupCount() {
    const total = combatState.selectedIds.length + setupNpcs.length;
    const el = document.getElementById('combatSetupCount');
    if (el) el.textContent = `${total} participante${total !== 1 ? 's' : ''}`;
}

// ---- Initiative Screen ----
function renderCombatInitiative() {
    const list = document.getElementById('combatInitList');
    if (!list) return;
    list.innerHTML = combatState.participants.map(p => `
        <div class="combat-init-row">
            <div class="combat-init-portrait">
                <img src="${p.charData?.imagen || ''}" onerror="this.style.display='none'">
            </div>
            <div class="combat-init-info">
                <div class="combat-init-name">${p.name}</div>
                <div class="combat-init-stats">❤️ ${p.hp.max} · 🛡️ ${p.ac}</div>
            </div>
            <div class="combat-init-input-wrap">
                <label>Iniciativa</label>
                <input type="number" class="combat-init-input"
                       placeholder="—" min="-5" max="30"
                       value="${p.initiative !== null ? p.initiative : ''}"
                       oninput="setParticipantInitiative('${p.id}', this.value)">
            </div>
        </div>
    `).join('');
}

function setParticipantInitiative(id, value) {
    const p = combatState.participants.find(x => x.id === id);
    if (p) p.initiative = value === '' ? null : parseInt(value);
}

// ---- Setup NPC Builder ----
function addSetupNpc(tipo) {
    const p = tipo === 'aliado' ? 'aliado' : 'enemigo';
    const nombre     = document.getElementById(`${p}Nombre`)?.value?.trim();
    const pg         = parseInt(document.getElementById(`${p}Pg`)?.value)   || 10;
    const ca         = parseInt(document.getElementById(`${p}Ca`)?.value)   || 10;
    const initiative = parseInt(document.getElementById(`${p}Init`)?.value) || 0;
    const acciones    = document.getElementById(`${p}Acciones`)?.value?.trim()    || '';
    const adicionales = document.getElementById(`${p}Adicionales`)?.value?.trim() || '';
    const reacciones  = document.getElementById(`${p}Reacciones`)?.value?.trim()  || '';

    if (!nombre) { showNotification('⚠️ Introduce un nombre', 2000); return; }

    // ── Group (enemies only) — just read the nº miembros field; ≥2 → group ────
    const rawGroupSize = parseInt(document.getElementById('enemigoGroupSize')?.value) || 1;
    const isGroup   = tipo === 'enemigo' && rawGroupSize >= 2;
    const groupSize = isGroup ? rawGroupSize : 1;

    // ── Summon (allies only) ──────────────────────────────────────────────────
    const isSummon  = tipo === 'aliado' && !!(document.getElementById('aliadoEsInvocacion')?.checked);
    const summoner  = isSummon ? (document.getElementById('aliadoSumoner')?.value || '') : '';

    setupNpcs.push({
        tipo, nombre, pg, ca, initiative,
        acciones, adicionales, reacciones,
        isGroup, groupSize,
        isSummon, summoner,
        summonedBeforeCombat: isSummon, // if added in setup, it was summoned before combat
    });

    // ── Save as reusable template (no initiative) ─────────────────────────────
    _saveEntityTemplate({
        name:    nombre,
        type:    tipo === 'aliado' ? 'ALLY' : 'ENEMY',
        stats:   { hp: pg, ac: ca },
        actions: [],
        isGroup, groupSize,
        isSummon, summoner,
        actionsText: { acciones, adicionales, reacciones },
    });

    // Clear form fields
    ['Nombre', 'Pg', 'Ca', 'Init', 'Acciones', 'Adicionales', 'Reacciones'].forEach(f => {
        const el = document.getElementById(`${p}${f}`);
        if (el) el.value = '';
    });
    // Clear group size (enemies)
    const groupSizeEl = document.getElementById('enemigoGroupSize');
    if (groupSizeEl) groupSizeEl.value = '';
    // Reset summon toggle (allies)
    const summonChk = document.getElementById('aliadoEsInvocacion');
    if (summonChk) { summonChk.checked = false; toggleSetupSummonFields('aliado'); }

    renderSetupNpcList(tipo);
    _updateSetupCount();
    showNotification(`${tipo === 'aliado' ? '💙' : '💀'} ${nombre} añadido`, 1500);
}

function removeSetupNpc(idx) {
    if (idx < 0 || idx >= setupNpcs.length) return;
    const name = setupNpcs[idx].nombre;
    const tipo = setupNpcs[idx].tipo;
    setupNpcs.splice(idx, 1);
    renderSetupNpcList('aliado');
    renderSetupNpcList('enemigo');
    renderSpecialSummonsSection(); // refresh so removed summons become selectable again
    _updateSetupCount();
    showNotification(`✕ ${name} eliminado`, 1200);
}

function renderSetupNpcList(tipo) {
    const listEl = document.getElementById(tipo === 'aliado' ? 'aliadoList' : 'enemigoList');
    if (!listEl) return;
    const items = setupNpcs.filter(n => n.tipo === tipo);
    if (!items.length) {
        listEl.innerHTML = `<div class="npc-list-empty">Ningún ${tipo} añadido todavía</div>`;
        return;
    }
    listEl.innerHTML = items.map(npc => {
        const idx = setupNpcs.indexOf(npc);
        const actParts = [npc.acciones, npc.adicionales, npc.reacciones].filter(Boolean);
        const actStr = actParts.join(' | ');
        const groupLabel  = npc.isGroup  ? ` · 👥 ${npc.groupSize}×${npc.pg}PG` : '';
        const summonLabel = npc.isSummon ? ` · ✨ ${npc.summoner}` : '';
        return `<div class="npc-builder-item">
            <div class="npc-item-info">
                <span class="npc-item-name">${npc.nombre}</span>
                <span class="npc-item-stats">❤️ ${npc.pg} · 🛡️ ${npc.ca} · Init ${npc.initiative}${groupLabel}${summonLabel}</span>
                ${actStr ? `<span class="npc-item-actions">⚔️ ${actStr}</span>` : ''}
            </div>
            <button class="npc-remove-btn" onclick="removeSetupNpc(${idx})">✕</button>
        </div>`;
    }).join('');
}
