// ============================================
// Map Editor — edit mode, pins, map creation, export
// Depends on: globals.js, utils.js, map.js
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

function editPin(pinIndex) {
    state.editingPinIndex = pinIndex;
    showAddPinModal();
}
