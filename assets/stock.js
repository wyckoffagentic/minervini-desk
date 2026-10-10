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
// ma_stack.html rows (ov=mastack, research-tools/ma_stack.py -> data/ma_stack/<T>.json): EMA 10/20/50 lines + markers (fresh EMA10 cross,
// GUD no-supply / undercut-reclaim bars) + for GUD rows the plan as the chart's own Entry / Stop / 2R / 3R lines (LAYERS + TEXT apply).
var MSX=null,MSV=(P.get('msv')||'').replace(/[^a-z0-9]/g,'');   // &msv=sbd|sbw: SPRING -> BULL row variant (its own markers + plan)
function msx(){if(OVM!=='mastack')return Promise.resolve(null);if(!MSX)MSX=get('data/ma_stack/'+encodeURIComponent(T)+'.json').then(function(r){return r.json();}).catch(function(){return null;});return MSX;}
function msApply(D,ms){var out=[];if(!ms)return out;
  if(MSV&&ms.variants&&ms.variants[MSV]){var vv=ms.variants[MSV];ms={ema:ms.ema,plan:vv.plan,vlabel:vv.label,marks:(ms.marks||[]).filter(function(m){return m.g==='ns'||m.g==='ur';}).concat(vv.marks||[])};}var first=(D.bars&&D.bars.length)?D.bars[0][0]:null;
  var E=ms.ema||{},d=E.d||[],cols={e10:'#ff7ad9',e20:'#7aa2ff',e50:'#ffd23f'},it=[];
  ['e10','e20','e50'].forEach(function(k){var v=E[k]||[];for(var i=1;i<d.length;i++){if(v[i]==null||v[i-1]==null||(first&&d[i-1]<first))continue;
    it.push({t:'seg',d0:d[i-1],p0:v[i-1],d1:d[i],p1:v[i],c:cols[k],w:k==='e50'?1.8:1.4});}});
  if(it.length)out.push({id:'ema_stack',label:'EMA 10 / 20 / 50 (daily closes)',color:cols.e10,legend:[[cols.e10,'EMA10'],[cols.e20,'EMA20'],[cols.e50,'EMA50']],items:it});
  var vis=(ms.marks||[]).filter(function(m){return !first||m.d>=first;}),pt=function(m){return {t:'point',d:m.d,p:m.p,label:m.label,pos:m.pos,c:m.c};};
  var mk=vis.filter(function(m){return m.g!=='ns'&&m.g!=='ur';}).map(pt),nk=vis.filter(function(m){return m.g==='ns';}).map(pt),uk=vis.filter(function(m){return m.g==='ur';}).map(pt);
  if(mk.length)out.push({id:'ma_marks',label:ms.vlabel?ms.vlabel+': spring bar + EMA10 cross':ms.plan?'GUD: no supply / undercut reclaim bars':'MA Stack signal bars',color:ms.plan?'#ffd23f':'#39ff88',items:mk});
  if(nk.length)out.push({id:'ma_ns',label:'NS: no supply in the 10/20 zone (notation)',color:'#ffd23f',items:nk});
  if(uk.length)out.push({id:'ma_ur',label:'UR: undercut reclaim in the 10/20 zone (notation)',color:'#00e5ff',items:uk});
  var pl=ms.plan;
  if(pl&&pl.entry!=null&&pl.stop!=null&&pl.entry>pl.stop){var R=pl.entry-pl.stop,rp=R/pl.entry*100,tfw={D:'daily',W:'weekly',M:'monthly'}[pl.tf]||pl.tf;
    D.entry=pl.entry;D.stop=pl.stop;D.pnl=pl.pnl||null;D.risk=R;D.risk_pct=pl.risk_pct;D.r2=pl.r2;D.r3=pl.r3;D.no_levels=false;
    if(ms.vlabel){D.entry_src=ms.vlabel+' plan: buy stop at the '+tfw+' EMA10 cross bar high ('+pl.rc_date+')';D.stop_src=ms.vlabel+' plan: spring low (structure stop)';}else{D.entry_src='GUD plan: buy stop at the '+tfw+' undercut-reclaim bar high ('+(pl.tf==='D'?pl.rc_date:pl.rc_start)+')';D.stop_src='GUD plan: '+tfw+' undercut-reclaim bar low';}D.r_src='entry + 2R / entry + 3R';
    D.risk_plan={default:0.75,min:0.5,max:1,tier:0.75,short:'MA STACK GUD PLAN',reasons:['0.75% desk default risk; the MA Stack page sizes a $100,000 placeholder account'],
      stop_pct:rp,size_pct:{'0.5':0.5/rp*100,'0.75':0.75/rp*100,'1':1/rp*100},m05:pl.m05,m10:pl.m10};}
  return out;}
// wyckoff_structure.html rows (ov=wyckoff, research-tools/wyckoff_structure.py -> data/wyckoff/<T>.json): the trading-range box, the dated
// Wyckoff events (SC / AR / ST / spring / test / SOS / LPS / UT / UTAD / SOW / LPSY), cause & effect targets and, on ticket cards (&wt=long|short),
// the ticket's entry / hard stop / trailing stop / 2R / 3R lines.  NO moving averages: D.no_ma (charts.js hides SMA lines/legend/layer for this
// chart only) and the RS-rating panel (it carries a 21-day MA of the rating) is dropped.  &wv=d|w picks the daily or the weekly structure (weekly: drawn on the weekly bars shipped in data/wyckoff/<T>.json 'wb').
var WYX=null,WYV=(P.get('wv')||'d').replace(/[^a-z]/g,''),WYT=(P.get('wt')||'').replace(/[^a-z]/g,'');
function wyx(){if(OVM!=='wyckoff')return Promise.resolve(null);if(!WYX)WYX=get('data/wyckoff/'+encodeURIComponent(T)+'.json').then(function(r){return r.json();}).catch(function(){return null;});return WYX;}
function wyApply(D,wy){var out=[];if(!wy)return out;var st=(WYV==='w'?wy.w:wy.d)||wy.d||wy.w,bs=D.bars||[],last=bs.length?bs[bs.length-1][0]:null,lc=bs.length?bs[bs.length-1][4]:null;
  var far=function(p){return lc&&Math.abs(p/lc-1)>0.5;};D._wyfar=[];
  if(st){var acc=st.side==='acc',col=acc?'#39ff88':'#ff3d7f',it=[];
    it.push({t:'box',d0:st.d0,d1:st.d1||last,lo:st.bottom,hi:st.top,c:col,fill:acc?'rgba(57,255,136,.07)':'rgba(255,61,127,.07)',label:(st.tf==='W'?'WEEKLY ':'')+String(st.sub||'').toUpperCase()+' · PHASE '+st.phase});
    it.push({t:'hline',d0:st.d0,p:st.top,c:'#00e5ff',w:1.2,dash:[5,3],label:'RANGE TOP'+(acc?' / CREEK ':' ')+st.top.toFixed(2)});
    it.push({t:'hline',d0:st.d0,p:st.bottom,c:'#ff9f1c',w:1.2,dash:[5,3],label:'RANGE BOTTOM'+(acc?' ':' / ICE ')+st.bottom.toFixed(2)});
    out.push({id:'wy_range',label:'Trading range ('+(st.tf==='W'?'weekly':'daily')+' structure)',color:col,items:it});
    var ev=(st.events||[]).map(function(e){return {t:'point',d:e.d,p:e.p,label:e.label,pos:e.pos,c:e.c,tip:e.tip};});
    if(ev.length)out.push({id:'wy_events',label:'Wyckoff events (dated)',color:'#ffd23f',items:ev});
    var ce=st.ce||{},ci=[],d0=st.d1||last;
    [['cons','C&E CONS ',ce.cons],['agg','C&E AGG ',ce.agg]].forEach(function(a){if(a[2]==null)return;if(far(a[2])){D._wyfar.push(a[1]+a[2].toFixed(2));return;}
      ci.push({t:'hline',d0:d0,p:a[2],c:a[0]==='cons'?'#b388ff':'#ff2bd6',w:1.3,dash:[2,4],label:a[1]+a[2].toFixed(2)});});
    if(ci.length)out.push({id:'wy_ce',label:'Cause & effect targets (P&F count / range height)',color:'#b388ff',items:ci});
    D._wy=st;}
  var tks=(wy.tickets||[]).filter(function(k){return WYT&&k.side===WYT;});
  if(tks.length){var k=tks[0],ti=[],d0=k.signal_date;
    [['ENTRY ',k.entry,'#00e5ff'],['HARD STOP ',k.hard_stop,'#ff2a2a'],['2R ',k.r2,'#39ff14'],['3R ',k.r3,'#ffd700']].forEach(function(a){if(a[1]==null)return;if(far(a[1])){D._wyfar.push(a[0]+a[1].toFixed(2));return;}
      ti.push({t:'hline',d0:d0,p:a[1],c:a[2],w:1.6,label:a[0]+a[1].toFixed(2)});});
    if(k.stop!=null&&Math.abs(k.stop-k.hard_stop)>1e-6)ti.push({t:'hline',d0:k.triggered||d0,p:k.stop,c:'#ff9f1c',w:1.8,dash:[6,3],label:'TRAIL STOP '+k.stop.toFixed(2)});
    if(ti.length)out.push({id:'wy_ticket',label:(k.side==='long'?'Long':'Short')+' ticket levels ('+k.status+')',color:'#00e5ff',items:ti});D._wyt=k;}
  return out;}
function chartFrom(kind){
  var p;
  if(kind==='page'||kind===1){
    p=get('charts/'+encodeURIComponent(T)+'.html').then(function(r){return r.text();}).then(function(h){
      var doc=new DOMParser().parseFromString(h,'text/html'),D=null;
      doc.querySelectorAll('script').forEach(function(s){var x=s.textContent,i=x.indexOf('window.TC_DATA=');if(i>=0&&!D){var j=x.lastIndexOf(';');D=JSON.parse(x.slice(i+15,j>i?j:x.length));}});
      var rb=doc.getElementById('tc-rsb');return {tc:D,rsb:rb?rb.outerHTML:'',page:true};});
  }else if(kind==='json'||kind===2){p=get('data/chart/'+encodeURIComponent(T)+'.json').then(function(r){return r.json();});}
  else return Promise.resolve(null);
  return Promise.all([p,msx(),wyx()]).then(function(pa){var c=pa[0],ms=pa[1],wy=pa[2];
    if(!c||!c.tc||!c.tc.bars)return null;
    // ONE chart module (4 Oct 2026, Chris: "every ticker dropdown opens the full chart setup"): the stock page and every inline dropdown draw the
    // chart page's own payload unchanged - same levels, plans, R-mult / % from entry, RISK box, HP/XP meter, overlays, legend, notes, RS box.
    // A page's context only ADDS: MA Stack rows their EMA 10/20/50 lines + signal bars (and the GUD plan as the levels when the chart has none);
    // Wyckoff Structure rows the range box / events / C&E / ticket lines, drawn without moving averages (that page's rule).
    var tc=c.tc,ctxo=[];
    if(OVM==='mastack'&&ms){var hadLv=tc.entry!=null&&!tc.no_levels,keepD={};if(hadLv)['entry','stop','pnl','risk','risk_pct','r2','r3','no_levels','entry_src','stop_src','r_src','risk_plan'].forEach(function(k){keepD[k]=tc[k];});
      ctxo=msApply(tc,ms);if(hadLv)Object.keys(keepD).forEach(function(k){tc[k]=keepD[k];});}
    if(OVM==='wyckoff'&&wy){['sma50','sma150','sma200'].forEach(function(k){tc[k]=null;});tc.no_ma=true;if(tc.rs)tc.rs.hist=null;
      if(WYV==='w'&&wy.wb&&wy.wb.bars&&wy.wb.bars.length){tc.bars=wy.wb.bars;tc.vol=wy.wb.vol;tc.wk=true;}ctxo=wyApply(tc,wy);
      var w=tc._wy;if(w&&ctxo.length)ctxo[0].note='Range '+w.bottom.toFixed(2)+' – '+w.top.toFixed(2)+' · '+(w.sub||'')+' · phase '+w.phase+(w.ce&&w.ce.cons!=null?' · C&E '+w.ce.cons.toFixed(2)+' / '+w.ce.agg.toFixed(2):'')+
        (tc._wyt?' · ticket '+tc._wyt.side+' entry '+tc._wyt.entry.toFixed(2)+' stop '+tc._wyt.stop.toFixed(2)+' ('+tc._wyt.status+')':'')+(tc._wyfar&&tc._wyfar.length?' · off-scale: '+tc._wyfar.join(' · '):'');}
    if(ctxo.length)tc.overlays=ctxo.concat((tc.overlays||[]).filter(Boolean));
    var NEON={'#1f9d3a':'#39ff88','#d62828':'#ff3d7f'};   // VSA sign colours -> desk neon (dark background)
    (c.tc.overlays||[]).forEach(function(o){if(o.id!=='vsa')return;o.color=NEON[o.color]||o.color;(o.items||[]).forEach(function(it){if(NEON[it.c])it.c=NEON[it.c];});(o.legend||[]).forEach(function(l){if(NEON[l[0]])l[0]=NEON[l[0]];});});
    window.TC_DATA=c.tc;window.TC_RSB=c.rsb||'';var box=$('stk-chart');box.hidden=false;   // charts.js builds the module in #tc-mount (RS box included)
    return loadScript('charts/_assets/chart_zoom.js?v=4d8ab1d0').then(function(){return loadScript('charts/_assets/charts.js?v=4d8ab1d0');}).then(function(){postH();return c;});
  }).catch(function(e){return null;});
}
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
// open-trade P/L chip: formats research-tools/trade_pct.py output (pnl dict); no maths here
function pgChip(p){if(!p)return '';var f=function(v){return (v>=0?'+':'')+v.toFixed(1)+'%';};
  if(p.state!=='open'||p.pct==null)return p.to_entry_pct!=null?' · <span class="tp tp-pend">entry '+Math.abs(p.to_entry_pct).toFixed(1)+'% '+(p.to_entry_pct>=0?'above':'below')+'</span>':'';
  var c=p.pct>=0?'tp-pos':'tp-neg',sub=[p.days!=null?p.days+'d':'',p.mfe_pct!=null?'MFE '+f(p.mfe_pct):''].filter(Boolean).join(' · ');
  return ' · <span class="tp '+c+'" title="entry '+p.entry+' → last close '+p.last+' ('+esc(p.last_date||'')+')'+(p.since?'; triggered '+esc(p.since):'')+'"><b>'+f(p.pct)+'</b> from entry</span>'+
    (p.r!=null?' <span class="tp-r '+c+'">'+(p.r>=0?'+':'')+p.r.toFixed(1)+'R</span>':'')+(sub?' <small class="tp-m">'+esc(sub)+'</small>':'');}
function pgOk(p,e){return !!(p&&e>0&&p.entry>0&&Math.abs(p.entry-e)/e<0.005);}
function deskSec(d){
  var k=d.desk||{},h=[];
  if(k.watch){var w=k.watch;h.push('<div class="stk-dk"><h4>Desk watchlist</h4><p><b>'+esc(w.status||'')+'</b> · '+esc(w.setup||'')+' · pivot <b>'+esc(w.pivot_raw||'—')+'</b> · stop <b>'+(num(w.stop)?w.stop.toFixed(2):'—')+'</b>'+(w.first_flagged?' · on list since '+esc(w.first_flagged):'')+'</p>'+(w.note?'<p class="mut">Note: '+esc(w.note)+'</p>':'')+'</div>');}
  if(k.radar)h.push('<div class="stk-dk"><h4>On the desk radar</h4><p>'+esc(k.radar)+'</p></div>');
  if(k.alert&&k.alert.state)h.push('<div class="stk-dk"><h4>Price alert state</h4><p>'+state([k.alert.state,'s-'+k.alert.state.toLowerCase().replace(/[^a-z]+/g,'-')])+' '+esc(k.alert.detail||'')+(k.alert.since?' <small>since '+esc(k.alert.since)+'</small>':'')+'</p></div>');
  if(k.setups&&k.setups.length)h.push('<div class="stk-dk"><h4>Setup scanners <small>'+esc(k.setups_asof||'')+'</small></h4><ul>'+k.setups.map(function(s){return '<li><b>'+esc(s.k)+'</b> '+esc(s.status||'')+(s.tf?' · '+esc(s.tf):'')+(num(s.pivot)?' · pivot '+s.pivot.toFixed(2):'')+(num(s.stop)?' · stop '+s.stop.toFixed(2):'')+(s.actionable?' · <span class="dk-up">actionable</span>':'')+pgChip(s.pnl)+(s.date?' <small>'+esc(s.date)+'</small>':'')+'</li>';}).join('')+'</ul></div>');
  if(k.highs){var x=k.highs;h.push('<div class="stk-dk"><h4>New highs monitor</h4><p>'+(x.new_ath?'<b class="dk-up">New all-time high</b> · ':'')+(x.new_52w?'<b class="dk-up">New 52-week high</b>':'')+(num(x.pct_above_52w)?' · '+x.pct_above_52w.toFixed(2)+'% above the prior 52-wk high '+px(x.prior_52w_high)+' ('+esc(x.prior_52w_high_date||'')+')':'')+'</p></div>');}
  if(k.movers){var m=k.movers,L={'1d':'1D','1w':'1W','1m':'1M','qtr':'QTR','ytd':'YTD'};h.push('<div class="stk-dk"><h4>Top Movers ranks <small>'+esc(k.movers_asof||'')+'</small></h4><p>'+Object.keys(m).map(function(p){var r=m[p];return chip(L[p]+' #'+r.rank+' '+(r.side==='gainers'?'▲':'▼')+' '+pc(r.chg),r.side==='gainers'?'g':'r');}).join(' ')+'</p></div>');}
  if(k.vsa){var v=k.vsa,ls=v.last_sign;h.push('<div class="stk-dk"><h4>Wyckoff / VSA read <small>'+esc(v.label||'')+(v.asof?' · '+esc(v.asof):'')+'</small></h4>'+
    '<p>'+(v.headline?'<b>'+esc(v.headline)+'</b>':'')+(v.balance?' · balance <b>'+esc(v.balance)+'</b>':'')+(num(v.score)?' ('+v.score+')':'')+'</p>'+
    (ls?'<p>Last notable sign: <b class="'+(ls.pol>0?'dk-up':ls.pol<0?'dk-dn':'')+'">'+esc(ls.name)+'</b> '+esc(ls.d||'')+(ls.tier?' · '+esc(ls.tier)+' significance':'')+(ls.why?'<br><small>'+esc(ls.why)+(ls.ref?' ('+esc(ls.ref)+')':'')+'</small>':'')+'</p>':'')+
    (v.key_bars&&v.key_bars.length?'<p class="stk-kb">'+v.key_bars.map(function(s){return chip(esc(s.name)+' '+esc((s.d||'').slice(5)),s.pol>0?'g':s.pol<0?'r':'');}).join(' ')+'</p>':'')+
    (v.narrative?'<details><summary>Story</summary><p>'+esc(v.narrative)+'</p></details>':'')+'<p><a href="vsa.html">VSA page →</a></p></div>');}
  if(k.vsa_seq&&k.vsa_seq.rows&&k.vsa_seq.rows.length){var q=k.vsa_seq,ST={armed:'armed',triggered:'triggered',invalidated:'invalidated',expired:'expired'};h.push('<div class="stk-dk"><h4>VSA trade set-up sequences <span style="color:#e6ebff;font-size:11px;font-weight:600">Holmes · last 10 bars · EOD '+esc(q.asof||'')+' · display only</span></h4>'+
    '<ul>'+q.rows.map(function(r){var b=r.dir==='bull';return '<li><b class="'+(b?'dk-up':'dk-dn')+'">'+(b?'▲ ':'▼ ')+esc(r.code)+'</b> '+esc(r.name)+'<br><span style="color:#e6ebff;font-size:12px">'+(r.steps||[]).map(function(s){return esc(s[0])+' '+esc(s[2])+' '+esc((s[1]||'').slice(5));}).join(' → ')+
      ' · trigger <b>'+(num(r.trigger)?r.trigger.toFixed(2):'—')+'</b> · invalidation <b>'+(num(r.stop)?r.stop.toFixed(2):'—')+'</b> · '+esc(ST[r.st]||r.st||'')+(r.bt?' · backtest '+esc(r.bt)+(num(r.btR)?' ('+(r.btR>=0?'+':'')+r.btR.toFixed(2)+'R)':''):'')+'</span></li>';}).join('')+'</ul>'+
    (q.lens?'<details><summary style="color:#f2f5ff">Williams lens read</summary><p style="color:#eef2ff">'+esc(q.lens)+'</p></details>':'')+'<p><a href="vsa.html#sequences">VSA Sequences →</a></p></div>');}
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
  // Wyckoff Structure embeds pass &ck=j|p (chart JSON or charts/<T>.html page, whichever existed at build) so no 404 probe is made; the other source stays as a fallback if that went stale
  var CK=(P.get('ck')||'').replace(/[^a-z]/g,''),WJ=CK==='j'||(OVM==='wyckoff'&&CK!=='p');   // &ck=j|p: the page knows which chart source exists
  chartFrom(WJ?'json':'page').then(function(c){return c||chartFrom(WJ?'page':'json');}).then(function(c){
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
