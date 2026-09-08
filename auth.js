// AmericaEsTuya authentication
// Firebase web configuration is safe to expose in client-side code.
// Never place a Facebook App Secret or any private server secret here.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCanpMR3uSiZAecwLYG9nWiXvaksJncX0U",
  authDomain: "americaestuya.firebaseapp.com",
  projectId: "americaestuya",
  storageBucket: "americaestuya.firebasestorage.app",
  messagingSenderId: "1071710933035",
  appId: "1:1071710933035:web:2443a0ec9f1405fcc61a6e",
  measurementId: "G-8K579LVLX1"
};

async function initAmericaAuth() {
  const gate = document.getElementById('authGate');
  const app = document.getElementById('siteApp');
  const status = document.getElementById('authStatus');
  const googleBtn = document.getElementById('googleLogin');
  const facebookBtn = document.getElementById('facebookLogin');
  const logoutBtn = document.getElementById('logoutBtn');
  const userBox = document.getElementById('userBox');
  const userPic = document.getElementById('userPic');
  const userName = document.getElementById('userName');
  if (!gate || !app) return;

  const [{ initializeApp }, {
    getAuth, onAuthStateChanged, signInWithPopup,
    signInWithRedirect, getRedirectResult,
    setPersistence, browserLocalPersistence,
    signOut, GoogleAuthProvider, FacebookAuthProvider
  }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);

  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(firebaseApp);
  await setPersistence(auth, browserLocalPersistence);

  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  const facebookProvider = new FacebookAuthProvider();
  facebookProvider.addScope('email');

  let loginInProgress = false;
  let processingRedirect = true;

  const setButtons = disabled => {
    if (googleBtn) googleBtn.disabled = disabled;
    if (facebookBtn) facebookBtn.disabled = disabled;
  };

  const showMainSite = user => {
    loginInProgress = false;
    processingRedirect = false;
    setButtons(false);
    gate.style.display = 'none';
    app.style.display = 'block';
    userBox.hidden = false;
    userName.textContent = 'Conectado como ' + (user.displayName || user.email || 'Usuario');

    if (user.photoURL) {
      userPic.src = user.photoURL;
      userPic.hidden = false;
    } else {
      userPic.hidden = true;
    }
  };

  const showLogin = message => {
    loginInProgress = false;
    processingRedirect = false;
    gate.style.display = 'grid';
    app.style.display = 'none';
    userBox.hidden = true;
    setButtons(false);
    status.textContent = message || 'Inicia sesión para entrar a América es Tuya.';
  };

  const showError = err => {
    console.error('AUTH ERROR', err);
    const code = err?.code || 'sin-codigo';
    const message = err?.message || '';

    if (code === 'auth/account-exists-with-different-credential') {
      showLogin('Ese correo ya está registrado con otro método de acceso. (' + code + ')');
    } else if (code === 'auth/operation-not-allowed') {
      showLogin('Facebook no está habilitado correctamente en Firebase. (' + code + ')');
    } else if (code === 'auth/unauthorized-domain') {
      showLogin('Falta autorizar iderguzl.github.io en Firebase. (' + code + ')');
    } else if (code === 'auth/network-request-failed') {
      showLogin('Falló la conexión con Firebase. (' + code + ')');
    } else {
      showLogin('ERROR FACEBOOK: ' + code + (message ? ' — ' + message : ''));
    }
  };

  // Procesamos primero cualquier regreso de Facebook. No forzamos recargas.
  status.textContent = 'Comprobando acceso…';
  setButtons(true);

  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      showMainSite(redirectResult.user);
      return;
    }
  } catch (e) {
    showError(e);
    return;
  }

  // Esperamos a que Firebase termine de restaurar una sesión persistida.
  if (typeof auth.authStateReady === 'function') {
    try {
      await auth.authStateReady();
    } catch (_) {}
  }

  if (auth.currentUser) {
    showMainSite(auth.currentUser);
    return;
  }

  processingRedirect = false;
  showLogin();

  const loginGoogle = async () => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Google…';
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result?.user) showMainSite(result.user);
    } catch (e) {
      showError(e);
    }
  };

  const loginFacebook = async () => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Facebook…';
    try {
      // Flujo oficial de Firebase en la misma pestaña.
      await signInWithRedirect(auth, facebookProvider);
    } catch (e) {
      showError(e);
    }
  };

  if (googleBtn) googleBtn.onclick = loginGoogle;
  if (facebookBtn) facebookBtn.onclick = loginFacebook;
  if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

  onAuthStateChanged(auth, user => {
    if (user) {
      showMainSite(user);
    } else if (!processingRedirect && !loginInProgress) {
      showLogin();
    }
  });
}

initAmericaAuth().catch(e => {
  console.error('Error inicializando Firebase Auth', e);
  const status = document.getElementById('authStatus');
  if (status) status.textContent = 'No se pudo iniciar Firebase Authentication: ' + (e?.message || e);
});
