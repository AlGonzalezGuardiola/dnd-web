// ============================================
// Combat Active Panel — rendering, turn queue, dice utilities
// Depends on: globals.js, utils.js, storage.js, combat-setup.js
// Runtime deps: renderCombatLog, renderKillScoreboard, saveCombatState,
//   renderCombatShareLink, isMaster, setView
// ============================================

// Always prefer live window.characterData over stale p.charData stored in MongoDB session
function getEffectiveCharData(p) {
    if (!p) return null;
    const live = window.characterData?.[p.id];
    return (live && p.tipo !== 'enemigo') ? live : p.charData;
}

function renderCombatManager() {
    const masterLayout = document.getElementById('combatMasterLayout');
    const playerView   = document.getElementById('playerCombatView');

    if (!isMaster()) {
        if (masterLayout) masterLayout.style.display = 'none';
        _renderPlayerCombatLayout(playerView);
        return;
    }

    // Master mode: show master layout, hide player view
    if (masterLayout) masterLayout.style.display = 'flex';
    if (playerView)   playerView.style.display   = 'none';

    const roundEl = document.getElementById('combatRoundBadge');
    if (roundEl) roundEl.textContent = `Ronda ${combatState.round}`;

    // Update current actor name in toolbar
    const actor = combatState.participants[combatState.currentIndex];
    const actorNameEl = document.getElementById('combatActorName');
    if (actorNameEl) actorNameEl.textContent = actor ? `Turno de ${actor.name.split(' ')[0]}` : '';

    // Show "Código de sesión" button only in online mode
    const sessionCodeBtn = document.getElementById('showSessionCodeBtn');
    if (sessionCodeBtn) sessionCodeBtn.style.display = isOnlineCombat ? '' : 'none';

    renderCombatShareLink();
    renderTurnQueue();
    renderActivePanel();
    renderCombatLog();
    renderKillScoreboard();
}

// ---- Player Combat Layout (role=jugador) — fully independent turn manager ----
function _renderPlayerCombatLayout(view) {
    if (!view) view = document.getElementById('playerCombatView');
    if (!view) return;

    const masterLayout = document.getElementById('combatMasterLayout');
    if (masterLayout) masterLayout.style.display = 'none';

    view.style.display = 'flex';

    const currentP = combatState.participants[combatState.currentIndex];
    if (!currentP) return;

    // Determine if this player can control the current participant
    const isMyCharTurn = gameRole.characterId && currentP.id === gameRole.characterId;
    const isMyAllyTurn = (
        currentP.ownerCharId === gameRole.characterId ||
        (currentP._isSirvienteInvisible && gameRole.characterId === 'Vel')
    );

    const isSegundaAccion = combatState.segundaAccionTurn;
    const roundLabel = isSegundaAccion
        ? `Ronda ${combatState.round} · Segunda Acción`
        : `Ronda ${combatState.round}`;

    // Only show "Siguiente Turno" when it's the player's own turn (or their summon's)
    const nextTurnBtn = (isMyCharTurn || isMyAllyTurn)
        ? `<button class="btn-combat-primary" onclick="nextCombatTurn()">Siguiente Turno →</button>`
        : `<span class="player-waiting-hint">Esperando a que el Master avance el turno…</span>`;

    view.innerHTML = `
        <div class="player-active-header">
            <div class="combat-round-badge">${roundLabel}</div>
            <button class="btn-end-combat" onclick="confirmEndCombat()">✕ Fin</button>
        </div>
        <div class="player-active-body">
            <div id="playerCombatPanel" class="combat-active-panel"></div>
        </div>
        <div class="player-active-footer">
            ${nextTurnBtn}
        </div>`;

    const panelEl = document.getElementById('playerCombatPanel');
    if (isMyCharTurn || isMyAllyTurn) {
        // My turn or my summon/servant's turn: show that participant in planner mode
        renderActivePanel(panelEl, combatState.currentIndex);
    } else {
        // Someone else's turn: role gates apply → shows waiting state
        renderActivePanel(panelEl);
    }
}

function renderTurnQueue() {
    const queue = document.getElementById('combatTurnQueue');
    if (!queue) return;
    queue.innerHTML = combatState.participants.map((p, i) => {
        const isCurrent = i === combatState.currentIndex;

        // ── Group vs single HP calculations ──────────────────────────────────────
        let isDead, hpPct, hpDisplay;
        if (p.isGroup) {
            isDead    = (p.membersRemaining ?? 0) <= 0;
            const maxTotalHp = (p.groupSize || 1) * (p.hpPerMember || 1);
            hpPct     = maxTotalHp > 0 ? Math.max(0, ((p.totalHp ?? 0) / maxTotalHp) * 100) : 0;
            const showHpGroup = !(!isMaster() && p.tipo === 'enemigo');
            hpDisplay = showHpGroup
                ? `${p.membersRemaining ?? 0}/${p.groupSize ?? 1}`
                : '? / ?';
        } else {
            isDead    = p.hp.current <= 0;
            hpPct     = p.hp.max > 0 ? Math.max(0, (p.hp.current / p.hp.max) * 100) : 0;
            const showHp = !(!isMaster() && p.tipo === 'enemigo');
            hpDisplay = showHp ? `${p.hp.current}/${p.hp.max}` : '? / ?';
        }

        const hpColor    = hpPct <= 0 ? '#555' : hpPct <= 25 ? '#ff4444' : hpPct <= 50 ? '#ffaa00' : '#4caf50';
        const tipoClass  = p.tipo || 'jugador';
        const cls = ['turn-queue-item', isCurrent ? 'active' : '', isDead ? 'dead' : '', p.demonicForm ? 'demonic' : '', tipoClass].filter(Boolean).join(' ');

        const condIcons = p.conditions.length
            ? `<div class="tqi-conditions">${p.conditions.map(cId => {
                  const c = CONDITIONS.find(x => x.id === cId);
                  return c ? `<span title="${c.title}">${c.label}</span>` : '';
              }).join('')}</div>`
            : '';

        // Group counter badge
        const groupBadge = p.isGroup
            ? `<div class="tqi-group-badge" title="Grupo: ${p.membersRemaining}/${p.groupSize} miembros">👥</div>`
            : '';
        // Summon indicator
        const summonBadge = p.isSummon
            ? `<div class="tqi-summon-badge" title="Invocación de ${p.summoner}">✨</div>`
            : '';

        return `<div class="${cls}">
            <div class="tqi-init">${p.initiative}</div>
            <div class="tqi-name">${p.name.split(' ')[0]}</div>
            ${groupBadge}${summonBadge}
            <div class="tqi-hp-bar"><div class="tqi-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
            <div class="tqi-hp-text">${hpDisplay}</div>
            ${condIcons}
            ${isCurrent && combatState.extraAttackTurn  ? '<div class="tqi-extra-badge">+ATQ</div>' : ''}
            ${isCurrent && combatState.segundaAccionTurn ? '<div class="tqi-extra-badge">+2ª</div>' : ''}
        </div>`;
    }).join('');
    setTimeout(() => {
        const active = queue.querySelector('.turn-queue-item.active');
        if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
}

// ---- Dice Rolling Utilities ----
function rollDiceString(diceStr) {
    if (!diceStr || diceStr === '—') return { breakdown: '—', total: 0 };
    // Split by '+' but handle negative numbers
    const parts = diceStr.replace(/\s/g, '').split('+');
    let total = 0;
    const segments = [];
    for (const part of parts) {
        const diceMatch = part.match(/^(\d+)d(\d+)$/i);
        if (diceMatch) {
            const count = parseInt(diceMatch[1]);
            const sides = parseInt(diceMatch[2]);
            const rolls = [];
            for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
            const sum = rolls.reduce((a, b) => a + b, 0);
            total += sum;
            segments.push(`${count}d${sides}:${rolls.join(',')}`);
        } else {
            const num = parseInt(part);
            if (!isNaN(num)) { total += num; segments.push(String(num)); }
        }
    }
    return { breakdown: segments.join(' + '), total };
}

function rollActionDice(participantId, nombre, atk, dado) {
    const p = combatState.participants.find(x => x.id === participantId);
    const entry = getCurrentLogEntry();
    if (!p || !entry) return;

    let parts = [];
    let attackTotal = null;

    if (atk && atk !== '—' && atk !== '') {
        const d20 = Math.floor(Math.random() * 20) + 1;
        const bonusMatch = atk.replace(/1d20/i, '').match(/[+-]?\d+/);
        const bonus = bonusMatch ? parseInt(bonusMatch[0]) : 0;
        attackTotal = d20 + bonus;
        const isCrit = d20 === 20;
        const isFumble = d20 === 1;
        parts.push(`d20:${d20} ${bonus >= 0 ? '+' : ''}${bonus} = **${attackTotal}** para impactar${isCrit ? ' ⚡CRÍTICO!' : isFumble ? ' 💀Pifia!' : ''}`);
    }

    let damageTotal = 0;
    if (dado && dado !== '—' && dado !== '') {
        const dmg = rollDiceString(dado);
        damageTotal = dmg.total;
        parts.push(`Daño: ${dmg.breakdown} = **${dmg.total}**`);
    }

    const rollText = `🎲 ${nombre}: ${parts.join(' / ')}`;
    const narratorText = generateNarratorText(p.name, nombre, attackTotal, damageTotal, !!atk);

    const existingIdx = entry.actions.findIndex(a => a.nombre === nombre);
    if (existingIdx >= 0) {
        entry.actions[existingIdx].rollText = rollText;
        entry.actions[existingIdx].narratorText = narratorText;
    } else {
        entry.actions.push({ nombre, dice: dado || '', rollText, narratorText });
        // Mark slot
        const slotKey = inferActionType({ nombre, tipo: '', desc: '' }) === 'adicional' ? 'adicional'
            : inferActionType({ nombre, tipo: '', desc: '' }) === 'reaccion' ? 'reaccion' : 'accion';
        if (entry.slots) entry.slots[slotKey] = true;
    }
    saveCombatState();
    renderActivePanel();
    renderCombatLog();
}

function generateNarratorText(name, actionName, attackTotal, damageTotal, hasAtk) {
    const firstName = name.split(' ')[0];
    const verbs = ['desenvaina', 'empuña', 'lanza', 'canaliza', 'desata'];
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    if (hasAtk && attackTotal !== null) {
        if (attackTotal >= 12) {
            return damageTotal > 0
                ? `${firstName} ${verb} ${actionName} y alcanza con un ${attackTotal} para impactar, infligiendo ${damageTotal} puntos de daño.`
                : `${firstName} utiliza ${actionName} con un resultado de ${attackTotal}.`;
        } else {
            return `${firstName} intenta usar ${actionName}, pero falla el ataque (resultado: ${attackTotal}).`;
        }
    } else if (damageTotal > 0) {
        return `${firstName} activa ${actionName}, causando ${damageTotal} puntos de daño.`;
    }
    return `${firstName} utiliza ${actionName}.`;
}

function showActionDetail(nombre, atk, dado, desc) {
    document.getElementById('actionDetailOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'actionDetailOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="action-detail-modal">
            <div class="action-detail-name">${nombre}</div>
            ${atk && atk !== '—' ? `<div class="action-detail-stat">⚔️ Ataque: <strong>${atk}</strong></div>` : ''}
            ${dado && dado !== '—' ? `<div class="action-detail-stat">💥 Daño: <strong>${dado}</strong></div>` : ''}
            ${desc ? `<div class="action-detail-desc">${desc}</div>` : ''}
            <button class="btn-combat-secondary" onclick="document.getElementById('actionDetailOverlay')?.remove()" style="margin-top:16px;width:100%">Cerrar</button>
        </div>`;
    document.body.appendChild(overlay);
}

function toggleSlotManual(participantId, slotKey) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    if (!entry.slots) entry.slots = { accion: false, extraAtaque: false, adicional: false, reaccion: false };
    entry.slots[slotKey] = !entry.slots[slotKey];
    saveCombatState();
    renderActivePanel();
}

function addPermanentCustomAction(participantId) {
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p) return;
    const nombre = document.getElementById('newCustomActionName')?.value?.trim();
    if (!nombre) { showNotification('⚠️ Introduce un nombre para la acción', 2000); return; }
    const tipo = document.getElementById('newCustomActionTipo')?.value || 'accion';
    const dado = document.getElementById('newCustomActionDado')?.value?.trim() || '';
    if (!p.customActions) p.customActions = [];
    // Prevent duplicates
    if (p.customActions.find(a => a.nombre === nombre)) {
        showNotification('⚠️ Ya existe una acción con ese nombre', 2000); return;
    }
    p.customActions.push({ nombre, tipo, dado, atk: '', desc: '' });
    saveCombatState();
    renderActivePanel();
    showNotification(`✅ Acción "${nombre}" añadida`, 2000);
}

function removePermanentCustomAction(participantId, nombre) {
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p || !p.customActions) return;
    p.customActions = p.customActions.filter(a => a.nombre !== nombre);
    // Also remove from current log entry if present
    const entry = getCurrentLogEntry();
    if (entry) entry.actions = entry.actions.filter(a => a.nombre !== nombre);
    saveCombatState();
    renderActivePanel();
}

function renderActivePanel(targetEl, forcePIdx) {
    const idx = (forcePIdx !== undefined) ? forcePIdx : combatState.currentIndex;
    const p = combatState.participants[idx];
    const panel = targetEl || document.getElementById('combatActivePanel') || document.getElementById('playerCombatPanel');
    if (!p || !panel) return;

    // isSegundaAccion / isExtraAttack only apply when rendering the actual current turn
    const isSegundaAccion = combatState.segundaAccionTurn && (idx === combatState.currentIndex);
    const isExtraAttack   = combatState.extraAttackTurn   && (idx === combatState.currentIndex);

    // ─── ROLE GATES — skipped when forcePIdx is set (player rendering own sheet) ──
    // canControl: master always yes; jugador yes for own char + their summoned allies
    const isMyCharTurn  = !isMaster() && gameRole.characterId && p.id === gameRole.characterId;
    const isMyAllyTurn  = !isMaster() && (
        p.ownerCharId === gameRole.characterId ||
        (p._isSirvienteInvisible && gameRole.characterId === 'Vel')
    );
    const canControl = isMaster() || isMyCharTurn || isMyAllyTurn;

    if (forcePIdx === undefined && !canControl) {
        let icon = '⏳', label = `Turno de ${p.name.split(' ')[0]}...`, note = 'El Master gestiona este turno';
        if (p.tipo === 'enemigo')      { icon = '💀'; label = 'Turno del enemigo'; }
        else if (p.tipo === 'aliado')  { icon = '🤝'; label = `Turno de ${p.name.split(' ')[0]}`; note = 'El Master gestiona este turno'; }
        else if (p.tipo === 'jugador') { icon = '🎮'; label = `Turno de ${p.name.split(' ')[0]}`; note = 'Ese jugador gestiona su propio turno'; }
        panel.className = 'combat-active-panel';
        panel.innerHTML = `<div class="waiting-panel">
            <span>${icon} ${label}</span>
            <small>${note}</small>
        </div>`;
        return;
    }
    // ─── END ROLE GATES ───────────────────────────────────────────────────────

    const currentEntry = getCurrentLogEntry();
    const hpPct = p.hp.max > 0 ? Math.max(0, (p.hp.current / p.hp.max) * 100) : 0;
    const hpClass = hpPct <= 0 ? 'hp-dead' : hpPct <= 25 ? 'hp-critical' : hpPct <= 50 ? 'hp-low' : '';

    // Conditions
    const condHTML = CONDITIONS.map(c => {
        const isActive = p.conditions.includes(c.id);
        return `<button class="combat-cond-btn${isActive ? ' active' : ''}"
                        onclick="toggleParticipantCondition('${p.id}','${c.id}')"
                        title="${c.title}">${c.label} ${c.title}</button>`;
    }).join('');

    // Concentration banner
    const concentrationBanner = p.conditions.includes('concentracion')
        ? `<div class="concentration-banner">🧠 Concentración activa — al recibir daño, tira Constitución</div>`
        : '';

    // Player mode flag — determines planner vs master slot UI
    const playerMode = forcePIdx !== undefined;

    // Action slots
    let actionChipsHTML = '';
    const SLOTS = [
        { key: 'accion',    icon: '⚔️',  label: 'Acción',          tipo: 'accion'    },
        { key: 'adicional', icon: '⚡',  label: 'Acción Adicional', tipo: 'adicional' },
        { key: 'reaccion',  icon: '↩️',  label: 'Reacción',         tipo: 'reaccion'  },
    ];
    // Build all available actions: use live characterData (not stale p.charData from MongoDB)
    const liveData = getEffectiveCharData(p);
    const baseItems = [...(liveData?.combateExtra || []), ...(liveData?.conjuros || [])];
    const customItems = (p.customActions || []).map(a => ({ ...a, _custom: true }));
    const allItems = [...baseItems, ...customItems];

    // Separate modifier (smite) items — they have their own section and don't consume slots
    const modificadorItems = allItems.filter(a => inferActionType(a) === 'modificador');
    const regularItems     = allItems.filter(a => inferActionType(a) !== 'modificador');

    // Phase key for per-attack smite tracking
    const currentPhase = isExtraAttack ? 'extra' : (isSegundaAccion ? 'segunda' : 'main');

    // Smite/modifier toggles — rendered as permanent toggle buttons like demonic form
    const smiteToggleHTML = modificadorItems.map(a => {
        const dado = a.dado && a.dado !== '—' ? a.dado : '';
        const safeName = a.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeDado = dado.replace(/'/g, "\\'");
        const safeTipo = (a.tipo_dano || '').replace(/'/g, "\\'");
        const isUsed = currentEntry?.actions.some(x => x.nombre === a.nombre && x.smitePhase === currentPhase) || false;
        return `<button class="combat-demonic-toggle${isUsed ? ' active' : ''}"
                onclick="toggleSmiteModifier('${p.id}','${safeName}','${safeDado}','${safeTipo}','${currentPhase}')">
            ✨ ${a.nombre}
            ${isUsed
                ? `<span class="demonic-badge">ACTIVO${dado ? ' · ' + dado : ''}${a.tipo_dano ? ' ' + a.tipo_dano : ''}</span>`
                : '<span style="color:var(--text-muted);font-size:12px">Inactivo — complementa el ataque</span>'}
        </button>`;
    }).join('');

    // Helper to render action chips
    const renderChips = (items) => items.map(a => {
        const atk = a.atk || '';
        const dado = a.dado && a.dado !== '—' ? a.dado : (a._custom ? '' : (extractDiceFromDesc(a.desc) || ''));
        const diceDisplay = atk ? `${atk}${dado ? ' / ' + dado : ''}` : dado;
        const safeName = a.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeDice = diceDisplay.replace(/'/g, "\\'");
        const safeAtk = atk.replace(/'/g, "\\'");
        const safeDado = dado.replace(/'/g, "\\'");
        const safeDesc = (a.desc || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
        const safeTipoDano = (a.tipo_dano || '').replace(/'/g, "\\'");
        const demonicBonus = (p.demonicForm && p.id === 'Vel' && atk)
            ? '<small class="demonic-bonus">+1d8 Necr.</small>' : '';
        const removeBtn = a._custom
            ? `<button class="chip-remove-btn" onclick="removePermanentCustomAction('${p.id}','${safeName}')" title="Eliminar acción">✕</button>` : '';
        // Player mode: highlight if assigned in planner
        const isUsed = playerMode
            ? ['accion_plan','adicional_plan','reaccion_plan'].some(k => currentEntry?.slots?.[k]?.nombre === a.nombre)
            : (currentEntry?.actions.some(x => x.nombre === a.nombre) || false);
        const chipOnclick = playerMode
            ? `selectPlannerAction('${p.id}','${safeName}','${safeAtk}','${safeDado}','${safeTipoDano}')`
            : `toggleCombatAction('${p.id}','${safeName}','${safeDice}')`;
        return `<div class="combat-chip-wrapper">
            <button class="combat-chip${isUsed ? ' used' : ''}${a._custom ? ' custom-action' : ''}"
                    onclick="${chipOnclick}">
                ${a.nombre}${diceDisplay ? `<small>${diceDisplay}</small>` : ''}${demonicBonus}
            </button>
            ${a.desc && !a._custom ? `<button class="chip-info-btn" onclick="showActionDetail('${safeName}','${safeAtk}','${safeDado}','${safeDesc}')" title="Ver descripción">ℹ️</button>` : ''}
            ${removeBtn}
        </div>`;
    }).join('');

    // Helper: render a single action as a card (used in all modes)
    const renderCard = (item, onclickFn, isUsedFn) => {
        const isUsed = isUsedFn(item);
        const diceStr = item.atk
            ? `ATK ${item.atk}${item.dado && item.dado !== '—' ? ` | DMG ${item.dado}` : ''}`
            : (item.dado && item.dado !== '—' ? `DMG ${item.dado}` : (extractDiceFromDesc(item.desc) || ''));
        const atk      = item.atk || '';
        const dado     = item.dado && item.dado !== '—' ? item.dado : (extractDiceFromDesc(item.desc) || '');
        const diceDisp = atk ? `${atk}${dado ? ' / ' + dado : ''}` : dado;
        const safeName = item.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const removeBtn = item._custom
            ? `<button class="chip-remove-btn" onclick="removePermanentCustomAction('${p.id}','${safeName}')" title="Eliminar">✕</button>` : '';
        return `<div class="combat-action-card${isUsed ? ' selected' : ''}${item._custom ? ' custom-action' : ''}"
                 onclick="${onclickFn(item, safeName, diceDisp)}">
            <div class="combat-action-header">
                <span class="combat-action-name">${item.nombre}</span>
                ${diceStr ? `<span class="combat-action-dice">${diceStr}</span>` : ''}
                ${removeBtn}
            </div>
            <div class="combat-action-desc">${item.desc || ''}</div>
        </div>`;
    };

    // Render slot sections or mini-turn-only views
    let slotSections;
    if (isExtraAttack) {
        const weaponItems = regularItems.filter(a =>
            inferActionType(a) === 'accion' && a.atk && a.atk !== '—' && a.atk !== ''
        );
        const weaponCards = weaponItems.map(item => renderCard(
            item,
            (item, safeName, diceDisp) => `toggleCombatAction('${p.id}','${safeName}','${diceDisp.replace(/'/g, "\\'")}')`,
            item => currentEntry?.actions.some(x => x.nombre === item.nombre) || false
        )).join('');
        slotSections = `<div class="combat-section">
            <div class="combat-section-title">🗡️ Ataque Extra (solo armas)</div>
            <div class="combat-action-list">${weaponCards || '<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin ataques disponibles</div>'}</div>
        </div>`;
    } else if (isSegundaAccion) {
        const accionItems = regularItems.filter(a => inferActionType(a) === 'accion');
        const accionCards = accionItems.map(item => renderCard(
            item,
            (item, safeName, diceDisp) => `toggleCombatAction('${p.id}','${safeName}','${diceDisp.replace(/'/g, "\\'")}')`,
            item => currentEntry?.actions.some(x => x.nombre === item.nombre) || false
        )).join('');
        slotSections = `<div class="combat-section">
            <div class="combat-section-title">⚔️ Acción (Segunda Acción)</div>
            <div class="combat-action-list">${accionCards || '<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin acciones disponibles</div>'}</div>
        </div>`;
    } else if (playerMode) {
        // ── PLANIFICADOR DE TURNO (player mode) ──────────────────────────────
        const PSLOTS = [
            { key: 'accion',    icon: '⚔️', label: 'ACCIÓN' },
            { key: 'adicional', icon: '⚡', label: 'ADICIONAL' },
            { key: 'reaccion',  icon: '🛡️', label: 'REACCIÓN' },
        ];
        const plannerSlotsHTML = PSLOTS.map(s => {
            const plan = currentEntry?.slots?.[s.key + '_plan'];
            return `<div class="planner-slot${plan ? ' filled' : ''}">
                <span class="planner-slot-label">${s.icon} ${s.label}:</span>
                ${plan
                    ? `<span class="planner-slot-action">${plan.nombre}</span>
                       <button class="planner-slot-remove" onclick="removePlannerSlot('${p.id}','${s.key}')">✕</button>`
                    : `<span class="planner-slot-empty">— selecciona abajo</span>`}
            </div>`;
        }).join('');
        const diceRows = PSLOTS.map(s => {
            const plan = currentEntry?.slots?.[s.key + '_plan'];
            if (!plan) return '';
            const atkBadge = plan.atk ? `<span class="planner-dice-badge atk">ATK ${plan.atk}</span>` : '';
            const dmgBadge = plan.dado ? `<span class="planner-dice-badge dmg">DMG ${plan.dado}</span>` : '';
            const tipoDanoKey = plan.tipo_dano ? plan.tipo_dano.split('/')[0].trim().toLowerCase() : '';
            const tipoBadge = plan.tipo_dano ? `<span class="planner-dice-badge tipo tipo-${tipoDanoKey}">${plan.tipo_dano}</span>` : '';
            return `<div class="planner-dice-row">
                <span class="planner-dice-name">${plan.nombre}</span>
                <div class="planner-dice-badges">${atkBadge}${dmgBadge}${tipoBadge}</div>
            </div>`;
        }).filter(Boolean).join('');
        const hasDice = PSLOTS.some(s => currentEntry?.slots?.[s.key + '_plan']);

        // Spell slot tracker (shared renderSlotTracker from character-sheet.js)
        const charData = liveData;
        const combatSlotsHTML = renderSlotTracker(p.id, liveData, 'combat-slots');

        // Card renderer — same style as character sheet, calls selectPlannerAction
        const renderPlannerCard = (item, sectionKey) => {
            const plan = currentEntry?.slots?.[sectionKey + '_plan'];
            const isSelected = plan?.nombre === item.nombre;
            const diceStr = item.atk
                ? `ATK ${item.atk}${item.dado && item.dado !== '—' ? ` | DMG ${item.dado}` : ''}`
                : (item.dado && item.dado !== '—' ? `DMG ${item.dado}` : (extractDiceFromDesc(item.desc) || ''));
            const safeName = item.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const safeAtk  = (item.atk || '').replace(/'/g, "\\'");
            const safeDado = (item.dado || '').replace(/'/g, "\\'");
            const safeTipo = (item.tipo_dano || '').replace(/'/g, "\\'");
            return `<div class="combat-action-card${isSelected ? ' selected' : ''}"
                     onclick="selectPlannerAction('${p.id}','${safeName}','${safeAtk}','${safeDado}','${safeTipo}')">
                <div class="combat-action-header">
                    <span class="combat-action-name">${item.nombre}</span>
                    ${diceStr ? `<span class="combat-action-dice">${diceStr}</span>` : ''}
                </div>
                <div class="combat-action-desc">${item.desc || ''}</div>
            </div>`;
        };

        // Action sections with trucos/hechizos split — same structure as character sheet
        const ACTION_SECTIONS = [
            { key: 'accion',    icon: '🎯', label: 'Acciones' },
            { key: 'adicional', icon: '⚡', label: 'Adicionales' },
            { key: 'reaccion',  icon: '↩️', label: 'Reacciones' },
        ];
        const cardSections = ACTION_SECTIONS.map(section => {
            const items = regularItems.filter(a => inferActionType(a) === section.key);
            if (!items.length) return '';
            const trucos   = items.filter(i => !i.nivel || typeof i.nivel !== 'number');
            const hechizos = items.filter(i => i.nivel && typeof i.nivel === 'number');
            let cardsHTML = trucos.map(item => renderPlannerCard(item, section.key)).join('');
            if (hechizos.length > 0) {
                initSpellSlotsForChar(p.id);
                const byLevel = {};
                hechizos.forEach(sp => { if (!byLevel[sp.nivel]) byLevel[sp.nivel] = []; byLevel[sp.nivel].push(sp); });
                const hechizosCards = Object.keys(byLevel).sort((a, b) => a - b).map(lv => {
                    const slotName = `Nv${lv}`;
                    const slotDef = charData?.ranuras?.find(s => s.nombre === slotName);
                    const remaining = slotDef ? (spellSlotState[p.id]?.[slotName] ?? slotDef.total) : null;
                    const slotBadge = remaining !== null
                        ? `<span class="slot-badge${remaining === 0 ? ' slot-empty' : ''}" data-slot="${slotName}">${remaining}/${slotDef.total} ranuras</span>`
                        : '';
                    return `<div class="hechizo-level-group">
                        <div class="hechizo-level-header">Nv${lv} ${slotBadge}</div>
                        ${byLevel[lv].map(item => renderPlannerCard(item, section.key)).join('')}
                    </div>`;
                }).join('');
                cardsHTML += hechizosCards;
            }
            return `<div class="combat-section">
                <div class="combat-section-title">${section.icon} ${section.label}</div>
                <div class="combat-action-list">${cardsHTML}</div>
            </div>`;
        }).join('');

        slotSections = `
        <div class="turn-planner">
            <div class="turn-planner-slots">${plannerSlotsHTML}</div>
            <div class="turn-planner-dice">
                <div class="planner-dice-title">🎲 DADOS DEL TURNO</div>
                ${hasDice ? diceRows : '<div class="planner-dice-empty">Selecciona acciones abajo</div>'}
            </div>
        </div>
        ${combatSlotsHTML}
        <div class="combat-actions-cards-section">${cardSections}</div>`;
    } else {
        // Master mode — card-based layout matching character sheet
        const masterCharData = liveData;
        const masterSlotsHTML = renderSlotTracker(p.id, liveData, 'combat-slots');

        const renderMasterCard = (item, sectionKey) => {
            const isUsed = currentEntry?.actions.some(x => x.nombre === item.nombre) || false;
            const diceStr = item.atk
                ? `ATK ${item.atk}${item.dado && item.dado !== '—' ? ` | DMG ${item.dado}` : ''}`
                : (item.dado && item.dado !== '—' ? `DMG ${item.dado}` : (extractDiceFromDesc(item.desc) || ''));
            const atk  = item.atk || '';
            const dado = item.dado && item.dado !== '—' ? item.dado : (extractDiceFromDesc(item.desc) || '');
            const diceDisplay = atk ? `${atk}${dado ? ' / ' + dado : ''}` : dado;
            const safeName = item.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const safeDice = diceDisplay.replace(/'/g, "\\'");
            const removeBtn = item._custom
                ? `<button class="chip-remove-btn" onclick="removePermanentCustomAction('${p.id}','${safeName}')" title="Eliminar acción">✕</button>` : '';
            return `<div class="combat-action-card${isUsed ? ' selected' : ''}${item._custom ? ' custom-action' : ''}"
                     onclick="toggleCombatAction('${p.id}','${safeName}','${safeDice}')">
                <div class="combat-action-header">
                    <span class="combat-action-name">${item.nombre}</span>
                    ${diceStr ? `<span class="combat-action-dice">${diceStr}</span>` : ''}
                    ${removeBtn}
                </div>
                <div class="combat-action-desc">${item.desc || ''}</div>
            </div>`;
        };

        const MASTER_SECTIONS = [
            { key: 'accion',    icon: '🎯', label: 'Acciones' },
            { key: 'adicional', icon: '⚡', label: 'Adicionales' },
            { key: 'reaccion',  icon: '↩️', label: 'Reacciones' },
        ];
        const masterCardSections = MASTER_SECTIONS.map(section => {
            const isSlotUsed = (currentEntry?.slots?.[section.key]) ||
                currentEntry?.actions.some(a => inferActionType(a) === section.key) || false;
            const items = regularItems.filter(a => inferActionType(a) === section.key);
            if (!items.length) return '';
            const trucos   = items.filter(i => !i.nivel || typeof i.nivel !== 'number');
            const hechizos = items.filter(i => i.nivel && typeof i.nivel === 'number');
            let cardsHTML = trucos.map(item => renderMasterCard(item, section.key)).join('');
            if (hechizos.length > 0) {
                initSpellSlotsForChar(p.id);
                const byLevel = {};
                hechizos.forEach(sp => { if (!byLevel[sp.nivel]) byLevel[sp.nivel] = []; byLevel[sp.nivel].push(sp); });
                const hechizosCards = Object.keys(byLevel).sort((a, b) => a - b).map(lv => {
                    const slotName = `Nv${lv}`;
                    const slotDef = masterCharData?.ranuras?.find(s => s.nombre === slotName);
                    const remaining = slotDef ? (spellSlotState[p.id]?.[slotName] ?? slotDef.total) : null;
                    const slotBadge = remaining !== null
                        ? `<span class="slot-badge${remaining === 0 ? ' slot-empty' : ''}" data-slot="${slotName}">${remaining}/${slotDef.total} ranuras</span>`
                        : '';
                    return `<div class="hechizo-level-group">
                        <div class="hechizo-level-header">Nv${lv} ${slotBadge}</div>
                        ${byLevel[lv].map(item => renderMasterCard(item, section.key)).join('')}
                    </div>`;
                }).join('');
                cardsHTML += hechizosCards;
            }
            const slotUsedClass = isSlotUsed ? ' used' : '';
            const btnClass = isSlotUsed ? 'used' : 'libre';
            const btnLabel = isSlotUsed ? '✅ Usada' : '☐ Libre';
            return `<div class="combat-section${slotUsedClass}">
                <div class="combat-section-title" style="display:flex;justify-content:space-between;align-items:center;">
                    <span>${section.icon} ${section.key === 'accion' ? 'Acciones' : section.key === 'adicional' ? 'Adicionales' : 'Reacciones'}</span>
                    <button class="slot-toggle-btn ${btnClass}" onclick="toggleSlotManual('${p.id}','${section.key}')">${btnLabel}</button>
                </div>
                <div class="combat-action-list">${cardsHTML}</div>
            </div>`;
        }).join('');

        slotSections = `${masterSlotsHTML}<div class="combat-actions-cards-section">${masterCardSections}</div>`;
    }

    // Form to add persistent custom actions (not shown in mini-turn modes)
    const addCustomActionForm = (isSegundaAccion || isExtraAttack) ? '' : `
        <details class="add-custom-action-details">
            <summary>✏️ Añadir acción personalizada…</summary>
            <div class="add-custom-action-form">
                <input type="text" id="newCustomActionName" class="combat-custom-input" placeholder="Nombre de la acción" autocomplete="off">
                <select id="newCustomActionTipo" class="combat-custom-input" style="flex:0 0 auto;width:auto">
                    <option value="accion">Acción</option>
                    <option value="adicional">Adicional</option>
                    <option value="reaccion">Reacción</option>
                </select>
                <input type="text" id="newCustomActionDado" class="combat-custom-input" placeholder="Dado (ej: 1d6+3)" style="flex:0 0 auto;width:110px">
                <button onclick="addPermanentCustomAction('${p.id}')">+ Guardar</button>
            </div>
        </details>`;

    // Invocaciones section for Zero (not shown in mini-turn modes)
    let invocacionesHTML = '';
    if (!isSegundaAccion && !isExtraAttack && p.id === 'Zero' && liveData?.invocaciones) {
        const invCards = liveData.invocaciones.map(inv => `
            <div class="invocation-card">
                <div>
                    <div class="invocation-name">${inv.emoji} ${inv.nombre}</div>
                    <div class="invocation-stats">HP ${inv.hp} · CA ${inv.ca} · ${inv.velocidad}</div>
                </div>
                <div class="invocation-btns">
                    <button onclick="showInvocationDetail('Zero','${inv.id}')">Ver stats</button>
                    <button onclick="addInvocationToCombat('Zero','${inv.id}')">+ Al combate</button>
                </div>
            </div>`).join('');
        invocacionesHTML = `<div class="combat-invocations-section">
            <div class="combat-actions-title">🔮 Invocaciones de Zero</div>
            ${invCards}
        </div>`;
    }

    actionChipsHTML = `<div class="combat-actions-section">
        <div class="combat-actions-title">⚡ Acciones del turno</div>
        ${slotSections}
        ${addCustomActionForm}
    </div>${invocacionesHTML}`;

    // Recorded actions
    const recordedItems = currentEntry?.actions || [];
    const recordedHTML = recordedItems.length
        ? recordedItems.map(a => {
            const safeName = a.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `<div class="combat-recorded-item">
                <div style="flex:1">
                    <span>✓ ${a.nombre}${a.dice && !a.rollText ? ` — ${a.dice}` : ''}</span>
                    ${a.rollText ? `<div class="combat-roll-result" style="font-size:10px">${a.rollText.replace(/\*\*/g, '')}</div>` : ''}
                    ${a.narratorText ? `<div class="combat-narrator-text" style="font-size:10px">${a.narratorText}</div>` : ''}
                </div>
                <button onclick="removeCombatAction('${p.id}','${safeName}')">×</button>
            </div>`;
        }).join('')
        : `<div class="combat-recorded-empty">Sin acciones registradas</div>`;

    // Demonic form toggle (Vel only)
    const demonicToggleHTML = p.id === 'Vel' ? `
        <button class="combat-demonic-toggle${p.demonicForm ? ' active' : ''}"
                onclick="toggleDemonicFormInCombat('Vel')">
            😈 Forma Demoníaca
            ${p.demonicForm
                ? `<span class="demonic-badge">ACTIVA · CA ${p.ac} · Vel. 50ft · +1d8 Necr.</span>`
                : '<span style="color:var(--text-muted);font-size:12px">Inactiva</span>'}
        </button>` : '';

    // Sirviente Invisible toggle (Vel only, not during segunda acción mini-turn)
    const sirvienteToggleHTML = (p.id === 'Vel' && !isSegundaAccion) ? `
        <button class="combat-demonic-toggle${p.sirvienteActive ? ' active' : ''}"
                onclick="toggleSirvienteInvisible('Vel')">
            👻 Sirviente Invisible
            ${p.sirvienteActive
                ? '<span class="demonic-badge">ACTIVO · CA ' + p.ac + '</span>'
                : '<span style="color:var(--text-muted);font-size:12px">Inactivo</span>'}
        </button>` : '';

    // Attack target panel (master or controlling player)
    let attackTargetPanelHTML = '';
    if (canControl && forcePIdx === undefined) {
        // Team filtering: jugador/aliado attack enemies; enemigo attacks jugadores/aliados
        const attackerIsAlly = (p.tipo === 'jugador' || p.tipo === 'aliado');
        const targets = combatState.participants.filter((t, i) => {
            if (i === idx) return false; // exclude self
            const targetIsAlly = (t.tipo === 'jugador' || t.tipo === 'aliado');
            return attackerIsAlly !== targetIsAlly; // only opposing team
        });
        if (targets.length > 0) {
            const targetRows = targets.map(t => {
                const hpPct = t.hp.max > 0 ? Math.round(t.hp.current / t.hp.max * 100) : 0;
                const hpColor = hpPct <= 0 ? '#555' : hpPct <= 25 ? '#ff4444' : hpPct <= 50 ? '#ffaa00' : '#4caf50';
                const tipoIcon = t.tipo === 'enemigo' ? '💀' : t.tipo === 'aliado' ? '💙' : '🎮';
                return `<div class="attack-target-row">
                    <div class="attack-target-info">
                        <span class="attack-target-icon">${tipoIcon}</span>
                        <span class="attack-target-name">${t.name.split(' ')[0]}</span>
                        <span class="attack-target-hp" style="color:${hpColor}">${t.hp.current}/${t.hp.max} ❤️</span>
                    </div>
                    <input type="number" class="attack-dmg-input" id="dmg_${t.id}"
                           placeholder="0 dmg" min="0" inputmode="numeric">
                </div>`;
            }).join('');
            attackTargetPanelHTML = `<div class="attack-target-panel">
                <div class="attack-target-title">⚔️ Aplicar daño</div>
                <div class="attack-target-list">${targetRows}</div>
                <button class="btn-apply-damage" onclick="applyAttackDamage('${p.id}')">💥 Aplicar Daño</button>
            </div>`;
        }
    }

    // HP slider fill percentage
    const sliderFillPct = p.hp.max > 0 ? Math.max(0, (p.hp.current / p.hp.max) * 100) : 0;

    const panelClass = `combat-active-panel${p.demonicForm ? ' demonic-active' : ''}${isSegundaAccion ? ' segunda-accion-active' : ''}${isExtraAttack ? ' extra-attack-active' : ''}`;
    panel.className = panelClass;

    const extraAttackHeaderHTML = isExtraAttack
        ? `<div class="extra-attack-header">🗡️ ATAQUE EXTRA — ${p.name.split(' ')[0]}</div>`
        : '';
    const segundaAccionHeaderHTML = isSegundaAccion
        ? `<div class="segunda-accion-header">⚔️ SEGUNDA ACCIÓN — ${p.name.split(' ')[0]}</div>`
        : '';
    const displayName = isExtraAttack ? `${p.name} — Ataque Extra` : isSegundaAccion ? `${p.name} — Segunda Acción` : p.name;

    panel.innerHTML = `
        ${extraAttackHeaderHTML}
        ${segundaAccionHeaderHTML}
        <div class="combat-active-header">
            <div class="combat-active-portrait">
                ${liveData?.imagen ? `<img src="${liveData.imagen}" onerror="this.style.display='none'">` : '<div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.05);border:2px solid var(--border-color);"></div>'}
            </div>
            <div class="combat-active-meta">
                <div class="combat-active-name">${displayName}</div>
                ${liveData ? `<div class="combat-active-class">${liveData.clase} · Nv ${liveData.nivel}</div>` : ''}
            </div>
        </div>
        <div class="combat-active-vitals">
            <div class="combat-vital-block ${hpClass}" id="activeHpBlock">
                <div class="combat-vital-label">❤️ Puntos de Golpe</div>
                <div class="combat-vital-value">
                    <input type="number" id="activeHpInput" class="hp-number-input"
                           min="0" max="${p.hp.max}" value="${p.hp.current}"
                           onchange="setParticipantHp('${p.id}', parseInt(this.value)||0)"
                           inputmode="numeric" aria-label="HP actual">
                    <span style="font-size:16px;color:var(--text-muted)"> / ${p.hp.max}</span>
                </div>
                <input type="range" class="combat-hp-slider"
                       min="0" max="${p.hp.max}" value="${p.hp.current}"
                       style="--fill-pct:${sliderFillPct}%"
                       oninput="setParticipantHp('${p.id}', parseInt(this.value))">
            </div>
            <div class="combat-vital-block">
                <div class="combat-vital-label">🛡️ Clase de Armadura</div>
                <div class="combat-vital-value">${p.ac}</div>
                ${p.speed ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">💨 ${p.speed}</div>` : ''}
            </div>
        </div>
        ${(isSegundaAccion || isExtraAttack) ? '' : concentrationBanner}
        ${(isSegundaAccion || isExtraAttack) ? '' : demonicToggleHTML}
        ${(isSegundaAccion || isExtraAttack) ? '' : sirvienteToggleHTML}
        ${smiteToggleHTML}
        ${(isSegundaAccion || isExtraAttack) ? '' : `<div class="combat-conds-bar">${condHTML}</div>`}
        ${actionChipsHTML}
        ${attackTargetPanelHTML}
        ${isExtraAttack ? `<button class="skip-extra-btn" onclick="skipExtraAttack()">⏭ Saltar Ataque Extra</button>` : ''}
        ${isSegundaAccion ? `<button class="skip-extra-btn" onclick="skipSegundaAccion()">⏭ Saltar Segunda Acción</button>` : ''}
        <div class="combat-recorded-section">
            <div class="combat-recorded-title">Registrado este turno:</div>
            <div id="combatRecordedList">${recordedHTML}</div>
        </div>
        ${(isSegundaAccion || isExtraAttack) ? '' : `<div class="combat-notes-section">
            <textarea class="combat-notes-input" placeholder="Notas del turno..."
                      oninput="setCombatTurnNote('${p.id}',this.value)">${currentEntry?.note || ''}</textarea>
        </div>`}
    `;
}
