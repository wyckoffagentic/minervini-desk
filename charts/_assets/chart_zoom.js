/* ===== TRADE CHARTS — density / zoom / pan controller (no dependencies) =====
   Loaded before charts.js by the chart pages (research-tools/charts.py copies it to site/public/charts/_assets/).
   charts.js asks TCZoom.view(areaPx, narrow) for the visible window on every draw and reports its geometry back with
   TCZoom.geo({...}); this file owns the toolbar (− TIGHTER / slider / + WIDER, 3M·6M·1Y·ALL, ▶| LATEST), the gestures
   (drag-to-pan + pinch on touch; drag + wheel/trackpad on desktop; keyboard on the focused canvas) and the saved density.
   Density is saved in localStorage ("tc_density_narrow" for phones, "tc_density_wide" for desktop) and shared by every chart page.
   The window is always anchored to the newest bar unless the user pans back (pan is not saved).
   Timeframe (charts.js 1D / 1W / 1M switch): TCZoom.setTf(tf,total) swaps the bar count, the range presets (D 3M/6M/1Y, W 6M/1Y/2Y,
   M 2Y/5Y/10Y) and the saved density key (D keeps "tc_density_<cls>"; W / M use "tc_density_<cls>_w|_m"). */
(function(){
  'use strict';
  var PRE={D:[['3M',63],['6M',126],['1Y',252],['ALL',0]],W:[['6M',26],['1Y',52],['2Y',104],['ALL',0]],M:[['2Y',24],['5Y',60],['10Y',120],['ALL',0]]},PRESETS=PRE.D;
  var MPB={D:1/21,W:12/52,M:1};      // months per bar (readout)
  var DEF_PX={narrow:4.7,wide:6};      // default bar pitch: ~60 bars on a 390px phone, ~130-140 on a 1240px desktop
  var MIN_BARS=12, MAX_PX=40, STEP=1.25;
  var LS={get:function(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}},set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
  var S={tf:'D',total:0,A:0,cls:null,pref:null,count:0,offset:0,bw:6,pl:0,barsEnd:0,start:0,n:0}, O=null, ui={}, raf=0, Z={dragging:false};

  function key(){return 'tc_density_'+S.cls+(S.tf!=='D'?'_'+S.tf.toLowerCase():'');}
  function minCount(){return Math.min(S.total,Math.max(MIN_BARS,Math.ceil(S.A/MAX_PX)));}
  function clampCount(c){return Math.max(minCount(),Math.min(S.total,Math.round(c)));}
  function countFor(p){
    if(!p) p={px:DEF_PX[S.cls]};
    if(p.preset){var d=PRESETS.filter(function(q){return q[0]===p.preset;})[0];return clampCount(d&&d[1]?d[1]:S.total);}
    return clampCount(S.A/(+p.px||DEF_PX[S.cls]));
  }
  function clampOff(){S.offset=Math.max(0,Math.min(S.total-S.count,S.offset));}
  function kick(){if(raf) return;raf=requestAnimationFrame(function(){raf=0;if(O&&O.redraw)O.redraw();sync();});}
  function save(p){S.pref=p;LS.set(key(),p);}

  // ------------------------------------------------------------------ public: called by charts.js draw()
  Z.view=function(A,narrow){
    var cls=narrow?'narrow':'wide';
    S.A=Math.max(40,A);
    if(cls!==S.cls){S.cls=cls;S.pref=LS.get(key());S.count=0;}
    S.count=countFor(S.pref); clampOff();
    S.start=S.total-Math.round(S.offset)-S.count;
    if(S.start<0) S.start=0;
    return {start:S.start,n:S.count};
  };
  Z.geo=function(g){S.bw=g.bw;S.pl=g.pl;S.barsEnd=g.barsEnd;S.n=g.n;if(!ui.bar)return;var sig=[S.count,Math.round(S.offset),Math.round(S.A)].join();if(sig!==ui.sig){ui.sig=sig;sync();}};
  Z.state=function(){return {count:S.count,offset:Math.round(S.offset),total:S.total,px:+(S.A/Math.max(1,S.count)).toFixed(2),barPitch:+S.bw.toFixed(2),mode:S.cls,pref:S.pref};};

  // ------------------------------------------------------------------ actions
  function setCount(c,focalFrac,keepPreset){
    var old=S.count, nc=clampCount(c); if(!old||nc===old&&!keepPreset){return;}
    if(S.offset>=0.5&&focalFrac!=null){           // zoom around the focal bar; at the right edge stay anchored to the newest bar
      var f=Math.max(0,Math.min(1,focalFrac)), R=S.total-S.offset, F=R-(1-f)*old;
      S.offset=S.total-(F+(1-f)*nc);
    }
    S.count=nc; clampOff();
    if(!keepPreset) save({px:+(S.A/nc).toFixed(3)});
    kick();
  }
  function preset(name){S.offset=0;save({preset:name});S.count=countFor(S.pref);kick();}
  function pan(dBars){S.offset+=dBars;clampOff();kick();}
  function latest(){S.offset=0;kick();}
  function frac(clientX){var r=O.canvas.getBoundingClientRect();var w=Math.max(1,S.barsEnd-S.pl);return (clientX-r.left-S.pl)/w;}
  Z.tighter=function(){setCount(S.count*STEP);};
  Z.wider=function(){setCount(S.count/STEP);};
  Z.preset=preset; Z.latest=latest; Z.pan=pan;

  // ------------------------------------------------------------------ toolbar
  var CSS='.tcz{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:7px 8px;border:2px solid #3a2f8a;border-bottom:0;background:#0e0b2e;font-family:var(--tc-px,monospace);font-size:8px;color:#9b93d6;user-select:none;-webkit-user-select:none}'+
   '.tcz button{font:inherit;font-size:8px;color:#e9e4ff;background:#07061a;border:2px solid #6b5cff;min-height:32px;min-width:34px;padding:4px 8px;cursor:pointer;box-shadow:2px 2px 0 #000;touch-action:manipulation}'+
   '.tcz button:hover,.tcz button:focus-visible{border-color:#00e5ff;color:#00e5ff;outline:none}'+
   '.tcz button[aria-pressed=true]{background:#00e5ff;border-color:#00e5ff;color:#07061a}'+
   '.tcz button:disabled{opacity:.35;cursor:default}'+
   '.tcz .zg{display:flex;align-items:center;gap:6px;flex:1 1 260px;min-width:0}'+
   '.tcz .zg button.pm{font-size:12px;padding:2px 8px}.tcz .zg button .t{font-size:7px;margin-left:5px}'+
   '.tcz input[type=range]{flex:1;min-width:60px;accent-color:#00e5ff;height:28px;margin:0;touch-action:manipulation}'+
   '.tcz .pr{display:flex;gap:5px}.tcz .rd{margin-left:auto;white-space:nowrap;font-size:7px;line-height:1.5;text-align:right}.tcz .rd b{color:#e9e4ff;font-weight:400}'+
   '.tcz .lt{color:#ffd700;border-color:#ffd700}'+
   '.tc-canvas{cursor:grab}.tc-canvas.tcz-drag{cursor:grabbing}.tc-canvas:focus-visible{outline:2px solid #00e5ff;outline-offset:-2px}'+
   '@media (max-width:760px){.tcz{gap:6px}.tcz .zg{flex-basis:100%}.tcz .zg button .t{display:none}.tcz .pr{flex:1}.tcz .pr button{flex:1;padding:4px 2px}.tcz .rd{flex-basis:100%;text-align:left;margin-left:0}}';
  function prHtml(){return PRESETS.map(function(p){return '<button type="button" data-p="'+p[0]+'">'+p[0]+'</button>';}).join('')+
      '<button type="button" class="lt" data-z="latest" title="Jump back to the newest bar" aria-label="Jump to the newest bar">▶|</button>';}
  function build(){
    var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    var bar=document.createElement('div');bar.className='tcz';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Chart density and range');
    bar.innerHTML='<div class="zg"><button type="button" class="pm" data-z="tighter" title="Tighter: more bars (−)" aria-label="Tighter, show more bars">-<span class="t">TIGHTER</span></button>'+
      '<input type="range" min="0" max="1000" step="1" aria-label="Bar density: left shows more bars, right shows wider bars">'+
      '<button type="button" class="pm" data-z="wider" title="Wider: fewer, wider bars (+)" aria-label="Wider, show fewer wider bars">+<span class="t">WIDER</span></button></div>'+
      '<div class="pr" role="group" aria-label="Range presets">'+prHtml()+'</div>'+
      '<div class="rd" aria-live="polite"></div>';
    O.host.parentNode.insertBefore(bar,O.host);
    ui.bar=bar;ui.range=bar.querySelector('input');ui.rd=bar.querySelector('.rd');ui.lt=bar.querySelector('[data-z=latest]');
    bar.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
      var z=b.getAttribute('data-z'),p=b.getAttribute('data-p');
      if(p)preset(p);else if(z==='tighter')Z.tighter();else if(z==='wider')Z.wider();else if(z==='latest')latest();});
    ui.range.addEventListener('input',function(){
      var lo=Math.log(minCount()),hi=Math.log(Math.max(S.total,minCount()+1)),v=+ui.range.value/1000;
      setCount(Math.exp(hi+(lo-hi)*v));});
  }
  function sync(){
    if(!ui.bar||!S.count) return;
    var lo=Math.log(minCount()),hi=Math.log(Math.max(S.total,minCount()+1));
    if(document.activeElement!==ui.range) ui.range.value=String(Math.round((Math.log(S.count)-hi)/(lo-hi)*1000));
    ui.bar.querySelectorAll('[data-p]').forEach(function(b){var p=b.getAttribute('data-p'),on=S.pref&&S.pref.preset===p&&countFor(S.pref)===S.count;b.setAttribute('aria-pressed',String(!!on));});
    var off=Math.round(S.offset);ui.lt.disabled=off<1;
    var pitch=S.A/S.count, mo=S.count*(MPB[S.tf]||1/21);
    ui.rd.innerHTML='<b>'+S.count+'</b> OF '+S.total+' BARS · ≈'+(mo>=12?(mo/12).toFixed(1)+'Y':mo.toFixed(mo<10?1:0)+'M')+' · '+pitch.toFixed(1)+'PX/BAR'+(off?' · <b style="color:#ffd700">◀ '+off+' BACK</b>':'');
  }

  // ------------------------------------------------------------------ gestures
  function attach(){
    var cv=O.canvas, P={}, drag=null, pinch=null;
    cv.setAttribute('tabindex','0');
    function pts(){return Object.keys(P).map(function(k){return P[k];});}
    function startPinch(){var a=pts();if(a.length<2)return;var d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1;
      pinch={d0:d,c0:S.count,mx:(a[0].x+a[1].x)/2,off0:S.offset,f:frac((a[0].x+a[1].x)/2),bw0:S.bw};drag=null;Z.dragging=true;if(O.clearTip)O.clearTip();}
    cv.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse'&&e.button!==0) return;
      if(e.isPrimary){P={};pinch=null;}            // a new gesture: drop any pointer whose pointerup was missed
      P[e.pointerId]={x:e.clientX,y:e.clientY};
      if(pts().length===2){startPinch();return;}
      drag={x0:e.clientX,y0:e.clientY,off0:S.offset,moved:false,type:e.pointerType,id:e.pointerId};
      try{cv.setPointerCapture(e.pointerId);}catch(_){}
    });
    cv.addEventListener('pointermove',function(e){
      if(!P[e.pointerId]) return;
      P[e.pointerId]={x:e.clientX,y:e.clientY};
      if(pinch){var a=pts();if(a.length<2)return;var d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1,mx=(a[0].x+a[1].x)/2;
        var nc=clampCount(pinch.c0*pinch.d0/d);
        if(nc!==S.count){var anchored=pinch.off0<0.5;S.count=nc;
          if(!anchored){var R=S.total-pinch.off0,F=R-(1-pinch.f)*pinch.c0;S.offset=S.total-(F+(1-pinch.f)*nc);}
          save({px:+(S.A/nc).toFixed(3)});}
        if(pinch.off0>=0.5||S.offset>=0.5) S.offset+= (mx-pinch.mx)/Math.max(1,S.bw);
        pinch.mx=mx;clampOff();kick();e.preventDefault();return;}
      if(!drag) return;
      var dx=e.clientX-drag.x0,dy=e.clientY-drag.y0;
      if(!drag.moved){if(Math.abs(dx)<(drag.type==='mouse'?3:7)) return; if(drag.type!=='mouse'&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
        drag.moved=true;Z.dragging=true;cv.classList.add('tcz-drag');if(O.clearTip)O.clearTip();}
      S.offset=drag.off0+dx/Math.max(0.5,S.bw);clampOff();kick();
    });
    function end(e){
      var was=P[e.pointerId];delete P[e.pointerId];
      if(pinch){if(pts().length<2){pinch=null;drag=null;setTimeout(function(){Z.dragging=false;},0);}return;}
      if(drag&&drag.id===e.pointerId){
        if(!drag.moved&&e.type==='pointerup'&&drag.type!=='mouse'&&O.tap&&was) O.tap(e.clientX,e.clientY);   // tap = inspect bar
        drag=null;cv.classList.remove('tcz-drag');setTimeout(function(){Z.dragging=false;},0);
      }
    }
    cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
    cv.addEventListener('wheel',function(e){
      e.preventDefault();
      var dx=e.deltaX,dy=e.deltaY; if(e.deltaMode===1){dx*=16;dy*=16;}
      if(e.shiftKey&&!dx){dx=dy;dy=0;}
      if(Math.abs(dx)>Math.abs(dy)){pan(-dx/Math.max(0.5,S.bw));return;}
      var k=Math.exp(dy*(e.ctrlKey?0.01:0.0018));
      setCount(S.count*k,frac(e.clientX));
    },{passive:false});
    cv.addEventListener('dblclick',function(){latest();});
    // iOS Safari: keep a two-finger pinch (and a horizontal drag in progress) on the chart instead of zooming/scrolling the page
    cv.addEventListener('touchmove',function(e){if(e.touches.length>1||(drag&&drag.moved)||pinch)e.preventDefault();},{passive:false});
    cv.addEventListener('gesturestart',function(e){e.preventDefault();});
    cv.addEventListener('keydown',function(e){
      var k=e.key;
      if(k==='+'||k==='='){Z.wider();}else if(k==='-'||k==='_'){Z.tighter();}
      else if(k==='ArrowLeft'){pan(Math.max(1,Math.round(S.count/10)));}else if(k==='ArrowRight'){pan(-Math.max(1,Math.round(S.count/10)));}
      else if(k==='End'){latest();}else if(k==='Home'){pan(S.total);}else return;
      e.preventDefault();
    });
  }

  // opts: {host, canvas, total, redraw(), tap(clientX,clientY), clearTip()}
  Z.mount=function(opts){O=opts;S.total=opts.total;if(opts.tf&&PRE[opts.tf]){S.tf=opts.tf;PRESETS=PRE[S.tf];}build();attach();};
  Z.setTf=function(tf,total){if(!PRE[tf])tf='D';var ch=tf!==S.tf;S.tf=tf;PRESETS=PRE[tf];S.total=total;
    if(ch){S.offset=0;if(S.cls)S.pref=LS.get(key());if(ui.bar){ui.bar.querySelector('.pr').innerHTML=prHtml();ui.lt=ui.bar.querySelector('[data-z=latest]');}}
    if(S.cls)S.count=countFor(S.pref);clampOff();ui.sig='';kick();};
  window.TCZoom=Z;
})();
