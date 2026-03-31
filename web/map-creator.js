// FILE: web/map-creator.js
// ============================================
// Map Creator — Core: estado de escena, init PixiJS, guardado, descarga
// Depends on: globals.js (API_BASE), view.js (setView), utils.js (showNotification)
// Requires: PixiJS v7 (window.PIXI) cargado antes de este archivo
// ============================================

// ─── Estado del módulo ─────────────────────────────────────────────────────

const _mc = {
    app:      null,  // PIXI.Application
    stage: {
        world:      null,  // PIXI.Container — pan/zoom aquí
        background: null,  // PIXI.Container
        grid:       null,  // PIXI.Graphics
        drawings:   null,  // PIXI.Container (between grid and tiles)
        tiles:      null,  // PIXI.Container
        walls:      null,  // PIXI.Graphics
        doors:      null,  // PIXI.Container
        notes:      null,  // PIXI.Container
        fog:        null,  // PIXI.Graphics
        ui:         null,  // PIXI.Container (selection handles + previews)
        uiHandles:  null,  // PIXI.Graphics — 8 resize + rotation handles
        uiPreview:  null,  // PIXI.Graphics — tool preview (wall chain, draw preview)
    },
    scene:        null,   // Scene data actual
    tool:         'select',
    selection:    null,   // { type, id }
    history:      [],     // Snapshots JSON para undo/redo
    historyIndex: -1,
    modified:     false,
    mapId:        null,   // null = nuevo, string = editando existente
    pan:    { x: 0, y: 0 },
    zoom:   1,
    spaceDown:   false,
    shiftDown:   false,
    isPanning:   false,
    panStart:    { x: 0, y: 0 },
    panStartPos: { x: 0, y: 0 },
    panelTab:    'scene',
    fogBrushSize: 70,
    fogErasing:   false,
    tileToPlace:  null,  // Tile a colocar desde la paleta
    wallDrawing:  null,  // Muro en construcción legacy (drag único)
    wallChain:    null,  // Cadena de muros { lastPoint:{x,y}, previewEnd:{x,y} }
    drawSubTool:  'rect',  // 'rect' | 'ellipse'
    drawFillColor:  0x3a5a8a,
    drawFillAlpha:  0.55,
    drawStrokeColor: 0x7ab3e0,
    drawStrokeWidth: 2,
    drawStart:    null,  // { x, y } — punto de inicio de dibujo
    dragState:    null,  // Drag de objetos seleccionados
    fogPainting:  false,
    initialized:  false,
    resizeObs:    null,
    textureCache: new Map(),
    autoSaveTimer: null,
    mouseWorld: { x: 0, y: 0 }, // posición del ratón en coords mundo
};

// ─── Scene por defecto ─────────────────────────────────────────────────────

function _mcDefaultScene(name) {
    return {
        version:    2,
        name:       name || 'Nuevo mapa',
        background: {
            type:   'color',
            color:  '#1a1a2e',
            url:    '',
            width:  1920,
            height: 1080,
        },
        grid: {
            enabled: true,
            size:    70,
            color:   '#ffffff',
            alpha:   0.12,
        },
        drawings: [],
        tiles: [],
        walls: [],
        doors: [],
        notes: [],
        fog: {
            enabled: false,
            regions: [],
        },
    };
}

// ─── Puntos de entrada ─────────────────────────────────────────────────────

function openMapCreatorHub() {
    setView('mapCreatorHub');
}

function openMapCreator(mapId) {
    if (_mc.initialized && !mapId) _mcNewScene();
    setView('mapCreator');
    if (mapId) {
        setTimeout(() => _mcLoadMap(mapId), 50);
    }
}

// ─── Hub: lista de mapas del editor ───────────────────────────────────────

function initMapCreatorHub() {
    _mcRenderHubGrid();
}

async function _mcRenderHubGrid() {
    const grid = document.getElementById('mcHubGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="mc-hub-loading">Cargando mapas…</div>';

    try {
        const res = await fetch(`${API_BASE}/api/combat-maps`);
        const all = res.ok ? await res.json() : [];
        const editorMaps = all.filter(m => m.sourceType === 'editor');

        if (!editorMaps.length) {
            grid.innerHTML = `
                <div class="mc-hub-empty">
                    <div style="font-size:48px;margin-bottom:12px">🗺️</div>
                    <div>Aún no has creado ningún mapa.<br>Pulsa <strong>Nuevo mapa</strong> para empezar.</div>
                </div>`;
            return;
        }

        grid.innerHTML = editorMaps.map(m => {
            const thumb = m.url
                ? `<img class="mc-hub-thumb" src="${m.url}" alt="${_escHtml(m.name)}"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const placeholder = `<div class="mc-hub-thumb-placeholder" style="${m.url ? 'display:none' : ''}">🗺️</div>`;
            return `
                <div class="mc-hub-card" onclick="openMapCreator('${m._id}')">
                    ${thumb}${placeholder}
                    <div class="mc-hub-info">
                        <div class="mc-hub-name">${_escHtml(m.name)}</div>
                        <div class="mc-hub-meta">${new Date(m.updatedAt).toLocaleDateString('es-ES')}</div>
                    </div>
                    <button class="mc-hub-delete-btn"
                            onclick="event.stopPropagation();_mcHubDeleteMap('${m._id}','${_escHtml(m.name)}')"
                            title="Eliminar">🗑</button>
                </div>`;
        }).join('');
    } catch (_) {
        grid.innerHTML = '<div class="mc-hub-empty">Error al cargar mapas.</div>';
    }
}

async function _mcHubDeleteMap(id, name) {
    if (!confirm(`¿Eliminar el mapa "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
        const res = await fetch(`${API_BASE}/api/combat-maps/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
        invalidateCombatMapsCache();
        showNotification('Mapa eliminado', 1800);
        _mcRenderHubGrid();
    } catch (err) {
        showNotification('Error: ' + err.message, 3000);
    }
}

// ─── Editor: init PixiJS ───────────────────────────────────────────────────

function initMapCreator() {
    const wrap = document.getElementById('mcCanvasWrap');
    if (!wrap) return;

    if (typeof PIXI === 'undefined') {
        wrap.innerHTML = `<div style="color:#f87171;padding:32px;text-align:center">
            El motor gráfico (PixiJS) no se ha cargado.<br>
            Verifica tu conexión a internet y recarga la página.</div>`;
        return;
    }

    if (!_mc.initialized) {
        _mcBootPixi(wrap);
        _mc.initialized = true;
    } else {
        if (_mc.app) _mc.app.ticker.start();
        _mcResizeCanvas();
        _mcRenderAll();
        _mcUpdateUI();
    }
}

function _mcBootPixi(wrap) {
    _mc.app = new PIXI.Application({
        resizeTo:    wrap,
        backgroundColor: 0x111118,
        resolution:  window.devicePixelRatio || 1,
        autoDensity: true,
        antialias:   true,
    });

    wrap.appendChild(_mc.app.view);

    // Capas en orden de render
    _mc.stage.world      = new PIXI.Container();
    _mc.stage.background = new PIXI.Container();
    _mc.stage.grid       = new PIXI.Graphics();
    _mc.stage.drawings   = new PIXI.Container();
    _mc.stage.tiles      = new PIXI.Container();
    _mc.stage.walls      = new PIXI.Graphics();
    _mc.stage.doors      = new PIXI.Container();
    _mc.stage.notes      = new PIXI.Container();
    _mc.stage.fog        = new PIXI.Graphics();

    // UI container con dos gráficos hijos
    _mc.stage.ui         = new PIXI.Container();
    _mc.stage.uiHandles  = new PIXI.Graphics();
    _mc.stage.uiPreview  = new PIXI.Graphics();
    _mc.stage.ui.addChild(_mc.stage.uiPreview);
    _mc.stage.ui.addChild(_mc.stage.uiHandles);

    _mc.app.stage.addChild(_mc.stage.world);
    _mc.stage.world.addChild(_mc.stage.background);
    _mc.stage.world.addChild(_mc.stage.grid);
    _mc.stage.world.addChild(_mc.stage.drawings);
    _mc.stage.world.addChild(_mc.stage.tiles);
    _mc.stage.world.addChild(_mc.stage.walls);
    _mc.stage.world.addChild(_mc.stage.doors);
    _mc.stage.world.addChild(_mc.stage.notes);
    _mc.stage.world.addChild(_mc.stage.fog);
    _mc.stage.world.addChild(_mc.stage.ui);

    // Eventos nativos del canvas
    _mc.app.view.addEventListener('wheel',       _mcOnWheel,     { passive: false });
    _mc.app.view.addEventListener('mousedown',   _mcOnMouseDown);
    _mc.app.view.addEventListener('mousemove',   _mcOnMouseMove);
    _mc.app.view.addEventListener('mouseup',     _mcOnMouseUp);
    _mc.app.view.addEventListener('mouseleave',  _mcOnMouseLeave);
    _mc.app.view.addEventListener('dblclick',    _mcOnDblClick);
    _mc.app.view.addEventListener('contextmenu', _mcOnContextMenu);

    document.addEventListener('keydown', _mcOnKeyDown);
    document.addEventListener('keyup',   _mcOnKeyUp);
    document.addEventListener('click',   _mcOnDocClick);

    _mcInitTextures();
    _mcNewScene();
}

function _mcNewScene() {
    _mc.scene        = _mcDefaultScene();
    _mc.mapId        = null;
    _mc.history      = [];
    _mc.historyIndex = -1;
    _mc.modified     = false;
    _mc.selection    = null;
    _mc.pan          = { x: 40, y: 40 };
    _mc.zoom         = 0.5;
    _mc.tool         = 'select';
    _mc.wallDrawing  = null;
    _mc.wallChain    = null;
    _mc.drawStart    = null;
    _mc.tileToPlace  = null;
    _mc.dragState    = null;
    _mc.fogErasing   = false;

    _mcPushHistory();
    _mcApplyViewport();
    _mcRenderAll();
    _mcSyncTopbar();
    _mcUpdateToolbar();
    _mcSyncStatusBar();
    _mcResizeCanvas();
    _mcHideContextMenu();
}

// ─── Texture init ─────────────────────────────────────────────────────────

function _mcInitTextures() {
    // Generate patterned textures for built-in tile types
    const SIZE = 140; // texture size in pixels

    const defs = [
        // Original 12
        { key: 'tile:stone',        fn: _mcTexStone        },
        { key: 'tile:wood',         fn: _mcTexWood         },
        { key: 'tile:water',        fn: _mcTexWater        },
        { key: 'tile:grass',        fn: _mcTexGrass        },
        { key: 'tile:sand',         fn: _mcTexSand         },
        { key: 'tile:lava',         fn: _mcTexLava         },
        { key: 'tile:snow',         fn: _mcTexSnow         },
        { key: 'tile:dark',         fn: _mcTexDark         },
        { key: 'tile:dirt',         fn: _mcTexDirt         },
        { key: 'tile:marble',       fn: _mcTexMarble       },
        { key: 'tile:moss',         fn: _mcTexMoss         },
        { key: 'tile:ice',          fn: _mcTexIce          },
        // Dungeon
        { key: 'tile:dungeon',      fn: _mcTexDungeon      },
        { key: 'tile:brick',        fn: _mcTexBrick        },
        { key: 'tile:cobble',       fn: _mcTexCobble       },
        { key: 'tile:gravel',       fn: _mcTexGravel       },
        { key: 'tile:blood',        fn: _mcTexBlood        },
        { key: 'tile:bone',         fn: _mcTexBone         },
        { key: 'tile:crypt',        fn: _mcTexCrypt        },
        { key: 'tile:iron',         fn: _mcTexIron         },
        { key: 'tile:rust',         fn: _mcTexRust         },
        { key: 'tile:grate',        fn: _mcTexGrate        },
        // Exterior
        { key: 'tile:mud',          fn: _mcTexMud          },
        { key: 'tile:swamp',        fn: _mcTexSwamp        },
        { key: 'tile:forest',       fn: _mcTexForest       },
        { key: 'tile:path',         fn: _mcTexPath         },
        { key: 'tile:rock',         fn: _mcTexRock         },
        { key: 'tile:volcanic',     fn: _mcTexVolcanic     },
        { key: 'tile:gravel_path',  fn: _mcTexGravelPath   },
        { key: 'tile:deepwater',    fn: _mcTexDeepwater    },
        { key: 'tile:shallows',     fn: _mcTexShallows     },
        { key: 'tile:mountain',     fn: _mcTexMountain     },
        // Interior
        { key: 'tile:carpet_red',   fn: _mcTexCarpetRed    },
        { key: 'tile:carpet_blue',  fn: _mcTexCarpetBlue   },
        { key: 'tile:tile_floor',   fn: _mcTexTileFloor    },
        { key: 'tile:parquet',      fn: _mcTexParquet      },
        { key: 'tile:rug',          fn: _mcTexRug          },
        { key: 'tile:straw',        fn: _mcTexStraw        },
        { key: 'tile:plank_dark',   fn: _mcTexPlankDark    },
        { key: 'tile:flagstone_int',fn: _mcTexFlagstoneInt },
        // Magic / Special
        { key: 'tile:arcane',       fn: _mcTexArcane       },
        { key: 'tile:void',         fn: _mcTexVoid         },
        { key: 'tile:crystal',      fn: _mcTexCrystal      },
        { key: 'tile:necrotic',     fn: _mcTexNecrotic     },
        { key: 'tile:fire',         fn: _mcTexFire         },
        { key: 'tile:holy',         fn: _mcTexHoly         },
        { key: 'tile:toxic',        fn: _mcTexToxic        },
        { key: 'tile:shadow',       fn: _mcTexShadow       },
        { key: 'tile:portal',       fn: _mcTexPortal       },
        { key: 'tile:sky',          fn: _mcTexSky          },
        // Structures
        { key: 'tile:wall_stone',   fn: _mcTexWallStone    },
        { key: 'tile:wall_wood',    fn: _mcTexWallWood     },
        { key: 'tile:roof_tile',    fn: _mcTexRoofTile     },
        { key: 'tile:thatch',       fn: _mcTexThatch       },
    ];

    for (const { key, fn } of defs) {
        if (_mc.textureCache.has(key)) continue;
        const g = new PIXI.Graphics();
        fn(g, SIZE);
        const tex = _mc.app.renderer.generateTexture(g, {
            scaleMode: PIXI.SCALE_MODES.LINEAR,
            resolution: 1,
            region: new PIXI.Rectangle(0, 0, SIZE, SIZE),
        });
        g.destroy();
        _mc.textureCache.set(key, tex);
    }
}

function _mcTexStone(g, S) {
    // Gray base
    g.beginFill(0x666672, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Stone blocks 2x3
    const bw = S / 2, bh = S / 3;
    g.lineStyle(2, 0x3a3a42, 0.9);
    for (let row = 0; row < 3; row++) {
        const offset = (row % 2) === 0 ? 0 : bw / 2;
        for (let col = -1; col < 3; col++) {
            const x = col * bw + offset, y = row * bh;
            g.drawRect(x + 2, y + 2, bw - 4, bh - 4);
        }
    }
    // Mortar color
    g.lineStyle(2, 0x2a2a30, 0.7);
    for (let row = 0; row <= 3; row++) { g.moveTo(0, row * bh); g.lineTo(S, row * bh); }
    for (let row = 0; row < 3; row++) {
        const offset = (row % 2) === 0 ? 0 : bw / 2;
        for (let col = 0; col <= 3; col++) {
            g.moveTo(col * bw + offset, row * bh);
            g.lineTo(col * bw + offset, (row + 1) * bh);
        }
    }
}

function _mcTexWood(g, S) {
    // Wood base warm brown
    g.beginFill(0x8B5A2B, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Plank lines (horizontal)
    const plankH = S / 5;
    for (let i = 0; i <= 5; i++) {
        g.lineStyle(2, 0x4a2e10, 0.8);
        g.moveTo(0, i * plankH); g.lineTo(S, i * plankH);
    }
    // Grain lines within planks
    for (let row = 0; row < 5; row++) {
        g.lineStyle(1, 0x6a4020, 0.4);
        for (let grainX = 8; grainX < S; grainX += 14) {
            const y = row * plankH + 4;
            g.moveTo(grainX, y);
            g.bezierCurveTo(grainX + 3, y + plankH * 0.3, grainX - 3, y + plankH * 0.7, grainX, y + plankH - 4);
        }
    }
    // Plank vertical separators (staggered)
    g.lineStyle(2, 0x4a2e10, 0.6);
    for (let row = 0; row < 5; row++) {
        const offset = (row % 2) === 0 ? 0 : S / 2;
        g.moveTo(offset, row * plankH); g.lineTo(offset, (row + 1) * plankH);
    }
}

function _mcTexWater(g, S) {
    g.beginFill(0x0d3b6e, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Ripple lines
    for (let i = 0; i < 6; i++) {
        const y = (i / 6) * S + S / 12;
        g.lineStyle(1.5, 0x1a6ea8, 0.5);
        g.moveTo(4, y);
        g.bezierCurveTo(S * 0.25, y - 6, S * 0.5, y + 6, S * 0.75, y - 4);
        g.bezierCurveTo(S * 0.85, y - 6, S - 4, y, S - 4, y);
    }
    // Highlight shimmer dots
    g.lineStyle(0);
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x5bc4f5, 0.25);
        g.drawEllipse(14 + i * 16, S * 0.3 + (i % 3) * 18, 4, 2);
        g.endFill();
    }
}

function _mcTexGrass(g, S) {
    g.beginFill(0x2d6b3a, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Darker speckles / clumps
    for (let i = 0; i < 20; i++) {
        const x = (i * 37 + 11) % S;
        const y = (i * 53 + 7) % S;
        g.beginFill(0x1a4a22, 0.4 + (i % 3) * 0.1);
        g.drawEllipse(x, y, 5 + (i % 4), 3 + (i % 3));
        g.endFill();
    }
    // Lighter highlights
    for (let i = 0; i < 12; i++) {
        const x = (i * 61 + 20) % S;
        const y = (i * 43 + 15) % S;
        g.beginFill(0x4a9a5a, 0.3);
        g.drawEllipse(x, y, 4, 2);
        g.endFill();
    }
}

function _mcTexSand(g, S) {
    g.beginFill(0xc4a050, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Subtle grain dots
    for (let i = 0; i < 30; i++) {
        const x = (i * 41 + 9) % S;
        const y = (i * 59 + 3) % S;
        const bright = (i % 2) === 0;
        g.beginFill(bright ? 0xd4b870 : 0xa08030, 0.3);
        g.drawCircle(x, y, 1 + (i % 2));
        g.endFill();
    }
    // Wave texture lines
    for (let i = 0; i < 4; i++) {
        g.lineStyle(1, 0x9a7a30, 0.2);
        g.moveTo(0, i * (S / 4) + 8);
        g.bezierCurveTo(S * 0.3, i * (S / 4) + 4, S * 0.7, i * (S / 4) + 12, S, i * (S / 4) + 8);
    }
}

function _mcTexLava(g, S) {
    g.beginFill(0x3d0a00, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Orange vein lines
    g.lineStyle(2, 0xcc4400, 0.8);
    g.moveTo(0, S * 0.6); g.bezierCurveTo(S * 0.2, S * 0.4, S * 0.5, S * 0.7, S, S * 0.5);
    g.moveTo(S * 0.3, 0); g.bezierCurveTo(S * 0.4, S * 0.3, S * 0.6, S * 0.5, S * 0.8, S);
    g.lineStyle(1.5, 0xff6600, 0.6);
    g.moveTo(0, S * 0.3); g.bezierCurveTo(S * 0.4, S * 0.2, S * 0.6, S * 0.4, S, S * 0.8);
    // Bright glow dots at intersections
    g.lineStyle(0);
    const dots = [[S*0.35, S*0.55], [S*0.7, S*0.42], [S*0.2, S*0.38]];
    for (const [x, y] of dots) {
        g.beginFill(0xff9900, 0.7); g.drawCircle(x, y, 5); g.endFill();
        g.beginFill(0xffcc00, 0.4); g.drawCircle(x, y, 10); g.endFill();
    }
}

function _mcTexSnow(g, S) {
    g.beginFill(0xdce8f4, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Crystal patterns (6-pointed snowflake snippets)
    const centers = [[S*0.25,S*0.3],[S*0.7,S*0.65],[S*0.5,S*0.15],[S*0.15,S*0.7]];
    for (const [cx, cy] of centers) {
        g.lineStyle(1, 0x8ab8d8, 0.5);
        for (let a = 0; a < 6; a++) {
            const angle = (a / 6) * Math.PI * 2;
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(angle) * 10, cy + Math.sin(angle) * 10);
        }
    }
    // Shadow drifts
    for (let i = 0; i < 5; i++) {
        g.lineStyle(0);
        g.beginFill(0xb8d0e8, 0.18);
        g.drawEllipse((i * 31 + 12) % S, (i * 43 + 20) % S, 18, 7);
        g.endFill();
    }
}

function _mcTexDark(g, S) {
    g.beginFill(0x0d0d18, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Slight texture: barely visible stone shapes
    for (let i = 0; i < 8; i++) {
        g.lineStyle(1, 0x1a1a2e, 0.6);
        const x = (i * 37) % S, y = (i * 53) % S;
        g.drawRect(x, y, 20 + (i % 3) * 8, 14 + (i % 2) * 6);
    }
}

function _mcTexDirt(g, S) {
    g.beginFill(0x6b4226, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Small rock shapes
    for (let i = 0; i < 12; i++) {
        const x = (i * 43 + 5) % S;
        const y = (i * 57 + 11) % S;
        g.beginFill(0x4a2e16, 0.5);
        g.drawEllipse(x, y, 6 + (i % 4), 4 + (i % 3));
        g.endFill();
    }
    // Lighter soil patches
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x8a5a36, 0.3);
        const x = (i * 67 + 15) % S;
        const y = (i * 37 + 8) % S;
        g.drawEllipse(x, y, 8, 5);
        g.endFill();
    }
}

function _mcTexMarble(g, S) {
    g.beginFill(0xd4cfc8, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Dark vein lines
    g.lineStyle(1.5, 0x6a6060, 0.4);
    g.moveTo(0, S * 0.4); g.bezierCurveTo(S*0.3,S*0.3, S*0.6,S*0.5, S, S*0.35);
    g.moveTo(S*0.2, 0); g.bezierCurveTo(S*0.3,S*0.4, S*0.5,S*0.3, S*0.7, S);
    g.lineStyle(1, 0x8a8080, 0.25);
    g.moveTo(S*0.5, 0); g.bezierCurveTo(S*0.6,S*0.3, S*0.4,S*0.6, S*0.8, S);
    // White highlight streak
    g.lineStyle(2, 0xffffff, 0.2);
    g.moveTo(S*0.1, S*0.8); g.bezierCurveTo(S*0.3,S*0.6, S*0.7,S*0.4, S*0.9, S*0.2);
}

function _mcTexMoss(g, S) {
    g.beginFill(0x3a5a3a, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Pebble shapes
    for (let i = 0; i < 15; i++) {
        const x = (i * 41 + 8) % S;
        const y = (i * 53 + 14) % S;
        g.beginFill(0x2a3a2a, 0.5);
        g.drawEllipse(x, y, 8 + (i % 4), 6 + (i % 3));
        g.endFill();
    }
    // Moss highlights
    for (let i = 0; i < 10; i++) {
        g.beginFill(0x5a8a4a, 0.35);
        const x = (i * 59 + 4) % S;
        const y = (i * 31 + 20) % S;
        g.drawEllipse(x, y, 5, 3);
        g.endFill();
    }
}

function _mcTexIce(g, S) {
    g.beginFill(0xc8e8f0, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Crack lines
    g.lineStyle(1, 0x7abcd4, 0.5);
    g.moveTo(S*0.3, 0); g.lineTo(S*0.45, S*0.4); g.lineTo(S*0.6, S*0.6); g.lineTo(S*0.8, S);
    g.moveTo(0, S*0.5); g.lineTo(S*0.35, S*0.55); g.lineTo(S*0.5, S*0.4); g.lineTo(S, S*0.3);
    g.lineStyle(1, 0x4a9abf, 0.3);
    g.moveTo(S*0.1, S*0.2); g.lineTo(S*0.4, S*0.3); g.lineTo(S*0.55, S*0.7);
    // Glossy highlights
    for (let i = 0; i < 4; i++) {
        g.beginFill(0xffffff, 0.2);
        g.drawEllipse((i * 37 + 10) % S, (i * 29 + 8) % S, 10, 4);
        g.endFill();
    }
}

// ─── New tile textures: Dungeon ────────────────────────────────────────────

function _mcTexDungeon(g, S) {
    // Very dark flagstone floor with deep mortar lines
    g.beginFill(0x2a2a2e, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Rectangular stone blocks in a running bond pattern
    const bw = S / 2, bh = S / 3;
    g.lineStyle(0);
    for (let row = 0; row < 4; row++) {
        const offset = (row % 2 === 0) ? 0 : bw / 2;
        for (let col = -1; col < 3; col++) {
            const bx = col * bw + offset, by = row * bh;
            const shade = 0x323236 + (((row * 3 + col) % 4) * 0x050508);
            g.beginFill(shade, 1);
            g.drawRect(bx + 2, by + 2, bw - 4, bh - 4);
            g.endFill();
            // Inner shadow edge
            g.beginFill(0x1a1a1e, 0.5);
            g.drawRect(bx + 2, by + 2, bw - 4, 2);
            g.drawRect(bx + 2, by + 2, 2, bh - 4);
            g.endFill();
        }
    }
    // Mortar (dark lines)
    g.lineStyle(2, 0x111114, 1);
    for (let row = 0; row <= 4; row++) { g.moveTo(0, row * bh); g.lineTo(S, row * bh); }
    for (let row = 0; row < 4; row++) {
        const offset = (row % 2 === 0) ? 0 : bw / 2;
        for (let col = 0; col <= 3; col++) {
            g.moveTo(col * bw + offset, row * bh);
            g.lineTo(col * bw + offset, (row + 1) * bh);
        }
    }
    // Subtle green mold specks
    for (let i = 0; i < 6; i++) {
        g.beginFill(0x2a4a2a, 0.35);
        g.drawCircle((i * 37 + 9) % S, (i * 53 + 20) % S, 3);
        g.endFill();
    }
}

function _mcTexBrick(g, S) {
    // Red/brown brick wall
    g.beginFill(0x8a3a28, 1); g.drawRect(0, 0, S, S); g.endFill();
    const bw = S / 3, bh = S / 4;
    g.lineStyle(0);
    for (let row = 0; row < 5; row++) {
        const offset = (row % 2 === 0) ? 0 : bw / 2;
        for (let col = -1; col < 4; col++) {
            const bx = col * bw + offset, by = row * bh;
            const shade = (row + col) % 3 === 0 ? 0x9a4530 : (row + col) % 3 === 1 ? 0x7a2e1e : 0x8a3828;
            g.beginFill(shade, 1);
            g.drawRect(bx + 2, by + 2, bw - 4, bh - 4);
            g.endFill();
            // Highlight top-left
            g.beginFill(0xb05040, 0.3);
            g.drawRect(bx + 2, by + 2, bw - 4, 2);
            g.endFill();
        }
    }
    // Mortar
    g.lineStyle(2, 0x5a3020, 0.9);
    for (let row = 0; row <= 5; row++) { g.moveTo(0, row * bh); g.lineTo(S, row * bh); }
    for (let row = 0; row < 5; row++) {
        const offset = (row % 2 === 0) ? 0 : bw / 2;
        for (let col = 0; col <= 4; col++) {
            g.moveTo(col * bw + offset, row * bh); g.lineTo(col * bw + offset, (row + 1) * bh);
        }
    }
}

function _mcTexCobble(g, S) {
    // Rounded cobblestones, varied gray
    g.beginFill(0x4a4a4a, 1); g.drawRect(0, 0, S, S); g.endFill();
    const stones = [
        [12,10,10,8],[35,8,11,9],[60,12,10,8],[82,7,12,9],[105,10,10,8],[125,8,11,7],
        [8,30,12,9],[30,28,10,8],[52,32,11,9],[75,27,10,8],[98,31,12,9],[120,29,10,8],
        [15,50,11,9],[38,48,10,8],[60,52,12,9],[85,49,10,8],[108,50,11,9],[128,48,10,8],
        [10,70,12,8],[33,68,11,9],[56,72,10,8],[80,69,12,9],[103,71,11,8],[124,68,10,9],
        [8,90,10,8],[30,88,12,9],[55,92,11,8],[78,89,10,9],[102,90,12,8],[123,88,11,9],
        [12,108,11,9],[36,110,10,8],[60,107,12,9],[83,111,10,8],[106,108,11,9],[126,106,10,8],
        [8,128,12,8],[33,126,10,9],[57,130,11,8],[81,128,12,9],[104,127,10,8],[126,130,11,8],
    ];
    for (let i = 0; i < stones.length; i++) {
        const [cx, cy, rx, ry] = stones[i];
        const shade = 0x505050 + (i % 5) * 0x080808;
        g.beginFill(shade, 1);
        g.drawEllipse(cx, cy, rx, ry);
        g.endFill();
        g.beginFill(0x707070, 0.4);
        g.drawEllipse(cx - 2, cy - 2, rx * 0.5, ry * 0.4);
        g.endFill();
    }
    // Dark gap fill between stones
    g.lineStyle(1.5, 0x282828, 0.7);
    for (const [cx, cy, rx, ry] of stones) {
        g.drawEllipse(cx, cy, rx, ry);
    }
}

function _mcTexGravel(g, S) {
    // Loose gravel — muted gray/brown, many small dots and pebbles
    g.beginFill(0x6a6258, 1); g.drawRect(0, 0, S, S); g.endFill();
    for (let i = 0; i < 60; i++) {
        const x = (i * 37 + 7) % S, y = (i * 53 + 11) % S;
        const r = 1.5 + (i % 3);
        const col = i % 4 === 0 ? 0x807870 : i % 4 === 1 ? 0x504840 : i % 4 === 2 ? 0x787068 : 0x404038;
        g.beginFill(col, 0.85);
        g.drawEllipse(x, y, r, r * 0.75);
        g.endFill();
    }
    // Slightly lighter surface variation
    for (let i = 0; i < 20; i++) {
        g.beginFill(0x908880, 0.2);
        g.drawEllipse((i * 67 + 4) % S, (i * 41 + 17) % S, 4, 3);
        g.endFill();
    }
}

function _mcTexBlood(g, S) {
    // Stone floor with dark red blood splatters
    g.beginFill(0x555558, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Stone tile pattern (faint)
    const bw = S / 2, bh = S / 2;
    g.lineStyle(1, 0x3a3a3e, 0.6);
    for (let r = 0; r <= 2; r++) { g.moveTo(0, r * bh); g.lineTo(S, r * bh); }
    for (let c = 0; c <= 2; c++) { g.moveTo(c * bw, 0); g.lineTo(c * bw, S); }
    // Blood pools
    const splatters = [
        [S*0.3, S*0.4, 18, 12], [S*0.65, S*0.25, 14, 9], [S*0.15, S*0.65, 10, 7],
        [S*0.7, S*0.7, 16, 10], [S*0.45, S*0.7, 8, 5],
    ];
    g.lineStyle(0);
    for (const [bx, by, rx, ry] of splatters) {
        g.beginFill(0x6a0a0a, 0.9); g.drawEllipse(bx, by, rx, ry); g.endFill();
        g.beginFill(0x3a0505, 0.7); g.drawEllipse(bx + rx*0.2, by + ry*0.1, rx*0.5, ry*0.5); g.endFill();
    }
    // Drip lines
    g.lineStyle(1.5, 0x6a0a0a, 0.7);
    g.moveTo(S*0.3, S*0.4); g.lineTo(S*0.28, S*0.6);
    g.moveTo(S*0.65, S*0.25); g.lineTo(S*0.63, S*0.4);
}

function _mcTexBone(g, S) {
    // Pale bone/skull motif floor
    g.beginFill(0xdad0c0, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Bone shapes — elongated with round ends
    const bones = [[S*0.2,S*0.3,0.4],[S*0.6,S*0.2,1.1],[S*0.75,S*0.6,0.2],[S*0.25,S*0.7,0.8],[S*0.5,S*0.5,1.5]];
    g.lineStyle(0);
    for (const [bx, by, rot] of bones) {
        g.beginFill(0xb8a890, 0.7);
        // Bone shaft
        const cos = Math.cos(rot), sin = Math.sin(rot);
        const len = 16, r = 3;
        g.drawEllipse(bx + cos * (len/2), by + sin * (len/2), r*1.5, r);
        g.drawEllipse(bx - cos * (len/2), by - sin * (len/2), r*1.5, r);
        g.drawRect(bx - sin*r - cos*(len/2), by + cos*r - sin*(len/2), sin*r*2 + cos*len, -cos*r*2 + sin*len);
        g.endFill();
    }
    // Subtle cracks
    g.lineStyle(1, 0xa89880, 0.35);
    g.moveTo(S*0.1, S*0.1); g.lineTo(S*0.3, S*0.2); g.lineTo(S*0.25, S*0.45);
    g.moveTo(S*0.6, S*0.5); g.lineTo(S*0.8, S*0.6); g.lineTo(S*0.85, S*0.9);
    // Slightly yellowed tile joints
    g.lineStyle(1, 0xc8b8a0, 0.3);
    g.moveTo(0, S/2); g.lineTo(S, S/2);
    g.moveTo(S/2, 0); g.lineTo(S/2, S);
}

function _mcTexCrypt(g, S) {
    // Very dark stone with cracks, greenish mold tint
    g.beginFill(0x141818, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Large irregular stone slabs
    g.lineStyle(0);
    const slabs = [[2,2,S/2-4,S/3-4],[S/2+2,2,S/2-4,S/3-4],[2,S/3+2,S*0.6-4,S/3-4],[S*0.6+2,S/3+2,S*0.4-4,S/3-4],[2,S*2/3+2,S/3-4,S/3-4],[S/3+2,S*2/3+2,S*2/3-4,S/3-4]];
    for (let i = 0; i < slabs.length; i++) {
        const [sx, sy, sw, sh] = slabs[i];
        g.beginFill(0x1c2020 + i * 0x020202, 1);
        g.drawRect(sx, sy, sw, sh);
        g.endFill();
    }
    g.lineStyle(1.5, 0x080c0c, 1);
    for (const [sx, sy, sw, sh] of slabs) { g.drawRect(sx, sy, sw, sh); }
    // Crack lines
    g.lineStyle(1, 0x2a3830, 0.7);
    g.moveTo(S*0.1, S*0.05); g.lineTo(S*0.15, S*0.3); g.lineTo(S*0.08, S*0.55);
    g.moveTo(S*0.6, S*0.4); g.lineTo(S*0.7, S*0.65); g.lineTo(S*0.65, S*0.9);
    // Mold patches
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x1e3028, 0.5);
        g.drawEllipse((i * 41 + 11) % S, (i * 57 + 9) % S, 5 + (i % 3), 4);
        g.endFill();
    }
}

function _mcTexIron(g, S) {
    // Metal iron floor plates — dark gray, bolted seams, rivets at corners
    g.beginFill(0x3a3a3e, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Panel plates — 2x2 grid
    const pw = S / 2;
    g.lineStyle(0);
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const px = col * pw, py = row * pw;
            g.beginFill(0x404044 + ((row + col) % 2) * 0x080808, 1);
            g.drawRect(px + 3, py + 3, pw - 6, pw - 6);
            g.endFill();
            // Subtle brushed metal lines
            for (let li = 0; li < 5; li++) {
                g.lineStyle(0.5, 0x505054, 0.15);
                const ly = py + 8 + li * ((pw - 16) / 4);
                g.moveTo(px + 5, ly); g.lineTo(px + pw - 5, ly);
            }
            // Rivets at each corner
            const rivets = [[px+5,py+5],[px+pw-5,py+5],[px+5,py+pw-5],[px+pw-5,py+pw-5]];
            for (const [rx, ry] of rivets) {
                g.lineStyle(0);
                g.beginFill(0x282828, 1); g.drawCircle(rx, ry, 3.5); g.endFill();
                g.beginFill(0x606068, 0.8); g.drawCircle(rx - 1, ry - 1, 2); g.endFill();
            }
        }
    }
    // Seam lines
    g.lineStyle(2, 0x222226, 1);
    g.moveTo(0, pw); g.lineTo(S, pw);
    g.moveTo(pw, 0); g.lineTo(pw, S);
}

function _mcTexRust(g, S) {
    // Rusted metal — reddish-brown streaks over orange-gray
    g.beginFill(0x6a4830, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Base metal patches
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x504030, 0.6);
        g.drawRect((i * 37 + 5) % (S - 20), (i * 53 + 3) % (S - 15), 15 + (i%4)*5, 10 + (i%3)*4);
        g.endFill();
    }
    // Rust streaks (orange/brown)
    g.lineStyle(3, 0x8a3810, 0.6);
    g.moveTo(S*0.1, 0); g.lineTo(S*0.15, S*0.4); g.lineTo(S*0.1, S);
    g.moveTo(S*0.5, 0); g.lineTo(S*0.55, S*0.5); g.lineTo(S*0.48, S);
    g.moveTo(S*0.8, S*0.1); g.lineTo(S*0.82, S*0.6);
    g.lineStyle(1.5, 0xc06020, 0.4);
    g.moveTo(S*0.3, S*0.1); g.lineTo(S*0.28, S*0.5);
    g.moveTo(S*0.7, S*0.3); g.lineTo(S*0.72, S*0.8);
    // Rust blobs
    for (let i = 0; i < 10; i++) {
        g.lineStyle(0);
        g.beginFill(0x904020, 0.45);
        g.drawEllipse((i * 43 + 8) % S, (i * 61 + 6) % S, 6 + (i%4), 4 + (i%3));
        g.endFill();
    }
}

function _mcTexGrate(g, S) {
    // Metal grate — dark, grid lines with void below
    g.beginFill(0x0a0a10, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Subtle void depth
    for (let i = 0; i < 5; i++) {
        g.beginFill(0x050508 + i * 0x030303, 0.3);
        g.drawEllipse((i*28+14) % (S-10), (i*37+18) % (S-10), 12, 8);
        g.endFill();
    }
    // Grate bars — horizontal and vertical
    const barW = 5, gap = 14;
    g.lineStyle(0);
    for (let x = 0; x < S; x += gap) {
        g.beginFill(0x4a4a50, 1);
        g.drawRect(x, 0, barW, S);
        g.endFill();
        g.beginFill(0x606068, 0.5);
        g.drawRect(x + 1, 0, 1.5, S);
        g.endFill();
    }
    for (let y = 0; y < S; y += gap) {
        g.beginFill(0x4a4a50, 1);
        g.drawRect(0, y, S, barW);
        g.endFill();
        g.beginFill(0x606068, 0.5);
        g.drawRect(0, y + 1, S, 1.5);
        g.endFill();
    }
    // Intersection bolts
    for (let x = 0; x < S; x += gap) {
        for (let y = 0; y < S; y += gap) {
            g.beginFill(0x282830, 1);
            g.drawCircle(x + barW/2, y + barW/2, 2.5);
            g.endFill();
        }
    }
}

// ─── New tile textures: Exterior ───────────────────────────────────────────

function _mcTexMud(g, S) {
    // Dark wet mud — brown, smear marks
    g.beginFill(0x3a2a18, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Wet smear patches
    for (let i = 0; i < 12; i++) {
        const x = (i * 43 + 7) % S, y = (i * 59 + 13) % S;
        g.beginFill(0x4a3520, 0.5);
        g.drawEllipse(x, y, 12 + (i%5), 5 + (i%3));
        g.endFill();
    }
    // Dark puddle areas
    g.beginFill(0x281e10, 0.6); g.drawEllipse(S*0.3, S*0.5, 22, 14); g.endFill();
    g.beginFill(0x281e10, 0.5); g.drawEllipse(S*0.7, S*0.3, 16, 10); g.endFill();
    // Highlight sheen on wet surface
    g.beginFill(0x5a4530, 0.2); g.drawEllipse(S*0.3, S*0.48, 18, 10); g.endFill();
    g.beginFill(0x5a4530, 0.15); g.drawEllipse(S*0.7, S*0.28, 12, 7); g.endFill();
    // Track marks
    g.lineStyle(1, 0x201510, 0.5);
    g.moveTo(S*0.1, S*0.1); g.lineTo(S*0.2, S*0.4); g.lineTo(S*0.15, S*0.8);
}

function _mcTexSwamp(g, S) {
    // Swampy water — murky green-brown, lily pad shapes
    g.beginFill(0x1e2e18, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Murky water base with ripples
    for (let i = 0; i < 5; i++) {
        const y = (i / 5) * S + S / 10;
        g.lineStyle(1, 0x2a4020, 0.4);
        g.moveTo(0, y); g.bezierCurveTo(S*0.3, y-4, S*0.6, y+4, S, y-2);
    }
    // Lily pads
    const pads = [[S*0.2,S*0.3,12],[S*0.6,S*0.2,10],[S*0.7,S*0.65,14],[S*0.25,S*0.7,11],[S*0.5,S*0.5,8]];
    g.lineStyle(0);
    for (const [px, py, pr] of pads) {
        g.beginFill(0x2a5a20, 0.9); g.drawCircle(px, py, pr); g.endFill();
        // V-cut notch in lily pad
        g.beginFill(0x1e2e18, 1); g.drawPolygon([px, py, px+pr*0.7, py-pr*0.5, px+pr*0.7, py+pr*0.5]); g.endFill();
        // Lighter pad center
        g.beginFill(0x4a8030, 0.4); g.drawCircle(px, py, pr*0.4); g.endFill();
    }
    // Floating debris / algae
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x3a5828, 0.5);
        g.drawEllipse((i*41+10)%S, (i*53+5)%S, 4, 2);
        g.endFill();
    }
}

function _mcTexForest(g, S) {
    // Forest floor — brown earth, fallen leaves in amber/red/brown
    g.beginFill(0x3a2818, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Leaf shapes (many ellipses at various rotations)
    const leaves = [
        [S*0.15,S*0.2,9,5,0.3,  0xc87830], [S*0.4,S*0.1,8,4,1.0, 0xa85820],
        [S*0.65,S*0.25,10,5,0.5,0xd89040], [S*0.8,S*0.15,7,4,1.5,0xb86030],
        [S*0.1,S*0.45,9,4,0.8, 0x806028], [S*0.35,S*0.4,10,5,0.2,0xc06828],
        [S*0.6,S*0.5,8,4,1.2, 0x984820], [S*0.85,S*0.45,9,5,0.6,0xd07838],
        [S*0.2,S*0.65,7,4,1.0, 0xa85020], [S*0.5,S*0.6,10,5,1.7,0xc87030],
        [S*0.75,S*0.7,8,4,0.4, 0xb06028], [S*0.05,S*0.8,9,5,1.3,0xd09040],
        [S*0.3,S*0.85,7,4,0.9, 0x985020], [S*0.6,S*0.8,10,5,1.6,0xc07030],
        [S*0.9,S*0.75,8,4,0.3, 0xa86030], [S*0.45,S*0.85,9,5,1.1,0xb07838],
    ];
    for (const [lx, ly, rx, ry, rot, col] of leaves) {
        g.beginFill(col, 0.85);
        // Approximate rotated ellipse with a circle-ish shape
        g.drawEllipse(lx, ly, rx, ry);
        g.endFill();
        // Leaf vein
        g.lineStyle(0.5, col - 0x302010, 0.5);
        g.moveTo(lx - Math.cos(rot)*rx*0.8, ly - Math.sin(rot)*ry*0.8);
        g.lineTo(lx + Math.cos(rot)*rx*0.8, ly + Math.sin(rot)*ry*0.8);
    }
    // Roots / twig lines
    g.lineStyle(1.5, 0x2a1a0e, 0.4);
    g.moveTo(0, S*0.55); g.bezierCurveTo(S*0.2,S*0.5, S*0.5,S*0.6, S*0.8,S*0.52); g.lineTo(S,S*0.55);
}

function _mcTexPath(g, S) {
    // Dirt path/trail — light tan, worn smooth, lighter center
    g.beginFill(0xb09060, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Lighter center worn channel
    g.beginFill(0xc8a870, 0.5);
    g.drawRect(S*0.2, 0, S*0.6, S);
    g.endFill();
    g.beginFill(0xd4b87a, 0.3);
    g.drawRect(S*0.35, 0, S*0.3, S);
    g.endFill();
    // Pebbles scattered along edges
    for (let i = 0; i < 18; i++) {
        const edgePick = i % 2;
        const x = edgePick === 0 ? (i * 29 + 3) % (S * 0.2) : S * 0.8 + (i * 23 + 5) % (S * 0.2);
        const y = (i * 41 + 7) % S;
        g.beginFill(0x907850, 0.6);
        g.drawEllipse(x, y, 3 + (i%3), 2 + (i%2));
        g.endFill();
    }
    // Edge roughness marks
    g.lineStyle(1, 0x988060, 0.3);
    for (let i = 0; i < 6; i++) {
        const y = (i * S / 6) + 10;
        g.moveTo(0, y + (i%3)*3);
        g.bezierCurveTo(S*0.15, y-2, S*0.2, y+4, S*0.2, y);
    }
}

function _mcTexRock(g, S) {
    // Rocky terrain — jagged gray rocks, dark crevices
    g.beginFill(0x585858, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Large rock shapes (polygonal)
    const rocks = [
        [S*0.05,S*0.1, S*0.35,S*0.05, S*0.45,S*0.3, S*0.3,S*0.45, S*0.1,S*0.4],
        [S*0.5,S*0.05, S*0.8,S*0.1, S*0.9,S*0.35, S*0.75,S*0.5, S*0.55,S*0.4],
        [S*0.1,S*0.55, S*0.4,S*0.5, S*0.5,S*0.75, S*0.35,S*0.9, S*0.05,S*0.85],
        [S*0.55,S*0.55, S*0.85,S*0.5, S*0.95,S*0.8, S*0.75,S*0.95, S*0.5,S*0.85],
    ];
    for (let i = 0; i < rocks.length; i++) {
        g.lineStyle(1, 0x3a3a3a, 0.8);
        g.beginFill(0x606060 + i * 0x0c0c0c, 1);
        g.drawPolygon(rocks[i]);
        g.endFill();
        // Highlight
        g.beginFill(0x888888, 0.2);
        g.drawPolygon(rocks[i].map((v,j) => j%2===0 ? v+4 : v+3));
        g.endFill();
    }
    // Dark crevices between rocks
    g.lineStyle(2, 0x202020, 0.9);
    g.moveTo(S*0.45, S*0.3); g.lineTo(S*0.55, S*0.4); g.lineTo(S*0.55, S*0.55);
    g.moveTo(S*0.3, S*0.45); g.lineTo(S*0.1, S*0.55);
    g.moveTo(S*0.75, S*0.5); g.lineTo(S*0.85, S*0.5);
}

function _mcTexVolcanic(g, S) {
    // Volcanic rock — black, jagged, subtle red glow cracks
    g.beginFill(0x141414, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Dark rock base texture
    for (let i = 0; i < 10; i++) {
        g.beginFill(0x1c1c1c + (i%3)*0x060606, 0.7);
        g.drawPolygon([(i*31+5)%S, (i*47+3)%S, (i*31+20)%S, (i*47+3)%S, (i*31+15)%S, (i*47+16)%S]);
        g.endFill();
    }
    // Red lava crack lines (glowing)
    g.lineStyle(2, 0xcc2200, 0.8);
    g.moveTo(0, S*0.5); g.bezierCurveTo(S*0.2,S*0.4, S*0.4,S*0.6, S*0.6,S*0.45); g.lineTo(S, S*0.5);
    g.moveTo(S*0.4, 0); g.bezierCurveTo(S*0.45,S*0.2, S*0.35,S*0.4, S*0.4,S*0.45);
    g.lineStyle(1, 0xff4400, 0.5);
    g.moveTo(S*0.2, S*0.7); g.lineTo(S*0.35, S*0.6); g.lineTo(S*0.4, S*0.75);
    g.moveTo(S*0.6, S*0.2); g.lineTo(S*0.7, S*0.35);
    // Glow spots at cracks
    g.lineStyle(0);
    const glows = [[S*0.3,S*0.48],[S*0.6,S*0.46],[S*0.4,S*0.45]];
    for (const [gx, gy] of glows) {
        g.beginFill(0xff6600, 0.3); g.drawCircle(gx, gy, 8); g.endFill();
        g.beginFill(0xff2200, 0.5); g.drawCircle(gx, gy, 3); g.endFill();
    }
}

function _mcTexGravelPath(g, S) {
    // Light gravel path — light gray, small circle pebbles
    g.beginFill(0xb0b0a8, 1); g.drawRect(0, 0, S, S); g.endFill();
    for (let i = 0; i < 50; i++) {
        const x = (i * 41 + 9) % S, y = (i * 57 + 5) % S;
        const r = 2 + (i % 3);
        const col = i % 3 === 0 ? 0xc8c8c0 : i % 3 === 1 ? 0x909088 : 0xa8a8a0;
        g.beginFill(col, 0.9);
        g.drawCircle(x, y, r);
        g.endFill();
        g.beginFill(0xd0d0c8, 0.4);
        g.drawCircle(x - 0.5, y - 0.5, r * 0.4);
        g.endFill();
    }
}

function _mcTexDeepwater(g, S) {
    // Deep dark ocean — very dark blue, subtle swells
    g.beginFill(0x04111e, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Dark blue depth gradient feel
    g.beginFill(0x051828, 0.5); g.drawRect(0, S*0.3, S, S*0.7); g.endFill();
    // Swell lines
    for (let i = 0; i < 5; i++) {
        const y = (i / 5) * S + S / 10;
        g.lineStyle(1.5, 0x0a2840, 0.5);
        g.moveTo(0, y); g.bezierCurveTo(S*0.25, y-5, S*0.5, y+5, S*0.75, y-3); g.lineTo(S, y);
    }
    // Faint surface glints
    g.lineStyle(0);
    for (let i = 0; i < 5; i++) {
        g.beginFill(0x1848a0, 0.15);
        g.drawEllipse((i*31+12)%S, (i*43+8)%S, 10, 3);
        g.endFill();
    }
}

function _mcTexShallows(g, S) {
    // Shallow water — lighter blue-green, sandy floor visible
    g.beginFill(0x4899b8, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Sandy bottom (warm beige showing through)
    for (let i = 0; i < 12; i++) {
        g.beginFill(0x90b870, 0.15);
        g.drawEllipse((i*43+8)%S, (i*37+11)%S, 12, 8);
        g.endFill();
    }
    for (let i = 0; i < 8; i++) {
        g.beginFill(0xd4b870, 0.2);
        g.drawEllipse((i*57+15)%S, (i*41+20)%S, 9, 6);
        g.endFill();
    }
    // Surface ripples
    for (let i = 0; i < 5; i++) {
        const y = (i / 5) * S + S / 10;
        g.lineStyle(1, 0x78c8e0, 0.4);
        g.moveTo(4, y); g.bezierCurveTo(S*0.3, y-3, S*0.6, y+4, S-4, y-2);
    }
    g.lineStyle(0);
    // Glitter highlights
    for (let i = 0; i < 6; i++) {
        g.beginFill(0xe0f8ff, 0.3);
        g.drawEllipse((i*29+5)%S, (i*53+7)%S, 5, 2);
        g.endFill();
    }
}

function _mcTexMountain(g, S) {
    // Mountain stone — gray, stratified rock layers, horizontal lines
    g.beginFill(0x787878, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Stratified horizontal bands
    const bands = [0x686868, 0x7a7a7a, 0x6a6a6a, 0x7c7c7c, 0x686870, 0x787880];
    for (let i = 0; i < 6; i++) {
        g.beginFill(bands[i], 0.7);
        const y = i * (S / 6);
        const h = S / 6;
        // Slightly irregular band edges
        g.drawRect(0, y + (i % 2) * 2, S, h);
        g.endFill();
    }
    // Strata lines
    for (let i = 0; i <= 6; i++) {
        g.lineStyle(1, 0x505050, 0.6);
        const y = i * (S / 6) + (i % 2) * 2;
        g.moveTo(0, y); g.lineTo(S, y + (i%3) * 2);
    }
    // Vertical cracks
    g.lineStyle(1.5, 0x4a4a4a, 0.5);
    g.moveTo(S*0.25, 0); g.lineTo(S*0.22, S*0.4); g.lineTo(S*0.27, S*0.8);
    g.moveTo(S*0.65, S*0.1); g.lineTo(S*0.63, S*0.55); g.lineTo(S*0.68, S);
    // Highlight (bright top face of layers)
    for (let i = 0; i < 6; i++) {
        g.lineStyle(0);
        g.beginFill(0x909090, 0.15);
        g.drawRect(0, i*(S/6) + (i%2)*2, S, 2);
        g.endFill();
    }
}

// ─── New tile textures: Interior ──────────────────────────────────────────

function _mcTexCarpetRed(g, S) {
    // Rich crimson carpet, woven diamond pattern
    g.beginFill(0x8a1020, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Darker field base
    g.beginFill(0x6a0818, 0.4); g.drawRect(4, 4, S-8, S-8); g.endFill();
    // Diamond weave pattern
    const d = 14;
    g.lineStyle(1, 0xa82030, 0.5);
    for (let x = -d; x < S + d; x += d) {
        g.moveTo(x, 0); g.lineTo(x + S, S);
        g.moveTo(x, 0); g.lineTo(x - S, S);
    }
    // Diamond highlights
    g.lineStyle(0.5, 0xd04050, 0.3);
    for (let x = -d/2; x < S + d; x += d) {
        g.moveTo(x, 0); g.lineTo(x + S, S);
    }
    // Border stripe
    g.lineStyle(3, 0xc8283a, 0.8);
    g.drawRect(6, 6, S-12, S-12);
    g.lineStyle(1.5, 0xffa040, 0.5);
    g.drawRect(9, 9, S-18, S-18);
    // Center medallion hint
    g.lineStyle(0);
    g.beginFill(0xb02030, 0.5); g.drawCircle(S/2, S/2, 10); g.endFill();
    g.beginFill(0xd84050, 0.3); g.drawCircle(S/2, S/2, 6); g.endFill();
}

function _mcTexCarpetBlue(g, S) {
    // Deep navy/royal blue carpet, diamond pattern
    g.beginFill(0x12205a, 1); g.drawRect(0, 0, S, S); g.endFill();
    g.beginFill(0x0c1840, 0.4); g.drawRect(4, 4, S-8, S-8); g.endFill();
    const d = 14;
    g.lineStyle(1, 0x2038a0, 0.5);
    for (let x = -d; x < S + d; x += d) {
        g.moveTo(x, 0); g.lineTo(x + S, S);
        g.moveTo(x, 0); g.lineTo(x - S, S);
    }
    g.lineStyle(0.5, 0x4060d0, 0.3);
    for (let x = -d/2; x < S + d; x += d) {
        g.moveTo(x, 0); g.lineTo(x + S, S);
    }
    g.lineStyle(3, 0x2848c8, 0.8);
    g.drawRect(6, 6, S-12, S-12);
    g.lineStyle(1.5, 0xc0d0ff, 0.4);
    g.drawRect(9, 9, S-18, S-18);
    g.lineStyle(0);
    g.beginFill(0x1830a0, 0.5); g.drawCircle(S/2, S/2, 10); g.endFill();
    g.beginFill(0x4060d0, 0.3); g.drawCircle(S/2, S/2, 6); g.endFill();
}

function _mcTexTileFloor(g, S) {
    // White/cream ceramic tiles, square, dark thin grout
    g.beginFill(0xe8e0d4, 1); g.drawRect(0, 0, S, S); g.endFill();
    const tw = S / 4, th = S / 4;
    g.lineStyle(0);
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const shade = (row + col) % 2 === 0 ? 0xf0e8dc : 0xe0d8cc;
            g.beginFill(shade, 1);
            g.drawRect(col*tw + 1, row*th + 1, tw - 2, th - 2);
            g.endFill();
            // Highlight corner
            g.beginFill(0xffffff, 0.25);
            g.drawRect(col*tw + 2, row*th + 2, tw * 0.4, th * 0.2);
            g.endFill();
        }
    }
    // Grout lines
    g.lineStyle(1.5, 0xa09888, 0.8);
    for (let i = 0; i <= 4; i++) { g.moveTo(i*tw, 0); g.lineTo(i*tw, S); }
    for (let j = 0; j <= 4; j++) { g.moveTo(0, j*th); g.lineTo(S, j*th); }
}

function _mcTexParquet(g, S) {
    // Herringbone parquet floor — warm brown wood, angled planks
    g.beginFill(0xa06030, 1); g.drawRect(0, 0, S, S); g.endFill();
    const pw = 12, pl = 28;
    g.lineStyle(0);
    for (let row = -2; row < S / pw + 2; row++) {
        for (let col = -2; col < S / pw + 2; col++) {
            const isEven = (row + col) % 2 === 0;
            const ox = col * pw + (row % 2) * pw / 2;
            const oy = row * pw;
            g.beginFill(isEven ? 0xb07038 : 0x906028, 0.9);
            if (isEven) {
                // Horizontal plank
                g.drawRect(ox, oy, pl, pw - 1);
            } else {
                // Vertical plank
                g.drawRect(ox, oy, pw - 1, pl);
            }
            g.endFill();
            // Grain lines
            g.lineStyle(0.5, 0x785020, 0.3);
            if (isEven) {
                g.moveTo(ox + 4, oy + pw/2); g.lineTo(ox + pl - 4, oy + pw/2);
            } else {
                g.moveTo(ox + pw/2, oy + 4); g.lineTo(ox + pw/2, oy + pl - 4);
            }
        }
    }
    // Dark plank separation
    g.lineStyle(1, 0x603818, 0.5);
    for (let row = -2; row < S / pw + 2; row++) {
        for (let col = -2; col < S / pw + 2; col++) {
            const isEven = (row + col) % 2 === 0;
            const ox = col * pw + (row % 2) * pw / 2;
            const oy = row * pw;
            if (isEven) { g.drawRect(ox, oy, pl, pw - 1); }
            else { g.drawRect(ox, oy, pw - 1, pl); }
        }
    }
}

function _mcTexRug(g, S) {
    // Decorative rug — warm red/gold border, geometric center
    g.beginFill(0x8a2018, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Outer border
    g.lineStyle(4, 0xb87820, 0.9); g.drawRect(4, 4, S-8, S-8);
    g.lineStyle(2, 0xd4a030, 0.7); g.drawRect(8, 8, S-16, S-16);
    // Inner field
    g.lineStyle(0);
    g.beginFill(0x6a1410, 0.5); g.drawRect(12, 12, S-24, S-24); g.endFill();
    // Geometric center motif (diamond grid)
    const cx = S/2, cy = S/2;
    g.lineStyle(1.5, 0xc89020, 0.7);
    g.drawPolygon([cx, cy-24, cx+20, cy, cx, cy+24, cx-20, cy]);
    g.drawPolygon([cx, cy-16, cx+13, cy, cx, cy+16, cx-13, cy]);
    g.lineStyle(0);
    g.beginFill(0xd4a030, 0.6); g.drawCircle(cx, cy, 5); g.endFill();
    g.beginFill(0xffd060, 0.4); g.drawCircle(cx, cy, 3); g.endFill();
    // Corner decorations
    const corners = [[14,14],[S-14,14],[14,S-14],[S-14,S-14]];
    for (const [cx2, cy2] of corners) {
        g.lineStyle(1, 0xb87820, 0.6);
        g.drawPolygon([cx2, cy2-6, cx2+5, cy2, cx2, cy2+6, cx2-5, cy2]);
    }
}

function _mcTexStraw(g, S) {
    // Straw/hay tavern floor — yellow straw bundles
    g.beginFill(0xb89040, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Straw bundle lines (many thin diagonal/horizontal lines)
    for (let i = 0; i < 30; i++) {
        const y = (i * (S / 30)) + ((i % 3) * 1.5);
        const col = i % 3 === 0 ? 0xd4a848 : i % 3 === 1 ? 0xa07828 : 0xc89838;
        g.lineStyle(1.5, col, 0.6 + (i%3)*0.1);
        const curve = (i % 5 - 2) * 3;
        g.moveTo(0, y); g.bezierCurveTo(S*0.3, y+curve, S*0.7, y-curve, S, y);
    }
    // Darker clumps
    g.lineStyle(0);
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x906828, 0.3);
        g.drawEllipse((i*43+6)%S, (i*37+10)%S, 10, 5);
        g.endFill();
    }
    // Dust motes / highlight
    for (let i = 0; i < 6; i++) {
        g.beginFill(0xe0c060, 0.25);
        g.drawCircle((i*59+12)%S, (i*41+8)%S, 2);
        g.endFill();
    }
}

function _mcTexPlankDark(g, S) {
    // Dark hardwood floor planks — mahogany/walnut tone
    g.beginFill(0x4a2810, 1); g.drawRect(0, 0, S, S); g.endFill();
    const plankH = S / 5;
    for (let row = 0; row < 5; row++) {
        const y = row * plankH;
        const shade = row % 2 === 0 ? 0x502c12 : 0x44240e;
        g.beginFill(shade, 1);
        g.drawRect(0, y + 1, S, plankH - 2);
        g.endFill();
        // Grain lines
        for (let gx = 6; gx < S; gx += 18) {
            g.lineStyle(0.7, 0x38200c, 0.4);
            g.moveTo(gx, y + 3);
            g.bezierCurveTo(gx+2, y+plankH*0.35, gx-2, y+plankH*0.65, gx, y+plankH-3);
        }
        // Highlight top edge
        g.lineStyle(0);
        g.beginFill(0x7a4828, 0.2);
        g.drawRect(0, y + 1, S, 2);
        g.endFill();
    }
    // Plank separators
    g.lineStyle(2, 0x280e06, 0.8);
    for (let row = 0; row <= 5; row++) { g.moveTo(0, row * plankH); g.lineTo(S, row * plankH); }
    // Vertical end-cuts (staggered)
    g.lineStyle(1.5, 0x280e06, 0.5);
    for (let row = 0; row < 5; row++) {
        const offset = (row % 2) === 0 ? S * 0.6 : S * 0.35;
        g.moveTo(offset, row * plankH); g.lineTo(offset, (row+1) * plankH);
    }
}

function _mcTexFlagstoneInt(g, S) {
    // Interior flagstone — large irregular light gray stones
    g.beginFill(0xa8a0a0, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Irregular stone shapes (4-6 stones)
    const stones = [
        [2,2,S*0.45-3,S*0.55-3],
        [S*0.45+1,2,S*0.55-3,S*0.35-3],
        [S*0.45+1,S*0.35+1,S*0.55-3,S*0.25-3],
        [S*0.45+1,S*0.6+1,S*0.55-3,S*0.4-3],
        [2,S*0.55+1,S*0.3-3,S*0.45-3],
        [S*0.3+1,S*0.55+1,S*0.15-3,S*0.45-3],
        [S*0.45-S*0.15+1,S*0.55+1,S*0.3,S*0.45-3],
    ];
    const shades = [0xb0a8a8, 0xa8a0a0, 0xb8b0b0, 0xa0989a, 0xb8b0b0, 0xa8a0a0, 0xb0a8aa];
    for (let i = 0; i < stones.length; i++) {
        const [sx, sy, sw, sh] = stones[i];
        if (sw <= 0 || sh <= 0) continue;
        g.lineStyle(0);
        g.beginFill(shades[i % shades.length], 1);
        g.drawRect(sx, sy, sw, sh);
        g.endFill();
        // Highlight top-left
        g.beginFill(0xd0c8c8, 0.2);
        g.drawRect(sx + 1, sy + 1, sw * 0.5, 2);
        g.endFill();
    }
    // Grout
    g.lineStyle(2, 0x706868, 0.8);
    g.moveTo(0, S*0.55); g.lineTo(S, S*0.55);
    g.moveTo(S*0.45, 0); g.lineTo(S*0.45, S);
    g.moveTo(S*0.45, S*0.35); g.lineTo(S, S*0.35);
    g.moveTo(S*0.45, S*0.6); g.lineTo(S, S*0.6);
    g.moveTo(S*0.3, S*0.55); g.lineTo(S*0.3, S);
    g.moveTo(S*0.45-S*0.15, S*0.55); g.lineTo(S*0.45-S*0.15, S);
}

// ─── New tile textures: Magic/Special ─────────────────────────────────────

function _mcTexArcane(g, S) {
    // Glowing arcane runes — dark blue/black, subtle gold glow rune marks
    g.beginFill(0x080c1a, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Gold glow aura beneath runes
    const runeCenters = [[S*0.2,S*0.25],[S*0.7,S*0.2],[S*0.5,S*0.55],[S*0.15,S*0.7],[S*0.75,S*0.72]];
    g.lineStyle(0);
    for (const [rx, ry] of runeCenters) {
        g.beginFill(0xc09010, 0.08); g.drawCircle(rx, ry, 16); g.endFill();
        g.beginFill(0xd0a820, 0.12); g.drawCircle(rx, ry, 10); g.endFill();
    }
    // Rune-like angular shapes
    g.lineStyle(1.5, 0xd4a820, 0.75);
    // Rune 1 — angular Z-ish
    g.moveTo(S*0.12,S*0.18); g.lineTo(S*0.28,S*0.18); g.lineTo(S*0.12,S*0.32); g.lineTo(S*0.28,S*0.32);
    // Rune 2 — cross
    g.moveTo(S*0.65,S*0.13); g.lineTo(S*0.75,S*0.27); g.moveTo(S*0.75,S*0.13); g.lineTo(S*0.65,S*0.27);
    g.moveTo(S*0.7,S*0.1); g.lineTo(S*0.7,S*0.3);
    // Rune 3 — triangle
    g.drawPolygon([S*0.45,S*0.44, S*0.55,S*0.44, S*0.5,S*0.65]);
    // Rune 4 — diamond
    g.drawPolygon([S*0.1,S*0.7, S*0.2,S*0.64, S*0.22,S*0.76, S*0.1,S*0.82]);
    // Rune 5 — stepped
    g.moveTo(S*0.68,S*0.65); g.lineTo(S*0.8,S*0.65); g.lineTo(S*0.8,S*0.72); g.lineTo(S*0.7,S*0.72); g.lineTo(S*0.7,S*0.8); g.lineTo(S*0.82,S*0.8);
    // Connecting constellation dots
    g.lineStyle(1, 0x8060f0, 0.25);
    g.moveTo(S*0.2,S*0.25); g.lineTo(S*0.7,S*0.2); g.lineTo(S*0.5,S*0.55); g.lineTo(S*0.15,S*0.7); g.lineTo(S*0.75,S*0.72); g.lineTo(S*0.2,S*0.25);
}

function _mcTexVoid(g, S) {
    // Void/abyss — pitch black, faint star speckles, subtle purple tint
    g.beginFill(0x020208, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Purple nebula wisps
    g.beginFill(0x200840, 0.2); g.drawEllipse(S*0.3, S*0.4, 30, 20); g.endFill();
    g.beginFill(0x180630, 0.15); g.drawEllipse(S*0.7, S*0.6, 25, 18); g.endFill();
    // Star speckles
    g.lineStyle(0);
    for (let i = 0; i < 35; i++) {
        const x = (i * 37 + 11) % S, y = (i * 53 + 7) % S;
        const brightness = (i % 3 === 0) ? 0.9 : (i % 3 === 1) ? 0.5 : 0.25;
        const r = i % 5 === 0 ? 1.5 : 0.8;
        g.beginFill(0xffffff, brightness);
        g.drawCircle(x, y, r);
        g.endFill();
    }
    // Subtle purple tint specks
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x8040c0, 0.12);
        g.drawCircle((i*47+14)%S, (i*31+20)%S, 2 + (i%3));
        g.endFill();
    }
}

function _mcTexCrystal(g, S) {
    // Crystal cave floor — light blue/cyan, faceted crystalline shapes
    g.beginFill(0x8ad8e8, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Crystal facets
    const crystals = [
        [S*0.1, S*0.15, S*0.35, S*0.08, S*0.4, S*0.4, S*0.05, S*0.45],
        [S*0.5, S*0.05, S*0.8, S*0.18, S*0.85, S*0.45, S*0.55, S*0.5],
        [S*0.05, S*0.55, S*0.4, S*0.5, S*0.42, S*0.82, S*0.08, S*0.92],
        [S*0.52, S*0.55, S*0.88, S*0.5, S*0.92, S*0.88, S*0.48, S*0.92],
    ];
    const cols = [0xa8e8f8, 0x98d8f0, 0xb8f0ff, 0x88c8e0];
    for (let i = 0; i < crystals.length; i++) {
        g.lineStyle(1, 0x48a8c8, 0.8);
        g.beginFill(cols[i], 0.75);
        g.drawPolygon(crystals[i]);
        g.endFill();
        // Highlight face
        g.beginFill(0xffffff, 0.25);
        g.drawPolygon([crystals[i][0],crystals[i][1], crystals[i][2],crystals[i][3], (crystals[i][0]+crystals[i][2])/2,(crystals[i][1]+crystals[i][3])/2+5]);
        g.endFill();
    }
    // Inner glow
    g.lineStyle(0);
    g.beginFill(0xc0f4ff, 0.3); g.drawCircle(S*0.5, S*0.5, 20); g.endFill();
    g.beginFill(0xe8fcff, 0.2); g.drawCircle(S*0.5, S*0.5, 10); g.endFill();
}

function _mcTexNecrotic(g, S) {
    // Necrotic/death energy — near-black, sickly green/purple wisps
    g.beginFill(0x080a08, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Sickly green energy wisps
    g.lineStyle(1.5, 0x204818, 0.5);
    g.moveTo(0, S*0.3); g.bezierCurveTo(S*0.2,S*0.2, S*0.4,S*0.5, S*0.5,S*0.4); g.bezierCurveTo(S*0.6,S*0.3, S*0.8,S*0.5, S,S*0.4);
    g.moveTo(0, S*0.6); g.bezierCurveTo(S*0.3,S*0.5, S*0.5,S*0.7, S*0.7,S*0.6); g.lineTo(S,S*0.65);
    g.lineStyle(1, 0x482858, 0.5);
    g.moveTo(S*0.2, 0); g.bezierCurveTo(S*0.3,S*0.3, S*0.2,S*0.5, S*0.3,S*0.8);
    g.moveTo(S*0.7, S*0.1); g.bezierCurveTo(S*0.65,S*0.4, S*0.75,S*0.6, S*0.7,S);
    // Glow pools
    g.lineStyle(0);
    g.beginFill(0x183018, 0.3); g.drawEllipse(S*0.3, S*0.35, 20, 12); g.endFill();
    g.beginFill(0x301838, 0.25); g.drawEllipse(S*0.7, S*0.6, 18, 10); g.endFill();
    // Spore / particle dots
    for (let i = 0; i < 10; i++) {
        g.beginFill(i % 2 === 0 ? 0x2a6020 : 0x4a2858, 0.4);
        g.drawCircle((i*41+8)%S, (i*53+6)%S, 1.5);
        g.endFill();
    }
}

function _mcTexFire(g, S) {
    // Fire floor — orange/red flames, glowing embers
    g.beginFill(0x2a0800, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Deep orange glow base
    g.beginFill(0x7a1800, 0.6); g.drawRect(0, S*0.4, S, S*0.6); g.endFill();
    // Flame shapes (upward tapers)
    const flames = [
        [S*0.1, S*0.9, 10, 35],  [S*0.25, S*0.85, 14, 45], [S*0.4, S*0.9, 12, 40],
        [S*0.55, S*0.88, 11, 38],[S*0.7, S*0.92, 13, 42],  [S*0.85, S*0.88, 10, 36],
        [S*0.18, S*0.75, 8, 28], [S*0.48, S*0.78, 9, 30],  [S*0.72, S*0.76, 10, 32],
    ];
    for (const [fx, fy, fr, fh] of flames) {
        g.lineStyle(0);
        g.beginFill(0xff6600, 0.7);
        g.drawPolygon([fx - fr, fy, fx, fy - fh, fx + fr, fy]);
        g.endFill();
        g.beginFill(0xff9900, 0.5);
        g.drawPolygon([fx - fr*0.6, fy, fx, fy - fh*0.6, fx + fr*0.6, fy]);
        g.endFill();
        g.beginFill(0xffcc00, 0.4);
        g.drawPolygon([fx - fr*0.3, fy, fx, fy - fh*0.35, fx + fr*0.3, fy]);
        g.endFill();
    }
    // Ember glow dots
    for (let i = 0; i < 15; i++) {
        g.beginFill(0xff4400, 0.6);
        g.drawCircle((i*37+9)%S, S*0.7 + (i*23)%(S*0.3), 1.5);
        g.endFill();
    }
}

function _mcTexHoly(g, S) {
    // Holy ground — cream/white, gold cross/star patterns, soft glow
    g.beginFill(0xf8f0e0, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Soft golden glow center
    g.beginFill(0xfff4c0, 0.4); g.drawEllipse(S/2, S/2, 35, 35); g.endFill();
    g.beginFill(0xffeea0, 0.3); g.drawEllipse(S/2, S/2, 22, 22); g.endFill();
    // Central cross
    g.lineStyle(2.5, 0xc8a020, 0.8);
    g.moveTo(S/2, S*0.2); g.lineTo(S/2, S*0.8);
    g.moveTo(S*0.2, S/2); g.lineTo(S*0.8, S/2);
    // Star rays
    g.lineStyle(1.5, 0xd4b030, 0.5);
    for (let a = 0; a < 8; a++) {
        const angle = (a / 8) * Math.PI * 2 + Math.PI / 8;
        g.moveTo(S/2, S/2);
        g.lineTo(S/2 + Math.cos(angle) * 30, S/2 + Math.sin(angle) * 30);
    }
    // Corner decorations
    const corners = [[S*0.15,S*0.15],[S*0.85,S*0.15],[S*0.15,S*0.85],[S*0.85,S*0.85]];
    g.lineStyle(0);
    for (const [cx, cy] of corners) {
        g.beginFill(0xd4b030, 0.5); g.drawPolygon([cx,cy-8, cx+5,cy, cx,cy+8, cx-5,cy]); g.endFill();
        g.beginFill(0xfff0a0, 0.5); g.drawCircle(cx, cy, 3); g.endFill();
    }
    // Tile lines (subtle)
    g.lineStyle(1, 0xd4c898, 0.3);
    g.moveTo(S/2, 0); g.lineTo(S/2, S);
    g.moveTo(0, S/2); g.lineTo(S, S/2);
}

function _mcTexToxic(g, S) {
    // Toxic sludge — sickly green, bubbles/blobs
    g.beginFill(0x1a3010, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Sludge surface
    g.beginFill(0x2a5018, 0.7); g.drawEllipse(S*0.5, S*0.55, 45, 35); g.endFill();
    g.beginFill(0x387020, 0.5); g.drawEllipse(S*0.3, S*0.35, 30, 22); g.endFill();
    // Bubble / blob rings
    const bubbles = [[S*0.2,S*0.2,8],[S*0.6,S*0.15,6],[S*0.75,S*0.5,10],[S*0.4,S*0.7,7],[S*0.15,S*0.6,5],[S*0.85,S*0.8,8]];
    g.lineStyle(0);
    for (const [bx, by, br] of bubbles) {
        g.beginFill(0x3a7820, 0.7); g.drawCircle(bx, by, br); g.endFill();
        g.beginFill(0x70c040, 0.4); g.drawCircle(bx, by, br * 0.5); g.endFill();
        g.lineStyle(1, 0x50a030, 0.6); g.drawCircle(bx, by, br); g.lineStyle(0);
    }
    // Toxic drips / lines
    g.lineStyle(1.5, 0x60b830, 0.4);
    g.moveTo(0, S*0.4); g.bezierCurveTo(S*0.2,S*0.35, S*0.4,S*0.45, S,S*0.38);
    // Spatter dots
    for (let i = 0; i < 8; i++) {
        g.lineStyle(0);
        g.beginFill(0x90d030, 0.5);
        g.drawCircle((i*43+7)%S, (i*57+11)%S, 2);
        g.endFill();
    }
}

function _mcTexShadow(g, S) {
    // Shadow realm — dark gray/blue, blurred shadow tendrils
    g.beginFill(0x0e0e16, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Shadow tendril wisps
    g.lineStyle(2, 0x202030, 0.6);
    g.moveTo(0, S*0.2); g.bezierCurveTo(S*0.3,S*0.1, S*0.5,S*0.4, S*0.7,S*0.3); g.bezierCurveTo(S*0.85,S*0.25, S,S*0.4, S,S*0.4);
    g.moveTo(0, S*0.6); g.bezierCurveTo(S*0.2,S*0.55, S*0.4,S*0.7, S*0.6,S*0.6); g.lineTo(S,S*0.65);
    g.moveTo(S*0.3, 0); g.bezierCurveTo(S*0.4,S*0.3, S*0.3,S*0.6, S*0.4,S);
    g.lineStyle(1, 0x303048, 0.4);
    g.moveTo(S*0.7, 0); g.bezierCurveTo(S*0.65,S*0.35, S*0.8,S*0.6, S*0.7,S);
    // Dark pools
    g.lineStyle(0);
    g.beginFill(0x181820, 0.5); g.drawEllipse(S*0.25, S*0.45, 25, 15); g.endFill();
    g.beginFill(0x181828, 0.4); g.drawEllipse(S*0.7, S*0.65, 20, 12); g.endFill();
    // Dim motes
    for (let i = 0; i < 8; i++) {
        g.beginFill(0x4040608, 0.2);
        g.drawCircle((i*41+10)%S, (i*53+8)%S, 2);
        g.endFill();
    }
}

function _mcTexPortal(g, S) {
    // Magical portal — swirling purple/cyan rings
    g.beginFill(0x0a0415, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Outer glow
    g.beginFill(0x400880, 0.2); g.drawCircle(S/2, S/2, 55); g.endFill();
    g.beginFill(0x300660, 0.3); g.drawCircle(S/2, S/2, 44); g.endFill();
    // Swirl rings
    const rings = [42, 35, 28, 20, 13];
    const ringCols = [0x8020c0, 0x20a0e0, 0xa040d0, 0x10c0d0, 0xc060e0];
    for (let i = 0; i < rings.length; i++) {
        g.lineStyle(2.5 - i*0.2, ringCols[i], 0.6 + i*0.05);
        g.drawCircle(S/2, S/2, rings[i]);
    }
    // Inner core
    g.lineStyle(0);
    g.beginFill(0x80b8ff, 0.4); g.drawCircle(S/2, S/2, 8); g.endFill();
    g.beginFill(0xffffff, 0.6); g.drawCircle(S/2, S/2, 4); g.endFill();
    // Sparkle points around ring
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = 38;
        g.beginFill(0xd080ff, 0.7);
        g.drawCircle(S/2 + Math.cos(angle)*r, S/2 + Math.sin(angle)*r, 2);
        g.endFill();
    }
}

function _mcTexSky(g, S) {
    // Sky floor — light blue with fluffy white clouds
    g.beginFill(0x6aacdc, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Gradient feel — lighter center
    g.beginFill(0x9cc8ec, 0.3); g.drawEllipse(S/2, S/2, 50, 50); g.endFill();
    // Fluffy cloud puffs
    const clouds = [[S*0.25,S*0.3,18],[S*0.65,S*0.2,15],[S*0.5,S*0.65,20],[S*0.15,S*0.6,12],[S*0.8,S*0.6,14]];
    for (const [cx, cy, cr] of clouds) {
        g.lineStyle(0);
        g.beginFill(0xffffff, 0.7); g.drawCircle(cx, cy, cr); g.endFill();
        g.beginFill(0xffffff, 0.6); g.drawCircle(cx + cr*0.6, cy + cr*0.2, cr*0.75); g.endFill();
        g.beginFill(0xffffff, 0.6); g.drawCircle(cx - cr*0.55, cy + cr*0.25, cr*0.65); g.endFill();
        g.beginFill(0xe8f4ff, 0.5); g.drawEllipse(cx, cy + cr*0.5, cr*1.1, cr*0.5); g.endFill();
    }
    // Sun glint
    g.beginFill(0xfff890, 0.35); g.drawCircle(S*0.85, S*0.12, 10); g.endFill();
    g.beginFill(0xffff80, 0.5); g.drawCircle(S*0.85, S*0.12, 5); g.endFill();
}

// ─── New tile textures: Structures ────────────────────────────────────────

function _mcTexWallStone(g, S) {
    // Stone wall face — lighter gray ashlar block pattern with mortar
    g.beginFill(0x9898a0, 1); g.drawRect(0, 0, S, S); g.endFill();
    const bw = S / 2, bh = S / 2.5;
    g.lineStyle(0);
    for (let row = 0; row < 3; row++) {
        const offset = (row % 2 === 0) ? 0 : bw / 2;
        for (let col = -1; col < 3; col++) {
            const bx = col * bw + offset, by = row * bh;
            const shade = (row * 2 + col) % 3 === 0 ? 0xa8a8b0 : (row * 2 + col) % 3 === 1 ? 0x909098 : 0xa0a0a8;
            g.beginFill(shade, 1);
            g.drawRect(bx + 2, by + 2, bw - 4, bh - 4);
            g.endFill();
            // Highlight top
            g.beginFill(0xc0c0c8, 0.25);
            g.drawRect(bx + 2, by + 2, bw - 4, 3);
            g.endFill();
            // Shadow bottom
            g.beginFill(0x606068, 0.2);
            g.drawRect(bx + 2, by + bh - 5, bw - 4, 3);
            g.endFill();
        }
    }
    // Mortar
    g.lineStyle(2, 0x686870, 0.9);
    for (let row = 0; row <= 3; row++) { g.moveTo(0, row * bh); g.lineTo(S, row * bh); }
    for (let row = 0; row < 3; row++) {
        const offset = (row % 2 === 0) ? 0 : bw / 2;
        for (let col = 0; col <= 3; col++) {
            g.moveTo(col * bw + offset, row * bh); g.lineTo(col * bw + offset, (row + 1) * bh);
        }
    }
}

function _mcTexWallWood(g, S) {
    // Wooden wall/fence — vertical planks with nails
    g.beginFill(0x6a4020, 1); g.drawRect(0, 0, S, S); g.endFill();
    const pw = S / 5;
    g.lineStyle(0);
    for (let col = 0; col < 5; col++) {
        const shade = col % 2 === 0 ? 0x7a4a28 : 0x603818;
        g.beginFill(shade, 1);
        g.drawRect(col * pw + 1, 0, pw - 2, S);
        g.endFill();
        // Grain lines
        for (let gy = 8; gy < S; gy += 22) {
            g.lineStyle(0.7, 0x4a2e12, 0.35);
            g.moveTo(col * pw + 3, gy);
            g.bezierCurveTo(col*pw + pw/2, gy + 4, col*pw + pw - 3, gy - 2, col*pw + pw - 1, gy + 1);
        }
        // Nail dots (top and bottom)
        g.lineStyle(0);
        for (const ny of [10, S - 10]) {
            g.beginFill(0x282010, 1); g.drawCircle(col * pw + pw/2, ny, 2.5); g.endFill();
            g.beginFill(0x907850, 0.6); g.drawCircle(col * pw + pw/2 - 0.8, ny - 0.8, 1.2); g.endFill();
        }
    }
    // Plank separation lines
    g.lineStyle(2, 0x3a2010, 0.9);
    for (let col = 0; col <= 5; col++) { g.moveTo(col * pw, 0); g.lineTo(col * pw, S); }
}

function _mcTexRoofTile(g, S) {
    // Roof tiles — terracotta/clay overlapping arc tiles
    g.beginFill(0xb84830, 1); g.drawRect(0, 0, S, S); g.endFill();
    const tw = S / 3, th = S / 4;
    g.lineStyle(0);
    for (let row = -1; row < 5; row++) {
        const offset = (row % 2 === 0) ? 0 : tw / 2;
        for (let col = -1; col < 4; col++) {
            const tx = col * tw + offset, ty = row * th;
            const shade = (row + col) % 3 === 0 ? 0xc05038 : (row + col) % 3 === 1 ? 0xa84028 : 0xb84830;
            g.beginFill(shade, 1);
            // Arc shape: rectangle with rounded bottom
            g.drawRect(tx + 1, ty, tw - 2, th - 2);
            g.endFill();
            // Curved arc shadow at bottom of tile
            g.beginFill(0x803020, 0.5);
            g.drawEllipse(tx + tw/2, ty + th - 2, tw/2 - 1, 5);
            g.endFill();
            // Highlight top
            g.beginFill(0xd06848, 0.3);
            g.drawRect(tx + 2, ty + 1, tw - 4, th * 0.35);
            g.endFill();
        }
    }
    // Ridge lines between rows
    g.lineStyle(1.5, 0x7a2818, 0.7);
    for (let row = 0; row <= 5; row++) { g.moveTo(0, row * th); g.lineTo(S, row * th); }
}

function _mcTexThatch(g, S) {
    // Thatched roof — irregular golden straw bundles
    g.beginFill(0xa88030, 1); g.drawRect(0, 0, S, S); g.endFill();
    // Horizontal straw bundle layers (overlapping)
    const bundleH = S / 5;
    for (let row = 0; row < 6; row++) {
        const y = row * bundleH;
        const col = row % 3 === 0 ? 0xc09840 : row % 3 === 1 ? 0x907028 : 0xb08838;
        // Many thin straw strands per row
        for (let strand = 0; strand < 20; strand++) {
            const sx = (strand * (S / 20));
            const curve = (strand % 5 - 2) * 2;
            g.lineStyle(1.5 + (strand % 2) * 0.5, col - (strand % 3) * 0x0a0a08, 0.6 + (strand % 3) * 0.1);
            g.moveTo(sx, y + bundleH * 0.2);
            g.bezierCurveTo(sx + 3, y + bundleH*0.4 + curve, sx - 2, y + bundleH*0.75 + curve, sx + 1, y + bundleH);
        }
        // Overlap shadow line
        g.lineStyle(0);
        g.beginFill(0x704820, 0.2);
        g.drawRect(0, y + bundleH - 4, S, 6);
        g.endFill();
    }
    // Highlight on each bundle top
    for (let row = 0; row < 6; row++) {
        g.beginFill(0xe0b850, 0.15);
        g.drawRect(0, row * bundleH, S, 4);
        g.endFill();
    }
}

// ─── Canvas resize ─────────────────────────────────────────────────────────

function _mcResizeCanvas() {
    if (!_mc.app) return;
    try { _mc.app.resize(); } catch (_) {}
}

// ─── Viewport ──────────────────────────────────────────────────────────────

function _mcApplyViewport() {
    if (!_mc.stage.world) return;
    _mc.stage.world.position.set(_mc.pan.x, _mc.pan.y);
    _mc.stage.world.scale.set(_mc.zoom, _mc.zoom);
}

function _mcZoomAt(sx, sy, delta) {
    const factor  = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(10, Math.max(0.08, _mc.zoom * factor));
    const wx = (sx - _mc.pan.x) / _mc.zoom;
    const wy = (sy - _mc.pan.y) / _mc.zoom;
    _mc.pan.x = sx - wx * newZoom;
    _mc.pan.y = sy - wy * newZoom;
    _mc.zoom  = newZoom;
    _mcApplyViewport();
    _mcSyncStatusBar();
}

function _mcScreenToWorld(sx, sy) {
    return {
        x: (sx - _mc.pan.x) / _mc.zoom,
        y: (sy - _mc.pan.y) / _mc.zoom,
    };
}

function _mcSnapToGrid(x, y) {
    if (!_mc.scene.grid.enabled) return { x, y };
    const s = _mc.scene.grid.size;
    return { x: Math.round(x / s) * s, y: Math.round(y / s) * s };
}

// ─── Render: escena completa ────────────────────────────────────────────────

function _mcRenderAll() {
    _mcRenderBackground();
    _mcRenderGrid();
    _mcRenderDrawings();
    _mcRenderTiles();
    _mcRenderWalls();
    _mcRenderDoors();
    _mcRenderNotes();
    _mcRenderFog();
    _mcRenderUI();
}

function _mcRenderBackground() {
    const c = _mc.stage.background;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    const { type, color, url, width, height } = _mc.scene.background;

    if (type === 'color') {
        const col = parseInt((color || '#1a1a2e').replace('#', ''), 16);
        const g = new PIXI.Graphics();
        g.beginFill(col, 1);
        g.drawRect(0, 0, width, height);
        g.endFill();
        c.addChild(g);
    } else if (type === 'image' && url) {
        const sprite = PIXI.Sprite.from(url);
        sprite.width  = width;
        sprite.height = height;
        c.addChild(sprite);
    } else {
        const g = new PIXI.Graphics();
        g.beginFill(0x1a1a2e, 1);
        g.drawRect(0, 0, width, height);
        g.endFill();
        c.addChild(g);
    }

    const border = new PIXI.Graphics();
    border.lineStyle(1.5, 0x3a3a5c, 1);
    border.drawRect(0, 0, width, height);
    c.addChild(border);
}

function _mcRenderGrid() {
    const g = _mc.stage.grid;
    g.clear();
    const { enabled, size, color, alpha } = _mc.scene.grid;
    if (!enabled) return;

    const { width, height } = _mc.scene.background;
    const col = parseInt((color || '#ffffff').replace('#', ''), 16);
    g.lineStyle(1, col, alpha);

    for (let x = 0; x <= width; x += size) { g.moveTo(x, 0); g.lineTo(x, height); }
    for (let y = 0; y <= height; y += size) { g.moveTo(0, y); g.lineTo(width, y); }
}

function _mcRenderDrawings() {
    const c = _mc.stage.drawings;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    if (!_mc.scene.drawings) return;

    for (const d of _mc.scene.drawings) {
        const sel = _mc.selection?.type === 'drawing' && _mc.selection.id === d.id;
        const g   = new PIXI.Graphics();
        const fillColor  = typeof d.fillColor === 'number' ? d.fillColor : 0x3a5a8a;
        const fillAlpha  = d.fillAlpha !== undefined ? d.fillAlpha : 0.55;
        const strokeColor = typeof d.strokeColor === 'number' ? d.strokeColor : 0x7ab3e0;
        const strokeWidth = d.strokeWidth !== undefined ? d.strokeWidth : 2;

        if (strokeWidth > 0) {
            g.lineStyle(strokeWidth, sel ? 0xffd700 : strokeColor, 1);
        }
        g.beginFill(fillColor, fillAlpha);

        if (d.type === 'rect') {
            g.drawRect(d.x, d.y, d.width, d.height);
        } else if (d.type === 'ellipse') {
            g.drawEllipse(d.x + d.width / 2, d.y + d.height / 2, d.width / 2, d.height / 2);
        }

        g.endFill();
        g.eventMode = 'none';
        c.addChild(g);
    }
}

function _mcRenderTiles() {
    const c = _mc.stage.tiles;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    for (const tile of _mc.scene.tiles) {
        const texture = _mcGetTexture(tile.url);
        const sprite  = new PIXI.Sprite(texture);
        // Use center anchor so rotation works correctly
        sprite.anchor.set(0.5, 0.5);
        sprite.x        = tile.x + tile.width / 2;
        sprite.y        = tile.y + tile.height / 2;
        sprite.width    = tile.width;
        sprite.height   = tile.height;
        sprite.rotation = tile.rotation || 0;
        sprite.alpha    = tile.alpha !== undefined ? tile.alpha : 1;
        sprite.eventMode = 'none';
        c.addChild(sprite);
    }
}

function _mcRenderWalls() {
    const g = _mc.stage.walls;
    g.clear();

    for (const wall of _mc.scene.walls) {
        const sel   = _mc.selection?.type === 'wall' && _mc.selection.id === wall.id;
        const col   = sel ? 0xffd700 : (wall.type === 'window' ? 0x3b82f6 : 0xef4444);
        const thick = wall.type === 'window' ? 2 : 3;
        g.lineStyle(thick, col, 1);
        g.moveTo(wall.x1, wall.y1);
        g.lineTo(wall.x2, wall.y2);
        g.lineStyle(0);
        g.beginFill(col, 1);
        g.drawCircle(wall.x1, wall.y1, 5);
        g.drawCircle(wall.x2, wall.y2, 5);
        g.endFill();
    }

    // Wall chain preview (chaining mode)
    if (_mc.wallChain && _mc.wallChain.previewEnd) {
        const { lastPoint, previewEnd } = _mc.wallChain;
        g.lineStyle(0);
        g.beginFill(0xffd700, 0.9);
        g.drawCircle(lastPoint.x, lastPoint.y, 6);
        g.endFill();
        // Dashed preview line
        _mcDrawDashedLine(g, lastPoint.x, lastPoint.y, previewEnd.x, previewEnd.y, 10, 6, 0xffd700, 0.7, 2);
    }

    // Legacy single-drag wall in progress
    if (_mc.wallDrawing) {
        g.lineStyle(2, 0xef4444, 0.55);
        g.moveTo(_mc.wallDrawing.x1, _mc.wallDrawing.y1);
        g.lineTo(_mc.wallDrawing.x2, _mc.wallDrawing.y2);
    }
}

function _mcDrawDashedLine(g, x1, y1, x2, y2, dashLen, gapLen, color, alpha, width) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const nx = dx / len, ny = dy / len;
    let pos = 0, drawing = true;
    while (pos < len) {
        const segLen = Math.min(drawing ? dashLen : gapLen, len - pos);
        if (drawing) {
            g.lineStyle(width || 2, color || 0xffd700, alpha !== undefined ? alpha : 1);
            g.moveTo(x1 + nx * pos, y1 + ny * pos);
            g.lineTo(x1 + nx * (pos + segLen), y1 + ny * (pos + segLen));
        }
        pos += segLen;
        drawing = !drawing;
    }
    g.lineStyle(0);
}

function _mcRenderDoors() {
    const c = _mc.stage.doors;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    for (const door of _mc.scene.doors) {
        const sel = _mc.selection?.type === 'door' && _mc.selection.id === door.id;
        const col = sel ? 0xffd700 : (door.open ? 0x22c55e : 0xf97316);
        const g   = new PIXI.Graphics();
        g.lineStyle(3, col, 1);
        g.moveTo(-16, 0);
        g.lineTo(16, 0);
        g.lineStyle(0);
        g.beginFill(col);
        g.drawCircle(0, 0, 7);
        g.endFill();
        g.x        = door.x;
        g.y        = door.y;
        g.rotation = door.rotation || 0;
        g.eventMode = 'none';
        c.addChild(g);
    }
}

function _mcRenderNotes() {
    const c = _mc.stage.notes;
    c.removeChildren().forEach(ch => ch.destroy({ children: true }));

    for (const note of _mc.scene.notes) {
        const sel = _mc.selection?.type === 'note' && _mc.selection.id === note.id;
        const col = sel ? 0xffd700 : 0xfbbf24;
        const g   = new PIXI.Graphics();
        g.lineStyle(2, col, 1);
        g.beginFill(0x1e1e2e, 0.9);
        g.drawRoundedRect(-15, -15, 30, 30, 5);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(col);
        g.drawCircle(0, -2, 5);
        g.drawPolygon([-3, 3, 3, 3, 0, 9]);
        g.endFill();

        if (note.text) {
            const lbl = new PIXI.Text(note.text.slice(0, 18), new PIXI.TextStyle({
                fontFamily: 'sans-serif', fontSize: 10, fill: '#ffffff',
                wordWrap: true, wordWrapWidth: 110,
            }));
            lbl.anchor.set(0.5, 0);
            lbl.y = 18;
            g.addChild(lbl);
        }

        g.x = note.x;
        g.y = note.y;
        g.eventMode = 'none';
        c.addChild(g);
    }
}

function _mcRenderFog() {
    const g = _mc.stage.fog;
    g.clear();
    if (!_mc.scene.fog.enabled) return;

    const { width, height } = _mc.scene.background;
    g.beginFill(0x000000, 0.78);
    g.drawRect(0, 0, width, height);

    for (const region of _mc.scene.fog.regions) {
        if (!region.revealed) continue;
        if (region.type === 'circle') {
            const pts = [];
            const segs = 32;
            for (let i = 0; i < segs; i++) {
                const a = (i / segs) * Math.PI * 2;
                pts.push(region.cx + Math.cos(a) * region.r, region.cy + Math.sin(a) * region.r);
            }
            g.beginHole();
            g.drawPolygon(pts);
            g.endHole();
        }
    }

    g.endFill();
}

// ─── UI handles (selection, resize, rotation) ──────────────────────────────

function _mcRenderUI() {
    const h = _mc.stage.uiHandles;
    h.clear();

    if (!_mc.selection) return;

    const bounds = _mcGetSelectedBounds();
    if (!bounds) return;

    const { x, y, w, height } = bounds;

    // Gold selection outline
    h.lineStyle(1.5, 0xffd700, 0.85);
    h.beginFill(0, 0);
    h.drawRect(x, y, w, height);
    h.endFill();

    // 8 resize handles (white squares)
    const handles = _mcGetBoundsHandles({ x, y, w, height });
    h.lineStyle(1, 0x000000, 0.5);
    h.beginFill(0xffffff, 1);
    for (const handle of handles) {
        if (handle.id === 'rot') continue;
        h.drawRect(handle.wx - 5, handle.wy - 5, 10, 10);
    }
    h.endFill();

    // Rotation handle (circle above top-center)
    const rotHandle = handles.find(hh => hh.id === 'rot');
    if (rotHandle) {
        // Dashed line from top-center to rot handle
        _mcDrawDashedLine(h, x + w / 2, y, rotHandle.wx, rotHandle.wy, 6, 4, 0xffd700, 0.5, 1);
        h.lineStyle(1.5, 0xffd700, 0.9);
        h.beginFill(0x1e1e2e, 1);
        h.drawCircle(rotHandle.wx, rotHandle.wy, 7);
        h.endFill();
        h.lineStyle(1, 0xffd700, 0.8);
        h.beginFill(0xffd700, 1);
        h.drawCircle(rotHandle.wx, rotHandle.wy, 3);
        h.endFill();
    }
}

function _mcGetBoundsHandles(bounds) {
    const { x, y, w, height } = bounds;
    const cx = x + w / 2, cy = y + height / 2;
    return [
        { id: 'nw', wx: x,       wy: y,          cursor: 'nw-resize' },
        { id: 'n',  wx: cx,      wy: y,          cursor: 'n-resize'  },
        { id: 'ne', wx: x + w,   wy: y,          cursor: 'ne-resize' },
        { id: 'e',  wx: x + w,   wy: cy,         cursor: 'e-resize'  },
        { id: 'se', wx: x + w,   wy: y + height, cursor: 'se-resize' },
        { id: 's',  wx: cx,      wy: y + height, cursor: 's-resize'  },
        { id: 'sw', wx: x,       wy: y + height, cursor: 'sw-resize' },
        { id: 'w',  wx: x,       wy: cy,         cursor: 'w-resize'  },
        { id: 'rot',wx: cx,      wy: y - 35,     cursor: 'crosshair' },
    ];
}

function _mcGetHandleAt(wx, wy) {
    const bounds = _mcGetSelectedBounds();
    if (!bounds) return null;
    const handles = _mcGetBoundsHandles(bounds);
    for (const handle of handles) {
        if (Math.hypot(wx - handle.wx, wy - handle.wy) <= 10) return handle;
    }
    return null;
}

function _mcGetSelectedBounds() {
    if (!_mc.selection) return null;
    const { type, id } = _mc.selection;

    if (type === 'tile') {
        const tile = _mc.scene.tiles.find(t => t.id === id);
        if (!tile) return null;
        return { x: tile.x, y: tile.y, w: tile.width, height: tile.height };
    }

    if (type === 'drawing') {
        const d = _mc.scene.drawings.find(dr => dr.id === id);
        if (!d) return null;
        return { x: d.x, y: d.y, w: d.width, height: d.height };
    }

    return null;
}

function _mcUpdateCursor(wx, wy) {
    const canvas = _mc.app?.view;
    if (!canvas) return;

    if (_mc.selection && _mc.tool === 'select') {
        const handle = _mcGetHandleAt(wx, wy);
        if (handle) {
            canvas.style.cursor = handle.cursor;
            return;
        }
    }

    const hit = _mcHitTest(wx, wy);
    if (hit) {
        canvas.style.cursor = 'grab';
    } else {
        canvas.style.cursor = 'default';
    }
}

// ─── Texture cache ─────────────────────────────────────────────────────────

function _mcGetTexture(url) {
    if (!url) return PIXI.Texture.WHITE;

    // Check built-in texture keys first
    if (_mc.textureCache.has(url)) return _mc.textureCache.get(url);

    let texture;
    if (url.startsWith('color:')) {
        const col = parseInt(url.replace('color:', ''), 16);
        const g   = new PIXI.Graphics();
        g.beginFill(col, 1);
        g.drawRect(0, 0, 64, 64);
        g.endFill();
        texture = _mc.app.renderer.generateTexture(g);
        g.destroy();
    } else if (url) {
        texture = PIXI.Texture.from(url);
    } else {
        texture = PIXI.Texture.WHITE;
    }

    _mc.textureCache.set(url, texture);
    return texture;
}

function _mcClearTextureCache() {
    for (const [key, tex] of _mc.textureCache) {
        // Don't destroy built-in tile textures — keep them alive for reuse
        if (key.startsWith('tile:')) continue;
        if (tex && !tex.destroyed && tex !== PIXI.Texture.WHITE) tex.destroy();
    }
    // Only remove non-tile entries
    for (const key of [..._mc.textureCache.keys()]) {
        if (!key.startsWith('tile:')) _mc.textureCache.delete(key);
    }
}

// ─── Hit testing ──────────────────────────────────────────────────────────

function _mcHitTest(wx, wy) {
    // Tiles — de arriba a abajo (el último añadido está encima)
    for (let i = _mc.scene.tiles.length - 1; i >= 0; i--) {
        const t = _mc.scene.tiles[i];
        // For rotated tiles, use an axis-aligned bounding box check (close enough for selection)
        if (wx >= t.x && wx <= t.x + t.width && wy >= t.y && wy <= t.y + t.height) {
            return { type: 'tile', id: t.id };
        }
    }
    // Drawings
    if (_mc.scene.drawings) {
        for (let i = _mc.scene.drawings.length - 1; i >= 0; i--) {
            const d = _mc.scene.drawings[i];
            if (_mcPointInDrawing(wx, wy, d)) return { type: 'drawing', id: d.id };
        }
    }
    // Puertas
    for (const d of _mc.scene.doors) {
        if (Math.hypot(wx - d.x, wy - d.y) < 16) return { type: 'door', id: d.id };
    }
    // Notas
    for (const n of _mc.scene.notes) {
        if (Math.abs(wx - n.x) < 16 && Math.abs(wy - n.y) < 16) return { type: 'note', id: n.id };
    }
    // Muros
    for (const w of _mc.scene.walls) {
        if (_mcDistToSegment(wx, wy, w.x1, w.y1, w.x2, w.y2) < 10) return { type: 'wall', id: w.id };
    }
    return null;
}

function _mcPointInDrawing(wx, wy, d) {
    if (d.type === 'rect') {
        return wx >= d.x && wx <= d.x + d.width && wy >= d.y && wy <= d.y + d.height;
    }
    if (d.type === 'ellipse') {
        const cx = d.x + d.width / 2, cy = d.y + d.height / 2;
        const rx = d.width / 2, ry = d.height / 2;
        if (rx <= 0 || ry <= 0) return false;
        return ((wx - cx) * (wx - cx)) / (rx * rx) + ((wy - cy) * (wy - cy)) / (ry * ry) <= 1;
    }
    return false;
}

function _mcDistToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

function _mcGetObject(type, id) {
    if (type === 'tile')    return _mc.scene.tiles.find(t => t.id === id);
    if (type === 'wall')    return _mc.scene.walls.find(w => w.id === id);
    if (type === 'door')    return _mc.scene.doors.find(d => d.id === id);
    if (type === 'note')    return _mc.scene.notes.find(n => n.id === id);
    if (type === 'drawing') return (_mc.scene.drawings || []).find(dr => dr.id === id);
    return null;
}

// ─── Selection ─────────────────────────────────────────────────────────────

function _mcSelectObject(type, id) {
    _mc.selection = { type, id };
    _mcRenderWalls();
    _mcRenderDoors();
    _mcRenderNotes();
    _mcRenderDrawings();
    _mcRenderUI();
    if (_mc.panelTab !== 'props') mcPanelTab('props');
    else _mcUpdatePropertiesPanel();
}

function _mcDeselect() {
    if (!_mc.selection) return;
    _mc.selection = null;
    _mcRenderWalls();
    _mcRenderDoors();
    _mcRenderNotes();
    _mcRenderDrawings();
    _mcRenderUI();
    _mcUpdatePropertiesPanel();
}

// ─── Context menu ─────────────────────────────────────────────────────────

function _mcShowContextMenu(cx, cy) {
    const menu = document.getElementById('mcContextMenu');
    if (!menu) return;

    // Build items based on selection
    const hasSelection = !!_mc.selection;
    const isTileOrDrawing = hasSelection &&
        (_mc.selection.type === 'tile' || _mc.selection.type === 'drawing');

    let items = '';
    if (hasSelection) {
        items += `<div class="mc-ctx-item" onclick="_mcCtxAction('delete')">Eliminar</div>`;
        if (isTileOrDrawing) {
            items += `<div class="mc-ctx-item" onclick="_mcCtxAction('duplicate')">Duplicar</div>`;
            items += `<div class="mc-ctx-sep"></div>`;
            items += `<div class="mc-ctx-item" onclick="_mcCtxAction('front')">Traer al frente</div>`;
            items += `<div class="mc-ctx-item" onclick="_mcCtxAction('back')">Enviar atrás</div>`;
        }
    } else {
        items = `<div class="mc-ctx-item" style="opacity:0.5;cursor:default">Sin selección</div>`;
    }

    menu.innerHTML = items;
    menu.style.left = cx + 'px';
    menu.style.top  = cy + 'px';
    menu.classList.add('visible');
}

function _mcHideContextMenu() {
    const menu = document.getElementById('mcContextMenu');
    if (menu) menu.classList.remove('visible');
}

function _mcCtxAction(action) {
    _mcHideContextMenu();
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;

    if (action === 'delete') {
        mcDeleteSelected();
    } else if (action === 'duplicate') {
        mcDuplicate();
    } else if (action === 'front') {
        mcBringToFront();
    } else if (action === 'back') {
        mcSendToBack();
    }
}

function mcDuplicate() {
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;
    const obj = _mcGetObject(type, id);
    if (!obj) return;

    _mcPushHistory();
    const copy = JSON.parse(JSON.stringify(obj));
    copy.id = _mcUUID();

    const offset = _mc.scene.grid.size || 70;
    if (type === 'tile') {
        copy.x += offset;
        copy.y += offset;
        _mc.scene.tiles.push(copy);
        _mcRenderTiles();
    } else if (type === 'drawing') {
        copy.x += offset;
        copy.y += offset;
        if (!_mc.scene.drawings) _mc.scene.drawings = [];
        _mc.scene.drawings.push(copy);
        _mcRenderDrawings();
    }

    _mcSelectObject(type, copy.id);
}

function mcBringToFront() {
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;
    _mcPushHistory();

    if (type === 'tile') {
        const idx = _mc.scene.tiles.findIndex(t => t.id === id);
        if (idx >= 0) {
            const [tile] = _mc.scene.tiles.splice(idx, 1);
            _mc.scene.tiles.push(tile);
            _mcRenderTiles();
        }
    } else if (type === 'drawing') {
        const arr = _mc.scene.drawings || [];
        const idx = arr.findIndex(d => d.id === id);
        if (idx >= 0) {
            const [drawing] = arr.splice(idx, 1);
            arr.push(drawing);
            _mcRenderDrawings();
        }
    }
}

function mcSendToBack() {
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;
    _mcPushHistory();

    if (type === 'tile') {
        const idx = _mc.scene.tiles.findIndex(t => t.id === id);
        if (idx >= 0) {
            const [tile] = _mc.scene.tiles.splice(idx, 1);
            _mc.scene.tiles.unshift(tile);
            _mcRenderTiles();
        }
    } else if (type === 'drawing') {
        const arr = _mc.scene.drawings || [];
        const idx = arr.findIndex(d => d.id === id);
        if (idx >= 0) {
            const [drawing] = arr.splice(idx, 1);
            arr.unshift(drawing);
            _mcRenderDrawings();
        }
    }
}

// ─── Historial (undo / redo) ────────────────────────────────────────────────

function _mcPushHistory() {
    _mc.history = _mc.history.slice(0, _mc.historyIndex + 1);
    _mc.history.push(JSON.stringify(_mc.scene));
    if (_mc.history.length > 60) _mc.history.shift();
    _mc.historyIndex = _mc.history.length - 1;
    _mc.modified = true;
    _mcUpdateModifiedDot();
    _mcScheduleAutoSave();
}

function mcUndo() {
    if (_mc.historyIndex <= 0) return;
    _mc.historyIndex--;
    _mc.scene     = JSON.parse(_mc.history[_mc.historyIndex]);
    _mc.selection = null;
    _mc.wallChain = null;
    _mcRenderAll();
    _mcUpdateUI();
}

function mcRedo() {
    if (_mc.historyIndex >= _mc.history.length - 1) return;
    _mc.historyIndex++;
    _mc.scene     = JSON.parse(_mc.history[_mc.historyIndex]);
    _mc.selection = null;
    _mc.wallChain = null;
    _mcRenderAll();
    _mcUpdateUI();
}

function _mcUpdateModifiedDot() {
    const el = document.getElementById('mcModifiedDot');
    if (el) el.style.display = _mc.modified ? 'inline-block' : 'none';
}

// ─── Herramienta activa ─────────────────────────────────────────────────────

function mcSetTool(tool) {
    // Finish wall chain when switching away
    if (_mc.tool === 'wall' && tool !== 'wall' && _mc.wallChain) {
        _mcWallFinish();
    }
    _mc.tool        = tool;
    _mc.wallDrawing = null;
    if (tool !== 'tile') _mc.tileToPlace = null;
    if (tool !== 'draw') _mc.drawStart = null;
    _mcDeselect();
    _mcUpdateToolbar();
    _mcRenderWalls();

    // Show/hide draw subbar
    _mcUpdateDrawSubbar();
    _mcUpdateFogModeIndicator();
}

function _mcUpdateToolbar() {
    document.querySelectorAll('.mc-tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === _mc.tool);
    });
}

function _mcUpdateDrawSubbar() {
    const subbar = document.getElementById('mcDrawSubbar');
    if (!subbar) return;
    subbar.classList.toggle('visible', _mc.tool === 'draw');
}

function _mcUpdateFogModeIndicator() {
    const el = document.getElementById('mcFogModeIndicator');
    if (!el) return;
    if (_mc.tool === 'fog') {
        el.style.display = 'block';
        el.textContent = _mc.fogErasing ? 'Modo: Añadir niebla (Clic der = revelar)' : 'Modo: Revelar (Clic der = añadir niebla)';
    } else {
        el.style.display = 'none';
    }
}

// ─── Delete / duplicar ─────────────────────────────────────────────────────

function mcDeleteSelected() {
    if (!_mc.selection) return;
    const { type, id } = _mc.selection;
    _mcPushHistory();

    if (type === 'tile')    _mc.scene.tiles    = _mc.scene.tiles.filter(t => t.id !== id);
    if (type === 'wall')    _mc.scene.walls    = _mc.scene.walls.filter(w => w.id !== id);
    if (type === 'door')    _mc.scene.doors    = _mc.scene.doors.filter(d => d.id !== id);
    if (type === 'note')    _mc.scene.notes    = _mc.scene.notes.filter(n => n.id !== id);
    if (type === 'drawing') _mc.scene.drawings = (_mc.scene.drawings || []).filter(dr => dr.id !== id);

    _mc.selection = null;
    _mcRenderAll();
    _mcUpdatePropertiesPanel();
}

// ─── Guardado ──────────────────────────────────────────────────────────────

async function mcSave() {
    const btn = document.getElementById('mcSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try {
        const name         = _mc.scene.name || 'Mapa sin nombre';
        const thumbnailUrl = await _mcExportThumbnail();

        if (_mc.mapId) {
            const res = await fetch(`${API_BASE}/api/combat-maps/${_mc.mapId}`, {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    name,
                    sceneData: _mc.scene,
                    fileData:  thumbnailUrl,
                    filename:  `editor-${Date.now()}.png`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');
        } else {
            const res = await fetch(`${API_BASE}/api/combat-maps`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    name,
                    filename:   `editor-${Date.now()}.png`,
                    fileData:   thumbnailUrl,
                    sceneData:  _mc.scene,
                    sourceType: 'editor',
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');
            _mc.mapId = data._id;
        }

        _mc.modified = false;
        _mcUpdateModifiedDot();
        invalidateCombatMapsCache();
        showNotification('Mapa guardado', 2000);
    } catch (err) {
        showNotification('Error: ' + err.message, 3000);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
}

function _mcScheduleAutoSave() {
    clearTimeout(_mc.autoSaveTimer);
    if (!_mc.mapId) return;
    _mc.autoSaveTimer = setTimeout(async () => {
        if (_mc.modified && _mc.mapId) {
            try {
                const thumbnailUrl = await _mcExportThumbnail();
                await fetch(`${API_BASE}/api/combat-maps/${_mc.mapId}`, {
                    method:  'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        name:      _mc.scene.name,
                        sceneData: _mc.scene,
                        fileData:  thumbnailUrl,
                        filename:  `editor-${Date.now()}.png`,
                    }),
                });
                _mc.modified = false;
                _mcUpdateModifiedDot();
                invalidateCombatMapsCache();
            } catch (_) { /* silencioso en auto-save */ }
        }
    }, 3000);
}

// ─── Carga de mapa existente ───────────────────────────────────────────────

async function _mcLoadMap(id) {
    try {
        const res = await fetch(`${API_BASE}/api/combat-maps/${id}`);
        if (!res.ok) throw new Error('No se pudo cargar el mapa');
        const data = await res.json();

        if (!data.sceneData) {
            showNotification('Este mapa no tiene datos de escena editables', 3000);
            return;
        }

        _mc.scene        = data.sceneData;
        // Ensure drawings array exists for old scenes
        if (!_mc.scene.drawings) _mc.scene.drawings = [];

        _mc.mapId        = data._id;
        _mc.history      = [JSON.stringify(_mc.scene)];
        _mc.historyIndex = 0;
        _mc.modified     = false;

        _mcClearTextureCache();
        _mcApplyViewport();
        _mcRenderAll();
        _mcUpdateUI();
        _mcSyncTopbar();
    } catch (err) {
        showNotification('Error: ' + err.message, 3000);
    }
}

// ─── Descarga ──────────────────────────────────────────────────────────────

async function mcDownload() {
    const name = (_mc.scene.name || 'mapa').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');

    try {
        const dataUrl = await _mcExportFullRender();
        const a = document.createElement('a');
        a.download = `${name}.png`;
        a.href     = dataUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (err) {
        showNotification('No se pudo exportar la imagen: ' + err.message, 3000);
    }

    setTimeout(() => {
        const blob    = new Blob([JSON.stringify(_mc.scene, null, 2)], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(blob);
        const b       = document.createElement('a');
        b.download    = `${name}.scene.json`;
        b.href        = jsonUrl;
        document.body.appendChild(b);
        b.click();
        document.body.removeChild(b);
        setTimeout(() => URL.revokeObjectURL(jsonUrl), 5000);
    }, 300);
}

async function _mcExportThumbnail() {
    return _mcExportCanvas(400, null);
}

async function _mcExportFullRender() {
    const { width, height } = _mc.scene.background;
    return _mcExportCanvas(width, height);
}

function _mcExportCanvas(targetW, targetH) {
    const { width, height } = _mc.scene.background;

    const sv = { x: _mc.stage.world.x, y: _mc.stage.world.y,
                  sx: _mc.stage.world.scale.x, sy: _mc.stage.world.scale.y };

    _mc.stage.world.position.set(0, 0);
    _mc.stage.world.scale.set(1, 1);

    const rt = PIXI.RenderTexture.create({ width, height });
    _mc.app.renderer.render(_mc.stage.world, { renderTexture: rt });

    const srcCanvas = _mc.app.renderer.extract.canvas(rt);
    rt.destroy();

    _mc.stage.world.position.set(sv.x, sv.y);
    _mc.stage.world.scale.set(sv.sx, sv.sy);

    let outCanvas = srcCanvas;
    if (targetW && targetH && (targetW !== width || targetH !== height)) {
        outCanvas = document.createElement('canvas');
        outCanvas.width  = targetW;
        outCanvas.height = targetH;
        outCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, targetW, targetH);
    } else if (targetW && !targetH) {
        const ratio  = targetW / width;
        outCanvas    = document.createElement('canvas');
        outCanvas.width  = targetW;
        outCanvas.height = Math.round(height * ratio);
        outCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, outCanvas.width, outCanvas.height);
    }

    return outCanvas.toDataURL('image/png');
}

// ─── Volver ────────────────────────────────────────────────────────────────

function mcGoBack() {
    if (_mc.modified) {
        if (!confirm('Hay cambios sin guardar. ¿Salir de todos modos?')) return;
    }
    clearTimeout(_mc.autoSaveTimer);
    _mc.modified = false;
    _mc.wallChain = null;
    if (_mc.app) _mc.app.ticker.stop();
    setView('mapCreatorHub');
}

// ─── UI sync helpers ────────────────────────────────────────────────────────

function _mcSyncTopbar() {
    const el = document.getElementById('mcMapNameDisplay');
    if (el) el.textContent = _mc.scene?.name || 'Nuevo mapa';
    _mcUpdateModifiedDot();
}

function _mcSyncStatusBar() {
    const z   = document.getElementById('mcStatusZoom');
    const pos = document.getElementById('mcStatusPos');
    if (z)   z.textContent   = Math.round(_mc.zoom * 100) + '%';
    if (pos) pos.textContent = `${Math.round(_mc.mouseWorld.x)}, ${Math.round(_mc.mouseWorld.y)}`;
}

function _mcUpdateUI() {
    _mcSyncTopbar();
    _mcSyncStatusBar();
    _mcUpdateToolbar();
    if (_mc.panelTab === 'scene')  _mcUpdateScenePanel();
    else if (_mc.panelTab === 'props') _mcUpdatePropertiesPanel();
    else if (_mc.panelTab === 'tiles') _mcUpdateTilesPanel();
    else if (_mc.panelTab === 'layers') _mcUpdateLayersPanel();
}

// ─── Eventos de ratón / teclado ────────────────────────────────────────────

function _mcOnWheel(e) {
    e.preventDefault();
    _mcZoomAt(e.offsetX, e.offsetY, e.deltaY);
}

function _mcOnMouseDown(e) {
    _mcHideContextMenu();

    const rect = _mc.app.view.getBoundingClientRect();
    const sx   = e.clientX - rect.left;
    const sy   = e.clientY - rect.top;

    if (e.button === 1 || (e.button === 0 && _mc.spaceDown)) {
        _mc.isPanning    = true;
        _mc.panStart     = { x: e.clientX, y: e.clientY };
        _mc.panStartPos  = { x: _mc.pan.x, y: _mc.pan.y };
        return;
    }

    const wp = _mcScreenToWorld(sx, sy);

    if (e.button === 2) {
        // Right-click
        if (_mc.tool === 'wall') {
            _mcWallFinish();
        } else if (_mc.tool === 'fog') {
            // Right-click fog = erase/restore fog
            _mc.fogErasing = true;
            _mc.fogPainting = true;
            _mcFogAddAt(wp.x, wp.y);
        } else if (_mc.tool === 'select') {
            const hit = _mcHitTest(wp.x, wp.y);
            if (hit) _mcSelectObject(hit.type, hit.id);
            _mcShowContextMenu(e.clientX, e.clientY);
        } else if (_mc.tool === 'draw') {
            _mc.drawStart = null;
            _mc.stage.uiPreview.clear();
        }
        return;
    }

    if (e.button !== 0) return;

    if (_mc.tool === 'fog') {
        _mc.fogErasing = false;
    }

    _mcToolDown(wp.x, wp.y, e);
}

function _mcOnMouseMove(e) {
    const rect = _mc.app.view.getBoundingClientRect();
    const sx   = e.clientX - rect.left;
    const sy   = e.clientY - rect.top;
    const wp   = _mcScreenToWorld(sx, sy);

    _mc.mouseWorld = wp;
    _mcSyncStatusBar();

    if (_mc.isPanning) {
        _mc.pan.x = _mc.panStartPos.x + (e.clientX - _mc.panStart.x);
        _mc.pan.y = _mc.panStartPos.y + (e.clientY - _mc.panStart.y);
        _mcApplyViewport();
        return;
    }

    _mcToolMove(wp.x, wp.y, e);

    // Update cursor
    if (!_mc.spaceDown) _mcUpdateCursor(wp.x, wp.y);
}

function _mcOnMouseUp(e) {
    if (_mc.isPanning) { _mc.isPanning = false; return; }

    const rect = _mc.app.view.getBoundingClientRect();
    const wp   = _mcScreenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (e.button === 2) {
        if (_mc.tool === 'fog' && _mc.fogPainting) {
            _mc.fogPainting = false;
            _mc.fogErasing  = false;
            _mcPushHistory();
        }
        return;
    }

    if (e.button !== 0) return;
    _mcToolUp(wp.x, wp.y);
}

function _mcOnMouseLeave() {
    if (_mc.isPanning) _mc.isPanning = false;
    if (_mc.fogPainting) { _mc.fogPainting = false; _mc.fogErasing = false; _mcPushHistory(); }
}

function _mcOnDblClick(e) {
    if (_mc.tool === 'wall') {
        _mcWallFinish();
    }
}

function _mcOnContextMenu(e) {
    e.preventDefault();
}

function _mcOnDocClick(e) {
    // Hide context menu when clicking outside it
    const menu = document.getElementById('mcContextMenu');
    if (menu && !menu.contains(e.target)) {
        _mcHideContextMenu();
    }
}

function _mcOnKeyDown(e) {
    if (state.currentView !== 'mapCreator') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    _mc.shiftDown = e.shiftKey;

    if (e.code === 'Space') { _mc.spaceDown = true; e.preventDefault(); return; }
    if (e.key === 'Escape') {
        if (_mc.wallChain) { _mcWallFinish(); }
        else { _mcDeselect(); }
        _mcHideContextMenu();
        return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { mcDeleteSelected(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { mcUndo(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        mcRedo(); e.preventDefault(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { mcSave(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        mcDuplicate(); e.preventDefault(); return;
    }

    const toolKeys = { v: 'select', b: 'tile', w: 'wall', d: 'door', n: 'note', f: 'fog', p: 'draw' };
    const tool = toolKeys[e.key.toLowerCase()];
    if (tool) { mcSetTool(tool); e.preventDefault(); }
}

function _mcOnKeyUp(e) {
    if (e.code === 'Space') _mc.spaceDown = false;
    _mc.shiftDown = e.shiftKey;
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

function _mcUUID() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
