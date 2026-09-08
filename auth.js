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
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  const facebookProvider = new FacebookAuthProvider();
  facebookProvider.addScope('email');

  let loginInProgress = sessionStorage.getItem('facebookRedirectPending') === '1';
  const setButtons = disabled => { googleBtn.disabled = disabled; facebookBtn.disabled = disabled; };

  const showError = err => {
    console.error('AUTH ERROR', err);
    const code = err?.code || 'sin-codigo';
    sessionStorage.removeItem('facebookRedirectPending');
    loginInProgress = false;
    setButtons(false);
    if (code === 'auth/account-exists-with-different-credential') status.textContent = 'Ese correo ya está registrado con otro método de acceso. (' + code + ')';
    else if (code === 'auth/operation-not-allowed') status.textContent = 'Facebook no está habilitado correctamente en Firebase. (' + code + ')';
    else if (code === 'auth/unauthorized-domain') status.textContent = 'Falta autorizar iderguzl.github.io en Firebase. (' + code + ')';
    else if (code === 'auth/configuration-not-found') status.textContent = 'Firebase Authentication todavía no está configurado. (' + code + ')';
    else if (code === 'auth/network-request-failed') status.textContent = 'Falló la conexión con Firebase. Revisa Internet e inténtalo nuevamente.';
    else status.textContent = 'Error de acceso: ' + code;
  };

  const loginGoogle = async () => {
    if (loginInProgress) return;
    loginInProgress = true; setButtons(true); status.textContent = 'Abriendo Google…';
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { showError(e); }
    finally { loginInProgress = false; setButtons(false); }
  };

  const loginFacebook = async () => {
    if (loginInProgress) return;
    loginInProgress = true;
    sessionStorage.setItem('facebookRedirectPending', '1');
    setButtons(true);
    status.textContent = 'Abriendo Facebook en esta página…';
    try { await signInWithRedirect(auth, facebookProvider); }
    catch (e) { showError(e); }
  };

  googleBtn.onclick = loginGoogle;
  facebookBtn.onclick = loginFacebook;
  logoutBtn.onclick = () => signOut(auth);

  if (loginInProgress) { setButtons(true); status.textContent = 'Completando inicio con Facebook…'; }
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      sessionStorage.removeItem('facebookRedirectPending');
      loginInProgress = false;
    }
  } catch (e) { showError(e); }

  onAuthStateChanged(auth, user => {
    if (user) {
      sessionStorage.removeItem('facebookRedirectPending');
      loginInProgress = false;
      gate.style.display = 'none'; app.style.display = 'block'; userBox.hidden = false;
      userName.textContent = user.displayName || user.email || 'Usuario';
      if (user.photoURL) { userPic.src = user.photoURL; userPic.hidden = false; } else userPic.hidden = true;
    } else {
      gate.style.display = 'grid'; app.style.display = 'none'; userBox.hidden = true;
      if (!loginInProgress) { setButtons(false); status.textContent = 'Inicia sesión para entrar a América es Tuya.'; }
    }
  });
}

initAmericaAuth().catch(e => {
  console.error('Error inicializando Firebase Auth', e);
  const status = document.getElementById('authStatus');
  if (status) status.textContent = 'No se pudo iniciar Firebase Authentication.';
});
