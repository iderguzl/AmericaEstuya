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

// Facebook App ID is public. Never put the App Secret in this file.
const FACEBOOK_APP_ID = "1605723354284010";
const FACEBOOK_RETURN_URL = "https://iderguzl.github.io/AmericaEstuya/";
const FB_STATE_KEY = "americaestuya_fb_oauth_state";

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
    getAuth, onAuthStateChanged, signInWithPopup, signInWithCredential,
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

  let loginInProgress = false;

  const setButtons = disabled => {
    if (googleBtn) googleBtn.disabled = disabled;
    if (facebookBtn) facebookBtn.disabled = disabled;
  };

  const showMainSite = user => {
    loginInProgress = false;
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

  const showError = err => {
    console.error('AUTH ERROR', err);
    const code = err?.code || 'sin-codigo';
    const message = err?.message || '';
    loginInProgress = false;
    setButtons(false);

    if (code === 'auth/account-exists-with-different-credential') {
      status.textContent = 'Ese correo ya está registrado con otro método de acceso. (' + code + ')';
    } else if (code === 'auth/operation-not-allowed') {
      status.textContent = 'Facebook no está habilitado correctamente en Firebase. (' + code + ')';
    } else if (code === 'auth/unauthorized-domain') {
      status.textContent = 'Falta autorizar iderguzl.github.io en Firebase. (' + code + ')';
    } else if (code === 'auth/network-request-failed') {
      status.textContent = 'Falló la conexión con Firebase. (' + code + ')';
    } else {
      status.textContent = 'ERROR FACEBOOK: ' + code + (message ? ' — ' + message : '');
    }
  };

  // Facebook vuelve a ESTA MISMA página con el access token en el fragmento.
  // Lo convertimos directamente en una credencial Firebase, evitando el
  // almacenamiento cross-site del helper /__/auth/handler.
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const fbAccessToken = hashParams.get('access_token');
  const returnedState = hashParams.get('state');
  const fbError = hashParams.get('error_description') || hashParams.get('error');

  if (fbError) {
    history.replaceState({}, document.title, FACEBOOK_RETURN_URL);
    status.textContent = 'Facebook no completó el acceso: ' + fbError;
  } else if (fbAccessToken) {
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Completando acceso con Facebook…';

    const expectedState = sessionStorage.getItem(FB_STATE_KEY);
    sessionStorage.removeItem(FB_STATE_KEY);

    if (!expectedState || returnedState !== expectedState) {
      history.replaceState({}, document.title, FACEBOOK_RETURN_URL);
      loginInProgress = false;
      setButtons(false);
      status.textContent = 'No se pudo validar el regreso de Facebook. Intenta nuevamente.';
    } else {
      try {
        const credential = FacebookAuthProvider.credential(fbAccessToken);
        const result = await signInWithCredential(auth, credential);
        history.replaceState({}, document.title, FACEBOOK_RETURN_URL);
        if (result?.user) {
          showMainSite(result.user);
          return;
        }
      } catch (e) {
        history.replaceState({}, document.title, FACEBOOK_RETURN_URL);
        showError(e);
      }
    }
  }

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
    } finally {
      if (!auth.currentUser) {
        loginInProgress = false;
        setButtons(false);
      }
    }
  };

  const loginFacebook = () => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Facebook…';

    const stateBytes = new Uint32Array(4);
    crypto.getRandomValues(stateBytes);
    const state = Array.from(stateBytes, n => n.toString(16).padStart(8, '0')).join('');
    sessionStorage.setItem(FB_STATE_KEY, state);

    const oauth = new URL('https://www.facebook.com/v23.0/dialog/oauth');
    oauth.searchParams.set('client_id', FACEBOOK_APP_ID);
    oauth.searchParams.set('redirect_uri', FACEBOOK_RETURN_URL);
    oauth.searchParams.set('response_type', 'token');
    oauth.searchParams.set('scope', 'email,public_profile');
    oauth.searchParams.set('state', state);

    // Todo en la misma pestaña: América es Tuya -> Facebook -> América es Tuya.
    window.location.assign(oauth.toString());
  };

  if (googleBtn) googleBtn.onclick = loginGoogle;
  if (facebookBtn) facebookBtn.onclick = loginFacebook;
  if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

  onAuthStateChanged(auth, user => {
    if (user) {
      showMainSite(user);
    } else if (!loginInProgress) {
      gate.style.display = 'grid';
      app.style.display = 'none';
      userBox.hidden = true;
      setButtons(false);
      if (!status.textContent || status.textContent === 'Comprobando acceso…') {
        status.textContent = 'Inicia sesión para entrar a América es Tuya.';
      }
    }
  });
}

initAmericaAuth().catch(e => {
  console.error('Error inicializando Firebase Auth', e);
  const status = document.getElementById('authStatus');
  if (status) status.textContent = 'No se pudo iniciar Firebase Authentication: ' + (e?.message || e);
});
