/* Mijn Werkregistratie - privacyvriendelijke, zelfstandige PWA. */
(() => {
  'use strict';
  const STORAGE_KEY = 'mijn-werkregistratie-v1';
  const MAX_SESSION_MS = 10 * 60 * 60 * 1000;
  const categoryMeta = {
    transfer: { label: 'Overdraagbaar', color: '#15764f' },
    partial: { label: 'Deels overdraagbaar', color: '#bf851f' },
    special: { label: 'Specialistische kennis', color: '#60748b' }
  };
  const icons = [
    { emoji: '\u{1F6E0}\uFE0F', label: 'Gereedschap' },
    { emoji: '\u{1F69A}', label: 'Transport' },
    { emoji: '\u{1F4E8}', label: 'E-mail' },
    { emoji: '\u{1F4CB}', label: 'Planning' },
    { emoji: '\u{1F3A7}', label: 'Ondersteuning' },
    { emoji: '\u{1F527}', label: 'Techniek' },
    { emoji: '\u{1F4E6}', label: 'Goederen' },
    { emoji: '\u{1F4C4}', label: 'Documentatie' },
    { emoji: '\u{1F465}', label: 'Overleg' },
    { emoji: '\u{1F4A1}', label: 'Verbeteren' },
    { emoji: '\u{1F4BB}', label: 'Computer' },
    { emoji: '\u{1F4CC}', label: 'Overig' }
  ];
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const hasCategory = (c) => Object.prototype.hasOwnProperty.call(categoryMeta, c);
  const normalizeCategory = (c) => hasCategory(c) ? c : 'partial';
  const normalizeIcon = (x) => icons.some(i => i.emoji === x) ? x : icons[11].emoji;
  const initTasks = () => [
    { id: uid(), name: 'Opbouw / demontage', icon: icons[0].emoji, category: 'transfer', archived: false },
    { id: uid(), name: 'Transport / logistiek', icon: icons[1].emoji, category: 'transfer', archived: false },
    { id: uid(), name: 'Administratie / e-mail', icon: icons[2].emoji, category: 'partial', archived: false },
    { id: uid(), name: 'Proefplaatsingen coordineren', icon: icons[3].emoji, category: 'partial', archived: false },
    { id: uid(), name: 'Technische ondersteuning', icon: icons[4].emoji, category: 'special', archived: false },
    { id: uid(), name: 'Problemen oplossen', icon: icons[5].emoji, category: 'special', archived: false }
  ];
  function initialState() { return { version: 1, tasks: initTasks(), sessions: [], active: null }; }
  function sanitizedState(raw) {
    if (!raw || !Array.isArray(raw.tasks) || !Array.isArray(raw.sessions)) throw new Error('Ongeldig bestand');
    const tasks = raw.tasks.slice(0, 10000).filter(t => t && typeof t.name === 'string' && t.name.trim())
      .map(t => ({ id: String(t.id || uid()).slice(0, 90), name: t.name.trim().slice(0, 54),
        icon: normalizeIcon(t.icon), category: normalizeCategory(t.category), archived: !!t.archived }));
    const sessions = raw.sessions.slice(0, 100000).filter(s => s && typeof s.start === 'number' && typeof s.end === 'number'
      && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.end - s.start <= MAX_SESSION_MS
      && s.start > 946684800000 && s.end < Date.now() + 86400000)
      .map(s => ({ id: String(s.id || uid()).slice(0, 90), taskId: String(s.taskId || '').slice(0, 90),
        taskName: String(s.taskName || 'Onbekende werkzaamheid').slice(0, 54), category: normalizeCategory(s.category),
        start: s.start, end: s.end }));
    let active = null;
    if (raw.active && Number.isFinite(raw.active.start) && raw.active.start <= Date.now() + 60000 && raw.active.start > 946684800000) {
      const t = tasks.find(x => x.id === raw.active.taskId && !x.archived);
      if (t) active = { taskId: t.id, taskName: t.name, category: t.category, start: raw.active.start };
    }
    return { version: 1, tasks, sessions, active };
  }
  let state;
  let storageOkay = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved ? sanitizedState(JSON.parse(saved)) : initialState();
  } catch (err) {
    state = initialState();
    storageOkay = false;
  }
  let currentScreen = 'home';
  let currentPeriod = 'week';
  let editingTaskId = null;
  let editingSessionId = null;
  let toastTimer = null;
  let deferredInstall = null;
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageOkay = true; return true; }
    catch (err) { storageOkay = false; toast('Opslaan niet gelukt. Controleer de opslagruimte van je browser.'); return false; }
  }
  if (!storageOkay) setTimeout(() => toast('Let op: lokale opslag is niet beschikbaar. Maak geen belangrijke registraties voordat dit is opgelost.'), 1500);
  function formatElapsed(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const pad = n => String(n).padStart(2, '0');
    return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
  }
  function formatMinutes(ms) {
    const minutes = Math.max(0, Math.round(ms / 60000));
    return `${Math.floor(minutes / 60)}u ${String(minutes % 60).padStart(2, '0')}m`;
  }
  function formatDate(ms) { return new Date(ms).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function formatTime(ms) { return new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); }
  function stopActive(at = Date.now()) {
    if (!state.active) return false;
    const a = state.active;
    const end = Math.min(Math.max(at, a.start), a.start + MAX_SESSION_MS);
    if (end > a.start) state.sessions.push({ id: uid(), taskId: a.taskId, taskName: a.taskName, category: a.category, start: a.start, end });
    state.active = null;
    persist();
    return true;
  }
  function autoStop() {
    if (state.active && Date.now() - state.active.start >= MAX_SESSION_MS) {
      stopActive(state.active.start + MAX_SESSION_MS);
      renderAll();
      toast('Automatisch gestopt na 10 uur. Controleer de registratie in Overzicht.');
    }
  }
  function startTask(id) {
    autoStop();
    const t = state.tasks.find(x => x.id === id && !x.archived);
    if (!t) return;
    if (state.active && state.active.taskId === id) { toast('Deze werkzaamheid loopt al.'); return; }
    stopActive();
    state.active = { taskId: t.id, taskName: t.name, category: t.category, start: Date.now() };
    persist(); renderAll();
    toast(`${t.name} gestart`);
  }
  function updateTimer() {
    const a = state.active;
    $('#activeLabel').textContent = a ? a.taskName : 'Geen actieve werkzaamheid';
    $('#elapsedTime').textContent = a ? formatElapsed(Date.now() - a.start) : '00:00:00';
    $('#activeSince').textContent = a ? `Sinds ${formatTime(a.start)}` : '';
    $('#runningHint').textContent = a ? 'De tijd loopt automatisch door.' : 'Kies hieronder een werkzaamheid.';
    $('#stopButton').disabled = !a;
    $('#liveIndicator').classList.toggle('active', !!a);
  }
  function renderHome() {
    $('#taskGrid').innerHTML = state.tasks.filter(x => !x.archived).map(t => {
      const active = state.active && state.active.taskId === t.id;
      return `<button type="button" class="task-button ${active ? 'is-active' : ''}" data-start-id="${escapeHtml(t.id)}" aria-pressed="${!!active}">
        <span class="task-icon" aria-hidden="true">${escapeHtml(t.icon)}</span>
        <div><strong>${escapeHtml(t.name)}</strong><div class="category">${escapeHtml(categoryMeta[t.category].label)}</div></div>
        ${active ? '<span class="active-pill">Nu bezig</span>' : ''}</button>`;
    }).join('') || '<div class="empty-state">Nog geen werkzaamheden. Tik op Toevoegen om te beginnen.</div>';
    updateTimer();
  }
  function getRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let label = 'Vandaag';
    if (currentPeriod === 'week') { start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); label = 'Deze week'; }
    if (currentPeriod === 'month') { start.setDate(1); label = 'Deze maand'; }
    return { start: start.getTime(), end: Date.now(), label };
  }
  function periodSessions() {
    const range = getRange();
    const sessions = state.sessions.concat(state.active ? [{ id: 'active', ...state.active, end: Math.min(Date.now(), state.active.start + MAX_SESSION_MS) }] : []);
    return sessions.map(s => ({ ...s, visibleStart: Math.max(s.start, range.start), visibleEnd: Math.min(s.end, range.end) }))
      .filter(s => s.visibleEnd > s.visibleStart);
  }
  function summarize() {
    const sessions = periodSessions();
    const byCategory = { transfer: 0, partial: 0, special: 0 };
    const byTask = new Map();
    let total = 0;
    for (const s of sessions) {
      const ms = s.visibleEnd - s.visibleStart;
      total += ms;
      byCategory[s.category] = (byCategory[s.category] || 0) + ms;
      const task = state.tasks.find(x => x.id === s.taskId);
      const title = task ? task.name : s.taskName;
      const key = s.taskId || title;
      const previous = byTask.get(key) || { name: title, ms: 0 };
      previous.ms += ms;
      byTask.set(key, previous);
    }
    return { sessions, total, byCategory, byTask: [...byTask.values()].sort((a, b) => b.ms - a.ms) };
  }
  function renderReport() {
    const { sessions, total, byCategory, byTask } = summarize();
    $$('#screen-report [data-period]').forEach(b => { b.classList.toggle('selected', b.dataset.period === currentPeriod); b.setAttribute('aria-pressed', String(b.dataset.period === currentPeriod)); });
    $('#periodLabel').textContent = getRange().label;
    $('#totalHours').textContent = formatMinutes(total);
    $('#transferHours').textContent = formatMinutes(byCategory.transfer);
    $('#categoryBar').innerHTML = total ? Object.keys(categoryMeta).map(c => `<div style="width:${(byCategory[c] / total * 100).toFixed(2)}%;background:${categoryMeta[c].color}" title="${categoryMeta[c].label}: ${formatMinutes(byCategory[c])}"></div>`).join('') : '';
    $('#categoryLegend').innerHTML = Object.keys(categoryMeta).map(c => `<div class="legend-item"><span><i class="color-dot" style="background:${categoryMeta[c].color}"></i>${categoryMeta[c].label}</span><strong>${formatMinutes(byCategory[c])}</strong></div>`).join('');
    $('#taskBreakdown').innerHTML = byTask.length ? byTask.map(t => `<div class="breakdown-item"><div class="breakdown-label"><span>${escapeHtml(t.name)}</span><strong>${formatMinutes(t.ms)}</strong></div><div class="mini-track"><div style="width:${(t.ms / total * 100).toFixed(2)}%"></div></div></div>`).join('') : '<p class="subtle">Nog geen registraties in deze periode.</p>';
    const recent = [...state.sessions].sort((a,b) => b.end - a.end).slice(0, 8);
    $('#historyList').innerHTML = recent.length ? recent.map(s => `<div class="history-item"><div><strong>${escapeHtml(s.taskName)}</strong><small>${formatDate(s.start)} &middot; ${formatMinutes(s.end - s.start)}</small></div><button class="mini-button" type="button" data-edit-session="${escapeHtml(s.id)}">Aanpassen</button></div>`).join('') : '<p class="subtle">Nog geen afgeronde registraties.</p>';
  }
  function renderTasks() {
    const active = state.tasks.filter(t => !t.archived);
    const archived = state.tasks.filter(t => t.archived);
    function item(t) {
      return `<div class="manage-item ${t.archived ? 'archived' : ''}"><span class="manage-icon" aria-hidden="true">${escapeHtml(t.icon)}</span>
        <div class="manage-copy"><strong>${escapeHtml(t.name)}</strong><span>${categoryMeta[t.category].label}${t.archived ? ' - gearchiveerd' : ''}</span></div>
        <div class="manage-actions"><button type="button" data-edit-task="${escapeHtml(t.id)}">Wijzigen</button><button type="button" class="archive" data-toggle-task="${escapeHtml(t.id)}">${t.archived ? 'Herstel' : 'Verwijder'}</button></div></div>`;
    }
    $('#manageTaskList').innerHTML = (active.length ? active.map(item).join('') : '<div class="empty-state">Nog geen actieve werkzaamheden.</div>') + (archived.length ? '<p class="list-subheading">Gearchiveerd</p>' + archived.map(item).join('') : '');
  }
  function renderAll() {
    renderHome(); renderTasks(); if (currentScreen === 'report') renderReport();
  }
  function showScreen(name) {
    if (!['home','report','tasks','backup'].includes(name)) return;
    currentScreen = name;
    $$('.screen').forEach(el => { el.hidden = el.id !== `screen-${name}`; });
    $$('.nav-item').forEach(btn => { btn.classList.toggle('active', btn.dataset.screen === name); btn.setAttribute('aria-current', btn.dataset.screen === name ? 'page' : 'false'); });
    if (name === 'report') renderReport();
    if (name === 'tasks') renderTasks();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function openTaskForm(task = null) {
    editingTaskId = task ? task.id : null;
    $('#taskDialogTitle').textContent = task ? 'Werkzaamheid wijzigen' : 'Nieuwe werkzaamheid';
    $('#taskName').value = task ? task.name : '';
    $('#taskCategory').value = task ? task.category : 'transfer';
    $('#taskIcon').value = task ? task.icon : icons[11].emoji;
    $('#taskDialog').showModal();
    $('#taskName').focus();
  }
  function changeArchive(id) {
    const t = state.tasks.find(x => x.id === id); if (!t) return;
    if (!t.archived && !confirm(`'${t.name}' verwijderen van het beginscherm? Eerdere uren blijven bewaard.`)) return;
    if (!t.archived && state.active && state.active.taskId === id) stopActive();
    t.archived = !t.archived;
    persist(); renderAll(); toast(t.archived ? 'Werkzaamheid gearchiveerd.' : 'Werkzaamheid teruggezet.');
  }
  function openSessionForm(id) {
    const s = state.sessions.find(x => x.id === id); if (!s) return;
    editingSessionId = id;
    $('#sessionHelp').textContent = `${s.taskName} - ${formatDate(s.start)}. Pas de geschatte tijdsduur aan.`;
    $('#sessionMinutes').value = Math.max(1, Math.round((s.end - s.start) / 60000));
    $('#editSessionDialog').showModal();
  }
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function csvCell(x) {
    let str = String(x ?? '');
    if (/^\s*[=+\-@\t\r]/.test(str)) str = "'" + str;
    return `"${str.replace(/"/g, '""')}"`;
  }
  function exportCsv() {
    const result = summarize();
    const lines = [['Datum', 'Werkzaamheid', 'Categorie', 'Start', 'Einde', 'Minuten']];
    [...result.sessions].sort((a,b)=>a.visibleStart-b.visibleStart).forEach(s => lines.push([
      new Date(s.visibleStart).toLocaleDateString('nl-NL'),
      state.tasks.find(t => t.id === s.taskId)?.name || s.taskName,
      categoryMeta[s.category].label,
      formatTime(s.visibleStart), formatTime(s.visibleEnd), Math.round((s.visibleEnd - s.visibleStart) / 60000)
    ]));
    const csv = '\uFEFFsep=;\r\n' + lines.map(r => r.map(csvCell).join(';')).join('\r\n');
    download(`werkregistratie-${currentPeriod}-${new Date().toISOString().slice(0,10)}.csv`, csv, 'text/csv;charset=utf-8');
    toast('CSV-overzicht gedownload.');
  }
  function exportBackup() {
    const savedAt = Date.now();
    const copy = JSON.parse(JSON.stringify(state));
    if (copy.active) {
      copy.sessions.push({ id: uid(), ...copy.active, end: Math.min(savedAt, copy.active.start + MAX_SESSION_MS) });
      copy.active = null;
    }
    download(`werkregistratie-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ app: 'mijn-werkregistratie', savedAt, data: copy }, null, 2), 'application/json;charset=utf-8');
    toast('Back-up gedownload. Bewaar dit bestand goed.');
  }
  async function importBackup(file) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast('Back-upbestand is te groot.'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.app !== 'mijn-werkregistratie' || !parsed.data) throw new Error('Dit is geen back-up van deze app.');
      const next = sanitizedState(parsed.data);
      if (!confirm('Back-up herstellen? Dit vervangt ALLE huidige werkzaamheden en registraties op dit toestel.')) return;
      state = next; persist(); renderAll(); showScreen('home'); toast('Back-up teruggezet.');
    } catch (err) { toast(`Terugzetten mislukt: ${err.message || 'ongeldig bestand'}`); }
  }
  function attachEvents() {
    $$('.nav-item').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));
    $('#taskGrid').addEventListener('click', e => { const b = e.target.closest('[data-start-id]'); if (b) startTask(b.dataset.startId); });
    $('#stopButton').addEventListener('click', () => { if (stopActive()) { renderAll(); toast('Registratie gestopt en opgeslagen.'); } });
    $('#addTaskButton').addEventListener('click', () => openTaskForm());
    $('#addTaskQuick').addEventListener('click', () => openTaskForm());
    $('#cancelTask').addEventListener('click', () => $('#taskDialog').close());
    $('#discardTask').addEventListener('click', () => $('#taskDialog').close());
    $('#taskForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#taskName').value.trim(); if (!name) return;
      const category = normalizeCategory($('#taskCategory').value);
      const icon = normalizeIcon($('#taskIcon').value);
      const record = editingTaskId ? state.tasks.find(t => t.id === editingTaskId) : null;
      if (record) Object.assign(record, { name: name.slice(0,54), category, icon });
      else state.tasks.push({ id: uid(), name: name.slice(0,54), category, icon, archived: false });
      persist(); $('#taskDialog').close(); renderAll(); toast('Werkzaamheid opgeslagen.');
    });
    $('#manageTaskList').addEventListener('click', e => {
      const edit = e.target.closest('[data-edit-task]'); const toggle = e.target.closest('[data-toggle-task]');
      if (edit) openTaskForm(state.tasks.find(t => t.id === edit.dataset.editTask));
      if (toggle) changeArchive(toggle.dataset.toggleTask);
    });
    $$('#screen-report [data-period]').forEach(btn => btn.addEventListener('click', () => { currentPeriod = btn.dataset.period; renderReport(); }));
    $('#historyList').addEventListener('click', e => { const b = e.target.closest('[data-edit-session]'); if (b) openSessionForm(b.dataset.editSession); });
    $('#cancelSession').addEventListener('click', () => $('#editSessionDialog').close());
    $('#sessionForm').addEventListener('submit', e => {
      e.preventDefault();
      const s = state.sessions.find(x => x.id === editingSessionId); if (!s) return;
      const minutes = Number($('#sessionMinutes').value);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) { toast('Vul 1 tot 600 minuten in.'); return; }
      s.start = s.end - minutes * 60000;
      persist(); $('#editSessionDialog').close(); renderReport(); toast('Registratie aangepast.');
    });
    $('#deleteSession').addEventListener('click', () => {
      const s = state.sessions.find(x => x.id === editingSessionId); if (!s) return;
      if (!confirm(`Registratie '${s.taskName}' definitief verwijderen?`)) return;
      state.sessions = state.sessions.filter(x => x.id !== s.id);
      persist(); $('#editSessionDialog').close(); renderReport(); toast('Registratie verwijderd.');
    });
    $('#downloadCsv').addEventListener('click', exportCsv);
    $('#exportBackup').addEventListener('click', exportBackup);
    $('#importBackup').addEventListener('change', async e => { await importBackup(e.target.files?.[0]); e.target.value = ''; });
    $('#resetAll').addEventListener('click', () => {
      if (!confirm('Echt ALLES verwijderen? Maak eerst een back-up als je deze gegevens wilt bewaren.')) return;
      if (!confirm('Laatste controle: alle registraties en onderwerpen op dit toestel worden gewist.')) return;
      state = initialState(); persist(); renderAll(); showScreen('home'); toast('Registratie opnieuw gestart.');
    });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('#installButton').hidden = false; $('#installFromSettings').hidden = false; });
    window.addEventListener('appinstalled', () => { deferredInstall = null; $('#installButton').hidden = true; $('#installFromSettings').hidden = true; });
    async function installApp() { if (!deferredInstall) { toast('Gebruik Chrome: menu > Toevoegen aan startscherm.'); return; } deferredInstall.prompt(); deferredInstall = null; $('#installButton').hidden = true; $('#installFromSettings').hidden = true; }
    $('#installButton').addEventListener('click', installApp);
    $('#installFromSettings').addEventListener('click', installApp);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { autoStop(); renderAll(); } });
  }
  $('#taskIcon').innerHTML = icons.map(icon => `<option value="${escapeHtml(icon.emoji)}">${escapeHtml(icon.emoji)} ${escapeHtml(icon.label)}</option>`).join('');
  attachEvents();
  autoStop(); renderAll(); showScreen('home');
  setInterval(() => { autoStop(); updateTimer(); if (currentScreen === 'report' && !document.hidden) renderReport(); }, 1000);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* browser may block it */ }); });
  }
})();
