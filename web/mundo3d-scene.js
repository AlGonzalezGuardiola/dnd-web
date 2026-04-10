/* Mundo 3D — modelo GLB con Three.js r134 (global build) */
(function () {
  'use strict';

  // ── Modos día/noche ──────────────────────────────────
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

  // ── Puntos de Interés ────────────────────────────────
  // theta: ángulo horizontal (0 = frente al modelo)
  // phi:   ángulo vertical desde el polo norte (0 = cima, Math.PI = base)
  // Ajusta estas coordenadas para que coincidan con tu modelo
  var POIS = [
    { id: 'p1', label: 'La Capital',           theta: 0.3,   phi: 1.1  },
    { id: 'p2', label: 'Bosque Élfico',         theta: 2.0,   phi: 0.85 },
    { id: 'p3', label: 'Montañas del Norte',    theta: -0.8,  phi: 0.4  },
    { id: 'p4', label: 'Puerto del Sur',        theta: 1.2,   phi: 1.75 },
    { id: 'p5', label: 'El Desierto Rojo',      theta: -2.1,  phi: 1.3  },
  ];

  var initialized = false;

  window.initMundo3D = function () {
    if (initialized) return;
    if (typeof THREE === 'undefined') return;
    if (typeof THREE.GLTFLoader === 'undefined') return;
    initialized = true;

    var section   = document.getElementById('mundo3DSection');
    var canvas    = document.getElementById('m3dCanvas');
    var btnToggle = document.getElementById('m3dModeToggle');
    var btnSalir  = document.getElementById('m3dBtnSalir');

    var W = function () { return section.clientWidth  || window.innerWidth; };
    var H = function () { return section.clientHeight || window.innerHeight; };

    // ── Renderer ─────────────────────────────────────────
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    } catch (e) { console.error('WebGLRenderer error:', e); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = false;

    // ── Escena ───────────────────────────────────────────
    var scene = new THREE.Scene();

    // ── Cámara ───────────────────────────────────────────
    var camera = new THREE.PerspectiveCamera(48, W() / H(), 0.1, 500);
    var defaultCamPos = new THREE.Vector3(0, 1.5, 6);
    camera.position.copy(defaultCamPos);

    // ── OrbitControls ────────────────────────────────────
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance   = 2;
    controls.maxDistance   = 30;
    controls.enablePan     = false;

    // ── Luces ────────────────────────────────────────────
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

    // ── Estrellas ────────────────────────────────────────
    var starBuf = new Float32Array(3000 * 3);
    for (var i = 0; i < starBuf.length; i++) starBuf[i] = (Math.random() - 0.5) * 200;
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starBuf, 3));
    var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.8,
    }));
    scene.add(stars);

    // ── Modo día/noche ───────────────────────────────────
    var currentMode = 'dia';

    function applyMode(modeKey) {
      var m = MODES[modeKey];
      scene.background = new THREE.Color(m.bg);
      scene.fog = new THREE.FogExp2(m.fogColor, m.fogDensity);
      ambientLight.color.set(m.ambientColor);
      ambientLight.intensity = m.ambientIntensity;
      sunLight.color.set(m.sunColor);
      sunLight.intensity = m.sunIntensity;
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
      if (btnToggle) btnToggle.textContent = modeKey === 'dia' ? '🌙 Noche' : '☀️ Día';
      currentMode = modeKey;
    }

    applyMode('dia');
    window.toggleMundo3DMode = function () { applyMode(currentMode === 'dia' ? 'noche' : 'dia'); };

    // ── Modelo GLB ───────────────────────────────────────
    var modelPivot  = new THREE.Group();
    scene.add(modelPivot);
    var modelRadius = 1.25;
    var autoRotate  = true;
    var rotationOffset = 0; // acumulado cuando se pausa la rotación

    var phGeo = new THREE.SphereGeometry(1, 12, 8);
    var phMat = new THREE.MeshStandardMaterial({ color: 0x332255, wireframe: true, opacity: 0.3, transparent: true });
    var placeholder = new THREE.Mesh(phGeo, phMat);
    modelPivot.add(placeholder);

    // ── Zoom a POI ───────────────────────────────────────
    var zoomActive    = false;
    var zoomTargetPos = new THREE.Vector3();
    var zoomTargetAt  = new THREE.Vector3();
    var tmpVec        = new THREE.Vector3();

    function zoomToPoi(poi) {
      if (zoomActive) return;

      // Posición mundial del POI en el momento actual (rotación congelada)
      tmpVec.copy(poi.localPos).applyEuler(modelPivot.rotation);

      var dir      = tmpVec.clone().normalize();
      var zoomDist = modelRadius * 1.3;
      zoomTargetPos.copy(tmpVec).add(dir.multiplyScalar(zoomDist));
      zoomTargetAt.copy(tmpVec);

      // Congelar rotación en la posición actual
      rotationOffset = modelPivot.rotation.y;
      autoRotate     = false;
      controls.enabled = false;
      zoomActive     = true;

      // Ocultar todos los marcadores durante el zoom
      POIS.forEach(function (p) { if (p.el) p.el.style.display = 'none'; });

      if (btnSalir) btnSalir.style.display = 'inline-block';
    }

    window.m3dZoomOut = function () {
      zoomActive       = false;
      autoRotate       = true;
      controls.enabled = true;
      controls.target.set(0, 0, 0);

      if (btnSalir) btnSalir.style.display = 'none';

      // Animar vuelta a posición por defecto
      var startPos  = camera.position.clone();
      var startAt   = controls.target.clone();
      var t0        = performance.now();
      var dur       = 800;

      function animBack() {
        var elapsed = performance.now() - t0;
        var t       = Math.min(elapsed / dur, 1);
        var ease    = 1 - Math.pow(1 - t, 3); // ease-out cúbico
        camera.position.lerpVectors(startPos, defaultCamPos, ease);
        controls.target.lerpVectors(startAt, new THREE.Vector3(0, 0, 0), ease);
        if (t < 1) requestAnimationFrame(animBack);
        else controls.update();
      }
      animBack();
    };

    // ── Crear marcadores HTML ────────────────────────────
    function buildMarkers() {
      POIS.forEach(function (poi) {
        // Posición local (coordenadas esféricas → cartesianas)
        poi.localPos = new THREE.Vector3(
          modelRadius * Math.sin(poi.phi) * Math.cos(poi.theta),
          modelRadius * Math.cos(poi.phi),
          modelRadius * Math.sin(poi.phi) * Math.sin(poi.theta)
        );

        var el = document.createElement('div');
        el.className    = 'm3d-poi-marker';
        el.dataset.id   = poi.id;
        el.innerHTML    = '<span class="m3d-poi-dot"></span><span class="m3d-poi-label">' + poi.label + '</span>';
        el.style.display = 'none';
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          zoomToPoi(poi);
        });
        section.appendChild(el);
        poi.el = el;
      });
    }

    // ── Actualizar posición de marcadores cada frame ─────
    function updateMarkers() {
      if (zoomActive) return;

      var camNorm = camera.position.clone().normalize();

      POIS.forEach(function (poi) {
        if (!poi.el || !poi.localPos) return;

        // Posición mundial con la rotación actual del pivot
        tmpVec.copy(poi.localPos).applyEuler(modelPivot.rotation);

        // Oclusión: ocultar si el punto está en la cara trasera del globo
        if (tmpVec.clone().normalize().dot(camNorm) < 0.08) {
          poi.el.style.display = 'none';
          return;
        }

        // Proyección 3D → 2D
        var proj = tmpVec.clone().project(camera);
        var x    = (proj.x * 0.5 + 0.5) * W();
        var y    = (-proj.y * 0.5 + 0.5) * H();

        poi.el.style.display = 'flex';
        poi.el.style.left    = x + 'px';
        poi.el.style.top     = y + 'px';
      });
    }

    // ── Carga del modelo ────────────────────────────────
    var loader = new THREE.GLTFLoader();
    loader.load(
      'assets/3D/Meshy_AI_Bola_del_Mundo_0410111440_texture.glb',
      function (gltf) {
        modelPivot.remove(placeholder);
        phGeo.dispose();
        phMat.dispose();

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

        defaultCamPos.set(0, size.y * scale * 0.5, maxDim * scale * 2.5);
        camera.position.copy(defaultCamPos);
        controls.minDistance = maxDim * scale * 1.0;
        controls.maxDistance = maxDim * scale * 8.0;
        controls.update();

        buildMarkers();
        console.log('Modelo 3D cargado. Radio estimado:', modelRadius);
      },
      function (xhr) {
        if (xhr.total) console.log('Cargando: ' + Math.round(xhr.loaded / xhr.total * 100) + '%');
      },
      function (err) {
        console.error('Error cargando GLB:', err);
        phMat.opacity  = 0.6;
        phMat.wireframe = false;
        phMat.color.set(0x441122);
        buildMarkers();
      }
    );

    // ── Resize ───────────────────────────────────────────
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        var w = section.clientWidth, h = section.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }).observe(section);
    }

    // ── Animación ────────────────────────────────────────
    var clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      var t = clock.getElapsedTime();

      if (autoRotate) {
        modelPivot.rotation.y = rotationOffset + t * 0.12;
        modelPivot.position.y = Math.sin(t * 0.4) * 0.08;
      }

      // Lerp de cámara hacia el POI activo
      if (zoomActive) {
        camera.position.lerp(zoomTargetPos, 0.06);
        controls.target.lerp(zoomTargetAt, 0.06);
        camera.lookAt(controls.target);
      }

      updateMarkers();
      controls.update();
      renderer.render(scene, camera);
    }

    animate();
  };
}());
