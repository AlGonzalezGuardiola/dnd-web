# Plan: Refactor Frontend — Monolito a Módulos

**Objetivo:** Partir `script.js` (5.654 líneas) en módulos cohesivos de ≤800 líneas.
**Restricciones:** Vanilla JS, sin bundler, archivos estáticos, compatibilidad total con `onclick=` en HTML.
**Patrón elegido:** Globals organizados en archivos separados (igual que ya hacen `encounters.js`, `npc-generator.js`).
**No usar ES Modules** (`type="module"`) porque los `onclick` del HTML quedarían rotos.

---

## Arquitectura objetivo

```
web/
  globals.js          # Estado global + constantes (state, combatState, hpState, API_BASE…) + currentView()
  utils.js            # Helpers (showNotification, getSliderGradient, updateTaskMd)
  storage.js          # localStorage + combat state persist (saveCombatState, loadSavedCombatIfAny…)
  api-sync.js         # Llamadas API + SSE (saveToApi, connectToSSE, applyRemoteState, lobby online)
  role.js             # Rol/jugador (gameRole, isMaster, initRole, showRoleSelectionOverlay…)
  map.js              # Mapa: render, navegación, zoom/pan, breadcrumbs
  map-editor.js       # Modo edición: pines CRUD, modales
  character-sheet.js  # HP, hechizos, condiciones, death saves, notas, renderCharacterSheet (~700 líneas)
  character-edit.js   # Edición de templates, fichas de personaje, Player DB (~400 líneas)
  combat-setup.js     # Pantalla de setup, initiative, NPCs de setup, templates DB
  combat-manager.js   # Gestión de turnos, renderActivePanel, acciones de dados, NPC rápido
  combat-log.js       # Log de combate, scoreboard, vista log, fin de combate
  view.js             # setView, init(), setupEventListeners, toggleLandingMenu, setupDiceRoller
  --- ya existentes, sin cambios ---
  characters.js       (datos)
  data.js             (datos)
  encounters.js       (feature)
  npc-generator.js    (feature)
  session-notes.js    (feature)
```

> **Nota:** Se añade `character-edit.js` porque `character-sheet.js` sola superaría las 800 líneas (la sección ocupa ~1.540 líneas en script.js).
> **Nota:** `currentView()` va en `globals.js` (no en `view.js`) porque `applyRemoteState` en `api-sync.js` la necesita.

**Orden de carga en index.html:**
```html
characters.js → data.js → globals.js → utils.js → storage.js →
api-sync.js → role.js → map.js → map-editor.js → character-sheet.js →
character-edit.js → combat-setup.js → combat-manager.js → combat-log.js → view.js →
encounters.js → npc-generator.js → session-notes.js
```

---

## Líneas estimadas por módulo

| Archivo | Líneas est. | Funciones clave |
|---|---|---|
| globals.js | ~70 | state, combatState, hpState, spellSlotState, demonicFormState, turnPlannerState, API_BASE, constantes, `currentView()` |
| utils.js | ~40 | showNotification, getSliderGradient, updateTaskMd |
| storage.js | ~130 | saveStateToStorage, loadStateFromStorage, initHpForChar/DeathSaves/SpellSlots, saveCombatState, clearSavedCombat, loadSavedCombatIfAny, showCombatResumePrompt, resumeSavedCombat, discardSavedCombat |
| api-sync.js | ~310 | saveToApi/Now, _buildSaveBody, _hydrateParticipants, applyRemoteState, connectToSSE, showOnlineLobby, startOnlineCombatSetup, waitingRoom |
| role.js | ~110 | gameRole, isMaster, initRole, showRoleSelectionOverlay, showPlayerPicker, selectRole, updateRoleIndicator |
| map.js | ~360 | renderMap, renderPins, createPinElement, navigateToMap, navigateBack, updateBreadcrumbs, zoom/pan, touch handlers |
| map-editor.js | ~260 | toggleEditMode, handleRightClick, showAddPinModal, savePin, showAddMapModal, saveNewMap, deletePin, editPin, exportData |
| character-sheet.js | ~700 | HP, spells (toggleSpellSlot, resetSpellSlots), conditions, death saves, notes, renderCharacterSheet, setupCharacterSheetListeners, renderDemonicSection, toggleDemonicForm, demonic actions |
| character-edit.js | ~400 | openPersonajesSection, switchPersonajesTab, renderPersonajesTemplatesList, editCharTemplate, createCharTemplate, saveEditedTemplate, deletePersonajesTemplate, initPlayerCharactersFromDB, loadPersonajesTemplates, exportCharacters, renderCharacterSelectionMenu |
| combat-setup.js | ~550 | showCombatSetup, showPlayerCombat, renderCombatSetup, toggleCombatParticipant, renderSpecialSummonsSection, addSpecialSummonToSetup, renderCombatInitiative, goToCombatInitiative, beginCombat, beginCombatFromSetup, _insertPreCombatSummons, addSetupNpc, renderSetupNpcList, removeSetupNpc, renderSavedTemplatesSection, addTemplateToSetup, loadSavedTemplates, deleteEntityTemplate |
| combat-manager.js | ~730 | showCombatMode, renderCombatManager, _renderPlayerCombatLayout, renderTurnQueue, rollDiceString, rollActionDice, generateNarratorText, renderActivePanel, setParticipantHp, toggleParticipantCondition, nextCombatTurn, previousCombatTurn, toggleDemonicFormInCombat, buildSirvienteCharData, toggleSirvienteInvisible, showInvocationDetail, addInvocationToCombat, showQuickNpcModal/showQuickEnemyModal/showQuickAllyModal, submitQuickNpc, _saveEntityTemplate, toggleCombatAction, applyGroupDamage, applyAttackDamage, selectPlannerAction, addCustomCombatAction |
| combat-log.js | ~320 | createCurrentTurnEntry, getCurrentLogEntry, getLogEntry, toggleLogAction, renderCombatLog, openCombatLogView, renderCombatLogView, computeKillScoreboard, renderKillScoreboard, confirmEndCombat, _doClearCombat, buildHistoryText, copyHistoryToClipboard, showCombatSummary |
| view.js | ~240 | setView, init, setupEventListeners, setupModalListeners, showWelcomeScreen, setupDiceRoller (rollDie, updateDiceHistory), setupCombatOptionsMenu, toggleLandingMenu, closeLandingMenu, toggleMobileLog + llamada a `init()` al final |

**Total estimado: ~4.220 líneas** en 13 archivos (vs 5.654 en uno — diferencia = comentarios de sección y líneas vacías eliminados)

---

## Pasos de implementación

### Paso 1 — Extraer globals.js + utils.js
**Branch:** `refactor/step-1-globals`
**Archivos:** crear `globals.js`, `utils.js`; modificar `script.js` y `index.html`

**Contexto:**
La parte más segura del refactor. Mueve las declaraciones de estado y constantes a un archivo separado. El resto de `script.js` las usa como antes porque siguen siendo globals. `currentView()` se incluye aquí (no en view.js) porque api-sync.js la necesita cuando recibe SSE.

**Tareas:**
- [ ] Crear `web/globals.js` con: `state`, `combatState`, `hpState`, `spellSlotState`, `inspirationState`, `conditionsState`, `deathSaveState`, `notesState`, `diceHistory`, `demonicFormState`, `turnPlannerState`, `combatModeActive`, `setupNpcs`, `setupInitiatives`, `savedTemplates`, `currentCharacterId`, `isCharacterEditing`, `CONDITIONS`, `API_BASE`, `COMBAT_ID_KEY`, `CLIENT_ID`, `activeCombatId`, `sseSource`, `_saveTimer`, `isOnlineCombat`, `ROLE_KEY`, `gameRole`, `COMBAT_SAVE_KEY`, `activeJoinCode`, `_quickNpcTipo`, `lastTouchX`, `lastTouchY` + función `currentView() { return state.currentView; }`
- [ ] Crear `web/utils.js` con: `showNotification`, `getSliderGradient`, `updateTaskMd`
- [ ] Eliminar esas declaraciones de `script.js`
- [ ] En `index.html`: añadir `globals.js` y `utils.js` antes de `script.js`

**Verificación:**
- App carga sin errores en consola
- Mapa se renderiza
- Notificaciones funcionan

**Exit criteria:** `script.js` ya no declara ninguna de las variables/constantes movidas.

---

### Paso 2 — Extraer storage.js
**Branch:** `refactor/step-2-storage`
**Archivos:** crear `storage.js`; modificar `script.js`, `index.html`

**Contexto:**
Agrupa toda la persistencia en localStorage, incluyendo el guardado automático del estado de combate. `saveCombatState()` llama a `saveToApi()` (api-sync.js) que aún no existe, pero como es una llamada runtime (no en el top-level) no hay problema de carga. Se marca como dependencia conocida.

**Tareas:**
- [ ] Crear `web/storage.js` con: `saveStateToStorage`, `loadStateFromStorage`, `initHpForChar`, `initDeathSavesForChar`, `initSpellSlotsForChar`, `saveCombatState`, `clearSavedCombat`, `loadSavedCombatIfAny`, `showCombatResumePrompt`, `resumeSavedCombat`, `discardSavedCombat`
- [ ] Eliminar esas funciones de `script.js`
- [ ] Añadir `storage.js` a `index.html` después de `utils.js`

**Verificación:**
- HP y hechizos persisten entre recargas
- `loadStateFromStorage` se llama correctamente en `init()`

---

### Paso 3 — Extraer api-sync.js
**Branch:** `refactor/step-3-api-sync`
**Archivos:** crear `api-sync.js`; modificar `script.js`, `index.html`

**Contexto:**
Todo lo relativo a sincronización online: llamadas a la API, SSE, lobby de espera, gestión de sesión online. Bloque denso (~300 líneas) pero bien delimitado.

**Tareas:**
- [ ] Crear `web/api-sync.js` con: `_buildSaveBody`, `saveToApi`, `saveToApiNow`, `_hydrateParticipants`, `applyRemoteState`, `connectToSSE`, `activeJoinCode`, `updateWaitingRoom`, `showOnlineCodeModal`, `showCurrentSessionCode`, `renderCombatShareLink`, `showOnlineLobby`, `startOnlineCombatSetup`, `showOnlineError`, `clearOnlineSession`
- [ ] Eliminar esas funciones de `script.js`
- [ ] Añadir `api-sync.js` después de `storage.js` en `index.html`

**Verificación:**
- Crear sesión online genera joinCode
- Unirse con código funciona
- SSE sincroniza cambios entre dos pestañas

---

### Paso 4 — Extraer role.js
**Branch:** `refactor/step-4-role`
**Archivos:** crear `role.js`; modificar `script.js`, `index.html`

**Contexto:**
Módulo pequeño y bien delimitado. Gestiona el rol del jugador (master vs jugador con personaje).

**Tareas:**
- [ ] Crear `web/role.js` con: `isMaster`, `initRole`, `showRoleSelectionOverlay`, `showPlayerPicker`, `selectRole`, `updateRoleIndicator`
- [ ] Eliminar de `script.js`
- [ ] Añadir `role.js` después de `api-sync.js` en `index.html`

**Verificación:**
- Overlay de selección de rol aparece correctamente
- Indicador de rol se actualiza en UI

---

### Paso 5 — Extraer map.js + map-editor.js
**Branch:** `refactor/step-5-map`
**Archivos:** crear `map.js`, `map-editor.js`; modificar `script.js`, `index.html`

**Contexto:**
El sistema de mapa tiene dos responsabilidades distintas: visualización/navegación y edición. Se separa en dos archivos para mantener ≤800 líneas cada uno.

**Tareas:**
- [ ] Crear `web/map.js` con: `renderMap`, `renderPins`, `createPinElement`, `makePinDraggable`, `navigateToMap`, `navigateBack`, `updateBreadcrumbs`, `adjustZoom`, `resetView`, `applyTransform`, `handleMapWheel`, `handleMapMouseDown`, `handleMapMouseMove`, `handleMapMouseUp`, `handleMapTouchStart`, `handleMapTouchMove`, `handleMapTouchEnd`
- [ ] Crear `web/map-editor.js` con: `toggleEditMode`, `handleRightClick`, `showAddPinModal`, `savePin`, `showAddMapModal`, `saveNewMap`, `deletePin`, `exportData`, `editPin`
- [ ] Eliminar esas funciones de `script.js`
- [ ] Añadir ambos archivos a `index.html` después de `role.js`

**Verificación:**
- Navegación entre mapas funciona
- Zoom y pan funcionan (mouse + touch)
- Modo edición: crear/editar/eliminar pines funciona

---

### Paso 6 — Extraer character-sheet.js + character-edit.js
**Branch:** `refactor/step-6-character-sheet`
**Archivos:** crear `character-sheet.js`, `character-edit.js`; modificar `script.js`, `index.html`

**Contexto:**
La sección de personajes ocupa ~1.540 líneas en script.js. Se divide en dos: la ficha en sí (HP, hechizos, condiciones, render) y la edición/gestión de templates y DB de jugadores. La separación es clara: character-sheet.js = visualización y estado in-game; character-edit.js = CRUD de templates y administración.

**Tareas character-sheet.js (~700 líneas):**
- [ ] `setHp`, `renderHpSection`, `toggleInspiration`, `toggleDeathSave`
- [ ] `toggleCondition`, `renderCharacterSheet`, `setupCharacterSheetListeners`
- [ ] `renderDemonicSection`, `toggleDemonicForm`, `advanceDemonicTurn`, `updateDemonicFormDisplay`
- [ ] `toggleSpellSlot`, `resetSpellSlots`
- [ ] `getModifier`, `skillMapping`, `extractDiceFromDesc`, `getDiceBadges`
- [ ] `renderCombatInline`, `renderCombatTab`, `inferActionType`, `selectCombatAction`, `clearPlannerSlot`
- [ ] `refreshCombatSections`, `renderTraitItem`, `renderCategorizedInventory`, `renderSpellsWithFilters`, `setupCollapsibleEvents`
- [ ] `updateFeature`, `deleteFeature`, `addFeature`, `updateSpell`, `deleteSpell`, `addSpell`
- [ ] `updateInventoryItem`, `deleteInventoryItem`, `addInventoryItem`
- [ ] `saveNote`, `toggleCharacterEditMode`, `saveCharacterChanges`
- [ ] `renderQuickActions`, `updateTabs`

**Tareas character-edit.js (~400 líneas):**
- [ ] `openPersonajesSection`, `switchPersonajesTab`, `renderPersonajesTemplatesList`
- [ ] `editCharTemplate`, `toggleCharSummonFields`, `createCharTemplate`, `saveEditedTemplate`, `deletePersonajesTemplate`
- [ ] `initPlayerCharactersFromDB`, `loadPersonajesTemplates`, `exportCharacters`
- [ ] `renderCharacterSelectionMenu`

**Tareas comunes:**
- [ ] Eliminar todas esas funciones de `script.js`
- [ ] Añadir `character-sheet.js` y `character-edit.js` (en ese orden) a `index.html` después de `map-editor.js`

**Verificación:**
- Ficha de personaje se renderiza con HP, hechizos, condiciones
- HP persiste correctamente
- Tabs de personajes funcionan (Personajes → Templates → Players DB)
- Forma demoníaca activa/desactiva correctamente

---

### Paso 7 — Extraer combat-setup.js
**Branch:** `refactor/step-7-combat-setup`
**Archivos:** crear `combat-setup.js`; modificar `script.js`, `index.html`

**Contexto:**
Todo lo que ocurre antes de que el combate empiece: pantalla de setup, iniciativas, NPCs, templates de la DB. `addSetupNpc` vive SOLO aquí (no en combat-manager). `beginCombat` también es exclusivo de este módulo.

**Tareas:**
- [ ] Crear `web/combat-setup.js` con: `showCombatSetup`, `showPlayerCombat`, `renderCombatSelectCard`, `renderCombatSetupCard`, `renderCombatSetup`, `toggleCombatParticipant`, `_buildInvocacionActions`, `renderSpecialSummonsSection`, `addSpecialSummonToSetup`, `setSetupJugadorInitiative`, `switchCombatSetupTab`, `_updateSetupCount`, `renderCombatInitiative`, `setParticipantInitiative`, `goToCombatInitiative`, `beginCombat`, `parseSetupActions`, `beginCombatFromSetup`, `_insertPreCombatSummons`, `addSetupNpc`, `renderSetupNpcList`, `removeSetupNpc`, `renderSavedTemplatesSection`, `_renderTemplateCard`, `addTemplateToSetup`, `loadSavedTemplates`, `deleteEntityTemplate`, `toggleSetupGroupFields`, `toggleSetupSummonFields`, `COMBAT_CATEGORIES`
- [ ] Eliminar de `script.js`
- [ ] Añadir `combat-setup.js` a `index.html` después de `character-edit.js`

**Verificación:**
- Setup de combate muestra personajes disponibles
- Añadir NPCs y templates funciona
- Pasar a iniciativa y comenzar combate funciona

---

### Paso 8 — Extraer combat-manager.js
**Branch:** `refactor/step-8-combat-manager`
**Archivos:** crear `combat-manager.js`; modificar `script.js`, `index.html`

**Contexto:**
El módulo más complejo: gestión de turnos, panel activo, acciones de dados, NPC rápido. Puede llegar a ~730 líneas.

**Tareas:**
- [ ] Crear `web/combat-manager.js` con: `showCombatMode`, `renderCombatManager`, `_renderPlayerCombatLayout`, `renderTurnQueue`, `rollDiceString`, `rollActionDice`, `generateNarratorText`, `showActionDetail`, `toggleSlotManual`, `addPermanentCustomAction`, `removePermanentCustomAction`, `renderActivePanel`, `setParticipantHp`, `toggleParticipantCondition`, `nextCombatTurn`, `showNextTurnWarning`, `confirmNextTurn`, `dismissNextTurnWarning`, `_doNextTurn`, `skipSegundaAccion`, `skipExtraAttack`, `previousCombatTurn`, `toggleDemonicFormInCombat`, `buildSirvienteCharData`, `toggleSirvienteInvisible`, `showInvocationDetail`, `addInvocationToCombat`, `showQuickNpcModal`, `submitQuickNpc`, `_saveEntityTemplate`, `toggleQeGroupFields`, `toggleQeSummonFields`, `addQeAction`, `getQeActions`, `toggleCombatAction`, `applyGroupDamage`, `applyAttackDamage`, `selectPlannerAction`, `removePlannerSlot`, `removeCombatAction`, `addCustomCombatAction`, `setCombatTurnNote`, `toggleMobileLog`, `addSetupNpc` (quick enemy context)
- [ ] Eliminar de `script.js`
- [ ] Añadir `combat-manager.js` a `index.html` después de `combat-setup.js`

**Verificación:**
- Combate avanza turno a turno (siguiente/anterior)
- Panel activo muestra acciones y dados
- Quick enemy/ally modal funciona
- HP de participantes se actualiza

---

### Paso 9 — Extraer combat-log.js
**Branch:** `refactor/step-9-combat-log`
**Archivos:** crear `combat-log.js`; modificar `script.js`, `index.html`

**Contexto:**
Log de combate, scoreboard y vista de historial. Módulo bien delimitado.

**Tareas:**
- [ ] Crear `web/combat-log.js` con: `createCurrentTurnEntry`, `getCurrentLogEntry`, `getLogEntry`, `toggleLogAction`, `removeLogAction`, `addLogCustomAction`, `toggleLogEdit`, `renderLogEditArea`, `renderRollText`, `renderCombatLog`, `openCombatLogView`, `closeCombatLogView`, `renderCombatLogView`, `openCombatLogModal`, `closeCombatLogModal`, `computeKillScoreboard`, `renderKillScoreboard`, `confirmEndCombat`, `_doClearCombat`, `buildHistoryText`, `copyHistoryToClipboard`, `showCombatSummary`
- [ ] Eliminar de `script.js`
- [ ] Añadir `combat-log.js` a `index.html` después de `combat-manager.js`

**Verificación:**
- Log de combate se renderiza y actualiza por turno
- Scoreboard muestra kills correctamente
- Copiar historial al portapapeles funciona
- Resumen de combate al finalizar funciona

---

### Paso 10 — Extraer view.js y eliminar script.js
**Branch:** `refactor/step-10-view-cleanup`
**Archivos:** crear `view.js`; eliminar `script.js`; actualizar `index.html`

**Contexto:**
Paso final. `script.js` debería estar casi vacío tras los pasos anteriores. Se mueve lo restante a `view.js` y se elimina `script.js`. Cuidado: la llamada `init()` al final de script.js debe preservarse al final de `view.js`.

**Tareas:**
- [ ] Crear `web/view.js` con: `setView`, `init`, `setupEventListeners`, `setupModalListeners`, `showWelcomeScreen`, `setupDiceRoller` (incluye `rollDie`, `updateDiceHistory`), `setupCombatOptionsMenu`, `_closeOptionsMenu`, `toggleLandingMenu`, `closeLandingMenu`, `toggleMobileLog`
- [ ] **IMPORTANTE:** añadir `init();` al final de `view.js` (el bootstrap call)
- [ ] Eliminar `web/script.js`
- [ ] En `index.html`: reemplazar `script.js` con `view.js` en el orden de carga
- [ ] Eliminar los 2 `console.log` DEBUG (líneas 870 y 1012 del `api-sync.js` ya extraído)
- [ ] Verificar que `script.js` está efectivamente vacío antes de borrar (buscar funciones remanentes)
- [ ] Audit final: `grep -r "function " web/*.js | wc -l` — comparar con conteo original

**Verificación:**
- App completa funciona de principio a fin
- Sin errores en consola (incluyendo eliminación de DEBUGs)
- Todos los archivos ≤ 800 líneas: `wc -l web/*.js`
- `currentView()` sigue funcionando (está en globals.js, no en view.js)

---

## Orden de carga final en index.html

```html
<script src="characters.js?v=..."></script>
<script src="data.js?v=..."></script>
<script src="globals.js?v=..."></script>
<script src="utils.js?v=..."></script>
<script src="storage.js?v=..."></script>
<script src="api-sync.js?v=..."></script>
<script src="role.js?v=..."></script>
<script src="map.js?v=..."></script>
<script src="map-editor.js?v=..."></script>
<script src="character-sheet.js?v=..."></script>
<script src="character-edit.js?v=..."></script>
<script src="combat-setup.js?v=..."></script>
<script src="combat-manager.js?v=..."></script>
<script src="combat-log.js?v=..."></script>
<script src="view.js?v=..."></script>
<script src="encounters.js?v=..."></script>
<script src="npc-generator.js?v=..."></script>
<script src="session-notes.js?v=..."></script>
```

---

## Invariantes (verificar después de CADA paso)

1. App carga sin errores en consola del navegador
2. Mapa se renderiza y la navegación funciona
3. Ficha de personaje muestra HP y persiste cambios
4. El combate puede iniciarse, avanzar turnos y finalizar
5. Las features externas (encounters, npc-generator, session-notes) no se modifican

## Notas de rollback

Cada paso es una branch independiente. Si un paso falla, basta con no mergear esa branch y revisar las dependencias. La branch anterior es siempre un estado funcional.

## Paralelismo posible

Los pasos 5 (map), 6 (character-sheet) y 4 (role) son independientes entre sí y podrían ejecutarse en paralelo una vez los pasos 1-3 están mergeados.
