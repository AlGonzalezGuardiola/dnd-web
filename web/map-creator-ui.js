// FILE: web/map-creator-ui.js
// ============================================
// Map Creator — UI: paneles de escena, propiedades, tiles y capas
// Depends on: map-creator.js (_mc, _mcPushHistory, _mcRenderAll, etc.)
// ============================================

// ─── Panel tabs ────────────────────────────────────────────────────────────

function mcPanelTab(tab) {
    _mc.panelTab = tab;
    document.querySelectorAll('.mc-panel-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (tab === 'scene')  _mcUpdateScenePanel();
    if (tab === 'props')  _mcUpdatePropertiesPanel();
    if (tab === 'tiles')  _mcUpdateTilesPanel();
    if (tab === 'layers') _mcUpdateLayersPanel();
}

// ─── Scene Panel ───────────────────────────────────────────────────────────

function _mcUpdateScenePanel() {
    const el = document.getElementById('mcPanelContent');
    if (!el || _mc.panelTab !== 'scene' || !_mc.scene) return;
    const s = _mc.scene;

    el.innerHTML = `
    <div class="mc-prop-section">Nombre</div>
    <div class="mc-prop-group">
        <input class="mc-prop-input" value="${_escHtml(s.name)}"
               oninput="_mcNameChange(this.value)" placeholder="Nombre del mapa">
    </div>

    <div class="mc-prop-section">Fondo</div>
    <div class="mc-prop-group">
        <label class="mc-prop-label">Tipo</label>
        <select class="mc-prop-input" onchange="_mcBgTypeChange(this.value)">
            <option value="color" ${s.background.type==='color'?'selected':''}>Color sólido</option>
            <option value="image" ${s.background.type==='image'?'selected':''}>Imagen</option>
        </select>
    </div>
    ${s.background.type === 'color' ? `
    <div class="mc-prop-group">
        <label class="mc-prop-label">Color de fondo</label>
        <input type="color" class="mc-prop-color" value="${s.background.color || '#1a1a2e'}"
               oninput="_mcBgColorChange(this.value)">
    </div>` : `
    <div class="mc-prop-group">
        <label class="mc-prop-label">URL de imagen</label>
        <input class="mc-prop-input" placeholder="https://…" value="${_escHtml(s.background.url || '')}"
               onchange="_mcBgUrlChange(this.value)">
    </div>
    <div class="mc-prop-group">
        <label class="mc-prop-label">O subir imagen</label>
        <label class="mc-upload-btn">Elegir archivo
            <input type="file" accept="image/*" style="display:none" onchange="_mcBgFileChange(this)">
        </label>
    </div>`}
    <div class="mc-prop-group mc-prop-row">
        <div>
            <label class="mc-prop-label">Ancho (px)</label>
            <input type="number" class="mc-prop-input" value="${s.background.width}" min="400" max="8000" step="70"
                   onchange="_mcBgSizeChange('width', +this.value)">
        </div>
        <div>
            <label class="mc-prop-label">Alto (px)</label>
            <input type="number" class="mc-prop-input" value="${s.background.height}" min="300" max="6000" step="70"
                   onchange="_mcBgSizeChange('height', +this.value)">
        </div>
    </div>

    <div class="mc-prop-section">Cuadrícula</div>
    <div class="mc-prop-check-row">
        <input type="checkbox" id="mcGridEnabled" ${s.grid.enabled?'checked':''}
               onchange="_mcGridChange('enabled', this.checked)">
        <label for="mcGridEnabled" class="mc-prop-label" style="margin:0;cursor:pointer">Activar cuadrícula</label>
    </div>
    <div class="mc-prop-group">
        <label class="mc-prop-label">Tamaño de celda (px)</label>
        <input type="number" class="mc-prop-input" value="${s.grid.size}" min="10" max="300"
               onchange="_mcGridChange('size', +this.value)">
    </div>
    <div class="mc-prop-group mc-prop-row">
        <div>
            <label class="mc-prop-label">Color</label>
            <input type="color" class="mc-prop-color" value="${s.grid.color || '#ffffff'}"
                   oninput="_mcGridChange('color', this.value)">
        </div>
        <div>
            <label class="mc-prop-label">Opacidad</label>
            <input type="range" style="width:100%;margin-top:8px" min="0" max="1" step="0.02"
                   value="${s.grid.alpha}"
                   oninput="_mcGridChange('alpha', +this.value)">
        </div>
    </div>

    <div class="mc-prop-section">Niebla de guerra</div>
    <div class="mc-prop-check-row">
        <input type="checkbox" id="mcFogEnabled" ${s.fog.enabled?'checked':''}
               onchange="_mcFogEnabledChange(this.checked)">
        <label for="mcFogEnabled" class="mc-prop-label" style="margin:0;cursor:pointer">Activar niebla</label>
    </div>
    ${s.fog.enabled ? `
    <div class="mc-prop-group">
        <label class="mc-prop-label">Tamaño del pincel: <strong id="mcFogBrushVal">${_mc.fogBrushSize}px</strong></label>
        <input type="range" style="width:100%" min="10" max="300" step="5" value="${_mc.fogBrushSize}"
               oninput="_mc.fogBrushSize=+this.value;document.getElementById('mcFogBrushVal').textContent=_mc.fogBrushSize+'px'">
    </div>
    <div class="mc-prop-group" style="display:flex;gap:6px">
        <button class="mc-btn mc-btn-sm" onclick="mcSetTool('fog')" style="flex:1">
            Pintar niebla (F)
        </button>
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:8px;line-height:1.5">
        Clic izq. = revelar · Clic der. = añadir niebla
    </div>
    <button class="mc-btn mc-btn-sm" onclick="_mcClearFog()" style="width:100%;margin-bottom:4px">
        Limpiar toda la niebla
    </button>` : ''}
    `;
}

// Handlers del panel de escena
function _mcNameChange(val) {
    _mc.scene.name = val;
    _mc.modified   = true;
    _mcUpdateModifiedDot();
    const el = document.getElementById('mcMapNameDisplay');
    if (el) el.textContent = val || 'Nuevo mapa';
}

function _mcBgTypeChange(type) {
    _mcPushHistory();
    _mc.scene.background.type = type;
    _mcRenderBackground();
    _mcUpdateScenePanel();
}

function _mcBgColorChange(color) {
    _mc.scene.background.color = color;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcRenderBackground();
}

function _mcBgUrlChange(url) {
    _mcPushHistory();
    _mc.scene.background.url = url;
    _mcRenderBackground();
}

function _mcBgFileChange(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        _mcPushHistory();
        _mc.scene.background.type = 'image';
        _mc.scene.background.url  = e.target.result;
        _mcRenderBackground();
        _mcUpdateScenePanel();
    };
    reader.readAsDataURL(file);
}

function _mcBgSizeChange(key, value) {
    if (!value || value < 10) return;
    _mcPushHistory();
    _mc.scene.background[key] = value;
    _mcRenderBackground();
    _mcRenderGrid();
}

function _mcGridChange(key, value) {
    _mc.scene.grid[key] = value;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcRenderGrid();
}

function _mcFogEnabledChange(enabled) {
    _mcPushHistory();
    _mc.scene.fog.enabled = enabled;
    _mcRenderFog();
    _mcUpdateScenePanel();
}

function _mcClearFog() {
    _mcPushHistory();
    _mc.scene.fog.regions = [];
    _mcRenderFog();
}

// ─── Properties Panel ──────────────────────────────────────────────────────

function _mcUpdatePropertiesPanel() {
    const el = document.getElementById('mcPanelContent');
    if (!el || _mc.panelTab !== 'props') return;

    if (!_mc.selection) {
        el.innerHTML = `<div class="mc-props-empty">
            Selecciona un elemento en el mapa para editar sus propiedades.<br><br>
            <small style="font-size:10px">V = Seleccionar · B = Tile · W = Muro<br>D = Puerta · N = Nota · F = Niebla · P = Dibujar</small>
        </div>`;
        return;
    }

    const { type, id } = _mc.selection;

    if (type === 'tile') {
        const tile = _mc.scene.tiles.find(t => t.id === id);
        if (!tile) { el.innerHTML = ''; return; }
        const deg = Math.round((tile.rotation || 0) * 180 / Math.PI);
        el.innerHTML = `
        <div class="mc-prop-section">Tile — ${_escHtml(tile.label || 'Sin nombre')}</div>
        <div class="mc-prop-group mc-prop-row">
            <div>
                <label class="mc-prop-label">X</label>
                <input type="number" class="mc-prop-input" value="${Math.round(tile.x)}"
                       onchange="_mcTileProp('${id}','x',+this.value)">
            </div>
            <div>
                <label class="mc-prop-label">Y</label>
                <input type="number" class="mc-prop-input" value="${Math.round(tile.y)}"
                       onchange="_mcTileProp('${id}','y',+this.value)">
            </div>
        </div>
        <div class="mc-prop-group mc-prop-row">
            <div>
                <label class="mc-prop-label">Ancho</label>
                <input type="number" class="mc-prop-input" value="${Math.round(tile.width)}" min="1"
                       onchange="_mcTileProp('${id}','width',+this.value)">
            </div>
            <div>
                <label class="mc-prop-label">Alto</label>
                <input type="number" class="mc-prop-input" value="${Math.round(tile.height)}" min="1"
                       onchange="_mcTileProp('${id}','height',+this.value)">
            </div>
        </div>
        <div class="mc-prop-group">
            <label class="mc-prop-label">Rotación: <strong id="mcTileRotVal">${deg}°</strong></label>
            <input type="range" style="width:100%" min="-3.14159" max="3.14159" step="0.05" value="${tile.rotation || 0}"
                   oninput="_mcTileProp('${id}','rotation',+this.value);document.getElementById('mcTileRotVal').textContent=Math.round(+this.value*180/Math.PI)+'°'">
        </div>
        <div class="mc-prop-group">
            <label class="mc-prop-label">Opacidad: <strong id="mcTileAlphaVal">${Math.round((tile.alpha||1)*100)}%</strong></label>
            <input type="range" style="width:100%" min="0" max="1" step="0.02"
                   value="${tile.alpha !== undefined ? tile.alpha : 1}"
                   oninput="_mcTileProp('${id}','alpha',+this.value);document.getElementById('mcTileAlphaVal').textContent=Math.round(+this.value*100)+'%'">
        </div>
        <div class="mc-prop-section">Acciones</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
            <button class="mc-btn mc-btn-sm" onclick="mcDuplicate()">Duplicar</button>
            <button class="mc-btn mc-btn-sm" onclick="mcBringToFront()">Al frente</button>
            <button class="mc-btn mc-btn-sm" onclick="mcSendToBack()">Al fondo</button>
            <button class="mc-btn mc-btn-danger mc-btn-sm" onclick="mcDeleteSelected()">Eliminar</button>
        </div>
        `;

    } else if (type === 'drawing') {
        const d = (_mc.scene.drawings || []).find(dr => dr.id === id);
        if (!d) { el.innerHTML = ''; return; }
        const fillHex = '#' + (d.fillColor || 0x3a5a8a).toString(16).padStart(6, '0');
        const strokeHex = '#' + (d.strokeColor || 0x7ab3e0).toString(16).padStart(6, '0');
        const typeName = d.type === 'rect' ? 'Rectángulo' : 'Elipse';
        el.innerHTML = `
        <div class="mc-prop-section">Dibujo — ${typeName}</div>
        <div class="mc-prop-group mc-prop-row">
            <div>
                <label class="mc-prop-label">X</label>
                <input type="number" class="mc-prop-input" value="${Math.round(d.x)}"
                       onchange="_mcDrawingProp('${id}','x',+this.value)">
            </div>
            <div>
                <label class="mc-prop-label">Y</label>
                <input type="number" class="mc-prop-input" value="${Math.round(d.y)}"
                       onchange="_mcDrawingProp('${id}','y',+this.value)">
            </div>
        </div>
        <div class="mc-prop-group mc-prop-row">
            <div>
                <label class="mc-prop-label">Ancho</label>
                <input type="number" class="mc-prop-input" value="${Math.round(d.width)}" min="1"
                       onchange="_mcDrawingProp('${id}','width',+this.value)">
            </div>
            <div>
                <label class="mc-prop-label">Alto</label>
                <input type="number" class="mc-prop-input" value="${Math.round(d.height)}" min="1"
                       onchange="_mcDrawingProp('${id}','height',+this.value)">
            </div>
        </div>
        <div class="mc-prop-section">Relleno</div>
        <div class="mc-prop-group mc-prop-row">
            <div>
                <label class="mc-prop-label">Color</label>
                <input type="color" class="mc-prop-color" value="${fillHex}"
                       oninput="_mcDrawingColorProp('${id}','fillColor',this.value)">
            </div>
            <div>
                <label class="mc-prop-label">Opacidad: <strong id="mcDrawFillAlpha">${Math.round((d.fillAlpha||0.55)*100)}%</strong></label>
                <input type="range" style="width:100%;margin-top:6px" min="0" max="1" step="0.02"
                       value="${d.fillAlpha !== undefined ? d.fillAlpha : 0.55}"
                       oninput="_mcDrawingProp('${id}','fillAlpha',+this.value);document.getElementById('mcDrawFillAlpha').textContent=Math.round(+this.value*100)+'%'">
            </div>
        </div>
        <div class="mc-prop-section">Borde</div>
        <div class="mc-prop-group mc-prop-row">
            <div>
                <label class="mc-prop-label">Color</label>
                <input type="color" class="mc-prop-color" value="${strokeHex}"
                       oninput="_mcDrawingColorProp('${id}','strokeColor',this.value)">
            </div>
            <div>
                <label class="mc-prop-label">Grosor</label>
                <input type="number" class="mc-prop-input" value="${d.strokeWidth !== undefined ? d.strokeWidth : 2}" min="0" max="20"
                       onchange="_mcDrawingProp('${id}','strokeWidth',+this.value)">
            </div>
        </div>
        <div class="mc-prop-section">Acciones</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
            <button class="mc-btn mc-btn-sm" onclick="mcDuplicate()">Duplicar</button>
            <button class="mc-btn mc-btn-sm" onclick="mcBringToFront()">Al frente</button>
            <button class="mc-btn mc-btn-sm" onclick="mcSendToBack()">Al fondo</button>
            <button class="mc-btn mc-btn-danger mc-btn-sm" onclick="mcDeleteSelected()">Eliminar</button>
        </div>
        `;

    } else if (type === 'wall') {
        const wall = _mc.scene.walls.find(w => w.id === id);
        if (!wall) { el.innerHTML = ''; return; }
        el.innerHTML = `
        <div class="mc-prop-section">Muro</div>
        <div class="mc-prop-group">
            <label class="mc-prop-label">Tipo</label>
            <select class="mc-prop-input" onchange="_mcWallProp('${id}','type',this.value)">
                <option value="wall"   ${wall.type==='wall'  ?'selected':''}>Muro sólido</option>
                <option value="window" ${wall.type==='window'?'selected':''}>Ventana</option>
            </select>
        </div>
        <div class="mc-prop-group mc-prop-row">
            <div><label class="mc-prop-label">X1</label>
                <input type="number" class="mc-prop-input" value="${Math.round(wall.x1)}"
                       onchange="_mcWallProp('${id}','x1',+this.value)"></div>
            <div><label class="mc-prop-label">Y1</label>
                <input type="number" class="mc-prop-input" value="${Math.round(wall.y1)}"
                       onchange="_mcWallProp('${id}','y1',+this.value)"></div>
        </div>
        <div class="mc-prop-group mc-prop-row">
            <div><label class="mc-prop-label">X2</label>
                <input type="number" class="mc-prop-input" value="${Math.round(wall.x2)}"
                       onchange="_mcWallProp('${id}','x2',+this.value)"></div>
            <div><label class="mc-prop-label">Y2</label>
                <input type="number" class="mc-prop-input" value="${Math.round(wall.y2)}"
                       onchange="_mcWallProp('${id}','y2',+this.value)"></div>
        </div>
        <div class="mc-prop-group">
            <button class="mc-btn mc-btn-sm" style="width:100%" onclick="_mcWallContinueChain('${id}')">
                Continuar cadena desde este muro
            </button>
        </div>
        <button class="mc-btn mc-btn-danger mc-btn-sm" onclick="mcDeleteSelected()" style="width:100%">Eliminar muro</button>
        `;

    } else if (type === 'door') {
        const door = _mc.scene.doors.find(d => d.id === id);
        if (!door) { el.innerHTML = ''; return; }
        el.innerHTML = `
        <div class="mc-prop-section">Puerta</div>
        <div class="mc-prop-group mc-prop-row">
            <div><label class="mc-prop-label">X</label>
                <input type="number" class="mc-prop-input" value="${Math.round(door.x)}"
                       onchange="_mcDoorProp('${id}','x',+this.value)"></div>
            <div><label class="mc-prop-label">Y</label>
                <input type="number" class="mc-prop-input" value="${Math.round(door.y)}"
                       onchange="_mcDoorProp('${id}','y',+this.value)"></div>
        </div>
        <div class="mc-prop-group">
            <label class="mc-prop-label">Rotación: <strong id="mcDoorRotVal">${Math.round((door.rotation||0)*180/Math.PI)}°</strong></label>
            <input type="range" style="width:100%" min="0" max="3.14159" step="0.05" value="${door.rotation||0}"
                   oninput="_mcDoorProp('${id}','rotation',+this.value);document.getElementById('mcDoorRotVal').textContent=Math.round(+this.value*180/Math.PI)+'°'">
        </div>
        <div class="mc-prop-check-row">
            <input type="checkbox" id="mcDoorOpen" ${door.open?'checked':''}
                   onchange="_mcDoorProp('${id}','open',this.checked)">
            <label for="mcDoorOpen" class="mc-prop-label" style="margin:0;cursor:pointer">Puerta abierta</label>
        </div>
        <button class="mc-btn mc-btn-danger mc-btn-sm" onclick="mcDeleteSelected()" style="width:100%">Eliminar puerta</button>
        `;

    } else if (type === 'note') {
        const note = _mc.scene.notes.find(n => n.id === id);
        if (!note) { el.innerHTML = ''; return; }
        el.innerHTML = `
        <div class="mc-prop-section">Nota</div>
        <div class="mc-prop-group">
            <label class="mc-prop-label">Texto</label>
            <textarea class="mc-prop-input" rows="3"
                      onchange="_mcNoteProp('${id}','text',this.value)">${_escHtml(note.text)}</textarea>
        </div>
        <div class="mc-prop-group mc-prop-row">
            <div><label class="mc-prop-label">X</label>
                <input type="number" class="mc-prop-input" value="${Math.round(note.x)}"
                       onchange="_mcNoteProp('${id}','x',+this.value)"></div>
            <div><label class="mc-prop-label">Y</label>
                <input type="number" class="mc-prop-input" value="${Math.round(note.y)}"
                       onchange="_mcNoteProp('${id}','y',+this.value)"></div>
        </div>
        <button class="mc-btn mc-btn-danger mc-btn-sm" onclick="mcDeleteSelected()" style="width:100%">Eliminar nota</button>
        `;
    }
}

// ─── Wall chain continue ───────────────────────────────────────────────────

function _mcWallContinueChain(wallId) {
    const wall = _mc.scene.walls.find(w => w.id === wallId);
    if (!wall) return;
    mcSetTool('wall');
    _mc.wallChain = {
        lastPoint:  { x: wall.x2, y: wall.y2 },
        previewEnd: { x: wall.x2, y: wall.y2 },
    };
    _mcRenderWalls();
    showNotification('Cadena continuada desde el extremo del muro', 2000);
}

// ─── Property change handlers ──────────────────────────────────────────────

function _mcTileProp(id, key, value) {
    const tile = _mc.scene.tiles.find(t => t.id === id);
    if (!tile) return;
    tile[key]    = value;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcRenderTiles();
    _mcRenderUI();
}

function _mcDrawingProp(id, key, value) {
    const d = (_mc.scene.drawings || []).find(dr => dr.id === id);
    if (!d) return;
    d[key]       = value;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcRenderDrawings();
    _mcRenderUI();
}

function _mcDrawingColorProp(id, key, hexStr) {
    // Convert #rrggbb string to number
    const num = parseInt(hexStr.replace('#', ''), 16);
    _mcDrawingProp(id, key, num);
}

function _mcWallProp(id, key, value) {
    const wall = _mc.scene.walls.find(w => w.id === id);
    if (!wall) return;
    wall[key]    = value;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcRenderWalls();
}

function _mcDoorProp(id, key, value) {
    const door = _mc.scene.doors.find(d => d.id === id);
    if (!door) return;
    door[key]    = value;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcRenderDoors();
}

function _mcNoteProp(id, key, value) {
    const note = _mc.scene.notes.find(n => n.id === id);
    if (!note) return;
    note[key]    = value;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcRenderNotes();
}

// ─── Tiles Panel ────────────────────────────────────────────────────────────

// Flat array kept for backward compatibility
const _MC_BUILTIN_TILES = [
    { label: 'Piedra',  url: 'tile:stone',  bg: 'linear-gradient(135deg,#777,#555)',     emoji: '🪨' },
    { label: 'Madera',  url: 'tile:wood',   bg: 'linear-gradient(180deg,#8B5A2B,#5c3314)', emoji: '🪵' },
    { label: 'Agua',    url: 'tile:water',  bg: 'linear-gradient(135deg,#0d3b6e,#1a6ea8)', emoji: '🌊' },
    { label: 'Hierba',  url: 'tile:grass',  bg: 'linear-gradient(135deg,#2d6b3a,#1a4a22)', emoji: '🌿' },
    { label: 'Arena',   url: 'tile:sand',   bg: 'linear-gradient(135deg,#c4a050,#a08030)', emoji: '🏖' },
    { label: 'Lava',    url: 'tile:lava',   bg: 'linear-gradient(135deg,#3d0a00,#cc4400)', emoji: '🌋' },
    { label: 'Nieve',   url: 'tile:snow',   bg: 'linear-gradient(135deg,#dce8f4,#b0c8e0)', emoji: '❄️' },
    { label: 'Oscuro',  url: 'tile:dark',   bg: 'linear-gradient(135deg,#0d0d18,#1a1a2e)', emoji: '⬛' },
    { label: 'Tierra',  url: 'tile:dirt',   bg: 'linear-gradient(135deg,#6b4226,#4a2e16)', emoji: '🟫' },
    { label: 'Mármol',  url: 'tile:marble', bg: 'linear-gradient(135deg,#d4cfc8,#b0a8a0)', emoji: '⬜' },
    { label: 'Musgo',   url: 'tile:moss',   bg: 'linear-gradient(135deg,#3a5a3a,#2a4a2a)', emoji: '🌱' },
    { label: 'Hielo',   url: 'tile:ice',    bg: 'linear-gradient(135deg,#c8e8f0,#7abcd4)', emoji: '🔵' },
];

// Category-organised tile palette (the authoritative data)
const _MC_TILE_CATEGORIES = [
    {
        label: 'Mazmorra',
        emoji: '🏰',
        tiles: [
            { label: 'Piedra',     url: 'tile:stone',   bg: 'linear-gradient(135deg,#777,#555)',      emoji: '🪨' },
            { label: 'Mazmorra',   url: 'tile:dungeon', bg: 'linear-gradient(135deg,#2a2a2e,#111)',   emoji: '🏰' },
            { label: 'Ladrillo',   url: 'tile:brick',   bg: 'linear-gradient(135deg,#8a3a28,#5a2010)', emoji: '🧱' },
            { label: 'Adoquín',    url: 'tile:cobble',  bg: 'linear-gradient(135deg,#4a4a4a,#333)',   emoji: '🪨' },
            { label: 'Grava',      url: 'tile:gravel',  bg: 'linear-gradient(135deg,#6a6258,#4a4238)', emoji: '⚪' },
            { label: 'Sangre',     url: 'tile:blood',   bg: 'linear-gradient(135deg,#555558,#6a0a0a)', emoji: '🩸' },
            { label: 'Hueso',      url: 'tile:bone',    bg: 'linear-gradient(135deg,#dad0c0,#a89880)', emoji: '🦴' },
            { label: 'Cripta',     url: 'tile:crypt',   bg: 'linear-gradient(135deg,#141818,#0a0c0a)', emoji: '⚰️' },
            { label: 'Hierro',     url: 'tile:iron',    bg: 'linear-gradient(135deg,#3a3a3e,#222228)', emoji: '⚙️' },
            { label: 'Óxido',      url: 'tile:rust',    bg: 'linear-gradient(135deg,#6a4830,#4a2818)', emoji: '🟧' },
            { label: 'Rejilla',    url: 'tile:grate',   bg: 'linear-gradient(135deg,#1a1a20,#0a0a10)', emoji: '▦' },
        ],
    },
    {
        label: 'Exterior',
        emoji: '🌲',
        tiles: [
            { label: 'Hierba',      url: 'tile:grass',      bg: 'linear-gradient(135deg,#2d6b3a,#1a4a22)', emoji: '🌿' },
            { label: 'Tierra',      url: 'tile:dirt',       bg: 'linear-gradient(135deg,#6b4226,#4a2e16)', emoji: '🟫' },
            { label: 'Arena',       url: 'tile:sand',       bg: 'linear-gradient(135deg,#c4a050,#a08030)', emoji: '🏖' },
            { label: 'Nieve',       url: 'tile:snow',       bg: 'linear-gradient(135deg,#dce8f4,#b0c8e0)', emoji: '❄️' },
            { label: 'Barro',       url: 'tile:mud',        bg: 'linear-gradient(135deg,#3a2a18,#201410)', emoji: '🟤' },
            { label: 'Pantano',     url: 'tile:swamp',      bg: 'linear-gradient(135deg,#1e2e18,#0e1a0e)', emoji: '🌾' },
            { label: 'Bosque',      url: 'tile:forest',     bg: 'linear-gradient(135deg,#3a2818,#201408)', emoji: '🌲' },
            { label: 'Camino',      url: 'tile:path',       bg: 'linear-gradient(135deg,#b09060,#8a7040)', emoji: '🛤' },
            { label: 'Roca',        url: 'tile:rock',       bg: 'linear-gradient(135deg,#585858,#383838)', emoji: '🗻' },
            { label: 'Volcánico',   url: 'tile:volcanic',   bg: 'linear-gradient(135deg,#141414,#300800)', emoji: '🌋' },
            { label: 'Grava camino',url: 'tile:gravel_path',bg: 'linear-gradient(135deg,#b0b0a8,#909088)', emoji: '⚪' },
            { label: 'Mar profundo',url: 'tile:deepwater',  bg: 'linear-gradient(135deg,#04111e,#020c18)', emoji: '🌊' },
            { label: 'Agua poco',   url: 'tile:shallows',   bg: 'linear-gradient(135deg,#4899b8,#3070a0)', emoji: '💧' },
            { label: 'Agua',        url: 'tile:water',      bg: 'linear-gradient(135deg,#0d3b6e,#1a6ea8)', emoji: '🌊' },
            { label: 'Montaña',     url: 'tile:mountain',   bg: 'linear-gradient(135deg,#787878,#585858)', emoji: '⛰' },
            { label: 'Musgo',       url: 'tile:moss',       bg: 'linear-gradient(135deg,#3a5a3a,#2a4a2a)', emoji: '🌱' },
            { label: 'Hielo',       url: 'tile:ice',        bg: 'linear-gradient(135deg,#c8e8f0,#7abcd4)', emoji: '🔵' },
            { label: 'Lava',        url: 'tile:lava',       bg: 'linear-gradient(135deg,#3d0a00,#cc4400)', emoji: '🔥' },
        ],
    },
    {
        label: 'Interior',
        emoji: '🏠',
        tiles: [
            { label: 'Madera',      url: 'tile:wood',         bg: 'linear-gradient(180deg,#8B5A2B,#5c3314)', emoji: '🪵' },
            { label: 'Mármol',      url: 'tile:marble',       bg: 'linear-gradient(135deg,#d4cfc8,#b0a8a0)', emoji: '⬜' },
            { label: 'Alfombra roja',url: 'tile:carpet_red',  bg: 'linear-gradient(135deg,#8a1020,#6a0818)', emoji: '🟥' },
            { label: 'Alfombra azul',url: 'tile:carpet_blue', bg: 'linear-gradient(135deg,#12205a,#0c1840)', emoji: '🟦' },
            { label: 'Cerámica',    url: 'tile:tile_floor',   bg: 'linear-gradient(135deg,#e8e0d4,#c8c0b4)', emoji: '⬛' },
            { label: 'Parqué',      url: 'tile:parquet',      bg: 'linear-gradient(135deg,#a06030,#804020)', emoji: '🪵' },
            { label: 'Tapete',      url: 'tile:rug',          bg: 'linear-gradient(135deg,#8a2018,#600e10)', emoji: '🎨' },
            { label: 'Paja',        url: 'tile:straw',        bg: 'linear-gradient(135deg,#b89040,#907028)', emoji: '🌾' },
            { label: 'Tablón oscuro',url: 'tile:plank_dark',  bg: 'linear-gradient(135deg,#4a2810,#2a1408)', emoji: '🟫' },
            { label: 'Losa int.',   url: 'tile:flagstone_int',bg: 'linear-gradient(135deg,#a8a0a0,#888080)', emoji: '⬜' },
        ],
    },
    {
        label: 'Magia y Especial',
        emoji: '✨',
        tiles: [
            { label: 'Oscuro',     url: 'tile:dark',     bg: 'linear-gradient(135deg,#0d0d18,#1a1a2e)', emoji: '⬛' },
            { label: 'Arcano',     url: 'tile:arcane',   bg: 'linear-gradient(135deg,#080c1a,#100830)', emoji: '🔮' },
            { label: 'Vacío',      url: 'tile:void',     bg: 'linear-gradient(135deg,#020208,#0a0418)', emoji: '🌌' },
            { label: 'Cristal',    url: 'tile:crystal',  bg: 'linear-gradient(135deg,#8ad8e8,#40a8c8)', emoji: '💎' },
            { label: 'Necrótico',  url: 'tile:necrotic', bg: 'linear-gradient(135deg,#080a08,#181830)', emoji: '💀' },
            { label: 'Fuego',      url: 'tile:fire',     bg: 'linear-gradient(135deg,#2a0800,#7a1800)', emoji: '🔥' },
            { label: 'Sagrado',    url: 'tile:holy',     bg: 'linear-gradient(135deg,#f8f0e0,#e0d0a0)', emoji: '✨' },
            { label: 'Tóxico',     url: 'tile:toxic',    bg: 'linear-gradient(135deg,#1a3010,#2a5018)', emoji: '☣️' },
            { label: 'Sombra',     url: 'tile:shadow',   bg: 'linear-gradient(135deg,#0e0e16,#060614)', emoji: '🌑' },
            { label: 'Portal',     url: 'tile:portal',   bg: 'linear-gradient(135deg,#0a0415,#300660)', emoji: '🌀' },
            { label: 'Cielo',      url: 'tile:sky',      bg: 'linear-gradient(135deg,#6aacdc,#9cc8ec)', emoji: '☁️' },
        ],
    },
    {
        label: 'Estructuras',
        emoji: '🧱',
        tiles: [
            { label: 'Muro piedra', url: 'tile:wall_stone',  bg: 'linear-gradient(135deg,#9898a0,#787880)', emoji: '🧱' },
            { label: 'Muro madera', url: 'tile:wall_wood',   bg: 'linear-gradient(135deg,#6a4020,#4a2810)', emoji: '🪵' },
            { label: 'Teja',        url: 'tile:roof_tile',   bg: 'linear-gradient(135deg,#b84830,#882818)', emoji: '🏠' },
            { label: 'Paja tejado', url: 'tile:thatch',      bg: 'linear-gradient(135deg,#a88030,#786018)', emoji: '🌾' },
        ],
    },
];

// Scene templates
const _MC_SCENE_TEMPLATES = [
    {
        label: 'Habitación mazmorra', emoji: '🏰',
        bg:   { type: 'color', color: '#1a1518', width: 1400, height: 1050 },
        grid: { enabled: true, size: 70, color: '#555577', alpha: 0.2 },
    },
    {
        label: 'Taberna', emoji: '🍺',
        bg:   { type: 'color', color: '#2a1a0a', width: 1120, height: 840 },
        grid: { enabled: true, size: 70, color: '#886644', alpha: 0.15 },
    },
    {
        label: 'Bosque', emoji: '🌲',
        bg:   { type: 'color', color: '#0d1a0d', width: 1960, height: 1400 },
        grid: { enabled: true, size: 70, color: '#3a6a3a', alpha: 0.15 },
    },
    {
        label: 'Cueva', emoji: '🦇',
        bg:   { type: 'color', color: '#0d0d10', width: 1400, height: 1050 },
        grid: { enabled: true, size: 70, color: '#444455', alpha: 0.12 },
    },
    {
        label: 'Ciudad / Plaza', emoji: '🏙',
        bg:   { type: 'color', color: '#1a1a22', width: 2100, height: 1400 },
        grid: { enabled: true, size: 70, color: '#666688', alpha: 0.18 },
    },
    {
        label: 'Mar abierto', emoji: '⛵',
        bg:   { type: 'color', color: '#041830', width: 2100, height: 1400 },
        grid: { enabled: true, size: 70, color: '#1a4a6a', alpha: 0.2 },
    },
    {
        label: 'Templo sagrado', emoji: '⛩',
        bg:   { type: 'color', color: '#1a1510', width: 1400, height: 1050 },
        grid: { enabled: true, size: 70, color: '#aa9944', alpha: 0.15 },
    },
    {
        label: 'Cripta', emoji: '💀',
        bg:   { type: 'color', color: '#0a0e0a', width: 1050, height: 1050 },
        grid: { enabled: true, size: 70, color: '#3a4a3a', alpha: 0.15 },
    },
];

function _mcUpdateTilesPanel() {
    const el = document.getElementById('mcPanelContent');
    if (!el || _mc.panelTab !== 'tiles') return;
    const gs = _mc.scene?.grid?.size || 70;

    // Active tile hint at top
    const hintHtml = (_mc.tool === 'tile' && _mc.tileToPlace) ? `
    <div class="mc-tile-active-hint">
        Tile activo: <strong>${_escHtml(_mc.tileToPlace.label || 'Personalizado')}</strong><br>
        <span>Haz clic en el mapa para colocarlo</span>
    </div>` : '';

    // Scene templates section
    const templatesHtml = `
    <div class="mc-prop-section" style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
        <span>Plantillas de escena</span>
    </div>
    <div class="mc-template-grid">
        ${_MC_SCENE_TEMPLATES.map((t, i) => `
        <div class="mc-template-btn" onclick="mcApplyTemplate(${i})" title="${t.label}">
            <span class="mc-template-emoji">${t.emoji}</span>
            <span class="mc-template-label">${t.label}</span>
        </div>`).join('')}
    </div>`;

    // Categories
    const categoriesHtml = _MC_TILE_CATEGORIES.map((cat, ci) => {
        const tilesHtml = cat.tiles.map(t => {
            const active = _mc.tileToPlace?.url === t.url && _mc.tool === 'tile' ? 'mc-tile-active' : '';
            return `<div class="mc-tile-swatch ${active}" onclick="_mcPickTileDef('${t.url}')" title="${t.label}">
                <div class="mc-tile-color" style="background:${t.bg}"></div>
                <div class="mc-tile-label">${t.emoji} ${t.label}</div>
            </div>`;
        }).join('');
        const catId = `mcTileCat_${ci}`;
        return `
        <details class="mc-tile-cat" open>
            <summary class="mc-tile-cat-header">
                ${cat.emoji} ${cat.label} <span class="mc-tile-cat-count">${cat.tiles.length}</span>
            </summary>
            <div class="mc-tile-palette">${tilesHtml}</div>
        </details>`;
    }).join('');

    // Custom tile + upload
    const customHtml = `
    <div class="mc-prop-section" style="margin-top:14px">Tile personalizado</div>
    <div class="mc-prop-group">
        <label class="mc-prop-label">URL de imagen</label>
        <input class="mc-prop-input" id="mcCustomTileUrl" placeholder="https://…">
    </div>
    <div class="mc-prop-group mc-prop-row">
        <div>
            <label class="mc-prop-label">Ancho (px)</label>
            <input type="number" class="mc-prop-input" id="mcCustomTileW" value="${gs}" min="1">
        </div>
        <div>
            <label class="mc-prop-label">Alto (px)</label>
            <input type="number" class="mc-prop-input" id="mcCustomTileH" value="${gs}" min="1">
        </div>
    </div>
    <button class="mc-btn mc-btn-sm" onclick="_mcPickCustomTile()" style="width:100%;margin-bottom:10px">
        Usar este tile
    </button>
    <div class="mc-prop-section">Subir imagen</div>
    <label class="mc-upload-btn" style="display:block;text-align:center">Elegir imagen
        <input type="file" accept="image/*" style="display:none" onchange="_mcUploadTile(this)">
    </label>`;

    el.innerHTML = hintHtml + templatesHtml + categoriesHtml + customHtml;
}

function _mcPickTileDef(urlKey) {
    // Find tile def across all categories
    for (const cat of _MC_TILE_CATEGORIES) {
        const t = cat.tiles.find(tile => tile.url === urlKey);
        if (t) {
            const gs = _mc.scene?.grid?.size || 70;
            _mc.tileToPlace = { url: t.url, label: t.label, w: gs, h: gs };
            mcSetTool('tile');
            _mcUpdateTilesPanel();
            return;
        }
    }
}

// Backward-compat shim: _mcPickBuiltinTile(index) still works for old callers
function _mcPickBuiltinTile(index) {
    const t = _MC_BUILTIN_TILES[index];
    if (!t) return;
    _mcPickTileDef(t.url);
}

function mcApplyTemplate(index) {
    const tmpl = _MC_SCENE_TEMPLATES[index];
    if (!tmpl) return;
    if (!confirm(`¿Aplicar la plantilla "${tmpl.label}"?\nSe reemplazarán el fondo y la cuadrícula, pero se conservarán los tiles y muros.`)) return;
    _mcPushHistory();
    _mc.scene.background = Object.assign({}, _mc.scene.background, tmpl.bg);
    _mc.scene.grid       = Object.assign({}, _mc.scene.grid, tmpl.grid);
    _mcRenderBackground();
    _mcRenderGrid();
    _mc.modified = true;
    _mcUpdateModifiedDot();
    showNotification('Plantilla aplicada: ' + tmpl.label, 2000);
}

function _mcPickCustomTile() {
    const url = document.getElementById('mcCustomTileUrl')?.value?.trim();
    if (!url) { showNotification('Introduce una URL de imagen', 2000); return; }
    const w = +(document.getElementById('mcCustomTileW')?.value) || 70;
    const h = +(document.getElementById('mcCustomTileH')?.value) || 70;
    _mc.tileToPlace = { url, label: 'Personalizado', w, h };
    mcSetTool('tile');
    _mcUpdateTilesPanel();
}

function _mcUploadTile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const gs        = _mc.scene?.grid?.size || 70;
        _mc.tileToPlace = {
            url:   e.target.result,
            label: file.name.replace(/\.[^.]+$/, ''),
            w:     gs,
            h:     gs,
        };
        mcSetTool('tile');
        _mcUpdateTilesPanel();
    };
    reader.readAsDataURL(file);
}

// ─── Draw Subbar ───────────────────────────────────────────────────────────

function mcSetDrawSubTool(subTool) {
    _mc.drawSubTool = subTool;
    document.querySelectorAll('.mc-draw-sub-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtool === subTool);
    });
}

function mcSetDrawFillColor(hex) {
    _mc.drawFillColor = parseInt(hex.replace('#', ''), 16);
}

function mcSetDrawFillAlpha(val) {
    _mc.drawFillAlpha = +val;
    const el = document.getElementById('mcDrawFillAlphaVal');
    if (el) el.textContent = Math.round(+val * 100) + '%';
}

function mcSetDrawStrokeColor(hex) {
    _mc.drawStrokeColor = parseInt(hex.replace('#', ''), 16);
}

function mcSetDrawStrokeWidth(val) {
    _mc.drawStrokeWidth = +val;
    const el = document.getElementById('mcDrawStrokeWidthVal');
    if (el) el.textContent = val + 'px';
}

// ─── Layers Panel ─────────────────────────────────────────────────────────

const _MC_LAYERS = [
    { id: 'background', label: 'Fondo',     stageKey: 'background' },
    { id: 'grid',       label: 'Cuadrícula',stageKey: 'grid'       },
    { id: 'drawings',   label: 'Dibujos',   stageKey: 'drawings'   },
    { id: 'tiles',      label: 'Tiles',     stageKey: 'tiles'      },
    { id: 'walls',      label: 'Muros',     stageKey: 'walls'      },
    { id: 'doors',      label: 'Puertas',   stageKey: 'doors'      },
    { id: 'notes',      label: 'Notas',     stageKey: 'notes'      },
    { id: 'fog',        label: 'Niebla',    stageKey: 'fog'        },
];

function _mcUpdateLayersPanel() {
    const el = document.getElementById('mcPanelContent');
    if (!el || _mc.panelTab !== 'layers') return;

    el.innerHTML = `
    <div class="mc-prop-section">Visibilidad de capas</div>
    <div class="mc-layers-list">
        ${_MC_LAYERS.map(layer => {
            const stage = _mc.stage[layer.stageKey];
            const visible = stage ? stage.visible : true;
            return `<div class="mc-layer-row">
                <input type="checkbox" id="mcLayer_${layer.id}" ${visible ? 'checked' : ''}
                       onchange="_mcToggleLayer('${layer.stageKey}', this.checked)">
                <label for="mcLayer_${layer.id}" class="mc-layer-label">
                    <span class="mc-layer-eye">${visible ? '👁' : '🚫'}</span>
                    ${layer.label}
                </label>
            </div>`;
        }).join('')}
    </div>
    `;
}

function _mcToggleLayer(stageKey, visible) {
    const stage = _mc.stage[stageKey];
    if (stage) {
        stage.visible = visible;
    }
    // Refresh layer panel icon display
    if (_mc.panelTab === 'layers') _mcUpdateLayersPanel();
}
