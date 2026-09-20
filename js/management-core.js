const FIREBASE_CONFIG={apiKey:'AIzaSyCanpMR3uSiZAecwLYG9nWiXvaksJncX0U',authDomain:'americaestuya.firebaseapp.com',projectId:'americaestuya',storageBucket:'americaestuya.firebasestorage.app',messagingSenderId:'1071710933035',appId:'1:1071710933035:web:2443a0ec9f1405fcc61a6e',measurementId:'G-8K579LVLX1'};
const DATA_API_URL='https://ep-muddy-fire-awvetyx3.apirest.c-12.us-east-1.aws.neon.tech/americaestuya/rest/v1';

const status=document.getElementById('accountStatus');
const details=document.getElementById('accountDetails');
const picker=document.getElementById('sectionSelect');
const clientStatus=document.getElementById('clientStatus');
const clientForm=document.getElementById('clientForm');
const clientsList=document.getElementById('clientsList');
const fmt=v=>v?new Intl.DateTimeFormat('es-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
let currentToken='',currentAccount=null,clientsCache=[],selectedClientId=null,clientSortAsc=true;
let beneficiaryTypeDef=null,beneficiaryTypeOptions=[];

const icons={save:'<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>',new:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',edit:'<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',delete:'<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>',search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',filter:'<svg viewBox="0 0 24 24"><path d="M4 5h16l-6 7v6l-4 2v-8Z"/></svg>',sort:'<svg viewBox="0 0 24 24"><path d="M8 6v12M5 9l3-3 3 3M16 18V6M13 15l3 3 3-3"/></svg>',print:'<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>',export:'<svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg>'};
function toolButton(action,label,disabled=false){return `<button class="tool-btn" type="button" data-action="${action}" title="${label}" aria-label="${label}" ${disabled?'disabled':''}>${icons[action]}</button>`}
function buildTools(kind){const h=document.querySelector(`[data-tools="${kind}"]`);if(!h)return;const disableEdit=kind!=='clients',disableNew=kind==='account';h.innerHTML=toolButton('new','Nuevo',disableNew)+toolButton('edit','Modificar',disableEdit)+toolButton('delete','Eliminar',disableEdit)+(['clients','users'].includes(kind)?toolButton('save','Guardar'):"")+'<span class="tool-sep"></span>'+toolButton('search','Buscar',kind==='account')+toolButton('filter','Filtrar',kind==='account')+toolButton('sort','Ordenar ascendente/descendente',kind==='account')+'<span class="tool-sep"></span>'+toolButton('print','Imprimir')+toolButton('export','Exportar');h.addEventListener('click',e=>{const b=e.target.closest('.tool-btn');if(!b||b.disabled)return;handleTool(kind,b.dataset.action,b)})}
['account','clients'].forEach(buildTools);

function placeMobilePicker(id){const wrap=picker?.closest('.mobile-picker'),section=document.getElementById(id),toolbar=section?.querySelector('.toolstrip');if(wrap&&toolbar&&matchMedia('(max-width:760px)').matches)toolbar.insertAdjacentElement('afterend',wrap)}
function showSection(id){document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('.nav a').forEach(x=>x.classList.toggle('active',x.dataset.section===id));if(picker&&[...picker.options].some(o=>o.value===id))picker.value=id;placeMobilePicker(id);history.replaceState({managementSection:id},'',`#${id}`);if(id==='clients'&&currentAccount)loadClients();window.dispatchEvent(new CustomEvent('management:section',{detail:{id}}))}
window.managementShowSection=showSection;
document.querySelectorAll('.nav a').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();showSection(link.dataset.section)}));if(picker)picker.addEventListener('change',()=>showSection(picker.value));

function setClientMessage(message,type=''){clientStatus.textContent=message||'';clientStatus.className='status'+(type?' '+type:'')}
function normalizeName(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()}
async function loadBeneficiaryTypes(){
  if(beneficiaryTypeDef&&beneficiaryTypeOptions.length)return;
  const r=await fetch(`${DATA_API_URL}/igldata?select=id_sequence,id_parent,name,is_active,deleted_at&deleted_at=is.null&order=id_sequence.asc`,{headers:{Authorization:`Bearer ${currentToken}`}});
  if(!r.ok)throw new Error(await r.text());
  const rows=await r.json();
  beneficiaryTypeDef=rows.find(x=>normalizeName(x.name)==='TIPO RELACION'&&x.is_active!==false)||null;
  beneficiaryTypeOptions=beneficiaryTypeDef?rows.filter(x=>String(x.id_parent)===String(beneficiaryTypeDef.id_sequence)&&x.is_active!==false):[];
  const sel=document.getElementById('clientCategory');
  if(sel)sel.innerHTML='<option value="">Seleccione…</option>'+beneficiaryTypeOptions.map(x=>`<option value="${escapeHtml(x.name)}">${escapeHtml(x.name)}</option>`).join('');
}
async function loadClientCategory(clientId){
  if(!clientId||!beneficiaryTypeDef)return '';
  const r=await fetch(`${DATA_API_URL}/client_data?select=value_text,is_active&client_id=eq.${encodeURIComponent(clientId)}&igldata_id=eq.${beneficiaryTypeDef.id_sequence}`,{headers:{Authorization:`Bearer ${currentToken}`}});
  if(!r.ok)throw new Error(await r.text());
  const rows=await r.json();
  return rows.find(x=>x.is_active!==false)?.value_text||'';
}
async function saveClientCategory(clientId,value){
  if(!clientId||!beneficiaryTypeDef)return;
  const q=`${DATA_API_URL}/client_data?select=client_data_id&client_id=eq.${encodeURIComponent(clientId)}&igldata_id=eq.${beneficiaryTypeDef.id_sequence}`;
  const ex=await fetch(q,{headers:{Authorization:`Bearer ${currentToken}`}});
  if(!ex.ok)throw new Error(await ex.text());
  const rows=await ex.json();
  const now=new Date().toISOString();
  if(rows.length){
    const r=await fetch(`${DATA_API_URL}/client_data?client_data_id=eq.${rows[0].client_data_id}`,{method:'PATCH',headers:{Authorization:`Bearer ${currentToken}`,'Content-Type':'application/json'},body:JSON.stringify({value_text:value||null,is_active:!!value,updated_at:now})});
    if(!r.ok)throw new Error(await r.text());
  }else if(value){
    const r=await fetch(`${DATA_API_URL}/client_data`,{method:'POST',headers:{Authorization:`Bearer ${currentToken}`,'Content-Type':'application/json'},body:JSON.stringify({client_id:Number(clientId),igldata_id:Number(beneficiaryTypeDef.id_sequence),value_text:value,is_active:true})});
    if(!r.ok)throw new Error(await r.text());
  }
}
function resetClientForm(){clientId.value='';clientName.value='';clientEmail.value='';clientPhone.value='';clientActive.value='true';const c=document.getElementById('clientCategory');if(c)c.value=''}
async function openClientForm(client=null){
  resetClientForm();
  try{await loadBeneficiaryTypes()}catch(e){console.error(e);setClientMessage('No se pudieron cargar las categorías.','error')}
  if(client){
    clientId.value=client.client_id;clientName.value=client.name||'';clientEmail.value=client.email||'';clientPhone.value=client.phone||'';clientActive.value=String(client.is_active!==false);
    try{document.getElementById('clientCategory').value=await loadClientCategory(client.client_id)}catch(e){console.error(e)}
  }
  clientForm.classList.add('open');clientName.focus()
}
function closeClientForm(){clientForm.classList.remove('open');resetClientForm()}
document.getElementById('cancelClientBtn')?.addEventListener('click',closeClientForm);document.getElementById('clientSearchText')?.addEventListener('input',renderClients);document.getElementById('clientFilter')?.addEventListener('change',renderClients);
function escapeHtml(v){return String(v??'').replace(/[&<>'\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[m]))}
function visibleClients(){const q=clientSearchText.value.trim().toLowerCase(),f=clientFilter.value;return [...clientsCache].filter(c=>(!q||[c.name,c.email,c.phone].some(v=>String(v||'').toLowerCase().includes(q)))&&(f==='all'||(f==='active'&&c.is_active!==false)||(f==='inactive'&&c.is_active===false))).sort((a,b)=>{const n=String(a.name||'').localeCompare(String(b.name||''),'es',{sensitivity:'base'});return clientSortAsc?n:-n})}
function renderClients(){const rows=visibleClients();if(!rows.length){clientsList.innerHTML='<div class="no-items">Sin resultados</div>';return}clientsList.innerHTML=rows.map(c=>`<div class="client-row ${String(c.client_id)===String(selectedClientId)?'selected':''}" tabindex="0" data-id="${c.client_id}"><div><div class="client-name">${escapeHtml(c.name||'')}</div><div class="client-meta">${c.email?`<span>${escapeHtml(c.email)}</span>`:''}${c.phone?`<span>${escapeHtml(c.phone)}</span>`:''}</div></div><span class="client-state ${c.is_active===false?'off':''}">${c.is_active===false?'Inactivo':'Activo'}</span></div>`).join('');clientsList.querySelectorAll('.client-row').forEach(row=>{const select=()=>{selectedClientId=row.dataset.id;renderClients();window.dispatchEvent(new CustomEvent('management:entity-selected',{detail:{type:'CLIENT',id:selectedClientId}}))};row.addEventListener('click',select);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}})})}
async function loadClients(){if(!currentAccount||!currentToken)return;try{const r=await fetch(`${DATA_API_URL}/clients?select=client_id,name,email,phone,is_active,created_at,updated_at&account_id=eq.${currentAccount.account_id}`,{headers:{Authorization:`Bearer ${currentToken}`}});if(!r.ok)throw new Error(await r.text());clientsCache=await r.json();renderClients();setClientMessage('')}catch(e){console.error(e);setClientMessage('No se pudieron cargar los beneficiarios.','error')}}
clientForm?.addEventListener('submit',async e=>{e.preventDefault();if(!currentAccount||!currentToken)return;const id=clientId.value,payload={name:clientName.value.trim(),email:clientEmail.value.trim()||null,phone:clientPhone.value.trim()||null,is_active:clientActive.value==='true',updated_at:new Date().toISOString()},category=document.getElementById('clientCategory')?.value||'';if(!payload.name)return;let url=`${DATA_API_URL}/clients`,method='POST';if(id){url+=`?client_id=eq.${encodeURIComponent(id)}&account_id=eq.${currentAccount.account_id}`;method='PATCH'}else payload.account_id=currentAccount.account_id;try{await loadBeneficiaryTypes();const r=await fetch(url,{method,headers:{Authorization:`Bearer ${currentToken}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(await r.text());const saved=await r.json();const savedId=id||saved?.[0]?.client_id;if(savedId)await saveClientCategory(savedId,category);closeClientForm();selectedClientId=null;await loadClients();setClientMessage('Guardado.','success');setTimeout(()=>setClientMessage(''),1300)}catch(err){console.error(err);setClientMessage('No se pudo guardar.','error')}});
function selectedClient(){return clientsCache.find(c=>String(c.client_id)===String(selectedClientId))||null}
async function softDeleteClient(){const c=selectedClient();if(!c){setClientMessage('Selecciona un beneficiario.','error');return}if(!confirm(`¿Eliminar ${c.name}?`))return;try{const r=await fetch(`${DATA_API_URL}/clients?client_id=eq.${c.client_id}&account_id=eq.${currentAccount.account_id}`,{method:'PATCH',headers:{Authorization:`Bearer ${currentToken}`,'Content-Type':'application/json'},body:JSON.stringify({is_active:false,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(await r.text());selectedClientId=null;await loadClients()}catch(e){console.error(e);setClientMessage('No se pudo eliminar.','error')}}
function exportClients(){const rows=visibleClients(),esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=['Nombre,Correo,Telefono,Estado',...rows.map(c=>[c.name,c.email,c.phone,c.is_active===false?'Inactivo':'Activo'].map(esc).join(','))].join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='beneficiarios.csv';a.click();URL.revokeObjectURL(a.href)}
function exportAccount(){if(!currentAccount)return;const data={nombre:currentAccount.display_name,correo:currentAccount.email,creada:currentAccount.created_at,ultimo_acceso:currentAccount.last_login_at,estado:currentAccount.is_active};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cuenta.json';a.click();URL.revokeObjectURL(a.href)}
function closeExportPopover(){document.querySelector('.export-popover')?.remove()}
window.managementOpenExportMenu=function(button,kind,context={}){
  closeExportPopover();
  const menu=document.createElement('div');menu.className='export-popover';
  menu.innerHTML='<button type="button" data-format="pdf">PDF</button><button type="button" data-format="csv">CSV</button><button type="button" data-format="jpg">JPG</button>';
  document.body.appendChild(menu);
  const rect=button.getBoundingClientRect(),w=160;menu.style.left=Math.max(8,Math.min(innerWidth-w-8,rect.right-w))+'px';menu.style.top=Math.min(innerHeight-150,rect.bottom+6)+'px';
  menu.onclick=async e=>{const b=e.target.closest('[data-format]');if(!b)return;const format=b.dataset.format;closeExportPopover();const includeAdditional=confirm('¿Exportar todos los datos, incluyendo datos adicionales e imágenes?\n\nAceptar = todos los datos\nCancelar = solo datos principales');
    try{
      if(typeof window.managementExportRecord==='function')await window.managementExportRecord({...context,kind,format,includeAdditional});
      else if(kind==='clients')exportClients();else if(kind==='account')exportAccount();
    }catch(err){console.error(err);if(kind==='clients')setClientMessage('No se pudo exportar: '+(err?.message||err),'error')}
  };
};
document.addEventListener('click',e=>{if(!e.target.closest('.export-popover')&&!e.target.closest('[data-action="export"]'))closeExportPopover()});
function handleTool(kind,action,button){
  if(action==='print'){window.print();return}
  if(action==='export'){
    if(kind==='clients'){const c=selectedClient();if(!c){setClientMessage('Selecciona un beneficiario.','error');return}window.managementOpenExportMenu(button,'clients',{type:'CLIENT',id:c.client_id,parent:{Nombre:c.name,Correo:c.email||'',Telefono:c.phone||'',Estado:c.is_active===false?'Inactivo':'Activo'}});return}
    if(kind==='account'){window.managementOpenExportMenu(button,'account',{type:'ACCOUNT',id:currentAccount?.account_id,parent:{Nombre:currentAccount?.display_name||'',Correo:currentAccount?.email||'',Estado:currentAccount?.is_active?'Activo':'Inactivo'}});return}
    return
  }
  if(kind!=='clients')return;
  if(action==='save'){
    let did=false;
    if(clientForm?.classList.contains('open')){clientForm.requestSubmit();did=true}
    if(selectedClientId&&typeof window.managementSaveAdditional==='function'){window.managementSaveAdditional('CLIENT');did=true}
    if(!did)setClientMessage('No hay cambios para guardar.','error');
    return
  }
  if(action==='new'){selectedClientId=null;renderClients();openClientForm();return}
  if(action==='edit'){const c=selectedClient();c?openClientForm(c):setClientMessage('Selecciona un beneficiario.','error');return}
  if(action==='delete'){softDeleteClient();return}
  if(action==='search'){clientSearch.classList.toggle('open');button.classList.toggle('active');return}
  if(action==='filter'){clientSearch.classList.add('open');clientFilter.focus();return}
  if(action==='sort'){clientSortAsc=!clientSortAsc;button.classList.toggle('active',!clientSortAsc);button.title=clientSortAsc?'Ordenar ascendente':'Ordenar descendente';renderClients()}
}
async function loadAccount(){try{const [{initializeApp,getApps,getApp},{getAuth,onAuthStateChanged}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')]);const app=getApps().length?getApp():initializeApp(FIREBASE_CONFIG),auth=getAuth(app);onAuthStateChanged(auth,async user=>{if(!user){status.textContent='No hay una sesión activa.';status.classList.add('error');return}try{currentToken=await user.getIdToken();const r=await fetch(`${DATA_API_URL}/accounts?select=account_id,email,display_name,created_at,last_login_at,is_active&auth_uid=eq.${encodeURIComponent(user.uid)}`,{headers:{Authorization:`Bearer ${currentToken}`}});if(!r.ok)throw new Error(await r.text());const rows=await r.json();currentAccount=rows[0];if(!currentAccount)throw new Error('Cuenta no encontrada');displayName.textContent=currentAccount.display_name||'—';email.textContent=currentAccount.email||'—';createdAt.textContent=fmt(currentAccount.created_at);lastLoginAt.textContent=fmt(currentAccount.last_login_at);isActive.textContent=currentAccount.is_active?'Activo':'Inactivo';isActive.className='value '+(currentAccount.is_active?'active-value':'');status.textContent='';status.classList.remove('error');details.hidden=false;window.dispatchEvent(new CustomEvent('management:session',{detail:{accountId:currentAccount.account_id,token:currentToken}}));if(document.getElementById('clients').classList.contains('active'))loadClients()}catch(e){console.error(e);status.textContent='No se pudo cargar la cuenta.';status.classList.add('error')}})}catch(e){console.error(e);status.textContent='No se pudo cargar la cuenta.';status.classList.add('error')}}
const initial=(location.hash||'#account').slice(1);const allowed=['account','clients','relationships','configuration','report'];if(initial!=='report')showSection(allowed.includes(initial)?initial:'account');
addEventListener('resize',()=>{const id=document.querySelector('.section.active')?.id;if(id)placeMobilePicker(id)});placeMobilePicker(document.querySelector('.section.active')?.id||'account');
loadAccount();
