// ============================================
// Character Model 3D — visor GLB por personaje
// Subida binaria directa (misma lógica que mundo3d-scene.js)
// Persistencia en servidor (/api/char-models)
// ============================================

var _m3dCharId    = null;
var _m3dCharName  = null;
var _m3dRenderer  = null;
var _m3dAnimFrame = null;

// ── API helpers (igual que API_BASE en globals.js) ───────────────────────────

function _m3dSaveModel(charId, file) {
    var uploadUrl = API_BASE + '/api/char-models/upload'
        + '?charId='    + encodeURIComponent(charId)
        + '&filename='  + encodeURIComponent(file.name);

    return fetch(uploadUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body:    file,
    }).then(function (r) {
        if (!r.ok) {
            return r.text().then(function (txt) {
                var msg = txt;
                try { msg = JSON.parse(txt).error || txt; } catch (e) {}
                throw new Error(msg);
            });
        }
        return r.json();
    });
}

function _m3dGetModel(charId) {
    return fetch(API_BASE + '/api/char-models/' + encodeURIComponent(charId))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function ()  { return null; });
}

function _m3dDeleteModel(charId) {
    return fetch(API_BASE + '/api/char-models/' + encodeURIComponent(charId), { method: 'DELETE' })
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

// ── Subida (binario directo, igual que mundo3d-scene.js) ─────────────────────

function onM3DFileUpload(charId, input) {
    var file = input.files && input.files[0];
    if (!file) return;

    var body = document.getElementById('model3dPageBody');
    if (body) body.innerHTML = '<div class="m3d-loading">Subiendo modelo…</div>';

    _m3dSaveModel(charId, file)
        .then(function (data) {
            showNotification('✅ Modelo 3D guardado', 2000);
            _renderViewer(charId, data.url);
        })
        .catch(function (err) {
            showNotification('❌ Error: ' + err.message, 4000);
            _renderUploadPrompt(charId);
        });
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

// ── Visor Three.js (misma receta de luces que mundo3d-scene.js) ───────────────

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

    // ── Renderer (igual que mundo3d-scene.js) ─────────────────
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = false;
    _m3dRenderer = renderer;

    // ── Escena ────────────────────────────────────────────────
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);

    // ── Luces (igual que mundo3d-scene.js modo noche) ─────────
    var ambientLight = new THREE.AmbientLight(0xffeedd, 0.6);
    scene.add(ambientLight);

    var sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(6, 10, 5);
    scene.add(sunLight);

    var fillA = new THREE.PointLight(0x33ddcc, 1.2, 40);
    fillA.position.set(-8, 3, -5);
    scene.add(fillA);

    var fillB = new THREE.PointLight(0xffaa33, 0.6, 20);
    fillB.position.set(2, -6, 3);
    scene.add(fillB);

    // ── Cámara ────────────────────────────────────────────────
    var camera = new THREE.PerspectiveCamera(48, W / H, 0.001, 2000);
    camera.position.set(0, 1.5, 6);

    // ── Controles ─────────────────────────────────────────────
    var controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.06;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 1.2;
    controls.enablePan       = false;
    controls.minDistance     = 0.05;
    controls.maxDistance     = 500;

    // ── Cargar GLB (URL relativa, igual que mundo3d-scene.js) ──
    var loader = new THREE.GLTFLoader();
    loader.load(glbUrl, function (gltf) {
        // Mismo proceso de escalado que mundo3d-scene.js _applyGltf
        var model  = gltf.scene;
        var box    = new THREE.Box3().setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        var size   = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var scale  = 2.5 / maxDim;

        model.position.sub(center.multiplyScalar(scale));
        model.scale.setScalar(scale);
        scene.add(model);

        // Ajustar cámara
        var fitBox   = new THREE.Box3().setFromObject(model);
        var fitCtr   = fitBox.getCenter(new THREE.Vector3());
        var fitSize  = fitBox.getSize(new THREE.Vector3());
        var dist     = maxDim * scale * 2.5;

        camera.position.set(fitCtr.x, fitSize.y * scale * 0.3, dist);
        controls.target.copy(fitCtr);
        controls.minDistance = maxDim * scale * 1.0;
        controls.maxDistance = maxDim * scale * 8.0;
        controls.update();
    }, undefined, function (err) {
        console.error('[Model3D] Error cargando GLB:', err);
        showNotification('❌ Error al cargar el modelo', 2500);
    });

    // ── Responsive ────────────────────────────────────────────
    new ResizeObserver(function () {
        if (!_m3dRenderer) return;
        var nW = wrap.clientWidth;
        var nH = wrap.clientHeight;
        if (nW < 10 || nH < 10) return;
        renderer.setSize(nW, nH);
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
    }).observe(wrap);

    // ── Loop ──────────────────────────────────────────────────
    (function animate() {
        if (_m3dRenderer !== renderer) return;
        _m3dAnimFrame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    })();
}
