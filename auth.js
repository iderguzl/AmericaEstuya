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

  let loginInProgress = false;

  const setButtons = disabled => {
    if (googleBtn) googleBtn.disabled = disabled;
    if (facebookBtn) facebookBtn.disabled = disabled;
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
      status.textContent = 'El navegador bloqueó la ventana de acceso.';
    } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      status.textContent = 'La ventana de acceso se cerró antes de completar el inicio de sesión.';
    } else {
      status.textContent = 'Error de acceso: ' + code;
    }
  };

  // IMPORTANT: process a redirect immediately when the page comes back from Firebase.
  // This was the missing part that left Android showing “Abriendo Facebook…” until refresh.
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
      status.textContent = 'Acceso correcto.';
    } else if (sessionStorage.getItem('americaAuthRedirect')) {
      // We returned from the redirect but Firebase did not produce a user.
      sessionStorage.removeItem('americaAuthRedirect');
      loginInProgress = false;
      setButtons(false);
      status.textContent = 'Facebook no completó el acceso. Inténtalo nuevamente.';
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

    try {
      // On Android/mobile, do NOT open a Firebase popup/custom-tab.
      // Redirect the whole page and consume the result above when it comes back.
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      if (isMobile) {
        sessionStorage.setItem('americaAuthRedirect', 'facebook');
        status.textContent = 'Entrando a Facebook…';
        await signInWithRedirect(auth, facebookProvider);
        return;
      }

      status.textContent = 'Abriendo Facebook…';
      await signInWithPopup(auth, facebookProvider);
    } catch (e) {
      showError(e);
    } finally {
      // Redirect navigates away, so this only matters for popup/error cases.
      if (!sessionStorage.getItem('americaAuthRedirect')) {
        loginInProgress = false;
        setButtons(false);
      }
    }
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
