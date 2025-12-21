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
    editingPinIndex: null // Index of pin being edited (null = creating new)
};

// ============================================
// Initialization
// ============================================
async function init() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('No data.json found');

        state.data = await response.json();

        if (!state.data.mapa_inicial || Object.keys(state.data.mapas).length === 0) {
            showWelcomeScreen();
            return;
        }

        state.currentMap = state.data.mapa_inicial;
        setupEventListeners();
        renderMap();
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
    document.getElementById('backBtn').addEventListener('click', navigateBack);

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => adjustZoom(0.2));
    document.getElementById('zoomOut').addEventListener('click', () => adjustZoom(-0.2));
    document.getElementById('zoomReset').addEventListener('click', resetView);

    // Editor controls
    document.getElementById('toggleEdit').addEventListener('click', toggleEditMode);
    document.getElementById('addMapBtn').addEventListener('click', showAddMapModal);
    document.getElementById('exportBtn').addEventListener('click', exportData);

    // Map interaction
    const container = document.getElementById('mapContainer');
    container.addEventListener('mousedown', handleMapMouseDown);
    container.addEventListener('mousemove', handleMapMouseMove);
    container.addEventListener('mouseup', handleMapMouseUp);
    container.addEventListener('wheel', handleMapWheel);
    container.addEventListener('contextmenu', handleRightClick);

    // Modal controls
    setupModalListeners();
}

function setupModalListeners() {
    // Pin modal
    document.getElementById('savePinBtn').addEventListener('click', savePin);
    document.getElementById('cancelPinBtn').addEventListener('click', () => {
        document.getElementById('pinModal').style.display = 'none';
        state.tempPin = null;
        state.editingPinIndex = null;
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

    // Update back button
    const backBtn = document.getElementById('backBtn');
    backBtn.style.display = state.history.length > 0 ? 'flex' : 'none';

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
        pinEl.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateToMap(pin.destino);
        });
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

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const container = document.getElementById('mapImage');
        const rect = container.getBoundingClientRect();

        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        pinEl.style.left = `${x * 100}%`;
        pinEl.style.top = `${y * 100}%`;
    });

    document.addEventListener('mouseup', () => {
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
    });
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
    const path = [...state.history, state.currentMap];
    breadcrumbs.textContent = path.join(' → ');
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
    if (state.editingPinIndex !== null) {
        modalTitle.textContent = 'Editar Pin';
        const pin = state.data.mapas[state.currentMap].pines[state.editingPinIndex];
        document.getElementById('pinName').value = pin.nombre;

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

    if (!nombre || !destino) {
        alert('Por favor completa todos los campos');
        return;
    }

    if (state.editingPinIndex !== null) {
        // Editing existing pin
        state.data.mapas[state.currentMap].pines[state.editingPinIndex].nombre = nombre;
        state.data.mapas[state.currentMap].pines[state.editingPinIndex].destino = destino;
        state.editingPinIndex = null;
        showNotification('Pin actualizado correctamente', 2000);
    } else {
        // Creating new pin
        const pin = {
            x: state.tempPin.x,
            y: state.tempPin.y,
            nombre: nombre,
            destino: destino
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
    const dataStr = JSON.stringify(state.data, null, 4);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Datos exportados. Reemplaza el archivo data.json con el descargado.');
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
    notification.textContent = message;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

// ============================================
// Task Tracking Helper
// ============================================
function updateTaskMd(action) {
    console.log(`[Task Update] ${action} completed`);
}

// ============================================
// Start Application
// ============================================
init();

