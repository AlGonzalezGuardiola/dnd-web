// ============================================
// Global State Management
// ============================================
const state = {
    data: null,           // Full data.json object
    currentMap: null,     // Current map ID
    history: [],          // Navigation history
    zoom: 1,              // Current zoom level
    pan: { x: 0, y: 0 },  // Pan position
    isEditing: false,     // Edit mode flag
    isDragging: false,    // Map dragging flag
    dragStart: { x: 0, y: 0 },
    tempPin: null,        // Temporary pin data during creation
    editingPinIndex: null,// Index of pin being edited (null = creating new)
    currentView: 'landing'
};

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
        setupDiceRoller();
        setView('landing');
        updateTaskMd('Initialize');
        initRole();
        loadSavedCombatIfAny();
        initCombatSync(); // auto-join if ?combat=ID is in the URL
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
        setView('characters');
    });

    document.getElementById('cardCombatMode').addEventListener('click', showCombatSetup);

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
// Map Rendering
// ============================================
function renderMap() {
    const mapData = state.data.mapas[state.currentMap];
    if (!mapData) {
        console.error('Map not found:', state.currentMap);
        return;
    }

    // Update image
    const mapImage = document.getElementById('mapImage');
    mapImage.src = mapData.imagen;
    mapImage.onerror = () => {
        console.error('Failed to load image:', mapData.imagen);
        mapImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect width="800" height="600" fill="%23151b2b"/%3E%3Ctext x="400" y="300" text-anchor="middle" fill="%23d4af37" font-size="20"%3EImagen no encontrada%3C/text%3E%3C/svg%3E';
    };

    // Update breadcrumbs
    updateBreadcrumbs();

    // Render pins
    renderPins();

    // Reset view
    resetView();
}

function renderPins() {
    const pinsLayer = document.getElementById('pinsLayer');
    pinsLayer.innerHTML = '';

    const mapData = state.data.mapas[state.currentMap];
    if (!mapData.pines) return;

    mapData.pines.forEach((pin, index) => {
        const pinElement = createPinElement(pin, index);
        pinsLayer.appendChild(pinElement);
    });
}

function createPinElement(pin, index) {
    const pinEl = document.createElement('div');
    pinEl.className = 'pin';
    pinEl.textContent = pin.nombre;
    pinEl.style.left = `${pin.x * 100}%`;
    pinEl.style.top = `${pin.y * 100}%`;

    // Apply size
    const size = pin.tamano || 1;
    pinEl.style.transform = `translate(-50%, -50%) scale(${size})`;
    pinEl.dataset.scale = size;

    if (state.isEditing) {
        pinEl.classList.add('editing');

        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'pin-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Eliminar pin';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePin(index);
        });
        pinEl.appendChild(deleteBtn);

        // Add double-click to edit
        pinEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            editPin(index);
        });

        makePinDraggable(pinEl, index);
    } else {
        const handlePinClick = (e) => {
            e.stopPropagation();
            navigateToMap(pin.destino);
        };
        pinEl.addEventListener('click', handlePinClick);
        pinEl.addEventListener('touchstart', (e) => {
            // Only navigate if it's a quick tap, not a drag start elsewhere
            // For now, simplicity: just tap to go.
            handlePinClick(e);
        }, { passive: true });
    }

    return pinEl;
}

function makePinDraggable(pinEl, pinIndex) {
    let isDragging = false;
    let startX, startY;

    pinEl.addEventListener('mousedown', (e) => {
        if (!state.isEditing) return;
        e.stopPropagation();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        pinEl.style.cursor = 'grabbing';
    });

    // Touch Support for Pin Dragging
    pinEl.addEventListener('touchstart', (e) => {
        if (!state.isEditing) return;
        e.stopPropagation();
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
    }, { passive: false });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        movePin(e.clientX, e.clientY);
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        movePin(touch.clientX, touch.clientY);
    }, { passive: false });

    function movePin(clientX, clientY) {
        const container = document.getElementById('mapImage');
        const rect = container.getBoundingClientRect();

        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        pinEl.style.left = `${x * 100}%`;
        pinEl.style.top = `${y * 100}%`;
    }

    const stopDragging = () => {
        if (isDragging) {
            isDragging = false;
            pinEl.style.cursor = 'move';

            // Update pin position in data
            const rect = document.getElementById('mapImage').getBoundingClientRect();
            const pinRect = pinEl.getBoundingClientRect();
            const x = (pinRect.left + pinRect.width / 2 - rect.left) / rect.width;
            const y = (pinRect.top + pinRect.height / 2 - rect.top) / rect.height;

            state.data.mapas[state.currentMap].pines[pinIndex].x = x;
            state.data.mapas[state.currentMap].pines[pinIndex].y = y;
        }
    };

    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);
}

// ============================================
// Navigation
// ============================================
function navigateToMap(mapId) {
    if (!state.data.mapas[mapId]) {
        console.error('Map not found:', mapId);
        return;
    }

    state.history.push(state.currentMap);
    state.currentMap = mapId;
    renderMap();
}

function navigateBack() {
    // Combat mode back navigation
    if (combatModeActive) {
        const view = state.currentView;
        if (view === 'combatManager') {
            // In active combat: back does nothing (use "Fin" button)
            return;
        } else if (view === 'combatInit') {
            showCombatSetup();
        } else if (view === 'combatSetup') {
            combatModeActive = false;
            setView('landing');
        }
        return;
    }

    // Map navigation back
    if (state.history.length === 0) return;
    state.currentMap = state.history.pop();
    renderMap();
}

function updateBreadcrumbs() {
    const breadcrumbs = document.getElementById('breadcrumbs');
    const btnBack = document.getElementById('btnBack');

    // Breadcrumbs text
    const path = [...state.history, state.currentMap];
    breadcrumbs.textContent = path.join(' → ');

    // Visibility of Back button
    if (btnBack) {
        if (state.history.length > 0) {
            btnBack.style.display = 'flex';
        } else {
            btnBack.style.display = 'none';
        }
    }
}

// ============================================
// Zoom & Pan
// ============================================
function adjustZoom(delta) {
    state.zoom = Math.max(0.5, Math.min(3, state.zoom + delta));
    applyTransform();
}

function resetView() {
    state.zoom = 1;
    state.pan = { x: 0, y: 0 };
    applyTransform();
}

function applyTransform() {
    const canvas = document.getElementById('mapCanvas');
    canvas.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
}

function handleMapWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    adjustZoom(delta);
}

function handleMapMouseDown(e) {
    if (e.button !== 0 || state.isEditing) return;
    state.isDragging = true;
    state.dragStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
    document.getElementById('mapContainer').classList.add('grabbing');
}

function handleMapMouseMove(e) {
    if (!state.isDragging) return;
    state.pan.x = e.clientX - state.dragStart.x;
    state.pan.y = e.clientY - state.dragStart.y;
    applyTransform();
}

function handleMapMouseUp(e) {
    state.isDragging = false;
    document.getElementById('mapContainer').classList.remove('grabbing');
}

// Touch handlers for mobile
let lastTouchX = 0;
let lastTouchY = 0;

function handleMapTouchStart(e) {
    if (state.isEditing) return;
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        state.isDragging = true;
        // No preventDefault here to allow potential taps on pins
    }
}

function handleMapTouchMove(e) {
    if (!state.isDragging) return;
    if (e.touches.length === 1) {
        e.preventDefault(); // Stop page scroll while panning
        const touch = e.touches[0];
        const dx = touch.clientX - lastTouchX;
        const dy = touch.clientY - lastTouchY;

        state.pan.x += dx;
        state.pan.y += dy;

        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;

        applyTransform();
    }
}

function handleMapTouchEnd(e) {
    state.isDragging = false;
    document.getElementById('mapContainer').classList.remove('grabbing');
}

// ============================================
// Edit Mode
// ============================================
function toggleEditMode() {
    state.isEditing = !state.isEditing;
    const toggleBtn = document.getElementById('toggleEdit');
    const addMapBtn = document.getElementById('addMapBtn');
    const exportBtn = document.getElementById('exportBtn');
    const mapContainer = document.getElementById('mapContainer');

    if (state.isEditing) {
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = '<span class="icon">✓</span> Modo Vista';
        addMapBtn.style.display = 'flex';
        exportBtn.style.display = 'flex';
        mapContainer.classList.add('edit-mode');

        // Show notification with instructions
        showNotification('Clic derecho para crear pin • Doble clic en un pin para editarlo', 4000);
    } else {
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '<span class="icon">✎</span> Modo Edición';
        addMapBtn.style.display = 'none';
        exportBtn.style.display = 'none';
        mapContainer.classList.remove('edit-mode');
    }

    renderPins();
}

function handleRightClick(e) {
    if (!state.isEditing) return;
    e.preventDefault();

    const rect = document.getElementById('mapImage').getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    state.tempPin = { x, y };
    showAddPinModal();
}

function showAddPinModal() {
    const modal = document.getElementById('pinModal');
    const modalTitle = document.getElementById('pinModalTitle');
    const select = document.getElementById('pinDestination');

    // Set title based on mode
    // Set title based on mode
    if (state.editingPinIndex !== null) {
        modalTitle.textContent = 'Editar Pin';
        const pin = state.data.mapas[state.currentMap].pines[state.editingPinIndex];
        document.getElementById('pinName').value = pin.nombre;
        document.getElementById('pinSize').value = pin.tamano || 1.0;
        document.getElementById('pinSizeValue').textContent = pin.tamano || 1.0;

        // Populate and select current destination
        select.innerHTML = '<option value="">-- Seleccionar mapa --</option>';
        for (const mapId in state.data.mapas) {
            const option = document.createElement('option');
            option.value = mapId;
            option.textContent = mapId;
            if (mapId === pin.destino) {
                option.selected = true;
            }
            select.appendChild(option);
        }
    } else {
        modalTitle.textContent = 'Nuevo Pin';
        document.getElementById('pinName').value = '';
        document.getElementById('pinSize').value = 1.0;
        document.getElementById('pinSizeValue').textContent = '1.0';

        // Populate map selection
        select.innerHTML = '<option value="">-- Seleccionar mapa --</option>';
        for (const mapId in state.data.mapas) {
            const option = document.createElement('option');
            option.value = mapId;
            option.textContent = mapId;
            select.appendChild(option);
        }
    }

    modal.style.display = 'flex';
    document.getElementById('pinName').focus();
}

function savePin() {
    const nombre = document.getElementById('pinName').value.trim();
    const destino = document.getElementById('pinDestination').value;
    const tamano = parseFloat(document.getElementById('pinSize').value);

    if (!nombre || !destino) {
        alert('Por favor completa todos los campos');
        return;
    }

    if (state.editingPinIndex !== null) {
        // Editing existing pin
        state.data.mapas[state.currentMap].pines[state.editingPinIndex].nombre = nombre;
        state.data.mapas[state.currentMap].pines[state.editingPinIndex].destino = destino;
        state.data.mapas[state.currentMap].pines[state.editingPinIndex].tamano = tamano;
        state.editingPinIndex = null;
        showNotification('Pin actualizado correctamente', 2000);
    } else {
        // Creating new pin
        const pin = {
            x: state.tempPin.x,
            y: state.tempPin.y,
            nombre: nombre,
            destino: destino,
            tamano: tamano
        };

        if (!state.data.mapas[state.currentMap].pines) {
            state.data.mapas[state.currentMap].pines = [];
        }

        state.data.mapas[state.currentMap].pines.push(pin);
        state.tempPin = null;
        showNotification('Pin creado correctamente', 2000);
    }

    document.getElementById('pinModal').style.display = 'none';
    renderPins();
}

function showAddMapModal() {
    const modal = document.getElementById('mapModal');
    modal.style.display = 'flex';
    document.getElementById('mapId').value = '';
    document.getElementById('mapImagePath').value = '';
    document.getElementById('mapId').focus();
}

function saveNewMap() {
    const mapId = document.getElementById('mapId').value.trim();
    const imageName = document.getElementById('mapImagePath').value.trim();

    if (!mapId || !imageName) {
        alert('Por favor completa todos los campos');
        return;
    }

    if (state.data.mapas[mapId]) {
        alert('Ya existe un mapa con ese ID');
        return;
    }

    // Automatically prepend the assets/imagenes/ path
    const imagePath = `assets/imagenes/${imageName}`;

    state.data.mapas[mapId] = {
        imagen: imagePath,
        pines: []
    };

    document.getElementById('mapModal').style.display = 'none';
    showNotification(`Mapa "${mapId}" creado correctamente`, 2000);
}

// ============================================
// Data Export
// ============================================
function deletePin(pinIndex) {
    const pinName = state.data.mapas[state.currentMap].pines[pinIndex].nombre;

    if (confirm(`¿Eliminar el pin "${pinName}"?`)) {
        state.data.mapas[state.currentMap].pines.splice(pinIndex, 1);
        renderPins();
    }
}

function exportData() {
    const dataStr = "window.initialGameData = " + JSON.stringify(state.data, null, 4) + ";";
    const blob = new Blob([dataStr], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Datos exportados como data.js. Reemplaza el archivo existente en la carpeta del proyecto.');
}

// ============================================
// Pin Editing
// ============================================
function editPin(pinIndex) {
    state.editingPinIndex = pinIndex;
    showAddPinModal();
}

// ============================================
// Notification System
// ============================================
function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    }
}

// ============================================
// Task Tracking Helper
// ============================================
function updateTaskMd(action) {
    console.log(`[Task Update] ${action} completed`);
}

// ============================================
// HP Tracker State
// ============================================
const hpState = {};
const spellSlotState = {};
const inspirationState = {};
const conditionsState = {};
const deathSaveState = {};
const notesState = {};
const diceHistory = [];
const demonicFormState = {}; // { charId: { active: bool, turnsLeft: int } }
const turnPlannerState = {}; // { charId: { accion: null, adicional: null, reaccion: null } }
// ============================================
// Role System
// ============================================
// ============================================
// Real-time Sync (API + SSE)
// ============================================
// En producción nginx proxea /api/ → localhost:3001; en local apunta directo
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : window.location.origin;
const COMBAT_ID_KEY = 'dnd_combat_id';
const CLIENT_ID     = Math.random().toString(36).slice(2, 10); // unique per tab

let activeCombatId = localStorage.getItem(COMBAT_ID_KEY) || null;
let sseSource      = null;
let _saveTimer     = null;

// Debounced PUT to API — called after every saveCombatState()
function saveToApi() {
    if (!activeCombatId || !combatState.isActive) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
        try {
            const body = {
                participants:      combatState.participants.map(p => ({ ...p, charData: null })),
                currentIndex:      combatState.currentIndex,
                round:             combatState.round,
                isActive:          combatState.isActive,
                segundaAccionTurn: combatState.segundaAccionTurn,
                extraAttackTurn:   combatState.extraAttackTurn,
                nextLogId:         combatState.nextLogId,
                log:               combatState.log,
                _clientId:         CLIENT_ID,
            };
            await fetch(`${API_BASE}/api/combats/${activeCombatId}`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(body),
            });
        } catch (e) { console.warn('[sync] PUT failed:', e.message); }
    }, 800);
}

// Re-attach charData after receiving remote state (charData is stripped before saving)
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

// Apply state received from SSE (skip own echoes via _clientId)
function applyRemoteState(data) {
    if (data._clientId === CLIENT_ID) return; // own echo — ignore
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
    });
    if (combatModeActive) renderCombatManager();
}

// Open SSE connection to receive real-time updates
function connectToSSE(id) {
    if (sseSource) { sseSource.close(); sseSource = null; }
    sseSource = new EventSource(`${API_BASE}/api/combats/${id}/stream`);
    sseSource.onmessage = e => {
        try { applyRemoteState(JSON.parse(e.data)); } catch (_) {}
    };
    // EventSource auto-reconnects on error — no action needed
}

// Master: POST to create a new combat session, then open SSE
async function startCombatSession() {
    try {
        const body = {
            participants:      combatState.participants.map(p => ({ ...p, charData: null })),
            currentIndex:      combatState.currentIndex,
            round:             combatState.round,
            isActive:          true,
            segundaAccionTurn: false,
            extraAttackTurn:   false,
            nextLogId:         combatState.nextLogId,
            log:               combatState.log,
            _clientId:         CLIENT_ID,
        };
        const res  = await fetch(`${API_BASE}/api/combats`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
        const data = await res.json();
        activeCombatId = String(data.combatId);
        localStorage.setItem(COMBAT_ID_KEY, activeCombatId);
        connectToSSE(activeCombatId);
        renderCombatShareLink();
    } catch (e) { console.warn('[sync] startCombatSession failed:', e.message); }
}

// Render the share link in the combat top bar (master only)
function renderCombatShareLink() {
    const el = document.getElementById('combatShareLink');
    if (!el || !activeCombatId) return;
    const url = `${window.location.origin}${window.location.pathname}?combat=${activeCombatId}`;
    const code = activeCombatId.slice(-6).toUpperCase();
    el.innerHTML = `
        <span class="share-link-code" title="Código de sala">${code}</span>
        <button class="share-link-copy"
                onclick="navigator.clipboard.writeText('${url}').then(()=>showNotification('✅ Link copiado — compártelo con los jugadores',2000))"
                title="Copiar link para jugadores">📋</button>`;
    el.style.display = 'flex';
}

// Players: called on init() — auto-join if ?combat=ID is in the URL
function initCombatSync() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('combat');
    if (!id) return;
    activeCombatId = id;
    localStorage.setItem(COMBAT_ID_KEY, id);
    connectToSSE(id);
    combatModeActive = true;
    setView('combatManager');
}

// ============================================
// Role System
// ============================================
const ROLE_KEY = 'dnd_game_role';
let gameRole = { type: 'master', characterId: null };

function isMaster() { return gameRole.type === 'master'; }

function initRole() {
    const saved = localStorage.getItem(ROLE_KEY);
    if (saved) {
        try { gameRole = JSON.parse(saved); } catch(e) {}
        updateRoleIndicator();
        return; // skip overlay, role already set
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
    // Update body class for CSS-based hiding
    if (isMaster()) {
        document.body.classList.remove('role-jugador');
    } else {
        document.body.classList.add('role-jugador');
    }
    // Update role badge in HUD
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

const combatState = {
    selectedIds: [],       // charIds selected for this combat
    participants: [],      // sorted by initiative after beginCombat()
    currentIndex: 0,
    round: 1,
    isActive: false,
    log: [],               // array of log entry objects
    nextLogId: 0,
    segundaAccionTurn: false, // true when in segunda acción mini-turn
    extraAttackTurn: false,   // true when in ataque extra mini-turn
};
// participant object: { id, name, initiative, hp:{current,max}, ac, conditions:[], note:'', charData }
// log entry: { id, round, participantId, participantName, actions:[{nombre,dice}], note:'', isCurrent:bool }

// Combat mode navigation flag
let combatModeActive = false;
let setupNpcs = [];        // NPCs built in the setup screen before combat starts
let setupInitiatives = {}; // { charId: number } — initiatives set in the setup screen
let currentCharacterId = null;
let isCharacterEditing = false;

const CONDITIONS = [
    { id: 'envenenado',    label: '🤢', title: 'Envenenado' },
    { id: 'paralizado',   label: '⛓️', title: 'Paralizado' },
    { id: 'asustado',     label: '😱', title: 'Asustado' },
    { id: 'cegado',       label: '🚫', title: 'Cegado' },
    { id: 'aturdido',     label: '💫', title: 'Aturdido' },
    { id: 'concentracion',label: '🧠', title: 'Concentración' },
];

function saveStateToStorage() {
    try {
        localStorage.setItem('dnd_hp',         JSON.stringify(hpState));
        localStorage.setItem('dnd_slots',      JSON.stringify(spellSlotState));
        localStorage.setItem('dnd_inspiration',JSON.stringify(inspirationState));
        localStorage.setItem('dnd_conditions', JSON.stringify(conditionsState));
        localStorage.setItem('dnd_deathsaves', JSON.stringify(deathSaveState));
        localStorage.setItem('dnd_demonic',    JSON.stringify(demonicFormState));
        localStorage.setItem('dnd_notes',      JSON.stringify(notesState));
    } catch(e) {}
}

function loadStateFromStorage() {
    try {
        const hp   = localStorage.getItem('dnd_hp');         if (hp)   Object.assign(hpState,          JSON.parse(hp));
        const sl   = localStorage.getItem('dnd_slots');      if (sl)   Object.assign(spellSlotState,   JSON.parse(sl));
        const ins  = localStorage.getItem('dnd_inspiration');if (ins)  Object.assign(inspirationState, JSON.parse(ins));
        const cond = localStorage.getItem('dnd_conditions'); if (cond) Object.assign(conditionsState,  JSON.parse(cond));
        const ds   = localStorage.getItem('dnd_deathsaves'); if (ds)   Object.assign(deathSaveState,   JSON.parse(ds));
        const dem  = localStorage.getItem('dnd_demonic');    if (dem)  Object.assign(demonicFormState, JSON.parse(dem));
        const nt   = localStorage.getItem('dnd_notes');      if (nt)   Object.assign(notesState,       JSON.parse(nt));
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

function getSliderGradient(pct) {
    let color;
    if (pct <= 25) color = '#ff4444';
    else if (pct <= 50) color = '#ffaa00';
    else color = '#44cc66';
    return `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
}

function setHp(value) {
    if (!currentCharacterId) return;
    initHpForChar(currentCharacterId);
    const hp = hpState[currentCharacterId];
    const wasAlive = hp.current > 0;
    hp.current = Math.max(0, Math.min(hp.max, value));

    const pct = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
    const currentEl = document.getElementById('hpCurrent');
    const sliderEl  = document.getElementById('hpSlider');
    const sectionEl = document.querySelector('.hp-bar-section');
    const deathEl   = document.getElementById('deathSavesSection');

    if (currentEl) currentEl.textContent = hp.current;
    if (sliderEl)  { sliderEl.value = hp.current; sliderEl.style.background = getSliderGradient(pct); }
    if (sectionEl) {
        sectionEl.classList.toggle('unconscious', hp.current === 0);
        sectionEl.classList.toggle('critical', pct <= 25 && hp.current > 0);
    }
    if (deathEl) deathEl.style.display = hp.current === 0 ? 'flex' : 'none';
    // Reset death saves when HP restored from 0
    if (!wasAlive && hp.current > 0 && deathSaveState[currentCharacterId]) {
        deathSaveState[currentCharacterId] = { successes: 0, failures: 0 };
    }

    saveStateToStorage();
    if (hp.current === 0) showNotification('💀 ¡Sin puntos de golpe!', 3000);
    else if (hp.current <= Math.floor(hp.max * 0.25)) showNotification('⚠️ HP crítico', 2000);
}

function renderHpSection(charId) {
    initHpForChar(charId);
    initDeathSavesForChar(charId);
    const hp = hpState[charId];
    const ds = deathSaveState[charId];
    const pct = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
    const isCritical = pct <= 25 && hp.current > 0;
    const isUnconscious = hp.current === 0;
    const hasInspiration = inspirationState[charId] || false;

    const makeDsPips = (type, count) =>
        [0,1,2].map(i => `<button class="ds-pip ${type}${i < count ? ' filled' : ''}"
            onclick="toggleDeathSave('${charId}','${type}',${i})" title="${type === 'success' ? 'Éxito' : 'Fallo'}"></button>`).join('');

    return `
        <div class="hp-bar-section${isUnconscious ? ' unconscious' : ''}${isCritical ? ' critical' : ''}">
            <div class="hp-bar-header">
                <div class="hp-info">
                    <div class="pill-label">❤️ Puntos de Golpe</div>
                    <div class="hp-display">
                        <span id="hpCurrent">${hp.current}</span><span class="hp-max"> / ${hp.max}</span>
                    </div>
                </div>
                <button class="inspiration-btn${hasInspiration ? ' active' : ''}"
                        onclick="toggleInspiration('${charId}')" title="Inspiración">⭐</button>
            </div>
            <input type="range" class="hp-slider" id="hpSlider"
                   min="0" max="${hp.max}" value="${hp.current}"
                   oninput="setHp(parseInt(this.value))"
                   style="background: ${getSliderGradient(pct)}"
                   aria-label="Puntos de golpe">
            <div class="death-saves-section" id="deathSavesSection" style="display:${isUnconscious ? 'flex' : 'none'}">
                <div class="ds-title">💀 Salvaciones de Muerte</div>
                <div class="ds-row"><span class="ds-label success">Éxitos</span>
                    <div class="ds-pips">${makeDsPips('success', ds.successes)}</div></div>
                <div class="ds-row"><span class="ds-label failure">Fallos</span>
                    <div class="ds-pips">${makeDsPips('failure', ds.failures)}</div></div>
            </div>
        </div>
    `;
}

function toggleInspiration(charId) {
    inspirationState[charId] = !inspirationState[charId];
    const btn = document.querySelector('.inspiration-btn');
    if (btn) btn.classList.toggle('active', inspirationState[charId]);
    saveStateToStorage();
    showNotification(inspirationState[charId] ? '⭐ ¡Inspiración!' : '⭐ Inspiración usada', 2000);
}

function toggleDeathSave(charId, type, index) {
    initDeathSavesForChar(charId);
    const ds = deathSaveState[charId];
    const key = type + 's';
    ds[key] = (index < ds[key]) ? index : Math.min(3, index + 1);
    // Update pips
    document.querySelectorAll(`#deathSavesSection .ds-pip.${type}`).forEach((pip, i) => {
        pip.classList.toggle('filled', i < ds[key]);
    });
    saveStateToStorage();
    if (ds.successes >= 3) showNotification('✅ ¡Estabilizado!', 3000);
    if (ds.failures  >= 3) showNotification('💀 ¡Has muerto!', 5000);
}

function renderConditionsBar(charId) {
    if (!conditionsState[charId]) conditionsState[charId] = [];
    const active = conditionsState[charId];
    return `<div class="conditions-bar" id="conditionsBar">
        ${CONDITIONS.map(c => `<button class="condition-btn${active.includes(c.id) ? ' active' : ''}"
            onclick="toggleCondition('${charId}','${c.id}')" title="${c.title}">${c.label} ${c.title}</button>`).join('')}
    </div>`;
}

function toggleCondition(charId, condId) {
    if (!conditionsState[charId]) conditionsState[charId] = [];
    const idx = conditionsState[charId].indexOf(condId);
    if (idx >= 0) conditionsState[charId].splice(idx, 1);
    else conditionsState[charId].push(condId);
    document.querySelectorAll(`#conditionsBar .condition-btn`).forEach(btn => {
        const id = btn.getAttribute('onclick').match(/'([^']+)'\)$/)?.[1];
        if (id) btn.classList.toggle('active', conditionsState[charId].includes(id));
    });
    saveStateToStorage();
}

function toggleSpellSlot(charId, slotName, index) {
    initSpellSlotsForChar(charId);
    const data = window.characterData[charId];
    const slotDef = data.ranuras?.find(s => s.nombre === slotName);
    if (!slotDef) return;
    const cur = spellSlotState[charId][slotName];
    spellSlotState[charId][slotName] = Math.max(0, Math.min(slotDef.total, index < cur ? index : index + 1));
    const remaining = spellSlotState[charId][slotName];
    document.querySelectorAll(`.slot-track[data-slot="${slotName}"] .slot-pip`).forEach((pip, i) => {
        pip.classList.toggle('used', i >= remaining);
    });
    const countEl = document.querySelector(`.slot-count[data-slot="${slotName}"]`);
    if (countEl) countEl.textContent = `${remaining}/${slotDef.total}`;
    saveStateToStorage();
}

function resetSpellSlots(charId) {
    const data = window.characterData[charId];
    if (!data?.ranuras) return;
    data.ranuras.forEach(s => { spellSlotState[charId][s.nombre] = s.total; });
    renderSpellsWithFilters(data);
    saveStateToStorage();
    showNotification('🌙 Descanso largo: slots restaurados', 2500);
}

function saveNote(charId, text) {
    notesState[charId] = text;
    saveStateToStorage();
}

function updateDiceHistory() {
    const el = document.getElementById('diceHistory');
    if (!el || diceHistory.length === 0) return;
    el.innerHTML = diceHistory.map(r => {
        const cls = r.sides === 20 && r.result === 20 ? ' crit' : r.sides === 20 && r.result === 1 ? ' fumble' : '';
        return `<span class="history-chip${cls}">d${r.sides}:${r.result}</span>`;
    }).join('');
}

// ============================================
// Dice Roller
// ============================================
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
// Character Sheet Logic (Redesign)
// ============================================
const skillMapping = {
    "Fuerza": ["Atletismo"],
    "Destreza": ["Acrobacias", "Juego de Manos", "Sigilo"],
    "Constitución": [],
    "Inteligencia": ["Arcanos", "Historia", "Investigación", "Naturaleza", "Religión"],
    "Sabiduría": ["Manejo de Animales", "Perspicacia", "Medicina", "Percepción", "Supervivencia"],
    "Carisma": ["Engaño", "Intimidación", "Persuación", "Interpretación"]
};

function getModifier(value) {
    return Math.floor((value - 10) / 2);
}

function renderQuickActions(data) {
    const container = document.getElementById('quickActions');
    if (!container) return;
    container.innerHTML = '';

    // We scan traits, spells and inventory for "quick" items
    const quickItems = [];

    // Heuristic: spells that are "Truco" or "Nivel 1" with damage/effect
    if (data.conjuros) {
        data.conjuros.forEach(s => {
            if (s.nivel === "Truco" || s.nivel === 1 || s.nombre.includes("Eldritch")) {
                quickItems.push({ ...s, type: 'Action', category: 'Spell' });
            }
        });
    }

    // Heuristic: traits that sound like weapons or major powers
    if (data.rasgos) {
        data.rasgos.forEach(r => {
            if (r.nombre.includes("🗡️") || r.nombre.includes("⚔️") || r.nombre.includes("Espada") || r.nombre.includes("Aura")) {
                quickItems.push({ ...r, type: 'Action', category: 'Trait' });
            }
        });
    }

    if (quickItems.length === 0) {
        container.innerHTML = '<div style="color:var(--text-secondary); font-size:12px;">No hay acciones rápidas definidas.</div>';
        return;
    }

    quickItems.forEach(item => {
        const card = document.createElement('div');
        const isExtra = item.desc.toLowerCase().includes("acción adicional") || item.desc.toLowerCase().includes("bonus");
        const isReaction = item.desc.toLowerCase().includes("reacción");

        card.className = `action-card ${isExtra ? 'extra' : ''} ${isReaction ? 'reaction' : ''}`;
        card.innerHTML = `
            <div class="action-header">
                <span class="action-name">${item.nombre}</span>
                <span class="action-type">${isExtra ? 'Bonus' : isReaction ? 'Reac' : 'Acción'}</span>
            </div>
            <div class="action-summary">${item.desc.substring(0, 60)}...</div>
        `;
        card.addEventListener('click', () => {
            showNotification(`Usando: ${item.nombre}`, 2000);
        });
        container.appendChild(card);
    });
}

function updateTabs(data) {
    const tabCombat = document.getElementById('tabCombat');
    const tabFeatures = document.getElementById('tabFeatures');
    const tabInventory = document.getElementById('tabInventory');
    const tabSpells = document.getElementById('tabSpells');

    // 1. Tab Combat: on mobile this mirrors the inline combat section
    if (tabCombat) tabCombat.innerHTML = renderCombatTab(data);

    // 2. Tab Narrative: Social, background, and passive traits
    let narrativeHTML = '<div class="feature-grid">';
    data.rasgos.forEach((trait, index) => {
        if (!trait.nombre.includes("🗡️") && !trait.nombre.includes("⚔️") && !trait.nombre.includes("Combate")) {
            narrativeHTML += renderTraitItem(trait, index, 'features');
        }
    });
    narrativeHTML += '</div>';
    tabFeatures.innerHTML = narrativeHTML;

    // 3. Tab Inventory: Categorized
    let inventorySearchHTML = `
        <div class="inventory-filters" style="margin-bottom:20px;">
            <input type="text" id="inventorySearch" placeholder="Buscar en equipo..." class="sheet-input" style="width:100%">
        </div>
        <div id="inventoryResults">
    `;
    tabInventory.innerHTML = inventorySearchHTML + '</div>';
    renderCategorizedInventory(data, "");

    // Search logic for inventory
    const invSearch = document.getElementById('inventorySearch');
    if (invSearch) {
        invSearch.addEventListener('input', (e) => {
            renderCategorizedInventory(data, e.target.value.toLowerCase());
        });
    }

    // 4. Tab Spells: With quick filters
    renderSpellsWithFilters(data);

    // Re-attach expand events
    setupCollapsibleEvents();
}

// ============================================
// Combat Tab – Turn Planner
// ============================================

// Extract dice notation (e.g. "2d10", "1d6+3") from a description string
function extractDiceFromDesc(desc) {
    if (!desc) return null;
    const plain = desc.replace(/<[^>]+>/g, ' '); // strip HTML tags
    const matches = plain.match(/\d+d\d+(?:[+-]\d+)?/gi);
    if (!matches || matches.length === 0) return null;
    return matches.join(' + ');
}

// Return styled dice badges for an action item
function getDiceBadges(action) {
    let parts = [];
    if (action.atk) parts.push(`<span class="dice-atk">ATK ${action.atk}</span>`);
    if (action.dado && action.dado !== '—') {
        parts.push(`<span class="dice-dmg">DMG ${action.dado}</span>`);
    } else if (!action.atk) {
        // Try to extract from description
        const extracted = extractDiceFromDesc(action.desc);
        if (extracted) parts.push(`<span class="dice-dmg">${extracted}</span>`);
    }
    return parts.join('');
}

// Render combat content into both combatInline and tabCombat
function renderCombatInline(data) {
    const html = renderCombatTab(data);
    const inline = document.getElementById('combatInline');
    if (inline) inline.innerHTML = html;
    const tab = document.getElementById('tabCombat');
    if (tab) tab.innerHTML = html;
}

function inferActionType(item) {
    if (item.tipo) return item.tipo;
    const nivel = String(item.nivel ?? '');
    const nombre = item.nombre || '';
    const desc = item.desc || '';
    // Reaction
    if (nivel === 'Reac' || /\(Reacci[oó]n\)/i.test(nombre) || /\(Reacci[oó]n\)/i.test(desc)) {
        return 'reaccion';
    }
    // Bonus action – capital-B "Bonus" word, or "(Bonus)" in name
    if (/\(Bonus\)/i.test(nombre) || /\bBonus\b/.test(desc)) {
        return 'adicional';
    }
    return 'accion';
}

function renderCombatTab(data) {
    const charId = data.id;
    if (!turnPlannerState[charId]) {
        turnPlannerState[charId] = { accion: null, adicional: null, reaccion: null };
    }
    const planner = turnPlannerState[charId];

    // Collect all combat items
    const allItems = [
        ...(data.combateExtra || []),
        ...(data.conjuros || [])
    ];

    // Group by type
    const groups = { accion: [], adicional: [], reaccion: [] };
    allItems.forEach(item => {
        const tipo = inferActionType(item);
        groups[tipo].push(item);
    });

    // Spell slots
    let slotsHTML = '';
    if (data.ranuras && data.ranuras.length > 0) {
        initSpellSlotsForChar(charId);
        slotsHTML = `<div class="slot-tracker combat-slots">
            <div class="slot-tracker-header">
                <span class="slot-tracker-title">✨ Ranuras</span>
                <button class="slot-reset-btn" onclick="resetSpellSlots('${charId}')" title="Descanso largo">🌙</button>
            </div>
            ${data.ranuras.map(slot => {
                const remaining = spellSlotState[charId]?.[slot.nombre] ?? slot.total;
                const pips = Array.from({ length: slot.total }, (_, i) =>
                    `<button class="slot-pip${i >= remaining ? ' used' : ''}"
                        onclick="toggleSpellSlot('${charId}','${slot.nombre}',${i})"></button>`
                ).join('');
                return `<div class="slot-row">
                    <span class="slot-name">${slot.nombre}</span>
                    <div class="slot-track" data-slot="${slot.nombre}">${pips}</div>
                    <span class="slot-count" data-slot="${slot.nombre}">${remaining}/${slot.total}</span>
                </div>`;
            }).join('')}
        </div>`;
    }

    // Turn planner
    const plannerSlots = [
        { key: 'accion', icon: '🎯', label: 'Acción' },
        { key: 'adicional', icon: '⚡', label: 'Adicional' },
        { key: 'reaccion', icon: '↩️', label: 'Reacción' }
    ];
    const plannerSlotsHTML = plannerSlots.map(s => {
        const sel = planner[s.key];
        if (sel) {
            return `<div class="planner-slot filled">
                <span class="planner-slot-icon">${s.icon}</span>
                <span class="planner-slot-label">${s.label}:</span>
                <span class="planner-slot-value">${sel.nombre}</span>
                <button class="planner-slot-clear" onclick="clearPlannerSlot('${charId}','${s.key}')">×</button>
            </div>`;
        }
        return `<div class="planner-slot empty">
            <span class="planner-slot-icon">${s.icon}</span>
            <span class="planner-slot-label">${s.label}:</span>
            <span class="planner-slot-empty">— selecciona abajo</span>
        </div>`;
    }).join('');

    // Dice panel — uses getDiceBadges for consistent display incl. extracted dice
    const selectedActions = [planner.accion, planner.adicional, planner.reaccion].filter(Boolean);
    let diceHTML = '';
    if (selectedActions.length > 0) {
        const rows = selectedActions.map(action => {
            const badges = getDiceBadges(action);
            return `<div class="dice-row">
                <span class="dice-name">${action.nombre}</span>
                <div class="dice-values">${badges || '<span class="dice-utility">Sin tirada</span>'}</div>
            </div>`;
        }).join('');
        diceHTML = `<div class="dice-panel-combat">
            <div class="dice-panel-title">🎲 Dados del Turno</div>
            ${rows}
        </div>`;
    }

    // Action lists
    const sections = [
        { key: 'accion', icon: '🎯', label: 'Acciones' },
        { key: 'adicional', icon: '⚡', label: 'Adicionales' },
        { key: 'reaccion', icon: '↩️', label: 'Reacciones' }
    ];
    const actionListHTML = sections.map(section => {
        const items = groups[section.key];
        if (items.length === 0) return '';
        const cardsHTML = items.map(item => {
            const sel = planner[section.key];
            const isSelected = sel && sel.nombre === item.nombre;
            // Dice badge: explicit fields first, then extracted from desc
            const diceStr = item.atk
                ? `ATK ${item.atk}${item.dado && item.dado !== '—' ? ` | DMG ${item.dado}` : ''}`
                : (item.dado && item.dado !== '—' ? `DMG ${item.dado}`
                    : (extractDiceFromDesc(item.desc) || ''));
            const safeName = item.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `<div class="combat-action-card${isSelected ? ' selected' : ''}"
                     onclick="selectCombatAction('${charId}','${section.key}','${safeName}')">
                <div class="combat-action-header">
                    <span class="combat-action-name">${item.nombre}</span>
                    ${diceStr ? `<span class="combat-action-dice">${diceStr}</span>` : ''}
                </div>
                <div class="combat-action-desc">${item.desc}</div>
            </div>`;
        }).join('');
        return `<div class="combat-section">
            <div class="combat-section-title">${section.icon} ${section.label}</div>
            <div class="combat-action-list">${cardsHTML}</div>
        </div>`;
    }).join('');

    return `<div class="turn-planner">
        <div class="turn-planner-title">⚡ Planificador de Turno</div>
        <div class="planner-slots">${plannerSlotsHTML}</div>
        ${diceHTML}
    </div>
    ${slotsHTML}
    ${actionListHTML}`;
}

function selectCombatAction(charId, tipo, nombre) {
    const data = window.characterData[charId];
    if (!data) return;
    const allItems = [...(data.combateExtra || []), ...(data.conjuros || [])];
    const item = allItems.find(i => i.nombre === nombre);
    if (!item) return;
    if (!turnPlannerState[charId]) turnPlannerState[charId] = { accion: null, adicional: null, reaccion: null };
    const planner = turnPlannerState[charId];
    planner[tipo] = (planner[tipo] && planner[tipo].nombre === nombre) ? null : item;
    refreshCombatSections(data);
}

function clearPlannerSlot(charId, tipo) {
    if (!turnPlannerState[charId]) return;
    turnPlannerState[charId][tipo] = null;
    const data = window.characterData[charId];
    if (data) refreshCombatSections(data);
}

function refreshCombatSections(data) {
    const html = renderCombatTab(data);
    const inline = document.getElementById('combatInline');
    if (inline) inline.innerHTML = html;
    const tab = document.getElementById('tabCombat');
    if (tab) tab.innerHTML = html;
}

function renderTraitItem(trait, index, tab) {
    return `
        <div class="feature-item" data-index="${index}">
            <div class="feature-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                <h3 style="margin:0; flex:1">${trait.nombre}</h3>
                ${isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteFeature(${index})">×</button>` : '<span class="feature-chevron">▼</span>'}
            </div>
            <div class="item-desc collapsible">${trait.desc}</div>
        </div>
    `;
}

function renderCategorizedInventory(data, filter = "") {
    const resultsContainer = document.getElementById('inventoryResults');
    if (!resultsContainer) return;

    const categories = {
        "Equipado": [],
        "Objetos Mágicos": [],
        "Consumibles": [],
        "Mochila": []
    };

    if (data.inventario) {
        data.inventario.forEach((item, index) => {
            if (filter && !item.nombre.toLowerCase().includes(filter) && !item.desc.toLowerCase().includes(filter)) return;

            const desc = item.desc.toLowerCase();
            if (desc.includes("arma") || desc.includes("armadura") || desc.includes("escudo")) categories["Equipado"].push({ item, index });
            else if (desc.includes("mágico") || desc.includes("anillo") || desc.includes("capa")) categories["Objetos Mágicos"].push({ item, index });
            else if (desc.includes("poción") || desc.includes("pergamino") || desc.includes("comida")) categories["Consumibles"].push({ item, index });
            else categories["Mochila"].push({ item, index });
        });
    }

    let html = '';
    for (const [catName, items] of Object.entries(categories)) {
        if (items.length === 0 && filter) continue;
        html += `<h3 class="feature-section-title">${catName}</h3><div class="feature-grid">`;
        if (items.length === 0) {
            html += `<div style="color:var(--text-secondary); font-size:12px; padding:10px;">Nada en esta categoría.</div>`;
        } else {
            items.forEach(({ item, index }) => {
                html += `
                    <div class="feature-item">
                        <div class="feature-header" style="display:flex; justify-content:space-between; cursor:pointer;">
                            <h3 style="margin:0">${item.nombre}</h3>
                            ${isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteInventoryItem(${index})">×</button>` : ''}
                        </div>
                        <div class="item-desc collapsible expanded">${item.desc}</div>
                    </div>
                `;
            });
        }
        html += '</div>';
    }

    if (isCharacterEditing) {
        html += `<button class="btn-add-item" onclick="addInventoryItem()">+ Añadir Objeto</button>`;
    }

    resultsContainer.innerHTML = html;
}

function renderSpellsWithFilters(data) {
    const container = document.getElementById('tabSpells');
    if (!data.conjuros || data.conjuros.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px;">Este personaje no posee conjuros.</div>';
        return;
    }

    // Collect unique spell levels
    const levels = ['Todos'];
    data.conjuros.forEach(s => {
        const lv = s.nivel === 'Truco' ? 'Truco' :
            (s.nivel === 'Esp' || s.nivel === 'Especial') ? 'Esp' :
            `Nv${s.nivel}`;
        if (!levels.includes(lv)) levels.push(lv);
    });

    const filterBtns = levels.map((lv, i) =>
        `<button class="spell-filter-btn${i === 0 ? ' active' : ''}" data-level="${lv}">${lv}</button>`
    ).join('');

    // Slot tracker
    let slotHTML = '';
    const charId = currentCharacterId;
    if (charId && data.ranuras && data.ranuras.length > 0) {
        initSpellSlotsForChar(charId);
        slotHTML = `<div class="slot-tracker">
            <div class="slot-tracker-header">
                <span class="slot-tracker-title">✨ Ranuras de Conjuro</span>
                <button class="slot-reset-btn" onclick="resetSpellSlots('${charId}')" title="Descanso largo">🌙 Descanso</button>
            </div>
            ${data.ranuras.map(slot => {
                const remaining = spellSlotState[charId]?.[slot.nombre] ?? slot.total;
                const pips = Array.from({ length: slot.total }, (_, i) =>
                    `<button class="slot-pip${i >= remaining ? ' used' : ''}"
                        onclick="toggleSpellSlot('${charId}','${slot.nombre}',${i})"></button>`
                ).join('');
                return `<div class="slot-row">
                    <span class="slot-name">${slot.nombre}</span>
                    <div class="slot-track" data-slot="${slot.nombre}">${pips}</div>
                    <span class="slot-count" data-slot="${slot.nombre}">${remaining}/${slot.total}</span>
                </div>`;
            }).join('')}
        </div>`;
    }

    let html = `
        ${slotHTML}
        <div class="spell-level-filters" id="spellFilters">${filterBtns}</div>
        <div class="spell-filters" style="margin-bottom:14px; display:flex; gap:10px;">
            <input type="text" id="spellSearch" placeholder="Buscar conjuro..." class="sheet-input" style="flex:1">
        </div>
        <div class="feature-grid" id="spellsGrid">
    `;

    data.conjuros.forEach((spell, index) => {
        const levelKey = spell.nivel === 'Truco' ? 'Truco' :
            (spell.nivel === 'Esp' || spell.nivel === 'Especial') ? 'Esp' :
            `Nv${spell.nivel}`;
        const type = spell.desc.toLowerCase().includes("daño") ? "DAÑO" :
            spell.desc.toLowerCase().includes("cur") ? "CURACIÓN" :
            spell.desc.toLowerCase().includes("control") ? "CONTROL" : "UTILIDAD";

        html += `
            <div class="spell-item" data-name="${spell.nombre.toLowerCase()}" data-level="${levelKey}">
                <div class="feature-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                    <h3 style="margin:0; flex:1">${spell.nombre}</h3>
                    ${isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteSpell(${index})">×</button>` : '<span class="feature-chevron">▼</span>'}
                </div>
                <div class="item-meta">${spell.nivel === "Truco" ? "Truco" : "Nivel " + spell.nivel} • ${type}</div>
                <div class="item-desc collapsible">${spell.desc}</div>
            </div>
        `;
    });

    html += '</div>';
    if (isCharacterEditing) {
        html += `<button class="btn-add-item" onclick="addSpell()">+ Añadir Conjuro</button>`;
    }
    container.innerHTML = html;

    // Level filter logic
    let activeLevel = 'Todos';
    let activeSearch = '';

    function applySpellFilters() {
        document.querySelectorAll('#spellsGrid .spell-item').forEach(item => {
            const levelMatch = activeLevel === 'Todos' || item.dataset.level === activeLevel;
            const searchMatch = !activeSearch || item.dataset.name.includes(activeSearch);
            item.style.display = (levelMatch && searchMatch) ? '' : 'none';
        });
    }

    document.querySelectorAll('#spellFilters .spell-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#spellFilters .spell-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeLevel = btn.dataset.level;
            applySpellFilters();
        });
    });

    const search = document.getElementById('spellSearch');
    if (search) {
        search.addEventListener('input', (e) => {
            activeSearch = e.target.value.toLowerCase();
            applySpellFilters();
        });
    }
}

function setupCollapsibleEvents() {
    const sheet = document.getElementById('characterSheetContainer');
    if (!sheet || sheet._collapsibleSetup) return;
    sheet._collapsibleSetup = true;
    sheet.addEventListener('click', (e) => {
        const header = e.target.closest('.feature-header');
        if (!header || e.target.closest('button')) return;
        const desc = header.nextElementSibling;
        if (desc?.classList.contains('collapsible')) {
            const expanding = !desc.classList.contains('expanded');
            desc.classList.toggle('expanded', expanding);
            const chevron = header.querySelector('.feature-chevron');
            if (chevron) chevron.textContent = expanding ? '▲' : '▼';
        }
    });
}

// ── Demonic Form ─────────────────────────────
function renderDemonicSection(charId) {
    const section = document.getElementById('sheetResources');
    if (!section) return;
    section.style.display = 'flex';
    let html = renderConditionsBar(charId);
    if (charId === 'Vel') {
        const ds = demonicFormState[charId] || { active: false, turnsLeft: 0 };
        const btnCls = 'btn-demonic' + (ds.active ? ' active' : '');
        const label  = ds.active ? `😈 Demoníaca — ${ds.turnsLeft}🔥` : '😈 Forma Demoníaca';
        html += `<button class="${btnCls}" onclick="toggleDemonicForm('Vel')">${label}</button>`;
        if (ds.active) {
            html += `<button class="btn-demonic-turn" onclick="advanceDemonicTurn('Vel')">⏭️ Siguiente turno</button>`;
        }
    }
    section.innerHTML = html;
}

function toggleDemonicForm(charId) {
    if (!demonicFormState[charId]) demonicFormState[charId] = { active: false, turnsLeft: 0 };
    const ds = demonicFormState[charId];
    ds.active = !ds.active;
    ds.turnsLeft = ds.active ? 6 : 0;
    updateDemonicFormDisplay(charId);
    saveStateToStorage();
    showNotification(ds.active ? '😈 ¡Forma Demoníaca activa!' : '💔 Forma Demoníaca terminada', 2200);
}

function advanceDemonicTurn(charId) {
    const ds = demonicFormState[charId];
    if (!ds?.active) return;
    ds.turnsLeft = Math.max(0, ds.turnsLeft - 1);
    if (ds.turnsLeft === 0) {
        ds.active = false;
        showNotification('💀 Forma Demoníaca terminada', 2500);
    }
    updateDemonicFormDisplay(charId);
    saveStateToStorage();
}

function updateDemonicFormDisplay(charId) {
    const ds  = demonicFormState[charId] || { active: false };
    const data = window.characterData[charId];
    if (!data) return;

    // Update CA pill
    const pillCA = document.getElementById('pillCA');
    if (pillCA) {
        const v = pillCA.querySelector('.pill-value');
        if (v) v.textContent = ds.active ? String(parseInt(data.resumen.CA) + 2) : data.resumen.CA;
        pillCA.classList.toggle('demonic-active', ds.active);
        pillCA.style.borderLeftColor = ds.active ? '#ff2222' : '#4488ff';
    }
    // Update Speed pill
    const pillSpeed = document.getElementById('pillSpeed');
    if (pillSpeed) {
        const v = pillSpeed.querySelector('.pill-value');
        if (v) v.textContent = ds.active ? '50ft' : data.resumen.Velocidad;
        pillSpeed.classList.toggle('demonic-active', ds.active);
        pillSpeed.style.borderLeftColor = ds.active ? '#ff2222' : '#ffcc44';
    }
    // Re-render button section
    renderDemonicSection(charId);
}
function renderCharacterSheet(charId) {
    if (!window.characterData || !window.characterData[charId]) {
        console.error('Data not found for character:', charId);
        showNotification('Datos de personaje no encontrados', 3000);
        return;
    }

    currentCharacterId = charId;
    const data = window.characterData[charId];

    // Sidebar: Portrait + Stats (Enhanced)
    const statsContainer = document.getElementById('sheetStats');
    statsContainer.innerHTML = '';

    // Portrait 
    const imgUrl = data.imagen || 'assets/imagenes/placeholder.jpg';
    const imgScale = data.imagenScale || 1;
    let portraitHTML = `
        <div class="sheet-portrait-container">
            <img id="portraitImg" src="${imgUrl}" class="sheet-portrait-img" style="transform: scale(${imgScale})" onerror="this.src='https://placehold.co/400x500/1e2536/d4af37?text=Sin+Imagen'">
            ${isCharacterEditing ? `
                <div class="portrait-edit-overlay">
                    <input class="sheet-input" id="editImage" value="${data.imagen || ''}" placeholder="URL Imagen...">
                    <input type="range" id="editImageScale" min="1.0" max="3.0" step="0.1" value="${imgScale}">
                </div>` : ''}
        </div>
    `;
    statsContainer.innerHTML += portraitHTML;

    // Attributes with Skills and Saves
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stat-grid';

    for (const [stat, value] of Object.entries(data.stats)) {
        const mod = getModifier(value);
        const signedMod = mod >= 0 ? `+${mod}` : mod;

        let statHTML = `
            <div class="stat-box">
                <div class="stat-details">
                    <span class="stat-label">${stat}</span>
                    ${isCharacterEditing
                ? `<input type="number" class="sheet-input" value="${value}" data-stat="${stat}">`
                : `<span class="stat-value">${value}</span>`}
                </div>
                <div class="stat-mod">${signedMod}</div>
                
                <div class="stat-sublist">
                    <div class="sub-item ${data.competencias_salvacion?.includes(stat) ? 'proficient' : ''}">
                        <span>Salvación</span>
                        <span>${data.competencias_salvacion?.includes(stat) ? `+${mod + (data.resumen.Competencia || 2)}` : signedMod}</span>
                    </div>
                    ${(skillMapping[stat] || []).map(skill => {
                    const isProf = data.habilidades?.includes(skill);
                    const bonus = isProf ? mod + parseInt(data.resumen.Competencia || 2) : mod;
                    return `
                        <div class="sub-item ${isProf ? 'proficient' : ''}">
                            <span>${skill}</span>
                            <span>${bonus >= 0 ? '+' : ''}${bonus}</span>
                            ${isProf ? '<div class="prof-dot"></div>' : ''}
                        </div>`;
                }).join('')}
                </div>
            </div>
        `;
        statsGrid.innerHTML += statHTML;
    }
    statsContainer.appendChild(statsGrid);


    // Header
    if (isCharacterEditing) {
        document.getElementById('sheetName').innerHTML = `<input class="sheet-input" value="${data.nombre}" id="editName">`;
        document.getElementById('sheetRace').innerHTML = `<input class="sheet-input" value="${data.raza}" id="editRace" style="width:120px">`;
        document.getElementById('sheetClass').innerHTML = `<input class="sheet-input" value="${data.clase}" id="editClass" style="width:140px">`;
        document.getElementById('sheetLevel').innerHTML = `<input type="number" class="sheet-input" value="${data.nivel}" id="editLevel" style="width:60px">`;
    } else {
        document.getElementById('sheetName').textContent = data.nombre;
        document.getElementById('sheetRace').textContent = data.raza;
        document.getElementById('sheetClass').textContent = data.clase;
        document.getElementById('sheetLevel').textContent = data.nivel;
    }

    // HP Bar (replaces HP pill)
    const combatVitals = document.getElementById('sheetCombatVitals');
    combatVitals.innerHTML = renderHpSection(charId) + `
        <div class="combat-pill" id="pillCA" style="border-left-color: #4488ff">
            <span class="pill-icon">🛡️</span>
            <div>
                <div class="pill-label">CA</div>
                <div class="pill-value">${data.resumen.CA}</div>
            </div>
        </div>
        <div class="combat-pill" style="border-left-color: #44ff88">
            <span class="pill-icon">⚡</span>
            <div>
                <div class="pill-label">Iniciativa</div>
                <div class="pill-value">${data.resumen.Iniciativa}</div>
            </div>
        </div>
        <div class="combat-pill" id="pillSpeed" style="border-left-color: #ffcc44">
            <span class="pill-icon">🏃</span>
            <div>
                <div class="pill-label">Velocidad</div>
                <div class="pill-value">${data.resumen.Velocidad}</div>
            </div>
        </div>
        <div class="combat-pill" style="border-left-color: #aa88ff">
            <span class="pill-icon">⚔️</span>
            <div>
                <div class="pill-label">Competencia</div>
                <div class="pill-value">${data.resumen.Competencia || '+2'}</div>
            </div>
        </div>
    `;

    // Combat Planner (inline on desktop, in tab on mobile)
    renderCombatInline(data);

    // Conditions bar + character-specific buttons
    const resourcesSection = document.getElementById('sheetResources');
    resourcesSection.style.display = 'flex';
    renderDemonicSection(charId);

    // Restore demonic form visual state if active
    if (charId === 'Vel' && demonicFormState[charId]?.active) {
        updateDemonicFormDisplay(charId);
    }

    // Tab Navigation Management
    updateTabs(data);

    // Features Tab
    let featuresHTML = '<h3 class="feature-section-title">Rasgos de Clase y Raza</h3><div class="feature-grid">';

    // Skills
    if (isCharacterEditing) {
        featuresHTML += `
            <div class="feature-item" style="grid-column: 1/-1">
                <h3>Competencias (Habilidades)</h3>
                <input class="sheet-input" value="${data.habilidades.join(', ')}" id="editSkills">
                <small style="color:var(--text-secondary)">Separar por comas</small>
            </div>
        `;
    } else {
        featuresHTML += `
            <div class="feature-item">
                <h3>Competencias</h3>
                <div class="item-desc"><strong>Habilidades:</strong> ${data.habilidades.join(', ')}</div>
            </div>
        `;
    }

    // Traits
    data.rasgos.forEach((feat, index) => {
        if (isCharacterEditing) {
            featuresHTML += `
                <div class="feature-item">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                        <input class="sheet-input" value="${feat.nombre}" onchange="updateFeature(${index}, 'nombre', this.value)" style="font-weight:bold; color:var(--accent-gold)">
                        <button class="btn-delete-item" onclick="deleteFeature(${index})">×</button>
                    </div>
                    <textarea class="sheet-textarea" onchange="updateFeature(${index}, 'desc', this.value)">${feat.desc}</textarea>
                </div>
            `;
        } else {
            featuresHTML += `
                <div class="feature-item">
                    <h3>${feat.nombre}</h3>
                    <div class="item-desc">${feat.desc}</div>
                </div>
            `;
        }
    });

    if (isCharacterEditing) {
        featuresHTML += `<button class="btn-add-item" onclick="addFeature()">+ Añadir Rasgo</button>`;
    }
    featuresHTML += '</div>';
    document.getElementById('tabFeatures').innerHTML = featuresHTML;

    // Spells Tab - use rich filter view when not editing
    if (isCharacterEditing) {
        let spellsHTML = '<div class="feature-grid">';
        if (data.conjuros && data.conjuros.length > 0) {
            data.conjuros.forEach((spell, index) => {
                spellsHTML += `
                    <div class="spell-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                            <input class="sheet-input" value="${spell.nombre}" onchange="updateSpell(${index}, 'nombre', this.value)" style="font-weight:bold; color:var(--accent-gold)">
                            <button class="btn-delete-item" onclick="deleteSpell(${index})">×</button>
                        </div>
                        <input class="sheet-input" value="${spell.nivel}" onchange="updateSpell(${index}, 'nivel', this.value)" style="margin-bottom:5px; width:100px" placeholder="Nivel">
                        <textarea class="sheet-textarea" onchange="updateSpell(${index}, 'desc', this.value)">${spell.desc}</textarea>
                    </div>
                `;
            });
        }
        spellsHTML += `<button class="btn-add-item" onclick="addSpell()">+ Añadir Conjuro</button></div>`;
        document.getElementById('tabSpells').innerHTML = spellsHTML;
    } else {
        renderSpellsWithFilters(data); // includes level filters + search
    }

    // Inventory Tab - use categorized view when not editing
    if (isCharacterEditing) {
        let inventoryHTML = '<div class="feature-grid">';
        if (data.inventario && data.inventario.length > 0) {
            data.inventario.forEach((item, index) => {
                inventoryHTML += `
                    <div class="feature-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                            <input class="sheet-input" value="${item.nombre}" onchange="updateInventoryItem(${index}, 'nombre', this.value)" style="font-weight:bold; color:var(--accent-gold)">
                            <button class="btn-delete-item" onclick="deleteInventoryItem(${index})">×</button>
                        </div>
                        <textarea class="sheet-textarea" onchange="updateInventoryItem(${index}, 'desc', this.value)">${item.desc}</textarea>
                    </div>
                `;
            });
        } else {
            inventoryHTML += '<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px">El inventario está vacío.</div>';
        }
        inventoryHTML += `<button class="btn-add-item" onclick="addInventoryItem()">+ Añadir Objeto</button></div>`;
        document.getElementById('tabInventory').innerHTML = inventoryHTML;
    } else {
        renderCategorizedInventory(data, ''); // includes search + categories
    }

    // Notes tab
    const tabNotes = document.getElementById('tabNotes');
    if (tabNotes) {
        const savedNote = notesState[charId] || '';
        tabNotes.innerHTML = `
            <div class="notes-container">
                <h3 class="section-label">📝 Notas de Sesión</h3>
                <textarea class="notes-textarea" id="sessionNotesArea"
                    placeholder="Apuntes de la sesión, objetivos, cosas importantes..."
                    oninput="saveNote('${charId}', this.value)">${savedNote}</textarea>
                <div class="notes-hint">Guardado automáticamente</div>
            </div>`;
    }

    // Reset Tabs — combat is default on mobile (inline on desktop), features on desktop
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const isMobile = window.innerWidth <= 768;
    const defaultTabKey = isMobile ? 'combat' : 'features';
    const defaultBtn = document.querySelector(`.tab-btn[data-tab="${defaultTabKey}"]`);
    const defaultId = 'tab' + defaultTabKey.charAt(0).toUpperCase() + defaultTabKey.slice(1);
    if (defaultBtn) defaultBtn.classList.add('active');
    const defaultContent = document.getElementById(defaultId);
    if (defaultContent) defaultContent.classList.add('active');

    // Show Container + dice roller
    document.getElementById('characterSheetContainer').style.display = 'flex';
    const diceWidget = document.getElementById('diceRollerWidget');
    if (diceWidget) diceWidget.style.display = 'flex';

    // Update HUD breadcrumbs based on navigation context
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'flex';
    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.style.display = 'flex';
    const breadcrumbs = document.getElementById('breadcrumbs');
    if (breadcrumbs) {
        const shortName = data.nombre.split(' ')[0];
        if (combatModeActive) {
            breadcrumbs.textContent = `⚔️ Combate › Jugador › ${shortName}`;
        } else {
            breadcrumbs.textContent = shortName;
        }
    }
}

// === Edit Actions ===
function toggleCharacterEditMode() {
    isCharacterEditing = !isCharacterEditing;
    renderCharacterSheet(currentCharacterId);
}

function saveCharacterChanges() {
    const char = window.characterData[currentCharacterId];

    // Portrait
    const imageInput = document.getElementById('editImage');
    if (imageInput) char.imagen = imageInput.value;

    const scaleInput = document.getElementById('editImageScale');
    if (scaleInput) char.imagenScale = parseFloat(scaleInput.value);

    // Header
    const nameInput = document.getElementById('editName');
    if (nameInput) char.nombre = nameInput.value;

    const raceInput = document.getElementById('editRace');
    if (raceInput) char.raza = raceInput.value;

    const classInput = document.getElementById('editClass');
    if (classInput) char.clase = classInput.value;

    const levelInput = document.getElementById('editLevel');
    if (levelInput) char.nivel = parseInt(levelInput.value) || 1;

    // Stats
    document.querySelectorAll('[data-stat]').forEach(input => {
        char.stats[input.dataset.stat] = parseInt(input.value) || 10;
    });

    // Vitals
    document.querySelectorAll('[data-vital]').forEach(input => {
        char.resumen[input.dataset.vital] = input.value;
    });

    // Inventory is updated in real-time via updateInventoryItem, no need to gather here 
    // unless we change the strategy, but for consistency with traits/spells:
    // traits/spells are also updated in real-time.

    // Skills
    const skillsInput = document.getElementById('editSkills');
    if (skillsInput) {
        char.habilidades = skillsInput.value.split(',').map(s => s.trim()).filter(s => s);
    }

    isCharacterEditing = false;
    renderCharacterSheet(currentCharacterId);
    showNotification('Cambios guardados. ¡Recuerda EXPORTAR para no perderlos!', 4000);
    renderCharacterSelectionMenu();
}

function updateFeature(index, field, value) {
    if (window.characterData[currentCharacterId].rasgos[index])
        window.characterData[currentCharacterId].rasgos[index][field] = value;
}

function deleteFeature(index) {
    if (confirm('¿Borrar rasgo?')) {
        window.characterData[currentCharacterId].rasgos.splice(index, 1);
        renderCharacterSheet(currentCharacterId);
    }
}

function addFeature() {
    window.characterData[currentCharacterId].rasgos.push({ nombre: 'Nuevo Rasgo', desc: 'Descripción' });
    renderCharacterSheet(currentCharacterId);
}

function updateSpell(index, field, value) {
    if (window.characterData[currentCharacterId].conjuros[index])
        window.characterData[currentCharacterId].conjuros[index][field] = value;
}

function deleteSpell(index) {
    if (confirm('¿Borrar conjuro?')) {
        window.characterData[currentCharacterId].conjuros.splice(index, 1);
        renderCharacterSheet(currentCharacterId);
    }
}

function addSpell() {
    if (!window.characterData[currentCharacterId].conjuros) window.characterData[currentCharacterId].conjuros = [];
    window.characterData[currentCharacterId].conjuros.push({ nombre: 'Nuevo Conjuro', nivel: '1', desc: 'Descripción' });
    renderCharacterSheet(currentCharacterId);
}

// === Inventory Actions ===
function updateInventoryItem(index, field, value) {
    if (window.characterData[currentCharacterId].inventario[index])
        window.characterData[currentCharacterId].inventario[index][field] = value;
}

function deleteInventoryItem(index) {
    if (confirm('¿Borrar objeto del inventario?')) {
        window.characterData[currentCharacterId].inventario.splice(index, 1);
        renderCharacterSheet(currentCharacterId);
    }
}

function addInventoryItem() {
    if (!window.characterData[currentCharacterId].inventario) window.characterData[currentCharacterId].inventario = [];
    window.characterData[currentCharacterId].inventario.push({ nombre: 'Nuevo Objeto', desc: 'Descripción' });
    renderCharacterSheet(currentCharacterId);
}

function exportCharacters() {
    const dataStr = "window.characterData = " + JSON.stringify(window.characterData, null, 4) + ";";
    const blob = new Blob([dataStr], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'characters.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Archivo characters.js descargado. Guárdalo en la carpeta del proyecto.', 5000);
}

function setupCharacterSheetListeners() {
    // Buttons
    const editBtn = document.getElementById('editCharBtn');
    if (editBtn) editBtn.addEventListener('click', toggleCharacterEditMode);

    const saveBtn = document.getElementById('saveCharBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveCharacterChanges);

    const exportBtn = document.getElementById('exportCharBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportCharacters);

    // Close Button
    document.getElementById('closeSheetBtn').addEventListener('click', () => {
        document.getElementById('characterSheetContainer').style.display = 'none';
        isCharacterEditing = false;
        const diceWidget = document.getElementById('diceRollerWidget');
        // Combat mode no longer opens character sheets, so just go to characters view
        if (state.currentView === 'landing') {
            if (diceWidget) diceWidget.style.display = 'none';
        }
    });

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            const targetId = `tab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`;

            // Toggle Buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Toggle Content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(targetId);
            if (content) content.classList.add('active');
        });
    });

    // Character Card Click Handlers
    Object.keys(window.characterData).forEach(id => {
        const card = document.getElementById(`charCard${id}`);
        if (card) {
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);

            newCard.addEventListener('click', () => {
                isCharacterEditing = false;
                renderCharacterSheet(id);
            });
        }
    });
}
function renderCharacterSelectionMenu() {
    const container = document.getElementById('characterListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!window.characterData) return;

    Object.values(window.characterData).filter(char => char.tipo === 'jugador').forEach(char => {
        const card = document.createElement('div');
        card.className = 'card character-card'; // Added class for specific styling
        card.onclick = () => {
            isCharacterEditing = false;
            renderCharacterSheet(char.id);
        };

        const imgUrl = char.imagen || 'assets/imagenes/placeholder.jpg';

        // Custom styling for image card
        card.innerHTML = `
            <div class="card-img-wrapper" style="width: 72px; height: 72px; border-radius: 50%; overflow: hidden; border: 2px solid var(--accent-gold); margin-bottom: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.5); flex-shrink: 0;">
                <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; object-position: top center;" onerror="this.src='https://placehold.co/100x100/1e2536/d4af37?text=?'">
            </div>
            <div class="card-title">${char.nombre}</div>
            <div class="char-card-meta">${char.raza} · ${char.clase}</div>
        `;
        container.appendChild(card);
    });
}

// ============================================
// Combat Mode Navigation
// ============================================
function showCombatSetup() {
    combatModeActive = true;
    if (!isMaster()) {
        showPlayerCombat();
        return;
    }
    setupNpcs = [];
    setupInitiatives = {};
    combatState.selectedIds = [];
    setView('combatSetup');
    switchCombatSetupTab('jugadores');
    renderCombatSetup();
}

// Jugador personal turn manager — completely independent from master
function showPlayerCombat() {
    const myId = gameRole.characterId;
    const cd = window.characterData?.[myId];
    if (!cd) { showNotification('Personaje no encontrado', 2000); return; }

    const maxHp = parseInt(cd.resumen?.HP) || 10;
    combatState.participants = [{
        id: myId,
        name: cd.nombre,
        tipo: cd.tipo || 'jugador',
        initiative: 0,
        hp: { current: maxHp, max: maxHp },
        ac: cd.resumen?.CA || '10',
        baseAc: cd.resumen?.CA || '10',
        speed: cd.resumen?.Velocidad || '30ft',
        baseSpeed: cd.resumen?.Velocidad || '30ft',
        conditions: [],
        note: '',
        charData: cd,
        customActions: [],
        demonicForm: false,
    }];
    combatState.currentIndex = 0;
    combatState.round = 1;
    combatState.isActive = true;
    combatState.segundaAccionTurn = false;
    combatState.log = [];
    combatState.nextLogId = 1;
    createCurrentTurnEntry();
    setView('combatManager');
    renderCombatManager();
}

function showCombatMode() {
    // Keep alias for landing card listener
    showCombatSetup();
}

function goToCombatInitiative() {
    if (combatState.selectedIds.length < 2) {
        showNotification('Selecciona al menos 2 participantes', 2500);
        return;
    }
    // Build participant list from selectedIds
    combatState.participants = combatState.selectedIds.map(id => {
        const char = window.characterData[id];
        const maxHp = parseInt(char.resumen?.HP) || 10;
        return {
            id,
            name: char.nombre,
            initiative: null,
            hp: { current: maxHp, max: maxHp },
            ac: char.resumen?.CA || '10',
            baseAc: char.resumen?.CA || '10',
            speed: char.resumen?.Velocidad || '30ft',
            baseSpeed: char.resumen?.Velocidad || '30ft',
            conditions: [],
            note: '',
            charData: char,
            demonicForm: false,
            tipo: char.tipo || 'jugador',
            customActions: [],
        };
    });
    setView('combatInit');
    renderCombatInitiative();
}

function beginCombat() {
    const missing = combatState.participants.filter(p => p.initiative === null);
    if (missing.length > 0) {
        showNotification(`Faltan iniciativas: ${missing.map(p => p.name.split(' ')[0]).join(', ')}`, 3000);
        return;
    }
    // Sort descending by initiative
    combatState.participants.sort((a, b) => b.initiative - a.initiative);
    combatState.currentIndex = 0;
    combatState.round = 1;
    combatState.isActive = true;
    combatState.log = [];
    combatState.nextLogId = 0;
    createCurrentTurnEntry();
    saveCombatState();
    setView('combatManager');
    renderCombatManager();
    if (isMaster()) startCombatSession(); // create combat in DB + get share link
}

function parseSetupActions(str, tipo) {
    if (!str?.trim()) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
        // Format: "Name +hit/dado" | "Name +hit" | "Name 1d6+2" | "Name"
        const m1 = s.match(/^(.+?)\s+([+-]\d+)(?:\/(\S+))?$/);
        if (m1) return { nombre: m1[1].trim(), tipo, atk: m1[2], dado: m1[3] || '', desc: '' };
        const m2 = s.match(/^(.+?)\s+(\d+d\d+\S*)$/);
        if (m2) return { nombre: m2[1].trim(), tipo, atk: '', dado: m2[2], desc: '' };
        return { nombre: s.trim(), tipo, atk: '', dado: '', desc: '' };
    });
}

function beginCombatFromSetup() {
    const total = combatState.selectedIds.length + setupNpcs.length;
    if (total < 1) {
        showNotification('Selecciona o añade al menos 1 participante', 2500);
        return;
    }

    // Validate: selected jugadores/aliados/enemigos need initiatives
    const missingInit = combatState.selectedIds.filter(id => {
        const val = setupInitiatives[id];
        return val === null || val === undefined || isNaN(val);
    });
    if (missingInit.length > 0) {
        const names = missingInit.map(id => window.characterData[id]?.nombre || id).join(', ');
        showNotification(`⚠️ Falta iniciativa para: ${names}`, 3000);
        return;
    }

    // Build participants from selected existing characters
    const participants = combatState.selectedIds.map(id => {
        const char = window.characterData[id];
        const maxHp = parseInt(char.resumen?.HP) || 10;
        return {
            id,
            name: char.nombre,
            initiative: setupInitiatives[id] || 0,
            hp: { current: maxHp, max: maxHp },
            ac: char.resumen?.CA || '10',
            baseAc: char.resumen?.CA || '10',
            speed: char.resumen?.Velocidad || '30ft',
            baseSpeed: char.resumen?.Velocidad || '30ft',
            conditions: [],
            note: '',
            charData: char,
            demonicForm: false,
            tipo: char.tipo || 'jugador',
            customActions: [],
        };
    });

    // Add setup NPCs
    setupNpcs.forEach(npc => {
        const uid = `setup_${npc.tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const combateExtra = [
            ...parseSetupActions(npc.acciones    || '', 'accion'),
            ...parseSetupActions(npc.adicionales || '', 'adicional'),
            ...parseSetupActions(npc.reacciones  || '', 'reaccion'),
        ];
        const charData = {
            id: uid, tipo: npc.tipo, nombre: npc.nombre,
            clase: npc.tipo === 'aliado' ? 'Aliado' : 'Enemigo',
            nivel: '—', imagen: '',
            resumen: { HP: String(npc.pg), CA: String(npc.ca), Velocidad: '30ft' },
            combateExtra, conjuros: [],
        };
        window.characterData[uid] = charData;
        participants.push({
            id: uid, name: npc.nombre,
            initiative: npc.initiative,
            hp: { current: npc.pg, max: npc.pg },
            ac: String(npc.ca), baseAc: String(npc.ca),
            speed: '30ft', baseSpeed: '30ft',
            conditions: [], note: '', charData,
            demonicForm: false, tipo: npc.tipo, customActions: [],
        });
    });

    // Sort by initiative descending
    participants.sort((a, b) => b.initiative - a.initiative);

    // Start combat
    Object.assign(combatState, {
        participants,
        selectedIds: [],
        currentIndex: 0,
        round: 1,
        isActive: true,
        log: [],
        nextLogId: 0,
        segundaAccionTurn: false,
    });

    // Clear setup state
    setupNpcs = [];
    setupInitiatives = {};

    createCurrentTurnEntry();
    saveCombatState();
    setView('combatManager');
    renderCombatManager();
}

function confirmEndCombat() {
    showCombatSummary();
}

function _doClearCombat() {
    document.getElementById('combatSummaryOverlay')?.remove();
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

    const overlay = document.createElement('div');
    overlay.id = 'combatSummaryOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.innerHTML = `
        <div class="combat-summary-modal">
            <div class="combat-summary-title">⚔️ Resumen del Combate</div>
            <div style="text-align:center;color:var(--text-muted);font-size:13px;margin-bottom:8px">
                ${combatState.round} ronda(s) · ${combatState.participants.length} participantes
            </div>
            <div class="combat-summary-body">${bodyHTML || '<div style="color:var(--text-muted);font-style:italic">Sin historial registrado</div>'}</div>
            <div class="combat-summary-btns">
                <button class="btn-combat-secondary" onclick="copyHistoryToClipboard()">📋 Copiar</button>
                <button class="btn-combat-primary" onclick="_doClearCombat()">✕ Finalizar</button>
                <button class="btn-combat-secondary" onclick="document.getElementById('combatSummaryOverlay')?.remove()">Volver</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

// ---- Setup Screen ----
const COMBAT_CATEGORIES = [
    { tipo: 'jugador', icon: '🗡️', label: 'Jugadores Principales', color: 'var(--accent-gold)' },
    { tipo: 'aliado',  icon: '🤝', label: 'Aliados y NPCs',         color: '#4488ff'            },
    { tipo: 'enemigo', icon: '💀', label: 'Enemigos',                color: '#cc3333'            },
];

function renderCombatSelectCard(char) {
    // Legacy card (still used in some paths) — delegates to new version
    return renderCombatSetupCard(char);
}

function renderCombatSetupCard(char) {
    const isSelected = combatState.selectedIds.includes(char.id);
    const initVal = setupInitiatives[char.id] ?? '';
    return `<div class="combat-select-card setup-char-card${isSelected ? ' selected' : ''}"
                 onclick="toggleCombatParticipant('${char.id}')">
        <div class="combat-select-portrait">
            <img src="${char.imagen || ''}" onerror="this.style.display='none'">
        </div>
        <div class="combat-select-info">
            <div class="combat-select-name">${char.nombre}</div>
            <div class="combat-select-meta">${char.clase || ''} · Nv ${char.nivel || '?'}</div>
            <div class="combat-select-vitals">❤️ ${char.resumen?.HP || '?'} · 🛡️ ${char.resumen?.CA || '?'}</div>
        </div>
        <div class="setup-card-right" onclick="event.stopPropagation()">
            <div class="combat-select-check">${isSelected ? '✓' : ''}</div>
            <div class="setup-init-wrap">
                <label class="setup-init-label">Init</label>
                <input type="number" class="setup-init-input"
                       placeholder="—" min="-5" max="30"
                       value="${initVal}"
                       oninput="setSetupJugadorInitiative('${char.id}', this.value)">
            </div>
        </div>
    </div>`;
}

function renderCombatSetup() {
    if (!window.characterData) return;
    const chars = Object.values(window.characterData);

    // --- Jugadores tab ---
    const grid = document.getElementById('combatParticipantGrid');
    if (grid) {
        const jugadores = chars.filter(c => c.tipo === 'jugador');
        grid.innerHTML = jugadores.length
            ? jugadores.map(renderCombatSetupCard).join('')
            : `<div class="combat-category-empty">No hay jugadores disponibles</div>`;
    }

    // --- Existing aliados / enemigos in their tabs ---
    const aliadoGrid = document.getElementById('aliadoExistingGrid');
    if (aliadoGrid) {
        const aliados = chars.filter(c => c.tipo === 'aliado');
        aliadoGrid.style.display = aliados.length ? 'flex' : 'none';
        aliadoGrid.innerHTML = aliados.length
            ? `<div class="npc-existing-label">📋 Personajes existentes</div>` +
              aliados.map(renderCombatSetupCard).join('')
            : '';
    }
    const enemigoGrid = document.getElementById('enemigoExistingGrid');
    if (enemigoGrid) {
        const enemigos = chars.filter(c => c.tipo === 'enemigo');
        enemigoGrid.style.display = enemigos.length ? 'flex' : 'none';
        enemigoGrid.innerHTML = enemigos.length
            ? `<div class="npc-existing-label">📋 Personajes existentes</div>` +
              enemigos.map(renderCombatSetupCard).join('')
            : '';
    }

    _updateSetupCount();
}

function toggleCombatParticipant(charId) {
    const idx = combatState.selectedIds.indexOf(charId);
    if (idx >= 0) combatState.selectedIds.splice(idx, 1);
    else combatState.selectedIds.push(charId);
    renderCombatSetup();
}

function setSetupJugadorInitiative(charId, value) {
    setupInitiatives[charId] = value === '' ? null : parseInt(value);
}

function switchCombatSetupTab(tabName) {
    document.querySelectorAll('.combat-setup-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.setupTab === tabName);
    });
    const panels = {
        jugadores: document.getElementById('setupTabJugadores'),
        aliados:   document.getElementById('setupTabAliados'),
        enemigos:  document.getElementById('setupTabEnemigos'),
    };
    Object.entries(panels).forEach(([key, el]) => {
        if (el) el.style.display = key === tabName ? 'block' : 'none';
    });
}

function _updateSetupCount() {
    const total = combatState.selectedIds.length + setupNpcs.length;
    const el = document.getElementById('combatSetupCount');
    if (el) el.textContent = `${total} participante${total !== 1 ? 's' : ''}`;
}

// ---- Initiative Screen ----
function renderCombatInitiative() {
    const list = document.getElementById('combatInitList');
    if (!list) return;
    list.innerHTML = combatState.participants.map(p => `
        <div class="combat-init-row">
            <div class="combat-init-portrait">
                <img src="${p.charData?.imagen || ''}" onerror="this.style.display='none'">
            </div>
            <div class="combat-init-info">
                <div class="combat-init-name">${p.name}</div>
                <div class="combat-init-stats">❤️ ${p.hp.max} · 🛡️ ${p.ac}</div>
            </div>
            <div class="combat-init-input-wrap">
                <label>Iniciativa</label>
                <input type="number" class="combat-init-input"
                       placeholder="—" min="-5" max="30"
                       value="${p.initiative !== null ? p.initiative : ''}"
                       oninput="setParticipantInitiative('${p.id}', this.value)">
            </div>
        </div>
    `).join('');
}

function setParticipantInitiative(id, value) {
    const p = combatState.participants.find(x => x.id === id);
    if (p) p.initiative = value === '' ? null : parseInt(value);
}

// ---- Combat Manager ----
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
    renderCombatShareLink();
    renderTurnQueue();
    renderActivePanel();
    renderCombatLog();
}

// ---- Player Combat Layout (role=jugador) — fully independent turn manager ----
function _renderPlayerCombatLayout(view) {
    if (!view) view = document.getElementById('playerCombatView');
    if (!view) return;

    const masterLayout = document.getElementById('combatMasterLayout');
    if (masterLayout) masterLayout.style.display = 'none';

    view.style.display = 'flex';

    const p = combatState.participants[0];
    if (!p) return;

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

    renderActivePanel(document.getElementById('playerCombatPanel'), 0);
}

function renderTurnQueue() {
    const queue = document.getElementById('combatTurnQueue');
    if (!queue) return;
    queue.innerHTML = combatState.participants.map((p, i) => {
        const isCurrent = i === combatState.currentIndex;
        const isDead = p.hp.current <= 0;
        const hpPct = p.hp.max > 0 ? Math.max(0, (p.hp.current / p.hp.max) * 100) : 0;
        const hpColor = hpPct <= 0 ? '#555' : hpPct <= 25 ? '#ff4444' : hpPct <= 50 ? '#ffaa00' : '#4caf50';
        const tipoClass = p.tipo || 'jugador';
        const cls = ['turn-queue-item', isCurrent ? 'active' : '', isDead ? 'dead' : '', p.demonicForm ? 'demonic' : '', tipoClass].filter(Boolean).join(' ');
        const condIcons = p.conditions.length
            ? `<div class="tqi-conditions">${p.conditions.map(cId => {
                  const c = CONDITIONS.find(x => x.id === cId);
                  return c ? `<span title="${c.title}">${c.label}</span>` : '';
              }).join('')}</div>`
            : '';
        const isCurrentParticipant = isCurrent;
        const showHp = !(!isMaster() && (p.tipo === 'enemigo'));
        return `<div class="${cls}">
            <div class="tqi-init">${p.initiative}</div>
            <div class="tqi-name">${p.name.split(' ')[0]}</div>
            <div class="tqi-hp-bar"><div class="tqi-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
            <div class="tqi-hp-text">${showHp ? `${p.hp.current}/${p.hp.max}` : '? / ?'}</div>
            ${condIcons}
            ${isCurrentParticipant && combatState.extraAttackTurn ? '<div class="tqi-extra-badge">+ATQ</div>' : ''}
            ${isCurrentParticipant && combatState.segundaAccionTurn ? '<div class="tqi-extra-badge">+2ª</div>' : ''}
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
            <button class="btn-combat-secondary waiting-pass-btn" onclick="nextCombatTurn()">⏭ Pasar turno</button>
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
        // Feature 4: weapon-only filter (actions with atk field, no spells)
        const weaponItems = allItems.filter(a =>
            inferActionType(a) === 'accion' && a.atk && a.atk !== '—' && a.atk !== ''
        );
        slotSections = `<div class="combat-slot-section">
            <div class="combat-slot-header"><span>⚔️ Ataque Extra (solo armas)</span></div>
            ${weaponItems.length ? `<div class="combat-chips">${renderChips(weaponItems)}</div>` : `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin ataques disponibles</div>`}
        </div>`;
    } else if (isSegundaAccion) {
        const accionItems = allItems.filter(a => inferActionType(a) === 'accion');
        slotSections = `<div class="combat-slot-section">
            <div class="combat-slot-header"><span>⚔️ Acción (Segunda Acción)</span></div>
            ${accionItems.length ? `<div class="combat-chips">${renderChips(accionItems)}</div>` : `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin acciones disponibles</div>`}
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
        const chipSections = SLOTS.map(slot => {
            const items = allItems.filter(a => inferActionType(a) === slot.tipo);
            if (!items.length) return '';
            return `<div class="combat-slot-section">
                <div class="combat-slot-header"><span>${slot.icon} ${slot.label}</span></div>
                <div class="combat-chips">${renderChips(items)}</div>
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
        <div class="combat-actions-chips-section">${chipSections}</div>`;
    } else {
        slotSections = SLOTS.map(slot => {
            const isSlotUsed = (currentEntry?.slots?.[slot.key]) ||
                currentEntry?.actions.some(a => inferActionType(a) === slot.tipo) || false;
            const items = allItems.filter(a => inferActionType(a) === slot.tipo);
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
        }).join('');
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
                    <span id="activeHpDisplay">${p.hp.current}</span>
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

// ---- Log Functions ----
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

function toggleCombatAction(participantId, nombre, dice) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    if (!entry.slots) entry.slots = { accion: false, extraAtaque: false, adicional: false, reaccion: false };
    const idx = entry.actions.findIndex(a => a.nombre === nombre);
    if (idx >= 0) {
        entry.actions.splice(idx, 1);
    } else {
        entry.actions.push({ nombre, dice: dice || '' });
        // Determine action type to mark slot
        const p = combatState.participants.find(x => x.id === participantId);
        if (p?.charData) {
            const allItems = [...(p.charData.combateExtra || []), ...(p.charData.conjuros || [])];
            const actionObj = allItems.find(a => a.nombre === nombre);
            if (actionObj) {
                const tipo = inferActionType(actionObj);
                if (tipo === 'adicional') entry.slots.adicional = true;
                else if (tipo === 'reaccion') entry.slots.reaccion = true;
                else entry.slots.accion = true;
            }
        }
    }
    saveCombatState();
    renderActivePanel();
    renderCombatLog();
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
                target.hp.current = Math.max(0, target.hp.current - damage);
                if (prevHp > target.hp.current && target.conditions.includes('concentracion')) {
                    const cd = Math.max(10, Math.floor(damage / 2));
                    showNotification(`🧠 ${target.name.split(' ')[0]}: Concentración CD ${cd}`, 3500);
                }
                log.push(`${target.name.split(' ')[0]} −${damage} PG`);
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
    } else {
        entry.slots[planKey] = { nombre, atk: atk || '', dado: dado || '', tipo_dano: tipoDano || '' };
        if (!entry.actions.some(a => a.nombre === nombre))
            entry.actions.push({ nombre, dice: atk ? `${atk}${dado ? '/' + dado : ''}` : dado });
    }
    saveCombatState();
    renderActivePanel(document.getElementById('playerCombatPanel'), 0);
    renderCombatLog();
}

function removePlannerSlot(participantId, slotKey) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    const plan = entry.slots?.[slotKey + '_plan'];
    if (plan) {
        entry.actions = entry.actions.filter(a => a.nombre !== plan.nombre);
        entry.slots[slotKey + '_plan'] = null;
    }
    saveCombatState();
    renderActivePanel(document.getElementById('playerCombatPanel'), 0);
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

// ---- HP + Conditions + Turn Advance ----
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
    // Lightweight DOM update — don't rebuild panel (would kill slider focus)
    const hpDisplay = document.getElementById('activeHpDisplay');
    if (hpDisplay) hpDisplay.textContent = p.hp.current;
    const hpBlock = document.getElementById('activeHpBlock');
    if (hpBlock) {
        const pct = p.hp.max > 0 ? (p.hp.current / p.hp.max) * 100 : 0;
        hpBlock.className = 'combat-vital-block ' +
            (pct <= 0 ? 'hp-dead' : pct <= 25 ? 'hp-critical' : pct <= 50 ? 'hp-low' : '');
        const slider = hpBlock.querySelector('.combat-hp-slider');
        if (slider) slider.style.setProperty('--fill-pct', pct + '%');
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
        // Jugador personal turn manager — always advance freely, no warnings
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
    saveCombatState();
    renderCombatManager();
    showNotification('⬅️ Turno anterior restaurado', 2000);
}

// ---- Demonic Form in Combat ----
function toggleDemonicFormInCombat(participantId) {
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p) return;
    p.demonicForm = !p.demonicForm;
    if (p.demonicForm) {
        p.ac    = String(parseInt(p.baseAc) + 2);
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
function buildSirvienteCharData(ac) {
    return {
        nombre: 'Sirviente Invisible',
        clase: 'Familiar',
        nivel: 1,
        tipo: 'aliado',
        imagen: null,
        combateExtra: [
            {
                nombre: 'Hacha de mano',
                tipo: 'accion',
                atk: '+7',
                dado: '1d8+5',
                desc: 'Daño divino. Siempre ataca con ventaja (invisible).'
            },
            {
                nombre: 'Hacha de mano',
                tipo: 'adicional',
                atk: '+5',
                dado: '1d8+5',
                desc: 'Acción adicional. Daño divino.'
            },
            {
                nombre: 'Daga',
                tipo: 'accion',
                atk: '+7',
                dado: '1d4',
                desc: 'El próximo aliado ataca con ventaja contra ese objetivo.'
            },
            {
                nombre: 'Ventaja / Desventaja',
                tipo: 'accion',
                atk: '',
                dado: '',
                desc: 'Genera ventaja o desventaja en un objetivo (sin tirada).'
            }
        ],
        conjuros: []
    };
}

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
let _quickNpcTipo = 'enemigo'; // module-level flag for current quick-add tipo

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
    overlay.innerHTML = `
        <div class="quick-enemy-modal">
            <div class="quick-enemy-title">${icon} ${label} Rápido</div>
            <input id="qeName" class="quick-enemy-input" placeholder="${placeholder}" autocomplete="off">
            <input id="qeHp" class="quick-enemy-input" type="number" placeholder="PG máximos" min="1">
            <input id="qeAc" class="quick-enemy-input" type="number" placeholder="Clase de Armadura" min="1">
            ${context === 'combat' ? `<input id="qeInit" class="quick-enemy-input" type="number" placeholder="Iniciativa (opcional)">` : ''}
            <div class="quick-enemy-btns">
                <button class="btn-combat-primary" onclick="submitQuickNpc('${context}')">Añadir</button>
                <button class="btn-combat-secondary" onclick="document.getElementById('quickEnemyOverlay')?.remove()">Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('qeName')?.focus();
}

function submitQuickEnemy(context) { submitQuickNpc(context); } // backward compat alias

function submitQuickNpc(context) {
    const tipo = _quickNpcTipo || 'enemigo';
    const isEnemy = tipo === 'enemigo';
    const icon = isEnemy ? '💀' : '💙';
    const name = document.getElementById('qeName')?.value?.trim();
    const hp = parseInt(document.getElementById('qeHp')?.value) || 10;
    const ac = parseInt(document.getElementById('qeAc')?.value) || 10;
    const initEl = document.getElementById('qeInit');
    const initiative = initEl ? (parseInt(initEl.value) || 0) : 0;
    if (!name) { showNotification('⚠️ Introduce un nombre', 2000); return; }

    const uid = `qe_${Date.now()}`;
    const charData = {
        id: uid, tipo, nombre: name,
        clase: isEnemy ? 'Enemigo' : 'Aliado NPC', nivel: '—', imagen: '',
        resumen: { HP: String(hp), CA: String(ac), Velocidad: '30ft' },
        combateExtra: [], conjuros: [],
    };
    window.characterData[uid] = charData;
    document.getElementById('quickEnemyOverlay')?.remove();

    if (context === 'setup') {
        combatState.selectedIds.push(uid);
        renderCombatSetup();
        showNotification(`${icon} ${name} añadido a la selección`, 2000);
    } else {
        const participant = {
            id: uid, name,
            initiative,
            hp: { current: hp, max: hp },
            ac: String(ac), baseAc: String(ac),
            speed: '30ft', baseSpeed: '30ft',
            conditions: [], note: '', charData,
            demonicForm: false, tipo,
            customActions: [],
        };
        combatState.participants.push(participant);
        combatState.participants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
        saveCombatState();
        renderCombatManager();
        showNotification(`${icon} ${name} añadido al combate`, 2000);
    }
}

// ---- Mobile Log Toggle ----
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

// ---- Setup NPC Builder ----
function addSetupNpc(tipo) {
    const p = tipo === 'aliado' ? 'aliado' : 'enemigo';
    const nombre     = document.getElementById(`${p}Nombre`)?.value?.trim();
    const pg         = parseInt(document.getElementById(`${p}Pg`)?.value)   || 10;
    const ca         = parseInt(document.getElementById(`${p}Ca`)?.value)   || 10;
    const initiative = parseInt(document.getElementById(`${p}Init`)?.value) || 0;
    const acciones    = document.getElementById(`${p}Acciones`)?.value?.trim()    || '';
    const adicionales = document.getElementById(`${p}Adicionales`)?.value?.trim() || '';
    const reacciones  = document.getElementById(`${p}Reacciones`)?.value?.trim()  || '';

    if (!nombre) { showNotification('⚠️ Introduce un nombre', 2000); return; }

    setupNpcs.push({ tipo, nombre, pg, ca, initiative, acciones, adicionales, reacciones });

    // Clear form fields
    ['Nombre', 'Pg', 'Ca', 'Init', 'Acciones', 'Adicionales', 'Reacciones'].forEach(f => {
        const el = document.getElementById(`${p}${f}`);
        if (el) el.value = '';
    });

    renderSetupNpcList(tipo);
    _updateSetupCount();
    showNotification(`${tipo === 'aliado' ? '💙' : '💀'} ${nombre} añadido`, 1500);
}

function renderSetupNpcList(tipo) {
    const listEl = document.getElementById(tipo === 'aliado' ? 'aliadoList' : 'enemigoList');
    if (!listEl) return;
    const items = setupNpcs.filter(n => n.tipo === tipo);
    if (!items.length) {
        listEl.innerHTML = `<div class="npc-list-empty">Ningún ${tipo} añadido todavía</div>`;
        return;
    }
    listEl.innerHTML = items.map(npc => {
        const idx = setupNpcs.indexOf(npc);
        const actParts = [npc.acciones, npc.adicionales, npc.reacciones].filter(Boolean);
        const actStr = actParts.join(' | ');
        return `<div class="npc-builder-item">
            <div class="npc-item-info">
                <span class="npc-item-name">${npc.nombre}</span>
                <span class="npc-item-stats">❤️ ${npc.pg} · 🛡️ ${npc.ca} · Init ${npc.initiative}</span>
                ${actStr ? `<span class="npc-item-actions">⚔️ ${actStr}</span>` : ''}
            </div>
            <button class="npc-remove-btn" onclick="removeSetupNpc(${idx})">✕</button>
        </div>`;
    }).join('');
}

function removeSetupNpc(idx) {
    if (idx < 0 || idx >= setupNpcs.length) return;
    const name = setupNpcs[idx].nombre;
    const tipo = setupNpcs[idx].tipo;
    setupNpcs.splice(idx, 1);
    renderSetupNpcList('aliado');
    renderSetupNpcList('enemigo');
    _updateSetupCount();
    showNotification(`✕ ${name} eliminado`, 1200);
}

// ---- Auto-save Combat State ----
const COMBAT_SAVE_KEY = 'dnd_combat_session';

function saveCombatState() {
    if (!combatState.isActive) return;
    const toSave = {
        ...combatState,
        participants: combatState.participants.map(p => ({ ...p, charData: null })),
    };
    try { localStorage.setItem(COMBAT_SAVE_KEY, JSON.stringify(toSave)); } catch (e) {}
    saveToApi(); // sync to MongoDB → SSE broadcast to all connected clients
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
                p.charData = buildSirvienteCharData(p.ac); // rebuild transient charData
            } else {
                p.charData = window.characterData[p.id] || null;
            }
            if (!p.customActions) p.customActions = []; // migration for old saves
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
            if (diceWidget) diceWidget.style.display = 'flex';
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
            if (diceWidget) diceWidget.style.display = 'flex';
            break;
    }
}

// ============================================
// Start Application
// ============================================
init();

