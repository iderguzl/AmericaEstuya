(() => {
  const COUNTRIES = [
    ['ARG','ar','Argentina','Buenos Aires',-34.6037,-58.3816],['BHS','bs','Bahamas','Nassau',25.0443,-77.3504],['BRB','bb','Barbados','Bridgetown',13.0975,-59.6167],['BLZ','bz','Belice','Belmopán',17.2510,-88.7590],['BOL','bo','Bolivia','Sucre',-19.0196,-65.2619],['BRA','br','Brasil','Brasilia',-15.7939,-47.8828],['CAN','ca','Canadá','Ottawa',45.4215,-75.6972],['CHL','cl','Chile','Santiago',-33.4489,-70.6693],['COL','co','Colombia','Bogotá',4.7110,-74.0721],['CRI','cr','Costa Rica','San José',9.9281,-84.0907],['CUB','cu','Cuba','La Habana',23.1136,-82.3666],['DMA','dm','Dominica','Roseau',15.3092,-61.3794],['DOM','do','República Dominicana','Santo Domingo',18.4861,-69.9312],['ECU','ec','Ecuador','Quito',-0.1807,-78.4678],['SLV','sv','El Salvador','San Salvador',13.6929,-89.2182],['GRD','gd','Granada','Saint George’s',12.0561,-61.7488],['GTM','gt','Guatemala','Ciudad de Guatemala',14.6349,-90.5069],['GUY','gy','Guyana','Georgetown',6.8013,-58.1551],['HTI','ht','Haití','Puerto Príncipe',18.5944,-72.3074],['HND','hn','Honduras','Tegucigalpa',14.0723,-87.1921],['JAM','jm','Jamaica','Kingston',17.9712,-76.7936],['MEX','mx','México','Ciudad de México',19.4326,-99.1332],['NIC','ni','Nicaragua','Managua',12.1140,-86.2362],['PAN','pa','Panamá','Ciudad de Panamá',8.9824,-79.5199],['PRY','py','Paraguay','Asunción',-25.2637,-57.5759],['PER','pe','Perú','Lima',-12.0464,-77.0428],['KNA','kn','San Cristóbal y Nieves','Basseterre',17.3026,-62.7177],['LCA','lc','Santa Lucía','Castries',14.0101,-60.9875],['VCT','vc','San Vicente y las Granadinas','Kingstown',13.1600,-61.2248],['SUR','sr','Surinam','Paramaribo',5.8520,-55.2038],['TTO','tt','Trinidad y Tobago','Puerto España',10.6549,-61.5019],['USA','us','Estados Unidos','Washington D. C.',38.9072,-77.0369],['URY','uy','Uruguay','Montevideo',-34.9011,-56.1645],['VEN','ve','Venezuela','Caracas',10.4806,-66.9036],['ATG','ag','Antigua y Barbuda','Saint John’s',17.1274,-61.8468]
  ].map(([iso3,iso2,name,capital,lat,lng])=>({iso3,iso2,name,capital,lat,lng}));

  let map, countryLayer, capitalMarker, worldGeo, current='CUB';

  function injectStyles(doc){
    if(doc.getElementById('countriesFeatureStyle')) return;
    const link=doc.createElement('link'); link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; doc.head.appendChild(link);
    const style=doc.createElement('style'); style.id='countriesFeatureStyle'; style.textContent=`
      .countries-wrap{padding:22px;display:grid;grid-template-columns:260px 1fr;gap:18px}.country-list-card,.country-detail{background:#fff;border:1px solid #dbe8f2;border-radius:20px;box-shadow:0 12px 32px #003c6d18}.country-list-card{padding:14px;max-height:calc(100vh - 150px);overflow:auto}.country-search{width:100%;padding:12px 14px;border:1px solid #c8dce9;border-radius:12px;margin-bottom:10px}.country-item{width:100%;display:flex;align-items:center;gap:10px;border:0;background:#fff;padding:10px;border-radius:10px;text-align:left;cursor:pointer;color:#123b63;font-size:15px}.country-item:hover,.country-item.active{background:#e9f4ff;color:#07589b;font-weight:700}.country-item img{width:28px;height:19px;object-fit:cover;border:1px solid #d6e1e8}.country-detail{padding:18px}.country-head{display:flex;align-items:center;gap:16px;margin-bottom:14px}.country-head img{width:86px;max-height:58px;object-fit:cover;border:1px solid #d8e2ea}.country-head h2{font-size:34px;margin:0}.country-capital{margin:4px 0 0;color:#5c748a;font-size:17px}.country-map{height:460px;border-radius:16px;overflow:hidden;border:1px solid #cfe1ee;background:#dff1ff}.capital-note{display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:10px 13px;border-radius:12px;background:#edf7ff;font-weight:700}.capital-dot{width:12px;height:12px;border-radius:50%;background:#e21b23;display:inline-block}.country-hint{color:#6c8296;font-size:13px;margin-top:8px}@media(max-width:800px){.countries-wrap{grid-template-columns:1fr;padding:12px}.country-list-card{max-height:260px}.country-map{height:380px}.country-head h2{font-size:28px}}
    `; doc.head.appendChild(style);
  }

  function buildUI(doc){
    const section=doc.getElementById('paises'); if(!section) return;
    section.innerHTML=`<div class="countries-wrap"><div class="country-list-card"><input id="countrySearch" class="country-search" placeholder="Buscar país…"><div id="countryList"></div></div><div class="country-detail"><div class="country-head"><img id="countryFlag" alt="Bandera"><div><h2 id="countryName"></h2><div class="country-capital">Capital: <b id="countryCapital"></b></div></div></div><div id="countryMap" class="country-map"></div><div class="capital-note"><span class="capital-dot"></span><span id="capitalLabel"></span></div><div class="country-hint">El mapa resalta la forma del país y marca la capital.</div></div></div>`;
    renderList(doc, COUNTRIES);
    doc.getElementById('countrySearch').addEventListener('input',e=>renderList(doc,COUNTRIES.filter(c=>c.name.toLowerCase().includes(e.target.value.toLowerCase()))));
  }

  function renderList(doc,list){
    const box=doc.getElementById('countryList'); if(!box) return;
    box.innerHTML=list.map(c=>`<button class="country-item ${c.iso3===current?'active':''}" data-iso="${c.iso3}"><img src="https://flagcdn.com/w80/${c.iso2}.png" alt="">${c.name}</button>`).join('');
    box.querySelectorAll('.country-item').forEach(b=>b.onclick=()=>showCountry(doc,b.dataset.iso));
  }

  function loadLeaflet(doc){
    return new Promise(resolve=>{
      if(doc.defaultView.L){resolve();return;}
      const s=doc.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload=resolve; doc.head.appendChild(s);
    });
  }

  function initMap(doc){
    const L=doc.defaultView.L;
    map=L.map(doc.getElementById('countryMap'),{zoomControl:true,scrollWheelZoom:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);
    map.setView([15,-75],3);
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson').then(r=>r.json()).then(g=>{worldGeo=g;showCountry(doc,current)}).catch(()=>{});
  }

  function showCountry(doc,iso){
    const c=COUNTRIES.find(x=>x.iso3===iso)||COUNTRIES.find(x=>x.iso3==='CUB'); current=c.iso3;
    doc.getElementById('countryName').textContent=c.name; doc.getElementById('countryCapital').textContent=c.capital; doc.getElementById('capitalLabel').textContent='Capital: '+c.capital; doc.getElementById('countryFlag').src=`https://flagcdn.com/w320/${c.iso2}.png`; doc.getElementById('countryFlag').alt='Bandera de '+c.name;
    renderList(doc,COUNTRIES.filter(x=>x.name.toLowerCase().includes((doc.getElementById('countrySearch')?.value||'').toLowerCase())));
    if(!map) return; const L=doc.defaultView.L;
    if(countryLayer) map.removeLayer(countryLayer); if(capitalMarker) map.removeLayer(capitalMarker);
    const feature=worldGeo?.features?.find(f=>(f.properties.ISO_A3||f.properties.iso_a3||f.properties.ADM0_A3)===c.iso3);
    if(feature){countryLayer=L.geoJSON(feature,{style:{weight:3,fillOpacity:.28}}).addTo(map); map.fitBounds(countryLayer.getBounds(),{padding:[28,28],maxZoom:6});} else {map.setView([c.lat,c.lng],5);}
    capitalMarker=L.circleMarker([c.lat,c.lng],{radius:8,weight:2,fillOpacity:1}).addTo(map).bindTooltip('Capital: '+c.capital,{permanent:true,direction:'top',offset:[0,-8]}).openTooltip();
    setTimeout(()=>map.invalidateSize(),120);
  }

  async function setup(){
    const frame=document.querySelector('#siteApp iframe'); if(!frame) return;
    const run=async()=>{try{const doc=frame.contentDocument; if(!doc||doc.getElementById('countriesFeatureReady')) return; injectStyles(doc); buildUI(doc); const marker=doc.createElement('meta'); marker.id='countriesFeatureReady'; doc.head.appendChild(marker); await loadLeaflet(doc); initMap(doc); showCountry(doc,'CUB'); const btn=doc.querySelector('.nav[data-v="paises"]'); if(btn) btn.addEventListener('click',()=>setTimeout(()=>{showCountry(doc,current);map&&map.invalidateSize()},160));}catch(e){console.error('Países de América:',e)}};
    frame.addEventListener('load',run); if(frame.contentDocument?.readyState==='complete') run();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup); else setup();
})();