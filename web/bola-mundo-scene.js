/* Bola del Mundo — Three.js r134 (global build, sin ES modules) */
(function () {
  'use strict';

  function dbg(msg) {
    var el = document.getElementById('bmDebug');
    if (el) el.textContent += msg + '\n';
    console.log('[BolaMundo]', msg);
  }

  // Marca que el script cargó
  dbg('script cargado. THREE=' + (typeof THREE));

  let initialized = false;

  window.initBolaMundo = function () {
    dbg('initBolaMundo() llamado');
    if (initialized) { dbg('ya inicializado'); return; }
    if (typeof THREE === 'undefined') {
      dbg('ERROR: THREE no definido');
      return;
    }
    initialized = true;

    const section = document.getElementById('bolaMundoSection');
    const canvas  = document.getElementById('bmCanvas');

    const W = () => section.clientWidth  || window.innerWidth;
    const H = () => section.clientHeight || window.innerHeight;

    dbg('section: ' + W() + 'x' + H());
    dbg('canvas el: ' + (canvas ? 'ok' : 'NULL'));

    // ── Renderer ────────────────────────────────────────
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      dbg('WebGLRenderer: ok');
    } catch(e) {
      dbg('ERROR WebGLRenderer: ' + e.message);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    dbg('renderer size: ' + W() + 'x' + H());

    // ── Escena ──────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06021a);
    scene.fog        = new THREE.FogExp2(0x06021a, 0.025);

    // ── Cámara ──────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(48, W() / H(), 0.1, 100);
    camera.position.set(0, 1.2, 5.5);

    // ── OrbitControls ───────────────────────────────────
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance   = 2.5;
    controls.maxDistance   = 14;
    controls.enablePan     = false;

    // ── Luces ───────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffeedd, 0.6));

    var sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(4, 6, 3);
    scene.add(sun);

    var fillA = new THREE.PointLight(0x33ddcc, 1.0, 18);
    fillA.position.set(-5, 2, -3);
    scene.add(fillA);

    var fillB = new THREE.PointLight(0xffaa33, 0.5, 12);
    fillB.position.set(1, -4, 2);
    scene.add(fillB);

    // ── Estrellas ───────────────────────────────────────
    var starBuf = new Float32Array(2400 * 3);
    for (var i = 0; i < starBuf.length; i++) starBuf[i] = (Math.random() - 0.5) * 90;
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starBuf, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.07, sizeAttenuation: true,
      transparent: true, opacity: 0.85,
    })));

    // ── Mundo low-poly ───────────────────────────────────
    var worldGeo = new THREE.SphereGeometry(1, 12, 8);
    var worldMat = new THREE.MeshStandardMaterial({ color: 0x6644cc, roughness: 0.8 });
    var worldPivot = new THREE.Group();
    scene.add(worldPivot);
    var world = new THREE.Mesh(worldGeo, worldMat);
    worldPivot.add(world);

    // Halo atmosférico
    worldPivot.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0x8855ff, transparent: true, opacity: 0.06,
        side: THREE.FrontSide, depthWrite: false,
      })
    ));

    dbg('escena lista, cargando textura...');

    // ── Textura ─────────────────────────────────────────
    new THREE.TextureLoader().load(
      'BolaMundo.jpg',
      function (tex) {
        dbg('textura cargada OK');
        var mat = new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.8, metalness: 0.02,
        });
        world.material = mat;
        worldMat = mat;
      },
      undefined,
      function (err) { dbg('ERROR textura: ' + (err && err.message || 'desconocido')); }
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
      world.rotation.y      = t * 0.18;
      worldPivot.position.y = Math.sin(t * 0.45) * 0.14;
      controls.update();
      renderer.render(scene, camera);
    }

    animate();
  };
}());
