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
        renderCharacterSelectionMenu();
        setupEventListeners();
        setupDiceRoller();
        setView('landing');
        updateTaskMd('Initialize');
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
        state.history = []; // Limpiar historial al volver a inicio
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
        setView('characters');
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
const hpState = {}; // { charId: { current: N, max: N } }

function initHpForChar(charId) {
    if (!hpState[charId]) {
        const maxHp = parseInt(window.characterData[charId]?.resumen?.HP) || 0;
        hpState[charId] = { current: maxHp, max: maxHp };
    }
}

function adjustHp(delta) {
    if (!currentCharacterId) return;
    initHpForChar(currentCharacterId);
    const hp = hpState[currentCharacterId];
    hp.current = Math.max(0, Math.min(hp.max, hp.current + delta));

    // Update UI without full re-render
    const currentEl = document.getElementById('hpCurrent');
    const fillEl = document.getElementById('hpBarFill');
    const sectionEl = document.querySelector('.hp-bar-section');

    if (currentEl) currentEl.textContent = hp.current;
    if (fillEl && sectionEl) {
        const pct = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
        fillEl.style.width = `${pct}%`;
        fillEl.className = 'hp-bar-fill';
        if (pct <= 25) fillEl.classList.add('low');
        else if (pct <= 50) fillEl.classList.add('medium');
        else fillEl.classList.add('high');

        sectionEl.classList.toggle('unconscious', hp.current === 0);
    }

    if (hp.current === 0) showNotification('💀 ¡Sin puntos de golpe!', 3000);
    else if (hp.current <= Math.floor(hp.max * 0.25)) showNotification('⚠️ HP crítico', 2000);
}

function renderHpSection(charId) {
    initHpForChar(charId);
    const hp = hpState[charId];
    const pct = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
    let barClass = 'hp-bar-fill';
    if (pct <= 25) barClass += ' low';
    else if (pct <= 50) barClass += ' medium';
    else barClass += ' high';

    return `
        <div class="hp-bar-section${hp.current === 0 ? ' unconscious' : ''}">
            <div class="hp-bar-header">
                <div class="hp-info">
                    <div class="pill-label">❤️ Puntos de Golpe</div>
                    <div class="hp-display">
                        <span id="hpCurrent">${hp.current}</span><span class="hp-max"> / ${hp.max}</span>
                    </div>
                </div>
                <div class="hp-controls">
                    <button class="hp-btn minus" onclick="adjustHp(-1)" title="Recibir 1 daño" aria-label="Restar HP">−</button>
                    <button class="hp-btn plus" onclick="adjustHp(1)" title="Curar 1 HP" aria-label="Añadir HP">+</button>
                </div>
            </div>
            <div class="hp-bar-track">
                <div class="${barClass}" id="hpBarFill" style="width:${pct}%"></div>
            </div>
        </div>
    `;
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

    // 1. Tab Combat: Detailed actions and combat-related traits
    let combatHTML = '<div class="feature-grid">';
    data.rasgos.forEach((trait, index) => {
        if (trait.nombre.includes("🗡️") || trait.nombre.includes("⚔️") || trait.nombre.includes("Aura") || trait.nombre.includes("Combate")) {
            combatHTML += renderTraitItem(trait, index, 'combat');
        }
    });
    combatHTML += '</div>';
    tabCombat.innerHTML = combatHTML;

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

function renderTraitItem(trait, index, tab) {
    const isExpanded = false; // Initial state
    return `
        <div class="feature-item" data-index="${index}">
            <div class="feature-header" style="display:flex; justify-content:space-between; cursor:pointer;">
                <h3 style="margin:0">${trait.nombre}</h3>
                ${isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteFeature(${index})">×</button>` : ''}
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

    let html = `
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
                <div class="feature-header" style="display:flex; justify-content:space-between; cursor:pointer;">
                    <h3 style="margin:0">${spell.nombre}</h3>
                    ${isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteSpell(${index})">×</button>` : ''}
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
    document.querySelectorAll('.feature-header').forEach(header => {
        header.addEventListener('click', () => {
            const desc = header.nextElementSibling;
            if (desc && desc.classList.contains('collapsible')) {
                desc.classList.toggle('expanded');
            }
        });
    });
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
        <div class="combat-pill" style="border-left-color: #4488ff">
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
        <div class="combat-pill" style="border-left-color: #ffcc44">
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

    // Quick Actions
    renderQuickActions(data);

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

    // Reset Tabs
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="features"]').classList.add('active');
    document.getElementById('tabFeatures').classList.add('active');

    // Show Container + dice roller
    document.getElementById('characterSheetContainer').style.display = 'flex';
    const diceWidget = document.getElementById('diceRollerWidget');
    if (diceWidget) diceWidget.style.display = 'flex';
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
        // Only hide dice roller if we're not in map/characters view
        if (state.currentView === 'landing') {
            const diceWidget = document.getElementById('diceRollerWidget');
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
    ['Vel', 'Zero', 'Asthor'].forEach(id => {
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

    Object.values(window.characterData).forEach(char => {
        const card = document.createElement('div');
        card.className = 'card character-card'; // Added class for specific styling
        card.onclick = () => {
            isCharacterEditing = false;
            renderCharacterSheet(char.id);
        };

        const imgUrl = char.imagen || 'assets/imagenes/placeholder.jpg';

        // Custom styling for image card
        card.innerHTML = `
            <div class="card-img-wrapper" style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; border: 2px solid var(--accent-gold); margin-bottom: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.5);">
                <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://placehold.co/100x100/1e2536/d4af37?text=?'">
            </div>
            <div class="card-title">${char.nombre}</div>
        `;
        container.appendChild(card);
    });
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
    }
}

// ============================================
// Start Application
// ============================================
init();

