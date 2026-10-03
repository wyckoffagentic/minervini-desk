/* watchlists.js - site/public/watchlists.html: the user's own lists (store = window.DKWL in assets/desk.js, localStorage on this device).
   Rows from data/universe.json (research-tools/stock_data.py).  Export / import JSON, share link (#wl=<json>).  Research, not advice. */
(function(){
'use strict';
function start(){
var W=window.DKWL;if(!W){setTimeout(start,30);return;}
var esc=W.esc,$=function(id){return document.getElementById(id);},U=null,IDX={};
function num(v){return typeof v==='number'&&isFinite(v);}
function pc(v){if(!num(v))return '<span class="mut">—</span>';return '<span class="'+(v>0?'dk-up':v<0?'dk-dn':'')+'">'+(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1)+'%</span>';}
function px(v){return num(v)?(v>=1000?v.toLocaleString('en-US',{maximumFractionDigits:0}):v.toFixed(2)):'—';}
function rsCls(r){return !num(r)?'':r>=90?'g':r>=70?'c':r<40?'r':'';}
function row(t){var o=IDX[t];
  if(!o)return '<tr><td class="tk"><a href="stock.html?t='+esc(t)+'">'+esc(t)+'</a><small>not in the desk universe</small></td><td class="r" colspan="3"><span class="mut">no data</span></td><td class="r hm"></td><td class="hm"></td><td><button class="x" data-rm="'+esc(t)+'" aria-label="Remove '+esc(t)+'">✕</button></td></tr>';
  var rsH=(num(o.rs)?'<span class="dk-chip '+rsCls(o.rs)+'" title="RS rating (desk calc)">RS '+o.rs+'</span>':'<span class="mut">RS —</span>')+' '+(o.tt===true||o.tt===1?'<span class="dk-chip g" title="passes the trend template">TT ✓</span>':'<span class="dk-chip" title="fails the trend template">TT ✗</span>');
  var stH=o.state?'<span class="dk-state '+esc(o.cls||'')+'">'+esc(o.state)+'</span>':'';
  return '<tr><td class="tk"><a href="stock.html?t='+esc(t)+'">'+esc(t)+'</a><small>'+esc(o.name||'')+'</small><span class="ph">'+rsH+' '+stH+'</span></td>'+
    '<td class="r">'+px(o.px)+'</td><td class="r">'+pc(o.d1)+'</td><td class="r">'+pc(o.w1)+'</td>'+
    '<td class="r hm">'+rsH+'</td><td class="hm">'+stH+'</td>'+
    '<td><button class="x" data-rm="'+esc(t)+'" aria-label="Remove '+esc(t)+'">✕</button></td></tr>';}
function draw(){
  var s=W.read(),box=$('wl-lists');
  if(!s.lists.length){box.innerHTML='<div class="wl-list"><div class="wl-empty">No lists yet. Tap <b>＋ New list</b>, or use the <b>＋</b> buttons on Top Movers, chart pages and stock pages.</div></div>';return;}
  box.innerHTML=s.lists.map(function(l,i){
    return '<section class="wl-list" data-id="'+esc(l.id)+'"><div class="wl-h"><h2>'+esc(l.name)+'<small>'+l.tickers.length+' ticker'+(l.tickers.length===1?'':'s')+'</small></h2>'+
      '<button class="dk-btn ghost sm" data-up'+(i?'':' disabled')+' aria-label="Move list up">↑</button><button class="dk-btn ghost sm" data-dn'+(i<s.lists.length-1?'':' disabled')+' aria-label="Move list down">↓</button>'+
      '<button class="dk-btn ghost sm" data-ren aria-label="Rename list">✎</button><button class="dk-btn warn sm" data-del aria-label="Delete list">🗑</button></div>'+
      '<div class="wl-add"><input class="dk-in" placeholder="Add ticker or company" aria-label="Add a ticker to '+esc(l.name)+'" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="40"><button class="dk-btn sm" data-add>Add</button></div>'+
      (l.tickers.length?'<div class="tscroll" style="border:0;border-radius:0"><table class="wl-tbl"><thead><tr><th>Ticker</th><th class="r">Last</th><th class="r">1D</th><th class="r">1W</th><th class="r hm">RS · TT</th><th class="hm">State</th><th></th></tr></thead><tbody>'+l.tickers.map(row).join('')+'</tbody></table></div>':'<div class="wl-empty">Empty: add a ticker above.</div>')+'</section>';}).join('');
  box.querySelectorAll('.wl-list').forEach(function(sec){var inp=sec.querySelector('.wl-add .dk-in');if(inp)W.autocomplete(inp,sec.querySelector('.wl-add'),function(t){add(sec.getAttribute('data-id'),t);});});
}
function mut(id,fn){var s=W.read(),l=s.lists.filter(function(x){return x.id===id;})[0];if(!l)return;fn(l,s);W.write(s);}
function add(id,raw){var t=W.clean(raw);if(!t)return;
  if(U&&!IDX[t]){var m=W.match(raw,1);if(m.length&&String(m[0][1]||'').toUpperCase().indexOf(String(raw).trim().toUpperCase())>=0)t=m[0][0];}
  mut(id,function(l){if(l.tickers.indexOf(t)<0)l.tickers.push(t);});W.toast('Added '+t+(IDX[t]?'':' (not in the desk universe: no data)'));
  setTimeout(function(){var i=document.querySelector('.wl-list[data-id="'+id+'"] .wl-add .dk-in');if(i)i.focus();},0);}
document.addEventListener('click',function(e){
  var sec=e.target.closest('.wl-list[data-id]'),id=sec&&sec.getAttribute('data-id'),b=e.target.closest('button');if(!b)return;
  if(b.id==='wl-new'){var n=prompt('Name your list (e.g. AI Infrastructure, Earnings plays):','');if(n&&n.trim())W.create(n.trim());return;}
  if(b.id==='wl-exp'){exp();return;}if(b.id==='wl-share'){share();return;}
  if(!id)return;
  if(b.hasAttribute('data-add')){add(id,sec.querySelector('.wl-add .dk-in').value);}
  else if(b.hasAttribute('data-rm')){var t=b.getAttribute('data-rm');mut(id,function(l){l.tickers=l.tickers.filter(function(x){return x!==t;});});}
  else if(b.hasAttribute('data-ren')){mut(id,function(l){var n=prompt('Rename list:',l.name);if(n&&n.trim())l.name=n.trim().slice(0,60);});}
  else if(b.hasAttribute('data-del')){mut(id,function(l,s){if(confirm('Delete the list “'+l.name+'” ('+l.tickers.length+' tickers)? This cannot be undone (export first if unsure).'))s.lists=s.lists.filter(function(x){return x.id!==id;});});}
  else if(b.hasAttribute('data-up')||b.hasAttribute('data-dn')){mut(id,function(l,s){var i=s.lists.indexOf(l),j=i+(b.hasAttribute('data-up')?-1:1);if(j<0||j>=s.lists.length)return;s.lists.splice(i,1);s.lists.splice(j,0,l);});}
});
document.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.defaultPrevented&&e.target.matches('.wl-add .dk-in')){var sec=e.target.closest('.wl-list');var ul=sec.querySelector('.dk-ac');if(ul&&!ul.hidden)return;e.preventDefault();add(sec.getAttribute('data-id'),e.target.value);}});
// ---- export / import / share
function payload(){var s=W.read();return {app:'wyckoff-agentic-watchlists',v:1,exported:new Date().toISOString(),lists:s.lists.map(function(l){return {name:l.name,tickers:l.tickers};})};}
function exp(){var b=new Blob([JSON.stringify(payload(),null,1)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='watchlists-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);}
function share(){var p=payload();if(!p.lists.length){W.toast('No lists to share yet');return;}
  var url=location.href.split('#')[0]+'#wl='+encodeURIComponent(JSON.stringify({v:1,lists:p.lists}));
  if(navigator.share){navigator.share({title:'My watchlists',url:url}).catch(function(){});return;}
  (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(function(){W.toast('Share link copied');},function(){prompt('Copy this link:',url);});}
function parse(o){if(!o||!Array.isArray(o.lists))throw new Error('not a watchlist file');return o.lists.filter(function(l){return l&&l.name;}).map(function(l){return {name:String(l.name).slice(0,60),tickers:(Array.isArray(l.tickers)?l.tickers:[]).map(W.clean).filter(Boolean).filter(function(t,i,a){return a.indexOf(t)===i;}).slice(0,500)};}).slice(0,100);}
function offer(lists,src){var bn=$('wl-banner'),n=lists.reduce(function(a,l){return a+l.tickers.length;},0);
  bn.innerHTML='<div class="wl-banner"><b>Import '+lists.length+' list'+(lists.length===1?'':'s')+' ('+n+' tickers)</b> from '+esc(src)+': '+lists.map(function(l){return esc(l.name);}).join(', ')+
    '<div class="dk-actions" style="padding:8px 0 0;margin:0"><button class="dk-btn sm" data-m>Merge into my lists</button><button class="dk-btn warn sm" data-r>Replace my lists</button><button class="dk-btn ghost sm" data-c>Cancel</button></div></div>';
  bn.onclick=function(e){var b=e.target.closest('button');if(!b)return;var s=W.read();
    if(b.hasAttribute('data-r')){if(!confirm('Replace all '+s.lists.length+' of your lists with the imported ones?'))return;s.lists=[];}
    if(b.hasAttribute('data-m')||b.hasAttribute('data-r')){lists.forEach(function(l){var ex=s.lists.filter(function(x){return x.name===l.name;})[0];
      if(ex)l.tickers.forEach(function(t){if(ex.tickers.indexOf(t)<0)ex.tickers.push(t);});else s.lists.push({id:W.id(),name:l.name,tickers:l.tickers.slice(),created:new Date().toISOString().slice(0,10)});});W.write(s);W.toast('Imported');}
    bn.innerHTML='';if(location.hash.indexOf('#wl=')===0)history.replaceState(null,'',location.pathname+location.search);};}
$('wl-imp').addEventListener('change',function(){var f=this.files&&this.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{offer(parse(JSON.parse(r.result)),'file '+f.name);}catch(e){W.toast('Could not read that file: '+e.message);}};r.readAsText(f);this.value='';});
if(location.hash.indexOf('#wl=')===0){try{offer(parse(JSON.parse(decodeURIComponent(location.hash.slice(4)))),'a share link');}catch(e){$('wl-banner').innerHTML='<div class="wl-banner">That share link could not be read.</div>';}}
window.addEventListener('dkwl',draw);
fetch('data/universe.json').then(function(r){return r.json();}).then(function(j){U=j;j.rows.forEach(function(r){var o={};j.cols.forEach(function(c,i){o[c]=r[i];});IDX[o.t]=o;});
  $('wl-asof').textContent='Prices as of the '+(j.session||'?')+' US close · index built '+String(j.generated||'').replace('T',' ').slice(0,16)+' (Sydney) · '+j.n+' tickers';draw();})
  .catch(function(){$('wl-asof').textContent='Could not load prices (data/universe.json): showing tickers only.';draw();});
W.tickers();
draw();
}
start();
})();
