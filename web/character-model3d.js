// ============================================
// Character Model 3D — visor GLB por personaje
// Patrón: página completa (igual que Forja/Cocina).
// Persiste en IndexedDB. Depende de THREE, OrbitControls, GLTFLoader.
// ============================================

var _m3dCharId   = null;
var _m3dCharName = null;
var _m3dRenderer = null;
var _m3dAnimFrame = null;

// ── IndexedDB helpers ────────────────────────────────────────────────────────

var _m3dDB = null;

function _openM3DDB() {
    if (_m3dDB) return Promise.resolve(_m3dDB);
    return new Promise(function (resolve, reject) {
        var req = indexedDB.open('dnd_char_models', 1);
        req.onupgradeneeded = function (e) { e.target.result.createObjectStore('models'); };
        req.onsuccess = function (e) { _m3dDB = e.target.result; resolve(_m3dDB); };
        req.onerror   = function (e) { reject(e); };
    });
}

function _saveM3DModel(charId, arrayBuffer) {
    return _openM3DDB().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction('models', 'readwrite');
            tx.objectStore('models').put(arrayBuffer, charId);
            tx.oncomplete = resolve;
            tx.onerror    = reject;
        });
    });
}

function _loadM3DModel(charId) {
    return _openM3DDB().then(function (db) {
        return new Promise(function (resolve, reject) {
            var req = db.transaction('models').objectStore('models').get(charId);
            req.onsuccess = function (e) { resolve(e.target.result || null); };
            req.onerror   = reject;
        });
    });
}

function _deleteM3DModel(charId) {
    return _openM3DDB().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction('models', 'readwrite');
            tx.objectStore('models').delete(charId);
            tx.oncomplete = resolve;
            tx.onerror    = reject;
        });
    });
}

// ── Abrir página ─────────────────────────────────────────────────────────────

function openModel3DPanel(charId, charName) {
    _m3dCharId   = charId;
    _m3dCharName = charName;

    var titleEl = document.getElementById('model3dPageTitle');
    if (titleEl) titleEl.textContent = charName;

    setView('model3d');
    _renderModel3DPage(charId);
}

// ── Renderizar contenido de la página ────────────────────────────────────────

function _renderModel3DPage(charId) {
    var body = document.getElementById('model3dPageBody');
    if (!body) return;

    // Mostrar estado de carga
    body.innerHTML = '<div class="m3d-loading">Cargando…</div>';

    _loadM3DModel(charId).then(function (buf) {
        if (buf) {
            _renderViewer(charId, buf);
        } else {
            _renderUploadPrompt(charId);
        }
    }).catch(function () {
        _renderUploadPrompt(charId);
    });
}

function _renderUploadPrompt(charId) {
    var body = document.getElementById('model3dPageBody');
    if (!body) return;

    body.innerHTML =
        '<div class="m3d-empty-state">' +
            '<div class="m3d-empty-icon">🎲</div>' +
            '<div class="m3d-empty-title">Sin modelo 3D</div>' +
            '<div class="m3d-empty-hint">Sube un archivo .glb para ver a este personaje en 3D</div>' +
            '<label class="m3d-upload-btn">' +
                '📂 Cargar modelo GLB' +
                '<input type="file" accept=".glb" style="display:none" onchange="onM3DFileUpload(\'' + charId + '\',this)">' +
            '</label>' +
        '</div>';
}

function _renderViewer(charId, arrayBuffer) {
    var body = document.getElementById('model3dPageBody');
    if (!body) return;

    body.innerHTML =
        '<div class="m3d-viewer-wrap">' +
            '<canvas id="m3dCanvas"></canvas>' +
            '<div class="m3d-controls-hint">Arrastrar para rotar · Scroll para zoom</div>' +
            '<div class="m3d-viewer-actions">' +
                '<label class="m3d-replace-btn" title="Cambiar modelo">' +
                    '📂 Cambiar' +
                    '<input type="file" accept=".glb" style="display:none" onchange="onM3DFileUpload(\'' + charId + '\',this)">' +
                '</label>' +
                '<button class="m3d-delete-btn" onclick="deleteM3DModel(\'' + charId + '\')">🗑️ Quitar</button>' +
            '</div>' +
        '</div>';

    // Inicializar visor en el siguiente frame (el canvas necesita estar en el DOM)
    requestAnimationFrame(function () {
        _startM3DViewer(charId, arrayBuffer);
    });
}

// ── Subida de archivo ─────────────────────────────────────────────────────────

function onM3DFileUpload(charId, input) {
    var file = input.files && input.files[0];
    if (!file) return;

    var body = document.getElementById('model3dPageBody');
    if (body) body.innerHTML = '<div class="m3d-loading">Procesando modelo…</div>';

    var reader = new FileReader();
    reader.onload = function (e) {
        var buf = e.target.result;
        _saveM3DModel(charId, buf).then(function () {
            showNotification('✅ Modelo 3D guardado', 2000);
            _renderViewer(charId, buf);
        });
    };
    reader.readAsArrayBuffer(file);
}

function deleteM3DModel(charId) {
    _stopM3DViewer();
    _deleteM3DModel(charId).then(function () {
        showNotification('🗑️ Modelo eliminado', 1500);
        _renderUploadPrompt(charId);
    });
}

// ── Limpieza ──────────────────────────────────────────────────────────────────

function cleanupM3DViewer() {
    _stopM3DViewer();
}

function _stopM3DViewer() {
    if (_m3dAnimFrame) { cancelAnimationFrame(_m3dAnimFrame); _m3dAnimFrame = null; }
    if (_m3dRenderer)  { _m3dRenderer.dispose(); _m3dRenderer = null; }
}

// ── Visor Three.js ────────────────────────────────────────────────────────────

function _startM3DViewer(charId, arrayBuffer) {
    if (typeof THREE === 'undefined') {
        showNotification('⚠️ Three.js no disponible', 2000);
        return;
    }

    _stopM3DViewer();

    var canvas = document.getElementById('m3dCanvas');
    var wrap   = canvas && canvas.parentElement;
    if (!canvas || !wrap) return;

    // Dimensiones
    var W = wrap.clientWidth  || window.innerWidth;
    var H = wrap.clientHeight || Math.round(W * 0.75);
    canvas.width  = W;
    canvas.height = H;

    // Renderer
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding      = THREE.sRGBEncoding;
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled   = true;
    _m3dRenderer = renderer;

    // Escena
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);

    // Luces
    scene.add(new THREE.AmbientLight(0xffeedd, 0.8));
    var sun = new THREE.DirectionalLight(0xfff5cc, 2.0);
    sun.position.set(5, 10, 7);
    sun.castShadow = true;
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0x4488ff, 0.6);
    fill.position.set(-6, 2, -5);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0xaa66ff, 0.3);
    rim.position.set(0, -3, -8);
    scene.add(rim);

    // Cámara
    var camera = new THREE.PerspectiveCamera(45, W / H, 0.001, 2000);
    camera.position.set(0, 1.5, 5);

    // Controles
    var controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.07;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 1.5;
    controls.enablePan       = false;
    controls.minDistance     = 0.1;
    controls.maxDistance     = 500;

    // Cargar GLB
    var loader = new THREE.GLTFLoader();
    loader.parse(arrayBuffer, '', function (gltf) {
        var model = gltf.scene;

        // Centrar y escalar
        var box    = new THREE.Box3().setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        var size   = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var scale  = 3.0 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        scene.add(model);

        // Ajustar cámara
        var fitBox    = new THREE.Box3().setFromObject(model);
        var fitCenter = fitBox.getCenter(new THREE.Vector3());
        var fitSize   = fitBox.getSize(new THREE.Vector3());
        var fitDist   = Math.max(fitSize.x, fitSize.y, fitSize.z) * 1.9;
        camera.position.set(fitCenter.x, fitCenter.y + fitSize.y * 0.1, fitCenter.z + fitDist);
        controls.target.copy(fitCenter);
        controls.update();

        // Quitar indicador de carga si existe
        var hint = document.querySelector('.m3d-load-hint');
        if (hint) hint.remove();
    }, function (err) {
        console.error('[Model3D] Error al parsear GLB:', err);
        showNotification('❌ Error al cargar el modelo', 2500);
    });

    // Responsive
    var resizeObs = new ResizeObserver(function () {
        if (!_m3dRenderer) return;
        var nW = wrap.clientWidth;
        var nH = wrap.clientHeight;
        if (nW < 1 || nH < 1) return;
        renderer.setSize(nW, nH);
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
    });
    resizeObs.observe(wrap);

    // Loop
    function animate() {
        if (_m3dRenderer !== renderer) return;
        _m3dAnimFrame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}
