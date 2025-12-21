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
        charCard.style.textDecoration = 'none';
        charCard.innerHTML = `
            <div class="card-img-wrapper" style="width:70px; height:70px; border-radius:50%; overflow:hidden; border:2px solid var(--accent-gold); margin: 0 auto 10px auto;">
                <img src="${char.imagen}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div class="card-title" style="color:var(--accent-gold); text-align:center;">${char.nombre}</div>
            <p style="color:#ccc; text-align:center; font-size:12px;">${char.raza} - ${char.clase}</p>
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
    if (img) {
        img.src = data.imagen;
        img.style.transform = `scale(${data.imagenScale || 1})`;
    }

    // Stats
    const statsGrid = document.getElementById('m_statGrid');
    if (statsGrid) {
        statsGrid.innerHTML = '';
        for (const [stat, val] of Object.entries(data.stats)) {
            const mod = Math.floor((val - 10) / 2);
            statsGrid.innerHTML += `
                <div class="stat-box">
                    <span style="font-size:10px; color:var(--accent-gold); text-transform:uppercase;">${stat}</span>
                    <span style="font-size:18px; font-weight:bold;">${val}</span>
                    <span style="font-size:12px; opacity:0.7;">${mod >= 0 ? '+' : ''}${mod}</span>
                </div>
            `;
        }
    }

    // Vitals
    const vitals = document.getElementById('m_sheetVitals');
    if (vitals) {
        vitals.innerHTML = '';
        for (const [key, val] of Object.entries(data.resumen)) {
            vitals.innerHTML += `
                <div class="vital-box" style="flex:1; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; text-align:center;">
                    <div style="font-size:10px; opacity:0.8; text-transform:uppercase;">${key}</div>
                    <div style="font-size:20px; font-weight:bold; color:var(--accent-gold);">${val}</div>
                </div>
            `;
        }
    }

    // Skills (Habilidades - Proficiency list)
    let skillsHTML = '<div class="skills-tags" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px;">';
    if (data.habilidades) {
        data.habilidades.forEach(skill => {
            skillsHTML += `<span class="skill-tag" style="background:rgba(212,175,55,0.1); border:1px solid var(--accent-gold); color:var(--accent-gold); padding:4px 10px; border-radius:20px; font-size:12px;">${skill}</span>`;
        });
    }
    skillsHTML += '</div>';

    renderMobileTabsContent(data, skillsHTML);
    setupMobileTabListeners();
}

function renderMobileTabsContent(data, skillsHTML) {
    // Features (including Skills at top)
    let featuresHTML = skillsHTML || '';
    data.rasgos.forEach(feat => {
        featuresHTML += `
            <div class="feature-item">
                <h3 style="margin:0 0 5px 0; color:var(--accent-gold); font-size:16px;">${feat.nombre}</h3>
                <div style="font-size:13px; color:#ccc; line-height:1.4;">${feat.desc}</div>
            </div>
        `;
    });
    document.getElementById('m_tabFeatures').innerHTML = featuresHTML;

    // Spells
    let spellsHTML = '';
    if (data.conjuros && data.conjuros.length > 0) {
        data.conjuros.forEach(spell => {
            spellsHTML += `
                <div class="spell-item">
                    <h3 style="margin:0 0 2px 0; color:var(--accent-gold); font-size:16px;">${spell.nombre}</h3>
                    <div style="font-size:11px; opacity:0.6; margin-bottom:5px;">Nivel ${spell.nivel}</div>
                    <div style="font-size:13px; color:#ccc; line-height:1.4;">${spell.desc}</div>
                </div>
            `;
        });
    } else {
        spellsHTML = '<p style="text-align:center; opacity:0.5; padding:20px;">Sin conjuros.</p>';
    }
    document.getElementById('m_tabSpells').innerHTML = spellsHTML;
}

function setupMobileTabListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.dataset.mTab === 'features' ? 'm_tabFeatures' : 'm_tabSpells';
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// --- Map Logic (IDÉNTICO A PC PERO CON TOUCH) ---
function initMobileMap() {
    if (!window.initialGameData) return;

    // Obtener mapa actual de la URL
    const params = new URLSearchParams(window.location.search);
    let mapId = params.get('map') || window.initialGameData.mapa_inicial;

    const mapData = window.initialGameData.mapas[mapId];
    if (!mapData) return;

    document.getElementById('m_mapImg').src = mapData.imagen;
    document.getElementById('m_breadcrumbs').textContent = mapData.nombre || 'Mundo';

    // Resetear coordenadas para que coincidan con PC
    mState.zoom = 1;
    mState.pan = { x: 0, y: 0 };
    updateTransform();

    renderMobilePins(mapData.pines);
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

        // COORDINADAS: Exactamente como en PC (porcentaje del canvas)
        pinLink.style.left = (pin.x * 100) + '%';
        pinLink.style.top = (pin.y * 100) + '%';

        // Capas inteligente: los pines de abajo tapan a los de arriba
        pinLink.style.zIndex = Math.floor(pin.y * 1000);

        // APLICAR TAMAÑO (Igual que en PC) + Centrado
        const size = pin.tamano || 1;
        pinLink.style.transform = `translate(-50%, -50%) scale(${size})`;

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
        const dx = (touch.clientX - mState.lastTouch.x);
        const dy = (touch.clientY - mState.lastTouch.y);

        mState.pan.x += dx;
        mState.pan.y += dy;
        mState.lastTouch = { x: touch.clientX, y: touch.clientY };
        updateTransform();
    });

    container.addEventListener('touchend', () => {
        mState.isDragging = false;
    });

    // Botones de Zoom
    document.getElementById('m_zoomIn').onclick = () => {
        mState.zoom += 0.2;
        updateTransform();
    };
    document.getElementById('m_zoomOut').onclick = () => {
        mState.zoom = Math.max(0.4, mState.zoom - 0.2);
        updateTransform();
    };
}

function updateTransform() {
    const canvas = document.getElementById('m_mapCanvas');
    if (canvas) {
        canvas.style.transform = `translate(${mState.pan.x}px, ${mState.pan.y}px) scale(${mState.zoom})`;
    }
}
