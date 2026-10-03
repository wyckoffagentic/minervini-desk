/* stock.js - renders site/public/stock.html?t=TICKER from data/stock/<T>.json (full rundown, research-tools/stock_data.py)
   or, when a ticker has no full JSON yet, from data/universe.json (name, price, RS) with a note.
   Chart: the desk chart design (charts/_assets/charts.js) fed with the chart page's own TC_DATA (charts/<T>.html) or
   data/chart/<T>.json.  ?embed=1&mini=1 = chart only (VSA dropdowns).  No dependencies.  Research, not advice. */
(function(){
'use strict';
var P=new URLSearchParams(location.search),T=(P.get('t')||P.get('ticker')||'').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,10);
var MINI=P.get('mini')==='1',EMB=P.get('embed')==='1',OVM=(P.get('ov')||'desk').replace(/[^a-z]/g,''),OVK=(P.get('k')||'').replace(/[^a-z]/g,'');
if(MINI)document.body.classList.add('tc-mini');
if(EMB)document.body.classList.add('tc-embed');
var $=function(id){return document.getElementById(id);};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function num(v){return typeof v==='number'&&isFinite(v);}
function px(v){return num(v)?'$'+(v>=1000?v.toLocaleString('en-US',{maximumFractionDigits:2}):v.toFixed(2)):'—';}
function big(v,cur){if(!num(v))return '—';var a=Math.abs(v),s=a>=1e12?(v/1e12).toFixed(2)+'T':a>=1e9?(v/1e9).toFixed(2)+'B':a>=1e6?(v/1e6).toFixed(1)+'M':a>=1e3?(v/1e3).toFixed(0)+'K':v.toFixed(0);return (cur===false?'':'$')+s;}
function cnt(v){return big(v,false);}
function pc(v,nd){if(v==='turned +')return '<span class="dk-up">turned +</span>';if(!num(v))return '<span class="mut">—</span>';nd=nd==null?1:nd;
  return '<span class="'+(v>0?'dk-up':v<0?'dk-dn':'')+'">'+(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(nd)+'%</span>';}
function eps(v){return num(v)?(v<0?'−':'')+'$'+Math.abs(v).toFixed(2):'—';}
function dshort(s){if(!s)return '—';var d=new Date(s+'T12:00:00Z');return isNaN(d)?esc(s):d.toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});}
function qlabel(s){if(!s)return '—';var d=new Date(s+'T12:00:00Z');return isNaN(d)?esc(s):d.toLocaleDateString('en-US',{month:'short',year:'2-digit',timeZone:'UTC'}).replace(' ',' ’');}
function sec(id,title,sub,body){return '<section class="stk-sec" id="'+id+'"><h2 class="sec-title">'+title+(sub?' <small>'+sub+'</small>':'')+'</h2>'+body+'</section>';}
function chip(txt,cls,tip){return '<span class="dk-chip '+(cls||'')+'"'+(tip?' title="'+esc(tip)+'"':'')+'>'+txt+'</span>';}
function state(s){return s?'<span class="dk-state '+esc(s[1]||'')+'">'+esc(s[0])+'</span>':'';}
function rsCls(r){return !num(r)?'':r>=90?'g':r>=70?'c':r<40?'r':'';}
function get(u){return fetch(u,{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r;});}
function wlBtn(t){return '<button type="button" class="dk-btn dk-wlb-big" data-wl="'+esc(t)+'">＋ Watchlist</button>';}

if(!T){ $('stk-top').innerHTML='<div class="dk-panel"><h1>Stock page</h1><p>Type a ticker in the box at the top (e.g. <a href="stock.html?t=NTAP">NTAP</a>) or open one from <a href="watchlists.html">My Watchlists</a>.</p></div>';$('stk-body').innerHTML='';return; }
document.title=T+' · Stock · Wyckoff Agentic';

// ------------------------------------------------------------------ chart (desk chart design, charts.js)
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.body.appendChild(s);});}
function chartFrom(kind){
  var p;
  if(kind==='page'||kind===1){
    p=get('charts/'+encodeURIComponent(T)+'.html').then(function(r){return r.text();}).then(function(h){
      var doc=new DOMParser().parseFromString(h,'text/html'),D=null;
      doc.querySelectorAll('script').forEach(function(s){var x=s.textContent,i=x.indexOf('window.TC_DATA=');if(i>=0&&!D){var j=x.lastIndexOf(';');D=JSON.parse(x.slice(i+15,j>i?j:x.length));}});
      var rb=doc.getElementById('tc-rsb');return {tc:D,rsb:rb?rb.outerHTML:'',page:true};});
  }else if(kind==='json'||kind===2){p=get('data/chart/'+encodeURIComponent(T)+'.json').then(function(r){return r.json();});}
  else return Promise.resolve(null);
  return p.then(function(c){
    if(!c||!c.tc||!c.tc.bars)return null;
    if(MINI){   // expandable-row chart: overlays for the page's context (ov=vsa|spring|ema|setup|desk), levels unless ov=vsa
      var all=(c.tc.overlays||[]).filter(Boolean),keep;
      if(OVM==='vsa')keep=all.filter(function(o){return o.id==='vsa';});
      else if(OVM==='spring')keep=all.filter(function(o){return /^spring/.test(o.id);});
      else if(OVM==='ema')keep=all.filter(function(o){return /^ema/.test(o.id);});
      else{keep=all.filter(function(o){return o.id!=='vsa';});
        var KR={vcp:/^vcp/,spring:/^spring/,ema:/^ema/}[OVK];if(KR){var kk=keep.filter(function(o){return KR.test(o.id);});if(kk.length)keep=kk;}}   // the row's own pattern when it has one
      if(!keep.length&&OVM!=='vsa'&&OVM!=='setup'&&OVM!=='desk')keep=all.filter(function(o){return o.id!=='vsa';});   // nothing of that kind: show the detector drawings there are
      c.tc.overlays=keep;
      if(OVM==='vsa'||c.tc.no_levels){['entry','stop','zone_top','buy_zone','r2','r3','cuts','risk','risk_pct'].forEach(function(k){c.tc[k]=null;});c.tc.no_levels=true;c.tc.risk_plan={};}
      c.tc._r2=c.tc.r2;c.tc._r3=c.tc.r3;   // 2R / 3R also listed in the key; charts.js moves far-off targets out of the price scale (Targets layer)
      miniKey(c.tc,keep);
    }
    var NEON={'#1f9d3a':'#39ff88','#d62828':'#ff3d7f'};   // VSA sign colours -> desk neon (dark background)
    (c.tc.overlays||[]).forEach(function(o){if(o.id!=='vsa')return;o.color=NEON[o.color]||o.color;(o.items||[]).forEach(function(it){if(NEON[it.c])it.c=NEON[it.c];});(o.legend||[]).forEach(function(l){if(NEON[l[0]])l[0]=NEON[l[0]];});});
    window.TC_DATA=c.tc;var box=$('stk-chart');box.hidden=false;
    if(c.tc.no_levels){document.body.classList.add('dk-nolv');}
    $('stk-rsb').innerHTML=c.rsb||'';
    return loadScript('charts/_assets/chart_zoom.js?v=bc656a99').then(function(){return loadScript('charts/_assets/charts.js?v=bc656a99');}).then(function(){postH();return c;});
  }).catch(function(e){return null;});
}
function miniKey(D,ovs){var k=document.querySelector('.stk-vkey');if(!k)return;var h=[];
  if(OVM==='vsa'){h.push('<span><i class="dk-up">●</i> strength sign (under the bar)</span><span><i class="dk-dn">●</i> weakness sign (over the bar)</span><span><i>!</i> high significance in context</span>');}
  else{if(!D.no_levels&&D.entry!=null)h.push('<span>levels: entry <b>'+(+D.entry).toFixed(2)+'</b>'+(D.stop!=null?' · stop <b>'+(+D.stop).toFixed(2)+'</b>':'')+(D._r2!=null?' · targets 2R '+(+D._r2).toFixed(2)+' / 3R '+(+D._r3).toFixed(2):'')+'</span>');
    else h.push('<span class="mut">no desk levels for this name</span>');
    ovs.forEach(function(o){h.push('<span><i style="color:'+esc(o.color||'#fff')+'">■</i> '+esc(String(o.label||o.id).toLowerCase())+'</span>');});}
  h.push('<span class="mut">RS panel on top · SMA 50/150/200 · tap a bar for details</span>');k.innerHTML=h.join('');}
function noChart(msg){var b=$('stk-chart');b.hidden=false;b.innerHTML='<div class="dk-note">'+msg+'</div>';postH();}
var roH=false;
function postH(){if(EMB&&parent!==window){var f=function(){try{parent.postMessage({dkh:document.getElementById('stk').scrollHeight+4,t:T},'*');}catch(e){}};f();setTimeout(f,400);setTimeout(f,1500);
  if(!roH&&window.ResizeObserver){roH=true;new ResizeObserver(f).observe(document.getElementById('stk'));}}}
function wlSync(){try{window.dispatchEvent(new CustomEvent('dkwl'));}catch(e){}}

// ------------------------------------------------------------------ sections
function topCard(d,u){
  var q=d.q||{},rs=d.rs||{},nm=d.name||(u&&u.name)||'',st=d.state;
  var price=num(q.px)?q.px:(u&&u.px);
  var chips=[];
  if(num(q.d1)||(u&&num(u.d1)))chips.push(chip('1D '+pc(num(q.d1)?q.d1:u.d1)));
  if(num(q.w1)||(u&&num(u.w1)))chips.push(chip('1W '+pc(num(q.w1)?q.w1:u.w1)));
  var r=num(rs.rating)?rs.rating:(u&&u.rs);
  chips.push(num(r)?chip('RS <b>'+r+'</b>'+(num(rs.rank)?' #'+rs.rank+(rs.of?'/'+rs.of:''):''),rsCls(r),'Desk IBD-style RS rating (our calc, not IBD\'s)'):chip('RS —','', 'not RS-ranked'));
  var tt=d.tt_pass!=null?d.tt_pass:(u?u.tt:null);
  if(tt!=null)chips.push(chip('Trend template '+(tt?'✓ pass':'✗ fail'),tt?'g':'r'));
  var links=[wlBtn(T)];
  if(d.chart==='page'||(u&&u.chart===1))links.push('<a class="dk-btn ghost" href="charts/'+esc(T)+'.html">🕹️ Trade chart</a>');
  var b=d.biz||{};
  if(b.cik)links.push('<a class="dk-btn ghost" href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK='+esc(b.cik)+'&owner=include&count=40" target="_blank" rel="noopener">SEC EDGAR ↗</a>');
  if(b.website)links.push('<a class="dk-btn ghost" href="'+esc(/^https?:/.test(b.website)?b.website:'https://'+b.website)+'" target="_blank" rel="noopener nofollow">Website ↗</a>');
  var sub=[d.exch||'',d.type==='ADRC'?'ADR':d.type==='CS'?'common stock':(d.type||''),b.sector||'',b.industry||b.sic_desc||''].filter(Boolean).map(esc).join(' · ');
  return '<div class="stk-id"><div class="stk-tkrow"><h1 class="stk-tk">'+esc(T)+'</h1>'+state(st)+'</div><div class="stk-nm">'+esc(nm)+'</div>'+
    (sub?'<div class="stk-sub">'+sub+'</div>':'')+
    '<div class="stk-px"><b>'+px(price)+'</b><span>'+((q.date||(u&&u.last_date))?'close '+dshort(q.date||u.last_date):(u&&window.DKU?'close '+dshort(DKU.session):''))+'</span></div>'+
    '<div class="stk-chips">'+chips.join('')+'</div><div class="stk-links">'+links.join('')+'</div></div>';
}
function statGrid(d){
  var q=d.q||{},rs=d.rs||{},b=d.biz||{};
  function s(l,v,n){return '<div class="stk-st"><small>'+l+'</small><b>'+v+'</b>'+(n?'<i>'+n+'</i>':'')+'</div>';}
  var h=[
    s('RS rating',num(rs.rating)?rs.rating:'—',num(rs.rank)?'rank '+rs.rank+' of '+(rs.of||'?')+(num(rs.chg_1w)?' · 1W '+(rs.chg_1w>0?'+':'')+rs.chg_1w:''):'not ranked'),
    s('Off 52-wk high',pc(q.off_hi),'high '+px(q.hi52)+(q.window&&q.window<252?' ('+q.window+' bars)':'')),
    s('Above 52-wk low',pc(q.above_lo),'low '+px(q.lo52)),
    s('Relative volume',num(q.rvol)?q.rvol.toFixed(2)+'×':'—','vol '+cnt(q.vol)+' vs 50d avg '+cnt(q.avgvol50)),
    s('ADR (20d)',num(q.adr20)?q.adr20.toFixed(2)+'%':'—','avg daily range'),
    s('Avg $ volume 50d',big(q.dv50),''),
    s('Market cap',big(b.mcap),b.mcap_src?esc(b.mcap_src):''),
    s('Shares out',cnt(b.shares),b.shares_src?esc(b.shares_src):''),
    s('1M / 3M',pc(q.m1)+' / '+pc(q.m3),''),
    s('6M / YTD',pc(q.m6)+' / '+pc(q.ytd),''),
  ];
  var hist=(rs.hist||[]);
  var spark='';
  if(hist.length>3){var W=300,H=46,n=hist.length,pts=hist.map(function(p,i){return [(i/(n-1))*W,H-3-(p[1]/99)*(H-6)];});
    var dd=pts.map(function(p,i){return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1);}).join('');
    var y70=H-3-(70/99)*(H-6),y90=H-3-(90/99)*(H-6);
    spark='<div class="stk-rsh"><div class="stk-rsh-h"><small>RS rating history · '+n+' sessions ('+esc(hist[0][0])+' → '+esc(hist[n-1][0])+')</small><b>'+hist[n-1][1]+'</b></div>'+
      '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-label="RS rating history"><line x1="0" x2="'+W+'" y1="'+y90+'" y2="'+y90+'" class="g90"/><line x1="0" x2="'+W+'" y1="'+y70+'" y2="'+y70+'" class="g70"/><path d="'+dd+'"/></svg>'+
      '<small class="mut">dashed: 90 and 70 · '+esc(rs.label||'desk RS')+'</small></div>';}
  return sec('stats','📊 Key stats','prices as of '+dshort(q.date)+' US close · '+esc(d.q_src||''),'<div class="stk-grid">'+h.join('')+'</div>'+spark);
}
function ttSec(d){
  if(!d.tt||!d.tt.length)return '';
  var ok=d.tt.filter(function(x){return x[1]===true;}).length;
  var li=d.tt.map(function(x){return '<li class="'+(x[1]===true?'ok':x[1]===false?'no':'na')+'"><span>'+(x[1]===true?'✓':x[1]===false?'✗':'–')+'</span><div><b>'+esc(x[0])+'</b><small>'+esc(x[2]||'')+'</small></div></li>';}).join('');
  return sec('tt','✅ Trend template',ok+' of '+d.tt.length+' · Minervini criteria on closes'+(d.tt_pass!=null?' · desk verdict: <b>'+(d.tt_pass?'PASS':'FAIL')+'</b>':''),'<ul class="stk-tt">'+li+'</ul>');
}
function deskSec(d){
  var k=d.desk||{},h=[];
  if(k.watch){var w=k.watch;h.push('<div class="stk-dk"><h4>Desk watchlist</h4><p><b>'+esc(w.status||'')+'</b> · '+esc(w.setup||'')+' · pivot <b>'+esc(w.pivot_raw||'—')+'</b> · stop <b>'+(num(w.stop)?w.stop.toFixed(2):'—')+'</b>'+(w.first_flagged?' · on list since '+esc(w.first_flagged):'')+'</p>'+(w.note?'<p class="mut">Note: '+esc(w.note)+'</p>':'')+'</div>');}
  if(k.radar)h.push('<div class="stk-dk"><h4>On the desk radar</h4><p>'+esc(k.radar)+'</p></div>');
  if(k.alert&&k.alert.state)h.push('<div class="stk-dk"><h4>Price alert state</h4><p>'+state([k.alert.state,'s-'+k.alert.state.toLowerCase().replace(/[^a-z]+/g,'-')])+' '+esc(k.alert.detail||'')+(k.alert.since?' <small>since '+esc(k.alert.since)+'</small>':'')+'</p></div>');
  if(k.setups&&k.setups.length)h.push('<div class="stk-dk"><h4>Setup scanners <small>'+esc(k.setups_asof||'')+'</small></h4><ul>'+k.setups.map(function(s){return '<li><b>'+esc(s.k)+'</b> '+esc(s.status||'')+(s.tf?' · '+esc(s.tf):'')+(num(s.pivot)?' · pivot '+s.pivot.toFixed(2):'')+(num(s.stop)?' · stop '+s.stop.toFixed(2):'')+(s.actionable?' · <span class="dk-up">actionable</span>':'')+(s.date?' <small>'+esc(s.date)+'</small>':'')+'</li>';}).join('')+'</ul></div>');
  if(k.highs){var x=k.highs;h.push('<div class="stk-dk"><h4>New highs monitor</h4><p>'+(x.new_ath?'<b class="dk-up">New all-time high</b> · ':'')+(x.new_52w?'<b class="dk-up">New 52-week high</b>':'')+(num(x.pct_above_52w)?' · '+x.pct_above_52w.toFixed(2)+'% above the prior 52-wk high '+px(x.prior_52w_high)+' ('+esc(x.prior_52w_high_date||'')+')':'')+'</p></div>');}
  if(k.movers){var m=k.movers,L={'1d':'1D','1w':'1W','1m':'1M','qtr':'QTR','ytd':'YTD'};h.push('<div class="stk-dk"><h4>Top Movers ranks <small>'+esc(k.movers_asof||'')+'</small></h4><p>'+Object.keys(m).map(function(p){var r=m[p];return chip(L[p]+' #'+r.rank+' '+(r.side==='gainers'?'▲':'▼')+' '+pc(r.chg),r.side==='gainers'?'g':'r');}).join(' ')+'</p></div>');}
  if(k.vsa){var v=k.vsa,ls=v.last_sign;h.push('<div class="stk-dk"><h4>Wyckoff / VSA read <small>'+esc(v.label||'')+(v.asof?' · '+esc(v.asof):'')+'</small></h4>'+
    '<p>'+(v.headline?'<b>'+esc(v.headline)+'</b>':'')+(v.balance?' · balance <b>'+esc(v.balance)+'</b>':'')+(num(v.score)?' ('+v.score+')':'')+'</p>'+
    (ls?'<p>Last notable sign: <b class="'+(ls.pol>0?'dk-up':ls.pol<0?'dk-dn':'')+'">'+esc(ls.name)+'</b> '+esc(ls.d||'')+(ls.tier?' · '+esc(ls.tier)+' significance':'')+(ls.why?'<br><small>'+esc(ls.why)+(ls.ref?' ('+esc(ls.ref)+')':'')+'</small>':'')+'</p>':'')+
    (v.key_bars&&v.key_bars.length?'<p class="stk-kb">'+v.key_bars.map(function(s){return chip(esc(s.name)+' '+esc((s.d||'').slice(5)),s.pol>0?'g':s.pol<0?'r':'');}).join(' ')+'</p>':'')+
    (v.narrative?'<details><summary>Story</summary><p>'+esc(v.narrative)+'</p></details>':'')+'<p><a href="vsa.html">VSA page →</a></p></div>');}
  if(k.scores){var sc=k.scores;h.push('<div class="stk-dk"><h4>Desk scores</h4><p>'+(num(sc.earn)?'earnings score <b>'+sc.earn+'</b> · ':'')+(sc.group?esc(sc.group)+(num(sc.group_rank)?' · group rank '+sc.group_rank+'/'+sc.group_n:''):'')+(num(sc.sector_rank)?' · sector rank '+sc.sector_rank+'/'+sc.sector_n:'')+(sc.ai_tag?' · '+esc(sc.ai_tag):'')+'</p></div>');}
  if(!h.length)h.push('<p class="mut">No desk setup, alert or notes for '+esc(T)+' right now.</p>');
  return sec('desk','🎯 Desk read','setup / state, notes, VSA and ranks from the desk feeds',h.join(''));
}
function finSec(d){
  var f=d.fin||{},h='';
  var ne=d.next_earn;
  var earnLine='<div class="stk-earn"><div><small>Next earnings</small><b>'+(ne?dshort(ne.date):'not known')+'</b>'+(ne?(ne.status==='confirmed'?chip('confirmed','g',ne.src):chip(esc(ne.status),'y',ne.src)):'')+'</div>'+
    '<div><small>Last report</small><b>'+(d.last_earn?dshort(d.last_earn):'—')+'</b></div></div>'+(ne?'<p class="mut stk-src">'+esc(ne.src)+'</p>':'');
  if(!f.available){return sec('earnings','💰 Earnings','',earnLine+'<p class="dk-note">'+esc(f.note||'No earnings history available from SEC XBRL for this filer (e.g. foreign filers on 20-F/6-K without quarterly XBRL).')+'</p>');}
  var fl=(f.flags||[]).map(function(x){return chip((x[0]==='up'?'▲ ':'▼ ')+esc(x[1]),x[0]==='up'?'g':'r',x[2]);}).join(' ');
  var fd=(f.flags||[]).map(function(x){return '<li class="'+(x[0]==='up'?'dk-up':'dk-dn')+'">'+esc(x[1])+' <small>'+esc(x[2])+'</small></li>';}).join('');
  var qr=(f.q||[]).slice().reverse().map(function(r){var dv=(r.derived||[]).length?' <sup title="Q4 derived: fiscal year minus 9-month YTD">d</sup>':'';
    return '<tr><td>'+qlabel(r.end)+dv+'</td><td class="r">'+big(r.rev)+'</td><td class="r">'+pc(r.rev_yoy,0)+'</td><td class="r">'+eps(r.eps)+'</td><td class="r">'+pc(r.eps_yoy,0)+'</td><td class="r">'+(num(r.nm)?r.nm.toFixed(1)+'%':'—')+'</td></tr>';}).join('');
  var ar=(f.a||[]).slice().reverse().map(function(r){return '<tr><td>FY '+qlabel(r.end)+'</td><td class="r">'+big(r.rev)+'</td><td class="r">'+pc(r.rev_yoy,0)+'</td><td class="r">'+eps(r.eps)+'</td><td class="r">'+pc(r.eps_yoy,0)+'</td><td class="r">'+(num(r.nm)?r.nm.toFixed(1)+'%':'—')+'</td></tr>';}).join('');
  var head='<thead><tr><th>Period</th><th class="r">Revenue</th><th class="r">YoY</th><th class="r">EPS dil.</th><th class="r">YoY</th><th class="r">Net mgn</th></tr></thead>';
  h=earnLine+(fl?'<div class="stk-flags">'+fl+'</div>':'')+
    '<h3>Quarterly <small>last '+(f.q||[]).length+' quarters, newest first</small></h3><div class="tscroll"><table class="dk-tbl stk-fin">'+head+'<tbody>'+qr+'</tbody></table></div>'+
    (ar?'<h3>Annual</h3><div class="tscroll"><table class="dk-tbl stk-fin">'+head+'<tbody>'+ar+'</tbody></table></div>':'')+
    (fd?'<details><summary>Acceleration flags explained</summary><ul class="stk-fl">'+fd+'</ul><p class="mut">Minervini-style checks on YoY growth of the last 3 quarters (EPS diluted, revenue) and net margin. Code 33 = all three accelerating.</p></details>':'')+
    (f.desk_score&&f.desk_score.bullets?'<div class="stk-dk"><h4>Desk earnings read <small>'+esc((f.desk_score.tags||[]).join(' · '))+'</small></h4><ul>'+f.desk_score.bullets.map(function(b){return '<li>'+esc(b)+'</li>';}).join('')+'</ul></div>':'')+
    '<p class="mut stk-src">Source: '+esc(f.src)+(f.entity?' ('+esc(f.entity)+')':'')+', fetched '+esc(f.asof||'?')+'. YoY vs the quarter ~1 year earlier; "turned +" = loss a year ago. <sup>d</sup> '+esc(f.derived_note||'')+'. Net margin = net income ÷ revenue.</p>';
  return sec('earnings','💰 Earnings','revenue, EPS (diluted), YoY growth, margins',h);
}
function estSec(d){
  var e=d.est||{};
  if(!e.available)return sec('estimates','🔮 Estimates','',' <p class="dk-note">'+esc(e.note||'No estimates available.')+'</p>');
  var er=(e.eps||[]).map(function(r){return '<tr><td>'+esc(r.label)+'</td><td class="r">'+eps(r.avg)+'</td><td class="r">'+(num(r.low)?eps(r.low)+'–'+eps(r.high):'—')+'</td><td class="r">'+eps(r.yearAgoEps)+'</td><td class="r">'+pc(num(r.growth)?r.growth*100:null,0)+'</td><td class="r">'+(num(r.numberOfAnalysts)?r.numberOfAnalysts:'—')+'</td></tr>';}).join('');
  var rr=(e.rev||[]).map(function(r){return '<tr><td>'+esc(r.label)+'</td><td class="r">'+big(r.avg)+'</td><td class="r">'+big(r.yearAgoRevenue)+'</td><td class="r">'+pc(num(r.growth)?r.growth*100:null,0)+'</td><td class="r">'+(num(r.numberOfAnalysts)?r.numberOfAnalysts:'—')+'</td></tr>';}).join('');
  var sp=(e.surprises||[]).slice().reverse().map(function(s){return '<tr><td>'+qlabel(s.quarter)+'</td><td class="r">'+eps(s.actual)+'</td><td class="r">'+eps(s.estimate)+'</td><td class="r">'+pc(num(s.surprise_pct)?s.surprise_pct*100:null,1)+'</td></tr>';}).join('');
  var tr='';
  if(e.trend&&e.trend['0y']){var t=e.trend['0y'];tr='<p>FY EPS estimate trend: now '+eps(t.current)+' · 30 days ago '+eps(t['30daysAgo'])+' · 90 days ago '+eps(t['90daysAgo'])+(e.revisions&&e.revisions['0y']?' · revisions last 30 days ▲'+(e.revisions['0y'].upLast30days||0)+' ▼'+(e.revisions['0y'].downLast30days||0):'')+'</p>';}
  return sec('estimates','🔮 Estimates','consensus · '+esc(e.src)+' · as of '+esc(e.asof||'?'),
    '<div class="tscroll"><table class="dk-tbl"><thead><tr><th>EPS</th><th class="r">Avg</th><th class="r">Range</th><th class="r">Yr ago</th><th class="r">Growth</th><th class="r">#</th></tr></thead><tbody>'+er+'</tbody></table></div>'+
    (rr?'<div class="tscroll"><table class="dk-tbl"><thead><tr><th>Revenue</th><th class="r">Avg</th><th class="r">Yr ago</th><th class="r">Growth</th><th class="r">#</th></tr></thead><tbody>'+rr+'</tbody></table></div>':'')+tr+
    (sp?'<h3>Recent surprises</h3><div class="tscroll"><table class="dk-tbl"><thead><tr><th>Quarter</th><th class="r">Actual</th><th class="r">Est.</th><th class="r">Surprise</th></tr></thead><tbody>'+sp+'</tbody></table></div>':'')+
    '<p class="mut stk-src">'+esc(e.caveat||'')+(e.kept_from?' Some fields kept from the '+esc(e.kept_from)+' fetch (source returned empty).':'')+(e.currency&&e.currency!=='USD'?' Currency: '+esc(e.currency)+'.':'')+'</p>');
}
function bizSec(d){
  var b=d.biz||{},rows=[];
  function r(l,v){if(v)rows.push('<tr><th>'+l+'</th><td>'+v+'</td></tr>');}
  r('Sector / industry',esc([b.sector,b.industry].filter(Boolean).join(' · ')));
  r('SEC SIC',esc((b.sic?b.sic+' ':'')+(b.sic_desc||'')));
  r('Market cap',b.mcap?big(b.mcap)+' <small>'+esc(b.mcap_src||'')+'</small>':'');
  r('Shares outstanding',b.shares?cnt(b.shares)+' <small>'+esc(b.shares_src||'')+'</small>':'');
  r('Headquarters',esc(b.hq||''));
  r('Website',b.website?'<a href="'+esc(/^https?:/.test(b.website)?b.website:'https://'+b.website)+'" target="_blank" rel="noopener nofollow">'+esc(b.website.replace(/^https?:\/\//,''))+'</a>':'');
  r('Employees',num(b.employees)?b.employees.toLocaleString():'');
  r('Listed',esc(b.list_date||'')+(b.exchange?' · '+esc(b.exchange):''));
  r('Fiscal year end',b.fy_end?esc(b.fy_end.slice(0,2)+'/'+b.fy_end.slice(2)):'');
  r('Incorporated',esc(b.state_inc||''));
  r('SEC CIK',b.cik?'<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK='+esc(b.cik)+'" target="_blank" rel="noopener">'+esc(b.cik)+'</a>':'');
  var src=[b.desc_src?'description: '+b.desc_src:'',b.massive_asof?'Massive ticker details '+b.massive_asof:(b.massive_note||''),b.sec_asof?'SEC EDGAR submissions '+b.sec_asof:''].filter(Boolean).map(esc).join(' · ');
  return sec('business','🏢 Business overview','what it does',(b.desc?'<p class="stk-desc">'+esc(b.desc)+'</p>':'<p class="mut">No company description fetched yet.</p>')+
    '<div class="tscroll"><table class="dk-tbl stk-kv"><tbody>'+rows.join('')+'</tbody></table></div><p class="mut stk-src">'+src+'</p>');
}
function filSec(d){
  var f=d.filings||{},I=d.items_8k||{};
  if(!f.available)return sec('filings','📑 SEC filings','','<p class="mut">'+esc(f.note||'')+'</p>');
  var li=(f.recent||[]).map(function(x){var it=(x.items||'').split(',').filter(Boolean).map(function(i){i=i.trim();return I[i]?i+' '+I[i]:i;}).join(', ');
    return '<li><span class="stk-fd">'+esc(x.d)+'</span> <a href="'+esc(x.url)+'" target="_blank" rel="noopener"><b>'+esc(x.f)+'</b></a> <small>'+esc(it||x.desc||(x.r?'period '+x.r:''))+'</small></li>';}).join('');
  var f4=f.f4||{},ins=f.insider;
  var ih='<div class="stk-dk"><h4>Insider activity (Form 4)</h4><p><b>'+(f4.n90||0)+'</b> Form 4 filing'+(f4.n90===1?'':'s')+' in the last 90 days'+(f4.last?' · latest '+esc(f4.last):'')+(f4.url?' · <a href="'+esc(f4.url)+'" target="_blank" rel="noopener">EDGAR list ↗</a>':'')+'</p>'+
    (ins?'<p>Desk insider tracker: '+ins.n+' transactions · '+ins.buys+' open-market buys ('+big(ins.buy_value)+') · '+ins.sells+' sales ('+big(ins.sell_value)+')'+(ins.plan_10b5_1?' · '+ins.plan_10b5_1+' under 10b5-1 plans':'')+'</p><ul>'+(ins.latest||[]).map(function(x){return '<li>'+esc(x.date)+' · '+esc(x.insider)+' <small>'+esc(x.role||'')+'</small> · '+(x.code==='P'?'<span class="dk-up">buy</span>':x.code==='S'?'<span class="dk-dn">sale</span>':esc(x.code))+' '+cnt(x.shares)+(num(x.price)?' @ '+px(x.price):'')+(x.plan_10b5_1?' <small>10b5-1</small>':'')+'</li>';}).join('')+'</ul><p class="mut stk-src">'+esc(ins.src)+'</p>':
     '<p class="mut">Buy/sell detail is parsed only for desk-tracked names (Insiders page); this is the filing count from EDGAR.</p>')+'</div>';
  return sec('filings','📑 SEC filings','8-K · 10-Q · 10-K · as of '+esc(f.asof||'?'),'<ul class="stk-fil">'+(li||'<li class="mut">no recent periodic / current reports</li>')+'</ul>'+ih+
    (f.edgar?'<p><a href="'+esc(f.edgar)+'" target="_blank" rel="noopener">All filings on SEC EDGAR ↗</a></p>':''));
}
function resSec(d){
  var r=d.research||[];
  if(!r.length)return sec('research','📚 Desk research','','<p class="mut">No desk research profile or daily-report mention of '+esc(T)+' yet.</p>');
  return sec('research','📚 Desk research',r.length+' link'+(r.length===1?'':'s'),'<ul class="stk-res">'+r.map(function(x){return '<li><a href="'+esc(x.url)+'"><b>'+esc(x.title)+'</b></a> <small>'+esc(x.kind)+(x.mentions?' · '+x.mentions+' mention'+(x.mentions===1?'':'s'):'')+'</small>'+(x.excerpt?'<br><small class="mut">“'+esc(x.excerpt)+'”</small>':'')+'</li>';}).join('')+'</ul>');
}
function toc(){var a=[['stats','Stats'],['tt','Trend'],['desk','Desk'],['earnings','Earnings'],['estimates','Estimates'],['business','Business'],['filings','Filings'],['research','Research']];
  return '<nav class="stk-toc">'+a.map(function(x){return '<a href="#'+x[0]+'">'+x[1]+'</a>';}).join('')+'</nav>';}

// ------------------------------------------------------------------ fallback from the universe index
function uniRow(){return get('data/universe.json').then(function(r){return r.json();}).then(function(U){window.DKU=U;var c=U.cols,row=null;
  for(var i=0;i<U.rows.length;i++){if(U.rows[i][0]===T){row=U.rows[i];break;}}
  if(!row)return null;var o={};c.forEach(function(k,i){o[k]=row[i];});return o;});}

function render(d){
  $('stk-top').innerHTML=topCard(d,null);setTimeout(wlSync,0);
  $('stk-body').innerHTML=toc()+statGrid(d)+ttSec(d)+deskSec(d)+finSec(d)+estSec(d)+bizSec(d)+filSec(d)+resSec(d)+
    '<p class="mut stk-src">Built '+esc((d.generated||'').replace('T',' ').slice(0,16))+' (Sydney) by research-tools/stock_data.py · covered because: '+esc((d.covered||[]).join(', '))+'.</p>';
}
function renderLite(u){
  if(!u){$('stk-top').innerHTML='<div class="dk-panel"><h1>'+esc(T)+'</h1><p>'+esc(T)+' is not in the desk universe (US common stocks &amp; ADRs on NYSE / Nasdaq / NYSE American from the RS reference list). Check the symbol, or try the search box.</p></div>';$('stk-chart').hidden=true;return;}
  setTimeout(wlSync,0);$('stk-top').innerHTML=topCard({name:u.name,state:u.state?[u.state,u.cls]:null,tt_pass:u.tt,q:{},rs:{},chart:u.chart===1?'page':u.chart===2?'json':null},u);
  $('stk-body').innerHTML='<div class="dk-note stk-pending"><b>Full rundown pending.</b> '+esc(T)+' is not in the nightly covered set yet (desk watchlist, setups, RS top 150, new highs, top movers, chart pages, <code>research-tools/custom_tickers.txt</code>). '+
    'Showing what is published now: name, last close, 1D / 1W, RS and trend template. The full page (business overview, earnings, estimates, filings) is added on the next nightly run once the ticker is in the covered set: ask the desk to add it to custom_tickers.txt.</div>';
}

if(MINI){
  // chart only (VSA dropdowns): the chart page's TC_DATA, else the chart JSON, else a note. No universe.json fetch (kept light).
  $('stk-top').innerHTML='';$('stk-body').innerHTML='';
  chartFrom('page').then(function(c){return c||chartFrom('json');}).then(function(c){
    if(!c)noChart('<b>No chart data published for '+esc(T)+'.</b> Charts are drawn for the desk\'s covered set (watchlist, setups, RS leaders, VSA names); this ticker has none yet. <a href="stock.html?t='+esc(T)+'" target="_top">Stock page →</a>');
  });
  window.addEventListener('resize',postH);
  return;
}
get('data/stock/'+encodeURIComponent(T)+'.json').then(function(r){return r.json();}).then(function(d){
  render(d);
  return chartFrom(d.chart).then(function(c){if(!c)noChart('No chart data published for '+esc(T)+' yet (it is added with the next nightly run).');});
}).catch(function(){
  return uniRow().then(function(u){renderLite(u);if(u)return chartFrom(u.chart).then(function(c){if(!c)noChart('No chart yet for '+esc(T)+': charts are drawn for the covered set (added on the next nightly run).');});});
});
})();
