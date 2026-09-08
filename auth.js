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
    getRedirectResult,
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
  facebookProvider.setCustomParameters({ display: 'touch' });

  let loginInProgress = false;

  const setButtons = disabled => {
    if (googleBtn) googleBtn.disabled = disabled;
    if (facebookBtn) facebookBtn.disabled = disabled;
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
    } else if (code === 'auth/configuration-not-found') {
      status.textContent = 'Firebase Authentication todavía no está configurado. (' + code + ')';
    } else if (code === 'auth/network-request-failed') {
      status.textContent = 'Falló la conexión con Firebase. (' + code + ')';
    } else if (code === 'auth/popup-closed-by-user') {
      status.textContent = 'Se cerró Facebook antes de terminar el acceso.';
    } else if (code === 'auth/popup-blocked') {
      status.textContent = 'Chrome bloqueó la ventana de Facebook. Permite ventanas emergentes para este sitio.';
    } else if (code === 'auth/cancelled-popup-request') {
      status.textContent = 'Ya hay un acceso en curso. Inténtalo otra vez.';
    } else {
      status.textContent = 'ERROR FACEBOOK: ' + code + (message ? ' — ' + message : '');
    }
  };

  // Conservamos esto solo para completar cualquier redirect antiguo pendiente.
  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      status.textContent = 'Acceso correcto.';
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
      await signInWithPopup(auth, googleProvider);
      status.textContent = 'Acceso correcto.';
    } catch (e) {
      showError(e);
    } finally {
      loginInProgress = false;
      setButtons(false);
    }
  };

  const loginFacebook = async () => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Facebook…';

    try {
      // En GitHub Pages evitamos signInWithRedirect porque el dominio de
      // autenticación de Firebase es distinto y algunos navegadores móviles
      // no completan correctamente el retorno. Popup mantiene la página
      // original abierta y Firebase devuelve aquí el resultado.
      const result = await signInWithPopup(auth, facebookProvider);
      if (result?.user) status.textContent = 'Acceso con Facebook correcto.';
    } catch (e) {
      showError(e);
    } finally {
      loginInProgress = false;
      setButtons(false);
    }
  };

  if (googleBtn) googleBtn.onclick = loginGoogle;
  if (facebookBtn) facebookBtn.onclick = loginFacebook;
  if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

  onAuthStateChanged(auth, user => {
    if (user) {
      loginInProgress = false;
      setButtons(false);
      gate.style.display = 'none';
      app.style.display = 'block';
      userBox.hidden = false;
      userName.textContent = user.displayName || user.email || 'Usuario';

      if (user.photoURL) {
        userPic.src = user.photoURL;
        userPic.hidden = false;
      } else {
        userPic.hidden = true;
      }
    } else {
      gate.style.display = 'grid';
      app.style.display = 'none';
      userBox.hidden = true;
      if (!loginInProgress) {
        setButtons(false);
        if (!status.textContent || status.textContent === 'Comprobando acceso…') {
          status.textContent = 'Inicia sesión para entrar a América es Tuya.';
        }
      }
    }
  });
}

initAmericaAuth().catch(e => {
  console.error('Error inicializando Firebase Auth', e);
  const status = document.getElementById('authStatus');
  if (status) status.textContent = 'No se pudo iniciar Firebase Authentication: ' + (e?.message || e);
});
