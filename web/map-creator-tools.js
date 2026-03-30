// ============================================
// Map Creator — Tools: select, tile, wall, door, note, fog
// Depends on: map-creator.js (_mc, _mcPushHistory, _mcRenderAll, etc.)
// ============================================

// ─── Dispatcher ────────────────────────────────────────────────────────────

function _mcToolDown(wx, wy) {
    switch (_mc.tool) {
        case 'select': _mcSelectDown(wx, wy);  break;
        case 'tile':   _mcTileDown(wx, wy);    break;
        case 'wall':   _mcWallDown(wx, wy);    break;
        case 'door':   _mcDoorDown(wx, wy);    break;
        case 'note':   _mcNoteDown(wx, wy);    break;
        case 'fog':    _mcFogDown(wx, wy);     break;
    }
}

function _mcToolMove(wx, wy, e) {
    switch (_mc.tool) {
        case 'select': _mcSelectMove(wx, wy); break;
        case 'wall':   _mcWallMove(wx, wy);   break;
        case 'fog':    _mcFogMove(wx, wy, e); break;
    }
}

function _mcToolUp(wx, wy) {
    switch (_mc.tool) {
        case 'select': _mcSelectUp(wx, wy); break;
        case 'wall':   _mcWallUp(wx, wy);   break;
        case 'fog':    _mcFogUp(wx, wy);    break;
    }
}

// ─── Select Tool ────────────────────────────────────────────────────────────

function _mcSelectDown(wx, wy) {
    const hit = _mcHitTest(wx, wy);

    if (hit) {
        _mcSelectObject(hit.type, hit.id);
        const obj = _mcGetObject(hit.type, hit.id);
        if (obj) {
            _mc.dragState = {
                type:       hit.type,
                id:         hit.id,
                startWX:    wx,
                startWY:    wy,
                startObjX:  obj.x !== undefined ? obj.x : (obj.x1 !== undefined ? obj.x1 : 0),
                startObjY:  obj.y !== undefined ? obj.y : (obj.y1 !== undefined ? obj.y1 : 0),
                startObjX2: obj.x2 !== undefined ? obj.x2 : 0,
                startObjY2: obj.y2 !== undefined ? obj.y2 : 0,
                hasMoved:   false,
            };
        }
    } else {
        _mcDeselect();
        _mc.dragState = null;
    }
}

function _mcSelectMove(wx, wy) {
    if (!_mc.dragState) return;

    const dx = wx - _mc.dragState.startWX;
    const dy = wy - _mc.dragState.startWY;
    if (!_mc.dragState.hasMoved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    _mc.dragState.hasMoved = true;

    const { type, id } = _mc.dragState;

    if (type === 'tile') {
        const tile = _mc.scene.tiles.find(t => t.id === id);
        if (!tile) return;
        const snapped = _mcSnapToGrid(_mc.dragState.startObjX + dx, _mc.dragState.startObjY + dy);
        tile.x = snapped.x;
        tile.y = snapped.y;
        _mcRenderTiles();
        _mcRenderUI();

    } else if (type === 'door') {
        const door = _mc.scene.doors.find(d => d.id === id);
        if (!door) return;
        const snapped = _mcSnapToGrid(_mc.dragState.startObjX + dx, _mc.dragState.startObjY + dy);
        door.x = snapped.x;
        door.y = snapped.y;
        _mcRenderDoors();

    } else if (type === 'note') {
        const note = _mc.scene.notes.find(n => n.id === id);
        if (!note) return;
        const snapped = _mcSnapToGrid(_mc.dragState.startObjX + dx, _mc.dragState.startObjY + dy);
        note.x = snapped.x;
        note.y = snapped.y;
        _mcRenderNotes();

    } else if (type === 'wall') {
        const wall = _mc.scene.walls.find(w => w.id === id);
        if (!wall) return;
        const snapped1 = _mcSnapToGrid(_mc.dragState.startObjX  + dx, _mc.dragState.startObjY  + dy);
        const snapped2 = _mcSnapToGrid(_mc.dragState.startObjX2 + dx, _mc.dragState.startObjY2 + dy);
        wall.x1 = snapped1.x; wall.y1 = snapped1.y;
        wall.x2 = snapped2.x; wall.y2 = snapped2.y;
        _mcRenderWalls();
    }
}

function _mcSelectUp(wx, wy) {
    if (_mc.dragState?.hasMoved) {
        _mcPushHistory();
        _mcUpdatePropertiesPanel();
    }
    _mc.dragState = null;
}

// ─── Tile Tool ────────────────────────────────────────────────────────────

function _mcTileDown(wx, wy) {
    if (!_mc.tileToPlace) {
        showNotification('Selecciona un tile desde el panel de Tiles', 2500);
        mcPanelTab('tiles');
        return;
    }

    _mcPushHistory();
    const gs      = _mc.scene.grid.size || 70;
    const tw      = _mc.tileToPlace.w || gs;
    const th      = _mc.tileToPlace.h || gs;
    const snapped = _mcSnapToGrid(wx - tw / 2, wy - th / 2);

    const tile = {
        id:       _mcUUID(),
        url:      _mc.tileToPlace.url,
        label:    _mc.tileToPlace.label || '',
        x:        snapped.x,
        y:        snapped.y,
        width:    tw,
        height:   th,
        rotation: 0,
        alpha:    1,
    };

    _mc.scene.tiles.push(tile);
    _mcRenderTiles();
    _mcSelectObject('tile', tile.id);
}

// ─── Wall Tool ────────────────────────────────────────────────────────────

function _mcWallDown(wx, wy) {
    const snapped = _mcSnapToGrid(wx, wy);
    _mc.wallDrawing = { x1: snapped.x, y1: snapped.y, x2: snapped.x, y2: snapped.y };
    _mcRenderWalls();
}

function _mcWallMove(wx, wy) {
    if (!_mc.wallDrawing) return;
    const snapped = _mcSnapToGrid(wx, wy);
    _mc.wallDrawing.x2 = snapped.x;
    _mc.wallDrawing.y2 = snapped.y;
    _mcRenderWalls();
}

function _mcWallUp(wx, wy) {
    if (!_mc.wallDrawing) return;
    const snapped = _mcSnapToGrid(wx, wy);
    _mc.wallDrawing.x2 = snapped.x;
    _mc.wallDrawing.y2 = snapped.y;

    const len = Math.hypot(_mc.wallDrawing.x2 - _mc.wallDrawing.x1, _mc.wallDrawing.y2 - _mc.wallDrawing.y1);
    if (len < 5) { _mc.wallDrawing = null; _mcRenderWalls(); return; }

    _mcPushHistory();
    _mc.scene.walls.push({
        id:   _mcUUID(),
        x1:   _mc.wallDrawing.x1,
        y1:   _mc.wallDrawing.y1,
        x2:   _mc.wallDrawing.x2,
        y2:   _mc.wallDrawing.y2,
        type: 'wall',
    });
    _mc.wallDrawing = null;
    _mcRenderWalls();
}

// ─── Door Tool ─────────────────────────────────────────────────────────────

function _mcDoorDown(wx, wy) {
    _mcPushHistory();
    const snapped = _mcSnapToGrid(wx, wy);
    _mc.scene.doors.push({
        id:       _mcUUID(),
        x:        snapped.x,
        y:        snapped.y,
        rotation: 0,
        open:     false,
    });
    _mcRenderDoors();
    showNotification('🚪 Puerta colocada', 1200);
}

// ─── Note Tool ─────────────────────────────────────────────────────────────

function _mcNoteDown(wx, wy) {
    const text = prompt('Texto de la nota (se mostrará en el mapa):', '');
    if (text === null) return;
    _mcPushHistory();
    const snapped = _mcSnapToGrid(wx, wy);
    _mc.scene.notes.push({
        id:   _mcUUID(),
        x:    snapped.x,
        y:    snapped.y,
        text: text.trim() || 'Nota',
        icon: '📌',
    });
    _mcRenderNotes();
}

// ─── Fog Tool (pintura circular) ───────────────────────────────────────────

function _mcFogDown(wx, wy) {
    if (!_mc.scene.fog.enabled) {
        _mc.scene.fog.enabled = true;
        _mcRenderFog();
        if (_mc.panelTab === 'scene') _mcUpdateScenePanel();
    }
    _mc.fogPainting = true;
    _mcFogAddCircle(wx, wy);
}

function _mcFogMove(wx, wy, e) {
    if (!_mc.fogPainting) return;
    // Solo añadir punto si nos hemos movido un poco (evitar spam)
    const last = _mc.scene.fog.regions[_mc.scene.fog.regions.length - 1];
    if (last && Math.hypot(wx - last.cx, wy - last.cy) < _mc.fogBrushSize * 0.4) return;
    _mcFogAddCircle(wx, wy);
}

function _mcFogUp(wx, wy) {
    if (!_mc.fogPainting) return;
    _mc.fogPainting = false;
    _mcPushHistory();
}

function _mcFogAddCircle(wx, wy) {
    _mc.scene.fog.regions.push({
        id:       _mcUUID(),
        type:     'circle',
        cx:       wx,
        cy:       wy,
        r:        _mc.fogBrushSize,
        revealed: true,
    });
    _mcRenderFog();
}
