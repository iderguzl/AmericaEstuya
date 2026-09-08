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
    signOut, GoogleAuthProvider, FacebookAuthProvider
  }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);

  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(firebaseApp);

  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  const facebookProvider = new FacebookAuthProvider();
  facebookProvider.addScope('email');

  let loginInProgress = false;

  const setButtons = disabled => {
    if (googleBtn) googleBtn.disabled = disabled;
    if (facebookBtn) facebookBtn.disabled = disabled;
  };

  const showError = err => {
    console.error('AUTH ERROR', err);
    const code = err?.code || 'sin-codigo';
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
      status.textContent = 'Falló la conexión con Firebase. Revisa Internet e inténtalo nuevamente.';
    } else if (code === 'auth/popup-blocked') {
      status.textContent = 'El navegador bloqueó la ventana de Facebook. Permite ventanas emergentes e inténtalo otra vez.';
    } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      status.textContent = 'La ventana de Facebook se cerró antes de completar el inicio de sesión.';
    } else {
      status.textContent = 'Error de acceso: ' + code;
    }
  };

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
    status.textContent = 'Abriendo Facebook…';

    try {
      // Use popup instead of redirect. On GitHub Pages, Firebase redirect can
      // return to the site without completing automatically on some mobile browsers.
      await signInWithPopup(auth, facebookProvider);
    } catch (e) {
      showError(e);
    } finally {
      loginInProgress = false;
      setButtons(false);
    }
  };

  googleBtn.onclick = loginGoogle;
  facebookBtn.onclick = loginFacebook;
  logoutBtn.onclick = () => signOut(auth);

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
  if (status) status.textContent = 'No se pudo iniciar Firebase Authentication.';
});
