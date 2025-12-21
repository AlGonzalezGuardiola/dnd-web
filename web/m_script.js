/**
 * MOBILE SCRIPT - Dedicated for m_*.html pages
 * View-only logic with real redirections
 */

const mState = {
    zoom: 1,
    pan: { x: 0, y: 0 },
    isDragging: false,
    lastTouch: { x: 0, y: 0 }
};

// --- Character List ---
function renderMobileCharacterList() {
    const container = document.getElementById('m_characterList');
    if (!container || !window.characterData) return;

    Object.values(window.characterData).forEach(char => {
        const charCard = document.createElement('a');
        charCard.href = `m_sheet.html?id=${char.id}`;
        charCard.className = 'card character-card-link';
        charCard.innerHTML = `
            <div class="card-img-wrapper" style="width:70px; height:70px; border-radius:50%; overflow:hidden; border:2px solid var(--accent-gold); margin-bottom:10px;">
                <img src="${char.imagen}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div class="card-title">${char.nombre}</div>
            <p>${char.raza} - ${char.clase}</p>
        `;
        container.appendChild(charCard);
    });
}

// --- Character Sheet ---
function renderMobileSheet(id) {
    const data = window.characterData[id];
    if (!data) return;

    document.getElementById('m_sheetName').textContent = data.nombre;
    document.getElementById('m_sheetRace').textContent = data.raza;
    document.getElementById('m_sheetClass').textContent = data.clase;
    document.getElementById('m_sheetLevel').textContent = data.nivel;

    const img = document.getElementById('m_sheetImg');
    img.src = data.imagen;
    img.style.transform = `scale(${data.imagenScale || 1.1})`;

    // Stats
    const statsGrid = document.getElementById('m_statGrid');
    statsGrid.innerHTML = '';
    for (const [stat, val] of Object.entries(data.stats)) {
        const mod = Math.floor((val - 10) / 2);
        statsGrid.innerHTML += `
            <div class="stat-box">
                <span class="stat-label">${stat.toUpperCase()}</span>
                <span class="stat-value">${val}</span>
                <div class="stat-mod">${mod >= 0 ? '+' : ''}${mod}</div>
            </div>
        `;
    }

    // Vitals
    const vitals = document.getElementById('m_sheetVitals');
    vitals.innerHTML = '';
    for (const [key, val] of Object.entries(data.resumen)) {
        vitals.innerHTML += `
            <div class="vital-box">
                <div class="vital-label">${key}</div>
                <div class="vital-value">${val}</div>
            </div>
        `;
    }

    // Tabs
    renderMobileTabsContent(data);
    setupMobileTabListeners();
}

function renderMobileTabsContent(data) {
    // Features
    let featuresHTML = '<div class="feature-grid">';
    data.rasgos.forEach(feat => {
        featuresHTML += `
            <div class="feature-item">
                <h3>${feat.nombre}</h3>
                <div class="item-desc">${feat.desc}</div>
            </div>
        `;
    });
    featuresHTML += '</div>';
    document.getElementById('m_tabFeatures').innerHTML = featuresHTML;

    // Spells
    let spellsHTML = '<div class="feature-grid">';
    if (data.conjuros && data.conjuros.length > 0) {
        data.conjuros.forEach(spell => {
            spellsHTML += `
                <div class="spell-item">
                    <h3>${spell.nombre}</h3>
                    <div class="item-meta">Nivel ${spell.nivel}</div>
                    <div class="item-desc">${spell.desc}</div>
                </div>
            `;
        });
    } else {
        spellsHTML += '<p style="text-align:center; padding:20px; color:var(--text-secondary)">Sin conjuros.</p>';
    }
    spellsHTML += '</div>';
    document.getElementById('m_tabSpells').innerHTML = spellsHTML;
}

function setupMobileTabListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = e.target.dataset.mTab === 'features' ? 'm_tabFeatures' : 'm_tabSpells';
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// --- Map Logic ---
function initMobileMap() {
    if (!window.initialGameData) return;

    // Obtener mapa actual de la URL o usar el inicial
    const params = new URLSearchParams(window.location.search);
    let mapId = params.get('map') || window.initialGameData.mapa_inicial;

    const mapData = window.initialGameData.mapas[mapId];
    if (!mapData) return;

    const mapImg = document.getElementById('m_mapImg');
    const canvas = document.getElementById('m_mapCanvas');
    const updateBreadcrumbs = () => {
        document.getElementById('m_breadcrumbs').textContent = mapData.nombre || 'Mundo';
    };

    updateBreadcrumbs();

    // Resetear cargando el mapa
    mapImg.onload = () => {
        const w = mapImg.naturalWidth;
        const h = mapImg.naturalHeight;

        // FIJAR EL CANVAS AL TAMAÑO REAL DE LA IMAGEN
        // Así los porcentajes (px * 100%) caerán siempre en el mismo píxel
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        // Ajustar zoom inicial para que se vea el ancho del mapa
        mState.zoom = window.innerWidth / w;
        mState.pan = { x: 0, y: 0 };

        updateTransform();
        renderMobilePins(mapData.pines);
    };

    mapImg.src = mapData.imagen;
    // Si la imagen ya estaba en cache
    if (mapImg.complete) {
        mapImg.onload();
    }

    setupMobileMapInteraction();
}

function renderMobilePins(pines) {
    const layer = document.getElementById('m_pinsLayer');
    if (!layer) return;
    layer.innerHTML = '';
    if (!pines) return;

    pines.forEach(pin => {
        const pinLink = document.createElement('a');
        pinLink.className = 'mobile-pin';

        // COORDINADAS: Usar el porcentaje exacto sobre el canvas (que es el tamaño de la imagen)
        pinLink.style.left = (pin.x * 100) + '%';
        pinLink.style.top = (pin.y * 100) + '%';

        pinLink.textContent = pin.nombre;
        if (pin.destino) {
            pinLink.href = `m_map.html?map=${pin.destino}`;
        }
        layer.appendChild(pinLink);
    });
}

function setupMobileMapInteraction() {
    const container = document.getElementById('m_mapContainer');
    const canvas = document.getElementById('m_mapCanvas');

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            mState.isDragging = true;
            mState.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    });

    container.addEventListener('touchmove', (e) => {
        if (!mState.isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - mState.lastTouch.x;
        const dy = touch.clientY - mState.lastTouch.y;

        mState.pan.x += dx;
        mState.pan.y += dy;
        mState.lastTouch = { x: touch.clientX, y: touch.clientY };
        updateTransform();
    });

    container.addEventListener('touchend', () => {
        mState.isDragging = false;
    });

    document.getElementById('m_zoomIn').onclick = () => {
        mState.zoom *= 1.25;
        updateTransform();
    };
    document.getElementById('m_zoomOut').onclick = () => {
        mState.zoom /= 1.25;
        updateTransform();
    };
}

// Global update for map
function updateTransform() {
    const canvas = document.getElementById('m_mapCanvas');
    if (canvas) {
        canvas.style.transform = `translate(${mState.pan.x}px, ${mState.pan.y}px) scale(${mState.zoom})`;
    }
}


function showNotification(msg, time) {
    const n = document.createElement('div');
    n.className = 'notification-banner';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), time);
}
