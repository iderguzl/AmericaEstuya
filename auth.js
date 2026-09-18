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

const LOCAL_ACCESS_KEY = 'americaestuya_access_mode';
const ACCESS_GUEST = 'guest';
const SESSION_ACCESS_KEY = 'americaestuya_session_access';
const RESUME_MAIN_KEY = 'americaestuya_resume_main';
const DRIVE_ACCESS_TOKEN_KEY = 'americaestuya_google_drive_token';
const DRIVE_ACCESS_TOKEN_EXP_KEY = 'americaestuya_google_drive_token_exp';

async function initAmericaAuth() {
  const gate = document.getElementById('authGate');
  const connectedGate = document.getElementById('connectedGate');
  const app = document.getElementById('siteApp');
  const status = document.getElementById('authStatus');
  const googleBtn = document.getElementById('googleLogin');
  const guestBtn = document.getElementById('guestLogin');
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

  const returningFromManagementEarly = sessionStorage.getItem(RESUME_MAIN_KEY) === '1';
  if (returningFromManagementEarly) {
    gate.style.display = 'none';
    connectedGate.style.display = 'none';
    app.style.display = 'block';
  }

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
  googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  const rememberGoogleCredential = result => {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) return;
    sessionStorage.setItem(DRIVE_ACCESS_TOKEN_KEY, credential.accessToken);
    // El token OAuth de Google suele durar alrededor de una hora.
    // Lo tratamos como vencido un poco antes para evitar subidas a mitad de expiración.
    sessionStorage.setItem(DRIVE_ACCESS_TOKEN_EXP_KEY, String(Date.now() + 50 * 60 * 1000));
  };

  const clearGoogleCredential = () => {
    sessionStorage.removeItem(DRIVE_ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(DRIVE_ACCESS_TOKEN_EXP_KEY);
  };

  const facebookProvider = new FacebookAuthProvider();
  facebookProvider.addScope('email');

  let loginInProgress = false;
  let connectedUser = null;
  let guestMode = false;
  let waitingForChoice = true;

  const finishResumeVisual = () => document.documentElement.classList.remove('resume-app');
  const setButtons = disabled => {
    if (googleBtn) googleBtn.disabled = disabled;
    if (guestBtn) guestBtn.disabled = disabled;
    if (facebookBtn) facebookBtn.disabled = disabled;
  };

  const getUserPhoto = user => {
    const providers = Array.isArray(user?.providerData) ? user.providerData : [];
    const facebookData = providers.find(p => p?.providerId === 'facebook.com');
    if (facebookData?.photoURL) return facebookData.photoURL;
    if (user?.photoURL) return user.photoURL;
    if (facebookData?.uid) return `https://graph.facebook.com/${encodeURIComponent(facebookData.uid)}/picture?type=large`;
    return '';
  };

  const setProfileImage = (img, user, sizeLabel) => {
    if (!img) return;
    const photo = getUserPhoto(user);
    if (photo) {
      img.hidden = false;
      img.alt = user.displayName ? `Foto de ${user.displayName}` : `Foto de perfil ${sizeLabel || ''}`;
      img.onerror = () => { img.onerror = null; img.hidden = true; };
      img.src = photo;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
  };

  const showConnected = user => {
    finishResumeVisual();
    waitingForChoice = false;
    guestMode = false;
    localStorage.removeItem(LOCAL_ACCESS_KEY);
    loginInProgress = false;
    connectedUser = user;
    sessionStorage.removeItem('facebookRedirectPending');
    setButtons(false);
    gate.style.display = 'none';
    app.style.display = 'none';
    connectedGate.style.display = 'grid';
    connectedName.textContent = user.displayName || user.email || 'Usuario';
    setProfileImage(connectedPic, user, 'grande');
  };

  const showMainSite = user => {
    finishResumeVisual();
    waitingForChoice = false;
    guestMode = false;
    localStorage.removeItem(LOCAL_ACCESS_KEY);
    sessionStorage.setItem(SESSION_ACCESS_KEY, 'google');
    sessionStorage.removeItem(RESUME_MAIN_KEY);
    loginInProgress = false;
    connectedUser = user;
    sessionStorage.removeItem('facebookRedirectPending');
    setButtons(false);
    gate.style.display = 'none';
    connectedGate.style.display = 'none';
    app.style.display = 'block';
    userBox.hidden = false;
    if (status) status.textContent = '';
    userName.textContent = 'Conectado como ' + (user.displayName || user.email || 'Usuario');
    setProfileImage(userPic, user, 'pequeña');
  };

  const showGuestSite = () => {
    finishResumeVisual();
    waitingForChoice = false;
    guestMode = true;
    connectedUser = null;
    localStorage.setItem(LOCAL_ACCESS_KEY, ACCESS_GUEST);
    sessionStorage.setItem(SESSION_ACCESS_KEY, 'guest');
    sessionStorage.removeItem(RESUME_MAIN_KEY);
    sessionStorage.removeItem('facebookRedirectPending');
    gate.style.display = 'none';
    connectedGate.style.display = 'none';
    app.style.display = 'block';
    userBox.hidden = false;
    if (status) status.textContent = '';
    if (userPic) {
      userPic.removeAttribute('src');
      userPic.hidden = true;
    }
    userName.textContent = 'Invitado';
  };

  const showLogin = message => {
    finishResumeVisual();
    waitingForChoice = true;
    loginInProgress = false;
    connectedUser = null;
    guestMode = false;
    localStorage.removeItem(LOCAL_ACCESS_KEY);
    sessionStorage.removeItem(SESSION_ACCESS_KEY);
    sessionStorage.removeItem(RESUME_MAIN_KEY);
    gate.style.display = 'grid';
    connectedGate.style.display = 'none';
    app.style.display = 'none';
    userBox.hidden = true;
    setButtons(false);
    status.textContent = message || '';
  };

  const leaveGuestMode = () => showLogin();

  const showError = err => {
    console.error('AUTH ERROR', err);
    sessionStorage.removeItem('facebookRedirectPending');
    const code = err?.code || 'sin-codigo';
    const message = err?.message || '';
    if (code === 'auth/account-exists-with-different-credential') showLogin('Ese correo ya está registrado con otro método de acceso. (' + code + ')');
    else if (code === 'auth/operation-not-allowed') showLogin('Facebook no está habilitado correctamente en Firebase. (' + code + ')');
    else if (code === 'auth/unauthorized-domain') showLogin('Este dominio no está autorizado en Firebase Authentication. (' + code + ')');
    else if (code === 'auth/network-request-failed') showLogin('Falló la conexión con Firebase. (' + code + ')');
    else showLogin('ERROR: ' + code + (message ? ' — ' + message : ''));
  };

  const returningFromFacebook = sessionStorage.getItem('facebookRedirectPending') === '1';
  const returningFromManagement = sessionStorage.getItem(RESUME_MAIN_KEY) === '1';
  const rememberedAuthenticatedSession = sessionStorage.getItem(SESSION_ACCESS_KEY) === 'google';
  if (status) status.textContent = returningFromFacebook ? 'Completando acceso…' : '';
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

  if ((returningFromManagement || rememberedAuthenticatedSession) && auth.currentUser) {
    showMainSite(auth.currentUser);
    return;
  }
  if (returningFromManagement && !auth.currentUser) sessionStorage.removeItem(RESUME_MAIN_KEY);

  if (returningFromFacebook) {
    sessionStorage.removeItem('facebookRedirectPending');
    showLogin('No se pudo confirmar la sesión.');
  } else {
    showLogin();
  }

  const loginGoogle = async () => {
    if (loginInProgress) return;
    waitingForChoice = false;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Google…';
    try {
      const result = await signInWithPopup(auth, googleProvider);
      rememberGoogleCredential(result);
      if (result?.user) showConnected(result.user);
    } catch (e) { showError(e); }
  };

  const loginFacebook = async () => {
    if (loginInProgress) return;
    waitingForChoice = false;
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
  if (guestBtn) guestBtn.onclick = showGuestSite;
  if (facebookBtn) facebookBtn.onclick = loginFacebook;
  if (enterBtn) enterBtn.onclick = () => {
    const user = connectedUser || auth.currentUser;
    if (user) showMainSite(user);
    else showLogin();
  };
  if (connectedLogoutBtn) connectedLogoutBtn.onclick = async () => {
    sessionStorage.removeItem(RESUME_MAIN_KEY);
    clearGoogleCredential();
    await signOut(auth);
    showLogin();
  };
  if (logoutBtn) logoutBtn.onclick = async () => {
    sessionStorage.removeItem(RESUME_MAIN_KEY);
    if (guestMode) {
      leaveGuestMode();
      return;
    }
    clearGoogleCredential();
    await signOut(auth);
    showLogin();
  };

  onAuthStateChanged(auth, user => {
    if (waitingForChoice || guestMode) return;
    if (!user) {
      if (!loginInProgress && sessionStorage.getItem('facebookRedirectPending') !== '1') showLogin();
      return;
    }
    if (app.style.display === 'block' || connectedGate.style.display === 'grid') return;
    showConnected(user);
  });
}

initAmericaAuth().catch(e => {
  document.documentElement.classList.remove('resume-app');
  console.error('Error inicializando Firebase Auth', e);
  const status = document.getElementById('authStatus');
  if (status) status.textContent = 'No se pudo iniciar Firebase Authentication: ' + (e?.message || e);
});
