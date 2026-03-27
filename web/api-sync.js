// ============================================
// API Sync + SSE — Real-time multi-device sync
// Depends on: globals.js, utils.js, storage.js
// Runtime deps (resolved at call-time): setView, renderCombatManager,
//   renderCombatShareLink, updateWaitingRoom, updateRoleIndicator,
//   showCombatSetup, buildSirvienteCharData
// ============================================

function _buildSaveBody() {
    return {
        participants:           combatState.participants.map(p => ({ ...p, charData: null })),
        currentIndex:           combatState.currentIndex,
        round:                  combatState.round,
        isActive:               combatState.isActive,
        segundaAccionTurn:      combatState.segundaAccionTurn,
        extraAttackTurn:        combatState.extraAttackTurn,
        nextLogId:              combatState.nextLogId,
        log:                    combatState.log,
        reactionsUsed:          combatState.reactionsUsed          || {},
        pendingReactionTrigger: combatState.pendingReactionTrigger || null,
        combatMap:              combatState.combatMap              || { id: null, name: '', url: '' },
        _clientId:              CLIENT_ID,
    };
}

function saveToApi() {
    if (!activeCombatId || !combatState.isActive) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
        try {
            await fetch(`${API_BASE}/api/combats/${activeCombatId}`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(_buildSaveBody()),
            });
        } catch (e) { console.warn('[sync] PUT failed:', e.message); }
    }, 800);
}

function saveToApiNow() {
    if (!activeCombatId || !combatState.isActive) return;
    clearTimeout(_saveTimer);
    _saveTimer = null;
    fetch(`${API_BASE}/api/combats/${activeCombatId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(_buildSaveBody()),
    }).catch(e => console.warn('[sync] immediate PUT failed:', e.message));
}

function _hydrateParticipants(participants) {
    (participants || []).forEach(p => {
        if (p._isSirvienteInvisible) {
            p.charData = buildSirvienteCharData(p.ac);
        } else {
            p.charData = window.characterData?.[p.id] || null;
        }
        if (!p.customActions) p.customActions = [];
    });
}

function applyRemoteState(data) {
    if (data._clientId === CLIENT_ID) return;

    if (data.status === 'RUNNING' && currentView() === 'onlineWaiting') {
        _hydrateParticipants(data.participants);
        Object.assign(combatState, {
            participants:      data.participants      || [],
            currentIndex:      data.currentIndex      ?? 0,
            round:             data.round             ?? 1,
            isActive:          true,
            segundaAccionTurn: data.segundaAccionTurn ?? false,
            extraAttackTurn:   data.extraAttackTurn   ?? false,
            nextLogId:         data.nextLogId         ?? 0,
            log:               data.log               || [],
            combatMap:         data.combatMap         || { id: null, name: '', url: '' },
        });
        combatModeActive = true;
        setView('combatManager');
        renderCombatManager();
        renderCombatShareLink();
        return;
    }

    if (currentView() === 'onlineWaiting') {
        updateWaitingRoom(data.connectedDevices?.length ?? 1, data.joinCode || activeJoinCode);
        return;
    }

    _hydrateParticipants(data.participants);
    Object.assign(combatState, {
        participants:      data.participants      || [],
        currentIndex:      data.currentIndex      ?? combatState.currentIndex,
        round:             data.round             ?? combatState.round,
        isActive:          data.isActive          ?? combatState.isActive,
        segundaAccionTurn: data.segundaAccionTurn ?? false,
        extraAttackTurn:   data.extraAttackTurn   ?? false,
        nextLogId:         data.nextLogId         ?? combatState.nextLogId,
        log:               data.log               || combatState.log,
        reactionsUsed:     data.reactionsUsed     || {},
        combatMap:         data.combatMap         || combatState.combatMap || { id: null, name: '', url: '' },
    });
    if (combatModeActive) renderCombatManager();
    if (data.pendingReactionTrigger) {
        handleIncomingReactionTrigger(data.pendingReactionTrigger);
    }
}

function connectToSSE(id) {
    if (sseSource) { sseSource.close(); sseSource = null; }
    sseSource = new EventSource(`${API_BASE}/api/combats/${id}/stream`);
    sseSource.onmessage = e => {
        try { applyRemoteState(JSON.parse(e.data)); } catch (_) {}
    };
}

async function startCombatSession() {
    showNotification('⏳ Creando sesión online…', 2000);
    try {
        const body = {
            participants:      combatState.participants.map(p => ({ ...p, charData: null })),
            currentIndex:      combatState.currentIndex,
            round:             combatState.round,
            isActive:          false,
            segundaAccionTurn: false,
            extraAttackTurn:   false,
            nextLogId:         combatState.nextLogId,
            log:               combatState.log,
            combatMap:         combatState.combatMap || { id: null, name: '', url: '' },
            deviceId:          CLIENT_ID,
        };
        const res = await fetch(`${API_BASE}/api/combats`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showNotification(`❌ Error al crear sesión: ${err.error || res.status}`, 4000);
            return;
        }
        const data = await res.json();

        activeCombatId = String(data.combatId);
        activeJoinCode = data.joinCode;
        localStorage.setItem(COMBAT_ID_KEY, activeCombatId);

        connectToSSE(activeCombatId);
        setView('onlineWaiting');
        updateWaitingRoom(data.deviceCount ?? 1, activeJoinCode, true);
    } catch (e) {
        console.error('[online] startCombatSession error:', e);
        showNotification(`❌ Sin conexión con el servidor (${e.message})`, 5000);
    }
}

function updateWaitingRoom(deviceCount, joinCode, isMasterDevice) {
    const el = document.getElementById('onlineWaitingView');
    if (!el) return;

    const code   = joinCode || activeJoinCode || '------';
    const isMstr = isMasterDevice !== undefined ? isMasterDevice : isMaster();

    el.querySelector('#waitingJoinCode').textContent = code;
    el.querySelector('#waitingDeviceCount').textContent = deviceCount;
    el.querySelector('#waitingDeviceMsg').textContent = deviceCount >= 1
        ? `✅ ${deviceCount} jugador${deviceCount !== 1 ? 'es' : ''} conectado${deviceCount !== 1 ? 's' : ''}`
        : 'Conectando…';

    const btn = el.querySelector('#btnStartCombat');
    if (btn) {
        btn.style.display   = isMstr ? 'block' : 'none';
        btn.disabled        = false;
        btn.textContent     = '⚔️ Iniciar combate';
    }
}

async function startOnlineCombat() {
    if (!activeCombatId) return;
    try {
        const res = await fetch(`${API_BASE}/api/combats/${activeCombatId}/start`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ _clientId: CLIENT_ID }),
        });
        if (res.status === 404) {
            showNotification('❌ Sesión no encontrada', 4000);
            return;
        }
        combatState.isActive = true;
        combatModeActive     = true;
        setView('combatManager');
        renderCombatManager();
        renderCombatShareLink();
    } catch (e) {
        showNotification(`❌ Error de conexión: ${e.message}`, 4000);
    }
}

function showOnlineCodeModal(joinCode) {
    if (!joinCode) return;
    document.getElementById('onlineCodeModal')?.remove();
    navigator.clipboard?.writeText(joinCode).catch(() => {});
    const modal = document.createElement('div');
    modal.id = 'onlineCodeModal';
    modal.className = 'online-code-modal-overlay';
    modal.innerHTML = `
        <div class="online-code-modal">
            <div class="online-code-modal-title">🌐 Código de sala</div>
            <div class="online-code-modal-subtitle">Comparte este código con los demás jugadores</div>
            <div class="online-code-big">${joinCode}</div>
            <div class="online-code-modal-btns">
                <button class="online-code-copy-btn"
                        onclick="navigator.clipboard.writeText('${joinCode}').then(()=>showNotification('✅ Código copiado',1500))">
                    🔢 Copiar código
                </button>
            </div>
            <div class="online-code-hint">El código ya se ha copiado automáticamente al portapapeles</div>
            <button class="online-code-close-btn" onclick="document.getElementById('onlineCodeModal').remove()">Cerrar</button>
        </div>`;
    document.body.appendChild(modal);
}

function showCurrentSessionCode() {
    if (activeJoinCode) {
        showOnlineCodeModal(activeJoinCode);
    } else {
        showNotification('No hay código de sesión activo', 2000);
    }
}

function renderCombatShareLink() {
    const el = document.getElementById('combatShareLink');
    if (!el || !activeJoinCode) return;
    el.innerHTML = `
        <span class="share-link-label">🌐</span>
        <span class="share-link-code" title="Código de sala">${activeJoinCode}</span>
        <button class="share-link-copy"
                onclick="navigator.clipboard.writeText('${activeJoinCode}').then(()=>showNotification('✅ Código copiado',1500));showOnlineCodeModal('${activeJoinCode}')"
                title="Ver código">📋</button>`;
    el.style.display = 'flex';
}

function showOnlineLobby() {
    setView('onlineLobby');
    document.getElementById('onlineJoinError')?.remove();
}

function startOnlineCombatSetup() {
    isOnlineCombat = true;
    gameRole = { type: 'master', characterId: null };
    localStorage.setItem(ROLE_KEY, JSON.stringify(gameRole));
    updateRoleIndicator();
    showCombatSetup();
}

async function joinOnlineSession() {
    const input = (document.getElementById('onlineJoinInput')?.value || '').trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(input)) {
        showOnlineError('Introduce el código de 6 caracteres (ej: AB12CD)');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/combats/join`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ joinCode: input, deviceId: CLIENT_ID }),
        });
        const data = await res.json();

        if (!res.ok) {
            showOnlineError(data.error || 'Partida no encontrada');
            return;
        }

        isOnlineCombat = true;
        activeJoinCode = data.joinCode;
        activeCombatId = String(data.combatId);
        localStorage.setItem(COMBAT_ID_KEY, activeCombatId);
        updateRoleIndicator();

        connectToSSE(activeCombatId);

        if (data.status === 'RUNNING' || data.combat?.status === 'RUNNING') {
            _hydrateParticipants(data.combat?.participants || []);
            Object.assign(combatState, {
                participants:      data.combat?.participants || [],
                currentIndex:      data.combat?.currentIndex ?? 0,
                round:             data.combat?.round ?? 1,
                isActive:          true,
                segundaAccionTurn: data.combat?.segundaAccionTurn ?? false,
                extraAttackTurn:   data.combat?.extraAttackTurn ?? false,
                nextLogId:         data.combat?.nextLogId ?? 0,
                log:               data.combat?.log || [],
            });
            combatModeActive = true;
            setView('combatManager');
            renderCombatManager();
            renderCombatShareLink();
        } else {
            setView('onlineWaiting');
            updateWaitingRoom(data.deviceCount ?? 1, activeJoinCode, false);
        }
    } catch (e) {
        showOnlineError('Error de conexión — comprueba que el servidor está activo');
        console.error('[online] join error:', e);
    }
}

function showOnlineError(msg) {
    const el = document.getElementById('onlineLobbyView');
    if (!el) return;
    let err = document.getElementById('onlineJoinError');
    if (!err) {
        err = document.createElement('div');
        err.id = 'onlineJoinError';
        err.className = 'online-error';
        el.appendChild(err);
    }
    err.textContent = '⚠️ ' + msg;
}

function clearOnlineSession() {
    isOnlineCombat = false;
    activeCombatId = null;
    activeJoinCode = null;
    localStorage.removeItem(COMBAT_ID_KEY);
    if (sseSource) { sseSource.close(); sseSource = null; }
    const el = document.getElementById('combatShareLink');
    if (el) el.style.display = 'none';
}
