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

  document.open();
  document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso denegado · América es Tuya</title><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,sans-serif;background:#f4f9fd;color:#123b63}body{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#062f57,#0b74b8 55%,#12a6cf)}.card{width:min(460px,100%);background:#fff;border-radius:24px;padding:32px;text-align:center;box-shadow:0 24px 70px #001f3f66}.icon{font-size:46px;margin-bottom:10px}.card h1{margin:0 0 10px;font-size:30px}.card p{color:#63798d;line-height:1.5;margin:0 0 22px}.card a{display:inline-block;text-decoration:none;background:#0b74b8;color:#fff;border-radius:12px;padding:12px 18px;font-weight:700}</style></head><body><main class="card"><div class="icon">🔒</div><h1>Acceso denegado</h1><p>${message}</p><a href="../">Volver a América es Tuya</a></main></body></html>`);
  document.close();
})();
