// ============================================
// Utility helpers — depends on globals.js
// ============================================

function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    }
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
