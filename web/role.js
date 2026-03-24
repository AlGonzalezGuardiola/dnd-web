// ============================================
// Role System — Master vs Player mode
// Depends on: globals.js
// ============================================

function isMaster() { return gameRole.type === 'master'; }

function initRole() {
    const saved = localStorage.getItem(ROLE_KEY);
    if (saved) {
        try { gameRole = JSON.parse(saved); } catch(e) {}
        updateRoleIndicator();
        return;
    }
    showRoleSelectionOverlay();
}

function showRoleSelectionOverlay() {
    document.getElementById('roleSelectOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'roleSelectOverlay';
    overlay.className = 'role-select-overlay';
    overlay.innerHTML = `
        <div class="role-select-modal">
            <div class="role-select-title">⚔️ Crónicas de D&D</div>
            <div class="role-select-subtitle">Elige tu rol para esta sesión</div>
            <div class="role-cards">
                <button class="role-card master-card" onclick="selectRole('master', null)">
                    🎲 Master
                    <small>Control total del combate</small>
                </button>
                <button class="role-card player-card" onclick="showPlayerPicker()">
                    🗡️ Jugador
                    <small>Gestiona tu propio turno</small>
                </button>
            </div>
            <div id="playerPickerSection" style="display:none">
                <div class="role-picker-label">¿Qué personaje eres?</div>
                <div id="playerPickerCards" class="player-picker-cards"></div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function showPlayerPicker() {
    const section = document.getElementById('playerPickerSection');
    const cardsEl = document.getElementById('playerPickerCards');
    if (!section || !cardsEl) return;
    section.style.display = 'block';
    const jugadores = Object.entries(window.characterData || {})
        .filter(([, ch]) => ch.tipo === 'jugador');
    cardsEl.innerHTML = jugadores.map(([id, ch]) =>
        `<button class="player-picker-card" onclick="selectRole('jugador','${id}')">
            ${ch.nombre || id}
        </button>`
    ).join('') || '<span style="color:var(--text-muted)">No hay jugadores disponibles</span>';
}

function selectRole(type, characterId) {
    gameRole = { type, characterId };
    localStorage.setItem(ROLE_KEY, JSON.stringify(gameRole));
    document.getElementById('roleSelectOverlay')?.remove();
    updateRoleIndicator();
}

function updateRoleIndicator() {
    if (isMaster()) {
        document.body.classList.remove('role-jugador');
    } else {
        document.body.classList.add('role-jugador');
    }
    const indicator = document.getElementById('roleIndicator');
    if (!indicator) return;
    if (isMaster()) {
        indicator.className = 'role-indicator master';
        indicator.textContent = '🎲 Master';
    } else {
        const ch = window.characterData?.[gameRole.characterId];
        const name = ch ? (ch.nombre || gameRole.characterId) : gameRole.characterId;
        indicator.className = 'role-indicator jugador';
        indicator.textContent = `🗡️ ${name}`;
    }
}
