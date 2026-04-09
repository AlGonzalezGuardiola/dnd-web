/* ============================================
   world-map.js — Cinematic zoom between maps
   ============================================ */

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * Each entry describes a region on the world map that links to a detail map.
 *
 * HOW TO ADJUST COORDINATES:
 *   - `hotspot.x` and `hotspot.y` are percentages (0–100) of the world-map image dimensions.
 *   - Open Mundo.jpeg in an image editor, hover over the centre of Grumak'thar
 *     and read the pixel coordinates. Divide by image width/height × 100.
 *   - `hotspot.w` and `hotspot.h` are the hotspot circle size in percentage of image width.
 *
 * Example: if the image is 2000×1500 px and Grumak'thar's centre is at (1400, 750):
 *   x: (1400/2000)*100 = 70,  y: (750/1500)*100 = 50
 */
const WORLD_MAP_REGIONS = [
    {
        id: 'grumakthar',
        label: "Grumak'thar",
        // ── Adjust these two values to place the hotspot ──────────────────
        hotspot: { x: 62, y: 45, w: 4.5, h: 4.5 }, // % of image size
        // ─────────────────────────────────────────────────────────────────
        detailSrc: 'assets/mapas/Grumakthar.jpg',
    },
];

// Zoom scale applied to the world-map canvas during the cinematic transition.
// Higher = more dramatic zoom-in before cutting to the detail map.
const ZOOM_SCALE = 3.5;

// How long (ms) to stay at peak zoom before fading in the detail map.
const ZOOM_HOLD_MS = 200;

// ── State ─────────────────────────────────────────────────────────────────────

let _wmActive = false; // true while showing detail map

// ── Public entry point ────────────────────────────────────────────────────────

function initWorldMap() {
    const section = document.getElementById('worldMapSection');
    if (!section || section.dataset.wmInit) return;
    section.dataset.wmInit = '1';

    const canvas = section.querySelector('.wm-canvas');
    const worldImg = section.querySelector('.wm-world-img');
    const backBtn  = section.querySelector('.wm-btn-back');
    const vignette = section.querySelector('.wm-vignette');
    const regionLabel = section.querySelector('.wm-region-label');

    // Build hotspot elements
    WORLD_MAP_REGIONS.forEach(region => {
        const hs = _buildHotspot(region);
        canvas.appendChild(hs);

        hs.addEventListener('click', () => {
            if (_wmActive) return;
            _zoomIntoRegion(region, canvas, worldImg, vignette, regionLabel, backBtn);
        });
    });

    // Back button
    backBtn.addEventListener('click', () => {
        if (!_wmActive) return;
        _zoomBackToWorld(canvas, vignette, regionLabel, backBtn);
    });

    // Reset state when the section is hidden (user navigates away)
    const observer = new MutationObserver(() => {
        if (section.style.display === 'none' && _wmActive) {
            _resetInstant(canvas, vignette, regionLabel, backBtn);
        }
    });
    observer.observe(section, { attributes: true, attributeFilter: ['style'] });
}

// ── Hotspot builder ───────────────────────────────────────────────────────────

function _buildHotspot(region) {
    const el = document.createElement('div');
    el.className = 'wm-hotspot';
    el.setAttribute('data-label', region.label);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Zoom a ${region.label}`);

    const { x, y, w, h } = region.hotspot;
    el.style.left   = `${x}%`;
    el.style.top    = `${y}%`;
    el.style.width  = `${w}%`;
    el.style.height = `${h}%`;
    // Centre the circle on the percentage point
    el.style.transform = 'translate(-50%, -50%)';

    // Keyboard support
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') el.click();
    });

    return el;
}

// ── Zoom-in animation ─────────────────────────────────────────────────────────

function _zoomIntoRegion(region, canvas, worldImg, vignette, regionLabel, backBtn) {
    _wmActive = true;

    // 1. Compute transform-origin from hotspot centre (same percentages)
    const { x, y } = region.hotspot;
    canvas.style.transformOrigin = `${x}% ${y}%`;

    // 2. Hide hotspots
    canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.add('wm-hidden'));

    // 3. Start vignette + zoom
    vignette.classList.add('wm-active');
    canvas.style.transform = `scale(${ZOOM_SCALE})`;

    // 4. Mid-zoom: show region name
    const labelSpan = regionLabel.querySelector('span');
    if (labelSpan) labelSpan.textContent = region.label;

    setTimeout(() => {
        regionLabel.classList.add('wm-active');
    }, 400);

    // 5. After zoom settles: swap to detail map
    const zoomDuration = parseFloat(
        getComputedStyle(canvas).transitionDuration
    ) * 1000 || 1100;

    setTimeout(() => {
        // Inject detail layer if not already present
        let detailLayer = canvas.querySelector(`.wm-detail-layer[data-region="${region.id}"]`);
        if (!detailLayer) {
            detailLayer = document.createElement('div');
            detailLayer.className = 'wm-detail-layer';
            detailLayer.dataset.region = region.id;
            const img = document.createElement('img');
            img.src = region.detailSrc;
            img.alt = `Mapa de ${region.label}`;
            img.draggable = false;
            detailLayer.appendChild(img);
            canvas.appendChild(detailLayer);
        }

        // Fade in the detail map (transition delay set in CSS)
        detailLayer.classList.add('wm-visible');

        // Fade out the region label
        setTimeout(() => regionLabel.classList.remove('wm-active'), 500);

        // Show back button, hide vignette
        backBtn.style.display = 'inline-block';
        vignette.classList.remove('wm-active');

    }, zoomDuration + ZOOM_HOLD_MS);
}

// ── Zoom-out animation ────────────────────────────────────────────────────────

function _zoomBackToWorld(canvas, vignette, regionLabel, backBtn) {
    // 1. Fade out detail map instantly
    const detailLayer = canvas.querySelector('.wm-detail-layer.wm-visible');
    if (detailLayer) {
        detailLayer.style.transition = 'opacity 0.3s ease';
        detailLayer.style.opacity = '0';
    }

    // 2. Vignette on
    vignette.classList.add('wm-active');
    backBtn.style.display = 'none';

    // 3. Zoom back out
    setTimeout(() => {
        canvas.style.transform = 'scale(1)';
        vignette.classList.remove('wm-active');
    }, 350);

    // 4. Restore detail layer opacity & class after zoom-out completes
    const zoomDuration = parseFloat(
        getComputedStyle(canvas).transitionDuration
    ) * 1000 || 1100;

    setTimeout(() => {
        if (detailLayer) {
            detailLayer.classList.remove('wm-visible');
            detailLayer.style.transition = '';
            detailLayer.style.opacity = '';
        }
        // Restore hotspots
        canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.remove('wm-hidden'));
        _wmActive = false;
    }, 350 + zoomDuration);
}

// ── Instant reset (navigation away) ──────────────────────────────────────────

function _resetInstant(canvas, vignette, regionLabel, backBtn) {
    canvas.style.transition = 'none';
    canvas.style.transform  = 'scale(1)';
    canvas.style.transformOrigin = 'center center';

    canvas.querySelectorAll('.wm-detail-layer').forEach(l => {
        l.classList.remove('wm-visible');
    });
    canvas.querySelectorAll('.wm-hotspot').forEach(h => h.classList.remove('wm-hidden'));

    vignette.classList.remove('wm-active');
    regionLabel.classList.remove('wm-active');
    backBtn.style.display = 'none';
    _wmActive = false;

    // Re-enable transitions on next frame
    requestAnimationFrame(() => {
        canvas.style.transition = '';
    });
}

// ── Called by view.js when navigating to this view ───────────────────────────

function openWorldMapView() {
    setView('worldMap');
    // Lazy-init (safe to call multiple times)
    initWorldMap();
}
