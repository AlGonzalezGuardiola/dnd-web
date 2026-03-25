// ============================================
// Combat Manager — turn management, actions, HP in combat
// Depends on: globals.js, utils.js, storage.js
// Runtime deps: renderCombatLog, renderKillScoreboard, saveCombatState,
//   renderCombatShareLink, isMaster, setView
// ============================================

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

    view.innerHTML = `
        <div class="player-active-header">
            <div class="combat-round-badge">${roundLabel}</div>
            <button class="btn-end-combat" onclick="confirmEndCombat()">✕ Fin</button>
        </div>
        <div class="player-active-body">
            <div id="playerCombatPanel" class="combat-active-panel"></div>
        </div>
        <div class="player-active-footer">
            <button class="btn-combat-primary" onclick="nextCombatTurn()">Siguiente Turno →</button>
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
    // Build all available actions: charData + persistent custom actions
    const baseItems = [...(p.charData?.combateExtra || []), ...(p.charData?.conjuros || [])];
    const customItems = (p.customActions || []).map(a => ({ ...a, _custom: true }));
    const allItems = [...baseItems, ...customItems];

    // Separate modifier (smite) items — they have their own section and don't consume slots
    const modificadorItems = allItems.filter(a => inferActionType(a) === 'modificador');
    const regularItems     = allItems.filter(a => inferActionType(a) !== 'modificador');

    // Phase key for per-attack smite tracking
    const currentPhase = isExtraAttack ? 'extra' : (isSegundaAccion ? 'segunda' : 'main');

    const renderModifierChips = (items) => items.map(a => {
        const dado = a.dado && a.dado !== '—' ? a.dado : '';
        const safeName    = a.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeDado    = dado.replace(/'/g, "\\'");
        const safeTipo    = (a.tipo_dano || '').replace(/'/g, "\\'");
        const safeDesc    = (a.desc || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
        const isUsed = currentEntry?.actions.some(x => x.nombre === a.nombre && x.smitePhase === currentPhase) || false;
        return `<div class="combat-chip-wrapper">
            <button class="combat-chip smite-chip${isUsed ? ' used' : ''}"
                    onclick="toggleSmiteModifier('${p.id}','${safeName}','${safeDado}','${safeTipo}','${currentPhase}')">
                ✨ ${a.nombre}${dado ? `<small>${dado}</small>` : ''}
            </button>
            ${a.desc ? `<button class="chip-info-btn" onclick="showActionDetail('${safeName}','','${safeDado}','${safeDesc}')" title="Ver descripción">ℹ️</button>` : ''}
        </div>`;
    }).join('');

    // Show smite/modifier section only when a weapon attack is active this phase
    const hasWeaponAttackActive = (() => {
        if (isExtraAttack) return true;
        if (playerMode) {
            return ['accion_plan', 'adicional_plan'].some(key => {
                const plan = currentEntry?.slots?.[key];
                if (!plan) return false;
                const item = allItems.find(x => x.nombre === plan.nombre);
                return !!(item?.atk);
            });
        }
        return currentEntry?.actions.some(a => {
            if (a.isModifier) return false;
            const item = allItems.find(x => x.nombre === a.nombre);
            return !!(item?.atk);
        }) || false;
    })();

    const modifierSectionHTML = (modificadorItems.length && hasWeaponAttackActive) ? `<div class="combat-slot-section smite-section">
        <div class="combat-slot-header"><span>✨ Divine Smite</span><small style="color:var(--text-muted);font-size:11px">complemento del ataque</small></div>
        <div class="combat-chips">${renderModifierChips(modificadorItems)}</div>
    </div>` : '';

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

    // Render slot sections or mini-turn-only views
    let slotSections;
    if (isExtraAttack) {
        const weaponItems = regularItems.filter(a =>
            inferActionType(a) === 'accion' && a.atk && a.atk !== '—' && a.atk !== ''
        );
        slotSections = `<div class="combat-slot-section">
            <div class="combat-slot-header"><span>⚔️ Ataque Extra (solo armas)</span></div>
            ${weaponItems.length ? `<div class="combat-chips">${renderChips(weaponItems)}</div>` : `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin ataques disponibles</div>`}
        </div>
        ${modifierSectionHTML}`;
    } else if (isSegundaAccion) {
        const accionItems = regularItems.filter(a => inferActionType(a) === 'accion');
        slotSections = `<div class="combat-slot-section">
            <div class="combat-slot-header"><span>⚔️ Acción (Segunda Acción)</span></div>
            ${accionItems.length ? `<div class="combat-chips">${renderChips(accionItems)}</div>` : `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin acciones disponibles</div>`}
        </div>
        ${modifierSectionHTML}`;
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

        // Spell slot tracker (same as character sheet)
        const charData = p.charData;
        let combatSlotsHTML = '';
        if (charData?.ranuras?.length > 0) {
            initSpellSlotsForChar(p.id);
            combatSlotsHTML = `<div class="slot-tracker combat-slots">
                <div class="slot-tracker-header">
                    <span class="slot-tracker-title">✨ Ranuras</span>
                    <button class="slot-reset-btn" onclick="resetSpellSlots('${p.id}')" title="Descanso largo">🌙</button>
                </div>
                ${charData.ranuras.map(slot => {
                    const remaining = spellSlotState[p.id]?.[slot.nombre] ?? slot.total;
                    const pips = Array.from({ length: slot.total }, (_, i) =>
                        `<button class="slot-pip${i >= remaining ? ' used' : ''}"
                            onclick="toggleSpellSlot('${p.id}','${slot.nombre}',${i})"></button>`
                    ).join('');
                    return `<div class="slot-row">
                        <span class="slot-name">${slot.nombre}</span>
                        <div class="slot-track" data-slot="${slot.nombre}">${pips}</div>
                        <span class="slot-count" data-slot="${slot.nombre}">${remaining}/${slot.total}</span>
                    </div>`;
                }).join('')}
            </div>`;
        }

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
            let cardsHTML  = trucos.map(item => renderPlannerCard(item, section.key)).join('');
            if (hechizos.length > 0) {
                initSpellSlotsForChar(p.id);
                const byLevel = {};
                hechizos.forEach(sp => { if (!byLevel[sp.nivel]) byLevel[sp.nivel] = []; byLevel[sp.nivel].push(sp); });
                const hechizosCards = Object.keys(byLevel).sort((a, b) => a - b).map(lv => {
                    const slotName = `Nv${lv}`;
                    const slotDef = charData?.ranuras?.find(s => s.nombre === slotName);
                    const remaining = slotDef ? (spellSlotState[p.id]?.[slotName] ?? slotDef.total) : null;
                    const slotBadge = remaining !== null
                        ? `<span class="slot-badge${remaining === 0 ? ' slot-empty' : ''}">${remaining}/${slotDef.total} ranuras</span>`
                        : '';
                    return `<div class="hechizo-level-group">
                        <div class="hechizo-level-header">Nv${lv} ${slotBadge}</div>
                        ${byLevel[lv].map(item => renderPlannerCard(item, section.key)).join('')}
                    </div>`;
                }).join('');
                cardsHTML += `<div class="hechizos-subsection">
                    <div class="hechizos-subsection-title">✨ Hechizos (gastan ranura)</div>
                    ${hechizosCards}
                </div>`;
            }
            return `<div class="combat-section">
                <div class="combat-section-title">${section.icon} ${section.label}</div>
                <div class="combat-action-list">${cardsHTML}</div>
            </div>`;
        }).join('');

        // Smite/modifier section — always visible in player mode
        const smiteSectionHTML = modificadorItems.length ? `<div class="combat-section">
            <div class="combat-section-title">✨ Divine Smite</div>
            <div class="combat-section-subtitle">Complemento del ataque — activa si impactas</div>
            <div class="combat-chips">${renderModifierChips(modificadorItems)}</div>
        </div>` : '';

        slotSections = `
        <div class="turn-planner">
            <div class="turn-planner-slots">${plannerSlotsHTML}</div>
            <div class="turn-planner-dice">
                <div class="planner-dice-title">🎲 DADOS DEL TURNO</div>
                ${hasDice ? diceRows : '<div class="planner-dice-empty">Selecciona acciones abajo</div>'}
            </div>
        </div>
        ${combatSlotsHTML}
        <div class="combat-actions-cards-section">${cardSections}${smiteSectionHTML}</div>`;
    } else {
        slotSections = SLOTS.map(slot => {
            const isSlotUsed = (currentEntry?.slots?.[slot.key]) ||
                currentEntry?.actions.some(a => inferActionType(a) === slot.tipo) || false;
            const items = regularItems.filter(a => inferActionType(a) === slot.tipo);
            const chips = renderChips(items);
            const slotUsedClass = isSlotUsed ? ' used' : '';
            const btnClass = isSlotUsed ? 'used' : 'libre';
            const btnLabel = isSlotUsed ? '✅ Usada' : '☐ Libre';
            return `<div class="combat-slot-section${slotUsedClass}">
                <div class="combat-slot-header">
                    <span>${slot.icon} ${slot.label}</span>
                    <button class="slot-toggle-btn ${btnClass}" onclick="toggleSlotManual('${p.id}','${slot.key}')">${btnLabel}</button>
                </div>
                ${items.length ? `<div class="combat-chips">${chips}</div>` : `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin acciones disponibles</div>`}
            </div>`;
        }).join('') + modifierSectionHTML;
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
    if (!isSegundaAccion && !isExtraAttack && p.id === 'Zero' && p.charData?.invocaciones) {
        const invCards = p.charData.invocaciones.map(inv => `
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
                ? '<span class="demonic-badge">ACTIVA · CA 19 · Vel. 50ft · +1d8 Necr.</span>'
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
                ${p.charData?.imagen ? `<img src="${p.charData.imagen}" onerror="this.style.display='none'">` : '<div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.05);border:2px solid var(--border-color);"></div>'}
            </div>
            <div class="combat-active-meta">
                <div class="combat-active-name">${displayName}</div>
                ${p.charData ? `<div class="combat-active-class">${p.charData.clase} · Nv ${p.charData.nivel}</div>` : ''}
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

function toggleCombatAction(participantId, nombre, dice) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    if (!entry.slots) entry.slots = { accion: false, extraAtaque: false, adicional: false, reaccion: false };
    const idx = entry.actions.findIndex(a => a.nombre === nombre);
    const p = combatState.participants.find(x => x.id === participantId);
    const allItems = [...(p?.charData?.combateExtra || []), ...(p?.charData?.conjuros || [])];
    const actionObj = allItems.find(a => a.nombre === nombre);

    if (idx >= 0) {
        entry.actions.splice(idx, 1);
        // Restore spell slot if this was a leveled spell
        if (actionObj?.nivel && typeof actionObj.nivel === 'number') {
            const slotName = `Nv${actionObj.nivel}`;
            initSpellSlotsForChar(participantId);
            const slotDef = p?.charData?.ranuras?.find(s => s.nombre === slotName);
            if (slotDef) {
                spellSlotState[participantId][slotName] = Math.min(slotDef.total, (spellSlotState[participantId][slotName] ?? slotDef.total) + 1);
                saveStateToStorage();
                showNotification(`🔄 Ranura ${slotName} restaurada`, 1500);
            }
        }
    } else {
        // Check spell slot availability before adding
        if (actionObj?.nivel && typeof actionObj.nivel === 'number') {
            const slotName = `Nv${actionObj.nivel}`;
            initSpellSlotsForChar(participantId);
            const slotDef = p?.charData?.ranuras?.find(s => s.nombre === slotName);
            if (slotDef) {
                const cur = spellSlotState[participantId][slotName] ?? slotDef.total;
                if (cur <= 0) {
                    showNotification(`❌ Sin ranuras ${slotName} disponibles`, 2000);
                    return;
                }
                spellSlotState[participantId][slotName] = cur - 1;
                saveStateToStorage();
                showNotification(`✨ Ranura ${slotName} gastada`, 1500);
            }
        }
        entry.actions.push({ nombre, dice: dice || '' });
        // Determine action type to mark slot
        if (actionObj) {
            const tipo = inferActionType(actionObj);
            if (tipo === 'adicional') entry.slots.adicional = true;
            else if (tipo === 'reaccion') entry.slots.reaccion = true;
            else entry.slots.accion = true;
        }
    }
    saveCombatState();
    renderActivePanel();
    renderCombatLog();
}

// ── Group damage helper ───────────────────────────────────────────────────────
function applyGroupDamage(p, damage) {
    const prevMembers = p.membersRemaining ?? p.groupSize ?? 1;
    p.totalHp = Math.max(0, (p.totalHp ?? 0) - damage);

    if (p.totalHp <= 0) {
        p.membersRemaining = 0;
        p.currentMemberHp  = 0;
        p.hp.current       = 0;
    } else {
        const hpPer = p.hpPerMember || 1;
        // How many members still standing (including a partially damaged front member)
        p.membersRemaining = Math.ceil(p.totalHp / hpPer);
        // HP of the partially-damaged front member
        const remainder    = p.totalHp % hpPer;
        p.currentMemberHp  = remainder === 0 ? hpPer : remainder;
        // Keep hp.current mirroring totalHp so the bar works
        p.hp.current = p.totalHp;
        p.hp.max     = (p.groupSize || 1) * hpPer;
    }
    return Math.max(0, prevMembers - (p.membersRemaining ?? 0));
}

function applyAttackDamage(attackerId) {
    const inputs = document.querySelectorAll('.attack-dmg-input');
    let applied = 0;
    const log = [];
    inputs.forEach(input => {
        const targetId = input.id.replace('dmg_', '');
        const damage = parseInt(input.value) || 0;
        if (damage > 0) {
            const target = combatState.participants.find(p => p.id === targetId);
            if (target) {
                const prevHp = target.hp.current;

                if (target.isGroup) {
                    // ── Group damage ─────────────────────────────────────────────
                    const killed = applyGroupDamage(target, damage);
                    // Track each killed member for scoreboard
                    if (killed > 0 && target.tipo === 'enemigo') {
                        const currentEntry = getCurrentLogEntry();
                        if (currentEntry) {
                            if (!currentEntry.kills) currentEntry.kills = [];
                            for (let k = 0; k < killed; k++) currentEntry.kills.push(target.id);
                        }
                    }
                    const suffix = killed > 0 ? ` (×${killed} caídos)` : '';
                    log.push(`${target.name.split(' ')[0]} −${damage} PG${suffix}`);
                } else {
                    // ── Single target damage ─────────────────────────────────────
                    target.hp.current = Math.max(0, target.hp.current - damage);
                    if (prevHp > target.hp.current && target.conditions.includes('concentracion')) {
                        const cd = Math.max(10, Math.floor(damage / 2));
                        showNotification(`🧠 ${target.name.split(' ')[0]}: Concentración CD ${cd}`, 3500);
                    }
                    // Track kills for scoreboard (enemy drops to 0)
                    if (prevHp > 0 && target.hp.current === 0 && target.tipo === 'enemigo') {
                        const currentEntry = getCurrentLogEntry();
                        if (currentEntry) {
                            if (!currentEntry.kills) currentEntry.kills = [];
                            currentEntry.kills.push(target.id);
                        }
                    }
                    log.push(`${target.name.split(' ')[0]} −${damage} PG`);
                }

                applied++;
                input.value = '';
            }
        }
    });
    if (applied > 0) {
        saveCombatState();
        renderTurnQueue();
        renderActivePanel();
        renderCombatLog();
        renderKillScoreboard();
        showNotification(`💥 ${log.join(' · ')}`, 3000);
    } else {
        showNotification('Introduce al menos 1 de daño a un objetivo', 1800);
    }
}

function selectPlannerAction(participantId, nombre, atk, dado, tipoDano) {
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p) return;
    const entry = getCurrentLogEntry();
    if (!entry) return;
    const allItems = [...(p.charData?.combateExtra || []), ...(p.charData?.conjuros || []), ...(p.customActions || [])];
    const actionObj = allItems.find(a => a.nombre === nombre);
    const tipo = actionObj ? inferActionType(actionObj) : 'accion';
    const planKey = tipo + '_plan';
    if (!entry.slots) entry.slots = {};
    if (entry.slots[planKey]?.nombre === nombre) {
        entry.slots[planKey] = null;
        entry.actions = entry.actions.filter(a => a.nombre !== nombre);
        // Restore spell slot if leveled spell deselected
        if (actionObj?.nivel && typeof actionObj.nivel === 'number') {
            const slotName = `Nv${actionObj.nivel}`;
            initSpellSlotsForChar(participantId);
            const slotDef = p.charData?.ranuras?.find(s => s.nombre === slotName);
            if (slotDef) {
                spellSlotState[participantId][slotName] = Math.min(slotDef.total, (spellSlotState[participantId][slotName] ?? slotDef.total) + 1);
                saveStateToStorage();
                showNotification(`🔄 Ranura ${slotName} restaurada`, 1500);
            }
        }
    } else {
        // Restore old slot if switching from a different leveled spell in the same plan slot
        const prevPlan = entry.slots?.[planKey];
        if (prevPlan && prevPlan.nombre !== nombre) {
            const prevObj = allItems.find(a => a.nombre === prevPlan.nombre);
            if (prevObj?.nivel && typeof prevObj.nivel === 'number') {
                const prevSlotName = `Nv${prevObj.nivel}`;
                initSpellSlotsForChar(participantId);
                const prevSlotDef = p.charData?.ranuras?.find(s => s.nombre === prevSlotName);
                if (prevSlotDef) {
                    spellSlotState[participantId][prevSlotName] = Math.min(prevSlotDef.total, (spellSlotState[participantId][prevSlotName] ?? prevSlotDef.total) + 1);
                    saveStateToStorage();
                }
                entry.actions = entry.actions.filter(a => a.nombre !== prevPlan.nombre);
            }
        }
        // Check slot availability for leveled spells
        if (actionObj?.nivel && typeof actionObj.nivel === 'number') {
            const slotName = `Nv${actionObj.nivel}`;
            initSpellSlotsForChar(participantId);
            const slotDef = p.charData?.ranuras?.find(s => s.nombre === slotName);
            if (slotDef) {
                const cur = spellSlotState[participantId][slotName] ?? slotDef.total;
                if (cur <= 0) {
                    showNotification(`❌ Sin ranuras ${slotName} disponibles`, 2000);
                    return;
                }
                spellSlotState[participantId][slotName] = cur - 1;
                saveStateToStorage();
                showNotification(`✨ Ranura ${slotName} gastada`, 1500);
            }
        }
        entry.slots[planKey] = { nombre, atk: atk || '', dado: dado || '', tipo_dano: tipoDano || '' };
        if (!entry.actions.some(a => a.nombre === nombre))
            entry.actions.push({ nombre, dice: atk ? `${atk}${dado ? '/' + dado : ''}` : dado });
    }
    saveCombatState();
    renderActivePanel(document.getElementById('playerCombatPanel'), combatState.currentIndex);
    renderCombatLog();
}

function removePlannerSlot(participantId, slotKey) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    const plan = entry.slots?.[slotKey + '_plan'];
    if (plan) {
        entry.actions = entry.actions.filter(a => a.nombre !== plan.nombre);
        // Restore spell slot if the removed plan was a leveled spell
        const p = combatState.participants.find(x => x.id === participantId);
        if (p?.charData) {
            const allItems = [...(p.charData.combateExtra || []), ...(p.charData.conjuros || [])];
            const actionObj = allItems.find(x => x.nombre === plan.nombre);
            if (actionObj?.nivel && typeof actionObj.nivel === 'number') {
                const slotName = `Nv${actionObj.nivel}`;
                initSpellSlotsForChar(participantId);
                const slotDef = p.charData.ranuras?.find(s => s.nombre === slotName);
                if (slotDef) {
                    spellSlotState[participantId][slotName] = Math.min(slotDef.total, (spellSlotState[participantId][slotName] ?? slotDef.total) + 1);
                    saveStateToStorage();
                }
            }
        }
        entry.slots[slotKey + '_plan'] = null;
    }
    saveCombatState();
    renderActivePanel(document.getElementById('playerCombatPanel'), combatState.currentIndex);
    renderCombatLog();
}

function toggleSmiteModifier(participantId, nombre, dado, tipoDano, phase) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    const existingIdx = entry.actions.findIndex(x => x.nombre === nombre && x.smitePhase === phase);
    if (existingIdx >= 0) {
        entry.actions.splice(existingIdx, 1);
    } else {
        entry.actions.push({ nombre, dice: dado, isModifier: true, smitePhase: phase });
    }
    saveCombatState();
    const panelEl = document.getElementById('combatActivePanel') || document.getElementById('playerCombatPanel');
    renderActivePanel(panelEl, combatState.currentIndex);
    renderCombatLog();
}

function removeCombatAction(participantId, nombre) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    entry.actions = entry.actions.filter(a => a.nombre !== nombre);
    saveCombatState();
    renderActivePanel();
    renderCombatLog();
}

function addCustomCombatAction(participantId) {
    const input = document.getElementById('customActionInput');
    const text = input?.value?.trim();
    if (!text) return;
    const entry = getCurrentLogEntry();
    if (!entry) return;
    entry.actions.push({ nombre: text, dice: '' });
    if (input) input.value = '';
    saveCombatState();
    renderActivePanel();
    renderCombatLog();
}

function setCombatTurnNote(participantId, value) {
    const entry = getCurrentLogEntry();
    if (entry) {
        entry.note = value;
        saveCombatState();
    }
}

function setParticipantHp(id, value) {
    const p = combatState.participants.find(x => x.id === id);
    if (!p) return;
    const prevHp = p.hp.current;
    p.hp.current = Math.max(0, Math.min(p.hp.max, isNaN(value) ? p.hp.current : value));
    // Concentration save reminder
    if (prevHp > p.hp.current && p.conditions.includes('concentracion')) {
        const dmgTaken = prevHp - p.hp.current;
        const cd = Math.max(10, Math.floor(dmgTaken / 2));
        showNotification(`🧠 Concentración: ¡Tirada de CON CD ${cd}!`, 4000);
    }
    saveCombatState();
    // Lightweight DOM update — don't rebuild panel (would kill slider/input focus)
    const hpDisplay = document.getElementById('activeHpInput');
    if (hpDisplay) hpDisplay.value = p.hp.current;
    const hpBlock = document.getElementById('activeHpBlock');
    if (hpBlock) {
        const pct = p.hp.max > 0 ? (p.hp.current / p.hp.max) * 100 : 0;
        hpBlock.className = 'combat-vital-block ' +
            (pct <= 0 ? 'hp-dead' : pct <= 25 ? 'hp-critical' : pct <= 50 ? 'hp-low' : '');
        const slider = hpBlock.querySelector('.combat-hp-slider');
        if (slider) { slider.value = p.hp.current; slider.style.setProperty('--fill-pct', pct + '%'); }
    }
    renderTurnQueue();
}

function toggleParticipantCondition(id, condId) {
    const p = combatState.participants.find(x => x.id === id);
    if (!p) return;
    const idx = p.conditions.indexOf(condId);
    if (idx >= 0) p.conditions.splice(idx, 1);
    else p.conditions.push(condId);
    saveCombatState();
    renderActivePanel();
}

function nextCombatTurn() {
    if (!isMaster()) {
        // Jugador: solo puede avanzar si es su turno o el turno de su invocación/aliado
        const p = combatState.participants[combatState.currentIndex];
        const isMyCharTurn = gameRole.characterId && p.id === gameRole.characterId;
        const isMyAllyTurn = (
            p.ownerCharId === gameRole.characterId ||
            (p._isSirvienteInvisible && gameRole.characterId === 'Vel')
        );
        if (!isMyCharTurn && !isMyAllyTurn) return;
        _doNextTurn();
        return;
    }

    const p = combatState.participants[combatState.currentIndex];
    if (p?.tipo === 'jugador') { _doNextTurn(); return; }

    const current = getCurrentLogEntry();
    // Extra attack / segunda acción mini-turns: no warning needed, can always pass
    if (combatState.extraAttackTurn) { _doNextTurn(); return; }
    if (combatState.segundaAccionTurn) { _doNextTurn(); return; }
    if (!current?.actions.length && !current?.note?.trim()) {
        showNextTurnWarning();
        return;
    }
    _doNextTurn();
}

function showNextTurnWarning() {
    if (document.getElementById('nextTurnWarning')) return;
    const panel = document.getElementById('combatActivePanel');
    if (!panel) return;
    const div = document.createElement('div');
    div.id = 'nextTurnWarning';
    div.className = 'next-turn-warning';
    div.innerHTML = `⚠️ Sin acciones registradas. ¿Seguro que quieres continuar?
        <div style="margin-top:8px;display:flex;gap:8px;justify-content:center">
            <button class="btn-combat-secondary" onclick="confirmNextTurn()" style="padding:6px 16px">Continuar</button>
            <button class="btn-combat-secondary" onclick="dismissNextTurnWarning()" style="padding:6px 16px">Cancelar</button>
        </div>`;
    panel.prepend(div);
}

function confirmNextTurn() {
    dismissNextTurnWarning();
    _doNextTurn();
}

function dismissNextTurnWarning() {
    document.getElementById('nextTurnWarning')?.remove();
}

function _doNextTurn() {
    const current = getCurrentLogEntry();
    if (current) current.isCurrent = false;

    if (combatState.extraAttackTurn) {
        // Finishing the ataque extra mini-turn → advance to next participant
        combatState.extraAttackTurn = false;
        combatState.currentIndex++;
        if (combatState.currentIndex >= combatState.participants.length) {
            combatState.currentIndex = 0;
            combatState.round++;
        }
    } else if (combatState.segundaAccionTurn) {
        // Finishing the segunda acción mini-turn → advance to next participant
        combatState.segundaAccionTurn = false;
        combatState.currentIndex++;
        if (combatState.currentIndex >= combatState.participants.length) {
            combatState.currentIndex = 0;
            combatState.round++;
        }
    } else {
        // Check if current participant has extraAttack or segundaAccion
        const currP = combatState.participants[combatState.currentIndex];
        if (currP?.charData?.extraAttack) {
            combatState.extraAttackTurn = true;
            // Stay on same currentIndex (same participant, ataque extra mini-turn)
        } else if (currP?.charData?.segundaAccion) {
            combatState.segundaAccionTurn = true;
            // Stay on same currentIndex (same participant, segunda acción mini-turn)
        } else {
            combatState.currentIndex++;
            if (combatState.currentIndex >= combatState.participants.length) {
                combatState.currentIndex = 0;
                combatState.round++;
            }
        }
    }

    // Skip invocations/summons waiting for their debut round
    let skipGuard = 0;
    while (skipGuard++ < combatState.participants.length) {
        const next = combatState.participants[combatState.currentIndex];
        if (next?._debutRound && next._debutRound > combatState.round) {
            // Auto-advance past this participant for now
            combatState.currentIndex++;
            if (combatState.currentIndex >= combatState.participants.length) {
                combatState.currentIndex = 0;
                combatState.round++;
            }
        } else {
            if (next?._debutRound) delete next._debutRound; // clear flag when ready
            break;
        }
    }

    createCurrentTurnEntry();
    saveCombatState();
    renderCombatManager();
}

function skipSegundaAccion() {
    combatState.segundaAccionTurn = false;
    const current = getCurrentLogEntry();
    if (current) current.isCurrent = false;
    combatState.currentIndex++;
    if (combatState.currentIndex >= combatState.participants.length) {
        combatState.currentIndex = 0;
        combatState.round++;
    }
    createCurrentTurnEntry();
    saveCombatState();
    renderCombatManager();
}

function skipExtraAttack() {
    combatState.extraAttackTurn = false;
    const current = getCurrentLogEntry();
    if (current) current.isCurrent = false;
    combatState.currentIndex++;
    if (combatState.currentIndex >= combatState.participants.length) {
        combatState.currentIndex = 0;
        combatState.round++;
    }
    createCurrentTurnEntry();
    saveCombatState();
    renderCombatManager();
}

function previousCombatTurn() {
    if (!isMaster()) return;
    const log = combatState.log;
    const currentIdx = log.findIndex(e => e.isCurrent);
    if (currentIdx <= 0) { showNotification('⬅️ Ya estás en el primer turno', 2000); return; }

    // Remove current entry
    log.splice(currentIdx, 1);

    // Mark previous as current
    const prevEntry = log[log.length - 1];
    if (!prevEntry) return;
    prevEntry.isCurrent = true;

    // Restore snapshot
    const snap = prevEntry.snapshot;
    if (snap) {
        combatState.currentIndex = snap.currentIndex;
        combatState.round = snap.round;
        combatState.segundaAccionTurn = snap.segundaAccionTurn || false;
        combatState.extraAttackTurn = snap.extraAttackTurn || false;
        // Restore participant HP, conditions, demonicForm, ac, speed
        snap.participants.forEach(snapP => {
            const p = combatState.participants.find(x => x.id === snapP.id);
            if (p) {
                p.hp = { ...snapP.hp };
                p.conditions = [...snapP.conditions];
                p.demonicForm = snapP.demonicForm;
                p.ac = snapP.ac;
                p.speed = snapP.speed;
            }
        });
    }
    // Online: bypass debounce so remote devices see the turn change immediately.
    // A debounced save risks being overwritten by a stale SSE echo before the PUT fires.
    saveCombatState({ immediate: isOnlineCombat });
    renderCombatManager();
    showNotification('⬅️ Turno anterior restaurado', 2000);
}

// ---- Demonic Form in Combat ----
function toggleDemonicFormInCombat(participantId) {
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p) return;
    p.demonicForm = !p.demonicForm;
    if (p.demonicForm) {
        p.ac    = String((parseInt(p.baseAc) || 0) + 2);
        p.speed = '50ft';
        showNotification('😈 ¡Forma Demoníaca activa! CA+2, Velocidad 50ft, +1d8 Necrótico', 2500);
    } else {
        p.ac    = p.baseAc;
        p.speed = p.baseSpeed;
        showNotification('💔 Forma Demoníaca desactivada', 2000);
    }
    saveCombatState();
    renderCombatManager();
}

// ---- Sirviente Invisible (Vel only) ----
function toggleSirvienteInvisible(velParticipantId) {
    const velP = combatState.participants.find(x => x.id === velParticipantId);
    if (!velP) return;

    const sirvienteId = 'sirviente_invisible_vel';
    const sirvienteIdx = combatState.participants.findIndex(x => x.id === sirvienteId);

    if (sirvienteIdx !== -1) {
        // DEACTIVATE: Remove Sirviente from initiative
        if (combatState.currentIndex > sirvienteIdx) {
            combatState.currentIndex--;
        } else if (combatState.currentIndex === sirvienteIdx) {
            // We're on Sirviente's turn — jump back to Vel
            combatState.currentIndex = combatState.participants.findIndex(x => x.id === velParticipantId);
        }
        combatState.participants.splice(sirvienteIdx, 1);
        velP.sirvienteActive = false;
        showNotification('👻 Sirviente Invisible retirado del combate', 2000);
    } else {
        // ACTIVATE: Insert Sirviente right after Vel in initiative order
        const velIdx = combatState.participants.findIndex(x => x.id === velParticipantId);
        const charData = buildSirvienteCharData(velP.ac);
        const sirviente = {
            id: sirvienteId,
            name: 'Sirviente Invisible',
            initiative: velP.initiative,
            hp: { current: 1, max: 1 },
            ac: velP.ac,
            baseAc: velP.ac,
            speed: '30ft',
            baseSpeed: '30ft',
            conditions: [],
            note: '',
            charData,
            demonicForm: false,
            tipo: 'aliado',
            customActions: [],
            _isSirvienteInvisible: true,
            ownerCharId: velParticipantId,           // belongs to Vel
        };
        combatState.participants.splice(velIdx + 1, 0, sirviente);
        // Shift currentIndex if we inserted before it
        if (combatState.currentIndex > velIdx) {
            combatState.currentIndex++;
        }
        velP.sirvienteActive = true;
        showNotification('👻 Sirviente Invisible invocado — CA ' + velP.ac, 2500);
    }
    saveCombatState();
    renderCombatManager();
}

// ---- Invocation Functions ----
function showInvocationDetail(charId, invId) {
    const char = window.characterData[charId];
    const inv = char?.invocaciones?.find(x => x.id === invId);
    if (!inv) return;
    document.getElementById('invocationDetailOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'invocationDetailOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    const habilidadesHTML = inv.habilidades?.map(h => `<div class="invocation-ability">• ${h}</div>`).join('') || '';
    overlay.innerHTML = `
        <div class="invocation-detail-modal">
            <div class="combat-resume-title">${inv.emoji} ${inv.nombre}</div>
            <div style="display:flex;gap:16px;justify-content:center;margin:12px 0">
                <div class="combat-vital-block" style="min-width:80px;text-align:center">
                    <div class="combat-vital-label">❤️ HP</div>
                    <div class="combat-vital-value">${inv.hp}</div>
                </div>
                <div class="combat-vital-block" style="min-width:80px;text-align:center">
                    <div class="combat-vital-label">🛡️ CA</div>
                    <div class="combat-vital-value">${inv.ca}</div>
                </div>
                <div class="combat-vital-block" style="min-width:80px;text-align:center">
                    <div class="combat-vital-label">💨 Vel.</div>
                    <div class="combat-vital-value" style="font-size:14px">${inv.velocidad}</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;margin:8px 0">
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">⚔️ Ataque</div>
                <div style="font-size:13px;color:var(--text-primary)">${inv.ataque}</div>
            </div>
            ${habilidadesHTML ? `<div style="margin-top:10px">
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Habilidades</div>
                ${habilidadesHTML}
            </div>` : ''}
            <div style="display:flex;gap:10px;margin-top:16px">
                <button class="btn-combat-primary" style="flex:1" onclick="addInvocationToCombat('${charId}','${invId}');document.getElementById('invocationDetailOverlay')?.remove()">+ Al combate</button>
                <button class="btn-combat-secondary" style="flex:1" onclick="document.getElementById('invocationDetailOverlay')?.remove()">Cerrar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function addInvocationToCombat(charId, invId) {
    const char = window.characterData[charId];
    const inv = char?.invocaciones?.find(x => x.id === invId);
    if (!inv) return;
    const uid = `inv_${invId}_${Date.now()}`;
    const participant = {
        id: uid,
        name: inv.nombre,
        initiative: 0,
        hp: { current: inv.hp, max: inv.hp },
        ac: String(inv.ca),
        baseAc: String(inv.ca),
        speed: inv.velocidad,
        baseSpeed: inv.velocidad,
        conditions: [],
        note: '',
        charData: null,
        demonicForm: false,
        tipo: 'aliado',
        ownerCharId: charId,                         // tracks which character summoned it
        _debutRound: combatState.round + 1,          // won't act until next round
    };
    // Prompt for initiative
    const initVal = prompt(`Iniciativa para ${inv.nombre}:`, '0');
    participant.initiative = parseInt(initVal) || 0;

    // Save current participant ID so we can restore currentIndex after the sort
    const currentPId = combatState.participants[combatState.currentIndex]?.id;

    combatState.participants.push(participant);
    combatState.participants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

    // Restore currentIndex to the same participant (sort may have shifted it)
    if (currentPId) {
        const newIdx = combatState.participants.findIndex(x => x.id === currentPId);
        if (newIdx !== -1) combatState.currentIndex = newIdx;
    }

    saveCombatState();
    renderCombatManager();
    showNotification(`🔮 ${inv.nombre} añadido — actúa desde ronda ${combatState.round + 1}`, 2500);
}

// ---- Quick Enemy / Ally Functions ----
// _quickNpcTipo is declared in globals.js

function showQuickEnemyModal(context) { showQuickNpcModal(context, 'enemigo'); }
function showQuickAllyModal(context)  { showQuickNpcModal(context, 'aliado');  }

function showQuickNpcModal(context, tipo) {
    _quickNpcTipo = tipo;
    const isEnemy = tipo === 'enemigo';
    const icon  = isEnemy ? '💀' : '💙';
    const label = isEnemy ? 'Enemigo' : 'Aliado';
    const placeholder = isEnemy ? 'Nombre (ej: Goblin)' : 'Nombre (ej: Guardia)';
    document.getElementById('quickEnemyOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'quickEnemyOverlay';
    overlay.className = 'combat-resume-overlay';

    // Extra fields differ by tipo
    const extraToggle = isEnemy ? `
        <div class="qe-group-row">
            <input id="qeGroupSize" class="quick-enemy-input" type="number" placeholder="Nº miembros (grupo)" min="1"
                   title="Pon 2 o más para crear un grupo. PG = HP por miembro.">
            <small class="npc-group-hint">Nº miembros ≥ 2 → grupo (PG = HP/miembro)</small>
        </div>` : `
        <div class="qe-toggle-row">
            <label class="qe-toggle-label">
                <input type="checkbox" id="qeIsSummon" onchange="toggleQeSummonFields()">
                <span>Es una invocación</span>
            </label>
            <div id="qeSummonFields" style="display:none;">
                <select id="qeSummoner" class="quick-enemy-input" style="margin-top:6px;">
                    <option value="ASTHOR">Asthor (Sirviente)</option>
                    <option value="ZERO">Zero</option>
                </select>
            </div>
        </div>`;

    overlay.innerHTML = `
        <div class="quick-enemy-modal">
            <div class="quick-enemy-title">${icon} ${label} Rápido</div>
            <input id="qeName" class="quick-enemy-input" placeholder="${placeholder}" autocomplete="off">
            <input id="qeHp" class="quick-enemy-input" type="number" placeholder="${isEnemy ? 'PG máximos (por miembro si es grupo)' : 'PG máximos'}" min="1">
            <input id="qeAc" class="quick-enemy-input" type="number" placeholder="Clase de Armadura" min="1">
            ${context === 'combat' ? `<input id="qeInit" class="quick-enemy-input" type="number" placeholder="Iniciativa (opcional, 0 = al final)">` : ''}
            ${extraToggle}

            <div class="qe-actions-section">
                <div class="qe-actions-title">⚔️ Acciones (opcional)</div>
                <div id="qeActionsList" class="qe-actions-list"></div>
                <button class="qe-add-action-btn" onclick="addQeAction()">+ Añadir acción</button>
            </div>

            <div class="quick-enemy-btns">
                <button class="btn-combat-primary" onclick="submitQuickNpc('${context}')">Añadir</button>
                <button class="btn-combat-secondary" onclick="document.getElementById('quickEnemyOverlay')?.remove()">Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('qeName')?.focus();
}

function toggleQeGroupFields() {
    const checked = document.getElementById('qeIsGroup')?.checked;
    const fields  = document.getElementById('qeGroupFields');
    if (fields) fields.style.display = checked ? 'block' : 'none';
}

function toggleQeSummonFields() {
    const checked = document.getElementById('qeIsSummon')?.checked;
    const fields  = document.getElementById('qeSummonFields');
    if (fields) fields.style.display = checked ? 'block' : 'none';
}

function addQeAction() {
    const list = document.getElementById('qeActionsList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'qe-action-row';
    row.innerHTML = `
        <input class="quick-enemy-input qe-action-name" placeholder="Nombre">
        <select class="qe-action-select qe-action-type">
            <option value="ACTION">Acción</option>
            <option value="BONUS_ACTION">Ac. adicional</option>
            <option value="REACTION">Reacción</option>
            <option value="EXTRA_ATTACK">Ataque extra</option>
        </select>
        <input class="quick-enemy-input qe-action-desc" placeholder="Descripción corta">
        <button class="qe-action-remove-btn" onclick="this.closest('.qe-action-row').remove()">✕</button>
    `;
    list.appendChild(row);
}

function getQeActions() {
    return Array.from(document.querySelectorAll('#qeActionsList .qe-action-row'))
        .map(row => ({
            name:        row.querySelector('.qe-action-name')?.value?.trim() || '',
            type:        row.querySelector('.qe-action-type')?.value        || 'ACTION',
            description: row.querySelector('.qe-action-desc')?.value?.trim() || '',
        }))
        .filter(a => a.name);
}

function _actionTypeToTipo(type) {
    return { ACTION: 'accion', BONUS_ACTION: 'adicional', REACTION: 'reaccion', EXTRA_ATTACK: 'accion' }[type] || 'accion';
}

function submitQuickEnemy(context) { submitQuickNpc(context); } // backward compat alias

async function submitQuickNpc(context) {
    const tipo = _quickNpcTipo || 'enemigo';
    const isEnemy = tipo === 'enemigo';
    const icon = isEnemy ? '💀' : '💙';
    const name = document.getElementById('qeName')?.value?.trim();
    const hp   = parseInt(document.getElementById('qeHp')?.value) || 10;
    const ac   = parseInt(document.getElementById('qeAc')?.value) || 10;
    const initEl = document.getElementById('qeInit');
    const initiative = initEl ? (parseInt(initEl.value) || 0) : 0;
    if (!name) { showNotification('⚠️ Introduce un nombre', 2000); return; }

    // ── Group / summon flags ──────────────────────────────────────────────────
    const rawQeGroupSize = parseInt(document.getElementById('qeGroupSize')?.value) || 1;
    const isGroup   = isEnemy && rawQeGroupSize >= 2;
    const groupSize = isGroup ? rawQeGroupSize : 1;
    const isSummon  = !!(document.getElementById('qeIsSummon')?.checked);
    const summoner  = isSummon ? (document.getElementById('qeSummoner')?.value || '') : '';

    // ── Zero one-summon check (frontend fast-path) ────────────────────────────
    if (isSummon && summoner === 'ZERO') {
        // Check both active participants AND setup NPCs (pre-combat phase)
        const existingInCombat = combatState.participants.find(p =>
            p.isSummon && p.summoner === 'ZERO' && (p.hp?.current > 0 || (p.totalHp ?? 0) > 0)
        );
        const existingInSetup = setupNpcs.find(n => n.isSummon && n.summoner === 'ZERO');
        if (existingInCombat || existingInSetup) {
            showNotification('⚠️ Zero ya tiene una invocación activa', 3000);
            return;
        }
    }

    // Collect actions defined in the form
    const actions = getQeActions();
    const combateExtra = actions.map(a => ({
        nombre: a.name,
        tipo:   _actionTypeToTipo(a.type),
        atk: '', dado: '', desc: a.description,
    }));

    // Total HP for groups
    const totalHp    = hp * groupSize;
    const displayHp  = isGroup ? totalHp : hp;

    const uid = `qe_${Date.now()}`;
    const charData = {
        id: uid, tipo, nombre: name,
        clase: isEnemy ? 'Enemigo' : 'Aliado NPC', nivel: '—', imagen: '',
        resumen: { HP: String(displayHp), CA: String(ac), Velocidad: '30ft' },
        combateExtra, conjuros: [],
    };
    window.characterData[uid] = charData;
    document.getElementById('quickEnemyOverlay')?.remove();

    // ── Save as reusable template (always, not just when online) ─────────────
    _saveEntityTemplate({
        name,
        type:      isEnemy ? 'ENEMY' : 'ALLY',
        stats:     { hp, ac },
        actions,
        isGroup, groupSize,
        isSummon, summoner,
    });

    // Persist to backend (fire-and-forget; doesn't block the UI)
    if (isOnlineCombat && activeCombatId) {
        try {
            const resp = await fetch(`${API_BASE}/api/combat-entities`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    type:      isEnemy ? 'ENEMY' : 'ALLY',
                    stats:     { hp, ac, initiative },
                    actions,
                    combatId:  activeCombatId,
                    sessionId: activeJoinCode || '',
                    isGroup, groupSize,
                    membersRemaining: groupSize,
                    hpPerMember:      hp,
                    totalHp,
                    currentMemberHp:  hp,
                    isSummon, summoner,
                    summonedBeforeCombat: false,
                }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                if (err.code === 'ZERO_SUMMON_LIMIT') {
                    showNotification('⚠️ Zero ya tiene una invocación activa', 3000);
                    return;
                }
            }
        } catch (e) {
            console.warn('[combat-entities] save failed:', e.message);
        }
    }

    // Build participant object
    const participant = {
        id: uid, name,
        initiative,
        hp: { current: displayHp, max: displayHp },
        ac: String(ac), baseAc: String(ac),
        speed: '30ft', baseSpeed: '30ft',
        conditions: [], note: '', charData,
        demonicForm: false, tipo,
        customActions: [],
        // Group fields
        isGroup, groupSize,
        membersRemaining: groupSize,
        hpPerMember: hp,
        totalHp,
        currentMemberHp: hp,
        // Summon fields
        isSummon, summoner,
        summonedBeforeCombat: false,
    };

    if (context === 'setup') {
        // Push to setupNpcs (same path as the NPC builder form)
        // so beginCombatFromSetup picks up group/summon fields correctly.
        setupNpcs.push({
            tipo, nombre: name, pg: hp, ca: ac, initiative,
            acciones: '', adicionales: '', reacciones: '',
            isGroup, groupSize,
            isSummon, summoner, summonedBeforeCombat: false,
            _uid: uid,
        });
        renderSetupNpcList(tipo);
        _updateSetupCount();
        showNotification(`${icon} ${name} añadido a la selección`, 2000);
    } else {
        combatState.participants.push(participant);
        combatState.participants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
        saveCombatState();
        renderCombatManager();
        showNotification(`${icon} ${name} añadido al combate`, 2000);
    }
}

function removeParticipant(participantId) {
    const idx = combatState.participants.findIndex(p => p.id === participantId);
    if (idx === -1) return;
    const name = combatState.participants[idx].name;
    combatState.participants.splice(idx, 1);
    // Adjust currentIndex if needed
    if (combatState.currentIndex >= combatState.participants.length) {
        combatState.currentIndex = Math.max(0, combatState.participants.length - 1);
    } else if (combatState.currentIndex > idx) {
        combatState.currentIndex--;
    }
    saveCombatState();
    renderCombatManager();
    showNotification(`✕ ${name} retirado del combate`, 1500);
}

function addCombatCustomAction(participantId) {
    addCustomCombatAction(participantId);
}
