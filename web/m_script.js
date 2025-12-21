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
    if (!container) return;

    // Robust check for data
    if (!window.characterData) {
        console.log('Esperando datos de personajes...');
        setTimeout(renderMobileCharacterList, 100);
        return;
    }

    container.innerHTML = '';
    const chars = Object.values(window.characterData);
    console.log('Renderizando personajes:', chars.length);

    chars.forEach(char => {
        const charCard = document.createElement('a');
        charCard.href = `m_sheet.html?id=${char.id}`;
        charCard.className = 'character-card-link';
        charCard.innerHTML = `
            <div class="card-img-wrapper" style="width:80px; height:80px; border-radius:50%; overflow:hidden; border:2px solid var(--accent-gold); margin-bottom:12px;">
                <img src="${char.imagen}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div class="card-title" style="color:var(--accent-gold); font-family:'Cinzel', serif; font-weight:bold; text-align:center; font-size:14px;">${char.nombre}</div>
            <div style="color:#aaa; font-size:11px; text-align:center; margin-top:4px;">${char.raza}</div>
            <div style="color:#888; font-size:10px; text-align:center;">${char.clase} - Nivel ${char.nivel}</div>
        `;
        container.appendChild(charCard);
    });
}

// --- Character Sheet ---
function renderMobileSheet(id) {
    if (!window.characterData) {
        setTimeout(() => renderMobileSheet(id), 100);
        return;
    }

    const data = window.characterData[id];
    if (!data) return;

    document.getElementById('m_sheetName').textContent = data.nombre;
    document.getElementById('m_sheetRace').textContent = data.raza;
    document.getElementById('m_sheetClass').textContent = data.clase;
    document.getElementById('m_sheetLevel').textContent = data.nivel;

    const img = document.getElementById('m_sheetImg');
    if (img) {
        img.src = data.imagen;
        // Quitar el scale dinámico que puede estar rompiendo la vista en móvil
        img.style.transform = 'none';
    }

    // Stats
    const statsGrid = document.getElementById('m_statGrid');
    if (statsGrid) {
        statsGrid.innerHTML = '';
        for (const [stat, val] of Object.entries(data.stats)) {
            const mod = Math.floor((val - 10) / 2);
            statsGrid.innerHTML += `
                <div class="stat-box">
                    <span style="font-size:9px; color:var(--accent-gold); text-transform:uppercase; letter-spacing:1px;">${stat.substring(0, 3)}</span>
                    <span style="font-size:20px; font-weight:bold; margin:2px 0;">${val}</span>
                    <span style="font-size:11px; color:#aaa; font-weight:600;">${mod >= 0 ? '+' : ''}${mod}</span>
                </div>
            `;
        }
    }

    // Vitals
    const vitals = document.getElementById('m_sheetVitals');
    if (vitals) {
        vitals.innerHTML = '';
        const vitalKeys = ['HP', 'CA', 'Iniciativa'];
        vitalKeys.forEach(key => {
            const val = data.resumen[key] || '0';
            vitals.innerHTML += `
                <div class="vital-box" style="flex:1; background:rgba(212,175,55,0.05); border:1px solid rgba(212,175,55,0.2); padding:10px; border-radius:10px; text-align:center;">
                    <div style="font-size:9px; color:#aaa; text-transform:uppercase;">${key}</div>
                    <div style="font-size:18px; font-weight:bold; color:var(--accent-gold);">${val}</div>
                </div>
            `;
        });
    }

    // Skills
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
}

function renderMobileTabsContent(data, skillsHTML) {
    // Features
    let featuresHTML = skillsHTML || '';
    data.rasgos.forEach(feat => {
        featuresHTML += `
            <div class="feature-item">
                <h3 style="margin:0 0 8px 0; color:var(--accent-gold); font-family:'Cinzel', serif; font-size:16px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:5px;">${feat.nombre}</h3>
                <div style="font-size:13px; color:#ccc; line-height:1.5;">${feat.desc}</div>
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
    document.getElementById('m_tabSpells').innerHTML = spellsHTML;
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

    const mapData = window.initialGameData.mapas[mapId];
    if (!mapData) return;

    const mapImg = document.getElementById('m_mapImg');
    const canvas = document.getElementById('m_mapCanvas');

    document.getElementById('m_breadcrumbs').textContent = mapData.nombre || 'Mundo';

    mapImg.src = mapData.imagen;
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
        pinLink.style.left = (pin.x * 100) + '%';
        pinLink.style.top = (pin.y * 100) + '%';
        pinLink.style.zIndex = Math.floor(pin.y * 1000);

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
