const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCanpMR3uSiZAecwLYG9nWiXvaksJncX0U",
  authDomain: "americaestuya.firebaseapp.com",
  projectId: "americaestuya",
  storageBucket: "americaestuya.firebasestorage.app",
  messagingSenderId: "1071710933035",
  appId: "1:1071710933035:web:2443a0ec9f1405fcc61a6e",
  measurementId: "G-8K579LVLX1"
};

const DATA_API_URL = 'https://ep-muddy-fire-awvetyx3.apirest.c-12.us-east-1.aws.neon.tech/americaestuya/rest/v1';

async function startAccountSync() {
  const [{ initializeApp, getApps, getApp }, { getAuth, onAuthStateChanged }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);

  const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);

  onAuthStateChanged(auth, async user => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${DATA_API_URL}/accounts?on_conflict=auth_uid`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          auth_uid: user.uid,
          email: user.email || '',
          display_name: user.displayName || user.email || 'Usuario',
          last_login_at: new Date().toISOString(),
          is_active: true
        })
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`No se pudo sincronizar ACCOUNTS (${response.status}): ${detail}`);
      }

      const rows = await response.json();
      const account = Array.isArray(rows) ? rows[0] : rows;
      if (account) sessionStorage.setItem('americaestuya_account', JSON.stringify(account));
      sessionStorage.setItem('americaestuya_account_sync', 'ok');
    } catch (error) {
      sessionStorage.setItem('americaestuya_account_sync', 'error');
      console.error('Error sincronizando ACCOUNTS', error);
    }
  });
}

startAccountSync().catch(error => console.error('Error iniciando sincronización de cuenta', error));
