/* StudyDesk – accounts (stored in this browser's LocalStorage; no server) */
const USERS_KEY = 'studydesk.users', SESSION_KEY = 'studydesk.session';

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch { return {}; }
}
/** SHA-256 hash so the plain password is never stored. */
async function hashPassword(username, password) {
  const text = `studydesk:${username}:${password}`;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return btoa(unescape(encodeURIComponent(text))); // fallback for very old browsers
}
/** Returns {username, name} for the logged-in user, or null. */
function getSessionUser() {
  const u = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  const users = getUsers();
  return u && users[u] ? { username: u, name: users[u].name } : null;
}
function logout() {
  localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
  location.href = 'login.html';
}

// ---------- Login page logic (runs only on login.html) ----------
if (document.getElementById('authForm')) {
  if (getSessionUser()) location.replace('index.html');
  const $ = id => document.getElementById(id);
  let mode = 'login';

  function setMode(m) {
    mode = m;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.mode === m));
    $('nameRow').classList.toggle('hidden', m === 'login');
    $('authTitle').textContent = m === 'login' ? 'Welcome back' : 'Create your account';
    $('authSubmit').textContent = m === 'login' ? 'Log in' : 'Sign up';
    $('password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('authErr').textContent = '';
  }
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  $('showPw').addEventListener('click', () => {
    const show = $('password').type === 'password';
    $('password').type = show ? 'text' : 'password';
    $('showPw').textContent = show ? '🙈' : '👁️';
  });

  $('authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = msg => { $('authErr').textContent = msg; };
    const username = $('username').value.trim().toLowerCase(), password = $('password').value;
    const users = getUsers();
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) return err('Username: 3–20 letters, numbers, "." or "_".');
    if (password.length < 6) return err('Password must be at least 6 characters.');
    const hash = await hashPassword(username, password);

    if (mode === 'signup') {
      const name = $('fullName').value.trim();
      if (!name) return err('Please enter your name.');
      if (users[username]) return err('This username is taken. Try another one or log in.');
      users[username] = { name, hash };
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } else if (!users[username] || users[username].hash !== hash) {
      return err('Wrong username or password.');
    }
    localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
    (($('remember').checked) ? localStorage : sessionStorage).setItem(SESSION_KEY, username);
    location.href = 'index.html';
  });
  setMode('login');
}
