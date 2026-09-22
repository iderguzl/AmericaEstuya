const DATA_API_URL='https://ep-muddy-fire-awvetyx3.apirest.c-12.us-east-1.aws.neon.tech/americaestuya/rest/v1';
const section=document.getElementById('activities');
if(section){
  const $=id=>document.getElementById(id);
  let session={token:'',accountId:null,uid:''},activities=[],clients=[],employees=[],selectedId=null,sortAsc=true;
  const status=$('activityStatus'),form=$('activityForm'),list=$('activitiesList'),search=$('activitySearch'),searchText=$('activitySearchText'),filter=$('activityFilter');

  const icons={
    new:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    edit:'<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
    delete:'<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>',
    save:'<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    filter:'<svg viewBox="0 0 24 24"><path d="M4 5h16l-6 7v6l-4 2v-8Z"/></svg>',
    sort:'<svg viewBox="0 0 24 24"><path d="M8 6v12M5 9l3-3 3 3M16 18V6M13 15l3 3 3-3"/></svg>',
    print:'<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>',
    export:'<svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg>'
  };
  const tool=(a,l)=>`<button class="tool-btn" type="button" data-action="${a}" title="${l}" aria-label="${l}">${icons[a]}</button>`;
  $('activityTools').innerHTML=tool('new','Nuevo')+tool('edit','Modificar')+tool('delete','Eliminar')+tool('save','Guardar')+'<span class="tool-sep"></span>'+tool('search','Buscar')+tool('filter','Filtrar')+tool('sort','Ordenar por fecha')+'<span class="tool-sep"></span>'+tool('print','Imprimir')+tool('export','Exportar');

  function msg(t,type=''){status.textContent=t||'';status.className='status'+(type?' '+type:'')}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
  function active(v){return !(v===false||v===0||v==='0')}
  function dtLocal(v){if(!v)return'';const d=new Date(v);const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
  function fmt(v){if(!v)return'—';try{return new Intl.DateTimeFormat('es-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return String(v)}}
  function nameOfClient(id){return clients.find(c=>String(c.client_id)===String(id))?.name||'—'}
  function selected(){return activities.find(a=>String(a.activity_id)===String(selectedId))||null}

  async function ensureSession(){
    if(session.token&&session.accountId)return session;
    const [{getApps,getApp},{getAuth}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')]);
    for(let i=0;i<80&&!getApps().length;i++)await new Promise(r=>setTimeout(r,100));
    if(!getApps().length)throw new Error('Firebase no está inicializado');
    const auth=getAuth(getApp());if(typeof auth.authStateReady==='function')await auth.authStateReady();
    const user=auth.currentUser;if(!user)throw new Error('No hay una sesión activa');
    session.uid=user.uid;session.token=await user.getIdToken();
    const r=await fetch(`${DATA_API_URL}/accounts?select=account_id&auth_uid=eq.${encodeURIComponent(user.uid)}`,{headers:{Authorization:`Bearer ${session.token}`}});
    if(!r.ok)throw new Error(await r.text());const rows=await r.json();session.accountId=rows[0]?.account_id;
    if(!session.accountId)throw new Error('Cuenta no encontrada');return session;
  }
  window.addEventListener('management:session',e=>{session={token:e.detail.token,accountId:e.detail.accountId,uid:''};loadAll().catch(console.error)});

  async function api(path,options={}){
    await ensureSession();
    const r=await fetch(DATA_API_URL+path,{...options,headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json',...(options.headers||{})}});
    if(!r.ok)throw new Error(await r.text());if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null;
  }
  async function loadClientsAndEmployees(){
    clients=await api(`/clients?select=client_id,name,is_active&account_id=eq.${session.accountId}&is_active=eq.1&order=name.asc`);
    const defs=await api('/igldata?select=id_sequence,id_parent,name,is_active,deleted_at&deleted_at=is.null');
    const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
    const relation=defs.find(x=>norm(x.name)==='TIPO RELACION'&&active(x.is_active));
    employees=[];
    if(relation){
      const employeeValue=defs.find(x=>String(x.id_parent)===String(relation.id_sequence)&&norm(x.name)==='EMPLEADO'&&active(x.is_active));
      if(employeeValue){
        const links=await api(`/client_data?select=client_id,value_text,is_active&igldata_id=eq.${relation.id_sequence}&is_active=eq.1`);
        const ids=new Set(links.filter(x=>norm(x.value_text)===norm(employeeValue.name)).map(x=>String(x.client_id)));
        employees=clients.filter(c=>ids.has(String(c.client_id)));
      }
    }
    $('activityClient').innerHTML='<option value="">Seleccione…</option>'+clients.map(c=>`<option value="${c.client_id}">${esc(c.name)}</option>`).join('');
    $('activityResponsible').innerHTML='<option value="">Seleccione…</option>'+employees.map(c=>`<option value="${c.client_id}">${esc(c.name)}</option>`).join('');
  }
  async function loadActivities(){
    activities=await api(`/activities?select=activity_id,account_id,client_id,description,start_at,end_at,responsible_client_id,is_active,created_at,updated_at&account_id=eq.${session.accountId}&order=start_at.asc`);
    render();
  }
  async function loadAll(){try{await ensureSession();await loadClientsAndEmployees();await loadActivities();msg('')}catch(e){console.error(e);msg('ERROR REAL: '+(e?.message||String(e)),'error')}}

  function visible(){
    const q=searchText.value.trim().toLowerCase(),f=filter.value;
    return [...activities].filter(a=>{
      const st=active(a.is_active);if(f==='active'&&!st)return false;if(f==='inactive'&&st)return false;
      if(!q)return true;const text=[a.description,nameOfClient(a.client_id),nameOfClient(a.responsible_client_id),fmt(a.start_at),fmt(a.end_at)].join(' ').toLowerCase();return text.includes(q);
    }).sort((a,b)=>sortAsc?new Date(a.start_at)-new Date(b.start_at):new Date(b.start_at)-new Date(a.start_at));
  }
  function render(){
    const rows=visible();
    if(!rows.some(x=>String(x.activity_id)===String(selectedId)))selectedId=null;
    list.innerHTML=rows.length?rows.map(a=>`<div class="client-row ${String(a.activity_id)===String(selectedId)?'selected':''}" data-id="${a.activity_id}" tabindex="0"><div><div class="client-name">${esc(nameOfClient(a.client_id))}</div><div class="client-meta"><span>${esc(fmt(a.start_at))} → ${esc(fmt(a.end_at))}</span><span>Responsable: ${esc(nameOfClient(a.responsible_client_id))}</span><span>${esc(a.description||'')}</span></div></div><span class="client-state ${active(a.is_active)?'':'off'}">${active(a.is_active)?'Activo':'Inactivo'}</span></div>`).join(''):'<div class="no-items">No hay actividades.</div>';
    list.querySelectorAll('.client-row').forEach(row=>{const choose=()=>{selectedId=row.dataset.id;render();window.dispatchEvent(new CustomEvent('management:entity-selected',{detail:{type:'ACTIVITY',id:selectedId}}))};row.onclick=choose;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}}});
  }
  function resetForm(){$('activityId').value='';$('activityClient').value='';$('activityResponsible').value='';$('activityStart').value='';$('activityEnd').value='';$('activityDescription').value='';$('activityActive').value='true'}
  function openForm(a=null){resetForm();if(a){$('activityId').value=a.activity_id;$('activityClient').value=String(a.client_id||'');$('activityResponsible').value=a.responsible_client_id?String(a.responsible_client_id):'';$('activityStart').value=dtLocal(a.start_at);$('activityEnd').value=dtLocal(a.end_at);$('activityDescription').value=a.description||'';$('activityActive').value=active(a.is_active)?'true':'false'}form.classList.add('open');$('activityDescription').focus()}
  function closeForm(){form.classList.remove('open');resetForm()}
  $('cancelActivityBtn').onclick=closeForm;searchText.oninput=render;filter.onchange=render;

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    try{
      const id=$('activityId').value,start=$('activityStart').value,end=$('activityEnd').value;
      if(!start||!end||new Date(end)<new Date(start)){msg('La fecha final no puede ser anterior a la fecha inicial.','error');return}
      const payload={client_id:Number($('activityClient').value),description:$('activityDescription').value.trim(),start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString(),responsible_client_id:$('activityResponsible').value?Number($('activityResponsible').value):null,is_active:$('activityActive').value==='true'?1:0,updated_at:new Date().toISOString()};
      if(!payload.client_id||!payload.description){msg('Beneficiario y descripción son obligatorios.','error');return}
      let path='/activities',method='POST';if(id){path+=`?activity_id=eq.${encodeURIComponent(id)}&account_id=eq.${session.accountId}`;method='PATCH'}else payload.account_id=Number(session.accountId);
      const saved=await api(path,{method,headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
      const savedId=id||saved?.[0]?.activity_id;closeForm();selectedId=savedId?String(savedId):null;await loadActivities();
      if(selectedId)window.dispatchEvent(new CustomEvent('management:entity-selected',{detail:{type:'ACTIVITY',id:selectedId}}));
      msg('Guardado.','success');setTimeout(()=>msg(''),1200);
    }catch(err){console.error(err);msg('ERROR REAL: '+(err?.message||String(err)),'error')}
  });

  async function remove(){
    const a=selected();if(!a){msg('Selecciona una actividad.','error');return}
    if(!confirm('¿Eliminar esta actividad?'))return;
    try{await api(`/activities?activity_id=eq.${a.activity_id}&account_id=eq.${session.accountId}`,{method:'PATCH',body:JSON.stringify({is_active:0,updated_at:new Date().toISOString()})});selectedId=null;await loadActivities()}catch(e){msg('ERROR REAL: '+(e?.message||String(e)),'error')}
  }
  function exportMenu(btn){
    document.querySelectorAll('.export-popover.activity-export').forEach(x=>x.remove());
    const pop=document.createElement('div');pop.className='export-popover activity-export';pop.innerHTML='<button data-f="csv">CSV</button><button data-f="pdf">PDF</button><button data-f="jpg">JPG</button>';document.body.appendChild(pop);
    const r=btn.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(innerWidth-pop.offsetWidth-8,r.right-pop.offsetWidth))+'px';pop.style.top=(r.bottom+6)+'px';
    pop.onclick=async e=>{const f=e.target.dataset.f;if(!f)return;pop.remove();const a=selected();if(!a){msg('Selecciona una actividad.','error');return}try{await window.managementExportRecord?.({type:'ACTIVITY',id:a.activity_id,parent:{Beneficiario:nameOfClient(a.client_id),'Fecha inicio':fmt(a.start_at),'Fecha fin':fmt(a.end_at),Descripción:a.description,Responsable:nameOfClient(a.responsible_client_id),Estado:active(a.is_active)?'Activo':'Inactivo'},format:f,includeAdditional:true})}catch(err){msg('ERROR REAL: '+(err?.message||String(err)),'error')}};
    setTimeout(()=>document.addEventListener('click',ev=>{if(!pop.contains(ev.target)&&ev.target!==btn)pop.remove()},{once:true}),0);
  }
  $('activityTools').addEventListener('click',async e=>{
    const b=e.target.closest('.tool-btn');if(!b)return;const a=b.dataset.action;
    if(a==='new')return openForm();if(a==='edit')return selected()?openForm(selected()):msg('Selecciona una actividad.','error');if(a==='delete')return remove();
    if(a==='save'){if(form.classList.contains('open'))return form.requestSubmit();const ok=await window.managementSaveAdditional?.('ACTIVITY');if(!ok)msg('No hay datos adicionales para guardar.','error');return}
    if(a==='search'){search.classList.toggle('open');return}
    if(a==='filter'){filter.value=filter.value==='all'?'active':filter.value==='active'?'inactive':'all';render();return}
    if(a==='sort'){sortAsc=!sortAsc;render();return}
    if(a==='print'){window.print();return}
    if(a==='export')return exportMenu(b);
  });
  window.addEventListener('management:section',e=>{if(e.detail?.id==='activities')loadAll().catch(console.error)});
  ensureSession().then(loadAll).catch(e=>{console.error(e);msg('ERROR REAL: '+(e?.message||String(e)),'error')});
}
