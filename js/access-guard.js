// Guardia común para páginas internas de América es Tuya.
// Uso normal: permite Google o Invitado.
// Para Gestión: <script src="../js/access-guard.js" data-access="authenticated"></script>
(function () {
  const ACCESS_KEY = 'americaestuya_session_access';
  const RESUME_MAIN_KEY = 'americaestuya_resume_main';
  const access = sessionStorage.getItem(ACCESS_KEY);
  const required = document.currentScript?.dataset?.access || 'any';

  // Compatibilidad temporal de Gestión con el estado numérico normalizado:
  // 0 = inactivo, 1 = activo, 2 = oculto.
  // Los módulos antiguos todavía trabajan internamente con booleanos; aquí se
  // traduce únicamente en la frontera HTTP. Los registros 2 no se incluyen en
  // consultas generales. Un módulo nuevo puede pedir valores crudos enviando
  // el header X-America-Raw-State: 1.
  if (required === 'authenticated' && !window.__americaNumericStateFetchInstalled) {
    window.__americaNumericStateFetchInstalled = true;
    const nativeFetch = window.fetch.bind(window);
    const API_MARK = '/americaestuya/rest/v1/';
    const STATE_TABLES = new Set([
      'accounts','clients','users','configuration','igldata',
      'account_data','client_data','user_data',
      'iglcustomers','iglcustomerdata','iglusers','igluserdata','igldatavalues'
    ]);

    const headerValue = (headers, name) => {
      try {
        if (headers instanceof Headers) return headers.get(name);
        if (Array.isArray(headers)) {
          const row = headers.find(x => String(x?.[0] || '').toLowerCase() === name.toLowerCase());
          return row?.[1] ?? null;
        }
        if (headers && typeof headers === 'object') {
          const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
          return key ? headers[key] : null;
        }
      } catch (_) {}
      return null;
    };

    const transformBody = body => {
      if (typeof body !== 'string' || !body.trim()) return body;
      try {
        const data = JSON.parse(body);
        const walk = value => {
          if (Array.isArray(value)) return value.map(walk);
          if (!value || typeof value !== 'object') return value;
          const out = {};
          for (const [k, v] of Object.entries(value)) {
            if (k === 'is_active' && typeof v === 'boolean') out[k] = v ? 1 : 0;
            else out[k] = walk(v);
          }
          return out;
        };
        return JSON.stringify(walk(data));
      } catch (_) {
        return body;
      }
    };

    const legacyJson = value => {
      if (Array.isArray(value)) return value.map(legacyJson);
      if (!value || typeof value !== 'object') return value;
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (k === 'is_active' && (v === 0 || v === 1)) out[k] = v === 1;
        else out[k] = legacyJson(v);
      }
      return out;
    };

    window.fetch = async function(input, init = {}) {
      let url = typeof input === 'string' ? input : input?.url;
      const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
      const rawState = String(headerValue(init?.headers, 'X-America-Raw-State') || '').trim() === '1';
      let stateTable = false;

      if (url && url.includes(API_MARK)) {
        try {
          const u = new URL(url, location.href);
          const tail = u.pathname.split(API_MARK)[1] || '';
          const table = tail.split('/')[0].toLowerCase();
          stateTable = STATE_TABLES.has(table);

          if (stateTable && !rawState) {
            // Traduce filtros booleanos heredados al nuevo SMALLINT.
            for (const [key, value] of [...u.searchParams.entries()]) {
              let next = value;
              next = next.replace(/^eq\.true$/i, 'eq.1').replace(/^eq\.false$/i, 'eq.0');
              next = next.replace(/^neq\.true$/i, 'neq.1').replace(/^neq\.false$/i, 'neq.0');
              next = next.replace(/\btrue\b/gi, '1').replace(/\bfalse\b/gi, '0');
              if (next !== value) u.searchParams.set(key, next);
            }

            // Consultas generales no muestran ocultos (estado 2).
            if (method === 'GET' && !u.searchParams.has('is_active') && table !== 'accounts') {
              u.searchParams.append('is_active', 'neq.2');
            }
          }
          url = u.toString();
        } catch (_) {}
      }

      let nextInput = input;
      if (typeof input === 'string') nextInput = url || input;
      else if (url && input instanceof Request) nextInput = new Request(url, input);

      const nextInit = { ...init };
      if (stateTable && !rawState && 'body' in nextInit) nextInit.body = transformBody(nextInit.body);

      const response = await nativeFetch(nextInput, nextInit);
      if (!stateTable || rawState) return response;

      // Mantiene compatibilidad visual mientras cada módulo se convierte a 0/1/2.
      const originalJson = response.json.bind(response);
      response.json = async () => legacyJson(await originalJson());
      return response;
    };
  }

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

  const deniedHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso denegado · América es Tuya</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;min-height:100%;font-family:Arial,sans-serif;overflow:hidden;background:#0b74b8;color:#123b63}#accessDeniedScreen{position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;height:100dvh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#062f57,#0b74b8 55%,#12a6cf)}#accessDeniedScreen .card{width:min(460px,100%);background:#fff;border-radius:24px;padding:32px;text-align:center;box-shadow:0 24px 70px #001f3f66}#accessDeniedScreen .icon{font-size:46px;margin-bottom:10px}#accessDeniedScreen h1{margin:0 0 10px;font-size:30px}#accessDeniedScreen p{color:#63798d;line-height:1.5;margin:0 0 22px}#accessDeniedScreen a{display:inline-block;text-decoration:none;background:#0b74b8;color:#fff;border-radius:12px;padding:12px 18px;font-weight:700}</style></head><body><main id="accessDeniedScreen"><section class="card"><div class="icon">🔒</div><h1>Acceso denegado</h1><p>${message}</p><a href="../">Volver a América es Tuya</a></section></main></body></html>`;

  document.open();
  document.write(deniedHtml);
  document.close();

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
