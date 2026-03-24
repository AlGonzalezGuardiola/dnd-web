// ============================================
// View — navigation, initialization, dice roller, menus
// Depends on: globals.js, utils.js, storage.js, role.js, map.js, map-editor.js,
//             character-sheet.js, character-edit.js, combat-setup.js,
//             combat-manager.js, combat-log.js
// ============================================

// ============================================
// Initialization
// ============================================
async function init() {
    try {
        if (window.initialGameData) {
            state.data = window.initialGameData;
        } else {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('No data.json found');
            state.data = await response.json();
        }

        if (!state.data.mapa_inicial || Object.keys(state.data.mapas).length === 0) {
            showWelcomeScreen();
            return;
        }

        state.currentMap = state.data.mapa_inicial;
        loadStateFromStorage();
        renderCharacterSelectionMenu();
        setupEventListeners();
        initPlayerCharactersFromDB();
        setupDiceRoller();
        setupCombatOptionsMenu();
        setView('landing');
        updateTaskMd('Initialize');
        initRole();
        loadSavedCombatIfAny();
    } catch (error) {
        console.error('Error loading data:', error);
        showWelcomeScreen();
    }
}

function showWelcomeScreen() {
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('loadDataBtn').addEventListener('click', () => {
        document.getElementById('dataFileInput').click();
    });

    document.getElementById('dataFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    state.data = JSON.parse(event.target.result);
                    state.currentMap = state.data.mapa_inicial;
                    document.getElementById('welcomeScreen').style.display = 'none';
                    setupEventListeners();
                    renderMap();
                } catch (error) {
                    alert('Error al cargar el archivo: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    });
}

// ============================================
// Event Listeners Setup
// ============================================
function setupEventListeners() {
    // Navigation
    const btnHome = document.getElementById('btnHome');
    if (btnHome) btnHome.addEventListener('click', () => {
        state.history = [];
        combatModeActive = false;
        combatState.isActive = false;
        clearSavedCombat();
        const sheet = document.getElementById('characterSheetContainer');
        if (sheet) sheet.style.display = 'none';
        const manager = document.getElementById('combatManagerSection');
        if (manager) manager.style.display = 'none';
        isCharacterEditing = false;
        setView('landing');
    });

    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.addEventListener('click', navigateBack);

    // Landing Page
    document.getElementById('cardWorld').addEventListener('click', () => {
        if (state.currentMap) {
            renderMap();
            setView('map');
        } else {
            showNotification('No hay mapa inicial configurado', 3000);
        }
    });

    document.getElementById('cardCharacters').addEventListener('click', () => {
        combatModeActive = false;
        openPersonajesSection();
    });

    // Character Selection
    ['Vel', 'Zero', 'Asthor'].forEach(id => {
        const card = document.getElementById(`charCard${id}`);
        if (card) {
            card.addEventListener('click', () => {
                const name = card.querySelector('.card-title').textContent;
                showNotification(`Has seleccionado a: ${name}`, 3000);
            });
        }
    });

    // Zoom controls
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => adjustZoom(0.2));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => adjustZoom(-0.2));

    // Editor controls
    document.getElementById('toggleEdit').addEventListener('click', toggleEditMode);
    document.getElementById('addMapBtn').addEventListener('click', showAddMapModal);
    document.getElementById('exportBtn').addEventListener('click', exportData);

    // Map interaction (Mouse)
    const container = document.getElementById('mapContainer');
    container.addEventListener('mousedown', handleMapMouseDown);
    container.addEventListener('mousemove', handleMapMouseMove);
    container.addEventListener('mouseup', handleMapMouseUp);
    container.addEventListener('wheel', handleMapWheel);
    container.addEventListener('contextmenu', handleRightClick);

    // Map interaction (Touch for mobile)
    container.addEventListener('touchstart', handleMapTouchStart, { passive: false });
    container.addEventListener('touchmove', handleMapTouchMove, { passive: false });
    container.addEventListener('touchend', handleMapTouchEnd);

    // Modal controls
    setupModalListeners();
    setupCharacterSheetListeners();
}

function setupModalListeners() {
    // Pin modal
    document.getElementById('savePinBtn').addEventListener('click', savePin);
    document.getElementById('cancelPinBtn').addEventListener('click', () => {
        document.getElementById('pinModal').style.display = 'none';
        state.tempPin = null;
        state.editingPinIndex = null;
    });

    // Pin Size Slider
    const sizeSlider = document.getElementById('pinSize');
    const sizeValue = document.getElementById('pinSizeValue');
    sizeSlider.addEventListener('input', (e) => {
        sizeValue.textContent = e.target.value;
    });

    // Map modal
    document.getElementById('saveMapBtn').addEventListener('click', saveNewMap);
    document.getElementById('cancelMapBtn').addEventListener('click', () => {
        document.getElementById('mapModal').style.display = 'none';
    });
}

// ============================================
// Dice Roller
// ============================================
function updateDiceHistory() {
    const el = document.getElementById('diceHistory');
    if (!el || diceHistory.length === 0) return;
    el.innerHTML = diceHistory.map(r => {
        const cls = r.sides === 20 && r.result === 20 ? ' crit' : r.sides === 20 && r.result === 1 ? ' fumble' : '';
        return `<span class="history-chip${cls}">d${r.sides}:${r.result}</span>`;
    }).join('');
}

function setupDiceRoller() {
    const toggleBtn = document.getElementById('diceToggleBtn');
    const panel = document.getElementById('dicePanel');
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = panel.classList.toggle('open');
        toggleBtn.classList.toggle('open', isOpen);
    });

    document.querySelectorAll('.die-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            rollDie(parseInt(btn.dataset.sides));
        });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dice-roller-widget')) {
            panel.classList.remove('open');
            toggleBtn.classList.remove('open');
        }
    });
}

function rollDie(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    diceHistory.unshift({ sides, result });
    if (diceHistory.length > 5) diceHistory.pop();
    updateDiceHistory();
    const resultEl = document.getElementById('diceResultValue');
    const labelEl = document.getElementById('diceDieLabel');
    if (!resultEl) return;

    // Reset animation
    resultEl.classList.remove('rolling', 'crit', 'fumble');
    void resultEl.offsetWidth;
    resultEl.classList.add('rolling');

    const isCrit = sides === 20 && result === 20;
    const isFumble = sides === 20 && result === 1;

    resultEl.textContent = result;
    if (labelEl) labelEl.textContent = `d${sides}`;

    if (isCrit) {
        resultEl.classList.add('crit');
        showNotification('⭐ ¡CRÍTICO! ¡Resultado perfecto!', 3000);
    } else if (isFumble) {
        resultEl.classList.add('fumble');
        showNotification('💀 ¡Pifia! El destino es cruel...', 3000);
    }
}

// ============================================
// Combat Options Menu (sandwich ☰)
// ============================================

// Helper: close the sandwich menu from anywhere (menu-item buttons call this)
function _closeOptionsMenu() {
    document.getElementById('optionsMenu')?.classList.remove('open');
    document.getElementById('optionsMenuToggle')?.classList.remove('open');
}

function setupCombatOptionsMenu() {
    const toggleBtn = document.getElementById('optionsMenuToggle');
    const menu      = document.getElementById('optionsMenu');
    if (!toggleBtn || !menu) return;

    // Prevent duplicate listeners by flagging the element
    if (toggleBtn.dataset.menuBound) return;
    toggleBtn.dataset.menuBound = '1';

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('open');
        toggleBtn.classList.toggle('open', isOpen);
    });

    // Close when clicking outside — use capture phase to run before other handlers
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !toggleBtn.contains(e.target)) {
            _closeOptionsMenu();
        }
    }, true /* capture */);
}

// ============================================
// Mobile Log / Landing Menu Toggles
// ============================================
function toggleLandingMenu() {
    const dd = document.getElementById('landingDropdown');
    if (!dd) return;
    const isOpen = dd.style.display !== 'none';
    dd.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        setTimeout(() => document.addEventListener('click', closeLandingMenu, { once: true }), 10);
    }
}

function closeLandingMenu() {
    const dd = document.getElementById('landingDropdown');
    if (dd) dd.style.display = 'none';
}

function toggleMobileLog() {
    const logPanel = document.querySelector('.combat-log-panel');
    if (logPanel) logPanel.classList.toggle('mobile-visible');
}

// ============================================
// View Management
// ============================================
function setView(viewName) {
    state.currentView = viewName;

    // Manage body scroll class
    document.body.classList.remove('view-map');
    if (viewName === 'map') {
        document.body.classList.add('view-map');
    }

    // Hide all main containers
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('mapContainer').style.display = 'none';
    document.getElementById('characterSection').style.display = 'none';
    document.getElementById('combatSetupSection').style.display = 'none';
    document.getElementById('combatInitSection').style.display = 'none';
    document.getElementById('combatManagerSection').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'none';
    const onlineLobby = document.getElementById('onlineLobbyView');
    if (onlineLobby) onlineLobby.style.display = 'none';
    const onlineWaiting = document.getElementById('onlineWaitingView');
    if (onlineWaiting) onlineWaiting.style.display = 'none';
    const combatLogViewEl = document.getElementById('combatLogView');
    if (combatLogViewEl) combatLogViewEl.style.display = 'none';
    const encountersEl = document.getElementById('encountersSection');
    if (encountersEl) encountersEl.style.display = 'none';
    const npcGenEl = document.getElementById('npcGenSection');
    if (npcGenEl) npcGenEl.style.display = 'none';
    const sessionNotesEl = document.getElementById('sessionNotesSection');
    if (sessionNotesEl) sessionNotesEl.style.display = 'none';

    // Also hide the character sheet if it was open
    const sheetContainer = document.getElementById('characterSheetContainer');
    if (sheetContainer) sheetContainer.style.display = 'none';

    const editorToolbar = document.getElementById('editorToolbar');
    const hud = document.getElementById('hud');
    const diceWidget = document.getElementById('diceRollerWidget');

    // Reset scroll position when changing views
    window.scrollTo(0, 0);

    // Show correct container
    switch (viewName) {
        case 'landing':
            document.getElementById('landingPage').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'none';
            if (diceWidget) diceWidget.style.display = 'none';
            break;
        case 'map':
            document.getElementById('mapContainer').style.display = 'block';
            if (editorToolbar) editorToolbar.style.display = 'flex';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'flex';
            break;
        case 'characters':
            document.getElementById('characterSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            document.getElementById('breadcrumbs').textContent = '👥 Personajes';
            document.getElementById('btnBack').style.display = 'flex';
            break;
        case 'combatSetup':
            document.getElementById('combatSetupSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            document.getElementById('breadcrumbs').textContent = '⚔️ Combate › Configuración';
            document.getElementById('btnBack').style.display = 'flex';
            break;
        case 'combatInit':
            document.getElementById('combatInitSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            document.getElementById('breadcrumbs').textContent = '⚔️ Combate › Iniciativa';
            document.getElementById('btnBack').style.display = 'flex';
            break;
        case 'combatManager':
            document.getElementById('combatManagerSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'none';
            if (diceWidget) diceWidget.style.display = 'none'; // no floating dice in combat
            break;
        case 'onlineLobby':
            document.getElementById('onlineLobbyView').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            document.getElementById('breadcrumbs').textContent = '🌐 Combate en Línea';
            document.getElementById('btnBack').style.display = 'flex';
            break;
        case 'onlineWaiting':
            document.getElementById('onlineWaitingView').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            document.getElementById('breadcrumbs').textContent = '🌐 Sala de espera';
            document.getElementById('btnBack').style.display = 'flex';
            break;
        case 'combatLogView':
            document.getElementById('combatLogView').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'none';
            if (diceWidget) diceWidget.style.display = 'none';
            break;
        case 'encounters':
            document.getElementById('encountersSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            document.getElementById('breadcrumbs').textContent = '⚔️ Encuentros';
            document.getElementById('btnBack').style.display = 'flex';
            break;
        case 'npcGenerator':
            document.getElementById('npcGenSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            document.getElementById('breadcrumbs').textContent = '🎭 Generador PNJ';
            document.getElementById('btnBack').style.display = 'flex';
            break;
        case 'sessionNotes':
            document.getElementById('sessionNotesSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            document.getElementById('breadcrumbs').textContent = '📝 Notas de Sesión';
            document.getElementById('btnBack').style.display = 'flex';
            break;
    }
}

// currentView() is defined in globals.js — do not redefine here

// ============================================
// Start Application
// ============================================
init();
