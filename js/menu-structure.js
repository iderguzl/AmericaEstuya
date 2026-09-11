(function(){
  const frame=document.getElementById('siteFrame');
  if(!frame)return;

  function buildMenu(){
    const d=frame.contentDocument;
    const side=d?.getElementById('side');
    if(!side)return;

    const style=d.createElement('style');
    style.textContent='.menu-group{display:block;width:100%;border:0;background:transparent;color:#dceeff;text-align:left;padding:14px;border-radius:12px;font-size:16px;margin:3px 0}.menu-group:hover,.menu-group.open{background:#1688df;color:#fff}.submenu{display:none;padding-left:10px}.submenu.open{display:block}.submenu .nav{font-size:15px;padding:11px 12px;background:#ffffff0d}[data-auth-only][hidden]{display:none!important}';
    d.head.appendChild(style);

    side.innerHTML=`
      <h3>☰ Menú</h3>
      <button class="nav active" data-v="inicio">⌂ Inicio</button>
      <button class="nav" data-v="gestion" data-auth-only>▣ Gestión</button>
      <button class="menu-group" id="utilitiesToggle" type="button">⚙ Utilidades <span>›</span></button>
      <div class="submenu" id="utilitiesMenu">
        <button class="nav" data-v="paises">● Países de América</button>
        <button class="nav" data-v="tasas">↗ Tasas de cambio</button>
        <button class="nav" data-v="info">▤ Información</button>
        <button class="nav" data-v="curiosidades">✦ Curiosidades</button>
        <button class="nav" data-v="noticias">▧ Noticias</button>
      </div>
      <button class="nav" data-v="proyecto">● Sobre el Proyecto</button>
      <button class="menu-logout" id="menuLogout" type="button">↪ Cerrar sesión</button>`;

    const utilitiesToggle=d.getElementById('utilitiesToggle');
    const utilitiesMenu=d.getElementById('utilitiesMenu');
    const gestion=side.querySelector('[data-v="gestion"]');

    const syncAccess=()=>{
      const isGuest=sessionStorage.getItem('americaestuya_session_access')==='guest';
      if(gestion)gestion.hidden=isGuest;
    };
    syncAccess();
    setInterval(syncAccess,400);

    utilitiesToggle?.addEventListener('click',()=>{
      utilitiesToggle.classList.toggle('open');
      utilitiesMenu?.classList.toggle('open');
    });

    side.addEventListener('click',e=>{
      const nav=e.target.closest?.('.nav');
      if(!nav)return;
      if(nav.dataset.v==='gestion'){
        if(sessionStorage.getItem('americaestuya_session_access')!=='google')return;
        window.location.assign('pages/management.html?v=20260911-1');
      }
      if(nav.dataset.v==='inicio'){
        d.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
        d.getElementById('inicio')?.classList.add('active');
        side.classList.remove('open');
      }
    },true);
  }

  frame.addEventListener('load',buildMenu);
})();
