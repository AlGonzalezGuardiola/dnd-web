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
    history: JSON.parse(sessionStorage.getItem('m_map_history') || '[]'),
    currentMapId: null
};

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

function saveMHistory() {
    sessionStorage.setItem('m_map_history', JSON.stringify(mState.history));
}

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

    // Stats with Skills and Saves (Mobile)
    const statsGrid = document.getElementById('m_statGrid');
    if (statsGrid && data.stats) {
        statsGrid.innerHTML = '';
        for (const [stat, value] of Object.entries(data.stats)) {
            const mod = getModifier(value);
            const signedMod = mod >= 0 ? `+${mod}` : mod;

            statsGrid.innerHTML += `
                <div class="stat-box">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span class="stat-label">${stat.substring(0, 3)}</span>
                        <span class="stat-value">${value}</span>
                        <div class="stat-mod" style="font-size:10px; border:1px solid rgba(212,175,55,0.3); border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; color:var(--accent-gold);">${signedMod}</div>
                    </div>
                    
                    <div class="stat-sublist">
                        <div class="sub-item ${data.competencias_salvacion?.includes(stat) ? 'proficient' : ''}">
                            <span>Salva</span>
                            <span>${data.competencias_salvacion?.includes(stat) ? `+${mod + (data.resumen.Competencia || 2)}` : signedMod}</span>
                        </div>
                        ${(skillMapping[stat] || []).map(skill => {
                const isProf = data.habilidades?.includes(skill);
                const bonus = isProf ? mod + parseInt(data.resumen.Competencia || 2) : mod;
                return `
                            <div class="sub-item ${isProf ? 'proficient' : ''}">
                                <span>${skill}</span>
                                <span>${bonus >= 0 ? '+' : ''}${bonus}</span>
                            </div>`;
            }).join('')}
                    </div>
                </div>
            `;
        }
    }

    // Combat Vitals (Enhanced Mobile)
    const combatVitals = document.getElementById('m_sheetCombatVitals');
    if (combatVitals && data.resumen) {
        combatVitals.innerHTML = `
            <div class="combat-pill" style="border-left-color: #ff4444">
                <span class="pill-icon">❤️</span>
                <div>
                    <div class="pill-label">HP</div>
                    <div class="pill-value">${data.resumen.HP}</div>
                </div>
            </div>
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
                    <div class="pill-label">INIT</div>
                    <div class="pill-value">${data.resumen.Iniciativa}</div>
                </div>
            </div>
            <div class="combat-pill" style="border-left-color: #ffcc44">
                <span class="pill-icon">🏃</span>
                <div>
                    <div class="pill-label">SPD</div>
                    <div class="pill-value">${data.resumen.Velocidad}</div>
                </div>
            </div>
        `;
    }

    // Quick Actions
    renderQuickActions(data);

    // Tab Navigation Management
    updateMobileTabs(data);

    // Tab Navigation Management
    updateMobileTabs(data);
    setupMobileTabListeners();
    console.log('--- Render finalizado con éxito ---');
}

function renderQuickActions(data) {
    const container = document.getElementById('m_quickActions');
    if (!container) return;
    container.innerHTML = '';

    const quickItems = [];
    if (data.conjuros) {
        data.conjuros.forEach(s => {
            if (s.nivel === "Truco" || s.nivel === 1 || s.nombre.includes("Eldritch")) {
                quickItems.push({ ...s, category: 'Spell' });
            }
        });
    }
    if (data.rasgos) {
        data.rasgos.forEach(r => {
            if (r.nombre.includes("🗡️") || r.nombre.includes("⚔️") || r.nombre.includes("Espada") || r.nombre.includes("Aura")) {
                quickItems.push({ ...r, category: 'Trait' });
            }
        });
    }

    if (quickItems.length === 0) {
        container.innerHTML = '<div style="color:#666; font-size:11px; text-align:center;">No hay acciones disponibles.</div>';
        return;
    }

    quickItems.forEach(item => {
        const isExtra = item.desc.toLowerCase().includes("acción adicional") || item.desc.toLowerCase().includes("bonus");
        const isReaction = item.desc.toLowerCase().includes("reacción");
        const card = document.createElement('div');
        card.className = `action-card ${isExtra ? 'extra' : ''} ${isReaction ? 'reaction' : ''}`;
        card.innerHTML = `
            <div class="action-header">
                <span class="action-name">${item.nombre}</span>
                <span class="action-type">${isExtra ? 'Bonus' : isReaction ? 'Reac' : 'Acción'}</span>
            </div>
            <div class="action-summary">${item.desc.substring(0, 50)}...</div>
        `;
        container.appendChild(card);
    });
}

function updateMobileTabs(data) {
    const tabCombat = document.getElementById('m_tabCombat');
    const tabFeatures = document.getElementById('m_tabFeatures');
    const tabInventory = document.getElementById('m_tabInventory');
    const tabSpells = document.getElementById('m_tabSpells');

    // 1. Tab Combat
    let combatHTML = '<div class="feature-grid">';
    data.rasgos.forEach((trait, index) => {
        if (trait.nombre.includes("🗡️") || trait.nombre.includes("⚔️") || trait.nombre.includes("Aura") || trait.nombre.includes("Combate")) {
            combatHTML += renderMobileTraitItem(trait, index);
        }
    });
    combatHTML += '</div>';
    if (tabCombat) tabCombat.innerHTML = combatHTML;

    // 2. Tab Features (Social/Narrative)
    let narrativeHTML = '<div class="feature-grid">';
    data.rasgos.forEach((trait, index) => {
        if (!trait.nombre.includes("🗡️") && !trait.nombre.includes("⚔️") && !trait.nombre.includes("Combate")) {
            narrativeHTML += renderMobileTraitItem(trait, index);
        }
    });
    narrativeHTML += '</div>';
    if (tabFeatures) tabFeatures.innerHTML = narrativeHTML;

    // 3. Tab Inventory
    renderMobileCategorizedInventory(data);

    // 4. Tab Spells
    renderMobileSpellsWithFilters(data);

    setupMobileCollapsibleEvents();
}

function renderMobileTraitItem(trait, index) {
    return `
        <div class="feature-item" style="padding:15px !important;">
            <div class="feature-header" style="cursor:pointer;">
                <h3 style="margin:0; font-size:15px !important;">${trait.nombre}</h3>
            </div>
            <div class="item-desc collapsible">${trait.desc}</div>
        </div>
    `;
}

function renderMobileCategorizedInventory(data) {
    const container = document.getElementById('m_tabInventory');
    if (!container) return;

    const categories = {
        "Equipado": [],
        "Objetos Mágicos": [],
        "Consumibles": [],
        "Mochila": []
    };

    if (data.inventario) {
        data.inventario.forEach((item, index) => {
            const desc = item.desc.toLowerCase();
            if (desc.includes("arma") || desc.includes("armadura")) categories["Equipado"].push(item);
            else if (desc.includes("mágico") || desc.includes("anillo")) categories["Objetos Mágicos"].push(item);
            else if (desc.includes("poción") || desc.includes("pergamino")) categories["Consumibles"].push(item);
            else categories["Mochila"].push(item);
        });
    }

    let html = '';
    for (const [catName, items] of Object.entries(categories)) {
        html += `<h3 style="color:var(--accent-gold); font-family:'Cinzel', serif; font-size:14px; margin:15px 0 10px 0;">${catName}</h3>`;
        if (items.length === 0) {
            html += `<div style="color:#666; font-size:11px; margin-bottom:10px;">Vacío</div>`;
        } else {
            items.forEach(item => {
                html += `
                    <div class="feature-item" style="padding:12px !important; margin-bottom:10px !important;">
                        <div class="feature-header" style="cursor:pointer;">
                            <h3 style="margin:0; font-size:14px !important;">${item.nombre}</h3>
                        </div>
                        <div class="item-desc collapsible">${item.desc}</div>
                    </div>
                `;
            });
        }
    }
    container.innerHTML = html;
}

function renderMobileSpellsWithFilters(data) {
    const container = document.getElementById('m_tabSpells');
    if (!container) return;

    if (!data.conjuros || data.conjuros.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:#666;">Sin conjuros</div>';
        return;
    }

    let html = '<div class="feature-grid">';
    data.conjuros.forEach(spell => {
        html += `
            <div class="spell-item" style="padding:15px !important;">
                <div class="feature-header" style="cursor:pointer; display:flex; justify-content:space-between;">
                    <h3 style="margin:0; font-size:15px !important;">${spell.nombre}</h3>
                    <span style="font-size:10px; color:var(--accent-gold);">NIV ${spell.nivel}</span>
                </div>
                <div class="item-desc collapsible">${spell.desc}</div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function setupMobileCollapsibleEvents() {
    document.querySelectorAll('.feature-header').forEach(header => {
        header.onclick = () => {
            const desc = header.nextElementSibling;
            if (desc && desc.classList.contains('collapsible')) {
                desc.classList.toggle('expanded');
            }
        };
    });
}

function clearMobileSheet() {
    // No longer needed with new updateMobileTabs logic but kept for safety
}

function setupMobileTabListeners() {
    document.querySelectorAll('.tab-combate').forEach(btn => {
        btn.onclick = (e) => {
            const targetTab = btn.dataset.mTab;
            const targetId = `m_tab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`;

            // Toggle Buttons
            document.querySelectorAll('.tab-combate').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle Content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(targetId);
            if (content) content.classList.add('active');
        };
    });
}

// --- Map Logic ---
function initMobileMap() {
    console.log('--- Init Mobile Map ---');
    if (!window.initialGameData) {
        setTimeout(initMobileMap, 100);
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const mapId = params.get('map') || window.initialGameData.mapa_inicial;

    // Actualizar historial
    const lastStored = mState.history[mState.history.length - 1];
    if (lastStored !== mapId) {
        // Si el actual es el que estaba detrás, es que hemos vuelto atrás
        const prev = mState.history[mState.history.length - 2];
        if (prev === mapId) {
            mState.history.pop();
        } else {
            // Si no estaba en el historial, lo añadimos (evitando duplicar el inicial)
            if (lastStored) mState.history.push(mapId);
            else mState.history = [mapId];
        }
        saveMHistory();
    }

    const mapData = window.initialGameData.mapas[mapId];
    if (!mapData) return;

    document.getElementById('m_breadcrumbs').textContent = mapData.nombre || 'Mundo';

    // Botón Atrás: Mostrar siempre si no estamos en el mapa inicial
    const btnBack = document.getElementById('m_btnBack');
    if (btnBack) {
        const isInitial = mapId === window.initialGameData.mapa_inicial;
        btnBack.style.display = isInitial ? 'none' : 'inline-block';
        btnBack.onclick = () => window.history.back();
    }

    const mapImg = document.getElementById('m_mapImg');
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

        // Contra-escalado de etiquetas para que no se vean gigantes al hacer zoom
        const pins = document.querySelectorAll('.pin-label');
        pins.forEach(p => {
            // Ajustamos el escalado inverso para compensar el zoom del padre
            p.style.transform = `scale(${1 / mState.zoom})`;
        });
    }
}
