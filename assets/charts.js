/* ===== TRADE CHARTS — arcade HLC chart page renderer (canvas, no dependencies) =====
   Data: window.TC_DATA (inlined by research-tools/charts.py). Works from file://.
   HLC bars: vertical low→high bar + right-side close tick (no open tick), coloured by close vs previous close. */
(function(){
  'use strict';
  var D=window.TC_DATA; if(!D||!D.bars) return;
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(/[?&]embed=1/.test(location.search)) document.body.classList.add('tc-embed');
  // ---------------------------------------------------------------- ONE chart module (added 4 Oct 2026): every surface that shows a chart
  // (charts/<T>.html, its ?embed=1 modal, stock.html?t=T, the inline dropdown iframes stock.html?embed=1&mini=1, D/W/M) gets exactly this
  // DOM, built here, in this order: LEVEL chip + RS box | trade panel (price, level, R-mult, % from / to entry, days, MFE, 1R) + RISK box
  // (shares calc) + HP/XP meter | zoom / ranges / 1D 1W 1M / FULL LAYERS TEXT (chart_zoom.js + layersUI) | notes row | overlays (+ story) |
  // chart | legend | levels & sources + notes | footer.  Pages only provide <div id="tc-mount"> (an RS box inside it, or window.TC_RSB, is kept).
  // Older chart pages that still carry the static markup are re-ordered into the same sequence.
  (function mount(){
    var host=document.getElementById('tc-mount')||document.querySelector('main.tc-wrap');if(!host)return;
    var rsb=document.getElementById('tc-rsb');
    if(!document.getElementById('tc-hud')){
      var tk=esc0(D.ticker||'');
      host.insertAdjacentHTML('beforeend','<header class="tc-top"><div class="tc-level" id="tc-level"></div></header>'+
        '<section class="tc-hud" id="tc-hud" aria-label="Trade HUD"></section>'+
        '<section class="tc-stage"><div class="tc-chart" id="tc-chart" role="img" aria-label="'+tk+' high-low-close bars with entry, stop and R-target levels, volume and RS"></div>'+
        '<div class="tc-legend" id="tc-legend"></div></section><section class="tc-panel" id="tc-levels"></section><footer class="tc-foot" id="tc-foot"></footer>');}
    var top=host.querySelector('.tc-top');
    if(!rsb&&window.TC_RSB&&top){top.insertAdjacentHTML('beforeend',window.TC_RSB);rsb=document.getElementById('tc-rsb');}
    if(rsb&&top&&rsb.parentNode!==top)top.appendChild(rsb);
    ['tc-hud','tc-stage','tc-levels','tc-foot'].forEach(function(id){var e=document.getElementById(id)||host.querySelector('.'+id);if(e&&e.parentNode===host)host.appendChild(e);});
    function esc0(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  })();
  var FONT="'Press Start 2P','DejaVu Sans',monospace", SYM="'Press Start 2P','DejaVu Sans','Noto Sans Symbols 2','Segoe UI Symbol',monospace";
  var C={up:'#39ff88',dn:'#ff3d7f',entry:'#00e5ff',stop:'#ff2a2a',cut:'#ff9f1c',a05:'#c77dff',a10:'#ff2bd6',r2:'#39ff14',r3:'#ffd700',zone:'#00e5ff',grid:'rgba(107,92,255,.13)',axis:'#6f6a9c',frame:'#3a2f8a',bg:'#000000'};
  // ---------------------------------------------------------------- layers (LAYERS panel + TEXT switch + FULL / LEVELS / CLEAN presets)
  // One shared state for every chart (full chart pages, stock.html, inline dropdown charts): localStorage wa.desk.chartlayers.v1 =
  // {L:{layer:0|1}, text:0|1, axis:0|1}. Presets just set the toggles; any other mix shows CUSTOM. Changes redraw from memory (no refetch).
  var LAYK=['bars','vol','weis','sqz','sma','entry','stop','targets','pct','pctl','acct','cuts','zones','last','rsp','rsl','ovl','oneup','tl'];
  var LPRE={full:{on:LAYK.filter(function(k){return k!=='pctl'&&k!=='weis';}),text:1,axis:1},   // faint % lines on the chart body + Weis waves: opt-in
    levels:{on:['bars','entry','stop','last','tl'],text:1,axis:1},clean:{on:['bars','vol','sma','rsp'],text:0,axis:1}};
  var LKEY='wa.desk.chartlayers.v1',MKEY='wa.desk.chartmode.v1';
  function preState(p){var P=LPRE[p],o={L:{},text:P.text,axis:P.axis};LAYK.forEach(function(k){o.L[k]=P.on.indexOf(k)>=0?1:0;});return o;}
  function loadLay(){var j=null;try{j=JSON.parse(localStorage.getItem(LKEY)||'null');}catch(e){}
    if(j&&j.L){var base='full';for(var pp in LPRE){var q=preState(pp);if(LAYK.every(function(k){return j.L[k]==null||q.L[k]===(j.L[k]?1:0);})){base=pp;break;}}   // layers added later take the matching preset's value
      var o=preState(base);LAYK.forEach(function(k){if(j.L[k]!=null)o.L[k]=j.L[k]?1:0;});o.text=j.text?1:0;o.axis=j.axis==null?1:(j.axis?1:0);return o;}
    var m=null;try{m=localStorage.getItem(MKEY);}catch(e){}return preState(LPRE[m]?m:'full');}   // first visit after the CLEAN-only version: keep its choice
  function presetOf(o){for(var p in LPRE){var q=preState(p);if(q.text===o.text&&q.axis===o.axis&&LAYK.every(function(k){return q.L[k]===o.L[k];}))return p;}return 'custom';}
  var LS=loadLay();
  // notes fold (▾ / ▸ row above the chart): hides the overlay banners + key, the inline key line, the legend and the far-target list
  var FKEY='wa.desk.chartfold.v1',FOLD=false,LAST_OFF=0;try{FOLD=localStorage.getItem(FKEY)==='1';}catch(e){}
  var MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  function $(id){return document.getElementById(id);}
  function money(v){return v==null?'—':'$'+Number(v).toFixed(2);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var bars=D.bars.map(function(b,i){return {d:b[0],o:b[1],h:b[2],l:b[3],c:b[4],up:!!b[5],v:(D.vol[i]||[])[1]||0};});
  function mapS(a){var m={};(a||[]).forEach(function(p){m[p[0]]=p[1];});return m;}
  var NOMA=!!D.no_ma;   // per-chart flag (Wyckoff Structure page, stock.js ov=wyckoff): no moving averages at all - SMA lines, legend and layer hidden; shared layer state untouched
  var S50=mapS(NOMA?null:D.sma50),S150=mapS(NOMA?null:D.sma150),S200=mapS(NOMA?null:D.sma200);
  if(D.entry>0&&D.stop!=null&&D.entry>D.stop&&(!D.risk_plan||D.risk_plan.default==null)){   // same numbers as charts.py risk_plan() for an unscored plan
    var _rp=(D.entry-D.stop)/D.entry*100;D.risk_plan={default:0.75,min:0.5,max:1,tier:0.75,short:'UNSCORED',reasons:['default 0.75%: unscored'],stop_pct:Math.round(_rp*100)/100,
      size_pct:{'0.5':Math.round(0.5/_rp*1000)/10,'0.75':Math.round(0.75/_rp*1000)/10,'1':Math.round(1/_rp*1000)/10},m05:Math.round((D.entry-(0.5/0.75)*(D.entry-D.stop))*100)/100,m10:Math.round((D.entry-(1/0.75)*(D.entry-D.stop))*100)/100};}
  var last=bars[bars.length-1], hasR=D.r3!=null, RP=D.risk_plan||{};
  // RS line (research-tools/charts.py rs_payload): close ÷ SPY close on the chart's own bars; marks: L = new 52w RS high before price (blue dot), P = with price
  var RSD=D.rs||{}, RSL=mapS(RSD.line), RSM=RSD.marks||{}, RSC={lead:'#2f7bff',hi:'#9fc4ff'};
  // RS rating panel (Deepvue-style, above price): D.rs.hist.rows = [[date, rating|null, ma21|null, band S/F/N/W|null, cross U/D|null]]
  var RTH=RSD.hist||null, hasRT=!!RTH, RTM={}; ((RTH&&RTH.rows)||[]).forEach(function(r){RTM[r[0]]=r;});
  var RTC={r:'#39ff88',ma:'#ffa630',up:'rgba(57,255,136,.20)',dn:'rgba(255,96,64,.24)',area:'rgba(57,255,136,.13)',
    band:{S:'rgba(24,170,80,.36)',F:'rgba(18,96,58,.48)',N:'rgba(130,118,28,.40)',W:'rgba(150,22,34,.48)'},
    bandName:{S:'STRONG',F:'FIRM',N:'NEUTRAL',W:'WEAK'}};
  function sday(d){return d?(d.slice(8,10)+' '+MON[+d.slice(5,7)-1]):'?';}

  // ---------------------------------------------------------------- VSA volume panel (4 Oct 2026, Chris; approved mockup) · VOL: PLAIN | VSA
  // One shared choice for every chart: localStorage wa.desk.chartvol.v1 = 'vsa' (default) | 'plain'; other open charts / dropdowns follow
  // live via 'storage'.  VSA mode, computed here from the chart's own bars on whichever timeframe is shown (D / W / M):
  //   colour = RV = volume ÷ the average volume of the 20 bars BEFORE it (needs 10+):  < 0.7× dim grey-blue (no supply / no demand
  //            candidates) · 0.7–1.5× cyan (normal) · 1.5–2× bright cyan · 2–3× orange · ≥ 3× white-hot + glow (climactic)
  //   fill   = close position in the bar's high-low range: top third solid · middle third half-filled · bottom third hollow outline
  //            (volume bars under 3px wide: opacity 100 / 60 / 30% instead)
  //   glyphs = effort vs result, spread = high - low vs the 20 bars before it:  ▲ absorption = RV > 1.5 and spread < 0.7× ·
  //            ○ no effort = RV < 0.7 and spread > 1.3×
  //   tags   = the VSA engine's own key bars only (research-tools/vsa.py -> vsa_ui.overlay_for, overlay id 'vsa'): in VSA mode they
  //            MOVE from the price pane to neon tags in the volume panel (glow = high significance in its context; tap a bar for why)
  //   line   = glowing 20-bar average volume + a faint band up to the dashed 2× average line
  //   Weis   = layer 'weis' (LAYERS, off by default): cumulative volume of each price wave behind the bars; a wave reverses when the
  //            close moves against the wave's extreme close by ≥ 1×ATR(14) (simple mean true range, same timeframe); green up, magenta down
  //   The newest provisional W / M period uses its pro-rated volume for RV.  TEXT off (CLEAN) hides tags, glyphs and wave totals.
  //   PLAIN = the old green / red volume bars, with the VSA engine markers back on the price bars.
  var VKEY='wa.desk.chartvol.v1',VM='vsa';try{if(localStorage.getItem(VKEY)==='plain')VM='plain';}catch(e){}
  if(document.body)document.body.classList.toggle('tc-volvsa',VM==='vsa');
  var VSA_T={dim:0.7,cy2:1.5,hot:2,climax:3,absV:1.5,absS:0.7,neV:0.7,neS:1.3,n:20,min:10,atr:14,rev:1.0};
  var VCOL={dim:'#56658c',cy:'#19b4d4',cy2:'#72f6ff',hot:'#ff9f1c',cl:'#ffffff'};
  function rvCol(r){return r==null||r<VSA_T.dim?VCOL.dim:r<VSA_T.cy2?VCOL.cy:r<VSA_T.hot?VCOL.cy2:r<VSA_T.climax?VCOL.hot:VCOL.cl;}
  function fmtV(v){v=Math.abs(v);return v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?Math.round(v/1e3)+'K':String(Math.round(v));}
  var VSC=null;
  function vsaPre(B){   // once per bar set (timeframe), never per frame
    var n=B.length,N=VSA_T.n,rv=new Array(n),sr=new Array(n),cp=new Array(n),av=new Array(n),gl=new Array(n),atr=new Array(n),sv=0,ss=0,cnt=0,i,b;
    for(i=0;i<n;i++){b=B[i];var sp=b.h-b.l,as=cnt>=VSA_T.min?ss/cnt:null;av[i]=cnt>=VSA_T.min?sv/cnt:null;
      rv[i]=av[i]?(b.vx||b.v)/av[i]:null;sr[i]=as?sp/as:null;cp[i]=sp>0?(b.c-b.l)/sp:0.5;
      gl[i]=(rv[i]==null||sr[i]==null)?null:(rv[i]>VSA_T.absV&&sr[i]<VSA_T.absS)?'abs':(rv[i]<VSA_T.neV&&sr[i]>VSA_T.neS)?'ne':null;
      sv+=b.v;ss+=sp;cnt++;if(cnt>N){sv-=B[i-N].v;ss-=B[i-N].h-B[i-N].l;cnt--;}}
    var tq=[],tr=0;for(i=0;i<n;i++){b=B[i];var pc=i?B[i-1].c:b.c,t=Math.max(b.h-b.l,Math.abs(b.h-pc),Math.abs(b.l-pc));tq.push(t);tr+=t;if(tq.length>VSA_T.atr)tr-=tq.shift();atr[i]=tr/tq.length;}
    var wv=[],wid=new Array(n),cum=new Array(n),dir=0,ext=0,ws=0;
    function wave(s0,e0,d){var t=0;for(var k=s0;k<=e0;k++){t+=B[k].v;cum[k]=t;wid[k]=wv.length;}wv.push({s:s0,e:e0,d:d,v:t});}
    for(i=1;i<n;i++){var th=VSA_T.rev*atr[i],c=B[i].c;
      if(!dir){if(c-B[0].c>=th){dir=1;ext=i;}else if(B[0].c-c>=th){dir=-1;ext=i;}continue;}
      if(dir>0){if(c>=B[ext].c)ext=i;else if(B[ext].c-c>=th){wave(ws,ext,1);ws=ext+1;dir=-1;ext=i;}}
      else{if(c<=B[ext].c)ext=i;else if(c-B[ext].c>=th){wave(ws,ext,-1);ws=ext+1;dir=1;ext=i;}}}
    if(n){wave(ws,n-1,dir||1);wv[wv.length-1].open=1;}
    return {B:B,rv:rv,sr:sr,cp:cp,av:av,gl:gl,wv:wv,wid:wid,cum:cum};}
  function vsaGet(){if(!VSC||VSC.B!==bars)VSC=vsaPre(bars);return VSC;}
  // the VSA engine's key bars (overlay 'vsa'): sign code / tag text / significance from the item (k, tier, pol) or its tip text
  var VSAN={SC:'SELL CLIMAX',SV:'STOP VOL',BAG:'BAG HOLD',SO:'SHAKEOUT',T:'TEST',TR:'TEST',NS:'NO SUPPLY',ETR:'EFFORT UP',BC:'BUY CLIMAX',UT:'UPTHRUST',
    PUT:'PSEUDO UT',ND:'NO DEMAND',EORM:'END OF RISE',ETF:'EFFORT DOWN',FT:'FAILED TEST?',SQ:'SQUAT'};
  var VSAK={'selling climax':'SC','stopping volume':'SV','bag holding':'BAG','shakeout':'SO','test':'T','test in a rising market':'TR','no supply':'NS',
    'effort to rise':'ETR','buying climax':'BC','upthrust':'UT','pseudo-upthrust':'PUT','no demand':'ND','end of a rising market':'EORM','effort to fall':'ETF',
    'possible failed test':'FT','squat':'SQ'};
  function vsaMeta(it){if(it._vk)return it._vk;var m=/^(.+?) \d{4}-\d\d-\d\d - (\w+) significance/.exec(it.tip||''),sh=String(it.label||'').replace(/!$/,''),
    k=it.k||(m&&VSAK[m[1].toLowerCase()])||sh,tier=it.tier||(m&&m[2])||(/!$/.test(it.label||'')?'high':'');
    it._vk={k:k,full:VSAN[k]||sh.toUpperCase(),sh:sh||k,hi:tier==='high',pol:it.pol!=null?it.pol:(it.pos==='below'?1:-1)};return it._vk;}

  // ---------------------------------------------------------------- detector overlays (format: research-tools/chart_overlays.py docstring)
  // D.overlays = [{id,label,color,asof,legend:[[colour,text]],items:[{t:'box'|'seg'|'hline'|'point'|'span', dates d0/d1/d, prices ...}]}]
  // Items live in date/price space, so they re-project on every draw (zoom, pan, resize). One toggle per overlay (localStorage tc_ovl_<id>).
  var OVL=(D.overlays||[]).filter(function(o){return o&&o.items&&o.items.length;});
  // Pre Squeeze band (Chris 5 Oct 2026): D.squeeze or band on the presqueeze overlay; LAYERS toggle 'sqz' (localStorage)
  var SQZ=D.squeeze||null;if(!SQZ){OVL.forEach(function(o){if(!SQZ&&o&&o.id==='presqueeze'&&o.band)SQZ=o.band;});}

  var OLS={get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
  OVL.forEach(function(o){o.on=OLS.get('tc_ovl_'+o.id)!=='0';});
  // overlay hlines that ARE a plan entry (spring overlays 'ENTRY 12.34' / 'SPRING ENTRY', Wyckoff ticket 'ENTRY') are drawn by the BUY-line code below
  OVL.forEach(function(o){o.items.forEach(function(it){var lb=String(it.label||'');if(it.t==='hline'&&/\b(ENTRY|PIVOT)\b/i.test(lb)&&!/NOT THE ENTRY/i.test(lb)){it.buy=1;
    it.side=/^short\b/i.test(String(o.label||''))?'short':'long';it.bnm=ovlName(o);}});});
  function ovlName(o){var id=String(o.id||'');if(/^spring_tr/.test(id))return 'SPRING (TR)'+(id.split('_')[2]?' '+id.split('_')[2]:'');if(/^spring_up/.test(id))return 'SPRING (UP)';
    if(id==='wy_ticket')return 'WYCKOFF '+(/^short/i.test(String(o.label||''))?'SHORT':'LONG')+' TICKET';return id.replace(/_/g,' ').toUpperCase();}
  var DIX={}; bars.forEach(function(b,i){DIX[b.d]=i;});
  function dix(d){if(d==null)return bars.length-1;if(DIX[d]!=null)return DIX[d];if(d<bars[0].d)return -1;var lo=0,hi=bars.length-1;if(d>bars[hi].d)return hi;
    while(lo<hi){var m=(lo+hi+1)>>1;if(bars[m].d<=d)lo=m;else hi=m-1;}return lo;}
  function ovlSpan(it){var a=it.d0!==undefined?it.d0:it.d,b=it.d1!==undefined?it.d1:it.d;return [dix(a),it.t==='hline'||it.t==='box'?(b==null?bars.length-1:dix(b)):dix(b)];}
  // ---------------------------------------------------------------- timeframe switch (1D / 1W / 1M) — one shared choice for every chart
  // localStorage wa.desk.charttf.v1 = 'D'|'W'|'M' (default D).  W / M bars: the chart's own daily bars aggregated here (Mon-Fri weeks,
  // calendar months; H = max, L = min, C = last close, V = sum) and, for the older periods, data/tf/<T>.json (research-tools/tf_data.py:
  // Yahoo ~10y history spliced onto Massive, lazy-loaded once; rescaled if its closes disagree with the daily bars on the overlap).
  // The newest period is PROVISIONAL until its last session (dashed bar, pro-rated volume outline).  SMAs are recomputed on the period
  // closes (W 10/30/40 ≈ 50/150/200 days, M 3/7/10), as are the RS line dots (52 W / 12 M high) and the RS-rating panel (last rating of
  // the period, MA4W / MA3M).  Price lines (entry / stop / 2R / 3R / levels / boxes / segments) map to the bar containing their date;
  // single-bar markers (points: VSA, spring, NS / UR, events) show only on the timeframe they were detected on (overlay id suffix _D/_W/_M,
  // item/overlay tf, or a "W " / "M " label prefix; everything else = the chart's native timeframe).  D.wk charts (weekly bars only) are fixed to 1W.
  var TFROOT=(document.currentScript&&document.currentScript.src)||'';   // .../charts/_assets/charts.js -> site root for data/tf/
  var TFK='wa.desk.charttf.v1', NATIVE=D.wk?'W':'D', TF=NATIVE, TFN={D:'1D',W:'1W',M:'1M'}, TFW={D:'daily',W:'weekly',M:'monthly'};
  if(NATIVE==='D'){try{var _tf=localStorage.getItem(TFK);if(_tf==='W'||_tf==='M')TF=_tf;}catch(e){}}
  var DAY={bars:bars,S50:S50,S150:S150,S200:S200,RSL:RSL,RSM:RSM,RTM:RTM}, TFX=null, TFXP=null, TFC={}, TFHID=0, TFSC='';
  var HOL={};['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25','2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24','2028-01-17','2028-02-21','2028-04-14','2028-05-29','2028-06-19','2028-07-04','2028-09-04','2028-11-23','2028-12-25'].forEach(function(d){HOL[d]=1;});   // NYSE weekday closures (rs_rank.HOLIDAYS)
  function isoD(t){return t.toISOString().slice(0,10);}
  function pStart(d,k){if(k==='M')return d.slice(0,8)+'01';var t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+6)%7));return isoD(t);}
  function pNext(s,k){var t=new Date(s+'T00:00:00Z');if(k==='W')t.setUTCDate(t.getUTCDate()+7);else{t.setUTCDate(1);t.setUTCMonth(t.getUTCMonth()+1);}return isoD(t);}
  function pSess(s,k){var t=new Date(s+'T00:00:00Z'),e=pNext(s,k),n=0,f=null,l=null;for(;isoD(t)<e;t.setUTCDate(t.getUTCDate()+1)){var w=t.getUTCDay(),q=isoD(t);if(w>0&&w<6&&!HOL[q]){n++;if(!f)f=q;l=q;}}return {n:n,first:f,last:l};}
  function smaMap(B,n){var m={},s=0;for(var i=0;i<B.length;i++){s+=B[i].c;if(i>=n)s-=B[i-n].c;if(i>=n-1)m[B[i].d]=Math.round(s/n*1000)/1000;}return m;}
  function emaArr(B,n){var o=[],k=2/(n+1),s=0,e=null;for(var i=0;i<B.length;i++){if(i<n){s+=B[i].c;if(i===n-1)e=s/n;}else e=B[i].c*k+e*(1-k);o.push(i>=n-1?e:null);}return o;}
  function tfAgg(k){   // the chart's daily bars -> periods (the first one dropped when the data starts mid-period)
    var out=[];DAY.bars.forEach(function(b){var s=pStart(b.d,k),p=out[out.length-1];
      if(p&&p.d===s){p.de=b.d;p.h=Math.max(p.h,b.h);p.l=Math.min(p.l,b.l);p.c=b.c;p.v+=b.v;p.n++;}
      else out.push({d:s,d1:b.d,de:b.d,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v,n:1});});
    if(out.length>2&&out[0].d1>pSess(out[0].d,k).first)out.shift();
    return out;}
  function tfSrv(k){var x=TFX&&TFX[k==='W'?'w':'m'];if(!x||!x.s||!x.r)return [];var out=[],s=x.s,vu=x.vu||1;
    x.r.forEach(function(r){if(r)out.push({d:s,h:r[0],l:r[1],c:r[2],v:r[3]*vu,srv:1});s=pNext(s,k);});return out;}
  function tfBuild(k){
    if(TFC[k])return TFC[k];
    var a=tfAgg(k),sv=tfSrv(k),sc=1,note='';
    if(sv.length&&a.length){var A={};a.forEach(function(p){A[p.d]=p;});var rr=[];
      sv.forEach(function(p){if(A[p.d]&&p.c>0)rr.push(A[p.d].c/p.c);});rr=rr.slice(-4).sort(function(x,y){return x-y;});
      if(rr.length){var md=rr[rr.length>>1];if(Math.abs(md-1)>0.02){sc=md;note='older '+TFW[k]+' bars rescaled ×'+md.toFixed(4)+' to match the daily bars';}}
      var a0=a[0].d;sv=sv.filter(function(p){return p.d<a0;});
      if(sc!==1)sv=sv.map(function(p){return {d:p.d,h:p.h*sc,l:p.l*sc,c:p.c*sc,v:p.v/sc,srv:1};});}
    else sv=[];
    var B=sv.concat(a).map(function(p,i,arr){var ss=pSess(p.d,k),q={d:p.d,de:p.de||ss.last,o:p.o,h:p.h,l:p.l,c:p.c,v:p.v,n:p.n||ss.n,srv:p.srv,
      up:i>0?p.c>=arr[i-1].c:true};return q;});
    var L=B[B.length-1];if(L&&!L.srv){var ss=pSess(L.d,k);if(L.de<ss.last){L.prov=1;L.ns=ss.n;L.vx=L.v*Math.max(1,ss.n/Math.max(1,L.n));}}
    // SMAs on the period closes
    var P=k==='W'?[10,30,40]:[3,7,10],S=NOMA?[{},{},{}]:P.map(function(n){return smaMap(B,n);});
    // RS line: the daily line sampled at each period's last session; dots = new 52-week (W) / 12-month (M) RS-line high before price
    var rl={},rm={},lb=k==='W'?52:12,seq=[];(RSD.line||[]).forEach(function(p){rl[pStart(p[0],k)]=p[1];});
    B.forEach(function(b){if(rl[b.d]!=null)seq.push([b.d,rl[b.d],b.c]);});
    for(var i=0;i<seq.length;i++){if(i<lb-1)continue;var mr=-1e18,mc=-1e18;for(var j=i-lb+1;j<i;j++){mr=Math.max(mr,seq[j][1]);mc=Math.max(mc,seq[j][2]);}
      if(seq[i][1]>mr)rm[seq[i][0]]=seq[i][2]>=mc?'P':'L';}
    // RS rating panel: last rating of the period, MA over 4 weeks / 3 months, crosses + regime band (2-period confirmation)
    var rt={},rows=(RTH&&RTH.rows)||[],per={},ord=[];rows.forEach(function(r){var s=pStart(r[0],k);if(!(s in per)){per[s]=null;ord.push(s);}if(r[1]!=null)per[s]=r[1];});
    var man=k==='W'?4:3,win=[],side=0,band=null,pend=null;
    ord.forEach(function(s){var r=per[s];if(r==null){win=[];side=0;band=null;pend=null;rt[s]=[s,null,null,null,null];return;}
      win.push(r);if(win.length>man)win.shift();var m=win.length===man?win.reduce(function(x,y){return x+y;},0)/man:null,cr=null,bd=null;
      if(m!=null){var sd=r>m?1:r<m?-1:0;if(sd&&side&&sd!==side)cr=sd>0?'U':'D';if(sd)side=sd;var d=r-m,st=(r<50||d<=-10)?'W':(r>=70&&d>=3)?'S':(r>=70&&d>-3)?'F':'N';
        if(band==null)band=st;else if(st!==band){if(pend===st){band=st;pend=null;}else pend=st;}else pend=null;bd=band;}
      rt[s]=[s,r,m==null?null:Math.round(m*100)/100,bd,cr];});
    TFC[k]={bars:B,S50:S[0],S150:S[1],S200:S[2],RSL:rl,RSM:rm,RTM:rt,note:note,srv:sv.length};return TFC[k];}
  function tfOf(o,it){var m;return it.tf||o.tf||((m=/_([DWM])$/.exec(o.id||''))&&m[1])||((m=/^([WM])(?=[\s→↑↓])/.exec(it.label||''))&&m[1])||NATIVE;}
  function ptShow(o,it){return TF===NATIVE||tfOf(o,it)===TF;}
  function maOv(o){   // overlays drawn as EMA / SMA line segments (legend "EMA10" ...): recomputed on the W / M closes
    if(o._ma!==undefined)return o._ma;var L=o.legend||[],m=L.map(function(l){var x=/^(EMA|SMA)\s?(\d+)$/i.exec(String(l[1]||'').trim());return x?{k:x[1].toUpperCase(),n:+x[2],c:l[0]}:null;});
    o._ma=(m.length&&m.every(Boolean)&&o.items.length&&o.items.every(function(it){return it.t==='seg';}))?m:null;if(o._ma){o._i0=o.items;o._l0=o.label;}return o._ma;}
  function applyTF(){
    var T0=TF===NATIVE?DAY:tfBuild(TF);
    bars=T0.bars;S50=T0.S50;S150=T0.S150;S200=T0.S200;RSL=T0.RSL;RSM=T0.RSM;RTM=T0.RTM;TFSC=T0.note||'';
    DIX={};bars.forEach(function(b,i){DIX[b.d]=i;});last=bars[bars.length-1];PVR=null;hover=-1;
    TFHID=0;OVL.forEach(function(o){var mm=maOv(o);
      if(mm){if(TF===NATIVE){o.items=o._i0;o.label=o._l0;}else{var it=[],wd={};o._i0.forEach(function(q){wd[q.c]=q.w;});
        mm.forEach(function(s){var e=s.k==='EMA'?emaArr(bars,s.n):bars.map(function(b,i){if(i<s.n-1)return null;var t=0;for(var j=i-s.n+1;j<=i;j++)t+=bars[j].c;return t/s.n;});
          for(var i=1;i<bars.length;i++){if(e[i]==null||e[i-1]==null)continue;it.push({t:'seg',d0:bars[i-1].d,p0:e[i-1],d1:bars[i].d,p1:e[i],c:s.c,w:wd[s.c]||1.4});}});
        o.items=it;o.label=String(o._l0||'').replace(/\(daily closes\)/i,'('+TFW[TF]+' closes)');}}
      else o.items.forEach(function(it){if(it.t==='point'&&!ptShow(o,it))TFHID++;});});
    if(window.TCZoom&&TCZoom.setTf)TCZoom.setTf(TF,bars.length);
    var tl=document.querySelector('.tc-tfl');if(tl)tl.textContent=TFN[TF];
    if(typeof legendHTML==='function'&&$('tc-legend'))$('tc-legend').innerHTML=legendHTML();}
  function tfFetch(){   // data/tf/<T>.json once (older W / M periods); never blocks the chart for long, never throws
    if(TFXP)return TFXP;var src=TFROOT,i=src.indexOf('charts/_assets/charts.js'),root=i>=0?src.slice(0,i):'';
    TFXP=(window.fetch&&D.ticker?fetch(root+'data/tf/'+encodeURIComponent(String(D.ticker).replace(/\//g,'_'))+'.json').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}):Promise.resolve(null))
      .then(function(j){if(j&&(j.w||j.m)){TFX=j;TFC={};}return j;});return TFXP;}
  function smaNames(){return TF==='W'?['SMA10W','SMA30W','SMA40W']:TF==='M'?['SMA3M','SMA7M','SMA10M']:['SMA50','SMA150','SMA200'];}
  function rtMaLbl(){return TF==='W'?'MA4W':TF==='M'?'MA3M':'MA'+((RTH&&RTH.ma)||21);}
  function tfDate(b){if(TF==='D'||!b.de)return esc(b.d);if(TF==='M')return MON[+b.d.slice(5,7)-1]+' '+b.d.slice(0,4);return 'WK '+esc(sday(b.d))+' → '+esc(sday(b.de))+' '+b.de.slice(0,4);}
  function smaLeg(){var n=smaNames();return '<span><i style="background:#ff9f1c"></i>'+n[0]+'</span><span><i style="background:#b86bff"></i>'+n[1]+'</span><span><i style="background:#4da3ff"></i>'+n[2]+'</span>';}
  function tfNote(){if(TF==='D')return '';var w=TF==='W'?'WEEK':'MONTH',h=TFC[TF]||{};
    return '<span class="tc-warnline" style="white-space:normal">'+TFN[TF]+' BARS: '+(TF==='W'?'MON-FRI WEEKS':'CALENDAR MONTHS')+' FROM THE DAILY BARS'+(h.srv?' + OLDER '+w+'S FROM THE 10Y HISTORY':' (NO LONG HISTORY LOADED)')+
      ' · NEWEST '+w+' PROVISIONAL UNTIL ITS LAST SESSION'+(TFHID?' · '+TFHID+' DAILY MARKER'+(TFHID===1?'':'S')+' HIDDEN (1D TO SEE)':'')+(TFSC?' · '+esc(TFSC.toUpperCase()):'')+'</span>';}
  function ovlPrices(off,n){var out=[];OVL.forEach(function(o){if(!o.on)return;o.items.forEach(function(it){if(it.pane==='vol')return;if(it.t==='point'&&!ptShow(o,it))return;var sp=ovlSpan(it);
    if(sp[1]<off||sp[0]>off+n-1)return;[it.p,it.p0,it.p1,it.lo,it.hi].forEach(function(v){if(v!=null)out.push(v);});});});return out;}
  function ovlTag(x,t,cx,cy,c,al,fs){x.font=fs+'px '+FONT;var w=x.measureText(t).width+6,h=fs+5,x0=al==='left'?cx:al==='right'?cx-w:cx-w/2,pb=freeBox(x0,cy-h/2,w,h);x0=pb[0];cy=pb[1]+h/2;
    x.fillStyle='rgba(0,0,0,.82)';x.fillRect(x0,cy-h/2,w,h);x.fillStyle=c;x.textAlign='left';x.fillText(t,x0+3,cy+fs/2-0.5);}
  function drawOverlays(x,g){
    var fs=g.narrow?6:7;
    OVL.forEach(function(o){if(!o.on)return;var col=o.color||'#ffd23f';
      o.items.forEach(function(it){if(it.t==='point'&&!ptShow(o,it))return;if(g.vsav&&o.id==='vsa'&&it.t==='point')return;var c=it.c||col,sp=ovlSpan(it);if(sp[1]<g.off-1||sp[0]>g.off+g.n)return;if(it.pane==='vol'&&g.novol)return;
        var x0=g.X(sp[0]-g.off),x1=g.X(sp[1]-g.off);x.save();x.beginPath();
        if(it.pane==='vol')x.rect(g.pl,g.vb-g.vh-18,g.barsEnd-g.pl+4,g.vh+20);else x.rect(g.pl,g.pt-2,g.barsEnd-g.pl+4,g.ph+4);x.clip();
        x.lineCap='round';x.setLineDash(it.dash||[]);x.lineWidth=it.w||1.5;x.strokeStyle=c;
        if(it.t==='box'){var bx0=x0-g.bw/2,bx1=x1+g.bw/2,y0=g.Y(it.hi),y1=g.Y(it.lo);x.fillStyle=it.fill||'rgba(255,255,255,.06)';x.fillRect(bx0,y0,bx1-bx0,y1-y0);
          x.globalAlpha=.55;x.lineWidth=1;x.setLineDash([2,3]);x.strokeRect(bx0,y0,bx1-bx0,y1-y0);x.globalAlpha=1;x.setLineDash([]);
          if(!g.notext&&it.label)ovlTag(x,it.label,Math.max(g.pl+2,bx0+2),y1-fs,c,'left',fs);}
        else if(it.t==='seg'){x.beginPath();x.moveTo(x0,g.Y(it.p0));x.lineTo(x1,g.Y(it.p1));x.stroke();
          if(!g.notext&&it.label){x.setLineDash([]);ovlTag(x,it.label,(x0+x1)/2,(g.Y(it.p0)+g.Y(it.p1))/2,c,'center',fs);}}
        else if(it.t==='hline'&&it.buy&&g.buyon){}
        else if(it.t==='hline'){var y=g.Y(it.p),xe=it.d1==null?g.barsEnd:x1;x.beginPath();x.moveTo(x0,y);x.lineTo(xe,y);x.stroke();x.setLineDash([]);
          if(!g.notext&&it.label){x.font=fs+'px '+FONT;var lw=x.measureText(it.label).width+6;ovlTag(x,it.label,Math.max(g.pl+2,Math.min(x0,xe-lw)),y-fs-1,c,'left',fs);}}
        else if(it.t==='point'){var py=g.Y(it.p);x.setLineDash([]);x.fillStyle=c;x.beginPath();x.arc(x0,py,g.narrow?2.5:3.2,0,Math.PI*2);x.fill();
          if(!g.notext&&it.label)ovlTag(x,it.label,x0,it.pos==='below'?py+fs+4:py-fs-3,c,'center',fs);}
        else if(it.t==='span'){var yb=it.pane==='vol'?g.vb-g.vh-5:g.pt+4;x.setLineDash([]);x.lineWidth=2;x.beginPath();x.moveTo(x0-g.bw/2,yb+5);x.lineTo(x0-g.bw/2,yb);x.lineTo(x1+g.bw/2,yb);x.lineTo(x1+g.bw/2,yb+5);x.stroke();
          if(!g.notext&&it.label){x.font=fs+'px '+FONT;var tw=x.measureText(it.label).width+6;ovlTag(x,it.label,Math.max(g.pl+2,Math.min(g.barsEnd-tw,x1+g.bw/2-tw)),yb-fs+1,c,'left',fs);}}
        x.restore();});});
  }
  // VSA volume panel renderer (see the VSA notes at the top). g: visible bars + geometry from draw()
  var VSTAT={},VSTS='';
  function drawVSA(x,g){
    var S=vsaGet(),V=g.V,off=g.off,n=g.n,top=g.vb-g.vh,TX=g.TX,nw=g.narrow,LY=g.LY,i,k,q;
    var ov=null;OVL.forEach(function(o){if(o.id==='vsa')ov=o;});
    var tg=[];if(TX&&ov&&ov.on&&LY.ovl)ov.items.forEach(function(it){if(it.t!=='point'||!ptShow(ov,it))return;var bi=dix(it.d);if(TF===NATIVE&&(!bars[bi]||bars[bi].d!==it.d))return;
      var j=bi-off;if(j<0||j>=n)return;var m=vsaMeta(it);tg.push({i:j,m:m,c:m.pol>0?'#39ff88':'#ff3d7f'});});
    var fsT=nw?6:7,RH=fsT+6,TRH=TX?RH:0,GRH=TX?(nw?8:9):0,bt=top+TRH+GRH,bh=Math.max(10,g.vb-bt-1);
    var smax=1;V.forEach(function(b,j){smax=Math.max(smax,b.vx||b.v,(S.av[j+off]||0)*2.1);});
    function VY(v){return g.vb-Math.min(bh,v/smax*bh);}
    var bwv=Math.max(1,g.bw*.72),thin=bwv<3,nWv=0,nG=0,nT=0;
    x.save();x.beginPath();x.rect(g.pl-2,top,g.barsEnd-g.pl+6,g.vh+1);x.clip();
    // Weis waves: translucent cumulative wave-volume columns behind everything, own scale (the biggest visible wave = the panel height)
    var wmax=1,WH=g.vh-TRH-2,lab=[];
    if(LY.weis){V.forEach(function(b,j){var c=S.cum[j+off];if(c>wmax)wmax=c;});
      V.forEach(function(b,j){var q=j+off,w=S.wv[S.wid[q]];if(!w)return;var h=S.cum[q]/wmax*WH,up=w.d>0;
        x.fillStyle=up?'rgba(57,255,136,.16)':'rgba(255,43,214,.17)';x.fillRect(g.X(j)-g.bw/2,g.vb-h,g.bw+.6,h);
        x.fillStyle=up?'rgba(57,255,136,.55)':'rgba(255,43,214,.58)';x.fillRect(g.X(j)-g.bw/2,g.vb-h,g.bw+.6,1);});
      var seen={};V.forEach(function(b,j){var w=S.wv[S.wid[j+off]];if(w&&!seen[S.wid[j+off]]){seen[S.wid[j+off]]=1;nWv++;
        var a=Math.max(w.s,off)-off,e=Math.min(w.e,off+n-1)-off;lab.push({a:a,e:e,w:w,v:S.cum[e+off]});}});
}
    // 1×–2× average band + dashed 2× line
    var pts=[];V.forEach(function(b,j){var a=S.av[j+off];if(a!=null)pts.push([g.X(j),a]);});
    function path(mul){x.beginPath();pts.forEach(function(p,q){var y=VY(p[1]*mul);q?x.lineTo(p[0],y):x.moveTo(p[0],y);});}
    if(pts.length>1){x.beginPath();pts.forEach(function(p,q){var y=VY(p[1]);q?x.lineTo(p[0],y):x.moveTo(p[0],y);});
      for(q=pts.length-1;q>=0;q--)x.lineTo(pts[q][0],VY(pts[q][1]*2));x.closePath();x.fillStyle='rgba(0,229,255,.055)';x.fill();
      x.setLineDash([3,3]);x.strokeStyle='rgba(200,205,255,.34)';x.lineWidth=1;path(2);x.stroke();x.setLineDash([]);}
    // the bars: colour = RV, fill = close position, white-hot glow at >= 3x
    V.forEach(function(b,j){var q=j+off,r=S.rv[q],c=rvCol(r),f=S.cp[q],x0=g.X(j)-bwv/2,y=VY(b.v),h=g.vb-y;if(h<1){h=1;y=g.vb-1;}
      var cl=r!=null&&r>=VSA_T.climax;if(cl){x.shadowColor='#fff2c0';x.shadowBlur=nw?6:9;}
      x.fillStyle=c;x.strokeStyle=c;
      if(thin){x.globalAlpha=f>=2/3?1:f>=1/3?.6:.3;x.fillRect(x0,y,bwv,h);x.globalAlpha=1;}
      else{var lw=bwv<5?1:1.3;if(f>=2/3)x.fillRect(x0,y,bwv,h);else{x.lineWidth=lw;x.strokeRect(x0+lw/2,y+lw/2,bwv-lw,Math.max(.5,h-lw));if(f>=1/3)x.fillRect(x0,y+h/2,bwv,h/2);}}
      if(cl)x.shadowBlur=0;
      if(b.vx){var yx=VY(b.vx);x.save();x.setLineDash([2,2]);x.lineWidth=1;x.globalAlpha=.8;x.strokeRect(x0,yx,bwv,g.vb-yx);x.restore();}});   // provisional period: pro-rated outline
    // glowing 20-bar average line
    if(pts.length>1){x.save();x.strokeStyle='#4de8ff';x.lineWidth=nw?1.1:1.3;x.shadowColor='#00e5ff';x.shadowBlur=nw?4:6;path(1);x.stroke();x.restore();}
    // Weis wave totals (on top of the bars, dark backing)
    if(LY.weis&&TX){x.font=(nw?6:7)+'px '+FONT;x.textAlign='center';var placed=[];
      lab.slice().sort(function(a,b){return b.v-a.v;}).forEach(function(L){if(L.e-L.a+1<(nw?3:2))return;var t=(L.w.d>0?'+':'−')+fmtV(L.v),tw=x.measureText(t).width,cx=(g.X(L.a)+g.X(L.e))/2;   // biggest waves first
        cx=Math.max(g.pl+tw/2+1,Math.min(g.barsEnd-tw/2,cx));if(placed.some(function(r){return cx-tw/2<r[1]+3&&cx+tw/2>r[0]-3;}))return;placed.push([cx-tw/2,cx+tw/2]);
        var y=Math.max(top+TRH+fsT+2,g.vb-L.v/wmax*WH-3);x.fillStyle='rgba(7,6,26,.72)';x.fillRect(cx-tw/2-2,y-fsT-1,tw+4,fsT+3);
        x.fillStyle=L.w.d>0?'#8cffb9':'#ff8ceb';x.fillText(t,cx,y);});}
    // effort vs result glyphs just above the bar
    if(TX)V.forEach(function(b,j){var gg=S.gl[j+off];if(!gg)return;nG++;var cx=g.X(j),y=Math.max(bt-1,VY(b.v)-3);
      if(gg==='abs'){var z=nw?3:3.6;x.fillStyle='#72f6ff';x.beginPath();x.moveTo(cx,y-z*1.7);x.lineTo(cx-z,y);x.lineTo(cx+z,y);x.closePath();x.fill();}
      else{x.strokeStyle='#d9ccff';x.lineWidth=1.2;x.beginPath();x.arc(cx,y-(nw?2.8:3.2),nw?2.4:2.8,0,Math.PI*2);x.stroke();}});
    x.restore();
    // header + neon tags (tag row on top of the panel; full name, else the short code, else a second row, else just a tick)
    if(TX){var occ=[],la=null;for(k=off+n-1;k>=off;k--){if(S.av[k]!=null){la=S.av[k];break;}}
      x.font=fsT+'px '+FONT;x.textAlign='left';var ht='VSA VOL'+(la?' · AVG20 '+fmtV(la):''),hw=x.measureText(ht).width;
      x.fillStyle='#8fe9ff';x.fillText(ht,g.pl+4,top+fsT+2);occ.push([g.pl,g.pl+4+hw+4,0]);
      tg.sort(function(a,b){return (b.m.hi-a.m.hi)||(b.i-a.i);});   // high significance first, then newest
      tg.forEach(function(t){var cx=g.X(t.i),C2=[[t.m.full,0],[t.m.sh,0],[t.m.full,1],[t.m.sh,1]],pl=null;
        for(var q=0;q<C2.length&&!pl;q++){var tw=x.measureText(C2[q][0]).width+6,x0=Math.max(g.pl,Math.min(g.barsEnd-tw,cx-tw/2)),x1=x0+tw,row=C2[q][1];
          if(!occ.some(function(o){return o[2]===row&&x0<o[1]+2&&x1>o[0]-2;})){occ.push([x0,x1,row]);pl={s:C2[q][0],x0:x0,w:tw,row:row};}}
        var by=VY(V[t.i].v);
        x.save();
        if(pl){nT++;var y0=top+1+pl.row*RH,h0=RH-1;x.strokeStyle=t.c;x.globalAlpha=.5;x.lineWidth=1;x.beginPath();x.moveTo(cx+.5,y0+h0);x.lineTo(cx+.5,Math.max(y0+h0,by-2));x.stroke();x.globalAlpha=1;
          x.fillStyle='rgba(7,6,26,.9)';x.fillRect(pl.x0,y0,pl.w,h0);if(t.m.hi){x.shadowColor=t.c;x.shadowBlur=nw?6:9;}x.lineWidth=t.m.hi?1.6:1;x.strokeRect(pl.x0+.5,y0+.5,pl.w-1,h0-1);
          x.shadowBlur=t.m.hi?(nw?4:6):0;x.fillStyle=t.c;x.textAlign='left';x.fillText(pl.s,pl.x0+3,y0+h0-3);}
        else{x.fillStyle=t.c;x.fillRect(cx-1.5,top+2,3,3);}
        x.restore();});}
    VSTAT={mode:'vsa',tags:nT,signs:tg.length,glyphs:nG,waves:nWv,weis:LY.weis?1:0};}
  var state=(D.alert_state||D.status||'SETUP').toUpperCase(), lvlCls='lvl-'+state.toLowerCase().replace(/[^a-z]+/g,'-');

  // ---------------------------------------------------------------- RISK box (fixed desk rules; computed in charts.py)
  function pct(v){return v==null?'—':(+v).toFixed(1)+'%';}
  // $ POSITION SIZE block (4 Oct 2026, Chris): a $10,000 default position per trade (changeable, one value for every page: wa_pos.js WAPos),
  // assumed bought at the plan's buy-stop entry -> shares, $ / % risk to the stop, 2R / 3R prices and $ profit. Shorts mirrored (stop above).
  function posSrc(){var P0=D.entry==null&&PLS.length?PLS[0].pnl:null,e=D.entry!=null?D.entry:P0&&P0.entry,st=D.entry!=null?D.stop:P0&&P0.stop;
    var side=(P0&&P0.side)||(st!=null&&e!=null&&st>e?'short':'long');
    // ACTIVE (triggered) trade -> its last close for the NOW $ P/L line (pending plans: none)
    var open=D.entry!=null?!!(PGO&&PG.last!=null):!!(P0&&P0.state==='open'&&P0.last!=null),lc=open?(D.entry!=null?PG.last:P0.last):null;
    return {e:e,s:st,side:side,last:lc};}
  function pgUsd(){var q=posSrc();if(!window.WAPos||q.last==null)return '';var o=WAPos.calc(q.e,q.s,q.side,null,q.last);return o&&o.pl!=null?' · '+WAPos.plc(o):'';}
  function money0(v){return window.WAPos?WAPos.usd(v):'$'+Math.round(v).toLocaleString();}
  function posOut(){var W=window.WAPos;if(!W)return '';var q=posSrc(),o=W.calc(q.e,q.s,q.side,null,q.last);if(!o)return '<span class="neg">NO ENTRY — NO POSITION</span>';
    var bs=o.side==='short'?'SELL STOP ':'BUY STOP ';
    return (o.pl!=null?'<div class="tc-now '+(o.pl>=0?'pos':'neg')+'" title="active trade: shares × (last close − entry)'+(o.side==='short'?', inverted for a short':'')+'"><b>'+esc(W.now(o))+'</b></div>':'')+'<div>'+bs+o.entry.toFixed(2)+' → <b>'+o.shares.toLocaleString('en-US')+' SH</b> ('+money0(o.cost)+')</div>'+
      (o.risk!=null?'<div>STOP '+o.stop.toFixed(2)+' → RISK <b class="neg">'+money0(o.risk)+'</b> ('+o.risk_pct.toFixed(1)+'%)</div>'+
        '<div>2R '+o.r2.toFixed(2)+' → <b class="pos">+'+money0(o.p2)+'</b> · 3R '+o.r3.toFixed(2)+' → <b class="pos">+'+money0(o.p3)+'</b></div>':
        '<div class="neg">NO STOP ON THIS PLAN — NO $ RISK / 2R / 3R</div>');}
  function posBox(){if(!window.WAPos)return '';var v=WAPos.get();
    return '<div class="tc-pos" id="tc-pos"><label class="pz">POSITION $<input id="tc-psz" inputmode="decimal" value="'+v.toLocaleString('en-US')+'" aria-label="Position size in dollars per trade (not account size); one value for every chart, saved in this browser"></label>'+
      '<span class="pzn">$ PER TRADE · NOT ACCOUNT SIZE · ONE VALUE FOR EVERY CHART</span><div id="tc-pos-out" class="out">'+posOut()+'</div></div>';}
  function wirePos(){var inp=document.getElementById('tc-psz'),out=document.getElementById('tc-pos-out');if(!inp||!window.WAPos)return;
    inp.addEventListener('input',function(){if(WAPos.set(inp.value)){out.innerHTML=posOut();document.querySelectorAll('#tc-hud .tc-pgd').forEach(function(e){if(e.textContent)e.textContent=pgUsd();});}});
    inp.addEventListener('blur',function(){inp.value=WAPos.get().toLocaleString('en-US');});
    WAPos.on(function(v){if(document.activeElement!==inp)inp.value=v.toLocaleString('en-US');out.innerHTML=posOut();document.querySelectorAll('#tc-hud .tc-pgd').forEach(function(e){if(e.textContent)e.textContent=pgUsd();});var lg=document.getElementById('tc-legend');if(lg&&window._tcLegend)lg.innerHTML=window._tcLegend();});}
  function plPos(x){var W=window.WAPos,p=x.pnl;if(!W||p.stop==null)return '';var o=W.calc(p.entry,p.stop,p.side);if(!o||o.risk==null)return '';
    return ' · '+money0(o.size)+': '+o.shares.toLocaleString('en-US')+' SH · RISK '+money0(o.risk)+' · 2R +'+money0(o.p2)+' · 3R +'+money0(o.p3);}
  function riskBox(){
    var RP=D.risk_plan||{}, sz=RP.size_pct||{}, t=RP.tier==null?0.75:RP.tier, skip=t==='SKIP';
    if(RP.default==null)RP={default:0.75,min:0.5,max:1,tier:t,short:'PLAN HAS NO STOP',reasons:['desk default 0.75% risk; no stop on this plan, so no position size'],size_pct:{}};   // same fixed rules as charts.py RISK_RULES
    var tierTxt=skip?'SKIP':(t+'%'), tcls=skip?'neg':t>=1?'pos':t<=0.5?'warn':'';
    return '<div class="tc-risk" id="tc-risk"><div class="rh">RISK</div>'+posBox()+
      '<div class="tc-acr"><div class="acr">% OF ACCOUNT RULE · '+RP.default+'% DEFAULT · RANGE '+RP.min+'–'+RP.max+'%</div>'+
      '<div class="tier '+tcls+'" title="'+esc((RP.reasons||[]).join(' | '))+'">TIER: '+tierTxt+' — '+esc(RP.short||'')+'</div>'+
      (RP.stop_pct!=null?'<div>SIZE = RISK ÷ '+RP.stop_pct.toFixed(2)+'% STOP: 0.5% → '+pct(sz['0.5'])+' · 0.75% → <b>'+pct(sz['0.75'])+'</b> · 1% → '+pct(sz['1'])+' OF ACCT</div>':'<div class="neg">STOP NOT SET — NO % SIZE</div>')+'</div>'+
      (RP.stop_pct!=null?'<details class="calcd"><summary>ACCOUNT SHARES CALC ▸</summary><div class="calc"><label>ACCT $<input id="tc-acct" inputmode="decimal" placeholder="e.g. 100000" aria-label="Account size in dollars (saved in this browser only)"></label>'+
      '<span class="sel" role="radiogroup" aria-label="Risk per trade">'+[0.5,0.75,1].map(function(r){return '<button type="button" data-r="'+r+'">'+r+'%</button>';}).join('')+'</span>'+
      '<div id="tc-calc-out" class="out">ENTER ACCOUNT SIZE (NOT POSITION) FOR SHARES / $ RISK AT THE % RULE</div></div></details>':'')+'</div>';
  }
  function wireRisk(){
    var RP=D.risk_plan||{}, inp=document.getElementById('tc-acct'), out=document.getElementById('tc-calc-out'); if(!inp) return;
    var ls={get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
    var r=parseFloat(ls.get('tc_risk_pct'))||(RP.tier==='SKIP'?RP.default:RP.tier)||RP.default;
    inp.value=ls.get('tc_account')||''; if(inp.value){var dd=inp.closest('details'); if(dd) dd.open=true;}
    function upd(){
      document.querySelectorAll('#tc-risk .sel button').forEach(function(b){b.setAttribute('aria-pressed',String(+b.getAttribute('data-r')===r));});
      var a=parseFloat(String(inp.value).replace(/[, $]/g,''));
      if(!(a>0)){out.textContent='ENTER ACCOUNT SIZE FOR SHARES / $ RISK';return;}
      var riskD=a*r/100, per=D.entry-D.stop, sh=Math.floor(riskD/per), pos=sh*D.entry;
      out.innerHTML=(RP.tier==='SKIP'?'<span class="neg">SKIP TIER · </span>':'')+'@'+r+'%: <b>'+sh.toLocaleString()+' SH</b> · $'+Math.round(sh*per).toLocaleString()+' AT RISK · $'+Math.round(pos).toLocaleString()+' ('+(pos/a*100).toFixed(1)+'%) POSITION';
    }
    inp.addEventListener('input',function(){ls.set('tc_account',inp.value);upd();});
    document.querySelectorAll('#tc-risk .sel button').forEach(function(b){b.addEventListener('click',function(){r=+b.getAttribute('data-r');ls.set('tc_risk_pct',String(r));upd();});});
    upd();
  }

  // ---------------------------------------------------------------- HUD (DOM) + gauge
  var rm=D.rmult, rmTxt=rm==null?'N/A':(rm>=0?'+':'')+rm.toFixed(1)+'R';
  // open-trade P/L from research-tools/trade_pct.py (charts.py payload "pnl"): % from entry on the last completed session close, sessions
  // since the trigger, MFE %; pending -> distance to entry. Used only when it was computed for this chart's entry (stock.js may swap levels).
  var PG=(D.pnl&&D.entry>0&&D.pnl.entry>0&&Math.abs(D.pnl.entry-D.entry)/D.entry<0.005)?D.pnl:null, PGO=!!(PG&&PG.state==='open'&&PG.pct!=null);
  function pgf(v){return (v>=0?'+':'')+v.toFixed(1)+'%';}
  var pgTxt=PGO?pgf(PG.pct)+' FROM ENTRY':(PG&&PG.to_entry_pct!=null)?'ENTRY '+Math.abs(PG.to_entry_pct).toFixed(1)+'% '+(PG.to_entry_pct>=0?'ABOVE':'BELOW'):'';
  var pgSub=PGO?[PG.days!=null?PG.days+'D':'',PG.mfe_pct!=null?'MFE '+pgf(PG.mfe_pct):''].filter(Boolean).join(' · '):'';
  var pgCls=PGO?(PG.pct>=0?'pos':'neg'):'pend';
  if(PG&&PG.off_scan)pgSub=(pgSub?pgSub+' · ':'')+'OFF SCAN · OLD LEVELS';
  // other open / pending plans for this ticker (charts.py plans_for: springs, VCP/SEPA..., Setup Master, MA Stack GUD / Spring->Bull / flips,
  // Wyckoff tickets), % recomputed on this chart's bars; the chart's own plan is not repeated. None -> nothing shown.
  var PLS=(D.plans||[]).filter(function(x){return x&&x.pnl&&(x.pnl.pct!=null||x.pnl.to_entry_pct!=null);});
  function plTxt(x,short){var p=x.pnl,o=p.state==='open';return o?pgf(p.pct)+(short?'':' from '+(+p.entry).toFixed(2))+(p.r!=null?' · '+(p.r>=0?'+':'')+p.r.toFixed(1)+'R':'')+(p.days!=null?' · '+p.days+'D':'')+(!short&&p.mfe_pct!=null?' · MFE '+pgf(p.mfe_pct):'')
    :'ENTRY '+(+p.entry).toFixed(2)+' '+Math.abs(p.to_entry_pct).toFixed(1)+'% '+(p.to_entry_pct>=0?'ABOVE':'BELOW');}
  function plCls(x){return x.pnl.state==='open'?(x.pnl.pct>=0?'pos':'neg'):'pend';}
  var PL0=!pgTxt&&PLS.length?PLS[0]:null;
  var pgTip=PG?'entry '+PG.entry+' → last close '+PG.last+' ('+(PG.last_date||'')+')'+(PG.since?'; triggered '+PG.since:'')+(PG.basis?'; '+PG.basis:''):'';
  var words=state.split(' '), lvlHtml=words.length>1?esc(words.slice(0,Math.ceil(words.length/2)).join(' '))+'<br>'+esc(words.slice(Math.ceil(words.length/2)).join(' ')):esc(state);
  $('tc-hud').innerHTML=
    '<div class="tc-id"><div class="tc-tk">'+esc(D.ticker)+'</div><div class="tc-sub">'+esc(((D.company||'').replace(/[,.].*$/,'').split(/\s+/)[0]||'').toUpperCase().slice(0,14))+' · <span class="tc-tfl">'+TFN[TF]+'</span></div></div>'+
    '<div class="tc-blk"><div class="l">PRICE</div><div class="v">'+money(D.last)+'</div><div class="tc-sub">'+esc(D.last_date)+'</div></div>'+
    '<div class="tc-blk"><div class="l">LEVEL</div><div class="v tc-lvl '+lvlCls+'">'+lvlHtml+'</div></div>'+
    '<div class="tc-blk"><div class="l">R-MULT</div><div class="v tc-rm '+(rm==null?'':rm>=0?'pos':'neg')+'">'+rmTxt+'</div>'+
      (pgTxt?'<div class="tc-pg '+pgCls+'" title="'+esc(pgTip)+'">'+esc(pgTxt)+'<span class="tc-pgd">'+(PGO?pgUsd():'')+'</span></div>'+(pgSub?'<div class="tc-sub tc-pgs">'+esc(pgSub)+'</div>':''):
       PL0?'<div class="tc-pg '+plCls(PL0)+'" title="'+esc(PL0.label+(PL0.pnl.basis?' · '+PL0.pnl.basis:''))+'">'+esc(PL0.pnl.state==='open'?pgf(PL0.pnl.pct)+' FROM ENTRY':plTxt(PL0,true))+'<span class="tc-pgd">'+(PL0.pnl.state==='open'?pgUsd():'')+'</span></div>'+
         '<div class="tc-sub tc-pgs">'+esc([PL0.pnl.state==='open'&&PL0.pnl.r!=null?(PL0.pnl.r>=0?'+':'')+PL0.pnl.r.toFixed(1)+'R':'',PL0.pnl.state==='open'&&PL0.pnl.days!=null?PL0.pnl.days+'D':'',String(PL0.label).toUpperCase()].filter(Boolean).join(' · '))+(PLS.length>1?' · +'+(PLS.length-1)+' MORE IN KEY':'')+'</div>':'')+
      (D.risk?'<div class="tc-sub">1R = $'+D.risk.toFixed(2)+'</div>':'')+'</div>'+
    riskBox()+
    '<div class="tc-gwrap">'+(hasR?'<canvas id="tc-gauge" aria-label="HP bar: price position between stop and 3R"></canvas>':'<div class="tc-warn">☠ STOP NOT SET — no R targets (desk has no documented stop)</div>')+'</div>';
  wireRisk();wirePos();
  var stTxt=D.status?String(D.status).toUpperCase():'';
  $('tc-level').innerHTML='<span class="'+lvlCls+'">LEVEL: <b>'+esc(state)+'</b>'+(stTxt&&stTxt!==state?' · '+esc(stTxt):'')+'</span>';
  // no plan at all (no chart levels and no plan_index plan): no trade panel / RISK / meter / LEVEL chip, on every surface alike
  var NOPLAN=D.entry==null&&!PLS.length;document.body.classList.toggle('tc-noplan',NOPLAN);
  if(NOPLAN){$('tc-hud').hidden=true;$('tc-hud').style.display='none';$('tc-level').hidden=true;$('tc-level').style.display='none';}

  var DPR=2;function setup(cv,w,h){var d=Math.max(2,window.devicePixelRatio||1),W2=Math.round(w*d),H2=Math.round(h*d),x=cv.getContext('2d');DPR=d;   // the backing store is only reallocated when the size changes (phone performance)
    if(cv.width!==W2||cv.height!==H2){cv.width=W2;cv.height=H2;cv.style.width=w+'px';cv.style.height=h+'px';}else if(typeof x.reset==='function')x.reset();else cv.width=W2;
    x.setTransform(d,0,0,d,0,0);return x;}
  function snp(v,lw){var d=DPR,o=(Math.round((lw||1)*d)%2)/2;return (Math.round(v*d-o)+o)/d;}   // crisp: snap a line of width lw to the device-pixel grid

  function drawGauge(){
    var cv=$('tc-gauge'); if(!cv) return;
    // trade strip in R (Chris 4 Oct: "that white stick in the meter tracker should always have the current percentage of the trade on it"):
    // STOP (-1R) → ENTRY (0) → 2R → 3R linear; past 3R the scale extends (compressed, log) to the next of 5R / 10R / 20R / 50R / 100R with
    // room above the current R, so the stick keeps moving as the trade runs and never parks at the end. The stick carries its own callout
    // (open: % from entry · R, green / red; pending: distance to the entry), clamped inside the strip. % ticks (+10 / +20 ...; layer 'pct')
    // map onto the same scale; % levels beyond the end are listed at the right of the % row.
    var PCT=!!LS.L.pct&&D.entry>0, TXg=!!LS.text, R1=D.entry-D.stop, SH=R1<0?-1:1;
    var gw=Math.max(200,cv.parentNode.getBoundingClientRect().width), gh=PCT?108:94, g=setup(cv,gw,gh);cv.parentNode.style.minHeight=gh+'px';
    var gx0=10,gx1=gw-14,gy=40,seg=gw<420?16:24,sh=22;
    function rOf(v){return (v-D.entry)/R1;}
    var cr=rOf(D.last), TOPS=[3,5,10,20,50,100], topR=3;TOPS.some(function(t){topR=t;return cr*1.15+0.25<=t;});
    var F3=topR===3?1:(gw<420?0.62:0.66);   // share of the strip for STOP → 3R
    function xr(r){var f=r<=3?(r+1)/4*F3:F3+(1-F3)*Math.log(r/3)/Math.log(topR/3);return gx0+Math.max(0,Math.min(1,f))*(gx1-gx0);}
    function gxp(v){return xr(rOf(v));}
    function rAt(f){return f<=F3?f/F3*4-1:3*Math.pow(topR/3,(f-F3)/(1-F3));}   // segment centre -> R
    var mx=Math.max(gx0,Math.min(gx1,xr(cr)));
    var sw=(gx1-gx0)/seg;
    for(var i=0;i<seg;i++){var rv=rAt((i+.5)/seg),on=gx0+(i+.5)*sw<=mx,col=rv<0?C.stop:rv<2?'#ff9f1c':rv<3?C.r2:C.r3;
      g.fillStyle=on?col:'#241f4a';g.shadowColor=col;g.shadowBlur=on?8:0;g.fillRect(gx0+i*sw+1,gy,sw-3,sh);}
    g.shadowBlur=0;g.strokeStyle='#6b5cff';g.lineWidth=2;g.strokeRect(gx0-2,gy-3,gx1-gx0+3,sh+6);
    if(topR>3){var x3=xr(3);g.save();g.strokeStyle='rgba(255,215,0,.55)';g.setLineDash([2,2]);g.lineWidth=1;g.beginPath();g.moveTo(x3,gy-3);g.lineTo(x3,gy+sh+3);g.stroke();g.restore();}   // compressed beyond here
    var rEndL=-1e9;g.font='7px '+FONT;   // R labels left→right; a label that would overlap the previous one is skipped (its tick stays)
    var TK=[['STOP',-1,C.stop],['ENTRY',0,C.entry],['2R',2,C.r2],['3R',3,C.r3]];[5,10,20,50,100].forEach(function(t){if(t<=topR)TK.push([t+'R',t,'#ffe680']);});
    TK.forEach(function(a){var x=xr(a[1]),w=g.measureText(a[0]).width,x0=Math.max(gx0-2,Math.min(gx1+2-w,x-w/2));
      g.fillStyle=a[2];g.fillRect(x-1,gy+sh+3,3,8);if(x0<rEndL+5){if(a[1]>3)return;x0=rEndL+5;}g.textAlign='left';g.fillText(a[0],x0,gy+sh+22);rEndL=x0+w;});
    var top=D.entry+topR*R1;
    if(PCT){   // % ticks: thin dim notch under the bar + a dim label on their own row below the R labels (no collisions with 2R / 3R)
      g.font='6px '+FONT;var lastX=-1e9,far=[],ry=gy+sh+35,rEnd=gx1,KS=[];for(var k=1;k<=20;k++)KS.push(k*10);[300,500,1000].forEach(function(q){KS.push(q);});
      KS.forEach(function(q){var pv=D.entry*(1+q/100);if(SH*(pv-top)>1e-9){if(q<=30)far.push(q);return;}var px=gxp(pv);
        g.fillStyle='rgba(185,178,232,.55)';g.fillRect(Math.round(px)-0.5,gy+sh+3,1,5);g.fillRect(Math.round(px)-0.5,gy-3,1,3);});
      if(far.length&&TXg){var ft=far.map(function(q){return '+'+q+'% '+(D.entry*(1+q/100)).toFixed(2);}).join(' · ')+' →';g.textAlign='right';g.fillStyle='#6f6a9c';g.fillText(ft,gx1,ry);rEnd=gx1-g.measureText(ft).width-10;}
      if(TXg)KS.forEach(function(q){var pv2=D.entry*(1+q/100);if(SH*(pv2-top)>1e-9)return;var px2=gxp(pv2),lt='+'+q+'%',lw=g.measureText(lt).width;
        var lx=Math.max(gx0,Math.min(gx1+2-lw,px2-lw/2));if(lx<lastX+6||lx+lw>rEnd+2)return;g.textAlign='left';g.fillStyle='#8f88c4';g.fillText(lt,lx,ry);lastX=lx+lw;});}
    // the stick + its callout (always attached: the box is centred on the stick, clamped inside the strip, joined by the stick's pointer)
    var ko=D.last<=D.stop&&SH>0||D.last>=D.stop&&SH<0, pend=!!(PG&&!PGO&&PG.to_entry_pct!=null), st=PGO?'open':pend?'pending':'level';
    var pctNow=PGO?PG.pct:(D.last/D.entry-1)*100*SH, rTxt=(cr>=0?'+':'')+cr.toFixed(1)+'R';
    var lab=pend?'ENTRY '+Math.abs(PG.to_entry_pct).toFixed(1)+'% '+(PG.to_entry_pct>=0?'ABOVE':'BELOW'):(ko?'KO ':'')+pgf(pctNow)+' · '+rTxt;
    var lc=pend?C.entry:pctNow>=0?'#39ff88':'#ff3d7f';
    g.font='8px '+FONT;var lw2=g.measureText(lab).width+10,lh=13,lx2=Math.max(1,Math.min(gw-1-lw2,mx-lw2/2)),ly2=gy-26;
    g.fillStyle='#fff';g.shadowColor='#fff';g.shadowBlur=10;g.beginPath();g.moveTo(mx,gy-2);g.lineTo(mx-6,gy-11);g.lineTo(mx+6,gy-11);g.fill();g.fillRect(mx-1,gy-2,3,sh+4);g.shadowBlur=0;
    g.fillStyle='#07061a';g.fillRect(lx2,ly2-lh+3,lw2,lh);g.strokeStyle=lc;g.lineWidth=1.5;g.strokeRect(lx2+.5,ly2-lh+3.5,lw2-1,lh-1);
    g.fillStyle=lc;g.fillRect(mx-1,ly2+3,3,gy-11-(ly2+3));   // stem: callout -> stick
    g.textAlign='left';g.fillText(lab,lx2+5,ly2);
    var gtit=gw>420?'HP / XP  ·  STOP → '+topR+'R':'HP / XP',gtw;g.font='7px '+FONT;gtw=g.measureText(gtit).width;g.fillStyle='#9a93d8';
    if(lx2>gx0+gtw+8){g.textAlign='left';g.fillText(gtit,gx0,ly2);}else if(lx2+lw2<gx1-gtw-8){g.textAlign='right';g.fillText(gtit,gx1,ly2);}
    window.TC_METER={state:st,r:+cr.toFixed(3),topR:topR,x:Math.round(mx),x0:gx0,x1:gx1,w:gw,lab:lab,lbox:[Math.round(lx2),Math.round(lx2+lw2)],ko:ko?1:0};
  }

  // ---------------------------------------------------------------- chart
  var host=$('tc-chart'), cv=document.createElement('canvas'), tip=document.createElement('div');
  cv.className='tc-canvas'; tip.className='tc-tip'; tip.hidden=true; host.appendChild(cv); host.appendChild(tip);
  var TLK='wa.desk.tl.v1',TLOK='wa.desk.tlopt.v1',TKR=String(D.ticker||D.t||location.pathname).toUpperCase(),TL={mode:0,sel:-1,p1:null,hov:null,drag:null,mag:1,ext:1,w:0,lines:[],g:[]};
  var geo=null, hover=-1, hoverY=-1, t0=performance.now(), PVR=null, HRAF=0;

  function levels(){
    var L=[];
    if(D.entry!=null) L.push({k:'entry',v:D.entry,c:C.entry,w:2,t:['▶ BUY '+money(D.entry)],short:['▶ BUY '+D.entry.toFixed(2)],nt:'▶ BUY '+D.entry.toFixed(2)});
    if(D.stop!=null) L.push({k:'stop',v:D.stop,c:C.stop,t:['STOP '+money(D.stop)+' (-0.75%)','— GAME OVER'],short:['STOP '+D.stop.toFixed(2)+' (-.75%)'],nt:'STOP '+D.stop.toFixed(2),w:2,skull:1});
    if(RP.m05!=null) L.push({k:'a05',v:RP.m05,c:C.a05,t:['-0.5% ACCT '+money(RP.m05)],short:['-0.5% '+RP.m05.toFixed(2)],nt:'-.5% '+RP.m05.toFixed(2),w:1.5,dash:[5,3],thin:1,bg:'#170a26'});
    if(RP.m10!=null) L.push({k:'a10',v:RP.m10,c:C.a10,t:['⚠ -1.0% ACCT '+money(RP.m10)+' MAX'],short:['-1.0% '+RP.m10.toFixed(2)+' MAX'],nt:'-1% '+RP.m10.toFixed(2),w:2,dash:[6,3],warn:1,bg:'#2a0626'});
    (D.cuts||[]).forEach(function(ct){L.push({k:'cut',v:ct.price,c:C.cut,t:['✂ '+ct.label],short:['✂ '+ct.label.replace(' (close)','')],nt:'✂'+ct.label.replace(' (close)','').replace(/^CUT\s*/,''),w:1.5,dash:[4,3],thin:1});});
    if(D.r2!=null) L.push({k:'r2',v:D.r2,c:C.r2,w:2,t:['★ 2R '+money(D.r2)],short:['★ 2R '+D.r2.toFixed(2)],nt:'2R '+D.r2.toFixed(2)});
    if(D.r3!=null) L.push({k:'r3',v:D.r3,c:C.r3,w:2,t:['★★ 3R BOSS '+money(D.r3)],short:['★★ 3R '+D.r3.toFixed(2)],nt:'3R '+D.r3.toFixed(2)});
    return L;
  }

  // BUY lines (4 Oct 2026, Chris: "Does power play and all other setups have a horizontal buy line for where to enter? I'm seeing a stop but no
  // buy line" + "It just needs to project forward for 5 bars and that's all"). Every plan with an entry draws a short solid line at the buy-stop
  // entry: from the trigger bar (open trade) or the last bar (pending), 5 bars forward, labelled '▶ BUY 59.31 · SETUP'. Sources: the chart's own
  // levels (D.entry; its right-edge tag reads '▶ BUY'), every other plan with an entry + stop (D.plans: flat base, SEPA, MA Stack GUD, Spring →
  // Bull, Setup Master, springs) and overlay ENTRY hlines (springs, Wyckoff tickets). Entries within 0.4% share one line + one label. Layer 'entry'.
  var SETN={powerplay:'POWER PLAY',vcp:'VCP',sepa:'SEPA',flatbase:'FLAT BASE',htf:'HIGH TIGHT FLAG',spring_tr:'SPRING (TR)',spring_up:'SPRING (UP)',mastack:'MA STACK GUD',
    mastack_sb:'SPRING → BULL',setup_master:'SETUP MASTER',ema_pullback:'EMA PULLBACK'};
  function setupName(){var s=String(D.setup||'').split('→')[0].replace(/\bscanner\b/i,'').replace(/\s+/g,' ').trim();if(SETN[s.toLowerCase()])s=SETN[s.toLowerCase()];if(!s&&D.scanner)s=SETN[D.scanner]||D.scanner;return s.toUpperCase().slice(0,28);}
  function planName(p){var l=String(p.label||'').split('·')[0].replace(/\(since[^)]*\)/i,'').trim();return (l||SETN[p.src]||p.src||'PLAN').toUpperCase().slice(0,28);}
  function buyWant(){var w=[],P0=D.pnl||{};
    if(D.entry!=null&&!D.no_levels)w.push({v:+D.entry,nm:setupName(),src:'levels',main:1,side:D.side==='short'?'short':'long',d:P0.state==='open'?(P0.since||D.trade_since||null):null});
    (D.plans||[]).forEach(function(p){var q=p&&p.pnl;if(!q||q.entry==null||q.stop==null)return;w.push({v:+q.entry,nm:planName(p),src:p.src||'plan',side:q.side==='short'?'short':'long',d:q.state==='open'?(q.since||null):null});});
    OVL.forEach(function(o){if(!o.on)return;o.items.forEach(function(it){if(it.t==='hline'&&it.buy)w.push({v:+it.p,nm:it.bnm,src:'ovl:'+o.id,side:it.side||'long',d:null});});});
    return w.filter(function(a){return isFinite(a.v)&&a.v>0;});}
  function buyGroups(w){var G=[];w.forEach(function(a){var g=null;G.forEach(function(b){if(!g&&b.side===a.side&&Math.abs(b.v-a.v)/b.v<0.004)g=b;});
    if(g){g.src.push(a.src);if(a.nm&&!g.nms.some(function(q){return q.indexOf(a.nm)===0;})){g.nms=g.nms.filter(function(q){return a.nm.indexOf(q)!==0;});g.nms.push(a.nm);}if(!g.d&&a.d)g.d=a.d;}else G.push({v:a.v,src:[a.src],nms:a.nm?[a.nm]:[],main:a.main||0,side:a.side,d:a.d});});return G;}
  var OVR=[],OVB={l:0,r:1e9};   // placed overlay / BUY label boxes this frame (labels shift instead of covering each other, e.g. 'POWER PLAY BUY' vs 'STOP 24.06')
  function freeBox(x0,y0,w,h,dxs){var tries=[],best=null,bo=Infinity;dxs=dxs||[0];for(var q=0;q<=6;q++)(q?[-q,q]:[0]).forEach(function(r){dxs.forEach(function(dx){tries.push([dx,r*(h+1)]);});});
    for(var k=0;k<tries.length;k++){var xx=Math.max(OVB.l,Math.min(OVB.r-w,x0+tries[k][0])),yy=y0+tries[k][1],ov=0;
      OVR.forEach(function(r){var ox=Math.min(xx+w,r[0]+r[2])-Math.max(xx,r[0]),oy=Math.min(yy+h,r[1]+r[3])-Math.max(yy,r[1]);if(ox>0&&oy>0)ov+=ox*oy;});
      if(!ov){OVR.push([xx,yy,w,h]);return [xx,yy];}if(ov<bo){bo=ov;best=[xx,yy];}}
    OVR.push([best[0],best[1],w,h]);return best;}   // nowhere free: the least-covered spot
  // ---------------------------------------------------------------- bar style + volume profile (4 Oct 2026, Chris: "make our charting package
  // more professional" + "detailed volume profiles", Deepvue as the reference, the desk's dark-neon look kept)
  // HLC is the default (Chris 4 Oct 21:43 "HLC is to be the default"); only an explicit CANDLES pick in LAYERS (saved under the v2 key) switches.
  // The v1 key (candles era) is dropped so nobody keeps candles just because they were the default for a few hours.
  var BSK='wa.desk.chartstyle.v2',BST='hlc';try{if(localStorage.getItem(BSK)==='candle')BST='candle';localStorage.removeItem('wa.desk.chartstyle.v1');}catch(e){}
  // VOLUME PROFILE - method. A horizontal histogram of traded volume by price on the right of the price pane, always built from DAILY
  // sessions (also on 1W / 1M: finer than the period bars; where the daily history does not reach - older 1W / 1M bars - those period bars
  // are used the same way). Range: VISIBLE = every session inside the bars on screen (recomputed on pan / zoom / timeframe), 20 / 50 / 100 =
  // the newest N bars of the current timeframe, TR = the Wyckoff trading-range box (spring_tr_<tf> overlay, else any spring_tr / spring_up box)
  // from its start to its end or today. Bins: N equal price bins (24 / 48 / 72 / 96, default 48) from the lowest low to the highest high of
  // the range. Each session's volume is spread uniformly over its own low→high: a bin gets v × overlap(bin, [L, H]) / (H − L); a session with
  // H = L puts it all in its close's bin, so the bins always sum to the range's total volume. Up / down split: a session's volume is UP when it
  // closed ≥ the prior close, else DOWN (the desk's bar colour). POC = the fullest bin (its mid price). Value area 70%: start at the POC and keep
  // adding the fuller of the next bin above / below until ≥ 70% of the volume is inside; VAH / VAL = its top / bottom edges. HVN / LVN: the
  // profile smoothed 1-2-1; HVN = a local peak ≥ 1.3× the mean bin, LVN = a local trough ≤ 0.5× the mean with ≥ mean volume on both sides
  // (strongest 3 of each). Saved for every chart: localStorage wa.desk.vprof.v1 = {on, m: vis|20|50|100|tr, b: bins}; off by default.
  var VPK='wa.desk.vprof.v1',VPM=['vis','20','50','100','tr'],VPB=[24,48,72,96],VPN={vis:'VISIBLE','20':'20 BARS','50':'50 BARS','100':'100 BARS',tr:'WYCKOFF TR'},VP={on:0,m:'vis',b:48},VPC={};
  function vpLoad(){VP={on:0,m:'vis',b:48};try{var j=JSON.parse(localStorage.getItem(VPK)||'null');if(j){VP.on=j.on?1:0;if(VPM.indexOf(String(j.m))>=0)VP.m=String(j.m);if(VPB.indexOf(+j.b)>=0)VP.b=+j.b;}}catch(e){}}
  vpLoad();
  function vpSave(){try{localStorage.setItem(VPK,JSON.stringify(VP));}catch(e){}}
  function vpTR(){var best=null;OVL.forEach(function(o){var id=o.id||'',r=id==='spring_tr_'+TF?0:/^spring_tr/.test(id)?1:/^spring_up/.test(id)?2:/^wy/.test(id)?3:9;if(r>3)return;
    (o.items||[]).forEach(function(it){if(it.t!=='box'||!it.d0)return;if(!best||r<best.r||(r===best.r&&it.d0>best.d0))best={d0:it.d0,d1:it.d1||null,r:r,id:id};});});return best;}
  function vpCalc(d0,d1,nb){var t0=performance.now(),S=[],DB=DAY.bars,D0=DB.length?DB[0].d:'9999',src='1D',k;
    if(TF!=='D'&&d0<D0)bars.forEach(function(b){if(b.d>=d0&&b.d<=d1&&(b.de||b.d)<D0)S.push(b);});
    var np=S.length;DB.forEach(function(b){if(b.d>=d0&&b.d<=d1)S.push(b);});if(np)src='1D + '+np+' older '+TFN[TF]+' bars';
    if(!S.length)return null;
    var lo=Infinity,hi=-Infinity;S.forEach(function(b){if(b.l<lo)lo=b.l;if(b.h>hi)hi=b.h;});if(!(hi>lo))hi=lo+Math.max(.01,lo*.001);
    var st=(hi-lo)/nb,up=new Float64Array(nb),dn=new Float64Array(nb),t=new Float64Array(nb),tot=0;
    S.forEach(function(b){var v=+b.v||0;if(!(v>0))return;tot+=v;var A=b.up?up:dn;
      if(!(b.h>b.l)){A[Math.min(nb-1,Math.max(0,Math.floor((b.c-lo)/st)))]+=v;return;}
      var k0=Math.max(0,Math.floor((b.l-lo)/st)),k1=Math.min(nb-1,Math.floor((b.h-lo)/st)),r=b.h-b.l;
      for(var q=k0;q<=k1;q++){var a=Math.max(b.l,lo+q*st),z=q===nb-1?b.h:Math.min(b.h,lo+(q+1)*st);if(z>a)A[q]+=v*(z-a)/r;}});
    var poc=0;for(k=0;k<nb;k++){t[k]=up[k]+dn[k];if(t[k]>t[poc])poc=k;}
    var a0=poc,a1=poc,va=t[poc];while(va<.7*tot&&(a0>0||a1<nb-1)){var vb=a0>0?t[a0-1]:-1,vu=a1<nb-1?t[a1+1]:-1;if(vu>=vb){a1++;va+=t[a1];}else{a0--;va+=t[a0];}}
    var sm=[],f=-1,l=-1;for(k=0;k<nb;k++){sm.push((t[Math.max(0,k-1)]+2*t[k]+t[Math.min(nb-1,k+1)])/4);if(t[k]>0){if(f<0)f=k;l=k;}}
    var mean=tot/Math.max(1,l-f+1),hv=[],lv=[],pre=[],suf=[];for(k=0;k<nb;k++)pre[k]=Math.max(k?pre[k-1]:0,sm[k]);for(k=nb-1;k>=0;k--)suf[k]=Math.max(k<nb-1?suf[k+1]:0,sm[k]);
    for(k=Math.max(1,f+1);k<Math.min(nb-1,l);k++){if(sm[k]>=sm[k-1]&&sm[k]>sm[k+1]&&sm[k]>=1.3*mean)hv.push(k);if(sm[k]<=sm[k-1]&&sm[k]<sm[k+1]&&sm[k]<=.5*mean&&pre[k-1]>=mean&&suf[k+1]>=mean)lv.push(k);}
    hv=hv.sort(function(p,q){return sm[q]-sm[p];}).slice(0,3);lv=lv.sort(function(p,q){return sm[p]-sm[q];}).slice(0,3);var hvs={};hv.forEach(function(q){hvs[q]=1;});
    var su=0,sd=0;for(k=0;k<nb;k++){su+=up[k];sd+=dn[k];}
    return {d0:d0,d1:d1,nb:nb,lo:lo,hi:hi,st:st,up:up,dn:dn,t:t,tot:tot,su:su,sd:sd,poc:poc,pocp:lo+(poc+.5)*st,va0:a0,va1:a1,va:va,vah:lo+(a1+1)*st,val:lo+a0*st,hv:hv,hvs:hvs,lv:lv,
      n:S.length,nd:S.length-np,src:src,ms:+(performance.now()-t0).toFixed(2)};}
  function vpGet(d0,d1,nb){var key=[TF,d0,d1,nb,DAY.bars.length,bars.length].join('|');if(!VPC[key]){var ks=Object.keys(VPC);if(ks.length>24)VPC={};VPC[key]=vpCalc(d0,d1,nb);}return VPC[key];}   // cached: a pan only recomputes when the range changes
  function vpRange(g){var V=g.V,n=g.n,L=bars[bars.length-1],m=VP.m;if(!n)return null;
    if(m==='tr'){var tr=vpTR();if(tr){var i0=dix(tr.d0);return {d0:tr.d0,d1:tr.d1||(L.de||L.d),x0:g.X(i0-g.off)-g.bw/2,lab:'WYCKOFF TR',tr:tr.id};}m='vis';}
    if(m==='vis')return {d0:V[0].d,d1:V[n-1].de||V[n-1].d,x0:g.pl,lab:VP.m==='tr'?'VISIBLE (NO TR)':'VISIBLE'};
    var N=+m,j0=Math.max(0,bars.length-N);return {d0:bars[j0].d,d1:L.de||L.d,x0:g.X(j0-g.off)-g.bw/2,lab:N+' BARS'};}
  function drawVP(x,g){var r=vpRange(g),P=r&&vpGet(r.d0,r.d1,VP.b);if(!P){window.TC_VP={on:1,ok:0,mode:VP.m,bins:VP.b};return null;}
    var R=g.R,maxW=Math.max(28,(R-g.pl)*(g.narrow?.3:.24)),x0=Math.max(g.pl,Math.min(r.x0,R-maxW)),tmax=0,k,fp=function(v){return v<1?v.toFixed(4):v.toFixed(2);};
    for(k=0;k<P.nb;k++)if(P.t[k]>tmax)tmax=P.t[k];tmax=tmax||1;
    x.save();x.beginPath();x.rect(g.pl,g.pt,R-g.pl,g.ph);x.clip();
    var yH=g.Y(P.vah),yL=g.Y(P.val),yP=snp(g.Y(P.pocp),1);
    x.fillStyle='rgba(255,174,0,.05)';x.fillRect(x0,yH,R-x0,yL-yH);   // value area band across the range
    for(k=0;k<P.nb;k++){if(!P.t[k])continue;var yt=Math.round(g.Y(P.lo+(k+1)*P.st)),yb=Math.round(g.Y(P.lo+k*P.st)),hh=yb-yt;if(hh>=3)hh-=1;if(hh<1)hh=1;
      var inV=k>=P.va0&&k<=P.va1,hv=P.hvs[k],wu=P.up[k]/tmax*maxW,wd=P.dn[k]/tmax*maxW,a=k===P.poc?.78:hv?.62:inV?.42:.2;
      x.fillStyle='rgba(57,255,136,'+a+')';x.fillRect(R-wu,yt,wu,hh);x.fillStyle='rgba(255,61,127,'+a+')';x.fillRect(R-wu-wd,yt,wd,hh);
      if(hv){x.fillStyle='#72f6ff';x.fillRect(Math.round(R-wu-wd)-2,yt,2,hh);}}   // HVN: cyan cap
    x.lineWidth=1;x.strokeStyle='rgba(255,210,63,.75)';x.setLineDash([2,3]);P.lv.forEach(function(q){var y=snp(g.Y(P.lo+(q+.5)*P.st),1);x.beginPath();x.moveTo(R-maxW,y);x.lineTo(R,y);x.stroke();});   // LVN: yellow dots
    x.strokeStyle='rgba(255,174,0,.5)';x.setLineDash([1,3]);[yH,yL].forEach(function(y){y=snp(y,1);x.beginPath();x.moveTo(x0,y);x.lineTo(R,y);x.stroke();});
    if(r.x0>g.pl+1&&r.x0<R-maxW){var xs=snp(r.x0,1);x.strokeStyle='rgba(255,174,0,.45)';x.setLineDash([2,3]);x.beginPath();x.moveTo(xs,g.pt);x.lineTo(xs,g.pt+g.ph);x.stroke();}   // fixed range: where it starts
    x.setLineDash([]);x.strokeStyle='#ffae00';x.shadowColor='#ffae00';x.shadowBlur=g.narrow?0:4;x.beginPath();x.moveTo(x0,yP);x.lineTo(R,yP);x.stroke();x.restore();
    var hvp=P.hv.map(function(q){return +(P.lo+(q+.5)*P.st).toFixed(4);}),lvp=P.lv.map(function(q){return +(P.lo+(q+.5)*P.st).toFixed(4);});
    var TV={on:1,ok:1,mode:VP.m,lab:r.lab,bins:P.nb,d0:P.d0,d1:P.d1,n:P.n,nd:P.nd,src:P.src,lo:+P.lo.toFixed(4),hi:+P.hi.toFixed(4),step:+P.st.toFixed(6),poc:+P.pocp.toFixed(4),
      vah:+P.vah.toFixed(4),val:+P.val.toFixed(4),va_pct:+(P.va/P.tot*100).toFixed(2),total:Math.round(P.tot),up:Math.round(P.su),dn:Math.round(P.sd),hvn:hvp,lvn:lvp,
      x0:Math.round(x0),R:Math.round(R),maxW:Math.round(maxW),ms:P.ms,tr:r.tr||null,labels:[]};window.TC_VP=TV;
    return function(){if(!g.TX)return;x.save();var fz=g.narrow?5:6,h=fz+6;x.font=fz+'px '+FONT;x.textBaseline='middle';x.textAlign='left';var _ob=OVB;OVB={l:g.pl+2,r:R};
      [['POC '+fp(P.pocp),'#ffae00',yP,1],['VAH '+fp(P.vah),'#ffc75a',yH],['VAL '+fp(P.val),'#ffc75a',yL]].forEach(function(it){if(it[2]<g.pt+4||it[2]>g.pt+g.ph-4)return;
        var w=x.measureText(it[0]).width+6,p=freeBox(Math.max(g.pl+2,R-maxW-w-3),Math.round(it[2]-h/2),w,h,[0,-40,-80]);
        x.fillStyle=it[3]?'#ffae00':'rgba(7,6,26,.85)';x.fillRect(p[0],p[1],w,h);if(!it[3]){x.strokeStyle='rgba(255,174,0,.6)';x.lineWidth=1;x.strokeRect(p[0]+.5,p[1]+.5,w-1,h-1);}
        x.fillStyle=it[3]?'#07061a':it[1];x.fillText(it[0],p[0]+3,p[1]+h/2+.5);TV.labels.push(it[0]);});
      if(!g.narrow){var cap='VOL PROFILE · '+r.lab+' · '+P.nb+' BINS',cw=x.measureText(cap).width+6,cp=freeBox(R-cw,g.pt+g.ph-h-2,cw,h,[0]);x.fillStyle='rgba(255,174,0,.8)';x.fillText(cap,cp[0]+3,cp[1]+h/2+.5);}
      OVB=_ob;x.restore();};}
  // Layout (left→right): HLC bars | level strip (short glowing segments + zone bands, right of the last bar) | tag flags | price axis
  var DRT={n:0,ms:0,max:0};window.TC_DRAW=DRT;   // draw cost (ms, EMA + max) for phone performance QA
  function draw(now){var _t0=performance.now();draw0(now);var dt=performance.now()-_t0;DRT.n++;DRT.ms=DRT.n<2?dt:DRT.ms*.9+dt*.1;if(dt>DRT.max)DRT.max=dt;}
  function draw0(now){
    var W=Math.round(host.getBoundingClientRect().width), H=Math.round(host.getBoundingClientRect().height);
    if(W<50||H<50) return;
    var x=setup(cv,W,H), narrow=W<700, LY=LS.L, TX=!!LS.text, AX=!!LS.axis, RSP=hasRT&&!!LY.rsp;
    x.fillStyle=C.bg;x.fillRect(0,0,W,H);x.strokeStyle=C.frame;x.lineWidth=2;x.strokeRect(1,1,W-2,H-2);
    var fs=narrow?7:8, tfs=narrow?6:8, pl=narrow?6:10, rh=RSP?Math.round(H*(narrow?.2:.17)):0, ry0=6, pt=34+(RSP?rh+ry0+4:0), pb=AX?(narrow?26:34):(narrow?8:10), vh=LY.vol?Math.round(H*(VM==='vsa'?(narrow?.2:.19):(narrow?.13:.14))):0, ph=H-pt-pb-vh-10;
    var LK={entry:'entry',stop:'stop',a05:'acct',a10:'acct',cut:'cuts',r2:'targets',r3:'targets'};
    var axisW=(AX||(!narrow&&TX&&LY.last))?(narrow?46:56):8, L=levels().filter(function(l){return l.v!=null&&LY[LK[l.k]];});
    // far-off targets (2R / 3R well above the visible bars) go in the key at the top instead of stretching the price scale
    var _blo=Infinity,_bhi=-Infinity;if(PVR){_blo=PVR[0];_bhi=PVR[1];}else bars.slice(-(narrow?60:130)).forEach(function(b){_blo=Math.min(_blo,b.l);_bhi=Math.max(_bhi,b.h);});   // previous frame's visible bars
    var BG=LY.entry?buyGroups(buyWant()):[];
    var OFF=[];L=L.filter(function(l){if((l.k==='r2'||l.k==='r3')&&l.v>_bhi+(_bhi-_blo)*(H<420?.15:.45)){OFF.push(l);return false;}return true;});
    // phones: level tags double as the price axis (one merged right column) and the last price joins the tag stack, so the bars get the width
    if(narrow&&TX&&LY.last) L.push({k:'last',v:last.c,c:last.up?C.up:C.dn,nt:last.c.toFixed(2),t:[last.c.toFixed(2)],w:1,inv:1});
    // measure tag widths first so the right margin always fits them (nothing covers the bars)
    x.font=tfs+'px '+SYM;
    var tags=L.map(function(l){var t=narrow?[l.nt||(l.short||l.t)[0]]:l.t;return {l:l,t:t,tw:Math.max.apply(null,t.map(function(s){return x.measureText(s).width;}))+(narrow?12:22)+(l.skull&&!narrow?22:0),bh:(l.thin?(narrow?12:16):(narrow?13:20))+(t.length-1)*(narrow?11:12)};});
    var tagW=TX?4+Math.max(narrow?(AX?40:8):120,Math.max.apply(null,tags.map(function(t){return t.tw;}).concat([0]))):(narrow&&AX?34:8);   // text off: no tag column (just the axis on phones)
    // exact geometry (approved v5): GAP px from the end of the last close tick, STUB px stubs, NOTCH px notch, then the tag body
    var GAP=narrow?4:30, STUB=narrow?5:70, NOTCH=narrow?5:10;
    if(narrow) axisW=0;
    var avail=W-pl-axisW-tagW-NOTCH-(narrow?2:6);
    // visible window (density / pan) from chart_zoom.js; without it fall back to the newest ~130 bars
    var ZV=window.TCZoom?TCZoom.view(avail-GAP-STUB,narrow):{start:Math.max(0,bars.length-(narrow?60:130)),n:Math.min(bars.length,narrow?60:130),fut:7};
    var V=bars.slice(ZV.start,ZV.start+ZV.n), off=ZV.start, n=V.length, atLatest=off+n>=bars.length;
    // future space: chart_zoom.js blank slots right of the newest bar (default 7, drag left for more, ▶| resets); no zoom module -> 7 when at the latest
    var FWD=ZV.fut!=null?ZV.fut:(atLatest?7:0);
    var bw=(avail-GAP-STUB)/(n-1+0.5+0.62+FWD); if(!narrow) bw=Math.min(bw,(avail-GAP-STUB)/(n-1+1.12+FWD));
    function X(i){return pl+i*bw+bw/2;}
    var lastEdge=X(n-1)+Math.max(1.5,Math.min(bw*.5,9)), barsEnd=lastEdge, sx0=Math.round(lastEdge+GAP+FWD*bw), sx1=sx0+STUB, tagX=sx1, axX=narrow?W-3:W-axisW+6;
    var lo=Infinity,hi=-Infinity;
    V.forEach(function(b){lo=Math.min(lo,b.l);hi=Math.max(hi,b.h);});var _pv=PVR;PVR=[lo,hi];if(!_pv||_pv[0]!==lo||_pv[1]!==hi){if(true)setTimeout(function(){draw(performance.now());},0);}
    L.forEach(function(l){if(l.k!=='last'){lo=Math.min(lo,l.v);hi=Math.max(hi,l.v);}});   // shown levels only (off-scale targets excluded)
    BG.forEach(function(b){lo=Math.min(lo,b.v);hi=Math.max(hi,b.v);});   // every plan's BUY line stays on the scale
    if(LY.zones&&D.buy_zone&&D.buy_zone[1]!=null){lo=Math.min(lo,D.buy_zone[1]);hi=Math.max(hi,D.buy_zone[1]);}
    if(LY.ovl)ovlPrices(off,n).forEach(function(v){lo=Math.min(lo,v);hi=Math.max(hi,v);});   // keep visible detector drawings in range
    var pad=(hi-lo)*.04; lo-=pad; hi+=pad;
    function Y(v){return pt+(hi-v)/(hi-lo)*ph;}
    geo={X:X,Y:Y,bw:bw,pl:pl,barsEnd:barsEnd,off:off,n:n,W:W,H:H,pt:pt,ph:ph,lo:lo,hi:hi,R:sx0-2};
    if(window.TCZoom) TCZoom.geo({pl:pl,bw:bw,barsEnd:barsEnd,n:n,start:off,W:W});
    // grid + price axis (far right)
    var span=hi-lo, raw=span/(narrow?5:8), mag=Math.pow(10,Math.floor(Math.log10(raw))), step=[1,2,2.5,5,10].map(function(m){return m*mag;}).find(function(s){return s>=raw;});
    x.strokeStyle=C.grid;x.lineWidth=1;x.font=(narrow?6:fs)+'px '+FONT;x.fillStyle=C.axis;x.textAlign=narrow?'right':'left';
    var AXT=[];if(AX)for(var v=Math.ceil(lo/step)*step;v<hi;v+=step){var gy0=Y(v);if(gy0<pt+3||gy0>pt+ph-1)continue;AXT.push({v:v,y:gy0,t:step<1?v.toFixed(2):String(Math.round(v*100)/100)});}
    if(AX){x.save();x.strokeStyle='rgba(107,92,255,.11)';x.lineWidth=1;x.beginPath();AXT.forEach(function(a){var gy=snp(a.y,1);x.moveTo(pl,gy);x.lineTo(sx0-2,gy);});x.stroke();   // crisp horizontal grid
      if(!narrow){x.strokeStyle='rgba(107,92,255,.45)';x.beginPath();AXT.forEach(function(a){var gy=snp(a.y,1);x.moveTo(W-axisW,gy);x.lineTo(W-axisW+3,gy);});x.stroke();}x.restore();}   // axis ticks; numbers are drawn after the tags (collision-free)
    x.textAlign='left';x.font=fs+'px '+FONT;if(!narrow&&AX){x.strokeStyle='rgba(107,92,255,.35)';x.beginPath();x.moveTo(snp(W-axisW,1),pt-6);x.lineTo(snp(W-axisW,1),H-pb);x.stroke();}x.strokeStyle=C.grid;
    // date axis (pro, 4 Oct 2026): the finest unit whose labels keep a readable gap - 1D: week → month → quarter → year; 1W: month → quarter
    // → year → 2Y; 1M: quarter → year → 2Y → 5Y. A tick = the first bar of a new unit (1W bars count in the month of their last session). The
    // labels are centred on their tick, year boundaries are bright and print the year, and a faint crisp grid line runs up the panes.
    var TCAX={unit:'',ticks:[],price:[]};
    if(AX&&n>1){x.font=(narrow?6:7)+'px '+FONT;var UN=TF==='D'?['wk','mo','qt','yr']:TF==='W'?['mo','qt','yr','y2']:['qt','yr','y2','y5'],TGAP=narrow?34:46,xEnd=barsEnd-2;
      var dOf=function(b){return TF==='W'&&b.de?b.de:b.d;};
      var ukey=function(u,b){var d=dOf(b),y=+d.slice(0,4),m=+d.slice(5,7);return u==='wk'?pStart(b.d,'W'):u==='mo'?d.slice(0,7):u==='qt'?y+'q'+((m-1)/3|0):u==='yr'?String(y):u==='y2'?String(y>>1):String(Math.floor(y/5));};
      var TK=null;
      for(var ui=0;ui<UN.length&&!TK;ui++){var u=UN[ui],tk=[],pk=ukey(u,V[0]),ok=true;
        for(var i=1;i<n;i++){var b=V[i],kk=ukey(u,b);if(kk===pk)continue;pk=kk;var xx=X(i);if(xx>xEnd)break;
          var d=dOf(b),mo=+d.slice(5,7),ny=d.slice(0,4)!==dOf(V[i-1]).slice(0,4),nm=d.slice(0,7)!==dOf(V[i-1]).slice(0,7),t,lv;
          if(ny||u==='yr'||u==='y2'||u==='y5'){t=d.slice(0,4);lv=2;}else if(u==='wk'&&!nm){t=d.slice(8,10);lv=0;}else{t=MON[mo-1];lv=1;}
          tk.push({x:xx,t:t,lv:lv,w:x.measureText(t).width});}
        for(var q=1;q<tk.length&&ok;q++)if(tk[q].x-tk[q-1].x<Math.max(TGAP,(tk[q].w+tk[q-1].w)/2+8))ok=false;
        if(ok||ui===UN.length-1){if(!ok){var kp=[];tk.forEach(function(a){var p=kp[kp.length-1];if(!p||a.x-p.x>=Math.max(TGAP,(a.w+p.w)/2+8))kp.push(a);});tk=kp;}TK=tk;TCAX.unit=u;}}
      x.save();x.lineWidth=1;TK.forEach(function(a){var gx=snp(a.x,1);x.strokeStyle=a.lv===2?'rgba(107,92,255,.2)':'rgba(107,92,255,.09)';x.beginPath();x.moveTo(gx,pt);x.lineTo(gx,H-pb);x.stroke();
        x.strokeStyle='rgba(107,92,255,.5)';x.beginPath();x.moveTo(gx,H-pb+1);x.lineTo(gx,H-pb+4);x.stroke();});x.restore();
      x.textAlign='center';TK.forEach(function(a){if(a.x-a.w/2<pl)return;x.fillStyle=a.lv===2?'#cfc9ff':a.lv===1?'#9d97cf':C.axis;x.fillText(a.t,a.x,H-pb+15);TCAX.ticks.push([Math.round(a.x),a.t,Math.round(a.w)]);});
      x.textAlign='left';x.fillStyle=C.axis;x.font=fs+'px '+FONT;}
    var VPL=VP.on?drawVP(x,{X:X,Y:Y,pl:pl,R:sx0-2,pt:pt,ph:ph,V:V,off:off,n:n,narrow:narrow,TX:TX,bw:bw}):null;if(!VP.on)window.TC_VP={on:0};
    // right-side strip: risk / reward / buy-zone bands only between the last bar and the tags
    if(LY.zones&&LY.entry&&LY.stop&&D.entry!=null&&D.stop!=null&&D.entry>D.stop){x.fillStyle='rgba(255,42,42,.08)';x.fillRect(sx0,Y(D.entry),sx1-sx0,Y(D.stop)-Y(D.entry));}
    if(LY.zones&&LY.targets&&hasR&&!OFF.length){x.fillStyle='rgba(57,255,20,.045)';x.fillRect(sx0,Y(D.r3),sx1-sx0,Y(D.entry)-Y(D.r3));}
    if(LY.zones&&D.buy_zone){var z0=Y(D.buy_zone[1]),z1=Y(D.buy_zone[0]);x.fillStyle='rgba(0,229,255,.08)';x.fillRect(sx0,z0,sx1-sx0,z1-z0);
      x.save();x.strokeStyle='rgba(0,229,255,.4)';x.setLineDash([2,2]);x.lineWidth=1;x.beginPath();x.moveTo(sx0,z0);x.lineTo(sx1,z0);x.stroke();x.restore();
      if(false){x.font=(narrow?5:6)+'px '+FONT;x.fillStyle='rgba(0,229,255,.9)';x.textAlign='center';x.fillText('BUY ZONE',(sx0+sx1)/2,(z0+z1)/2-2);x.fillText('TO '+D.buy_zone[1].toFixed(2),(sx0+sx1)/2,(z0+z1)/2+8);}}
    // vertical pixel labels inside the strip
    if(!narrow){x.save();x.font='6px '+FONT;x.textAlign='center';
      function vlab(t,y0,y1,c){if(Math.abs(y1-y0)<t.length*7+6)return;x.save();x.translate((sx0+sx1)/2,(y0+y1)/2);x.rotate(-Math.PI/2);x.fillStyle=c;x.fillText(t,0,3);x.restore();}

      x.restore();}
    var FULLW=[];   // levels drawn across the bars this frame (audit: never entry / 2R / 3R)
    if(narrow||!TX){tags.forEach(function(t){var l=t.l;if(l.k==='last'||l.k==='entry'||l.k==='r2'||l.k==='r3'||l.k==='a05'||l.k==='a10')return;FULLW.push(l.k);var y=Y(l.v);x.save();x.strokeStyle=l.c;x.globalAlpha=l.thin?.35:.45;x.lineWidth=1;x.setLineDash(l.dash||[4,3]);
      x.beginPath();x.moveTo(pl,y);x.lineTo(sx0,y);x.stroke();x.restore();});}
    // volume
    var vmax=Math.max.apply(null,V.map(function(b){return b.v;}))||1, vb=H-pb, VSAV=!!LY.vol&&VM==='vsa';
    if(VSAV)drawVSA(x,{V:V,off:off,n:n,X:X,bw:bw,pl:pl,barsEnd:barsEnd,vb:vb,vh:vh,narrow:narrow,TX:TX,LY:LY});else VSTAT={mode:VM,vol:LY.vol?1:0};
    var _vs=JSON.stringify(VSTAT);if(_vs!==VSTS){VSTS=_vs;host.setAttribute('data-vol',VM);host.setAttribute('data-vsa',_vs);}
    if(LY.vol&&!VSAV)V.forEach(function(b,i){x.fillStyle=(b.up?C.up:C.dn)+'55';var hh=b.v/vmax*vh;x.fillRect(X(i)-bw*.35,vb-hh,Math.max(1,bw*.7),hh);
      if(b.vx){var hx=Math.min(vh,b.vx/vmax*vh);x.save();x.strokeStyle=(b.up?C.up:C.dn)+'bb';x.setLineDash([2,2]);x.lineWidth=1;x.strokeRect(X(i)-bw*.35,vb-hx,Math.max(1,bw*.7),hx);x.restore();}});   // provisional period: dotted outline = volume pro-rated to a full period
    x.fillStyle=C.axis;x.textAlign='left';x.font=fs+'px '+FONT;if(LY.vol&&TX&&!VSAV)x.fillText('VOL',pl+6,vb-vh+4);
    // RS RATING panel (top): area fill, smooth rating-vs-MA21 fill, crossover dots, 0-100 scale + value tags on the right
    // (no per-bar regime band columns: on phones they rendered as dozens of thin vertical stripes; band names stay in the tooltip)
    if(RSP){var RH=rh, rw=barsEnd-pl, vis=V.map(function(b){return RTM[b.d]||null;}), mn=100, any=false;
      x.save();x.fillStyle='#000';x.fillRect(pl,ry0,rw,RH);
      var mx=0;vis.forEach(function(r){if(r&&r[1]!=null){any=true;mn=Math.min(mn,r[1]);mx=Math.max(mx,r[1]);}if(r&&r[2]!=null){mn=Math.min(mn,r[2]);mx=Math.max(mx,r[2]);}});
      // autoscale to the visible rating + MA21 (min-3 .. max+2, clamped 1-99, at least a 10-point span) so a 90-99 leader is not a flat strip
      var rlo=Math.max(1,Math.floor(mn-3)), rhi=Math.min(99,Math.ceil(mx+2));if(!any){rlo=1;rhi=99;}
      if(rhi-rlo<10){var _c=(rhi+rlo)/2;rlo=Math.round(_c-5);rhi=rlo+10;if(rhi>99){rhi=99;rlo=89;}if(rlo<1){rlo=1;rhi=11;}}
      var rstep=20;[1,2,5,10,20].some(function(st){if(rh*st/(rhi-rlo)>=(narrow?14:18)){rstep=st;return true;}});   // scale labels >= ~14px apart
      var rtp=TX?(narrow?12:14):3;   // top pad: keep the 'RS RATING · MA21' title clear of a 95-99 rating line (longer history, 4 Oct 2026)
      var RY=function(v){return ry0+rtp+(rhi-v)/(rhi-rlo)*(RH-rtp-3);};
      x.beginPath();x.rect(pl,ry0,rw,RH);x.clip();
      // grid (20-step) inside the plot
      x.strokeStyle='rgba(255,255,255,.07)';x.lineWidth=1;if(AX)for(var gv=Math.ceil(rlo/rstep)*rstep;gv<=rhi;gv+=rstep){var gy=Math.round(RY(gv))+.5;x.beginPath();x.moveTo(pl,gy);x.lineTo(barsEnd,gy);x.stroke();}
      // segments of consecutive rated bars
      var segs=[],cur=null;vis.forEach(function(r,i){if(r&&r[1]!=null){if(!cur){cur=[];segs.push(cur);}cur.push(i);}else cur=null;});
      segs.forEach(function(sg){x.beginPath();sg.forEach(function(i,k){var y=RY(vis[i][1]);k?x.lineTo(X(i),y):x.moveTo(X(i),y);});
        x.lineTo(X(sg[sg.length-1]),ry0+RH);x.lineTo(X(sg[0]),ry0+RH);x.closePath();x.fillStyle=RTC.area;x.fill();});
      // rating vs MA21: one continuous polygon per run of bars with both values (rating forward, MA back), filled twice with a clip at
      // the MA line - green where the rating is above its MA, red where below - so there are no per-bar slices / seams
      var bsegs=[],bc=null;vis.forEach(function(r,i){if(r&&r[1]!=null&&r[2]!=null){if(!bc){bc=[];bsegs.push(bc);}bc.push(i);}else bc=null;});
      bsegs.forEach(function(sg){if(sg.length<2)return;
        function band(){x.beginPath();sg.forEach(function(i,k){var y=RY(vis[i][1]);k?x.lineTo(X(i),y):x.moveTo(X(i),y);});
          for(var k=sg.length-1;k>=0;k--)x.lineTo(X(sg[k]),RY(vis[sg[k]][2]));x.closePath();}
        function maPath(edge){x.beginPath();sg.forEach(function(i,k){var y=RY(vis[i][2]);k?x.lineTo(X(i),y):x.moveTo(X(i),y);});
          x.lineTo(X(sg[sg.length-1]),edge);x.lineTo(X(sg[0]),edge);x.closePath();}
        [[ry0-2,RTC.up],[ry0+RH+2,RTC.dn]].forEach(function(p){x.save();maPath(p[0]);x.clip();band();x.fillStyle=p[1];x.fill();x.restore();});});
      x.strokeStyle=RTC.ma;x.lineWidth=narrow?1.1:1.4;x.beginPath();var on=0;
      vis.forEach(function(r,i){if(!r||r[2]==null){on=0;return;}var y=RY(r[2]);on?x.lineTo(X(i),y):x.moveTo(X(i),y);on=1;});x.stroke();
      x.strokeStyle=RTC.r;x.lineWidth=narrow?1.4:1.8;x.shadowColor=RTC.r;x.shadowBlur=narrow?0:5;
      segs.forEach(function(sg){x.beginPath();sg.forEach(function(i,k){var y=RY(vis[i][1]);k?x.lineTo(X(i),y):x.moveTo(X(i),y);});x.stroke();});x.shadowBlur=0;
      vis.forEach(function(r,i){if(!r||!r[4])return;x.fillStyle=r[4]==='U'?RTC.r:RTC.ma;x.strokeStyle='#000';x.lineWidth=1;x.beginPath();x.arc(X(i),RY(r[1]),narrow?2.2:2.7,0,Math.PI*2);x.fill();x.stroke();});
      // where the stored history starts / blank before it
      var f0=RTH.from, fi=-1;V.forEach(function(b,i){if(fi<0&&f0&&(b.de||b.d)>=f0)fi=i;});
      x.font=(narrow?6:7)+'px '+FONT;x.textAlign='left';
      if(!TX){}else if(!f0||!any){x.fillStyle=C.axis;x.textAlign='center';x.fillText(f0?'NO RS RATING IN VIEW':'NO RS RATING HISTORY',pl+rw/2,ry0+RH/2+3);}
      else if(fi>0){x.strokeStyle='rgba(57,255,136,.45)';x.setLineDash([3,3]);x.beginPath();x.moveTo(X(fi)-bw/2,ry0);x.lineTo(X(fi)-bw/2,ry0+RH);x.stroke();x.setLineDash([]);
        var ht='RS HISTORY FROM '+sday(f0);x.fillStyle=C.axis;var htw=x.measureText(ht).width;
        if(X(fi)-bw/2-pl>htw+8){x.textAlign='right';x.fillText(ht,X(fi)-bw/2-4,ry0+RH/2+3);}else{x.fillText(ht,X(fi)+4,ry0+RH-5);}}
      x.restore();
      x.fillStyle='#cfe9d8';x.font=(narrow?6:7)+'px '+FONT;x.textAlign='left';if(TX)x.fillText('RS RATING · '+rtMaLbl(),pl+5,ry0+10);
      x.strokeStyle='rgba(57,255,136,.35)';x.lineWidth=1;x.strokeRect(pl+.5,ry0+.5,rw-1,RH-1);
      // right column: value tags (rating green, MA orange) + scale labels that don't collide with them
      var lr=null;for(var k=vis.length-1;k>=0;k--){if(vis[k]&&vis[k][1]!=null){lr=vis[k];break;}}
      var tx=sx0+2, tg=[];x.font=(narrow?6:7)+'px '+FONT;
      if(lr&&TX){tg.push({y:RY(lr[1]),t:String(lr[1]),bg:RTC.r});if(lr[2]!=null)tg.push({y:RY(lr[2]),t:lr[2].toFixed(2),bg:RTC.ma});
        if(tg.length===2&&Math.abs(tg[0].y-tg[1].y)<11){var mid=(tg[0].y+tg[1].y)/2,up=tg[0].y<=tg[1].y?0:1;tg[up].y=mid-5.5;tg[1-up].y=mid+5.5;}
        var tmin=Math.min.apply(null,tg.map(function(t){return t.y;})),tmax=Math.max.apply(null,tg.map(function(t){return t.y;})),sh0=tmin<ry0+5?ry0+5-tmin:tmax>ry0+RH-5?ry0+RH-5-tmax:0;
        tg.forEach(function(t){t.y+=sh0;var w=x.measureText(t.t).width+6;x.fillStyle=t.bg;x.fillRect(tx,t.y-5,w,10);x.fillStyle='#07061a';x.textAlign='left';x.fillText(t.t,tx+3,t.y+3);});}
      x.fillStyle=C.axis;x.textAlign='right';x.font=(narrow?5:6)+'px '+FONT;
      if(AX)for(var tv=Math.ceil(rlo/rstep)*rstep;tv<=rhi;tv+=rstep){var ty=RY(tv);if(tg.some(function(t){return Math.abs(t.y-ty)<8;}))continue;x.fillText(String(tv),W-3,Math.max(ry0+6,Math.min(ry0+RH-1,ty+3)));}
    }
    // SMAs
    if(LY.sma&&!NOMA)[[S50,'#ff9f1c',smaNames()[0]],[S150,'#b86bff',smaNames()[1]],[S200,'#4da3ff',smaNames()[2]]].forEach(function(a,j){
      x.strokeStyle=a[1];x.lineWidth=1.3;x.globalAlpha=.85;x.beginPath();var s=0;
      V.forEach(function(b,i){var val=a[0][b.d];if(val==null)return;var y=Y(val);if(y<pt-2||y>pt+ph+2){s=0;return;}s?x.lineTo(X(i),y):x.moveTo(X(i),y);s=1;});
      x.stroke();x.globalAlpha=1;});
    // header (Deepvue-style readout): row 1 = date · O H L C · change · volume of the bar under the crosshair (else the newest bar);
    // row 2 = the moving averages with their values on that bar. Shrinks (drops the open, then a smaller font) to fit a phone.
    var hi0=hover>=0&&hover<n?hover:n-1,hb=V[hi0],hpv=hi0+off>0?bars[hi0+off-1].c:null,hch=hpv?(hb.c/hpv-1)*100:null,fp=function(v){return v==null?'—':Math.abs(v)<1?v.toFixed(4):v.toFixed(2);};
    var hdt=TF==='M'?MON[+hb.d.slice(5,7)-1]+' '+hb.d.slice(0,4):TF==='W'?'WK '+sday(hb.d)+(narrow?'':' → '+sday(hb.de||hb.d))+' '+(hb.de||hb.d).slice(2,4):sday(hb.d)+' '+hb.d.slice(narrow?2:0,4);
    var HS=function(dropO,brief){var a=[[hdt+(hb.prov?' PROV':''),hover>=0?'#00e5ff':'#e8e6ff'],['  ']];if(!dropO&&hb.o!=null)a.push(['O ','#8f88c4'],[fp(hb.o)+'  ']);
      a.push(['H ','#8f88c4'],[fp(hb.h)+'  '],['L ','#8f88c4'],[fp(hb.l)+'  '],['C ','#8f88c4'],[fp(hb.c)+'  ',hb.up?C.up:C.dn]);
      if(hch!=null)a.push([(hch>=0?'+':'')+hch.toFixed(2)+'%'+(brief?'':' ('+(hb.c-hpv>=0?'+':'-')+Math.abs(hb.c-hpv).toFixed(hb.c<1?4:2)+')')+'  ',hch>=0?C.up:C.dn]);
      a.push(['V ','#8f88c4'],[fmtV(hb.v)]);return a;};
    var hmax=(narrow&&OFF.length&&TX?tagX:W-6)-pl-4,HV=[[0,0,narrow?6:8],[0,1,narrow?6:8],[1,1,6],[1,1,5]],hseg=null,hfz=6;
    for(var hq=0;hq<HV.length;hq++){hfz=HV[hq][2];x.font=hfz+'px '+FONT;var sg=HS(HV[hq][0],HV[hq][1]||narrow);if(x.measureText(sg.map(function(z){return z[0];}).join('')).width<=hmax||hq===HV.length-1){hseg=sg;break;}}
    var HDR={i:hi0+off,d:hb.d,hover:hover>=0?1:0,text:hseg.map(function(z){return z[0];}).join('').replace(/\s+/g,' ').trim(),ma:[]};
    if(TX){x.textAlign='left';x.font=hfz+'px '+FONT;var hxp=pl+4;hseg.forEach(function(z){x.fillStyle=z[1]||'#e8e6ff';x.fillText(z[0],hxp,pt-20);hxp+=x.measureText(z[0]).width;});}
    if(LY.sma&&!NOMA){x.font=(narrow?6:fs)+'px '+FONT;var mxp=pl+4,MAS=[[S50,'#ff9f1c',smaNames()[0]],[S150,'#b86bff',smaNames()[1]],[S200,'#4da3ff',smaNames()[2]]];
      var mw=MAS.map(function(a){var vv=a[0][hb.d];return a[2]+' '+(vv!=null?fp(vv):Object.keys(a[0]).length?'—':'n/a');});
      var full=x.measureText(mw.join('   ')).width<=hmax;
      MAS.forEach(function(a,j){var has=Object.keys(a[0]).length>0,t=full?mw[j]:a[2]+(has?'':' n/a');HDR.ma.push(mw[j]);x.fillStyle=has?a[1]:'#4a456f';if(TX)x.fillText(t,mxp,pt-8);mxp+=x.measureText(t).width+(narrow?8:14);});}
    window.TC_HDR=HDR;
    // price bars. CANDLES (default, 4 Oct 2026 pro polish): colour = close vs the prior close (the desk's up / down, same as volume), HOLLOW body =
    // close ≥ open, FILLED = close < open; 1px wick on the half-pixel, odd body widths on whole pixels (crisp at any zoom). HLC = the old style.
    // Older 1W / 1M bars from the server history have no open: the prior close stands in.
    if(LY.bars&&BST!=='hlc'){var bodyW=Math.max(1,Math.min(Math.round(bw*.75),narrow?11:17));if(bodyW%2===0)bodyW+=bodyW+1<=bw-1?1:-1;
      V.forEach(function(b,i){var c=b.up?C.up:C.dn,o=b.o!=null?b.o:(i+off>0?bars[i+off-1].c:b.c),cx=Math.floor(X(i))+.5,yh=Math.round(Y(b.h)),yl=Math.max(yh+1,Math.round(Y(b.l))),
        t=Math.round(Y(Math.max(o,b.c))),bb=Math.max(t+1,Math.round(Y(Math.min(o,b.c)))),bx=cx-bodyW/2,hol=b.c>=o&&bodyW>=3&&bb-t>=3;
        x.strokeStyle=c;x.fillStyle=c;x.lineWidth=1;if(b.prov){x.globalAlpha=.6;x.setLineDash([2,2]);}
        x.beginPath();if(hol){x.moveTo(cx,yh);x.lineTo(cx,t);x.moveTo(cx,bb);x.lineTo(cx,yl);}else{x.moveTo(cx,yh);x.lineTo(cx,yl);}x.stroke();
        if(hol){x.fillStyle=C.bg;x.fillRect(bx,t,bodyW,bb-t);x.strokeRect(bx+.5,t+.5,bodyW-1,bb-t-1);}else if(bodyW>1)x.fillRect(bx,t,bodyW,bb-t);
        if(b.prov){x.globalAlpha=1;x.setLineDash([]);if(TX){x.font=(narrow?5:6)+'px '+FONT;x.fillStyle='#ffd23f';x.textAlign='center';x.fillText('PROV',X(i),Math.min(pt+ph+6,Y(b.l)+(narrow?9:11)));}}});}
    // HLC bars (default): low→high bar + right close tick, no open tick. The close tick has exactly the bar's line width (Chris 4 Oct 21:43),
    // a whole number of CSS px, and both are snapped to the pixel grid (odd width -> centre on a half pixel, even -> on a whole pixel).
    var bLW=Math.max(1,Math.round(Math.min(bw*.38,narrow?5:6))), tLW=bLW, tLen=Math.max(1,Math.round(Math.min(bw*.5,9))), hlcC=function(v){return bLW%2?Math.floor(v)+.5:Math.round(v);};
    window.TC_HLC={style:BST,bar:bLW,tick:tLW,tick_len:tLen};
    if(LY.bars&&BST==='hlc')V.forEach(function(b,i){var c=b.up?C.up:C.dn,cx=hlcC(X(i)),yh=Math.round(Y(b.h)),yl=Math.max(yh+1,Math.round(Y(b.l))),yc=hlcC(Y(b.c));
      x.strokeStyle=c;x.lineWidth=bLW;x.lineCap='butt';if(b.prov){x.globalAlpha=.6;x.setLineDash([2,2]);}
      x.beginPath();x.moveTo(cx,yh);x.lineTo(cx,yl);x.stroke();
      x.lineWidth=tLW;x.beginPath();x.moveTo(cx-bLW/2,yc);x.lineTo(cx+bLW/2+tLen,yc);x.stroke();
      if(b.prov){x.globalAlpha=1;x.setLineDash([]);if(TX){x.font=(narrow?5:6)+'px '+FONT;x.fillStyle='#ffd23f';x.textAlign='center';x.fillText('PROV',X(i),Math.min(pt+ph+6,Y(b.l)+(narrow?9:11)));}}});   // provisional (unfinished) week / month
    // RS-line new high BEFORE price (D.rs.marks 'L'): small blue dot under the bar
    if(LY.rsl)V.forEach(function(b,i){if(RSM[b.d]!=='L')return;var cy=Y(b.l)+(narrow?6:7);if(cy>pt+ph+4)return;x.fillStyle=RSC.lead;x.shadowColor=RSC.lead;x.shadowBlur=6;
      x.beginPath();x.arc(X(i),cy,narrow?2.4:2.9,0,Math.PI*2);x.fill();x.shadowBlur=0;x.strokeStyle='#fff';x.lineWidth=.8;x.stroke();});
    OVR=[];OVB={l:pl+2,r:barsEnd+2};
    // BUY lines: 5 bars from the trigger bar (open) / the last bar (pending); a trigger bar out of view -> from the newest visible bar
    var BUYD=[],BUYL=[],BFS=narrow?6:7;
    if(LY.oneup&&LY.bars&&atLatest&&TX){var _sy=Y(V[n-1].h)-8;OVR.push([X(n-1)-14,_sy-(narrow?32:40),28,(narrow?32:40)]);}   // keep BUY labels off the 1UP sprite
    BG.forEach(function(b){var y=Math.round(Y(b.v))+.5;if(y<pt-3||y>pt+ph+3)return;var ai=b.d?dix(b.d):bars.length-1,j=ai-off,fb=0;
      if(ai<0||j+5<0||j>n-1){j=n-1;fb=1;}
      var bx0=Math.max(pl,X(j)-bw/2),bx1=Math.min(tagX-1,X(j+5)+bw/2);if(bx1-bx0<6)bx1=Math.min(tagX-1,bx0+6);
      BUYL.push((function(bx0,bx1,y,lw0){return function(){x.save();x.strokeStyle=C.entry;x.shadowColor=C.entry;x.shadowBlur=narrow?3:6;x.lineWidth=lw0;x.lineCap='butt';x.setLineDash([]);
        x.beginPath();x.moveTo(bx0,y);x.lineTo(bx1,y);x.stroke();x.restore();};})(bx0,bx1,y,b.main?(narrow?2:2.5):(narrow?1.6:2)));
      var lab=(b.side==='short'?'▼ SELL ':'▶ BUY ')+b.v.toFixed(2),L2='',full=lab+(b.nms.length?' · '+b.nms.join(' / '):'');
      if(TX){x.font=BFS+'px '+FONT;var room=Math.max(80,sx0-pl-10),fit=function(t){return x.measureText(t).width+8<=room;};
        if(fit(full))lab=full;else if(b.nms.length){lab=lab+' · '+b.nms[0];var rest=b.nms.slice(1);   // 2nd line: the other setups on this entry
          while(rest.length>1&&!fit(rest.join(' / ')+' +'+(b.nms.length-1-rest.length+1)))rest.pop();L2=rest.join(' / ')+(rest.length<b.nms.length-1?' +'+(b.nms.length-1-rest.length):'');}}
      var lx=bx0,lw=0,ly=y,hh=BFS+6;
      var dl=null;if(TX){x.font=BFS+'px '+FONT;lw=Math.max(x.measureText(lab).width,L2?x.measureText(L2).width:0)+8;var bh=L2?hh*2-2:hh,_r=OVB.r;OVB.r=Math.max(_r,sx0);var lfx=bx0-2-lw,lfy=y-bh/2,ldx=[0,-34,-68];if(lfx<pl+2){if(bx1+2+lw<=sx0){lfx=bx1+2;ldx=[0,34];}else{lfx=bx0;lfy=y-bh-2;ldx=[0];}}   // left of the segment; no room -> right of it; else above it
        var pp=freeBox(lfx,lfy,lw,bh,ldx);OVB.r=_r;lx=pp[0];ly=pp[1];
        dl=(function(lx,ly,lw,bh,lab,L2){return function(){x.save();x.font=BFS+'px '+FONT;x.fillStyle='rgba(0,10,16,.9)';x.fillRect(lx,ly,lw,bh);x.strokeStyle=C.entry;x.lineWidth=1;x.strokeRect(lx+.5,ly+.5,lw-1,bh-1);
          x.fillStyle=C.entry;x.textAlign='left';x.fillText(lab,lx+4,ly+hh-3.5);if(L2)x.fillText(L2,lx+4,ly+2*hh-5.5);x.restore();};})(lx,ly,lw,bh,lab,L2);BUYL.push(dl);}
      b.full=full;if(L2)lab+=' | '+L2;
      BUYD.push({v:b.v,y:Math.round(y),x0:Math.round(bx0),x1:Math.round(bx1),bars:5,bw:+bw.toFixed(2),fb:fb,anchor:b.d||'last',lab:TX?lab:'',full:b.full||lab,src:b.src,main:b.main,
        lbox:TX?[Math.round(lx),Math.round(ly),Math.round(lw)]:null});});
    window.TC_BUY={tf:TF,text:TX?1:0,layer:LY.entry?1:0,groups:BG.length,lines:BUYD,miss:BG.filter(function(b){return !BUYD.some(function(d){return d.v===b.v;});}).map(function(b){return b.v;}),full:FULLW,plot:[pl,Math.round(barsEnd),pt,pt+ph]};
        if(LY.sqz&&SQZ&&SQZ.d0){   // shaded coil zone + demand-tell dot (Pre Squeeze)
      var a=dix(SQZ.d0),b=SQZ.d1==null?bars.length-1:dix(SQZ.d1);if(a<0)a=0;if(b<0)b=bars.length-1;
      if(!(b<off-1||a>off+n)){var x0=X(Math.max(a,off)),x1=X(Math.min(b,off+n-1))+bw;
        var yHi=Y(SQZ.hi),yLo=Y(SQZ.lo);x.save();x.fillStyle='rgba(0,229,255,0.11)';x.fillRect(x0,Math.min(yHi,yLo),Math.max(1,x1-x0),Math.abs(yLo-yHi));
        x.strokeStyle='rgba(0,229,255,0.55)';x.lineWidth=1;x.setLineDash([4,3]);x.strokeRect(x0+0.5,Math.min(yHi,yLo)+0.5,Math.max(1,x1-x0)-1,Math.abs(yLo-yHi)-1);x.setLineDash([]);
        if(TX){x.font=(narrow?8:9)+'px '+FONT;x.fillStyle='#00e5ff';x.textAlign='left';
          x.fillText('SQUEEZE '+(SQZ.bars!=null?SQZ.bars+'b · ':'')+(SQZ.score!=null?SQZ.score:''),x0+4,Math.min(yHi,yLo)-4);}
        if(SQZ.tell){var ti=dix(SQZ.tell);if(ti>=off&&ti<off+n){var cx=X(ti)+bw*0.5,cy=Y(SQZ.hi)-6;
          x.beginPath();x.arc(cx,cy,4.5,0,Math.PI*2);x.fillStyle='#ff9f1c';x.fill();x.strokeStyle='#fff';x.lineWidth=1;x.stroke();
          if(TX){x.fillStyle='#ff9f1c';x.font=(narrow?8:9)+'px '+FONT;x.textAlign='center';x.fillText('TELL',cx,cy-7);}}}
        x.restore();}}
    if(LY.ovl&&OVL.length) drawOverlays(x,{buyon:!!LY.entry,X:X,Y:Y,off:off,n:n,bw:bw,pl:pl,barsEnd:barsEnd,pt:pt,ph:ph,vb:vb,vh:vh,narrow:narrow,notext:!TX,novol:!LY.vol,vsav:VSAV});
    // % gain from entry (+10 / +20 / +30 ...): faint dotted lines across the bars, only inside the visible range (never stretch the scale);
    // +10..+30 above the range go in the far-target key. Opt-in layer 'pctl' (the trade strip ticks are layer 'pct').
    if(LY.pctl&&D.entry>0){x.save();x.setLineDash([1,4]);x.lineWidth=1;x.font=(narrow?5:6)+'px '+FONT;x.textAlign='right';
      for(var pk=1;pk<=9;pk++){var pv=D.entry*(1+pk/10);if(pv>hi){if(pk<=3)OFF.push({k:'pct',v:pv,c:'#8f88c4',ol:'+'+pk*10+'% '});continue;}if(pv<lo)continue;
        var py=Y(pv);x.globalAlpha=.3;x.strokeStyle='#b8b2e8';x.beginPath();x.moveTo(pl,py);x.lineTo(barsEnd,py);x.stroke();
        if(TX){x.globalAlpha=.65;x.fillStyle='#9a93d8';x.fillText('+'+pk*10+'%',barsEnd-2,py-2);}}
      x.restore();}
    BUYL.forEach(function(f){f();});   // BUY labels on top of the detector drawings (positions were reserved first)
    if(VPL)VPL();   // volume profile POC / VAH / VAL labels (collision-checked against the BUY + overlay labels)
    // my trend lines (✎ LINE): light ice colour, the HLC bar line width; selected = gold with end handles; channel = dashed parallel
    TL.g=[];var TLV={mode:TL.mode,mag:TL.mag,ext:TL.ext,w:TL.w,sel:TL.sel,n:TL.lines.length,shown:0,lw:bLW,p1:TL.p1,lines:[]};
    if(LY.tl&&(TL.lines.length||TL.mode)){x.save();x.beginPath();x.rect(pl,pt,sx0-2-pl,ph);x.clip();var gg={X:X,Y:Y,off:off,R:sx0-2};x.lineCap='round';
      TL.lines.forEach(function(l,j){var s=tlGeo(l,gg);TL.g[j]=s;if(!s)return;var sel=TL.mode&&j===TL.sel,c=sel?'#ffd23f':TLC;
        var lw=l.w>0?l.w:bLW,sx=function(v){return snp(v,lw);};   // width: the line's own (1-6px) or 'BARS' = the HLC bar width; pixel-snapped ends
        x.strokeStyle=c;x.lineWidth=lw;x.shadowColor=c;x.shadowBlur=narrow?0:4;x.beginPath();x.moveTo(sx(s.xa),sx(s.ya));x.lineTo(sx(s.xe),sx(s.ye));x.stroke();
        if(l.ch!=null){var dy=Y(l.a.p+l.ch)-Y(l.a.p);x.globalAlpha=.85;x.setLineDash([Math.max(7,lw*3),Math.max(5,lw*2)]);x.beginPath();x.moveTo(sx(s.xa),sx(s.ya+dy));x.lineTo(sx(s.xe),sx(s.ye+dy));x.stroke();x.setLineDash([]);x.globalAlpha=1;}
        x.shadowBlur=0;if(sel){var hs=narrow?9:7;[[s.xa,s.ya],[s.xb,s.yb]].forEach(function(q){x.fillStyle='#07061a';x.fillRect(q[0]-hs/2,q[1]-hs/2,hs,hs);x.strokeStyle='#ffd23f';x.lineWidth=1.5;x.strokeRect(q[0]-hs/2,q[1]-hs/2,hs,hs);});}
        TLV.shown++;TLV.lines.push({a:l.a,b:l.b,ext:l.ext,ch:l.ch==null?null:l.ch,tf:l.tf,w:l.w||0,lw:lw,px:[Math.round(s.xa),Math.round(s.ya),Math.round(s.xb),Math.round(s.yb),Math.round(s.xe),Math.round(s.ye)]});});
      if(TL.mode&&TL.p1){var ia=dix(TL.p1.d)-off,xa=X(ia),ya=Y(TL.p1.p);x.fillStyle='#ffd23f';x.beginPath();x.arc(xa,ya,narrow?4:3.5,0,Math.PI*2);x.fill();
        if(TL.hov&&TL.hov.d!==TL.p1.d){x.strokeStyle='rgba(255,210,63,.8)';x.lineWidth=Math.max(1,bLW-1);x.setLineDash([4,4]);x.beginPath();x.moveTo(xa,ya);x.lineTo(X(dix(TL.hov.d)-off),Y(TL.hov.p));x.stroke();x.setLineDash([]);}}
      if(TL.mode&&TL.hov&&TL.hov.sn){x.strokeStyle='#ffd23f';x.lineWidth=1;var sx=X(dix(TL.hov.d)-off),sy=Y(TL.hov.p);x.strokeRect(sx-5,sy-5,10,10);}   // magnet target
      x.restore();}
    window.TC_TL=TLV;
    // short, thick, glowing level segments in the strip
    var pulse=RM?1:(0.75+0.25*Math.sin((now-t0)/420));
    tags.forEach(function(t){var l=t.l,y=Y(l.v);t.y=y;if(l.inv)return;x.save();x.strokeStyle=l.c;x.shadowColor=l.c;x.shadowBlur=5;x.globalAlpha=.95;x.lineWidth=l.w;x.lineCap='butt';x.setLineDash(l.dash||[]);
      x.beginPath();x.moveTo(sx0,y);x.lineTo(sx1,y);x.stroke();x.restore();});
    // de-collide tags vertically (the notch stays on the price; an elbow joins if a tag had to move)
    tags.sort(function(a,b){return a.y-b.y;});
    // cluster layout: overlapping tags merge into a stack centred on the mean of their price levels; elbows connect offsets
    function gp(a,b){return 3+((a.l.warn||b.l.warn)?5:0);}
    var G=tags.map(function(t){return {m:[t]};});
    function place(g){var acc=0,cs=[];g.m.forEach(function(t,i){if(i)acc+=gp(g.m[i-1],t);cs.push(acc+t.bh/2);acc+=t.bh;});
      var sh=g.m.reduce(function(s,t,i){return s+t.y-cs[i];},0)/g.m.length;
      sh=Math.max(pt-12,Math.min(H-pb-2-acc,sh));
      g.m.forEach(function(t,i){t.cy=sh+cs[i];});g.top=sh;g.bot=sh+acc;}
    G.forEach(place);
    for(var ch=true;ch;){ch=false;for(var k=0;k<G.length-1;k++){if(G[k].bot+gp(G[k].m[G[k].m.length-1],G[k+1].m[0])>G[k+1].top){G[k].m=G[k].m.concat(G[k+1].m);G.splice(k+1,1);place(G[k]);ch=true;break;}}}
    // pixel flag tags with an arrow notch pointing at the price
    if(TX)tags.forEach(function(t){var l=t.l,c=l.c,nx=tagX,notch=NOTCH,bx=nx+notch,by=t.cy-t.bh/2,moved=Math.abs(t.cy-t.y)>1.5;
      var ay=t.cy;
      x.save();x.globalAlpha=l.thin?.92:1;
      x.beginPath();x.moveTo(nx,ay);x.lineTo(bx,Math.max(by,ay-notch));x.lineTo(bx,by);x.lineTo(bx+t.tw,by);x.lineTo(bx+t.tw,by+t.bh);x.lineTo(bx,by+t.bh);x.lineTo(bx,Math.min(by+t.bh,ay+notch));x.closePath();
      x.fillStyle=l.inv?c:(l.bg||'#000');x.fill();x.strokeStyle=c;x.lineWidth=l.thin?1.2:2;x.setLineDash(l.thin?[3,2]:[]);x.shadowColor=c;x.shadowBlur=l.thin?0:10;x.stroke();x.setLineDash([]);
      if(!l.thin&&!l.inv){x.shadowBlur=0;x.fillStyle=c;x.globalAlpha=.9;x.fillRect(bx+t.tw-4,by+2,2,t.bh-4);x.globalAlpha=1;} // pixel "pole" edge
      if(Math.abs(t.cy-t.y)>0.5){x.save();x.setLineDash([]);x.strokeStyle=c;x.lineWidth=1.5;x.shadowColor=c;x.shadowBlur=3;x.beginPath();x.moveTo(sx1,t.y);x.lineTo(nx+2,t.cy);x.stroke();x.restore();}
      x.fillStyle=l.inv?'#07061a':c;x.shadowColor=c;x.shadowBlur=(l.thin||l.inv||narrow)?0:8;x.textAlign='left';x.font=tfs+'px '+SYM;
      var tx=bx+(narrow?5:6);
      if(l.skull&&!narrow){var SP=narrow?2:2.5,SK=['.#####.','#######','#..#..#','#..#..#','#######','.##.##.','.#.#.#.'];x.shadowBlur=6;
        SK.forEach(function(r,ry){r.split('').forEach(function(ch,cx){if(ch=='#')x.fillRect(Math.round(tx+cx*SP),Math.round(t.cy-(t.t.length-1)*(narrow?11:12)/2-SP*3.5+ry*SP),Math.ceil(SP),Math.ceil(SP));});});tx+=SP*7+(narrow?4:6);}
      var lh=narrow?11:12;t.t.forEach(function(s,k){x.fillText(s,k?bx+6:tx,t.cy+(narrow?3:4)-(t.t.length-1)*lh/2+k*lh);});
      if(l.warn){x.shadowBlur=0;for(var q=0;q<t.tw-6;q+=6){x.fillRect(bx+3+q,by-4,3,2);x.fillRect(bx+3+q,by+t.bh+2,3,2);}}
      x.restore();});
    // price axis numbers: skipped where a tag / the last-price box sits (no hidden or overlapping numbers)
    var lyT=(!narrow&&TX&&LY.last)?Y(last.c):null;x.font=(narrow?6:fs)+'px '+FONT;x.fillStyle=C.axis;x.textAlign=narrow?'right':'left';
    AXT.forEach(function(a){if(lyT!=null&&Math.abs(a.y-lyT)<11)return;if(narrow&&TX&&tags.some(function(t){return Math.abs(t.cy-a.y)<t.bh/2+5;}))return;x.fillText(a.t,axX,a.y+3);TCAX.price.push(a.t);});
    window.TC_AXIS=TCAX;x.textAlign='left';
    if(TX&&LY.stop&&D.stop==null&&!D.no_levels){x.font=(narrow?8:10)+'px '+SYM;x.fillStyle=C.stop;x.shadowColor=C.stop;x.shadowBlur=10;x.textAlign='center';x.fillText('☠ STOP NOT SET — NO R TARGETS',(pl+barsEnd)/2,pt+ph*.5);x.shadowBlur=0;}
    // last price tag on the axis
    var lastV=V[n-1],ly=Y(last.c);if(LY.last&&ly>pt&&ly<pt+ph){x.save();x.strokeStyle=last.up?C.up:C.dn;x.globalAlpha=.3;x.setLineDash([1,3]);x.lineWidth=1;x.beginPath();x.moveTo(pl,snp(ly,1));x.lineTo(sx0-2,snp(ly,1));x.stroke();x.restore();}   // faint last-price line
   if(!narrow&&TX&&LY.last&&ly>pt-8&&ly<pt+ph+8){x.font=fs+'px '+FONT;var lt=lastV.c.toFixed(2),ltw=x.measureText(lt).width+6;x.fillStyle=last.up?C.up:C.dn;x.beginPath();x.moveTo(W-axisW-5,ly);x.lineTo(W-axisW+1,ly-7);x.lineTo(W-2,ly-7);x.lineTo(W-2,ly+7);x.lineTo(W-axisW+1,ly+7);x.fill();x.fillStyle='#07061a';x.font=(narrow?6:7)+'px '+FONT;x.textAlign='left';x.fillText(lt,W-axisW+3,ly+4);}
    // 1UP sprite above last bar
    LAST_OFF=OFF.length;if(TX&&OFF.length&&!FOLD){x.font=(narrow?6:7)+'px '+FONT;x.textAlign='right';var ox=W-4;
      if(narrow)OFF.slice().sort(function(a,b){return a.v-b.v;}).forEach(function(l,i){x.fillStyle=l.c;x.fillText((l.ol||('▲'+(l.k==='r3'?'3R ':'2R ')))+l.v.toFixed(2),ox,pt-8-i*9);});   // phone: stacked in the tag column
      else{OFF.slice().reverse().forEach(function(l){var t=(l.ol||('▲ '+(l.k==='r3'?'3R ':'2R ')))+l.v.toFixed(2);x.fillStyle=l.c;x.fillText(t,ox,pt-8);ox-=x.measureText(t).width+8;});x.fillStyle=C.axis;x.fillText('OFF-SCALE',ox,pt-8);}}   // off-scale targets key
    if(LY.oneup&&LY.bars&&atLatest){var bob=RM?0:Math.round(Math.sin((now-t0)/260)*2), spx=X(n-1), spy=Y(lastV.h)-8+bob, P=narrow?2:3, spr=['.###.','.###.','.###.','#####','.###.','..#..'];spy=Math.max(spy,pt+spr.length*P+(TX?11:1));   // never up into the header readout
    x.fillStyle=C.r3;x.shadowColor=C.r3;x.shadowBlur=10;
    spr.forEach(function(r,ry){r.split('').forEach(function(ch,cx){if(ch=='#')x.fillRect(spx+(cx-2.5)*P,spy-(spr.length-ry)*P,P,P);});});
    x.shadowBlur=0;x.fillStyle='#fff';x.font=fs+'px '+FONT;x.textAlign='center';if(TX)x.fillText('1UP',spx,spy-spr.length*P-6);}
    // crosshair
    // crosshair (pro): vertical snapped to the bar, horizontal at the pointer inside the price pane; price box on the right axis, date box on the date axis
    window.TC_XH=null;
    if(hover>=0&&hover<n){var hx=snp(X(hover),1),hy=hoverY,inP=hy>=pt&&hy<=pt+ph,pv=inP?hi-(hy-pt)/ph*(hi-lo):null,xr=narrow?tagX:W-axisW;x.save();x.strokeStyle='rgba(232,230,255,.42)';x.setLineDash([3,3]);x.lineWidth=1;
      x.beginPath();x.moveTo(hx,pt-2);x.lineTo(hx,H-pb);if(inP){var yy=snp(hy,1);x.moveTo(pl,yy);x.lineTo(xr,yy);}x.stroke();x.setLineDash([]);
      x.font=(narrow?6:7)+'px '+FONT;x.textBaseline='middle';
      if(inP){var ptx=pv<1?pv.toFixed(4):pv.toFixed(2),pw=x.measureText(ptx).width+8,px0=narrow?W-pw-2:W-axisW+1;x.fillStyle='#e8e6ff';x.fillRect(px0,Math.round(hy)-6,pw,12);x.fillStyle='#07061a';x.textAlign='left';x.fillText(ptx,px0+4,Math.round(hy)+.5);}
      var hbx=V[hover],dtx=TF==='M'?MON[+hbx.d.slice(5,7)-1]+' '+hbx.d.slice(0,4):(TF==='W'?'WK ':'')+sday(hbx.d)+' '+hbx.d.slice(2,4);
      if(AX){var dw=x.measureText(dtx).width+8,dx0=Math.max(pl,Math.min(W-dw-2,hx-dw/2));x.fillStyle='#e8e6ff';x.fillRect(dx0,H-pb+9,dw,12);x.fillStyle='#07061a';x.textAlign='center';x.fillText(dtx,dx0+dw/2,H-pb+15.5);}
      x.restore();window.TC_XH={i:hover+off,d:hbx.d,y:inP?Math.round(hy):null,p:inP?+pv.toFixed(4):null,date:dtx};}
  }

  function ovlTips(bi){var t='',d=bars[bi]&&bars[bi].d;OVL.forEach(function(o){if(!o.on)return;o.items.forEach(function(it){if(it.t==='point'&&(TF===NATIVE?it.d===d:(ptShow(o,it)&&dix(it.d)===bi))&&it.tip)t+='<br><span class="tc-otip" style="color:'+esc(it.c||o.color)+'">'+esc(it.tip)+'</span>';});});return t;}   // overlay point notes (e.g. VSA why)
  function vsaTip(i){if(VM!=='vsa'||!LS.L.vol)return '';var S=vsaGet(),r=S.rv[i],sp=S.sr[i],f=S.cp[i],w=S.wv[S.wid[i]];
    return (r==null?'':' <span style="color:'+rvCol(r)+'">'+r.toFixed(2)+'× AVG20</span>')+'<br>SPREAD '+(sp==null?'n/a':sp.toFixed(2)+'× AVG')+' · CLOSE '+(f>=2/3?'TOP':f>=1/3?'MID':'LOW')+' ⅓'+
      (S.gl[i]==='abs'?'<br><span style="color:#72f6ff">▲ ABSORPTION: HIGH VOLUME, NARROW SPREAD</span>':S.gl[i]==='ne'?'<br><span style="color:#d9ccff">○ NO EFFORT: LOW VOLUME, WIDE SPREAD</span>':'')+
      (LS.L.weis&&w?'<br>WEIS '+(w.d>0?'UP':'DOWN')+' WAVE '+fmtV(S.cum[i])+(i<w.e?' SO FAR':w.open?' (OPEN)':' TOTAL'):'');}
  function showTip(i,px,py){
    if(i<0||!TIPON||TL.mode){tip.hidden=true;return;}   // info box off (LAYERS) / drawing: crosshair + header only
    var b=bars[i],prev=i>0?bars[i-1].c:null,ch=prev?((b.c/prev-1)*100):null, r=(D.risk&&D.entry!=null)?((b.c-D.entry)/D.risk):null;
    tip.innerHTML='<b>'+tfDate(b)+'</b>'+(b.prov?'<br><span style="color:#ffd23f">PROVISIONAL: '+b.n+' OF '+b.ns+' SESSIONS</span>':'')+(LS.text?'':'<br>C '+b.c.toFixed(2)+(ch==null?'':' <span class="'+(ch>=0?'pos':'neg')+'">'+(ch>=0?'+':'')+ch.toFixed(1)+'%</span>'))+
      '<br>VOL '+(b.v>=1e6?(b.v/1e6).toFixed(2)+'M':Math.round(b.v/1e3)+'K')+vsaTip(i)+(S50[b.d]&&!LS.text?'<br>'+smaNames()[0]+' '+S50[b.d].toFixed(2):'')+(r==null?'':'<br>'+(r>=0?'+':'')+r.toFixed(2)+'R')+(RSL[b.d]!=null?'<br>RS LINE '+(RSL[b.d]*100).toPrecision(4)+(RSM[b.d]==='L'?' <span style="color:'+RSC.lead+'">BLUE DOT: NEW HI BEFORE PRICE</span>':RSM[b.d]?' <span style="color:'+RSC.hi+'">NEW HI W/ PRICE</span>':''):'')+
      (RTM[b.d]&&RTM[b.d][1]!=null?'<br><span style="color:'+RTC.r+'">RS RATING '+RTM[b.d][1]+'</span>'+(RTM[b.d][2]!=null?' · <span style="color:'+RTC.ma+'">'+rtMaLbl()+' '+RTM[b.d][2].toFixed(2)+'</span>':'')+(RTM[b.d][3]?' · '+RTC.bandName[RTM[b.d][3]]:'')+(RTM[b.d][4]?' · '+(RTM[b.d][4]==='U'?'CROSS UP':'CROSS DOWN'):''):(hasRT?'<br>RS RATING n/a':''))+ovlTips(i);
    tip.hidden=false;var w=host.clientWidth,ty=geo&&geo.pt!=null?geo.pt+4:py-40;tip.style.left=(px>w/2?Math.max(4,Math.min(px-tip.offsetWidth-14,geo?geo.pl+4:4)):Math.max(px+14,(geo?geo.barsEnd:w)-tip.offsetWidth-4))+'px';tip.style.top=Math.max(4,Math.min(host.clientHeight-tip.offsetHeight-4,ty))+'px';   // pinned to the top corner away from the pointer
  }
  function onMove(e){if(!geo)return;var r=cv.getBoundingClientRect(),p=e.touches?e.touches[0]:e,px=p.clientX-r.left,py=p.clientY-r.top;
    var i=Math.floor((px-geo.pl)/geo.bw);hoverY=py;if(px>geo.barsEnd||i<0||i>=geo.n){hover=-1;showTip(-1);}else{hover=i;showTip(i+geo.off,px,py);}if(!HRAF)HRAF=requestAnimationFrame(function(){HRAF=0;draw(performance.now());});}
  cv.addEventListener('mousemove',function(e){if(window.TCZoom&&TCZoom.dragging){return;}onMove(e);});
  if(window.TCZoom) TCZoom.mount({host:host,canvas:cv,total:bars.length,redraw:function(){draw(performance.now());},
    tap:function(cx,cy){onMove({clientX:cx,clientY:cy});},clearTip:function(){hover=-1;showTip(-1);}});
  else {cv.addEventListener('touchstart',onMove,{passive:true});cv.addEventListener('touchmove',onMove,{passive:true});}
  // overlay toggle + legend bar (between the zoom toolbar and the chart)
  var OBAR=null,OBTN=null;
  if(OVL.length){var ob=document.createElement('div');ob.className='tc-ovl';ob.setAttribute('role','group');ob.setAttribute('aria-label','Detector overlays');
    function obtn(o){return (o.on?'◉ ':'○ ')+esc(o.label)+(o.on?' · ON':' · OFF');}
    function oleg(o){return (o.id==='vsa'&&VM==='vsa'&&LS.L.vol)?[['#39ff88','STRENGTH TAG'],['#ff3d7f','WEAKNESS TAG'],['#ffffff','SHOWN AS TAGS IN THE VSA VOLUME PANEL · GLOW = HIGH SIGNIFICANCE · TAP A BAR FOR WHY']]:(o.legend||[]);}
    window._tcObHTML=function(){return OVL.map(function(o,k){return '<div class="ovr"><button type="button" data-o="'+k+'" aria-pressed="'+o.on+'" title="Show / hide the detector drawing">'+obtn(o)+'</button>'+
      '<span class="ol">'+oleg(o).map(function(l){return '<span><i style="background:'+esc(l[0])+'"></i>'+esc(l[1])+'</span>';}).join('')+
      (o.asof?'<span class="oa">AS OF '+esc(o.asof)+'</span>':'')+'</span>'+(o.note?'<details class="onote"><summary>STORY</summary><p>'+esc(o.note)+'</p></details>':'')+'</div>';}).join('');};
    ob.innerHTML=window._tcObHTML();
    host.parentNode.insertBefore(ob,host);OBAR=ob;OBTN=obtn;
    ob.addEventListener('click',function(e){var b=e.target.closest('button[data-o]');if(!b)return;var o=OVL[+b.getAttribute('data-o')];o.on=!o.on;
      OLS.set('tc_ovl_'+o.id,o.on?'1':'0');b.setAttribute('aria-pressed',String(o.on));b.innerHTML=obtn(o);draw(performance.now());if(window._tcLaySync)_tcLaySync();});
  }
  cv.addEventListener('mouseleave',function(){hover=-1;hoverY=-1;TL.hov=null;showTip(-1);draw(performance.now());});
  // ---------------------------------------------------------------- ✎ LINE: trend lines (4 Oct 2026, Chris: draws them the David Weis way)
  // ✎ LINE in the chart toolbar = draw mode (pan / tap-inspect are off while it is on; the page still scrolls outside the chart). Tap / click
  // 2 points; MAGNET snaps a point to the bar's high / low / close when within ~10px (18px on touch). Each point is stored as {bar date,
  // price}, so a line stays put through pan / zoom and maps by date onto 1D / 1W / 1M. EXTEND → (default on) runs it to the right edge.
  // In draw mode: tap a line to select it, drag its square ends, CHANNEL adds a dashed parallel through the farthest bar on the other side,
  // DELETE removes it, CLEAR ALL (tap twice) removes every line on this ticker. Saved per ticker in localStorage wa.desk.tl.v1
  // ({TICKER: [{a:{d,p}, b:{d,p}, ext, ch, tf}]}, tf = the timeframe it was drawn on); layer 'tl' (hidden by the CLEAN preset).
  var TIPK='wa.desk.charttip.v1',TIPON=true;try{TIPON=localStorage.getItem(TIPK)!=='0';}catch(e){}
  var TLC='#d8f6ff';   // light ice: readable on the black chart
  function tlLoad(){var j={};try{j=JSON.parse(localStorage.getItem(TLK)||'{}')||{};}catch(e){}
    TL.lines=(Array.isArray(j[TKR])?j[TKR]:[]).filter(function(l){return l&&l.a&&l.b&&l.a.d&&l.b.d&&isFinite(l.a.p)&&isFinite(l.b.p);});if(TL.sel>=TL.lines.length)TL.sel=-1;
    try{var o=JSON.parse(localStorage.getItem(TLOK)||'null');if(o){TL.mag=o.mag?1:0;TL.ext=o.ext?1:0;TL.w=[1,2,3,4,6].indexOf(+o.w)>=0?+o.w:0;}}catch(e){}}
  function tlSave(){try{var j=JSON.parse(localStorage.getItem(TLK)||'{}')||{};if(TL.lines.length)j[TKR]=TL.lines;else delete j[TKR];localStorage.setItem(TLK,JSON.stringify(j));}catch(e){}}
  function tlOpt(){try{localStorage.setItem(TLOK,JSON.stringify({mag:TL.mag,ext:TL.ext,w:TL.w}));}catch(e){}}
  tlLoad();
  function tlGeo(l,g){var ia=dix(l.a.d),ib=dix(l.b.d);if(ia<0||ib<0||ia===ib)return null;
    var xa=g.X(ia-g.off),xb=g.X(ib-g.off),ya=g.Y(l.a.p),yb=g.Y(l.b.p),xe=xb,ye=yb;
    if(l.ext&&g.R>xb){xe=g.R;ye=ya+(yb-ya)/(xb-xa)*(xe-xa);}return {xa:xa,ya:ya,xb:xb,yb:yb,xe:xe,ye:ye};}
  function segD(px,py,s){var dx=s.xe-s.xa,dy=s.ye-s.ya,L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((px-s.xa)*dx+(py-s.ya)*dy)/L)):0;return Math.hypot(px-(s.xa+t*dx),py-(s.ya+t*dy));}
  function tlPt(e,snap){var g=geo;if(!g||g.lo==null)return null;var r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
    var i=Math.max(0,Math.min(g.n-1,Math.floor((px-g.pl)/g.bw))),bi=i+g.off,b=bars[bi];if(!b)return null;
    var p=g.hi-(py-g.pt)/g.ph*(g.hi-g.lo),sn='';
    if(snap&&TL.mag){var best=e.pointerType==='mouse'?10:18;[['H',b.h],['L',b.l],['C',b.c]].forEach(function(q){var d=Math.abs(g.Y(q[1])-py);if(d<best){best=d;p=q[1];sn=q[0];}});}
    return {d:b.d,p:+(+p).toFixed(4),sn:sn};}
  function tlNorm(l){if(l.b.d<l.a.d){var t=l.a;l.a=l.b;l.b=t;}return l;}
  function tlChan(l){var ia=dix(l.a.d),ib=dix(l.b.d);if(ib<=ia)return null;var k=(l.b.p-l.a.p)/(ib-ia),up=0,dn=0,mxA=0,mxB=0;   // line above the bars -> channel through the lowest low, else the highest high
    for(var i=ia;i<=ib;i++){var b=bars[i];if(!b)continue;var lv=l.a.p+k*(i-ia);if(b.c<lv)up++;else dn++;mxA=Math.max(mxA,lv-b.l);mxB=Math.max(mxB,b.h-lv);}
    return up>=dn?-mxA:mxB;}
  var tlRaf=0;function tlDraw(){if(!tlRaf)tlRaf=requestAnimationFrame(function(){tlRaf=0;draw(performance.now());});}
  window.TC_TLXY=function(d,p){var g=geo;if(!g)return null;var r=cv.getBoundingClientRect(),i=dix(d)-g.off;return [r.left+g.X(i),r.top+g.Y(p)];};   // audit / tests: a bar date + price -> client px
  function tlDown(e){if(!TL.mode)return;if(e.pointerType==='mouse'&&e.button!==0)return;e.stopImmediatePropagation();e.preventDefault();
    var r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,tol=e.pointerType==='mouse'?8:16,G=TL.g||[];
    if(TL.sel>=0&&G[TL.sel]){var s=G[TL.sel],h=[['a',s.xa,s.ya],['b',s.xb,s.yb]].filter(function(q){return Math.hypot(q[1]-px,q[2]-py)<=tol+4;})[0];
      if(h){TL.drag={k:h[0],id:e.pointerId};try{cv.setPointerCapture(e.pointerId);}catch(_){}return;}}
    if(!TL.p1){var hit=-1,bd=tol;G.forEach(function(s,j){if(!s)return;var d=segD(px,py,s);if(d<=bd){bd=d;hit=j;}});
      if(hit>=0){TL.sel=hit;tlUI();tlDraw();return;}
      if(TL.sel>=0){TL.sel=-1;tlUI();tlDraw();return;}}
    var q=tlPt(e,true);if(!q)return;
    if(!TL.p1){TL.p1=q;TL.hov=null;}
    else if(q.d!==TL.p1.d){var l=tlNorm({a:{d:TL.p1.d,p:TL.p1.p},b:{d:q.d,p:q.p},ext:TL.ext,ch:null,tf:TF,w:TL.w});TL.lines.push(l);TL.sel=TL.lines.length-1;TL.p1=null;tlSave();}
    tlUI();tlDraw();}
  function tlMove(e){if(!TL.mode)return;e.stopImmediatePropagation();
    if(TL.drag&&TL.drag.id===e.pointerId){var q=tlPt(e,true),l=TL.lines[TL.sel];if(q&&l){var o=TL.drag.k==='a'?l.b:l.a;if(q.d!==o.d){l[TL.drag.k]={d:q.d,p:q.p};}TL.hov=q;tlDraw();}return;}
    if(e.pointerType==='mouse'||TL.p1){TL.hov=tlPt(e,true);tlDraw();}}
  function tlUp(e){if(!TL.mode)return;e.stopImmediatePropagation();if(TL.drag&&TL.drag.id===e.pointerId){var l=TL.lines[TL.sel];if(l){var a=l.a.d,wasA=TL.drag.k==='a';tlNorm(l);}TL.drag=null;tlSave();tlDraw();}}
  cv.addEventListener('pointerdown',tlDown,true);cv.addEventListener('pointermove',tlMove,true);cv.addEventListener('pointerup',tlUp,true);cv.addEventListener('pointercancel',tlUp,true);
  cv.addEventListener('dblclick',function(e){if(TL.mode){e.stopImmediatePropagation();e.preventDefault();}},true);
  cv.addEventListener('touchmove',function(e){if(TL.mode)e.preventDefault();},{passive:false});
  window.addEventListener('storage',function(e){if(e.key===TLK||e.key===TLOK){tlLoad();if(window._tcTLUI)_tcTLUI();draw(performance.now());}else if(e.key===TIPK){TIPON=e.newValue!=='0';if(!TIPON)showTip(-1);if(window._tcLaySync)_tcLaySync();}});
  var tlUI=function(){if(window._tcTLUI)_tcTLUI();};

  // ---------------------------------------------------------------- legend, levels table, footer
  function vpKey(){if(!VP.on)return '';var T=window.TC_VP||{};return '<span class="tc-vpk" style="white-space:normal;overflow-wrap:anywhere;max-width:100%"><i style="background:#ffae00"></i>VOLUME PROFILE · '+esc(T.lab||VPN[VP.m])+' · '+VP.b+' BINS'+' · AMBER LINE = POC · DOTTED BAND = VALUE AREA 70% (VAH / VAL)'+
    ' · GREEN / RED = UP / DOWN-DAY VOLUME · CYAN CAP = HVN · YELLOW DOTS = LVN · EACH DAY’S VOLUME SPREAD EVENLY OVER ITS HIGH–LOW</span>';}
  function volKey(){if(!LS.L.vol)return '';if(VM!=='vsa')return '<span>VOL: PLAIN · GREEN UP / RED DOWN</span>';
    var hasV=OVL.some(function(o){return o.id==='vsa';}),mini=document.body.classList.contains('tc-mini');
    function sw(c,t,gl){return '<i style="background:'+c+';width:9px;height:7px;margin:0 3px 0 6px'+(gl?';box-shadow:0 0 6px #fff2c0':'')+'"></i>'+t;}
    var how='SOLID = CLOSE IN TOP ⅓ · HALF = MIDDLE ⅓ · HOLLOW = BOTTOM ⅓ · ▲ VOL >1.5× + SPREAD <0.7× · ○ VOL <0.7× + SPREAD >1.3× (VS THE 20 BARS BEFORE) · LINE = 20-BAR AVG VOLUME, DASHED = 2×';
    return '<span class="tc-vsak" title="'+how+'">color = rel volume · fill = close position · ▲ absorption · ○ no effort</span>'+
      '<span class="tc-vsal">REL VOL'+sw(VCOL.dim,'&lt;0.7×')+sw(VCOL.cy,'0.7–1.5')+sw(VCOL.cy2,'1.5–2')+sw(VCOL.hot,'2–3')+sw('#fff','≥3× CLIMAX',1)+'</span>'+
      (mini?'':'<span class="tc-vsal">'+how+'</span>')+
      (LS.L.weis?'<span class="tc-vsal"><i style="background:rgba(57,255,136,.5)"></i>/<i style="background:rgba(255,43,214,.5);margin-left:4px"></i>WEIS WAVES UP / DOWN · NEW WAVE WHEN THE CLOSE REVERSES ≥1×ATR14</span>':'');}
  function legendHTML(){return '<span><i style="background:'+C.up+'"></i>'+(BST==='hlc'?'HLC BAR UP (CLOSE ≥ PRIOR CLOSE)':'UP: CLOSE ≥ PRIOR CLOSE')+'</span><span><i style="background:'+C.dn+'"></i>DOWN</span>'+(BST==='hlc'?'':'<span>HOLLOW = CLOSE ≥ OPEN</span>')+vpKey()+
    (NOMA?'<span class="tc-warnline">NO MOVING AVERAGES ON THIS CHART (STRUCTURE + VOLUME ONLY)</span>':smaLeg())+
    (D.buy_zone?'<span><i style="background:rgba(0,229,255,.35)"></i>BUY ZONE</span>':'')+
    (hasRT?'<span><i style="background:'+RTC.r+'"></i>RS RATING 1-99</span><span><i style="background:'+RTC.ma+'"></i>'+rtMaLbl()+' OF RATING</span>'+
      '<span><i style="background:'+RTC.up+';height:8px"></i>RATING ABOVE MA</span><span><i style="background:'+RTC.dn+';height:8px"></i>RATING BELOW MA</span>'+
      '<span><i style="background:'+RTC.r+';height:5px;width:5px;border-radius:50%"></i>/<i style="background:'+RTC.ma+';height:5px;width:5px;border-radius:50%;margin-left:4px"></i>RATING CROSSES MA UP / DOWN</span>'+
      '<span>'+(RTH.from?'RS HISTORY FROM '+esc(sday(RTH.from))+' TO '+esc(sday(RTH.to)):'NO RS RATING HISTORY')+'</span>':'')+
    ((RSD.line||[]).length?'<span><i style="background:'+RSC.lead+';height:6px;width:6px;border-radius:50%"></i>UNDER BAR: RS LINE (÷'+esc(RSD.bench||'SPY')+') 52W HIGH BEFORE PRICE</span>':'<span class="tc-warnline">RS LINE N/A</span>')+'<span>BAR = LOW→HIGH · TICK = CLOSE · NO OPEN</span>'+volKey()+(pgTxt?'<span class="tc-pgk '+pgCls+'" title="'+esc(pgTip)+'">◆ LAST '+esc(pgTxt)+(PGO&&rm!=null?' · '+rmTxt:'')+(pgSub?' · '+esc(pgSub):'')+'</span>':'')+
    PLS.map(function(x){return '<span class="tc-pgk '+plCls(x)+'" title="'+esc(x.pnl.basis||'')+'">◇ '+esc(String(x.label).toUpperCase())+': '+esc(plTxt(x,false).toUpperCase())+esc(plPos(x))+'</span>';}).join('')+(D.sma_note&&TF==='D'?'<span class="tc-warnline">'+esc(D.sma_note.toUpperCase())+'</span>':'')+tfNote();}
  $('tc-legend').innerHTML=legendHTML();window._tcLegend=legendHTML;
  function row(cls,name,v,src,r){return '<tr class="'+cls+'"><td>'+name+'</td><td class="px">'+(v==null?'—':money(v))+'</td><td class="rr">'+(r||'')+'</td><td class="tc-src">'+esc(src||'—')+'</td></tr>';}
  var tbl='<h2>LEVELS &amp; SOURCES</h2><div class="tc-scroll"><table class="tc-tbl"><thead><tr><th>LEVEL</th><th>PRICE</th><th>R</th><th>SOURCE</th></tr></thead><tbody>'+
    row('c-r3','★★ 3R BOSS',D.r3,D.r3!=null?D.r_src+' = '+D.entry.toFixed(2)+' + 3×'+D.risk.toFixed(2):'not computed: '+(D.problem||''),'+3R')+
    row('c-r2','★ 2R',D.r2,D.r2!=null?(D.r_src||'plan').split(' / ')[0]+' = '+D.entry.toFixed(2)+' + 2×'+D.risk.toFixed(2):'not computed: '+(D.problem||''),'+2R')+
    (D.buy_zone?row('c-zone','BUY ZONE TOP',D.buy_zone[1],D.zone_src,''):'')+
    row('c-last','◆ LAST',D.last,(D.last_src||D.price_src)+' · bar '+D.last_date+(pgTxt?' · '+pgTxt.toLowerCase()+(pgSub?' · '+pgSub.toLowerCase():''):''),rmTxt+(PGO?' · <span class="tc-pg '+pgCls+'">'+pgf(PG.pct)+'</span>':''))+
    row('c-entry','▶ BUY (ENTRY)',D.entry,D.entry_src,'0R')+
    (D.cuts||[]).map(function(ct){return row('c-cut','✂ '+esc(ct.label),ct.price,ct.src,D.risk?((ct.price-D.entry)/D.risk).toFixed(2)+'R':'');}).join('')+
    (RP.m05!=null?row('c-a05','-0.5% ACCT',RP.m05,'computed: entry - (0.5/0.75)·R = '+D.entry.toFixed(2)+' - 0.667×'+D.risk.toFixed(2)+' (loss -0.5% of account for a position sized at 0.75% risk)',(-0.5/0.75).toFixed(2)+'R'):'')+
    row('c-stop','✖ STOP',D.stop,D.stop!=null?D.stop_src:'STOP NOT SET — the desk has not documented a stop for this setup','-1R')+
    (RP.m10!=null?row('c-a10','⚠ -1.0% ACCT MAX',RP.m10,'computed: entry - (1/0.75)·R = '+D.entry.toFixed(2)+' - 1.333×'+D.risk.toFixed(2)+' (loss -1.0% of account at 0.75% sizing — the hard max)',(-1/0.75).toFixed(2)+'R'):'')+
    '</tbody></table></div>';
  var notes=[];
  if(D.risk_pct!=null) notes.push(['RISK','1R = '+money(D.risk)+' per share ('+D.risk_pct.toFixed(1)+'% of entry)']);
  (RP.reasons||[]).forEach(function(r){notes.push(['RISK TIER',(RP.tier==='SKIP'?'SKIP':RP.tier+'%')+' — '+r]);});
  if(RP.inputs) notes.push(['RISK INPUTS','score '+(RP.inputs.score==null?'unscored':RP.inputs.score)+' · market confirmed uptrend: '+(RP.inputs.market_confirmed?'yes':'no')+' ('+(RP.inputs.market_src||'?')+') · losing streak: '+(RP.inputs.streak||'n/a')]);
  if(D.setup) notes.push(['SETUP',D.setup+(D.status?' · watchlist status: '+D.status:'')]);
  if(D.alert_state) notes.push(['ALERT','feeds/alerts/state.json: '+D.alert_state+(D.alert_detail?' — '+D.alert_detail:'')]);
  if(D.note) notes.push(['NOTE','watchlist.md: '+D.note]);
  if(D.verdict) notes.push(['VERDICT','report: '+D.verdict]);
  (D.checks||[]).forEach(function(c){notes.push(['CHECK',c]);});
  if(RTH&&RTH.src) notes.push(['RS PANEL',RTH.src+' Regime (tooltip only, not drawn): '+(RTH.rule||'')]);
  if(RSD.src) notes.push(['RS LINE',RSD.src]);
  var RT=RSD.rating||{}; if(RT.src) notes.push(['RS RATING',(RT.status==='ranked'?'RS '+RT.rs+' · rank #'+RT.rank+' of '+RT.universe+' · 1w rank change '+(RT.chg_1w==null?'n/a':RT.chg_1w)+' (vs '+RT.week_ago+') · 4w '+(RT.chg_4w==null?'n/a':RT.chg_4w)+' (vs '+RT.four_week_ago+'); positive = moved up':
    RT.status==='unranked'?'not ranked: '+(RT.reason||'')+(RT.provisional?' · provisional RS '+RT.provisional+' (unverified, short history)':''):'no ranking feed')+' · '+(RT.label||'')+' · session '+(RT.asof||'?')+', file generated '+(RT.generated||'?')+' · '+RT.src]);
  $('tc-levels').innerHTML=(D.entry!=null?tbl:'<h2>LEVELS &amp; SOURCES</h2><p class="tc-src">'+(PLS.length?'NO CHART LEVELS · THE OPEN / PENDING PLANS ARE LISTED IN THE KEY':'NO DESK LEVELS OR PLANS FOR THIS NAME')+'</p>')+'<ul class="tc-notes">'+notes.map(function(n){return '<li><b>'+n[0]+'</b>'+esc(n[1])+'</li>';}).join('')+'</ul>';
  $('tc-foot').innerHTML='<p><b>RESEARCH, NOT ADVICE.</b> Entry/stop are the desk\'s planning levels (watchlist.md, daily report, alert state), not orders; 2R/3R are arithmetic targets. Verify before trading.</p>'+
    '<p>Prices: '+esc(D.price_src)+' · fetched '+esc(D.fetched_at||'?')+' · page generated '+esc(D.generated||'')+' (Sydney).</p><p>Font: Press Start 2P (SIL OFL 1.1). Chart drawn on canvas, no third-party code.</p>';

  // inline dropdowns (stock.html?mini=1): same module, but the long levels table + sources fold closed so the
  // dropdown stays phone-sized (chart canvas at phone height, trade panel / RISK / key open, details one tap away)
  if(document.body.classList.contains('tc-mini')){
    var lvE=$('tc-levels'),ftE=$('tc-foot');
    if(lvE&&!lvE.querySelector('details.tc-fold')){var nr=lvE.querySelectorAll('table tbody tr').length;
      lvE.innerHTML='<details class="tc-fold"><summary>LEVELS &amp; SOURCES'+(nr?' · '+nr+' ROWS':'')+' ▸</summary>'+lvE.innerHTML+'</details>';}
    if(ftE&&!ftE.querySelector('details.tc-fold'))ftE.innerHTML='<details class="tc-fold"><summary>RESEARCH, NOT ADVICE · SOURCES ▸</summary>'+ftE.innerHTML+'</details>';}

  // ---------------------------------------------------------------- run
  function redraw(){drawGauge();draw(performance.now());}
  var ready=(document.fonts&&document.fonts.load)?Promise.all([document.fonts.load("10px 'Press Start 2P'"),document.fonts.ready]).catch(function(){}):Promise.resolve();
  function layersUI(){
    var NAMES={bars:'Price bars',vol:'Volume',weis:'Weis waves (VOL: VSA panel)',sqz:'Pre Squeeze band (coil + demand tell)',sma:'Moving averages (SMA 50/150/200 · 1W 10/30/40 · 1M 3/7/10)',entry:'Entry / pivot line',stop:'Stop line',targets:'Targets 2R / 3R',pct:'% gain ticks (trade strip)',pctl:'% gain lines (chart, faint)',
      acct:'−0.5% / −1% acct loss',cuts:'Cut levels ✂',zones:'Risk / reward / buy-zone bands',last:'Price tag (last)',rsp:'RS rating panel',
      rsl:'RS line dots (new high first)',ovl:'Pattern overlays',oneup:'1UP marker (latest bar)',tl:'My trend lines (✎ LINE)'};
    var HAS={bars:1,vol:1,weis:1,sqz:!!SQZ,sma:NOMA?0:1,entry:D.entry!=null,stop:D.stop!=null,targets:D.r2!=null||D.r3!=null,pct:!!(D.entry>0&&$('tc-gauge')&&$('tc-gauge').offsetParent),pctl:D.entry>0,acct:RP.m05!=null||RP.m10!=null,cuts:(D.cuts||[]).length>0,
      zones:!!D.buy_zone||(D.entry!=null&&D.stop!=null),last:1,rsp:hasRT,rsl:Object.keys(RSM).some(function(k){return RSM[k]==='L';}),ovl:OVL.length>0,oneup:1,tl:1};
    var zb=host.parentNode.querySelector('.tcz'),own=!zb;
    if(own){zb=document.createElement('div');zb.className='tcz tcz-m';host.parentNode.insertBefore(zb,host);}
    var g=document.createElement('div');g.className='tcg';g.setAttribute('role','group');g.setAttribute('aria-label','Chart layers');
    g.innerHTML='<span class="tctf" role="radiogroup" aria-label="Timeframe">'+['D','W','M'].map(function(k){return '<button type="button" role="radio" data-tf="'+k+'" aria-checked="false" title="'+(NATIVE!=='D'&&k!==NATIVE?'This chart is drawn on '+TFW[NATIVE]+' bars only':TFW[k].charAt(0).toUpperCase()+TFW[k].slice(1)+' bars (saved for every chart)')+'">'+TFN[k]+'</button>';}).join('')+'</span>'+
      '<span class="tcvol" role="radiogroup" aria-label="Volume panel"><b>VOL:</b><button type="button" role="radio" data-vm="plain" aria-checked="false" title="Plain green / red volume bars (saved for every chart)">PLAIN</button>'+
      '<button type="button" role="radio" data-vm="vsa" aria-checked="false" title="VSA volume: colour = relative volume, fill = close position, absorption / no-effort glyphs, VSA engine tags (saved for every chart)">VSA</button></span>'+
      '<button type="button" class="tcm"></button><button type="button" class="tcl" aria-haspopup="dialog" aria-expanded="false">☰ LAYERS</button><button type="button" class="tcd" aria-pressed="false" title="Draw trend lines: tap 2 points (pan is off while drawing)">✎ LINE</button><button type="button" class="tct"></button>';
    zb.appendChild(g);
    var pn=document.createElement('div');pn.className='tclp';pn.hidden=true;pn.setAttribute('role','dialog');pn.setAttribute('aria-label','Chart layers');
    function tb(k,lab,on,extra){return '<button type="button" class="tg'+(extra||'')+'" data-k="'+k+'" aria-pressed="'+(on?'true':'false')+'"><i></i><span>'+esc(lab)+'</span></button>';}
    function render(){var pre=presetOf(LS);
      pn.innerHTML='<div class="tclh"><b>LAYERS</b><span class="pp">'+['full','levels','clean'].map(function(p){return '<button type="button" data-p="'+p+'" aria-pressed="'+(pre===p)+'">'+p.toUpperCase()+'</button>';}).join('')+'</span>'+
        '<button type="button" class="x" aria-label="Close layers">✕</button></div>'+
        '<div class="tcvp" role="radiogroup" aria-label="Bar style"><b>BARS</b>'+[['candle','CANDLES'],['hlc','HLC']].map(function(q){return '<button type="button" role="radio" data-bst="'+q[0]+'" aria-checked="'+(BST===q[0])+'" aria-pressed="'+(BST===q[0])+'">'+q[1]+'</button>';}).join('')+'</div>'+
        '<div class="tclg">'+LAYK.filter(function(k){return HAS[k];}).map(function(k){return tb(k,NAMES[k],LS.L[k]);}).join('')+'</div>'+
        '<div class="tcls">VOLUME PROFILE</div><div class="tclg">'+'<button type="button" class="tg" data-vp="on" aria-pressed="'+(VP.on?'true':'false')+'"><i></i><span>Volume profile (right side · POC · value area 70% · HVN / LVN · up / down split)</span></button></div>'+
        '<div class="tcvp" role="radiogroup" aria-label="Volume profile range"><b>RANGE</b>'+VPM.map(function(m){var dis=m==='tr'&&!vpTR();return '<button type="button" role="radio" data-vpm="'+m+'" aria-checked="'+(VP.m===m)+'" aria-pressed="'+(VP.m===m)+'"'+(dis?' disabled title="No Wyckoff trading range on this chart"':'')+'>'+{vis:'VISIBLE','20':'20','50':'50','100':'100',tr:'TR'}[m]+'</button>';}).join('')+'</div>'+
        '<div class="tcvp" role="radiogroup" aria-label="Volume profile bins"><b>BINS</b>'+VPB.map(function(q){return '<button type="button" role="radio" data-vpb="'+q+'" aria-checked="'+(VP.b===q)+'" aria-pressed="'+(VP.b===q)+'">'+q+'</button>';}).join('')+'</div>'+
        '<div class="tcvn">Built from daily bars: each day’s volume is spread evenly over its high–low, green / red = up / down days. VISIBLE follows pan + zoom; 20 / 50 / 100 = the newest bars; TR = the Wyckoff trading range.</div>'+
        (OVL.length?'<div class="tcls">PATTERN OVERLAYS'+(LS.L.ovl?'':' (layer off)')+'</div><div class="tclg">'+OVL.map(function(o,i){return '<button type="button" class="tg tgo" data-o="'+i+'" aria-pressed="'+o.on+'"><i style="border-color:'+esc(o.color||'#ffd23f')+'"></i><span>'+esc(String(o.label||o.id).slice(0,60))+'</span></button>';}).join('')+'</div>':'')+
        '<div class="tcls">TEXT</div><div class="tclg">'+tb('text','All text labels',LS.text,' tgt')+tb('axis','Axis numbers + months',LS.axis,' tgt')+'<button type="button" class="tg tgt" data-tip="1" aria-pressed="'+(TIPON?'true':'false')+'"><i></i><span>Hover / tap info box (crosshair + header stay)</span></button></div>'+
        '<div class="tclf"><button type="button" data-a="all">ALL ON</button><button type="button" data-a="reset">RESET</button><span>'+(pre==='custom'?'CUSTOM mix · saved for every chart':'preset '+pre.toUpperCase()+' · saved for every chart')+'</span></div>';}
    var bm=g.querySelector('.tcm'),bl=g.querySelector('.tcl'),bt=g.querySelector('.tct');
    function lab(){var pre=presetOf(LS),nx={full:'levels',levels:'clean',clean:'full',custom:'full'}[pre];
      bm.textContent={full:'◉ FULL',levels:'◎ LEVELS',clean:'○ CLEAN',custom:'◈ CUSTOM'}[pre];bm.setAttribute('data-mode',pre);
      bm.setAttribute('aria-label','Chart preset: '+pre+'. Tap for '+nx);bm.title='Presets: FULL → LEVELS (bars, entry, stop, price tag) → CLEAN (bars, volume, SMAs, RS panel, no text)';
      bt.textContent=LS.text?'Aa TEXT':'Aa TEXT OFF';bt.setAttribute('aria-pressed',LS.text?'true':'false');bt.setAttribute('aria-label','All chart text '+(LS.text?'on':'off'));
      var B=document.body.classList;B.toggle('tc-notext',!LS.text);B.toggle('tc-noovl',!LS.L.ovl);B.remove('tc-clean','tc-lvonly');
      if(!pn.hidden)render();}
    function legRe(){if($('tc-legend'))$('tc-legend').innerHTML=legendHTML();if(OBAR&&window._tcObHTML)OBAR.innerHTML=window._tcObHTML();}
    function save(){try{localStorage.setItem(LKEY,JSON.stringify(LS));var p=presetOf(LS);if(p!=='custom')localStorage.setItem(MKEY,p);}catch(e){}lab();legRe();redraw();}
    // VOL: PLAIN | VSA (one shared choice, localStorage wa.desk.chartvol.v1, default VSA; other open charts follow live)
    var vg=g.querySelector('.tcvol');
    function vmLab(){vg.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-checked',String(b.getAttribute('data-vm')===VM));});}
    window._tcSetVM=function(m,nosave){VM=m==='plain'?'plain':'vsa';if(!nosave){try{localStorage.setItem(VKEY,VM);}catch(e){}}
      document.body.classList.toggle('tc-volvsa',VM==='vsa');vmLab();legRe();if(!pn.hidden)render();setTimeout(redraw,0);};
    vg.addEventListener('click',function(e){var b=e.target.closest('button[data-vm]');if(b&&b.getAttribute('data-vm')!==VM)window._tcSetVM(b.getAttribute('data-vm'));});
    window.addEventListener('storage',function(e){if(e.key===VKEY&&(e.newValue||'vsa')!==VM)window._tcSetVM(e.newValue||'vsa',1);});
    vmLab();
    function syncOvl(){if(OBAR)OBAR.querySelectorAll('button[data-o]').forEach(function(b){var o=OVL[+b.getAttribute('data-o')];b.setAttribute('aria-pressed',String(o.on));b.innerHTML=OBTN(o);});}
    window._tcLaySync=function(){if(!pn.hidden)render();};
    function open(v){pn.hidden=!v;bl.setAttribute('aria-expanded',String(v));if(v)render();}
    bm.addEventListener('click',function(){var pre=presetOf(LS);LS=preState({full:'levels',levels:'clean',clean:'full',custom:'full'}[pre]);save();});
    bt.addEventListener('click',function(){LS.text=LS.text?0:1;save();});
    // timeframe segmented switch (1D / 1W / 1M): shared by every chart (localStorage wa.desk.charttf.v1); other open charts follow via 'storage'
    var tfg=g.querySelector('.tctf');
    function tfLab(){tfg.querySelectorAll('button').forEach(function(b){var k=b.getAttribute('data-tf');b.setAttribute('aria-checked',String(k===TF));b.disabled=NATIVE!=='D'&&k!==NATIVE;});}
    window._tcSetTF=function(k,nosave){if(NATIVE!=='D'||(k!=='D'&&k!=='W'&&k!=='M'))return;TF=k;if(!nosave){try{localStorage.setItem(TFK,k);}catch(e){}}
      applyTF();tfLab();redraw();if(k!=='D'&&!TFX)tfFetch().then(function(j){if(j&&TF===k){applyTF();redraw();}});};
    tfg.addEventListener('click',function(e){var b=e.target.closest('button[data-tf]');if(!b||b.disabled)return;if(b.getAttribute('data-tf')!==TF)window._tcSetTF(b.getAttribute('data-tf'));});
    tfg.addEventListener('keydown',function(e){var ks=['D','W','M'],i=ks.indexOf(TF),d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d||NATIVE!=='D')return;e.preventDefault();var k=ks[(i+d+3)%3];window._tcSetTF(k);var nb=tfg.querySelector('[data-tf="'+k+'"]');if(nb)nb.focus();});
    window.addEventListener('storage',function(e){if(e.key===TFK&&e.newValue&&e.newValue!==TF)window._tcSetTF(e.newValue,1);});
    tfLab();
    bl.addEventListener('click',function(e){e.stopPropagation();open(pn.hidden);});
    pn.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;e.stopPropagation();
      if(b.classList.contains('x')){open(false);return;}
      if(b.getAttribute('data-tip')){TIPON=!TIPON;try{localStorage.setItem(TIPK,TIPON?'1':'0');}catch(e){}if(!TIPON)showTip(-1);render();return;}
      var vpa=b.getAttribute('data-vp'),vpm=b.getAttribute('data-vpm'),vpb=b.getAttribute('data-vpb'),bst=b.getAttribute('data-bst');
      if(vpa||vpm||vpb){if(vpa)VP.on=VP.on?0:1;if(vpm){VP.m=vpm;VP.on=1;}if(vpb){VP.b=+vpb;VP.on=1;}vpSave();legRe();redraw();render();return;}
      if(bst){BST=bst==='candle'?'candle':'hlc';try{localStorage.setItem(BSK,BST);}catch(e){}legRe();redraw();render();return;}
      var k=b.getAttribute('data-k'),o=b.getAttribute('data-o'),p=b.getAttribute('data-p'),a=b.getAttribute('data-a');
      if(k==='text'||k==='axis')LS[k]=LS[k]?0:1;else if(k)LS.L[k]=LS.L[k]?0:1;
      else if(o!=null){var ov=OVL[+o];ov.on=!ov.on;OLS.set('tc_ovl_'+ov.id,ov.on?'1':'0');if(ov.on)LS.L.ovl=1;syncOvl();}
      else if(p)LS=preState(p);
      else if(a==='all'){LS=preState('full');LAYK.forEach(function(k){LS.L[k]=1;});}
      else if(a==='reset'){LS=preState('full');OVL.forEach(function(ov){ov.on=true;try{localStorage.removeItem('tc_ovl_'+ov.id);}catch(e){}});syncOvl();}
      save();render();});
    document.addEventListener('pointerdown',function(e){if(!pn.hidden&&!pn.contains(e.target)&&!bl.contains(e.target))open(false);},true);
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!pn.hidden){open(false);bl.focus();}});
    window.addEventListener('storage',function(e){if(e.key===LKEY){LS=loadLay();lab();legRe();draw(performance.now());}});   // other open charts / tabs
    window.addEventListener('storage',function(e){if(e.key===VPK){vpLoad();legRe();if(!pn.hidden)render();draw(performance.now());}else if(e.key===BSK){BST=e.newValue==='candle'?'candle':'hlc';legRe();if(!pn.hidden)render();draw(performance.now());}});
    zb.appendChild(pn);lab();
    // ✎ LINE draw bar
    var bd=g.querySelector('.tcd'),dr=document.createElement('div');dr.className='tcdr';dr.hidden=true;dr.setAttribute('role','toolbar');dr.setAttribute('aria-label','Trend line tools');
    dr.innerHTML='<span class="h"></span><button type="button" data-dr="mag"></button><button type="button" data-dr="ext"></button><button type="button" data-dr="ch">∥ CHANNEL</button>'+
      '<span class="tw" role="radiogroup" aria-label="Line width"><b>WIDTH</b>'+[0,1,2,3,4,6].map(function(w){return '<button type="button" role="radio" data-dr="w" data-w="'+w+'" title="'+(w?w+'px line':'Match the bar line width')+'">'+(w?w+'<i style="height:'+w+'px"></i>':'BARS')+'</button>';}).join('')+'</span>'+
      '<button type="button" data-dr="del">DELETE</button><button type="button" data-dr="clr">CLEAR ALL</button><button type="button" data-dr="done">DONE ✓</button>';
    host.parentNode.insertBefore(dr,host);var clrT=0;   // right above the chart (on a phone the notes sit between the toolbar and the chart)
    window._tcTLUI=function(){var s=TL.sel>=0?TL.lines[TL.sel]:null,q=function(k){return dr.querySelector('[data-dr="'+k+'"]');};
      bd.setAttribute('aria-pressed',String(!!TL.mode));dr.hidden=!TL.mode;document.body.classList.toggle('tc-drawing',!!TL.mode);cv.style.touchAction=TL.mode?'none':'';
      dr.querySelector('.h').textContent=TL.p1?'TAP THE 2ND POINT':s?'DRAG THE ■ ENDS · OR DELETE / CHANNEL':'TAP 2 POINTS · TAP A LINE TO EDIT';
      q('mag').textContent='🧲 MAGNET '+(TL.mag?'ON':'OFF');q('mag').setAttribute('aria-pressed',String(!!TL.mag));
      var ex=s?s.ext:TL.ext;q('ext').textContent='EXTEND → '+(ex?'ON':'OFF');q('ext').setAttribute('aria-pressed',String(!!ex));
      var cw=s?(s.w||0):TL.w;dr.querySelectorAll('[data-dr="w"]').forEach(function(b){var on=+b.getAttribute('data-w')===cw;b.setAttribute('aria-checked',String(on));b.setAttribute('aria-pressed',String(on));});
      q('ch').disabled=!s;q('ch').setAttribute('aria-pressed',String(!!(s&&s.ch!=null)));q('del').disabled=!s;q('clr').disabled=!TL.lines.length;
      q('clr').textContent=clrT?'TAP AGAIN: CLEAR '+TL.lines.length:'CLEAR ALL';};
    window._tcTLMode=function(on){TL.mode=on?1:0;TL.p1=null;TL.hov=null;TL.drag=null;if(!on)TL.sel=-1;if(on){hover=-1;showTip(-1);if(!LS.L.tl){LS.L.tl=1;save();}}_tcTLUI();draw(performance.now());};
    bd.addEventListener('click',function(){window._tcTLMode(!TL.mode);});
    dr.addEventListener('click',function(e){var b=e.target.closest('button[data-dr]');if(!b||b.disabled)return;var k=b.getAttribute('data-dr'),s=TL.sel>=0?TL.lines[TL.sel]:null;
      if(k==='done'){window._tcTLMode(false);return;}
      if(k==='mag'){TL.mag=TL.mag?0:1;tlOpt();}
      else if(k==='ext'){if(s){s.ext=s.ext?0:1;tlSave();}else{TL.ext=TL.ext?0:1;tlOpt();}}
      else if(k==='w'){var wv=+b.getAttribute('data-w');TL.w=wv;tlOpt();if(s){s.w=wv;tlSave();}}   // the default for new lines + the selected line (its channel follows)
      else if(k==='ch'&&s){s.ch=s.ch!=null?null:tlChan(s);tlSave();}
      else if(k==='del'&&s){TL.lines.splice(TL.sel,1);TL.sel=-1;tlSave();}
      else if(k==='clr'){if(clrT){clearTimeout(clrT);clrT=0;TL.lines=[];TL.sel=-1;TL.p1=null;tlSave();}else{clrT=setTimeout(function(){clrT=0;_tcTLUI();},3000);}}
      if(k!=='clr'&&clrT){clearTimeout(clrT);clrT=0;}
      _tcTLUI();draw(performance.now());});
    document.addEventListener('keydown',function(e){if(!TL.mode)return;if(e.key==='Escape'){if(TL.p1){TL.p1=null;_tcTLUI();draw(performance.now());}else window._tcTLMode(false);}
      else if((e.key==='Delete'||e.key==='Backspace')&&TL.sel>=0&&!/INPUT|TEXTAREA/.test((e.target||{}).tagName||'')){e.preventDefault();TL.lines.splice(TL.sel,1);TL.sel=-1;tlSave();_tcTLUI();draw(performance.now());}});
    _tcTLUI();
    // ---- notes fold row
    var fr=document.createElement('button');fr.type='button';fr.className='tcf';fr.setAttribute('aria-controls','tc-chart');
    var vk=document.querySelector('.stk-vkey');
    if(vk&&vk.parentNode)vk.parentNode.insertBefore(fr,vk);else zb.parentNode.insertBefore(fr,zb.nextSibling);
    var NN=0;
    function shown(el){return el&&el.offsetParent!==null&&el.textContent.trim().length>0;}
    function count(){if(FOLD)return NN;var n=0,ob=document.querySelector('.tc-ovl'),lg=document.getElementById('tc-legend');
      if(shown(ob))n+=ob.querySelectorAll('.ovr').length;if(shown(vk))n+=Math.max(1,vk.children.length);if(shown(lg))n+=1;if(LAST_OFF&&LS.text)n+=1;return n;}
    function flab(){NN=Math.max(NN,count());fr.hidden=NN===0;
      fr.innerHTML='<i>'+(FOLD?'▸':'▾')+'</i> '+NN+' note'+(NN===1?'':'s')+'<span>'+(FOLD?'tap to show headings + keys':'tap to fold away')+'</span>';
      fr.setAttribute('aria-expanded',FOLD?'false':'true');document.body.classList.toggle('tc-fold',FOLD);}
    fr.addEventListener('click',function(){if(!FOLD)NN=count()||NN;FOLD=!FOLD;try{localStorage.setItem(FKEY,FOLD?'1':'0');}catch(e){}flab();draw(performance.now());});
    window.addEventListener('storage',function(e){if(e.key===FKEY){FOLD=e.newValue==='1';flab();draw(performance.now());}});
    if(FOLD){FOLD=false;document.body.classList.remove('tc-fold');setTimeout(function(){NN=count();FOLD=true;flab();draw(performance.now());},0);}   // count what is foldable, then fold
    else setTimeout(flab,0);
    setTimeout(function(){if(!FOLD)flab();},600);}
  if(!document.getElementById('tc-tf-css')){var tcs=document.createElement('style');tcs.id='tc-tf-css';   // 1D / 1W / 1M segmented switch (cyan, next to the gold presets)
    tcs.textContent='.tcz .tcg .tcd[aria-pressed=true]{background:#ffd23f!important;color:#07061a!important;border-color:#ffd23f!important}'+
      '.tcdr{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:6px;border:2px solid #ffd23f;background:#141005;box-shadow:0 0 10px rgba(255,210,63,.25);position:sticky;top:0;z-index:30;max-width:100%;box-sizing:border-box}.tcdr[hidden]{display:none}'+
      '.tcdr .h{flex:1 1 100%;font:11px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#ffe9a6;letter-spacing:.3px}'+
      '.tcdr button{font:400 8px var(--tc-px,monospace);min-height:36px;padding:4px 7px;cursor:pointer;border:2px solid #8a7420;box-shadow:2px 2px 0 #000;color:#ffe9a6!important;background:#07061a!important;flex:1 1 auto;touch-action:manipulation}.tcdr button[aria-pressed=true]{color:#07061a!important;background:#ffd23f!important;border-color:#ffd23f!important}'+
      '.tcdr .tw{display:flex;flex:1 1 100%;align-items:center;gap:4px;flex-wrap:nowrap}.tcdr .tw b{font:400 8px var(--tc-px,monospace);color:#ffe9a6;margin-right:2px}'+
      '.tcdr .tw button{flex:1 1 0;min-width:38px;padding:4px 2px;display:flex;align-items:center;justify-content:center;gap:4px}.tcdr .tw button i{display:block;width:14px;background:currentColor}'+
      '.tcdr button:disabled{opacity:.35;cursor:default}.tcdr button[data-dr=done]{color:#39ff88!important;border-color:#39ff88!important}body.tc-drawing .tc-canvas{cursor:crosshair}'+
      '.tclp .tcvp{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:6px 0}.tclp .tcvp b{font:400 8px var(--tc-px,monospace);color:#ffae00;min-width:48px;letter-spacing:1px}'+
      '.tclp .tcvp button{min-height:34px!important;min-width:40px;padding:4px 7px!important;font-size:11px!important}.tclp .tcvp button[aria-pressed=true]{border-color:#ffae00!important;color:#ffae00!important;background:rgba(255,174,0,.14)!important}'+
      '.tclp .tcvp button:disabled{opacity:.35;cursor:not-allowed}.tclp .tcvn{font:11px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#9d97cf;margin:2px 0 8px}'+
      '.tc-now{font-size:11px;line-height:1.5;margin:2px 0 7px;padding:5px 7px;border:2px solid currentColor;box-shadow:0 0 8px currentColor inset}.tc-now.pos{color:#39ff88}.tc-now.neg{color:#ff3d7f}.tc-now b{font-weight:400;color:inherit}.tc-pgd{white-space:nowrap}'+'.tc-legend span.tc-vsak,.tc-legend span.tc-vsal,.tc-legend span.tc-vpk,.tc-legend span.tc-pgk,.tc-legend .tc-warnline{white-space:normal!important;overflow-wrap:anywhere;max-width:100%}'+   // the module never widens the page, with or without desk.css (raw generator output)
      '.tc-legend{min-width:0;max-width:100%}.tc-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}.tc-tbl td.tc-src{overflow-wrap:anywhere}.tc-stage,.tc-panel,.tc-foot{min-width:0;max-width:100%}'+
      '.tcz .tcg .tctf{display:inline-flex;flex:0 0 auto;gap:0;border:2px solid #00e5ff;box-shadow:2px 2px 0 #000}'+
      '.tcz .tcg .tctf button{min-width:38px!important;min-height:40px!important;margin:0;border:0!important;border-right:1px solid rgba(0,229,255,.45)!important;box-shadow:none!important;color:#00e5ff!important;background:#07061a!important;padding:4px 6px;flex:0 0 auto}'+
      '.tcz .tcg .tctf button:last-child{border-right:0!important}.tcz .tcg .tctf button[aria-checked=true]{background:#00e5ff!important;color:#07061a!important}'+
      '.tcz .tcg .tctf button:disabled{opacity:.3;cursor:not-allowed}.tcz .tcg .tctf button:focus-visible{outline:2px solid #ffd23f;outline-offset:-2px}'+
      '.tcz .tcg .tcvol{display:inline-flex;flex:0 0 auto;gap:0;border:2px solid #ff2bd6;box-shadow:2px 2px 0 #000}'+
      '.tcz .tcg .tcvol b{display:flex;align-items:center;padding:0 5px;font-size:8px;font-weight:400;color:#ff7be8;background:#07061a;border-right:1px solid rgba(255,43,214,.45)}'+
      '.tcz .tcg .tcvol button{min-width:46px!important;min-height:40px!important;margin:0;border:0!important;border-right:1px solid rgba(255,43,214,.45)!important;box-shadow:none!important;color:#ff7be8!important;background:#07061a!important;padding:4px 5px;flex:0 0 auto}'+
      '.tcz .tcg .tcvol button:last-child{border-right:0!important}.tcz .tcg .tcvol button[aria-checked=true]{background:#ff2bd6!important;color:#07061a!important}'+
      '.tcz .tcg .tcvol button:focus-visible{outline:2px solid #ffd23f;outline-offset:-2px}'+
      '@media (max-width:760px){.tcz .tcg{flex-wrap:wrap}.tcz .tcg .tctf{flex:1 1 44%;min-width:0}.tcz .tcg .tctf button{flex:1 1 0!important;min-width:0!important}.tcz .tcg .tcvol{flex:1 1 50%;min-width:0}.tcz .tcg .tcvol button{flex:1 1 0!important;min-width:0!important}}'+
      'body.tc-mini .tcz .tcg .tctf{flex:1 1 44%;min-width:0}body.tc-mini .tcz .tcg .tctf button{flex:1 1 0!important;min-width:0!important}body.tc-mini .tcz .tcg .tcvol{flex:1 1 50%;min-width:0}body.tc-mini .tcz .tcg .tcvol button{flex:1 1 0!important;min-width:0!important}';
    document.head.appendChild(tcs);}
  var tfReady=TF!==NATIVE?Promise.race([tfFetch(),new Promise(function(r){setTimeout(r,1500);})]):null;
  Promise.all([ready,tfReady]).then(function(){
    if(TF!==NATIVE){applyTF();if(!TFX)tfFetch().then(function(j){if(j&&TF!==NATIVE){applyTF();redraw();}});}
    try{layersUI();}catch(e){if(window.console)console.error(e);}
    redraw(); document.body.classList.add('tc-ready');
    var to=null;window.addEventListener('resize',function(){clearTimeout(to);to=setTimeout(redraw,60);});
    if(!RM){var lastT=0;(function loop(t){if(t-lastT>50&&!document.hidden){lastT=t;draw(t);}requestAnimationFrame(loop);})(0);}
  });
})();
