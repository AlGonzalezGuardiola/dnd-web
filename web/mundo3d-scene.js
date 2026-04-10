/* ============================================================
   Mundo 3D — editor de POIs con navegación anidada
   Escenas: glb3d (modelo 3D) / image2d (imagen 2D)
   ============================================================ */
(function () {
  'use strict';

  // ── Modos día/noche ──────────────────────────────────────
  var MODES = {
    dia: {
      bg: 0x0a8fd4, fogColor: 0x0a8fd4, fogDensity: 0.012,
      ambientColor: 0xd0eeff, ambientIntensity: 1.2,
      sunColor: 0xfff5cc, sunIntensity: 2.5,
      hemi: { sky: 0x87ceeb, ground: 0x1a6b9e, intensity: 0.8 },
      fillIntensity: 0, stars: false,
    },
    noche: {
      bg: 0x06021a, fogColor: 0x06021a, fogDensity: 0.018,
      ambientColor: 0xffeedd, ambientIntensity: 0.6,
      sunColor: 0xffffff, sunIntensity: 1.8,
      hemi: null,
      fillIntensity: 1, stars: true,
    },
  };

  // ── Estado de navegación y edición ───────────────────────
  var _m3d = {
    sceneStack:   [],
    sceneId:      'm3d_root',
    sceneType:    'glb3d',
    pois:         [],
    pending:      [],
    editMode:     false,
    clickBlocked: false,
  };

  // ── Three.js (variables de cierre) ───────────────────────
  var renderer, camera, controls, scene;
  var modelPivot;
  var autoRotate = true, rotationOffset = 0;
  var raycaster, mouse;
  var ambientLight, sunLight, hemiLight, fillA, fillB, stars;
  var defaultCamPos = new THREE.Vector3(0, 1.5, 6);
  var modelRadius   = 1.25;
  var groundY       = -1.25;
  var currentMode   = 'dia';
  var currentModelUrl = 'assets/3D/Meshy_AI_Bola_del_Mundo_0410111440_texture.glb';
  var initialized   = false;

  // ── Anchors 3D activos (Object3D hijos de modelPivot) ───
  var _activeAnchors = [];

  // ── Fade overlay ────────────────────────────────────────
  var fadeEl = null;

  // ── DOM ─────────────────────────────────────────────────
  var section, canvas, imgOverlay, imgStage, overlayImg;

  // ── Zoom lerp ────────────────────────────────────────────
  var zoomLerp = { active: false, targetPos: new THREE.Vector3(), targetAt: new THREE.Vector3() };
  var tmpVec   = new THREE.Vector3();

  // ════════════════════════════════════════════════════════
  //  INIT
  // ════════════════════════════════════════════════════════

  window.initMundo3D = function () {
    if (initialized) return;
    if (typeof THREE === 'undefined') return;
    if (typeof THREE.GLTFLoader === 'undefined') return;
    initialized = true;

    section    = document.getElementById('mundo3DSection');
    canvas     = document.getElementById('m3dCanvas');
    imgOverlay = document.getElementById('m3dImageOverlay');
    imgStage   = document.getElementById('m3dImgStage');
    overlayImg = document.getElementById('m3dOverlayImg');

    // Crear fade overlay una sola vez
    fadeEl = document.createElement('div');
    fadeEl.style.cssText = 'position:absolute;inset:0;z-index:20;background:#000;opacity:0;pointer-events:none;transition:opacity 0.4s ease;';
    section.appendChild(fadeEl);

    _setupThree();
    applyMode('dia');
    _bindHudButtons();
    _bindCanvasClick();
    _bindImgOverlayClick();
    _loadScene('m3d_root', 'glb3d', currentModelUrl, null, true);
    _animate();
  };

  // ════════════════════════════════════════════════════════
  //  THREE.JS SETUP
  // ════════════════════════════════════════════════════════

  function _setupThree() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    } catch (e) { console.error('WebGLRenderer:', e); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(_W(), _H());
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = false;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(48, _W() / _H(), 0.1, 500);
    camera.position.copy(defaultCamPos);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance   = 2;
    controls.maxDistance   = 30;
    controls.enablePan     = false;

    ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(6, 10, 5);
    scene.add(sunLight);
    hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0);
    scene.add(hemiLight);
    fillA = new THREE.PointLight(0x33ddcc, 0, 40);
    fillA.position.set(-8, 3, -5);
    scene.add(fillA);
    fillB = new THREE.PointLight(0xffaa33, 0, 20);
    fillB.position.set(2, -6, 3);
    scene.add(fillB);

    var starBuf = new Float32Array(3000 * 3);
    for (var i = 0; i < starBuf.length; i++) starBuf[i] = (Math.random() - 0.5) * 200;
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(starBuf, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.8,
    }));
    scene.add(stars);

    modelPivot = new THREE.Group();
    scene.add(modelPivot);

    raycaster = new THREE.Raycaster();
    mouse     = new THREE.Vector2();

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (!_W() || !_H()) return;
        camera.aspect = _W() / _H();
        camera.updateProjectionMatrix();
        renderer.setSize(_W(), _H());
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }).observe(section);
    }
  }

  function _W() { return section ? section.clientWidth  || window.innerWidth  : window.innerWidth;  }
  function _H() { return section ? section.clientHeight || window.innerHeight : window.innerHeight; }

  // ════════════════════════════════════════════════════════
  //  DÍA / NOCHE + ROTACIÓN
  // ════════════════════════════════════════════════════════

  function applyMode(modeKey) {
    var m = MODES[modeKey];
    scene.background = new THREE.Color(m.bg);
    scene.fog        = new THREE.FogExp2(m.fogColor, m.fogDensity);
    ambientLight.color.set(m.ambientColor); ambientLight.intensity = m.ambientIntensity;
    sunLight.color.set(m.sunColor);         sunLight.intensity     = m.sunIntensity;
    if (m.hemi) {
      hemiLight.color.set(m.hemi.sky); hemiLight.groundColor.set(m.hemi.ground);
      hemiLight.intensity = m.hemi.intensity; fillA.intensity = 0; fillB.intensity = 0;
    } else {
      hemiLight.intensity = 0; fillA.intensity = 1.2; fillB.intensity = 0.6;
    }
    stars.visible = m.stars;
    var btn = document.getElementById('m3dModeToggle');
    if (btn) btn.textContent = modeKey === 'dia' ? '🌙 Noche' : '☀️ Día';
    currentMode = modeKey;
  }

  window.toggleMundo3DMode = function () { applyMode(currentMode === 'dia' ? 'noche' : 'dia'); };

  window.toggleMundo3DRotation = function () {
    autoRotate = !autoRotate;
    if (autoRotate) rotationOffset = modelPivot.rotation.y - performance.now() / 1000 * 0.12;
    var btn = document.getElementById('m3dRotateToggle');
    if (btn) btn.textContent = autoRotate ? '⏸ Pausa' : '▶ Play';
  };

  // ════════════════════════════════════════════════════════
  //  CARGA DE ESCENAS
  // ════════════════════════════════════════════════════════

  function _loadScene(sceneId, sceneType, modelUrl, imageUrl, isRoot) {
    _m3d.sceneId   = sceneId;
    _m3d.sceneType = sceneType;

    if (sceneType === 'glb3d') {
      _showImageOverlay(false);
      _loadGlb(modelUrl, isRoot);
    } else {
      _showImageOverlay(true, imageUrl);
    }

    _m3dLoadPois(sceneId).then(_renderAllMarkers);
  }

  function _loadGlb(url, isRoot) {
    currentModelUrl = url;

    // Limpiar modelo anterior (sin los anchors de POI que se limpian en _clearMarkers3D)
    var toRemove = [];
    modelPivot.children.forEach(function (c) {
      if (!c._isPOIAnchor) toRemove.push(c);
    });
    toRemove.forEach(function (c) {
      modelPivot.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) { [].concat(c.material).forEach(function (m) { m.dispose(); }); }
    });

    // Placeholder
    var phGeo = new THREE.SphereGeometry(1, 12, 8);
    var phMat = new THREE.MeshStandardMaterial({ color: 0x332255, wireframe: true, opacity: 0.25, transparent: true });
    var ph    = new THREE.Mesh(phGeo, phMat);
    modelPivot.add(ph);

    new THREE.GLTFLoader().load(url,
      function (gltf) {
        modelPivot.remove(ph); phGeo.dispose(); phMat.dispose();

        var model  = gltf.scene;
        var box    = new THREE.Box3().setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        var size   = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var scale  = 2.5 / maxDim;

        model.position.sub(center.multiplyScalar(scale));
        model.scale.setScalar(scale);
        modelPivot.add(model);

        modelRadius = maxDim * scale * 0.52;
        groundY     = (box.min.y - center.y) * scale;

        var defaultDist = maxDim * scale * 2.5;
        var cosMax      = Math.max(-0.85, Math.min(0, groundY / defaultDist));
        controls.maxPolarAngle = Math.acos(cosMax);

        if (isRoot) {
          defaultCamPos.set(0, size.y * scale * 0.3, defaultDist);
          camera.position.copy(defaultCamPos);
          controls.minDistance = maxDim * scale * 1.0;
          controls.maxDistance = maxDim * scale * 8.0;
          controls.target.set(0, 0, 0);
          controls.update();
        } else {
          // Escena de detalle (POI): cámara cenital (~80° desde el suelo), distancia media
          var detailDist = maxDim * scale * 2.0;
          camera.position.set(0, detailDist * 0.34, detailDist * 0.94);
          controls.minDistance = maxDim * scale * 0.8;
          controls.maxDistance = maxDim * scale * 6.0;
          controls.target.set(0, 0, 0);
          controls.update();
        }

        // Re-renderizar marcadores ahora que el modelo está listo
        _renderAllMarkers();
      },
      function (xhr) { if (xhr.total) console.log('GLB: ' + Math.round(xhr.loaded / xhr.total * 100) + '%'); },
      function (err) { console.error('Error cargando GLB:', err); showNotification('Error cargando modelo', 3000); }
    );
  }

  function _showImageOverlay(visible, url) {
    if (!imgOverlay) return;
    if (visible) {
      overlayImg.src = url || '';
      imgOverlay.style.display = 'block';
      requestAnimationFrame(function () { imgOverlay.style.opacity = '1'; });
      autoRotate = false;
    } else {
      imgOverlay.style.opacity = '0';
      setTimeout(function () { imgOverlay.style.display = 'none'; }, 400);
      if (_m3d.sceneStack.length === 0) autoRotate = true;
    }
  }

  // ════════════════════════════════════════════════════════
  //  API — CARGAR / GUARDAR
  // ════════════════════════════════════════════════════════

  function _m3dLoadPois(sceneId) {
    return fetch(API_BASE + '/api/mundo3d?sceneId=' + encodeURIComponent(sceneId))
      .then(function (r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(function (data) {
        _m3d.pois    = data.hotspots || [];
        _m3d.pending = _m3d.pois.map(function (p) { return Object.assign({}, p); });
      })
      .catch(function (err) {
        console.warn('[mundo3d] load:', err);
        _m3d.pois = []; _m3d.pending = [];
      });
  }

  function _m3dSavePois() {
    var btnSave = document.getElementById('m3dBtnSave');
    if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Guardando…'; }

    fetch(API_BASE + '/api/mundo3d', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sceneId: _m3d.sceneId, sceneType: _m3d.sceneType, hotspots: _m3d.pending }),
    })
    .then(function (r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
    .then(function (data) {
      _m3d.pois    = data.hotspots;
      _m3d.pending = _m3d.pois.map(function (p) { return Object.assign({}, p); });
      showNotification('Puntos de interés guardados', 2500);
      _m3dExitEditMode();
    })
    .catch(function (err) { showNotification('Error guardando: ' + err.message, 4000); })
    .finally(function () {
      if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Guardar'; }
    });
  }

  // ════════════════════════════════════════════════════════
  //  MARCADORES
  // ════════════════════════════════════════════════════════

  function _renderAllMarkers() {
    _clearMarkers3D();
    _clearMarkers2D();
    var list = _m3d.editMode ? _m3d.pending : _m3d.pois;
    if (_m3d.sceneType === 'glb3d') {
      list.forEach(_buildMarker3D);
    } else {
      list.forEach(_buildMarker2D);
    }
  }

  function _clearMarkers3D() {
    section.querySelectorAll('.m3d-poi-marker').forEach(function (el) { el.remove(); });
    _activeAnchors.forEach(function (a) { modelPivot.remove(a); });
    _activeAnchors = [];
  }

  function _clearMarkers2D() {
    imgStage && imgStage.querySelectorAll('.m3d-poi-marker-2d').forEach(function (el) { el.remove(); });
  }

  // ── Marcador 3D ──────────────────────────────────────────
  function _buildMarker3D(poi) {
    // Anchor hijo del pivot — se mueve exactamente con el modelo
    var anchor = new THREE.Object3D();
    anchor._isPOIAnchor = true;
    anchor.position.set(
      poi.lx != null ? poi.lx : 0,
      poi.ly != null ? poi.ly : 0,
      poi.lz != null ? poi.lz : 0
    );
    modelPivot.add(anchor);
    _activeAnchors.push(anchor);
    poi._anchor = anchor;

    var hasDetail = poi.detailType && poi.detailType !== 'none' && poi.detailUrl;

    var el = document.createElement('div');
    el.className     = 'm3d-poi-marker';
    el.dataset.poiId = poi.id;
    el.style.display = 'none';
    el.innerHTML =
      '<span class="m3d-poi-dot' + (hasDetail ? ' m3d-poi-dot--link' : '') + '"></span>'
      + '<span class="m3d-poi-label">' + _esc(poi.label) + '</span>'
      + '<button class="m3d-poi-delete" title="Eliminar">✕</button>';

    el.querySelector('.m3d-poi-delete').addEventListener('click', function (e) {
      e.stopPropagation(); _deletePoi(poi.id);
    });
    el.addEventListener('click', function (e) {
      if (e.target.closest('.m3d-poi-delete')) return;
      if (_m3d.editMode) return;
      _zoomIn(poi);
    });

    section.appendChild(el);
    poi._el = el;
  }

  // ── Marcador 2D ──────────────────────────────────────────
  function _buildMarker2D(poi) {
    var hasDetail = poi.detailType && poi.detailType !== 'none' && poi.detailUrl;

    var el = document.createElement('div');
    el.className      = 'm3d-poi-marker-2d';
    el.dataset.poiId  = poi.id;
    el.style.position = 'absolute';
    el.style.left     = poi.x + '%';
    el.style.top      = poi.y + '%';
    el.innerHTML =
      '<span class="m3d-poi-dot' + (hasDetail ? ' m3d-poi-dot--link' : '') + '"></span>'
      + '<span class="m3d-poi-label">' + _esc(poi.label) + '</span>'
      + '<button class="m3d-poi-delete" title="Eliminar">✕</button>';

    el.querySelector('.m3d-poi-delete').addEventListener('click', function (e) {
      e.stopPropagation(); _deletePoi(poi.id);
    });
    el.addEventListener('click', function (e) {
      if (e.target.closest('.m3d-poi-delete')) return;
      if (_m3d.editMode) return;
      _zoomIn(poi);
    });

    imgStage.appendChild(el);
    poi._el = el;
  }

  // ── Actualizar posición de marcadores 3D cada frame ──────
  var _wPos = new THREE.Vector3();

  function _updateMarkers3D() {
    if (_m3d.sceneType !== 'glb3d') return;

    var list = _m3d.editMode ? _m3d.pending : _m3d.pois;

    list.forEach(function (poi) {
      if (!poi._anchor || !poi._el) return;

      // Posición mundial exacta usando el transform completo del anchor
      poi._anchor.getWorldPosition(_wPos);

      // Proyección 3D → 2D (siempre visible, independiente de si está detrás)
      var proj = _wPos.clone().project(camera);

      var x = (proj.x * 0.5 + 0.5) * _W();
      var y = (-proj.y * 0.5 + 0.5) * _H();

      poi._el.style.display  = 'flex';
      poi._el.style.left     = x + 'px';
      poi._el.style.top      = y + 'px';
      poi._el.style.opacity  = '1';
    });
  }

  // ════════════════════════════════════════════════════════
  //  MODO EDICIÓN
  // ════════════════════════════════════════════════════════

  function _m3dEnterEditMode() {
    _m3d.editMode = true;
    _m3d.pending  = _m3d.pois.map(function (p) { return Object.assign({}, p); });
    section.classList.add('m3d-edit-mode');
    _renderAllMarkers();
    _updateHud();
    _showEditHint(true);
  }

  function _m3dExitEditMode() {
    _m3d.editMode = false;
    section.classList.remove('m3d-edit-mode');
    _renderAllMarkers();
    _updateHud();
    _showEditHint(false);
  }

  function _m3dCancelEdit() {
    _m3d.pending = _m3d.pois.map(function (p) { return Object.assign({}, p); });
    _m3dExitEditMode();
  }

  function _showEditHint(visible) {
    var h3 = document.getElementById('m3dEditHint3D');
    var h2 = document.getElementById('m3dEditHint2D');
    if (h3) h3.style.display = (visible && _m3d.sceneType === 'glb3d')   ? 'block' : 'none';
    if (h2) h2.style.display = (visible && _m3d.sceneType === 'image2d') ? 'flex'  : 'none';
  }

  function _deletePoi(id) {
    if (!_m3d.editMode) return;
    _m3d.pending = _m3d.pending.filter(function (p) { return p.id !== id; });
    _renderAllMarkers();
  }

  // ════════════════════════════════════════════════════════
  //  RAYCAST — click en modelo 3D para añadir POI
  // ════════════════════════════════════════════════════════

  function _bindCanvasClick() {
    canvas.addEventListener('click', function (e) {
      if (!_m3d.editMode || _m3d.sceneType !== 'glb3d') return;
      if (_m3d.clickBlocked) return;

      var rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
      mouse.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
      raycaster.setFromCamera(mouse, camera);

      var hits = raycaster.intersectObjects(modelPivot.children, true);
      // Filtrar anchors de POI (son Object3D sin geometría)
      hits = hits.filter(function (h) { return !h.object._isPOIAnchor; });
      if (!hits.length) return;

      var worldPoint = hits[0].point;

      // Rechazar bajo el suelo
      if (worldPoint.y < groundY + 0.05) {
        showNotification('No puedes añadir puntos bajo el suelo', 2000);
        return;
      }

      // Convertir a espacio local del pivot (correcto: tiene en cuenta posición y rotación)
      var localPoint = modelPivot.worldToLocal(worldPoint.clone());

      _openModal3D(localPoint.x, localPoint.y, localPoint.z);
    });
  }

  // ════════════════════════════════════════════════════════
  //  CLICK EN IMAGEN 2D
  // ════════════════════════════════════════════════════════

  function _bindImgOverlayClick() {
    imgStage.addEventListener('click', function (e) {
      if (!_m3d.editMode || _m3d.sceneType !== 'image2d') return;
      if (e.target.closest('.m3d-poi-marker-2d')) return;
      if (_m3d.clickBlocked) return;

      var rect = overlayImg.getBoundingClientRect();
      var x = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width)  * 100));
      var y = Math.min(98, Math.max(2, ((e.clientY - rect.top)  / rect.height) * 100));
      _openModal2D(x, y);
    });
  }

  // ════════════════════════════════════════════════════════
  //  MODAL — AÑADIR POI
  // ════════════════════════════════════════════════════════

  function _openModal3D(lx, ly, lz) { _openModal({ lx: lx, ly: ly, lz: lz }, 'glb3d'); }
  function _openModal2D(x, y)       { _openModal({ x: x, y: y },             'image2d'); }

  function _openModal(coords, coordType) {
    document.getElementById('m3dAddModal')?.remove();

    var overlay = document.createElement('div');
    overlay.id        = 'm3dAddModal';
    overlay.className = 'wm-modal-overlay';
    overlay.innerHTML =
      '<div class="wm-modal" role="dialog" aria-modal="true">'
      + '<h3>📍 Nuevo punto de interés</h3>'
      + '<div class="wm-modal-field">'
      +   '<label for="m3dHsLabel">Nombre del lugar</label>'
      +   '<input type="text" id="m3dHsLabel" placeholder="Ej: La Ciudadela" maxlength="80" autocomplete="off">'
      + '</div>'
      + '<div class="wm-modal-field">'
      +   '<label>Detalle al hacer zoom</label>'
      +   '<div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap;">'
      +     '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;">'
      +       '<input type="radio" name="m3dDetailType" value="none" checked> Sin detalle'
      +     '</label>'
      +     '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;">'
      +       '<input type="radio" name="m3dDetailType" value="image"> Imagen'
      +     '</label>'
      +     '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;">'
      +       '<input type="radio" name="m3dDetailType" value="glb"> Modelo GLB'
      +     '</label>'
      +   '</div>'
      +   '<div id="m3dFileWrap" style="display:none;">'
      +     '<input type="file" id="m3dHsFile" accept="image/jpeg,image/png,image/webp,.glb">'
      +     '<div class="wm-modal-preview" id="m3dHsPreview" style="margin-top:8px;">'
      +       '<img id="m3dHsPreviewImg" src="" alt="Vista previa">'
      +     '</div>'
      +     '<div class="wm-modal-progress" id="m3dHsProgress">Subiendo…</div>'
      +   '</div>'
      + '</div>'
      + '<div class="wm-modal-actions">'
      +   '<button class="wm-btn-dismiss" id="m3dModalCancel">Cancelar</button>'
      +   '<button class="wm-btn-confirm" id="m3dModalConfirm">Añadir</button>'
      + '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    var radios    = overlay.querySelectorAll('input[name="m3dDetailType"]');
    var fileWrap  = overlay.querySelector('#m3dFileWrap');
    var fileInput = overlay.querySelector('#m3dHsFile');
    var preview   = overlay.querySelector('#m3dHsPreview');

    radios.forEach(function (r) {
      r.addEventListener('change', function () {
        var isNone = this.value === 'none';
        var isGlb  = this.value === 'glb';
        fileWrap.style.display  = isNone ? 'none' : 'block';
        fileInput.accept        = isGlb ? '.glb' : 'image/jpeg,image/png,image/webp';
        preview.style.display   = isGlb ? 'none' : '';
        fileInput.value         = '';
        overlay.querySelector('#m3dHsPreviewImg').src = '';
        preview.classList.remove('visible');
      });
    });

    fileInput.addEventListener('change', function () {
      var file = this.files[0];
      if (!file || file.name.endsWith('.glb')) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        overlay.querySelector('#m3dHsPreviewImg').src = ev.target.result;
        preview.classList.add('visible');
      };
      reader.readAsDataURL(file);
    });

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#m3dModalCancel').addEventListener('click', function () { overlay.remove(); });
    overlay.querySelector('#m3dModalConfirm').addEventListener('click', function () {
      _confirmAddPoi(coords, coordType, overlay);
    });

    setTimeout(function () { overlay.querySelector('#m3dHsLabel')?.focus(); }, 50);
  }

  function _confirmAddPoi(coords, coordType, overlay) {
    var labelInput = overlay.querySelector('#m3dHsLabel');
    var fileInput  = overlay.querySelector('#m3dHsFile');
    var confirmBtn = overlay.querySelector('#m3dModalConfirm');
    var progressEl = overlay.querySelector('#m3dHsProgress');
    var detailType = (overlay.querySelector('input[name="m3dDetailType"]:checked') || {}).value || 'none';

    var label = labelInput.value.trim();
    if (!label) {
      labelInput.focus();
      labelInput.style.borderColor = 'var(--accent-blood, #8b1a1a)';
      return;
    }

    // Si eligió imagen/glb pero no subió fichero, tratar como sin detalle
    if (detailType !== 'none' && !fileInput.files[0]) {
      detailType = 'none';
    }

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Añadiendo…';

    var poi = {
      id:             'p3d_' + Date.now(),
      label:          label,
      detailType:     detailType,
      detailUrl:      '',
      detailFilename: '',
      detailSceneId:  '',
      // Coords 3D
      lx: coords.lx != null ? coords.lx : 0,
      ly: coords.ly != null ? coords.ly : 0,
      lz: coords.lz != null ? coords.lz : 0,
      // Coords 2D
      x: coords.x != null ? coords.x : 50,
      y: coords.y != null ? coords.y : 50,
      // Legacy
      theta: 0, phi: 1.5708,
    };

    if (detailType !== 'none') {
      var file     = fileInput.files[0];
      var fileType = detailType;
      progressEl.classList.add('visible');

      // Subida binaria directa (sin base64) — evita problemas con JSON y tamaño
      var uploadUrl = API_BASE + '/api/mundo3d/upload'
        + '?fileType=' + encodeURIComponent(fileType)
        + '&filename=' + encodeURIComponent(file.name);

      fetch(uploadUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body:    file,
      })
        .then(function (r) {
          if (!r.ok) {
            return r.text().then(function (txt) {
              var msg = txt;
              try { msg = JSON.parse(txt).error || txt; } catch (e) { /* mantener txt */ }
              throw new Error(msg);
            });
          }
          return r.json();
        })
        .then(function (data) {
          poi.detailUrl      = data.url;
          poi.detailFilename = data.filename;
          poi.detailSceneId  = 'm3d_' + poi.id;
          _finishAddPoi(poi, overlay);
        })
        .catch(function (err) {
          showNotification('Error subiendo archivo: ' + err.message, 5000);
          confirmBtn.disabled    = false;
          confirmBtn.textContent = 'Añadir';
          progressEl.classList.remove('visible');
        });
    } else {
      _finishAddPoi(poi, overlay);
    }
  }

  function _finishAddPoi(poi, overlay) {
    _m3d.pending.push(poi);
    overlay.remove();
    _renderAllMarkers();
  }

  // ════════════════════════════════════════════════════════
  //  ZOOM IN
  // ════════════════════════════════════════════════════════

  function _zoomIn(poi) {
    if (poi.detailType === 'none' || !poi.detailUrl) {
      showNotification('Este punto no tiene detalle configurado', 2500);
      return;
    }

    var childSceneId   = poi.detailSceneId || ('m3d_' + poi.id);
    var childSceneType = poi.detailType === 'glb' ? 'glb3d' : 'image2d';

    // Guardar estado actual en pila
    _m3d.sceneStack.push({
      sceneId:    _m3d.sceneId,
      sceneType:  _m3d.sceneType,
      pois:       _m3d.pois.map(function (p) { return Object.assign({}, p); }),
      modelUrl:   currentModelUrl,
      imageUrl:   overlayImg ? overlayImg.src : '',
      camPos:     camera.position.clone(),
      camTarget:  controls.target.clone(),
    });

    _updateHud();

    if (_m3d.sceneType === 'glb3d' && poi._anchor) {
      // Vuelo cinematográfico hacia el POI, luego fade y carga la nueva escena
      _flyCameraToPoi(poi, function () {
        _fadeAndLoad(childSceneId, childSceneType, poi.detailUrl, poi.detailUrl);
      });
    } else {
      // Desde imagen 2D: transición directa con fade
      _fadeAndLoad(childSceneId, childSceneType, poi.detailUrl, poi.detailUrl);
    }
  }

  function _flyCameraToPoi(poi, onDone) {
    // Detener rotación y controls durante el vuelo
    autoRotate       = false;
    controls.enabled = false;
    zoomLerp.active  = false;

    // Ocultar marcadores
    section.querySelectorAll('.m3d-poi-marker').forEach(function (el) { el.style.opacity = '0'; });

    // Posición mundial del POI
    poi._anchor.getWorldPosition(_wPos);

    // La cámara vuela hacia una posición cercana al POI, mirando al POI
    var dir      = _wPos.clone().sub(modelPivot.position).normalize();
    var closeDist = modelRadius * 0.6;
    zoomLerp.targetPos.copy(_wPos).add(dir.multiplyScalar(closeDist));
    zoomLerp.targetAt.copy(_wPos);
    zoomLerp.active = true;

    // Esperar que el lerp llegue (~1s) y luego ejecutar el callback
    setTimeout(function () {
      zoomLerp.active  = false;
      controls.enabled = true;
      if (onDone) onDone();
    }, 1000);
  }

  function _fadeAndLoad(sceneId, sceneType, modelUrl, imageUrl) {
    // Fade a negro
    if (fadeEl) { fadeEl.style.opacity = '1'; fadeEl.style.pointerEvents = 'auto'; }

    setTimeout(function () {
      // La cámara la posiciona _loadGlb una vez conoce el tamaño del modelo
      _loadScene(sceneId, sceneType, modelUrl, imageUrl, false);

      setTimeout(function () {
        if (fadeEl) { fadeEl.style.opacity = '0'; fadeEl.style.pointerEvents = 'none'; }
      }, 300);
    }, 420);
  }

  // ════════════════════════════════════════════════════════
  //  VOLVER
  // ════════════════════════════════════════════════════════

  window.m3dGoBack = function () {
    var parent = _m3d.sceneStack.pop();
    if (!parent) return;

    if (_m3d.editMode) _m3dExitEditMode();

    // Fade a negro
    if (fadeEl) { fadeEl.style.opacity = '1'; fadeEl.style.pointerEvents = 'auto'; }

    setTimeout(function () {
      _m3d.sceneId   = parent.sceneId;
      _m3d.sceneType = parent.sceneType;
      _m3d.pois      = parent.pois;
      _m3d.pending   = parent.pois.map(function (p) { return Object.assign({}, p); });

      if (parent.sceneType === 'glb3d') {
        _showImageOverlay(false);
        _loadGlb(parent.modelUrl, _m3d.sceneStack.length === 0);
        if (parent.camPos) {
          camera.position.copy(parent.camPos);
          controls.target.copy(parent.camTarget);
          controls.update();
        }
        if (_m3d.sceneStack.length === 0) {
          autoRotate     = true;
          rotationOffset = modelPivot.rotation.y - performance.now() / 1000 * 0.12;
        }
      } else {
        _showImageOverlay(true, parent.imageUrl);
      }

      _renderAllMarkers();
      _updateHud();

      setTimeout(function () {
        if (fadeEl) { fadeEl.style.opacity = '0'; fadeEl.style.pointerEvents = 'none'; }
      }, 300);
    }, 420);
  };

  // ════════════════════════════════════════════════════════
  //  HUD
  // ════════════════════════════════════════════════════════

  function _bindHudButtons() {
    var btnEdit   = document.getElementById('m3dBtnEdit');
    var btnCancel = document.getElementById('m3dBtnCancel');
    var btnSave   = document.getElementById('m3dBtnSave');
    var btnSalir  = document.getElementById('m3dBtnSalir');

    if (btnEdit)   btnEdit.addEventListener('click',   _m3dEnterEditMode);
    if (btnCancel) btnCancel.addEventListener('click', _m3dCancelEdit);
    if (btnSave)   btnSave.addEventListener('click',   _m3dSavePois);
    if (btnSalir)  btnSalir.addEventListener('click',  window.m3dGoBack);
  }

  function _updateHud() {
    var btnSalir  = document.getElementById('m3dBtnSalir');
    var btnEdit   = document.getElementById('m3dBtnEdit');
    var btnCancel = document.getElementById('m3dBtnCancel');
    var btnSave   = document.getElementById('m3dBtnSave');
    var hasStack  = _m3d.sceneStack.length > 0;

    if (_m3d.editMode) {
      if (btnSalir)  btnSalir.style.display  = hasStack ? 'inline-flex' : 'none';
      if (btnEdit)   btnEdit.style.display   = 'none';
      if (btnCancel) btnCancel.style.display = 'inline-flex';
      if (btnSave)   btnSave.style.display   = 'inline-flex';
    } else {
      if (btnSalir)  btnSalir.style.display  = hasStack ? 'inline-flex' : 'none';
      if (btnEdit)   btnEdit.style.display   = 'inline-flex';
      if (btnCancel) btnCancel.style.display = 'none';
      if (btnSave)   btnSave.style.display   = 'none';
    }
  }

  // ════════════════════════════════════════════════════════
  //  ANIMACIÓN
  // ════════════════════════════════════════════════════════

  function _animate() {
    requestAnimationFrame(_animate);
    var t = performance.now() / 1000;

    if (autoRotate) {
      modelPivot.rotation.y = rotationOffset + t * 0.12;
      modelPivot.position.y = Math.sin(t * 0.4) * 0.08;
    }

    if (zoomLerp.active) {
      camera.position.lerp(zoomLerp.targetPos, 0.07);
      controls.target.lerp(zoomLerp.targetAt,  0.07);
      camera.lookAt(controls.target);
    }

    if (camera.position.y < groundY) camera.position.y = groundY;

    _updateMarkers3D();
    controls.update();
    renderer.render(scene, camera);
  }

  // ════════════════════════════════════════════════════════
  //  UTILS
  // ════════════════════════════════════════════════════════

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

}());
