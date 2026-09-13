// Gestión de Usuarios para America es Tuya.
// Sigue el mismo patrón CRUD que Clientes.

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCanpMR3uSiZAecwLYG9nWiXvaksJncX0U',
  authDomain: 'americaestuya.firebaseapp.com',
  projectId: 'americaestuya',
  storageBucket: 'americaestuya.firebasestorage.app',
  messagingSenderId: '1071710933035',
  appId: '1:1071710933035:web:2443a0ec9f1405fcc61a6e',
  measurementId: 'G-8K579LVLX1'
};

const DATA_API_URL = 'https://ep-muddy-fire-awvetyx3.apirest.c-12.us-east-1.aws.neon.tech/americaestuya/rest/v1';

let currentToken = '';
let currentAccount = null;
let usersCache = [];
let selectedUserId = null;
let userSortAsc = true;
let initialized = false;

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>'\"]/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;'
}[ch]));

function setUserMessage(message, type = '') {
  const el = $('userStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'status' + (type ? ' ' + type : '');
}

function clearTransientMessages() {
  document.querySelectorAll('.status').forEach(el => {
    el.textContent = '';
    el.className = 'status';
  });
}

function configureBackButton() {
  const back = document.querySelector('.back');
  if (!back) return;

  back.removeAttribute('onclick');
  back.addEventListener('click', event => {
    event.preventDefault();

    // Volver a la página real desde la que se entró a Gestión.
    // No forzar nunca la raíz/login.
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === location.origin && ref.href !== location.href) {
        location.href = ref.href;
        return;
      }
    } catch (_) {}

    if (history.length > 1) history.back();
    else location.href = '../site.html';
  });
}

function injectUsersUI() {
  const section = $('users');
  if (!section || $('usersList')) return;

  const toolbar = section.querySelector('[data-tools="users"]');
  const oldPlaceholder = section.querySelector('.placeholder');
  const additional = section.querySelector('.additional-box');

  oldPlaceholder?.remove();

  const box = document.createElement('div');
  box.innerHTML = `
    <div id="userStatus" class="status"></div>
    <div id="userSearch" class="searchbar">
      <input id="userSearchText" type="search" placeholder="Buscar">
      <select id="userFilter" aria-label="Filtrar usuarios">
        <option value="active">Activos</option>
      </select>
    </div>
    <form id="userForm" class="client-form">
      <input id="userId" type="hidden">
      <div class="form-grid">
        <div class="field full">
          <label for="userName">Nombre</label>
          <input id="userName" maxlength="150" required>
        </div>
        <div class="field">
          <label for="userEmail">Correo</label>
          <input id="userEmail" type="email" maxlength="320">
        </div>
        <div class="field">
          <label for="userPhone">Teléfono</label>
          <input id="userPhone" maxlength="40">
        </div>
        <div class="field">
          <label for="userActive">Estado</label>
          <select id="userActive">
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button class="primary" type="submit">Guardar</button>
        <button id="cancelUserBtn" class="secondary" type="button">Cancelar</button>
      </div>
    </form>
    <div id="usersList" class="clients-list"><div class="no-items">Cargando…</div></div>
  `;

  if (additional) section.insertBefore(box, additional);
  else if (toolbar) toolbar.insertAdjacentElement('afterend', box);
  else section.appendChild(box);

  if (additional) {
    const body = additional.querySelector('.additional-body');
    if (body) body.id = 'userAdditional';
  }
}

function resetUserForm() {
  $('userId').value = '';
  $('userName').value = '';
  $('userEmail').value = '';
  $('userPhone').value = '';
  $('userActive').value = 'true';
}

function openUserForm(user = null) {
  resetUserForm();
  setUserMessage('');

  if (user) {
    $('userId').value = user.user_id;
    $('userName').value = user.name || '';
    $('userEmail').value = user.email || '';
    $('userPhone').value = user.phone || '';
    $('userActive').value = String(user.is_active !== false);
  }

  $('userForm').classList.add('open');
  $('userName').focus();
}

function closeUserForm() {
  $('userForm').classList.remove('open');
  resetUserForm();
  setUserMessage('');
}

function visibleUsers() {
  const q = $('userSearchText').value.trim().toLowerCase();

  return [...usersCache]
    .filter(user => user.is_active !== false)
    .filter(user => !q || [user.name, user.email, user.phone]
      .some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => {
      const n = String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
      return userSortAsc ? n : -n;
    });
}

function renderUsers() {
  const list = $('usersList');
  if (!list) return;

  const rows = visibleUsers();
  if (!rows.length) {
    list.innerHTML = '<div class="no-items">Sin resultados</div>';
    return;
  }

  list.innerHTML = rows.map(user => `
    <div class="client-row ${String(user.user_id) === String(selectedUserId) ? 'selected' : ''}"
         tabindex="0" data-id="${escapeHtml(user.user_id)}">
      <div>
        <div class="client-name">${escapeHtml(user.name || '')}</div>
        <div class="client-meta">
          ${user.email ? `<span>${escapeHtml(user.email)}</span>` : ''}
          ${user.phone ? `<span>${escapeHtml(user.phone)}</span>` : ''}
        </div>
      </div>
      <span class="client-state">Activo</span>
    </div>`).join('');

  list.querySelectorAll('.client-row').forEach(row => {
    const select = () => {
      selectedUserId = row.dataset.id;
      setUserMessage('');
      renderUsers();
    };

    row.addEventListener('click', select);
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  });
}

async function waitForFirebaseUser(auth) {
  if (typeof auth.authStateReady === 'function') {
    try { await auth.authStateReady(); } catch (_) {}
  }
  if (auth.currentUser) return auth.currentUser;

  const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js');
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('No hay una sesión activa.'));
    }, 8000);

    unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(user);
    }, error => {
      clearTimeout(timer);
      unsubscribe();
      reject(error);
    });
  });
}

async function getSession() {
  const [{ initializeApp, getApps, getApp }, { getAuth }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);

  const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const user = await waitForFirebaseUser(auth);

  currentToken = await user.getIdToken();
  const response = await fetch(
    `${DATA_API_URL}/accounts?select=account_id&auth_uid=eq.${encodeURIComponent(user.uid)}`,
    { headers: { Authorization: `Bearer ${currentToken}` } }
  );

  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  currentAccount = rows[0] || null;
  if (!currentAccount) throw new Error('Cuenta no encontrada.');
}

async function loadUsers() {
  setUserMessage('');
  if (!currentToken || !currentAccount) await getSession();

  try {
    const response = await fetch(
      `${DATA_API_URL}/users?select=user_id,name,email,phone,is_active,created_at,updated_at&account_id=eq.${currentAccount.account_id}&is_active=eq.true`,
      { headers: { Authorization: `Bearer ${currentToken}` } }
    );

    if (!response.ok) throw new Error(await response.text());
    usersCache = await response.json();
    selectedUserId = null;
    renderUsers();
    setUserMessage('');
  } catch (error) {
    console.error(error);
    setUserMessage('No se pudieron cargar los usuarios.', 'error');
  }
}

function selectedUser() {
  return usersCache.find(user => String(user.user_id) === String(selectedUserId)) || null;
}

async function saveUser(event) {
  event.preventDefault();
  setUserMessage('');
  if (!currentToken || !currentAccount) await getSession();

  const id = $('userId').value;
  const payload = {
    name: $('userName').value.trim(),
    email: $('userEmail').value.trim() || null,
    phone: $('userPhone').value.trim() || null,
    is_active: $('userActive').value === 'true',
    updated_at: new Date().toISOString()
  };

  if (!payload.name) return;

  let url = `${DATA_API_URL}/users`;
  let method = 'POST';

  if (id) {
    url += `?user_id=eq.${encodeURIComponent(id)}&account_id=eq.${currentAccount.account_id}`;
    method = 'PATCH';
  } else {
    // Igual que Clientes: la base de datos genera user_id.
    // Enviar un ID manual impedía guardar cuando la columna es identity.
    payload.account_id = currentAccount.account_id;
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(await response.text());

    closeUserForm();
    selectedUserId = null;
    await loadUsers();
    setUserMessage('Guardado.', 'success');
    setTimeout(() => setUserMessage(''), 1300);
  } catch (error) {
    console.error(error);
    setUserMessage('No se pudo guardar.', 'error');
  }
}

async function softDeleteUser() {
  const user = selectedUser();
  if (!user) {
    setUserMessage('Selecciona un usuario.', 'error');
    return;
  }
  if (!confirm(`¿Eliminar ${user.name}?`)) return;

  setUserMessage('');
  try {
    if (!currentToken || !currentAccount) await getSession();

    const response = await fetch(
      `${DATA_API_URL}/users?user_id=eq.${encodeURIComponent(user.user_id)}&account_id=eq.${currentAccount.account_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() })
      }
    );

    if (!response.ok) throw new Error(await response.text());
    selectedUserId = null;
    await loadUsers();
  } catch (error) {
    console.error(error);
    setUserMessage('No se pudo eliminar.', 'error');
  }
}

function exportUsers() {
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const rows = visibleUsers();
  const csv = [
    'Nombre,Correo,Telefono,Estado',
    ...rows.map(user => [user.name, user.email, user.phone, 'Activo'].map(quote).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'usuarios.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function handleUserTool(action, button) {
  setUserMessage('');

  if (action === 'new') {
    selectedUserId = null;
    renderUsers();
    openUserForm();
    return;
  }

  if (action === 'edit') {
    const user = selectedUser();
    user ? openUserForm(user) : setUserMessage('Selecciona un usuario.', 'error');
    return;
  }

  if (action === 'delete') {
    softDeleteUser();
    return;
  }

  if (action === 'search') {
    $('userSearch').classList.toggle('open');
    button.classList.toggle('active');
    if ($('userSearch').classList.contains('open')) $('userSearchText').focus();
    return;
  }

  if (action === 'filter') {
    $('userSearch').classList.add('open');
    $('userFilter').focus();
    return;
  }

  if (action === 'sort') {
    userSortAsc = !userSortAsc;
    button.classList.toggle('active', !userSortAsc);
    button.title = userSortAsc ? 'Ordenar ascendente' : 'Ordenar descendente';
    button.setAttribute('aria-label', button.title);
    renderUsers();
    return;
  }

  if (action === 'print') {
    window.print();
    return;
  }

  if (action === 'export') exportUsers();
}

function wireUsersToolbar() {
  const toolbar = document.querySelector('[data-tools="users"]');
  if (!toolbar) return;

  toolbar.querySelectorAll('.tool-btn').forEach(button => {
    button.disabled = false;
    if (button.dataset.action === 'sort') {
      button.title = 'Ordenar ascendente';
      button.setAttribute('aria-label', 'Ordenar ascendente');
    }
  });

  toolbar.addEventListener('click', event => {
    const button = event.target.closest('.tool-btn');
    if (!button || !toolbar.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleUserTool(button.dataset.action, button);
  }, true);
}

async function initUsersManagement() {
  if (initialized) return;
  initialized = true;

  injectUsersUI();
  configureBackButton();
  clearTransientMessages();
  wireUsersToolbar();

  $('cancelUserBtn')?.addEventListener('click', closeUserForm);
  $('userForm')?.addEventListener('submit', saveUser);
  $('userSearchText')?.addEventListener('input', renderUsers);

  window.addEventListener('pageshow', event => {
    clearTransientMessages();
    if (event.persisted) {
      currentToken = '';
      currentAccount = null;
      loadUsers().catch(error => console.error(error));
    }
  });

  try {
    await getSession();
    await loadUsers();
  } catch (error) {
    console.error(error);
    setUserMessage('No se pudieron cargar los usuarios.', 'error');
  }
}

if (document.readyState === 'complete') initUsersManagement();
else window.addEventListener('load', initUsersManagement, { once: true });
