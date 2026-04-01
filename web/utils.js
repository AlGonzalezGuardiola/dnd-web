// ============================================
// Utility helpers — depends on globals.js
// ============================================

let _notifTimer = null;
function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    clearTimeout(_notifTimer);
    notification.textContent = message;
    notification.classList.add('show');
    _notifTimer = setTimeout(() => notification.classList.remove('show'), duration);
}

function updateTaskMd(action) {
    console.log(`[Task Update] ${action} completed`);
}

function getSliderGradient(pct) {
    let color;
    if (pct <= 25) color = '#ff4444';
    else if (pct <= 50) color = '#ffaa00';
    else color = '#44cc66';
    return `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
}

// ---- Shared combat/sheet utilities ----

// Escapa caracteres HTML peligrosos en strings de usuario
function _escHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getModifier(value) {
    return Math.floor((value - 10) / 2);
}

function extractDiceFromDesc(desc) {
    if (!desc) return null;
    const plain = desc.replace(/<[^>]+>/g, ' '); // strip HTML tags
    const matches = plain.match(/\d+d\d+(?:[+-]\d+)?/gi);
    if (!matches || matches.length === 0) return null;
    return matches.join(' + ');
}

function getDiceBadges(action) {
    let parts = [];
    if (action.atk) parts.push(`<span class="dice-atk">ATK ${action.atk}</span>`);
    if (action.dado && action.dado !== '—') {
        parts.push(`<span class="dice-dmg">DMG ${action.dado}</span>`);
    } else if (!action.atk) {
        const extracted = extractDiceFromDesc(action.desc);
        if (extracted) parts.push(`<span class="dice-dmg">${extracted}</span>`);
    }
    return parts.join('');
}

function inferActionType(item) {
    if (item.tipo) return item.tipo;
    const nivel = String(item.nivel ?? '');
    const nombre = item.nombre || '';
    const desc = item.desc || '';
    // Reaction
    if (nivel === 'Reac' || /\(Reacci[oó]n\)/i.test(nombre) || /\(Reacci[oó]n\)/i.test(desc)) {
        return 'reaccion';
    }
    // Bonus action
    if (/\(Bonus\)/i.test(nombre) || /\bBonus\b/.test(desc)) {
        return 'adicional';
    }
    return 'accion';
}
