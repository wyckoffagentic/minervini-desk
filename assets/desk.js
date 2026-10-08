/* desk.js - shared behaviour for every dashboard page (research-tools/unify.py links it on every page). No dependencies.
   - nav: centre the active pill
   - header search: ticker autocomplete (lazy-loads data/tickers.json on first focus) -> stock.html?t=
   - watchlists: one localStorage store (window.DKWL, key wa.desk.watchlists.v1) + the "+ watchlist" popover for any [data-wl] button;
     "+" buttons on chart pages (actions bar) and Top Movers rows
   - ?embed=1 / ?mini=1: chart-only embeds (tc-embed / tc-mini classes)
   - VSA page: opening a "story" dropdown lazy-loads that stock's chart inline (stock.html?embed=1&mini=1 in an iframe; removed on close)
   Lists live on this device / browser only (localStorage). Research, not advice. */
(function(){
'use strict';
var D=document,B=D.body,LS_KEY='wa.desk.watchlists.v1';
var me=D.currentScript||D.querySelector('script[src*="assets/desk.js"]');
var BASE=me&&me.src?me.src.replace(/assets\/desk\.js.*$/,''):'';
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function el(tag,cls,html){var e=D.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
var Q=new URLSearchParams(location.search);
if(Q.get('embed')==='1')B.classList.add('tc-embed');
if(Q.get('mini')==='1')B.classList.add('tc-mini');

// ------------------------------------------------------------------ nav: centre the active pill
var nav=D.querySelector('.dk-nav'),on=nav&&nav.querySelector('a.on');
if(nav&&on&&nav.scrollWidth>nav.clientWidth){nav.scrollLeft=on.offsetLeft-nav.clientWidth/2+on.offsetWidth/2;}

// ------------------------------------------------------------------ ticker index (shared by search + watchlists page)
var TK=null,TKP=null;
function tickers(){if(TK)return Promise.resolve(TK);if(!TKP)TKP=fetch(BASE+'data/tickers.json').then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(j){TK=j.rows||j;return TK;}).catch(function(){TKP=null;return [];});return TKP;}
function match(q,n){q=q.trim().toUpperCase();if(!q||!TK)return [];var a=[],b=[],c=[];
  for(var i=0;i<TK.length&&a.length<n;i++){var r=TK[i],t=r[0];if(t===q)a.unshift(r);else if(t.indexOf(q)===0)a.push(r);
    else if(q.length>=2&&b.length<n&&(' '+String(r[1]||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ')).indexOf(' '+q)>=0)b.push(r);}   // name: word start
  return a.concat(b,c).slice(0,n);}
// attach an autocomplete list to an <input>; onPick(ticker)
function autocomplete(inp,box,onPick){
  var ul=el('ul','dk-ac');ul.hidden=true;ul.setAttribute('role','listbox');box.appendChild(ul);var cur=-1,rows=[];
  function draw(){rows=match(inp.value,8);cur=rows.length?0:-1;
    ul.innerHTML=rows.map(function(r,i){return '<li role="option" data-t="'+esc(r[0])+'"'+(i===cur?' class="on"':'')+'><b>'+esc(r[0])+'</b><span>'+esc(r[1]||'')+'</span></li>';}).join('');
    ul.hidden=!rows.length;}
  inp.addEventListener('focus',function(){tickers().then(function(){if(inp.value)draw();});},{once:false});
  inp.addEventListener('input',function(){tickers().then(draw);});
  inp.addEventListener('keydown',function(e){if(ul.hidden)return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();cur=(cur+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;
      [].forEach.call(ul.children,function(li,i){li.classList.toggle('on',i===cur);});}
    else if(e.key==='Enter'&&cur>=0&&rows[cur]&&inp.value.trim().toUpperCase()!==rows[cur][0]){e.preventDefault();ul.hidden=true;onPick(rows[cur][0]);}
    else if(e.key==='Escape'){ul.hidden=true;}});
  ul.addEventListener('mousedown',function(e){e.preventDefault();});
  ul.addEventListener('click',function(e){var li=e.target.closest('li[data-t]');if(li){ul.hidden=true;onPick(li.getAttribute('data-t'));}});
  inp.addEventListener('blur',function(){setTimeout(function(){ul.hidden=true;},150);});
  return ul;}
var find=D.querySelector('.dk-find');
if(find){var fi=find.querySelector('input');
  autocomplete(fi,find,function(t){location.href=BASE+'stock.html?t='+encodeURIComponent(t);});
  find.addEventListener('submit',function(e){var v=fi.value.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g,'');if(!v){e.preventDefault();fi.focus();return;}fi.value=v;});}

// ------------------------------------------------------------------ watchlist store
var WL={
  read:function(){try{var j=JSON.parse(localStorage.getItem(LS_KEY)||'null');if(j&&Array.isArray(j.lists))return j;}catch(e){}return {v:1,lists:[]};},
  write:function(s){s.v=1;s.updated=new Date().toISOString();try{localStorage.setItem(LS_KEY,JSON.stringify(s));}catch(e){toast('Could not save: browser storage is full or blocked (private mode?)');return false;}
    try{window.dispatchEvent(new CustomEvent('dkwl'));}catch(e){}return true;},
  id:function(){return 'l'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);},
  clean:function(t){return String(t||'').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,10);},
  create:function(name,tks){var s=WL.read(),l={id:WL.id(),name:String(name||'My Watchlist').slice(0,60),tickers:(tks||[]).map(WL.clean).filter(Boolean),created:new Date().toISOString().slice(0,10)};s.lists.push(l);WL.write(s);return l;},
  has:function(t){t=WL.clean(t);return WL.read().lists.some(function(l){return l.tickers.indexOf(t)>=0;});},
  toggle:function(id,t,want){t=WL.clean(t);var s=WL.read(),l=s.lists.filter(function(x){return x.id===id;})[0];if(!l||!t)return;
    var i=l.tickers.indexOf(t);if(want===undefined)want=i<0;if(want&&i<0)l.tickers.push(t);if(!want&&i>=0)l.tickers.splice(i,1);WL.write(s);},
  key:LS_KEY,tickers:tickers,match:match,autocomplete:autocomplete,base:BASE,esc:esc,toast:function(m){toast(m);}
};
window.DKWL=WL;
window.addEventListener('storage',function(e){if(e.key===LS_KEY){try{window.dispatchEvent(new CustomEvent('dkwl'));}catch(x){}}});
function toast(m){var t=el('div','dk-toast');t.textContent=m;B.appendChild(t);setTimeout(function(){t.remove();},2200);}
function markBtns(){D.querySelectorAll('[data-wl]').forEach(function(b){var i=WL.has(b.getAttribute('data-wl'));b.classList.toggle('in',i);
  if(b.classList.contains('dk-wlb'))b.textContent=i?'★':'＋';else if(b.classList.contains('dk-wlb-big'))b.textContent=i?'★ On a list':'＋ Watchlist';});}
window.addEventListener('dkwl',markBtns);

// popover
var pop=null;
function closePop(){if(pop){pop.remove();pop=null;D.removeEventListener('mousedown',outside,true);}}
function outside(e){if(pop&&!pop.contains(e.target)&&!e.target.closest('[data-wl]'))closePop();}
function openPop(btn){
  closePop();var t=WL.clean(btn.getAttribute('data-wl'));if(!t)return;
  pop=el('div','dk-pop');pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Add '+t+' to a watchlist');
  function draw(){var s=WL.read();
    pop.innerHTML='<h5>ADD '+esc(t)+' TO…</h5>'+(s.lists.length?s.lists.map(function(l){return '<label><input type="checkbox" data-id="'+esc(l.id)+'"'+(l.tickers.indexOf(t)>=0?' checked':'')+'> '+esc(l.name)+'<small>'+l.tickers.length+'</small></label>';}).join(''):'<p class="mut" style="margin:4px 0">No lists yet: name your first one.</p>')+
      '<div class="np"><input class="dk-in" maxlength="60" placeholder="'+(s.lists.length?'New list name':'e.g. AI Infrastructure')+'" aria-label="New list name"><button type="button" class="dk-btn sm" data-new>Create</button></div>'+
      '<div class="ft"><a href="'+BASE+'watchlists.html">Manage lists →</a><button type="button" class="dk-btn ghost sm" data-x>Done</button></div>';}
  draw();B.appendChild(pop);
  var r=btn.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
  var x=Math.max(10,Math.min(r.left,innerWidth-w-10)),y=r.bottom+6;if(y+h>innerHeight-10)y=Math.max(10,r.top-h-6);
  pop.style.left=x+'px';pop.style.top=y+'px';
  pop.addEventListener('change',function(e){var c=e.target.closest('input[type=checkbox]');if(c){WL.toggle(c.getAttribute('data-id'),t,c.checked);toast((c.checked?'Added ':'Removed ')+t+(c.checked?' to ':' from ')+c.parentNode.textContent.replace(/\d+$/,'').trim());draw();}});
  function mk(){var i=pop.querySelector('.dk-in'),n=i.value.trim();if(!n){i.focus();return;}WL.create(n,[t]);toast('Created “'+n+'” with '+t);draw();}
  pop.addEventListener('click',function(e){if(e.target.closest('[data-new]'))mk();else if(e.target.closest('[data-x]'))closePop();});
  pop.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.classList.contains('dk-in')){e.preventDefault();mk();}if(e.key==='Escape')closePop();});
  setTimeout(function(){D.addEventListener('mousedown',outside,true);},0);
}
D.addEventListener('click',function(e){var b=e.target.closest('[data-wl]');if(!b)return;e.preventDefault();e.stopPropagation();if(pop&&pop._b===b){closePop();return;}openPop(b);if(pop)pop._b=b;},true);
window.addEventListener('scroll',function(){if(pop&&!pop.contains(D.activeElement))closePop();},{passive:true});

// chart pages: actions bar (+ watchlist, stock page)
var TCD=window.TC_DATA;
if(B.classList.contains('tc-arcade')&&!B.classList.contains('dk-stock')&&TCD&&TCD.ticker&&!B.classList.contains('tc-embed')){
  var tk=WL.clean(TCD.ticker),bar=el('div','dk-actions','<button type="button" class="dk-btn dk-wlb-big" data-wl="'+esc(tk)+'">＋ Watchlist</button><a class="dk-btn ghost" href="'+BASE+'stock.html?t='+encodeURIComponent(tk)+'">📄 Stock page: earnings, estimates, filings</a>');
  var after=D.querySelector('.dk-nav');if(after&&after.parentNode)after.parentNode.insertBefore(bar,after.nextSibling);}
// Top Movers rows: "+" next to each ticker; plain tickers link to the stock page
var ml=D.getElementById('list');
if(ml&&B.classList.contains('tmv')){
  var deco=function(){ml.querySelectorAll('li.row[data-tk]').forEach(function(li){var t=li.getAttribute('data-tk'),tkd=li.querySelector('.tk');if(!tkd)return;
    var b=tkd.querySelector('.dk-wlb');if(b&&b.getAttribute('data-wl')===t)return;if(b)b.remove();
    var sp=tkd.querySelector('span.t');if(sp){var a=el('a','t');a.href=BASE+'stock.html?t='+encodeURIComponent(t);a.textContent=sp.textContent;sp.replaceWith(a);}
    var first=tkd.querySelector('a,span.t');b=el('button','dk-wlb');b.type='button';b.setAttribute('data-wl',t);b.setAttribute('aria-label','Add '+t+' to a watchlist');
    if(first&&first.nextSibling)tkd.insertBefore(b,first.nextSibling);else tkd.appendChild(b);});markBtns();};
  new MutationObserver(function(){deco();}).observe(ml,{childList:true});deco();}
markBtns();

// ------------------------------------------------------------------ expandable ticker rows: tap a row (or its ▸) -> our chart inline
// Every per-ticker row on the dashboard (tables with data-tk / td.tkc / ticker links, Top Movers, My Lists, report / weekend rows,
// insider signal cards) gets a toggle. Opening lazy-loads stock.html?t=T&embed=1&mini=1&ov=<context> in an iframe under the row
// (chart page TC_DATA or data/chart/T.json; the page's overlays: VSA signs / spring markers / EMA / setup levels + pattern drawings);
// closing removes it. At most 2 charts open at once (phone memory); sorting / filtering / re-rendering a list closes them.
var PAGE=(location.pathname.split('/').pop()||'index.html').toLowerCase();
var XP_ON=!B.classList.contains('tc-embed')&&!B.classList.contains('tc-arcade')&&!/^(stock|lenses)\.html$/.test(PAGE);
var TKRE=/^[A-Z][A-Z0-9]{0,5}(?:[.\-][A-Z0-9]{1,3})?$/,OPEN=[];
var PMODE={'vsa.html':'vsa','springs_track.html':'spring','ma_stack.html':'mastack','wyckoff_structure.html':'wyckoff','squeeze.html':'setup'}[PAGE]||'';   // wyckoff_structure.html: range box + Wyckoff events + C&E, no MAs (stock.js ov=wyckoff)   // ma_stack.html: EMA 10/20/50 + GUD levels (stock.js ov=mastack)
function headingText(el){var n=el;for(var d=0;n&&n!==B&&d<14;d++){var p=n.previousElementSibling,h=0;
  while(p&&h<60){if(/^H[1-4]$/.test(p.tagName)||(p.classList&&(p.classList.contains('sec-title')||p.classList.contains('bigsec'))))return p.textContent;
    if(p.querySelectorAll){var qs=p.querySelectorAll('h2,h3,h4,.sec-title,.bigsec');if(qs.length)return qs[qs.length-1].textContent;}p=p.previousElementSibling;h++;}
  n=n.parentElement;}return '';}
function modeFor(row){if(PMODE)return PMODE;
  var ty=((row.getAttribute('data-ty')||'')+' '+(row.closest('table')&&row.closest('table').id||'')).toLowerCase();
  if(/spring/.test(ty))return 'spring';if(/ema|epb/.test(ty))return 'ema';
  if(row.querySelector('details.vsan')&&PAGE!=='setups.html')return 'vsa';
  var h=headingText(row).toLowerCase();
  if(/\bvsa\b|volume spread/.test(h))return 'vsa';if(/spring/.test(h))return 'spring';if(/\bema\b|pullback/.test(h))return 'ema';
  if(PAGE==='setups.html'||/setup|vcp|sepa|power play|flat base|tight flag|trigger|pivot|breakout/.test(h))return 'setup';
  return 'desk';}
function fromHref(a){var h=a&&a.getAttribute('href')||'',m=h.match(/(?:charts|tickers)\/([A-Za-z0-9.\-]{1,10})\.html|stock\.html\?t=([A-Za-z0-9.\-]{1,10})|^#([A-Z0-9.\-]{1,10})$/);return m?(m[1]||m[2]||m[3]).toUpperCase():'';}
function firstTok(el){return ((el&&el.textContent)||'').trim().split(/[\s(·,:]+/)[0].toUpperCase();}
var UNI=null;   // ticker set for rows that need validation (plain <b>TICKER</b> cells on weekend / email-style pages)
function rowInfo(r,strict){   // -> [ticker, cell to hold the ▸] or null
  if(r.closest('thead,.dk-vrow,.dk-head,.dk-nav,.dk-ac,.dk-pop,.dk-vchart,.tc-stage'))return null;
  var t=r.getAttribute('data-tk')||r.getAttribute('data-t')||'',c=null;
  var tkc=r.querySelector(':scope>td.tkc,:scope>.tk,:scope>td.tk');
  if(tkc){c=tkc;if(!t){var a=tkc.querySelector('a');t=fromHref(a)||firstTok(tkc.querySelector('b,a')||tkc);}}
  if(r.tagName==='TR'&&r.querySelector('table'))return null;   // layout rows wrapping whole tables (email-style pages)
  if(!t&&r.tagName==='TR'){var f=r.querySelector(':scope>td');var a2=f&&f.querySelector('a[href*="charts/"],a[href*="tickers/"],a[href*="stock.html?t="]');if(a2){t=fromHref(a2);c=f;}}
  if(!t&&r.classList.contains('sig')){var k=r.querySelector('.tkb');if(k){t=firstTok(k);c=k;}}
  if(!t&&strict&&UNI){var fc=r.tagName==='TR'?r.querySelector(':scope>td'):r,b=fc&&fc.firstElementChild;
    if(b&&b.tagName==='B'&&(r.tagName==='LI'||fc.textContent.trim().length<=12)){var x=b.textContent.trim();if(UNI[x]){t=x;c=r.tagName==='TR'?fc:b;}}}
  t=String(t||'').toUpperCase();if(!TKRE.test(t))return null;
  if(!c){var cells=r.querySelectorAll(':scope>td');for(var i=0;i<cells.length&&!c;i++){if(firstTok(cells[i])===t)c=cells[i];}c=c||cells[0]||r;}
  return [t,c];}
function decorate(r,info){if(r.hasAttribute('data-dkx'))return;r.setAttribute('data-dkx',info[0]);r.classList.add('dk-xrow');
  var b=el('button','dk-xb');b.type='button';b.setAttribute('aria-expanded','false');b.setAttribute('aria-label','Show '+info[0]+' chart');b.innerHTML='<i>▸</i>';
  var c=info[1];if(c===r){r.insertBefore(b,r.firstChild);return;}
  var anchor=c.querySelector(':scope>b,:scope>a,:scope>.t');if(anchor&&anchor.parentNode===c)c.insertBefore(b,anchor.nextSibling);else c.appendChild(b);}
function scan(root){root=root||D;if(!XP_ON)return;
  root.querySelectorAll('tr[data-tk],tr[data-t],li.row[data-tk],tr').forEach(function(r){if(r.hasAttribute('data-dkx'))return;var i=rowInfo(r,false);if(i)decorate(r,i);});
  root.querySelectorAll('.sig').forEach(function(r){if(r.hasAttribute('data-dkx'))return;var i=rowInfo(r,false);if(i)decorate(r,i);});}
function scanStrict(){   // weekend.html / email-style rows: first cell is <b>TICKER</b>; validated against data/tickers.json
  if(!XP_ON||PAGE!=='weekend.html')return;var cand=[];D.querySelectorAll('tr:not([data-dkx]),li').forEach(function(r){if(r.hasAttribute('data-dkx'))return;
    var fc=r.tagName==='TR'?r.querySelector(':scope>td'):r,b=fc&&fc.firstElementChild;if(b&&b.tagName==='B'&&TKRE.test(firstTok(b)))cand.push(r);});
  if(!cand.length)return;tickers().then(function(rows){UNI={};rows.forEach(function(x){UNI[x[0]]=1;});cand.forEach(function(r){var i=rowInfo(r,true);if(i)decorate(r,i);});});}
function owner(x){return x&&x.closest&&x.closest('[data-dkx]');}
function closeX(r){var k=OPEN.indexOf(r);if(k>=0)OPEN.splice(k,1);if(!r)return;var n=r._dkv;if(n&&n.parentNode)n.remove();r._dkv=null;
  if(r._dkmh){var sc=r._dkmh[0];r._dkmh=null;if(!OPEN.some(function(o){return o._dkmh&&o._dkmh[0]===sc;})){sc.style.maxHeight=sc._dkmh0;delete sc._dkmh0;}}
  if(r._dko){r._dko.disconnect();r._dko=null;}r.classList.remove('dk-vopen');var b=r.querySelector('.dk-xb');if(b)b.setAttribute('aria-expanded','false');
  var dv=r.querySelector('details.vsan[open]');if(dv&&!r._dkc){r._dkc=1;dv.open=false;setTimeout(function(){r._dkc=0;},0);}}
function openX(r){var t=r.getAttribute('data-dkx');if(!t||r._dkv)return;
  while(OPEN.length>=2)closeX(OPEN[0]);
  var mode=modeFor(r),tag=r.tagName,n,box;
  var lbl=r.getAttribute('data-xl')||{vsa:'full chart · VSA signs',spring:'full chart · spring markers',ema:'full chart · 10/20 EMA',setup:'full chart · levels + patterns',desk:'full chart · levels + patterns',mastack:'full chart + EMA 10/20/50',wyckoff:'full chart + range box, Wyckoff events, C&E (no MAs)'}[mode];
  box=el('div','dk-vchart','<div class="dk-vchart-h"><span><b>'+esc(t)+'</b> · '+lbl+' · volume'+(mode==='wyckoff'?'':' · RS')+'</span><a href="'+BASE+'stock.html?t='+encodeURIComponent(t)+'">Full stock page →</a></div><div class="ld">Loading chart…</div>');
  if(tag==='TR'){var cs=0;[].forEach.call(r.children,function(td){cs+=td.colSpan||1;});n=el('tr','dk-vrow');var td=el('td');td.colSpan=cs;n.appendChild(td);td.appendChild(box);}
  else{n=el(tag==='LI'?'li':'div','dk-vrow');n.appendChild(box);}
  var sc=tag==='TR'?scrollBox(r):null;r._dksc=sc;
  if(tag==='TR'&&sc){fitX(box,sc);box.style.position='sticky';box.style.left='6px';   // wide scrolling table: pin to the visible part (width = the container's visible width, not the table's scroll width)
    if(sc._dkmh0!==undefined)r._dkmh=[sc];else if(getComputedStyle(sc).maxHeight!=='none'){sc._dkmh0=sc.style.maxHeight;sc.style.maxHeight='none';r._dkmh=[sc];}}   // a height-capped scroller (qullamaggie.html .q-scroll 560px) would clip the chart's bottom: uncapped while a chart is open
  else if(tag==='TR'){box.style.width='100%';box.style.maxWidth=(innerWidth-16)+'px';}   // fixed-layout table: never widen it
  var f=D.createElement('iframe');f.title=t+' chart';f.setAttribute('scrolling','no');f.style.height='0px';
  var hint=((r.getAttribute('data-ty')||'')+' '+(r.textContent||'').slice(0,160)+' '+(mode==='setup'?headingText(r):'')).toLowerCase();
  var k=/spring/.test(hint)?'spring':/\bema\b|pullback/.test(hint)?'ema':/\bvcp\b/.test(hint)?'vcp':'';
  var xq=(mode==='mastack'||mode==='wyckoff'?String(r.getAttribute('data-xq')||'').replace(/[^a-z0-9=&]/g,''):''),src0=BASE+'stock.html?t='+encodeURIComponent(t)+'&embed=1&mini=1&ov='+mode+(k?'&k='+k:'')+xq;   // per-row chart variant (ma_stack &msv= / wyckoff &wv= &wt=)   // ma_stack.html: per-row chart variant (&msv=)
  f.addEventListener('load',function(){if(!f.getAttribute('src'))return;setTimeout(function(){var l=box.querySelector('.ld');if(l)l.remove();if(f.style.height==='0px')f.style.height='900px';},1200);});
  box.appendChild(f);
  chartPages().then(function(m){if(r._dkv!==n)return;   // (the row may have been closed meanwhile) the list is current with the pages: it wins over a ck baked into the row at build time
    f.src=m?src0.replace(/&ck=[a-z]*/g,'')+'&ck='+(m[t]?'p':'j'):src0;});
  var st=r.querySelector('details.vsan p');if(st){var sp=el('div','dk-vstory');sp.innerHTML='<b>Story</b> '+st.innerHTML;box.appendChild(sp);}
  r.parentNode.insertBefore(n,r.nextSibling);r._dkv=n;r.classList.add('dk-vopen');OPEN.push(r);

  var b=r.querySelector('.dk-xb');if(b)b.setAttribute('aria-expanded','true');
  var dv=r.querySelector('details.vsan');if(dv&&!dv.open){r._dkc=1;dv.open=true;setTimeout(function(){r._dkc=0;},0);}
  // re-render / sort / filter of this list -> close (the chart row must never sit under the wrong ticker)
  if(window.MutationObserver){var mo=new MutationObserver(function(){if(!r.isConnected||r.nextElementSibling!==n||r.offsetParent===null)closeX(r);});
    mo.observe(r.parentNode,{childList:true});mo.observe(r,{attributes:true,attributeFilter:['class','style','hidden']});r._dko=mo;}}
// the horizontal scroller around a wide table: a known wrapper class, else the nearest ancestor that actually scrolls sideways
// (qullamaggie.html .q-scroll and any other wide table site-wide; 5 Oct 2026: the dropdown chart filled the scroll width and was clipped at 390px)
function scrollBox(r){var k=r.closest('.tscroll,.table-scroll,.tbl-wrap,.tw,.tc-scroll,.q-scroll');if(k)return k;
  for(var n=r.parentElement;n&&n!==B&&n!==D.documentElement;n=n.parentElement){var ox=getComputedStyle(n).overflowX;if((ox==='auto'||ox==='scroll')&&n.scrollWidth>n.clientWidth+1)return n;}return null;}
function fitX(box,sc){var w=Math.min(sc.clientWidth,innerWidth)-14;box.style.width=Math.max(240,w)+'px';box.style.maxWidth=Math.max(240,w)+'px';}
// which tickers have a charts/<T>.html page (data/chart_pages.json, written by research-tools/charts.py with the pages): the dropdown tells
// stock.html (&ck=p|j) so it loads that page or the chart JSON directly instead of probing a missing page (404)
var CHP=null;function chartPages(){if(!CHP)CHP=fetch(BASE+'data/chart_pages.json').then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(j){var o={};(j.tickers||[]).forEach(function(t){o[t]=1;});return o;}).catch(function(){return null;});return CHP;}
function toggleX(r){if(r._dkv)closeX(r);else openX(r);}
if(XP_ON){
  scan();scanStrict();
  D.addEventListener('click',function(e){
    var th=e.target.closest('th');if(th){var tb=th.closest('table');if(tb)OPEN.slice().forEach(function(r){if(tb.contains(r))closeX(r);});return;}   // sort -> close first
    var xb=e.target.closest('.dk-xb');if(xb){e.preventDefault();e.stopPropagation();var r=owner(xb);if(r)toggleX(r);return;}
    if(e.target.closest('a,button,input,select,textarea,label,summary,details,.dk-vrow,[data-wl]'))return;
    var r2=owner(e.target);if(r2&&!(window.getSelection&&String(window.getSelection()).length))toggleX(r2);});
  D.addEventListener('toggle',function(e){var d=e.target;if(!d.matches||!d.matches('details.vsan'))return;var r=owner(d);if(!r||r._dkc)return;if(d.open&&!r._dkv)openX(r);else if(!d.open&&r._dkv)closeX(r);},true);
  D.addEventListener('input',function(e){if(!e.target.closest('.dk-find,.dk-vrow,.wl-add,.dk-pop'))OPEN.slice().forEach(closeX);},true);   // list filters
  window.addEventListener('resize',function(){OPEN.forEach(function(r){var b=r._dkv&&r._dkv.querySelector('.dk-vchart');if(b&&r._dksc)fitX(b,r._dksc);});});   // rotate / resize: keep the pinned chart the visible width
  window.addEventListener('message',function(e){var m=e.data;if(!m||typeof m.dkh!=='number')return;
    D.querySelectorAll('.dk-vchart iframe').forEach(function(f){if(f.contentWindow===e.source){f.style.height=Math.max(80,Math.min(9000,Math.ceil(m.dkh)))+'px';var l=f.parentNode.querySelector('.ld');if(l)l.remove();}});});
  ['list','wl-lists'].forEach(function(id){var c=D.getElementById(id);if(c&&window.MutationObserver)new MutationObserver(function(){scan(c);}).observe(c,{childList:true,subtree:id==='wl-lists'});});
}
// ------------------------------------------------------------------ springs timeframe filter: All / Daily / Weekly / Monthly (+ Actionable only)
// setups.html springs section (tables #springs-a / #springs-w, rows data-tf 0/1/2), Floor springs summary (#springs: filters the inline
// lists, links open setups.html#tf=..), springs_track.html "Latest actionable" table. Choice kept in localStorage; #tf=w&act=1 / ?tf=w open filtered.
(function(){
  var KEY='wa.desk.springs.tf.v1',TFN={d:'Daily',w:'Weekly',m:'Monthly'},IDX={'0':'d','1':'w','2':'m'};
  function readUrl(){var q=(location.hash||'').replace(/^#/,'').split('&').concat((location.search||'').replace(/^\?/,'').split('&')),o={};
    q.forEach(function(kv){var p=kv.split('=');if(p[0]==='tf'&&/^(all|d|w|m)$/.test(p[1]))o.tf=p[1];if(p[0]==='act')o.act=p[1]==='1'?1:0;if(p[0]==='ph'&&/^(all|[A-F])$/.test(p[1]))o.ph=p[1];});return o;}
  var st={tf:'all',act:0};try{var sv=JSON.parse(localStorage.getItem(KEY)||'{}');if(/^(all|d|w|m)$/.test(sv.tf))st.tf=sv.tf;st.act=sv.act?1:0;}catch(e){}
  var U=readUrl(),fromUrl=('tf' in U)||('act' in U);if(U.tf)st.tf=U.tf;if('act' in U)st.act=U.act;
  function save(){try{localStorage.setItem(KEY,JSON.stringify({tf:st.tf,act:st.act}));}catch(e){}}
  function hashFor(){return 'tf='+st.tf+(st.act?'&act=1':'')+(st.ph&&st.ph!=='all'?'&ph='+st.ph:'');}
  function bar(counts,opts){var b=el('div','dk-tfbar');b.setAttribute('role','group');b.setAttribute('aria-label','Springs timeframe filter');
    b.innerHTML=['all','d','w','m'].map(function(k){return '<button type="button" class="dk-tfc" data-tf="'+k+'">'+(k==='all'?'All':TFN[k])+' <b></b></button>';}).join('')+
      (opts.act?'<button type="button" class="dk-tfc dk-tfa" data-act>⚡ Actionable only <b></b></button>':'');
    return b;}
  function paint(b,c){b.querySelectorAll('[data-tf]').forEach(function(x){var k=x.getAttribute('data-tf');x.setAttribute('aria-pressed',String(st.tf===k));
      var n=c(k,st.act);x.querySelector('b').textContent=n==null?'':n;x.classList.toggle('zero',n===0);});
    var a=b.querySelector('[data-act]');if(a){a.setAttribute('aria-pressed',String(!!st.act));var na=c(st.tf,1);a.querySelector('b').textContent=na==null?'':na;}}
  function closeCharts(){OPEN.slice().forEach(closeX);}
  function wire(b,apply){b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;
    if(x.hasAttribute('data-act'))st.act=st.act?0:1;else st.tf=x.getAttribute('data-tf');save();closeCharts();apply(true);});}
  function emptyRow(tb,n,show,label){var r=tb.querySelector('tr.dk-tfempty');if(show&&!r){r=el('tr','dk-tfempty');var td=el('td');td.colSpan=n;r.appendChild(td);tb.appendChild(r);}
    if(r){r.hidden=!show;if(show)r.firstChild.textContent=label;}}
  var lbl=function(){return 'No '+(st.tf==='all'?'':TFN[st.tf].toLowerCase()+' ')+'springs in this list.';};

  if(PAGE==='setups.html'){var h=D.getElementById('t-springs');
    var fams=[].slice.call(D.querySelectorAll('section.pg-fam[data-fam]'));
    if(fams.length){
      // phase-grouped families (research-tools/phase_groups.py): section.pg-fam > .pg-phbar tabs + .pg-blk tables
      // (details.pg-ph Phase -> details.pg-ba bars-ago -> table.pg-tbl; rows data-ph / data-ba / data-act / data-mx [+ data-tf on springs]).
      // Shareable: #min=C&spr=D&epb=N (+ tf=w&act=1 for the springs family, which also gets the D/W/M + actionable bar). Phase is URL-only.
      var FH={};(location.hash||'').replace(/^#/,'').split('&').forEach(function(kv){var p=kv.split('=');if(p[1]&&/^(all|[A-FN])$/.test(p[1]))FH[p[0]]=p[1];});
      if(FH.ph&&!FH.spr)FH.spr=FH.ph;   // old springs links (#ph=C)
      var FS={},anyTf=0;
      var fullHash=function(){var h=[];if(anyTf){if(st.tf!=='all')h.push('tf='+st.tf);if(st.act)h.push('act=1');}
        fams.forEach(function(f){var k=f.getAttribute('data-fam');if(FS[k]&&FS[k]!=='all')h.push(k+'='+FS[k]);});return h.join('&');};
      var mixTxt=function(rows,ord){var a=0,c={},n=0;rows.forEach(function(r){n++;if(r.getAttribute('data-act')==='1')a++;(r.getAttribute('data-mx')||'').split(' ').forEach(function(t){if(t)c[t]=(c[t]||0)+1;});});
        var keys=ord.length?ord:Object.keys(c).sort(),p=[];if(a)p.push('⚡ '+a+' actionable');keys.forEach(function(k){if(c[k])p.push(k.replace(/_/g,' ')+' '+c[k]);});
        if(!keys.length)p.push((n-a)+' watching');return p.join(' · ');};
      var setCnt=function(cn,v,filt){if(!cn)return;var tot=cn.getAttribute('data-tot')||cn.textContent;cn.textContent=filt?v+' of '+tot:tot;};
      fams.forEach(function(fam){
        var fid=fam.getAttribute('data-fam'),tfb=fam.hasAttribute('data-tfbar'),pb=fam.querySelector('.pg-phbar');if(!pb)return;
        FS[fid]=FH[fid]||'all';if(tfb)anyTf=1;
        var rows=[].slice.call(fam.querySelectorAll('table.pg-tbl tbody tr[data-ph]'));
        var cntRows=[].slice.call(fam.querySelectorAll('.pg-blk[data-pgc="1"] table.pg-tbl tbody tr[data-ph]'));
        var okTf=function(r,tf,act){if(!tfb)return true;return (tf==='all'||IDX[r.getAttribute('data-tf')]===tf)&&(!act||r.getAttribute('data-act')==='1');};
        var b=null;
        var apply=function(user){var ph=FS[fid],filt=ph!=='all'||(tfb&&(st.tf!=='all'||!!st.act));
          rows.forEach(function(r){var ok=okTf(r,st.tf,st.act)&&(ph==='all'||r.getAttribute('data-ph')===ph);r.classList.toggle('dk-tfhide',!ok);});
          fam.querySelectorAll('.pg-blk').forEach(function(bk){var ord=(bk.getAttribute('data-mxo')||'').split(' ').filter(Boolean),bv=0,tot=0;
            bk.querySelectorAll('details.pg-ph').forEach(function(pd){var pv=0,show=ph==='all'||ph===pd.getAttribute('data-ph'),pr=[];
              pd.querySelectorAll('details.pg-ba').forEach(function(bd){var vr=[].slice.call(bd.querySelectorAll('tbody tr[data-ph]')).filter(function(r){return !r.classList.contains('dk-tfhide');});
                bd.hidden=!vr.length;pv+=vr.length;pr=pr.concat(vr);setCnt(bd.querySelector(':scope>summary>.cnt'),vr.length,filt);
                var m=bd.querySelector(':scope>summary>.pg-mix');if(m)m.textContent=mixTxt(vr,ord);});
              pd.hidden=!show||!pv;bv+=pv;setCnt(pd.querySelector(':scope>summary>.cnt'),pv,filt);
              var m=pd.querySelector(':scope>summary>.pg-mix');if(m)m.textContent=mixTxt(pr,ord);
              if(user&&show&&ph!=='all')pd.open=true;});
            tot=bk.querySelectorAll('table.pg-tbl tbody tr[data-ph]').length;
            var em=bk.querySelector('.pg-none');if(em){em.hidden=!tot||!!bv;em.textContent='None in '+(ph==='all'?'this view':(ph==='F'?'the failed group':ph==='N'?'No range · trending':'Phase '+ph))+(tfb&&st.tf!=='all'?' ('+TFN[st.tf].toLowerCase()+')':'')+'.';}
            var sec=bk.closest('details.pg-sec');if(sec){setCnt(sec.querySelector(':scope>summary>.pg-scnt'),bv,filt&&!!tot);}});
          pb.querySelectorAll('[data-ph]').forEach(function(x){var k=x.getAttribute('data-ph'),n=0;cntRows.forEach(function(r){if(okTf(r,st.tf,st.act)&&(k==='all'||r.getAttribute('data-ph')===k))n++;});
            x.setAttribute('aria-pressed',String(ph===k));x.querySelector('b').textContent=n;x.classList.toggle('zero',n===0);});
          if(b)paint(b,function(tf,act){var n=0;cntRows.forEach(function(r){if(okTf(r,tf,act)&&(ph==='all'||r.getAttribute('data-ph')===ph))n++;});return n;});
          if(user)try{history.replaceState(null,'',location.pathname+location.search+'#'+fullHash());}catch(e){}};
        if(tfb){b=bar(null,{act:1});b.classList.add('pg-tfbar');pb.parentNode.insertBefore(b,pb.nextSibling);wire(b,apply);}
        pb.addEventListener('click',function(e){var x=e.target.closest('button[data-ph]');if(!x)return;FS[fid]=x.getAttribute('data-ph');closeCharts();apply(true);
          if(pb.getBoundingClientRect().top<0)window.scrollTo(0,pb.getBoundingClientRect().top+window.scrollY-8);});
        fam.addEventListener('toggle',function(e){var d=e.target;if(d&&d.tagName==='DETAILS'&&!d.open)OPEN.slice().forEach(function(x){if(x&&d.contains(x))closeX(x);});},true);
        // master-list sort bar: Best overall / Actionable first, applied to every sub-table of its block
        fam.querySelectorAll('.pg-sortbar').forEach(function(sb){sb.addEventListener('click',function(e){var x=e.target.closest('button[data-k]');if(!x)return;var k=x.getAttribute('data-k');
          var blk=sb.parentNode.querySelector('.pg-blk')||sb.nextElementSibling;if(!blk)return;
          blk.querySelectorAll('table.pg-tbl').forEach(function(t){var th=t.querySelector('th[data-k="'+k+'"]');if(!th)return;th.classList.remove('asc','desc');th.classList.add(k==='ov'?'asc':'desc');th.click();});
          sb.querySelectorAll('button').forEach(function(y){y.classList.toggle('on',y===x);});});});
        apply(false);
      });
      var tgt=null;fams.forEach(function(f){var k=f.getAttribute('data-fam');if(!tgt&&FH[k])tgt=f;});
      if(!tgt&&fromUrl)tgt=D.querySelector('section.pg-fam[data-tfbar]');
      if(tgt)setTimeout(function(){D.documentElement.style.scrollBehavior='auto';var hh=tgt.querySelector('h2')||tgt;window.scrollTo(0,hh.getBoundingClientRect().top+window.scrollY-8);},60);
      return;
    }
    if(!h)return;
    var tA=D.getElementById('springs-a'),tW=D.getElementById('springs-w');if(!tA&&!tW)return;
    function rows(t){return t?[].slice.call(t.querySelectorAll('tbody tr[data-tf]')):[];}
    var cnt=function(tf,act){var n=0;[[tA,1],[tW,0]].forEach(function(p){if(act&&!p[1])return;rows(p[0]).forEach(function(r){if(tf==='all'||IDX[r.getAttribute('data-tf')]===tf)n++;});});return n;};
    var b=bar(null,{act:1});h.parentNode.insertBefore(b,h.nextSibling);
    var apply=function(user){[[tA,1],[tW,0]].forEach(function(p){var t=p[0];if(!t)return;var hide=st.act&&!p[1],vis=0;
        rows(t).forEach(function(r){var ok=!hide&&(st.tf==='all'||IDX[r.getAttribute('data-tf')]===st.tf);r.classList.toggle('dk-tfhide',!ok);if(ok)vis++;});
        var wrap=t.closest('.tscroll')||t,hd=wrap.previousElementSibling;wrap.hidden=hide;if(hd&&hd.tagName==='H3'){hd.hidden=hide;var cn=hd.querySelector('.cnt');if(cn){if(!cn.dataset.tot)cn.dataset.tot=cn.textContent;cn.textContent=st.tf==='all'?cn.dataset.tot:vis+' of '+cn.dataset.tot;}}
        var tb=t.querySelector('tbody');if(tb)emptyRow(tb,(t.querySelector('thead tr')||{children:[1]}).children.length,!hide&&!vis,lbl());});
      paint(b,cnt);if(user)try{history.replaceState(null,'',location.pathname+location.search+'#'+hashFor());}catch(e){}};
    wire(b,apply);apply(false);
    if(fromUrl)setTimeout(function(){D.documentElement.style.scrollBehavior='auto';window.scrollTo(0,h.getBoundingClientRect().top+window.scrollY-8);},60);
  }
  else if(PAGE==='index.html'){var hf=D.getElementById('springs');if(!hf)return;var pn=hf.nextElementSibling;if(!pn)return;
    var sum=(pn.firstElementChild&&pn.firstElementChild.textContent)||'',T={all:{},act:{}};
    var m=sum.match(/daily\s+(\d+)\s*·\s*weekly\s+(\d+)\s*·\s*monthly\s+(\d+)/i);if(m){T.all={d:+m[1],w:+m[2],m:+m[3]};}
    var ma=sum.match(/(\d+)\s+actionable/i);
    // wrap each "<b>TICKER</b> <small>D · ...</small>" item so it can be hidden
    pn.querySelectorAll('.stp-act').forEach(function(a){[].slice.call(a.querySelectorAll(':scope>b+small')).forEach(function(sm){var bt=sm.previousElementSibling,tf=(sm.textContent.trim()[0]||'').toLowerCase();
      if(!/[dwm]/.test(tf)||!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(bt.textContent.trim()))return;var w=el('span','dk-tfi');w.setAttribute('data-tf',tf);bt.parentNode.insertBefore(w,bt);w.appendChild(bt);w.appendChild(D.createTextNode(' '));w.appendChild(sm);
      var nx=w.nextSibling;if(nx&&nx.nodeType===3&&/^\s*·\s*$/.test(nx.textContent)){var sep=el('span','dk-tfsep');sep.textContent=' · ';nx.replaceWith(sep);}});});
    var cnt2=function(tf,act){var src=act?T.act:T.all;if(!src||src.d==null)return act&&ma&&tf==='all'?+ma[1]:null;return tf==='all'?src.d+src.w+src.m:src[tf];};
    var b2=bar(null,{act:1});pn.insertBefore(b2,pn.firstElementChild?pn.firstElementChild.nextSibling:null);
    var links=[].slice.call(pn.querySelectorAll('a.stp-go[href*="setups.html"]'));
    var apply2=function(){pn.querySelectorAll('.stp-act').forEach(function(a){var any=0;a.querySelectorAll('.dk-tfi').forEach(function(w){var ok=st.tf==='all'||w.getAttribute('data-tf')===st.tf;w.hidden=!ok;if(ok)any++;});
        var hasItems=a.querySelector('.dk-tfi');a.classList.toggle('dk-tfnone',!!hasItems&&!any);a.setAttribute('data-none',lbl());
        var seps=[].slice.call(a.querySelectorAll('.dk-tfsep'));seps.forEach(function(sp){var p=sp.previousElementSibling,n=sp.nextElementSibling;sp.hidden=!(p&&!p.hidden&&n&&n.classList.contains('dk-tfi'));});
        // separators between visible items only
        var vis=[].slice.call(a.querySelectorAll('.dk-tfi')).filter(function(w){return !w.hidden;});seps.forEach(function(sp){sp.hidden=true;});vis.forEach(function(w,i){if(i){var sp=w.previousElementSibling;while(sp&&!sp.classList.contains('dk-tfsep'))sp=sp.previousElementSibling;if(sp)sp.hidden=false;}});});
      links.forEach(function(l){l.href='setups.html#'+hashFor();});paint(b2,cnt2);};
    wire(b2,apply2);apply2();
    fetch(BASE+'data/springs.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(j&&j.all){T.all=j.all;T.act=j.act;paint(b2,cnt2);}}).catch(function(){});
  }
  else if(PAGE==='springs_track.html'){var hs=[].slice.call(D.querySelectorAll('h2')).filter(function(x){return /Latest .*actionable springs/i.test(x.textContent);})[0];if(!hs)return;
    var wrap3=hs.nextElementSibling,t3=wrap3&&wrap3.querySelector('table');if(!t3)return;
    var rows3=[].slice.call(t3.querySelectorAll('tr')).filter(function(r){return r.querySelector('td');});
    rows3.forEach(function(r){var sm=r.querySelector('td small'),tf=sm?(sm.textContent.trim()[0]||'').toLowerCase():'';if(/[dwm]/.test(tf))r.setAttribute('data-sptf',tf);});
    var cnt3=function(tf){return rows3.filter(function(r){return tf==='all'||r.getAttribute('data-sptf')===tf;}).length;};
    var b3=bar(null,{act:0});hs.parentNode.insertBefore(b3,hs.nextSibling);
    var apply3=function(user){var v=0;rows3.forEach(function(r){var ok=st.tf==='all'||r.getAttribute('data-sptf')===st.tf;r.classList.toggle('dk-tfhide',!ok);if(ok)v++;});
      emptyRow(t3.querySelector('tbody')||t3,5,!v,lbl());paint(b3,cnt3);if(user)try{history.replaceState(null,'',location.pathname+'#'+hashFor());}catch(e){}};
    wire(b3,apply3);apply3(false);
  }
})();
// ------------------------------------------------------------------ as-of badges (research-tools/desk_today.py, 9 Oct 2026)
// .dk-asof[data-asof] = the US session a section's data covers. Re-checked against the viewer's clock: ok = covers the last completed
// US session (4:15pm New York), amber = one session older, red = more than one. Holidays mirror desk_today.HOLIDAYS / rs_rank.HOLIDAYS.
(function(){
  var HOL='2025-01-01 2025-01-09 2025-01-20 2025-02-17 2025-04-18 2025-05-26 2025-06-19 2025-07-04 2025-09-01 2025-11-27 2025-12-25 2026-01-01 2026-01-19 2026-02-16 2026-04-03 2026-05-25 2026-06-19 2026-07-03 2026-09-07 2026-11-26 2026-12-25 2027-01-01 2027-01-18 2027-02-15 2027-03-26 2027-05-31 2027-06-18 2027-07-05 2027-09-06 2027-11-25 2027-12-24'.split(' ');
  var bs=D.querySelectorAll('.dk-asof[data-asof]');if(!bs.length)return;
  function iso(d){return d.toISOString().slice(0,10);}
  function isS(d){var w=d.getUTCDay();return w>0&&w<6&&HOL.indexOf(iso(d))<0;}
  function prev(d){d=new Date(d.getTime()-864e5);while(!isS(d))d=new Date(d.getTime()-864e5);return d;}
  var ny;try{var p={};new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});ny=p;}catch(e){return;}
  var today=new Date(Date.UTC(+ny.year,+ny.month-1,+ny.day)),hm=(+ny.hour)*60+(+ny.minute);
  var ref=(isS(today)&&hm>=16*60+15)?today:prev(today);
  function behind(a){var d=new Date(ref.getTime()),n=0;while(iso(d)>a&&n<400){if(isS(d))n++;d=new Date(d.getTime()-864e5);}return n;}
  var M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],W=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function lab(d){return W[d.getUTCDay()]+' '+d.getUTCDate()+' '+M[d.getUTCMonth()]+' '+d.getUTCFullYear();}
  [].forEach.call(bs,function(b){var a=b.getAttribute('data-asof');if(!/^\d{4}-\d{2}-\d{2}$/.test(a))return;var n=behind(a);
    b.classList.remove('ok','amber','red');b.classList.add(n>=2?'red':n===1?'amber':'ok');
    var t=(b.getAttribute('title')||'').replace(/; last completed US session.*$/,'');
    b.setAttribute('title',t+'; last completed US session '+lab(ref)+(n?' ('+n+' session'+(n>1?'s':'')+' behind)':''));});
})();
window.DKXP={scan:scan,open:openX,close:closeX};
})();
