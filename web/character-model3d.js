// ============================================
// Character Model 3D — visor GLB por personaje
// Persistencia en servidor (/api/char-models).
// Depende de THREE, OrbitControls, GLTFLoader.
// ============================================

var _m3dCharId   = null;
var _m3dCharName = null;
var _m3dRenderer = null;
var _m3dAnimFrame = null;

// ── API helpers ──────────────────────────────────────────────────────────────

function _m3dApiBase() {
    return (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? 'http://localhost:3001'
        : window.location.origin;
}

function _m3dGetModel(charId) {
    return fetch(_m3dApiBase() + '/api/char-models/' + charId)
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function ()  { return null; });
}

function _m3dSaveModel(charId, fileDataUri) {
    return fetch(_m3dApiBase() + '/api/char-models', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ charId: charId, fileData: fileDataUri })
    }).then(function (r) { return r.json(); });
}

function _m3dDeleteModel(charId) {
    return fetch(_m3dApiBase() + '/api/char-models/' + charId, { method: 'DELETE' })
        .then(function (r) { return r.json(); });
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

// ── Renderizar contenido ─────────────────────────────────────────────────────

function _renderModel3DPage(charId) {
    var body = document.getElementById('model3dPageBody');
    if (!body) return;
    body.innerHTML = '<div class="m3d-loading">Buscando modelo…</div>';

    _m3dGetModel(charId).then(function (data) {
        if (data && data.url) {
            _renderViewer(charId, data.url);
        } else {
            _renderUploadPrompt(charId);
        }
    });
}

function _renderUploadPrompt(charId) {
    var body = document.getElementById('model3dPageBody');
    if (!body) return;
    body.innerHTML =
        '<div class="m3d-empty-state">' +
            '<div class="m3d-empty-icon">🎲</div>' +
            '<div class="m3d-empty-title">Sin modelo 3D</div>' +
            '<div class="m3d-empty-hint">Sube un archivo .glb para ver a este personaje en 3D desde cualquier dispositivo</div>' +
            '<label class="m3d-upload-btn">' +
                '📂 Cargar modelo GLB' +
                '<input type="file" accept=".glb" style="display:none" onchange="onM3DFileUpload(\'' + charId + '\',this)">' +
            '</label>' +
        '</div>';
}

function _renderViewer(charId, glbUrl) {
    var body = document.getElementById('model3dPageBody');
    if (!body) return;
    body.innerHTML =
        '<div class="m3d-viewer-wrap">' +
            '<canvas id="m3dCanvas"></canvas>' +
            '<div class="m3d-controls-hint">Arrastrar · Scroll para zoom</div>' +
            '<div class="m3d-viewer-actions">' +
                '<label class="m3d-replace-btn" title="Cambiar modelo">' +
                    '📂 Cambiar' +
                    '<input type="file" accept=".glb" style="display:none" onchange="onM3DFileUpload(\'' + charId + '\',this)">' +
                '</label>' +
                '<button class="m3d-delete-btn" onclick="deleteM3DModel(\'' + charId + '\')">🗑️ Quitar</button>' +
            '</div>' +
        '</div>';

    requestAnimationFrame(function () {
        _startM3DViewer(glbUrl);
    });
}

// ── Subida ────────────────────────────────────────────────────────────────────

function onM3DFileUpload(charId, input) {
    var file = input.files && input.files[0];
    if (!file) return;

    var body = document.getElementById('model3dPageBody');
    if (body) body.innerHTML = '<div class="m3d-loading">Subiendo modelo… (puede tardar unos segundos)</div>';

    var reader = new FileReader();
    reader.onload = function (e) {
        var dataUri = e.target.result;          // data:application/octet-stream;base64,...
        _m3dSaveModel(charId, dataUri)
            .then(function (res) {
                if (res.url) {
                    showNotification('✅ Modelo 3D guardado', 2000);
                    _renderViewer(charId, res.url);
                } else {
                    showNotification('❌ ' + (res.error || 'Error al guardar'), 3000);
                    _renderUploadPrompt(charId);
                }
            })
            .catch(function () {
                showNotification('❌ Error de conexión', 3000);
                _renderUploadPrompt(charId);
            });
    };
    reader.readAsDataURL(file);
}

function deleteM3DModel(charId) {
    _stopM3DViewer();
    _m3dDeleteModel(charId).then(function () {
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

function _startM3DViewer(glbUrl) {
    if (typeof THREE === 'undefined') {
        showNotification('⚠️ Three.js no disponible', 2000);
        return;
    }

    _stopM3DViewer();

    var canvas = document.getElementById('m3dCanvas');
    var wrap   = canvas && canvas.parentElement;
    if (!canvas || !wrap) return;

    var W = wrap.clientWidth  || window.innerWidth;
    var H = wrap.clientHeight || window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    // ── Renderer ─────────────────────────────────────────────
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;   // igual que mundo3d — sin tone mapping
    renderer.shadowMap.enabled = false;
    _m3dRenderer = renderer;

    // ── Escena ────────────────────────────────────────────��───
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);

    // ── Luces (misma receta que mundo3d-scene.js) ─────────────
    var ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    var sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(6, 10, 5);
    scene.add(sun);

    var hemi = new THREE.HemisphereLight(0xddeeff, 0x222244, 0.8);
    scene.add(hemi);

    var fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-5, 3, -5);
    scene.add(fill);

    // ── Cámara ─────────────────────────────────────────────���──
    var camera = new THREE.PerspectiveCamera(45, W / H, 0.001, 2000);
    camera.position.set(0, 1.5, 5);

    // ── Controles ─────────────────────────────────────────────
    var controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.07;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 1.5;
    controls.enablePan       = false;
    controls.minDistance     = 0.05;
    controls.maxDistance     = 500;

    // ── Cargar GLB desde URL ──────────────────────────────────
    var loader = new THREE.GLTFLoader();
    loader.load(glbUrl, function (gltf) {
        var model = gltf.scene;

        // Centrar y escalar para que quepa en pantalla
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
            fitCenter.y + fitSize.y * 0.1,
            fitCenter.z + fitDist
        );
        controls.target.copy(fitCenter);
        controls.update();
    }, undefined, function (err) {
        console.error('[Model3D] Error cargando GLB:', err);
        showNotification('❌ Error al cargar el modelo', 2500);
    });

    // ── Responsive ────────────────────────────────────────────
    var resizeObs = new ResizeObserver(function () {
        if (!_m3dRenderer) return;
        var nW = wrap.clientWidth;
        var nH = wrap.clientHeight;
        if (nW < 10 || nH < 10) return;
        renderer.setSize(nW, nH);
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
    });
    resizeObs.observe(wrap);

    // ── Loop ──────────────────────────────────────────────────
    function animate() {
        if (_m3dRenderer !== renderer) return;
        _m3dAnimFrame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}
