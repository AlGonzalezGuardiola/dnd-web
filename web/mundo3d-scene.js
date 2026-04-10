/* Mundo 3D — modelo GLB con Three.js r134 (global build) */
(function () {
  'use strict';

  let initialized = false;

  var MODES = {
    dia: {
      bg:      0x0a8fd4,
      fog:     { color: 0x0a8fd4, density: 0.012 },
      ambient: { color: 0xd0eeff, intensity: 1.2 },
      sun:     { color: 0xfff5cc, intensity: 2.5 },
      hemi:    { sky: 0x87ceeb, ground: 0x1a6b9e, intensity: 0.8 },
      stars:   false,
    },
    noche: {
      bg:      0x06021a,
      fog:     { color: 0x06021a, density: 0.018 },
      ambient: { color: 0xffeedd, intensity: 0.6 },
      sun:     { color: 0xffffff, intensity: 1.8 },
      hemi:    null,
      stars:   true,
    },
  };

  window.initMundo3D = function () {
    if (initialized) return;
    if (typeof THREE === 'undefined') return;
    if (typeof THREE.GLTFLoader === 'undefined') return;
    initialized = true;

    const section = document.getElementById('mundo3DSection');
    const canvas  = document.getElementById('m3dCanvas');
    const btn     = document.getElementById('m3dModeToggle');

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

    // ── Luces (referencias para actualizar) ─────────────
    var ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    var sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(6, 10, 5);
    scene.add(sunLight);

    var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0);
    scene.add(hemiLight);

    var fillA = new THREE.PointLight(0x33ddcc, 0, 40);
    fillA.position.set(-8, 3, -5);
    scene.add(fillA);

    var fillB = new THREE.PointLight(0xffaa33, 0, 20);
    fillB.position.set(2, -6, 3);
    scene.add(fillB);

    // ── Estrellas ───────────────────────────────────────
    var starBuf = new Float32Array(3000 * 3);
    for (var i = 0; i < starBuf.length; i++) starBuf[i] = (Math.random() - 0.5) * 200;
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starBuf, 3));
    var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, sizeAttenuation: true,
      transparent: true, opacity: 0.8,
    }));
    scene.add(stars);

    // ── Aplicar modo ────────────────────────────────────
    var currentMode = 'dia';

    function applyMode(modeKey) {
      var m = MODES[modeKey];
      scene.background = new THREE.Color(m.bg);
      scene.fog = new THREE.FogExp2(m.fog.color, m.fog.density);

      ambientLight.color.set(m.ambient.color);
      ambientLight.intensity = m.ambient.intensity;

      sunLight.color.set(m.sun.color);
      sunLight.intensity = m.sun.intensity;

      if (m.hemi) {
        hemiLight.color.set(m.hemi.sky);
        hemiLight.groundColor.set(m.hemi.ground);
        hemiLight.intensity = m.hemi.intensity;
        fillA.intensity = 0;
        fillB.intensity = 0;
      } else {
        hemiLight.intensity = 0;
        fillA.intensity = 1.2;
        fillB.intensity = 0.6;
      }

      stars.visible = m.stars;

      if (btn) {
        btn.textContent = modeKey === 'dia' ? '🌙 Noche' : '☀️ Día';
      }

      currentMode = modeKey;
    }

    applyMode('dia');

    window.toggleMundo3DMode = function () {
      applyMode(currentMode === 'dia' ? 'noche' : 'dia');
    };

    // ── Carga del modelo GLB ─────────────────────────────
    var modelPivot = new THREE.Group();
    scene.add(modelPivot);

    var placeholderGeo = new THREE.SphereGeometry(1, 12, 8);
    var placeholderMat = new THREE.MeshStandardMaterial({ color: 0x332255, wireframe: true, opacity: 0.3, transparent: true });
    var placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
    modelPivot.add(placeholder);

    var loader = new THREE.GLTFLoader();
    loader.load(
      'assets/3D/Meshy_AI_Bola_del_Mundo_0410111440_texture.glb',
      function (gltf) {
        modelPivot.remove(placeholder);
        placeholder.geometry.dispose();
        placeholder.material.dispose();

        var model = gltf.scene;
        var box    = new THREE.Box3().setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        var size   = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var scale  = 2.5 / maxDim;

        model.position.sub(center.multiplyScalar(scale));
        model.scale.setScalar(scale);
        modelPivot.add(model);

        camera.position.set(0, size.y * scale * 0.5, maxDim * scale * 2.5);
        controls.minDistance = maxDim * scale * 1.0;
        controls.maxDistance = maxDim * scale * 8.0;
        controls.update();
      },
      function (xhr) {
        if (xhr.total) console.log('Cargando modelo: ' + Math.round(xhr.loaded / xhr.total * 100) + '%');
      },
      function (err) {
        console.error('Error cargando GLB:', err);
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
