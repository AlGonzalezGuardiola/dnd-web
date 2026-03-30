// ============================================================
// session-notes.js — Panel de Notas de Sesión
// ============================================================
// Persisted in MongoDB via /api/session-notes
// Local shape: { id, title, tag, content, createdAt, updatedAt }

(function () {
    'use strict';

    const STORAGE_KEY = 'dnd_session_notes'; // fallback cache

    let notes = [];
    let currentNoteId = null;
    let activeTagFilter = '';
    let autoSaveTimer = null;

    // ── API helpers ───────────────────────────────────────────
    function apiBase() { return API_BASE + '/api/session-notes'; }

    async function apiLoad() {
        try {
            const res = await fetch(apiBase());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const remoteNotes = (data.notes || []).map(n => ({
                id: n.clientId,
                title: n.title,
                tag: n.tag,
                content: n.content,
                createdAt: n.createdAt,
                updatedAt: n.updatedAt,
            }));

            // One-time migration: if MongoDB has no notes but localStorage does, push them up
            if (remoteNotes.length === 0) {
                let localNotes = [];
                try { localNotes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) {}
                if (localNotes.length > 0) {
                    await Promise.all(localNotes.map(n => apiSave(n)));
                    notes = localNotes;
                    return;
                }
            }

            notes = remoteNotes;
            // Sync to localStorage as cache
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch (_) {}
        } catch (e) {
            console.warn('[session-notes] load failed:', e.message);
            // Fallback to localStorage cache
            try { notes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { notes = []; }
        }
    }

    async function apiSave(note) {
        try {
            const res = await fetch(apiBase(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: note.id,
                    title: note.title,
                    tag: note.tag,
                    content: note.content,
                    createdAt: note.createdAt,
                    updatedAt: note.updatedAt,
                }),
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
        } catch (e) {
            console.warn('[session-notes] save failed:', e.message);
            showNotification('⚠️ Nota guardada solo localmente — sin conexión con el servidor', 3000);
        }
        // Always update localStorage cache
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch (_) {}
    }

    async function apiDelete(id) {
        try {
            const res = await fetch(apiBase() + '/' + id, { method: 'DELETE' });
            if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
        } catch (e) {
            console.warn('[session-notes] delete failed:', e.message);
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch (_) {}
    }

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function fmtDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // ── Public entry point ────────────────────────────────────
    window.openSessionNotes = function () {
        setView('sessionNotes');
        currentNoteId = null;
        activeTagFilter = '';
        notesRenderTagFilters();
        notesRenderList();
        showEmptyEditor();
        // Load from API and refresh
        apiLoad().then(() => {
            notesRenderTagFilters();
            notesRenderList();
        });
    };

    // ── New note ──────────────────────────────────────────────
    window.notesNewNote = function () {
        const note = {
            id: uid(),
            title: '',
            tag: '',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        notes.unshift(note);
        apiSave(note);
        currentNoteId = note.id;
        notesRenderTagFilters();
        notesRenderList();
        openEditor(note);
        setTimeout(() => {
            const titleEl = document.getElementById('noteTitleInput');
            if (titleEl) titleEl.focus();
        }, 50);
    };

    // ── Open existing note ────────────────────────────────────
    window.notesOpenNote = function (id) {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        currentNoteId = id;
        notesRenderList();
        openEditor(note);
    };

    function openEditor(note) {
        document.getElementById('notesEmptyState').style.display = 'none';
        const form = document.getElementById('notesEditorForm');
        form.style.display = 'flex';
        document.getElementById('noteTitleInput').value = note.title || '';
        document.getElementById('noteTagInput').value = note.tag || '';
        document.getElementById('noteContentInput').value = note.content || '';
        document.getElementById('noteDateDisplay').textContent = note.updatedAt
            ? `Actualizado: ${fmtDate(note.updatedAt)}`
            : '';
    }

    function showEmptyEditor() {
        document.getElementById('notesEmptyState').style.display = 'flex';
        const form = document.getElementById('notesEditorForm');
        form.style.display = 'none';
    }

    // ── Auto-save ─────────────────────────────────────────────
    window.notesAutoSave = function () {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(notesSave, 800);
    };

    // ── Save note ─────────────────────────────────────────────
    window.notesSave = function () {
        if (!currentNoteId) return;
        const note = notes.find(n => n.id === currentNoteId);
        if (!note) return;
        note.title = document.getElementById('noteTitleInput').value.trim() || 'Sin título';
        note.tag = document.getElementById('noteTagInput').value.trim();
        note.content = document.getElementById('noteContentInput').value;
        note.updatedAt = new Date().toISOString();
        notes = [note, ...notes.filter(n => n.id !== note.id)];
        apiSave(note);
        document.getElementById('noteDateDisplay').textContent = `Actualizado: ${fmtDate(note.updatedAt)}`;
        notesRenderTagFilters();
        notesRenderList();
    };

    // ── Delete current note ───────────────────────────────────
    window.notesDeleteCurrent = function () {
        if (!currentNoteId) return;
        const id = currentNoteId;
        notes = notes.filter(n => n.id !== id);
        apiDelete(id);
        currentNoteId = null;
        notesRenderTagFilters();
        notesRenderList();
        showEmptyEditor();
        showNotification('Nota eliminada', 1500);
    };

    // ── Search ────────────────────────────────────────────────
    function getFilteredNotes() {
        const query = (document.getElementById('notesSearch')?.value || '').toLowerCase().trim();
        return notes.filter(n => {
            const matchesTag = !activeTagFilter || n.tag === activeTagFilter;
            if (!matchesTag) return false;
            if (!query) return true;
            return (n.title || '').toLowerCase().includes(query)
                || (n.content || '').toLowerCase().includes(query)
                || (n.tag || '').toLowerCase().includes(query);
        });
    }

    // ── Tag filter ────────────────────────────────────────────
    window.notesSetTagFilter = function (btn, tag) {
        activeTagFilter = tag;
        [...document.querySelectorAll('.note-tag-filter')].forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        notesRenderList();
    };

    function notesRenderTagFilters() {
        const container = document.getElementById('notesTagFilters');
        if (!container) return;
        const tags = [...new Set(notes.map(n => n.tag).filter(Boolean))].sort();
        const allBtn = container.querySelector('[data-tag=""]') || (() => {
            const b = document.createElement('button');
            b.className = 'note-tag-filter active';
            b.dataset.tag = '';
            b.onclick = function () { notesSetTagFilter(this, ''); };
            b.textContent = 'Todas';
            container.appendChild(b);
            return b;
        })();
        [...container.querySelectorAll('.note-tag-filter:not([data-tag=""])')].forEach(b => b.remove());
        tags.forEach(tag => {
            const b = document.createElement('button');
            b.className = 'note-tag-filter' + (activeTagFilter === tag ? ' active' : '');
            b.dataset.tag = tag;
            b.textContent = tag;
            b.onclick = function () { notesSetTagFilter(this, tag); };
            container.appendChild(b);
        });
        if (!activeTagFilter) allBtn.classList.add('active');
        else allBtn.classList.remove('active');
    }

    // ── Render list ───────────────────────────────────────────
    window.notesRenderList = function () {
        const container = document.getElementById('notesList');
        if (!container) return;
        const filtered = getFilteredNotes();
        if (filtered.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0;">Sin notas que mostrar.</p>';
            return;
        }
        container.innerHTML = filtered.map(n => `
            <div class="note-list-item${n.id === currentNoteId ? ' active' : ''}" onclick="notesOpenNote('${n.id}')">
                <div class="note-list-title">${n.title || 'Sin título'}</div>
                <div class="note-list-meta">
                    ${n.tag ? `<span class="note-list-tag">${n.tag}</span>` : ''}
                    <span>${fmtDate(n.updatedAt)}</span>
                </div>
            </div>
        `).join('');
    };

}());
