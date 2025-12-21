/**
 * MOBILE SCRIPT - Dedicated for m_*.html pages
 * View-only logic with real redirections
 */

console.log('M_SCRIPT.JS LOADED');

const mState = {
    zoom: 1,
    pan: { x: 0, y: 0 },
    isDragging: false,
    lastTouch: { x: 0, y: 0 },
    history: [], // Historial para navegación móvil
    currentMapId: null
};

// --- Character List ---
function renderMobileCharacterList() {
    console.log('--- Iniciando renderMobileCharacterList ---');
    const container = document.getElementById('m_characterList');
    if (!container) {
        console.error('ERROR: No se encontró el contenedor m_characterList');
        return;
    }

    // Robust check for data
    if (!window.characterData || Object.keys(window.characterData).length === 0) {
        console.log('Esperando datos de personajes... (window.characterData missing or empty)');
        setTimeout(renderMobileCharacterList, 200);
        return;
    }

    container.innerHTML = '';
    const chars = Object.values(window.characterData);
    console.log('Mobile character list count:', chars.length);

    if (chars.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px; color:#666;">No se encontraron personajes disponibles.</div>';
        return;
    }

    chars.forEach(char => {
        console.log('Rendering character:', char.nombre, 'ID:', char.id);
        const charCard = document.createElement('a');
        charCard.href = `m_sheet.html?id=${char.id}`;
        charCard.className = 'character-card-link';
        charCard.innerHTML = `
            <div class="card-img-wrapper" style="width:70px; height:70px; min-width:70px; border-radius:12px; overflow:hidden; border:1px solid var(--accent-gold);">
                <img src="${char.imagen}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='assets/imagenes/placeholder.jpg'">
            </div>
            <div class="card-info" style="display:flex; flex-direction:column; gap:2px; flex:1;">
                <div class="card-title" style="color:var(--accent-gold); font-family:'Cinzel', serif; font-weight:bold; font-size:16px;">${char.nombre}</div>
                <div style="color:#aaa; font-size:12px;">${char.raza} • ${char.clase}</div>
                <div style="color:#888; font-size:11px; text-transform:uppercase; letter-spacing:1px;">Nivel ${char.nivel}</div>
            </div>
            <div style="color:var(--accent-gold); opacity:0.5; font-size:20px;">→</div>
        `;
        container.appendChild(charCard);
    });
    console.log('--- Render list completado ---');
}

// --- Character Sheet ---
function renderMobileSheet(id) {
    console.log('--- Iniciando renderMobileSheet para:', id, '---');
    if (!window.characterData || Object.keys(window.characterData).length === 0) {
        console.log('Esperando characterData...');
        setTimeout(() => renderMobileSheet(id), 200);
        return;
    }

    // Búsqueda insensible a mayúsculas
    let data = window.characterData[id];
    if (!data) {
        // Intentar búsqueda por ID ignorando capitalización
        const key = Object.keys(window.characterData).find(k => k.toLowerCase() === id.toLowerCase());
        if (key) data = window.characterData[key];
    }
    if (!data) {
        console.error('ERROR: No se encontró data para ID:', id);
        // Mostrar algo de error en el HTML si es posible
        const nameEl = document.getElementById('m_sheetName');
        if (nameEl) nameEl.textContent = 'Personaje no encontrado';
        return;
    }

    console.log('Data encontrada:', data.nombre);

    // Forzar visibilidad del contenedor
    const mainContainer = document.getElementById('m_sheetContainer');
    if (mainContainer) {
        mainContainer.style.display = 'block';
        mainContainer.style.opacity = '1';
        mainContainer.style.visibility = 'visible';
    }

    // Name and Meta
    const fields = {
        'm_sheetName': data.nombre,
        'm_sheetRace': data.raza,
        'm_sheetClass': data.clase,
        'm_sheetLevel': data.nivel
    };

    for (const [fieldId, value] of Object.entries(fields)) {
        const el = document.getElementById(fieldId);
        if (el) el.textContent = value;
        else console.warn('Campo no encontrado en HTML:', fieldId);
    }

    // Image
    const img = document.getElementById('m_sheetImg');
    if (img) {
        img.src = data.imagen || '';
        img.style.transform = 'none';
        console.log('Imagen cargada:', img.src);
    }

    // Stats
    const statsGrid = document.getElementById('m_statGrid');
    if (statsGrid && data.stats) {
        console.log('Renderizando stats...');
        statsGrid.innerHTML = '';
        for (const [stat, val] of Object.entries(data.stats)) {
            const mod = Math.floor((val - 10) / 2);
            statsGrid.innerHTML += `
                <div class="stat-box">
                    <span class="stat-label" style="font-size:9px; color:var(--accent-gold); text-transform:uppercase;">${stat.substring(0, 3)}</span>
                    <span class="stat-value" style="font-size:20px; font-weight:bold;">${val}</span>
                    <span class="stat-mod" style="font-size:11px; color:#aaa;">${mod >= 0 ? '+' : ''}${mod}</span>
                </div>
            `;
        }
    }

    // Vitals
    const vitals = document.getElementById('m_sheetVitals');
    if (vitals && data.resumen) {
        console.log('Renderizando vitales...');
        vitals.innerHTML = '';
        const vitalKeys = ['HP', 'CA', 'Iniciativa'];
        vitalKeys.forEach(key => {
            const val = data.resumen[key] || '0';
            vitals.innerHTML += `
                <div class="vital-box">
                    <div style="font-size:9px; color:#aaa; text-transform:uppercase;">${key}</div>
                    <div style="font-size:18px; font-weight:bold; color:var(--accent-gold);">${val}</div>
                </div>
            `;
        });
    }

    // Skills & Tabs
    console.log('Renderizando habilidades y pestañas...');
    let skillsHTML = '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px; justify-content:center;">';
    if (data.habilidades) {
        data.habilidades.forEach(skill => {
            skillsHTML += `<span style="background:rgba(212,175,55,0.1); border:1px solid var(--accent-gold); color:var(--accent-gold); padding:4px 10px; border-radius:4px; font-size:10px; font-weight:600; text-transform:uppercase;">${skill}</span>`;
        });
    }
    skillsHTML += '</div>';

    clearMobileSheet();
    renderMobileTabsContent(data, skillsHTML);
    setupMobileTabListeners();
    console.log('--- Render finalizado con éxito ---');
}

function renderMobileTabsContent(data, skillsHTML) {
    // Features
    let featuresHTML = skillsHTML || '';
    if (data.rasgos && Array.isArray(data.rasgos)) {
        data.rasgos.forEach(feat => {
            featuresHTML += `
                <div class="feature-item">
                    <h3 style="margin:0 0 8px 0; color:var(--accent-gold); font-family:'Cinzel', serif; font-size:16px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:5px;">${feat.nombre}</h3>
                    <div style="font-size:13px; color:#ccc; line-height:1.5;">${feat.desc}</div>
                </div>
            `;
        });
    }
    const featuresTab = document.getElementById('m_tabFeatures');
    if (featuresTab) featuresTab.innerHTML = featuresHTML;

    // Spells
    let spellsHTML = '';
    if (data.conjuros && Array.isArray(data.conjuros) && data.conjuros.length > 0) {
        data.conjuros.forEach(spell => {
            spellsHTML += `
                <div class="spell-item">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:5px;">
                        <h3 style="margin:0; color:var(--accent-gold); font-family:'Cinzel', serif; font-size:16px;">${spell.nombre}</h3>
                        <span style="font-size:10px; background:rgba(212,175,55,0.1); padding:2px 6px; border-radius:4px; color:var(--accent-gold);">NIV ${spell.nivel}</span>
                    </div>
                    <div style="font-size:13px; color:#ccc; line-height:1.5;">${spell.desc}</div>
                </div>
            `;
        });
    } else {
        spellsHTML = '<div style="text-align:center; padding:40px; color:#666; font-style:italic;">No hay conjuros registrados</div>';
    }
    const spellsTab = document.getElementById('m_tabSpells');
    if (spellsTab) spellsTab.innerHTML = spellsHTML;
}

function clearMobileSheet() {
    const features = document.getElementById('m_tabFeatures');
    const spells = document.getElementById('m_tabSpells');
    if (features) features.innerHTML = '';
    if (spells) spells.innerHTML = '';
}

function setupMobileTabListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.dataset.mTab === 'features' ? 'm_tabFeatures' : 'm_tabSpells';
            document.getElementById(targetId).classList.add('active');
        };
    });
}

// --- Map Logic ---
function initMobileMap() {
    if (!window.initialGameData) {
        setTimeout(initMobileMap, 100);
        return;
    }

    const params = new URLSearchParams(window.location.search);
    let mapId = params.get('map') || window.initialGameData.mapa_inicial;

    // Si cambiamos de mapa (no es una recarga), guardamos en historial
    if (mState.currentMapId && mState.currentMapId !== mapId) {
        mState.history.push(mState.currentMapId);
    }
    mState.currentMapId = mapId;

    const mapData = window.initialGameData.mapas[mapId];
    if (!mapData) return;

    const mapImg = document.getElementById('m_mapImg');
    const canvas = document.getElementById('m_mapCanvas');

    // Breadcrumbs y Botón Atrás
    document.getElementById('m_breadcrumbs').textContent = mapData.nombre || 'Mundo';
    const btnBack = document.getElementById('m_btnBack');
    if (btnBack) {
        btnBack.style.display = mState.history.length > 0 ? 'inline-block' : 'none';
        btnBack.onclick = navigateMobileBack;
    }

    mapImg.src = mapData.imagen;
    mState.zoom = 1;
    mState.pan = { x: 0, y: 0 };
    updateTransform();

    renderMobilePins(mapData.pines);
    setupMobileMapInteraction();
}

function navigateMobileBack() {
    if (mState.history.length === 0) return;
    const lastMap = mState.history.pop();
    // Navegar sin añadir al historial (initMobileMap se encarga del resto)
    mState.currentMapId = null; // Reset para que no se autoguarde
    window.location.href = `m_map.html?map=${lastMap}`;
}

function renderMobilePins(pines) {
    const layer = document.getElementById('m_pinsLayer');
    if (!layer) return;
    layer.innerHTML = '';
    if (!pines) return;

    pines.forEach(pin => {
        const pinLink = document.createElement('a');
        pinLink.className = 'mobile-pin';
        pinLink.style.left = (pin.x * 100) + '%';
        pinLink.style.top = (pin.y * 100) + '%';
        pinLink.style.zIndex = Math.floor(pin.y * 1000);

        const size = pin.tamano || 1;
        pinLink.style.transform = `translate(-50%, -50%) scale(${size})`;

        pinLink.innerHTML = `<span class="pin-label">${pin.nombre}</span>`;
        if (pin.destino) {
            pinLink.href = `m_map.html?map=${pin.destino}`;
        }
        layer.appendChild(pinLink);
    });
}

function setupMobileMapInteraction() {
    const container = document.getElementById('m_mapContainer');
    if (!container) return;

    container.ontouchstart = (e) => {
        if (e.touches.length === 1) {
            mState.isDragging = true;
            mState.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    };

    container.ontouchmove = (e) => {
        if (!mState.isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - mState.lastTouch.x;
        const dy = touch.clientY - mState.lastTouch.y;

        mState.pan.x += dx;
        mState.pan.y += dy;
        mState.lastTouch = { x: touch.clientX, y: touch.clientY };
        updateTransform();
    };

    container.ontouchend = () => {
        mState.isDragging = false;
    };

    document.getElementById('m_zoomIn').onclick = () => {
        mState.zoom = Math.min(mState.zoom * 1.5, 5);
        updateTransform();
    };
    document.getElementById('m_zoomOut').onclick = () => {
        mState.zoom = Math.max(mState.zoom / 1.5, 0.5);
        updateTransform();
    };
}

function updateTransform() {
    const canvas = document.getElementById('m_mapCanvas');
    if (canvas) {
        canvas.style.transform = `translate(${mState.pan.x}px, ${mState.pan.y}px) scale(${mState.zoom})`;
    }
}
