// ============================================
// Storage — localStorage persistence
// Depends on: globals.js, utils.js
// ============================================

function saveStateToStorage() {
    try {
        localStorage.setItem('dnd_hp',         JSON.stringify(hpState));
        localStorage.setItem('dnd_slots',      JSON.stringify(spellSlotState));
        localStorage.setItem('dnd_inspiration',JSON.stringify(inspirationState));
        localStorage.setItem('dnd_conditions', JSON.stringify(conditionsState));
        localStorage.setItem('dnd_deathsaves', JSON.stringify(deathSaveState));
        localStorage.setItem('dnd_demonic',    JSON.stringify(demonicFormState));
        localStorage.setItem('dnd_notes',      JSON.stringify(notesState));
        localStorage.setItem('dnd_modifiers',  JSON.stringify(modifierState));
        localStorage.setItem('dnd_mod_used',   JSON.stringify(modifierUsedState));
    } catch(e) {}
}

function loadStateFromStorage() {
    try {
        const hp   = localStorage.getItem('dnd_hp');         if (hp)   Object.assign(hpState,          JSON.parse(hp));
        const sl   = localStorage.getItem('dnd_slots');      if (sl)   Object.assign(spellSlotState,   JSON.parse(sl));
        const ins  = localStorage.getItem('dnd_inspiration');if (ins)  Object.assign(inspirationState, JSON.parse(ins));
        const cond = localStorage.getItem('dnd_conditions'); if (cond) Object.assign(conditionsState,  JSON.parse(cond));
        const ds   = localStorage.getItem('dnd_deathsaves'); if (ds)   Object.assign(deathSaveState,   JSON.parse(ds));
        const dem  = localStorage.getItem('dnd_demonic');    if (dem)  Object.assign(demonicFormState,  JSON.parse(dem));
        const nt   = localStorage.getItem('dnd_notes');      if (nt)   Object.assign(notesState,        JSON.parse(nt));
        const mods = localStorage.getItem('dnd_modifiers');  if (mods) Object.assign(modifierState,     JSON.parse(mods));
        const modu = localStorage.getItem('dnd_mod_used');   if (modu) Object.assign(modifierUsedState, JSON.parse(modu));
    } catch(e) {}
}

function initHpForChar(charId) {
    if (!hpState[charId]) {
        const maxHp = parseInt(window.characterData[charId]?.resumen?.HP) || 0;
        hpState[charId] = { current: maxHp, max: maxHp };
    }
}

function initDeathSavesForChar(charId) {
    if (!deathSaveState[charId]) deathSaveState[charId] = { successes: 0, failures: 0 };
}

function initSpellSlotsForChar(charId) {
    if (!spellSlotState[charId]) {
        const data = window.characterData[charId];
        spellSlotState[charId] = {};
        if (data?.ranuras) data.ranuras.forEach(s => { spellSlotState[charId][s.nombre] = s.total; });
    }
}

// opts.immediate — bypass debounce (used by previousCombatTurn)
function saveCombatState(opts = {}) {
    if (!combatState.isActive) return;
    const toSave = {
        ...combatState,
        participants: combatState.participants.map(p => ({ ...p, charData: null })),
    };
    try { localStorage.setItem(COMBAT_SAVE_KEY, JSON.stringify(toSave)); } catch (e) {}
    if (isOnlineCombat) {
        if (opts.immediate) saveToApiNow(); else saveToApi();
    }
}

function clearSavedCombat() {
    localStorage.removeItem(COMBAT_SAVE_KEY);
}

function loadSavedCombatIfAny() {
    const raw = localStorage.getItem(COMBAT_SAVE_KEY);
    if (!raw) return;
    try {
        const saved = JSON.parse(raw);
        if (!saved.isActive || !saved.participants?.length) return;
        saved.participants.forEach(p => {
            if (p._isSirvienteInvisible) {
                p.charData = buildSirvienteCharData(p.ac);
            } else {
                p.charData = window.characterData[p.id] || null;
            }
            if (!p.customActions) p.customActions = [];
            if (p.isGroup) {
                if (p.totalHp          === undefined) p.totalHp          = p.hp.current;
                if (p.hpPerMember      === undefined) p.hpPerMember      = p.hp.max / (p.groupSize || 1);
                if (p.membersRemaining === undefined) p.membersRemaining = Math.ceil(p.totalHp / (p.hpPerMember || 1));
                if (p.currentMemberHp  === undefined) p.currentMemberHp  = p.hp.current % (p.hpPerMember || 1) || p.hpPerMember;
            }
        });
        Object.assign(combatState, saved);
        showCombatResumePrompt();
    } catch (e) { clearSavedCombat(); }
}

function showCombatResumePrompt() {
    const names = combatState.participants.map(p => p.name.split(' ')[0]).join(', ');
    const overlay = document.createElement('div');
    overlay.id = 'combatResumeOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.innerHTML = `
        <div class="combat-resume-modal">
            <div class="combat-resume-title">⚔️ Combate guardado</div>
            <div class="combat-resume-info">
                Ronda ${combatState.round} · ${combatState.participants.length} participantes
                <br><small>${names}</small>
            </div>
            <div class="combat-resume-btns">
                <button class="btn-combat-primary" onclick="resumeSavedCombat()">▶ Reanudar</button>
                <button class="btn-combat-secondary" onclick="discardSavedCombat()">🗑 Descartar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function resumeSavedCombat() {
    document.getElementById('combatResumeOverlay')?.remove();
    combatModeActive = true;
    setView('combatManager');
    renderCombatManager();
}

function discardSavedCombat() {
    document.getElementById('combatResumeOverlay')?.remove();
    Object.assign(combatState, {
        isActive: false, participants: [], selectedIds: [],
        log: [], round: 1, currentIndex: 0, nextLogId: 0, segundaAccionTurn: false,
    });
    clearSavedCombat();
}
