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
  const connectedGate = document.getElementById('connectedGate');
  const app = document.getElementById('siteApp');
  const status = document.getElementById('authStatus');
  const googleBtn = document.getElementById('googleLogin');
  const facebookBtn = document.getElementById('facebookLogin');
  const enterBtn = document.getElementById('enterSiteBtn');
  const connectedLogoutBtn = document.getElementById('connectedLogoutBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userBox = document.getElementById('userBox');
  const userPic = document.getElementById('userPic');
  const userName = document.getElementById('userName');
  const connectedPic = document.getElementById('connectedPic');
  const connectedName = document.getElementById('connectedName');
  if (!gate || !connectedGate || !app) return;

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
  let connectedUser = null;

  const setButtons = disabled => {
    if (googleBtn) googleBtn.disabled = disabled;
    if (facebookBtn) facebookBtn.disabled = disabled;
  };

  const getUserPhoto = user => {
    const providers = Array.isArray(user?.providerData) ? user.providerData : [];
    const facebookData = providers.find(p => p?.providerId === 'facebook.com');
    if (facebookData?.photoURL) return facebookData.photoURL;
    if (user?.photoURL) return user.photoURL;
    if (facebookData?.uid) {
      return `https://graph.facebook.com/${encodeURIComponent(facebookData.uid)}/picture?type=large`;
    }
    return '';
  };

  const setProfileImage = (img, user, sizeLabel) => {
    if (!img) return;
    const photo = getUserPhoto(user);
    if (photo) {
      img.hidden = false;
      img.alt = user.displayName ? `Foto de ${user.displayName}` : `Foto de perfil ${sizeLabel || ''}`;
      img.onerror = () => {
        img.onerror = null;
        img.hidden = true;
      };
      img.src = photo;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
  };

  const showConnected = user => {
    loginInProgress = false;
    connectedUser = user;
    sessionStorage.removeItem('facebookRedirectPending');
    setButtons(false);
    gate.style.display = 'none';
    app.style.display = 'none';
    connectedGate.style.display = 'grid';
    const label = user.displayName || user.email || 'Usuario';
    connectedName.textContent = label;
    setProfileImage(connectedPic, user, 'grande');
  };

  const showMainSite = user => {
    loginInProgress = false;
    connectedUser = user;
    sessionStorage.removeItem('facebookRedirectPending');
    setButtons(false);
    gate.style.display = 'none';
    connectedGate.style.display = 'none';
    app.style.display = 'block';
    userBox.hidden = false;
    userName.textContent = 'Conectado como ' + (user.displayName || user.email || 'Usuario');
    setProfileImage(userPic, user, 'pequeña');
  };

  const showLogin = message => {
    loginInProgress = false;
    connectedUser = null;
    gate.style.display = 'grid';
    connectedGate.style.display = 'none';
    app.style.display = 'none';
    userBox.hidden = true;
    setButtons(false);
    status.textContent = message || 'Inicia sesión para entrar a América es Tuya.';
  };

  const showError = err => {
    console.error('AUTH ERROR', err);
    sessionStorage.removeItem('facebookRedirectPending');
    const code = err?.code || 'sin-codigo';
    const message = err?.message || '';
    if (code === 'auth/account-exists-with-different-credential') {
      showLogin('Ese correo ya está registrado con otro método de acceso. (' + code + ')');
    } else if (code === 'auth/operation-not-allowed') {
      showLogin('Facebook no está habilitado correctamente en Firebase. (' + code + ')');
    } else if (code === 'auth/unauthorized-domain') {
      showLogin('Este dominio no está autorizado en Firebase Authentication. (' + code + ')');
    } else if (code === 'auth/network-request-failed') {
      showLogin('Falló la conexión con Firebase. (' + code + ')');
    } else {
      showLogin('ERROR FACEBOOK: ' + code + (message ? ' — ' + message : ''));
    }
  };

  const returningFromFacebook = sessionStorage.getItem('facebookRedirectPending') === '1';
  status.textContent = returningFromFacebook ? 'Completando acceso con Facebook…' : 'Comprobando acceso…';
  setButtons(true);

  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      showConnected(redirectResult.user);
      return;
    }
  } catch (e) {
    showError(e);
    return;
  }

  if (typeof auth.authStateReady === 'function') {
    try { await auth.authStateReady(); } catch (_) {}
  }

  if (auth.currentUser) {
    showConnected(auth.currentUser);
  } else if (returningFromFacebook) {
    sessionStorage.removeItem('facebookRedirectPending');
    showLogin('Facebook regresó, pero Firebase no confirmó la sesión.');
  } else {
    showLogin();
  }

  const loginGoogle = async () => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Google…';
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result?.user) showConnected(result.user);
    } catch (e) { showError(e); }
  };

  const loginFacebook = async () => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Facebook…';
    sessionStorage.setItem('facebookRedirectPending', '1');
    try {
      await signInWithRedirect(auth, facebookProvider);
    } catch (e) {
      showError(e);
    }
  };

  if (googleBtn) googleBtn.onclick = loginGoogle;
  if (facebookBtn) facebookBtn.onclick = loginFacebook;
  if (enterBtn) enterBtn.onclick = () => {
    const user = connectedUser || auth.currentUser;
    if (user) showMainSite(user);
    else showLogin();
  };
  if (connectedLogoutBtn) connectedLogoutBtn.onclick = () => signOut(auth);
  if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

  onAuthStateChanged(auth, user => {
    if (!user) {
      if (!loginInProgress && sessionStorage.getItem('facebookRedirectPending') !== '1') showLogin();
      return;
    }
    if (app.style.display === 'block') return;
    showConnected(user);
  });
}

initAmericaAuth().catch(e => {
  console.error('Error inicializando Firebase Auth', e);
  const status = document.getElementById('authStatus');
  if (status) status.textContent = 'No se pudo iniciar Firebase Authentication: ' + (e?.message || e);
});
