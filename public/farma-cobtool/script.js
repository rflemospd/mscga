/* ===== TEMA GLOBAL (PERSISTENTE) ===== */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  const btn=document.getElementById('toggleTheme');
  if(btn){
    const dark=(t==='dark');
    btn.setAttribute('aria-pressed', String(!dark));
    btn.innerHTML= dark
      ? '<i class="bi bi-brightness-high" aria-hidden="true"></i>'
      : '<i class="bi bi-moon" aria-hidden="true"></i>';
    btn.setAttribute('aria-label', dark ? 'Alternar para tema claro' : 'Alternar para tema escuro');
  }
  localStorage.setItem('ch_theme', t);
}
(function initTheme(){
  const saved=localStorage.getItem('ch_theme');
  applyTheme(saved==='light'?'light':'dark');
})();

(function initMessageCounter(){
  const STORAGE_KEY='ct_message_counter_v1';
  const LIMIT=200;
  const DAY_MS=24*60*60*1000;

  const sentEl=document.getElementById('msg-counter-sent');
  const remainingEl=document.getElementById('msg-counter-remaining');
  const decreaseBtn=document.getElementById('msg-counter-decrease');
  const increaseBtn=document.getElementById('msg-counter-increase');

  if(!sentEl||!remainingEl||!decreaseBtn||!increaseBtn) return;

  let expiryTimer=null;

  function nowMs(){ return Date.now(); }

  function cleanup(entries){
    const now=nowMs();
    return (Array.isArray(entries)?entries:[])
      .map(v=>Number(v))
      .filter(v=>Number.isFinite(v) && (now-v)<DAY_MS && v<=now)
      .sort((a,b)=>a-b);
  }

  function readEntries(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw) return [];
      const parsed=JSON.parse(raw);
      return cleanup(parsed?.entries);
    }catch(_e){
      return [];
    }
  }

  function writeEntries(entries){
    const clean=cleanup(entries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({entries:clean}));
    return clean;
  }

  function render(entries){
    const sent=entries.length;
    const remaining=Math.max(0, LIMIT-sent);
    sentEl.textContent=String(sent);
    remainingEl.textContent=String(remaining);
    decreaseBtn.disabled=sent<=0;
    increaseBtn.disabled=remaining<=0;
  }

  function scheduleNextSync(entries){
    if(expiryTimer){
      clearTimeout(expiryTimer);
      expiryTimer=null;
    }
    if(!entries.length) return;
    const now=nowMs();
    const nextExpireIn=Math.max(200, (entries[0]+DAY_MS)-now+50);
    expiryTimer=setTimeout(()=>{ sync(); }, nextExpireIn);
  }

  function sync(){
    const entries=writeEntries(readEntries());
    render(entries);
    scheduleNextSync(entries);
    return entries;
  }

  function addMessage(){
    const entries=sync();
    if(entries.length>=LIMIT) return;
    entries.push(nowMs());
    const updated=writeEntries(entries);
    render(updated);
    scheduleNextSync(updated);
  }

  function removeMessage(){
    const entries=sync();
    if(!entries.length) return;
    entries.pop();
    const updated=writeEntries(entries);
    render(updated);
    scheduleNextSync(updated);
  }

  decreaseBtn.addEventListener('click', removeMessage);
  increaseBtn.addEventListener('click', addMessage);
  window.addEventListener('storage',e=>{
    if(e.key===STORAGE_KEY) sync();
  });

  window.ctMessageCounter={
    increment:addMessage,
    decrement:removeMessage,
    sync,
    getSnapshot(){
      const entries=readEntries();
      return {sent:entries.length, remaining:Math.max(0, LIMIT-entries.length)};
    }
  };

  sync();
})();



/* ===== UTILIDADES ===== */
const onlyDigits = s => (s||'').replace(/\D+/g,'');
const normalizeCodigo = raw => {
  const digits=onlyDigits(raw).slice(0,6);
  return digits ? digits.padStart(6,'0') : '';
};
const normalizeCnpj = raw => {
  const digits=onlyDigits(raw).slice(0,14);
  return digits.length===14 ? digits : '';
};
function lowerEmailsInData(data){
  let changed=false;
  const seen=new WeakSet();
  function walk(val){
    if(!val || typeof val!=='object') return;
    if(seen.has(val)) return;
    seen.add(val);
    if(Array.isArray(val)){
      for(let i=0;i<val.length;i++){
        const v=val[i];
        if(typeof v==='string' && v.includes('@')){
          const lower=v.toLowerCase();
          if(lower!==v){ val[i]=lower; changed=true; }
        }else if(v && typeof v==='object'){
          walk(v);
        }
      }
      return;
    }
    Object.keys(val).forEach(k=>{
      const v=val[k];
      if(typeof v==='string' && v.includes('@')){
        const lower=v.toLowerCase();
        if(lower!==v){ val[k]=lower; changed=true; }
      }else if(v && typeof v==='object'){
        walk(v);
      }
    });
  }
  walk(data);
  return changed;
}
const pad2=n=>String(n).padStart(2,'0');
function parseBR(str){
  if(!str) return 0;
  const n=Number(String(str).trim().replace(/\./g,'').replace(',','.'));
  return Number.isFinite(n)?n:0;
}
function formatBR(num){
  const fixed=Math.round((num+Number.EPSILON)*100)/100;
  return fixed.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function toTitleCase(str){
  return (str||'').toLowerCase().replace(/\S+/g, w => w[0]?.toUpperCase()+w.slice(1));
}
function cleanNF(s){
  if(!s) return '';
  let base=String(s).trim().replace(/-.*/,'').replace(/^0+/, '');
  return base||'0';
}
function formatCNPJCustom(raw){
  const d = onlyDigits(raw).slice(0,14); let i=0;
  const g1=d.slice(i,i+=2), g2=d.slice(i,i+=3), g3=d.slice(i,i+=3),
        g4=d.slice(i,i+=4), g5=d.slice(i,i+=2);
  return (g1||'')+(g2?'.'+g2:'')+(g3?'.'+g3:'')+(g4?'/'+g4:'')+(g5?'-'+g5:'');
}
function formatTelefoneCob(raw){
  let digits=onlyDigits(raw||'');
  if(digits.startsWith('55')) digits=digits.slice(2);
  if(digits.length>11) digits=digits.slice(-11);
  if(!digits) return '+55';
  if(digits.length<=2) return `+55 ${digits}`;
  const ddd=digits.slice(0,2);
  const rest=digits.slice(2);
  if(rest.length>4){
    return `+55 ${ddd} ${rest.slice(0,-4)}-${rest.slice(-4)}`;
  }
  return `+55 ${ddd} ${rest}`;
}
function guardDigits(el,max){
  el.value=onlyDigits(el.value||'').slice(0,max);
}
function guardUF(el){
  el.value=String(el.value||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,2);
}
function getDateISOInGMT3(){
  try{
    const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit'});
    return fmt.format(new Date());
  }catch(_e){
    const now=new Date();
    const utcMs=now.getTime()+now.getTimezoneOffset()*60000;
    const target=new Date(utcMs - 180*60000);
    return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;
  }
}
function parseDateInputToISO(raw){
  const value=String(raw||'').trim();
  if(!value) return '';
  let y=0, m=0, d=0;
  const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso){
    y=Number(iso[1]); m=Number(iso[2]); d=Number(iso[3]);
  }else{
    const br=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!br) return '';
    d=Number(br[1]); m=Number(br[2]); y=Number(br[3]);
  }
  if(!y || !m || !d) return '';
  const dt=new Date(y,m-1,d);
  if(dt.getFullYear()!==y || dt.getMonth()!==m-1 || dt.getDate()!==d) return '';
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function formatDateBRInput(raw){
  const digits=onlyDigits(raw||'').slice(0,8);
  if(!digits) return '';
  if(digits.length<=2) return digits;
  if(digits.length<=4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
  return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
}
function resolveInputDateISOOrNow(raw){
  return parseDateInputToISO(raw) || getDateISOInGMT3();
}
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}
function maskCNPJInput(e){
  const el=e.target, pos=el.selectionStart, before=onlyDigits(el.value).length;
  el.value=formatCNPJCustom(el.value);
  const after=onlyDigits(el.value).length, delta=after-before;
  try{
    el.setSelectionRange(Math.max(0,(pos||0)+delta), Math.max(0,(pos||0)+delta));
}catch{}
}
const maskCNPJValue = val => (typeof onlyDigits==='function' ? onlyDigits(val) : String(val||'').replace(/\D+/g,''));
function formatBRDateFromISO(iso){
  if(!iso) return '';
  const datePart=String(iso).split('T')[0];
  const [y,m,d]=datePart.split('-').map(Number);
  if(!y||!m||!d) return '';
  const dt=new Date(y,m-1,d);
  if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d) return '';
  return negFormatDateBR(dt);
}
function negParseISODate(val){
  if(!val) return null;
  const [y,m,d]=val.split('-').map(Number);
  if(!y||!m||!d) return null;
  const dt=new Date(y,m-1,d);
  if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d) return null;
  return dt;
}

function bindGlobalCNPJInputs(){
  document.querySelectorAll('[data-cnpj-mask]').forEach(inp=>{
    inp.addEventListener('input',maskCNPJInput);
  });
}
function maskPhoneInput(e){
  const el=e.target;
  let digits=(el.value||'').replace(/\D+/g,'');
  if(digits.length>11 && digits.startsWith('55')){
    digits=digits.slice(2);
  }
  if(digits.length>11){
    digits=digits.slice(digits.length-11);
  }
  let formatted=digits;
  if(digits.length>=2 && digits.length<=6){
    formatted='('+digits.slice(0,2)+') '+digits.slice(2);
  }else if(digits.length>6 && digits.length<=10){
    const ddd=digits.slice(0,2);
    const meio=digits.slice(2,digits.length-4);
    const fim=digits.slice(-4);
    formatted='('+ddd+') '+meio+'-'+fim;
  }else if(digits.length===11){
    const ddd=digits.slice(0,2);
    const meio=digits.slice(2,7);
    const fim=digits.slice(7);
    formatted='('+ddd+') '+meio+'-'+fim;
  }
  el.value=formatted;
}

/* ===== RIPPLE ===== */
(function rippleAll(){
  document.addEventListener('pointerdown',e=>{
    const el=e.target.closest('.btn,.card');
    if(!el) return;
    const r=el.getBoundingClientRect();
    el.style.setProperty('--rx',(e.clientX-r.left)+'px');
    el.style.setProperty('--ry',(e.clientY-r.top)+'px');
    el.classList.add('rippling');
    setTimeout(()=>el.classList.remove('rippling'),450);
  },{passive:true});
})();

/* ===== NAVEGAÇÃO ENTRE PÁGINAS ===== */
const pages=['home','menu-formatacao','menu-esfera','menu-cadastro','formatacao','compensacoes','import-export','formatacao-texto','formatacao-cobrancas','negociacoes','neg-cadastro','neg-cad-negociacoes','neg-andamento','neg-finalizadas','neg-canceladas','registro-representantes','transferencias','notificacao-extrajudicial','alfa','emissao-boletos','registro-contato'];
const PAGE_PARENT={
  home:null,
  'menu-formatacao':'home',
  'menu-esfera':'home',
  'menu-cadastro':'home',
  negociacoes:'menu-esfera',
  'neg-menu':'menu-esfera',
  'neg-cadastro':'home',
  'cadastro-clientes':'home',
  'neg-cad-negociacoes':'negociacoes',
  'neg-andamento':'negociacoes',
  'neg-finalizadas':'negociacoes',
  'neg-canceladas':'negociacoes',
  'registro-representantes':'menu-cadastro',
  transferencias:'menu-esfera',
  'notificacao-extrajudicial':'home',
  alfa:'home',
  'emissao-boletos':'menu-esfera',
  'registro-contato':'menu-esfera',
  formatacao:'menu-formatacao',
  'formatacao-texto':'menu-formatacao',
  'formatacao-cobrancas':'menu-formatacao',
  compensacoes:'menu-esfera',
  'import-export':'home'
};
let currentPage='home';
const pageIds={
  negociacoes:'neg-menu',
  'neg-cadastro':'neg-cadastro',
  'neg-cad-negociacoes':'neg-cad-negociacoes',
  'neg-andamento':'neg-andamento',
  'neg-finalizadas':'neg-finalizadas',
  'neg-canceladas':'neg-canceladas',
  'registro-representantes':'registro-representantes',
  'menu-cadastro':'menu-cadastro',
  'emissao-boletos':'emissao-boletos',
  'registro-contato':'registro-contato'
};
function clearPageFields(pageKey){
  if(!pageKey) return;
  const sectionId=`page-${pageIds[pageKey]||pageKey}`;
  const pageEl=document.getElementById(sectionId);
  if(!pageEl) return;
  pageEl.querySelectorAll('input, textarea').forEach(el=>{
    const type=(el.getAttribute('type')||'text').toLowerCase();
    if(type==='checkbox' || type==='radio' || type==='range') return;
    el.value='';
  });
  if(pageKey==='neg-cad-negociacoes'){
    const txt=document.getElementById('neg-compensacao-out');
    if(txt) txt.value='';
  }
}
function setPage(pg){
  const prev=currentPage;
  currentPage=pg;
  if(prev && prev!==pg){
    clearPageFields(prev);
    if(prev==='transferencias' && typeof window.__cobtoolTransferenciasHideForm==='function'){
      window.__cobtoolTransferenciasHideForm();
    }
  }
  const pageIdForPg=pageIds[pg]||pg;
  const hasPageEl=!!document.getElementById(`page-${pageIdForPg}`);
  const registeredPage=pages.includes(pg);

  pages.forEach(p=>{
    document.querySelectorAll(`[data-page="${p}"]`).forEach(btn=>{
      btn.classList.toggle('primary', p===pg);
    });
    const pageId=pageIds[p]||p;
    document.getElementById(`page-${pageId}`)?.classList.toggle('active', p===pg);
  });

  if(!registeredPage && hasPageEl){
    document.querySelectorAll(`[data-page="${pg}"]`).forEach(btn=>btn.classList.add('primary'));
    document.getElementById(`page-${pageIdForPg}`)?.classList.add('active');
  }

  if(!hasPageEl){
    currentPage='home';
    document.getElementById('page-home')?.classList.add('active');
    document.querySelectorAll('[data-page]').forEach(btn=>{
      btn.classList.toggle('primary', btn.getAttribute('data-page')==='home');
    });
  }

  localStorage.setItem('ch_last_page', pg);
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const popTargets={
      home:'#page-home .home-card',
      'menu-formatacao':'#page-menu-formatacao .home-card',
      'menu-esfera':'#page-menu-esfera .home-card',
      'menu-cadastro':'#page-menu-cadastro .home-card',
      formatacao:'#page-formatacao .panel-section, #page-formatacao .card.output-wrap',
      compensacoes:'#page-compensacoes .panel-section, #page-compensacoes .card.output-wrap',
      'import-export':'#page-import-export .panel-section, #page-import-export .card',
      'formatacao-texto':'#page-formatacao-texto .panel-section, #page-formatacao-texto .card',
      'formatacao-cobrancas':'#page-formatacao-cobrancas .panel-section, #page-formatacao-cobrancas .card',
      negociacoes:'#page-neg-menu .home-card',
      'neg-cadastro':'#page-neg-cadastro .panel-section, #page-neg-cadastro .card',
      'neg-cad-negociacoes':'#page-neg-cad-negociacoes .panel-section, #page-neg-cad-negociacoes .card',
      'neg-andamento':'#page-neg-andamento .panel-section, #page-neg-andamento .card',
      transferencias:'#page-transferencias .panel-section, #page-transferencias .card',
      'notificacao-extrajudicial':'#page-notificacao-extrajudicial .panel-section, #page-notificacao-extrajudicial .card',
      alfa:'#page-alfa .panel-section, #page-alfa .card',
      'emissao-boletos':'#page-emissao-boletos .panel-section, #page-emissao-boletos .card',
      'registro-contato':'#page-registro-contato .panel-section, #page-registro-contato .card'
    };
    const sel=popTargets[currentPage] || (hasPageEl ? `#page-${pageIdForPg} .panel-section, #page-${pageIdForPg} .card` : '');
    if(sel){
      document.querySelectorAll(sel).forEach(el=>{
        el.classList.remove('pop-anim'); void el.offsetWidth; el.classList.add('pop-anim');
      });
    }
  }
}
document.querySelectorAll('[data-page]').forEach(btn=>{
  btn.addEventListener('click',()=>setPage(btn.getAttribute('data-page')));
});
const navBrand=document.getElementById('nav-brand');
if(navBrand){
  navBrand.addEventListener('click',e=>{
    if(e.target.closest('.cnpj-convert')) return;
    setPage('home');
  });
  navBrand.addEventListener('keydown',e=>{
    if(e.target.closest('.cnpj-convert')) return;
    if(e.key==='Enter' || e.key===' '){
      e.preventDefault();
      setPage('home');
    }
  });
}
(function initNavbarMenu(){
  const menuToggle=document.getElementById('nav-menu-toggle');
  const menuPanel=document.getElementById('nav-menu-panel');
  const menuDropdown=document.getElementById('nav-menu-dropdown');
  if(!menuToggle || !menuPanel || !menuDropdown) return;

  const setExpanded=(expanded)=>{
    menuToggle.setAttribute('aria-expanded', String(expanded));
    menuPanel.hidden=!expanded;
  };

  menuToggle.addEventListener('click',e=>{
    e.stopPropagation();
    const expanded=menuToggle.getAttribute('aria-expanded')==='true';
    setExpanded(!expanded);
  });

  menuPanel.addEventListener('click',e=>{
    if(e.target.closest('[data-page], #toggleTheme')) setExpanded(false);
  });

  document.addEventListener('click',e=>{
    if(!menuDropdown.contains(e.target)) setExpanded(false);
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape') setExpanded(false);
  });
})();

document.addEventListener('input',e=>{
  const el=e.target;
  if(!(el instanceof HTMLInputElement)) return;
  if(el.closest('.cnpj-convert')) return;
  if(el.classList.contains('guard-codigo')) guardDigits(el,6);
  if(el.classList.contains('guard-cnpj')) guardDigits(el,14);
  if(el.classList.contains('guard-uf')) guardUF(el);
  if(el.classList.contains('guard-date-br')) el.value=formatDateBRInput(el.value);
});
document.addEventListener('blur',e=>{
  const el=e.target;
  if(!(el instanceof HTMLInputElement)) return;
  if(el.closest('.cnpj-convert')) return;
  if(el.classList.contains('guard-codigo')){
    const normalized=normalizeCodigo(el.value);
    el.value=normalized || '';
  }
  if(el.classList.contains('guard-telefone')){
    el.value=formatTelefoneCob(el.value);
  }
  if(el.classList.contains('guard-date-br')){
    const iso=parseDateInputToISO(el.value);
    if(iso){
      el.value=formatBRDateFromISO(iso);
    }else{
      el.value=formatDateBRInput(el.value);
    }
  }
}, true);

/* ===== NOTIFICACAO EXTRAJUDICIAL ===== */
async function neGeneratePDF(){
  const razao=String(document.getElementById('ne-razao')?.value||'').trim();
  const cnpjRaw=String(document.getElementById('ne-cnpj')?.value||'').trim();
  const dateRaw=String(document.getElementById('ne-data')?.value||'').trim();
  const titulos=String(document.getElementById('ne-titulos')?.value||'').trim();
  const esfera=document.getElementById('ne-esfera')?.checked ? 'PRATI' : 'NDS';

  if(!razao && !cnpjRaw && !titulos){
    alert('Preencha pelo menos Raz�o Social, CNPJ ou T�tulos.');
    return;
  }
  if(!window.PDFLib || !window.pdfjsLib){
    alert('Bibliotecas de PDF n�o carregadas.');
    return;
  }
  if(window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions){
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const titulosLineCount=String(titulos||'')
    .split(/\r?\n/)
    .map(line=>line.trim())
    .filter(Boolean)
    .length;
  let baseLineCount=4;
  if(titulosLineCount>=5){
    baseLineCount=Math.min(titulosLineCount, 31);
  }
  const baseSuffix=`_${String(baseLineCount).padStart(2,'0')}tl.pdf`;
  const baseFileName=esfera==='PRATI'
    ? `PRATI${baseSuffix}`
    : `NDS${baseSuffix}`;
  const baseUrl='notifica%C3%A7%C3%A3o/' + encodeURIComponent(baseFileName);

  let pdfBytes;
  try{
    const res=await fetch(baseUrl);
    if(!res.ok) throw new Error('Base PDF n�o encontrada.');
    pdfBytes=await res.arrayBuffer();
  }catch(_err){
    alert('N�o foi poss�vel carregar o PDF base.');
    return;
  }

  const {PDFDocument, StandardFonts, rgb}=window.PDFLib;
  const pdfDoc=await PDFDocument.load(pdfBytes);
    const pdfPages=pdfDoc.getPages();
    const page1=pdfPages[0];
    const page2=pdfPages[1] || null;
  const font=await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont=await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  async function getTextItems(pageNum){
    const loadingTask=window.pdfjsLib.getDocument({data: pdfBytes});
    const pdf=await loadingTask.promise;
    const pdfPage=await pdf.getPage(pageNum||1);
    const viewport=pdfPage.getViewport({scale:1});
    const textContent=await pdfPage.getTextContent();
    return {items:textContent.items||[], viewport};
  }

  function findItem(itemsList, matcher){
    return itemsList.find(it=>matcher(String(it.str||'').trim()));
  }

  function toPdfRect(item, viewport){
    const xV=item.transform[4];
    const yV=item.transform[5];
    const heightV=Math.abs(item.transform[3]) || item.height || 12;
    const widthV=item.width || 0;
    const p1=viewport.convertToPdfPoint(xV, yV);
    const p2=viewport.convertToPdfPoint(xV + widthV, yV - heightV);
    const x=p1[0];
    const yTop=p1[1];
    const yBottom=p2[1];
    const width=Math.abs(p2[0] - p1[0]);
    const height=Math.abs(yTop - yBottom);
    const fontSize=height || Math.max(10, Math.min(13, heightV || 11));
    return {x, yTop, yBottom, width, height, fontSize};
  }

  function drawReplaceText(item, viewport, text, size, isBold, pageTarget, offsetX=0, offsetY=0){
    if(!item) return false;
    const rect=toPdfRect(item, viewport);
      const target=pageTarget || page1;
    const fontSize=size || rect.fontSize;
    const textWidth=font.widthOfTextAtSize(text, fontSize);
    const padX=10;
    const padY=6;
    const clearW=Math.max(rect.width, textWidth) + padX * 2;
    const clearH=Math.max(rect.height, fontSize) * 1.4 + padY;
    const rectBottom=rect.yTop - clearH;
    const textY=rectBottom + (clearH - fontSize) * 0.5;
    target.drawRectangle({
      x: rect.x - padX + offsetX,
      y: rectBottom + offsetY,
      width: clearW,
      height: clearH,
      color: rgb(1,1,1)
    });
    if(String(text||'').trim()){
      const drawFont=isBold ? boldFont : font;
      target.drawText(text, {x: rect.x + offsetX, y: textY + offsetY, size: fontSize, font: drawFont, color: rgb(0,0,0)});
    }
    return true;
  }

  function drawTextAt(x, yTop, fontSize, text, isBold, pageTarget){
    if(!String(text||'').trim()) return false;
    const y = yTop - fontSize;
      const target=pageTarget || page1;
    const drawFont=isBold ? boldFont : font;
    target.drawText(text, {x, y, size: fontSize, font: drawFont, color: rgb(0,0,0)});
    return true;
  }

  function parseTitulos(raw){
  const rows=String(raw||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  return rows.map(line=>{
    let parts=line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/);
    parts=parts.map(p=>p.trim()).filter(Boolean);
    if(parts.length<4){
      parts=line.split(/\s+/).map(p=>p.trim()).filter(Boolean);
    }
    if(parts.length>=5){
      return [parts[0], parts[1], parts[3], parts[4]];
    }
    return [parts[0]||'', parts[1]||'', parts[2]||'', parts[3]||''];
  });
}
  let items=[];
  let viewport=null;
  try{
    const textItems=await getTextItems(1);
    items=textItems.items||[];
    viewport=textItems.viewport;
  }catch(_e){
    alert('Falha ao ler texto do PDF base.');
    return;
  }
  if(!viewport){
    alert('Falha ao ler o viewport do PDF base.');
    return;
  }
  const razaoItem=findItem(items, s=>s.toUpperCase().includes('L R PEREIRA JUNIOR LTDA'));
  const cnpjItem=findItem(items, s=>s.toUpperCase().startsWith('CNPJ:'));
  const dataItem=findItem(items, s=>/toledo,\s*\d{2}\s+de\s+/i.test(s));

  const cnpjDigits=onlyDigits(cnpjRaw);
  const cnpj=cnpjDigits.length===14 ? formatCNPJCustom(cnpjDigits) : cnpjRaw;
  const razaoText=(razao || '').toLocaleUpperCase('pt-BR');
  const cnpjText=cnpj ? `CNPJ: ${cnpj}` : '';
  const dateIso=resolveInputDateISOOrNow(dateRaw);
  const partsDate=dateIso.split('-').map(Number);
  const meses=['janeiro','fevereiro','mar�o','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const yy=partsDate[0], mm=partsDate[1], dd=partsDate[2];
  const dataLinha=dd && mm && yy
    ? 'Toledo, '+String(dd).padStart(2,'0')+' de '+(meses[mm-1]||'')+' de '+yy
    : '';
  let razaoPlaced=false;
  let cnpjPlaced=false;
  // Regra solicitada: Razão Social deve ficar acima do CNPJ.
  // Quando ambos os campos de referência existem no PDF-base, invertemos os alvos.
  const swapRazaoAndCnpj=!!(razaoItem && cnpjItem);
  const razaoTarget=swapRazaoAndCnpj ? cnpjItem : razaoItem;
  const cnpjTarget=swapRazaoAndCnpj ? razaoItem : cnpjItem;

  if(razaoTarget){
    razaoPlaced=drawReplaceText(razaoTarget, viewport, razaoText, 12, true, page1, 0, 286);
  }
  if(cnpjTarget && cnpj){
    cnpjPlaced=drawReplaceText(cnpjTarget, viewport, cnpjText, 12, true, page1, 0, 286);
  }

  const dateRect={x: 0, yTop: 0, width: 0, height: 0, fontSize: 0};
  dateRect.x = page1.getSize().width * 0.58;
  dateRect.yTop = page1.getSize().height * 0.78;
  dateRect.width = 220;
  dateRect.height = 12;
  dateRect.fontSize = 11;

  if(dataLinha && dateRect){
    const rect=dateRect;
    const fontSize=Math.max(8, (rect.fontSize || 11) - 1);
    const textWidth=font.widthOfTextAtSize(dataLinha, fontSize);
    const padX=10;
    const padY=6;
    const clearW=Math.max(rect.width || 0, textWidth) + padX * 2;
    const clearH=Math.max(rect.height || fontSize, fontSize) * 1.4 + padY;
    const rectBottom=rect.yTop - clearH;
    const textY=rectBottom + (clearH - fontSize) * 0.5;
    const offsetX=23;
    const offsetY=-12;
    page1.drawRectangle({
      x: rect.x + offsetX - padX,
      y: rectBottom + offsetY,
      width: clearW,
      height: clearH,
      color: rgb(1,1,1)
    });
    page1.drawText(dataLinha, {x: rect.x + offsetX, y: textY + offsetY, size: fontSize, font, color: rgb(0,0,0)});
  }

  if(!razaoPlaced || (cnpj && !cnpjPlaced)){
    const anchorItem=findItem(items, s=>/prezados/i.test(s));
    if(anchorItem){
      const anchorRect=toPdfRect(anchorItem, viewport);
      const fontSize=Math.max(11, Math.min(13, anchorRect.height||12));
      const lineGap=fontSize * 1.2;
      const lift = lineGap * 13.5;
      if(!razaoPlaced){
        razaoPlaced=drawTextAt(anchorRect.x, anchorRect.yTop + lineGap * 2 + lift, fontSize, razaoText, true, page1);
      }
      if(cnpj && !cnpjPlaced){
        cnpjPlaced=drawTextAt(anchorRect.x, anchorRect.yTop + lineGap + lift, fontSize, cnpjText, true, page1);
      }
    }
  }

  if(!razaoPlaced){
    alert('N�o foi poss�vel posicionar a Raz�o Social no PDF base.');
    return;
  }
  if(cnpj && !cnpjPlaced){
    alert('N�o foi poss�vel posicionar o CNPJ no PDF base.');
    return;
  }


    let tableItems=[];
  let tableViewport=null;
  let tablePage=page1;
  if(page2){
    tablePage=page2;
    try{
      const textItems2=await getTextItems(2);
      tableItems=textItems2.items||[];
      tableViewport=textItems2.viewport||null;
    }catch(_e){}
  }else{
    tableItems=items;
    tableViewport=viewport;
    tablePage=page1;
  }

  const headerNF=findItem(tableItems, s=>{ const up=String(s||'').toUpperCase().replace(/\s+/g,' '); return up.includes('NOTA') && up.includes('FISCAL'); });
  const headerParcela=findItem(tableItems, s=>{ const up=String(s||'').toUpperCase().replace(/\s+/g,' '); return up.includes('PARCELA') || up.includes('PARC'); });
  const headerVenc=findItem(tableItems, s=>{ const up=String(s||'').toUpperCase().replace(/\s+/g,' '); return up.includes('DATA') && up.includes('VENCTO'); });
  const headerValor=findItem(tableItems, s=>{ const up=String(s||'').toUpperCase().replace(/\s+/g,' '); return up.includes('VALOR'); });

  let rows=parseTitulos(titulos);
  if(rows.length && String(rows[0].join(' ')).toUpperCase().includes('NOTA')){ rows=rows.slice(1); }
    const hasHeaders=false;
  if(hasHeaders){
    const nfPt=toPdfRect(headerNF, tableViewport);
    const parPt=toPdfRect(headerParcela, tableViewport);
    const vencPt=toPdfRect(headerVenc, tableViewport);
    const valPt=toPdfRect(headerValor, tableViewport);

    const colX=[nfPt.x + 0, parPt.x + 0, vencPt.x + 0, valPt.x + 0];
    const colW=[parPt.x - nfPt.x - 18, vencPt.x - parPt.x - 18, valPt.x - vencPt.x - 18, 46];
    const fontSize=Math.max(8, Math.min(11, nfPt.height||11) + 1);
    const lineHeight=fontSize + 3;

    const maxRows=Math.max(rows.length, 6);
    const clearTop=nfPt.yBottom + 36;
    const clearBottom=clearTop - lineHeight * (maxRows + 1.2);
    const clearLeft=colX[0] - 6;
    const clearRight=colX[3] + colW[3] + 13;

    tablePage.drawRectangle({
      x: clearLeft,
      y: clearBottom,
      width: clearRight - clearLeft,
      height: clearTop - clearBottom,
      color: rgb(1,1,1)
    });

    const headerLabels=['NOTA FISCAL','PARCELA','VENCIMENTO','R$ VALOR'];
    const headerY=clearTop + (lineHeight * 0.15);
    headerLabels.forEach((label, i)=>{
      const w=font.widthOfTextAtSize(label, fontSize);
      const x=colX[i] + Math.max(0, (colW[i] - w) / 2);
      tablePage.drawText(label, {x, y: headerY, size: fontSize, font: boldFont, color: rgb(0,0,0)});
    });

    rows.forEach((row, idx)=>{
      const y=clearTop - lineHeight * (idx + 1) + (lineHeight - fontSize) * 0.5;
      for(let i=0;i<4;i++){
        const text=String(row[i]||'').trim();
        if(!text) continue;
        const w=font.widthOfTextAtSize(text, fontSize);
        const x=colX[i] + Math.max(0, (colW[i] - w) / 2);
        tablePage.drawText(text, {x, y, size: fontSize, font, color: rgb(0,0,0)});
      }
    });
  }else if(rows.length && tablePage){
    const size=tablePage.getSize();
    const fontSize=11;
    const lineHeight=fontSize + 3;
    const colX=[size.width*0.12 + 0, size.width*0.33 + 0, size.width*0.52 + 0, size.width*0.72 + 0];
    const colW=[size.width*0.15, size.width*0.12, size.width*0.15, size.width*0.15];
    const maxRows=Math.max(rows.length, 6);
    const clearTop=size.height*0.84;
    const clearBottom=clearTop - lineHeight * (maxRows + 1.2);
    const clearLeft=colX[0] - 6;
    const clearRight=colX[3] + colW[3] + 40;

    tablePage.drawRectangle({
      x: clearLeft,
      y: clearBottom,
      width: clearRight - clearLeft,
      height: clearTop - clearBottom,
      color: rgb(1,1,1)
    });

    const headerLabels=['NOTA FISCAL','PARCELA','VENCIMENTO','R$ VALOR'];
    const headerY=clearTop + (lineHeight * 0.15);
    headerLabels.forEach((label, i)=>{
      const w=font.widthOfTextAtSize(label, fontSize);
      const x=colX[i] + Math.max(0, (colW[i] - w) / 2);
      tablePage.drawText(label, {x, y: headerY, size: fontSize, font: boldFont, color: rgb(0,0,0)});
    });

    rows.forEach((row, idx)=>{
      const y=clearTop - lineHeight * (idx + 1) + (lineHeight - fontSize) * 0.5;
      for(let i=0;i<4;i++){
        const text=String(row[i]||'').trim();
        if(!text) continue;
        const w=font.widthOfTextAtSize(text, fontSize);
        const x=colX[i] + Math.max(0, (colW[i] - w) / 2);
        tablePage.drawText(text, {x, y, size: fontSize, font, color: rgb(0,0,0)});
      }
    });
  }
  const cnpjOnlyDigits=onlyDigits(cnpjRaw);
  const cnpjFilePart=cnpjOnlyDigits || 'SEM_CNPJ';
  const fileName=`Notificação Extrajudicial - ${cnpjFilePart} - ${esfera}.pdf`;

  const outBytes=await pdfDoc.save();
  const blob=new Blob([outBytes], {type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=fileName;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('ne-gerar')?.addEventListener('click', neGeneratePDF);

function negIsNoIdentificar(){
  return !!document.getElementById('neg-no-identificar')?.checked;
}

/* ===== CNPJ CONVERTER (HEADER) ===== */
const cnpjToggle=document.getElementById('cnpjToggle');
const cnpjBox=document.getElementById('cnpjBox');
const cnpjConvert=document.getElementById('cnpjConvert');
const cnpjCopy=document.getElementById('cnpjCopy');
function showCNPJBox(){
  cnpjToggle.style.display='none';
  cnpjBox.style.display='flex';
  cnpjBox.classList.remove('cnpj-out');
  void cnpjBox.offsetWidth;
  cnpjBox.classList.add('cnpj-in');
  cnpjConvert.value='';
  cnpjConvert.focus();
}
function hideCNPJBox(){
  cnpjBox.classList.remove('cnpj-in');
  cnpjBox.classList.add('cnpj-out');
  const onEnd=()=>{
    cnpjBox.style.display='none';
    cnpjBox.classList.remove('cnpj-out');
    cnpjToggle.style.display='inline-flex';
  };
  cnpjBox.addEventListener('animationend',onEnd,{once:true});
}
function convertCNPJ(){
  const raw=(cnpjConvert.value||'').trim();
  const digits=onlyDigits(raw);
  if(!digits) return;
  if(raw===digits && digits.length===14){
    cnpjConvert.value=formatCNPJCustom(digits);
  }else if(raw!==digits){
    cnpjConvert.value=digits;
  }
}
function copyCNPJ(){
  const val=(cnpjConvert.value||'').trim();
  if(!val) return hideCNPJBox();
  (navigator.clipboard?.writeText(val)||Promise.resolve()).finally(()=>{
    hideCNPJBox();
  });
}
cnpjToggle.addEventListener('click',showCNPJBox);
cnpjConvert.addEventListener('input',convertCNPJ);
cnpjCopy.addEventListener('click',copyCNPJ);
cnpjConvert.addEventListener('keydown',e=>{
  e.stopPropagation();
  if(e.key==='Enter'){ copyCNPJ(); }
  if(e.key==='Escape'){ hideCNPJBox(); }
});
cnpjToggle.addEventListener('click',e=>e.stopPropagation());
cnpjCopy.addEventListener('click',e=>e.stopPropagation());
cnpjConvert.addEventListener('click',e=>e.stopPropagation());

// ===== LIMITADORES NUMÉRICOS (CNPJ e CÓDIGO) =====
function bindNumericLimit(selector, maxLen){
  document.querySelectorAll(selector).forEach(inp=>{
    inp.setAttribute('inputmode','numeric');
    inp.setAttribute('maxlength', String(maxLen));
    inp.addEventListener('input', ()=>{
      const digits=onlyDigits(inp.value).slice(0,maxLen);
      if(inp.value!==digits) inp.value=digits;
    });
  });
}
// Aplica em campos fixos (exceto conversor do header)
bindNumericLimit('#f-cnpjA, #f-cnpj, #cli-cnpj, #neg-busca-cnpj, #neg-cli-cnpj, #pix-add-cnpj, #pix-inline-cnpj, #tr-cnpj, #fc-cnpj', 14);
bindNumericLimit('#cli-codigo, #neg-busca-codigo, #neg-cli-codigo, #pix-add-codigo, #pix-inline-codigo, #tr-codigo, #fc-codigo', 6);

/* ===== COMPROVANTES PIX (IndexedDB) ===== */
const PIX_STATE_KEY='cobtool_pix_state_v1';
const PIX_DB=(typeof window.PIX_DB==='string' && window.PIX_DB) ? window.PIX_DB : 'cobtool_pix_db_v1';
const PIX_STORE=(typeof window.PIX_STORE==='string' && window.PIX_STORE) ? window.PIX_STORE : 'pix_store';
let pixDbPromise=null;
function pixOpenDb(){
  if(pixDbPromise) return pixDbPromise;
  pixDbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(PIX_DB,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(PIX_STORE)){
        db.createObjectStore(PIX_STORE,{keyPath:'id'});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return pixDbPromise;
}
function pixSanitizeFileName(str){
  return String(str||'').replace(/[\\/:*?"<>|]/g,'_');
}
async function pixSaveComprovante({codigo, cnpj, valorStr, file}){
  if(!file) return;
  const db=await pixOpenDb();
  const ext=file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const codigoNorm=normalizeCodigo(codigo);
  const rawName=`${codigoNorm} - ${valorStr}`;
  const nomeBase=pixSanitizeFileName(rawName);
  const filename=nomeBase+(ext||'');
  const storedAt=new Date().toISOString();
  const id=`${codigoNorm}-${storedAt}-${file.size}`;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PIX_STORE,'readwrite');
    const store=tx.objectStore(PIX_STORE);
    store.put({
      id,
      codigo:codigoNorm,
      cnpj,
      valor:valorStr,
      filename,
      storedAt,
      blob:file
    });
    tx.oncomplete=()=>resolve(id);
    tx.onerror=()=>reject(tx.error);
  });
}
async function pixGetAll(){
  const db=await pixOpenDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PIX_STORE,'readonly');
    const store=tx.objectStore(PIX_STORE);
    const req=store.getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=()=>reject(req.error);
  });
}
async function pixGetById(id){
  const db=await pixOpenDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PIX_STORE,'readonly');
    const req=tx.objectStore(PIX_STORE).get(id);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
  });
}
async function pixDeleteById(id){
  if(!id) return;
  const db=await pixOpenDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PIX_STORE,'readwrite');
    tx.objectStore(PIX_STORE).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
function crc32(buf){
  let crc=0xffffffff;
  for(let i=0;i<buf.length;i++){
    crc=(crc>>>8)^crcTable[(crc^buf[i])&0xff];
  }
  return (crc^0xffffffff)>>>0;
}
const crcTable=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++){c=c&1?0xedb88320^(c>>>1):c>>>1;}t[i]=c;}return t;})();
function dosDateTime(d){
  const year=d.getFullYear();
  const dosYear=Math.max(1980,Math.min(2107,year))-1980;
  const dosMonth=d.getMonth()+1;
  const dosDay=d.getDate();
  const dosTime=(d.getHours()<<11)|(d.getMinutes()<<5)|(Math.floor(d.getSeconds()/2));
  const dosDate=(dosYear<<9)|(dosMonth<<5)|dosDay;
  return {dosTime,dosDate};
}
async function buildZip(entries){
  const enc=new TextEncoder();
  const parts=[];
  const central=[];
  let offset=0;
  for(const ent of entries){
    const nameBytes=enc.encode(ent.name);
    const data=new Uint8Array(await ent.blob.arrayBuffer());
    const crc=crc32(data);
    const {dosTime,dosDate}=dosDateTime(ent.date||new Date());
    const local=new Uint8Array(30+nameBytes.length);
    const view=new DataView(local.buffer);
    view.setUint32(0,0x04034b50,true);
    view.setUint16(4,20,true); // version needed
    view.setUint16(6,0,true); // flags
    view.setUint16(8,0,true); // compression store
    view.setUint16(10,dosTime,true);
    view.setUint16(12,dosDate,true);
    view.setUint32(14,crc,true);
    view.setUint32(18,data.length,true);
    view.setUint32(22,data.length,true);
    view.setUint16(26,nameBytes.length,true);
    view.setUint16(28,0,true); // extra len
    local.set(nameBytes,30-0+0);
    parts.push(local,data);
    const centralHdr=new Uint8Array(46+nameBytes.length);
    const cview=new DataView(centralHdr.buffer);
    cview.setUint32(0,0x02014b50,true);
    cview.setUint16(4,20,true); // version made by
    cview.setUint16(6,20,true); // version needed
    cview.setUint16(8,0,true); // flags
    cview.setUint16(10,0,true); // compression
    cview.setUint16(12,dosTime,true);
    cview.setUint16(14,dosDate,true);
    cview.setUint32(16,crc,true);
    cview.setUint32(20,data.length,true);
    cview.setUint32(24,data.length,true);
    cview.setUint16(28,nameBytes.length,true);
    cview.setUint16(30,0,true); // extra
    cview.setUint16(32,0,true); // comment
    cview.setUint16(34,0,true); // disk start
    cview.setUint16(36,0,true); // int attr
    cview.setUint32(38,0,true); // ext attr
    cview.setUint32(42,offset,true); // local offset
    centralHdr.set(nameBytes,46-0+0);
    central.push({hdr:centralHdr, offset});
    offset+=local.length+data.length;
  }
  const centralSize=central.reduce((s,c)=>s+c.hdr.length,0);
  const centralOffset=offset;
  central.forEach(c=>parts.push(c.hdr));
  const end=new Uint8Array(22);
  const eview=new DataView(end.buffer);
  eview.setUint32(0,0x06054b50,true);
  eview.setUint16(4,0,true);
  eview.setUint16(6,0,true);
  eview.setUint16(8,entries.length,true);
  eview.setUint16(10,entries.length,true);
  eview.setUint32(12,centralSize,true);
  eview.setUint32(16,centralOffset,true);
  eview.setUint16(20,0,true);
  parts.push(end);
  let total=0;
  parts.forEach(p=>{total+=p.length;});
  const out=new Uint8Array(total);
  let pos=0;
  parts.forEach(p=>{out.set(p,pos); pos+=p.length;});
  return new Blob([out],{type:'application/zip'});
}
async function pixExportAll(){
  const list=await pixGetAll();
  if(!list.length){
    alert('Nenhum comprovante salvo.');
    return;
  }
  const entries=await Promise.all(list.map(async item=>{
    const d=item.storedAt ? new Date(item.storedAt) : new Date();
    // Usa pasta única por data; hífens evitam criar subpastas.
    const folder=`${pad2(d.getDate())}-${pad2(d.getMonth()+1)}-${d.getFullYear()}`;
    const name=`${folder}/${item.filename||'comprovante'}`;
    return {name, blob:item.blob, date:d};
  }));
  const zip=await buildZip(entries);
  const url=URL.createObjectURL(zip);
  const a=document.createElement('a');
  a.href=url;
  a.download='comprovantes_pix.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function pixGetRowData(tr){
  const cells=[...tr.querySelectorAll('td')];
  const codigo=normalizeCodigo(cells[0]?.textContent.trim()||'');
  const cnpj=onlyDigits(cells[1]?.textContent.trim()||'').slice(0,14);
  const valor=cells[2]?.textContent.trim()||'';
  return {codigo, cnpj, valor};
}
function pixCreateRow({codigo, cnpj, valor}){
  const id=Math.random().toString(36).slice(2,8);
  const codigoNorm=normalizeCodigo(codigo);
  return `<tr data-row-id="${id}">
    <td>${codigoNorm||'-'}</td>
    <td>${cnpj||'-'}</td>
    <td>R$ ${formatBR(valorDisplayToNumber(valor))}</td>
    <td class="text-center"><input type="checkbox" class="form-check-input" aria-label="E-mail enviado"></td>
    <td class="text-center"><input type="checkbox" class="form-check-input" aria-label="Creditado"></td>
    <td class="text-center"><input type="checkbox" class="form-check-input" aria-label="Compensação"></td>
    <td>
      <label class="form-check form-switch mb-0">
        <input type="checkbox" class="form-check-input" aria-label="Finalizado">
      </label>
    </td>
    <td>
      <div class="pix-actions">
        <div class="pix-upload">
          <label class="visually-hidden" for="pix-file-${id}">Comprovante</label>
          <input id="pix-file-${id}" type="file" class="form-control form-control-sm">
        </div>
        <button class="btn btn-sm pix-save d-none" type="button">
          <i class="bi bi-save" aria-hidden="true"></i>
          <span>SALVAR</span>
        </button>
        <button class="btn btn-sm pix-view d-none" type="button">
          <i class="bi bi-eye" aria-hidden="true"></i>
          <span>VISUALIZAR</span>
        </button>
        <button class="btn btn-sm pix-resend d-none" type="button">
          <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
          <span>REENVIAR COMPROVANTE</span>
        </button>
      </div>
    </td>
  </tr>`;
}
function valorDisplayToNumber(str){
  return parseBR((str||'').replace('R$',''));
}
function pixSetSavedState(tr, saved){
  const upload=tr.querySelector('.pix-upload');
  const saveBtn=tr.querySelector('.pix-save');
  const viewBtn=tr.querySelector('.pix-view');
  const resendBtn=tr.querySelector('.pix-resend');
  if(saved){
    tr.dataset.fileId=saved.id||'';
    if(upload) upload.classList.add('d-none');
    if(saveBtn) saveBtn.classList.add('d-none');
    if(viewBtn){
      viewBtn.classList.remove('d-none');
      viewBtn.dataset.fileId=saved.id||'';
      viewBtn.title=saved.filename||'';
    }
    if(resendBtn) resendBtn.classList.remove('d-none');
  }else{
    tr.dataset.fileId='';
    const inp=tr.querySelector('.pix-upload input[type="file"]');
    if(inp){ inp.value=''; inp.removeAttribute('title'); }
    if(upload) upload.classList.remove('d-none');
    if(saveBtn) saveBtn.classList.add('d-none');
    if(viewBtn) viewBtn.classList.add('d-none');
    if(resendBtn) resendBtn.classList.add('d-none');
  }
}
async function pixSaveFromRow(tr){
  const inp=tr.querySelector('.pix-upload input[type="file"]');
  const file=inp?.files?.[0];
  if(!file){
    alert('Selecione um arquivo para salvar.');
    return;
  }
  const oldId=tr.dataset.fileId;
  if(oldId) await pixDeleteById(oldId);
  const {codigo,cnpj,valor}=pixGetRowData(tr);
  const valorStr=formatBR(valorDisplayToNumber(valor));
  const id=await pixSaveComprovante({codigo, cnpj, valorStr, file});
  pixSetSavedState(tr,{id, filename:file.name});
}
async function pixResetRow(tr){
  const oldId=tr.dataset.fileId;
  if(oldId) await pixDeleteById(oldId);
  pixSetSavedState(tr,null);
}
async function pixHandleFileChange(e){
  const inp=e.target;
  const file=inp.files?.[0];
  const tr=inp.closest('tr');
  if(!tr) return;
  const saveBtn=tr.querySelector('.pix-save');
  if(file && saveBtn){
    saveBtn.classList.remove('d-none');
  }
}
async function pixClearStore(){
  const db=await pixOpenDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PIX_STORE,'readwrite');
    tx.objectStore(PIX_STORE).clear();
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
function pixGetRowsState(){
  const rows=[...document.querySelectorAll('#pix-tbody tr')];
  return rows.map(tr=>{
    const {codigo,cnpj,valor}=pixGetRowData(tr);
    const cbs=tr.querySelectorAll('input[type="checkbox"]');
    const email=!!cbs[0]?.checked;
    const creditado=!!cbs[1]?.checked;
    const compensacao=!!cbs[2]?.checked;
    const finalizado=!!cbs[3]?.checked;
    return {codigo, cnpj, valor, email, creditado, compensacao, finalizado};
  });
}
function pixApplyRowState(stateList){
  const rows=[...document.querySelectorAll('#pix-tbody tr')];
  rows.forEach((tr,idx)=>{
    const st=stateList[idx];
    if(!st) return;
    const cbs=tr.querySelectorAll('input[type="checkbox"]');
    if(cbs[0]) cbs[0].checked=!!st.email;
    if(cbs[1]) cbs[1].checked=!!st.creditado;
    if(cbs[2]) cbs[2].checked=!!st.compensacao;
    if(cbs[3]) cbs[3].checked=!!st.finalizado;
  });
}
function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result.split(',')[1]);
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function base64ToBlob(b64, type='application/octet-stream'){
  const bin=atob(b64);
  const len=bin.length;
  const arr=new Uint8Array(len);
  for(let i=0;i<len;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type});
}

/* ===== TRANSFERÊNCIAS ===== */
const TR_KEY='cobtool_transferencias_v1';
function trSanitizeItem(item){
  if(!item || typeof item!=='object') return null;
  const status=item.status||{};
  const rawId=String(item.id||'').trim();
  return {
    id:rawId || (Date.now().toString(36)+Math.random().toString(36).slice(2,8)),
    codigo:normalizeCodigo(item.codigo),
    cnpj:(onlyDigits(item.cnpj)||'').slice(0,14),
    valorCentavos:Math.max(0, parseInt(item.valorCentavos||0,10)||0),
    razaoSocial:item.razaoSocial||'',
    responsavel:item.responsavel||'',
    contato:item.contato||'',
    status:{
      email:!!status.email,
      creditado:!!status.creditado,
      compensacao:!!status.compensacao,
      finalizado:!!status.finalizado
    },
    createdAt:item.createdAt || new Date().toISOString()
  };
}
function trLoadAll(){
  try{
    const raw=localStorage.getItem(TR_KEY);
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    if(lowerEmailsInData(parsed)) localStorage.setItem(TR_KEY, JSON.stringify(parsed));
    return parsed.map(trSanitizeItem).filter(Boolean);
  }catch{
    return [];
  }
}
function trSaveAll(list){
  localStorage.setItem(TR_KEY, JSON.stringify(list||[]));
}
let trList=trLoadAll();
let pixLastFoundClient=null;
let pixCurrentClientId=null;
let pixClienteSnapshot=null;
function trValorToCentavos(val){
  const digits=onlyDigits(val);
  return digits ? parseInt(digits,10) : 0;
}
function trMaskValorInput(e){
  const el=e.target;
  const digits=onlyDigits(el.value);
  if(!digits){
    el.value='';
    return;
  }
  const num=parseInt(digits,10)||0;
  el.value='R$ '+formatBR(num/100);
}
function trEnsureStatus(item){
  if(!item || typeof item!=='object') return {email:false, creditado:false, compensacao:false, finalizado:false};
  if(!item.status || typeof item.status!=='object'){
    item.status={email:false, creditado:false, compensacao:false, finalizado:false};
  }else{
    item.status={
      email:!!item.status.email,
      creditado:!!item.status.creditado,
      compensacao:!!item.status.compensacao,
      finalizado:!!item.status.finalizado
    };
  }
  return item.status;
}
function trGetStage(item){
  const status=trEnsureStatus(item);
  if(status.finalizado) return 'finalizado';
  if(status.compensacao) return 'compensacao';
  if(status.creditado) return 'creditado';
  if(status.email) return 'email';
  return 'none';
}
function trGetPercent(item){
  const stage=trGetStage(item);
  const map={none:0, email:25, creditado:50, compensacao:75, finalizado:100};
  return map[stage] ?? 0;
}
function trHexToRgb(hex){
  const clean=String(hex||'').replace('#','');
  if(clean.length!==6) return null;
  const num=parseInt(clean,16);
  return {r:(num>>16)&255,g:(num>>8)&255,b:num&255};
}
function trRgbToHex({r,g,b}){
  const toHex=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function trMixHex(a,b,t){
  const c1=trHexToRgb(a);
  const c2=trHexToRgb(b);
  if(!c1 || !c2) return a;
  return trRgbToHex({
    r:c1.r+(c2.r-c1.r)*t,
    g:c1.g+(c2.g-c1.g)*t,
    b:c1.b+(c2.b-c1.b)*t
  });
}
function trGetProgressColor(percent){
  const gray='#8f9499';
  const green='#34b36a';
  const map={
    0:gray,
    25:trMixHex(gray, green, 0.35),
    50:trMixHex(gray, green, 0.55),
    75:trMixHex(gray, green, 0.75),
    100:trMixHex(gray, green, 0.9)
  };
  return map[percent] || gray;
}
function trGetStageLabel(stage){
  const map={
    none:'Nenhum',
    email:'E-mail enviado',
    creditado:'Creditado',
    compensacao:'Compensação enviada',
    finalizado:'Finalizado'
  };
  return map[stage] || 'Nenhum';
}
(function initTransferencias(){
  const codigo=document.getElementById('tr-codigo');
  const cnpj=document.getElementById('tr-cnpj');
  const valor=document.getElementById('tr-valor');
  const add=document.getElementById('tr-add');
  const trNewBtn=document.getElementById('tr-new-btn');
  const trFormWrap=document.getElementById('tr-form-wrap');
  const tbody=document.getElementById('tr-body');
  const trModal=document.getElementById('tr-modal');
  const trModalBody=document.getElementById('tr-modal-body');
  const trModalTitle=document.getElementById('tr-modal-title');
  const trModalClose=document.getElementById('tr-modal-close');
  const trModalInfo=document.getElementById('tr-modal-info');
  const trModalEmail=document.getElementById('tr-modal-email');
  const trModalEsfera=document.getElementById('tr-modal-esfera');
  const trModalCompensar=document.getElementById('tr-modal-compensar');
  const trModalDelete=document.getElementById('tr-modal-delete');
  const trStatusEmail=document.getElementById('tr-status-email');
  const trStatusCreditado=document.getElementById('tr-status-creditado');
  const trStatusCompensacao=document.getElementById('tr-status-compensacao');
  const trStatusFinalizado=document.getElementById('tr-status-finalizado');
  const trBtnExportTable=document.getElementById('tr-export-table-btn');
  const trBtnKpis=document.getElementById('tr-kpis-btn');
  const trKpiModal=document.getElementById('tr-kpi-modal');
  const trKpiContent=document.getElementById('tr-kpi-content');
  const trKpiClose=document.getElementById('tr-kpi-close');
  const trPasteZone=document.getElementById('tr-paste-zone');
  const trPastePreview=document.getElementById('tr-paste-preview');
  const trPasteImg=document.getElementById('tr-paste-img');
  const trDownloadImg=document.getElementById('tr-download-img');
  const trProofWrap=document.getElementById('tr-proof-wrap');
  const trSaveProofBtn=document.getElementById('tr-save-proof-btn');
  const pixInlineCnpj=document.getElementById('pix-inline-cnpj');
  const pixInlineCodigo=document.getElementById('pix-inline-codigo');
  const pixCliBuscar=document.getElementById('pix-cli-buscar');
  const pixBuscarOutro=document.getElementById('pix-buscar-outro');
  const pixRazaoWrapper=document.getElementById('pix-razao-wrapper');
  const pixRazaoSelecionada=document.getElementById('pix-razao-selecionada');
  const pixClienteInfo=document.getElementById('pix-cliente-info');
  const pixClienteSelecionado=document.getElementById('pix-cliente-selecionado');
  const pixCliRazao=document.getElementById('pix-cli-razao');
  const pixCliCnpj=document.getElementById('pix-cli-cnpj');
  const pixCliCodigo=document.getElementById('pix-cli-codigo');
  const pixCliResponsavel=document.getElementById('pix-cli-responsavel');
  const pixCliContato=document.getElementById('pix-cli-contato');
  const pixNoIdentificar=document.getElementById('pix-no-identificar');
  if(!tbody) return;
  function trHideForm(){
    if(trFormWrap) trFormWrap.classList.add('d-none');
    if(trNewBtn) trNewBtn.classList.remove('d-none');
  }
  window.__cobtoolTransferenciasHideForm=trHideForm;

  if(valor) valor.addEventListener('input', trMaskValorInput);
  if(valor) valor.addEventListener('input', trUpdateAddState);
  trHideForm();

  let trModalItem=null;
  let trPastedBlob=null;
  let trPastedUrl=null;
  let trPastedMime='';
  const TR_PASTE_HINT='Cole uma imagem ou PDF aqui (Ctrl+V)';
  const TR_DEPOSITOS_EMAIL='depositos@pratidonaduzzi.com.br';
  let pixLastFoundClientLocal=null;
  let pixCurrentClientIdLocal=null;
  let pixClienteSnapshotLocal=null;

  const pixCliDigitsCNPJ = v => onlyDigits(v||'').slice(0,14);
  const pixCliDigitsCodigo = v => normalizeCodigo(v);
  const pixIsNoIdentificar = () => !!pixNoIdentificar?.checked;
  function trFindNegociacaoMatch(trItem){
    const cnpjTr=onlyDigits(trItem?.cnpj||'');
    const codTr=normalizeCodigo(trItem?.codigo||'');
    for(const neg of negList){
      const snap=neg.clienteSnapshot||{};
      const cnpjNeg=onlyDigits(snap.cnpj||'');
      const codNeg=normalizeCodigo(snap.codigoCliente||'');
      const matchCnpj=cnpjTr && cnpjNeg && cnpjTr===cnpjNeg;
      const matchCod=codTr && codNeg && codTr===codNeg;
      if(!matchCnpj && !matchCod) continue;
      const parcelas=negGetParcelas(neg);
      if(parcelas.some(p=>!p.paga)) return neg;
    }
    return null;
  }
  function pixSyncMainInputs(){
    const cnpjDigits=pixCliDigitsCNPJ(pixInlineCnpj?.value||'');
    const codDigits=pixCliDigitsCodigo(pixInlineCodigo?.value||'');
    if(cnpj) cnpj.value=cnpjDigits;
    if(codigo) codigo.value=codDigits || '';
  }

  function pixClearSelection(){
    pixLastFoundClientLocal=null;
    pixCurrentClientIdLocal=null;
    pixClienteSnapshotLocal=null;
    if(pixClienteInfo){
      pixClienteInfo.innerHTML='';
      pixClienteInfo.classList.add('d-none');
    }
    if(pixRazaoWrapper) pixRazaoWrapper.classList.add('d-none');
    if(pixClienteSelecionado) pixClienteSelecionado.classList.add('d-none');
    if(pixBuscarOutro) pixBuscarOutro.classList.add('d-none');
    if(pixRazaoSelecionada) pixRazaoSelecionada.value='';
    [pixCliRazao,pixCliCnpj,pixCliCodigo,pixCliResponsavel,pixCliContato].forEach(el=>{
      if(el){
        el.value='';
        el.disabled=true;
      }
    });
    if(pixInlineCnpj){
      pixInlineCnpj.disabled=false;
    }
    if(pixInlineCodigo){
      pixInlineCodigo.disabled=false;
    }
    pixSyncMainInputs();
  }
  function pixRenderSelecionado(cli){
    if(!cli) return;
    pixLastFoundClientLocal={...cli};
    pixCurrentClientIdLocal=cli.id;
    pixClienteSnapshotLocal={...cli};
    if(pixRazaoWrapper){
      pixRazaoWrapper.classList.remove('d-none');
      if(pixRazaoSelecionada) pixRazaoSelecionada.value=cli.razaoSocial||'';
    }
    if(pixClienteSelecionado) pixClienteSelecionado.classList.add('d-none');
    if(pixCliRazao) pixCliRazao.value=cli.razaoSocial||'';
    if(pixCliCnpj) pixCliCnpj.value=pixCliDigitsCNPJ(cli.cnpj);
    if(pixCliCodigo) pixCliCodigo.value=pixCliDigitsCodigo(cli.codigoCliente);
    if(pixCliResponsavel) pixCliResponsavel.value=cli.responsavel||'';
    if(pixCliContato) pixCliContato.value=cli.contato||'';
    if(pixInlineCnpj){
      pixInlineCnpj.value=pixCliDigitsCNPJ(cli.cnpj);
      pixInlineCnpj.disabled=true;
    }
    if(pixInlineCodigo){
      pixInlineCodigo.value=pixCliDigitsCodigo(cli.codigoCliente);
      pixInlineCodigo.disabled=true;
    }
    if(pixBuscarOutro) pixBuscarOutro.classList.remove('d-none');
    pixSyncMainInputs();
  }
  function pixRenderClienteInfo(cli){
    if(!pixClienteInfo || !cli) return;
    pixClienteInfo.classList.remove('d-none');
    pixClienteInfo.innerHTML=`
      <div class="info-row">
        <span class="info-label">RAZÃO SOCIAL</span>
        <div class="info-value">${cli.razaoSocial||'-'}</div>
      </div>
      <div class="info-row">
        <span class="info-label">CNPJ</span>
        <div class="info-value">${pixCliDigitsCNPJ(cli.cnpj)||'-'}</div>
      </div>
      <div class="info-row">
        <span class="info-label">CÓDIGO DO CLIENTE</span>
        <div class="info-value">${pixCliDigitsCodigo(cli.codigoCliente)||'-'}</div>
      </div>
      <div class="info-row">
        <span class="info-label">RESPONSÁVEL</span>
        <div class="info-value">${cli.responsavel||'-'}</div>
      </div>
      <div class="info-row">
        <span class="info-label">CONTATO</span>
      <div class="info-value">${cli.contato||'-'}</div>
    </div>
    <div class="actions justify-content-start">
      <button class="btn btn-sm" id="pix-confirmar-cliente">
        <i class="bi bi-check2-circle" aria-hidden="true"></i>
        <span>CONFIRMAR CLIENTE</span>
      </button>
    </div>`;
    const btn=document.getElementById('pix-confirmar-cliente');
    if(btn){
      btn.addEventListener('click',()=>{
        if(!pixLastFoundClientLocal){
          alert('Busque e selecione um cliente primeiro.');
          return;
        }
        pixRenderSelecionado(pixLastFoundClientLocal);
        if(pixClienteInfo){
          pixClienteInfo.innerHTML='';
          pixClienteInfo.classList.add('d-none');
        }
        if(pixClienteSelecionado){
          pixClienteSelecionado.classList.add('d-none');
        }
        if(pixRazaoWrapper){
          pixRazaoWrapper.classList.remove('d-none');
        }
        trUpdateAddState();
      },{once:true});
    }
  }
  function pixBuscarCliente(){
    if(pixIsNoIdentificar()) return;
    const cnpjDigits=pixCliDigitsCNPJ(pixInlineCnpj?.value||'');
    const codigoDigits=pixCliDigitsCodigo(pixInlineCodigo?.value||'');
    let found=null;
    if(cnpjDigits) found=cliList.find(c=>pixCliDigitsCNPJ(c.cnpj)===cnpjDigits);
    if(!found && codigoDigits){
      found=cliList.find(c=>pixCliDigitsCodigo(c.codigoCliente)===codigoDigits);
    }
    if(found){
      pixLastFoundClientLocal={
        ...found,
        cnpj:pixCliDigitsCNPJ(found.cnpj),
        codigoCliente:pixCliDigitsCodigo(found.codigoCliente)
      };
      // Auto-confirma quando há match exato por CNPJ ou código.
      pixRenderSelecionado(pixLastFoundClientLocal);
      if(pixClienteInfo){
        pixClienteInfo.innerHTML='';
        pixClienteInfo.classList.add('d-none');
      }
    }else{
      pixClearSelection();
      alert('Cliente não encontrado.');
    }
    trUpdateAddState();
  }
  pixClearSelection();

  function trUpdateAddState(){
    if(!add) return;
    const valorCentavos=trValorToCentavos(valor?.value);
    if(valorCentavos<=0){
      add.disabled=true;
      return;
    }
    if(pixIsNoIdentificar()){
      const cnpjDigits=pixCliDigitsCNPJ(pixInlineCnpj?.value||'');
      const codDigits=pixCliDigitsCodigo(pixInlineCodigo?.value||'');
      add.disabled=!(cnpjDigits.length===14 && codDigits.length>0);
      return;
    }
    add.disabled=!(pixCurrentClientIdLocal && pixClienteSnapshotLocal);
  }
  function trSetDownloadButtonState(enabled, label='BAIXAR ARQUIVO'){
    if(!trDownloadImg) return;
    trDownloadImg.disabled=!enabled;
    if(enabled){
      trDownloadImg.classList.remove('disabled');
      trDownloadImg.style.pointerEvents='auto';
      trDownloadImg.removeAttribute('aria-disabled');
    }else{
      trDownloadImg.classList.add('disabled');
      trDownloadImg.style.pointerEvents='none';
      trDownloadImg.setAttribute('aria-disabled','true');
    }
    const labelEl=trDownloadImg.querySelector('span');
    if(labelEl) labelEl.textContent=label;
  }
  function trBuildProofFileName(ext){
    const code=normalizeCodigo(trModalItem?.codigo||'');
    const valorFmt=formatBR((trModalItem?.valorCentavos||0)/100);
    return `${code} - ${valorFmt}.${ext}`;
  }
  function trClearPaste(){
    if(trPastedUrl){
      URL.revokeObjectURL(trPastedUrl);
      trPastedUrl=null;
    }
    trPastedBlob=null;
    trPastedMime='';
    if(trPasteZone) trPasteZone.textContent=TR_PASTE_HINT;
    if(trPastePreview) trPastePreview.classList.add('d-none');
    if(trPasteImg){
      trPasteImg.src='';
      trPasteImg.style.display='';
    }
  }
  function trResetProofArea(hide=true){
    trClearPaste();
    trSetDownloadButtonState(false,'BAIXAR ARQUIVO');
    if(hide){
      trProofWrap?.classList.add('d-none');
    }
    trSaveProofBtn?.classList.remove('d-none');
  }
  function trSyncModalStatus(item){
    if(!item) return;
    const status=trEnsureStatus(item);
    const locked=!!status.finalizado;
    if(trStatusEmail){
      trStatusEmail.checked=!!status.email;
      trStatusEmail.disabled=locked;
    }
    if(trStatusCreditado){
      trStatusCreditado.checked=!!status.creditado;
      trStatusCreditado.disabled=locked;
    }
    if(trStatusCompensacao){
      trStatusCompensacao.checked=!!status.compensacao;
      trStatusCompensacao.disabled=locked;
    }
    if(trStatusFinalizado){
      trStatusFinalizado.checked=!!status.finalizado;
      trStatusFinalizado.disabled=false;
    }
  }
  function trUpdateStatus(field, checked){
    if(!trModalItem) return;
    const status=trEnsureStatus(trModalItem);
    if(status.finalizado && field!=='finalizado'){
      trSyncModalStatus(trModalItem);
      return;
    }
    status[field]=!!checked;
    const updated={...trModalItem, status:{...status}};
    trList=trList.map(row=>row.id===updated.id ? {...row, status:{...status}} : row);
    trSaveAll(trList);
    trModalItem=updated;
    render();
    trSyncModalStatus(trModalItem);
  }
  function trShowModal(item){
    if(!trModal || !trModalTitle || !trModalInfo) return;
    trModalItem=item;
    trModal.setAttribute('data-tr-id', item.id||'');
    trModalTitle.textContent=`CÓDIGO ${normalizeCodigo(item.codigo)||''}`;
    const valorFmt=formatBR((item.valorCentavos||0)/100);
    const hasClienteExtra = !!(item.razaoSocial || item.responsavel || item.contato);
    trModalInfo.innerHTML= hasClienteExtra ? `
      <div class="neg-modal-grid">
        <div class="neg-modal-field"><span class="neg-modal-label">RAZÃO SOCIAL</span><span class="neg-modal-value">${item.razaoSocial||'-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">CÓDIGO DO CLIENTE</span><span class="neg-modal-value">${normalizeCodigo(item.codigo)||''}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">CNPJ</span><span class="neg-modal-value">${maskCNPJValue(item.cnpj||'')}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">RESPONSÁVEL</span><span class="neg-modal-value">${item.responsavel||'-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">CONTATO</span><span class="neg-modal-value">${item.contato||'-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">DATA</span><span class="neg-modal-value">${formatBRDateFromISO(item.createdAt||'')}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">VALOR</span><span class="neg-modal-value">R$ ${valorFmt}</span></div>
      </div>
    ` : `
      <div class="neg-modal-grid">
        <div class="neg-modal-field"><span class="neg-modal-label">CÓDIGO DO CLIENTE</span><span class="neg-modal-value">${normalizeCodigo(item.codigo)||''}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">CNPJ</span><span class="neg-modal-value">${maskCNPJValue(item.cnpj||'')}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">DATA</span><span class="neg-modal-value">${formatBRDateFromISO(item.createdAt||'')}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">VALOR</span><span class="neg-modal-value">R$ ${valorFmt}</span></div>
      </div>
    `;
    trResetProofArea(true);
    trSyncModalStatus(item);
    trModal.classList.add('open');
    document.body.style.overflow='hidden';
  }
  function trHideModal(){
    if(trModal){
      trModal.classList.remove('open');
      document.body.style.overflow='';
    }
    trModalItem=null;
    trModal?.removeAttribute('data-tr-id');
    trResetProofArea(true);
  }
  trModalClose?.addEventListener('click', trHideModal);
  trModal?.addEventListener('click',e=>{
    if(e.target===trModal) trHideModal();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && trModal?.classList.contains('open')){
      trHideModal();
      e.stopPropagation();
    }
  }, true);
  trStatusEmail?.addEventListener('change',e=>{
    trUpdateStatus('email', e.target.checked);
  });
  trStatusCreditado?.addEventListener('change',e=>{
    trUpdateStatus('creditado', e.target.checked);
  });
  trStatusCompensacao?.addEventListener('change',e=>{
    trUpdateStatus('compensacao', e.target.checked);
  });
  trStatusFinalizado?.addEventListener('change',e=>{
    trUpdateStatus('finalizado', e.target.checked);
  });
  pixInlineCnpj?.addEventListener('input',()=>{
    if(pixIsNoIdentificar()){
      pixLastFoundClientLocal=null;
      pixCurrentClientIdLocal=null;
      pixClienteSnapshotLocal=null;
    }
    pixSyncMainInputs();
    trUpdateAddState();
  });
  pixInlineCodigo?.addEventListener('input',()=>{
    if(pixIsNoIdentificar()){
      pixLastFoundClientLocal=null;
      pixCurrentClientIdLocal=null;
      pixClienteSnapshotLocal=null;
    }
    pixSyncMainInputs();
    trUpdateAddState();
  });
  pixCliBuscar?.addEventListener('click',()=>{
    if(pixIsNoIdentificar()){
      trUpdateAddState();
      return;
    }
    pixBuscarCliente();
  });
  pixBuscarOutro?.addEventListener('click',()=>{
    pixClearSelection();
    pixSyncMainInputs();
    trUpdateAddState();
    pixInlineCnpj?.focus();
  });
  pixNoIdentificar?.addEventListener('change',()=>{
    if(pixIsNoIdentificar()){
      pixClearSelection();
      if(pixInlineCnpj) pixInlineCnpj.disabled=false;
      if(pixInlineCodigo) pixInlineCodigo.disabled=false;
    }else{
      pixClearSelection();
      if(pixClienteInfo) pixClienteInfo.classList.add('d-none');
    }
    pixSyncMainInputs();
    trUpdateAddState();
  });

  function trCopyText(btn, text){
    if(!btn || !text) return;
    const original=btn.innerHTML;
    const doCopy=()=>{
      btn.innerHTML='COPIADO';
      setTimeout(()=>{btn.innerHTML=original;},800);
    };
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(text).then(doCopy).catch(()=>doCopy());
    }else{
      const ta=document.createElement('textarea');
      ta.value=text;
      ta.style.position='fixed';
      ta.style.opacity='0';
      document.body.appendChild(ta);
      ta.select();
      try{document.execCommand('copy');}catch{}
      document.body.removeChild(ta);
      doCopy();
    }
  }
  trModalEmail?.addEventListener('click',()=>{
    if(!trModalItem) return;
    const codigo=normalizeCodigo(trModalItem.codigo);
    const cnpj=onlyDigits(trModalItem.cnpj||'').slice(0,14);
    const valor=formatBR((trModalItem.valorCentavos||0)/100);
    const razao=(trModalItem.razaoSocial||'').trim();
    const assunto=`Comprovante de Transferência - Cliente ${codigo} - R$ ${valor}`;
    const razaoSafe=escapeHtml(razao || '-');
    const codigoSafe=escapeHtml(codigo || '-');
    const cnpjSafe=escapeHtml(cnpj || '-');
    const valorSafe=escapeHtml(`R$ ${valor}`);
    const htmlBody=`<div>Prezados(as),</div>
<br>
<div>Segue em anexo o comprovante de transferência:</div>
<br>
<div>Razão Social: <strong>${razaoSafe}</strong></div>
<div>Código: <strong>${codigoSafe}</strong></div>
<div>CNPJ: <strong>${cnpjSafe}</strong></div>
<div>Valor: <strong>${valorSafe}</strong></div>
<br>
<div>Atenciosamente,</div>`;
    let plainString=`Prezados(as),

Segue em anexo o comprovante de transferência:

Razão Social: ${razao || '-'}
Código: ${codigo || '-'}
CNPJ: ${cnpj || '-'}
Valor: R$ ${valor}

Atenciosamente,`;
    plainString=plainString.replace(/[ \t]+\n/g,"\n").trimEnd();
    const bodyForCompose=plainString.replace(/\n/g,'\r\n');
    const outlookParams=new URLSearchParams({
      to:TR_DEPOSITOS_EMAIL,
      subject:assunto,
      body:bodyForCompose,
      popoutv2:'1'
    });
    const outlookQuery=outlookParams.toString().replace(/\+/g,'%20');
    const outlookUrl=`https://outlook.office.com/mail/deeplink/compose?${outlookQuery}`;

    let opened=false;
    try{
      const win=window.open('about:blank','_blank');
      if(win){
        try{ win.opener=null; }catch{}
        win.location.href=outlookUrl;
        opened=true;
      }
    }catch{}
    if(!opened){
      alert('Não foi possível abrir o Outlook em nova guia. Verifique o bloqueador de pop-ups.');
    }

    const original=trModalEmail.innerHTML;
    const trSetEmailBtnState=(text,delay=900)=>{
      trModalEmail.innerHTML=text;
      setTimeout(()=>{trModalEmail.innerHTML=original;},delay);
    };
    trSetEmailBtnState('ABERTO');
    (async()=>{
      let attachmentCopied=false;
      const mime=String(trPastedMime||trPastedBlob?.type||'').toLowerCase();
      const canCopyAttachment=!!(trPastedBlob && typeof ClipboardItem!=='undefined' && navigator.clipboard?.write);
      if(canCopyAttachment && (mime==='application/pdf' || mime.startsWith('image/'))){
        try{
          const attachmentItem=new ClipboardItem({[mime]:trPastedBlob});
          await navigator.clipboard.write([attachmentItem]);
          attachmentCopied=true;
          trSetEmailBtnState('ANEXO COPIADO',1400);
        }catch(_err){}
      }
      if(attachmentCopied){
        alert('Outlook aberto. No e-mail, pressione Ctrl+V para anexar o comprovante.');
        return;
      }
      try{
        if(typeof ClipboardItem!=='undefined' && navigator.clipboard?.write){
          const item=new ClipboardItem({
            'text/html':new Blob([htmlBody],{type:'text/html'}),
            'text/plain':new Blob([plainString],{type:'text/plain'})
          });
          await navigator.clipboard.write([item]);
          return;
        }
        throw new Error('NO_RICH_CLIPBOARD');
      }catch{
        if(navigator.clipboard?.writeText){
          navigator.clipboard.writeText(plainString).catch(()=>{});
        }
      }
    })();
  });
  trModalEsfera?.addEventListener('click',()=>{
    if(!trModalItem) return;
    const email=TR_DEPOSITOS_EMAIL;
    const valorComRS='R$ '+formatBR((trModalItem.valorCentavos||0)/100);
    const msg=`CLIENTE ENVIOU O COMPROVANTE DE TRANSFERÊNCIA NO VALOR DE ${valorComRS} VIA WHATSAPP, O COMPROVANTE FOI DEVIDAMENTE ENVIADO POR E-MAIL PARA A EQUIPE DE DEPÓSITOS (${email});`;
    const original=trModalEsfera.innerHTML;
    const setCopied=()=>{
      trModalEsfera.innerHTML='COPIADO';
      setTimeout(()=>{trModalEsfera.innerHTML=original;},800);
    };
    (navigator.clipboard?.writeText(msg)||Promise.resolve()).then(setCopied).catch(setCopied);
  });
  trModalCompensar?.addEventListener('click',()=>{
    if(!trModalItem) return;
    const neg=trFindNegociacaoMatch(trModalItem);
    const centsTr=trModalItem.valorCentavos||0;
    if(neg){
      const centsParcela=Math.round((neg.valorParcela||0)*100);
      if(centsParcela===centsTr){
        trHideModal();
        setPage('compensacoes');
        if(typeof cSetMode==='function') cSetMode('neg');
        document.getElementById('c-negociacao')?.focus();
        return;
      }
    }
    trHideModal();
    setPage('compensacoes');
  });
  trModalDelete?.addEventListener('click',()=>{
    if(!trModalItem) return;
    if(!confirm('Excluir esta transferência? Esta ação não pode ser desfeita.')) return;
    const id=String(trModalItem.id||'');
    trDeleteById(id);
    trHideModal();
    trEnsureEmptyState();
  });

  function trExtractPastedFile(e){
    const fromFiles=[...(e.clipboardData?.files||[])];
    const fromItems=[...(e.clipboardData?.items||[])]
      .filter(it=>it.kind==='file')
      .map(it=>it.getAsFile())
      .filter(Boolean);
    const all=[...fromFiles, ...fromItems];
    return all.find(f=>{
      const type=String(f?.type||'').toLowerCase();
      return type.startsWith('image/') || type==='application/pdf';
    }) || null;
  }
  function trHandlePaste(e){
    if(!trModalItem || trProofWrap?.classList.contains('d-none')) return;
    const file=trExtractPastedFile(e);
    if(!file) return;
    e.preventDefault();
    trPastedBlob=file;
    trPastedMime=String(file.type||'').toLowerCase();
    if(trPastedUrl) URL.revokeObjectURL(trPastedUrl);
    trPastedUrl=URL.createObjectURL(file);
    const isPdf=trPastedMime==='application/pdf';
    if(trPasteImg){
      if(isPdf){
        trPasteImg.removeAttribute('src');
        trPasteImg.style.display='none';
      }else{
        trPasteImg.src=trPastedUrl;
        trPasteImg.style.display='block';
      }
    }
    if(trPasteZone){
      const kind=isPdf ? 'PDF' : 'Imagem';
      const name=String(file.name||'').trim() || (isPdf ? 'arquivo.pdf' : 'arquivo.png');
      trPasteZone.textContent=`${kind} colado: ${name}`;
    }
    if(trPastePreview) trPastePreview.classList.remove('d-none');
    trSetDownloadButtonState(true, isPdf ? 'BAIXAR PDF' : 'BAIXAR PNG');
  }
  trPasteZone?.addEventListener('paste',trHandlePaste);
  trPasteZone?.addEventListener('click',()=>trPasteZone?.focus());
  trSaveProofBtn?.addEventListener('click',()=>{
    trProofWrap?.classList.remove('d-none');
    trPasteZone?.focus();
  });
  trDownloadImg?.addEventListener('click',()=>{
    if(!trPastedBlob || !trModalItem) return;
    const mime=String(trPastedMime||trPastedBlob.type||'').toLowerCase();
    const isPdf=mime==='application/pdf';
    if(isPdf){
      const url=URL.createObjectURL(trPastedBlob);
      const a=document.createElement('a');
      a.href=url;
      a.download=trBuildProofFileName('pdf');
      a.addEventListener('click',()=>{
        const urlToRevoke=url;
        setTimeout(()=>{
          trResetProofArea(true);
          URL.revokeObjectURL(urlToRevoke);
        },400);
      },{once:true});
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    const tmpUrl=trPastedUrl||URL.createObjectURL(trPastedBlob);
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=img.naturalWidth||img.width;
      canvas.height=img.naturalHeight||img.height;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0);
      canvas.toBlob(blob=>{
        if(!blob) return;
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=trBuildProofFileName('png');
        a.addEventListener('click',()=>{
          const urlToRevoke=url;
          setTimeout(()=>{
            trResetProofArea(true);
            URL.revokeObjectURL(urlToRevoke);
          },400);
        },{once:true});
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      },'image/png',1.0);
    };
    img.src=tmpUrl;
  });

  function render(){
    if(!trList.length){
      tbody.innerHTML='<tr><td colspan="4" class="text-center text-muted">Nenhuma transferência cadastrada.</td></tr>';
      return;
    }
    const rows=trList.map(item=>{
      const stage=trGetStage(item);
      const percent=trGetPercent(item);
      const color=trGetProgressColor(percent);
      const stageLabel=trGetStageLabel(stage);
      return `
        <tr data-id="${item.id}" data-tr-id="${item.id}">
          <td>${normalizeCodigo(item.codigo)||'-'}</td>
          <td>${item.cnpj||''}</td>
          <td>R$ ${formatBR((item.valorCentavos||0)/100)}</td>
          <td class="text-center">
            <div class="tr-progress" title="${percent}% • ${stageLabel}">
              <div class="tr-progress__bar" style="width:${percent}%;background-color:${color}"></div>
              <div class="tr-progress__text"><span>${percent}%</span></div>
            </div>
          </td>
        </tr>`;
    });
    tbody.innerHTML=rows.join('');
  }
  window.__cobtoolTransferenciasRefresh=render;

  function trBuildExportTsv(){
    const cols=['CÓDIGO','CNPJ','VALOR','DATA'];
    const sepCol='\t';
    const sepRow='\r\n';
    const rows=[cols.join(sepCol)];
    trList.forEach(item=>{
      const codigo=normalizeCodigo(item.codigo || item.codigoCliente || '');
      const cnpj=normalizeCnpj(item.cnpj || '');
      const valor=`R$ ${formatBR((item.valorCentavos||0)/100)}`;
      const data=formatBRDateFromISO(item.createdAt||'');
      rows.push([codigo, cnpj, valor, data].join(sepCol));
    });
    return rows.join(sepRow);
  }
  async function trCopyPlainText(text){
    if(!text) return false;
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch(_e){}
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.style.position='fixed';
    ta.style.opacity='0';
    document.body.appendChild(ta);
    ta.select();
    try{
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    }catch(_e){
      document.body.removeChild(ta);
      return false;
    }
  }
  function trCloseKpiModal(){
    if(trKpiModal){
      trKpiModal.classList.remove('open');
      document.body.style.overflow='';
    }
  }
  function trOpenKpiModal(){
    if(!trKpiModal || !trKpiContent) return;
    const items=[...trList];
    const count=items.length;
    const totalCents=items.reduce((sum,i)=>sum+(i.valorCentavos||0),0);
    const total=totalCents/100;
    const values=items.map(i=>i.valorCentavos||0).filter(v=>Number.isFinite(v));
    values.sort((a,b)=>a-b);
    const mid=Math.floor(values.length/2);
    const medianCents=values.length ? (values.length%2 ? values[mid] : Math.round((values[mid-1]+values[mid])/2)) : 0;
    const minCents=values.length ? values[0] : 0;
    const maxCents=values.length ? values[values.length-1] : 0;
    const stageCounts={none:0, email:0, creditado:0, compensacao:0, finalizado:0};
    const daySet=new Set();
    let pendingCents=0;
    items.forEach(item=>{
      const stage=trGetStage(item);
      stageCounts[stage]=(stageCounts[stage]||0)+1;
      if(!trEnsureStatus(item).finalizado) pendingCents+=item.valorCentavos||0;
      const dt=item.createdAt ? new Date(item.createdAt) : null;
      if(dt && !Number.isNaN(dt.getTime())){
        const key=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        daySet.add(key);
      }
    });
    const uniqueDays=daySet.size;
    const divisor=Math.max(1, uniqueDays);
    const avgPerTransfer=count ? total/count : 0;
    const avgPerDay=count/divisor;
    const avgValuePerDay=total/divisor;
    const pctFinalizado=count ? (stageCounts.finalizado/count)*100 : 0;
    const fmtInt=n=>Number.isFinite(n) ? n.toLocaleString('pt-BR') : '0';
    const fmtNum=n=>Number.isFinite(n) ? n.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2}) : '0';
    const fmtMoney=v=>`R$ ${formatBR(v||0)}`;
    const fmtPct=v=>`${(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
    trKpiContent.innerHTML=`
      <div class="tr-kpi-grid">
        <div class="tr-kpi-card"><div class="tr-kpi-label">Número de transferências</div><div class="tr-kpi-value">${fmtInt(count)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Soma total</div><div class="tr-kpi-value">${fmtMoney(total)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Valor médio por transferência</div><div class="tr-kpi-value">${fmtMoney(avgPerTransfer)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Média de transferências por dia</div><div class="tr-kpi-value">${fmtNum(avgPerDay)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Média de valor por dia</div><div class="tr-kpi-value">${fmtMoney(avgValuePerDay)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Finalizado (%)</div><div class="tr-kpi-value">${fmtPct(pctFinalizado)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Valor pendente</div><div class="tr-kpi-value">${fmtMoney(pendingCents/100)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Ticket mediano</div><div class="tr-kpi-value">${fmtMoney(medianCents/100)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Maior transferência</div><div class="tr-kpi-value">${fmtMoney(maxCents/100)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Menor transferência</div><div class="tr-kpi-value">${fmtMoney(minCents/100)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Estágios (Nenhum / E-mail)</div><div class="tr-kpi-value">${fmtInt(stageCounts.none)} / ${fmtInt(stageCounts.email)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Estágios (Creditado / Compensação)</div><div class="tr-kpi-value">${fmtInt(stageCounts.creditado)} / ${fmtInt(stageCounts.compensacao)}</div></div>
        <div class="tr-kpi-card"><div class="tr-kpi-label">Estágios (Finalizado)</div><div class="tr-kpi-value">${fmtInt(stageCounts.finalizado)}</div></div>
      </div>
    `;
    trKpiModal.classList.add('open');
    document.body.style.overflow='hidden';
  }

  trNewBtn?.addEventListener('click',()=>{
    trNewBtn.classList.add('d-none');
    trFormWrap?.classList.remove('d-none');
    if(pixInlineCnpj){
      pixInlineCnpj.focus();
    }else if(codigo){
      codigo.focus();
    }
  });
  trBtnExportTable?.addEventListener('click',async()=>{
    const tsv=trBuildExportTsv();
    const ok=await trCopyPlainText(tsv);
    alert(ok ? 'Tabela copiada para a área de transferência.' : 'Não foi possível copiar a tabela.');
  });
  trBtnKpis?.addEventListener('click',trOpenKpiModal);
  trKpiClose?.addEventListener('click',trCloseKpiModal);
  trKpiModal?.addEventListener('click',e=>{
    if(e.target===trKpiModal) trCloseKpiModal();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && trKpiModal?.classList.contains('open')){
      trCloseKpiModal();
      e.stopPropagation();
    }
  }, true);

  add?.addEventListener('click',()=>{
    let codigoVal='';
    let cnpjVal='';
    let razaoVal='';
    let responsavelVal='';
    let contatoVal='';
    if(pixIsNoIdentificar()){
      const cnpjDigits=pixCliDigitsCNPJ(pixInlineCnpj?.value||'');
      const codDigits=pixCliDigitsCodigo(pixInlineCodigo?.value||'');
      if(cnpjDigits.length!==14 || !codDigits){
        alert('Informe CNPJ (14 dígitos) e Código do Cliente para salvar.');
        return;
      }
      codigoVal=codDigits;
      cnpjVal=cnpjDigits;
    }else{
      if(!pixClienteSnapshotLocal || !pixCurrentClientIdLocal){
        alert('Busque e selecione um cliente para salvar.');
        return;
      }
      const cnpjDigits=pixCliDigitsCNPJ(pixClienteSnapshotLocal.cnpj);
      const codDigits=pixCliDigitsCodigo(pixClienteSnapshotLocal.codigoCliente);
      if(cnpjDigits.length!==14 || !codDigits){
        alert('Dados do cliente selecionado são inválidos.');
        return;
      }
      codigoVal=codDigits;
      cnpjVal=cnpjDigits;
      razaoVal=pixClienteSnapshotLocal.razaoSocial||'';
      responsavelVal=pixClienteSnapshotLocal.responsavel||'';
      contatoVal=pixClienteSnapshotLocal.contato||'';
    }
    const valorCentavos=trValorToCentavos(valor?.value);
    if(valorCentavos<=0){
      alert('Preencha código, CNPJ com 14 dígitos e valor maior que zero.');
      return;
    }
    if(codigo) codigo.value=codigoVal;
    if(cnpj) cnpj.value=cnpjVal;
    const now=new Date().toISOString();
    const novo={
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),
      codigo:codigoVal,
      cnpj:cnpjVal,
      valorCentavos,
      razaoSocial:razaoVal,
      responsavel:responsavelVal,
      contato:contatoVal,
      status:{email:false, creditado:false, compensacao:false, finalizado:false},
      createdAt:now
    };
    trList=[...trList, novo];
    trSaveAll(trList);
    render();
    if(codigo) codigo.value='';
    if(cnpj) cnpj.value='';
    if(pixInlineCnpj){
      pixInlineCnpj.removeAttribute('disabled');
      pixInlineCnpj.value='';
    }
    if(pixInlineCodigo){
      pixInlineCodigo.removeAttribute('disabled');
      pixInlineCodigo.value='';
    }
    pixClearSelection();
    if(valor) valor.value='';
    trHideForm();
    pixInlineCnpj?.focus();
    trUpdateAddState();
  });
  tbody.addEventListener('click',e=>{
    const tr=e.target.closest('tr[data-tr-id]');
    if(!tr) return;
    const id=tr.getAttribute('data-tr-id');
    const item=trList.find(x=>String(x.id)===String(id));
    if(item) trShowModal(item);
  });

  trUpdateAddState();
  render();
})();

async function exportUnified(){
  const localStorageDump={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key!==null) localStorageDump[key]=localStorage.getItem(key);
  }
  const uiSnapshot={
    __currentPage:currentPage||'home',
    __cMode:cState?.mode||'creditos'
  };
  document.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    if(cb.id) uiSnapshot[`checkbox:${cb.id}`]=!!cb.checked;
  });
  document.querySelectorAll('input[type="radio"]').forEach(radio=>{
    if(radio.name && radio.checked) uiSnapshot[`radio:${radio.name}`]=radio.value;
  });
  document.querySelectorAll('input[type="range"]').forEach(rg=>{
    if(rg.id) uiSnapshot[`range:${rg.id}`]=rg.value;
  });
  let pixFilesRaw=[];
  if(typeof pixGetAll==='function'){
    try{
      pixFilesRaw=await pixGetAll();
    }catch(err){
      console.warn('Falha ao ler comprovantes PIX para backup.', err);
      pixFilesRaw=[];
    }
  }
  const pixFiles=[];
  for(const f of pixFilesRaw){
    if(!f?.blob) continue;
    let b64='';
    try{
      if(typeof blobToBase64!=='function') continue;
      b64=await blobToBase64(f.blob);
    }catch(err){
      console.warn('Falha ao converter comprovante PIX.', err);
      continue;
    }
    pixFiles.push({
      id:f.id,
      codigo:f.codigo,
      cnpj:f.cnpj,
      valor:f.valor,
      filename:f.filename,
      storedAt:f.storedAt,
      type:f.blob?.type||'application/octet-stream',
      data:b64
    });
  }
  const payload={
    payloadType:'cobtool_backup_v2',
    exportedAt:new Date().toISOString(),
    localStorage:localStorageDump,
    uiSnapshot,
    pixFiles
  };
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='cobtool_backup.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 60000);
}
function readFileAsText(file){
  if(file?.text) return file.text();
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result||'');
    reader.onerror=()=>reject(reader.error);
    reader.readAsText(file);
  });
}
async function importUnified(file){
  if(!file) return;
  const text=await readFileAsText(file);
  const data=JSON.parse(text);
  if(data?.payloadType==='cobtool_backup_v2'){
    const ls=(data.localStorage && typeof data.localStorage==='object') ? data.localStorage : {};
    localStorage.clear();
    Object.keys(ls).forEach(key=>{
      localStorage.setItem(key, String(ls[key] ?? ''));
    });

    if(typeof pixClearStore==='function') await pixClearStore();
    const pixFiles=Array.isArray(data.pixFiles) ? data.pixFiles : [];
    if(pixFiles.length && typeof pixOpenDb==='function' && typeof base64ToBlob==='function'){
      const db=await pixOpenDb();
      for(const f of pixFiles){
        if(!f?.data) continue;
        const blob=base64ToBlob(f.data, f.type||'application/octet-stream');
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(PIX_STORE,'readwrite');
          const store=tx.objectStore(PIX_STORE);
          store.put({
            id:f.id,
            codigo:f.codigo,
            cnpj:f.cnpj,
            valor:f.valor,
            filename:f.filename,
            storedAt:f.storedAt,
            blob
          });
          tx.oncomplete=()=>resolve();
          tx.onerror=()=>reject(tx.error);
        });
      }
    }

    const snap=data.uiSnapshot||{};
    if(snap.__cMode && typeof cSetMode==='function'){
      const m=snap.__cMode;
      if(['creditos','pos','neg'].includes(m)) cSetMode(m);
    }
    Object.keys(snap).forEach(key=>{
      if(key.startsWith('checkbox:')){
        const id=key.slice(9);
        const el=document.getElementById(id);
        if(el && el.type==='checkbox') el.checked=!!snap[key];
      }else if(key.startsWith('radio:')){
        const name=key.slice(6);
        const val=snap[key];
        if(!name) return;
        document.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach(r=>{
          if(r.value===val) r.checked=true;
        });
      }else if(key.startsWith('range:')){
        const id=key.slice(6);
        const el=document.getElementById(id);
        if(el && el.type==='range') el.value=String(snap[key] ?? '');
      }
    });
    if(typeof cToggleTaxa==='function') cToggleTaxa();
    if(typeof negToggleEntrada==='function') negToggleEntrada();
    if(typeof negToggleTaxaBoletos==='function') negToggleTaxaBoletos();
    if(snap.__currentPage && typeof setPage==='function'){
      const next=pages.includes(snap.__currentPage) ? snap.__currentPage : 'home';
      setPage(next);
    }else if(typeof setPage==='function'){
      setPage('home');
    }

    cliList=cliLoadAll();
    cliRenderList();
    negList=negLoadAll();
    negList.forEach(item=>{
      negEnsureSituacao(item);
      negEnsureClosedDates(item);
    });
    negRefreshAll();
    trList=trLoadAll();
    if(typeof window.__cobtoolTransferenciasRefresh==='function'){
      window.__cobtoolTransferenciasRefresh();
    }
    pixRenderState(pixLoadState());
    await pixHydrateRowsFromDb();
    const theme=localStorage.getItem('ch_theme');
    if(typeof applyTheme==='function'){
      applyTheme(theme==='light' ? 'light' : 'dark');
    }
    alert('Backup importado com sucesso.');
    location.reload();
    return;
  }

  cliList=(data.clientes||[]).map(cliSanitize);
  cliSaveAll(cliList);
  cliRenderList();

  negList=(data.negociacoes||[]);
  negList.forEach(item=>{
    negEnsureSituacao(item);
    negEnsureClosedDates(item);
  });
  negSaveAll(negList);
  negRefreshAll();

  trList=(data.transferencias||[]).map(trSanitizeItem).filter(Boolean);
  trSaveAll(trList);
  if(typeof window.__cobtoolTransferenciasRefresh==='function'){
    window.__cobtoolTransferenciasRefresh();
  }

  await pixClearStore();
  const files=data.pix?.files||[];
  for(const f of files){
    const blob=base64ToBlob(f.data, f.type||'application/octet-stream');
    await pixSaveComprovante({codigo:f.codigo, cnpj:f.cnpj, valorStr:f.valor, file:new File([blob], f.filename||'comprovante')});
  }
  const pixRows=data.pix?.rows||[];
  localStorage.setItem(PIX_STATE_KEY, JSON.stringify(pixRows));
  pixRenderState(pixRows);
  await pixHydrateRowsFromDb();

  alert('Importação concluída. Dados atualizados.');
}

/* ===== PIX ADD MODAL ===== */
function pixShowAddModal(){
  const modal=document.getElementById('pix-add-modal');
  if(modal){
    modal.classList.add('open');
    document.body.style.overflow='hidden';
    pixAddSelected=null;
    ['pix-add-razao','pix-add-cnpj-val','pix-add-codigo-val'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.textContent='-';
    });
    document.getElementById('pix-add-info').style.display='none';
    document.getElementById('pix-add-salvar').disabled=false;
    document.getElementById('pix-add-cnpj').value='';
    document.getElementById('pix-add-codigo').value='';
    document.getElementById('pix-add-valor').value='';
  }
}
function pixHideAddModal(){
  const modal=document.getElementById('pix-add-modal');
  if(modal){
    modal.classList.remove('open');
    document.body.style.overflow='';
  }
}
function pixFindCliente(cnpj,codigo){
  const dc=normalizeCnpj(cnpj||'');
  const code=normalizeCodigo(codigo||'');
  let found=null;
  if(dc) found=cliList.find(c=>normalizeCnpj(c.cnpj)===dc);
  if(!found && code) found=cliList.find(c=>normalizeCodigo(c.codigoCliente)===code);
  return found;
}
function pixUpdateAddButton(){
  const btn=document.getElementById('pix-add-salvar');
  if(!btn) return;
  btn.disabled=false; // sem validação
}
function pixFormatValorInput(){
  const inp=document.getElementById('pix-add-valor');
  if(!inp) return;
  const num=parseBR(inp.value);
  inp.value = num>0 ? formatBR(num) : '';
  pixUpdateAddButton();
}
function pixFormatValorLive(){
  const inp=document.getElementById('pix-add-valor');
  if(!inp) return;
  const digits=onlyDigits(inp.value);
  if(!digits){
    inp.value='';
    pixUpdateAddButton();
    return;
  }
  const cents=parseInt(digits,10);
  const num=cents/100;
  inp.value=formatBR(num);
  pixUpdateAddButton();
}
function pixFormatValorLiveInline(){
  const inp=document.getElementById('pix-inline-valor');
  if(!inp) return;
  const digits=onlyDigits(inp.value);
  if(!digits){
    inp.value='';
    return;
  }
  const cents=parseInt(digits,10);
  const num=cents/100;
  inp.value=formatBR(num);
}
function pixSetAddInfo(cli){
  const box=document.getElementById('pix-add-info');
  if(!cli || !box){
    box.style.display='none';
    return;
  }
  document.getElementById('pix-add-razao').textContent=cli.razaoSocial||'-';
  document.getElementById('pix-add-cnpj-val').textContent=cli.cnpj||'-';
  document.getElementById('pix-add-codigo-val').textContent=normalizeCodigo(cli.codigoCliente)||'-';
  box.style.display='block';
}
function pixAddBusca(){
  const cnpj=document.getElementById('pix-add-cnpj')?.value||'';
  const codigo=document.getElementById('pix-add-codigo')?.value||'';
  const cnpjDigits=onlyDigits(cnpj);
  const codigoDigits=normalizeCodigo(codigo);
  // Busca opcional; se existir, preenche info; se não, usa dados digitados.
  const cli=pixFindCliente(cnpjDigits,codigoDigits) || {razaoSocial:'-', cnpj:cnpjDigits, codigoCliente:codigoDigits};
  pixAddSelected=cli;
  pixSetAddInfo(cli);
  pixUpdateAddButton();
}
function pixAddSalvar(){
  const valorStr=(document.getElementById('pix-add-valor')?.value||'').trim();
  const valor=parseBR(valorStr);
  const cnpjDigits=onlyDigits(document.getElementById('pix-add-cnpj')?.value||'');
  const codigoDigits=normalizeCodigo(document.getElementById('pix-add-codigo')?.value||'');
  const tbody=document.getElementById('pix-tbody');
  if(!tbody) return;
  document.getElementById('pix-add-valor').value=formatBR(valor);
  // Se a tabela tinha linha placeholder, limpa.
  if(tbody.children.length===1 && tbody.children[0]?.querySelector?.('.text-muted')){
    tbody.innerHTML='';
  }
  const rowHtml=pixCreateRow({
    codigo:codigoDigits,
    cnpj:cnpjDigits,
    valor:valor
  });
  const temp=document.createElement('tbody');
  temp.innerHTML=rowHtml.trim();
  const newRow=temp.firstElementChild;
  if(newRow){
    tbody.appendChild(newRow);
    pixSetSavedState(newRow,null);
  }
  pixHideAddModal();
  pixHydrateRowsFromDb();
  alert('Transferência adicionada à lista.');
  document.getElementById('pix-add-cnpj').value='';
  document.getElementById('pix-add-codigo').value='';
  document.getElementById('pix-add-valor').value='';
  pixUpdateAddButton();
}
function pixInlineAdd(){
  const codigo=normalizeCodigo(document.getElementById('pix-inline-codigo')?.value||'');
  const cnpj=onlyDigits(document.getElementById('pix-inline-cnpj')?.value||'');
  const valorInput=(document.getElementById('pix-inline-valor')?.value||'').trim();
  const valor=parseBR(valorInput);
  const tbody=document.getElementById('pix-tbody');
  if(!tbody) return;
  document.getElementById('pix-inline-valor').value=valor ? formatBR(valor) : '';
  if(tbody.children.length===1 && tbody.children[0]?.querySelector?.('.text-muted')){
    tbody.innerHTML='';
  }
  const rowHtml=pixCreateRow({codigo, cnpj, valor});
  tbody.insertAdjacentHTML('beforeend', rowHtml);
  const newRow=tbody.lastElementChild;
  if(newRow) pixSetSavedState(newRow,null);
  pixSaveState();
  pixHydrateRowsFromDb();
  // limpa campos
  document.getElementById('pix-inline-codigo').value='';
  document.getElementById('pix-inline-cnpj').value='';
  document.getElementById('pix-inline-valor').value='';
}
function pixLoadState(){
  try{
    const raw=localStorage.getItem(PIX_STATE_KEY);
    const parsed=JSON.parse(raw||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}
function pixSaveState(){
  const state=pixGetRowsState();
  localStorage.setItem(PIX_STATE_KEY, JSON.stringify(state));
}
function pixRenderState(state){
  const tbody=document.getElementById('pix-tbody');
  if(!tbody) return;
  if(!state.length){
    return;
  }
  tbody.innerHTML=state.map(row=>pixCreateRow(row)).join('');
  pixApplyRowState(state);
}

/* ===== TEMA ===== */
document.getElementById('toggleTheme').addEventListener('click',()=>{
  const cur=document.documentElement.getAttribute('data-theme')||'dark';
  applyTheme(cur==='dark'?'light':'dark');
});

/* =======================================================================================
   FORMATAÇÃO DE TEXTO (WHATSAPP)
   ======================================================================================= */
(function initFT(){
  const editor=document.getElementById('ft-editor');
  const output=document.getElementById('ft-output');
  const copyBtn=document.getElementById('ft-copy');
  const clockEl=document.getElementById('ft-clock');
  if(!editor || !output || !copyBtn) return;

  // Mantém o último range válido dentro do editor para restaurar a seleção após clicar na toolbar
  let ftSavedRange=null;

  function ftWrap(marker, text){
    const clean=(text||'').trim();
    return clean ? `${marker}${clean}${marker}` : '';
  }
  function ftInlineText(node, ctx={}){ // legacy helper retained (unused)
    let out='';
    node.childNodes.forEach(child=>{
      out+=ftInlineNode(child, ctx);
    });
    return out;
  }
  function ftInlineNode(node, ctx){ // legacy helper retained (unused)
    if(node.nodeType===3){
      return node.nodeValue||'';
    }
    if(node.nodeType!==1) return '';
    const tag=node.tagName.toLowerCase();
    if(tag==='br') return '\n';
    if(tag==='strong'||tag==='b') return ftWrap('*', ftInlineText(node, ctx));
    if(tag==='em'||tag==='i') return ftWrap('_', ftInlineText(node, ctx));
    if(tag==='s'||tag==='del'||tag==='strike') return ftWrap('~', ftInlineText(node, ctx));
    if(tag==='code'){
      if(ctx.inPre) return node.textContent;
      return ftWrap('`', ftInlineText(node,{...ctx,inCode:true}));
    }
    if(tag==='pre'){
      const code=node.textContent.replace(/^\n+|\n+$/g,'');
      return code ? `\`\`\`${code}\`\`\`` : '``` ```';
    }
    if(tag==='blockquote'){
      const inner=ftCollectLines(node.childNodes).join('\n');
      return inner ? `> ${inner.replace(/\n/g,'\n> ')}` : '> ';
    }
    if(tag==='ul') return ftRenderList(node,false).join('\n');
    if(tag==='ol') return ftRenderList(node,true).join('\n');
    if(tag==='li'){
      const txt=ftNormalizeInline(ftInlineText(node));
      return txt;
    }
    return ftInlineText(node, ctx);
  }
  // --- Nova conversão fiel: preserva quebras/espacos e insere marcadores apenas onde há formatação ---
  function ftRenderChildren(el){
    let out='';
    el.childNodes.forEach(n=>{ out+=ftRenderNode(n); });
    return out;
  }
  const ftBlockify = txt => txt.endsWith('\n') ? txt : txt+'\n';
  function ftRenderListWA(listEl, ordered){
    const items=[...listEl.querySelectorAll(':scope>li')];
    return items.map((li,idx)=>{
      const txt=ftRenderChildren(li);
      const prefix=ordered ? `${idx+1}. ` : '- ';
      return prefix+txt;
    }).join('\n');
  }
  function ftRenderNode(node){
    if(node.nodeType===3) return node.nodeValue||'';
    if(node.nodeType!==1) return '';
    const tag=node.tagName.toLowerCase();
    if(tag==='br') return '\n';
    if(tag==='strong'||tag==='b') return ftWrap('*', ftRenderChildren(node));
    if(tag==='em'||tag==='i') return ftWrap('_', ftRenderChildren(node));
    if(tag==='s'||tag==='del'||tag==='strike') return ftWrap('~', ftRenderChildren(node));
    if(tag==='code') return ftWrap('`', ftRenderChildren(node));
    if(tag==='pre'){
      const code=node.textContent||'';
      return ftBlockify('```'+code+'```');
    }
    if(tag==='blockquote'){
      const inner=ftRenderChildren(node).split('\n').map(l=> l ? `> ${l}` : '> ').join('\n');
      // Não adiciona quebra extra; a quebra vira responsabilidade do container
      return inner;
    }
    if(tag==='ul') return ftBlockify(ftRenderListWA(node,false));
    if(tag==='ol') return ftBlockify(ftRenderListWA(node,true));
    if(tag==='li') return ftRenderChildren(node);
    if(tag==='div'||tag==='p') return ftBlockify(ftRenderChildren(node));
    return ftRenderChildren(node);
  }
  function ftHtmlToWA(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    let txt=ftRenderChildren(doc.body);
    // Normaliza apenas o tipo de quebra de linha, mantendo linhas vazias exatamente como no input
    txt=txt.replace(/\r\n?/g,'\n');
    // Remove quebra final extra
    txt=txt.replace(/\n$/, '');
    return txt;
  }

  function ftRangeInEditor(range){
    return editor.contains(range.commonAncestorContainer);
  }
  function ftRememberSelection(){
    const sel=window.getSelection();
    if(!sel?.rangeCount) return;
    const range=sel.getRangeAt(0);
    if(ftRangeInEditor(range)) ftSavedRange=range.cloneRange();
  }
  function ftGetSelectionRange(){
    const sel=window.getSelection();
    if(!sel) return null;
    const current=sel.rangeCount ? sel.getRangeAt(0) : null;
    if(current && ftRangeInEditor(current)) return {sel, range:current};
    if(ftSavedRange){
      sel.removeAllRanges();
      sel.addRange(ftSavedRange.cloneRange());
      const restored=sel.rangeCount ? sel.getRangeAt(0) : null;
      if(restored && ftRangeInEditor(restored)) return {sel, range:restored};
    }
    return null;
  }
  function ftFindAncestor(node, tag){
    const t=tag.toLowerCase();
    let cur=node;
    while(cur && cur!==editor){
      if(cur.nodeType===1 && cur.tagName.toLowerCase()===t) return cur;
      cur=cur.parentNode;
    }
    return null;
  }
  function ftIsEmptyBlock(node){
    if(!node || node.nodeType!==1) return false;
    const tag=node.tagName.toLowerCase();
    if(tag==='br') return true;
    if(tag==='div'||tag==='p'){
      return !node.textContent.trim() && !node.querySelector('ul,ol,blockquote,pre');
    }
    return false;
  }
  function ftPlaceCaretAfter(node){
    if(!node || !node.parentNode) return;
    const range=document.createRange();
    const sel=window.getSelection();
    // Garante um ponto de inserção visível após o bloco
    let anchor=node.nextSibling;
    if(!anchor){
      anchor=document.createElement('br');
      node.parentNode.appendChild(anchor);
    }
    range.setStartAfter(node);
    range.collapse(true);
    if(sel){
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  function ftTrimAround(node){
    if(!node) return;
    let prev=node.previousSibling;
    while(prev && ((prev.nodeType===3 && !prev.nodeValue.trim()) || ftIsEmptyBlock(prev))){
      const p=prev.previousSibling;
      prev.remove();
      prev=p;
    }
    let next=node.nextSibling;
    while(next && ((next.nodeType===3 && !next.nodeValue.trim()) || ftIsEmptyBlock(next))){
      const n=next.nextSibling;
      next.remove();
      next=n;
    }
  }
  function ftToggleInline(tag){
    const ctx=ftGetSelectionRange();
    if(!ctx) return;
    const {sel, range}=ctx;
    if(range.collapsed) return;
    const cmdMap={strong:'bold', em:'italic', s:'strikeThrough'};
    const cmd=cmdMap[tag];
    editor.focus({preventScroll:true});
    if(cmd){
      try{ document.execCommand('styleWithCSS', false, false); }catch{}
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand(cmd);
      ftRememberSelection();
      return;
    }
    let newRange=null;
    const startAnc=ftFindAncestor(range.startContainer, tag);
    const endAnc=ftFindAncestor(range.endContainer, tag);
    if(startAnc && endAnc && startAnc===endAnc){
      const wrap=startAnc;
      const parent=wrap.parentNode;
      const first=wrap.firstChild;
      const last=wrap.lastChild;
      while(wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap);
      parent.removeChild(wrap);
      if(first && last){
        newRange=document.createRange();
        newRange.setStartBefore(first);
        newRange.setEndAfter(last);
      }
    }else{
      const frag=range.extractContents();
      const wrap=document.createElement(tag);
      wrap.appendChild(frag);
      range.insertNode(wrap);
      newRange=document.createRange();
      newRange.selectNodeContents(wrap);
    }
    sel.removeAllRanges();
    if(newRange) sel.addRange(newRange);
    ftRememberSelection();
  }
  function ftTogglePre(){
    const ctx=ftGetSelectionRange();
    if(!ctx) return;
    const {sel, range}=ctx;
    if(range.collapsed) return;
    const start=ftFindAncestor(range.startContainer,'pre');
    const end=ftFindAncestor(range.endContainer,'pre');
    if(start && end && start===end){
      const pre=start;
      const parent=pre.parentNode;
      const frag=document.createDocumentFragment();
      const lines=pre.textContent.split(/\r?\n/);
      lines.forEach((line,idx)=>{
        frag.appendChild(document.createTextNode(line));
        if(idx<lines.length-1) frag.appendChild(document.createElement('br'));
      });
      parent.insertBefore(frag, pre);
      parent.removeChild(pre);
      return;
    }
    const text=sel.toString();
    const pre=document.createElement('pre');
    const code=document.createElement('code');
    code.textContent=text;
    pre.appendChild(code);
    range.deleteContents();
    range.insertNode(pre);
    ftTrimAround(pre);
    ftPlaceCaretAfter(pre);
  }
  function ftInsertQuote(){
    const ctx=ftGetSelectionRange();
    if(!ctx) return;
    const {sel, range}=ctx;
    if(range.collapsed) return;
    const start=ftFindAncestor(range.startContainer,'blockquote');
    const end=ftFindAncestor(range.endContainer,'blockquote');
    if(start && end && start===end){
      const blk=start;
      const parent=blk.parentNode;
      while(blk.firstChild) parent.insertBefore(blk.firstChild, blk);
      parent.removeChild(blk);
      return;
    }
    const text=sel.toString();
    if(!text) return;
    const lines=text.split(/\r?\n/);
    const block=document.createElement('blockquote');
    lines.forEach((line,idx)=>{
      block.appendChild(document.createTextNode(line));
      if(idx<lines.length-1) block.appendChild(document.createElement('br'));
    });
    range.deleteContents();
    range.insertNode(block);
    ftTrimAround(block);
    ftPlaceCaretAfter(block);
  }
  function ftInsertList(ordered=false){
    const ctx=ftGetSelectionRange();
    if(!ctx) return;
    const {sel, range}=ctx;
    if(range.collapsed) return;
    const tag=ordered?'ol':'ul';
    const startList=ftFindAncestor(range.startContainer, tag);
    const endList=ftFindAncestor(range.endContainer, tag);
    if(startList && endList && startList===endList){
      const list=startList;
      const parent=list.parentNode;
      const frag=document.createDocumentFragment();
      const items=[...list.querySelectorAll(':scope>li')];
      items.forEach((li,idx)=>{
        frag.appendChild(document.createTextNode(li.textContent));
        if(idx<items.length-1) frag.appendChild(document.createElement('br'));
      });
      parent.insertBefore(frag, list);
      parent.removeChild(list);
      return;
    }
    const text=sel.toString();
    if(!text.trim()) return;
    const lines=text.split(/\r?\n/).filter(l=>l.length>0);
    if(!lines.length) return;
    const list=document.createElement(tag);
    lines.forEach(line=>{
      const li=document.createElement('li');
      li.textContent=line;
      list.appendChild(li);
    });
    range.deleteContents();
    range.insertNode(list);
    ftTrimAround(list);
    ftPlaceCaretAfter(list);
  }

  function ftSync(){
    const html=editor.innerHTML||'';
    ftLastHtml=html;
    let wa='';
    try{
      wa=ftHtmlToWA(html);
    }catch(err){
      console.warn('ftHtmlToWA falhou, usando texto puro', err);
    }
    if(!wa && editor.textContent){
      wa=editor.textContent.replace(/\s+\n/g,'\n').trimEnd();
    }
    output.value=wa;
    output.style.height='auto';
    output.style.height=(output.scrollHeight||output.clientHeight)+'px';
    editor.classList.toggle('empty', !editor.textContent.trim());
  }
  const ftSyncAndRemember=()=>{
    ftRememberSelection();
    ftSync();
  };
  const ftSyncImmediate=()=>ftSync();
  let ftLastHtml='';
  const ftMaybeSync=()=>{
    const html=editor.innerHTML||'';
    if(html===ftLastHtml) return;
    ftLastHtml=html;
    ftSync();
  };
  let ftSyncRaf=null;
  const ftQueueSync=()=>{
    if(ftSyncRaf) cancelAnimationFrame(ftSyncRaf);
    ftSyncRaf=requestAnimationFrame(()=>{
      ftSyncRaf=null;
      ftSyncAndRemember();
    });
  };
  function ftSurround(tag){
    const sel=window.getSelection();
    if(!sel || !sel.rangeCount) return;
    const text=sel.toString();
    document.execCommand('insertHTML', false, `<${tag}>${text||''}</${tag}>`);
  }
  function ftInsertBlockCode(){
    const sel=window.getSelection();
    const text=sel?.toString()||'';
    document.execCommand('insertHTML', false, `<pre><code>${text||''}</code></pre>`);
  }
  function ftApply(action){
    editor.focus();
    const map={
      bold:()=>ftToggleInline('strong'),
      italic:()=>ftToggleInline('em'),
      strike:()=>ftToggleInline('s'),
      quote:()=>ftInsertQuote(),
      ul:()=>ftInsertList(false),
      ol:()=>ftInsertList(true),
      'code-inline':()=>ftToggleInline('code'),
      'code-block':()=>ftTogglePre()
    };
    if(map[action]) map[action]();
    ftSyncAndRemember();
  }

  document.querySelectorAll('[data-ft-action]').forEach(btn=>{
    btn.addEventListener('mousedown',e=>e.preventDefault());
    btn.addEventListener('click',()=>ftApply(btn.dataset.ftAction));
  });
  editor.addEventListener('input', ftSyncImmediate);
  editor.addEventListener('keyup', ftSyncImmediate);
  ['beforeinput','keydown','compositionend','mouseup'].forEach(ev=>{
    editor.addEventListener(ev, ftQueueSync);
  });
  document.addEventListener('selectionchange',()=>{
    const sel=window.getSelection();
    if(sel?.rangeCount){
      const range=sel.getRangeAt(0);
      if(ftRangeInEditor(range)) ftQueueSync();
    }
  });
  new MutationObserver(()=>ftMaybeSync()).observe(editor,{subtree:true,childList:true,characterData:true});
  setInterval(ftSync, 200);
  editor.addEventListener('paste',e=>{
    e.preventDefault();
    const txt=(e.clipboardData||window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, txt);
    ftQueueSync();
  });
  function ftUpdateClock(){
    if(!clockEl) return;
    const now=new Date();
    const hh=String(now.getHours()).padStart(2,'0');
    const mm=String(now.getMinutes()).padStart(2,'0');
    clockEl.textContent=`${hh}:${mm}`;
  }
  ftUpdateClock();
  setInterval(ftUpdateClock, 30*1000);
  copyBtn.addEventListener('click',()=>{
    const txt=output.value||'';
    if(!txt.trim()) return;
    (navigator.clipboard?.writeText(txt)||Promise.resolve()).then(()=>{
      copyBtn.classList.add('copied');
      setTimeout(()=>copyBtn.classList.remove('copied'),1100);
    });
  });
  ftSync();
})();

/* =======================================================================================
   ALFA
   ======================================================================================= */
(function initAlfa(){
  const operadorSel=document.getElementById('alfa-operador');
  const cnpjIn=document.getElementById('alfa-cnpj');
  const esferaIn=document.getElementById('alfa-esfera');
  const outWrap=document.getElementById('alfa-wrap');
  const outArea=document.getElementById('alfa-out');
  const btnFria=document.getElementById('alfa-msg-fria');
  const btnPrevisaoSerasa=document.getElementById('alfa-msg-previsao-serasa');
  const btnRiscoBloqueio=document.getElementById('alfa-msg-risco-bloqueio');
  const btnRegularizacaoUrgente=document.getElementById('alfa-msg-regularizacao-urgente');
  const btnNotificacaoCobranca=document.getElementById('alfa-msg-notificacao-cobranca');
  const btnLimpar=document.getElementById('alfa-limpar');
  const btnCopiar=document.getElementById('alfa-copiar');
  if(!operadorSel || !cnpjIn || !esferaIn || !outWrap || !outArea || !btnFria || !btnPrevisaoSerasa || !btnRiscoBloqueio || !btnRegularizacaoUrgente) return;

  let alfaLastKind='previsao-serasa';
  let alfaLastCtx=null;
  let alfaRegModal=null;
  let alfaRegText=null;
  let alfaRegCopyBtn=null;
  let alfaCartaModal=null;
  let alfaCartaRazaoIn=null;
  let alfaCartaCnpjIn=null;
  let alfaCartaDataIn=null;
  let alfaCartaPdfIn=null;
  let alfaCartaFileName=null;
  let alfaCartaGerarBtn=null;
  let alfaCartaBusy=false;
  const ALFA_OPERATOR_KEY='cobtool_alfa_operador_v1';
  const ALFA_CARTA_BASE_PREFIX='NOTIFICAÇÃO DE BOLETOS EM ATRASO - ';
  const ALFA_CARTA_OPERADORES={
    carlyle:['Carlyle'],
    lucia:['Lúcia','Lucia'],
    pedro:['Pedro'],
    rafael:['Rafael'],
    renan:['Renan'],
    vanderleia:['Vanderleia']
  };

  function alfaRestoreOperator(){
    const saved=String(localStorage.getItem(ALFA_OPERATOR_KEY)||'').trim();
    if(!saved) return;
    const exists=[...operadorSel.options].some(opt=>opt.value===saved);
    if(exists) operadorSel.value=saved;
  }

  function alfaPersistOperator(){
    const value=String(operadorSel.value||'').trim();
    if(value){
      localStorage.setItem(ALFA_OPERATOR_KEY, value);
      return;
    }
    localStorage.removeItem(ALFA_OPERATOR_KEY);
  }

  alfaRestoreOperator();
  alfaPersistOperator();

  function alfaEnsureRegistroModal(){
    if(alfaRegModal) return;
    const modal=document.createElement('div');
    modal.id='alfa-reg-modal';
    modal.className='neg-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','alfa-reg-title');
    modal.innerHTML=`
      <div class="neg-modal-content">
        <div class="neg-modal-header">
          <div>
            <div class="neg-modal-eyebrow">REGISTRO PARA ESFERA</div>
            <h3 id="alfa-reg-title" class="neg-modal-title">REGISTRO DE CONTATO</h3>
          </div>
          <button class="btn icon" id="alfa-reg-close" type="button" aria-label="Fechar">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
        <div class="neg-modal-body">
          <div class="neg-modal-section">
            <textarea id="alfa-reg-text" class="output" rows="8" readonly></textarea>
            <div class="out-actions">
              <button class="btn btn-sm" id="alfa-reg-copy" type="button">
                <i class="bi bi-clipboard" aria-hidden="true"></i>
                <span>COPIAR REGISTRO</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    alfaRegModal=modal;
    alfaRegText=modal.querySelector('#alfa-reg-text');
    alfaRegCopyBtn=modal.querySelector('#alfa-reg-copy');
    const closeBtn=modal.querySelector('#alfa-reg-close');
    closeBtn?.addEventListener('click',alfaHideRegistroModal);
    modal.addEventListener('click',e=>{
      if(e.target===modal) alfaHideRegistroModal();
    });
    alfaRegCopyBtn?.addEventListener('click',alfaCopyRegistro);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape' && alfaRegModal?.classList.contains('open')){
        alfaHideRegistroModal();
      }
    });
  }

  function alfaHideRegistroModal(){
    alfaRegModal?.classList.remove('open');
  }

  function alfaShowRegistroModal(text){
    alfaEnsureRegistroModal();
    if(alfaRegText) alfaRegText.value=String(text||'').trim();
    alfaRegModal?.classList.add('open');
  }

  function alfaIncrementSentCounter(){
    try{
      window.ctMessageCounter?.increment?.();
    }catch(_e){}
  }

  function alfaCopyRegistro(){
    const text=alfaRegText?.value||'';
    if(!text.trim()) return;
    const onDone=()=>{
      alfaIncrementSentCounter();
      alfaClear();
    };
    (navigator.clipboard?.writeText(text)||Promise.resolve()).then(onDone).catch(onDone);
  }

  function alfaCartaSetBusy(isBusy){
    alfaCartaBusy=!!isBusy;
    if(alfaCartaGerarBtn){
      alfaCartaGerarBtn.disabled=alfaCartaBusy;
      const label=alfaCartaGerarBtn.querySelector('span');
      if(label) label.textContent=alfaCartaBusy ? 'GERANDO...' : 'GERAR CARTA';
    }
  }

  function alfaCartaUpdateFileName(){
    if(!alfaCartaFileName) return;
    const file=alfaCartaPdfIn?.files?.[0]||null;
    alfaCartaFileName.textContent=file ? file.name : 'Nenhum arquivo selecionado.';
  }

  function alfaHideCartaModal(){
    alfaCartaModal?.classList.remove('open');
  }

  function alfaEnsureCartaModal(){
    if(alfaCartaModal) return;
    const modal=document.createElement('div');
    modal.id='alfa-carta-modal';
    modal.className='neg-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','alfa-carta-title');
    modal.innerHTML=`
      <div class="neg-modal-content">
        <div class="neg-modal-header">
          <div>
            <div class="neg-modal-eyebrow">GERADOR DE PDF</div>
            <h3 id="alfa-carta-title" class="neg-modal-title">CARTA DE COBRANÇA</h3>
          </div>
          <button class="btn icon" id="alfa-carta-close" type="button" aria-label="Fechar">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
        <div class="neg-modal-body">
          <div class="neg-modal-section">
            <div class="row g-2">
              <div class="col-12">
                <label for="alfa-carta-razao">RAZÃO SOCIAL</label>
                <input id="alfa-carta-razao" type="text" placeholder="RAZÃO SOCIAL" />
              </div>
              <div class="col-12">
                <label for="alfa-carta-cnpj">CNPJ</label>
                <input id="alfa-carta-cnpj" class="guard-cnpj" type="text" inputmode="numeric" maxlength="14" placeholder="00000000000000" />
              </div>
              <div class="col-12">
                <label for="alfa-carta-data">DATA (OPCIONAL)</label>
                <input id="alfa-carta-data" class="guard-date-br" type="text" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" />
              </div>
              <div class="col-12">
                <label for="alfa-carta-pdf">UPLOAD DE PDF</label>
                <input id="alfa-carta-pdf" type="file" accept=".pdf,application/pdf" />
                <small id="alfa-carta-file-name" style="color:var(--muted)">Nenhum arquivo selecionado.</small>
              </div>
            </div>
            <div class="actions justify-content-start">
              <button class="btn primary btn-sm" id="alfa-carta-gerar" type="button">
                <i class="bi bi-file-earmark-pdf" aria-hidden="true"></i>
                <span>GERAR CARTA</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    alfaCartaModal=modal;
    alfaCartaRazaoIn=modal.querySelector('#alfa-carta-razao');
    alfaCartaCnpjIn=modal.querySelector('#alfa-carta-cnpj');
    alfaCartaDataIn=modal.querySelector('#alfa-carta-data');
    alfaCartaPdfIn=modal.querySelector('#alfa-carta-pdf');
    alfaCartaFileName=modal.querySelector('#alfa-carta-file-name');
    alfaCartaGerarBtn=modal.querySelector('#alfa-carta-gerar');
    const closeBtn=modal.querySelector('#alfa-carta-close');
    closeBtn?.addEventListener('click',alfaHideCartaModal);
    modal.addEventListener('click',e=>{
      if(e.target===modal) alfaHideCartaModal();
    });
    alfaCartaPdfIn?.addEventListener('change',alfaCartaUpdateFileName);
    alfaCartaGerarBtn?.addEventListener('click',alfaGenerateCartaCobranca);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape' && alfaCartaModal?.classList.contains('open')){
        alfaHideCartaModal();
      }
    });
  }

  function alfaShowCartaModal(){
    alfaEnsureCartaModal();
    alfaCartaSetBusy(false);
    alfaCartaUpdateFileName();
    alfaCartaModal?.classList.add('open');
    alfaCartaRazaoIn?.focus();
  }

  function alfaCartaNormalizeKey(value){
    return String(value||'')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'');
  }

  function alfaCartaDeaccent(value){
    return String(value||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'');
  }

  function alfaCartaBuildBaseFileNames(operadorNome){
    const opName=String(operadorNome||'').trim();
    const key=alfaCartaNormalizeKey(opName);
    const names=(ALFA_CARTA_OPERADORES[key]||[]).slice();
    if(!names.length && opName) names.push(opName);
    if(!names.length) names.push('Carlyle');
    const files=[];
    const seen=new Set();
    names.forEach(name=>{
      const fileName=`${ALFA_CARTA_BASE_PREFIX}${String(name||'').trim()}.pdf`;
      if(fileName && !seen.has(fileName)){
        seen.add(fileName);
        files.push(fileName);
      }
      const noAccent=`${ALFA_CARTA_BASE_PREFIX}${alfaCartaDeaccent(String(name||'').trim())}.pdf`;
      if(noAccent && !seen.has(noAccent)){
        seen.add(noAccent);
        files.push(noAccent);
      }
    });
    const fallback=`${ALFA_CARTA_BASE_PREFIX}Carlyle.pdf`;
    if(!seen.has(fallback)){
      files.push(fallback);
    }
    return files;
  }

  async function alfaCartaLoadBasePdfBytes(operadorNome){
    const baseDirs=['notifica%C3%A7%C3%A3o/','notificacao/'];
    const fileNames=alfaCartaBuildBaseFileNames(operadorNome);
    const candidates=[];
    const seenUrls=new Set();
    fileNames.forEach(fileName=>{
      baseDirs.forEach(dir=>{
        const url=dir + encodeURIComponent(fileName);
        if(!seenUrls.has(url)){
          seenUrls.add(url);
          candidates.push(url);
        }
      });
    });
    for(const url of candidates){
      try{
        const res=await fetch(url);
        if(res.ok){
          return await res.arrayBuffer();
        }
      }catch(_err){}
    }
    throw new Error('BASE_PDF_NOT_FOUND');
  }

  function alfaCartaFindItem(itemsList, matcher){
    return (itemsList||[]).find(it=>matcher(String(it?.str||'').trim()));
  }

  function alfaCartaToPdfRect(item, viewport){
    const xV=Number(item?.transform?.[4]||0);
    const yV=Number(item?.transform?.[5]||0);
    const heightV=Math.abs(Number(item?.transform?.[3]||0)) || Number(item?.height||0) || 12;
    const widthV=Number(item?.width||0);
    const p1=viewport.convertToPdfPoint(xV, yV);
    const p2=viewport.convertToPdfPoint(xV + widthV, yV - heightV);
    const x=p1[0];
    const yTop=p1[1];
    const yBottom=p2[1];
    const width=Math.abs(p2[0] - p1[0]);
    const height=Math.abs(yTop - yBottom);
    const fontSize=height || Math.max(10, Math.min(13, heightV || 11));
    return {x,yTop,yBottom,width,height,fontSize};
  }

  async function alfaCartaPlaceClientData(opts){
    const page=opts.page;
    const baseBytes=opts.baseBytes;
    const razaoText=String(opts.razaoText||'').trim();
    const cnpjFormatted=String(opts.cnpjText||'').trim();
    const boldFont=opts.boldFont;
    const font=opts.font;
    const rgb=opts.rgb;
    const cnpjLine=cnpjFormatted ? `CNPJ: ${cnpjFormatted}` : '';

    if(!window.pdfjsLib){
      throw new Error('PDFJS_UNAVAILABLE');
    }
    if(window.pdfjsLib.GlobalWorkerOptions){
      window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const loadingTask=window.pdfjsLib.getDocument({data:baseBytes});
    const pdf=await loadingTask.promise;
    const pdfPage=await pdf.getPage(1);
    const viewport=pdfPage.getViewport({scale:1});
    const textContent=await pdfPage.getTextContent();
    const items=textContent.items||[];

    function drawReplaceText(item, text, size, isBold, offsetX=0, offsetY=0){
      if(!item) return false;
      const rect=alfaCartaToPdfRect(item, viewport);
      const fontSize=size || rect.fontSize;
      const textWidth=font.widthOfTextAtSize(text, fontSize);
      const padX=10;
      const padY=6;
      const clearW=Math.max(rect.width, textWidth) + padX * 2;
      const clearH=Math.max(rect.height, fontSize) * 1.4 + padY;
      const rectBottom=rect.yTop - clearH;
      const textY=rectBottom + (clearH - fontSize) * 0.5;
      page.drawRectangle({
        x: rect.x - padX + offsetX,
        y: rectBottom + offsetY,
        width: clearW,
        height: clearH,
        color: rgb(1,1,1)
      });
      if(String(text||'').trim()){
        const drawFont=isBold ? boldFont : font;
        page.drawText(text, {
          x: rect.x + offsetX,
          y: textY + offsetY,
          size: fontSize,
          font: drawFont,
          color: rgb(0,0,0)
        });
      }
      return true;
    }

    function drawTextAt(x, yTop, fontSize, text, isBold){
      if(!String(text||'').trim()) return false;
      const y=yTop - fontSize;
      const drawFont=isBold ? boldFont : font;
      page.drawText(text,{x,y,size:fontSize,font:drawFont,color:rgb(0,0,0)});
      return true;
    }

    const razaoItem=alfaCartaFindItem(items, s=>s.toUpperCase().includes('L R PEREIRA JUNIOR LTDA'));
    const cnpjItem=alfaCartaFindItem(items, s=>s.toUpperCase().startsWith('CNPJ:'));

    let razaoPlaced=false;
    let cnpjPlaced=false;
    const swapRazaoAndCnpj=!!(razaoItem && cnpjItem);
    const razaoTarget=swapRazaoAndCnpj ? cnpjItem : razaoItem;
    const cnpjTarget=swapRazaoAndCnpj ? razaoItem : cnpjItem;

    if(razaoTarget){
      razaoPlaced=drawReplaceText(razaoTarget, razaoText, 12, true, 0, 286);
    }
    if(cnpjTarget && cnpjLine){
      cnpjPlaced=drawReplaceText(cnpjTarget, cnpjLine, 12, true, 0, 286);
    }

    const dateIso=resolveInputDateISOOrNow(opts.dateIso);
    const partsDate=dateIso.split('-').map(Number);
    const meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const yy=partsDate[0], mm=partsDate[1], dd=partsDate[2];
    const dataLinha=dd && mm && yy
      ? 'Toledo, '+String(dd).padStart(2,'0')+' de '+(meses[mm-1]||'')+' de '+yy
      : '';
    const dateRect={x:0, yTop:0, width:0, height:0, fontSize:0};
    dateRect.x=page.getSize().width * 0.58;
    dateRect.yTop=page.getSize().height * 0.78;
    dateRect.width=220;
    dateRect.height=12;
    dateRect.fontSize=11;
    if(dataLinha && dateRect){
      const rect=dateRect;
      const fontSize=Math.max(8, (rect.fontSize || 11) - 1);
      const textWidth=font.widthOfTextAtSize(dataLinha, fontSize);
      const padX=10;
      const padY=6;
      const clearW=Math.max(rect.width || 0, textWidth) + padX * 2;
      const clearH=Math.max(rect.height || fontSize, fontSize) * 1.4 + padY;
      const rectBottom=rect.yTop - clearH;
      const textY=rectBottom + (clearH - fontSize) * 0.5;
      const offsetX=23;
      const offsetY=-12;
      page.drawRectangle({
        x: rect.x + offsetX - padX,
        y: rectBottom + offsetY,
        width: clearW,
        height: clearH,
        color: rgb(1,1,1)
      });
      page.drawText(dataLinha, {x: rect.x + offsetX, y: textY + offsetY, size: fontSize, font, color: rgb(0,0,0)});
    }

    if(!razaoPlaced || (cnpjLine && !cnpjPlaced)){
      const anchorItem=alfaCartaFindItem(items, s=>/prezados/i.test(s));
      if(anchorItem){
        const anchorRect=alfaCartaToPdfRect(anchorItem, viewport);
        const fontSize=Math.max(11, Math.min(13, anchorRect.height||12));
        const lineGap=fontSize * 1.2;
        const lift=lineGap * 13.5;
        if(!razaoPlaced){
          razaoPlaced=drawTextAt(anchorRect.x, anchorRect.yTop + lineGap * 2 + lift, fontSize, razaoText, true);
        }
        if(cnpjLine && !cnpjPlaced){
          cnpjPlaced=drawTextAt(anchorRect.x, anchorRect.yTop + lineGap + lift, fontSize, cnpjLine, true);
        }
      }
    }

    if(!razaoPlaced){
      throw new Error('RAZAO_POSITION_NOT_FOUND');
    }
    if(cnpjLine && !cnpjPlaced){
      throw new Error('CNPJ_POSITION_NOT_FOUND');
    }
  }

  function alfaCartaDownload(bytes, fileName){
    const blob=new Blob([bytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=fileName;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),800);
  }

  async function alfaGenerateCartaCobranca(){
    if(alfaCartaBusy) return;
    const razao=String(alfaCartaRazaoIn?.value||'').trim();
    const cnpjDigits=onlyDigits(alfaCartaCnpjIn?.value||'').slice(0,14);
    const dateRaw=String(alfaCartaDataIn?.value||'').trim();
    const uploadFile=alfaCartaPdfIn?.files?.[0]||null;
    if(!razao){
      alert('Informe a Razão Social.');
      return;
    }
    if(cnpjDigits.length!==14){
      alert('Informe um CNPJ com 14 dígitos.');
      return;
    }
    if(!uploadFile){
      alert('Selecione o PDF para anexar.');
      return;
    }
    if(!window.PDFLib){
      alert('Biblioteca de PDF não carregada.');
      return;
    }

    alfaCartaSetBusy(true);
    try{
      const operadorAtual=alfaNormalizeOperator(operadorSel.value||'');
      const baseBytes=await alfaCartaLoadBasePdfBytes(operadorAtual.nome||'');
      const uploadBytes=await uploadFile.arrayBuffer();
      const {PDFDocument, StandardFonts, rgb}=window.PDFLib;
      const baseDoc=await PDFDocument.load(baseBytes);
      const uploadDoc=await PDFDocument.load(uploadBytes);
      const basePageCount=baseDoc.getPageCount();
      if(basePageCount<1){
        throw new Error('BASE_WITHOUT_PAGES');
      }

      const outDoc=await PDFDocument.create();
      const [firstPage]=await outDoc.copyPages(baseDoc,[0]);
      outDoc.addPage(firstPage);
      const font=await outDoc.embedFont(StandardFonts.Helvetica);
      const boldFont=await outDoc.embedFont(StandardFonts.HelveticaBold);
      await alfaCartaPlaceClientData({
        page:firstPage,
        baseBytes,
        razaoText:razao.toLocaleUpperCase('pt-BR'),
        cnpjText:formatCNPJCustom(cnpjDigits),
        dateIso:resolveInputDateISOOrNow(dateRaw),
        boldFont,
        font,
        rgb
      });

      const uploadPageIndexes=uploadDoc.getPageIndices();
      if(uploadPageIndexes.length){
        const uploadPages=await outDoc.copyPages(uploadDoc,uploadPageIndexes);
        uploadPages.forEach(p=>outDoc.addPage(p));
      }

      if(basePageCount>1){
        const restIndexes=[];
        for(let i=1;i<basePageCount;i++) restIndexes.push(i);
        const restPages=await outDoc.copyPages(baseDoc,restIndexes);
        restPages.forEach(p=>outDoc.addPage(p));
      }

      const outBytes=await outDoc.save();
      const fileName='Carta de Cobranca - '+cnpjDigits+'.pdf';
      alfaCartaDownload(outBytes,fileName);
      alfaHideCartaModal();
    }catch(err){
      console.error(err);
      alert('Não foi possível gerar a carta. Verifique o PDF base e o arquivo enviado.');
    }finally{
      alfaCartaSetBusy(false);
    }
  }

  function alfaTodayBR(){
    const now=new Date();
    return `${pad2(now.getDate())}/${pad2(now.getMonth()+1)}/${now.getFullYear()}`;
  }

  function alfaRegistroQtd(){
    const qtd=Number(alfaLastCtx?.qtd||0);
    if(Number.isFinite(qtd) && qtd>0) return String(qtd);
    const parsed=alfaExtractEsferaData(esferaIn.value||'');
    const count=(parsed?.titulos||[]).length;
    return count>0 ? String(count) : '[NÚMERO DE BOLETOS EM ATRASO]';
  }

  function alfaBuildRegistroText(){
    const date=alfaTodayBR();
    const qtd=alfaRegistroQtd();
    const lines=[
      date,
      'Whatsapp: [INSERIR NÚMERO DO CLIENTE]'
    ];
    if(alfaLastKind==='fria'){
      lines.push('— Solicitei contato com o responsável pelo CNPJ;');
      lines.push('— Aguardando retorno;');
    }
    if(alfaLastKind==='previsao-serasa'){
      lines.push(`— Informei o cliente sobre ${qtd} boleto(s) em atraso e seu devido registro no Serasa;`);
      lines.push('— Solicitei a previsão para o pagamento;');
    }
    if(alfaLastKind==='risco-bloqueio'){
      lines.push(`— Informei o cliente sobre o risco de bloqueio de crédito integral em razão de ${qtd} boleto(s) em atraso;`);
      lines.push('— Solicitei que o pagamento seja feito ainda nessa semana;');
    }
    if(alfaLastKind==='regularizacao-urgente'){
      lines.push(`— Informei o cliente que seu cadastro tem registros no Serasa e atualmente está com o crédito bloqueado por razão do(s) ${qtd} boleto(s) em atraso;`);
      lines.push('— Solicitei o pagamento com imediato para evitar direcionamento ao setor jurídico;');
    }
    if(lines.length===2){
      lines.push('— Registro de contato realizado;');
    }
    lines.push('– – – – –');
    return lines.join('\n');
  }

  function alfaShowOutput(text){
    if(text && text.trim()){
      outArea.value=text;
      outWrap.style.display='block';
      outWrap.classList.add('reveal');
      outArea.classList.remove('flash');
      void outArea.offsetWidth;
      outArea.classList.add('flash');
      return;
    }
    outArea.value='';
    outWrap.style.display='none';
  }

  function alfaPick(arr){
    if(!Array.isArray(arr) || !arr.length) return '';
    return arr[Math.floor(Math.random()*arr.length)] || '';
  }

  function alfaHumanList(items){
    const xs=(items||[]).filter(Boolean);
    if(!xs.length) return '';
    if(xs.length===1) return xs[0];
    if(xs.length===2) return `${xs[0]} e ${xs[1]}`;
    return `${xs.slice(0,-1).join(', ')} e ${xs[xs.length-1]}`;
  }

  function alfaOneLine(text){
    return String(text||'')
      .replace(/\s*\r?\n+\s*/g,' ')
      .replace(/\s{2,}/g,' ')
      .trim();
  }

  function alfaNormalizeNotasFormatting(text){
    return String(text||'')
      .replace(/`((?:`\d+`)(?:\s*,\s*`\d+`)*(?:\s+e\s+`\d+`)?)`/g,'$1');
  }

  function alfaNormalizeNota(raw){
    return String(raw||'').trim().split('-')[0].replace(/\D+/g,'');
  }

  function alfaShortNota(nota){
    const d=String(nota||'').replace(/\D+/g,'');
    if(!d) return '';
    return d.replace(/^0+(?=\d)/,'');
  }

  function alfaExtractEsferaData(raw){
    const text=String(raw||'');
    const lembreteRe=/\*{3}\s*Lembrete de Cobran(?:ça|ca)\s*\(Auto\.\)\s*\*{3}/i;
    const lembreteMatch=text.match(lembreteRe);
    const baseText=lembreteMatch ? text.slice(0, lembreteMatch.index) : text;
    const titulos=[];
    const notaSet=new Set();

    const pushTitulo=(notaRaw,itemRaw,emissaoRaw,venctoRaw,valorRaw)=>{
      const nota=alfaNormalizeNota(notaRaw);
      const itemNum=parseInt(String(itemRaw||'').replace(/\D+/g,''),10);
      const item=Number.isFinite(itemNum) ? String(itemNum).padStart(3,'0') : '000';
      const emissao=String(emissaoRaw||'').trim();
      const vencto=String(venctoRaw||'').trim();
      const valor=parseBR(valorRaw);
      if(!nota || !vencto || !Number.isFinite(valor)) return;
      titulos.push({nota,item,emissao,vencto,valor});
      notaSet.add(nota);
    };

    const rowTableRe=/^\s*([0-9.\-]+)\s+(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)\s*$/;
    const rowTituloRe=/Título:\s*\d+\s+(\d{1,3})\s+([0-9.\-]+)\s+Emiss(?:ão|ao):\s*(\d{2}\/\d{2}\/\d{4})\s+Vencto:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]*?Valor:\s*R\$\s*([\d.,]+)/i;
    const rowTituloNfRe=/Título:\s*\S+\s+\S+\s+NF:\s*([0-9.\-]+)\s*-\s*(\d{1,3})[\s\S]*?Dt\.:\s*(\d{2}\/\d{2}\/\d{4})\s+Vencto\.:\s*(\d{2}\/\d{2}\/\d{4})\s+R\$:\s*([\d.,]+)/i;

    baseText.split(/\r?\n/).forEach(line=>{
      const normalized=String(line||'').trim().replace(/\s{2,}/g,' ');
      if(!normalized) return;

      let m=normalized.match(rowTableRe);
      if(m){
        pushTitulo(m[1],m[2],m[3],m[4],m[5]);
        return;
      }

      m=normalized.match(rowTituloRe);
      if(m){
        pushTitulo(m[2],m[1],m[3],m[4],m[5]);
        return;
      }

      m=normalized.match(rowTituloNfRe);
      if(m){
        pushTitulo(m[1],m[2],m[3],m[4],m[5]);
      }
    });

    const total=titulos.reduce((acc,t)=>acc+(t.valor||0),0);
    return {
      titulos,
      notas:[...notaSet],
      total
    };
  }

  function alfaNormalizeOperator(value){
    const raw=String(value||'');
    const [nome,telefone]=raw.split('|');
    return {
      nome:(nome||'').trim(),
      telefone:(telefone||'').trim()
    };
  }

  function alfaGetSystemHour(){
    return new Date().getHours();
  }

  function alfaBlockSaudacao(){
    const manha=[
      '*Bom dia*, tudo bem?',
      '*Bom dia*, tudo bem com você?',
      '*Bom dia*, tudo bom?'
    ];
    const tarde=[
      '*Boa tarde*, tudo bem?',
      '*Boa tarde*, tudo bem com você?',
      '*Boa tarde*, tudo bom?'
    ];
    return alfaGetSystemHour()<12 ? alfaPick(manha) : alfaPick(tarde);
  }

  function alfaBlockIdentificacao(nome){
    const n=nome||'operador';
    return alfaPick([
      `Meu nome é *${n}*, faço parte do *setor financeiro* da *Prati-Donaduzzi*.`,
      `Meu nome é *${n}*, falo do *setor financeiro* da *Prati-Donaduzzi*.`,
      `Me chamo *${n}*, falo em nome do *setor financeiro* da *Prati-Donaduzzi*.`,
      `Me chamo *${n}*, faço do *setor financeiro* da *Prati-Donaduzzi*.`,
      `Sou *${n}*, do *setor financeiro* da *Prati-Donaduzzi*.`
    ]);
  }

  function alfaBuildContext(){
    const esferaRaw=String(esferaIn.value||'').trim();
    if(!esferaRaw){
      alert('Preencha o texto do esfera para gerar a mensagem.');
      return null;
    }
    const esfera=alfaExtractEsferaData(esferaRaw);
    const operador=alfaNormalizeOperator(operadorSel.value);
    const cnpjDigits=onlyDigits(cnpjIn.value||'').slice(0,14);
    const cnpjFmt=cnpjDigits.length===14 ? formatCNPJCustom(cnpjDigits) : '';
    const notasFull=esfera.notas.filter(Boolean);
    const notasShort=notasFull.map(alfaShortNota).filter(Boolean);
    const notasShortFmt=notasShort.length
      ? alfaHumanList(notasShort.map(n=>`\`${n}\``))
      : '`000000`';
    const qtd=esfera.titulos.length;
    const notasCount=notasShort.length;
    const notaPrep=notasCount===1 ? 'à' : 'às';
    const notaTerm=notasCount===1 ? 'nota fiscal' : 'notas fiscais';
    return {
      operador,
      cnpjFmt,
      qtd,
      qtdFmt:String(qtd),
      qtdTxt:String(qtd),
      valorFmt:`R$ ${formatBR(esfera.total)}`,
      notasShortFmt,
      notaPrep,
      notaTerm
    };
  }

  function alfaComposeFria(ctx){
    const cnpjTag=ctx.cnpjFmt ? `\`${ctx.cnpjFmt}\`` : '`00.000.000/0000-00`';
    const pergunta=alfaPick([
      `Falo com o(a) responsável pelo CNPJ ${cnpjTag}?`,
      `Consigo falar com o(a) responsável pelo CNPJ ${cnpjTag}?`,
      `O(A) responsável pelo CNPJ ${cnpjTag} se encontra?`,
      `Poderia me confirmar se falo com o(a) responsável pelo CNPJ ${cnpjTag}?`,
      `Gostaria de falar com o(a) responsável pelo CNPJ ${cnpjTag}?`,
      `O responsável pelo CNPJ ${cnpjTag} se encontra?`,
      `Poderia, por getileza, confirmar se falo com o(a) responsável pelo CNPJ ${cnpjTag}?`,
      `Falo com a pessoa responsável pelo CNPJ ${cnpjTag}?`,
      `Você poderia confirmar se falo com o(a) responsável pelo CNPJ ${cnpjTag}?`,
      `Preciso falar com o(a) responsável pelo CNPJ ${cnpjTag}, seria possível?`
    ]);
    return `${alfaBlockSaudacao()} ${alfaBlockIdentificacao(ctx.operador.nome)} ${pergunta}`;
  }

  function alfaComposePendencia(ctx){
    if(ctx.qtd===1){
      return alfaPick([
        `Consta \`${ctx.qtdFmt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Identificamos \`${ctx.qtdFmt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Há \`${ctx.qtdFmt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Existe \`${ctx.qtdFmt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no montante de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Consta em aberto \`${ctx.qtdFmt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `No cadastro consta \`${ctx.qtdFmt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com o valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Identificamos em seu cadastro \`${ctx.qtdFmt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Você tem em seu cadastro \`${ctx.qtdFmt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Consta \`${ctx.qtdFmt}\` *boleto vencido* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Seu cadastro tem \`${ctx.qtdFmt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor de \`${ctx.valorFmt}\` *+ encargos*.`
      ]);
    }
    return alfaPick([
      `Constam \`${ctx.qtdFmt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Identificamos \`${ctx.qtdFmt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Há \`${ctx.qtdFmt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Existem \`${ctx.qtdFmt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no montante total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Constam em aberto \`${ctx.qtdFmt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `No cadastro constam \`${ctx.qtdFmt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com o valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Identificamos em seu cadastro \`${ctx.qtdFmt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Você tem em seu cadastro \`${ctx.qtdFmt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Constam \`${ctx.qtdFmt}\` boletos *vencidos* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Seu cadastro tem \`${ctx.qtdFmt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`
    ]);
  }

  function alfaComposeRiscoSerasa(){
    return alfaPick([
      'Preciso da *previsão de pagamento* para evitar registro junto ao *Serasa*.',
      'Preciso do seu *retorno com data prevista* para quitação para evitar registro junto ao *Serasa*.',
      'Solicito a *previsão de regularização* para evitar registro junto ao *Serasa*.',
      'Preciso de *previsão de pagamento* para evitar registro junto ao *Serasa*.',
      'Preciso de *retorno com previsão de regularização* para evitar registro junto ao *Serasa*.',
      'Preciso da sua *previsão de pagamento* para evitar registro junto ao *Serasa*.',
      'Preciso de uma *posição com previsão de regularização* para evitar registro junto ao *Serasa*.',
      'Preciso de *retorno com data prevista de pagamento* para evitar registro junto ao *Serasa*.',
      'Preciso de *previsão de quitação* para evitar registro junto ao *Serasa*.',
      'Preciso do *retorno com previsão de pagamento* para evitar registro junto ao *Serasa*.'
    ]);
  }

  function alfaComposeCompromisso(){
    return alfaPick([
      'Posso contar com a regularização *ainda nesta semana*?',
      'Posso contar com o pagamento *ainda nesta semana*?',
      'Você efetuará o pagamento *ainda nesta semana*?',
      'Você pode concluir a quitação *ainda nesta semana*?',
      'Posso contar com a quitação *ainda nesta semana*?',
      'Posso contar com seu comprometimento em regularizar o cadastro *ainda nesta semana*?',
      'Posso contar com o pagamento até o *final da semana*?',
      'Você consegue pagar *ainda nesta semana*?',
      'Você pode regularizar a inadimplência *ainda nesta semana*?',
      'Posso contar com o pagamento *ainda nesta semana*?'
    ]);
  }

  function alfaComposePrevisaoSerasa(ctx){
    const pendencia=String(alfaComposePendencia(ctx)||'').trim().replace(/\.\s*$/,'');
    const avisoSerasa=String(alfaComposeRiscoSerasa()||'')
      .trim()
      .replace(/^([A-ZÀ-Ý])/u,m=>m.toLowerCase());
    return `${alfaBlockSaudacao()} ${pendencia}, ${avisoSerasa} ${alfaComposeCompromisso()}`;
  }

  function alfaComposeRiscoCredito(ctx){
    if(ctx.qtd===1){
      return alfaPick([
        `Há risco de *bloqueio integral de crédito* no cadastro por conta do *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Seu cadastro está sob risco de *bloqueio integral de crédito* devido ao *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Existe risco de *bloqueio integral de crédito* no cadastro em razão d *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`,
        `O cadastro está em risco de *bloqueio integral de crédito* por conta do *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Temos risco de *bloqueio integral de crédito* no cadastro devido ao *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Há iminência de *bloqueio integral de crédito* por conta do *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, somando \`${ctx.valorFmt}\` *+ encargos*.`,
        `Seu cadastro pode sofrer *bloqueio integral de crédito* em razão do *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Identificamos risco de *bloqueio integral de crédito* no cadastro devido ao *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Há risco imediato de *bloqueio integral de crédito* por conta do *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `O cadastro encontra-se com risco de *bloqueio integral de crédito* pelo *boleto em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`
      ]);
    }
    return alfaPick([
      `Há risco de *bloqueio integral de crédito* no cadastro por conta dos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Seu cadastro está sob risco de *bloqueio integral de crédito* devido aos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Existe risco de *bloqueio integral de crédito* no cadastro em razão dos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`,
      `O cadastro está em risco de *bloqueio integral de crédito* por conta dos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Temos risco de *bloqueio integral de crédito* no cadastro devido aos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Há iminência de *bloqueio integral de crédito* por conta dos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, somando \`${ctx.valorFmt}\` *+ encargos*.`,
      `Seu cadastro pode sofrer *bloqueio integral de crédito* em razão dos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Identificamos risco de *bloqueio integral de crédito* no cadastro devido aos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Há risco imediato de *bloqueio integral de crédito* por conta dos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `O cadastro encontra-se com risco de *bloqueio integral de crédito* pelos \`${ctx.qtdFmt}\` *boletos em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`
    ]);
  }

  function alfaComposeUrgencia(){
    return alfaPick([
      'Preciso da regularização *ainda nesta semana*.',
      'Preciso regularizar *ainda nesta semana*.',
      'Preciso dessa regularização *ainda nesta semana*.',
      'Preciso da quitação *ainda nesta semana*.'
    ]);
  }

  function alfaComposeUrgenciaImediata(){
    return alfaPick([
      'Preciso de retorno com confirmação de pagamento *ainda hoje*.',
      'Preciso da confirmação de regularização *ainda hoje*.',
      'Preciso de uma posição imediata para regularização *ainda hoje*.',
      'Preciso do seu retorno para conclusão da regularização *ainda hoje*.',
      'Preciso de confirmação dos pagamentos *ainda hoje*.'
    ]);
  }

  function alfaComposeRiscoBloqueio(ctx){
    return `${alfaBlockSaudacao()} ${alfaComposeRiscoCredito(ctx)} ${alfaComposeUrgencia()}`;
  }

  function alfaComposeRegistroBloqueio(ctx){
    if(ctx.qtd===1){
      return alfaPick([
        `Seu cadastro está com *registro no Serasa* e com *bloqueio integral de crédito* devido ao \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Seu cadastro possui *registro no Serasa* e *bloqueio integral de crédito* por conta do \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Consta *registro no Serasa* e *bloqueio integral de crédito* no cadastro em razão do \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`,
        `O cadastro está com *registro no Serasa* e com *bloqueio integral de crédito* por conta do \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Há *registro no Serasa* e *bloqueio integral de crédito* no cadastro devido ao \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Seu cadastro permanece com *registro no Serasa* e com *bloqueio integral de crédito* em função do \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`,
        `Identificamos *registro no Serasa* e *bloqueio integral de crédito* no cadastro por conta do \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `No cadastro consta *registro no Serasa* e *bloqueio integral de crédito* devido ao \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Seu cadastro já está com *registro no Serasa* e com *bloqueio integral de crédito* por conta do \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, total de \`${ctx.valorFmt}\` *+ encargos*.`,
        `Existe *registro no Serasa* e *bloqueio integral de crédito* no cadastro em razão do \`${ctx.qtdTxt}\` boleto *em atraso* referente ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`
      ]);
    }
    return alfaPick([
      `Seu cadastro está com *registros no Serasa* e com *bloqueio integral de crédito* devido aos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Seu cadastro possui *registros no Serasa* e *bloqueio integral de crédito* por conta dos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Constam *registros no Serasa* e *bloqueio integral de crédito* no cadastro em razão dos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`,
      `O cadastro está com *registros no Serasa* e com *bloqueio integral de crédito* por conta dos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, com total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Há *registros no Serasa* e *bloqueio integral de crédito* no cadastro devido aos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Seu cadastro permanece com *registros no Serasa* e com *bloqueio integral de crédito* em função dos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`,
      `Identificamos *registros no Serasa* e *bloqueio integral de crédito* no cadastro por conta dos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `No cadastro constam *registros no Serasa* e *bloqueio integral de crédito* devido aos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, no valor total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Seu cadastro já está com *registros no Serasa* e com *bloqueio integral de crédito* por conta dos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, total de \`${ctx.valorFmt}\` *+ encargos*.`,
      `Existem *registros no Serasa* e *bloqueio integral de crédito* no cadastro em razão dos \`${ctx.qtdTxt}\` boletos *em atraso* referentes ${ctx.notaPrep} ${ctx.notaTerm} \`${ctx.notasShortFmt}\`, totalizando \`${ctx.valorFmt}\` *+ encargos*.`
    ]);
  }

  function alfaComposeDirecionamentoJuridico(){
    return alfaPick([
      'Para evitar direcionamento ao *setor jurídico*.',
      'A fim de evitar direcionamento ao *setor jurídico*.',
      'Para impedir direcionamento ao *setor jurídico*.',
      'Para evitar o direcionamento ao *setor jurídico*.'
    ]);
  }

  function alfaComposeRegularizacaoUrgente(ctx){
    const urgencia=String(alfaComposeUrgenciaImediata()||'').trim().replace(/\.\s*$/,'');
    const direcionamento=String(alfaComposeDirecionamentoJuridico()||'')
      .trim()
      .replace(/^([A-ZÀ-Ý])/u,m=>m.toLowerCase());
    return `${alfaBlockSaudacao()} ${alfaComposeRegistroBloqueio(ctx)} ${urgencia}, ${direcionamento}`;
  }

  function alfaGenerate(kind){
    const ctx=alfaBuildContext();
    if(!ctx) return;
    if(kind!=='fria' && (!ctx.qtd || ctx.qtd<1)){
      alert('Não consegui identificar os títulos no texto do esfera. Verifique se o conteúdo está no padrão esperado.');
      return;
    }
    let msg='';
    if(kind==='fria') msg=alfaComposeFria(ctx);
    if(kind==='previsao-serasa') msg=alfaComposePrevisaoSerasa(ctx);
    if(kind==='risco-bloqueio') msg=alfaComposeRiscoBloqueio(ctx);
    if(kind==='regularizacao-urgente') msg=alfaComposeRegularizacaoUrgente(ctx);
    if(!msg.trim()) return;
    alfaLastCtx=ctx;
    alfaLastKind=kind;
    alfaShowOutput(alfaNormalizeNotasFormatting(alfaOneLine(msg)));
  }

  function alfaCopy(){
    const text=outArea.value||'';
    if(!text.trim()) return;
    const onDone=()=>{
      btnCopiar?.classList.add('copied');
      setTimeout(()=>btnCopiar?.classList.remove('copied'),1100);
      alfaShowRegistroModal(alfaBuildRegistroText());
    };
    (navigator.clipboard?.writeText(text)||Promise.resolve()).then(onDone).catch(onDone);
  }

  function alfaClear(){
    cnpjIn.value='';
    esferaIn.value='';
    alfaShowOutput('');
    alfaHideRegistroModal();
    alfaHideCartaModal();
    alfaLastKind='previsao-serasa';
    alfaLastCtx=null;
  }

  btnFria.addEventListener('click',()=>alfaGenerate('fria'));
  btnPrevisaoSerasa.addEventListener('click',()=>alfaGenerate('previsao-serasa'));
  btnRiscoBloqueio.addEventListener('click',()=>alfaGenerate('risco-bloqueio'));
  btnRegularizacaoUrgente.addEventListener('click',()=>alfaGenerate('regularizacao-urgente'));
  btnNotificacaoCobranca?.addEventListener('click',alfaShowCartaModal);
  operadorSel.addEventListener('change',alfaPersistOperator);
  btnCopiar?.addEventListener('click',alfaCopy);
  btnLimpar?.addEventListener('click',alfaClear);
  esferaIn.addEventListener('keydown',e=>{
    if((e.ctrlKey || e.metaKey) && e.key==='Enter'){
      e.preventDefault();
      alfaGenerate(alfaLastKind);
    }
  });
})();

/* =======================================================================================
   FORMATAÇÃO DE COBRANÇAS
   ======================================================================================= */
(function initFC(){
  const esferaIn=document.getElementById('fc-esfera-in');
  const esferaOut=document.getElementById('fc-esfera-out');
  const esferaWrap=document.getElementById('fc-esfera-wrap');
  const esferaFormat=document.getElementById('fc-esfera-formatar');
  const esferaCopy=document.getElementById('fc-esfera-copiar');
  const cliCodigo=document.getElementById('fc-codigo');
  const cliCnpj=document.getElementById('fc-cnpj');
  const cliUf=document.getElementById('fc-uf');
  const cliOut=document.getElementById('fc-cli-out');
  const cliWrap=document.getElementById('fc-cli-wrap');
  const cliFormat=document.getElementById('fc-cli-formatar');
  const cliCopy=document.getElementById('fc-cli-copiar');
  const telInput=document.getElementById('fc-tel');
  const histInput=document.getElementById('fc-hist');
  const whatsOut=document.getElementById('fc-whats-out');
  const whatsWrap=document.getElementById('fc-whats-wrap');
  const whatsFormat=document.getElementById('fc-whats-formatar');
  const whatsCopy=document.getElementById('fc-whats-copiar');
  const insAudio=document.getElementById('fc-ins-audio');
  const insNF=document.getElementById('fc-ins-nf');
  const insBoleto=document.getElementById('fc-ins-boleto');
  const insChavePix=document.getElementById('fc-insert-chave-pix');
  const insCobrancaMeta=document.getElementById('fc-insert-cobranca-meta');
  if(!esferaIn || !esferaOut || !esferaWrap) return;

  function fcShowOutput(wrap, out, text){
    if(!wrap || !out) return;
    if(text && text.trim()){
      out.value=text;
      wrap.style.display='block';
      wrap.classList.add('reveal');
      out.classList.remove('flash');
      void out.offsetWidth;
      out.classList.add('flash');
    }else{
      out.value='';
      wrap.style.display='none';
    }
  }
  function fcCopyOut(btn, out){
    const text=out?.value||'';
    if(!text.trim()) return;
    (navigator.clipboard?.writeText(text)||Promise.resolve()).then(()=>{
      btn?.classList.add('copied');
      setTimeout(()=>btn?.classList.remove('copied'),1100);
    });
  }
  function fcFormatEsfera(raw){
    const text=String(raw||'');
    const re=/Título:\s*(\d+)\s+(\d+)\s+([0-9-]+)[\s\S]*?Vencto:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]*?Valor:\s*R\$\s*([\d\.,]+)/gi;
    const out=[];
    let m;
    while((m=re.exec(text))!==null){
      const parcela=parseInt(m[2],10);
      const nf=cleanNF(m[3]);
      const vencto=m[4];
      const valor=(m[5]||'').trim();
      if(!parcela || !nf || nf==='0' || !vencto || !valor) continue;
      out.push(`NOTA FISCAL ${nf} | Parcela ${parcela} | ${vencto}`);
      out.push(valor);
    }
    return out.join('\n');
  }
  function fcFormatCliente(codRaw, cnpjRaw, ufRaw){
    const cod=onlyDigits(codRaw||'').slice(0,6);
    const cnpj=onlyDigits(cnpjRaw||'').slice(0,14);
    const uf=String(ufRaw||'').replace(/[^a-zA-Z]/g,'').toUpperCase().slice(0,2);
    return `[${cod}][${uf}]\n[${cnpj}]`;
  }
  const fcFormatTelefone=formatTelefoneCob;
  function fcFormatHistorico(raw){
    const lines=String(raw||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if(!lines.length) return '';
    const tsRe=/^\[\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}\]\s+Prati Donaduzzi:\s+/;
    const tokens=new Set([
      '~MENSAGEM DE ÁUDIO~',
      '~ANEXO DE NOTA FISCAL~',
      '~ANEXO DE BOLETO BANCÁRIO~',
      '~ANEXO DE CHAVE PIX~',
      '~ANEXO DE COBRANÇA META~'
    ]);
    const realLines=lines.filter(l=>!tokens.has(l));
    const hasPrefixLine=lines.some(l=>tsRe.test(l));
    const shouldGenerateSingleTs=!hasPrefixLine && realLines.length===1;
    const buildPrefix=()=>{
      const now=new Date();
      return `[${pad2(now.getHours())}:${pad2(now.getMinutes())}, ${pad2(now.getDate())}/${pad2(now.getMonth()+1)}/${now.getFullYear()}] Prati Donaduzzi: `;
    };
    const singlePrefix=shouldGenerateSingleTs ? buildPrefix() : '';
    let lastTsPrefix=hasPrefixLine ? '' : singlePrefix;
    const out=[];
    lines.forEach(line=>{
      const match=line.match(tsRe);
      if(match){
        lastTsPrefix=match[0];
      }
      const isToken=tokens.has(line);
      const startsWithTs=!!match;
      if(isToken && !startsWithTs && lastTsPrefix){
        out.push(lastTsPrefix+line);
        return;
      }
      if(!startsWithTs && singlePrefix && realLines.length===1 && !isToken){
        lastTsPrefix=singlePrefix;
        out.push(singlePrefix+line);
        return;
      }
      out.push(line);
    });
    return out.join('\n');
  }
  function fcInsertToken(token){
    if(!histInput) return;
    histInput.focus();
    const val=histInput.value;
    const start=histInput.selectionStart ?? val.length;
    const end=histInput.selectionEnd ?? val.length;
    const before=val.slice(0,start);
    const selected=val.slice(start,end);
    const after=val.slice(end);
    const needsBreakBefore=before && !before.endsWith('\n');
    const nextText=selected || after;
    const needsBreakAfter=nextText && !nextText.startsWith('\n');
    const insert=`${needsBreakBefore ? '\n' : ''}${token}${needsBreakAfter ? '\n' : ''}`;
    histInput.value=before+insert+selected+after;
    const pos=before.length+insert.length;
    histInput.setSelectionRange(pos,pos);
  }

  esferaFormat?.addEventListener('click',()=>{
    const out=fcFormatEsfera(esferaIn.value||'');
    fcShowOutput(esferaWrap, esferaOut, out);
  });
  esferaCopy?.addEventListener('click',()=>fcCopyOut(esferaCopy, esferaOut));

  cliFormat?.addEventListener('click',()=>{
    const out=fcFormatCliente(cliCodigo?.value, cliCnpj?.value, cliUf?.value);
    fcShowOutput(cliWrap, cliOut, out);
  });
  cliCopy?.addEventListener('click',()=>fcCopyOut(cliCopy, cliOut));

  whatsFormat?.addEventListener('click',()=>{
    const telefone=fcFormatTelefone(telInput?.value);
    const hist=fcFormatHistorico(histInput?.value||'');
    const out=[telefone, hist].filter(Boolean).join('\n');
    fcShowOutput(whatsWrap, whatsOut, out);
  });
  whatsCopy?.addEventListener('click',()=>fcCopyOut(whatsCopy, whatsOut));

  insAudio?.addEventListener('click',()=>fcInsertToken('~MENSAGEM DE ÁUDIO~'));
  insNF?.addEventListener('click',()=>fcInsertToken('~ANEXO DE NOTA FISCAL~'));
  insBoleto?.addEventListener('click',()=>fcInsertToken('~ANEXO DE BOLETO BANCÁRIO~'));
  insChavePix?.addEventListener('click',()=>fcInsertToken('~ANEXO DE CHAVE PIX~'));
  insCobrancaMeta?.addEventListener('click',()=>fcInsertToken('~ANEXO DE COBRANÇA META~'));
})();

/* =======================================================================================
   FORMATAÇÃO DE TÍTULOS (MODO EM ABERTO / ATUALIZADOS)
   ======================================================================================= */
let fMode='aberto';
function fSetMode(m){
  if(m===fMode) return;
  fMode=m;
  document.getElementById('f-tab-aberto').classList.toggle('primary', m==='aberto');
  document.getElementById('f-tab-atual').classList.toggle('primary', m==='atual');
  document.getElementById('f-m-aberto').classList.toggle('active', m==='aberto');
  document.getElementById('f-m-atual').classList.toggle('active', m==='atual');
  document.querySelectorAll('#f-m-atual .panel-section, #f-m-aberto .panel-section').forEach(el=>{
    if(!el || el.style.display==='none') return;
    el.classList.remove('pop-anim'); void el.offsetWidth; el.classList.add('pop-anim');
  });
}
document.getElementById('f-tab-aberto').addEventListener('click',()=>fSetMode('aberto'));
document.getElementById('f-tab-atual').addEventListener('click',()=>fSetMode('atual'));

function fParseEsfera(raw){
  const lines=String(raw||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let nome='';
  for(const l of lines){
    const i=l.indexOf(',');
    if(i>0){ nome=l.slice(0,i).trim(); break; }
  }
  const rows=[];
  const hasTituloFormat = lines.some(l=>/^t[íi]tulo:/i.test(l));
  if(hasTituloFormat){
    const reTitulo=/^\s*T[íi]tulo:\s*(\S+)\s+(\d{1,3})\s+([0-9.\-]+)\s+Emiss(?:ão|ao):\s*(\d{2}\/\d{2}\/\d{4})\s+Vencto:\s*(\d{2}\/\d{2}\/\d{4})[^\n]*?Dias:\s*(\d+)[^\n]*?Valor:\s*R\$\s*([\d\.,]+)/i;
    for(const l of lines){
      const normalized=l.replace(/\s{2,}/g,' ');
      const m=normalized.match(reTitulo);
      if(m){
        const item=String(parseInt(m[2],10));
        const nota=cleanNF(m[3]);
        const emissao=m[4];
        const vencto=m[5];
        const dias=m[6]?String(parseInt(m[6],10)):'';
        const valor=parseBR(m[7]);
        rows.push({nota, item, emissao, vencto, valor, dias});
      }
    }
  }else{
    const reRow=/^([0-9.\-]+)\s+(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d\.,]+)\s*$/;
    for(const l of lines){
      const m=l.replace(/\s{2,}/g,' ').match(reRow);
      if(m){
        const nota=cleanNF(m[1]), item=String(parseInt(m[2],10)),
              emissao=m[3], vencto=m[4];
        const valor=parseBR(m[5]);
        rows.push({nota, item, emissao, vencto, valor, dias:''});
      }
    }
  }
  return {nome, rows};
}

function fGerarAberto(){
  const razaoManual=(document.getElementById('f-razaoA').value||'').trim();
  const parsed=fParseEsfera(document.getElementById('f-esfera').value);
  const nome=razaoManual||parsed.nome;
  const rows=parsed.rows;
  const cnpj=onlyDigits(document.getElementById('f-cnpjA').value);
  const wrap=document.getElementById('f-wrapA');
  document.getElementById('f-wrap').style.display='none';
  const out=document.getElementById('f-outA');

  if(!nome || !rows.length){
    out.textContent='VERIFIQUE O “TEXTO DO ESFERA”. NÃO FOI POSSÍVEL IDENTIFICAR NOME/LINHAS.';
    wrap.style.display='block';
    wrap.classList.add('reveal');
    return;
  }

  const lines=[];
  const nomeUpper = (nome || '').toUpperCase();
  lines.push(`*${nomeUpper}*`);
  lines.push(`_${cnpj}_`);
  lines.push(`----------`);
  rows.forEach((r,idx)=>{
    const parcela=String(r.item||'').padStart(2,'0');
    const diasAtraso=r.dias?String(r.dias).padStart(2,'0'):'';
    lines.push(`${idx+1}. *NOTA FISCAL \`${r.nota}\`*`);
    lines.push(`* *Valor: \`R$ ${formatBR(r.valor)}\`*`);
    lines.push(`* *Vencimento: \`${r.vencto}\`*`);
    lines.push(`* *Parcela \`${parcela}\`*`);
    lines.push(`> *\`${diasAtraso}\` dias de atraso*`);
  });

  out.textContent=lines.join('\n');
  wrap.style.display='block';
  wrap.classList.add('reveal');
  out.classList.remove('flash');
  void out.offsetWidth;
  out.classList.add('flash');
}
function fCopiarA(){
  const b=document.getElementById('f-copiarA');
  const t=document.getElementById('f-outA').textContent||'';
  if(!t.trim()) return;
  (navigator.clipboard?.writeText(t)||Promise.resolve()).then(()=>{
    b.classList.add('copied');
    setTimeout(()=>b.classList.remove('copied'),1100);
  });
}
function fLimparA(){
  ['f-esfera','f-cnpjA','f-razaoA'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('f-wrapA').style.display='none';
  document.getElementById('f-outA').textContent='';
}

/* ===== ATUALIZADOS ===== */
let fNextId=1;
function fMakeRow(id){
  const el=document.createElement('div');
  el.className='grid row';
  el.dataset.id=id;
  el.innerHTML=`
    <div><label>NOTA FISCAL</label><input id="f-nf-${id}" type="text" placeholder="EX.: 000155148-1" data-f="nf" /></div>
    <div><label>VALOR (R$)</label><input id="f-valor-${id}" type="text" inputmode="decimal" placeholder="EX.: 864,00" data-f="valor" /></div>
    <div><label>DIAS EM ATRASO</label><input id="f-dias-${id}" type="text" inputmode="numeric" placeholder="EX.: 12" data-f="dias" /></div>
    <div><label>MULTA (R$)</label><input id="f-multa-${id}" type="text" inputmode="decimal" placeholder="EX.: 25,00" data-f="multa" /></div>
    <div><label>JUROS (R$)</label><input id="f-juros-${id}" type="text" inputmode="decimal" placeholder="EX.: 0,89" data-f="juros" /></div>
    <div class="remove d-flex align-items-end">
      <button class="btn" data-action="rm">
        <i class="bi bi-trash" aria-hidden="true"></i>
        <span>REMOVER</span>
      </button>
    </div>`;
  el.querySelector('[data-action="rm"]').addEventListener('click',()=>el.remove());
  return el;
}
function fAddRow(){
  const rowsEl=document.getElementById('f-rows');
  const btn=document.getElementById('f-add');
  rowsEl.appendChild(fMakeRow(fNextId++));
  btn.classList.add('copied');
  setTimeout(()=>btn.classList.remove('copied'),1100);
}
function fGetEmpresa(){
  return {
    razao:(document.getElementById('f-razao').value||'').trim(),
    cnpj:(document.getElementById('f-cnpj').value||'').trim()
  };
}
function fGetTitulos(){
  const out=[];
  document.querySelectorAll('#f-rows .grid').forEach(r=>{
    const get=n=> (r.querySelector(`[data-f="${n}"]`)?.value||'').trim();
    const nf=cleanNF(get('nf')),
          valor=parseBR(get('valor')),
          dias=(get('dias')||''),
          multa=parseBR(get('multa')),
          juros=parseBR(get('juros'));
    if(nf||valor>0||multa>0||juros>0||dias){
      out.push({
        nf,valor,dias,multa,juros,
        atual:valor+multa+juros
      });
    }
  });
  return out;
}
function fGerarAtual(){
  const emp=fGetEmpresa();
  const ts=fGetTitulos();
  const total=ts.reduce((s,t)=>s+(t.atual||0),0);
  const razaoUpper=(emp.razao||'').toUpperCase();
  const lines=[];
  lines.push(`*${razaoUpper}*`);
  lines.push(`_${onlyDigits(emp.cnpj)}_`);
  lines.push(`*VALOR TOTAL + ENCARGOS: \`R$ ${formatBR(total)}\`*`);
  lines.push(`----------`);
  ts.forEach((t,i)=>{
    lines.push(`${i+1}. *NOTA FISCAL* \`${t.nf||''}\``);
    lines.push(`* *VALOR*: \`R$ ${formatBR(t.valor)}\``);
    lines.push(`* *DIAS EM ATRASO*: \`${t.dias||''}\``);
    lines.push(`* *MULTA*: \`R$ ${formatBR(t.multa)}\``);
    lines.push(`* *JUROS*: \`R$ ${formatBR(t.juros)}\``);
    lines.push(`*VALOR ATUALIZADO*: \`R$ ${formatBR(t.atual)}\``);
  });
  const wrap=document.getElementById('f-wrap');
  document.getElementById('f-wrapA').style.display='none';
  const out=document.getElementById('f-out');
  out.textContent=lines.join('\n');
  wrap.style.display='block';
  wrap.classList.add('reveal');
  out.classList.remove('flash');
  void out.offsetWidth;
  out.classList.add('flash');
}
function fCopiar(){
  const b=document.getElementById('f-copiar');
  const t=document.getElementById('f-out').textContent||'';
  if(!t.trim()) return;
  (navigator.clipboard?.writeText(t)||Promise.resolve()).then(()=>{
    b.classList.add('copied');
    setTimeout(()=>b.classList.remove('copied'),1100);
  });
}
function fLimpar(){
  ['f-razao','f-cnpj'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('f-rows').innerHTML='';
  fAddRow();
  document.getElementById('f-wrap').style.display='none';
  document.getElementById('f-out').textContent='';
}

/* Eventos formatacao */
document.getElementById('f-add').addEventListener('click',fAddRow);
document.getElementById('f-gerar').addEventListener('click',fGerarAtual);
document.getElementById('f-limpar').addEventListener('click',fLimpar);
document.getElementById('f-copiar').addEventListener('click',fCopiar);
document.getElementById('f-gerarA').addEventListener('click',fGerarAberto);
document.getElementById('f-limparA').addEventListener('click',fLimparA);
document.getElementById('f-copiarA').addEventListener('click',fCopiarA);

/* atalhos */
document.addEventListener('keydown',e=>{
  if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){
    const pg=document.querySelector('.page.active')?.id;
    if(pg==='page-formatacao'){
      fMode==='aberto'?fGerarAberto():fGerarAtual();
    }else{
      cCalcular();
    }
  }
  if(e.key==='Escape'){
    const pg=document.querySelector('.page.active')?.id;
    if(pg==='page-formatacao'){
      fMode==='aberto'?fLimparA():fLimpar();
    }else{
      cClearAll();
    }
  }
});

/* init formatacao */
fAddRow();

/* =======================================================================================
   COMPENSAÇÕES
   ======================================================================================= */
const cState={mode:'creditos'};
const cHeader = ()=> 'NOTA FISCAL    ITEM    DATA EMISSÃO    DATA VENCTO.                R$ VALOR';
const cBANNER_CREDITOS = "------------------------------------------------ CRÉDITO(S) --------------------------------------------------";
const cBANNER_TITULOS  = "------------------------------------------------- TÍTULO(S) ---------------------------------------------------";
const cBANNER_FINAL    = "----------------------------------------------------------------------------------------------------------------";
const cRep = n=>' '.repeat(Math.max(0,n));
function cFmtCredito(r,suf=''){
  const s1=15,s2=8,s3=9,s4=19;
  return r.nome+cRep(s1)+r.item+cRep(s2)+r.emissao+cRep(s3)+r.vencto+cRep(s4)+formatBR(r.valor)+(suf?(' '+suf):'');
}
function cFmtTitulo (r,suf=''){
  const s1=5 ,s2=8,s3=9,s4=19;
  return r.nome+cRep(s1)+r.item+cRep(s2)+r.emissao+cRep(s3)+r.vencto+cRep(s4)+formatBR(r.valor)+(suf?(' '+suf):'');
}
function cParseLine(line){
  const raw=line.replace(/\s+/g,' ').trim();
  if(!raw) return null;
  const parts=raw.split(' ');
  if(parts.length<5) return null;
  const valorTxt=parts.at(-1),
        vencto=parts.at(-2),
        emissao=parts.at(-3),
        item=parts.at(-4),
        nome=parts.slice(0,-4).join(' ');
  return { nome,item,emissao,vencto, valor:parseBR(valorTxt) };
}
function cParseDateBR(str){
  const m=/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec((str||'').trim());
  if(!m) return null;
  const dd=+m[1], mm=+m[2], yy=+m[3];
  const d=new Date(yy,mm-1,dd);
  if(d.getFullYear()!==yy || d.getMonth()+1!==mm || d.getDate()!==dd) return null;
  return d;
}
const cToISO = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const cTodayISO = ()=>cToISO(new Date());
const cFormatBRFromISO = iso => {
  if(!iso) return '';
  const [y,m,d]=iso.split('-');
  return `${d}/${m}/${y}`;
};
function cSetBRAndISO(d){
  document.getElementById('c-dataPagto').value=cToISO(d);
  document.getElementById('c-dataPagtoBR').value=cFormatBRFromISO(cToISO(d));
}
function cShiftBR(days){
  let d=cParseDateBR(document.getElementById('c-dataPagtoBR').value)||new Date();
  d.setDate(d.getDate()+days);
  cSetBRAndISO(d);
}

function cPopVisible(el, anchor){
  if(!el || el.style.display==='none') return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(anchor){
    const rect=anchor.getBoundingClientRect();
    const originX=rect.left+rect.width/2;
    el.style.setProperty('--pop-origin', `${originX}px 0px`);
  }else{
    el.style.removeProperty('--pop-origin');
  }
  el.style.animation='none';
  el.classList.remove('pop-anim');
  void el.offsetWidth;
  el.classList.add('pop-anim');
  el.style.animation='';
}

function cSetMode(m){
  if(cState.mode===m) return;
  cState.mode=m;
  const map={creditos:'c-m-creditos',pos:'c-m-pos',neg:'c-m-neg'};
  for(const k of Object.keys(map)){
    const btn=document.getElementById(map[k]);
    const on=(k===m);
    btn.classList.toggle('primary',on);
    btn.setAttribute('aria-selected',String(on));
  }
  const grid=document.getElementById('c-grid');
  const enc=document.getElementById('c-cardEncargos');
  const wrapParc=document.getElementById('c-wrapParcelas');
  const cardNeg=document.getElementById('c-cardNeg');
  const cardParc=document.getElementById('c-cardParc');
  const wrapQtd=document.getElementById('c-wrapQtd');
  const wrapTaxa=document.getElementById('c-wrapTaxa');
  const popTargets=[
    document.getElementById('c-cardTitulos'),
    document.getElementById('c-cardCreditos'),
    enc,
    cardNeg,
    cardParc
  ];
  const checks=[
    document.getElementById('c-chkNoParcial'),
    document.getElementById('c-chkSobraJuro')
  ];

  if(m==='creditos'){
    grid.classList.remove('cols-2');
    grid.classList.add('cols-3');
    enc.style.display='';
    wrapParc.style.display='none';
    cardNeg.style.display='none';
    cardParc.style.display='none';
    wrapTaxa.style.display='';
    if(document.getElementById('c-chkTaxa').checked) wrapQtd.style.display='';
    checks.forEach(ch=>ch.parentElement.style.display='');
  }else if(m==='pos'){
    grid.classList.remove('cols-3');
    grid.classList.add('cols-2');
    enc.style.display='none';
    cardNeg.style.display='none';
    cardParc.style.display='none';
    checks.forEach(ch=>{
      ch.checked=false;
      ch.parentElement.style.display='none';
    });
    wrapQtd.style.display='none';
  }else{
    grid.classList.remove('cols-2');
    grid.classList.add('cols-3');
    enc.style.display='';
    wrapParc.style.display='';
    cardNeg.style.display='';
    cardParc.style.display='';
    wrapTaxa.style.display='';
    if(document.getElementById('c-chkTaxa').checked) wrapQtd.style.display='';
    checks.forEach(ch=>ch.parentElement.style.display='');
    if(!document.getElementById('c-dataPagtoBR').value){
      const iso=cTodayISO();
      document.getElementById('c-dataPagto').value=iso;
      document.getElementById('c-dataPagtoBR').value=cFormatBRFromISO(iso);
    }
  }
  popTargets.forEach(el=>cPopVisible(el));
  if(document.getElementById('c-chkTaxa').checked){
    cPopVisible(document.getElementById('c-wrapQtd'), document.getElementById('c-chkTaxa'));
  }
}

function cToggleTaxa(){
  const on=document.getElementById('c-chkTaxa').checked;
  document.getElementById('c-wrapQtd').style.display=on?'':'none';
  if(on) cPopVisible(document.getElementById('c-wrapQtd'), document.getElementById('c-chkTaxa'));
  if(!on) document.getElementById('c-qtdBoletos').value='';
}

/* NEGOCIAÇÃO */
function cParseNegotiation(raw){
  const xs=[], lines=(raw||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const re=/^0?(\d{1,2})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d\.\,]+)(?:\s+(\d{2}\/\d{2}\/\d{4}|X))?$/;
  for(const ln of lines){
    if(/^[\-\*~]+/.test(ln)) continue;
    if(/^N[ºo]\s*PARCELA/i.test(ln)) continue;
    const m=ln.replace(/\s{2,}/g,' ').match(re);
    if(m){
      xs.push({
        parcela:+m[1],
        vencto:m[2],
        valor:parseBR(m[3]),
        pagto:(m[4]&&m[4]!=='X')?m[4]:'X'
      });
    }
  }
  xs.sort((a,b)=>a.parcela-b.parcela);
  return xs;
}
const NEG_TOP="~~~~~~~~~~~~~~~~ NEGOCIAÇÃO ~~~~~~~~~~~~~~~~";
const NEG_HEADER="Nº PARCELA    DATA VENCTO.     VLR. BASE       DATA PAGTO.  ";
const NEG_LINE="------------------------------";
const NEG_TOTAL="**************** VALOR TOTAL: ";
const NEG_BOTTOM="~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~";
const NEG_S1=19, NEG_S2=11, NEG_S3=18;
const z2=n=>String(n).padStart(2,'0');
function cFmtNegRow(r){
  const valStr=formatBR(r.valor);
  const baseLen=6;
  const extra=Math.max(0,valStr.length-baseLen);
  const padVal=Math.max(0,NEG_S2-extra);
  const isDate=/^\d{2}\/\d{2}\/\d{4}$/.test(r.pagto);
  const padPg=Math.max(0,NEG_S3-(isDate?7:0));
  return z2(r.parcela)+cRep(NEG_S1)+r.vencto+cRep(padVal)+valStr+cRep(padPg)+(isDate?r.pagto:'X');
}
function cBuildNegBlock(perParcelFee=0){
  const rows=cParseNegotiation(document.getElementById('c-negociacao').value||'');
  if(!rows.length) return '';
  const p= parseInt((document.getElementById('c-parcelaPaga').value||'').trim(),10);
  const d= cParseDateBR((document.getElementById('c-dataPagtoBR').value||'').trim());
  const dataPag=d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:'';
  if(Number.isInteger(p) && dataPag){
    const r=rows.find(x=>x.parcela===p);
    if(r) r.pagto=dataPag;
  }
  if(perParcelFee>0){
    rows.forEach(r=> { r.valor=(r.valor||0)+perParcelFee; });
  }
  const total=rows.reduce((s,r)=>s+(r.valor||0),0);
  const out=[
    NEG_TOP,
    NEG_HEADER,
    ...rows.map(cFmtNegRow),
    NEG_LINE,
    NEG_TOTAL+formatBR(total)+"  ",
    NEG_BOTTOM
  ];
  return out.join('\n');
}

function cCalcular(){
  const titulos=(document.getElementById('c-titulos').value||'')
    .split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
    .map(cParseLine).filter(Boolean);
  const creditos=(document.getElementById('c-creditos').value||'')
    .split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
    .map(cParseLine).filter(Boolean);
  let multa=0,juros=0,parcelas=1,taxaBoletos=0,qtd=0,encargos=0;
  if(document.getElementById('c-chkTaxa').checked){
    qtd=Math.max(0, Math.floor(parseFloat((document.getElementById('c-qtdBoletos').value||'0').replace(',','.')))||0);
    taxaBoletos=5*qtd;
  }
  if(cState.mode==='creditos'){
    multa=parseBR(document.getElementById('c-multa').value);
    juros=parseBR(document.getElementById('c-juros').value);
    encargos=multa+juros+taxaBoletos;
  }else if(cState.mode==='pos'){
    multa=0; juros=0; parcelas=1; encargos=0;
  }else{
    multa=parseBR(document.getElementById('c-multa').value);
    juros=parseBR(document.getElementById('c-juros').value);
    parcelas=Math.max(1, Math.floor(parseFloat((document.getElementById('c-parcelas').value||'1').replace(',','.')))||1);
    encargos=(multa+juros+taxaBoletos)/parcelas;
  }
  const totalCred=creditos.reduce((s,c)=>s+(c.valor||0),0);
  let creditoLiquido=Math.max(0,totalCred-encargos);
  const pre=[];
  if(cState.mode==='creditos'){
    const parts=[
      `MULTA [${formatBR(multa)}]`,
      `JUROS [${formatBR(juros)}]`
    ];
    if(taxaBoletos>0){
      const taxaBase=formatBR(taxaBoletos/(qtd||1));
      const taxaLabel=qtd>1
        ? `TAXA ADM. BOLETO [${taxaBase} * ${qtd}]`
        : `TAXA ADM. BOLETO [${formatBR(taxaBoletos)}]`;
      parts.push(taxaLabel);
    }
    pre.push(
      'COMPENSAÇÃO DE CRÉDITO + ENCARGOS',
      `ENCARGOS: ${parts.join(' + ')} = ${formatBR(encargos)}`,
      ''
    );
  }else if(cState.mode==='pos'){
    pre.push('COMPENSAÇÃO DE CRÉDITO PÓS-VENDAS','');
  }else{
    const parts=[
      `MULTA [${formatBR(multa)}]`,
      `JUROS [${formatBR(juros)}]`
    ];
    if(taxaBoletos>0){
      const taxaBase=formatBR(taxaBoletos/(qtd||1));
      const taxaLabel=qtd>1
        ? `TAXA ADM. BOLETO [${taxaBase} * ${qtd}]`
        : `TAXA ADM. BOLETO [${formatBR(taxaBoletos)}]`;
      parts.push(taxaLabel);
    }
    pre.push(
      'COMPENSAÇÃO DE CRÉDITO + ENCARGOS REF. NEGOCIAÇÃO',
      `ENCARGOS: (${parts.join(' + ')}) / PARCELAS [${parcelas}] = ${formatBR(encargos)}`,
      ''
    );
  }
  const blocCred=[cBANNER_CREDITOS,'',cHeader()];
  creditos.forEach((c,idx)=>{
    if((cState.mode==='creditos'||cState.mode==='neg') && idx===0 && encargos>0){
      const liquido=Math.max(0,c.valor-Math.min(encargos,c.valor));
      blocCred.push(
        cFmtCredito(c,`- ${formatBR(encargos)} = ${formatBR(liquido)}`)
      );
    }else{
      blocCred.push(cFmtCredito(c));
    }
  });
  const blocTit=[cBANNER_TITULOS,'',cHeader()];
  let restante=creditoLiquido, diverg=0;
  const noParcial=(cState.mode!=='pos') && !!document.getElementById('c-chkNoParcial')?.checked;
  for(const t of titulos){
    if(noParcial){
      const falta=Math.max(0,t.valor-restante);
      diverg+=falta;
      restante=Math.max(0,restante-t.valor);
      blocTit.push(cFmtTitulo(t,'(BAIXA TOTAL)'));
      continue;
    }
    if(restante<=0){
      blocTit.push(cFmtTitulo(t));
      continue;
    }
    if(restante>=t.valor-1e-9){
      restante-=t.valor;
      blocTit.push(cFmtTitulo(t,'(BAIXA TOTAL)'));
    }else{
      const atualizado=t.valor-restante;
      blocTit.push(
        cFmtTitulo(
          t,
          `(BAIXA PARCIAL) [VALOR ATUALIZADO: ${formatBR(atualizado)}]`
        )
      );
      restante=0;
    }
  }
  let arr=[...pre, ...blocCred, '', ...blocTit, '', cBANNER_FINAL];
  if(noParcial && diverg>0.005){
    arr.push(`*** POR GENTILEZA, DESCONSIDERAR A DIVERGÊNCIA DE VALORES (${formatBR(diverg)}) ***`);
  }else if(restante>0.005){
    const comoJuro=(cState.mode!=='pos') && !!document.getElementById('c-chkSobraJuro')?.checked;
    arr.push(
      comoJuro
        ? `*** POR GENTILEZA, CONSIDERAR CRÉDITO REMANESCENTE (${formatBR(restante)}) COMO ENCARGO ***`
        : `CRÉDITO REMANESCENTE: ${formatBR(restante)}`
    );
  }
  if(cState.mode==='neg'){
    const blk = cBuildNegBlock();
    if(blk){
      arr.push('', '', blk);
    }
  }
  const text=arr.join('\n');
  const w=document.getElementById('c-wrapOut');
  const out=document.getElementById('c-out');
  out.textContent=text;
  w.style.display='block';
  w.classList.add('reveal');
  out.classList.remove('flash');
  void out.offsetWidth;
  out.classList.add('flash');
}

function cCopyOut(){
  const btn=document.getElementById('c-copiar');
  const t=document.getElementById('c-out')?.textContent??'';
  if(!t.trim()) return;
  (navigator.clipboard?.writeText(t)||Promise.resolve()).then(()=>{
    btn.classList.add('copied');
    setTimeout(()=>btn.classList.remove('copied'),1100);
  });
}
function cClearAll(){
  document.getElementById('c-titulos').value='';
  document.getElementById('c-creditos').value='';
  ['c-multa','c-juros','c-parcelas','c-negociacao','c-parcelaPaga',
    'c-dataPagto','c-dataPagtoBR','c-qtdBoletos'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  ['c-chkTaxa','c-chkSobraJuro','c-chkNoParcial'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.checked=false;
  });
  document.getElementById('c-wrapQtd').style.display='none';
  document.getElementById('c-wrapOut').style.display='none';
  document.getElementById('c-out').textContent='';
  cSetBRAndISO(new Date());
  document.getElementById('c-titulos').focus();
}

/* Eventos compensações */
document.getElementById('c-m-creditos').addEventListener('click',()=>cSetMode('creditos'));
document.getElementById('c-m-pos').addEventListener('click',()=>cSetMode('pos'));
document.getElementById('c-m-neg').addEventListener('click',()=>cSetMode('neg'));
document.getElementById('c-chkTaxa').addEventListener('change',cToggleTaxa);
document.getElementById('c-calcular').addEventListener('click',cCalcular);
document.getElementById('c-copiar').addEventListener('click',cCopyOut);
document.getElementById('c-limpar').addEventListener('click',cClearAll);
document.getElementById('c-dataPagtoBR').addEventListener('input',e=>{
  const d=cParseDateBR(e.target.value);
  if(d) document.getElementById('c-dataPagto').value=cToISO(d);
});
document.getElementById('c-dataPagtoBR').addEventListener('blur',e=>{
  const d=cParseDateBR(e.target.value);
  if(d) cSetBRAndISO(d);
});
document.getElementById('c-dataPagto').addEventListener('change',e=>{
  document.getElementById('c-dataPagtoBR').value=cFormatBRFromISO(e.target.value);
});
document.getElementById('c-prevDate').addEventListener('click',()=>cShiftBR(-1));
document.getElementById('c-nextDate').addEventListener('click',()=>cShiftBR(+1));

/* =======================================================================================
   CLIENTES (NEGOCIAÇÕES) – PERSISTÊNCIA E UI
   ======================================================================================= */
const CLI_KEY='cobtool_clientes_v1';

function cliLoadAll(){
  try{
    const raw=localStorage.getItem(CLI_KEY);
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    if(lowerEmailsInData(parsed)) localStorage.setItem(CLI_KEY, JSON.stringify(parsed));
    return parsed;
  }catch{
    return [];
  }
}
function cliSaveAll(list){
  localStorage.setItem(CLI_KEY, JSON.stringify(list||[]));
}
const cliSanitize=item=>({
  ...item,
  codigoCliente:normalizeCodigo(item?.codigoCliente),
  cnpj:normalizeCnpj(item?.cnpj)
});
let cliList=cliLoadAll().map(cliSanitize);
cliSaveAll(cliList);
let cliCurrentId=null;

function cliClearForm(){
  cliCurrentId=null;
  document.getElementById('cli-razao').value='';
  document.getElementById('cli-codigo').value='';
  document.getElementById('cli-cnpj').value='';
  document.getElementById('cli-responsavel').value='';
  document.getElementById('cli-contato').value='';
}
function cliFillForm(item){
  cliCurrentId=item.id;
  document.getElementById('cli-razao').value=item.razaoSocial||'';
  document.getElementById('cli-codigo').value=normalizeCodigo(item.codigoCliente)||'';
  document.getElementById('cli-cnpj').value=maskCNPJValue(item.cnpj||'');
  document.getElementById('cli-responsavel').value=item.responsavel||'';
  document.getElementById('cli-contato').value=item.contato||'';
}

function cliSaveFromForm(){
  const razao=(document.getElementById('cli-razao').value||'').trim();
  const codigoRaw=(document.getElementById('cli-codigo').value||'').trim();
  const rawCnpj=(document.getElementById('cli-cnpj').value||'').trim();
  const responsavel=(document.getElementById('cli-responsavel').value||'').trim();
  const contato=(document.getElementById('cli-contato').value||'').trim();

  const codigo=normalizeCodigo(codigoRaw);
  const cnpj=normalizeCnpj(rawCnpj);
  if(!razao || !codigo || !cnpj){
    alert('Preencha pelo menos Razão social, Código do cliente e CNPJ.');
    return;
  }

  const now=new Date().toISOString();

  // evita duplicidade de CNPJ
  const existente=cliList.find(item=>item.cnpj===cnpj);
  if(!cliCurrentId && existente){
    alert('Já existe um cliente cadastrado com este CNPJ.');
    return;
  }
  if(cliCurrentId && existente && existente.id!==cliCurrentId){
    alert('Este CNPJ já está em uso por outro cliente cadastrado.');
    return;
  }

  if(cliCurrentId){
    cliList=cliList.map(item=>{
      if(item.id!==cliCurrentId) return item;
      return {
        ...item,
        razaoSocial:razao,
        codigoCliente:codigo,
        cnpj,
        responsavel,
        contato,
        atualizadoEm:now
      };
    });
  }else{
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    cliList.push({
      id,
      razaoSocial:razao,
      codigoCliente:codigo,
      cnpj,
      responsavel,
      contato,
      criadoEm:now,
      atualizadoEm:now
    });
  }

  cliSaveAll(cliList);
  cliRenderList();
  cliClearForm();
  const btn=document.getElementById('cli-salvar');
  if(btn){
    btn.classList.add('copied');
    setTimeout(()=>btn.classList.remove('copied'),1000);
  }
}

function cliRenderList(){
  const tbody=document.getElementById('cli-tbody');
  if(!tbody) return;
  if(!cliList.length){
    tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted">NENHUM CLIENTE CADASTRADO.</td></tr>';
    return;
  }
  const rows=cliList.map(item=>{
    const atualizado=item.atualizadoEm ? item.atualizadoEm.slice(0,10) : '';
    return `
      <tr data-id="${item.id}">
        <td>
          <div class="neg-client">${item.razaoSocial||'-'}</div>
          <div class="neg-meta">${atualizado ? 'Atualizado: '+atualizado : ''}</div>
        </td>
        <td>${normalizeCodigo(item.codigoCliente)||'-'}</td>
        <td>${item.cnpj||'-'}</td>
        <td>${item.responsavel||'-'}</td>
        <td>${item.contato||'-'}</td>
        <td>
          <div class="d-flex gap-1 align-items-center">
            <button class="btn btn-sm cli-btn-icon" type="button" data-cli-action="edit">
              <i class="bi bi-pencil" aria-hidden="true"></i>
            </button>
            <button class="btn btn-sm cli-btn-icon" type="button" data-cli-action="delete">
              <i class="bi bi-trash" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      </tr>`;
  });
  tbody.innerHTML=rows.join('');
}

function cliExportar(){
  const data=cliLoadAll();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='cobtool_clientes_backup.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function cliImportar(){
  const input=document.getElementById('cli-import-file');
  if(!input) return;
  input.value='';
  input.click();
}
function cliHandleImportFile(e){
  const file=e.target.files && e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(String(ev.target.result||''));
      if(!Array.isArray(data)) throw new Error('Formato inválido');
      cliList=data.map(item=>({
        id:item.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,8)),
        razaoSocial:item.razaoSocial||'',
        codigoCliente:normalizeCodigo(item.codigoCliente),
        cnpj:normalizeCnpj(item.cnpj),
        responsavel:item.responsavel||'',
        contato:item.contato||'',
        criadoEm:item.criadoEm||new Date().toISOString(),
        atualizadoEm:item.atualizadoEm||item.criadoEm||new Date().toISOString()
      }));
      cliSaveAll(cliList);
      cliRenderList();
      alert('Dados importados com sucesso.');
    }catch(err){
      alert('Não foi possível importar este arquivo. Verifique o formato JSON.');
      console.error(err);
    }
  };
  reader.readAsText(file,'utf-8');
}

(function initCli(){
  const page=document.getElementById('page-neg-cadastro');
  if(!page) return;

  const contatoField=document.getElementById('cli-contato');
  if(contatoField) contatoField.addEventListener('input',maskPhoneInput);

  cliRenderList();
  document.getElementById('cli-salvar')?.addEventListener('click',cliSaveFromForm);
  document.getElementById('cli-exportar')?.addEventListener('click',cliExportar);
  document.getElementById('cli-importar')?.addEventListener('click',cliImportar);
  document.getElementById('cli-import-file')?.addEventListener('change',cliHandleImportFile);

  const tbody=document.getElementById('cli-tbody');
  if(tbody){
    tbody.addEventListener('click',e=>{
      const btn=e.target.closest('[data-cli-action]');
      if(!btn) return;
      const tr=btn.closest('tr[data-id]');
      if(!tr) return;
      const id=tr.getAttribute('data-id');
      const item=cliList.find(x=>x.id===id);
      if(!item) return;
      const action=btn.getAttribute('data-cli-action');
      if(action==='edit'){
        cliFillForm(item);
        setPage('neg-cadastro');
        document.getElementById('cli-razao')?.focus();
      }else if(action==='delete'){
        if(confirm('Remover este cliente?')){
          cliList=cliList.filter(x=>x.id!==id);
          cliSaveAll(cliList);
          cliRenderList();
          if(cliCurrentId===id) cliClearForm();
          btn.classList.add('deleted');
          setTimeout(()=>btn.classList.remove('deleted'),1000);
        }
      }
    });
  }
})();

/* init compensações */
cSetMode('creditos');
cSetBRAndISO(new Date());
setPage('home');

/* =======================================================================================
   NEGOCIAÇÕES – PERSISTÊNCIA E UI
   ======================================================================================= */
const NEG_KEY='cobtool_negociacoes_v1';
function negLoadAll(){
  try{
    const raw=localStorage.getItem(NEG_KEY);
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    if(lowerEmailsInData(parsed)) localStorage.setItem(NEG_KEY, JSON.stringify(parsed));
    return parsed;
  }catch{return [];}
}
function negSaveAll(list){
  localStorage.setItem(NEG_KEY, JSON.stringify(list||[]));
}
let negList=negLoadAll();
let negCurrentClienteId=null;
let negClienteSnapshot=null;
let negLastFoundClient=null;
let negEditingId=null;
function negGetSituacao(item){
  return item?.situacao || 'andamento';
}
function negEnsureSituacao(item){
  if(item && !item.situacao) item.situacao='andamento';
  return item;
}
function negEnsureClosedDates(item){
  if(!item) return item;
  if(item.situacao==='finalizada' && !item.finalizadaEm){
    item.finalizadaEm=item.atualizadoEm || item.criadoEm || Date.now();
  }
  if(item.situacao==='cancelada' && !item.canceladaEm){
    item.canceladaEm=item.atualizadoEm || item.criadoEm || Date.now();
  }
  return item;
}
function negDaysSince(ts){
  if(!ts) return '—';
  const d0=new Date(ts);
  const d1=new Date();
  d0.setHours(0,0,0,0);
  d1.setHours(0,0,0,0);
  const diff=Math.max(0, Math.round((d1 - d0) / 86400000));
  return diff;
}
function negCopyPlainText(text){
  if(!text) return false;
  if(navigator.clipboard?.writeText){
    return navigator.clipboard.writeText(text).then(()=>true).catch(()=>false);
  }
  const ta=document.createElement('textarea');
  ta.value=text;
  ta.style.position='fixed';
  ta.style.opacity='0';
  document.body.appendChild(ta);
  ta.select();
  try{
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }catch(_e){
    document.body.removeChild(ta);
    return false;
  }
}
function negBuildExportTsv(list, opts={}){
  const cols=['CÓDIGO','CNPJ','VALOR','DATA'];
  const sepCol='\t';
  const sepRow='\r\n';
  const extraCols=opts.extraCols || [];
  const header=[...cols.slice(0,2), ...extraCols, ...cols.slice(2)];
  const rows=[header.join(sepCol)];
  list.forEach(item=>{
    const codigo=normalizeCodigo(item?.clienteSnapshot?.codigoCliente || '');
    const cnpj=normalizeCnpj(item?.clienteSnapshot?.cnpj || '');
    const parcelas=Array.isArray(item?.parcelasPagas) ? item.parcelasPagas : negGetParcelas(item);
    const totalParc=parcelas.length;
    const pagasCount=parcelas.filter(p=>p?.paga || p===true).length;
    const valor=`R$ ${formatBR(item?.valorTotalNegociado||0)}`;
    const dateField=opts.dateField || '';
    const rawDate=dateField ? item?.[dateField] : (item?.criadoEm || item?.atualizadoEm || '');
    const data=formatBRDateFromISO(rawDate || '');
    const extras=opts.extraRow
      ? opts.extraRow({item, pagasCount, totalParc})
      : [];
    const row=[codigo, cnpj, ...extras, valor, data].join(sepCol);
    rows.push(row);
  });
  return rows.join(sepRow);
}
function negFindById(id){
  const key=String(id ?? '');
  return negList.find(n=>String(n?.id ?? '')===key) || null;
}
function negRemoveById(id){
  const idx=negList.findIndex(n=>String(n.id)===String(id));
  if(idx>=0) negList.splice(idx,1);
}
if(!Array.isArray(negList)) negList=[];
let negListChanged=false;
const negIdSet=new Set();
negList=negList.filter(item=>item && typeof item==='object');
negList.forEach(item=>{
  let id=String(item.id ?? '').trim();
  if(!id || negIdSet.has(id)){
    id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    negListChanged=true;
  }
  if(String(item.id) !== id){
    item.id=id;
    negListChanged=true;
  }
  negIdSet.add(id);
  if(!Array.isArray(item.parcelasPagas)){
    item.parcelasPagas=[];
    negListChanged=true;
  }
  negEnsureSituacao(item);
  negEnsureClosedDates(item);
});
if(negListChanged) negSaveAll(negList);

function negClearClienteInfo(){
  const box=document.getElementById('neg-cliente-info');
  negCurrentClienteId=null;
  negClienteSnapshot=null;
  negLastFoundClient=null;
  if(box){
    // EXPLICAÇÃO: removemos a classe text-muted e aplicamos cor clara diretamente para garantir visibilidade no tema escuro.
    box.innerHTML='<div style="font-size:12px;color:#e6e6e6;text-align:center">Nenhum cliente selecionado.</div>';
    box.classList.remove('d-none');
  }
  negFillClienteSelecionado(null);
  negHideSelectedBox();
  const cnpjBusca=document.getElementById('neg-busca-cnpj');
  const codBusca=document.getElementById('neg-busca-codigo');
  const razaoWrap=document.getElementById('neg-razao-wrapper');
  const razaoField=document.getElementById('neg-razao-selecionada');
  if(cnpjBusca){ cnpjBusca.disabled=false; cnpjBusca.value=''; }
  if(codBusca){ codBusca.disabled=false; codBusca.value=''; }
  if(razaoField) razaoField.value='';
  if(razaoWrap) razaoWrap.classList.add('d-none');
  const btnBuscar=document.getElementById('neg-buscar');
  const btnOutro=document.getElementById('neg-buscar-outro');
  if(btnBuscar) btnBuscar.classList.remove('d-none');
  if(btnOutro) btnOutro.classList.add('d-none');
}
function negHideFoundBox(){
  const box=document.getElementById('neg-cliente-info');
  if(box){
    box.classList.add('d-none');
    box.innerHTML='';
  }
}
function negHideSelectedBox(){
  const box=document.getElementById('neg-cliente-selecionado');
  if(box) box.classList.add('d-none');
}
function negShowSelectedBox(){
  const box=document.getElementById('neg-cliente-selecionado');
  if(box) box.classList.remove('d-none');
}
function negShowFoundBox(){
  const box=document.getElementById('neg-cliente-info');
  if(box){
    box.classList.remove('d-none');
  }
}
function negRenderClienteInfo(cli){
  const box=document.getElementById('neg-cliente-info');
  if(!box || !cli) return;
  const maskCnpj=maskCNPJValue(cli.cnpj);
  negShowFoundBox();
  box.innerHTML=`
    <div class="info-row">
      <span class="info-label">RAZÃO SOCIAL</span>
      <div class="info-value">${cli.razaoSocial||'-'}</div>
    </div>
    <div class="info-row">
      <span class="info-label">CNPJ</span>
      <div class="info-value">${maskCnpj||'-'}</div>
    </div>
    <div class="info-row">
      <span class="info-label">CÓDIGO DO CLIENTE</span>
      <div class="info-value">${normalizeCodigo(cli.codigoCliente)||'-'}</div>
    </div>
    <div class="info-row">
      <span class="info-label">RESPONSÁVEL</span>
      <div class="info-value">${cli.responsavel||'-'}</div>
    </div>
  <div class="info-row">
    <span class="info-label">CONTATO</span>
    <div class="info-value">${cli.contato||'-'}</div>
  </div>
  <div class="actions justify-content-start">
    <button class="btn btn-sm" id="neg-confirmar-cliente">
      <i class="bi bi-check2-circle" aria-hidden="true"></i>
      <span>CONFIRMAR CLIENTE</span>
    </button>
  </div>`;
}
function negFindClienteByInputs(){
  if(negIsNoIdentificar()) return;
  const rawCnpj=document.getElementById('neg-busca-cnpj')?.value||'';
  const rawCod=document.getElementById('neg-busca-codigo')?.value||'';
  const cnpj=normalizeCnpj(rawCnpj);
  const codigo=normalizeCodigo(rawCod);
  let found=null;
  if(cnpj) found=cliList.find(c=>c.cnpj===cnpj);
  if(!found && codigo){
    found=cliList.find(c=> normalizeCodigo(c.codigoCliente)===codigo);
  }
  if(found){
    negLastFoundClient={
      id:found.id,
      cnpj:found.cnpj,
      codigoCliente:found.codigoCliente,
      razaoSocial:found.razaoSocial,
      responsavel:found.responsavel,
      contato:found.contato
    };
    // Auto-confirma quando há match exato por CNPJ ou código.
    negConfirmarCliente();
  }else{
    const selecBox=document.getElementById('neg-cliente-selecionado');
    if(selecBox) selecBox.classList.add('d-none');
    negHideFoundBox();
    const razaoWrap=document.getElementById('neg-razao-wrapper');
    const btnOutro=document.getElementById('neg-buscar-outro');
    if(razaoWrap) razaoWrap.classList.add('d-none');
    if(btnOutro) btnOutro.classList.add('d-none');
    alert('Cliente não encontrado nos clientes cadastrados.');
    negClearClienteInfo();
  }
}
function negFillClienteSelecionado(cli){
  const fields=[
    ['neg-cli-razao', cli?.razaoSocial||''],
    ['neg-cli-cnpj', cli?.cnpj ? maskCNPJValue(cli.cnpj) : ''],
    ['neg-cli-codigo', normalizeCodigo(cli?.codigoCliente)||''],
    ['neg-cli-responsavel', cli?.responsavel||''],
    ['neg-cli-contato', cli?.contato||'']
  ];
  fields.forEach(([id,val])=>{
    const el=document.getElementById(id);
    if(el){
      el.value=val;
      el.disabled=true;
    }
  });
}
function negConfirmarCliente(){
  if(!negLastFoundClient){
    alert('Busque e selecione um cliente primeiro.');
    return;
  }
  negCurrentClienteId=negLastFoundClient.id;
  negClienteSnapshot={...negLastFoundClient};
  negFillClienteSelecionado(negClienteSnapshot);
  // preenche campos de busca e trava
  const cnpjBusca=document.getElementById('neg-busca-cnpj');
  const codBusca=document.getElementById('neg-busca-codigo');
  const razaoWrap=document.getElementById('neg-razao-wrapper');
  const razaoField=document.getElementById('neg-razao-selecionada');
  if(cnpjBusca){
    cnpjBusca.value=maskCNPJValue(negClienteSnapshot.cnpj||'');
    cnpjBusca.disabled=true;
  }
  if(codBusca){
    codBusca.value=normalizeCodigo(negClienteSnapshot.codigoCliente);
    codBusca.disabled=true;
  }
  if(razaoField){
    razaoField.value=negClienteSnapshot.razaoSocial||'';
    razaoField.disabled=true;
  }
  if(razaoWrap) razaoWrap.classList.remove('d-none');
  negHideFoundBox();
  negHideSelectedBox();
  const btnBuscar=document.getElementById('neg-buscar');
  const btnOutro=document.getElementById('neg-buscar-outro');
  if(btnBuscar) btnBuscar.classList.add('d-none');
  if(btnOutro) btnOutro.classList.remove('d-none');
  const btn=document.getElementById('neg-confirmar-cliente');
  if(btn){
    btn.classList.add('copied');
    btn.disabled=true;
    setTimeout(()=>btn.classList.remove('copied'),1000);
  }
  // Se já existir negociação ativa para o cliente, pré-carrega para edição.
  const existente=negList.find(n=>n.clienteId===negCurrentClienteId);
  if(existente){
    negEditingId=existente.id;
    negLoadFormFromNeg(existente);
  }else{
    negEditingId=null;
    negClearNegotiacaoFields();
  }
}
function negToggleEntrada(){
  const chk=document.getElementById('neg-entrada-ativa');
  const val=document.getElementById('neg-valor-entrada');
  const wrap=document.getElementById('neg-entrada-wrapper');
  if(!chk||!val) return;
  const on=chk.checked;
  val.disabled=!on;
  if(wrap) wrap.classList.toggle('d-none', !on);
  if(!on) val.value='';
}
function negFormatDateBR(d){
  const dd=String(d.getDate()).padStart(2,'0');
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const yy=d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}
function negParseDateBR(str){
  if(typeof cParseDateBR==='function') return cParseDateBR(str);
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(str||'').trim());
  if(!m) return null;
  const d=new Date(+m[3], +m[2]-1, +m[1]);
  return (d.getFullYear()==+m[3] && d.getMonth()==+m[2]-1 && d.getDate()==+m[1]) ? d : null;
}
function negAdjustWeekend(d){
  const day=d.getDay();
  if(day===6) d.setDate(d.getDate()+2);
  if(day===0) d.setDate(d.getDate()+1);
  return d;
}
function negSyncDateDisplay(){
  const inp=document.getElementById('neg-primeiro-pagamento');
  const disp=document.getElementById('neg-primeiro-pagamento-display');
  if(!inp||!disp) return;
  // EXPLICAÇÃO: input type="date" sempre fornece value em ISO (YYYY-MM-DD);
  // convertemos para DD/MM/AAAA para exibição clara ao usuário.
  disp.value=formatBRDateFromISO(inp.value);
}
// Formata bloco de negociação exatamente como o modelo solicitado, preservando espaçamentos.
function negBuildCompensacaoBlock(datas, valorParcela, startIndex=1, entradaInfo=null){
  const top="~~~~~~~~~~~~~~~~ NEGOCIAÇÃO ~~~~~~~~~~~~~~~~";
  const header="Nº PARCELA    DATA VENCTO.     VLR. BASE       DATA PAGTO.  ";
  const line="——————————————————————";
  const bottom="~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ";
  const pad=(txt,len)=>String(txt).padStart(len,'0');
  // EXPLICAÇÃO: os espaçamentos abaixo reproduzem exatamente o layout fornecido no exemplo.
  const gap1='                   '; // 19 espaços entre Nº PARCELA e DATA VENCTO.
  const gap2='           ';       // 11 espaços entre DATA VENCTO. e VLR. BASE
  const gap3='                   '; // 19 espaços entre VLR. BASE e DATA PAGTO.
  const rows=[];
  let totalValor=0;
  function pushRow(parcelaNum, vencto, valor){
    totalValor+=(valor||0);
    const num=pad(parcelaNum,2);
    const valStr=formatBR(valor||0).padEnd(5,' ');
    rows.push(`${num}${gap1}${vencto}${gap2}${valStr}${gap3}X  `);
  }
  if(entradaInfo && (entradaInfo.valor||0)>0){
    const entradaData=entradaInfo.data || negFormatDateBR(new Date());
    pushRow(1, entradaData, entradaInfo.valor||0);
  }
  datas.forEach((dt,i)=>{
    pushRow(i+startIndex, dt, valorParcela);
  });
  const total=formatBR(totalValor);
  return [
    top,
    header,
    ...rows,
    line,
    `****************VALOR TOTAL: ${total}  `,
    bottom
  ].join('\n');
}
function negSetDateISO(iso){
  const inp=document.getElementById('neg-primeiro-pagamento');
  const disp=document.getElementById('neg-primeiro-pagamento-display');
  if(!inp||!disp) return;
  // EXPLICAÇÃO: sempre armazenamos ISO no input escondido e exibimos BR no campo visível.
  inp.value=iso||'';
  disp.value=formatBRDateFromISO(iso);
}
function negShiftDate(days){
  const disp=document.getElementById('neg-primeiro-pagamento-display');
  const current=negParseDateBR(disp?.value)||new Date();
  current.setDate(current.getDate()+days);
  negSetDateISO(`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`);
}
function negGenerateDatas(){
  const nParc=Math.max(1, parseInt(document.getElementById('neg-num-parcelas')?.value||'0',10)||0);
  const periodicidade=(document.querySelector('input[name="neg-periodicidade"]:checked')?.value)||'semanal';
  const preexistente=!!document.getElementById('neg-preexistente')?.checked;
  const first=document.getElementById('neg-primeiro-pagamento')?.value;
  if(!first){
    alert('Informe a data do primeiro pagamento.');
    return;
  }
  const start=negParseISODate(first);
  if(!start){
    alert('Data inicial inválida.');
    return;
  }
  let delta=7;
  if(periodicidade==='quinzenal') delta=15;
  if(periodicidade==='mensal') delta=30;
  const datas=[];
  for(let i=0;i<nParc;i++){
    const d=new Date(start);
    d.setDate(d.getDate()+delta*i);
    datas.push(negFormatDateBR(negAdjustWeekend(d)));
  }
  // Persistimos datas puras para o fluxo de salvamento
  const ta=document.getElementById('neg-datas');
  if(ta) ta.value=datas.join('\n');
  // Construímos bloco de negociação seguindo o formato solicitado
  const valorDevido=parseBR(document.getElementById('neg-valor-devido')?.value);
  const valorMulta=parseBR(document.getElementById('neg-multa')?.value);
  const valorJuros=parseBR(document.getElementById('neg-juros')?.value);
  const entradaAtiva=!!document.getElementById('neg-entrada-ativa')?.checked;
  const valorEntrada=entradaAtiva ? parseBR(document.getElementById('neg-valor-entrada')?.value) : 0;
  const taxaBoletosAtiva=!!document.getElementById('neg-taxa-boletos')?.checked;
  const qtdBoletos=parseInt(document.getElementById('neg-qtd-boletos')?.value||'0',10)||0;
  const toCents=v=>Math.round((v||0)*100);
  let valorParcela=0;
  if(preexistente){
    const valorDevidoC=toCents(valorDevido);
    const valorMultaC=toCents(valorMulta);
    const valorJurosC=toCents(valorJuros);
    const entradaC=entradaAtiva ? toCents(valorEntrada) : 0;
    const taxaBoletoC=taxaBoletosAtiva ? 500*qtdBoletos : 0;
    const valorTotalBrutoC=valorDevidoC+valorMultaC+valorJurosC+taxaBoletoC-entradaC;
    valorParcela=(valorTotalBrutoC/nParc)/100;
  }else{
    const taxaBoleto=taxaBoletosAtiva ? 5*qtdBoletos : 0;
    const baseEncargos=(valorMulta||0)+(valorJuros||0)+taxaBoleto;
    const valorTotalBruto=(valorDevido||0)+baseEncargos-(valorEntrada||0);
    valorParcela=Math.ceil(valorTotalBruto/nParc);
  }
  let entradaInfo=null;
  let startIndex=1;
  if(entradaAtiva && valorEntrada>0){
    const existente=negEditingId ? negFindById(negEditingId) : null;
    const dataEntrada=existente?.dataEntrada || negFormatDateBR(new Date());
    entradaInfo={valor:valorEntrada, data:dataEntrada};
    startIndex=2;
  }
  const out=document.getElementById('neg-compensacao-out');
  if(out){
    out.value=negBuildCompensacaoBlock(datas, valorParcela, startIndex, entradaInfo);
  }
}
function negClearForm(){
  ['neg-busca-cnpj','neg-busca-codigo','neg-valor-devido','neg-multa','neg-juros','neg-num-parcelas','neg-valor-entrada','neg-primeiro-pagamento','neg-primeiro-pagamento-display','neg-datas','neg-qtd-boletos'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  const entradaChk=document.getElementById('neg-entrada-ativa');
  if(entradaChk) entradaChk.checked=false;
  negToggleEntrada();
  const radio=document.querySelector('input[name="neg-periodicidade"][value="semanal"]');
  if(radio) radio.checked=true;
  const taxa=document.getElementById('neg-taxa-boletos');
  if(taxa) taxa.checked=false;
  negToggleTaxaBoletos();
  negClearClienteInfo();
  negEditingId=null;
}
function negClearNegotiacaoFields(){
  ['neg-valor-devido','neg-multa','neg-juros','neg-num-parcelas','neg-valor-entrada','neg-primeiro-pagamento','neg-primeiro-pagamento-display','neg-datas','neg-qtd-boletos','neg-numero-negociacao'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  const texto=document.getElementById('neg-compensacao-out');
  if(texto) texto.value='';
  const entradaChk=document.getElementById('neg-entrada-ativa');
  if(entradaChk) entradaChk.checked=false;
  negToggleEntrada();
  const radio=document.querySelector('input[name="neg-periodicidade"][value="semanal"]');
  if(radio) radio.checked=true;
  const taxa=document.getElementById('neg-taxa-boletos');
  if(taxa) taxa.checked=false;
  negToggleTaxaBoletos();
  negEditingId=null;
}

function negBuscarOutroCliente(){
  const cnpjBusca=document.getElementById('neg-busca-cnpj');
  const codBusca=document.getElementById('neg-busca-codigo');
  const razaoWrap=document.getElementById('neg-razao-wrapper');
  const razaoField=document.getElementById('neg-razao-selecionada');
  if(cnpjBusca){ cnpjBusca.disabled=false; cnpjBusca.value=''; }
  if(codBusca){ codBusca.disabled=false; codBusca.value=''; }
  if(razaoField) razaoField.value='';
  if(razaoWrap) razaoWrap.classList.add('d-none');
  const btnBuscar=document.getElementById('neg-buscar');
  const btnOutro=document.getElementById('neg-buscar-outro');
  if(btnBuscar) btnBuscar.classList.remove('d-none');
  if(btnOutro) btnOutro.classList.add('d-none');
  negCurrentClienteId=null;
  negClienteSnapshot=null;
  negLastFoundClient=null;
  negEditingId=null;
}

function negToggleTaxaBoletos(){
  const toggle=document.getElementById('neg-taxa-boletos');
  const wrap=document.getElementById('neg-qtd-boletos-wrapper');
  const input=document.getElementById('neg-qtd-boletos');
  if(!toggle||!wrap||!input) return;
  const on=!!toggle.checked;
  wrap.classList.toggle('d-none', !on);
  if(!on) input.value='';
}
function negValidateDates(datas){
  for(const dt of datas){
    const d=negParseDateBR(dt);
    if(!d){
      alert('Data inválida: '+dt);
      return false;
    }
    const day=d.getDay();
    if(day===0 || day===6){
      alert('Datas não podem cair em sábados ou domingos. Ajuste-as.');
      return false;
    }
  }
  return true;
}
function negCalcDiasAtraso(item){
  const parcelas=negGetParcelas(item||{datasPrevistas:[]});
  if(!parcelas.length) return 0;
  // usa a primeira parcela ainda não paga (próxima a vencer) para calcular atraso/antecedência
  const alvo=parcelas.find(p=>!p.paga);
  if(!alvo) return 0;
  const dt=negParseDateBR(alvo.data);
  if(!dt) return 0;
  const today=new Date();
  // Round instead of floor to avoid DST off-by-one; negative means dias restantes até vencer.
  const diff=Math.round((today.setHours(0,0,0,0)-dt.setHours(0,0,0,0))/(1000*60*60*24));
  return diff;
}
function negHasEntrada(item){
  return !!(item?.entradaAtiva && (item.valorEntrada||0)>0);
}
function negBaseParcelas(item){
  return Math.max(item.numeroParcelas||0, (item.datasPrevistas||[]).length);
}
function negTotalParcelas(item){
  return negBaseParcelas(item) + (negHasEntrada(item) ? 1 : 0);
}
function negNormalizeParcelasPagas(item){
  const hasEntrada=negHasEntrada(item);
  const base=negBaseParcelas(item);
  const total=negTotalParcelas(item);
  if(!Array.isArray(item.parcelasPagas)) item.parcelasPagas=[];
  if(hasEntrada && item.parcelasPagas.length===base){
    item.parcelasPagas=[{paga:false, pagoEm:''}, ...item.parcelasPagas];
  }else if(!hasEntrada && item.parcelasPagas.length===base+1){
    item.parcelasPagas=item.parcelasPagas.slice(1);
  }
  const arr=new Array(total);
  for(let i=0;i<total;i++){
    const entry=item.parcelasPagas[i];
    if(entry && typeof entry==='object'){
      arr[i]={paga:!!entry.paga, pagoEm:entry.pagoEm||''};
    }else{
      arr[i]={paga:!!entry, pagoEm:''};
    }
  }
  item.parcelasPagas=arr;
  return arr;
}
function negDiffDiasDataBR(dtStr){
  const d=negParseDateBR(dtStr);
  if(!d) return 0;
  const today=new Date();
  const t=new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const base=new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((t-base)/(1000*60*60*24));
}
function negParcelaMeta(parc, opts={}){
  const pagoDt=parc.pagoEm ? negParseISODate(parc.pagoEm) : null;
  const pagoText=parc.pagoEm ? negFormatDateBR(pagoDt||new Date(parc.pagoEm)) : '';
  const canEdit=!!opts.editable;
  const disabled=opts.disabled ? 'disabled aria-disabled="true"' : '';
  const dateHtml=canEdit
    ? `<span class="neg-parcela-pay-wrap">
        <span class="neg-parcela-date-text">${parc.data||'-'}</span>
        <span class="neg-parcela-pay-inline">
          <span class="neg-parcela-pay-label">pago em</span>
          <span class="neg-parcela-pay-edit">
            <span class="neg-parcela-pay-display">${pagoText||'-'}</span>
            <input type="text" class="neg-parcela-pay-input" data-parcela="${parc.idx}" value="${escapeHtml(pagoText)}" placeholder="dd/mm/aaaa" ${disabled}>
          </span>
        </span>
      </span>`
    : `<span class="neg-parcela-date-text">${parc.data||'-'}</span>`;
  const paySuffix=!canEdit ? (pagoText ? ` · pago em ${pagoText}` : '') : '';
  return `${dateHtml} · R$ ${formatBR(parc.valor||0)}${paySuffix}`;
}
function negSetParcelaPagoEm(item, idx, raw){
  if(!item) return {ok:false, reason:'no-item'};
  const parcelas=negGetParcelas(item);
  const parc=parcelas.find(p=>p.idx===idx);
  if(!parc) return {ok:false, reason:'not-found'};
  const arr=negNormalizeParcelasPagas(item);
  if(!raw){
    arr[idx]={paga:!!arr[idx]?.paga, pagoEm:''};
    item.parcelasPagas=arr;
    item.atualizadoEm=Date.now();
    return {ok:true, normalized:''};
  }
  const d=negParseDateBR(raw);
  if(!d) return {ok:false, reason:'invalid'};
  const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  arr[idx]={paga:true, pagoEm:iso};
  item.parcelasPagas=arr;
  item.atualizadoEm=Date.now();
  return {ok:true, normalized:negFormatDateBR(d)};
}
async function copyRichEmailSerasa(razao, cnpj){
  const razaoSafe=escapeHtml(razao||'');
  const cnpjSafe=escapeHtml(cnpj||'');
  const subject=`Remissão do Serasa (${cnpj||''})`;
  const html=`${escapeHtml(subject)}<br><br>Prezados(as),<br><br>Favor remitir os títulos registrados junto ao Serasa do seguinte cliente:<br><b>${razaoSafe}</b><br><b>${cnpjSafe}</b><br>Cliente iniciou uma negociação de suas pendências conosco.<br><br>Atenciosamente,`;
  const plain=`${subject}

Prezados(as),

Favor remitir os títulos registrados junto ao Serasa do seguinte cliente:
${razao||''}
${cnpj||''}
Cliente iniciou uma negociação de suas pendências conosco.

Atenciosamente,`;
  try{
    if(window.ClipboardItem && navigator.clipboard?.write){
      const item=new ClipboardItem({
        'text/html': new Blob([html], {type:'text/html'}),
        'text/plain': new Blob([plain], {type:'text/plain'})
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  }catch(_e){}
  let tempDiv=null;
  try{
    const div=document.createElement('div');
    tempDiv=div;
    div.contentEditable='true';
    div.style.position='fixed';
    div.style.left='-9999px';
    div.style.top='0';
    div.innerHTML=html;
    document.body.appendChild(div);
    const selection=window.getSelection();
    const saved=[];
    if(selection){
      for(let i=0;i<selection.rangeCount;i++){
        saved.push(selection.getRangeAt(i));
      }
    }
    const range=document.createRange();
    range.selectNodeContents(div);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand('copy');
    selection?.removeAllRanges();
    saved.forEach(r=>selection?.addRange(r));
    return true;
  }catch(_e){
  }finally{
    if(tempDiv?.parentNode) tempDiv.parentNode.removeChild(tempDiv);
  }
  return false;
}
function negBuildCobrancaText(parc, diff, parcelaCobrada, total){
  const atraso=Math.max(0,diff||0);
  const hora=new Date().getHours();
  const saudacao=hora<12 ? '*Bom dia*' : '*Boa tarde*';
  const parcelaLabel=(parcelaCobrada && total) ? `\`${parcelaCobrada}\`/\`${total}\`` : `\`${parc.idx+1}\``;
  if(atraso===0){
    return `${saudacao}, a parcela ${parcelaLabel} com valor de \`R$ ${formatBR(parc.valor||0)}\` vence *hoje*, posso contar com a transferência *até o fim do dia*?`;
  }
  return `${saudacao}, a parcela ${parcelaLabel} com o valor de \`R$ ${formatBR(parc.valor||0)}\` está em atraso há \`${atraso}\` dia(s), para evitar o *cancelamento da negociação*, por gentileza, efetue a transferência *ainda hoje*!`;
}
function negBuildCobrancaTextMulti(cobraveis, total){
  const hora=new Date().getHours();
  const saudacao=hora<12 ? '*Bom dia*' : '*Boa tarde*';
  const ord=[...cobraveis].sort((a,b)=>a.idx-b.idx);
  const bullets=ord.map(p=>{
    const diff=negDiffDiasDataBR(p.data);
    const valor=`R$ ${formatBR(p.valor||0)}`;
    const idx=total ? `\`${p.idx+1}\`/\`${total}\`` : `\`${p.idx+1}\``;
    if(diff>0){
      return `- Parcela ${idx} com o valor de \`${valor}\` está em atraso há \`${diff}\` dia(s);`;
    }
    return `- Parcela ${idx} com valor de \`${valor}\` vence *hoje*;`;
  });
  return `${saudacao}, as seguintes parcelas estão em atraso:
${bullets.join('\n')}
Para evitar o *cancelamento da negociação*, por gentileza, efetue a transferência *ainda hoje*!`;
}
function negEnsureManualClienteSelected(){
  const rawCnpj=document.getElementById('neg-busca-cnpj')?.value||'';
  const rawCod=document.getElementById('neg-busca-codigo')?.value||'';
  const cnpj14=normalizeCnpj(rawCnpj);
  const cod6=normalizeCodigo(rawCod);
  if(!cnpj14 || !cod6){
    alert('Informe CNPJ (14 dígitos) e Código do Cliente para salvar.');
    return false;
  }
  const manualId=`manual:${cod6}:${cnpj14}`;
  negCurrentClienteId=manualId;
  negClienteSnapshot={
    id:manualId,
    razaoSocial:'',
    cnpj:cnpj14,
    codigoCliente:cod6,
    responsavel:'',
    contato:''
  };
  return true;
}
function negLoadFormFromNeg(neg){
  const set=(id,val)=>{const el=document.getElementById(id); if(el) el.value=val??'';};
  set('neg-valor-devido', formatBR(neg.valorDevido||0));
  set('neg-multa', formatBR(neg.multa||0));
  set('neg-juros', formatBR(neg.juros||0));
  set('neg-num-parcelas', neg.numeroParcelas||'');
  const entradaChk=document.getElementById('neg-entrada-ativa');
  if(entradaChk){ entradaChk.checked=!!neg.entradaAtiva; }
  set('neg-valor-entrada', neg.entradaAtiva ? formatBR(neg.valorEntrada||0) : '');
  negToggleEntrada();
  const radios=document.querySelectorAll('input[name="neg-periodicidade"]');
  radios.forEach(r=>{ r.checked = (r.value===neg.periodicidade); });
  const taxa=document.getElementById('neg-taxa-boletos');
  if(taxa) taxa.checked=!!neg.taxaBoletosAtiva;
  set('neg-qtd-boletos', neg.taxaBoletosAtiva ? (neg.qtdBoletos||'') : '');
  negToggleTaxaBoletos();
  set('neg-numero-negociacao', neg.numeroNegociacao||'');
  const datasText=(neg.datasPrevistas||[]).join('\n');
  set('neg-datas', datasText);
  const texto=document.getElementById('neg-compensacao-out');
  if(texto) texto.value=neg.textoNegociacao||'';
  const first=neg.datasPrevistas?.[0];
  if(first){
    const d=negParseDateBR(first);
    if(d){
      negSetDateISO(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
  }
}
function negGetParcelas(item){
  const datas=item.datasPrevistas||[];
  const valor=item.valorParcela||0;
  const hasEntrada=negHasEntrada(item);
  const pagas=negNormalizeParcelasPagas(item);
  const parcelas=[];
  if(hasEntrada){
    let dataEntrada=item.dataEntrada;
    if(!dataEntrada){
      dataEntrada=negFormatDateBR(new Date());
      item.dataEntrada=dataEntrada;
    }
    parcelas.push({
      idx:0,
      kind:'entrada',
      data:dataEntrada,
      valor:item.valorEntrada||0,
      paga:!!pagas[0]?.paga,
      pagoEm:pagas[0]?.pagoEm||''
    });
  }
  datas.forEach((dt,i)=>{
    const idx=hasEntrada ? i+1 : i;
    const pagaInfo=pagas[idx]||{};
    parcelas.push({
      idx,
      kind:'parcela',
      data:dt,
      valor,
      paga:!!pagaInfo.paga,
      pagoEm:pagaInfo.pagoEm||''
    });
  });
  return parcelas;
}
function negBuildCompensacaoTexto(item){
  const base=(item?.textoNegociacao||'').trim();
  if(!base) return '';
  const parcelas=negGetParcelas(item);
  const pagosMap=new Map();
  parcelas.forEach(p=>{
    if(p?.pagoEm){
      const d=negParseISODate(p.pagoEm);
      if(d) pagosMap.set(p.idx+1, negFormatDateBR(d));
    }
  });
  if(!pagosMap.size) return base;
  const lines=base.split(/\r?\n/);
  const re=/^0?(\d{1,2})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d\.\,]+)(?:\s+(\d{2}\/\d{2}\/\d{4}|X))?\s*$/;
  const updated=lines.map(line=>{
    const m=line.match(re);
    if(!m) return line;
    const parcelaNum=parseInt(m[1],10);
    const pagoDate=pagosMap.get(parcelaNum);
    const row={
      parcela:parcelaNum,
      vencto:m[2],
      valor:parseBR(m[3]),
      pagto:pagoDate || (m[4]||'X')
    };
    return typeof cFmtNegRow==='function' ? cFmtNegRow(row) : line;
  });
  return updated.join('\n').trim();
}
function negFillCompensacaoFromNeg(item, parcelaIdx){
  if(!item) return;
  const multaEl=document.getElementById('c-multa');
  const jurosEl=document.getElementById('c-juros');
  const parcelasEl=document.getElementById('c-parcelas');
  const negEl=document.getElementById('c-negociacao');
  const chkTaxa=document.getElementById('c-chkTaxa');
  const qtdBoletosEl=document.getElementById('c-qtdBoletos');
  const parcelaPagaEl=document.getElementById('c-parcelaPaga');
  if(!multaEl || !jurosEl || !parcelasEl || !negEl || !chkTaxa || !qtdBoletosEl || !parcelaPagaEl) return;

  setPage('compensacoes');
  if(typeof cSetMode==='function') cSetMode('neg');

  multaEl.value=formatBR(item.multa||0);
  jurosEl.value=formatBR(item.juros||0);
  const totalParc=negGetParcelas(item).length;
  parcelasEl.value=String(item.numeroParcelas||totalParc||1);

  const hasTaxa=!!item.taxaBoletosAtiva && (item.qtdBoletos||0)>0;
  chkTaxa.checked=hasTaxa;
  qtdBoletosEl.value=hasTaxa ? String(item.qtdBoletos||0) : '';
  if(typeof cToggleTaxa==='function') cToggleTaxa();

  negEl.value=negBuildCompensacaoTexto(item);

  const parcelas=negGetParcelas(item);
  const alvo=parcelas.find(p=>p.idx===parcelaIdx) || parcelas[0];
  if(alvo){
    parcelaPagaEl.value=String(alvo.idx+1);
    let d=null;
    if(alvo.pagoEm){
      d=negParseISODate(alvo.pagoEm);
    }
    if(!d) d=new Date();
    if(typeof cSetBRAndISO==='function') cSetBRAndISO(d);
  }else{
    if(typeof cSetBRAndISO==='function') cSetBRAndISO(new Date());
  }
}
function negUltimaParcelaPaga(item){
  const parcelas=negGetParcelas(item);
  const isClosed=item.situacao==='finalizada' || item.situacao==='cancelada';
  for(let i=parcelas.length-1;i>=0;i--){
    if(parcelas[i].paga) return parcelas[i];
  }
  return null;
}
function negGetUltimaParcelaPagaInfo(item){
  const parcelas=negGetParcelas(item) || [];
  let lastIdx=-1;
  let lastPaidTs=null;
  for(let i=0;i<parcelas.length;i++){
    if(parcelas[i]?.paga){
      lastIdx=i;
      if(parcelas[i].pagoEm) lastPaidTs=parcelas[i].pagoEm;
    }
  }
  if(lastIdx<0) return '—';
  const n=lastIdx+1;
  const dt=lastPaidTs ? formatBRDateFromISO(lastPaidTs) : '';
  return dt ? `${n} • ${dt}` : `${n}`;
}
function negBuildNegociacaoRow(item, includeUltima, diasValue, diasClass){
  const snap=item.clienteSnapshot||{};
  const codigo=normalizeCodigo(snap.codigoCliente)||'-';
  const cnpjDigits=snap.cnpj||'';
  const cnpj=maskCNPJValue(cnpjDigits);
  const parcelas=negGetParcelas(item);
  const total=parcelas.length;
  const pagas=parcelas.filter(p=>p.paga).length;
  const parcelaAtual=(total===0) ? 0 : (pagas>=total ? total : (pagas+1));
  const textoParcela=`${parcelaAtual}/${total}`;
  const valorTotal=item.valorTotalNegociado||0;
  const valorPago=pagas*(item.valorParcela||0);
  const percent=total>0 ? Math.round((pagas/total)*100) : 0;
  const color=trGetProgressColor(percent);
  const progressTitle=`R$ ${formatBR(valorPago)} / R$ ${formatBR(valorTotal)} • (${pagas}/${total} parcelas)`;
  const situacao=negGetSituacao(item);
  const isClosed=situacao==='finalizada' || situacao==='cancelada';
  const diasValor=typeof diasValue!=='undefined'
    ? diasValue
    : (situacao==='finalizada'
      ? negDaysSince(item.finalizadaEm)
      : situacao==='cancelada'
        ? negDaysSince(item.canceladaEm)
        : negCalcDiasAtraso(item));
  const diasClassName=typeof diasClass!=='undefined'
    ? diasClass
    : (situacao==='andamento'
      ? (diasValor<0 ? 'neg-dias verde' : diasValor===0 ? 'neg-dias hoje' : 'neg-dias vermelho')
      : '');
  const ultimaInfo=includeUltima ? negGetUltimaParcelaPagaInfo(item) : null;
  return `<tr data-neg-id="${item.id}">
    <td>${codigo||'-'}</td>
    <td>${cnpj||'-'}</td>
    ${includeUltima ? `<td>${ultimaInfo}</td>` : ''}
    <td>${diasClassName ? `<span class="${diasClassName}">${diasValor}</span>` : diasValor}</td>
    <td>
      <div class="tr-progress" title="${progressTitle}">
        <div class="tr-progress__bar" style="width:${percent}%;background-color:${color}"></div>
        <div class="tr-progress__text"><span>${textoParcela}</span></div>
      </div>
    </td>
  </tr>`;
}
function negRenderAndamento(){
  const tbody=document.getElementById('neg-andamento-body');
  if(!tbody) return;
  const list=negList.filter(item=>negGetSituacao(item)==='andamento');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="5" class="text-center text-muted">Nenhuma negociação cadastrada.</td></tr>';
    return;
  }
  const sorted=[...list].sort((a,b)=>(negCalcDiasAtraso(b)||0)-(negCalcDiasAtraso(a)||0));
  const rows=sorted.map(item=>negBuildNegociacaoRow(item,true));
  tbody.innerHTML=rows.join('');
}
function negRenderFinalizadas(){
  const tbody=document.getElementById('neg-finalizadas-body');
  if(!tbody) return;
  const list=negList.filter(item=>negGetSituacao(item)==='finalizada');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="4" class="text-center text-muted">Nenhuma negociação cadastrada.</td></tr>';
    return;
  }
  const sorted=[...list].sort((a,b)=>(negCalcDiasAtraso(b)||0)-(negCalcDiasAtraso(a)||0));
  tbody.innerHTML=sorted.map(item=>{
    const dias=negDaysSince(item.finalizadaEm);
    return negBuildNegociacaoRow(item,false,dias,null);
  }).join('');
}
function negRenderCanceladas(){
  const tbody=document.getElementById('neg-canceladas-body');
  if(!tbody) return;
  const list=negList.filter(item=>negGetSituacao(item)==='cancelada');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="4" class="text-center text-muted">Nenhuma negociação cadastrada.</td></tr>';
    return;
  }
  const sorted=[...list].sort((a,b)=>(negCalcDiasAtraso(b)||0)-(negCalcDiasAtraso(a)||0));
  tbody.innerHTML=sorted.map(item=>{
    const dias=negDaysSince(item.canceladaEm);
    return negBuildNegociacaoRow(item,false,dias,null);
  }).join('');
}
function negRefreshAll(){
  negRenderAndamento();
  negRenderFinalizadas();
  negRenderCanceladas();
}
// Modal de detalhes de negociação em andamento
const negModal=document.getElementById('neg-modal');
const negModalBody=document.getElementById('neg-modal-body');
const negModalTitle=document.getElementById('neg-modal-title');
const negModalClose=document.getElementById('neg-modal-close');
let pixModalUrl=null;
function negHideModal(){
  if(negModal) negModal.classList.remove('open');
  document.body.style.overflow='';
}
function negShowModal(item){
  if(!negModal || !negModalBody || !negModalTitle) return;
  negEnsureSituacao(item);
  const snap=item.clienteSnapshot||{};
  const cnpj=maskCNPJValue(snap.cnpj||'');
  const parcelas=negGetParcelas(item);
  const totalParc=parcelas.length;
  const pagasCount=parcelas.filter(p=>p.paga).length;
  const parcelaAtual=(totalParc===0) ? 0 : (pagasCount>=totalParc ? totalParc : (pagasCount+1));
  const valorTotal=item.valorTotalNegociado||0;
  const valorPago=pagasCount*(item.valorParcela||0);
  const restante=Math.max(0, valorTotal-valorPago);
  const diasAtraso=negCalcDiasAtraso(item);
  const percent=valorTotal>0 ? Math.min(100, Math.round((valorPago/valorTotal)*100)) : 0;
  const color=trGetProgressColor(percent);
  const progressTitle=`R$ ${formatBR(valorPago)} / R$ ${formatBR(valorTotal)} • (${pagasCount}/${totalParc} parcelas)`;
  const ultima=negUltimaParcelaPaga(item);
  let ultimaPaga='-';
  if(ultima){
    const pagoDt=ultima.pagoEm ? negParseISODate(ultima.pagoEm) : null;
    const pagoData=ultima.pagoEm ? negFormatDateBR(pagoDt||new Date(ultima.pagoEm)) : '';
    ultimaPaga=`PARC. ${ultima.idx+1}${pagoData ? ' • '+pagoData : ''}`;
  }
  negModalTitle.textContent=snap.razaoSocial||'CLIENTE';
  const situacao=negGetSituacao(item);
  let actions=document.getElementById('neg-modal-actions');
  if(!actions){
    actions=document.createElement('div');
    actions.id='neg-modal-actions';
    actions.className='neg-modal-actions mt-2';
    negModalTitle.insertAdjacentElement('afterend', actions);
  }
  actions.innerHTML='';
  const serasaBtn=document.createElement('button');
  serasaBtn.id='neg-email-serasa-btn';
  serasaBtn.type='button';
  serasaBtn.className='btn btn-sm btn-dark';
  serasaBtn.innerHTML='<i class="bi bi-envelope-fill" aria-hidden="true"></i><span class="ms-1">E-mail Serasa</span>';
  actions.appendChild(serasaBtn);
  const deleteBtn=document.createElement('button');
  deleteBtn.type='button';
  deleteBtn.className='btn btn-sm btn-dark';
  deleteBtn.setAttribute('data-neg-action','delete-modal');
  deleteBtn.innerHTML='<i class="bi bi-trash" aria-hidden="true"></i><span class="ms-1">Excluir</span>';
  actions.appendChild(deleteBtn);
  if(situacao==='andamento'){
    const cancelBtn=document.createElement('button');
    cancelBtn.type='button';
    cancelBtn.className='btn btn-sm btn-dark neg-icon-btn';
    cancelBtn.setAttribute('data-neg-action','cancelar');
    cancelBtn.setAttribute('aria-label','Cancelar negociação');
    cancelBtn.title='Cancelar';
    cancelBtn.innerHTML='<i class="bi bi-x-circle" aria-hidden="true"></i>';
    actions.appendChild(cancelBtn);
    const finalizeBtn=document.createElement('button');
    finalizeBtn.type='button';
    finalizeBtn.className='btn btn-sm btn-dark neg-icon-btn';
    finalizeBtn.setAttribute('data-neg-action','finalizar');
    finalizeBtn.setAttribute('aria-label','Finalizar negociação');
    finalizeBtn.title='Finalizar';
    finalizeBtn.innerHTML='<i class="bi bi-check2-circle" aria-hidden="true"></i>';
    actions.appendChild(finalizeBtn);
  }
  if(situacao==='cancelada'){
    const revertBtn=document.createElement('button');
    revertBtn.type='button';
    revertBtn.className='btn btn-sm';
    revertBtn.setAttribute('data-neg-action','reverter-cancelamento');
    revertBtn.innerHTML='<i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span class="ms-1">Reverter cancelamento</span>';
    actions.appendChild(revertBtn);
  }
  serasaBtn.onclick=async e=>{
    e.stopPropagation();
    const razao=snap.razaoSocial||'';
    const cnpjFmt=maskCNPJValue(snap.cnpj||'');
    const ok=await copyRichEmailSerasa(razao, cnpjFmt);
    if(ok){
      serasaBtn.classList.add('copied');
      setTimeout(()=>serasaBtn.classList.remove('copied'),800);
    }
  };
  const isClosedLocal=situacao==='finalizada' || situacao==='cancelada';
  const canEditDates=(situacao==='andamento');
  const cobraveis=parcelas.filter(p=>!p.paga && negDiffDiasDataBR(p.data)>=0);
  const multiAtraso=cobraveis.length>1;
  const lastAtrasadaIdx=multiAtraso ? Math.max(...cobraveis.map(p=>p.idx)) : null;
  const parcelasHtml=parcelas.map(parc=>{
    const id=`parc-${item.id}-${parc.idx}`;
    const diff=negDiffDiasDataBR(parc.data);
    const overdue=!parc.paga && diff>0;
    const stateLabel=parc.paga ? 'PAGO' : (overdue ? `EM ATRASO HÁ ${diff} DIA${diff>1?'S':''}` : 'PENDENTE');
    const stateClass=parc.paga ? 'neg-parcela-state paid' : (overdue ? 'neg-parcela-state overdue' : 'neg-parcela-state pending');
    const showCopy=!isClosedLocal && (multiAtraso ? (!parc.paga && diff>=0 && parc.idx===lastAtrasadaIdx) : (!parc.paga && diff>=0));
    const showComp=(situacao==='andamento' && !!parc.paga);
    const titleLabel=parc.kind==='entrada' ? `PARCELA ${parc.idx+1} (Entrada)` : `PARCELA ${parc.idx+1}`;
    const canEditPay=canEditDates && !!parc.paga;
    return `<div class="neg-parcela">
      <div>
        <div class="neg-parcela-title-row">
          <div class="neg-parcela-title">${titleLabel}</div>
          ${canEditPay ? `
          <button type="button" class="btn btn-sm neg-parcela-pay-btn" data-parcela-pay-edit="${parc.idx}" aria-label="Editar data de pagamento da parcela ${parc.idx+1}">
            <i class="bi bi-calendar-event" aria-hidden="true"></i>
          </button>` : ''}
        </div>
        <div class="neg-parcela-meta">${negParcelaMeta(parc,{editable:canEditPay, disabled:!canEditPay})}</div>
        ${showCopy ? `
        <button class="btn btn-sm neg-copiar-cobranca" type="button" data-parcela="${parc.idx}">
          <i class="bi bi-clipboard" aria-hidden="true"></i>
          <span>COPIAR COBRANÇA</span>
        </button>` : ''}
      </div>
      <div class="neg-parcela-toggle">
        ${showComp ? `
        <button class="btn btn-sm neg-comp-btn" type="button" data-neg-compensar="${parc.idx}" aria-label="Compensação da parcela ${parc.idx+1}">
          <span>COMPENSAÇÃO</span>
        </button>` : ''}
        <span class="${stateClass}">${stateLabel}</span>
        <label class="neg-switch" for="${id}">
          <input type="checkbox" class="neg-parcela-check" data-parcela="${parc.idx}" id="${id}" ${parc.paga?'checked':''} ${isClosedLocal ? 'disabled aria-disabled="true"' : ''} aria-label="Parcela ${parc.idx+1} paga">
          <span class="neg-switch-slider"></span>
        </label>
      </div>
    </div>`;
  }).join('');
  negModalBody.innerHTML=`
    <div class="neg-modal-section">
      <h4>CLIENTE</h4>
      <div class="neg-modal-grid">
        <div class="neg-modal-field"><span class="neg-modal-label">RAZÃO SOCIAL</span><span class="neg-modal-value">${snap.razaoSocial||'-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">CNPJ</span><span class="neg-modal-value">${cnpj||'-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">CÓDIGO</span><span class="neg-modal-value">${normalizeCodigo(snap.codigoCliente)||'-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">RESPONSÁVEL</span><span class="neg-modal-value">${snap.responsavel||'-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">CONTATO</span><span class="neg-modal-value">${snap.contato||'-'}</span></div>
      </div>
    </div>
    <div class="neg-modal-section">
      <h4>RESUMO</h4>
      <div class="neg-modal-grid">
        <div class="neg-modal-field"><span class="neg-modal-label">PARCELAS PAGAS</span><span class="neg-modal-value">${pagasCount}/${totalParc}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">PARCELA ATUAL</span><span class="neg-modal-value">${parcelaAtual}/${totalParc}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">DIAS</span><span class="neg-modal-value">${diasAtraso}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">VALOR PARCELA</span><span class="neg-modal-value">R$ ${formatBR(item.valorParcela||0)}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">VALOR TOTAL</span><span class="neg-modal-value">R$ ${formatBR(valorTotal)}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">VALOR PAGO</span><span class="neg-modal-value">R$ ${formatBR(valorPago)}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">VALOR RESTANTE</span><span class="neg-modal-value">R$ ${formatBR(restante)}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">ÚLTIMA PARC. PAGA</span><span class="neg-modal-value">${ultimaPaga}</span></div>
      </div>
      <div class="tr-progress" title="${progressTitle}">
        <div class="tr-progress__bar" style="width:${percent}%;background-color:${color}"></div>
        <div class="tr-progress__text"><span>${parcelaAtual}/${totalParc}</span></div>
      </div>
    </div>
    <div class="neg-modal-section">
      <h4>NEGOCIAÇÃO</h4>
      <div class="neg-modal-grid">
        <div class="neg-modal-field"><span class="neg-modal-label">Nº NEGOCIAÇÃO</span><span class="neg-modal-value">${item.numeroNegociacao||'-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">VALOR DEVIDO</span><span class="neg-modal-value">R$ ${formatBR(item.valorDevido||0)}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">MULTA</span><span class="neg-modal-value">R$ ${formatBR(item.multa||0)}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">JUROS</span><span class="neg-modal-value">R$ ${formatBR(item.juros||0)}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">ENTRADA</span><span class="neg-modal-value">${item.entradaAtiva ? 'R$ '+formatBR(item.valorEntrada||0) : '-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">PARCELAS</span><span class="neg-modal-value">${item.numeroParcelas||0}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">VALOR PARCELA</span><span class="neg-modal-value">R$ ${formatBR(item.valorParcela||0)}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">VALOR TOTAL</span><span class="neg-modal-value">R$ ${formatBR(item.valorTotalNegociado||0)}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">PERIODICIDADE</span><span class="neg-modal-value">${item.periodicidade||'-'}</span></div>
        <div class="neg-modal-field"><span class="neg-modal-label">TAXA BOLETOS</span><span class="neg-modal-value">${item.taxaBoletosAtiva ? 'SIM ('+(item.qtdBoletos||0)+' boletos)' : 'NÃO'}</span></div>
      </div>
      <div class="neg-modal-field">
        <span class="neg-modal-label">PARCELAS</span>
        <div class="neg-parcelas-list">
          ${parcelasHtml || '<div class="neg-modal-pre">Nenhuma parcela.</div>'}
        </div>
      </div>
    </div>
  `;
  negModal.classList.add('open');
  negModal.setAttribute('data-neg-id', item.id);
  document.body.style.overflow='hidden';
}
function negSaveFromForm(){
  const noIdentificar=negIsNoIdentificar();
  const preexistente=!!document.getElementById('neg-preexistente')?.checked;
  if(!negCurrentClienteId && !noIdentificar){
    alert('Selecione e confirme um cliente antes de salvar a negociação.');
    return;
  }
  if(noIdentificar){
    if(!negEnsureManualClienteSelected()) return;
  }
  const existente=negEditingId ? negFindById(negEditingId) : null;
  const valorDevido=parseBR(document.getElementById('neg-valor-devido')?.value);
  const valorMulta=parseBR(document.getElementById('neg-multa')?.value);
  const valorJuros=parseBR(document.getElementById('neg-juros')?.value);
  const numParcelas=Math.max(1, parseInt(document.getElementById('neg-num-parcelas')?.value||'0',10)||0);
  const entradaAtiva=!!document.getElementById('neg-entrada-ativa')?.checked;
  const valorEntrada=entradaAtiva ? parseBR(document.getElementById('neg-valor-entrada')?.value) : 0;
  const periodicidade=(document.querySelector('input[name="neg-periodicidade"]:checked')?.value)||'semanal';
  const taxaBoletosAtiva=!!document.getElementById('neg-taxa-boletos')?.checked;
  const qtdBoletos=parseInt(document.getElementById('neg-qtd-boletos')?.value||'0',10)||0;
  const numeroNegociacao=(document.getElementById('neg-numero-negociacao')?.value||'').trim();
  const textoNegociacao=document.getElementById('neg-compensacao-out')?.value||'';
  const datas=(document.getElementById('neg-datas')?.value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  let dataEntrada=existente?.dataEntrada || '';

  if(!valorDevido || valorDevido<=0){
    alert('Informe o valor devido.');
    return;
  }
  if(numParcelas<1){
    alert('Número de parcelas deve ser no mínimo 1.');
    return;
  }
  if(datas.length!==numParcelas){
    alert('A quantidade de datas previstas deve ser igual ao número de parcelas.');
    return;
  }
  if(!negValidateDates(datas)) return;

  const now=new Date().toISOString();
  let snap={...negClienteSnapshot};
  if(!snap || !snap.cnpj){
    alert('Cliente inválido. Busque novamente.');
    return;
  }
  snap={
    ...snap,
    codigoCliente:normalizeCodigo(snap.codigoCliente),
    cnpj:normalizeCnpj(snap.cnpj)
  };
  const toCents=v=>Math.round((v||0)*100);
  let valorParcela=0;
  let valorTotalNegociado=0;
  let valorJurosAjustado=valorJuros||0;
  let encargos=0;
  if(entradaAtiva && valorEntrada>0){
    if(!dataEntrada){
      dataEntrada=negFormatDateBR(new Date());
    }
  }else{
    dataEntrada='';
  }
  if(preexistente){
    const valorDevidoC=toCents(valorDevido);
    const valorMultaC=toCents(valorMulta);
    const valorJurosC=toCents(valorJuros);
    const entradaC=entradaAtiva ? toCents(valorEntrada) : 0;
    const taxaBoletoC=taxaBoletosAtiva ? 500*qtdBoletos : 0;
    encargos=(valorMultaC+valorJurosC+taxaBoletoC)/100;
    const valorTotalBrutoC=valorDevidoC+valorMultaC+valorJurosC+taxaBoletoC-entradaC;
    valorParcela=(valorTotalBrutoC/numParcelas)/100;
    valorTotalNegociado=valorTotalBrutoC/100;
  }else{
    const taxaBoleto=taxaBoletosAtiva ? 5*qtdBoletos : 0;
    const baseEncargos=(valorMulta||0)+(valorJuros||0)+taxaBoleto;
    const valorTotalBruto=(valorDevido||0)+baseEncargos-(valorEntrada||0);
    const valorParcelaCalc=Math.ceil(valorTotalBruto/numParcelas);
    const diferenca=valorParcelaCalc*numParcelas - valorTotalBruto;
    valorJurosAjustado=(valorJuros||0)+diferenca;
    encargos=(valorMulta||0)+valorJurosAjustado+taxaBoleto;
    valorParcela=valorParcelaCalc;
    valorTotalNegociado=valorParcelaCalc*numParcelas;
  }
  const id=existente?.id || Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const negObj={
    id,
    clienteId:noIdentificar ? null : negCurrentClienteId,
    clienteSnapshot:snap,
    situacao:existente?.situacao || 'andamento',
    valorDevido,
    multa:valorMulta||0,
    juros:valorJurosAjustado,
    encargos,
    numeroParcelas:numParcelas,
    entradaAtiva,
    valorEntrada,
    periodicidade,
    datasPrevistas:datas,
    dataEntrada,
    taxaBoletosAtiva,
    qtdBoletos:taxaBoletosAtiva ? qtdBoletos : 0,
    numeroNegociacao,
    textoNegociacao,
    valorParcela,
    valorTotalNegociado,
    preexistente,
    parcelasPagas:existente?.parcelasPagas||[],
    criadoEm:existente?.criadoEm||now,
    atualizadoEm:now
  };
  // Ajusta parcelasPagas ao novo tamanho preservando datas pagas
  const temp={...negObj};
  negNormalizeParcelasPagas(temp);
  negObj.parcelasPagas=temp.parcelasPagas;
  if(existente){
    negList=negList.map(n=> n.id===existente.id ? negObj : n);
  }else{
    negList.push(negObj);
  }
  negSaveAll(negList);
  negRefreshAll();
  negClearForm();
  const texto=document.getElementById('neg-compensacao-out');
  if(texto) texto.value='';
  const btn=document.getElementById('neg-salvar');
  if(btn){
    btn.classList.add('copied');
    setTimeout(()=>btn.classList.remove('copied'),1000);
  }
  if(negClienteSnapshot?.razaoSocial){
    alert(`Negociação ${existente?'atualizada':'registrada'} para o cliente: ${negClienteSnapshot.razaoSocial}`);
  }else{
    alert(`Negociação ${existente?'atualizada':'registrada'}.`);
  }
}

(function initNegCad(){
  const page=document.getElementById('page-neg-cad-negociacoes');
  if(!page) return;
  // inputs
  const cnpjBusca=document.getElementById('neg-busca-cnpj');
  const noIdentChk=document.getElementById('neg-no-identificar');
  const preexistChk=document.getElementById('neg-preexistente');
  const codigoBusca=document.getElementById('neg-busca-codigo');
  if(noIdentChk){
    noIdentChk.checked=false;
  }
  if(preexistChk){
    preexistChk.checked=false;
  }
  function negToggleNoIdentificar(){
    const active=noIdentChk?.checked;
    if(active){
      if(cnpjBusca) cnpjBusca.disabled=false;
      if(codigoBusca) codigoBusca.disabled=false;
    negCurrentClienteId=null;
    negClienteSnapshot=null;
    negClearClienteInfo();
    negLastFoundClient=null;
  }else{
    negClearClienteInfo();
  }
  }
  noIdentChk?.addEventListener('change',negToggleNoIdentificar);
  negToggleNoIdentificar();
  ['neg-busca-cnpj','neg-busca-codigo'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.addEventListener('keydown',e=>{
        if(e.key==='Enter'){
          e.preventDefault();
          if(negIsNoIdentificar()) return;
          negFindClienteByInputs();
        }
      });
      el.addEventListener('blur',()=>{
        if(negIsNoIdentificar()) return;
        negFindClienteByInputs();
      });
    }
  });
  document.getElementById('neg-buscar')?.addEventListener('click',()=>{
    if(negIsNoIdentificar()) return;
    negFindClienteByInputs();
  });
  document.getElementById('neg-entrada-ativa')?.addEventListener('change',negToggleEntrada);
  document.getElementById('neg-gerar-datas')?.addEventListener('click',negGenerateDatas);
  document.getElementById('neg-salvar')?.addEventListener('click',negSaveFromForm);
  document.getElementById('neg-buscar-outro')?.addEventListener('click',negBuscarOutroCliente);
  document.getElementById('neg-taxa-boletos')?.addEventListener('change',negToggleTaxaBoletos);
  // EXPLICAÇÃO: usamos 'change' no type="date" porque ele só dispara com uma data válida,
  // evitando mostrar formato parcial; a exibição sempre passa por formatBRDateFromISO.
  const negPrimeiro=document.getElementById('neg-primeiro-pagamento');
  const negPrimeiroDisp=document.getElementById('neg-primeiro-pagamento-display');
  if(negPrimeiro){
    // EXPLICAÇÃO: change dispara com data válida; input cobre casos de seleção imediata no calendário.
    negPrimeiro.addEventListener('change',negSyncDateDisplay);
    negPrimeiro.addEventListener('input',negSyncDateDisplay);
  }
  if(negPrimeiroDisp){
    negPrimeiroDisp.addEventListener('input',()=>{
      const d=negParseDateBR(negPrimeiroDisp.value);
      if(d) negSetDateISO(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    });
    negPrimeiroDisp.addEventListener('blur',()=>{
      const d=negParseDateBR(negPrimeiroDisp.value);
      if(d) negSetDateISO(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      else negSyncDateDisplay();
    });
  }
  document.getElementById('neg-prev-date')?.addEventListener('click',()=>negShiftDate(-1));
  document.getElementById('neg-next-date')?.addEventListener('click',()=>negShiftDate(1));
  negSyncDateDisplay(); // garante que o display reflita qualquer valor ISO já presente
  negToggleEntrada();
  negToggleTaxaBoletos();
  negSyncDateDisplay();
  negClearClienteInfo();
  negRefreshAll();
})();

(function initNegModalAndLists(){
  const negModal=document.getElementById('neg-modal');
  const negModalBody=document.getElementById('neg-modal-body');
  const negModalTitle=document.getElementById('neg-modal-title');
  const negModalClose=document.getElementById('neg-modal-close');
  if(!negModal || !negModalBody || !negModalTitle) return;

  function bindTbodyClick(tbodyId){
    const tbody=document.getElementById(tbodyId);
    if(!tbody) return;
    if(tbody.dataset.boundNegClick==='1') return;
    tbody.dataset.boundNegClick='1';
    tbody.addEventListener('click',e=>{
      const tr=e.target.closest('tr[data-neg-id]');
      if(!tr) return;
      const id=tr.getAttribute('data-neg-id');
      const item=negFindById(id);
      if(item) negShowModal(item);
    });
  }

  bindTbodyClick('neg-andamento-body');
  bindTbodyClick('neg-finalizadas-body');
  bindTbodyClick('neg-canceladas-body');

  if(negModalBody && negModalBody.dataset.boundNegBody!=='1'){
    negModalBody.dataset.boundNegBody='1';
    negModalBody.addEventListener('change',e=>{
      const payInput=e.target.closest('.neg-parcela-pay-input');
      if(payInput){
        const idx=parseInt(payInput.getAttribute('data-parcela')||'-1',10);
        if(idx<0) return;
        const negId=negModal?.getAttribute('data-neg-id');
        const item=negFindById(negId);
        if(!item) return;
        if(item.situacao && item.situacao!=='andamento'){
          const parc=negGetParcelas(item).find(p=>p.idx===idx);
          const pagoDt=parc?.pagoEm ? negParseISODate(parc.pagoEm) : null;
          payInput.value=pagoDt ? negFormatDateBR(pagoDt) : '';
          return;
        }
        const res=negSetParcelaPagoEm(item, idx, payInput.value||'');
        if(!res.ok){
          const parc=negGetParcelas(item).find(p=>p.idx===idx);
          const pagoDt=parc?.pagoEm ? negParseISODate(parc.pagoEm) : null;
          payInput.classList.add('is-invalid');
          setTimeout(()=>payInput.classList.remove('is-invalid'),1200);
          payInput.value=pagoDt ? negFormatDateBR(pagoDt) : '';
          return;
        }
        payInput.value=res.normalized;
        negSaveAll(negList);
        negShowModal(item);
        negRefreshAll();
        return;
      }
      const chk=e.target.closest('.neg-parcela-check');
      if(!chk) return;
      const idx=parseInt(chk.getAttribute('data-parcela')||'-1',10);
      if(idx<0) return;
      const negId=negModal?.getAttribute('data-neg-id');
      const item=negFindById(negId);
      if(!item) return;
      if(item.situacao && item.situacao!=='andamento') return;
      const arr=negNormalizeParcelasPagas(item);
      const localIso=getDateISOInGMT3();
      arr[idx]={paga:!!chk.checked, pagoEm:chk.checked ? localIso : ''};
      item.parcelasPagas=arr;
      const parcelas=negGetParcelas(item);
      const pagasCount=parcelas.filter(p=>p.paga).length;
      negSaveAll(negList);
      if(negGetSituacao(item)==='andamento' && parcelas.length && pagasCount===parcelas.length){
        item.situacao='finalizada';
        if(!item.finalizadaEm) item.finalizadaEm=Date.now();
        negSaveAll(negList);
        negHideModal();
      }else{
        negShowModal(item);
      }
      negRefreshAll();
    });
    negModalBody.addEventListener('click',e=>{
      const payBtn=e.target.closest('[data-parcela-pay-edit]');
      if(payBtn){
        e.preventDefault();
        e.stopPropagation();
        const idx=parseInt(payBtn.getAttribute('data-parcela-pay-edit')||'-1',10);
        if(idx<0) return;
        const editWrap=negModalBody.querySelector(`.neg-parcela-pay-edit .neg-parcela-pay-input[data-parcela="${idx}"]`);
        const input=editWrap instanceof HTMLInputElement ? editWrap : null;
        if(input){
          const wrapper=input.closest('.neg-parcela-pay-edit');
          if(wrapper) wrapper.classList.toggle('is-editing');
          input.focus();
          input.select();
        }
        return;
      }
      const compBtn=e.target.closest('[data-neg-compensar]');
      if(compBtn){
        e.preventDefault();
        e.stopPropagation();
        const negId=negModal?.getAttribute('data-neg-id');
        const item=negFindById(negId);
        const idx=parseInt(compBtn.getAttribute('data-neg-compensar')||'-1',10);
        if(item){
          negHideModal();
          negFillCompensacaoFromNeg(item, idx);
        }
        return;
      }
      const btn=e.target.closest('.neg-copiar-cobranca');
      if(!btn) return;
      const negId=negModal?.getAttribute('data-neg-id');
      const item=negFindById(negId);
      if(!item) return;
      const idx=parseInt(btn.getAttribute('data-parcela')||'-1',10);
      const parc=negGetParcelas(item).find(p=>p.idx===idx);
      if(!parc) return;
      const parcelas=negGetParcelas(item);
      const cobraveis=parcelas.filter(p=>!p.paga && negDiffDiasDataBR(p.data)>=0);
      const totalParc=parcelas.length;
      const pagasCount=parcelas.filter(p=>p.paga).length;
      const parcelaCobrada=totalParc===0 ? 0 : (pagasCount>=totalParc ? totalParc : (pagasCount+1));
      let texto='';
      if(cobraveis.length>1){
        texto=negBuildCobrancaTextMulti(cobraveis, totalParc);
      }else{
        const diff=negDiffDiasDataBR(parc.data);
        texto=negBuildCobrancaText(parc,diff,parcelaCobrada,totalParc);
      }
      const copyFn=navigator.clipboard?.writeText;
      const onCopied=()=>{
        btn.classList.add('copied');
        setTimeout(()=>btn.classList.remove('copied'),800);
      };
      if(typeof copyFn==='function'){
        copyFn(texto).then(onCopied).catch(()=>{
          const el=document.createElement('textarea');
          el.value=texto;
          el.style.position='fixed';
          el.style.opacity='0';
          document.body.appendChild(el);
          el.select();
          try{ document.execCommand('copy'); onCopied(); }catch{}
          document.body.removeChild(el);
        });
      }else{
        const el=document.createElement('textarea');
        el.value=texto;
        el.style.position='fixed';
        el.style.opacity='0';
        document.body.appendChild(el);
        el.select();
        try{ document.execCommand('copy'); onCopied(); }catch{}
        document.body.removeChild(el);
      }
    });
  }

  if(negModalClose && negModalClose.dataset.boundNegClose!=='1'){
    negModalClose.dataset.boundNegClose='1';
    negModalClose.addEventListener('click',negHideModal);
  }
  if(negModal.dataset.boundNegOverlay!=='1'){
    negModal.dataset.boundNegOverlay='1';
    negModal.addEventListener('click',e=>{
      const actionBtn=e.target.closest('[data-neg-action]');
      if(actionBtn){
        e.preventDefault();
        const action=actionBtn.getAttribute('data-neg-action');
        const negId=negModal?.getAttribute('data-neg-id');
        const item=negFindById(negId);
        if(!item) return;
        if(action==='delete-modal'){
          if(!confirm('Excluir esta negociação? Esta ação não pode ser desfeita.')) return;
          negRemoveById(negId);
          negSaveAll(negList);
          negHideModal();
          negRefreshAll();
          return;
        }
        if(action==='cancelar'){
          if(!confirm('Cancelar esta negociação?')) return;
          item.situacao='cancelada';
          if(!item.canceladaEm) item.canceladaEm=Date.now();
          negSaveAll(negList);
          negHideModal();
          negRefreshAll();
          return;
        }
        if(action==='finalizar'){
          if(!confirm('Finalizar esta negociação?')) return;
          item.situacao='finalizada';
          if(!item.finalizadaEm) item.finalizadaEm=Date.now();
          negSaveAll(negList);
          negHideModal();
          negRefreshAll();
          return;
        }
        if(action==='reverter-cancelamento'){
          if(!confirm('Reverter cancelamento e retornar para negociações em andamento?')) return;
          item.situacao='andamento';
          item.canceladaEm=null;
          negSaveAll(negList);
          negHideModal();
          negRefreshAll();
          return;
        }
      }
      if(e.target===negModal) negHideModal();
    });
  }
  if(document.body.dataset.boundNegEsc!=='1'){
    document.body.dataset.boundNegEsc='1';
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape') negHideModal();
    });
  }
  if(document.body.dataset.boundNegDocClick!=='1'){
    document.body.dataset.boundNegDocClick='1';
    document.addEventListener('click',e=>{
      if(e.target.closest('#neg-modal')) return;
      const tr=e.target.closest('tr[data-neg-id]');
      if(!tr) return;
      const id=tr.getAttribute('data-neg-id');
      const item=negFindById(id);
      if(item) negShowModal(item);
    });
  }
  if(document.body.dataset.boundNegRefresh!=='1'){
    document.body.dataset.boundNegRefresh='1';
    document.addEventListener('DOMContentLoaded', negRefreshAll);
  }
})();

(function initNegExports(){
  const btnAnd=document.getElementById('neg-andamento-export');
  const btnFin=document.getElementById('neg-finalizadas-export');
  const btnCan=document.getElementById('neg-canceladas-export');
  if(btnAnd){
    btnAnd.addEventListener('click',async()=>{
      const list=negList.filter(n=>negGetSituacao(n)==='andamento');
      const tsv=negBuildExportTsv(list);
      const ok=await negCopyPlainText(tsv);
      alert(ok ? 'Tabela copiada para a área de transferência.' : 'Não foi possível copiar a tabela.');
    });
  }
  if(btnFin){
    btnFin.addEventListener('click',async()=>{
      const list=negList.filter(n=>negGetSituacao(n)==='finalizada');
      const tsv=negBuildExportTsv(list, {
        dateField:'finalizadaEm'
      });
      const ok=await negCopyPlainText(tsv);
      alert(ok ? 'Tabela copiada para a área de transferência.' : 'Não foi possível copiar a tabela.');
    });
  }
  if(btnCan){
    btnCan.addEventListener('click',async()=>{
      const list=negList.filter(n=>negGetSituacao(n)==='cancelada');
      const tsv=negBuildExportTsv(list, {
        extraCols:['PARCELAS PAGAS','/','TOTAL PARCELAS'],
        extraRow:({pagasCount,totalParc})=>[String(pagasCount), '/', String(totalParc)],
        dateField:'canceladaEm'
      });
      const ok=await negCopyPlainText(tsv);
      alert(ok ? 'Tabela copiada para a área de transferência.' : 'Não foi possível copiar a tabela.');
    });
  }
})();

(function initRepresentantes(){
  const page=document.getElementById('page-registro-representantes');
  if(!page) return;
  const slider=document.getElementById('rep-tipo');
  const tvForm=document.getElementById('rep-tv-form');
  const repForm=document.getElementById('rep-rep-form');
  const tvListWrap=document.getElementById('rep-tv-list-wrap');
  const repListWrap=document.getElementById('rep-rep-list-wrap');
  const tvTbody=document.getElementById('rep-tv-tbody');
  const repTbody=document.getElementById('rep-rep-tbody');
  const saveBtn=document.getElementById('rep-salvar');
  const tvId=document.getElementById('rep-tv-id');
  const tvEmail=document.getElementById('rep-tv-email');
  const tvNome=document.getElementById('rep-tv-nome');
  const repNome=document.getElementById('rep-rep-nome');
  const repEstado=document.getElementById('rep-rep-estado');
  const repTelefone=document.getElementById('rep-rep-telefone');
  const repEmail=document.getElementById('rep-rep-email');
  const domain='@pratidonaduzzi.com.br';
  let syncing=false;
  const REP_KEY='cobtool_representantes_v1';
  let repList=[];
  let repCurrentId=null;
  let repCurrentTipo='tv';

  function repLoadAll(){
    try{
      const raw=localStorage.getItem(REP_KEY);
      if(!raw) return [];
      const parsed=JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      if(lowerEmailsInData(parsed)) localStorage.setItem(REP_KEY, JSON.stringify(parsed));
      return parsed;
    }catch{
      return [];
    }
  }
  function repSaveAll(list){
    localStorage.setItem(REP_KEY, JSON.stringify(list||[]));
  }
  function repNormalizeEmail(val){
    return String(val||'').trim().toLowerCase();
  }
  function repGetTipo(){
    return slider?.checked ? 'rep' : 'tv';
  }
  function repClearForm(){
    repCurrentId=null;
    repCurrentTipo=repGetTipo();
    if(tvNome) tvNome.value='';
    if(tvId) tvId.value='';
    if(tvEmail) tvEmail.value='';
    if(repNome) repNome.value='';
    if(repEstado) repEstado.value='';
    if(repTelefone) repTelefone.value='';
    if(repEmail) repEmail.value='';
  }
  function repFillForm(item){
    repCurrentId=item.id;
    repCurrentTipo=item.tipo;
    if(item.tipo==='tv'){
      if(tvNome) tvNome.value=item.nome||'';
      if(tvId) tvId.value=item.idLogin||'';
      if(tvEmail) tvEmail.value=repNormalizeEmail(item.email||'');
    }else{
      if(repNome) repNome.value=item.nome||'';
      if(repEstado) repEstado.value=item.estado||'';
      if(repTelefone) repTelefone.value=item.telefone||'';
      if(repEmail) repEmail.value=repNormalizeEmail(item.email||'');
    }
  }
  function repRenderList(){
    const tvList=repList.filter(r=>r.tipo==='tv');
    const repListFiltered=repList.filter(r=>r.tipo==='rep');
    if(tvTbody){
      if(!tvList.length){
        tvTbody.innerHTML='<tr><td colspan="4" class="text-center text-muted">Nenhum televendedor cadastrado.</td></tr>';
      }else{
        tvTbody.innerHTML=tvList.map(item=>`
          <tr data-rep-id="${item.id}">
            <td>${item.nome||'-'}</td>
            <td data-lowercase="1">${item.idLogin||'-'}</td>
            <td data-lowercase="1">${item.email||'-'}</td>
            <td class="text-center">
              <button class="btn btn-sm cli-btn-icon" type="button" data-rep-action="edit" title="Editar">
                <i class="bi bi-pencil" aria-hidden="true"></i>
              </button>
              <button class="btn btn-sm cli-btn-icon" type="button" data-rep-action="delete" title="Excluir">
                <i class="bi bi-trash" aria-hidden="true"></i>
              </button>
            </td>
          </tr>`).join('');
      }
    }
    if(repTbody){
      if(!repListFiltered.length){
        repTbody.innerHTML='<tr><td colspan="5" class="text-center text-muted">Nenhum representante cadastrado.</td></tr>';
      }else{
        repTbody.innerHTML=repListFiltered.map(item=>`
          <tr data-rep-id="${item.id}">
            <td>${item.nome||'-'}</td>
            <td>${item.estado||'-'}</td>
            <td>${item.telefone||'-'}</td>
            <td data-lowercase="1">${item.email||'-'}</td>
            <td class="text-center">
              <button class="btn btn-sm cli-btn-icon" type="button" data-rep-action="edit" title="Editar">
                <i class="bi bi-pencil" aria-hidden="true"></i>
              </button>
              <button class="btn btn-sm cli-btn-icon" type="button" data-rep-action="delete" title="Excluir">
                <i class="bi bi-trash" aria-hidden="true"></i>
              </button>
            </td>
          </tr>`).join('');
      }
    }
  }
  function repHandleAction(e){
    const btn=e.target.closest('[data-rep-action]');
    if(!btn) return;
    const tr=btn.closest('tr[data-rep-id]');
    const id=tr?.getAttribute('data-rep-id');
    if(!id) return;
    const item=repList.find(r=>String(r.id)===String(id));
    if(!item) return;
    const action=btn.getAttribute('data-rep-action');
    if(action==='edit'){
      repFillForm(item);
      if(item.tipo==='tv'){
        if(slider) slider.checked=false;
      }else{
        if(slider) slider.checked=true;
      }
      updateVisibility();
    }else if(action==='delete'){
      if(!confirm('Excluir este registro?')) return;
      repList=repList.filter(r=>String(r.id)!==String(id));
      repSaveAll(repList);
      repRenderList();
      repClearForm();
    }
  }

  function updateVisibility(){
    const isRep=!!slider?.checked;
    if(tvForm) tvForm.classList.toggle('d-none', isRep);
    if(repForm) repForm.classList.toggle('d-none', !isRep);
    if(tvListWrap) tvListWrap.classList.toggle('d-none', isRep);
    if(repListWrap) repListWrap.classList.toggle('d-none', !isRep);
  }
  function normalizeId(val){
    const raw=String(val||'').trim().toLowerCase();
    if(!raw) return '';
    const base=raw.split('@')[0].trim();
    return base;
  }
  function syncFromId(){
    if(syncing) return;
    syncing=true;
    const idVal=normalizeId(tvId?.value||'');
    if(tvId) tvId.value=idVal;
    if(tvEmail){
      tvEmail.value=idVal ? `${idVal}${domain}` : '';
    }
    syncing=false;
  }
  function syncFromEmail(){
    if(syncing) return;
    syncing=true;
    const emailVal=String(tvEmail?.value||'').trim().toLowerCase();
    const idVal=normalizeId(emailVal);
    if(tvId) tvId.value=idVal;
    if(tvEmail){
      tvEmail.value=idVal ? `${idVal}${domain}` : '';
    }
    syncing=false;
  }

  repList=repLoadAll();
  repRenderList();
  slider?.addEventListener('change',()=>{
    repClearForm();
    updateVisibility();
  });
  tvId?.addEventListener('input',syncFromId);
  tvEmail?.addEventListener('input',syncFromEmail);
  tvTbody?.addEventListener('click',repHandleAction);
  repTbody?.addEventListener('click',repHandleAction);
  saveBtn?.addEventListener('click',()=>{
    const tipo=repGetTipo();
    const now=new Date().toISOString();
    if(tipo==='tv'){
      const nome=String(tvNome?.value||'').trim();
      const idLogin=normalizeId(tvId?.value||'');
      const email=idLogin ? `${idLogin}${domain}` : repNormalizeEmail(tvEmail?.value||'');
      if(!nome || !idLogin){
        alert('Preencha nome e ID.');
        return;
      }
      const payload={
        id:repCurrentId || (Date.now().toString(36)+Math.random().toString(36).slice(2,8)),
        tipo:'tv',
        nome,
        idLogin,
        email,
        criadoEm:repCurrentId ? undefined : now,
        atualizadoEm:now
      };
      const idx=repList.findIndex(r=>String(r.id)===String(payload.id));
      if(idx>=0){
        repList[idx]={...repList[idx], ...payload, criadoEm:repList[idx].criadoEm||now};
      }else{
        repList.push(payload);
      }
    }else{
      const nome=String(repNome?.value||'').trim();
      const estado=String(repEstado?.value||'').trim().toUpperCase();
      const telefone=String(repTelefone?.value||'').trim();
      const email=repNormalizeEmail(repEmail?.value||'');
      if(!nome || !estado || !telefone || !email){
        alert('Preencha nome, estado, telefone e e-mail.');
        return;
      }
      const payload={
        id:repCurrentId || (Date.now().toString(36)+Math.random().toString(36).slice(2,8)),
        tipo:'rep',
        nome,
        estado,
        telefone,
        email,
        criadoEm:repCurrentId ? undefined : now,
        atualizadoEm:now
      };
      const idx=repList.findIndex(r=>String(r.id)===String(payload.id));
      if(idx>=0){
        repList[idx]={...repList[idx], ...payload, criadoEm:repList[idx].criadoEm||now};
      }else{
        repList.push(payload);
      }
    }
    repSaveAll(repList);
    repRenderList();
    repClearForm();
    if(saveBtn){
      saveBtn.classList.add('copied');
      setTimeout(()=>saveBtn.classList.remove('copied'),1000);
    }
  });
  updateVisibility();
})();

(function initEmissaoBoletos(){
  const page=document.getElementById('page-emissao-boletos');
  if(!page) return;
  const typeTv=document.getElementById('bol-type-tv');
  const typeRep=document.getElementById('bol-type-rep');
  const typeCli=document.getElementById('bol-type-cli');
  const tvForm=document.getElementById('bol-tv-form');
  const repForm=document.getElementById('bol-rep-form');
  const cliForm=document.getElementById('bol-cli-form');
  const tvNome=document.getElementById('bol-tv-nome');
  const tvId=document.getElementById('bol-tv-id');
  const tvEmail=document.getElementById('bol-tv-email');
  const repNome=document.getElementById('bol-rep-nome');
  const repEstado=document.getElementById('bol-rep-estado');
  const repTelefone=document.getElementById('bol-rep-telefone');
  const repEmail=document.getElementById('bol-rep-email');
  const cliTelefone=document.getElementById('bol-cli-telefone');
  const tvResults=document.getElementById('bol-tv-results');
  const repResults=document.getElementById('bol-rep-results');
  const tvResultsWrap=document.getElementById('bol-tv-results-wrap');
  const repResultsWrap=document.getElementById('bol-rep-results-wrap');
  const qtdInput=document.getElementById('bol-quantidade');
  const metaInput=document.getElementById('bol-meta');
  const quaisInput=document.getElementById('bol-quais');
  const saveBtn=document.getElementById('bol-salvar');
  const tbody=document.getElementById('bol-tbody');
  const REP_KEY='cobtool_representantes_v1';
  const BOL_KEY='cobtool_emissao_boletos_v1';
  let activeTipo='tv';
  let selected=null;
  let bolList=[];

  function bolLoadAll(){
    try{
      const raw=localStorage.getItem(BOL_KEY);
      if(!raw) return [];
      const parsed=JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }catch{
      return [];
    }
  }
  function bolSaveAll(list){
    localStorage.setItem(BOL_KEY, JSON.stringify(list||[]));
  }
  function bolLoadRepresentantes(){
    try{
      const raw=localStorage.getItem(REP_KEY);
      if(!raw) return [];
      const parsed=JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }catch{
      return [];
    }
  }
  function bolSetTipo(tipo){
    activeTipo=tipo;
    if(typeTv) typeTv.checked=tipo==='tv';
    if(typeRep) typeRep.checked=tipo==='rep';
    if(typeCli) typeCli.checked=tipo==='cli';
    if(tvForm) tvForm.classList.toggle('d-none', tipo!=='tv');
    if(repForm) repForm.classList.toggle('d-none', tipo!=='rep');
    if(cliForm) cliForm.classList.toggle('d-none', tipo!=='cli');
    selected=null;
    renderResults();
  }
  function bolEnsureTipo(e, tipo){
    if(!e.target.checked){
      e.target.checked=true;
      return;
    }
    bolSetTipo(tipo);
  }
  function normalizeVal(val){
    return String(val||'').trim().toLowerCase();
  }
  function filterTele(list){
    const nome=normalizeVal(tvNome?.value);
    const id=normalizeVal(tvId?.value);
    const email=normalizeVal(tvEmail?.value);
    return list.filter(item=>{
      if(nome && !String(item.nome||'').toLowerCase().includes(nome)) return false;
      if(id && !String(item.idLogin||'').toLowerCase().includes(id)) return false;
      if(email && !String(item.email||'').toLowerCase().includes(email)) return false;
      return true;
    });
  }
  function filterRep(list){
    const nome=normalizeVal(repNome?.value);
    const estado=normalizeVal(repEstado?.value);
    const tel=normalizeVal(repTelefone?.value);
    const email=normalizeVal(repEmail?.value);
    return list.filter(item=>{
      if(nome && !String(item.nome||'').toLowerCase().includes(nome)) return false;
      if(estado && !String(item.estado||'').toLowerCase().includes(estado)) return false;
      if(tel && !String(item.telefone||'').toLowerCase().includes(tel)) return false;
      if(email && !String(item.email||'').toLowerCase().includes(email)) return false;
      return true;
    });
  }
  function renderResults(){
    const reps=bolLoadRepresentantes();
    if(activeTipo==='tv' && tvResults){
      const nome=normalizeVal(tvNome?.value);
      const id=normalizeVal(tvId?.value);
      const email=normalizeVal(tvEmail?.value);
      const hasQuery=!!(nome || id || email);
      if(tvResultsWrap) tvResultsWrap.classList.toggle('d-none', !hasQuery);
      if(!hasQuery){
        tvResults.innerHTML='';
        return;
      }
      const list=filterTele(reps.filter(r=>r.tipo==='tv'));
      if(!list.length){
        tvResults.innerHTML='<tr><td colspan="3" class="text-center text-muted">Nenhum resultado.</td></tr>';
        return;
      }
      tvResults.innerHTML=list.map(item=>`
        <tr data-rep-id="${item.id}">
          <td>${escapeHtml(item.nome||'-')}</td>
          <td data-lowercase="1">${escapeHtml(item.idLogin||'-')}</td>
          <td data-lowercase="1">${escapeHtml(item.email||'-')}</td>
        </tr>`).join('');
    }
    if(activeTipo==='rep' && repResults){
      const nome=normalizeVal(repNome?.value);
      const estado=normalizeVal(repEstado?.value);
      const tel=normalizeVal(repTelefone?.value);
      const email=normalizeVal(repEmail?.value);
      const hasQuery=!!(nome || estado || tel || email);
      if(repResultsWrap) repResultsWrap.classList.toggle('d-none', !hasQuery);
      if(!hasQuery){
        repResults.innerHTML='';
        return;
      }
      const list=filterRep(reps.filter(r=>r.tipo==='rep'));
      if(!list.length){
        repResults.innerHTML='<tr><td colspan="4" class="text-center text-muted">Nenhum resultado.</td></tr>';
        return;
      }
      repResults.innerHTML=list.map(item=>`
        <tr data-rep-id="${item.id}">
          <td>${escapeHtml(item.nome||'-')}</td>
          <td>${escapeHtml(item.estado||'-')}</td>
          <td>${escapeHtml(item.telefone||'-')}</td>
          <td data-lowercase="1">${escapeHtml(item.email||'-')}</td>
        </tr>`).join('');
    }
  }
  function selectItem(item){
    selected=item;
    if(!item) return;
    if(item.tipo==='tv'){
      if(tvNome) tvNome.value=item.nome||'';
      if(tvId) tvId.value=item.idLogin||'';
      if(tvEmail) tvEmail.value=item.email||'';
    }else{
      if(repNome) repNome.value=item.nome||'';
      if(repEstado) repEstado.value=item.estado||'';
      if(repTelefone) repTelefone.value=item.telefone||'';
      if(repEmail) repEmail.value=item.email||'';
    }
  }
  function handleResultsClick(e){
    const tr=e.target.closest('tr[data-rep-id]');
    if(!tr) return;
    const id=tr.getAttribute('data-rep-id');
    const reps=bolLoadRepresentantes();
    const item=reps.find(r=>String(r.id)===String(id));
    if(item) selectItem(item);
  }
  function clearSelectionOnInput(){
    selected=null;
    renderResults();
  }
  function bolRenderList(){
    if(!tbody) return;
    if(!bolList.length){
      tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted">Nenhuma solicitação registrada.</td></tr>';
      return;
    }
    tbody.innerHTML=bolList.map(item=>{
      const data=formatBRDateFromISO(item.createdAt) || '';
      const tipoLabel=item.tipo==='tv' ? 'TELE VENDEDOR(A)' : (item.tipo==='rep' ? 'REPRESENTANTE EXTERNO' : 'CLIENTE');
      const solicitante=item.nome ? String(item.nome) : '-';
      const boletos=String(item.quantidade||0);
      return `
        <tr data-bol-id="${item.id}">
          <td>${escapeHtml(solicitante)}</td>
          <td>${tipoLabel}</td>
          <td>${escapeHtml(boletos)}</td>
          <td>${escapeHtml(String(item.meta||0))}</td>
          <td>${escapeHtml(data||'-')}</td>
          <td class="text-center">
            <button class="btn btn-sm cli-btn-icon" type="button" data-bol-action="delete" title="Excluir">
              <i class="bi bi-trash" aria-hidden="true"></i>
            </button>
          </td>
        </tr>`;
    }).join('');
  }

  typeTv?.addEventListener('change',e=>bolEnsureTipo(e,'tv'));
  typeRep?.addEventListener('change',e=>bolEnsureTipo(e,'rep'));
  typeCli?.addEventListener('change',e=>bolEnsureTipo(e,'cli'));

  tvNome?.addEventListener('input',clearSelectionOnInput);
  tvId?.addEventListener('input',clearSelectionOnInput);
  tvEmail?.addEventListener('input',clearSelectionOnInput);
  repNome?.addEventListener('input',clearSelectionOnInput);
  repEstado?.addEventListener('input',clearSelectionOnInput);
  repTelefone?.addEventListener('input',e=>{
    maskPhoneInput(e);
    clearSelectionOnInput();
  });
  repEmail?.addEventListener('input',clearSelectionOnInput);
  cliTelefone?.addEventListener('input',maskPhoneInput);

  tvResults?.addEventListener('click',handleResultsClick);
  repResults?.addEventListener('click',handleResultsClick);
  tbody?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-bol-action]');
    if(!btn) return;
    const tr=e.target.closest('tr[data-bol-id]');
    const id=tr?.getAttribute('data-bol-id');
    if(!id) return;
    if(!confirm('Excluir esta solicitação?')) return;
    bolList=bolList.filter(it=>String(it.id)!==String(id));
    bolSaveAll(bolList);
    bolRenderList();
  });

  saveBtn?.addEventListener('click',()=>{
    const quantidade=parseInt(qtdInput?.value||'0',10)||0;
    const meta=parseInt(metaInput?.value||'0',10)||0;
    const quais=String(quaisInput?.value||'').trim();
    if(!quantidade || !quais){
      alert('Preencha quantos boletos e quais foram solicitados.');
      return;
    }
    const now=new Date().toISOString();
    if(activeTipo==='tv' || activeTipo==='rep'){
      if(!selected){
        alert('Selecione um solicitante na lista.');
        return;
      }
    }else{
      const tel=String(cliTelefone?.value||'').trim();
      if(!tel){
        alert('Informe o telefone do cliente.');
        return;
      }
    }
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    const payload={
      id,
      tipo:activeTipo,
      nome:activeTipo!=='cli' ? (selected?.nome||'') : '',
      idLogin:activeTipo==='tv' ? (selected?.idLogin||'') : '',
      email:activeTipo!=='cli' ? (selected?.email||'') : '',
      telefone:activeTipo==='rep' ? (selected?.telefone||'') : (activeTipo==='cli' ? String(cliTelefone?.value||'').trim() : ''),
      estado:activeTipo==='rep' ? (selected?.estado||'') : '',
      quantidade,
      meta,
      quais,
      createdAt:now
    };
    bolList.push(payload);
    bolSaveAll(bolList);
    bolRenderList();
    if(qtdInput) qtdInput.value='';
    if(metaInput) metaInput.value='';
    if(quaisInput) quaisInput.value='';
    if(tvNome) tvNome.value='';
    if(tvId) tvId.value='';
    if(tvEmail) tvEmail.value='';
    if(repNome) repNome.value='';
    if(repEstado) repEstado.value='';
    if(repTelefone) repTelefone.value='';
    if(repEmail) repEmail.value='';
    if(cliTelefone) cliTelefone.value='';
    selected=null;
    if(saveBtn){
      saveBtn.classList.add('copied');
      setTimeout(()=>saveBtn.classList.remove('copied'),1000);
    }
  });

  bolList=bolLoadAll();
  bolRenderList();
  bolSetTipo('tv');
})();

(function initRegistroContato(){
  const page=document.getElementById('page-registro-contato');
  if(!page) return;
  const messageEl=document.getElementById('rc-message');
  const clockEl=document.getElementById('rc-clock');
  const resumo=document.getElementById('rc-resumo');
  const ultimos=document.getElementById('rc-ultimos');
  const historico=document.getElementById('rc-historico');
  const btnGerar=document.getElementById('rc-gerar-historico');
  const btnCopiar=document.getElementById('rc-copiar-historico');
  const greetTime=document.getElementById('rc-greet-time');
  const greetId=document.getElementById('rc-greet-id');
  const waiting=document.getElementById('rc-waiting');
  const KEY='cobtool_registro_contato_v1';
  let lastRandom='';

  function rcGetGreeting(){
    const isTarde=!!greetTime?.checked;
    const withId=!!greetId?.checked;
    const base=isTarde ? '*Boa tarde*, tudo bem?' : '*Bom dia*, tudo bem?';
    if(!withId) return base;
    return `${base} Meu nome é *Rafael*, faço parte do setor *financeiro* da *Prati-Donaduzzi*.`;
  }
  function rcBuildMessage(text){
    const greet=rcGetGreeting();
    const tail=String(text||'').trim();
    return tail ? `${greet} ${tail}` : greet;
  }
  function rcFormatWhatsApp(text){
    let safe=escapeHtml(text||'');
    safe=safe.replace(/\r\n|\r|\n/g,'<br>');
    safe=safe.replace(/\*(.+?)\*/g,'<strong>$1</strong>');
    safe=safe.replace(/_(.+?)_/g,'<em>$1</em>');
    safe=safe.replace(/~(.+?)~/g,'<s>$1</s>');
    safe=safe.replace(/`(.+?)`/g,'<code>$1</code>');
    return safe;
  }
  function setMessage(text){
    if(!messageEl) return;
    messageEl.innerHTML=rcFormatWhatsApp(text||'');
    messageEl.classList.toggle('empty', !text);
    if(clockEl) clockEl.textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  }
  function loadState(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw) return {};
      return JSON.parse(raw)||{};
    }catch{
      return {};
    }
  }
  function saveState(state){
    localStorage.setItem(KEY, JSON.stringify(state||{}));
  }
  function buildHistory(){
    const resumoVal=String(resumo?.value||'').trim();
    const baseVal=String(ultimos?.value||'').trim();
    const sep='----------------------------------------------------------------------------------------------------------------';
    const dateStr=negFormatDateBR(new Date());
    const tail=waiting?.checked ? ' — Aguardando retorno' : '';
    const entry=`${dateStr}: ${resumoVal}${tail};`;
    if(!baseVal){
      return `${entry}\n${sep}`;
    }
    const hasToday=new RegExp(`^${dateStr.replace(/\//g,'\\/')}:`,'m').test(baseVal);
    let base=baseVal.replace(/\s+$/,'');
    const endsWithSep=base.endsWith(sep);
    if(hasToday){
      if(endsWithSep){
        base=base.slice(0,-sep.length).replace(/\s+$/,'');
        return `${base}\n${entry}\n${sep}`;
      }
      return `${base}\n${entry}`;
    }
    if(endsWithSep){
      return `${base}\n${entry}\n${sep}`;
    }
    return `${base}\n${sep}\n${entry}\n${sep}`;
  }

  page.querySelectorAll('[data-rc-msg]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      let text=btn.getAttribute('data-rc-msg')||'';
      if(btn.hasAttribute('data-rc-random')){
        const options=[
          'Falo com o *responsável* pelo *CNPJ `#`*?',
          'Gostaria de falar com o *responsável* pelo *CNPJ `#`*, seria possível?',
          'O *responsável* pelo *CNPJ `#`* se encontra?'
        ];
        if(options.length===1){
          text=options[0];
        }else{
          let next=text;
          do{
            next=options[Math.floor(Math.random()*options.length)];
          }while(next===lastRandom);
          text=next;
        }
        lastRandom=text;
      }
      const full=rcBuildMessage(text);
      setMessage(full);
      const ok=negCopyPlainText(full);
      if(ok && btn){
        btn.classList.add('copied');
        setTimeout(()=>btn.classList.remove('copied'),900);
      }
    });
  });

  btnGerar?.addEventListener('click',()=>{
    const resumoVal=String(resumo?.value||'').trim();
    if(!resumoVal){
      alert('Preencha o resumo do contato.');
      return;
    }
    const text=buildHistory();
    if(historico) historico.value=text;
    saveState({ultimos:ultimos?.value||'', historico:text});
    if(btnGerar){
      btnGerar.classList.add('copied');
      setTimeout(()=>btnGerar.classList.remove('copied'),900);
    }
  });

  btnCopiar?.addEventListener('click',()=>{
    const text=String(historico?.value||'').trim();
    const ok=negCopyPlainText(text);
    if(ok && btnCopiar){
      btnCopiar.classList.add('copied');
      setTimeout(()=>btnCopiar.classList.remove('copied'),900);
    }
  });

  if(ultimos){
    ultimos.addEventListener('input',()=>{
      saveState({ultimos:ultimos.value||'', historico:historico?.value||''});
    });
  }

  const state=loadState();
  if(ultimos && state.ultimos) ultimos.value=state.ultimos;
  if(historico && state.historico) historico.value=state.historico;
})();

(function initEmailLowercase(){
  if(document.body?.dataset.boundEmailLowercase) return;
  document.body.dataset.boundEmailLowercase='1';
  function forceLowercase(input){
    const val=input.value || '';
    const lower=val.toLowerCase();
    if(val===lower) return;
    const start=input.selectionStart;
    const end=input.selectionEnd;
    input.value=lower;
    if(start!==null && end!==null){
      const delta=lower.length - val.length;
      input.setSelectionRange(start + delta, end + delta);
    }
  }
  document.querySelectorAll('input[type="email"], input[id$="email"]').forEach(el=>{
    if(el instanceof HTMLInputElement) forceLowercase(el);
  });
  document.addEventListener('input',e=>{
    const el=e.target;
    if(!(el instanceof HTMLInputElement)) return;
    if(!el.matches('input[type="email"], input[id$="email"]')) return;
    forceLowercase(el);
  });
  document.addEventListener('blur',e=>{
    const el=e.target;
    if(!(el instanceof HTMLInputElement)) return;
    if(!el.matches('input[type="email"], input[id$="email"]')) return;
    forceLowercase(el);
  }, true);
})();

(function initEmailTextLowercase(){
  if(document.body?.dataset.boundEmailTextLowercase) return;
  document.body.dataset.boundEmailTextLowercase='1';
  function markEmailParent(node){
    const el=node.parentElement;
    if(!el) return;
    if(el.dataset?.lowercase==='1') return;
    el.dataset.lowercase='1';
  }
  function lowerTextEmails(root){
    if(!root) return;
    const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node=walker.nextNode();
    while(node){
      const val=node.nodeValue;
      if(val && val.includes('@')){
        const lower=val.toLowerCase();
        if(lower!==val) node.nodeValue=lower;
        markEmailParent(node);
      }
      node=walker.nextNode();
    }
  }
  lowerTextEmails(document.body);
  let pending=false;
  const observer=new MutationObserver(muts=>{
    if(pending) return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      muts.forEach(m=>{
        m.addedNodes?.forEach(n=>{
          if(n.nodeType===Node.TEXT_NODE){
            const val=n.nodeValue;
            if(val && val.includes('@')){
              const lower=val.toLowerCase();
              if(lower!==val) n.nodeValue=lower;
              markEmailParent(n);
            }
          }else if(n.nodeType===Node.ELEMENT_NODE){
            lowerTextEmails(n);
          }
        });
      });
    });
  });
  observer.observe(document.body, {childList:true, subtree:true});
})();

/* ===== INIT PIX ===== */
(function initPix(){
  const tbody=document.getElementById('pix-tbody');
  if(tbody){
    tbody.addEventListener('change',e=>{
      if(e.target.matches('input[type="file"]')){
        pixHandleFileChange(e);
        pixSaveState();
      }
      if(e.target.matches('input[type="checkbox"]')){
        pixSaveState();
      }
    });
  }
  document.getElementById('pix-exportar')?.addEventListener('click',()=>{
    pixExportAll();
  });
  // Restaura tabela a partir do localStorage (estado editável)
  const saved=pixLoadState();
  if(saved?.length){
    pixRenderState(saved);
  }
  pixHydrateRowsFromDb();
  document.querySelector('#pix-tbody')?.addEventListener('click',e=>{
    const tr=e.target.closest('tr');
    if(!tr) return;
    if(e.target.closest('.pix-save')){
      pixSaveFromRow(tr);
    }else if(e.target.closest('.pix-view')){
      pixViewSaved(tr);
    }else if(e.target.closest('.pix-resend')){
      pixResetRow(tr);
    }
    if(e.target.closest('.pix-save')||e.target.closest('.pix-view')||e.target.closest('.pix-resend')){
      pixSaveState();
    }
  });
  const inlineBtn=document.getElementById('pix-inline-add');
  if(inlineBtn){
    inlineBtn.addEventListener('click',e=>{
      e.preventDefault();
      pixInlineAdd();
    });
  }
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#pix-inline-add');
    if(btn){
      e.preventDefault();
      pixInlineAdd();
    }
  });
  document.getElementById('pix-inline-valor')?.addEventListener('input',pixFormatValorLiveInline);
})();

/* ===== INIT IMPORT/EXPORT ===== */
(function initImpExp(){
  const btnExport=document.getElementById('imp-exp-exportar');
  const btnImport=document.getElementById('imp-exp-importar-btn');
  const fileInput=document.getElementById('imp-exp-importar');
  const pixModalClose=document.getElementById('pix-modal-close');
  const pixModal=document.getElementById('pix-modal');
  if(btnExport){
    btnExport.addEventListener('click',async()=>{
      const oldHtml=btnExport.innerHTML;
      btnExport.disabled=true;
      try{
        btnExport.innerHTML=`<i class="bi bi-hourglass-split" aria-hidden="true"></i><span>GERANDO BACKUP...</span>`;
        await exportUnified();
      }catch(err){
        console.error(err);
        alert('Falha ao exportar arquivo.');
      }finally{
        btnExport.disabled=false;
        btnExport.innerHTML=oldHtml;
      }
    });
  }
  if(btnImport && fileInput){
    btnImport.addEventListener('click',async()=>{
      const file=fileInput.files?.[0];
      if(!file){
        fileInput.click();
        return;
      }
      try{
        await importUnified(file);
      }catch(err){
        console.error(err);
        alert('Falha ao importar arquivo.');
      }
    });
  }
  if(pixModalClose) pixModalClose.addEventListener('click',pixHideModal);
  if(pixModal){
    pixModal.addEventListener('click',e=>{
      if(e.target===pixModal) pixHideModal();
    });
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      pixHideModal();
    }
  });
})();
async function pixHydrateRowsFromDb(){
  const stored=await pixGetAll();
  const latest=new Map();
  stored.forEach(item=>{
    const key=`${item.codigo}|${item.valor}`;
    const prev=latest.get(key);
    if(!prev || (prev.storedAt||'')<(item.storedAt||'')){
      latest.set(key,item);
    }
  });
  const rows=[...document.querySelectorAll('#pix-tbody tr')];
  rows.forEach(tr=>{
    const {codigo,valor}=pixGetRowData(tr);
    const key=`${codigo}|${valor}`;
    const match=latest.get(key);
    if(match){
      pixSetSavedState(tr,{id:match.id, filename:match.filename});
    }else{
      pixSetSavedState(tr,null);
    }
  });
}
function trDeleteById(id){
  if(!id) return;
  const idStr=String(id);
  const stored=trLoadAll();
  const next=(stored||[]).filter(x=>String(x.id)!==idStr);
  trList=next;
  trSaveAll(trList);
  if(typeof window.__cobtoolTransferenciasRefresh==='function'){
    window.__cobtoolTransferenciasRefresh();
    return;
  }
  try{
    const esc=(window.CSS && typeof CSS.escape==='function')
      ? CSS.escape(idStr)
      : idStr.replace(/"/g,'\\"');
    const row=document.querySelector(`#tr-body tr[data-id="${esc}"]`);
    if(row) row.remove();
    const tbody=document.getElementById('tr-body');
    if(tbody && !tbody.querySelector('tr[data-id]')){
      tbody.innerHTML='<tr><td colspan="4" class="text-center text-muted">Nenhuma transferência cadastrada.</td></tr>';
    }
  }catch(e){}
}
function trEnsureEmptyState(){
  const tbody=document.getElementById('tr-body');
  if(!tbody) return;
  const hasRow=tbody.querySelector('tr[data-tr-id]');
  if(!hasRow){
    tbody.innerHTML='<tr><td colspan="4" class="text-center text-muted">Nenhuma transferência cadastrada.</td></tr>';
  }
}
function trCloseModalIfOpenForId(id){
  if(trModal?.classList.contains('open')){
    const openId=trModal?.getAttribute('data-tr-id');
    if(String(openId)===String(id)) trHideModal();
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const urlPage=new URLSearchParams(window.location.search).get('page');
  const requested=(urlPage && pages.includes(urlPage)) ? urlPage : '';
  const last=requested || localStorage.getItem('ch_last_page');
  const pageId=last ? (pageIds[last]||last) : null;
  const valid=last && document.getElementById(`page-${pageId}`);
  if(valid){
    setPage(last);
    clearPageFields(last);
  }else{
    setPage('home');
    localStorage.setItem('ch_last_page','home');
  }
});

