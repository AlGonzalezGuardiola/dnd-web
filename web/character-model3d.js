// ============================================
// Character Model 3D — visor GLB por personaje
// Persiste en IndexedDB. Depende de THREE, OrbitControls, GLTFLoader.
// ============================================

var _m3dDB = null;
var _m3dRenderer = null;
var _m3dAnimFrame = null;

// ── IndexedDB helpers ────────────────────────────────────────────────────────

function _openM3DDB() {
    if (_m3dDB) return Promise.resolve(_m3dDB);
    return new Promise(function (resolve, reject) {
        var req = indexedDB.open('dnd_char_models', 1);
        req.onupgradeneeded = function (e) {
            e.target.result.createObjectStore('models');
        };
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

// ── Tab render ────────────────────────────────────────────────────────────────

function renderModel3DTab(charId) {
    var tab = document.getElementById('tabModel3D');
    if (!tab) return;
    tab.innerHTML =
        '<div class="m3d-tab">' +
            '<div class="m3d-upload-row">' +
                '<label class="m3d-upload-btn">' +
                    '📂 Cargar modelo GLB' +
                    '<input type="file" accept=".glb" style="display:none" onchange="onM3DFileUpload(\'' + charId + '\',this)">' +
                '</label>' +
                '<button class="m3d-delete-btn" id="m3dDeleteBtn" onclick="deleteM3DModel(\'' + charId + '\')" style="display:none">🗑️ Quitar</button>' +
            '</div>' +
            '<div class="m3d-canvas-wrap" id="m3dCanvasWrap">' +
                '<div class="m3d-placeholder" id="m3dPlaceholder">' +
                    '<div class="m3d-placeholder-icon">🎲</div>' +
                    '<div>Sin modelo 3D</div>' +
                    '<div class="m3d-placeholder-hint">Sube un archivo .glb para verlo aquí</div>' +
                '</div>' +
                '<canvas id="m3dCanvas" style="display:none;border-radius:12px"></canvas>' +
            '</div>' +
        '</div>';
}

// ── Activación del tab ────────────────────────────────────────────────────────
// Llamado cuando el usuario hace clic en el tab Modelo 3D

function activateModel3DTab(charId) {
    if (!charId) return;
    renderModel3DTab(charId);
    _loadM3DModel(charId).then(function (buf) {
        if (buf) _startM3DViewer(charId, buf);
    });
}

// ── Upload ────────────────────────────────────────────────────────────────────

function onM3DFileUpload(charId, input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
        var buf = e.target.result;
        _saveM3DModel(charId, buf).then(function () {
            _startM3DViewer(charId, buf);
            showNotification('✅ Modelo 3D guardado', 2000);
        });
    };
    reader.readAsArrayBuffer(file);
}

function deleteM3DModel(charId) {
    _stopM3DViewer();
    _deleteM3DModel(charId).then(function () {
        renderModel3DTab(charId);
        showNotification('🗑️ Modelo eliminado', 1500);
    });
}

// ── Visor Three.js ────────────────────────────────────────────────────────────

function _stopM3DViewer() {
    if (_m3dAnimFrame) { cancelAnimationFrame(_m3dAnimFrame); _m3dAnimFrame = null; }
    if (_m3dRenderer)  { _m3dRenderer.dispose(); _m3dRenderer = null; }
}

function _startM3DViewer(charId, arrayBuffer) {
    if (typeof THREE === 'undefined') {
        showNotification('⚠️ Three.js no disponible', 2000);
        return;
    }

    _stopM3DViewer();

    var canvas      = document.getElementById('m3dCanvas');
    var wrap        = document.getElementById('m3dCanvasWrap');
    var placeholder = document.getElementById('m3dPlaceholder');
    var deleteBtn   = document.getElementById('m3dDeleteBtn');
    if (!canvas || !wrap) return;

    canvas.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (deleteBtn)   deleteBtn.style.display   = 'inline-flex';

    // Dimensiones iniciales
    var W = wrap.clientWidth  || 400;
    var H = Math.round(Math.max(320, Math.min(520, W * 0.9)));
    canvas.width  = W;
    canvas.height = H;

    // Renderer
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding  = THREE.sRGBEncoding;
    renderer.toneMapping     = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    _m3dRenderer = renderer;

    // Escena
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);

    // Luces
    var ambient = new THREE.AmbientLight(0xffeedd, 0.7);
    scene.add(ambient);

    var sun = new THREE.DirectionalLight(0xfff5cc, 1.8);
    sun.position.set(5, 10, 7);
    sun.castShadow = true;
    scene.add(sun);

    var fill = new THREE.DirectionalLight(0x4488ff, 0.5);
    fill.position.set(-6, 2, -5);
    scene.add(fill);

    // Cámara
    var camera = new THREE.PerspectiveCamera(45, W / H, 0.001, 2000);
    camera.position.set(0, 1.5, 5);

    // Controles
    var controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.07;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 1.2;
    controls.enablePan       = false;
    controls.minDistance     = 0.1;
    controls.maxDistance     = 500;

    // Cargar GLB desde ArrayBuffer
    var loader = new THREE.GLTFLoader();
    loader.parse(arrayBuffer, '', function (gltf) {
        var model = gltf.scene;

        // Centrar y escalar para que quepa bien
        var box    = new THREE.Box3().setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        var size   = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var scale  = 3.0 / maxDim;

        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));

        scene.add(model);

        // Ajustar cámara al modelo escalado
        var fitBox    = new THREE.Box3().setFromObject(model);
        var fitCenter = fitBox.getCenter(new THREE.Vector3());
        var fitSize   = fitBox.getSize(new THREE.Vector3());
        var fitDist   = Math.max(fitSize.x, fitSize.y, fitSize.z) * 1.9;

        camera.position.set(
            fitCenter.x,
            fitCenter.y + fitSize.y * 0.15,
            fitCenter.z + fitDist
        );
        controls.target.copy(fitCenter);
        controls.update();
    }, function (err) {
        console.error('[Model3D] Error al parsear GLB:', err);
        showNotification('❌ Error al cargar el modelo', 2500);
    });

    // Responsive
    var _resizeObs = new ResizeObserver(function () {
        if (!_m3dRenderer) return;
        var nW = wrap.clientWidth;
        var nH = Math.round(Math.max(320, Math.min(520, nW * 0.9)));
        renderer.setSize(nW, nH);
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
    });
    _resizeObs.observe(wrap);

    // Loop de animación
    function animate() {
        if (_m3dRenderer !== renderer) return; // renderer fue reemplazado/dispuesto
        _m3dAnimFrame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

// Limpia el visor al cerrar la hoja de personaje
function cleanupM3DViewer() {
    _stopM3DViewer();
}
