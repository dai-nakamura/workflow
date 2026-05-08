 function getTodayString() { return toDateInput(new Date()); }
    function toDateInput(date) { const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
    function parseDate(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d); }
    function addDays(dateStr, days) { const dt = parseDate(dateStr); dt.setDate(dt.getDate() + days); return toDateInput(dt); }
    function createId(prefix = 'id') { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`; }
    function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }
    function escapeHtml(str) { return String(str ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
    function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }
    function ceil2(n) { return Math.ceil(Number(n || 0) * 100) / 100; }
