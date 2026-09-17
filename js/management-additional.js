const DATA_API_URL='https://ep-muddy-fire-awvetyx3.apirest.c-12.us-east-1.aws.neon.tech/americaestuya/rest/v1';
let session={token:'',accountId:null,uid:''};
let allRows=[],selected={CLIENT:null,USER:null},chosen={CLIENT:new Set(),USER:new Set()};
let storageModulePromise=null;
const esc=v=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const norm=t=>({BOOLEAN:'LIST',LONG_TEXT:'MEMO',EMAIL:'TEXT',INTEGER:'NUMBER',DECIMAL:'NUMBER',DATE_DMY:'DATETIME',DATE_MDY:'DATETIME',TIME_12:'DATETIME',TIME_24:'DATETIME'}[String(t||'').toUpperCase()]||String(t||'TEXT').toUpperCase());

const style=document.createElement('style');
style.textContent=`
.additional-picker-row{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:8px;align-items:center;margin-bottom:12px}
.additional-picker-hint{height:42px;border:1px solid #cbdbe7;border-radius:10px;background:#fff;color:#8093a2;padding:0 12px;display:flex;align-items:center}
.additional-more{height:42px;border:0;border-radius:10px;background:#0b78c5;color:#fff;font-size:22px;font-weight:900;cursor:pointer;line-height:1}
.additional-fields{display:grid;gap:12px}.additional-field-row{display:grid;grid-template-columns:minmax(130px,.8fr) minmax(0,1.2fr) 42px;gap:10px;align-items:center}.additional-remove{width:40px;height:40px;border:0;border-radius:10px;background:#fff1f1;color:#a63232;display:grid;place-items:center;cursor:pointer}.additional-remove:hover{background:#ffe3e3}.additional-remove svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.additional-field-name{font-weight:800;color:#315b7a}.additional-field-control input,.additional-field-control select,.additional-field-control textarea{width:100%;border:1px solid #cbdbe7;border-radius:10px;background:#fff;color:#173f61;padding:0 11px}.additional-field-control input,.additional-field-control select{height:42px}.additional-field-control textarea{min-height:86px;padding:10px 11px;resize:vertical}
.additional-file-current{font-size:12px;color:#6b8295;margin-top:6px;overflow-wrap:anywhere}.additional-file-current b{color:#315b7a}.additional-file-open{border:0;background:transparent;color:#07589b;font-weight:800;text-decoration:underline;padding:0;cursor:pointer;max-width:100%;text-align:left;overflow-wrap:anywhere}
.additional-picker{border:0;border-radius:16px;padding:0;max-width:470px;width:calc(100% - 28px);box-shadow:0 24px 70px #102f4960}.additional-picker::backdrop{background:#102f4966}.additional-picker-box{padding:18px}.additional-picker-title{text-align:center;font-size:20px;font-weight:900;margin-bottom:12px}.additional-picker-list{display:grid;gap:8px;max-height:58vh;overflow:auto}.additional-picker-item{border:1px solid #dce7f0;background:#fff;border-radius:11px;padding:11px 12px;text-align:left;color:#173f61;cursor:pointer}.additional-picker-item:hover{background:#eef6fb}.additional-picker-name{font-weight:900}.additional-picker-meta{font-size:12px;color:#71879a;margin-top:3px}.additional-picker-close{margin-top:12px;width:100%;border:1px solid #cbdbe7;background:#fff;color:#28506f;border-radius:10px;padding:10px;font-weight:800;cursor:pointer}
@media(max-width:760px){.additional-field-row{grid-template-columns:minmax(0,1fr) 42px}.additional-field-name{grid-column:1/-1;margin-bottom:-5px}.additional-field-control{grid-column:1}.additional-remove{grid-column:2;align-self:center}}
`;
document.head.appendChild(style);

async function ensureSession(){
  if(session.token&&session.accountId&&session.uid)return session;
  const [{getApps,getApp},{getAuth}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')]);
  for(let i=0;i<80&&!getApps().length;i++)await new Promise(r=>setTimeout(r,100));
  if(!getApps().length)throw new Error('Firebase no está inicializado');
  const auth=getAuth(getApp());if(typeof auth.authStateReady==='function')await auth.authStateReady();
  const user=auth.currentUser;if(!user)throw new Error('No hay una sesión activa');
  session.uid=user.uid;session.token=await user.getIdToken();
  if(!session.accountId){
    const r=await fetch(`${DATA_API_URL}/accounts?select=account_id&auth_uid=eq.${encodeURIComponent(user.uid)}`,{headers:{Authorization:`Bearer ${session.token}`}});
    if(!r.ok)throw new Error(await r.text());const rows=await r.json();session.accountId=rows[0]?.account_id;if(!session.accountId)throw new Error('Cuenta no encontrada');
  }
  return session;
}
window.addEventListener('management:session',e=>{session={token:e.detail.token,accountId:e.detail.accountId,uid:''};ensureSession().then(loadDefinitions).catch(console.error)});

async function storageApi(){
  if(!storageModulePromise)storageModulePromise=Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js')
  ]).then(([appMod,storageMod])=>({appMod,storageMod}));
  return storageModulePromise;
}
function safeFileName(name){return String(name||'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'archivo'}
function fileExtension(name){const m=String(name||'').toLowerCase().match(/(\.[a-z0-9]+)$/);return m?m[1]:''}
function allowedExtensions(def){return optionsFor(def).map(o=>String(o.name||'').trim().toLowerCase()).filter(x=>/^\.[a-z0-9]+$/.test(x))}
async function uploadAdditionalFile(type,id,def,file){
  await ensureSession();
  if(!file)throw new Error('No se seleccionó ningún archivo.');
  if(file.size>20*1024*1024)throw new Error('El archivo supera el límite de 20 MB.');
  const allowed=allowedExtensions(def),ext=fileExtension(file.name);
  if(allowed.length&&!allowed.includes(ext))throw new Error(`${def.name}: tipo de archivo no permitido. Permitidos: ${allowed.join(', ')}`);
  const {appMod,storageMod}=await storageApi();
  const folder=type==='CLIENT'?'clients':'users';
  const path=`accounts/${session.uid}/${folder}/${Number(id)}/${Number(def.id_sequence)}/${Date.now()}_${safeFileName(file.name)}`;
  const app=appMod.getApp();
  const storage=storageMod.getStorage(app,'gs://americaestuya.firebasestorage.app');
  const fileRef=storageMod.ref(storage,path);
  await storageMod.uploadBytes(fileRef,file,{contentType:file.type||'application/octet-stream'});
  await storageMod.getDownloadURL(fileRef);
  return path;
}
async function deleteStoredFile(path){
  if(!path||!session.uid||!String(path).startsWith(`accounts/${session.uid}/`))return;
  try{const {appMod,storageMod}=await storageApi();await storageMod.deleteObject(storageMod.ref(storageMod.getStorage(appMod.getApp(),'gs://americaestuya.firebasestorage.app'),path))}catch(e){console.warn('No se pudo borrar el archivo anterior',e)}
}

async function loadDefinitions(){
  await ensureSession();
  const r=await fetch(`${DATA_API_URL}/igldata?select=id_sequence,id_parent,name,description,data_type,format,applies_to,display_order,is_active,deleted_at&deleted_at=is.null&order=display_order.asc,id_sequence.asc`,{headers:{Authorization:`Bearer ${session.token}`}});
  if(!r.ok)throw new Error(await r.text());allRows=await r.json();
}
function activeRow(r){return r.deleted_at==null&&(r.status?String(r.status).toUpperCase()==='A':r.is_active!==false)}
function applies(r,type){const a=String(r.applies_to||'ALL').toUpperCase();if(type==='CLIENT')return ['ALL','CLIENT','T','C'].includes(a);if(type==='USER')return ['ALL','USER','T','U'].includes(a);return ['ALL','ACCOUNT','T','A'].includes(a)}
function rootRows(){return allRows.filter(r=>r.id_parent==null&&activeRow(r)&&['ADDITIONAL_FIELDS','ACCOUNT_FIELDS','CLIENT_FIELDS','USER_FIELDS'].includes(String(r.name||'').toUpperCase()))}
function defsFor(type){const roots=rootRows();const allowedRootIds=new Set(roots.filter(r=>{const n=String(r.name||'').toUpperCase();return n==='ADDITIONAL_FIELDS'||(type==='CLIENT'&&n==='CLIENT_FIELDS')||(type==='USER'&&n==='USER_FIELDS')}).map(r=>String(r.id_sequence)));const seen=new Set();return allRows.filter(r=>allowedRootIds.has(String(r.id_parent))&&activeRow(r)&&applies(r,type)).filter(r=>{const k=String(r.name||'').trim().toUpperCase();if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>(Number(a.display_order||0)-Number(b.display_order||0))||(Number(a.id_sequence)-Number(b.id_sequence)))}
function optionsFor(def){return allRows.filter(r=>String(r.id_parent)===String(def.id_sequence)&&activeRow(r)).sort((a,b)=>(Number(a.display_order||0)-Number(b.display_order||0))||(Number(a.id_sequence)-Number(b.id_sequence)))}
async function loadValues(type,id){if(!id)return{};await ensureSession();const table=type==='CLIENT'?'client_data':'user_data',key=type==='CLIENT'?'client_id':'user_id';const r=await fetch(`${DATA_API_URL}/${table}?select=igldata_id,value_text,is_active&${key}=eq.${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${session.token}`}});if(!r.ok)throw new Error(await r.text());const rows=await r.json();return Object.fromEntries(rows.filter(activeRow).map(x=>[String(x.igldata_id),x.value_text??'']))}
function controlHtml(def,value){
  const type=norm(def.data_type),id=`add_${def.id_sequence}`,val=esc(value||'');
  if(type==='LIST'||type==='FILE'){
    const opts=optionsFor(def);
    if(type==='FILE'){
      const accept=opts.map(o=>o.name).join(',');
      const current=value?`<div class="additional-file-current"><b>Guardado:</b> <button type="button" class="additional-file-open" data-file-path="${val}" title="Abrir archivo">${esc(storedFileName(value))}</button></div>`:'';
      return `<input id="${id}" data-igldata="${def.id_sequence}" data-kind="FILE" data-current="${val}" type="file" ${accept?`accept="${esc(accept)}"`:''}>${current}`;
    }
    return `<select id="${id}" data-igldata="${def.id_sequence}"><option value=""></option>${opts.map(o=>`<option value="${esc(o.name)}" ${String(o.name)===String(value)?'selected':''}>${esc(o.name)}</option>`).join('')}</select>`;
  }
  if(type==='MEMO')return `<textarea id="${id}" data-igldata="${def.id_sequence}">${val}</textarea>`;
  const placeholder=def.format&&def.format!=='TEXT'?` placeholder="${esc(def.format)}"`:'';
  return `<input id="${id}" data-igldata="${def.id_sequence}" data-type="${type}" data-format="${esc(def.format||'')}" type="text" value="${val}"${placeholder}>`;
}
function validate(def,value){const t=norm(def.data_type),f=String(def.format||'').toUpperCase();if(!value)return true;if(t==='NUMBER'){if(f==='###')return /^-?\d+$/.test(value);if(f.includes('.'))return /^-?\d+(?:\.\d+)?$/.test(value);if(f.includes(','))return /^-?\d+(?:,\d+)?$/.test(value);return /^-?\d+(?:[.,]\d+)?$/.test(value)}if(t==='DATETIME'){if(f.includes('DD/MM/YYYY'))return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(value);if(f.includes('MM/DD/YYYY'))return /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/.test(value);if(f.includes('HH24'))return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);if(f.includes('HH12'))return /^(0[1-9]|1[0-2]):[0-5]\d(?:\s?[AP]M)?$/i.test(value)}return true}
function ensureDialog(type){const id=`additionalPicker${type}`;let dlg=document.getElementById(id);if(dlg)return dlg;dlg=document.createElement('dialog');dlg.id=id;dlg.className='additional-picker';document.body.appendChild(dlg);return dlg}
function openPicker(type){const defs=defsFor(type),dlg=ensureDialog(type),already=chosen[type];dlg.innerHTML=`<div class="additional-picker-box"><div class="additional-picker-title">Seleccionar dato</div><div class="additional-picker-list">${defs.filter(d=>!already.has(String(d.id_sequence))).map(d=>`<button type="button" class="additional-picker-item" data-def="${d.id_sequence}"><div class="additional-picker-name">${esc(d.name)}</div><div class="additional-picker-meta">${esc(d.description||'')} ${d.format&&d.format!=='TEXT'?' · '+esc(d.format):''}</div></button>`).join('')||'<div class="no-items">No hay más datos disponibles.</div>'}</div><button type="button" class="additional-picker-close">Cerrar</button></div>`;dlg.querySelectorAll('[data-def]').forEach(b=>b.addEventListener('click',()=>{already.add(String(b.dataset.def));dlg.close();renderFor(type).catch(console.error)}));dlg.querySelector('.additional-picker-close').onclick=()=>dlg.close();dlg.showModal()}
async function removeAdditionalValue(type,id,def){
  await ensureSession();
  const table=type==='CLIENT'?'client_data':'user_data',key=type==='CLIENT'?'client_id':'user_id',pk=type==='CLIENT'?'client_data_id':'user_data_id';
  const r=await fetch(`${DATA_API_URL}/${table}?select=${pk},value_text&${key}=eq.${encodeURIComponent(id)}&igldata_id=eq.${def.id_sequence}&is_active=eq.true`,{headers:{Authorization:`Bearer ${session.token}`}});
  if(!r.ok)throw new Error(await r.text());
  const rows=await r.json();
  if(rows.length){
    const u=await fetch(`${DATA_API_URL}/${table}?${pk}=eq.${rows[0][pk]}`,{method:'PATCH',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify({is_active:false,updated_at:new Date().toISOString()})});
    if(!u.ok)throw new Error(await u.text());
  }
  chosen[type].delete(String(def.id_sequence));
  await renderFor(type);
}
async function renderFor(type){const box=document.getElementById(type==='CLIENT'?'clientAdditional':'userAdditional');if(!box)return;const id=selected[type];if(!id){box.innerHTML=`Selecciona un ${type==='CLIENT'?'cliente':'usuario'}.`;return}if(!allRows.length)await loadDefinitions();const defs=defsFor(type),values=await loadValues(type,id);Object.keys(values).forEach(k=>chosen[type].add(String(k)));const selectedDefs=defs.filter(d=>chosen[type].has(String(d.id_sequence)));const trash='<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>';box.innerHTML=`<form class="additional-form" data-additional-type="${type}"><div class="additional-picker-row"><div class="additional-picker-hint">Añadir dato adicional</div><button class="additional-more" type="button" title="Seleccionar dato" aria-label="Seleccionar dato">...</button></div>${selectedDefs.length?'<div class="toolstrip additional-toolstrip"><button class="tool-btn additional-save-top" type="submit" title="Guardar datos adicionales" aria-label="Guardar datos adicionales"><svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg></button></div>':''}<div class="additional-fields">${selectedDefs.map(d=>`<div class="additional-field-row"><div class="additional-field-name">${esc(d.name)}</div><div class="additional-field-control">${controlHtml(d,values[String(d.id_sequence)])}</div><button type="button" class="additional-remove" data-remove-def="${d.id_sequence}" title="Quitar dato adicional" aria-label="Quitar ${esc(d.name)}">${trash}</button></div>`).join('')}</div><div class="status additional-status"></div></form>`;box.querySelector('.additional-more').onclick=()=>openPicker(type);box.querySelectorAll('.additional-file-open').forEach(b=>b.addEventListener('click',async()=>{try{await openStoredFile(b.dataset.filePath)}catch(err){console.error(err);const s=box.querySelector('.additional-status');if(s){s.textContent='ERROR REAL: '+(err?.message||String(err));s.className='status additional-status error'}}}));box.querySelectorAll('[data-remove-def]').forEach(b=>b.addEventListener('click',async()=>{const def=selectedDefs.find(d=>String(d.id_sequence)===String(b.dataset.removeDef));if(!def)return;try{await removeAdditionalValue(type,id,def)}catch(err){console.error(err);const s=box.querySelector('.additional-status');if(s){s.textContent='ERROR REAL: '+(err?.message||String(err));s.className='status additional-status error'}}}));box.querySelector('form').addEventListener('submit',e=>saveAdditional(e,type,id,selectedDefs))}
async function saveAdditional(e,type,id,defs){
  e.preventDefault();await ensureSession();const form=e.currentTarget,status=form.querySelector('.additional-status');status.textContent='';status.className='status additional-status';
  const table=type==='CLIENT'?'client_data':'user_data',key=type==='CLIENT'?'client_id':'user_id',pk=type==='CLIENT'?'client_data_id':'user_data_id';
  try{
    for(const def of defs){
      const input=form.querySelector(`[data-igldata="${def.id_sequence}"]`);if(!input)continue;
      const ex=await fetch(`${DATA_API_URL}/${table}?select=${pk},value_text&${key}=eq.${encodeURIComponent(id)}&igldata_id=eq.${def.id_sequence}`,{headers:{Authorization:`Bearer ${session.token}`}});if(!ex.ok)throw new Error(await ex.text());const old=await ex.json();
      let value='';
      if(input.dataset.kind==='FILE'){
        const file=input.files?.[0];
        if(!file)continue;
        status.textContent=`Subiendo ${file.name}...`;status.className='status additional-status';
        value=await uploadAdditionalFile(type,id,def,file);
      }else{
        value=String(input.value??'').trim();
        if(!validate(def,value))throw new Error(`${def.name}: formato inválido. Debe cumplir ${def.format||'el formato configurado'}`);
      }
      if(old.length){
        const r=await fetch(`${DATA_API_URL}/${table}?${pk}=eq.${old[0][pk]}`,{method:'PATCH',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify({value_text:value||null,is_active:true,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(await r.text());
        if(input.dataset.kind==='FILE'&&old[0].value_text&&old[0].value_text!==value)deleteStoredFile(old[0].value_text);
      }else if(value){
        const payload={[key]:Number(id),igldata_id:Number(def.id_sequence),value_text:value,is_active:true};const r=await fetch(`${DATA_API_URL}/${table}`,{method:'POST',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(await r.text());
      }
    }
    status.textContent='Guardado.';status.className='status additional-status success';await renderFor(type);setTimeout(()=>{const s=document.querySelector(`[data-additional-type="${type}"] .additional-status`);if(s){s.textContent='';s.className='status additional-status'}},1300);
  }catch(err){console.error(err);status.textContent='ERROR REAL: '+(err?.message||String(err));status.className='status additional-status error'}
}
window.addEventListener('management:entity-selected',e=>{if(e.detail?.type==='CLIENT'||e.detail?.type==='USER'){selected[e.detail.type]=e.detail.id;chosen[e.detail.type]=new Set();renderFor(e.detail.type).catch(console.error)}});
let usersWired=false;function wireUsers(){const list=document.getElementById('usersList');if(!list||usersWired)return false;usersWired=true;list.addEventListener('click',e=>{const row=e.target.closest('.client-row');if(!row)return;selected.USER=row.dataset.id;chosen.USER=new Set();renderFor('USER').catch(console.error)});list.addEventListener('keydown',e=>{const row=e.target.closest('.client-row');if(row&&(e.key==='Enter'||e.key===' ')){selected.USER=row.dataset.id;chosen.USER=new Set();renderFor('USER').catch(console.error)}});return true}
const obs=new MutationObserver(()=>{if(wireUsers())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true});wireUsers();ensureSession().then(loadDefinitions).catch(console.error);
