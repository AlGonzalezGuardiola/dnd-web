// ============================================
// Reactions — reaction offer system
// Depends on: globals.js, utils.js, combat-manager.js
// ============================================

let _lastShownReactionTriggerId = null;

// ── Trigger type detection ────────────────────────────────────────────────────

// Classify what event triggers this reaction based on its description/name.
// Returns: 'hechizo' | 'daño' | 'ally_daño' | 'ataque' | 'any'
function getReactionTriggerType(reaction) {
    const desc   = (reaction.desc   || '').toLowerCase();
    const nombre = (reaction.nombre || '').toLowerCase();

    // Spell counters (Contrahechizo)
    if (nombre.includes('contrahechizo') ||
        desc.includes('conjuro') ||
        desc.includes('interrumpe') ||
        desc.includes('anula conjuro') ||
        desc.includes('lanzarse')) {
        return 'hechizo';
    }
    // Damage reactions triggered on self receiving damage (Represión Infernal)
    if (desc.includes('recibir daño') ||
        desc.includes('al recibir') ||
        desc.includes('recibido') ||
        desc.includes('ser golpead')) {
        return 'daño';
    }
    // Ally-damage reactions (Venganza del Guardián)
    if (desc.includes('aliado') && (desc.includes('daño') || desc.includes('recibe'))) {
        return 'ally_daño';
    }
    // Attack/action reactions (Velo de la Doncella, generic)
    if (desc.includes('ataque') || desc.includes('atacante') ||
        desc.includes('inmunidad') || desc.includes('ataque o hechizo')) {
        return 'ataque';
    }
    return 'any';
}

// Reactions for this participant that match the given event trigger type.
function _getApplicableReactions(p, triggerType) {
    const data = getEffectiveCharData(p);
    if (!data) return [];
    const all = [
        ...(data.combateExtra || []),
        ...(data.conjuros    || []),
        ...(p.customActions  || []),
    ];
    return all
        .filter(a => inferActionType(a) === 'reaccion')
        .filter(r => {
            const rt = getReactionTriggerType(r);
            if (rt === 'any') return true;
            if (rt === triggerType) return true;
            // Velo / generic attack reactions also fire on spells
            if (triggerType === 'hechizo' && rt === 'ataque') return true;
            return false;
        });
}

// All reaction abilities for a participant (unfiltered — for display)
function getParticipantReactions(p) {
    const data = getEffectiveCharData(p);
    if (!data) return [];
    const all = [
        ...(data.combateExtra || []),
        ...(data.conjuros    || []),
        ...(p.customActions  || []),
    ];
    return all.filter(a => inferActionType(a) === 'reaccion');
}

// True if the participant still has their reaction available this round
function canParticipantReact(participantId) {
    return !combatState.reactionsUsed?.[participantId];
}

// True if this device controls this participant
function _isMyParticipant(p) {
    if (isMaster()) {
        return p.tipo === 'enemigo' || !isOnlineCombat;
    }
    return p.id === gameRole.characterId;
}

// ── Public API ────────────────────────────────────────────────────────────────

// Called after an action/spell is recorded for actorId.
// actionType: 'accion' | 'adicional' | 'hechizo'
function offerReactions(actorId, actionName, actionType) {
    if (!combatState.isActive) return;
    if (actionType === 'reaccion' || actionType === 'modificador') return;

    // Map to reaction trigger vocabulary
    const triggerType = actionType === 'hechizo' ? 'hechizo' : 'ataque';

    const reactors = combatState.participants.filter(p => {
        if (p.id === actorId) return false;
        if (!canParticipantReact(p.id)) return false;
        return _getApplicableReactions(p, triggerType).length > 0;
    });
    if (reactors.length === 0) return;

    const triggerId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const trigger = { id: triggerId, actorId, actionName, actionType: triggerType };

    const myReactors = reactors.filter(p => _isMyParticipant(p));
    if (myReactors.length > 0) {
        _lastShownReactionTriggerId = triggerId;
        _showReactionPopup(trigger, myReactors);
    }

    if (isOnlineCombat && reactors.some(p => !_isMyParticipant(p))) {
        combatState.pendingReactionTrigger = trigger;
        saveToApiNow();
    }
}

// Called when a participant takes damage (from applyAttackDamage or setParticipantHp).
function offerDamageReactions(damagedId, prevHp) {
    if (!combatState.isActive) return;
    if (!canParticipantReact(damagedId)) return;

    const damagedP = combatState.participants.find(p => p.id === damagedId);
    if (!damagedP) return;
    // Only trigger if HP actually went down
    if (prevHp !== undefined && damagedP.hp.current >= prevHp) return;

    const applicable = _getApplicableReactions(damagedP, 'daño');
    if (applicable.length === 0) return;

    const triggerId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const trigger = { id: triggerId, actorId: damagedId, actionName: 'Daño recibido', actionType: 'daño' };

    if (_isMyParticipant(damagedP)) {
        _lastShownReactionTriggerId = triggerId;
        _showReactionPopup(trigger, [damagedP]);
    } else if (isOnlineCombat) {
        combatState.pendingReactionTrigger = trigger;
        saveToApiNow();
    }
}

// Called by applyRemoteState when an SSE update carries a new reaction trigger
function handleIncomingReactionTrigger(trigger) {
    if (!trigger || trigger.id === _lastShownReactionTriggerId) return;
    _lastShownReactionTriggerId = trigger.id;

    let reactors;
    if (trigger.actionType === 'daño') {
        // Only the damaged participant can react with damage reactions
        const damagedP = combatState.participants.find(p => p.id === trigger.actorId);
        reactors = (damagedP && canParticipantReact(damagedP.id) && _isMyParticipant(damagedP))
            ? [damagedP] : [];
    } else {
        reactors = combatState.participants.filter(p =>
            p.id !== trigger.actorId &&
            canParticipantReact(p.id) &&
            _isMyParticipant(p) &&
            _getApplicableReactions(p, trigger.actionType).length > 0
        );
    }

    if (reactors.length > 0) {
        _showReactionPopup(trigger, reactors);
    }
}

// Restore a participant's reaction at the start of their turn
function clearReactionForParticipant(participantId) {
    if (combatState.reactionsUsed?.[participantId]) {
        delete combatState.reactionsUsed[participantId];
    }
}

// Full reset (combat end / restart)
function resetAllReactions() {
    combatState.reactionsUsed = {};
    combatState.pendingReactionTrigger = null;
    _lastShownReactionTriggerId = null;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _showReactionPopup(trigger, reactors) {
    document.getElementById('reactionModal')?.remove();

    const isDamage = trigger.actionType === 'daño';
    const actorP   = isDamage ? null : combatState.participants.find(p => p.id === trigger.actorId);

    const reactorItems = reactors.map(p => ({
        p,
        reactions: isDamage
            ? _getApplicableReactions(p, 'daño')
            : _getApplicableReactions(p, trigger.actionType),
    })).filter(x => x.reactions.length > 0);

    if (reactorItems.length === 0) return;

    // Context text
    let contextHTML;
    if (isDamage) {
        const damagedP = combatState.participants.find(p => p.id === trigger.actorId);
        contextHTML = `<strong>${damagedP?.name ?? 'Tu personaje'}</strong> acaba de recibir daño.`;
    } else {
        contextHTML = `<strong>${actorP?.name ?? trigger.actorId}</strong> usó <strong>${trigger.actionName}</strong>.`;
    }

    const subtitle = (isMaster() || !isOnlineCombat)
        ? 'Reacciones disponibles:'
        : '¿Quieres reaccionar?';

    const itemsHTML = reactorItems.map(({ p, reactions }) => {
        const btns = reactions.map(r => {
            const rawKey = `${p.id}::${r.nombre}`.replace(/'/g, '');
            const meta = [
                r.atk  ? `⚔️ ${r.atk}`  : '',
                r.dado ? `💥 ${r.dado}` : '',
            ].filter(Boolean).join(' ');
            return `<button class="reaction-use-btn" onclick="window._reactionChoice('${rawKey}')">
                <span class="reaction-btn-name">${r.nombre}</span>
                ${meta ? `<span class="reaction-btn-meta">${meta}</span>` : ''}
            </button>`;
        }).join('');
        return `<div class="reaction-participant-block">
            <div class="reaction-participant-name">${p.name}</div>
            <div class="reaction-btns-list">${btns}</div>
        </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'reactionModal';
    modal.className = 'reaction-modal-overlay';
    modal.innerHTML = `
        <div class="reaction-modal">
            <div class="reaction-modal-header">
                <span class="reaction-modal-icon">↩️</span>
                <span class="reaction-modal-title">Reacción posible</span>
            </div>
            <div class="reaction-modal-context">${contextHTML} ${subtitle}</div>
            <div class="reaction-modal-items">${itemsHTML}</div>
            <button class="reaction-skip-btn"
                    onclick="document.getElementById('reactionModal')?.remove()">
                Sin reacción
            </button>
        </div>`;
    document.body.appendChild(modal);

    window._reactionChoice = function(key) {
        document.getElementById('reactionModal')?.remove();
        window._reactionChoice = null;
        const sep = key.indexOf('::');
        if (sep < 0) return;
        _applyReaction(key.slice(0, sep), key.slice(sep + 2), trigger);
    };
}

function _applyReaction(participantId, reactionName, trigger) {
    if (!combatState.reactionsUsed) combatState.reactionsUsed = {};
    combatState.reactionsUsed[participantId] = true;

    const p     = combatState.participants.find(x => x.id === participantId);
    const pName = p?.name || participantId;

    const entry = getCurrentLogEntry();
    if (entry) {
        if (!entry.reactions) entry.reactions = [];
        entry.reactions.push({ by: pName, nombre: reactionName, inResponseTo: trigger.actionName });
    }

    combatState.pendingReactionTrigger = null;
    showNotification(`↩️ ${pName} reacciona con ${reactionName}!`, 3000);
    saveCombatState();
    renderCombatManager();
}
