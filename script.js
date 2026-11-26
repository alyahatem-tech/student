/* StudyDesk – Student Task Manager (vanilla JS, no backend) */
const STORE_KEY = 'studydesk.tasks', THEME_KEY = 'studydesk.theme';
const QUOTES = [
  'Small steps every day add up to big results.',
  'Start now. Perfect can come later.',
  'Focus on progress, not perfection.',
  'One task at a time. You can do this!',
  'Future you will thank you for studying today.'
];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

// ---------- State ----------
let tasks = load();
let ui = { view: 'dashboard', filter: 'all', subject: 'all', search: '', sort: 'date' };
let editingId = null, deletingId = null;

const $ = id => document.getElementById(id);

// ---------- Storage ----------
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
/** Save tasks and refresh the whole UI so the dashboard is always in sync. */
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(tasks));
  render();
}

// ---------- Date helpers ----------
/** Today's date as YYYY-MM-DD in local time (matches <input type="date">). */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Whole days from today until the due date (negative = past). */
function daysUntil(due) {
  const [y, m, d] = due.split('-').map(Number);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - now) / 86400000);
}
function fmtDate(due) {
  if (!due) return 'No due date';
  const [y, m, d] = due.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
const isOverdue = t => !t.done && !!t.due && t.due < todayStr();
const isSoon = t => !t.done && !!t.due && daysUntil(t.due) >= 0 && daysUntil(t.due) <= 2;

// ---------- Helpers ----------
function esc(s) {
  const div = document.createElement('div'); div.textContent = s; return div.innerHTML;
}
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// ---------- Filtering & sorting ----------
/** Returns tasks matching the current filter, subject, search and sort. */
function visibleTasks() {
  const q = ui.search.trim().toLowerCase();
  let list = tasks.filter(t => {
    if (ui.filter === 'pending' && t.done) return false;
    if (ui.filter === 'completed' && !t.done) return false;
    if (ui.filter === 'overdue' && !isOverdue(t)) return false;
    if (ui.subject !== 'all' && t.subject !== ui.subject) return false;
    return !q || t.title.toLowerCase().includes(q);
  });
  list.sort((a, b) => {
    if (ui.sort === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (ui.sort === 'created') return b.created - a.created;
    return (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99'); // by due date
  });
  return list;
}

// ---------- Rendering ----------
function renderDashboard() {
  const total = tasks.length, done = tasks.filter(t => t.done).length;
  const overdue = tasks.filter(isOverdue).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  $('sTotal').textContent = total;
  $('sDone').textContent = done;
  $('sPending').textContent = total - done;
  $('sOverdue').textContent = overdue;
  $('pct').textContent = pct + '%';
  $('barFill').style.width = pct + '%';
  $('progressMsg').textContent = !total ? 'Add your first task to start tracking progress.'
    : pct === 100 ? '🎉 All done! Amazing work.'
    : `${done} of ${total} tasks finished. Keep going!`;

  const soon = tasks.filter(t => !t.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 5);
  $('upcoming').innerHTML = soon.length ? soon.map(t => {
    const label = !t.due ? 'No date' : isOverdue(t) ? 'Overdue' : daysUntil(t.due) === 0 ? 'Today' : fmtDate(t.due);
    return `<li><span><b>${esc(t.title)}</b> · ${esc(t.subject)}</span><span class="tag ${isOverdue(t) ? 'late' : t.priority}">${label}</span></li>`;
  }).join('') : '<li>Nothing pending. Enjoy your free time! 🌴</li>';
}

function renderTasks() {
  const list = visibleTasks();
  if (!list.length) {
    const none = !tasks.length;
    $('taskList').innerHTML = `<div class="empty"><div class="big">${none ? '📝' : '🔍'}</div>
      <p><b>${none ? 'No tasks yet' : 'No tasks match your filters'}</b></p>
      <p>${none ? 'Click “Add task” to plan your first assignment.' : 'Try another filter or search term.'}</p></div>`;
    return;
  }
  $('taskList').innerHTML = list.map(t => {
    const late = isOverdue(t), cls = ['task', 'p-' + t.priority, t.done ? 'done' : '', late ? 'overdue' : ''].join(' ');
    return `<article class="${cls}" data-id="${t.id}">
      <input type="checkbox" class="check" ${t.done ? 'checked' : ''} aria-label="Mark complete" data-act="toggle">
      <div class="t-body">
        <h3>${esc(t.title)}</h3>
        ${t.desc ? `<p>${esc(t.desc)}</p>` : ''}
        <div class="tags">
          <span class="tag subject">${esc(t.subject)}</span>
          <span class="tag ${t.priority}">${t.priority[0].toUpperCase() + t.priority.slice(1)}</span>
          <span class="tag">📅 ${fmtDate(t.due)}</span>
          ${late ? '<span class="tag late">Overdue</span>' : ''}${t.done ? '<span class="tag ok">Done</span>' : ''}
        </div>
      </div>
      <div class="t-actions">
        <button class="icon-btn" data-act="edit" aria-label="Edit task">✏️</button>
        <button class="icon-btn" data-act="delete" aria-label="Delete task">🗑️</button>
      </div></article>`;
  }).join('');
}

function renderSubjects() {
  const sel = $('subjectFilter'), current = ui.subject;
  const subjects = [...new Set(tasks.map(t => t.subject))].sort();
  sel.innerHTML = '<option value="all">All subjects</option>' + subjects.map(s => `<option>${esc(s)}</option>`).join('');
  if (!subjects.includes(current)) ui.subject = 'all';
  sel.value = ui.subject;
}

function render() { renderSubjects(); renderDashboard(); renderTasks(); }

function showView(name) {
  ui.view = name;
  $('view-dashboard').classList.toggle('hidden', name !== 'dashboard');
  $('view-tasks').classList.toggle('hidden', name !== 'tasks');
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

// ---------- Add / edit / delete ----------
function openModal(id = null) {
  editingId = id;
  const t = tasks.find(x => x.id === id);
  $('modalTitle').textContent = t ? 'Edit task' : 'Add task';
  $('fTitle').value = t ? t.title : '';
  $('fDesc').value = t ? t.desc : '';
  $('fSubject').value = t ? t.subject : 'Math';
  $('fPriority').value = t ? t.priority : 'medium';
  $('fDue').value = t ? t.due : '';
  $('titleErr').textContent = '';
  $('modal').classList.remove('hidden');
  $('fTitle').focus();
}
const closeModal = () => $('modal').classList.add('hidden');

/** Validates the form (no empty titles) then creates or updates a task. */
function submitForm(e) {
  e.preventDefault();
  const title = $('fTitle').value.trim();
  if (!title) { $('titleErr').textContent = 'Please enter a task title.'; $('fTitle').focus(); return; }
  const data = { title, desc: $('fDesc').value.trim(), subject: $('fSubject').value, priority: $('fPriority').value, due: $('fDue').value };
  if (editingId) {
    tasks = tasks.map(t => t.id === editingId ? { ...t, ...data } : t);
    toast('Task updated');
  } else {
    tasks.push({ id: Date.now().toString(36), done: false, created: Date.now(), ...data });
    toast('Task added');
  }
  closeModal(); save();
}

function toggleTask(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
  save();
}

function askDelete(id) {
  deletingId = id;
  $('confirmText').textContent = `“${tasks.find(t => t.id === id).title}” will be removed permanently.`;
  $('confirm').classList.remove('hidden');
}
function confirmDelete() {
  tasks = tasks.filter(t => t.id !== deletingId);
  $('confirm').classList.add('hidden'); save(); toast('Task deleted');
}

// ---------- Deadline notifications ----------
/** Shows a toast for overdue and soon-due tasks (runs on page load). */
function checkDeadlines() {
  const soon = tasks.filter(isSoon), late = tasks.filter(isOverdue);
  if (late.length) toast(`⚠️ ${late.length} task${late.length > 1 ? 's are' : ' is'} overdue.`);
  soon.slice(0, 3).forEach(t => {
    const d = daysUntil(t.due);
    toast(`⏰ “${t.title}” is due ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in 2 days'}.`);
  });
}

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('themeBtn').textContent = theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode';
  localStorage.setItem(THEME_KEY, theme);
}

// ---------- Init & events ----------
function init() {
  const h = new Date().getHours();
  $('welcome').textContent = `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, student! 👋`;
  $('today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('quote').textContent = QUOTES[new Date().getDate() % QUOTES.length];
  applyTheme(localStorage.getItem(THEME_KEY) ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('navAdd').addEventListener('click', () => openModal());
  document.querySelectorAll('[data-open-add]').forEach(b => b.addEventListener('click', () => openModal()));
  $('themeBtn').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

  $('taskForm').addEventListener('submit', submitForm);
  $('cancelBtn').addEventListener('click', closeModal);
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  $('noDel').addEventListener('click', () => $('confirm').classList.add('hidden'));
  $('yesDel').addEventListener('click', confirmDelete);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); $('confirm').classList.add('hidden'); } });

  $('search').addEventListener('input', e => { ui.search = e.target.value; renderTasks(); });
  $('subjectFilter').addEventListener('change', e => { ui.subject = e.target.value; renderTasks(); });
  $('sort').addEventListener('change', e => { ui.sort = e.target.value; renderTasks(); });
  $('chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip'); if (!chip) return;
    ui.filter = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
    renderTasks();
  });

  // One delegated listener handles checkbox / edit / delete on every task card
  $('taskList').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const id = btn.closest('.task').dataset.id;
    if (btn.dataset.act === 'toggle') toggleTask(id);
    if (btn.dataset.act === 'edit') openModal(id);
    if (btn.dataset.act === 'delete') askDelete(id);
  });

  render();
  checkDeadlines();
}
init();
