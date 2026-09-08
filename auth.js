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

const FB_REDIRECT_KEY = 'americaestuya_fb_redirect_pending';
const FB_RELOAD_KEY = 'americaestuya_fb_return_reloaded';

// Algunos Chrome móviles restauran la página anterior desde BFCache al volver
// de Facebook. En ese caso el JavaScript no se reinicia y queda visible
// "Abriendo Facebook…". Forzamos UNA recarga limpia para que Firebase pueda
// leer el resultado del redirect.
window.addEventListener('pageshow', (event) => {
  if (event.persisted && sessionStorage.getItem(FB_REDIRECT_KEY) === '1') {
    if (sessionStorage.getItem(FB_RELOAD_KEY) !== '1') {
      sessionStorage.setItem(FB_RELOAD_KEY, '1');
      window.location.reload();
    }
  }
});

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
  const returningFromFacebook = sessionStorage.getItem(FB_REDIRECT_KEY) === '1';

  const setButtons = disabled => {
    if (googleBtn) googleBtn.disabled = disabled;
    if (facebookBtn) facebookBtn.disabled = disabled;
  };

  const showMainSite = user => {
    loginInProgress = false;
    sessionStorage.removeItem(FB_REDIRECT_KEY);
    sessionStorage.removeItem(FB_RELOAD_KEY);
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
    sessionStorage.removeItem(FB_REDIRECT_KEY);
    sessionStorage.removeItem(FB_RELOAD_KEY);
    setButtons(false);

    if (code === 'auth/account-exists-with-different-credential') {
      status.textContent = 'Ese correo ya está registrado con otro método de acceso. (' + code + ')';
    } else if (code === 'auth/operation-not-allowed') {
      status.textContent = 'Facebook no está habilitado correctamente en Firebase. (' + code + ')';
    } else if (code === 'auth/unauthorized-domain') {
      status.textContent = 'Falta autorizar iderguzl.github.io en Firebase. (' + code + ')';
    } else if (code === 'auth/configuration-not-found') {
      status.textContent = 'Firebase Authentication todavía no está configurado. (' + code + ')';
    } else if (code === 'auth/network-request-failed') {
      status.textContent = 'Falló la conexión con Firebase. (' + code + ')';
    } else {
      status.textContent = 'ERROR FACEBOOK: ' + code + (message ? ' — ' + message : '');
    }
  };

  // Al regresar de Facebook procesamos el resultado ANTES de dejar al usuario
  // otra vez en la pantalla de acceso.
  if (returningFromFacebook) {
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Completando acceso con Facebook…';
  }

  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      showMainSite(redirectResult.user);
      return;
    }
  } catch (e) {
    showError(e);
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

  const loginFacebook = async () => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Facebook…';
    sessionStorage.setItem(FB_REDIRECT_KEY, '1');
    sessionStorage.removeItem(FB_RELOAD_KEY);

    try {
      // Misma pestaña: América es Tuya -> Facebook -> América es Tuya.
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
    } else {
      gate.style.display = 'grid';
      app.style.display = 'none';
      userBox.hidden = true;

      // Si acabamos de volver de Facebook, damos un momento a Firebase para
      // publicar el estado autenticado antes de reactivar los botones.
      if (returningFromFacebook) {
        setTimeout(() => {
          if (auth.currentUser) {
            showMainSite(auth.currentUser);
            return;
          }
          loginInProgress = false;
          setButtons(false);
          sessionStorage.removeItem(FB_REDIRECT_KEY);
          sessionStorage.removeItem(FB_RELOAD_KEY);
          status.textContent = 'Facebook regresó, pero Firebase no recibió la sesión. Intenta nuevamente.';
        }, 2500);
      } else if (!loginInProgress) {
        setButtons(false);
        status.textContent = 'Inicia sesión para entrar a América es Tuya.';
      }
    }
  });
}

initAmericaAuth().catch(e => {
  console.error('Error inicializando Firebase Auth', e);
  sessionStorage.removeItem(FB_REDIRECT_KEY);
  sessionStorage.removeItem(FB_RELOAD_KEY);
  const status = document.getElementById('authStatus');
  if (status) status.textContent = 'No se pudo iniciar Firebase Authentication: ' + (e?.message || e);
});
