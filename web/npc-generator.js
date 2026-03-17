// ============================================================
// npc-generator.js — Generador de PNJ
// ============================================================
// localStorage key: 'dnd_saved_npcs'
// Saved NPC shape: { id, nombre, raza, rol, personalidad, aspecto, motivacion }

(function () {
    'use strict';

    const STORAGE_KEY = 'dnd_saved_npcs';

    // ── Data tables ───────────────────────────────────────────
    const DATOS = {
        nombre: [
            'Aldric', 'Seraphina', 'Torvan', 'Mireille', 'Grogg', 'Lirien', 'Daxton', 'Ysolde',
            'Korrigan', 'Thessaly', 'Brom', 'Evelyne', 'Nareth', 'Saoirse', 'Alduin', 'Vespera',
            'Calder', 'Isolde', 'Zephyr', 'Thaegan', 'Rhedyn', 'Morwenna', 'Osric', 'Celestyne',
            'Draven', 'Aurelia', 'Finnick', 'Rowan', 'Zara', 'Edric', 'Lysa', 'Carver',
            'Petra', 'Wulfric', 'Nia', 'Beorn', 'Sylvara', 'Gond', 'Melisande', 'Theron'
        ],
        raza: [
            'Humano', 'Elfo', 'Semielfo', 'Enano', 'Gnomo', 'Mediano', 'Tiefling',
            'Draconiano', 'Aasimar', 'Orco', 'Semiorco', 'Kenku', 'Tabaxi', 'Genasi de Fuego',
            'Genasi de Tierra', 'Genasi de Agua', 'Firbolg', 'Goliath', 'Warforged', 'Changeling'
        ],
        rol: [
            'Herrero', 'Tabernero', 'Guardia de la ciudad', 'Mercader de especias', 'Cazarecompensas',
            'Clérigo del templo local', 'Noble venido a menos', 'Ladrón reformado', 'Archivero real',
            'Marinero retirado', 'Curandera de aldea', 'Espía de la corona', 'Gladiador retirado',
            'Astrólogo errante', 'Maestro de gremio', 'Contrabandista', 'Oráculo ciego',
            'Ingeniero de siege', 'Embajador de tierras lejanas', 'Monje itinerante',
            'Bardo de taberna', 'Alquimista excéntrico', 'Carcelero', 'Juez corrupto',
            'Explorador del bosque', 'Druida ermitaño', 'Necromante arrepentido', 'Comandante en exilio'
        ],
        personalidad: [
            'Desconfiado de los forasteros, pero leal hasta la muerte con sus amigos',
            'Habla en metáforas náuticas aunque nunca ha visto el mar',
            'Ríe ante el peligro y llora con las pequeñas alegrías',
            'Obsesionado con el orden; repliega todo dos veces',
            'Filosófico y lento de movimientos, pero de reflejos mentales afilados',
            'Guarda rencores durante décadas, pero los perdona de golpe',
            'Optimista irremediable incluso en las peores circunstancias',
            'Habla poco, observa mucho y siempre recuerda nombres',
            'Colecciona secretos ajenos sin usarlos jamás',
            'Extremadamente generoso con extraños y tacaño con los conocidos',
            'Sarcástico en la superficie, genuinamente empático en el fondo',
            'Fanático de las normas hasta que le conviene ignorarlas',
            'Supersticioso: lleva tres amuletos y evita los martes',
            'Curioso hasta el peligro; siempre abre la puerta prohibida',
            'Demasiado honesto; dice verdades incómodas en el peor momento',
            'Nostálgico crónico; compara todo con "los viejos tiempos"',
            'Amante del riesgo; apuesta incluso cuando no tiene nada que ganar',
            'Meticuloso narrador; cualquier anécdota dura el doble de lo necesario'
        ],
        aspecto: [
            'Cicatriz diagonal desde la ceja hasta la mandíbula',
            'Ojos de distinto color: uno verde, uno ámbar',
            'Cabello plateado pese a su corta edad',
            'Manos permanentemente manchadas de hollín',
            'Camina con un ligero cojeo del pie derecho',
            'Lleva siempre un sombrero de ala ancha raído',
            'Tatuajes tribales que le cubren el cuello y las manos',
            'Extremadamente alto; roza los marcos de las puertas',
            'Ropa inmaculada sin importar dónde haya estado',
            'Voz inusualmente grave para su constitución',
            'Sonrisa permanente que no alcanza los ojos',
            'Dedos excesivamente largos, como arañas pálidas',
            'Huele siempre a lavanda y pólvora',
            'Dientes de oro que destella cuando habla',
            'Piel con un leve tono azulado en sombra',
            'Cabeza rapada con una compleja cicatriz en forma de runas',
            'Siempre acompañado de un cuervo silencioso sobre el hombro',
            'Se mueve tan silenciosamente que parece flotar'
        ],
        motivacion: [
            'Busca redención por un crimen del pasado que jamás menciona',
            'Quiere reunir suficiente oro para comprar la libertad de su hermano',
            'Persigue el conocimiento de un artefacto que destruyó su aldea natal',
            'Pretende vengar la muerte de su mentor caído hace diez años',
            'Intenta mantener oculta su identidad de noble desterrado',
            'Desea demostrar que su linaje maldito no define su destino',
            'Busca la cura para una enfermedad que consume lentamente a su hija',
            'Sigue órdenes de una organización secreta que teme más que respeta',
            'Quiere escribir la historia definitiva de una guerra olvidada',
            'Aspira a fundar una ciudad donde forasteros y locales coexistan',
            'Persigue a un asesino que cambió de cara y de nombre',
            'Trata de deshacer un pacto con una entidad planar antes de que expire',
            'Busca reconciliarse con un dios que le retiró sus poderes',
            'Intenta recuperar un grimorio robado antes de que sea usado',
            'Simplemente quiere sobrevivir otro día más y quizás comer caliente'
        ]
    };

    // State
    let currentNpc = {};
    let savedNpcs = [];

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function loadSaved() {
        try {
            savedNpcs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            savedNpcs = [];
        }
    }

    function saveSaved() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedNpcs));
    }

    // ── Public entry point ────────────────────────────────────
    window.openNpcGenerator = function () {
        loadSaved();
        setView('npcGenerator');
        // If no NPC generated yet, generate one immediately
        if (!currentNpc.nombre) npcGenerate();
        renderSaved();
    };

    // ── Generate full NPC ─────────────────────────────────────
    window.npcGenerate = function () {
        currentNpc = {
            id: uid(),
            nombre: pick(DATOS.nombre),
            raza: pick(DATOS.raza),
            rol: pick(DATOS.rol),
            personalidad: pick(DATOS.personalidad),
            aspecto: pick(DATOS.aspecto),
            motivacion: pick(DATOS.motivacion)
        };
        renderNpc();
    };

    // ── Reroll individual field ───────────────────────────────
    window.npcReroll = function (field) {
        if (!DATOS[field]) return;
        currentNpc[field] = pick(DATOS[field]);
        const el = document.getElementById('npcField' + field.charAt(0).toUpperCase() + field.slice(1));
        if (el) {
            el.textContent = currentNpc[field];
            el.classList.remove('npc-reroll-flash');
            // Force reflow for re-animation
            void el.offsetWidth;
            el.classList.add('npc-reroll-flash');
        }
    };

    // ── Render current NPC fields ─────────────────────────────
    function renderNpc() {
        const fields = ['nombre', 'raza', 'rol', 'personalidad', 'aspecto', 'motivacion'];
        fields.forEach(f => {
            const el = document.getElementById('npcField' + f.charAt(0).toUpperCase() + f.slice(1));
            if (el) el.textContent = currentNpc[f] || '—';
        });
    }

    // ── Save current NPC ──────────────────────────────────────
    window.npcSaveCurrent = function () {
        if (!currentNpc.nombre) { showNotification('Genera un PNJ primero', 2000); return; }
        loadSaved();
        // Avoid duplicate ids
        currentNpc.id = uid();
        savedNpcs.unshift({ ...currentNpc });
        saveSaved();
        renderSaved();
        showNotification('⭐ PNJ guardado', 1500);
    };

    // ── Delete saved NPC ──────────────────────────────────────
    window.npcDeleteSaved = function (id) {
        loadSaved();
        savedNpcs = savedNpcs.filter(n => n.id !== id);
        saveSaved();
        renderSaved();
    };

    // ── Load saved NPC into current ───────────────────────────
    window.npcLoadSaved = function (id) {
        loadSaved();
        const found = savedNpcs.find(n => n.id === id);
        if (!found) return;
        currentNpc = { ...found };
        renderNpc();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ── Render saved NPCs list ────────────────────────────────
    function renderSaved() {
        const container = document.getElementById('npcSavedList');
        if (!container) return;
        if (savedNpcs.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:16px 0;">Ningún PNJ guardado todavía.</p>';
            return;
        }
        container.innerHTML = savedNpcs.map(n => `
            <div class="npc-saved-item">
                <div class="npc-saved-info">
                    <div class="npc-saved-name">${n.nombre}</div>
                    <div class="npc-saved-meta">${n.raza} · ${n.rol}<br>${n.personalidad}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
                    <button class="btn-combat-secondary" style="padding:5px 12px;font-size:12px" onclick="npcLoadSaved('${n.id}')">Cargar</button>
                    <button class="btn-danger" style="padding:5px 12px;font-size:12px" onclick="npcDeleteSaved('${n.id}')">🗑</button>
                </div>
            </div>
        `).join('');
    }

}());

// CSS flash animation added inline to avoid separate file
(function () {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes npcFlash {
            from { background: rgba(201,162,39,0.18); }
            to   { background: transparent; }
        }
        .npc-reroll-flash {
            animation: npcFlash 0.4s ease-out;
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);
}());
