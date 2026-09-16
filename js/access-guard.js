// Guardia común para páginas internas de América es Tuya.
// Uso normal: permite Google o Invitado.
// Para Gestión: <script src="../js/access-guard.js" data-access="authenticated"></script>
(function () {
  const ACCESS_KEY = 'americaestuya_session_access';
  const RESUME_MAIN_KEY = 'americaestuya_resume_main';
  const access = sessionStorage.getItem(ACCESS_KEY);
  const required = document.currentScript?.dataset?.access || 'any';

  const allowed = required === 'authenticated'
    ? access === 'google'
    : access === 'google' || access === 'guest';

  if (allowed) {
    if (required === 'authenticated') {
      window.addEventListener('DOMContentLoaded', () => {
        const backButton = document.querySelector('.back');
        if (backButton) {
          backButton.onclick = () => {
            sessionStorage.setItem(RESUME_MAIN_KEY, '1');
            window.location.replace('../index.html?resume=management');
          };
        }
        if (!document.querySelector('script[data-management-config]')) {
          const script = document.createElement('script');
          script.type = 'module';
          script.src = '../js/management-config.js?v=20260913-3';
          script.dataset.managementConfig = '1';
          document.body.appendChild(script);
        }
      });
    }
    return;
  }

  const guestBlocked = required === 'authenticated' && access === 'guest';
  const message = guestBlocked
    ? 'La sección Gestión requiere iniciar sesión con una cuenta. El acceso como invitado solo permite Inicio, Utilidades y Sobre el Proyecto.'
    : 'Debes entrar primero a América es Tuya con Google o como invitado.';

  // Pantalla de bloqueo completamente independiente de la página protegida.
  // Aunque el navegador continúe procesando el HTML original, este panel fijo
  // cubre todo el viewport y evita que se vea o se solape contenido de atrás.
  const deniedHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso denegado · América es Tuya</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;min-height:100%;font-family:Arial,sans-serif;overflow:hidden;background:#0b74b8;color:#123b63}#accessDeniedScreen{position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;height:100dvh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#062f57,#0b74b8 55%,#12a6cf)}#accessDeniedScreen .card{width:min(460px,100%);background:#fff;border-radius:24px;padding:32px;text-align:center;box-shadow:0 24px 70px #001f3f66}#accessDeniedScreen .icon{font-size:46px;margin-bottom:10px}#accessDeniedScreen h1{margin:0 0 10px;font-size:30px}#accessDeniedScreen p{color:#63798d;line-height:1.5;margin:0 0 22px}#accessDeniedScreen a{display:inline-block;text-decoration:none;background:#0b74b8;color:#fff;border-radius:12px;padding:12px 18px;font-weight:700}</style></head><body><main id="accessDeniedScreen"><section class="card"><div class="icon">🔒</div><h1>Acceso denegado</h1><p>${message}</p><a href="../">Volver a América es Tuya</a></section></main></body></html>`;

  document.open();
  document.write(deniedHtml);
  document.close();

  // Refuerzo por si algún navegador móvil intenta continuar mostrando
  // elementos de la página protegida después de document.write().
  const keepDeniedClean = () => {
    const screen = document.getElementById('accessDeniedScreen');
    if (!screen) return;
    screen.style.position = 'fixed';
    screen.style.inset = '0';
    screen.style.zIndex = '2147483647';
    document.documentElement.style.overflow = 'hidden';
    if (document.body) document.body.style.overflow = 'hidden';
  };
  keepDeniedClean();
  window.addEventListener('DOMContentLoaded', keepDeniedClean, { once: true });
})();
