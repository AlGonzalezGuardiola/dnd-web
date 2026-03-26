// ============================================
// Reactions — reaction offer system
// Depends on: globals.js, utils.js, combat-manager.js
// ============================================

let _lastShownReactionTriggerId = null;

// Get all reaction abilities for a participant (combateExtra + conjuros + customActions)
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

// True if this participant still has their reaction available this round
function canParticipantReact(participantId) {
    if (combatState.reactionsUsed?.[participantId]) return false;
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p) return false;
    return getParticipantReactions(p).length > 0;
}

// True if the current device controls this participant
function _isMyParticipant(p) {
    if (isMaster()) {
        // Offline: master handles everyone. Online: master handles enemies only.
        return p.tipo === 'enemigo' || !isOnlineCombat;
    }
    return p.id === gameRole.characterId;
}

// ── Public API ────────────────────────────────────────────────────────────────

// Called right after an action/spell is recorded for actorId.
// actionType: 'accion' | 'adicional' | 'hechizo'
function offerReactions(actorId, actionName, actionType) {
    if (!combatState.isActive) return;
    if (actionType === 'reaccion' || actionType === 'modificador') return;

    const reactors = combatState.participants.filter(p =>
        p.id !== actorId && canParticipantReact(p.id)
    );
    if (reactors.length === 0) return;

    const triggerId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const trigger = { id: triggerId, actorId, actionName, actionType };

    // Show popup on this device for participants we control
    const myReactors = reactors.filter(p => _isMyParticipant(p));
    if (myReactors.length > 0) {
        _lastShownReactionTriggerId = triggerId;
        _showReactionPopup(trigger, myReactors);
    }

    // In online sessions, broadcast trigger so other devices can show their popups
    if (isOnlineCombat && reactors.some(p => !_isMyParticipant(p))) {
        combatState.pendingReactionTrigger = trigger;
        saveToApiNow();
    }
}

// Called by applyRemoteState when an SSE update carries a new reaction trigger
function handleIncomingReactionTrigger(trigger) {
    if (!trigger || trigger.id === _lastShownReactionTriggerId) return;
    _lastShownReactionTriggerId = trigger.id;

    const reactors = combatState.participants.filter(p =>
        p.id !== trigger.actorId &&
        canParticipantReact(p.id) &&
        _isMyParticipant(p)
    );
    if (reactors.length > 0) {
        _showReactionPopup(trigger, reactors);
    }
}

// Clear a participant's used-reaction flag at the start of their turn
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

    const actorP    = combatState.participants.find(p => p.id === trigger.actorId);
    const actorName = actorP?.name || trigger.actorId;

    const reactorItems = reactors
        .map(p => ({ p, reactions: getParticipantReactions(p) }))
        .filter(x => x.reactions.length > 0);

    if (reactorItems.length === 0) return;

    const itemsHTML = reactorItems.map(({ p, reactions }) => {
        const btns = reactions.map(r => {
            // Build a safe key: "participantId::reactionName" (strip single quotes)
            const rawKey = `${p.id}::${r.nombre}`;
            const safeKey = rawKey.replace(/'/g, '');
            const meta = [
                r.atk  ? `⚔️ ${r.atk}`  : '',
                r.dado ? `💥 ${r.dado}` : '',
            ].filter(Boolean).join(' ');
            return `<button class="reaction-use-btn" onclick="window._reactionChoice('${safeKey}')">
                <span class="reaction-btn-name">${r.nombre}</span>
                ${meta ? `<span class="reaction-btn-meta">${meta}</span>` : ''}
            </button>`;
        }).join('');

        return `<div class="reaction-participant-block">
            <div class="reaction-participant-name">${p.name}</div>
            <div class="reaction-btns-list">${btns}</div>
        </div>`;
    }).join('');

    const subtitle = (isMaster() || !isOnlineCombat)
        ? 'Tienes estas reacciones disponibles:'
        : '¿Quieres usar una reacción?';

    const modal = document.createElement('div');
    modal.id = 'reactionModal';
    modal.className = 'reaction-modal-overlay';
    modal.innerHTML = `
        <div class="reaction-modal">
            <div class="reaction-modal-header">
                <span class="reaction-modal-icon">↩️</span>
                <span class="reaction-modal-title">Reacción posible</span>
            </div>
            <div class="reaction-modal-context">
                <strong>${actorName}</strong> usó <strong>${trigger.actionName}</strong>.
                ${subtitle}
            </div>
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
        const participantId = key.slice(0, sep);
        const reactionName  = key.slice(sep + 2);
        _applyReaction(participantId, reactionName, trigger);
    };
}

function _applyReaction(participantId, reactionName, trigger) {
    if (!combatState.reactionsUsed) combatState.reactionsUsed = {};
    combatState.reactionsUsed[participantId] = true;

    const p     = combatState.participants.find(x => x.id === participantId);
    const pName = p?.name || participantId;

    // Attach reaction note to the current log entry so it appears in the log
    const entry = getCurrentLogEntry();
    if (entry) {
        if (!entry.reactions) entry.reactions = [];
        entry.reactions.push({
            by:           pName,
            nombre:       reactionName,
            inResponseTo: trigger.actionName,
        });
    }

    combatState.pendingReactionTrigger = null;

    showNotification(`↩️ ${pName} reacciona con ${reactionName}!`, 3000);
    saveCombatState();
    renderCombatManager();
}
