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
    sceneStack:   [],      // [{sceneId, sceneType, pois, modelUrl, imageUrl}]
    sceneId:      'm3d_root',
    sceneType:    'glb3d',
    pois:         [],      // guardados en servidor
    pending:      [],      // cambios pendientes en modo edición
    editMode:     false,
    clickBlocked: false,   // anti-click tras drag
    inited:       false,
  };

  // ── Three.js (variables de cierre) ───────────────────────
  var renderer, camera, controls, scene;
  var modelPivot, currentGlbModel;
  var autoRotate = true, rotationOffset = 0;
  var raycaster, mouse;
  var ambientLight, sunLight, hemiLight, fillA, fillB, stars;
  var defaultCamPos = new THREE.Vector3(0, 1.5, 6);
  var modelRadius   = 1.25;
  var groundY       = -1.25;   // Y mínimo del modelo en espacio mundial (actualizado al cargar)
  var currentMode   = 'dia';
  var initialized   = false;

  // ── Zoom suave (lerp) ────────────────────────────────────
  var zoomLerp = { active: false, targetPos: new THREE.Vector3(), targetAt: new THREE.Vector3() };
  var tmpVec   = new THREE.Vector3();

  // ── DOM helpers ──────────────────────────────────────────
  var section, canvas, imgOverlay, imgStage, overlayImg;

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

    _setupThree();
    applyMode('dia');
    _bindHudButtons();
    _bindCanvasClick();
    _bindImgOverlayClick();
    _loadScene('m3d_root', 'glb3d', 'assets/3D/Meshy_AI_Bola_del_Mundo_0410111440_texture.glb', null, true);
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
    controls.dampingFactor = 0.05;
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
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.8 }));
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
  //  MODO DÍA / NOCHE
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
    _m3d.sceneId    = sceneId;
    _m3d.sceneType  = sceneType;

    if (sceneType === 'glb3d') {
      _showImageOverlay(false);
      _loadGlb(modelUrl, isRoot);
    } else {
      _showImageOverlay(true, imageUrl);
    }

    _m3dLoadPois(sceneId).then(_renderAllMarkers);
  }

  function _loadGlb(url, isRoot) {
    // Limpiar modelo anterior
    while (modelPivot.children.length) {
      var child = modelPivot.children[0];
      modelPivot.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
    currentGlbModel = null;

    // Placeholder temporal
    var phGeo = new THREE.SphereGeometry(1, 12, 8);
    var phMat = new THREE.MeshStandardMaterial({ color: 0x332255, wireframe: true, opacity: 0.3, transparent: true });
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
        currentGlbModel = model;

        modelRadius = maxDim * scale * 0.52;

        // El suelo es el Y mínimo del modelo tras centrarlo (≈ -size.y/2 * scale)
        groundY = (box.min.y - center.y) * scale;

        // Limitar cámara: no puede orbitar por debajo del suelo del modelo.
        // maxPolarAngle = ángulo desde el polo norte (0=arriba, π=abajo).
        // Usamos el ángulo en que la cámara llegaría a groundY desde la posición por defecto.
        var defaultDist = maxDim * scale * 2.5;
        var cosMax      = (groundY - controls.target.y) / defaultDist;
        // Clampear entre π/4 y π*0.88 para no restringir demasiado ni demasiado poco
        cosMax = Math.max(-0.9, Math.min(0, cosMax));
        controls.maxPolarAngle = Math.acos(cosMax);

        if (isRoot) {
          defaultCamPos.set(0, size.y * scale * 0.5, defaultDist);
          camera.position.copy(defaultCamPos);
          controls.minDistance = maxDim * scale * 1.0;
          controls.maxDistance = maxDim * scale * 8.0;
          controls.target.set(0, 0, 0);
          controls.update();
        }
        _renderAllMarkers();
      },
      function (xhr) { if (xhr.total) console.log('GLB: ' + Math.round(xhr.loaded/xhr.total*100) + '%'); },
      function (err) { console.error('Error cargando GLB:', err); }
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
  //  API — CARGAR / GUARDAR POIS
  // ════════════════════════════════════════════════════════

  function _m3dLoadPois(sceneId) {
    return fetch(API_BASE + '/api/mundo3d?sceneId=' + encodeURIComponent(sceneId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _m3d.pois    = data.hotspots || [];
        _m3d.pending = _m3d.pois.map(function (p) { return Object.assign({}, p); });
      })
      .catch(function (err) {
        console.warn('[mundo3d] load pois:', err);
        _m3d.pois    = [];
        _m3d.pending = [];
      });
  }

  function _m3dSavePois() {
    var btnSave = document.getElementById('m3dBtnSave');
    if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Guardando…'; }

    return fetch(API_BASE + '/api/mundo3d', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneId: _m3d.sceneId, sceneType: _m3d.sceneType, hotspots: _m3d.pending }),
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      _m3d.pois    = data.hotspots;
      _m3d.pending = _m3d.pois.map(function (p) { return Object.assign({}, p); });
      showNotification('Puntos de interés guardados', 2500);
      _m3dExitEditMode();
    })
    .catch(function (err) {
      showNotification('Error guardando: ' + err.message, 4000);
    })
    .finally(function () {
      if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Guardar'; }
    });
  }

  // ════════════════════════════════════════════════════════
  //  RENDER DE MARCADORES
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
  }
  function _clearMarkers2D() {
    imgStage && imgStage.querySelectorAll('.m3d-poi-marker-2d').forEach(function (el) { el.remove(); });
  }

  // ── Marcador 3D proyectado ────────────────────────────
  function _buildMarker3D(poi) {
    // Posición esférica → cartesiana local
    poi._localPos = new THREE.Vector3(
      modelRadius * Math.sin(poi.phi) * Math.cos(poi.theta),
      modelRadius * Math.cos(poi.phi),
      modelRadius * Math.sin(poi.phi) * Math.sin(poi.theta)
    );

    var el = document.createElement('div');
    el.className    = 'm3d-poi-marker';
    el.dataset.poiId = poi.id;
    el.style.display = 'none';
    el.innerHTML     = '<span class="m3d-poi-dot"></span>'
      + '<span class="m3d-poi-label">' + _esc(poi.label) + '</span>'
      + '<button class="m3d-poi-delete" title="Eliminar">✕</button>';

    el.querySelector('.m3d-poi-delete').addEventListener('click', function (e) {
      e.stopPropagation(); _deletePoi(poi.id);
    });
    el.addEventListener('click', function () {
      if (_m3d.editMode || _m3d.clickBlocked) return;
      _zoomIn(poi);
    });
    section.appendChild(el);
    poi._el = el;
  }

  // ── Marcador 2D sobre imagen ──────────────────────────
  function _buildMarker2D(poi) {
    var el = document.createElement('div');
    el.className    = 'm3d-poi-marker-2d';
    el.dataset.poiId = poi.id;
    el.style.position = 'absolute';
    el.style.left     = poi.x + '%';
    el.style.top      = poi.y + '%';
    el.innerHTML      = '<span class="m3d-poi-dot"></span>'
      + '<span class="m3d-poi-label">' + _esc(poi.label) + '</span>'
      + '<button class="m3d-poi-delete" title="Eliminar">✕</button>';

    el.querySelector('.m3d-poi-delete').addEventListener('click', function (e) {
      e.stopPropagation(); _deletePoi(poi.id);
    });
    el.addEventListener('click', function () {
      if (_m3d.editMode || _m3d.clickBlocked) return;
      _zoomIn(poi);
    });
    imgStage.appendChild(el);
    poi._el = el;
  }

  // Actualizar posición de marcadores 3D cada frame
  function _updateMarkers3D() {
    if (zoomLerp.active) return;
    if (_m3d.sceneType !== 'glb3d') return;

    var camNorm = camera.position.clone().normalize();
    var list = _m3d.editMode ? _m3d.pending : _m3d.pois;
    list.forEach(function (poi) {
      if (!poi._el || !poi._localPos) return;
      tmpVec.copy(poi._localPos).applyEuler(modelPivot.rotation);
      var visible = tmpVec.clone().normalize().dot(camNorm) > 0.08;
      if (!visible) { poi._el.style.display = 'none'; return; }
      var proj = tmpVec.clone().project(camera);
      var x    = (proj.x * 0.5 + 0.5) * _W();
      var y    = (-proj.y * 0.5 + 0.5) * _H();
      poi._el.style.display = 'flex';
      poi._el.style.left    = x + 'px';
      poi._el.style.top     = y + 'px';
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
    var hint3d = document.getElementById('m3dEditHint3D');
    var hint2d = document.getElementById('m3dEditHint2D');
    if (hint3d) hint3d.style.display = (visible && _m3d.sceneType === 'glb3d') ? 'block' : 'none';
    if (hint2d) hint2d.style.display = (visible && _m3d.sceneType === 'image2d') ? 'flex' : 'none';
  }

  function _deletePoi(id) {
    if (!_m3d.editMode) return;
    _m3d.pending = _m3d.pending.filter(function (p) { return p.id !== id; });
    _renderAllMarkers();
  }

  // ════════════════════════════════════════════════════════
  //  RAYCAST (click en canvas 3D en modo edición)
  // ════════════════════════════════════════════════════════

  function _bindCanvasClick() {
    canvas.addEventListener('click', function (e) {
      if (!_m3d.editMode || _m3d.sceneType !== 'glb3d') return;
      if (_m3d.clickBlocked) return;

      var rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      var intersects = raycaster.intersectObjects(modelPivot.children, true);
      if (!intersects.length) return;

      var point = intersects[0].point;

      // Rechazar si el punto está por debajo del suelo del modelo
      if (point.y < groundY + 0.05) {
        showNotification('No puedes añadir puntos de interés bajo el suelo', 2000);
        return;
      }

      var invRotY    = new THREE.Matrix4().makeRotationY(-modelPivot.rotation.y);
      var localPoint = point.clone().applyMatrix4(invRotY);
      var r          = localPoint.length();
      var phi        = Math.acos(Math.max(-1, Math.min(1, localPoint.y / r)));
      var theta      = Math.atan2(localPoint.z, localPoint.x);

      _openModal3D(theta, phi);
    });
  }

  // ════════════════════════════════════════════════════════
  //  CLICK EN IMAGEN 2D (modo edición)
  // ════════════════════════════════════════════════════════

  function _bindImgOverlayClick() {
    imgStage.addEventListener('click', function (e) {
      if (!_m3d.editMode || _m3d.sceneType !== 'image2d') return;
      if (e.target.closest('.m3d-poi-marker-2d')) return;
      if (_m3d.clickBlocked) return;

      var rect = overlayImg.getBoundingClientRect();
      var x    = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width)  * 100));
      var y    = Math.min(98, Math.max(2, ((e.clientY - rect.top)  / rect.height) * 100));
      _openModal2D(x, y);
    });
  }

  // ════════════════════════════════════════════════════════
  //  MODAL — AÑADIR POI
  // ════════════════════════════════════════════════════════

  function _openModal3D(theta, phi) { _openModal({ theta: theta, phi: phi }, 'glb3d'); }
  function _openModal2D(x, y)       { _openModal({ x: x, y: y }, 'image2d'); }

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
      +   '<div style="display:flex;gap:8px;margin-bottom:8px;">'
      +     '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="m3dDetailType" value="none" checked> Sin detalle</label>'
      +     '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="m3dDetailType" value="image"> Imagen</label>'
      +     '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="m3dDetailType" value="glb"> Modelo GLB</label>'
      +   '</div>'
      +   '<div id="m3dFileWrap" style="display:none;">'
      +     '<input type="file" id="m3dHsFile" accept="image/jpeg,image/png,image/webp,.glb">'
      +     '<div class="wm-modal-preview" id="m3dHsPreview"><img id="m3dHsPreviewImg" src="" alt="Vista previa"></div>'
      +     '<div class="wm-modal-progress" id="m3dHsProgress">Subiendo…</div>'
      +   '</div>'
      + '</div>'
      + '<div class="wm-modal-actions">'
      +   '<button class="wm-btn-dismiss" id="m3dModalCancel">Cancelar</button>'
      +   '<button class="wm-btn-confirm" id="m3dModalConfirm">Añadir</button>'
      + '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    // Mostrar/ocultar campo de archivo según tipo
    var radios   = overlay.querySelectorAll('input[name="m3dDetailType"]');
    var fileWrap = overlay.querySelector('#m3dFileWrap');
    var fileInput = overlay.querySelector('#m3dHsFile');
    radios.forEach(function (r) {
      r.addEventListener('change', function () {
        fileWrap.style.display = this.value === 'none' ? 'none' : 'block';
        var isGlb = this.value === 'glb';
        fileInput.accept = isGlb ? '.glb' : 'image/jpeg,image/png,image/webp';
        overlay.querySelector('#m3dHsPreview').style.display = isGlb ? 'none' : '';
      });
    });

    // Preview de imagen
    fileInput.addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      if (file.name.endsWith('.glb')) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        overlay.querySelector('#m3dHsPreviewImg').src = ev.target.result;
        overlay.querySelector('#m3dHsPreview').classList.add('visible');
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
    var labelInput  = overlay.querySelector('#m3dHsLabel');
    var fileInput   = overlay.querySelector('#m3dHsFile');
    var confirmBtn  = overlay.querySelector('#m3dModalConfirm');
    var progressEl  = overlay.querySelector('#m3dHsProgress');
    var detailType  = overlay.querySelector('input[name="m3dDetailType"]:checked')?.value || 'none';

    var label = labelInput.value.trim();
    if (!label) { labelInput.focus(); labelInput.style.borderColor = 'var(--accent-blood)'; return; }

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Añadiendo…';

    var poi = {
      id:             'p3d_' + Date.now(),
      label:          label,
      detailType:     detailType,
      detailUrl:      '',
      detailFilename: '',
      detailSceneId:  '',
    };

    // Copiar coordenadas según tipo de escena
    if (coordType === 'glb3d') {
      poi.theta = coords.theta; poi.phi = coords.phi;
      poi.x = 50; poi.y = 50;
    } else {
      poi.x = coords.x; poi.y = coords.y;
      poi.theta = 0; poi.phi = 1.5708;
    }

    if (detailType !== 'none' && fileInput.files[0]) {
      var file     = fileInput.files[0];
      var fileType = detailType; // 'image' or 'glb'
      progressEl.classList.add('visible');

      _readFileAsDataURL(file).then(function (fileData) {
        return fetch(API_BASE + '/api/mundo3d/upload', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ filename: file.name, fileData: fileData, fileType: fileType }),
        }).then(function (r) { return r.json(); });
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        poi.detailUrl      = data.url;
        poi.detailFilename = data.filename;
        poi.detailSceneId  = 'm3d_' + poi.id;
        _finishAddPoi(poi, overlay);
      })
      .catch(function (err) {
        showNotification('Error subiendo archivo: ' + err.message, 4000);
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

  function _readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload  = function (e) { resolve(e.target.result); };
      r.onerror = function ()  { reject(new Error('Error leyendo archivo')); };
      r.readAsDataURL(file);
    });
  }

  // ════════════════════════════════════════════════════════
  //  ZOOM IN (click en POI fuera de modo edición)
  // ════════════════════════════════════════════════════════

  function _zoomIn(poi) {
    if (poi.detailType === 'none' || !poi.detailUrl) {
      showNotification('Este punto no tiene detalle configurado', 2500);
      return;
    }

    // Guardar estado actual en la pila
    _m3d.sceneStack.push({
      sceneId:    _m3d.sceneId,
      sceneType:  _m3d.sceneType,
      pois:       _m3d.pois.map(function (p) { return Object.assign({}, p); }),
      modelUrl:   _currentModelUrl(),
      imageUrl:   overlayImg.src,
      camPos:     camera.position.clone(),
      camTarget:  controls.target.clone(),
    });

    var childSceneId   = poi.detailSceneId || ('m3d_' + poi.id);
    var childSceneType = poi.detailType === 'glb' ? 'glb3d' : 'image2d';

    if (_m3d.sceneType === 'glb3d') {
      // Animar cámara hacia el POI, luego cargar detalle
      _animCameraTowardPoi(poi, function () {
        _loadScene(childSceneId, childSceneType, poi.detailUrl, poi.detailUrl, false);
      });
    } else {
      // Desde una imagen 2D: transición directa
      _loadScene(childSceneId, childSceneType, poi.detailUrl, poi.detailUrl, false);
    }

    _updateHud();
  }

  function _animCameraTowardPoi(poi, onDone) {
    if (!poi._localPos) return onDone && onDone();
    tmpVec.copy(poi._localPos).applyEuler(modelPivot.rotation);
    var dir      = tmpVec.clone().normalize();
    var zoomDist = modelRadius * 1.3;
    zoomLerp.targetPos.copy(tmpVec).add(dir.multiplyScalar(zoomDist));
    zoomLerp.targetAt.copy(tmpVec);
    zoomLerp.active = true;
    autoRotate      = false;
    controls.enabled = false;

    // Ocultar marcadores durante la animación
    section.querySelectorAll('.m3d-poi-marker').forEach(function (el) { el.style.display = 'none'; });

    setTimeout(function () {
      zoomLerp.active  = false;
      controls.enabled = true;
      if (onDone) onDone();
    }, 900);
  }

  function _currentModelUrl() {
    // Heurística: intentar leer la URL del modelo activo
    return 'assets/3D/Meshy_AI_Bola_del_Mundo_0410111440_texture.glb';
  }

  // ════════════════════════════════════════════════════════
  //  VOLVER (zoom out / back)
  // ════════════════════════════════════════════════════════

  window.m3dGoBack = function () {
    var parent = _m3d.sceneStack.pop();
    if (!parent) return;

    // Salir de modo edición si estamos en él
    if (_m3d.editMode) _m3dExitEditMode();

    _m3d.sceneId   = parent.sceneId;
    _m3d.sceneType = parent.sceneType;
    _m3d.pois      = parent.pois;
    _m3d.pending   = parent.pois.map(function (p) { return Object.assign({}, p); });

    if (parent.sceneType === 'glb3d') {
      _showImageOverlay(false);
      if (parent.modelUrl) _loadGlb(parent.modelUrl, parent.sceneStack && parent.sceneStack.length === 0);
      // Restaurar posición de cámara
      if (parent.camPos) {
        camera.position.copy(parent.camPos);
        controls.target.copy(parent.camTarget);
        controls.update();
        if (_m3d.sceneStack.length === 0) {
          autoRotate = true;
          rotationOffset = modelPivot.rotation.y;
        }
      }
    } else {
      _showImageOverlay(true, parent.imageUrl);
    }

    _renderAllMarkers();
    _updateHud();
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

    var hasStack = _m3d.sceneStack.length > 0;

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
      camera.position.lerp(zoomLerp.targetPos, 0.06);
      controls.target.lerp(zoomLerp.targetAt,  0.06);
      camera.lookAt(controls.target);
    }

    // Clamp: la cámara nunca puede bajar del suelo del modelo
    if (camera.position.y < groundY) {
      camera.position.y = groundY;
    }

    _updateMarkers3D();
    controls.update();
    renderer.render(scene, camera);
  }

  // ════════════════════════════════════════════════════════
  //  UTILS
  // ════════════════════════════════════════════════════════

  function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

}());
