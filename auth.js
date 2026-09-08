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
    getRedirectResult, signOut, GoogleAuthProvider, FacebookAuthProvider
  }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);

  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(firebaseApp);
  const googleProvider = new GoogleAuthProvider();
  const facebookProvider = new FacebookAuthProvider();
  facebookProvider.addScope('email');

  let loginInProgress = false;

  const setButtons = (disabled) => {
    googleBtn.disabled = disabled;
    facebookBtn.disabled = disabled;
  };

  const showError = (err) => {
    console.error(err);
    const code = err?.code || 'sin-codigo';
    if (code === 'auth/account-exists-with-different-credential') {
      status.textContent = 'Ese correo ya está registrado con otro método de acceso. (' + code + ')';
    } else if (code === 'auth/operation-not-allowed') {
      status.textContent = 'Falta habilitar este proveedor en Firebase. (' + code + ')';
    } else if (code === 'auth/unauthorized-domain') {
      status.textContent = 'Falta autorizar iderguzl.github.io en Firebase. (' + code + ')';
    } else if (code === 'auth/configuration-not-found') {
      status.textContent = 'Firebase Authentication todavía no está configurado. (' + code + ')';
    } else if (code === 'auth/popup-blocked') {
      status.textContent = 'Chrome bloqueó la ventana de acceso. Permite ventanas emergentes para este sitio e inténtalo otra vez.';
    } else if (code === 'auth/popup-closed-by-user') {
      status.textContent = 'La ventana de acceso se cerró antes de completar el inicio.';
    } else if (code === 'auth/cancelled-popup-request') {
      status.textContent = 'Había otro inicio de sesión pendiente. Espera un momento y toca el botón una sola vez.';
    } else if (code === 'auth/network-request-failed') {
      status.textContent = 'Falló la conexión con Firebase. Revisa Internet e inténtalo nuevamente.';
    } else {
      status.textContent = 'Error de acceso: ' + code;
    }
  };

  const loginWithPopup = async (provider, name) => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo ' + name + '…';
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      showError(e);
    } finally {
      loginInProgress = false;
      setButtons(false);
    }
  };

  const loginFacebookWithRedirect = async () => {
    if (loginInProgress) return;
    loginInProgress = true;
    setButtons(true);
    status.textContent = 'Abriendo Facebook…';
    try {
      await signInWithRedirect(auth, facebookProvider);
    } catch (e) {
      loginInProgress = false;
      setButtons(false);
      showError(e);
    }
  };

  googleBtn.onclick = () => loginWithPopup(googleProvider, 'Google');
  facebookBtn.onclick = () => loginFacebookWithRedirect();
  logoutBtn.onclick = () => signOut(auth);

  try {
    await getRedirectResult(auth);
  } catch (e) {
    loginInProgress = false;
    setButtons(false);
    showError(e);
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginInProgress = false;
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
        if (!status.textContent.includes('Error') && !status.textContent.includes('cerró') && !status.textContent.includes('bloqueó')) {
          status.textContent = 'Inicia sesión para entrar a América es Tuya.';
        }
      }
    }
  });
}

initAmericaAuth();
