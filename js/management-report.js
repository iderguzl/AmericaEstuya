const DATA_API_URL='https://ep-muddy-fire-awvetyx3.apirest.c-12.us-east-1.aws.neon.tech/americaestuya/rest/v1';
let adminSession={token:'',accountId:null};
let adminRows=[];
let adminColumns=[];
let ownerAccess=false;

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

window.addEventListener('management:session',async e=>{
  adminSession={token:e.detail.token,accountId:e.detail.accountId};
  await refreshOwnerAccess();
});

async function ensureSession(){
  if(adminSession.token&&adminSession.accountId)return adminSession;
  const [{getApps,getApp},{getAuth}]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);
  for(let i=0;i<80&&!getApps().length;i++)await new Promise(r=>setTimeout(r,100));
  if(!getApps().length)throw new Error('Firebase no está inicializado');
  const auth=getAuth(getApp());
  if(typeof auth.authStateReady==='function')await auth.authStateReady();
  if(!auth.currentUser)throw new Error('No hay una sesión activa');
  adminSession.token=await auth.currentUser.getIdToken();
  const r=await fetch(`${DATA_API_URL}/accounts?select=account_id&auth_uid=eq.${encodeURIComponent(auth.currentUser.uid)}&limit=1`,{headers:{Authorization:`Bearer ${adminSession.token}`}});
  if(!r.ok)throw new Error(await r.text());
  const rows=await r.json();
  adminSession.accountId=rows[0]?.account_id??null;
  if(!adminSession.accountId)throw new Error('Cuenta no encontrada');
  return adminSession;
}

async function isOwner(){
  await ensureSession();
  const r=await fetch(`${DATA_API_URL}/account_access?select=role&account_id=eq.${encodeURIComponent(adminSession.accountId)}&limit=1`,{headers:{Authorization:`Bearer ${adminSession.token}`}});
  if(!r.ok)throw new Error(await r.text());
  const rows=await r.json();
  return rows[0]?.role==='OWNER';
}

function addAdminMenu(){
  const nav=document.querySelector('.nav');
  if(nav&&!nav.querySelector('[data-section="admin"]')){
    const a=document.createElement('a');
    a.href='#admin';
    a.dataset.section='admin';
    a.innerHTML='<span class="icon">🛠️</span><span>Administrar</span>';
    a.addEventListener('click',e=>{e.preventDefault();window.managementShowSection?.('admin')});
    nav.appendChild(a);
  }
  const picker=document.getElementById('sectionSelect');
  if(picker&&!picker.querySelector('option[value="admin"]')){
    const o=document.createElement('option');
    o.value='admin';
    o.textContent='Administrar';
    picker.appendChild(o);
  }
}

function removeAdminMenu(){
  document.querySelector('.nav [data-section="admin"]')?.remove();
  document.querySelector('#sectionSelect option[value="admin"]')?.remove();
  document.getElementById('admin')?.remove();
}

function addAdminSection(){
  if(document.getElementById('admin'))return;
  const main=document.querySelector('main.content');
  const section=document.createElement('section');
  section.id='admin';
  section.className='card section';
  section.innerHTML=`
    <style>
      .admin-editor{width:100%;min-height:190px;border:1px solid #cbdbe7;border-radius:12px;padding:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:14px;line-height:1.45;color:#173f61;background:#fff;resize:vertical}
      .admin-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .admin-action{border:1px solid #c8d9e6;background:#fff;color:#234f70;border-radius:10px;padding:9px 16px;font-weight:900;cursor:pointer}
      .admin-action:hover{background:#eef6fb}.admin-action.execute{border-color:#d8c5a9}
      .admin-grid-wrap{margin-top:16px;overflow:auto;border:1px solid #dce7f0;border-radius:14px;max-height:58vh}
      .admin-grid{border-collapse:collapse;width:max-content;min-width:100%;background:#fff}
      .admin-grid th,.admin-grid td{border-bottom:1px solid #e5edf3;border-right:1px solid #eef3f7;padding:9px 11px;text-align:left;white-space:nowrap}
      .admin-grid th{position:sticky;top:0;background:#eef5fb;color:#214c6c;font-weight:900;z-index:1}.admin-grid td{color:#355b76}
      .admin-empty{padding:25px;text-align:center;color:#6b8295}.admin-export-wrap{position:relative;margin-left:auto}
      .admin-export-menu{display:none;position:absolute;top:44px;right:0;z-index:40;min-width:145px;background:#fff;border:1px solid #d7e4ed;border-radius:12px;box-shadow:0 12px 30px #153f6130;padding:6px}
      .admin-export-menu.open{display:grid}.admin-export-menu button{border:0;background:#fff;text-align:left;padding:10px;border-radius:8px;color:#244d6c;font-weight:700}.admin-export-menu button:hover{background:#eef6fb}
      .admin-exec-results{display:grid;gap:8px}.admin-exec-item{padding:11px 13px;border-bottom:1px solid #e5edf3}.admin-exec-item:last-child{border-bottom:0}
    </style>
    <div class="toolstrip" id="adminToolbar">
      <div class="admin-actions">
        <button class="admin-action" type="button" id="adminQuery">Query</button>
        <button class="admin-action execute" type="button" id="adminExecute">Execute</button>
      </div>
      <span class="admin-export-wrap">
        <button class="tool-btn" type="button" id="adminExport" title="Exportar resultado" aria-label="Exportar resultado"><svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg></button>
        <span class="admin-export-menu" id="adminExportMenu"><button data-format="csv">CSV</button><button data-format="pdf">PDF</button><button data-format="excel">EXCEL</button><button data-format="jpg">JPG</button></span>
      </span>
    </div>
    <textarea id="adminSql" class="admin-editor" spellcheck="false" placeholder="Query: SELECT ...\n\nExecute: UPDATE ...;\nCREATE TABLE ...;\nALTER TABLE ...;"></textarea>
    <div id="adminStatus" class="status"></div>
    <div id="adminGridWrap" class="admin-grid-wrap"><div class="admin-empty">Escribe SQL y usa Query o Execute.</div></div>`;
  main.appendChild(section);
  wireAdminSection();
}

async function refreshOwnerAccess(){
  try{
    ownerAccess=await isOwner();
    if(!ownerAccess){
      removeAdminMenu();
      if(location.hash==='#admin'||location.hash==='#report')window.managementShowSection?.('account');
      return;
    }
    addAdminMenu();
    addAdminSection();
    if(location.hash==='#admin'||location.hash==='#report')window.managementShowSection?.('admin');
  }catch(e){
    console.error(e);
    ownerAccess=false;
    removeAdminMenu();
  }
}

function requireOwner(){if(!ownerAccess)throw new Error('Acceso denegado. Solo el propietario puede administrar SQL.')}

function normalizeQuery(sql){
  let text=String(sql??'').trim();
  if(!text)throw new Error('La consulta está vacía.');
  text=text.replace(/;\s*$/,'').trim();
  if(/;/.test(text))throw new Error('Query acepta una sola consulta SELECT.');
  if(!/^select\s/i.test(text))throw new Error('Query solo acepta SELECT. Usa Execute para UPDATE, CREATE, ALTER, etc.');
  if(/\sinto\s/i.test(text))throw new Error('SELECT INTO no está permitido en Query.');
  return text;
}

function splitSqlScript(text){
  const sql=String(text??'');
  const out=[];let start=0,i=0,state='normal',dollar='';
  while(i<sql.length){
    const c=sql[i],n=sql[i+1];
    if(state==='single'){if(c==="'"&&n==="'"){i+=2;continue}if(c==="'")state='normal';i++;continue}
    if(state==='double'){if(c==='"'&&n==='"'){i+=2;continue}if(c==='"')state='normal';i++;continue}
    if(state==='line'){if(c==='\n')state='normal';i++;continue}
    if(state==='block'){if(c==='*'&&n==='/'){state='normal';i+=2;continue}i++;continue}
    if(state==='dollar'){if(sql.startsWith(dollar,i)){i+=dollar.length;state='normal';continue}i++;continue}
    if(c==="'"){state='single';i++;continue}
    if(c==='"'){state='double';i++;continue}
    if(c==='-'&&n==='-'){state='line';i+=2;continue}
    if(c==='/'&&n==='*'){state='block';i+=2;continue}
    if(c==='$'){
      const m=sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if(m){dollar=m[0];state='dollar';i+=dollar.length;continue}
    }
    if(c===';'){
      const s=sql.slice(start,i).trim();if(s)out.push(s);start=i+1;
    }
    i++;
  }
  const tail=sql.slice(start).trim();if(tail)out.push(tail);
  return out;
}

function setStatus(text,type=''){const s=document.getElementById('adminStatus');if(!s)return;s.textContent=text||'';s.className='status'+(type?' '+type:'')}

function renderGrid(rows){
  adminRows=Array.isArray(rows)?rows:[];
  adminColumns=adminRows.length?[...new Set(adminRows.flatMap(r=>Object.keys(r)))]:[];
  const wrap=document.getElementById('adminGridWrap');
  if(!adminRows.length){wrap.innerHTML='<div class="admin-empty">La consulta no devolvió filas.</div>';return}
  wrap.innerHTML=`<table class="admin-grid"><thead><tr>${adminColumns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${adminRows.map(r=>`<tr>${adminColumns.map(c=>`<td>${esc(r[c]==null?'':typeof r[c]==='object'?JSON.stringify(r[c]):r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

async function runQuery(){
  try{
    requireOwner();setStatus('');
    const sql=normalizeQuery(document.getElementById('adminSql').value);
    await ensureSession();
    const r=await fetch(`${DATA_API_URL}/rpc/run_report_query`,{method:'POST',headers:{Authorization:`Bearer ${adminSession.token}`,'Content-Type':'application/json','X-America-Raw-State':'1'},body:JSON.stringify({p_sql:sql})});
    if(!r.ok)throw new Error(await r.text());
    const data=await r.json();const rows=Array.isArray(data)?data:(Array.isArray(data?.result)?data.result:[]);
    renderGrid(rows);setStatus(`${rows.length} fila(s).`,'success');
  }catch(e){console.error(e);setStatus('ERROR REAL: '+(e?.message||e),'error')}
}

async function runExecute(){
  try{
    requireOwner();setStatus('');
    const statements=splitSqlScript(document.getElementById('adminSql').value);
    if(!statements.length)throw new Error('El script está vacío.');
    if(statements.some(s=>/^\s*select\b/i.test(s)))throw new Error('Los SELECT se ejecutan con Query.');
    const destructive=statements.filter(s=>/^\s*(drop|truncate|delete)\b/i.test(s));
    if(destructive.length&&!confirm(`El script contiene ${destructive.length} operación(es) destructiva(s) (DROP/TRUNCATE/DELETE). ¿Ejecutar de todas formas?`))return;
    await ensureSession();
    const results=[];
    for(let i=0;i<statements.length;i++){
      const r=await fetch(`${DATA_API_URL}/rpc/admin_execute_statement`,{method:'POST',headers:{Authorization:`Bearer ${adminSession.token}`,'Content-Type':'application/json','X-America-Raw-State':'1'},body:JSON.stringify({p_sql:statements[i]})});
      if(!r.ok)throw new Error(`Sentencia ${i+1}: ${await r.text()}`);
      const data=await r.json();
      const result=Array.isArray(data)?data[0]:data;
      results.push({n:i+1,command:result?.command||'SQL',rows:result?.rows_affected??0});
    }
    adminRows=[];adminColumns=[];
    document.getElementById('adminGridWrap').innerHTML=`<div class="admin-exec-results">${results.map(x=>`<div class="admin-exec-item"><strong>${x.n}. ${esc(x.command)}</strong> · filas afectadas: ${esc(x.rows)}</div>`).join('')}</div>`;
    setStatus(`${results.length} sentencia(s) ejecutada(s) correctamente.`,'success');
  }catch(e){console.error(e);setStatus('ERROR REAL: '+(e?.message||e),'error')}
}

function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function exportCsv(){const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[adminColumns.map(q).join(','),...adminRows.map(r=>adminColumns.map(c=>q(r[c])).join(','))].join('\n');download(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),'query.csv')}
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
async function exportExcel(){if(!adminRows.length)return;if(!window.XLSX)await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');const ws=XLSX.utils.json_to_sheet(adminRows,{header:adminColumns});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Query');XLSX.writeFile(wb,'query.xlsx')}
async function exportPdf(){if(!adminRows.length)return;if(!window.jspdf)await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');if(!window.jspdf.jsPDF.API.autoTable)await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js');const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape'});doc.autoTable({head:[adminColumns],body:adminRows.map(r=>adminColumns.map(c=>String(r[c]??''))),styles:{fontSize:7}});doc.save('query.pdf')}
function exportJpg(){if(!adminRows.length)return;const cw=180,rowH=28,w=Math.max(720,adminColumns.length*cw),h=Math.min(12000,(adminRows.length+1)*rowH+20),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.font='bold 14px Arial';x.fillStyle='#173f61';adminColumns.forEach((col,i)=>x.fillText(String(col).slice(0,22),i*cw+8,20));x.font='13px Arial';adminRows.slice(0,Math.floor((h-rowH)/rowH)).forEach((r,ri)=>{x.fillStyle='#355b76';adminColumns.forEach((col,i)=>x.fillText(String(r[col]??'').slice(0,24),i*cw+8,(ri+2)*rowH-8))});c.toBlob(b=>download(b,'query.jpg'),'image/jpeg',0.92)}
function exportFormat(f){if(!adminRows.length){setStatus('Primero ejecuta un Query.','error');return}if(f==='csv')exportCsv();else if(f==='excel')exportExcel().catch(e=>setStatus(e.message,'error'));else if(f==='pdf')exportPdf().catch(e=>setStatus(e.message,'error'));else if(f==='jpg')exportJpg()}

function wireAdminSection(){
  document.getElementById('adminQuery').onclick=runQuery;
  document.getElementById('adminExecute').onclick=runExecute;
  document.getElementById('adminExport').onclick=e=>{e.stopPropagation();document.getElementById('adminExportMenu').classList.toggle('open')};
  document.getElementById('adminExportMenu').addEventListener('click',e=>{const b=e.target.closest('[data-format]');if(!b)return;exportFormat(b.dataset.format);document.getElementById('adminExportMenu').classList.remove('open')});
}

document.addEventListener('click',e=>{if(!e.target.closest('.admin-export-wrap'))document.getElementById('adminExportMenu')?.classList.remove('open')});
