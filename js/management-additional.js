const DATA_API_URL='https://ep-muddy-fire-awvetyx3.apirest.c-12.us-east-1.aws.neon.tech/americaestuya/rest/v1';
let session={token:'',accountId:null};
let definitions=[],allRows=[],selected={CLIENT:null,USER:null};
const esc=v=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const norm=t=>({BOOLEAN:'LIST',LONG_TEXT:'MEMO',EMAIL:'TEXT',INTEGER:'NUMBER',DECIMAL:'NUMBER',DATE_DMY:'DATETIME',DATE_MDY:'DATETIME',TIME_12:'DATETIME',TIME_24:'DATETIME'}[t]||t||'TEXT');

async function ensureSession(){
  if(session.token&&session.accountId)return session;
  const [{getApps,getApp},{getAuth}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')]);
  for(let i=0;i<80&&!getApps().length;i++)await new Promise(r=>setTimeout(r,100));
  if(!getApps().length)throw new Error('Firebase no está inicializado');
  const auth=getAuth(getApp());if(typeof auth.authStateReady==='function')await auth.authStateReady();
  const user=auth.currentUser;if(!user)throw new Error('No hay una sesión activa');
  session.token=await user.getIdToken();
  const r=await fetch(`${DATA_API_URL}/accounts?select=account_id&auth_uid=eq.${encodeURIComponent(user.uid)}`,{headers:{Authorization:`Bearer ${session.token}`}});
  if(!r.ok)throw new Error(await r.text());const rows=await r.json();session.accountId=rows[0]?.account_id;if(!session.accountId)throw new Error('Cuenta no encontrada');return session;
}
window.addEventListener('management:session',e=>{session={token:e.detail.token,accountId:e.detail.accountId};loadDefinitions().catch(console.error)});

async function loadDefinitions(){
  await ensureSession();
  const r=await fetch(`${DATA_API_URL}/igldata?select=id_sequence,id_parent,name,description,data_type,format,applies_to,display_order,is_active,deleted_at&deleted_at=is.null&is_active=eq.true&order=display_order.asc,id_sequence.asc`,{headers:{Authorization:`Bearer ${session.token}`}});
  if(!r.ok)throw new Error(await r.text());allRows=await r.json();
  const root=allRows.find(x=>x.id_parent==null&&String(x.name).toUpperCase()==='ADDITIONAL_FIELDS');
  const legacy=['ACCOUNT_FIELDS','CLIENT_FIELDS','USER_FIELDS'].map(n=>allRows.find(x=>x.id_parent==null&&String(x.name).toUpperCase()===n)).filter(Boolean);
  const parents=new Set([root,...legacy].filter(Boolean).map(x=>String(x.id_sequence)));
  definitions=allRows.filter(x=>parents.has(String(x.id_parent))&&x.is_active!==false);
  renderFor('CLIENT');renderFor('USER');
}
function defsFor(type){
  const legacyName=type==='CLIENT'?'CLIENT_FIELDS':type==='USER'?'USER_FIELDS':'ACCOUNT_FIELDS';
  const legacyRoot=allRows.find(x=>x.id_parent==null&&String(x.name).toUpperCase()===legacyName);
  const unifiedRoot=allRows.find(x=>x.id_parent==null&&String(x.name).toUpperCase()==='ADDITIONAL_FIELDS');
  return definitions.filter(d=>{
    const p=String(d.id_parent),ap=String(d.applies_to||'ALL').toUpperCase();
    return (legacyRoot&&p===String(legacyRoot.id_sequence))||(unifiedRoot&&p===String(unifiedRoot.id_sequence)&&(ap==='ALL'||ap===type));
  }).filter((d,i,a)=>a.findIndex(x=>String(x.name).trim().toLowerCase()===String(d.name).trim().toLowerCase())===i)
    .sort((a,b)=>(Number(a.display_order||0)-Number(b.display_order||0))||String(a.name).localeCompare(String(b.name),'es'));
}
function optionsFor(def){return allRows.filter(x=>String(x.id_parent)===String(def.id_sequence)&&x.is_active!==false&&x.deleted_at==null).sort((a,b)=>(Number(a.display_order||0)-Number(b.display_order||0))||String(a.name).localeCompare(String(b.name),'es'))}
async function loadValues(type,id){
  if(!id)return{};await ensureSession();const table=type==='CLIENT'?'client_data':'user_data',key=type==='CLIENT'?'client_id':'user_id';
  const r=await fetch(`${DATA_API_URL}/${table}?select=igldata_id,value_text,is_active&${key}=eq.${encodeURIComponent(id)}&is_active=eq.true`,{headers:{Authorization:`Bearer ${session.token}`}});if(!r.ok)throw new Error(await r.text());const rows=await r.json();return Object.fromEntries(rows.map(x=>[String(x.igldata_id),x.value_text??'']));
}
function inputHtml(def,value){
  const type=norm(def.data_type),id=`add_${def.id_sequence}`,name=esc(def.name),val=esc(value||'');
  if(type==='LIST'||type==='FILE'){
    const opts=optionsFor(def);
    if(type==='FILE'){const accept=opts.map(o=>o.name).join(',');return `<div class="field full"><label for="${id}">${name}</label><input id="${id}" data-igldata="${def.id_sequence}" data-kind="FILE" type="file" ${accept?`accept="${esc(accept)}"`:''}><small>${accept?`Permitidos: ${esc(accept)}`:'Archivo'}</small></div>`}
    return `<div class="field"><label for="${id}">${name}</label><select id="${id}" data-igldata="${def.id_sequence}"><option value=""></option>${opts.map(o=>`<option value="${esc(o.name)}" ${String(o.name)===String(value)?'selected':''}>${esc(o.name)}</option>`).join('')}</select></div>`;
  }
  if(type==='MEMO')return `<div class="field full"><label for="${id}">${name}</label><textarea id="${id}" data-igldata="${def.id_sequence}">${val}</textarea></div>`;
  const placeholder=def.format&&def.format!=='TEXT'?` placeholder="${esc(def.format)}"`:'';
  return `<div class="field"><label for="${id}">${name}</label><input id="${id}" data-igldata="${def.id_sequence}" data-type="${type}" data-format="${esc(def.format||'')}" type="text" value="${val}"${placeholder}></div>`;
}
function validate(def,value){
  const t=norm(def.data_type),f=String(def.format||'').toUpperCase();if(!value)return true;
  if(t==='NUMBER')return /^-?\d+(?:[.,]\d+)?$/.test(value);
  if(t==='DATETIME'){
    if(f.includes('DD/MM/YYYY'))return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(value);
    if(f.includes('MM/DD/YYYY'))return /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/.test(value);
    if(f.includes('HH24'))return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if(f.includes('HH12'))return /^(0[1-9]|1[0-2]):[0-5]\d(?:\s?[AP]M)?$/i.test(value);
  }
  return true;
}
async function renderFor(type){
  const box=document.getElementById(type==='CLIENT'?'clientAdditional':'userAdditional');if(!box)return;const id=selected[type];if(!id){box.innerHTML=`Selecciona un ${type==='CLIENT'?'cliente':'usuario'}.`;return}
  if(!definitions.length)await loadDefinitions();const defs=defsFor(type),values=await loadValues(type,id);if(!defs.length){box.innerHTML='No hay campos adicionales configurados.';return}
  box.innerHTML=`<form class="additional-form" data-additional-type="${type}"><div class="form-grid">${defs.map(d=>inputHtml(d,values[String(d.id_sequence)])).join('')}</div><div class="form-actions"><button class="primary" type="submit">Guardar datos adicionales</button></div><div class="status additional-status"></div></form>`;
  box.querySelector('form').addEventListener('submit',e=>saveAdditional(e,type,id,defs));
}
async function saveAdditional(e,type,id,defs){
  e.preventDefault();await ensureSession();const form=e.currentTarget,status=form.querySelector('.additional-status');status.textContent='';status.className='status additional-status';
  const table=type==='CLIENT'?'client_data':'user_data',key=type==='CLIENT'?'client_id':'user_id';
  try{
    for(const def of defs){
      const input=form.querySelector(`[data-igldata="${def.id_sequence}"]`);if(!input||input.dataset.kind==='FILE')continue;const value=String(input.value??'').trim();if(!validate(def,value))throw new Error(`${def.name}: formato inválido (${def.format||''})`);
      const pk=type==='CLIENT'?'client_data_id':'user_data_id';const ex=await fetch(`${DATA_API_URL}/${table}?select=${pk}&${key}=eq.${encodeURIComponent(id)}&igldata_id=eq.${def.id_sequence}`,{headers:{Authorization:`Bearer ${session.token}`}});if(!ex.ok)throw new Error(await ex.text());const old=await ex.json();
      if(old.length){const r=await fetch(`${DATA_API_URL}/${table}?${pk}=eq.${old[0][pk]}`,{method:'PATCH',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify({value_text:value||null,is_active:true,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(await r.text())}
      else if(value){const payload={[key]:Number(id),igldata_id:Number(def.id_sequence),value_text:value,is_active:true};const r=await fetch(`${DATA_API_URL}/${table}`,{method:'POST',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(await r.text())}
    }
    status.textContent='Guardado.';status.className='status additional-status success';setTimeout(()=>{status.textContent='';status.className='status additional-status'},1300);
  }catch(err){console.error(err);status.textContent='ERROR REAL: '+(err?.message||String(err));status.className='status additional-status error'}
}
window.addEventListener('management:entity-selected',e=>{if(e.detail?.type==='CLIENT'||e.detail?.type==='USER'){selected[e.detail.type]=e.detail.id;renderFor(e.detail.type).catch(console.error)}});
let usersWired=false;function wireUsers(){const list=document.getElementById('usersList');if(!list||usersWired)return false;usersWired=true;list.addEventListener('click',e=>{const row=e.target.closest('.client-row');if(!row)return;selected.USER=row.dataset.id;renderFor('USER').catch(console.error)});list.addEventListener('keydown',e=>{const row=e.target.closest('.client-row');if(row&&(e.key==='Enter'||e.key===' ')){selected.USER=row.dataset.id;renderFor('USER').catch(console.error)}});return true}
const obs=new MutationObserver(()=>{if(wireUsers())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true});wireUsers();ensureSession().then(loadDefinitions).catch(console.error);
