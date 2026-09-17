const DATA_API_URL='https://ep-muddy-fire-awvetyx3.apirest.c-12.us-east-1.aws.neon.tech/americaestuya/rest/v1';
let session={token:'',accountId:null};
let allRows=[],selected={CLIENT:null,USER:null},chosen={CLIENT:new Set(),USER:new Set()};
const esc=v=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const norm=t=>({BOOLEAN:'LIST',LONG_TEXT:'MEMO',EMAIL:'TEXT',INTEGER:'NUMBER',DECIMAL:'NUMBER',DATE_DMY:'DATETIME',DATE_MDY:'DATETIME',TIME_12:'DATETIME',TIME_24:'DATETIME'}[String(t||'').toUpperCase()]||String(t||'TEXT').toUpperCase());

const style=document.createElement('style');
style.textContent=`
.additional-picker-row{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:8px;align-items:center;margin-bottom:12px}
.additional-picker-hint{height:42px;border:1px solid #cbdbe7;border-radius:10px;background:#fff;color:#8093a2;padding:0 12px;display:flex;align-items:center}
.additional-more{height:42px;border:0;border-radius:10px;background:#0b78c5;color:#fff;font-size:22px;font-weight:900;cursor:pointer;line-height:1}
.additional-fields{display:grid;gap:12px}.additional-field-row{display:grid;grid-template-columns:minmax(130px,.8fr) minmax(0,1.2fr);gap:12px;align-items:center}
.additional-field-name{font-weight:800;color:#315b7a}.additional-field-control input,.additional-field-control select,.additional-field-control textarea{width:100%;border:1px solid #cbdbe7;border-radius:10px;background:#fff;color:#173f61;padding:0 11px}.additional-field-control input,.additional-field-control select{height:42px}.additional-field-control textarea{min-height:86px;padding:10px 11px;resize:vertical}
.additional-picker{border:0;border-radius:16px;padding:0;max-width:470px;width:calc(100% - 28px);box-shadow:0 24px 70px #102f4960}.additional-picker::backdrop{background:#102f4966}.additional-picker-box{padding:18px}.additional-picker-title{text-align:center;font-size:20px;font-weight:900;margin-bottom:12px}.additional-picker-list{display:grid;gap:8px;max-height:58vh;overflow:auto}.additional-picker-item{border:1px solid #dce7f0;background:#fff;border-radius:11px;padding:11px 12px;text-align:left;color:#173f61;cursor:pointer}.additional-picker-item:hover{background:#eef6fb}.additional-picker-name{font-weight:900}.additional-picker-meta{font-size:12px;color:#71879a;margin-top:3px}.additional-picker-close{margin-top:12px;width:100%;border:1px solid #cbdbe7;background:#fff;color:#28506f;border-radius:10px;padding:10px;font-weight:800;cursor:pointer}
@media(max-width:760px){.additional-field-row{grid-template-columns:1fr}.additional-field-name{margin-bottom:-5px}}
`;
document.head.appendChild(style);

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
  const r=await fetch(`${DATA_API_URL}/igldata?select=id_sequence,id_parent,name,description,data_type,format,applies_to,display_order,is_active,deleted_at&deleted_at=is.null&order=display_order.asc,id_sequence.asc`,{headers:{Authorization:`Bearer ${session.token}`}});
  if(!r.ok)throw new Error(await r.text());allRows=await r.json();
}
function activeRow(r){return r.deleted_at==null&&(r.status?String(r.status).toUpperCase()==='A':r.is_active!==false)}
function applies(r,type){
  const a=String(r.applies_to||'ALL').toUpperCase();
  if(type==='CLIENT')return ['ALL','CLIENT','T','C'].includes(a);
  if(type==='USER')return ['ALL','USER','T','U'].includes(a);
  return ['ALL','ACCOUNT','T','A'].includes(a);
}
function rootRows(){return allRows.filter(r=>r.id_parent==null&&activeRow(r)&&['ADDITIONAL_FIELDS','ACCOUNT_FIELDS','CLIENT_FIELDS','USER_FIELDS'].includes(String(r.name||'').toUpperCase()))}
function defsFor(type){
  const roots=rootRows();
  const allowedRootIds=new Set(roots.filter(r=>{
    const n=String(r.name||'').toUpperCase();
    return n==='ADDITIONAL_FIELDS'||(type==='CLIENT'&&n==='CLIENT_FIELDS')||(type==='USER'&&n==='USER_FIELDS');
  }).map(r=>String(r.id_sequence)));
  const seen=new Set();
  return allRows.filter(r=>allowedRootIds.has(String(r.id_parent))&&activeRow(r)&&applies(r,type)).filter(r=>{
    const k=String(r.name||'').trim().toUpperCase();if(seen.has(k))return false;seen.add(k);return true;
  }).sort((a,b)=>(Number(a.display_order||0)-Number(b.display_order||0))||(Number(a.id_sequence)-Number(b.id_sequence)));
}
function optionsFor(def){return allRows.filter(r=>String(r.id_parent)===String(def.id_sequence)&&activeRow(r)).sort((a,b)=>(Number(a.display_order||0)-Number(b.display_order||0))||(Number(a.id_sequence)-Number(b.id_sequence)))}
async function loadValues(type,id){
  if(!id)return{};await ensureSession();const table=type==='CLIENT'?'client_data':'user_data',key=type==='CLIENT'?'client_id':'user_id';
  const r=await fetch(`${DATA_API_URL}/${table}?select=igldata_id,value_text,is_active&${key}=eq.${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${session.token}`}});if(!r.ok)throw new Error(await r.text());const rows=await r.json();
  return Object.fromEntries(rows.filter(activeRow).map(x=>[String(x.igldata_id),x.value_text??'']));
}
function controlHtml(def,value){
  const type=norm(def.data_type),id=`add_${def.id_sequence}`,val=esc(value||'');
  if(type==='LIST'||type==='FILE'){
    const opts=optionsFor(def);
    if(type==='FILE'){const accept=opts.map(o=>o.name).join(',');return `<input id="${id}" data-igldata="${def.id_sequence}" data-kind="FILE" type="file" ${accept?`accept="${esc(accept)}"`:''}>`;}
    return `<select id="${id}" data-igldata="${def.id_sequence}"><option value=""></option>${opts.map(o=>`<option value="${esc(o.name)}" ${String(o.name)===String(value)?'selected':''}>${esc(o.name)}</option>`).join('')}</select>`;
  }
  if(type==='MEMO')return `<textarea id="${id}" data-igldata="${def.id_sequence}">${val}</textarea>`;
  const placeholder=def.format&&def.format!=='TEXT'?` placeholder="${esc(def.format)}"`:'';
  return `<input id="${id}" data-igldata="${def.id_sequence}" data-type="${type}" data-format="${esc(def.format||'')}" type="text" value="${val}"${placeholder}>`;
}
function validate(def,value){
  const t=norm(def.data_type),f=String(def.format||'').toUpperCase();if(!value)return true;
  if(t==='NUMBER'){
    if(f==='###')return /^-?\d+$/.test(value);
    if(f.includes('.'))return /^-?\d+(?:\.\d+)?$/.test(value);
    if(f.includes(','))return /^-?\d+(?:,\d+)?$/.test(value);
    return /^-?\d+(?:[.,]\d+)?$/.test(value);
  }
  if(t==='DATETIME'){
    if(f.includes('DD/MM/YYYY'))return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(value);
    if(f.includes('MM/DD/YYYY'))return /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/.test(value);
    if(f.includes('HH24'))return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if(f.includes('HH12'))return /^(0[1-9]|1[0-2]):[0-5]\d(?:\s?[AP]M)?$/i.test(value);
  }
  return true;
}
function ensureDialog(type){
  const id=`additionalPicker${type}`;let dlg=document.getElementById(id);if(dlg)return dlg;
  dlg=document.createElement('dialog');dlg.id=id;dlg.className='additional-picker';document.body.appendChild(dlg);return dlg;
}
function openPicker(type){
  const defs=defsFor(type),dlg=ensureDialog(type);const already=chosen[type];
  dlg.innerHTML=`<div class="additional-picker-box"><div class="additional-picker-title">Seleccionar dato</div><div class="additional-picker-list">${defs.filter(d=>!already.has(String(d.id_sequence))).map(d=>`<button type="button" class="additional-picker-item" data-def="${d.id_sequence}"><div class="additional-picker-name">${esc(d.name)}</div><div class="additional-picker-meta">${esc(d.description||'')} ${d.format&&d.format!=='TEXT'?' · '+esc(d.format):''}</div></button>`).join('')||'<div class="no-items">No hay más datos disponibles.</div>'}</div><button type="button" class="additional-picker-close">Cerrar</button></div>`;
  dlg.querySelectorAll('[data-def]').forEach(b=>b.addEventListener('click',()=>{already.add(String(b.dataset.def));dlg.close();renderFor(type).catch(console.error)}));
  dlg.querySelector('.additional-picker-close').onclick=()=>dlg.close();dlg.showModal();
}
async function renderFor(type){
  const box=document.getElementById(type==='CLIENT'?'clientAdditional':'userAdditional');if(!box)return;const id=selected[type];
  if(!id){box.innerHTML=`Selecciona un ${type==='CLIENT'?'cliente':'usuario'}.`;return}
  if(!allRows.length)await loadDefinitions();const defs=defsFor(type),values=await loadValues(type,id);
  Object.keys(values).forEach(k=>chosen[type].add(String(k)));
  const selectedDefs=defs.filter(d=>chosen[type].has(String(d.id_sequence)));
  box.innerHTML=`<form class="additional-form" data-additional-type="${type}"><div class="additional-picker-row"><div class="additional-picker-hint">Añadir dato adicional</div><button class="additional-more" type="button" title="Seleccionar dato" aria-label="Seleccionar dato">...</button></div><div class="additional-fields">${selectedDefs.map(d=>`<div class="additional-field-row"><div class="additional-field-name">${esc(d.name)}</div><div class="additional-field-control">${controlHtml(d,values[String(d.id_sequence)])}</div></div>`).join('')}</div>${selectedDefs.length?'<div class="form-actions"><button class="primary" type="submit">Guardar</button></div>':''}<div class="status additional-status"></div></form>`;
  box.querySelector('.additional-more').onclick=()=>openPicker(type);
  box.querySelector('form').addEventListener('submit',e=>saveAdditional(e,type,id,selectedDefs));
}
async function saveAdditional(e,type,id,defs){
  e.preventDefault();await ensureSession();const form=e.currentTarget,status=form.querySelector('.additional-status');status.textContent='';status.className='status additional-status';
  const table=type==='CLIENT'?'client_data':'user_data',key=type==='CLIENT'?'client_id':'user_id',pk=type==='CLIENT'?'client_data_id':'user_data_id';
  try{
    for(const def of defs){
      const input=form.querySelector(`[data-igldata="${def.id_sequence}"]`);if(!input||input.dataset.kind==='FILE')continue;const value=String(input.value??'').trim();if(!validate(def,value))throw new Error(`${def.name}: formato inválido. Debe cumplir ${def.format||'el formato configurado'}`);
      const ex=await fetch(`${DATA_API_URL}/${table}?select=${pk}&${key}=eq.${encodeURIComponent(id)}&igldata_id=eq.${def.id_sequence}`,{headers:{Authorization:`Bearer ${session.token}`}});if(!ex.ok)throw new Error(await ex.text());const old=await ex.json();
      if(old.length){const r=await fetch(`${DATA_API_URL}/${table}?${pk}=eq.${old[0][pk]}`,{method:'PATCH',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify({value_text:value||null,is_active:true,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(await r.text())}
      else if(value){const payload={[key]:Number(id),igldata_id:Number(def.id_sequence),value_text:value,is_active:true};const r=await fetch(`${DATA_API_URL}/${table}`,{method:'POST',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(await r.text())}
    }
    status.textContent='Guardado.';status.className='status additional-status success';setTimeout(()=>{status.textContent='';status.className='status additional-status'},1300);
  }catch(err){console.error(err);status.textContent='ERROR REAL: '+(err?.message||String(err));status.className='status additional-status error'}
}
window.addEventListener('management:entity-selected',e=>{if(e.detail?.type==='CLIENT'||e.detail?.type==='USER'){selected[e.detail.type]=e.detail.id;chosen[e.detail.type]=new Set();renderFor(e.detail.type).catch(console.error)}});
let usersWired=false;function wireUsers(){const list=document.getElementById('usersList');if(!list||usersWired)return false;usersWired=true;list.addEventListener('click',e=>{const row=e.target.closest('.client-row');if(!row)return;selected.USER=row.dataset.id;chosen.USER=new Set();renderFor('USER').catch(console.error)});list.addEventListener('keydown',e=>{const row=e.target.closest('.client-row');if(row&&(e.key==='Enter'||e.key===' ')){selected.USER=row.dataset.id;chosen.USER=new Set();renderFor('USER').catch(console.error)}});return true}
const obs=new MutationObserver(()=>{if(wireUsers())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true});wireUsers();ensureSession().then(loadDefinitions).catch(console.error);
