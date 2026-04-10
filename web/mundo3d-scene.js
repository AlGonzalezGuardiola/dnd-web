/* Mundo 3D — modelo GLB con Three.js r134 (global build) */
(function () {
  'use strict';

  let initialized = false;

  window.initMundo3D = function () {
    if (initialized) return;
    if (typeof THREE === 'undefined') return;
    if (typeof THREE.GLTFLoader === 'undefined') return;
    initialized = true;

    const section = document.getElementById('mundo3DSection');
    const canvas  = document.getElementById('m3dCanvas');

    const W = () => section.clientWidth  || window.innerWidth;
    const H = () => section.clientHeight || window.innerHeight;

    // ── Renderer ────────────────────────────────────────
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    } catch(e) {
      console.error('WebGLRenderer error:', e);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = false;

    // ── Escena ──────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a8fd4);
    scene.fog        = new THREE.FogExp2(0x0a8fd4, 0.012);

    // ── Cámara ──────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(48, W() / H(), 0.1, 500);
    camera.position.set(0, 1.5, 6);

    // ── OrbitControls ───────────────────────────────────
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance   = 2;
    controls.maxDistance   = 30;
    controls.enablePan     = false;

    // ── Luces ───────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xd0eeff, 1.2));

    var sun = new THREE.DirectionalLight(0xfff5cc, 2.5);
    sun.position.set(6, 10, 5);
    scene.add(sun);

    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x1a6b9e, 0.8));

    // ── Carga del modelo GLB ─────────────────────────────
    var modelPivot = new THREE.Group();
    scene.add(modelPivot);
    var loadedModel = null;

    // Mostrar placeholder mientras carga
    var placeholderGeo = new THREE.SphereGeometry(1, 12, 8);
    var placeholderMat = new THREE.MeshStandardMaterial({ color: 0x332255, wireframe: true, opacity: 0.3, transparent: true });
    var placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
    modelPivot.add(placeholder);

    var loader = new THREE.GLTFLoader();
    loader.load(
      'assets/3D/Meshy_AI_Bola_del_Mundo_0410111440_texture.glb',
      function (gltf) {
        // Eliminar placeholder
        modelPivot.remove(placeholder);
        placeholder.geometry.dispose();
        placeholder.material.dispose();

        var model = gltf.scene;

        // Centrar y escalar el modelo
        var box = new THREE.Box3().setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        var size   = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var scale  = 2.5 / maxDim;

        model.position.sub(center.multiplyScalar(scale));
        model.scale.setScalar(scale);

        modelPivot.add(model);
        loadedModel = model;

        // Ajustar cámara al tamaño del modelo
        camera.position.set(0, size.y * scale * 0.5, maxDim * scale * 2.5);
        controls.minDistance = maxDim * scale * 1.0;
        controls.maxDistance = maxDim * scale * 8.0;
        controls.update();

        console.log('Modelo 3D cargado:', gltf);
      },
      function (xhr) {
        if (xhr.total) {
          console.log('Cargando modelo: ' + Math.round(xhr.loaded / xhr.total * 100) + '%');
        }
      },
      function (err) {
        console.error('Error cargando GLB:', err);
        // Dejar placeholder visible en caso de error
        placeholder.material.opacity = 0.6;
        placeholder.material.wireframe = false;
        placeholder.material.color.set(0x441122);
      }
    );

    // ── Resize ──────────────────────────────────────────
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        var w = section.clientWidth;
        var h = section.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }).observe(section);
    }

    // ── Animación ───────────────────────────────────────
    var clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      var t = clock.getElapsedTime();
      modelPivot.rotation.y = t * 0.12;
      modelPivot.position.y = Math.sin(t * 0.4) * 0.08;
      controls.update();
      renderer.render(scene, camera);
    }

    animate();
  };
}());
