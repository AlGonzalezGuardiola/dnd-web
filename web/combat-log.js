// ============================================
// Combat Log — turn log, scoreboard, end combat
// Depends on: globals.js, utils.js, storage.js
// Runtime deps: renderCombatManager, setView, clearOnlineSession
// ============================================

// ---- Turn Log Entry Creation ----
function createCurrentTurnEntry() {
    const p = combatState.participants[combatState.currentIndex];
    if (!p) return;
    combatState.log.push({
        id: combatState.nextLogId++,
        round: combatState.round,
        participantId: p.id,
        participantName: p.name,
        actions: [],
        slots: { accion: false, extraAtaque: false, adicional: false, reaccion: false },
        note: '',
        isCurrent: true,
        isSegundaAccion: combatState.segundaAccionTurn || false,
        isExtraAttack: combatState.extraAttackTurn || false,
        snapshot: {
            currentIndex: combatState.currentIndex,
            round: combatState.round,
            segundaAccionTurn: combatState.segundaAccionTurn || false,
            extraAttackTurn: combatState.extraAttackTurn || false,
            participants: combatState.participants.map(part => ({
                id: part.id,
                hp: { ...part.hp },
                conditions: [...part.conditions],
                demonicForm: part.demonicForm,
                ac: part.ac,
                speed: part.speed,
            })),
        },
    });
}

function getCurrentLogEntry() {
    return combatState.log.find(e => e.isCurrent);
}

function getLogEntry(logId) {
    return combatState.log.find(e => e.id === logId);
}

// ---- Log Action Helpers ----
function toggleLogAction(logId, nombre, dice) {
    const entry = getLogEntry(logId);
    if (!entry) return;
    const idx = entry.actions.findIndex(a => a.nombre === nombre);
    if (idx >= 0) entry.actions.splice(idx, 1);
    else entry.actions.push({ nombre, dice: dice || '' });
    renderCombatLog();
    if (entry.isCurrent) renderActivePanel();
}

function removeLogAction(logId, nombre) {
    const entry = getLogEntry(logId);
    if (!entry) return;
    entry.actions = entry.actions.filter(a => a.nombre !== nombre);
    renderCombatLog();
    if (entry.isCurrent) renderActivePanel();
}

function addLogCustomAction(logId) {
    const input = document.getElementById(`logCustomInput_${logId}`);
    const text = input?.value?.trim();
    if (!text) return;
    const entry = getLogEntry(logId);
    if (!entry) return;
    entry.actions.push({ nombre: text, dice: '' });
    if (input) input.value = '';
    renderCombatLog();
    if (entry.isCurrent) renderActivePanel();
}

function toggleLogEdit(logId) {
    const area = document.getElementById(`logEdit_${logId}`);
    if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
}

function renderLogEditArea(entry, p) {
    let chips = '';
    if (p?.charData) {
        const allItems = [...(p.charData.combateExtra || []), ...(p.charData.conjuros || [])];
        chips = allItems.map(a => {
            const dice = a.atk || (a.dado && a.dado !== '—' ? a.dado : '') || '';
            const isUsed = entry.actions.some(x => x.nombre === a.nombre);
            const safeName = a.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const safeDice = dice.replace(/'/g, "\\'");
            return `<button class="combat-chip${isUsed ? ' used' : ''}"
                            onclick="toggleLogAction(${entry.id},'${safeName}','${safeDice}')">
                ${a.nombre}
            </button>`;
        }).join('');
    }
    const actionsHtml = entry.actions.map(a => {
        const safeName = a.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<div class="combat-recorded-item">
            ✓ ${a.nombre}${a.dice ? ` — ${a.dice}` : ''}
            <button onclick="removeLogAction(${entry.id},'${safeName}')">×</button>
        </div>`;
    }).join('');
    return `<div class="log-edit-chips">${chips}</div>
        <div class="log-edit-recorded">${actionsHtml}</div>
        <div class="log-custom-row">
            <input type="text" id="logCustomInput_${entry.id}" class="combat-custom-input"
                   placeholder="Acción personalizada..."
                   onkeydown="if(event.key==='Enter') addLogCustomAction(${entry.id})">
            <button onclick="addLogCustomAction(${entry.id})">+</button>
        </div>`;
}

function renderRollText(text) {
    if (!text) return '';
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// ---- Sidebar Combat Log ----
function renderCombatLog() {
    const logEl = document.getElementById('combatLog');
    if (!logEl) return;
    const entries = [...combatState.log].reverse();
    logEl.innerHTML = entries.map(entry => {
        const p = combatState.participants.find(x => x.id === entry.participantId);
        const actionsHTML = entry.actions.length
            ? entry.actions.map(a => `<div class="log-action-item">
                <div>✓ ${a.nombre}${a.dice && !a.rollText ? ` (${a.dice})` : ''}${entry.isSegundaAccion ? ' <span class="log-extra-badge">+2ª</span>' : ''}</div>
                ${a.rollText ? `<div class="combat-roll-result">${renderRollText(a.rollText)}</div>` : ''}
                ${a.narratorText ? `<div class="combat-narrator-text">${a.narratorText}</div>` : ''}
            </div>`).join('')
            : '<span style="color:var(--text-muted)">—</span>';
        return `<div class="combat-log-entry${entry.isCurrent ? ' log-current' : ''}">
            <div class="log-entry-header">
                <span class="log-round-badge">R${entry.round}</span>
                <span class="log-participant-name">${entry.participantName.split(' ')[0]}</span>
                ${entry.isCurrent ? '<span class="log-current-badge">← ahora</span>' : ''}
                <button class="log-edit-toggle" onclick="toggleLogEdit(${entry.id})" title="Editar">✏️</button>
            </div>
            <div class="log-actions-display">${actionsHTML}</div>
            ${entry.note ? `<div class="log-note">📝 ${entry.note}</div>` : ''}
            <div class="log-edit-area" id="logEdit_${entry.id}" style="display:none;">
                ${renderLogEditArea(entry, p)}
            </div>
        </div>`;
    }).join('');
}

// ---- Combat Log View (full-screen) ----
function openCombatLogView() {
    renderCombatLogView();
    setView('combatLogView');
}

function closeCombatLogView() {
    // Guard: only navigate back if combat is still active
    if (!combatState.isActive) { setView('landing'); return; }
    setView('combatManager');
    // renderCombatManager is called inside setView via the combatManager case? No —
    // setView just shows/hides DOM. Call render explicitly.
    try { renderCombatManager(); } catch (e) { console.warn('renderCombatManager error:', e); }
}

function renderCombatLogView() {
    // ── Scoreboard ───────────────────────────────────────────────────────────
    const sbEl = document.getElementById('clvScoreboard');
    if (sbEl) {
        const scores = computeKillScoreboard();
        if (scores.length) {
            sbEl.innerHTML = `
                <div class="clv-sb-title">🏆 Bajas por aliado</div>
                <div class="clv-sb-list">
                    ${scores.map(([name, kills]) =>
                        `<span class="clv-sb-entry">
                            <span class="clv-sb-name">${name}</span>
                            <span class="clv-sb-kills">${kills} kill${kills !== 1 ? 's' : ''}</span>
                        </span>`
                    ).join('')}
                </div>`;
            sbEl.style.display = '';
        } else {
            sbEl.style.display = 'none';
        }
    }

    // ── Log entries (newest first, same rendering as sidebar log) ────────────
    const logEl = document.getElementById('clvLog');
    if (!logEl) return;
    const entries = [...combatState.log].reverse();
    if (!entries.length) {
        logEl.innerHTML = '<div class="clv-empty">Sin entradas en el registro todavía.</div>';
        return;
    }
    logEl.innerHTML = entries.map(entry => {
        const actionsHTML = entry.actions.length
            ? entry.actions.map(a => `<div class="log-action-item">
                <div>✓ ${a.nombre}${a.dice && !a.rollText ? ` (${a.dice})` : ''}</div>
                ${a.rollText ? `<div class="combat-roll-result">${renderRollText(a.rollText)}</div>` : ''}
                ${a.narratorText ? `<div class="combat-narrator-text">${a.narratorText}</div>` : ''}
            </div>`).join('')
            : '<span style="color:var(--text-muted)">—</span>';
        return `<div class="combat-log-entry${entry.isCurrent ? ' log-current' : ''}">
            <div class="log-entry-header">
                <span class="log-round-badge">R${entry.round}</span>
                <span class="log-participant-name">${entry.participantName.split(' ')[0]}</span>
                ${entry.isCurrent ? '<span class="log-current-badge">← ahora</span>' : ''}
            </div>
            <div class="log-actions-display">${actionsHTML}</div>
            ${entry.note ? `<div class="log-note">📝 ${entry.note}</div>` : ''}
        </div>`;
    }).join('');
}

// Kept for backward-compat (called from renderCombatLog previously)
function openCombatLogModal() { openCombatLogView(); }
function closeCombatLogModal() { closeCombatLogView(); }

// ---- Kill Scoreboard ----
function computeKillScoreboard() {
    const scores = {};
    combatState.log.forEach(entry => {
        if (!entry.kills?.length) return;
        const actor = combatState.participants.find(p => p.id === entry.participantId);
        // Only count kills by allies/players, not enemies
        if (!actor || actor.tipo === 'enemigo') return;
        const name = entry.participantName.split(' ')[0];
        scores[name] = (scores[name] || 0) + entry.kills.length;
    });
    return Object.entries(scores).sort((a, b) => b[1] - a[1]);
}

function renderKillScoreboard() {
    const board = document.getElementById('combatScoreboard');
    const list  = document.getElementById('scoreboardList');
    if (!board || !list) return;
    const scores = computeKillScoreboard();
    if (!scores.length) { board.style.display = 'none'; return; }
    board.style.display = 'flex';
    list.innerHTML = scores
        .map(([name, kills]) =>
            `<span class="scoreboard-entry"><span class="sb-name">${name}</span><span class="sb-kills">${kills} kill${kills !== 1 ? 's' : ''}</span></span>`)
        .join('');
}

// ---- History Text / Clipboard ----
function buildHistoryText() {
    const rounds = {};
    combatState.log.forEach(entry => {
        if (!rounds[entry.round]) rounds[entry.round] = [];
        rounds[entry.round].push(entry);
    });
    let text = `=== COMBATE — ${combatState.round} Ronda(s) · ${combatState.participants.length} participantes ===\n\n`;
    Object.keys(rounds).sort((a,b) => a-b).forEach(round => {
        text += `RONDA ${round}\n${'─'.repeat(30)}\n`;
        rounds[round].forEach(entry => {
            text += `\n${entry.participantName}:\n`;
            entry.actions.forEach(a => {
                text += `  ⚔️ ${a.nombre}`;
                if (a.rollText) text += `\n     ${a.rollText.replace(/\*\*/g, '')}`;
                if (a.narratorText) text += `\n     📖 ${a.narratorText}`;
                text += '\n';
            });
            if (entry.note) text += `  📝 ${entry.note}\n`;
        });
        text += '\n';
    });
    return text;
}

function copyHistoryToClipboard() {
    const text = buildHistoryText();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showNotification('📋 Historial copiado al portapapeles', 2000));
    } else {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showNotification('📋 Historial copiado', 2000);
    }
}

// ---- End Combat / Summary ----
function confirmEndCombat() {
    showCombatSummary();
}

function _doClearCombat() {
    document.getElementById('combatSummaryOverlay')?.remove();
    // Mark the online session as ENDED and let the server clean up when all clients disconnect
    if (isOnlineCombat && activeCombatId) {
        fetch(`${API_BASE}/api/combats/${activeCombatId}`, { method: 'DELETE' }).catch(() => {});
        clearOnlineSession();
    }
    combatState.isActive = false;
    combatState.participants = [];
    combatState.selectedIds = [];
    combatState.log = [];
    combatState.round = 1;
    combatState.currentIndex = 0;
    combatState.nextLogId = 0;
    clearSavedCombat();
    combatModeActive = false;
    setView('landing');
}

function showCombatSummary() {
    document.getElementById('combatSummaryOverlay')?.remove();
    const rounds = {};
    combatState.log.filter(e => !e.isCurrent || e.actions.length || e.note).forEach(entry => {
        if (!rounds[entry.round]) rounds[entry.round] = [];
        rounds[entry.round].push(entry);
    });
    const roundKeys = Object.keys(rounds).sort((a,b) => a-b);
    const bodyHTML = roundKeys.map(round => {
        const entries = rounds[round];
        const entriesHTML = entries.map(entry => `
            <div style="margin-bottom:10px">
                <strong style="color:var(--text-primary)">${entry.participantName}</strong>
                ${entry.actions.map(a => `
                    <div style="margin-left:12px;margin-top:4px">
                        <div>⚔️ ${a.nombre}${a.dice && !a.rollText ? ` (${a.dice})` : ''}</div>
                        ${a.rollText ? `<div class="combat-roll-result">${a.rollText.replace(/\*\*/g, '')}</div>` : ''}
                        ${a.narratorText ? `<div class="combat-narrator-text">${a.narratorText}</div>` : ''}
                    </div>`).join('')}
                ${entry.note ? `<div style="margin-left:12px;font-style:italic;color:var(--text-muted);font-size:12px">📝 ${entry.note}</div>` : ''}
            </div>`).join('');
        return `<div style="margin-bottom:16px">
            <div style="font-weight:700;color:var(--accent-gold);margin-bottom:8px;border-bottom:1px solid var(--border-color);padding-bottom:4px">Ronda ${round}</div>
            ${entriesHTML || '<div style="color:var(--text-muted);font-style:italic;font-size:12px">Sin acciones registradas</div>'}
        </div>`;
    }).join('');

    // Build kill scoreboard
    const scores = computeKillScoreboard();
    const medals = ['🥇', '🥈', '🥉'];
    const scoreboardHTML = scores.length ? `
        <div class="summary-scoreboard">
            <div class="summary-scoreboard-title">🏆 Clasificación de Bajas</div>
            ${scores.map(([name, kills], i) => `
                <div class="summary-score-entry${i === 0 ? ' first-place' : ''}">
                    <span class="score-medal">${medals[i] || `${i + 1}.`}</span>
                    <span class="score-name">${name}</span>
                    <span class="score-kills">${kills} baja${kills !== 1 ? 's' : ''}</span>
                </div>`).join('')}
        </div>` : '';

    const overlay = document.createElement('div');
    overlay.id = 'combatSummaryOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.innerHTML = `
        <div class="combat-summary-modal">
            <div class="combat-summary-title">⚔️ Fin del Combate</div>
            <div style="text-align:center;color:var(--text-muted);font-size:13px;margin-bottom:16px">
                ${combatState.round} ronda(s) · ${combatState.participants.length} participantes
            </div>
            ${scoreboardHTML}
            <div class="combat-summary-body">${bodyHTML || '<div style="color:var(--text-muted);font-style:italic">Sin historial registrado</div>'}</div>
            <div class="combat-summary-btns">
                <button class="btn-combat-secondary" onclick="copyHistoryToClipboard()">📋 Copiar</button>
                <button class="btn-combat-primary" onclick="_doClearCombat()">✕ Finalizar</button>
                <button class="btn-combat-secondary" onclick="document.getElementById('combatSummaryOverlay')?.remove()">Volver</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

// saveCombatState, clearSavedCombat, loadSavedCombatIfAny, showCombatResumePrompt,
// resumeSavedCombat, discardSavedCombat, and COMBAT_SAVE_KEY are all defined in storage.js
