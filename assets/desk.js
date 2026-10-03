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

// ------------------------------------------------------------------ VSA: inline chart when a story dropdown opens (lazy; removed on close)
function vsaClose(row){var r=row&&row.nextElementSibling;if(r&&r.classList.contains('dk-vrow'))r.remove();if(row)row.classList.remove('dk-vopen');}
function vsaOpen(det){
  var row=det.closest('tr[data-tk]');if(!row)return;var t=WL.clean(row.getAttribute('data-tk'));if(!t)return;
  vsaClose(row);row.classList.add('dk-vopen');
  var n=0;[].forEach.call(row.children,function(td){n+=td.colSpan||1;});
  var tr=el('tr','dk-vrow'),td=el('td');td.colSpan=n;tr.appendChild(td);
  var sc=row.closest('.tscroll'),w=sc?sc.clientWidth-14:0;
  var box=el('div','dk-vchart','<div class="dk-vchart-h"><span><b>'+esc(t)+'</b> · daily bars · VSA signs · volume · RS</span><a href="'+BASE+'stock.html?t='+encodeURIComponent(t)+'">Full stock page →</a></div><div class="ld">Loading chart…</div>');
  if(w>0){box.style.width=w+'px';box.style.position='sticky';box.style.left='0';}
  var f=D.createElement('iframe');f.title=t+' chart';f.loading='lazy';f.setAttribute('scrolling','no');f.style.height='0px';
  f.src=BASE+'stock.html?t='+encodeURIComponent(t)+'&embed=1&mini=1';
  f.addEventListener('load',function(){var l=box.querySelector('.ld');if(l)l.remove();if(f.style.height==='0px')f.style.height='420px';});
  box.appendChild(f);
  var st=det.querySelector('p');if(st){var sp=el('div','dk-vstory');sp.innerHTML='<b>Story</b> '+st.innerHTML;box.appendChild(sp);}   // full-width copy of the story (the cell copy is hidden while open)
  td.appendChild(box);row.parentNode.insertBefore(tr,row.nextSibling);
}
var vsaRoot=D.querySelector('details.vsan');
if(vsaRoot){
  D.addEventListener('toggle',function(e){var d=e.target;if(!d.matches||!d.matches('details.vsan'))return;if(d.open)vsaOpen(d);else vsaClose(d.closest('tr[data-tk]'));},true);
  window.addEventListener('message',function(e){var m=e.data;if(!m||typeof m.dkh!=='number')return;
    D.querySelectorAll('.dk-vchart iframe').forEach(function(f){if(f.contentWindow===e.source){f.style.height=Math.max(80,Math.min(900,Math.ceil(m.dkh)))+'px';var l=f.parentNode.querySelector('.ld');if(l)l.remove();}});});
  // sorting a table re-appends rows: close open charts first so a chart row never lands under the wrong ticker
  D.addEventListener('click',function(e){var th=e.target.closest('th.sort');if(!th)return;var tb=th.closest('table');if(!tb)return;
    tb.querySelectorAll('tr.dk-vrow').forEach(function(r){r.remove();});tb.querySelectorAll('tr.dk-vopen').forEach(function(r){r.classList.remove('dk-vopen');var d=r.querySelector('details.vsan[open]');if(d)d.open=false;});},true);
}
})();
