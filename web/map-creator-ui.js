// ============================================
// Map Creator — UI: paneles de escena, propiedades y tiles
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
        <label class="mc-upload-btn">📁 Elegir archivo
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
        <label class="mc-prop-label">Tamaño del pincel: <strong>${_mc.fogBrushSize}px</strong></label>
        <input type="range" style="width:100%" min="10" max="300" step="5" value="${_mc.fogBrushSize}"
               oninput="_mc.fogBrushSize=+this.value;this.previousElementSibling.querySelector('strong').textContent=_mc.fogBrushSize+'px'">
    </div>
    <button class="mc-btn mc-btn-sm" onclick="_mcClearFog()" style="width:100%;margin-bottom:4px">
        🌫 Limpiar toda la niebla
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
            <small style="font-size:10px">V = Seleccionar · B = Tile · W = Muro<br>D = Puerta · N = Nota · F = Niebla</small>
        </div>`;
        return;
    }

    const { type, id } = _mc.selection;

    if (type === 'tile') {
        const tile = _mc.scene.tiles.find(t => t.id === id);
        if (!tile) { el.innerHTML = ''; return; }
        const deg = Math.round((tile.rotation || 0) * 180 / Math.PI);
        el.innerHTML = `
        <div class="mc-prop-section">Tile</div>
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
            <label class="mc-prop-label">Rotación: <strong>${deg}°</strong></label>
            <input type="range" style="width:100%" min="0" max="6.283" step="0.05" value="${tile.rotation || 0}"
                   oninput="_mcTileProp('${id}','rotation',+this.value);this.previousElementSibling.querySelector('strong').textContent=Math.round(+this.value*180/Math.PI)+'°'">
        </div>
        <div class="mc-prop-group">
            <label class="mc-prop-label">Opacidad: <strong>${Math.round((tile.alpha||1)*100)}%</strong></label>
            <input type="range" style="width:100%" min="0" max="1" step="0.02"
                   value="${tile.alpha !== undefined ? tile.alpha : 1}"
                   oninput="_mcTileProp('${id}','alpha',+this.value);this.previousElementSibling.querySelector('strong').textContent=Math.round(+this.value*100)+'%'">
        </div>
        <button class="mc-btn mc-btn-danger mc-btn-sm" onclick="mcDeleteSelected()" style="width:100%">🗑 Eliminar tile</button>
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
        <button class="mc-btn mc-btn-danger mc-btn-sm" onclick="mcDeleteSelected()" style="width:100%">🗑 Eliminar muro</button>
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
            <label class="mc-prop-label">Rotación: ${Math.round((door.rotation||0)*180/Math.PI)}°</label>
            <input type="range" style="width:100%" min="0" max="3.14" step="0.05" value="${door.rotation||0}"
                   onchange="_mcDoorProp('${id}','rotation',+this.value)">
        </div>
        <div class="mc-prop-check-row">
            <input type="checkbox" id="mcDoorOpen" ${door.open?'checked':''}
                   onchange="_mcDoorProp('${id}','open',this.checked)">
            <label for="mcDoorOpen" class="mc-prop-label" style="margin:0;cursor:pointer">Puerta abierta</label>
        </div>
        <button class="mc-btn mc-btn-danger mc-btn-sm" onclick="mcDeleteSelected()" style="width:100%">🗑 Eliminar puerta</button>
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
        <button class="mc-btn mc-btn-danger mc-btn-sm" onclick="mcDeleteSelected()" style="width:100%">🗑 Eliminar nota</button>
        `;
    }
}

// Property change handlers
function _mcTileProp(id, key, value) {
    const tile = _mc.scene.tiles.find(t => t.id === id);
    if (!tile) return;
    tile[key]    = value;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcRenderTiles();
    _mcRenderUI();
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

const _MC_BUILTIN_TILES = [
    { label: 'Piedra',   url: 'color:606060', emoji: '🪨' },
    { label: 'Madera',   url: 'color:7A4A1E', emoji: '🪵' },
    { label: 'Agua',     url: 'color:1A5FA8', emoji: '🌊' },
    { label: 'Hierba',   url: 'color:2D7A3A', emoji: '🌿' },
    { label: 'Arena',    url: 'color:C4A050', emoji: '🏖' },
    { label: 'Lava',     url: 'color:CC3300', emoji: '🌋' },
    { label: 'Nieve',    url: 'color:D8E8F4', emoji: '❄️' },
    { label: 'Oscuro',   url: 'color:0d0d18', emoji: '⬛' },
    { label: 'Tierra',   url: 'color:6B4226', emoji: '🟫' },
    { label: 'Mármol',   url: 'color:D4CFC8', emoji: '🔲' },
    { label: 'Musgo',    url: 'color:4A7A3A', emoji: '🌱' },
    { label: 'Hielo',    url: 'color:A8D8EA', emoji: '🔵' },
];

function _mcUpdateTilesPanel() {
    const el = document.getElementById('mcPanelContent');
    if (!el || _mc.panelTab !== 'tiles') return;
    const gs = _mc.scene?.grid?.size || 70;

    el.innerHTML = `
    <div class="mc-prop-section">Tiles predefinidos</div>
    <div class="mc-tile-palette">
        ${_MC_BUILTIN_TILES.map((t, i) => {
            const col    = '#' + t.url.replace('color:', '');
            const active = _mc.tileToPlace?.url === t.url && _mc.tool === 'tile' ? 'mc-tile-active' : '';
            return `<div class="mc-tile-swatch ${active}" onclick="_mcPickBuiltinTile(${i})" title="${t.label}">
                <div class="mc-tile-color" style="background:${col}"></div>
                <div class="mc-tile-label">${t.emoji} ${t.label}</div>
            </div>`;
        }).join('')}
    </div>

    <div class="mc-prop-section" style="margin-top:18px">Tile personalizado</div>
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
        ✅ Usar este tile
    </button>

    <div class="mc-prop-section">Subir imagen</div>
    <label class="mc-upload-btn" style="display:block;text-align:center">📁 Elegir imagen
        <input type="file" accept="image/*" style="display:none" onchange="_mcUploadTile(this)">
    </label>

    ${_mc.tool === 'tile' && _mc.tileToPlace ? `
    <div style="margin-top:14px;padding:10px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.3);border-radius:6px;font-size:12px;color:var(--accent-gold)">
        ✅ Tile activo: <strong>${_escHtml(_mc.tileToPlace.label || 'Personalizado')}</strong><br>
        <span style="color:rgba(255,255,255,0.5)">Haz clic en el mapa para colocarlo (B = modo tile)</span>
    </div>` : ''}
    `;
}

function _mcPickBuiltinTile(index) {
    const t        = _MC_BUILTIN_TILES[index];
    const gs       = _mc.scene?.grid?.size || 70;
    _mc.tileToPlace = { url: t.url, label: t.label, w: gs, h: gs };
    mcSetTool('tile');
    _mcUpdateTilesPanel();
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
