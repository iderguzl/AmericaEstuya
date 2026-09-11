(function(){
  const frame=document.getElementById('siteFrame');
  if(!frame)return;
  function buildMenu(){
    const d=frame.contentDocument;
    const side=d?.getElementById('side');
    if(!side)return;
    side.innerHTML=`
      <h3>☰ Menú</h3>
      <button class="nav active" data-v="inicio">⌂ Inicio</button>
      <button class="nav" data-v="gestion">▣ Gestión</button>
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
  }
  frame.addEventListener('load',buildMenu);
})();
