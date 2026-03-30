// FILE: web/map-creator-tools.js
// ============================================
// Map Creator — Tools: select, tile, wall, door, note, fog, draw
// Depends on: map-creator.js (_mc, _mcPushHistory, _mcRenderAll, etc.)
// ============================================

// ─── Dispatcher ────────────────────────────────────────────────────────────

function _mcToolDown(wx, wy, e) {
    switch (_mc.tool) {
        case 'select': _mcSelectDown(wx, wy);  break;
        case 'tile':   _mcTileDown(wx, wy);    break;
        case 'wall':   _mcWallDown(wx, wy);    break;
        case 'door':   _mcDoorDown(wx, wy);    break;
        case 'note':   _mcNoteDown(wx, wy);    break;
        case 'fog':    _mcFogDown(wx, wy);     break;
        case 'draw':   _mcDrawDown(wx, wy);    break;
    }
}

function _mcToolMove(wx, wy, e) {
    switch (_mc.tool) {
        case 'select': _mcSelectMove(wx, wy); break;
        case 'wall':   _mcWallMove(wx, wy);   break;
        case 'fog':    _mcFogMove(wx, wy, e); break;
        case 'draw':   _mcDrawMove(wx, wy);   break;
    }
}

function _mcToolUp(wx, wy) {
    switch (_mc.tool) {
        case 'select': _mcSelectUp(wx, wy); break;
        case 'wall':   _mcWallUp(wx, wy);   break;
        case 'fog':    _mcFogUp(wx, wy);    break;
        case 'draw':   _mcDrawUp(wx, wy);   break;
    }
}

// ─── Select Tool ────────────────────────────────────────────────────────────

function _mcSelectDown(wx, wy) {
    // 1. Check handles first if something is selected
    if (_mc.selection) {
        const handle = _mcGetHandleAt(wx, wy);
        if (handle) {
            const bounds = _mcGetSelectedBounds();
            if (!bounds) return;
            const cx = bounds.x + bounds.w / 2;
            const cy = bounds.y + bounds.height / 2;

            if (handle.id === 'rot') {
                _mc.dragState = {
                    mode:         'rotate',
                    id:           _mc.selection.id,
                    objType:      _mc.selection.type,
                    startAngle:   Math.atan2(wy - cy, wx - cx),
                    origRotation: _mcGetObject(_mc.selection.type, _mc.selection.id)?.rotation || 0,
                    cx, cy,
                };
                return;
            } else {
                _mc.dragState = {
                    mode:       'resize',
                    handleId:   handle.id,
                    origBounds: { x: bounds.x, y: bounds.y, w: bounds.w, height: bounds.height },
                    startWX:    wx,
                    startWY:    wy,
                    id:         _mc.selection.id,
                    objType:    _mc.selection.type,
                };
                return;
            }
        }
    }

    // 2. Hit test
    const hit = _mcHitTest(wx, wy);
    if (hit) {
        _mcSelectObject(hit.type, hit.id);
        const obj = _mcGetObject(hit.type, hit.id);
        if (obj) {
            _mc.dragState = {
                mode:       'move',
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

    const { mode } = _mc.dragState;

    if (mode === 'resize') {
        const dx = wx - _mc.dragState.startWX;
        const dy = wy - _mc.dragState.startWY;
        _mcApplyResize(dx, dy);
        return;
    }

    if (mode === 'rotate') {
        _mcApplyRotation(wx, wy);
        return;
    }

    if (mode === 'move') {
        const dx = wx - _mc.dragState.startWX;
        const dy = wy - _mc.dragState.startWY;
        if (!_mc.dragState.hasMoved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        _mc.dragState.hasMoved = true;
        _mcApplyMove(dx, dy);
    }
}

function _mcSelectUp(wx, wy) {
    if (_mc.dragState?.hasMoved || _mc.dragState?.mode === 'resize' || _mc.dragState?.mode === 'rotate') {
        _mcPushHistory();
        _mcUpdatePropertiesPanel();
    }
    _mc.dragState = null;
}

// ─── Apply Resize ─────────────────────────────────────────────────────────

function _mcApplyResize(dx, dy) {
    const { handleId, origBounds, id, objType } = _mc.dragState;
    const { x: ox, y: oy, w: ow, height: oh } = origBounds;
    const minSize = Math.max(_mc.scene.grid.size || 10, 10);

    let nx = ox, ny = oy, nw = ow, nh = oh;

    switch (handleId) {
        case 'se': nw = ow + dx; nh = oh + dy; break;
        case 's':  nh = oh + dy; break;
        case 'e':  nw = ow + dx; break;
        case 'nw': nx = ox + dx; ny = oy + dy; nw = ow - dx; nh = oh - dy; break;
        case 'ne': ny = oy + dy; nw = ow + dx; nh = oh - dy; break;
        case 'sw': nx = ox + dx; nw = ow - dx; nh = oh + dy; break;
        case 'n':  ny = oy + dy; nh = oh - dy; break;
        case 'w':  nx = ox + dx; nw = ow - dx; break;
    }

    // Clamp to minimum size
    if (nw < minSize) {
        if (handleId.includes('w')) nx = ox + ow - minSize;
        nw = minSize;
    }
    if (nh < minSize) {
        if (handleId.includes('n')) ny = oy + oh - minSize;
        nh = minSize;
    }

    const obj = _mcGetObject(objType, id);
    if (!obj) return;

    if (objType === 'tile') {
        obj.x = nx; obj.y = ny; obj.width = nw; obj.height = nh;
        _mcRenderTiles();
    } else if (objType === 'drawing') {
        obj.x = nx; obj.y = ny; obj.width = nw; obj.height = nh;
        _mcRenderDrawings();
    }

    _mcRenderUI();
}

// ─── Apply Rotation ───────────────────────────────────────────────────────

function _mcApplyRotation(wx, wy) {
    const { cx, cy, origRotation, startAngle, id, objType } = _mc.dragState;
    let angle = Math.atan2(wy - cy, wx - cx) + Math.PI / 2;

    // Snap to 15° increments when shift is held
    if (_mc.shiftDown) {
        const snapRad = (15 * Math.PI) / 180;
        angle = Math.round(angle / snapRad) * snapRad;
    }

    const obj = _mcGetObject(objType, id);
    if (!obj) return;

    obj.rotation = angle;

    if (objType === 'tile') {
        _mcRenderTiles();
    } else if (objType === 'drawing') {
        _mcRenderDrawings();
    }
    _mcRenderUI();
}

// ─── Apply Move ───────────────────────────────────────────────────────────

function _mcApplyMove(dx, dy) {
    const { type, id } = _mc.dragState;

    if (type === 'tile') {
        const tile = _mc.scene.tiles.find(t => t.id === id);
        if (!tile) return;
        const snapped = _mcSnapToGrid(_mc.dragState.startObjX + dx, _mc.dragState.startObjY + dy);
        tile.x = snapped.x;
        tile.y = snapped.y;
        _mcRenderTiles();
        _mcRenderUI();

    } else if (type === 'drawing') {
        const d = (_mc.scene.drawings || []).find(dr => dr.id === id);
        if (!d) return;
        const snapped = _mcSnapToGrid(_mc.dragState.startObjX + dx, _mc.dragState.startObjY + dy);
        d.x = snapped.x;
        d.y = snapped.y;
        _mcRenderDrawings();
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

// ─── Wall Tool (chaining) ─────────────────────────────────────────────────

function _mcWallDown(wx, wy) {
    const snapped = _mcSnapToGrid(wx, wy);

    if (!_mc.wallChain) {
        // Start new chain
        _mc.wallChain = {
            lastPoint:  { x: snapped.x, y: snapped.y },
            previewEnd: { x: snapped.x, y: snapped.y },
        };
        _mcRenderWalls();
        _mcSyncStatusBar();
    }
    // If chain exists, just record position for drag detection; wall added on mouseUp
}

function _mcWallMove(wx, wy) {
    if (!_mc.wallChain) return;
    const snapped = _mcSnapToGrid(wx, wy);
    _mc.wallChain.previewEnd = { x: snapped.x, y: snapped.y };
    _mcRenderWalls();
}

function _mcWallUp(wx, wy) {
    if (!_mc.wallChain) return;
    const snapped = _mcSnapToGrid(wx, wy);
    const endPt   = snapped;
    const startPt = _mc.wallChain.lastPoint;

    const dist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
    if (dist < 5) return; // too short, ignore

    // Add wall segment
    _mc.scene.walls.push({
        id:   _mcUUID(),
        x1:   startPt.x,
        y1:   startPt.y,
        x2:   endPt.x,
        y2:   endPt.y,
        type: 'wall',
    });

    // Continue chain from end point
    _mc.wallChain.lastPoint  = { x: endPt.x, y: endPt.y };
    _mc.wallChain.previewEnd = { x: endPt.x, y: endPt.y };

    _mcRenderWalls();
    // Don't push history on every segment — push when chain finishes
}

function _mcWallFinish() {
    if (!_mc.wallChain) return;
    _mc.wallChain = null;
    _mcPushHistory();
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
    showNotification('Puerta colocada', 1200);
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

// ─── Fog Tool ─────────────────────────────────────────────────────────────

function _mcFogDown(wx, wy) {
    if (!_mc.scene.fog.enabled) {
        _mc.scene.fog.enabled = true;
        _mcRenderFog();
        if (_mc.panelTab === 'scene') _mcUpdateScenePanel();
    }
    _mc.fogPainting = true;
    _mcFogAddAt(wx, wy);
}

function _mcFogMove(wx, wy, e) {
    if (!_mc.fogPainting) return;
    const last = _mc.scene.fog.regions[_mc.scene.fog.regions.length - 1];
    if (last && Math.hypot(wx - last.cx, wy - last.cy) < _mc.fogBrushSize * 0.35) return;
    _mcFogAddAt(wx, wy);
}

function _mcFogUp(wx, wy) {
    if (!_mc.fogPainting) return;
    _mc.fogPainting = false;
    _mc.fogErasing  = false;
    _mcPushHistory();
}

function _mcFogAddAt(wx, wy) {
    // revealed=true means "hole in fog" (player can see), revealed=false means "add fog back"
    const revealed = !_mc.fogErasing;

    // If erasing, remove circles at this position instead of adding new ones
    if (_mc.fogErasing) {
        const r = _mc.fogBrushSize;
        _mc.scene.fog.regions = _mc.scene.fog.regions.filter(region => {
            if (region.type !== 'circle') return true;
            const dist = Math.hypot(region.cx - wx, region.cy - wy);
            return dist > r * 0.7; // remove circles overlapping this brush
        });
    } else {
        _mc.scene.fog.regions.push({
            id:       _mcUUID(),
            type:     'circle',
            cx:       wx,
            cy:       wy,
            r:        _mc.fogBrushSize,
            revealed: true,
        });
    }

    _mcRenderFog();
}

// ─── Draw Tool (rect / ellipse shapes) ─────────────────────────────────────

function _mcDrawDown(wx, wy) {
    _mc.drawStart = { x: wx, y: wy };
    _mc.stage.uiPreview.clear();
}

function _mcDrawMove(wx, wy) {
    if (!_mc.drawStart) return;

    const preview = _mc.stage.uiPreview;
    preview.clear();

    const x1 = Math.min(_mc.drawStart.x, wx);
    const y1 = Math.min(_mc.drawStart.y, wy);
    const w  = Math.abs(wx - _mc.drawStart.x);
    const h  = Math.abs(wy - _mc.drawStart.y);

    if (w < 2 || h < 2) return;

    preview.lineStyle(_mc.drawStrokeWidth || 2, _mc.drawStrokeColor, 0.8);
    preview.beginFill(_mc.drawFillColor, _mc.drawFillAlpha * 0.7);

    if (_mc.drawSubTool === 'rect') {
        preview.drawRect(x1, y1, w, h);
    } else if (_mc.drawSubTool === 'ellipse') {
        preview.drawEllipse(x1 + w / 2, y1 + h / 2, w / 2, h / 2);
    }

    preview.endFill();
}

function _mcDrawUp(wx, wy) {
    if (!_mc.drawStart) return;

    const x1 = Math.min(_mc.drawStart.x, wx);
    const y1 = Math.min(_mc.drawStart.y, wy);
    const w  = Math.abs(wx - _mc.drawStart.x);
    const h  = Math.abs(wy - _mc.drawStart.y);

    _mc.drawStart = null;
    _mc.stage.uiPreview.clear();

    const minSize = 8;
    if (w < minSize || h < minSize) return;

    if (!_mc.scene.drawings) _mc.scene.drawings = [];

    const drawing = {
        id:          _mcUUID(),
        type:        _mc.drawSubTool,
        x:           x1,
        y:           y1,
        width:       w,
        height:      h,
        fillColor:   _mc.drawFillColor,
        fillAlpha:   _mc.drawFillAlpha,
        strokeColor: _mc.drawStrokeColor,
        strokeWidth: _mc.drawStrokeWidth,
    };

    _mc.scene.drawings.push(drawing);
    _mcPushHistory();
    _mcRenderDrawings();
    _mcSelectObject('drawing', drawing.id);
}
