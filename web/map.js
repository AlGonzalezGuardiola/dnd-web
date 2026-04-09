// ============================================
// Map — rendering, navigation, zoom/pan, touch
// Depends on: globals.js, utils.js
// Runtime deps: setView, showCombatSetup, renderCombatManager,
//   openPersonajesSection, clearSavedCombat
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

    // Apply persisted grid color preference
    _applyGridColor();
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
        } else if (view === 'tvMode') {
            setView('combatManager');
            return;
        } else if (view === 'combatInit') {
            showCombatSetup();
        } else if (view === 'combatSetup') {
            combatModeActive = false;
            setView('onlineLobby');
        }
        return;
    }

    // Non-map single-level views
    const view = state.currentView;
    if (view === 'characters') {
        // If a character sheet is open, close it (back = close sheet, not leave view)
        const sheetContainer = document.getElementById('characterSheetContainer');
        if (sheetContainer && sheetContainer.style.display !== 'none') {
            sheetContainer.style.display = 'none';
            isCharacterEditing = false;
            return;
        }
        setView('landing');
        return;
    }
    if (view === 'onlineLobby') { setView('landing'); return; }
    if (view === 'combatMaps') { setView('onlineLobby'); return; }
    if (view === 'onlineWaiting') { setView('onlineLobby'); return; }
    if (view === 'encounters') { setView('onlineLobby'); return; }
    if (view === 'npcGenerator') { setView('landing'); return; }
    if (view === 'tvMode') { setView(combatState.isActive ? 'combatManager' : 'landing'); return; }
    if (view === 'sessionNotes') { setView('landing'); return; }
    if (view === 'narrativaHub') { setView('landing'); return; }
    if (view === 'narrative') { setView('narrativaHub'); return; }
    if (view === 'narrativeImages') { setView('narrativaHub'); return; }
    if (view === 'forja') { setView('characters'); return; }
    if (view === 'cocina') { setView('characters'); return; }
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

    // Update grid overlay: keeps the repeating grid aligned to the canvas
    // transform-origin is center center, so the effective screen offset of canvas-origin is:
    //   screen_x = ox*(1 - zoom) + pan.x*zoom   (where ox = container half-width)
    const grid = document.getElementById('mapGridOverlay');
    if (grid) {
        const BASE_CELL = 60; // px at zoom 1 — matches 5 ft DnD square
        const cellSizePx = BASE_CELL * state.zoom;
        const container = document.getElementById('mapContainer');
        const ox = container.clientWidth  / 2;
        const oy = container.clientHeight / 2;
        // Phase: position of the canvas origin (x=0, y=0) in screen-space, mod cell size
        const rawX = ox * (1 - state.zoom) + state.pan.x * state.zoom;
        const rawY = oy * (1 - state.zoom) + state.pan.y * state.zoom;
        const offsetX = ((rawX % cellSizePx) + cellSizePx) % cellSizePx;
        const offsetY = ((rawY % cellSizePx) + cellSizePx) % cellSizePx;
        grid.style.backgroundSize     = `${cellSizePx}px ${cellSizePx}px`;
        grid.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    }
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
// lastTouchX and lastTouchY are declared in globals.js

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
// Grid color toggle (shared by map + TV mode)
// ============================================
function _getGridColor() {
    return localStorage.getItem('dnd_grid_color') || 'white';
}

function toggleGridColor() {
    const next = _getGridColor() === 'white' ? 'black' : 'white';
    localStorage.setItem('dnd_grid_color', next);
    _applyGridColor();
}

function _applyGridColor() {
    const isBlack = _getGridColor() === 'black';

    const mapOverlay = document.getElementById('mapGridOverlay');
    const tvOverlay  = document.getElementById('tvGridOverlay');
    [mapOverlay, tvOverlay].forEach(el => {
        if (el) el.classList.toggle('grid-color-black', isBlack);
    });

    const label = isBlack ? 'N' : 'W';
    const tip   = isBlack ? 'Líneas negras · click para blancas' : 'Líneas blancas · click para negras';
    document.querySelectorAll('.grid-color-btn').forEach(btn => {
        btn.textContent = label;
        btn.title = tip;
    });
}
