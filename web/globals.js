// ============================================
// Global State — loaded first, used by all modules
// ============================================

const state = {
    data: null,
    currentMap: null,
    history: [],
    zoom: 1,
    pan: { x: 0, y: 0 },
    isEditing: false,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    tempPin: null,
    editingPinIndex: null,
    currentView: 'landing'
};

// HP / Character state
const hpState = {};
const spellSlotState = {};
const inspirationState = {};
const conditionsState = {};
const deathSaveState = {};
const notesState = {};
const diceHistory = [];
const demonicFormState = {};
const turnPlannerState = {};
const modifierState = {};      // { charId: { nombre: bool } } — active modifiers
const modifierUsedState = {};  // { charId: { nombre: bool } } — 1/rest used

// API / SSE
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : window.location.origin;
const COMBAT_ID_KEY = 'dnd_combat_id';
const CLIENT_ID = Math.random().toString(36).slice(2, 10);

let activeCombatId = localStorage.getItem(COMBAT_ID_KEY) || null;
let sseSource      = null;
let _saveTimer     = null;
let isOnlineCombat = false;
let activeJoinCode = null;

// Role
const ROLE_KEY = 'dnd_game_role';
let gameRole = { type: 'master', characterId: null };

// Combat
const combatState = {
    selectedIds: [],
    participants: [],
    currentIndex: 0,
    round: 1,
    isActive: false,
    log: [],
    nextLogId: 0,
    segundaAccionTurn: false,
    extraAttackTurn: false,
    reactionsUsed: {},           // { participantId: true } — used reaction this round
    pendingReactionTrigger: null, // transient broadcast: { id, actorId, actionName, actionType }
};

let combatModeActive = false;
let setupNpcs = [];
let setupInitiatives = {};
let savedTemplates = { ALLY: [], ENEMY: [] };
let currentCharacterId = null;
let isCharacterEditing = false;

const CONDITIONS = [
    { id: 'envenenado',    label: '🤢', title: 'Envenenado' },
    { id: 'paralizado',   label: '⛓️', title: 'Paralizado' },
    { id: 'asustado',     label: '😱', title: 'Asustado' },
    { id: 'cegado',       label: '🚫', title: 'Cegado' },
    { id: 'aturdido',     label: '💫', title: 'Aturdido' },
    { id: 'concentracion',label: '🧠', title: 'Concentración' },
];

// Quick NPC
let _quickNpcTipo = 'enemigo';

// Combat persistence key
const COMBAT_SAVE_KEY = 'dnd_combat_session';

// Touch pan tracking
let lastTouchX = 0;
let lastTouchY = 0;

// Current view getter — defined here so api-sync.js can call it before view.js loads
function currentView() { return state.currentView; }
