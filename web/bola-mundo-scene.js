import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let initialized = false;

export function initBolaMundo() {
  if (initialized) return;
  initialized = true;

  const canvas  = document.getElementById('bmCanvas');
  const section = document.getElementById('bolaMundoSection');

  // Dimensiones reales de la sección en este momento
  const W = () => section.clientWidth  || innerWidth;
  const H = () => section.clientHeight || innerHeight;

  // ── Renderer ──────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // ── Escena ────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06021a);
  scene.fog        = new THREE.FogExp2(0x06021a, 0.025);

  // ── Cámara ────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(48, W() / H(), 0.1, 100);
  camera.position.set(0, 1.2, 5.5);

  // ── OrbitControls ─────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance   = 2.5;
  controls.maxDistance   = 14;
  controls.enablePan     = false;

  // ── Luces ─────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffeedd, 0.6));

  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(4, 6, 3);
  scene.add(sun);

  const fillA = new THREE.PointLight(0x33ddcc, 1.0, 18);
  fillA.position.set(-5, 2, -3);
  scene.add(fillA);

  const fillB = new THREE.PointLight(0xffaa33, 0.5, 12);
  fillB.position.set(1, -4, 2);
  scene.add(fillB);

  // ── Estrellas ─────────────────────────────────────────
  const starBuf = new Float32Array(2400 * 3);
  for (let i = 0; i < starBuf.length; i++) starBuf[i] = (Math.random() - 0.5) * 90;
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starBuf, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.07, sizeAttenuation: true,
    transparent: true, opacity: 0.85,
  })));

  // ── Mundo low-poly ────────────────────────────────────
  const worldGeo = new THREE.SphereGeometry(1, 12, 8);
  let worldMat   = new THREE.MeshStandardMaterial({ color: 0x6644cc, roughness: 0.8 });
  const worldPivot = new THREE.Group();
  scene.add(worldPivot);
  const world = new THREE.Mesh(worldGeo, worldMat);
  // flatShading requiere recalcular normales por cara
  world.geometry.computeVertexNormals();
  worldPivot.add(world);

  // Halo atmosférico
  worldPivot.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.06, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x8855ff, transparent: true, opacity: 0.06,
      side: THREE.FrontSide, depthWrite: false,
    })
  ));

  // ── Textura ───────────────────────────────────────────
  new THREE.TextureLoader().load(
    'assets/mapas/BolaMundo.jpg',
    tex => {
      tex.colorSpace  = THREE.SRGBColorSpace;
      tex.anisotropy  = renderer.capabilities.getMaxAnisotropy();
      worldMat = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.8, metalness: 0.02, flatShading: true,
      });
      world.material = worldMat;
    },
    undefined,
    err => console.warn('Textura no cargada:', err)
  );

  // ── Resize via ResizeObserver ──────────────────────────
  new ResizeObserver(() => {
    const w = section.clientWidth;
    const h = section.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  }).observe(section);

  // ── Animación ─────────────────────────────────────────
  const clock = new THREE.Clock();

  (function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    world.rotation.y       = t * 0.18;
    worldPivot.position.y  = Math.sin(t * 0.45) * 0.14;
    controls.update();
    renderer.render(scene, camera);
  })();
}

// Exponer globalmente para que view.js (no-módulo) pueda llamarlo
window.initBolaMundo = initBolaMundo;
