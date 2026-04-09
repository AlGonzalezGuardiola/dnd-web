// ============================================================
// narrative.js — Crónicas de la Campaña
// ============================================================
// Persisted in MongoDB via /api/narrative-sessions
// Local shape: { id, number, title, sessionDate, summary, content, tags, createdAt, updatedAt }

(function () {
    'use strict';

    const STORAGE_KEY = 'dnd_narrative_sessions';

    const PREDEFINED_TAGS = [
        { key: 'revelacion', label: '🔮 Revelación',     color: '#a78bfa' },
        { key: 'combate',    label: '⚔️ Combate épico',   color: '#f87171' },
        { key: 'aliado',     label: '🤝 Nuevo aliado',    color: '#4ade80' },
        { key: 'perdida',    label: '💀 Pérdida',         color: '#94a3b8' },
        { key: 'tesoro',     label: '💎 Tesoro',          color: '#fbbf24' },
        { key: 'viaje',      label: '🗺️ Viaje',           color: '#60a5fa' },
        { key: 'misterio',   label: '❓ Misterio',        color: '#c084fc' },
        { key: 'giro',       label: '🌀 Giro argumental', color: '#fb923c' },
    ];

    // ── State ──────────────────────────────────────────────────
    let sessions        = [];
    let currentId       = null;
    let isEditMode      = false;
    let autoSaveTimer   = null;
    let timelineVisible = false;

    // ── API ────────────────────────────────────────────────────
    function apiBase() { return API_BASE + '/api/narrative-sessions'; }

    async function apiLoad() {
        try {
            const res = await fetch(apiBase());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            sessions = (data.sessions || []).map(s => ({
                id:          s.clientId,
                number:      s.number,
                title:       s.title,
                sessionDate: s.sessionDate,
                summary:     s.summary,
                content:     s.content,
                tags:        s.tags || [],
                createdAt:   s.createdAt,
                updatedAt:   s.updatedAt,
            }));
            sessions.sort((a, b) => a.number - b.number);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch (_) {}
        } catch (e) {
            try { sessions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { sessions = []; }
        }
    }

    async function apiSave(session) {
        try {
            const res = await fetch(apiBase(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId:    session.id,
                    number:      session.number,
                    title:       session.title,
                    sessionDate: session.sessionDate,
                    summary:     session.summary,
                    content:     session.content,
                    tags:        session.tags,
                    createdAt:   session.createdAt,
                    updatedAt:   session.updatedAt,
                }),
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
        } catch (e) {
            console.warn('[narrative] save failed:', e.message);
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch (_) {}
    }

    async function apiDelete(id) {
        try {
            const res = await fetch(apiBase() + '/' + id, { method: 'DELETE' });
            if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
        } catch (e) {
            console.warn('[narrative] delete failed:', e.message);
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch (_) {}
    }

    // ── Utilities ──────────────────────────────────────────────
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function toRoman(n) {
        if (!n || n < 1) return '?';
        const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
        const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
        let r = '';
        for (let i = 0; i < vals.length; i++) {
            while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
        }
        return r;
    }

    function fmtSessionDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone shift
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function escHtml(s) {
        return (s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function nextSessionNumber() {
        if (sessions.length === 0) return 1;
        return Math.max(...sessions.map(s => s.number || 0)) + 1;
    }

    // ── Entry point ────────────────────────────────────────────
    window.openNarrativeSection = function () {
        setView('narrativaHub');
    };

    window.openCronicas = function () {
        setView('narrative');
        currentId  = null;
        isEditMode = false;
        // Render from cache immediately
        renderSessionList();
        showEmptyState();
        // Then hydrate from API
        apiLoad().then(() => {
            renderSessionList();
            if (sessions.length > 0) {
                // Open the latest session by default
                narrativeOpenSession(sessions[sessions.length - 1].id);
            }
        });
    };

    // ── New session ────────────────────────────────────────────
    window.narrativeNewSession = function () {
        const session = {
            id:          uid(),
            number:      nextSessionNumber(),
            title:       '',
            sessionDate: new Date().toISOString().slice(0, 10),
            summary:     '',
            content:     '',
            tags:        [],
            createdAt:   new Date().toISOString(),
            updatedAt:   new Date().toISOString(),
        };
        sessions.push(session);
        sessions.sort((a, b) => a.number - b.number);
        apiSave(session);
        currentId  = session.id;
        isEditMode = true;
        renderSessionList();
        renderSessionEditor(session);
        setTimeout(() => {
            const el = document.getElementById('narrativeTitleInput');
            if (el) el.focus();
        }, 50);
    };

    // ── Open session (read mode) ───────────────────────────────
    window.narrativeOpenSession = function (id) {
        clearTimeout(autoSaveTimer);
        currentId  = id;
        isEditMode = false;
        renderSessionList();
        if (timelineVisible) renderTimeline();
        const session = sessions.find(s => s.id === id);
        if (session) renderSessionView(session);
    };

    // ── Toggle edit / view ─────────────────────────────────────
    window.narrativeToggleEdit = function () {
        const session = sessions.find(s => s.id === currentId);
        if (!session) return;
        isEditMode = !isEditMode;
        if (isEditMode) renderSessionEditor(session);
        else            renderSessionView(session);
    };

    // ── Auto-save ──────────────────────────────────────────────
    window.narrativeAutoSave = function () {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(narrativeSave, 900);
    };

    // ── Save (reads from current form inputs) ─────────────────
    window.narrativeSave = function () {
        if (!currentId) return;
        const session = sessions.find(s => s.id === currentId);
        if (!session) return;

        const titleEl   = document.getElementById('narrativeTitleInput');
        const dateEl    = document.getElementById('narrativeDateInput');
        const numEl     = document.getElementById('narrativeNumberInput');
        const summaryEl = document.getElementById('narrativeSummaryInput');
        const contentEl = document.getElementById('narrativeContentInput');

        if (titleEl)   session.title       = titleEl.value.trim()              || 'Sin título';
        if (dateEl)    session.sessionDate  = dateEl.value;
        if (numEl)     session.number       = parseInt(numEl.value, 10)         || session.number;
        if (summaryEl) session.summary      = summaryEl.value.trim();
        if (contentEl) session.content      = contentEl.value;

        session.updatedAt = new Date().toISOString();
        sessions.sort((a, b) => a.number - b.number);
        apiSave(session);
        renderSessionList();
    };

    // ── Save and switch to view mode ───────────────────────────
    window.narrativeSaveAndView = function () {
        narrativeSave();
        isEditMode = false;
        const session = sessions.find(s => s.id === currentId);
        if (session) renderSessionView(session);
    };

    // ── Delete current session ─────────────────────────────────
    window.narrativeDeleteSession = function () {
        if (!currentId) return;
        if (!confirm('¿Borrar este capítulo? Esta acción no se puede deshacer.')) return;
        const id = currentId;
        sessions = sessions.filter(s => s.id !== id);
        apiDelete(id);
        currentId  = null;
        isEditMode = false;
        renderSessionList();
        if (sessions.length > 0) {
            narrativeOpenSession(sessions[sessions.length - 1].id);
        } else {
            showEmptyState();
        }
        showNotification('Capítulo eliminado', 1800);
    };

    // ── Toggle tag (editor only) ───────────────────────────────
    window.narrativeToggleTag = function (tagKey) {
        if (!currentId) return;
        const session = sessions.find(s => s.id === currentId);
        if (!session) return;
        const idx = session.tags.indexOf(tagKey);
        if (idx === -1) session.tags.push(tagKey);
        else session.tags.splice(idx, 1);
        const container = document.getElementById('narrativeTagPills');
        if (container) container.innerHTML = buildTagPillsHtml(session.tags);
    };

    // ── Render helpers ─────────────────────────────────────────
    function showEmptyState() {
        const main = document.getElementById('narrativeMain');
        if (!main) return;
        main.innerHTML = `
            <div class="narrative-empty-state">
                <div class="narrative-empty-icon">📜</div>
                <h3>El libro de la campaña está vacío</h3>
                <p>Registra la historia de tus aventuras, sesión a sesión.<br>
                Cada capítulo quedará guardado para siempre.</p>
                <button class="btn-combat-primary" onclick="narrativeNewSession()">
                    ✦ Escribir el primer capítulo
                </button>
            </div>
        `;
    }

    function buildTagChipsHtml(tags) {
        if (!tags || tags.length === 0) return '';
        const chips = tags.map(key => {
            const def = PREDEFINED_TAGS.find(t => t.key === key);
            if (!def) return '';
            return `<span class="narrative-tag-chip" style="--tag-color:${def.color}">${def.label}</span>`;
        }).filter(Boolean).join('');
        if (!chips) return '';
        return `<div class="narrative-tags-row">${chips}</div>`;
    }

    function buildTagPillsHtml(activeTags) {
        return PREDEFINED_TAGS.map(t => {
            const active = activeTags.includes(t.key);
            return `<button class="narrative-tag-pill${active ? ' active' : ''}"
                            style="--tag-color:${t.color}"
                            onclick="narrativeToggleTag('${t.key}')">${t.label}</button>`;
        }).join('');
    }

    function renderSessionList() {
        const container = document.getElementById('narrativeList');
        if (!container) return;
        if (sessions.length === 0) {
            container.innerHTML = '<p class="narrative-list-empty">Sin capítulos todavía.</p>';
            return;
        }
        container.innerHTML = sessions.map(s => `
            <div class="narrative-list-item${s.id === currentId ? ' active' : ''}"
                 onclick="narrativeOpenSession('${s.id}')">
                <span class="narrative-list-num">${toRoman(s.number)}</span>
                <div class="narrative-list-info">
                    <div class="narrative-list-title">${escHtml(s.title || 'Sin título')}</div>
                    ${s.sessionDate ? `<div class="narrative-list-date">${fmtSessionDate(s.sessionDate)}</div>` : ''}
                    ${s.tags && s.tags.length > 0
                        ? `<div class="narrative-list-tags">${s.tags.slice(0, 2).map(k => {
                              const def = PREDEFINED_TAGS.find(t => t.key === k);
                              return def ? `<span style="color:${def.color};font-size:11px;">${def.label.split(' ')[0]}</span>` : '';
                          }).join(' ')}</div>`
                        : ''}
                </div>
            </div>
        `).join('');
    }

    function renderSessionView(session) {
        const main = document.getElementById('narrativeMain');
        if (!main) return;

        const contentHtml = session.content
            ? `<div class="narrative-view-content">${renderContent(session.content)}</div>`
            : `<p class="narrative-view-no-content">Sin crónica todavía. Pulsa <em>Editar</em> para escribir.</p>`;

        main.innerHTML = `
            <div class="narrative-view">
                <div class="narrative-chapter-header">
                    <div class="chapter-ornament"></div>
                    <span class="chapter-label">CAPÍTULO&nbsp;${toRoman(session.number)}</span>
                    <div class="chapter-ornament"></div>
                </div>

                <h1 class="narrative-view-title">${escHtml(session.title || 'Sin título')}</h1>

                ${session.sessionDate
                    ? `<div class="narrative-view-date">📅 ${fmtSessionDate(session.sessionDate)}</div>`
                    : ''}

                ${session.summary
                    ? `<blockquote class="narrative-view-summary">${escHtml(session.summary)}</blockquote>`
                    : ''}

                <div class="narrative-view-divider"></div>

                ${contentHtml}

                ${buildTagChipsHtml(session.tags)}

                <div class="narrative-view-footer">
                    <button class="btn-secondary narrative-edit-btn" onclick="narrativeToggleEdit()">✏️ Editar crónica</button>
                    <button class="btn-danger narrative-delete-btn" onclick="narrativeDeleteSession()">🗑</button>
                </div>
            </div>
        `;
    }

    function renderSessionEditor(session) {
        const main = document.getElementById('narrativeMain');
        if (!main) return;

        main.innerHTML = `
            <div class="narrative-editor">
                <div class="narrative-chapter-header" style="margin-bottom:20px;">
                    <div class="chapter-ornament"></div>
                    <span class="chapter-label">EDITANDO CAPÍTULO ${toRoman(session.number)}</span>
                    <div class="chapter-ornament"></div>
                </div>

                <div class="narrative-editor-top-row">
                    <div class="narrative-editor-field" style="flex:0 0 88px;">
                        <label class="narrative-label" for="narrativeNumberInput">Sesión nº</label>
                        <input id="narrativeNumberInput" class="narrative-input narrative-input-num"
                               type="number" min="1" value="${session.number}"
                               oninput="narrativeAutoSave()">
                    </div>
                    <div class="narrative-editor-field" style="flex:1;">
                        <label class="narrative-label" for="narrativeTitleInput">Título</label>
                        <input id="narrativeTitleInput" class="narrative-input"
                               type="text" placeholder="Nombre del capítulo…"
                               value="${escHtml(session.title)}"
                               oninput="narrativeAutoSave()">
                    </div>
                    <div class="narrative-editor-field" style="flex:0 0 170px;">
                        <label class="narrative-label" for="narrativeDateInput">Fecha real de sesión</label>
                        <input id="narrativeDateInput" class="narrative-input"
                               type="date" value="${session.sessionDate || ''}"
                               onchange="narrativeAutoSave()">
                    </div>
                </div>

                <div class="narrative-editor-field">
                    <label class="narrative-label" for="narrativeSummaryInput">
                        Resumen <span class="narrative-label-hint">— aparece en cursiva al inicio del capítulo</span>
                    </label>
                    <input id="narrativeSummaryInput" class="narrative-input"
                           type="text"
                           placeholder="Una frase que capture la esencia de la sesión…"
                           value="${escHtml(session.summary)}"
                           oninput="narrativeAutoSave()">
                </div>

                <div class="narrative-editor-field narrative-content-field">
                    <label class="narrative-label" for="narrativeContentInput">Crónica</label>
                    <div class="narrative-editor-toolbar">
                        <button type="button" class="narrative-toolbar-btn"
                                onclick="narrativeOpenImagePicker()" title="Insertar imagen de la galería">🖼️ Imagen</button>
                        <button type="button" class="narrative-toolbar-btn"
                                onclick="narrativeOpenLinkPicker()" title="Vincular a otro capítulo">🔗 Vincular</button>
                    </div>
                    <textarea id="narrativeContentInput" class="narrative-textarea"
                              placeholder="Escribe aquí la narración completa de la sesión…"
                              oninput="narrativeAutoSave()">${escHtml(session.content)}</textarea>
                </div>

                <div class="narrative-editor-field">
                    <label class="narrative-label">Etiquetas</label>
                    <div class="narrative-tag-pills" id="narrativeTagPills">
                        ${buildTagPillsHtml(session.tags)}
                    </div>
                </div>

                <div class="narrative-editor-actions">
                    <button class="btn-combat-primary" onclick="narrativeSaveAndView()">✓ Guardar capítulo</button>
                    <button class="btn-secondary" onclick="narrativeToggleEdit()">✕ Cancelar</button>
                    <button class="btn-danger narrative-delete-btn" onclick="narrativeDeleteSession()">🗑 Borrar</button>
                </div>
            </div>
        `;
    }


    // ── Rich content rendering (images + links) ────────────────
    function renderContent(text) {
        if (!text) return '';
        const TOKEN_RE = /(\[\[(?:img|link):[^\]]*\]\])/g;
        const parts = text.split(TOKEN_RE);
        return parts.map(part => {
            const imgMatch = part.match(/^\[\[img:([^\]]*?)(?::([^\]]*))?\]\]$/);
            if (imgMatch) {
                const url     = (imgMatch[1] || '').replace(/"/g, '%22');
                const caption = imgMatch[2] || '';
                return `<figure class="narrative-img-embed">` +
                    `<img src="${url}" alt="${escHtml(caption)}" loading="lazy"` +
                    ` onclick="narrativeOpenImgLightbox(this.src)">` +
                    (caption ? `<figcaption>${escHtml(caption)}</figcaption>` : '') +
                    `</figure>`;
            }
            const linkMatch = part.match(/^\[\[link:([^\]]*?)(?::([^\]]*))?\]\]$/);
            if (linkMatch) {
                const id    = linkMatch[1] || '';
                const title = linkMatch[2] || 'Ver capítulo';
                return `<span class="narrative-inline-link"` +
                    ` onclick="narrativeOpenSession('${escHtml(id)}')"` +
                    ` title="Ir a este capítulo">📖 ${escHtml(title)}</span>`;
            }
            return escHtml(part).replace(/\n/g, '<br>');
        }).join('');
    }

    window.narrativeOpenImgLightbox = function (src) {
        const overlay = document.createElement('div');
        overlay.className = 'narrative-lightbox-overlay';
        overlay.onclick = () => overlay.remove();
        const safeSrc = (src || '').replace(/"/g, '%22');
        overlay.innerHTML = `<img src="${safeSrc}" class="narrative-lightbox-img" onclick="event.stopPropagation()">`;
        document.body.appendChild(overlay);
    };

    // ── Timeline ───────────────────────────────────────────────
    window.narrativeToggleTimeline = function () {
        timelineVisible = !timelineVisible;
        const bar = document.getElementById('narrativeTimelineBar');
        const btn = document.getElementById('narrativeTimelineToggleBtn');
        if (!bar) return;
        if (timelineVisible) {
            renderTimeline();
            bar.style.display = 'block';
            if (btn) btn.classList.add('active');
        } else {
            bar.style.display = 'none';
            if (btn) btn.classList.remove('active');
        }
    };

    function renderTimeline() {
        const bar = document.getElementById('narrativeTimelineBar');
        if (!bar) return;
        if (sessions.length === 0) {
            bar.innerHTML = '<div class="timeline-empty">Sin capítulos todavía.</div>';
            return;
        }
        const nodesHtml = sessions.map((s, idx) => {
            const tagDots = (s.tags || []).slice(0, 3).map(key => {
                const def = PREDEFINED_TAGS.find(t => t.key === key);
                return def
                    ? `<span class="timeline-tag-dot" style="background:${def.color}" title="${def.label}"></span>`
                    : '';
            }).join('');
            const isActive = s.id === currentId;
            const connector = idx < sessions.length - 1
                ? '<div class="timeline-connector"></div>'
                : '';
            return `
                <div class="timeline-node${isActive ? ' active' : ''}" onclick="narrativeOpenSession('${s.id}')">
                    <div class="timeline-dot-wrapper"><div class="timeline-dot"></div></div>
                    <div class="timeline-node-label">
                        <span class="timeline-node-num">${toRoman(s.number)}</span>
                        <span class="timeline-node-title">${escHtml(s.title || 'Sin título')}</span>
                        ${s.sessionDate ? `<span class="timeline-node-date">${fmtSessionDate(s.sessionDate)}</span>` : ''}
                        ${tagDots ? `<div class="timeline-tag-dots">${tagDots}</div>` : ''}
                    </div>
                </div>${connector}`;
        }).join('');

        bar.innerHTML = `<div class="timeline-scroll-wrapper"><div class="timeline-track">${nodesHtml}</div></div>`;

        setTimeout(() => {
            const activeNode = bar.querySelector('.timeline-node.active');
            if (activeNode) activeNode.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 80);
    }

    // ── Image picker ───────────────────────────────────────────
    window.narrativeOpenImagePicker = function () {
        const modal = document.getElementById('narrativeImagePickerModal');
        const body  = document.getElementById('narrativeImagePickerBody');
        if (!modal || !body) return;
        body.innerHTML = '<p class="picker-loading">Cargando imágenes…</p>';
        modal.style.display = 'flex';
        fetch(API_BASE + '/api/narrative-images')
            .then(r => r.json())
            .then(images => {
                if (!Array.isArray(images) || images.length === 0) {
                    body.innerHTML = '<p class="picker-empty">Sin imágenes en la galería.<br>Añade imágenes desde la sección de Imágenes.</p>';
                    return;
                }
                body.innerHTML = `<div class="picker-image-grid">${images.map(img => {
                    const safeUrl  = (img.url  || '').replace(/"/g, '%22');
                    const safeName = escHtml(img.name || '');
                    return `<div class="picker-image-item" onclick="narrativePickImage('${safeUrl}','${safeName}')">
                        <img src="${safeUrl}" alt="${safeName}" loading="lazy">
                        <span>${safeName}</span>
                    </div>`;
                }).join('')}</div>`;
            })
            .catch(() => {
                body.innerHTML = '<p class="picker-error">Error al cargar imágenes.</p>';
            });
    };

    window.narrativeCloseImagePicker = function () {
        const modal = document.getElementById('narrativeImagePickerModal');
        if (modal) modal.style.display = 'none';
    };

    window.narrativePickImage = function (url, name) {
        const textarea = document.getElementById('narrativeContentInput');
        if (!textarea) return;
        insertAtCursor(textarea, `[[img:${url}:${name}]]`);
        narrativeAutoSave();
        narrativeCloseImagePicker();
    };

    // ── Link picker ────────────────────────────────────────────
    window.narrativeOpenLinkPicker = function () {
        const modal = document.getElementById('narrativeLinkPickerModal');
        const body  = document.getElementById('narrativeLinkPickerBody');
        if (!modal || !body) return;
        const others = sessions.filter(s => s.id !== currentId);
        if (others.length === 0) {
            body.innerHTML = '<p class="picker-empty">No hay otros capítulos para vincular.</p>';
        } else {
            body.innerHTML = `<ul class="picker-session-list">${others.map(s => {
                const safeId    = escHtml(s.id);
                const safeTitle = escHtml(s.title || 'Sin título');
                return `<li class="picker-session-item" onclick="narrativePickLink('${safeId}','${safeTitle}')">
                    <span class="picker-session-num">${toRoman(s.number)}</span>
                    <div class="picker-session-info">
                        <span class="picker-session-title">${safeTitle}</span>
                        ${s.sessionDate ? `<span class="picker-session-date">${fmtSessionDate(s.sessionDate)}</span>` : ''}
                    </div>
                </li>`;
            }).join('')}</ul>`;
        }
        modal.style.display = 'flex';
    };

    window.narrativeCloseLinkPicker = function () {
        const modal = document.getElementById('narrativeLinkPickerModal');
        if (modal) modal.style.display = 'none';
    };

    window.narrativePickLink = function (id, title) {
        const textarea = document.getElementById('narrativeContentInput');
        if (!textarea) return;
        insertAtCursor(textarea, `[[link:${id}:${title}]]`);
        narrativeAutoSave();
        narrativeCloseLinkPicker();
    };

    // ── Cursor insertion helper ────────────────────────────────
    function insertAtCursor(textarea, text) {
        const start  = textarea.selectionStart;
        const end    = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after  = textarea.value.substring(end);
        textarea.value = before + text + after;
        const newPos = start + text.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd   = newPos;
        textarea.focus();
    }

}());
