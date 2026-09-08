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
    getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect,
    getRedirectResult, setPersistence, browserLocalPersistence,
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

  const pageParams = new URLSearchParams(window.location.search);
  const facebookAuthTab = pageParams.get('facebookAuthTab') === '1';

  let loginInProgress = false;

  const setButtons = disabled => {
    if (googleBtn) googleBtn.disabled = disabled;
    if (facebookBtn) facebookBtn.disabled = disabled;
  };

  const clearFacebookTabParam = () => {
    if (!facebookAuthTab) return;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('facebookAuthTab');
    history.replaceState({}, '', cleanUrl.toString());
  };

  const showError = err => {
    console.error('AUTH ERROR', err);
    const code = err?.code || 'sin-codigo';
    loginInProgress = false;
    sessionStorage.removeItem('americaAuthRedirect');
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
      status.textContent = 'Falló la conexión con Firebase. Revisa Internet e inténtalo nuevamente.';
    } else if (code === 'auth/popup-blocked') {
      status.textContent = 'El navegador bloqueó la pestaña de acceso.';
    } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      status.textContent = 'La ventana de acceso se cerró antes de completar el inicio de sesión.';
    } else {
      status.textContent = 'Error de acceso: ' + code;
    }
  };

  if (sessionStorage.getItem('americaAuthRedirect')) {
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Completando inicio de sesión…';
  }

  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      sessionStorage.removeItem('americaAuthRedirect');
      loginInProgress = false;
      clearFacebookTabParam();
      status.textContent = 'Acceso correcto.';
    } else if (sessionStorage.getItem('americaAuthRedirect')) {
      sessionStorage.removeItem('americaAuthRedirect');
      loginInProgress = false;
      setButtons(false);
      clearFacebookTabParam();
      status.textContent = 'Facebook no completó el acceso. Inténtalo nuevamente.';
    }
  } catch (e) {
    showError(e);
  }

  // A tab opened specifically for Facebook starts the redirect inside that tab.
  // This keeps the original AmericaEsTuya page open so screenshots can be taken easily.
  if (facebookAuthTab && !sessionStorage.getItem('americaAuthRedirect') && !auth.currentUser) {
    loginInProgress = true;
    setButtons(true);
    sessionStorage.setItem('americaAuthRedirect', 'facebook');
    status.textContent = 'Abriendo Facebook en esta pestaña…';
    try {
      await signInWithRedirect(auth, facebookProvider);
      return;
    } catch (e) {
      showError(e);
      return;
    }
  }

  const loginGoogle = async () => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Google…';

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      showError(e);
    } finally {
      loginInProgress = false;
      setButtons(false);
    }
  };

  const loginFacebook = () => {
    if (loginInProgress) return;

    const facebookUrl = new URL(window.location.href);
    facebookUrl.searchParams.set('facebookAuthTab', '1');

    const newTab = window.open(facebookUrl.toString(), '_blank');
    if (!newTab) {
      status.textContent = 'El navegador bloqueó la pestaña nueva. Permite ventanas emergentes para este sitio.';
      return;
    }

    status.textContent = 'Facebook se abrió en una pestaña nueva.';
  };

  googleBtn.onclick = loginGoogle;
  facebookBtn.onclick = loginFacebook;
  logoutBtn.onclick = () => signOut(auth);

  onAuthStateChanged(auth, user => {
    if (user) {
      sessionStorage.removeItem('americaAuthRedirect');
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
  if (status) status.textContent = 'No se pudo iniciar Firebase Authentication.';
});
