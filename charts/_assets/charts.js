/* ===== TRADE CHARTS — arcade HLC chart page renderer (canvas, no dependencies) =====
   Data: window.TC_DATA (inlined by research-tools/charts.py). Works from file://.
   HLC bars: vertical low→high bar + right-side close tick (no open tick), coloured by close vs previous close. */
(function(){
  'use strict';
  var D=window.TC_DATA; if(!D||!D.bars) return;
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(/[?&]embed=1/.test(location.search)) document.body.classList.add('tc-embed');
  var FONT="'Press Start 2P','DejaVu Sans',monospace", SYM="'Press Start 2P','DejaVu Sans','Noto Sans Symbols 2','Segoe UI Symbol',monospace";
  var C={up:'#39ff88',dn:'#ff3d7f',entry:'#00e5ff',stop:'#ff2a2a',cut:'#ff9f1c',a05:'#c77dff',a10:'#ff2bd6',r2:'#39ff14',r3:'#ffd700',zone:'#00e5ff',grid:'rgba(107,92,255,.13)',axis:'#6f6a9c',frame:'#3a2f8a',bg:'#0a0822'};
  var MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  function $(id){return document.getElementById(id);}
  function money(v){return v==null?'—':'$'+Number(v).toFixed(2);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var bars=D.bars.map(function(b,i){return {d:b[0],o:b[1],h:b[2],l:b[3],c:b[4],up:!!b[5],v:(D.vol[i]||[])[1]||0};});
  function mapS(a){var m={};(a||[]).forEach(function(p){m[p[0]]=p[1];});return m;}
  var S50=mapS(D.sma50),S150=mapS(D.sma150),S200=mapS(D.sma200);
  var last=bars[bars.length-1], hasR=D.r3!=null, RP=D.risk_plan||{};

  // ---------------------------------------------------------------- detector overlays (format: research-tools/chart_overlays.py docstring)
  // D.overlays = [{id,label,color,asof,legend:[[colour,text]],items:[{t:'box'|'seg'|'hline'|'point'|'span', dates d0/d1/d, prices ...}]}]
  // Items live in date/price space, so they re-project on every draw (zoom, pan, resize). One toggle per overlay (localStorage tc_ovl_<id>).
  var OVL=(D.overlays||[]).filter(function(o){return o&&o.items&&o.items.length;});
  var OLS={get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
  OVL.forEach(function(o){o.on=OLS.get('tc_ovl_'+o.id)!=='0';});
  var DIX={}; bars.forEach(function(b,i){DIX[b.d]=i;});
  function dix(d){if(d==null)return bars.length-1;if(DIX[d]!=null)return DIX[d];if(d<bars[0].d)return -1;var lo=0,hi=bars.length-1;if(d>bars[hi].d)return hi;
    while(lo<hi){var m=(lo+hi+1)>>1;if(bars[m].d<=d)lo=m;else hi=m-1;}return lo;}
  function ovlSpan(it){var a=it.d0!==undefined?it.d0:it.d,b=it.d1!==undefined?it.d1:it.d;return [dix(a),it.t==='hline'||it.t==='box'?(b==null?bars.length-1:dix(b)):dix(b)];}
  function ovlPrices(off,n){var out=[];OVL.forEach(function(o){if(!o.on)return;o.items.forEach(function(it){if(it.pane==='vol')return;var sp=ovlSpan(it);
    if(sp[1]<off||sp[0]>off+n-1)return;[it.p,it.p0,it.p1,it.lo,it.hi].forEach(function(v){if(v!=null)out.push(v);});});});return out;}
  function ovlTag(x,t,cx,cy,c,al,fs){x.font=fs+'px '+FONT;var w=x.measureText(t).width+6,h=fs+5,x0=al==='left'?cx:al==='right'?cx-w:cx-w/2;
    x.fillStyle='rgba(7,6,26,.82)';x.fillRect(x0,cy-h/2,w,h);x.fillStyle=c;x.textAlign='left';x.fillText(t,x0+3,cy+fs/2-0.5);}
  function drawOverlays(x,g){
    var fs=g.narrow?6:7;
    OVL.forEach(function(o){if(!o.on)return;var col=o.color||'#ffd23f';
      o.items.forEach(function(it){var c=it.c||col,sp=ovlSpan(it);if(sp[1]<g.off-1||sp[0]>g.off+g.n)return;
        var x0=g.X(sp[0]-g.off),x1=g.X(sp[1]-g.off);x.save();x.beginPath();
        if(it.pane==='vol')x.rect(g.pl,g.vb-g.vh-18,g.barsEnd-g.pl+4,g.vh+20);else x.rect(g.pl,g.pt-2,g.barsEnd-g.pl+4,g.ph+4);x.clip();
        x.lineCap='round';x.setLineDash(it.dash||[]);x.lineWidth=it.w||1.5;x.strokeStyle=c;
        if(it.t==='box'){var bx0=x0-g.bw/2,bx1=x1+g.bw/2,y0=g.Y(it.hi),y1=g.Y(it.lo);x.fillStyle=it.fill||'rgba(255,255,255,.06)';x.fillRect(bx0,y0,bx1-bx0,y1-y0);
          x.globalAlpha=.55;x.lineWidth=1;x.setLineDash([2,3]);x.strokeRect(bx0,y0,bx1-bx0,y1-y0);x.globalAlpha=1;x.setLineDash([]);
          if(it.label)ovlTag(x,it.label,Math.max(g.pl+2,bx0+2),y1-fs,c,'left',fs);}
        else if(it.t==='seg'){x.beginPath();x.moveTo(x0,g.Y(it.p0));x.lineTo(x1,g.Y(it.p1));x.stroke();
          if(it.label){x.setLineDash([]);ovlTag(x,it.label,(x0+x1)/2,(g.Y(it.p0)+g.Y(it.p1))/2,c,'center',fs);}}
        else if(it.t==='hline'){var y=g.Y(it.p),xe=it.d1==null?g.barsEnd:x1;x.beginPath();x.moveTo(x0,y);x.lineTo(xe,y);x.stroke();x.setLineDash([]);
          if(it.label){x.font=fs+'px '+FONT;var lw=x.measureText(it.label).width+6;ovlTag(x,it.label,Math.max(g.pl+2,Math.min(x0,xe-lw)),y-fs-1,c,'left',fs);}}
        else if(it.t==='point'){var py=g.Y(it.p);x.setLineDash([]);x.fillStyle=c;x.beginPath();x.arc(x0,py,g.narrow?2.5:3.2,0,Math.PI*2);x.fill();
          if(it.label)ovlTag(x,it.label,x0,it.pos==='below'?py+fs+4:py-fs-3,c,'center',fs);}
        else if(it.t==='span'){var yb=it.pane==='vol'?g.vb-g.vh-5:g.pt+4;x.setLineDash([]);x.lineWidth=2;x.beginPath();x.moveTo(x0-g.bw/2,yb+5);x.lineTo(x0-g.bw/2,yb);x.lineTo(x1+g.bw/2,yb);x.lineTo(x1+g.bw/2,yb+5);x.stroke();
          if(it.label){x.font=fs+'px '+FONT;var tw=x.measureText(it.label).width+6;ovlTag(x,it.label,Math.max(g.pl+2,Math.min(g.barsEnd-tw,x1+g.bw/2-tw)),yb-fs+1,c,'left',fs);}}
        x.restore();});});
  }
  var state=(D.alert_state||D.status||'SETUP').toUpperCase(), lvlCls='lvl-'+state.toLowerCase().replace(/[^a-z]+/g,'-');

  // ---------------------------------------------------------------- RISK box (fixed desk rules; computed in charts.py)
  function pct(v){return v==null?'—':(+v).toFixed(1)+'%';}
  function riskBox(){
    var RP=D.risk_plan||{}, sz=RP.size_pct||{}, t=RP.tier, skip=t==='SKIP';
    var tierTxt=skip?'SKIP':(t+'%'), tcls=skip?'neg':t>=1?'pos':t<=0.5?'warn':'';
    return '<div class="tc-risk" id="tc-risk"><div class="rh">RISK</div>'+
      '<div>'+RP.default+'% (DEFAULT) · RANGE '+RP.min+'–'+RP.max+'%</div>'+
      '<div class="tier '+tcls+'" title="'+esc((RP.reasons||[]).join(' | '))+'">TIER: '+tierTxt+' — '+esc(RP.short||'')+'</div>'+
      (RP.stop_pct!=null?'<div>SIZE = RISK ÷ '+RP.stop_pct.toFixed(2)+'% STOP</div>'+
      '<div>0.5% → '+pct(sz['0.5'])+' · 0.75% → <b>'+pct(sz['0.75'])+'</b> · 1% → '+pct(sz['1'])+' OF ACCT</div>':'<div class="neg">STOP NOT SET — NO SIZE</div>')+
      (RP.stop_pct!=null?'<details class="calcd"><summary>SHARES CALC ▸</summary><div class="calc"><label>ACCT $<input id="tc-acct" inputmode="decimal" placeholder="e.g. 100000" aria-label="Account size in dollars (saved in this browser only)"></label>'+
      '<span class="sel" role="radiogroup" aria-label="Risk per trade">'+[0.5,0.75,1].map(function(r){return '<button type="button" data-r="'+r+'">'+r+'%</button>';}).join('')+'</span>'+
      '<div id="tc-calc-out" class="out">ENTER ACCOUNT SIZE FOR SHARES / $ RISK</div></div></details>':'')+'</div>';
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
  var words=state.split(' '), lvlHtml=words.length>1?esc(words.slice(0,Math.ceil(words.length/2)).join(' '))+'<br>'+esc(words.slice(Math.ceil(words.length/2)).join(' ')):esc(state);
  $('tc-hud').innerHTML=
    '<div class="tc-id"><div class="tc-tk">'+esc(D.ticker)+'</div><div class="tc-sub">'+esc(((D.company||'').replace(/[,.].*$/,'').split(/\s+/)[0]||'').toUpperCase().slice(0,14))+' · 1D</div></div>'+
    '<div class="tc-blk"><div class="l">PRICE</div><div class="v">'+money(D.last)+'</div><div class="tc-sub">'+esc(D.last_date)+'</div></div>'+
    '<div class="tc-blk"><div class="l">LEVEL</div><div class="v tc-lvl '+lvlCls+'">'+lvlHtml+'</div></div>'+
    '<div class="tc-blk"><div class="l">R-MULT</div><div class="v tc-rm '+(rm==null?'':rm>=0?'pos':'neg')+'">'+rmTxt+'</div>'+(D.risk?'<div class="tc-sub">1R = $'+D.risk.toFixed(2)+'</div>':'')+'</div>'+
    riskBox()+
    '<div class="tc-gwrap">'+(hasR?'<canvas id="tc-gauge" aria-label="HP bar: price position between stop and 3R"></canvas>':'<div class="tc-warn">☠ STOP NOT SET — no R targets (desk has no documented stop)</div>')+'</div>';
  wireRisk();
  $('tc-level').innerHTML='<span class="'+lvlCls+'">LEVEL: <b>'+esc(state)+'</b>'+(D.status?' · '+esc(D.status.toUpperCase()):'')+'</span>';

  function setup(cv,w,h){var d=Math.max(2,window.devicePixelRatio||1);cv.width=Math.round(w*d);cv.height=Math.round(h*d);cv.style.width=w+'px';cv.style.height=h+'px';var x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);return x;}

  function drawGauge(){
    var cv=$('tc-gauge'); if(!cv) return;
    var gw=Math.max(200,cv.parentNode.getBoundingClientRect().width), gh=84, g=setup(cv,gw,gh);
    var gx0=10,gx1=gw-14,gy=30,seg=gw<420?16:24,sh=22;
    function gxp(v){return gx0+(v-D.stop)/(D.r3-D.stop)*(gx1-gx0);}
    var mx0=gxp(D.last);g.font='8px '+FONT;g.fillStyle='#9a93d8';var gtit=gw>420?'HP / XP  ·  STOP → 3R':'HP / XP',gtw=g.measureText(gtit).width;if(mx0<gx0+gtw+30){g.textAlign='right';g.fillText(gtit,gx1,12);}else{g.textAlign='left';g.fillText(gtit,gx0,12);}
    var sw=(gx1-gx0)/seg, fill=Math.max(0,Math.min(1,(D.last-D.stop)/(D.r3-D.stop)));
    for(var i=0;i<seg;i++){var t=i/(seg-1),on=(i+.5)/seg<=fill,col=t<.3?C.stop:t<.55?'#ff9f1c':t<.8?C.r2:C.r3;
      g.fillStyle=on?col:'#241f4a';g.shadowColor=col;g.shadowBlur=on?8:0;g.fillRect(gx0+i*sw+1,gy,sw-3,sh);}
    g.shadowBlur=0;g.strokeStyle='#6b5cff';g.lineWidth=2;g.strokeRect(gx0-2,gy-3,gx1-gx0+3,sh+6);
    [['STOP',D.stop,C.stop],['ENTRY',D.entry,C.entry],['2R',D.r2,C.r2],['3R',D.r3,C.r3]].forEach(function(a){var x=gxp(a[1]);
      g.fillStyle=a[2];g.fillRect(x-1,gy+sh+3,3,8);g.font='7px '+FONT;g.textAlign=a[0]=='STOP'?'left':a[0]=='3R'?'right':'center';g.fillText(a[0],a[0]=='STOP'?x-2:a[0]=='3R'?x+2:x,gy+sh+22);});
    var mx=Math.max(gx0,Math.min(gx1,gxp(D.last)));g.fillStyle='#fff';g.shadowColor='#fff';g.shadowBlur=10;g.beginPath();g.moveTo(mx,gy-2);g.lineTo(mx-7,gy-12);g.lineTo(mx+7,gy-12);g.fill();g.fillRect(mx-1,gy-2,3,sh+4);g.shadowBlur=0;
    g.textAlign='center';g.font='7px '+FONT;g.fillText(D.last<D.stop?'KO':'YOU',mx,gy-15);
  }

  // ---------------------------------------------------------------- chart
  var host=$('tc-chart'), cv=document.createElement('canvas'), tip=document.createElement('div');
  cv.className='tc-canvas'; tip.className='tc-tip'; tip.hidden=true; host.appendChild(cv); host.appendChild(tip);
  var geo=null, hover=-1, t0=performance.now();

  function levels(){
    var L=[];
    if(D.entry!=null) L.push({k:'entry',v:D.entry,c:C.entry,w:2,t:['▶ ENTRY '+money(D.entry)],short:['▶ ENTRY '+D.entry.toFixed(2)],nt:'▶ '+D.entry.toFixed(2)});
    if(D.stop!=null) L.push({k:'stop',v:D.stop,c:C.stop,t:['STOP '+money(D.stop)+' (-0.75%)','— GAME OVER'],short:['STOP '+D.stop.toFixed(2)+' (-.75%)'],nt:'STOP '+D.stop.toFixed(2),w:2,skull:1});
    if(RP.m05!=null) L.push({k:'a05',v:RP.m05,c:C.a05,t:['-0.5% ACCT '+money(RP.m05)],short:['-0.5% '+RP.m05.toFixed(2)],nt:'-.5% '+RP.m05.toFixed(2),w:1.5,dash:[5,3],thin:1,bg:'#170a26'});
    if(RP.m10!=null) L.push({k:'a10',v:RP.m10,c:C.a10,t:['⚠ -1.0% ACCT '+money(RP.m10)+' MAX'],short:['-1.0% '+RP.m10.toFixed(2)+' MAX'],nt:'-1% '+RP.m10.toFixed(2),w:2,dash:[6,3],warn:1,bg:'#2a0626'});
    (D.cuts||[]).forEach(function(ct){L.push({k:'cut',v:ct.price,c:C.cut,t:['✂ '+ct.label],short:['✂ '+ct.label.replace(' (close)','')],nt:'✂'+ct.label.replace(' (close)','').replace(/^CUT\s*/,''),w:1.5,dash:[4,3],thin:1});});
    if(D.r2!=null) L.push({k:'r2',v:D.r2,c:C.r2,w:2,t:['★ 2R '+money(D.r2)],short:['★ 2R '+D.r2.toFixed(2)],nt:'2R '+D.r2.toFixed(2)});
    if(D.r3!=null) L.push({k:'r3',v:D.r3,c:C.r3,w:2,t:['★★ 3R BOSS '+money(D.r3)],short:['★★ 3R '+D.r3.toFixed(2)],nt:'3R '+D.r3.toFixed(2)});
    return L;
  }

  // Layout (left→right): HLC bars | level strip (short glowing segments + zone bands, right of the last bar) | tag flags | price axis
  function draw(now){
    var W=Math.round(host.getBoundingClientRect().width), H=Math.round(host.getBoundingClientRect().height);
    if(W<50||H<50) return;
    var x=setup(cv,W,H), narrow=W<700;
    x.fillStyle=C.bg;x.fillRect(0,0,W,H);x.strokeStyle=C.frame;x.lineWidth=2;x.strokeRect(1,1,W-2,H-2);
    var fs=narrow?7:8, tfs=narrow?6:8, pl=narrow?6:10, pt=narrow?26:22, pb=narrow?26:34, vh=Math.round(H*(narrow?.13:.14)), ph=H-pt-pb-vh-10;
    var axisW=narrow?46:56, L=levels().filter(function(l){return l.v!=null;});
    // phones: level tags double as the price axis (one merged right column) and the last price joins the tag stack, so the bars get the width
    if(narrow) L.push({k:'last',v:last.c,c:'#ffffff',nt:last.c.toFixed(2),t:[last.c.toFixed(2)],w:1,inv:1});
    // measure tag widths first so the right margin always fits them (nothing covers the bars)
    x.font=tfs+'px '+SYM;
    var tags=L.map(function(l){var t=narrow?[l.nt||(l.short||l.t)[0]]:l.t;return {l:l,t:t,tw:Math.max.apply(null,t.map(function(s){return x.measureText(s).width;}))+(narrow?12:22)+(l.skull&&!narrow?22:0),bh:(l.thin?(narrow?12:16):(narrow?13:20))+(t.length-1)*(narrow?11:12)};});
    var tagW=4+Math.max(narrow?40:120,Math.max.apply(null,tags.map(function(t){return t.tw;}).concat([0])));
    // exact geometry (approved v5): GAP px from the end of the last close tick, STUB px stubs, NOTCH px notch, then the tag body
    var GAP=narrow?4:30, STUB=narrow?5:70, NOTCH=narrow?5:10;
    if(narrow) axisW=0;
    var avail=W-pl-axisW-tagW-NOTCH-(narrow?2:6);
    // visible window (density / pan) from chart_zoom.js; without it fall back to the newest ~130 bars
    var ZV=window.TCZoom?TCZoom.view(avail-GAP-STUB,narrow):{start:Math.max(0,bars.length-(narrow?60:130)),n:Math.min(bars.length,narrow?60:130)};
    var V=bars.slice(ZV.start,ZV.start+ZV.n), off=ZV.start, n=V.length, atLatest=off+n>=bars.length;
    var bw=(avail-GAP-STUB)/(n-1+0.5+0.62); if(!narrow) bw=Math.min(bw,(avail-GAP-STUB)/(n-1+1.12));
    function X(i){return pl+i*bw+bw/2;}
    var lastEdge=X(n-1)+Math.max(1.5,Math.min(bw*.5,9)), barsEnd=lastEdge, sx0=Math.round(lastEdge+GAP), sx1=sx0+STUB, tagX=sx1, axX=narrow?W-3:W-axisW+6;
    var lo=Infinity,hi=-Infinity;
    V.forEach(function(b){lo=Math.min(lo,b.l);hi=Math.max(hi,b.h);});
    [D.stop,D.entry,D.r2,D.r3,RP.m05,RP.m10,D.buy_zone&&D.buy_zone[1]].concat((D.cuts||[]).map(function(c){return c.price;})).forEach(function(v){if(v!=null){lo=Math.min(lo,v);hi=Math.max(hi,v);}});
    ovlPrices(off,n).forEach(function(v){lo=Math.min(lo,v);hi=Math.max(hi,v);});   // keep visible detector drawings in range
    var pad=(hi-lo)*.04; lo-=pad; hi+=pad;
    function Y(v){return pt+(hi-v)/(hi-lo)*ph;}
    geo={X:X,Y:Y,bw:bw,pl:pl,barsEnd:barsEnd,off:off,n:n,W:W,H:H};
    if(window.TCZoom) TCZoom.geo({pl:pl,bw:bw,barsEnd:barsEnd,n:n,start:off,W:W});
    // grid + price axis (far right)
    var span=hi-lo, raw=span/(narrow?5:8), mag=Math.pow(10,Math.floor(Math.log10(raw))), step=[1,2,2.5,5,10].map(function(m){return m*mag;}).find(function(s){return s>=raw;});
    x.strokeStyle=C.grid;x.lineWidth=1;x.font=(narrow?6:fs)+'px '+FONT;x.fillStyle=C.axis;x.textAlign=narrow?'right':'left';
    for(var v=Math.ceil(lo/step)*step;v<hi;v+=step){x.beginPath();x.moveTo(pl,Y(v));x.lineTo(sx1,Y(v));x.stroke();x.fillText(step<1?v.toFixed(2):String(Math.round(v*100)/100),axX,Y(v)+3);}
    x.textAlign='left';x.font=fs+'px '+FONT;if(!narrow){x.strokeStyle='rgba(107,92,255,.35)';x.beginPath();x.moveTo(W-axisW,pt-6);x.lineTo(W-axisW,H-pb);x.stroke();}x.strokeStyle=C.grid;
    var pm=V[0].d.slice(0,7);
    var lastLab=-1e9, labGap=narrow?30:36;
    V.forEach(function(b,i){var m=b.d.slice(0,7);if(m!=pm&&i>0){pm=m;if(X(i)-lastLab<labGap||X(i)>barsEnd-10)return;lastLab=X(i);var mo=+b.d.slice(5,7);x.beginPath();x.moveTo(X(i),pt);x.lineTo(X(i),H-pb);x.stroke();
      x.fillStyle=mo===1?'#cfc9ff':C.axis;x.fillText(mo===1?b.d.slice(0,4):MON[mo-1],X(i)+3,H-pb+18);x.fillStyle=C.axis;}});
    // right-side strip: risk / reward / buy-zone bands only between the last bar and the tags
    if(D.entry!=null&&D.stop!=null&&D.entry>D.stop){x.fillStyle='rgba(255,42,42,.08)';x.fillRect(sx0,Y(D.entry),sx1-sx0,Y(D.stop)-Y(D.entry));}
    if(hasR){x.fillStyle='rgba(57,255,20,.045)';x.fillRect(sx0,Y(D.r3),sx1-sx0,Y(D.entry)-Y(D.r3));}
    if(D.buy_zone){var z0=Y(D.buy_zone[1]),z1=Y(D.buy_zone[0]);x.fillStyle='rgba(0,229,255,.08)';x.fillRect(sx0,z0,sx1-sx0,z1-z0);
      x.save();x.strokeStyle='rgba(0,229,255,.4)';x.setLineDash([2,2]);x.lineWidth=1;x.beginPath();x.moveTo(sx0,z0);x.lineTo(sx1,z0);x.stroke();x.restore();
      if(false){x.font=(narrow?5:6)+'px '+FONT;x.fillStyle='rgba(0,229,255,.9)';x.textAlign='center';x.fillText('BUY ZONE',(sx0+sx1)/2,(z0+z1)/2-2);x.fillText('TO '+D.buy_zone[1].toFixed(2),(sx0+sx1)/2,(z0+z1)/2+8);}}
    // vertical pixel labels inside the strip
    if(!narrow){x.save();x.font='6px '+FONT;x.textAlign='center';
      function vlab(t,y0,y1,c){if(Math.abs(y1-y0)<t.length*7+6)return;x.save();x.translate((sx0+sx1)/2,(y0+y1)/2);x.rotate(-Math.PI/2);x.fillStyle=c;x.fillText(t,0,3);x.restore();}

      x.restore();}
    if(narrow){tags.forEach(function(t){var l=t.l;if(l.k==='last')return;var y=Y(l.v);x.save();x.strokeStyle=l.c;x.globalAlpha=l.thin?.35:.45;x.lineWidth=1;x.setLineDash(l.dash||[4,3]);
      x.beginPath();x.moveTo(pl,y);x.lineTo(sx0,y);x.stroke();x.restore();});}
    // volume
    var vmax=Math.max.apply(null,V.map(function(b){return b.v;}))||1, vb=H-pb;
    V.forEach(function(b,i){x.fillStyle=(b.up?C.up:C.dn)+'55';var hh=b.v/vmax*vh;x.fillRect(X(i)-bw*.35,vb-hh,Math.max(1,bw*.7),hh);});
    x.fillStyle=C.axis;x.textAlign='left';x.font=fs+'px '+FONT;x.fillText('VOL',pl+6,vb-vh+4);
    // SMAs
    [[S50,'#ff9f1c','SMA50'],[S150,'#b86bff','SMA150'],[S200,'#4da3ff','SMA200']].forEach(function(a,j){
      x.strokeStyle=a[1];x.lineWidth=1.3;x.globalAlpha=.85;x.beginPath();var s=0;
      V.forEach(function(b,i){var val=a[0][b.d];if(val==null)return;var y=Y(val);if(y<pt-2||y>pt+ph+2){s=0;return;}s?x.lineTo(X(i),y):x.moveTo(X(i),y);s=1;});
      x.stroke();x.globalAlpha=1;var has=Object.keys(a[0]).length>0;x.fillStyle=has?a[1]:'#4a456f';x.font=fs+'px '+FONT;x.textAlign='left';
      x.fillText(a[2]+(has?'':' n/a'),pl+10+j*(narrow?70:90),pt-8);});
    // HLC bars: low→high bar + right close tick, no open tick
    var bLW=Math.max(1,Math.min(bw*.38,narrow?5:6)), tLW=Math.max(1,Math.min(bw*.3,2.4)), tLen=Math.max(1.5,Math.min(bw*.5,9));
    V.forEach(function(b,i){var c=b.up?C.up:C.dn;x.strokeStyle=c;x.lineWidth=bLW;x.lineCap='butt';
      x.beginPath();x.moveTo(X(i),Y(b.h));x.lineTo(X(i),Y(b.l)+(Y(b.l)-Y(b.h)<1?1:0));x.stroke();
      x.lineWidth=tLW;x.beginPath();x.moveTo(X(i),Y(b.c));x.lineTo(X(i)+bLW/2+tLen,Y(b.c));x.stroke();});
    if(OVL.length) drawOverlays(x,{X:X,Y:Y,off:off,n:n,bw:bw,pl:pl,barsEnd:barsEnd,pt:pt,ph:ph,vb:vb,vh:vh,narrow:narrow});
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
    tags.forEach(function(t){var l=t.l,c=l.c,nx=tagX,notch=NOTCH,bx=nx+notch,by=t.cy-t.bh/2,moved=Math.abs(t.cy-t.y)>1.5;
      var ay=t.cy;
      x.save();x.globalAlpha=l.thin?.92:1;
      x.beginPath();x.moveTo(nx,ay);x.lineTo(bx,Math.max(by,ay-notch));x.lineTo(bx,by);x.lineTo(bx+t.tw,by);x.lineTo(bx+t.tw,by+t.bh);x.lineTo(bx,by+t.bh);x.lineTo(bx,Math.min(by+t.bh,ay+notch));x.closePath();
      x.fillStyle=l.inv?c:(l.bg||(l.thin?'#120a10':'#07061a'));x.fill();x.strokeStyle=c;x.lineWidth=l.thin?1.2:2;x.setLineDash(l.thin?[3,2]:[]);x.shadowColor=c;x.shadowBlur=l.thin?0:10;x.stroke();x.setLineDash([]);
      if(!l.thin&&!l.inv){x.shadowBlur=0;x.fillStyle=c;x.globalAlpha=.9;x.fillRect(bx+t.tw-4,by+2,2,t.bh-4);x.globalAlpha=1;} // pixel "pole" edge
      if(Math.abs(t.cy-t.y)>0.5){x.save();x.setLineDash([]);x.strokeStyle=c;x.lineWidth=1.5;x.shadowColor=c;x.shadowBlur=3;x.beginPath();x.moveTo(sx1,t.y);x.lineTo(nx+2,t.cy);x.stroke();x.restore();}
      x.fillStyle=l.inv?'#07061a':c;x.shadowColor=c;x.shadowBlur=(l.thin||l.inv||narrow)?0:8;x.textAlign='left';x.font=tfs+'px '+SYM;
      var tx=bx+(narrow?5:6);
      if(l.skull&&!narrow){var SP=narrow?2:2.5,SK=['.#####.','#######','#..#..#','#..#..#','#######','.##.##.','.#.#.#.'];x.shadowBlur=6;
        SK.forEach(function(r,ry){r.split('').forEach(function(ch,cx){if(ch=='#')x.fillRect(Math.round(tx+cx*SP),Math.round(t.cy-(t.t.length-1)*(narrow?11:12)/2-SP*3.5+ry*SP),Math.ceil(SP),Math.ceil(SP));});});tx+=SP*7+(narrow?4:6);}
      var lh=narrow?11:12;t.t.forEach(function(s,k){x.fillText(s,k?bx+6:tx,t.cy+(narrow?3:4)-(t.t.length-1)*lh/2+k*lh);});
      if(l.warn){x.shadowBlur=0;for(var q=0;q<t.tw-6;q+=6){x.fillRect(bx+3+q,by-4,3,2);x.fillRect(bx+3+q,by+t.bh+2,3,2);}}
      x.restore();});
    if(D.stop==null){x.font=(narrow?8:10)+'px '+SYM;x.fillStyle=C.stop;x.shadowColor=C.stop;x.shadowBlur=10;x.textAlign='center';x.fillText('☠ STOP NOT SET — NO R TARGETS',(pl+barsEnd)/2,pt+ph*.5);x.shadowBlur=0;}
    // last price tag on the axis
    var lastV=V[n-1],ly=Y(last.c);if(!narrow&&ly>pt-8&&ly<pt+ph+8){x.font=fs+'px '+FONT;var lt=lastV.c.toFixed(2),ltw=x.measureText(lt).width+6;x.fillStyle='#fff';x.beginPath();x.moveTo(W-axisW-5,ly);x.lineTo(W-axisW+1,ly-7);x.lineTo(W-2,ly-7);x.lineTo(W-2,ly+7);x.lineTo(W-axisW+1,ly+7);x.fill();x.fillStyle='#07061a';x.font=(narrow?6:7)+'px '+FONT;x.textAlign='left';x.fillText(lt,W-axisW+3,ly+4);}
    // 1UP sprite above last bar
    if(atLatest){var bob=RM?0:Math.round(Math.sin((now-t0)/260)*2), spx=X(n-1), spy=Y(lastV.h)-8+bob, P=narrow?2:3, spr=['.###.','.###.','.###.','#####','.###.','..#..'];
    x.fillStyle=C.r3;x.shadowColor=C.r3;x.shadowBlur=10;
    spr.forEach(function(r,ry){r.split('').forEach(function(ch,cx){if(ch=='#')x.fillRect(spx+(cx-2.5)*P,spy-(spr.length-ry)*P,P,P);});});
    x.shadowBlur=0;x.fillStyle='#fff';x.font=fs+'px '+FONT;x.textAlign='center';x.fillText('1UP',spx,spy-spr.length*P-6);}
    // crosshair
    if(hover>=0&&hover<n){var hx=X(hover);x.save();x.strokeStyle='rgba(255,255,255,.35)';x.setLineDash([3,3]);x.lineWidth=1;
      x.beginPath();x.moveTo(hx,pt);x.lineTo(hx,H-pb);x.stroke();x.restore();}
  }

  function ovlTips(d){var t='';OVL.forEach(function(o){if(!o.on)return;o.items.forEach(function(it){if(it.t==='point'&&it.d===d&&it.tip)t+='<br><span class="tc-otip" style="color:'+esc(it.c||o.color)+'">'+esc(it.tip)+'</span>';});});return t;}   // overlay point notes (e.g. VSA why)
  function showTip(i,px,py){
    if(i<0){tip.hidden=true;return;}
    var b=bars[i],prev=i>0?bars[i-1].c:null,ch=prev?((b.c/prev-1)*100):null, r=(D.risk&&D.entry!=null)?((b.c-D.entry)/D.risk):null;
    tip.innerHTML='<b>'+esc(b.d)+'</b><br>H '+b.h.toFixed(2)+'<br>L '+b.l.toFixed(2)+'<br>C '+b.c.toFixed(2)+(ch==null?'':' <span class="'+(ch>=0?'pos':'neg')+'">'+(ch>=0?'+':'')+ch.toFixed(1)+'%</span>')+
      '<br>VOL '+(b.v>=1e6?(b.v/1e6).toFixed(2)+'M':Math.round(b.v/1e3)+'K')+(S50[b.d]?'<br>SMA50 '+S50[b.d].toFixed(2):'')+(r==null?'':'<br>'+(r>=0?'+':'')+r.toFixed(2)+'R')+ovlTips(b.d);
    tip.hidden=false;var w=host.clientWidth;tip.style.left=(px>w/2?Math.max(4,px-tip.offsetWidth-14):px+14)+'px';tip.style.top=Math.max(4,Math.min(host.clientHeight-tip.offsetHeight-4,py-40))+'px';
  }
  function onMove(e){if(!geo)return;var r=cv.getBoundingClientRect(),p=e.touches?e.touches[0]:e,px=p.clientX-r.left,py=p.clientY-r.top;
    var i=Math.floor((px-geo.pl)/geo.bw);if(px>geo.barsEnd||i<0||i>=geo.n){hover=-1;showTip(-1);}else{hover=i;showTip(i+geo.off,px,py);}if(RM)draw(performance.now());}
  cv.addEventListener('mousemove',function(e){if(window.TCZoom&&TCZoom.dragging){return;}onMove(e);});
  if(window.TCZoom) TCZoom.mount({host:host,canvas:cv,total:bars.length,redraw:function(){draw(performance.now());},
    tap:function(cx,cy){onMove({clientX:cx,clientY:cy});},clearTip:function(){hover=-1;showTip(-1);}});
  else {cv.addEventListener('touchstart',onMove,{passive:true});cv.addEventListener('touchmove',onMove,{passive:true});}
  // overlay toggle + legend bar (between the zoom toolbar and the chart)
  if(OVL.length){var ob=document.createElement('div');ob.className='tc-ovl';ob.setAttribute('role','group');ob.setAttribute('aria-label','Detector overlays');
    function obtn(o){return (o.on?'◉ ':'○ ')+esc(o.label)+(o.on?' · ON':' · OFF');}
    ob.innerHTML=OVL.map(function(o,k){return '<div class="ovr"><button type="button" data-o="'+k+'" aria-pressed="'+o.on+'" title="Show / hide the detector drawing">'+obtn(o)+'</button>'+
      '<span class="ol">'+(o.legend||[]).map(function(l){return '<span><i style="background:'+esc(l[0])+'"></i>'+esc(l[1])+'</span>';}).join('')+
      (o.asof?'<span class="oa">AS OF '+esc(o.asof)+'</span>':'')+'</span>'+(o.note?'<details class="onote"><summary>STORY</summary><p>'+esc(o.note)+'</p></details>':'')+'</div>';}).join('');
    host.parentNode.insertBefore(ob,host);
    ob.addEventListener('click',function(e){var b=e.target.closest('button[data-o]');if(!b)return;var o=OVL[+b.getAttribute('data-o')];o.on=!o.on;
      OLS.set('tc_ovl_'+o.id,o.on?'1':'0');b.setAttribute('aria-pressed',String(o.on));b.innerHTML=obtn(o);draw(performance.now());});
  }
  cv.addEventListener('mouseleave',function(){hover=-1;showTip(-1);if(RM)draw(performance.now());});

  // ---------------------------------------------------------------- legend, levels table, footer
  $('tc-legend').innerHTML='<span><i style="background:'+C.up+'"></i>HLC BAR UP (CLOSE ≥ PRIOR CLOSE)</span><span><i style="background:'+C.dn+'"></i>DOWN</span>'+
    '<span><i style="background:#ff9f1c"></i>SMA50</span><span><i style="background:#b86bff"></i>SMA150</span><span><i style="background:#4da3ff"></i>SMA200</span>'+
    (D.buy_zone?'<span><i style="background:rgba(0,229,255,.35)"></i>BUY ZONE</span>':'')+'<span>BAR = LOW→HIGH · TICK = CLOSE · NO OPEN</span>'+(D.sma_note?'<span class="tc-warnline">'+esc(D.sma_note.toUpperCase())+'</span>':'');
  function row(cls,name,v,src,r){return '<tr class="'+cls+'"><td>'+name+'</td><td class="px">'+(v==null?'—':money(v))+'</td><td class="rr">'+(r||'')+'</td><td class="tc-src">'+esc(src||'—')+'</td></tr>';}
  var tbl='<h2>LEVELS &amp; SOURCES</h2><div class="tc-scroll"><table class="tc-tbl"><thead><tr><th>LEVEL</th><th>PRICE</th><th>R</th><th>SOURCE</th></tr></thead><tbody>'+
    row('c-r3','★★ 3R BOSS',D.r3,D.r3!=null?D.r_src+' = '+D.entry.toFixed(2)+' + 3×'+D.risk.toFixed(2):'not computed: '+(D.problem||''),'+3R')+
    row('c-r2','★ 2R',D.r2,D.r2!=null?D.r_src.split(' / ')[0]+' = '+D.entry.toFixed(2)+' + 2×'+D.risk.toFixed(2):'not computed: '+(D.problem||''),'+2R')+
    (D.buy_zone?row('c-zone','BUY ZONE TOP',D.buy_zone[1],D.zone_src,''):'')+
    row('c-last','◆ LAST',D.last,(D.last_src||D.price_src)+' · bar '+D.last_date,rmTxt)+
    row('c-entry','▶ ENTRY',D.entry,D.entry_src,'0R')+
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
  $('tc-levels').innerHTML=tbl+'<ul class="tc-notes">'+notes.map(function(n){return '<li><b>'+n[0]+'</b>'+esc(n[1])+'</li>';}).join('')+'</ul>';
  $('tc-foot').innerHTML='<p><b>RESEARCH, NOT ADVICE.</b> Entry/stop are the desk\'s planning levels (watchlist.md, daily report, alert state), not orders; 2R/3R are arithmetic targets. Verify before trading.</p>'+
    '<p>Prices: '+esc(D.price_src)+' · fetched '+esc(D.fetched_at||'?')+' · page generated '+esc(D.generated||'')+' (Sydney).</p><p>Font: Press Start 2P (SIL OFL 1.1). Chart drawn on canvas, no third-party code.</p>';

  // ---------------------------------------------------------------- run
  function redraw(){drawGauge();draw(performance.now());}
  var ready=(document.fonts&&document.fonts.load)?Promise.all([document.fonts.load("10px 'Press Start 2P'"),document.fonts.ready]).catch(function(){}):Promise.resolve();
  ready.then(function(){
    redraw(); document.body.classList.add('tc-ready');
    var to=null;window.addEventListener('resize',function(){clearTimeout(to);to=setTimeout(redraw,60);});
    if(!RM){var lastT=0;(function loop(t){if(t-lastT>50&&!document.hidden){lastT=t;draw(t);}requestAnimationFrame(loop);})(0);}
  });
})();
