// AmericaEsTuya authentication
// Fill FIREBASE_CONFIG with the values from your Firebase web app.
// The apiKey and other Firebase web config values are public identifiers;
// never place a Facebook App Secret in this file.

const FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.firebasestorage.app",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

const AUTH_READY = !Object.values(FIREBASE_CONFIG).some(v => String(v).includes('REPLACE_ME'));

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

  if (!AUTH_READY) {
    gate.style.display = 'grid';
    app.style.display = 'none';
    status.textContent = 'Falta conectar Firebase para activar Google y Facebook.';
    googleBtn.disabled = true;
    facebookBtn.disabled = true;
    return;
  }

  const [{ initializeApp }, {
    getAuth, onAuthStateChanged, signInWithPopup, signOut,
    GoogleAuthProvider, FacebookAuthProvider
  }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);

  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(firebaseApp);
  const googleProvider = new GoogleAuthProvider();
  const facebookProvider = new FacebookAuthProvider();

  const showError = (err) => {
    console.error(err);
    status.textContent = err?.code === 'auth/account-exists-with-different-credential'
      ? 'Ese correo ya está registrado con otro método de acceso.'
      : 'No se pudo iniciar sesión. Inténtalo nuevamente.';
  };

  googleBtn.onclick = async () => {
    status.textContent = 'Abriendo Google…';
    try { await signInWithPopup(auth, googleProvider); } catch (e) { showError(e); }
  };

  facebookBtn.onclick = async () => {
    status.textContent = 'Abriendo Facebook…';
    try { await signInWithPopup(auth, facebookProvider); } catch (e) { showError(e); }
  };

  logoutBtn.onclick = () => signOut(auth);

  onAuthStateChanged(auth, (user) => {
    if (user) {
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
      status.textContent = 'Inicia sesión para entrar a América es Tuya.';
    }
  });
}

initAmericaAuth();
