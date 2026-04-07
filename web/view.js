// ============================================
// View — navigation, initialization, dice roller, menus
// Depends on: globals.js, utils.js, storage.js, role.js, map.js, map-editor.js,
//             character-sheet.js, character-edit.js, combat-setup.js,
//             combat-manager.js, combat-log.js
// ============================================

// ============================================
// Client-side Router
// ============================================

// Map: viewName → URL path segment (relative to app base)
const _ROUTES = {
    landing:       '',
    characters:    'personajes',
    onlineLobby:   'combate',
    encounters:    'combate/encuentros',
    combatSetup:   'combate/nueva-partida',
    combatInit:    'combate/inicio',
    onlineWaiting: 'combate/sala-espera',
    combatManager: 'combate/activo',
    combatLogView: 'combate/registro',
    narrativaHub:     'narrativa',
    narrative:        'narrativa/cronicas',
    narrativeImages:  'narrativa/imagenes',
    sessionNotes:  'notas',
    map:             'mapa',
    npcGenerator:    'generador-npc',
    tvMode:          'mesa-tv',
};

// Reverse map: path segment → viewName
const _PATH_TO_VIEW = Object.fromEntries(
    Object.entries(_ROUTES).map(([k, v]) => [v, k])
);

// Detect app base path from the <base href> tag (set in index.html).
// Falls back to regex heuristic for environments without a base tag.
const _APP_BASE = (() => {
    const base = document.querySelector('base[href]');
    if (base) return base.getAttribute('href');
    const m = location.pathname.match(/^(\/(?:[^/]+\/)*dnd-web\/web)\//);
    return m ? m[1] + '/' : '/';
})();

let _skipPushState = false;

// Push a new history entry for a view
function _pushRoute(viewName) {
    if (_skipPushState) return;
    const seg = _ROUTES[viewName];
    if (seg === undefined) return;
    const path = _APP_BASE + seg;
    if (location.pathname !== path) {
        history.pushState({ view: viewName }, '', path);
    } else if (!history.state?.view) {
        history.replaceState({ view: viewName }, '', path);
    }
}

// Derive view name from current URL path
function _viewFromPath(pathname) {
    const stripped = pathname.startsWith(_APP_BASE)
        ? pathname.slice(_APP_BASE.length)
        : pathname.replace(/^\//, '');
    const seg = stripped.replace(/\/$/, '');
    return _PATH_TO_VIEW[seg] ?? 'landing';
}

// Init routing: navigate to URL-indicated view on page load and handle popstate
function _initRouting() {
    window.addEventListener('popstate', function(e) {
        const viewName = e.state?.view || _viewFromPath(location.pathname);
        _skipPushState = true;
        setView(viewName);
        _skipPushState = false;
    });

    const initialView = _viewFromPath(location.pathname);
    // Guard: stateful views need active combat — fallback to parent
    const _needsCombat = ['combatManager', 'combatInit', 'combatLogView'];
    const _safeView = _needsCombat.includes(initialView) && !combatState?.isActive
        ? 'onlineLobby'
        : initialView;

    history.replaceState({ view: _safeView }, '', location.pathname);
    _skipPushState = true;
    setView(_safeView);
    _skipPushState = false;
}

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
        _initRouting();
        updateTaskMd('Initialize');
        initRole();
        loadSavedCombatIfAny();
        migrateEncounterNpcsToTemplates();
        // Auto-join if ?join=CODE is in the URL (e.g. scanned from QR)
        const _urlJoin = new URLSearchParams(location.search).get('join');
        if (_urlJoin) {
            showOnlineLobby();
            const inp = document.getElementById('onlineJoinInput');
            if (inp) { inp.value = _urlJoin.toUpperCase(); }
        }
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

    // Landing Page — cardWorld removed; map access via Narrativa hub

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
    setupMobileTouchFix();
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
// Mobile Touch Fix — iOS click events inside scrollable fixed containers
// ============================================
function setupMobileTouchFix() {
    if (!('ontouchstart' in window)) return; // desktop-only: skip

    let _tsX = 0, _tsY = 0;

    document.addEventListener('touchstart', function(e) {
        _tsX = e.touches[0].clientX;
        _tsY = e.touches[0].clientY;
    }, { passive: true });

    // Fire click immediately on touchend for action cards (bypasses iOS tap delay
    // and the position-tracking bug in position:fixed + overflow-y:auto containers).
    document.addEventListener('touchend', function(e) {
        const dx = Math.abs(e.changedTouches[0].clientX - _tsX);
        const dy = Math.abs(e.changedTouches[0].clientY - _tsY);
        if (dx > 10 || dy > 10) return; // user was scrolling, not tapping

        const card = e.target.closest('.combat-action-card, .modifier-card');
        if (!card) return;
        if (e.target.closest('button, input, select, textarea, a')) return;

        e.preventDefault(); // block synthesized click so we don't double-fire
        card.click();
    }, { passive: false });
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
    _pushRoute(viewName);

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
    const sessionNotesEl = document.getElementById('sessionNotesSection');
    if (sessionNotesEl) sessionNotesEl.style.display = 'none';
    const narrativaHubEl = document.getElementById('narrativaHubView');
    if (narrativaHubEl) narrativaHubEl.style.display = 'none';
    const narrativeEl = document.getElementById('narrativeSection');
    if (narrativeEl) narrativeEl.style.display = 'none';
    const narrativeImagesEl = document.getElementById('narrativeImagesSection');
    if (narrativeImagesEl) narrativeImagesEl.style.display = 'none';
    const tvModeEl = document.getElementById('tvModeSection');
    if (tvModeEl) tvModeEl.style.display = 'none';
    const combatMapsEl = document.getElementById('combatMapsView');
    if (combatMapsEl) combatMapsEl.style.display = 'none';
    // Also hide the character sheet if it was open
    const sheetContainer = document.getElementById('characterSheetContainer');
    if (sheetContainer) sheetContainer.style.display = 'none';

    const editorToolbar = document.getElementById('editorToolbar');
    const hud = document.getElementById('hud');
    const diceWidget = document.getElementById('diceRollerWidget');
    const breadcrumbs = document.getElementById('breadcrumbs');
    const btnBack = document.getElementById('btnBack');
    const setBreadcrumb = (text) => { if (breadcrumbs) breadcrumbs.textContent = text; if (btnBack) btnBack.style.display = 'flex'; };

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
            setBreadcrumb('👥 Personajes');
            break;
        case 'combatSetup':
            document.getElementById('combatSetupSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            setBreadcrumb('⚔️ Combate › Configuración');
            break;
        case 'combatInit':
            document.getElementById('combatInitSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            setBreadcrumb('⚔️ Combate › Iniciativa');
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
            setBreadcrumb('🌐 Combate en Línea');
            break;
        case 'onlineWaiting':
            document.getElementById('onlineWaitingView').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            setBreadcrumb('🌐 Sala de espera');
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
            setBreadcrumb('⚔️ Encuentros');
            break;
        case 'sessionNotes':
            document.getElementById('sessionNotesSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            setBreadcrumb('📝 Notas de Sesión');
            break;
        case 'narrativaHub':
            document.getElementById('narrativaHubView').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            setBreadcrumb('📜 Narrativa');
            break;
        case 'narrative':
            document.getElementById('narrativeSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            setBreadcrumb('📜 Narrativa › Crónicas');
            break;
        case 'narrativeImages':
            document.getElementById('narrativeImagesSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            setBreadcrumb('📜 Narrativa › Imágenes');
            break;
        case 'tvMode':
            document.getElementById('tvModeSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'none';   // toolbar propio en TV mode
            if (diceWidget) diceWidget.style.display = 'none';
            if (typeof initTvMode === 'function') initTvMode();
            break;
        case 'combatMaps':
            document.getElementById('combatMapsView').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            if (diceWidget) diceWidget.style.display = 'none';
            setBreadcrumb('🗺️ Mapas de Combate');
            break;
    }
}

// currentView() is defined in globals.js — do not redefine here

// ============================================
// Narrativa Hub helpers
// ============================================
function openWorldMap() {
    if (state.currentMap) {
        renderMap();
        setView('map');
    } else {
        showNotification('No hay mapa inicial configurado', 3000);
    }
}

// openCronicas() defined in narrative.js

// ============================================
// Fullscreen
// ============================================
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

document.addEventListener('fullscreenchange', () => {
    const isFs = !!document.fullscreenElement;
    document.getElementById('fsIconEnter')?.style.setProperty('display', isFs ? 'none' : '');
    document.getElementById('fsIconExit')?.style.setProperty('display', isFs ? '' : 'none');
});

// ============================================
// Start Application
// ============================================
init();
