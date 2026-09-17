const DATA_API_URL='https://ep-muddy-fire-awvetyx3.apirest.c-12.us-east-1.aws.neon.tech/americaestuya/rest/v1';
let reportSession={token:'',accountId:null};
let reportRows=[];
let reportColumns=[];

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

window.addEventListener('management:session',e=>{
  reportSession={token:e.detail.token,accountId:e.detail.accountId};
});

async function ensureSession(){
  if(reportSession.token)return reportSession;
  const [{getApps,getApp},{getAuth}]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);
  for(let i=0;i<80&&!getApps().length;i++)await new Promise(r=>setTimeout(r,100));
  const auth=getAuth(getApp());
  if(typeof auth.authStateReady==='function')await auth.authStateReady();
  if(!auth.currentUser)throw new Error('No hay una sesión activa');
  reportSession.token=await auth.currentUser.getIdToken();
  return reportSession;
}

function addReportMenu(){
  const nav=document.querySelector('.nav');
  if(nav&&!nav.querySelector('[data-section="report"]')){
    const a=document.createElement('a');
    a.href='#report';
    a.dataset.section='report';
    a.innerHTML='<span class="icon">📊</span><span>Generar Reporte</span>';
    a.addEventListener('click',e=>{
      e.preventDefault();
      window.managementShowSection?.('report');
    });
    nav.appendChild(a);
  }
  const picker=document.getElementById('sectionSelect');
  if(picker&&!picker.querySelector('option[value="report"]')){
    const o=document.createElement('option');
    o.value='report';
    o.textContent='Generar Reporte';
    picker.appendChild(o);
  }
}

function addReportSection(){
  if(document.getElementById('report'))return;
  const main=document.querySelector('main.content');
  const section=document.createElement('section');
  section.id='report';
  section.className='card section';
  section.innerHTML=`
    <style>
      .report-editor{width:100%;min-height:155px;border:1px solid #cbdbe7;border-radius:12px;padding:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:14px;line-height:1.45;color:#173f61;background:#fff;resize:vertical}
      .report-grid-wrap{margin-top:16px;overflow:auto;border:1px solid #dce7f0;border-radius:14px;max-height:58vh}
      .report-grid{border-collapse:collapse;width:max-content;min-width:100%;background:#fff}
      .report-grid th,.report-grid td{border-bottom:1px solid #e5edf3;border-right:1px solid #eef3f7;padding:9px 11px;text-align:left;white-space:nowrap}
      .report-grid th{position:sticky;top:0;background:#eef5fb;color:#214c6c;font-weight:900;z-index:1}
      .report-grid td{color:#355b76}
      .report-empty{padding:25px;text-align:center;color:#6b8295}
      .report-export-wrap{position:relative}
      .report-export-menu{display:none;position:absolute;top:44px;right:0;z-index:40;min-width:145px;background:#fff;border:1px solid #d7e4ed;border-radius:12px;box-shadow:0 12px 30px #153f6130;padding:6px}
      .report-export-menu.open{display:grid}
      .report-export-menu button{border:0;background:#fff;text-align:left;padding:10px;border-radius:8px;color:#244d6c;font-weight:700}
      .report-export-menu button:hover{background:#eef6fb}
    </style>
    <div class="toolstrip" id="reportToolbar">
      <button class="tool-btn" type="button" id="reportRun" title="Ejecutar query" aria-label="Ejecutar query"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
      <span class="tool-sep"></span>
      <span class="report-export-wrap">
        <button class="tool-btn" type="button" id="reportExport" title="Exportar" aria-label="Exportar"><svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg></button>
        <span class="report-export-menu" id="reportExportMenu">
          <button data-format="csv">CSV</button>
          <button data-format="pdf">PDF</button>
          <button data-format="excel">EXCEL</button>
          <button data-format="jpg">JPG</button>
        </span>
      </span>
    </div>
    <textarea id="reportSql" class="report-editor" spellcheck="false" placeholder="SELECT ...\nFROM tabla1 t1\nJOIN tabla2 t2 ON ...\nWHERE ...\nORDER BY ..."></textarea>
    <div id="reportStatus" class="status"></div>
    <div id="reportGridWrap" class="report-grid-wrap"><div class="report-empty">Escribe un SELECT y pulsa Query.</div></div>`;
  main.appendChild(section);
}

function normalizeAndValidateSql(sql){
  let text=String(sql??'').trim();
  if(!text)throw new Error('La consulta está vacía.');
  text=text.replace(/;\s*$/,'').trim();
  if(/;/.test(text))throw new Error('Usa una sola consulta SELECT.');
  if(!/^select\s/i.test(text))throw new Error('Solo SELECT está permitido.');
  if(/\sinto\s/i.test(text))throw new Error('SELECT INTO no está permitido.');
  return text;
}

function setStatus(text,type=''){
  const s=document.getElementById('reportStatus');
  s.textContent=text||'';
  s.className='status'+(type?' '+type:'');
}

function renderGrid(rows){
  reportRows=Array.isArray(rows)?rows:[];
  reportColumns=reportRows.length?[...new Set(reportRows.flatMap(r=>Object.keys(r)))]:[];
  const wrap=document.getElementById('reportGridWrap');
  if(!reportRows.length){
    wrap.innerHTML='<div class="report-empty">La consulta no devolvió filas.</div>';
    return;
  }
  wrap.innerHTML=`<table class="report-grid"><thead><tr>${reportColumns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${reportRows.map(r=>`<tr>${reportColumns.map(c=>`<td>${esc(r[c]==null?'':typeof r[c]==='object'?JSON.stringify(r[c]):r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

async function runReport(){
  try{
    setStatus('');
    const sql=normalizeAndValidateSql(document.getElementById('reportSql').value);
    await ensureSession();
    const r=await fetch(`${DATA_API_URL}/rpc/run_report_query`,{
      method:'POST',
      headers:{
        Authorization:`Bearer ${reportSession.token}`,
        'Content-Type':'application/json',
        'X-America-Raw-State':'1'
      },
      body:JSON.stringify({p_sql:sql})
    });
    if(!r.ok)throw new Error(await r.text());
    const data=await r.json();
    const rows=Array.isArray(data)?data:(Array.isArray(data?.result)?data.result:[]);
    renderGrid(rows);
    setStatus(`${rows.length} fila(s).`,'success');
  }catch(e){
    console.error(e);
    setStatus('ERROR REAL: '+(e?.message||e),'error');
  }
}

function download(blob,name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}

function exportCsv(){
  const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv=[reportColumns.map(q).join(','),...reportRows.map(r=>reportColumns.map(c=>q(r[c])).join(','))].join('\n');
  download(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),'reporte.csv');
}

function loadScript(src){
  return new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src=src;
    s.onload=res;
    s.onerror=rej;
    document.head.appendChild(s);
  });
}

async function exportExcel(){
  if(!reportRows.length)return;
  if(!window.XLSX)await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  const ws=XLSX.utils.json_to_sheet(reportRows,{header:reportColumns});
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Reporte');
  XLSX.writeFile(wb,'reporte.xlsx');
}

async function exportPdf(){
  if(!reportRows.length)return;
  if(!window.jspdf)await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
  if(!window.jspdf.jsPDF.API.autoTable)await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape'});
  doc.autoTable({head:[reportColumns],body:reportRows.map(r=>reportColumns.map(c=>String(r[c]??''))),styles:{fontSize:7}});
  doc.save('reporte.pdf');
}

function exportJpg(){
  if(!reportRows.length)return;
  const cw=180,rowH=28,w=Math.max(720,reportColumns.length*cw),h=Math.min(12000,(reportRows.length+1)*rowH+20);
  const c=document.createElement('canvas');
  c.width=w;
  c.height=h;
  const x=c.getContext('2d');
  x.fillStyle='#fff';
  x.fillRect(0,0,w,h);
  x.font='bold 14px Arial';
  x.fillStyle='#173f61';
  reportColumns.forEach((col,i)=>x.fillText(String(col).slice(0,22),i*cw+8,20));
  x.font='13px Arial';
  reportRows.slice(0,Math.floor((h-rowH)/rowH)).forEach((r,ri)=>{
    x.fillStyle='#355b76';
    reportColumns.forEach((col,i)=>x.fillText(String(r[col]??'').slice(0,24),i*cw+8,(ri+2)*rowH-8));
  });
  c.toBlob(b=>download(b,'reporte.jpg'),'image/jpeg',0.92);
}

function exportFormat(f){
  if(!reportRows.length){
    setStatus('Primero ejecuta una consulta.','error');
    return;
  }
  if(f==='csv')exportCsv();
  else if(f==='excel')exportExcel().catch(e=>setStatus(e.message,'error'));
  else if(f==='pdf')exportPdf().catch(e=>setStatus(e.message,'error'));
  else if(f==='jpg')exportJpg();
}

function wire(){
  addReportMenu();
  addReportSection();
  const picker=document.getElementById('sectionSelect');
  picker?.addEventListener('change',()=>{
    if(picker.value==='report')window.managementShowSection?.('report');
  },true);
  document.getElementById('reportRun').onclick=runReport;
  document.getElementById('reportExport').onclick=e=>{
    e.stopPropagation();
    document.getElementById('reportExportMenu').classList.toggle('open');
  };
  document.getElementById('reportExportMenu').addEventListener('click',e=>{
    const b=e.target.closest('[data-format]');
    if(!b)return;
    exportFormat(b.dataset.format);
    document.getElementById('reportExportMenu').classList.remove('open');
  });
  document.addEventListener('click',e=>{
    if(!e.target.closest('.report-export-wrap'))document.getElementById('reportExportMenu')?.classList.remove('open');
  });
  if(location.hash==='#report')window.managementShowSection?.('report');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
else wire();
