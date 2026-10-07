/* rs_orbital.js - RELATIVE STRENGTH · ORBITAL (top of rs.html).
   Data:   data/rs_orbital.json (live view) + data/rs_orbital_replay.json (replay; loaded on first REPLAY tap), both written by
           research-tools/rs_orbital.py on every rs / daily / refresh run.  Desk RS calc, not IBD's official rating.
   Engine: Three.js r186, tree-shaken + vendored at assets/vendor/three-r186.orbital.min.js (MIT, no CDN).
   Encoding: ring = RS tier, sphere size = rank, orbit speed + trail length = rank change over 1D/1W/4W, radius in ring = rank inside the tier.
   HUD drawer: colours, presets, X/Y/Z stretch, tilt, sizes, speed, glow, TAILS, per-orbit panel (ring on/opacity, stocks on/off,
           planet size, FOCUS stretch by RS), BLACK HOLE (NOW / AUTO / frequency), camera; saved in localStorage ('rso.cfg.v1').
           SIM SPEED bar: 0.25-4x + FREEZE. Replay glides: eased Hermite (TRANSITION slider) with arc + overlap.
   Replay: real sessions only (whatever rating_history.json covers at build time), scrub / play / step, Top-50 entry/exit flashes,
           path trails, end-of-window summary.  Touch: drag = rotate, pinch = zoom, tap = select.
   SOLO ORBIT (7 Oct 2026): bar under the stage (ALL + one button per ring), tap a ring line / its label, or long-press a ring -> only that orbit
           and its planets stay (every other ring, planet, dust and label hidden). Clear: ALL / SHOW ALL / Esc / tap the same ring button or label.
           V-STRETCH slider (1-8x, continuous) spreads the solo orbit's planets vertically by rank (best at the top) + nudges overlapping tags apart.
           cfg.vs (stretch) + cfg.solo (last solo orbit) persist in localStorage ('rso.cfg.v1') and are restored on load.
   BLACK HOLE EVENTS (7 Oct 2026, reworked): every ~45-90 s (HUD: RARE / NORMAL / CHAOS, on/off, TRIGGER NOW, BLACK HOLE) a real-looking black hole
           (screen-space: black shadow, photon ring, rotating doppler accretion disk lensed over the top + under the bottom, glow halo; stars / dust / rings /
           planets near it are lensed in their vertex shaders) appears at one side and pulls the orbit LAYERS in - outer / low-RS layers first and hardest,
           elite layers resist and lag - then they come back in from the OPPOSITE side and settle (small overshoot) into their exact orbits.
           mode 'full' = whole system (1 in 3 random + BLACK HOLE button), 'part' = 1-2 outer layers (TRIGGER NOW). cfg.capOn / cfg.capFreq persist.
   prefers-reduced-motion: no auto motion (renders on interaction / replay steps).  No WebGL2 -> server-rendered static list. */
(function(){
'use strict';
window.RSO_UP=true;
var root=document.getElementById('rso'); if(!root) return;
function nogl(why){root.classList.add('nogl'); var l=root.querySelector('.rso-load'); if(l) l.remove(); if(why&&window.console) console.warn('rs_orbital: static list ('+why+')');}
var gl2=false; try{var tc=document.createElement('canvas'); gl2=!!(tc.getContext('webgl2'));}catch(e){}
if(!gl2){nogl('no WebGL2'); return;}
var src=root.getAttribute('data-src'), lib=root.getAttribute('data-three'), rpSrc=root.getAttribute('data-replay');
var libUrl; try{libUrl=new URL(lib,document.baseURI).href;}catch(e){libUrl=lib;}
Promise.all([fetch(src,{cache:'no-cache'}).then(function(r){if(!r.ok) throw new Error('data '+r.status); return r.json();}), import(libUrl)])
 .then(function(a){try{init(a[0],a[1]);}catch(e){nogl(e&&e.message); if(window.console) console.error(e);}})
 .catch(function(e){nogl(e&&e.message);});

function hex(c){c=String(c||'#000').replace('#','');if(c.length===3)c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];return [parseInt(c.substr(0,2),16)/255,parseInt(c.substr(2,2),16)/255,parseInt(c.substr(4,2),16)/255];}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function clamp(x,a,b){return x<a?a:x>b?b:x;}
function hash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%100000)/100000;}
function flat(a){var f=new Float32Array(a.length*3);a.forEach(function(c,i){f[i*3]=c[0];f[i*3+1]=c[1];f[i*3+2]=c[2];});return f;}
function sstep(x){x=clamp(x,0,1);return x*x*(3-2*x);}

// ------------------------------------------------------------------ config (HUD drawer), presets, persistence
var PRESETS={
  neon:   {name:'NEON',            c:['#ffd23f','#a8ff3e','#00e5ff','#b06bff','#ff2bd6'],beam:'#00e5ff',bg:'#03030d',tMode:'ring',  trailCol:'#ffffff'},
  mission:{name:'MISSION CONTROL', c:['#ffffff','#d6e6ff','#9cc2ff','#5b8cff','#3a5fc8'],beam:'#bfe0ff',bg:'#01040c',tMode:'custom',trailCol:'#7fb2ff'},
  mars:   {name:'MARS',            c:['#ffe2b0','#ffb066','#ff7a3d','#e04a2a','#b8392a'],beam:'#ff9a5a',bg:'#0c0302',tMode:'ring',  trailCol:'#ff8a4c'}};
var ORB0={on:true,ring:true,ringOp:1,size:1};
function newOrbs(){return [0,1,2,3,4].map(function(){return {on:ORB0.on,ring:ORB0.ring,ringOp:ORB0.ringOp,size:ORB0.size};});}
var DEF={theme:'neon',c:PRESETS.neon.c.slice(),beam:'#00e5ff',bg:'#03030d',trailCol:'#ffffff',
  sx:1,sz:1,sy:1,tilt:0,size:1,trail:1,speed:1,glow:1,auto:true,autoSpd:1,fov:38,sound:false,
  tOn:true,tMode:'ring',tStyle:'solid',tW:1,tOp:1,tFade:1.6,tGlow:1,gspd:1,glide:2,
  orb:newOrbs(),bhAuto:true,bhMin:3,bhMax:8,vs:1,solo:-1,capOn:true,capFreq:'normal'};
var KEY='rso.cfg.v1';
function loadCfg(){var c=JSON.parse(JSON.stringify(DEF));try{var s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object'){for(var k in DEF){if(s[k]!==undefined&&typeof s[k]===typeof DEF[k]) c[k]=s[k];}if(!Array.isArray(c.c)||c.c.length!==5) c.c=DEF.c.slice(); if(s.tMode===undefined&&s.trailTier===false) c.tMode='custom';
    if(Array.isArray(s.orb)&&s.orb.length===5){c.orb=s.orb.map(function(o){return {on:o&&o.on!==false,ring:o&&o.ring!==false,ringOp:clamp(+(o&&o.ringOp!=null?o.ringOp:1),0,1),size:clamp(+(o&&o.size!=null?o.size:1),0.3,3)};});}
    if(typeof s.bhAuto==='boolean') c.bhAuto=s.bhAuto; if(s.bhMin!=null) c.bhMin=+s.bhMin; if(s.bhMax!=null) c.bhMax=+s.bhMax;}}catch(e){}
  if(['ring','custom','delta'].indexOf(c.tMode)<0) c.tMode='ring'; if(['solid','dotted','sparkle'].indexOf(c.tStyle)<0) c.tStyle='solid';
  if(!Array.isArray(c.orb)||c.orb.length!==5) c.orb=newOrbs();
  c.gspd=clamp(c.gspd,0.1,4); c.glide=clamp(c.glide,0.6,4);
  c.vs=clamp(+c.vs||1,1,8); c.solo=Math.round(+c.solo); if(!(c.solo>=0&&c.solo<=4)) c.solo=-1;
  c.bhMin=clamp(c.bhMin||3,1,30); c.bhMax=clamp(Math.max(c.bhMax||8,c.bhMin),c.bhMin,60);
  if(['rare','normal','chaos'].indexOf(c.capFreq)<0) c.capFreq='normal';
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){c.bhAuto=false; c.capOn=false;}
  return c;}
var saveT=0; function saveCfg(cfg){clearTimeout(saveT);saveT=setTimeout(function(){try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch(e){}},250);}

// ------------------------------------------------------------------ subtle UI sounds (WebAudio, off by default)
var AC=null;
function snd(kind,cfg){if(!cfg.sound) return; try{AC=AC||new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended') AC.resume();
  var t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain(),f={click:[1400,1400,0.035,0.035,'triangle'],sel:[880,1320,0.09,0.05,'sine'],tick:[2600,2600,0.012,0.012,'square'],
    up:[660,990,0.12,0.045,'sine'],dn:[520,330,0.14,0.045,'sine'],play:[440,660,0.08,0.05,'triangle'],end:[523,784,0.35,0.05,'sine'],tog:[980,760,0.05,0.04,'triangle']}[kind]||[1000,1000,0.03,0.03,'sine'];
  o.type=f[4]; o.frequency.setValueAtTime(f[0],t); o.frequency.exponentialRampToValueAtTime(f[1],t+f[2]);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(kind==='tick'?0.008:f[3],t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+f[2]+0.04);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t+f[2]+0.06);}catch(e){}}

function init(D,THREE){
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cfg=loadCfg();
  var stage=root.querySelector('.rso-stage'), cv=root.querySelector('.rso-cv'), ov=root.querySelector('.rso-ov');
  var load=root.querySelector('.rso-load'); if(load) load.remove();
  var WIN=['1d','1w','4w'], WL={'1d':'1D','1w':'1W','4w':'4W'}, wi=1, climb=false;
  var R=3.0, LANES=[1.0,0.82,0.64], TIERS=D.tiers;
  var TC=cfg.c.map(hex), TDIM=[1,1,1,0.95,0.62];
  function tierY(ty){return (3.0-1.5*ty)*cfg.sy;}
  function coreY(){return tierY(0)+1.55;} function botY(){return tierY(4)-0.9;}
  function tierOf(rs){for(var t=0;t<TIERS.length;t++){if(rs>=TIERS[t].lo) return t;} return TIERS.length-1;}
  function rfrac(rank,N,t){var pr=99*(1-(rank-1)/Math.max(N,1)),lo=TIERS[t].lo,hi=TIERS[t].hi;return 0.6+0.4*clamp((pr-(lo-1))/(hi-lo+1),0,1);}
  var renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:false,powerPreference:'high-performance'});
  var PR=Math.min(window.devicePixelRatio||1,2); renderer.setPixelRatio(PR);
  var running=true;
  cv.addEventListener('webglcontextlost',function(e){e.preventDefault(); nogl('context lost'); running=false;});
  var scene=new THREE.Scene(), cam=new THREE.PerspectiveCamera(cfg.fov,1,0.1,400);
  var stars=new THREE.Group(), fixed=new THREE.Group(); scene.add(stars); scene.add(fixed);
  var U={uTime:{value:0},uScale:{value:600},uGlow:{value:cfg.glow},uBeam:{value:hex(cfg.beam)},
    // BLACK HOLE event (shared by every material): hole H, exit point E, swirl axis, uCG = (swirl, ref dist from H, ref dist from E, horizon radius),
    // uLens = (x, y, Einstein radius in drawing-buffer px, strength), uRes = drawing-buffer size
    uH:{value:new THREE.Vector3()},uE:{value:new THREE.Vector3()},uAx:{value:new THREE.Vector3(0,0,1)},uCG:{value:new Float32Array([0,1,1,1])},
    uLens:{value:new Float32Array(4)},uRes:{value:new Float32Array([1,1])}};
  var capU=[0,1,2,3,4].map(function(){return {cl:new Float32Array(4),cx:new Float32Array([1,0.6])};});   // per layer: (a, b, overshoot, phase), (swirl, lead)
  // point-mass lens on the projected vertex (primary image, tapered to 0 far from the hole)
  var LENS_GL='uniform vec4 uLens;uniform vec2 uRes;vec4 lensP(vec4 c){if(uLens.w<0.001||c.w<=0.0) return c;vec2 s=(c.xy/c.w*0.5+0.5)*uRes;vec2 d=s-uLens.xy;float b=length(d)+0.001;float tE=uLens.z;'+
    'float th=0.5*(b+sqrt(b*b+4.0*tE*tE));float nb=b+(th-b)*uLens.w*(1.0-smoothstep(4.0*tE,11.0*tE,b));c.xy=((uLens.xy+d*(nb/b))/uRes*2.0-1.0)*c.w;return c;}\n';
  // pull field (phase 1 in toward H, near parts lead + spiral; 2 back out from E with overshoot; 3 tidal tug). capD3() below is the JS twin.
  var CAP_GL='uniform vec3 uH;uniform vec3 uE;uniform vec3 uAx;uniform vec4 uCG;uniform vec4 uCL;uniform vec2 uCX;'+
    'vec3 capD(vec3 P){if(uCL.w<0.5) return P;bool o=uCL.w>1.5&&uCL.w<2.5;vec3 c=o?uE:uH;vec3 d=P-c;float n=min(1.0,length(d)/(o?uCG.z:uCG.y));float w;'+
    'if(uCL.w>2.5){w=uCL.x*(1.0-n)*(1.0-n);}else if(o){w=1.0-smoothstep(0.0,1.0,uCL.y*(1.0+uCX.y)-n*uCX.y)-uCL.z;}else{w=smoothstep(0.0,1.0,uCL.x*(1.0+uCX.y)-n*uCX.y);}'+
    'float th=(o?-1.0:1.0)*uCG.x*uCX.x*pow(max(w,0.0),2.0);float cs=cos(th),sn=sin(th);d=d*cs+cross(uAx,d)*sn+uAx*dot(uAx,d)*(1.0-cs);return c+d*(1.0-w);}'+
    'float capK(vec3 q){return (uCL.w<0.5||(uCL.w>1.5&&uCL.w<2.5))?1.0:smoothstep(0.0,1.0,(length(q-uH)/uCG.w-0.35)/0.75);}\n';
  var CH=U.uH.value, CE=U.uE.value, CX=U.uAx.value, CG=U.uCG.value;
  function capD3(A,o,L){var ph=L.ph; if(!ph) return 0; var out=ph===2, c=out?CE:CH, dx=A[o]-c.x, dy=A[o+1]-c.y, dz=A[o+2]-c.z, n=Math.min(1,Math.sqrt(dx*dx+dy*dy+dz*dz)/(out?CG[2]:CG[1])), w;
    if(ph===3) w=L.a*(1-n)*(1-n); else if(out) w=1-sstep(L.b*(1+L.lead)-n*L.lead)-L.osc; else w=sstep(L.a*(1+L.lead)-n*L.lead);
    var th=(out?-1:1)*CG[0]*L.sw*Math.pow(Math.max(w,0),2), cs=Math.cos(th), sn=Math.sin(th), kx=CX.x, ky=CX.y, kz=CX.z, kd=(kx*dx+ky*dy+kz*dz)*(1-cs), s=1-w;
    A[o]=c.x+(dx*cs+(ky*dz-kz*dy)*sn+kx*kd)*s; A[o+1]=c.y+(dy*cs+(kz*dx-kx*dz)*sn+ky*kd)*s; A[o+2]=c.z+(dz*cs+(kx*dy-ky*dx)*sn+kz*kd)*s; return w;}
  function capK3(A,o,L){if(!L.ph||L.ph===2) return 1; var dx=A[o]-CH.x, dy=A[o+1]-CH.y, dz=A[o+2]-CH.z; return sstep((Math.sqrt(dx*dx+dy*dy+dz*dz)/CG[3]-0.35)/0.75);}
  function mat(vs,fs,uni,blend){var u={};for(var k in U) u[k]=U[k];for(k in (uni||{})) u[k]=uni[k];
    return new THREE.ShaderMaterial({uniforms:u,vertexShader:vs,fragmentShader:fs,transparent:true,depthWrite:false,depthTest:false,blending:blend||THREE.AdditiveBlending,side:THREE.DoubleSide});}

  // ---------------------------------------------------------------- background (opaque canvas: theme colour + soft nebula)
  var bgU={uBg:{value:hex(cfg.bg)},uT1:{value:TC[2]},uT2:{value:TC[4]}};
  var bgM=mat('varying vec2 vU;void main(){vU=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    ['uniform vec3 uBg;uniform vec3 uT1;uniform vec3 uT2;uniform vec3 uBeam;varying vec2 vU;void main(){vec2 p=vU;',
     'float a=exp(-pow(length((p-vec2(0.5,0.78))*vec2(1.2,1.6)),2.0)*2.2)*0.16;float b=exp(-pow(length((p-vec2(0.85,0.12))*vec2(1.4,1.8)),2.0)*2.5)*0.12;',
     'float c=exp(-pow(length((p-vec2(0.08,0.45))*vec2(1.6,1.4)),2.0)*3.0)*0.08;',
     'gl_FragColor=vec4(uBg+uBeam*a*0.6+uT2*b+uT1*c,1.0);}'].join('\n'),bgU,THREE.NormalBlending);
  bgM.transparent=false; var bgQ=new THREE.Mesh(new THREE.PlaneGeometry(2,2),bgM); bgQ.frustumCulled=false; bgQ.renderOrder=-10; scene.add(bgQ);

  // ---------------------------------------------------------------- starfield
  (function(){var n=1300,P=new Float32Array(n*3),S=new Float32Array(n),C=new Float32Array(n*3),Ph=new Float32Array(n);
    for(var i=0;i<n;i++){var u=Math.random()*2-1,th=Math.random()*6.2832,rr=60+Math.random()*60,q=Math.sqrt(1-u*u);
      P[i*3]=Math.cos(th)*q*rr;P[i*3+1]=u*rr*0.8;P[i*3+2]=Math.sin(th)*q*rr;
      S[i]=(Math.random()<0.08?2.4:0.9+Math.random()*1.2); Ph[i]=Math.random()*6.28;
      var k=Math.random(), c=k<0.6?[0.75,0.85,1]:k<0.85?[0.6,0.9,1]:[1,0.75,0.95]; var b=0.3+Math.random()*0.6;
      C[i*3]=c[0]*b;C[i*3+1]=c[1]*b;C[i*3+2]=c[2]*b;}
    var g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(P,3)); g.setAttribute('aS',new THREE.BufferAttribute(S,1));
    g.setAttribute('aC',new THREE.BufferAttribute(C,3)); g.setAttribute('aPh',new THREE.BufferAttribute(Ph,1));
    var m=mat(LENS_GL+'attribute float aS;attribute vec3 aC;attribute float aPh;uniform float uTime;uniform float uPR;varying vec3 vC;'+
      'void main(){vC=aC*(0.65+0.35*sin(uTime*(0.6+aPh*0.25)+aPh*7.0));gl_PointSize=aS*uPR;gl_Position=lensP(projectionMatrix*modelViewMatrix*vec4(position,1.0));}',
      'varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*exp(-r*3.5),1.0);}',{uPR:{value:PR}});
    var pts=new THREE.Points(g,m); pts.frustumCulled=false; stars.add(pts);})();

  // ---------------------------------------------------------------- rings (tierG: y + stretch -> tiltG: tilt -> spinG: yaw)
  var ringMats=[], tierG=[], tiltG=[], spinG=[], dustMats=[], dustAttr=[];
  var RING_VS=LENS_GL+CAP_GL+'varying vec2 vP;varying float vK;void main(){vP=position.xz;vec4 wp=modelMatrix*vec4(position,1.0);vec3 q=capD(wp.xyz);vK=capK(q);gl_Position=lensP(projectionMatrix*viewMatrix*vec4(q,1.0));}';
  var RING_FS=['uniform vec3 uColor;uniform float uR;uniform float uTime;uniform float uDim;uniform float uGlow;varying vec2 vP;varying float vK;',
    'float ln(float x,float c,float w,float fw){return 1.0-smoothstep(w,w+fw*1.6,abs(x-c));}',
    'void main(){float r=length(vP);float a=atan(vP.y,vP.x);float fw=fwidth(r);',
    ' float core=ln(r,uR,0.012,fw);',
    ' float glow=(exp(-pow((r-uR)/0.10,2.0))*0.42+exp(-pow((r-uR)/0.32,2.0))*0.12)*uGlow;',
    ' float lanes=0.0;',
    ' for(int k=1;k<3;k++){float f=k==1?0.82:0.64;float rr=uR*f;float d=step(0.46,fract(a*rr*7.0/6.2832));',
    '   lanes+=ln(r,rr,0.005,fw)*d*0.55+exp(-pow((r-rr)/0.05,2.0))*0.05*uGlow;}',
    ' float outer=ln(r,uR*1.065,0.003,fw)*0.32;',
    ' float tk=step(fract(a*72.0/6.2832),0.08)*step(uR*1.095,r)*step(r,uR*1.13)*0.4+step(fract(a*8.0/6.2832),0.012)*step(uR*1.09,r)*step(r,uR*1.17)*0.6;',
    ' float fill=smoothstep(uR*0.42,uR,r)*(1.0-smoothstep(uR,uR*1.02,r))*0.025;',
    ' float sw=0.62+0.38*pow(0.5+0.5*cos(a-uTime*0.45),3.0);',
    ' float I=(core*1.15+glow)*sw+lanes+outer+tk+fill;',
    ' vec3 col=uColor*I+vec3(1.0)*core*0.35*sw;',
    ' gl_FragColor=vec4(col*uDim*vK,1.0);}'].join('\n');
  var DUST_VS=LENS_GL+CAP_GL+'attribute float aR;attribute float aA;attribute float aY;attribute float aSp;attribute float aS;attribute float aB;uniform float uTime;uniform float uScale;uniform float uDim;uniform vec3 uColor;varying vec3 vC;'+
    'void main(){float an=aA+uTime*aSp;vec4 wp=modelMatrix*vec4(cos(an)*aR,aY,sin(an)*aR,1.0);vec3 q=capD(wp.xyz);vec4 mv=viewMatrix*vec4(q,1.0);gl_PointSize=max(1.5,aS*uScale/(-mv.z));vC=uColor*aB*uDim*capK(q);gl_Position=lensP(projectionMatrix*mv);}';
  var DUST_FS='varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*exp(-r*2.5),1.0);}';
  TIERS.forEach(function(T,t){
    var a=new THREE.Group(), b=new THREE.Group(), c=new THREE.Group(); a.add(b); b.add(c); scene.add(a); tierG.push(a); tiltG.push(b); spinG.push(c);
    var g=new THREE.RingGeometry(R*0.45,R*1.2,192,4); g.rotateX(-Math.PI/2);
    var m=mat(RING_VS,RING_FS,{uColor:{value:TC[t]},uR:{value:R},uDim:{value:TDIM[t]},uCL:{value:capU[t].cl},uCX:{value:capU[t].cx}});
    ringMats.push(m); var me=new THREE.Mesh(g,m); me.frustumCulled=false; c.add(me);
    var n=Math.min(T.dust,1200), Rr=new Float32Array(n),A=new Float32Array(n),Y=new Float32Array(n),Sp=new Float32Array(n),S=new Float32Array(n),Bb=new Float32Array(n);
    for(var j=0;j<n;j++){var l=LANES[Math.floor(Math.random()*3)]; Rr[j]=R*(l+(Math.random()-0.5)*0.16+(Math.random()<0.25?(Math.random()-0.5)*0.4:0));
      A[j]=Math.random()*6.2832; Y[j]=(Math.random()-0.5)*0.07; Sp[j]=0.03+Math.random()*0.05; S[j]=0.03+Math.random()*0.035; Bb[j]=(0.2+Math.random()*0.28)*TDIM[t];}
    var dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(Math.max(n,1)*3),3));
    [['aR',Rr],['aA',A],['aY',Y],['aSp',Sp],['aS',S],['aB',Bb]].forEach(function(x){dg.setAttribute(x[0],new THREE.BufferAttribute(x[1],1));});
    var dm=mat(DUST_VS,DUST_FS,{uDim:{value:1},uColor:{value:TC[t]},uCL:{value:capU[t].cl},uCX:{value:capU[t].cx}}); dustMats.push(dm);
    if(n){var dp=new THREE.Points(dg,dm); dp.frustumCulled=false; c.add(dp);}});

  // ---------------------------------------------------------------- axis beam + ring nodes + AI core
  var beam,nodeG,core,retic,torus;
  (function(){var g=new THREE.PlaneGeometry(1.0,1.0,1,1);
    var m=mat('varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      ['uniform float uTime;uniform vec3 uBeam;uniform float uGlow;varying vec2 vU;void main(){float x=(vU.x-0.5);float y=vU.y;',
       'float core=exp(-x*x/0.00012)*1.0+(exp(-x*x/0.0022)*0.42+exp(-x*x/0.03)*0.12)*uGlow;',
       'float fade=smoothstep(0.0,0.12,y)*(0.55+0.45*y);',
       'float pu=pow(fract(y*2.6-uTime*0.32),22.0)*exp(-x*x/0.002)*1.3;',
       'vec3 c=uBeam*(core*fade+pu*fade)+vec3(1.0)*exp(-x*x/0.00005)*0.45*fade;',
       'gl_FragColor=vec4(c,1.0);}'].join('\n'));
    beam=new THREE.Mesh(g,m); beam.frustumCulled=false; fixed.add(beam);
    var n=TIERS.length+1,P=new Float32Array(n*3),S=new Float32Array(n),T=new Float32Array(n);
    for(var t=0;t<n;t++){S[t]=t<n-1?0.5:3.4;T[t]=t<n-1?t:-1;}
    var gg=new THREE.BufferGeometry(); gg.setAttribute('position',new THREE.BufferAttribute(P,3)); gg.setAttribute('aS',new THREE.BufferAttribute(S,1)); gg.setAttribute('aT',new THREE.BufferAttribute(T,1));
    var mm=mat('attribute float aS;attribute float aT;uniform float uScale;uniform vec3 uBeam;uniform vec3 uTC[5];varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aS*uScale/(-mv.z);'+
      'vC=aT<0.0?uBeam*0.16:(0.5*uTC[int(aT)]+0.5*vec3(1.0));gl_Position=projectionMatrix*mv;}',
      'uniform float uGlow;varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*(exp(-r*9.0)*0.8+exp(-r*3.0)*0.3*uGlow)*(1.0-r),1.0);}',{uTC:{value:flat(TC)}});
    nodeG=new THREE.Points(gg,mm); nodeG.frustumCulled=false; fixed.add(nodeG);
    var sm=mat('varying vec3 vN;varying vec2 vU;void main(){vU=uv;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      ['uniform float uTime;uniform vec3 uBeam;varying vec3 vN;varying vec2 vU;void main(){float f=pow(1.0-abs(vN.z),2.2);',
       'float la=smoothstep(0.9,0.97,abs(fract(vU.y*9.0)-0.5)*2.0);float lo=smoothstep(0.92,0.98,abs(fract(vU.x*18.0+uTime*0.03)-0.5)*2.0);',
       'float grid=max(la,lo)*0.45*(gl_FrontFacing?1.0:0.25);',
       'vec3 c=uBeam*(0.035+f*1.15+grid)+vec3(1.0)*pow(f,5.0)*0.4;gl_FragColor=vec4(c,1.0);}'].join('\n'));
    core=new THREE.Mesh(new THREE.SphereGeometry(0.6,48,32),sm); fixed.add(core);
    var rm=mat('varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      ['uniform float uTime;uniform vec3 uBeam;varying vec2 vU;float ln(float x,float c,float w){return 1.0-smoothstep(w*0.5,w,abs(x-c));}',
       'void main(){vec2 p=vU*2.0-1.0;float r=length(p);if(r>1.0)discard;float a=atan(p.y,p.x);',
       'float c=ln(r,0.16,0.025)*0.8+ln(r,0.34,0.02)*0.5+ln(r,0.62,0.016)*0.45*step(0.35,fract(a*3.0/6.2832+uTime*0.05));',
       'c+=ln(r,0.84,0.014)*step(fract(a*48.0/6.2832-uTime*0.12),0.16)*0.6;',
       'c+=exp(-r*r*120.0)*1.5;',
       'c+=ln(abs(p.x),0.0,0.01)*step(r,0.95)*step(0.42,r)*0.3+ln(abs(p.y),0.0,0.01)*step(r,0.95)*step(0.42,r)*0.3;',
       'gl_FragColor=vec4(mix(uBeam,vec3(1.0),0.25)*c,1.0);}'].join('\n'));
    retic=new THREE.Mesh(new THREE.PlaneGeometry(1.25,1.25),rm); fixed.add(retic);
    var tm=mat('void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}','uniform vec3 uBeam;void main(){gl_FragColor=vec4(uBeam*0.8,1.0);}');
    torus=new THREE.Mesh(new THREE.TorusGeometry(0.98,0.009,6,120),tm); torus.rotation.x=Math.PI/2-0.22; torus.rotation.z=0.12; fixed.add(torus);})();
  function layoutFixed(){var cy=coreY(),by=botY(); beam.scale.y=cy-by; beam.position.y=(cy+by)/2; core.position.y=retic.position.y=torus.position.y=cy;
    var P=nodeG.geometry.attributes.position.array; for(var t=0;t<TIERS.length;t++){P[t*3+1]=tierY(t);} P[TIERS.length*3+1]=cy; nodeG.geometry.attributes.position.needsUpdate=true;
    TIERS.forEach(function(_,t){tierG[t].position.y=tierY(t); tierG[t].scale.set(cfg.sx,1,cfg.sz); tiltG[t].rotation.z=cfg.tilt*Math.PI/180;});}

  // ---------------------------------------------------------------- spheres (live roster + replay extras), trails, paths, bursts
  var S=D.s, N=S.length, XC=200, M=N+XC, K=24, PK=64, lnU=Math.log(Math.max(D.universe,2));
  var ang=new Float32Array(M),rf=new Float32Array(M),ty=new Float32Array(M),om=new Float32Array(M),omT=new Float32Array(M),jit=new Float32Array(M);
  var dia=new Float32Array(M),al=new Float32Array(M),alT=new Float32Array(M),sm=new Float32Array(M),smT=new Float32Array(M),fl=new Float32Array(M),flS=new Float32Array(M),grp=new Int8Array(M);
  var info=[], byT={}, Mact=N;
  S.forEach(function(s,i){byT[s.t]=i; info[i]={t:s.t,n:s.n,ind:s.ind,g:s.g,k:s.k,rs:s.rs,tt:s.tt,h:s.h,c:s.c,p:s.p,m:s.m};
    jit[i]=(hash(s.t)-0.5)*0.05; grp[i]=s.g; ty[i]=s.g; rf[i]=rfrac(s.k,D.universe,s.g)+jit[i]; ang[i]=hash(s.t+'a')*6.2832;
    dia[i]=0.1+0.29*Math.max(0,1-Math.log(s.k)/lnU); al[i]=alT[i]=1; sm[i]=smT[i]=1;});
  var BASE=0.2;
  // SOLO V-STRETCH: each live sphere gets a vertical slot in its ring, ordered by rank (best on top), -1..1
  var vslot=new Float32Array(M);
  function VSUf(){return 0.46*clamp(H/W,1,1.8);}   // world units per 1x of stretch; portrait phones get more (they have spare height)
  (function(){for(var g=0;g<TIERS.length;g++){var L=[];for(var i=0;i<N;i++){if(S[i].g===g) L.push(i);} L.sort(function(a,b){return S[a].k-S[b].k;});
    L.forEach(function(i,j){vslot[i]=L.length>1?1-2*j/(L.length-1):0;});}})();
  function omega(i){if(i>=N) return BASE*0.6; var m=info[i].m[wi]; return BASE*(m>=0?1+1.6*m:1+0.78*m);}
  for(var i0=0;i0<N;i0++){om[i0]=omT[i0]=omega(i0);}
  function buf(n,k){return new THREE.BufferAttribute(new Float32Array(n*k),k);}
  var sg=new THREE.BufferGeometry(); sg.setAttribute('position',buf(M,3)); sg.setAttribute('aS',buf(M,1)); sg.setAttribute('aC',buf(M,3)); sg.setAttribute('aF',buf(M,1));
  var sP=sg.attributes.position.array,sS=sg.attributes.aS.array,sC=sg.attributes.aC.array,sF=sg.attributes.aF.array;
  var sMat=mat(LENS_GL+'attribute float aS;attribute vec3 aC;attribute float aF;uniform float uScale;varying vec3 vC;varying float vF;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aS*2.3*uScale/(-mv.z);vC=aC;vF=aF;gl_Position=lensP(projectionMatrix*mv);}',
    ['uniform float uGlow;varying vec3 vC;varying float vF;void main(){vec2 p=gl_PointCoord*2.0-1.0;p.y=-p.y;float r=length(p);if(r>1.0)discard;float rc=0.435;vec3 c=vec3(0.0);',
     'float lum=max(vC.r,max(vC.g,vC.b));vec3 hue=lum>0.0?vC/lum:vC;hue=mix(hue,vec3(1.0),clamp(vF,0.0,1.0)*0.7);',
     'if(r<rc){vec2 q=p/rc;vec3 n=vec3(q,sqrt(max(0.0,1.0-dot(q,q))));vec3 L=normalize(vec3(-0.45,0.55,0.7));',
     ' float df=max(dot(n,L),0.0);float spc=pow(max(dot(reflect(-L,n),vec3(0.0,0.0,1.0)),0.0),24.0);float rim=pow(1.0-n.z,2.2);',
     ' c=(hue*(0.16+0.9*df)+hue*rim*0.8+vec3(1.0)*spc*0.8)*smoothstep(rc,rc-0.05,r)*lum;}',
     'float h=pow(1.0-smoothstep(rc*0.75,1.0,r),2.8)*0.28*uGlow;c+=hue*lum*h*(1.0+vF*2.0);gl_FragColor=vec4(c,1.0);}'].join('\n'));
  var sPts=new THREE.Points(sg,sMat); sPts.frustumCulled=false;
  var tg=new THREE.BufferGeometry(); tg.setAttribute('position',buf(M*K,3)); tg.setAttribute('aS',buf(M*K,1)); tg.setAttribute('aC',buf(M*K,3));
  (function(){var F=new Float32Array(M*K),J=new Float32Array(M*K*3),Ph=new Float32Array(M*K);
    for(var j=0;j<M*K;j++){F[j]=(j%K)/(K-1); var u=Math.random()*2-1,th=Math.random()*6.2832,q=Math.sqrt(1-u*u); J[j*3]=Math.cos(th)*q;J[j*3+1]=u;J[j*3+2]=Math.sin(th)*q; Ph[j]=Math.random();}
    tg.setAttribute('aF',new THREE.BufferAttribute(F,1)); tg.setAttribute('aJ',new THREE.BufferAttribute(J,3)); tg.setAttribute('aPh',new THREE.BufferAttribute(Ph,1));})();
  var tP=tg.attributes.position.array,tS=tg.attributes.aS.array,tC=tg.attributes.aC.array;
  // TAILS: uMode 1 = dotted (crisp beads), 2 = particle sparkle (jittered, twinkling star points); solid = ribbon below
  var TU={uMode:{value:1},uTG:{value:cfg.tGlow}};
  var tMat=mat(LENS_GL+'attribute float aS;attribute vec3 aC;attribute float aF;attribute vec3 aJ;attribute float aPh;uniform float uScale;uniform float uTime;uniform float uMode;varying vec3 vC;varying float vM;'+
    'void main(){vec3 p=position;float sp=step(1.5,uMode);float w=uTime*(1.2+aPh*2.0)+aPh*40.0;p+=(aJ*cos(w)+aJ.zxy*sin(w))*aS*(0.25+1.6*aF)*sp;'+
    'vec4 mv=modelViewMatrix*vec4(p,1.0);float s=mix(1.0,0.35+1.1*fract(aPh*13.7),sp);gl_PointSize=max(1.0,aS*s*uScale/(-mv.z));'+
    'float tw=mix(1.0,0.25+0.95*pow(0.5+0.5*sin(uTime*(5.0+aPh*6.0)+aPh*30.0),3.0),sp);vC=aC*tw;vM=sp;gl_Position=lensP(projectionMatrix*mv);}',
    'uniform float uTG;varying vec3 vC;varying float vM;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r2=dot(p,p);if(r2>1.0)discard;'+
    'float bd=(1.0-smoothstep(0.30,0.48,r2))*0.95+exp(-r2*3.0)*0.45*uTG;'+
    'float st=exp(-r2*16.0)*1.3+(exp(-abs(p.x)*16.0)*exp(-abs(p.y)*2.2)+exp(-abs(p.y)*16.0)*exp(-abs(p.x)*2.2))*0.55*(0.4+0.6*uTG)+exp(-r2*4.0)*0.25*uTG;'+
    'float I=mix(bd,st,vM);vec3 c=mix(vC,vec3(max(vC.r,max(vC.g,vC.b))),0.3*vM);gl_FragColor=vec4(c*I,1.0);}',TU);
  var tPts=new THREE.Points(tg,tMat); tPts.frustumCulled=false;
  var RV=M*K*2, rg=new THREE.BufferGeometry(); rg.setAttribute('position',buf(RV,3)); rg.setAttribute('aC',buf(RV,3));
  (function(){var V=new Float32Array(RV),I=new Uint16Array(M*(K-1)*6),n=0; for(var j=0;j<RV;j++) V[j]=(j%2)?-1:1;
    for(var i=0;i<M;i++){for(var k=0;k<K-1;k++){var a=(i*K+k)*2; I[n++]=a;I[n++]=a+1;I[n++]=a+2;I[n++]=a+1;I[n++]=a+3;I[n++]=a+2;}}
    rg.setAttribute('aV',new THREE.BufferAttribute(V,1)); rg.setIndex(new THREE.BufferAttribute(I,1));})();
  var rP=rg.attributes.position.array, rC=rg.attributes.aC.array;
  var rMesh=new THREE.Mesh(rg,mat(LENS_GL+'attribute vec3 aC;attribute float aV;varying vec3 vC;varying float vV;void main(){vC=aC;vV=aV;gl_Position=lensP(projectionMatrix*modelViewMatrix*vec4(position,1.0));}',
    'uniform float uTG;varying vec3 vC;varying float vV;void main(){float v=vV*vV;float I=exp(-v*7.0)*(0.75+0.2*uTG)+exp(-v*2.2)*0.5*uTG;gl_FragColor=vec4(vC*I,1.0);}',TU)); rMesh.frustumCulled=false;
  var LINE_VS='attribute vec3 aC;varying vec3 vC;void main(){vC=aC;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', LINE_FS='varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.0);}';
  var PS=PK*2, pg=new THREE.BufferGeometry(); pg.setAttribute('position',buf(M*PS,3)); pg.setAttribute('aC',buf(M*PS,3));
  var pP=pg.attributes.position.array,pC=pg.attributes.aC.array;
  var pSeg=new THREE.LineSegments(pg,mat(LINE_VS,LINE_FS)); pSeg.frustumCulled=false; pSeg.visible=false;
  var bg2=new THREE.BufferGeometry(); bg2.setAttribute('position',buf(M,3)); bg2.setAttribute('aS',buf(M,1)); bg2.setAttribute('aC',buf(M,3));
  var bP=bg2.attributes.position.array,bS=bg2.attributes.aS.array,bC=bg2.attributes.aC.array;
  var bPts=new THREE.Points(bg2,mat(LENS_GL+'attribute float aS;attribute vec3 aC;uniform float uScale;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aS*uScale/(-mv.z);vC=aC;gl_Position=lensP(projectionMatrix*mv);}',
    'varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=length(p);if(r>1.0)discard;float ring=exp(-pow((r-0.8)/0.07,2.0))+exp(-pow((r-0.55)/0.04,2.0))*0.4;gl_FragColor=vec4(vC*ring,1.0);}'));
  bPts.frustumCulled=false;
  scene.add(pSeg); scene.add(rMesh); scene.add(tPts); scene.add(sPts); scene.add(bPts);
  var sel=-1, yaw=0.5, pitch=0.34, zoom=1;
  // opened tier: op.t = tier (-1 none), op.k = 0..1 animation, op.E = ring stretch (slider / pinch)
  var op={t:-1,k:0,target:0,E:1.35,focus:false}, PITCH_O=0.8, ea=new Float32Array(M);
  var bh={on:false,k:0,phase:0,dur:10,t:0,x:0,y:0,z:0,next:1e18,arm:function(){},trigger:function(){}};
  function tsc(t){if(op.t<0) return 1; return t===op.t?1+(op.E-1)*op.k:1-0.55*op.k;}
  function vsF(){return (cfg.vs-1)/7;}                       // 0..1 stretch fraction
  function yOff(i,tI){return op.t>=0&&tI===op.t&&!rp.on&&i<N?vslot[i]*VSUf()*(cfg.vs-1)*sstep(op.k):0;}
  function pitchOpen(){return PITCH_O-0.3*vsF();}             // lower the camera a little as the stretch grows
  function orbOn(t){t=clamp(t,0,4); return cfg.orb[t].on;}
  function rsFrac(rs,t){var lo=TIERS[t].lo,hi=TIERS[t].hi; return 0.55+0.85*clamp((rs-lo)/Math.max(1,hi-lo),0,1);}
  var cY=1,sY=0,cT=1,sT=0;
  function W3(rf_,ty_,a,o,arr){var tt=ty_<0.5?0:ty_>3.5?4:Math.round(ty_); if(op.t>=0&&tt===op.t) rf_+=(0.3+(rf_-0.6)*1.75-rf_)*op.k; var r=R*rf_*tsc(tt),x=Math.cos(a)*r,z=Math.sin(a)*r,x1=x*cY+z*sY,z1=-x*sY+z*cY;arr[o]=x1*cT*cfg.sx;arr[o+1]=x1*sT+tierY(ty_);arr[o+2]=z1*cfg.sz;}
  function colOf(i){var g=grp[i];return TC[g<0?0:g];}
  var trailRGB=hex(cfg.trailCol);

  // ---------------------------------------------------------------- replay state
  var RP=null, rp={on:false,d0:0,d1:0,p:0,play:false,spd:1,paths:false,win:'1m',lastDay:-1,events:[],done:false,gu:5,gm:'jump',gday:-1,sumP:false};
  var frozen=false;
  var RW=[['1w','1W',5],['1m','1M',21],['3m','3M',63],['6m','6M',126],['max','MAX',1e9]];
  function rpState(i,d){var v=RP.v[i*RP.nd+d]; if(v<0) return null; var rk=Math.floor(v/100), rs=v%100;
    var vis=i<N||rk<=50; return vis?{rk:rk,rs:rs,g:tierOf(rs),N:RP.N[d]}:null;}
  function rpPose(i,p,out){var a=Math.floor(p),b=Math.min(a+1,rp.d1),f=sstep(p-a),A=rpState(i,a),B=b===a?A:rpState(i,b);
    if(!A&&!B){out.a=0;return out;}
    var X=A||B, Y=B||A, rfA=rfrac(X.rk,X.N,X.g)+jit[i], rfB=rfrac(Y.rk,Y.N,Y.g)+jit[i];
    out.ty=X.g+(Y.g-X.g)*f; out.rf=rfA+(rfB-rfA)*f; var lk=Math.log(X.rk)+(Math.log(Y.rk)-Math.log(X.rk))*f; out.lk=lk; out.dia=0.1+0.29*Math.max(0,1-lk/lnU);
    out.a=A&&B?1:A?1-f:f; out.g=f<0.5?X.g:Y.g; return out;}
  var pose={a:0,ty:0,rf:0,dia:0,g:0,lk:0};
  function curDay(){return clamp(Math.floor(rp.p+1e-6),rp.d0,rp.d1);}
  // ---- glide engine: every sphere holds a cubic Hermite (p0, tangent m0 -> p1, zero end velocity) over [rf, ty, ln rank] + an arc
  //      bump sin^2(pi u). All spheres share progress rp.gu (0..1; keeps counting past 1 so tails can settle). Retargeting mid-glide
  //      starts from the displayed pose with the displayed velocity, so steps that overlap (or a fast scrub) never snap.
  var G0=new Float32Array(M*3),GM=new Float32Array(M*3),G1=new Float32Array(M*3),GA=new Float32Array(M*2),rpChg=new Float32Array(M),rpFirst=new Float32Array(M);
  var gq={rf:0,ty:0,lk:0},gq2={rf:0,ty:0,lk:0},gc_={rf:0,ty:0,lk:0},gd_={rf:0,ty:0,lk:0},gt_={rf:0,ty:0,lk:0};
  function gEval(i,u,o){u=u<0?0:u>1?1:u; var u2=u*u,u3=u2*u,h0=2*u3-3*u2+1,h1=u3-2*u2+u,h2=3*u2-2*u3,b=i*3,sn=Math.sin(Math.PI*u),bp=sn*sn;
    o.rf=h0*G0[b]+h1*GM[b]+h2*G1[b]+GA[i*2]*bp; o.ty=h0*G0[b+1]+h1*GM[b+1]+h2*G1[b+1]+GA[i*2+1]*bp; o.lk=h0*G0[b+2]+h1*GM[b+2]+h2*G1[b+2]; return o;}
  function gDer(i,u,o){u=u<0?0:u>1?1:u; var d0=6*u*u-6*u,d1=3*u*u-4*u+1,b=i*3,db=Math.PI*Math.sin(2*Math.PI*u);
    o.rf=d0*(G0[b]-G1[b])+d1*GM[b]+GA[i*2]*db; o.ty=d0*(G0[b+1]-G1[b+1])+d1*GM[b+1]+GA[i*2+1]*db; o.lk=d0*(G0[b+2]-G1[b+2])+d1*GM[b+2]; return o;}
  // glide progress per real second. Day glides last 1.2 x the day period (20% overlap); 'step' ignores FREEZE so a manual step still moves.
  function effRate(m){m=m||rp.gm; if(m==='scrub') return 1/0.22; if(m==='jump') return 1; var g=(m==='step'?cfg.gspd:(frozen?0:cfg.gspd))*rp.spd; return g/(cfg.glide*1.2);}
  function gRetarget(mode,fn){var u=Math.min(rp.gu,1), moving=rp.gu<1, r0=effRate(rp.gm), r1=effRate(mode), ratio=moving&&r1>0?r0/r1:0;
    for(var i=0;i<Mact;i++){var b=i*3; gEval(i,u,gc_); if(moving) gDer(i,u,gd_); else {gd_.rf=gd_.ty=gd_.lk=0;}
      var A=fn(i,gt_); if(A<=0){gt_.rf=gc_.rf;gt_.ty=gc_.ty;gt_.lk=gc_.lk;}
      var fresh=al[i]<0.03&&A>0;
      if(fresh){G0[b]=gt_.rf;G0[b+1]=gt_.ty;G0[b+2]=gt_.lk;GM[b]=GM[b+1]=GM[b+2]=0;}
      else{G0[b]=gc_.rf;G0[b+1]=gc_.ty;G0[b+2]=gc_.lk; GM[b]=clamp(gd_.rf*ratio,-1,1);GM[b+1]=clamp(gd_.ty*ratio,-2,2);GM[b+2]=clamp(gd_.lk*ratio,-3,3);}
      G1[b]=gt_.rf;G1[b+1]=gt_.ty;G1[b+2]=gt_.lk;
      var dT=Math.abs(G1[b+1]-G0[b+1]), dR=Math.abs(G1[b]-G0[b]);
      GA[i*2]=fresh||mode==='scrub'?0:Math.min(0.22,0.09*dT); GA[i*2+1]=fresh||mode==='scrub'?0:-Math.min(0.14,0.35*dR)*(dT<0.5?1:0.3);
      alT[i]=Math.max(0,A); if(RM) al[i]=alT[i];}
    rp.gm=mode; rp.gu=RM?1:0;}
  function rkChg(i,rk){if(rpFirst[i]>0) rpChg[i]=Math.tanh(Math.log(rpFirst[i]/rk)/0.7);}
  function dayFn(d){return function(i,o){var st=rpState(i,d); if(!st) return 0; o.rf=rfrac(st.rk,st.N,st.g)+jit[i]; o.ty=st.g; o.lk=Math.log(st.rk); rkChg(i,st.rk); return 1;};}
  function fracFn(p){return function(i,o){rpPose(i,p,pose); if(pose.a<=0) return 0; o.rf=pose.rf;o.ty=pose.ty;o.lk=pose.lk; var st=rpState(i,Math.floor(p+1e-6)); if(st) rkChg(i,st.rk); return pose.a;};}
  function gJump(d){var fn=dayFn(d); for(var i=0;i<Mact;i++){var b=i*3,A=fn(i,gt_); if(A<=0){gt_.rf=rf[i];gt_.ty=ty[i];gt_.lk=Math.log(Math.max(1,info[i].k||1));}
      G0[b]=G1[b]=gt_.rf;G0[b+1]=G1[b+1]=gt_.ty;G0[b+2]=G1[b+2]=gt_.lk;GM[b]=GM[b+1]=GM[b+2]=0;GA[i*2]=GA[i*2+1]=0; alT[i]=al[i]=A;}
    rp.gm='jump'; rp.gu=5; rp.gday=d;}
  function firstRanks(){for(var i=0;i<Mact;i++){rpFirst[i]=0; rpChg[i]=0; for(var d=rp.d0;d<=rp.d1;d++){var st=rpState(i,d); if(st){rpFirst[i]=st.rk;break;}}}}

  var TMC=[hex('#ff3d5a'),hex('#8a7432'),hex('#3dff8a')], ccol=[0,0,0], dcl=[0,0,0], camP=new THREE.Vector3();
  function dcol(m,o){m=clamp(m,-1,1); var e=m<0?TMC[0]:TMC[2], b=TMC[1], f=Math.pow(Math.abs(m),0.6); for(var j=0;j<3;j++) o[j]=b[j]+(e[j]-b[j])*f; return o;}
  function tierCol(v,o){var t0=clamp(Math.floor(v),0,4),t1=Math.min(4,t0+1),f=clamp(v-t0,0,1),A=TC[t0],B=TC[t1]; for(var j=0;j<3;j++) o[j]=A[j]+(B[j]-A[j])*f; return o;}
  function upd(dt){
    var TL=cfg.trail, SZ=cfg.size, tOn=cfg.tOn&&TL>0.001&&cfg.tOp>0.001, sty=cfg.tStyle, solid=sty==='solid', tw=cfg.tW, tfd=cfg.tFade, tamp=cfg.tOp*Math.min(1,TL*1.5), gu=Math.min(rp.gu,1), tm=cfg.tMode;
    cY=Math.cos(yaw);sY=Math.sin(yaw);cT=Math.cos(cfg.tilt*Math.PI/180);sT=Math.sin(cfg.tilt*Math.PI/180); camP.copy(cam.position);
    var foc=op.t>=0&&op.focus&&op.k>0.05, bhk=bh.k;
    for(var i=0;i<Mact;i++){
      if(rp.on){gEval(i,gu,gq); rf[i]=gq.rf; ty[i]=gq.ty; dia[i]=0.1+0.29*Math.max(0,1-gq.lk/lnU); grp[i]=clamp(Math.round(gq.ty),0,4);}
      var tI=clamp(Math.round(ty[i]),0,4), oOn=orbOn(tI), oSz=cfg.orb[tI].size;
      var c=rp.on?tierCol(ty[i],ccol):colOf(i),dm=TDIM[tI];
      var aMul=(op.t<0||tI===op.t?1:1-op.k)*(oOn?1:0), yo=yOff(i,tI);
      if(foc&&tI!==op.t) aMul*=1-0.97*op.k;
      var a=al[i]*dm*aMul, sz=dia[i]*sm[i]*SZ*oSz*(i===sel?1.25:1)*(1+fl[i]*0.5);
      // focus: remap radius by RS score within the tier (high RS farther out)
      var rfUse=rf[i], angUse=ang[i];
      if(foc&&tI===op.t){var rsV=i<N?info[i].rs:(rp.on?Math.round(Math.exp(gq.lk||0)):50); rfUse=rf[i]+(rsFrac(rsV,tI)-rf[i])*op.k; angUse=ang[i]+(hash(info[i].t+'f')-0.5)*0.35*op.k;}
      ea[i]=oOn&&a>0.02?a/Math.max(dm,0.01):0; W3(rfUse,ty[i],angUse,i*3,sP); sP[i*3+1]+=yo;
      var cL=cap.on?capL[tI]:null, cw=0, cvv=1;   // BLACK HOLE event: displace the drawn pose by the layer's pull field (orbit state untouched -> exact return)
      if(cL&&cL.ph){cw=capD3(sP,i*3,cL); cvv=capK3(sP,i*3,cL); a*=cvv; sz*=(1-0.4*clamp(cw,0,1))*(0.35+0.65*cvv); if(cvv<0.5) ea[i]=0;}
      capVis[i]=cvv;
      // black-hole warp: spiral + stretch toward the BH, then restore (positions are computed from live state so exit is exact)
      if(bhk>0.001){var bx=bh.x,by=bh.y,bz=bh.z, px=sP[i*3],py=sP[i*3+1],pz=sP[i*3+2], dx=px-bx,dy=py-by,dz=pz-bz, dist=Math.sqrt(dx*dx+dy*dy+dz*dz)+1e-4;
        var pull=sstep(bhk)*clamp(1.15-dist/14,0,1); var swirl=bhk*bhk*2.4*(0.4+0.6*pull);
        var cs=Math.cos(swirl+i*0.17), sn=Math.sin(swirl+i*0.17);
        var rx=dx*cs-dz*sn, rz=dx*sn+dz*cs; var inward=1-pull*0.92*bhk;
        sP[i*3]=bx+rx*inward; sP[i*3+1]=by+dy*inward*(1-0.35*pull*bhk)+Math.sin(swirl*1.7)*0.15*pull; sP[i*3+2]=bz+rz*inward;
        sz*=1+pull*bhk*(1.8+1.6*Math.sin(swirl*3)); a*=1-0.55*pull*bhk;}
      sS[i]=sz; sC[i*3]=c[0]*a;sC[i*3+1]=c[1]*a;sC[i*3+2]=c[2]*a; sF[i]=cw>0.02?Math.max(fl[i],0.55*Math.min(1,cw)):fl[i];
      // burst ring on Top-50 entry/exit
      if(fl[i]>0.01){bP[i*3]=sP[i*3];bP[i*3+1]=sP[i*3+1];bP[i*3+2]=sP[i*3+2];bS[i]=sz*(1.2+(1-fl[i])*5.0);var fc=flS[i]>0?[1,0.95,0.7]:[1,0.3,0.35],fa=fl[i]*al[i];bC[i*3]=fc[0]*fa;bC[i*3+1]=fc[1]*fa;bC[i*3+2]=fc[2]*fa;}
      else{bS[i]=0;bC[i*3]=bC[i*3+1]=bC[i*3+2]=0;}
      // TAILS: live = arc behind the sphere along its orbit (length ~ orbit speed); replay = the same arc + the glide path it just drifted along
      if(tOn){var tcol=tm==='ring'?c:tm==='delta'?dcol(rp.on?rpChg[i]:(i<N?info[i].m[wi]:0),dcl):trailRGB;
        var span=clamp(Math.abs(om[i])*2.6,0.07,1.45)*TL*(rp.on?0.6:1)*(cL&&cL.ph?1+1.2*cL.st:1), g0=grp[i]===0?0.8:1;
        for(var k=0;k<K;k++){var f=k/(K-1),o=(i*K+k)*3,fa2=Math.pow(1-f,tfd)*0.6*a*tamp*g0;
          if(rp.on){gEval(i,rp.gu-f*0.9*TL,gq2); W3(gq2.rf,gq2.ty,ang[i]-f*span,o,tP);} else {W3(rf[i],ty[i],ang[i]-f*span,o,tP); tP[o+1]+=yo; if(cL&&cL.ph){capD3(tP,o,cL); fa2*=capK3(tP,o,cL);}}
          tS[i*K+k]=solid?0:sz*(sty==='dotted'?0.5*tw*(1-0.55*f):0.75*tw*(1-0.4*f)); tC[o]=tcol[0]*fa2;tC[o+1]=tcol[1]*fa2;tC[o+2]=tcol[2]*fa2;}
        if(solid){var hw0=sz*0.3*tw*(1+0.35*cfg.tGlow);
          for(k=0;k<K;k++){var o5=(i*K+k)*3,oa=(i*K+Math.max(0,k-1))*3,ob=(i*K+Math.min(K-1,k+1))*3,
              tx=tP[ob]-tP[oa],tyy=tP[ob+1]-tP[oa+1],tz=tP[ob+2]-tP[oa+2],vx=camP.x-tP[o5],vy=camP.y-tP[o5+1],vz=camP.z-tP[o5+2],
              cx=tyy*vz-tz*vy,cy2=tz*vx-tx*vz,cz=tx*vy-tyy*vx,ln=Math.sqrt(cx*cx+cy2*cy2+cz*cz),hw=ln>1e-9?hw0*(1-0.8*k/(K-1))/ln:0,q=(i*K+k)*6;
            rP[q]=tP[o5]+cx*hw;rP[q+1]=tP[o5+1]+cy2*hw;rP[q+2]=tP[o5+2]+cz*hw;rP[q+3]=tP[o5]-cx*hw;rP[q+4]=tP[o5+1]-cy2*hw;rP[q+5]=tP[o5+2]-cz*hw;
            rC[q]=rC[q+3]=tC[o5];rC[q+1]=rC[q+4]=tC[o5+1];rC[q+2]=rC[q+5]=tC[o5+2];}}}
      // replay path: each session's ring position from the window start to now, curling back in angle with age
      if(rp.on&&rp.paths){var cur=rp.p, n0=Math.max(rp.d0,Math.ceil(cur)-PK+1), prev=null, s=0, base=(i*PS)*3;
        for(var d=Math.floor(cur);d>=n0&&s<PK;d--){var st=rpState(i,d); if(!st){prev=null;continue;}
          var age=cur-d, rr=rfrac(st.rk,st.N,st.g)+jit[i], o3=base+s*6, fa3=Math.pow(1-age/Math.max(1,cur-rp.d0+1),1.1)*0.5*al[i];
          if(prev===null){W3(rf[i],ty[i],ang[i],o3,pP);} else {pP[o3]=prev[0];pP[o3+1]=prev[1];pP[o3+2]=prev[2];}
          W3(rr,st.g,ang[i]-age*0.035,o3+3,pP); prev=[pP[o3+3],pP[o3+4],pP[o3+5]];
          var pc=TC[st.g]; pC[o3]=pc[0]*fa3;pC[o3+1]=pc[1]*fa3;pC[o3+2]=pc[2]*fa3;pC[o3+3]=pc[0]*fa3*0.9;pC[o3+4]=pc[1]*fa3*0.9;pC[o3+5]=pc[2]*fa3*0.9; s++;}
        for(;s<PK;s++){var o4=base+s*6; for(var z=0;z<6;z++){pP[o4+z]=0;pC[o4+z]=0;}}}
    }
    var tr=tOn&&!solid, rb=tOn&&solid; tPts.visible=tr; rMesh.visible=rb;
    sg.setDrawRange(0,Mact); tg.setDrawRange(0,tr?Mact*K:0); rg.setDrawRange(0,rb?Mact*(K-1)*6:0); pg.setDrawRange(0,Mact*PS); bg2.setDrawRange(0,Mact);
    [sg,bg2].forEach(function(g){for(var k in g.attributes) g.attributes[k].needsUpdate=true;});
    if(tr){tg.attributes.position.needsUpdate=tg.attributes.aS.needsUpdate=tg.attributes.aC.needsUpdate=true;}
    if(rb){rg.attributes.position.needsUpdate=rg.attributes.aC.needsUpdate=true;}
    if(pSeg.visible){pg.attributes.position.needsUpdate=pg.attributes.aC.needsUpdate=true;}
  }

  // ---------------------------------------------------------------- HTML overlay: tier labels, ticker tags, reticle, callout
  var labels=TIERS.map(function(t,ti){var e=document.createElement('div');e.className='rso-tl'+(ti===4?' dim':'');
    e.innerHTML='<span class="hit">'+esc(t.label)+'</span><i>'+t.shown+(t.dust?' +'+t.dust.toLocaleString()+' dust':'')+'</i>';ov.appendChild(e);return e;});
  var topIdx=[]; (function(){for(var i=0;i<N&&topIdx.length<6;i++){if(S[i].g===0) topIdx.push(i);} for(var t=1;t<5;t++){for(i=0;i<N;i++){if(S[i].g===t){topIdx.push(i);break;}}}})();
  var tags={};
  function tag(i){if(tags[i]) return tags[i];var e=document.createElement('div');e.className='rso-tag';e.textContent=info[i].t;ov.appendChild(e);tags[i]=e;return e;}
  var svgNS='http://www.w3.org/2000/svg', lead=document.createElementNS(svgNS,'svg'); lead.setAttribute('class','rso-lead'); var lpath=document.createElementNS(svgNS,'path'); lead.appendChild(lpath); ov.appendChild(lead);
  var ret=document.createElement('div'); ret.className='rso-ret'; ov.appendChild(ret);
  var co=document.createElement('div'); co.className='rso-co'; co.setAttribute('role','dialog'); co.setAttribute('aria-live','polite'); ov.appendChild(co);
  var hint=root.querySelector('.rso-hint');
  var W=1,H=1, sx=new Float32Array(M),sy=new Float32Array(M),sr=new Float32Array(M),sdep=new Float32Array(M), coX=0,coY=0,coSide=0;
  function tcss(t){return cfg.c[clamp(t,0,4)];}
  function chgHTML(c){return c==null?'<span class="nw">NEW</span>':c>0?'<span class="up">▲'+c+'</span>':c<0?'<span class="dn">▼'+(-c)+'</span>':'<span>=0</span>';}
  function spark(h,col,from,to,mark){var v=[],lo=101,hi=-1;h.forEach(function(x,i){if(x!=null){v.push([i,x]);lo=Math.min(lo,x);hi=Math.max(hi,x);}});
    if(v.length<2) return '<svg class="sp" viewBox="0 0 186 46"><text x="93" y="26" fill="#7f9cc0" font-size="9" text-anchor="middle">no RS history yet</text></svg>';
    lo=Math.max(1,lo-3);hi=Math.min(99,hi+2);if(hi-lo<6){lo=Math.max(1,hi-6);}
    var n=h.length-1||1,X=function(i){return 2+i/n*182;},Y=function(x){return 42-(x-lo)/(hi-lo)*38;};
    var d='',pen=false;h.forEach(function(x,i){if(x==null){pen=false;return;}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(x).toFixed(1);pen=true;});
    var f=v[0],l=v[v.length-1], id='rsog'+Math.floor(Math.random()*1e6);
    var area='M'+X(f[0]).toFixed(1)+' 44'+v.map(function(p){return 'L'+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1);}).join('')+'L'+X(l[0]).toFixed(1)+' 44Z';
    var mk=mark!=null?'<path d="M'+X(mark).toFixed(1)+' 0V46" stroke="#fff" stroke-width="1" opacity=".7" vector-effect="non-scaling-stroke"/>':'';
    return '<svg class="sp" viewBox="0 0 186 46" preserveAspectRatio="none"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity=".3"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'+
      '<path d="M2 '+Y(90).toFixed(1)+'H184" stroke="rgba(255,255,255,.13)" stroke-dasharray="2 3" fill="none" vector-effect="non-scaling-stroke"/>'+
      '<path d="'+area+'" fill="url(#'+id+')"/><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'+mk+
      '<circle cx="'+X(l[0]).toFixed(1)+'" cy="'+Y(l[1]).toFixed(1)+'" r="2.2" fill="#fff"/></svg>'+
      '<div class="spl"><span>'+esc(String(from||'').slice(5))+' · RS '+f[1]+'</span><span>RS '+lo+'–'+hi+'</span><span>RS '+l[1]+' · '+esc(String(to||'').slice(5))+'</span></div>';}
  function fillCo(){if(sel<0) return; var s=info[sel], col;
    if(rp.on&&RP){var d=curDay(), st=rpState(sel,d), s0=null;
      for(var d0=rp.d0;d0<=d;d0++){s0=rpState(sel,d0); if(s0) break;}
      var g=st?st.g:grp[sel]; col=tcss(g); var ch=st&&s0?s0.rk-st.rk:null;
      var hh=[]; for(var j=rp.d0;j<=rp.d1;j++){var x=RP.v[sel*RP.nd+j]; hh.push(x<0?null:x%100);}
      co.innerHTML='<button class="x" aria-label="Close">×</button><div class="h">'+(st?'RANK #'+st.rk+' · RS '+st.rs+' · '+chgHTML(ch)+' SINCE '+esc(RP.dates[rp.d0].slice(5)):'NOT RANKED / OUTSIDE TOP GROUP')+'</div>'+
        '<div class="tk"><b>'+esc(s.t)+'</b><span>'+esc(s.n)+'</span></div><div class="in">'+esc(RP.dates[d])+' · '+(st?esc(TIERS[st.g].label):'—')+'</div>'+
        spark(hh,col,RP.dates[rp.d0],RP.dates[rp.d1],d-rp.d0)+'<a class="go" href="stock.html?t='+encodeURIComponent(s.t)+'">OPEN CHART ›</a>';}
    else{var w=WIN[wi]; col=tcss(s.g);
      co.innerHTML='<button class="x" aria-label="Close">×</button><div class="h">RANK #'+s.k+' · RS '+s.rs+' · '+chgHTML(s.c[wi])+' '+WL[w]+'</div>'+
        '<div class="tk"><b>'+esc(s.t)+'</b><span>'+esc(s.n)+'</span></div><div class="in">'+esc(TIERS[s.g].label)+(s.ind?' · '+esc(s.ind):'')+(s.tt?' · TT ✓':'')+'</div>'+
        spark(s.h||[],col,D.spark&&D.spark.from,D.spark&&D.spark.to)+'<div class="ch">'+WIN.map(function(x,j){return '<div class="'+(j===wi?'on':'')+'"><small>'+WL[x]+(s.p[j]?' · was #'+s.p[j]:'')+'</small>'+chgHTML(s.c[j])+'</div>';}).join('')+'</div>'+
        '<a class="go" href="stock.html?t='+encodeURIComponent(s.t)+'">OPEN CHART ›</a>';}
    co.style.setProperty('--c',col); ret.style.setProperty('--c',col); lpath.setAttribute('stroke',col);
    co.querySelector('.x').addEventListener('click',function(e){e.stopPropagation();select(-1);});}
  function select(i){sel=i; if(i<0){co.classList.remove('on');ret.classList.remove('on');lpath.setAttribute('d','');need();return;}
    snd('sel',cfg); fillCo(); coSide=sx[i]>W/2?0:1; co.classList.add('on'); ret.classList.add('on'); placeCo(true); need();}
  function placeCo(force){if(sel<0) return; var cw=co.offsetWidth||206,ch=co.offsetHeight||170,x=sx[sel],y=sy[sel];
    if(!force&&((coSide===0&&x<cw+30)||(coSide===1&&x>W-cw-30))) coSide=1-coSide;
    coX=coSide===0?8:W-cw-8; var ty_=y-ch-30; if(ty_<40) ty_=y+34; coY=clamp(ty_,40,H-ch-6);
    co.style.transform='translate('+coX.toFixed(0)+'px,'+coY.toFixed(0)+'px)';
    var ax=coSide===0?coX+cw:coX, ay=clamp(y,coY+14,coY+ch-14), mx=(x+ax)/2;
    lpath.setAttribute('d','M'+x.toFixed(1)+' '+y.toFixed(1)+'L'+mx.toFixed(1)+' '+ay.toFixed(1)+'L'+ax.toFixed(1)+' '+ay.toFixed(1));}

  // ---------------------------------------------------------------- camera / controls
  var yawV=0, lastUser=-1e9, tNow=0, dist=14, cyC=0.3;
  function fit(){var asp=W/H, vf=cfg.fov*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*asp), tl=Math.abs(cfg.tilt*Math.PI/180);
    var halfW=R*1.18*Math.max(cfg.sx*Math.cos(tl),cfg.sz*0.75), top=coreY()+0.95+R*Math.sin(tl)*0.6, bot=tierY(4)-R*cfg.sz*Math.sin(pitch)*1.05-R*Math.sin(tl)-0.15, halfH=(top-bot)/2*Math.cos(pitch*0.35)+0.1; cyC=(top+bot)/2;
    dist=Math.max(halfW/Math.tan(hf/2)+R*cfg.sz*0.55*Math.cos(pitch), halfH/Math.tan(vf/2)+R*cfg.sz*0.35);}
  function fitOpen(){var asp=W/H, vf=cfg.fov*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*asp), E0=Math.min(op.E,1.45), po=pitchOpen();
    var halfW=R*1.1*E0*cfg.sx, hh=R*E0*cfg.sz*Math.sin(po)+0.55+VSUf()*(cfg.vs-1)*Math.cos(po);
    return {d:Math.max(halfW/Math.tan(hf/2)+R*E0*cfg.sz*0.55*Math.cos(po), hh/Math.tan(vf/2)+R*E0*cfg.sz*0.4), y:tierY(op.t)};}
  var camD=14;
  function placeCam(){var k=op.t>=0?sstep(op.k):0, d=dist*zoom, cy=cyC, pt=pitch;
    if(k>0){var f=fitOpen(); d+=(f.d*zoom-d)*k; cy+=(f.y-cy)*k; pt+=(pitchOpen()-pt)*k;}
    camD=d; cam.position.set(0,cy+d*Math.sin(pt),d*Math.cos(pt)); cam.lookAt(0,cy,0); capGeo(cy);
    retic.quaternion.copy(cam.quaternion); for(var t=0;t<spinG.length;t++){spinG[t].rotation.y=yaw; var q=tsc(t); tierG[t].scale.set(cfg.sx*q,1,cfg.sz*q);
      var od=(op.t<0||t===op.t?1:1-op.k); var ro=cfg.orb[t].ring?cfg.orb[t].ringOp:0; if(bh.k>0) ro*=1-0.7*bh.k;
      ringMats[t].uniforms.uDim.value=TDIM[t]*(climb&&!rp.on?0.55:1)*od*ro; dustMats[t].uniforms.uDim.value=(climb&&!rp.on?0.35:(rp.on?0.55:1))*od*ro*(orbOn(t)?1:0.15);}
    stars.rotation.y=yaw*0.25;}
  function resize(){var r=stage.getBoundingClientRect(); W=Math.max(1,Math.round(r.width)); H=Math.max(1,Math.round(r.height));
    renderer.setSize(W,H,false); cam.fov=cfg.fov; cam.aspect=W/H; cam.updateProjectionMatrix(); fit();
    U.uScale.value=H*PR/(2*Math.tan(cam.fov*Math.PI/360)); U.uRes.value[0]=W*PR; U.uRes.value[1]=H*PR; need();}
  var dirty=true; function need(){dirty=true;}
  var ptr={}, np=0, pinch0=0, zoom0=1, tap=null, lpT=0, E0p=1.35;
  function pd(e){return Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y);}
  function arr(){return Object.keys(ptr).map(function(k){return ptr[k];});}
  cv.addEventListener('pointerdown',function(e){var b=cv.getBoundingClientRect();ptr[e.pointerId]={x:e.clientX,y:e.clientY};np=Object.keys(ptr).length;
    try{cv.setPointerCapture(e.pointerId);}catch(_){}
    if(np===1) tap={x:e.clientX,y:e.clientY,t:performance.now(),bx:b.left,by:b.top,ok:true}; else {tap=null; if(np===2){pinch0=pd(arr());zoom0=zoom;E0p=op.E;}} clearTimeout(lpT); if(np===1){var lx=e.clientX-b.left,ly=e.clientY-b.top; lpT=setTimeout(function(){if(tap&&tap.ok&&np===1){tap.ok=false; var t=ringAt(lx,ly); if(t>=0){if(navigator.vibrate) try{navigator.vibrate(12);}catch(_){} openTier(t);}}},520);}
    yawV=0; lastUser=tNow; if(hint) hint.style.opacity='0';});
  cv.addEventListener('pointermove',function(e){var p=ptr[e.pointerId]; if(!p) return; var dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX;p.y=e.clientY;
    if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>9){tap.ok=false; clearTimeout(lpT);}
    if(np===1){yaw+=dx*0.0085; yawV=dx*0.0085*60; if(e.pointerType!=='touch'){pitch=clamp(pitch+dy*0.004,0.1,0.8); fit();}}
    else if(np===2){var d=pd(arr()); if(pinch0>0){if(op.t>=0&&op.target>0){setE(E0p*d/pinch0);} else zoom=clamp(zoom0*pinch0/d,0.5,1.7);}}
    lastUser=tNow; need();});
  function up(e,cancel){clearTimeout(lpT); if(!ptr[e.pointerId]) return; delete ptr[e.pointerId]; np=Object.keys(ptr).length;
    if(!cancel&&tap&&tap.ok&&np===0&&performance.now()-tap.t<500) pick(e.clientX-tap.bx,e.clientY-tap.by);
    if(np===0) tap=null; if(np<2) pinch0=0;}
  cv.addEventListener('pointerup',function(e){up(e,false);}); cv.addEventListener('pointercancel',function(e){up(e,true);});
  stage.addEventListener('touchmove',function(e){if(e.touches&&e.touches.length>1) e.preventDefault();},{passive:false});
  stage.addEventListener('gesturestart',function(e){e.preventDefault();});
  cv.addEventListener('wheel',function(e){if(!e.ctrlKey) return; e.preventDefault(); zoom=clamp(zoom*(1+e.deltaY*0.01),0.5,1.7); need();},{passive:false});
  cv.setAttribute('tabindex','0');
  cv.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'){yaw-=0.15;need();}else if(e.key==='ArrowRight'){yaw+=0.15;need();}else if(e.key===' '||e.key==='f'){e.preventDefault(); setFreeze(!frozen);}});
  function hitAt(x,y){var best=-1,bd=1e9;for(var i=0;i<Mact;i++){if(ea[i]<0.5) continue;var d=Math.hypot(sx[i]-x,sy[i]-y),lim=Math.max(sr[i]+9,15);
      if(d<lim){var sc=d-sdep[i]*2-(sr[i]*0.3);if(sc<bd){bd=sc;best=i;}}}
    return best;}
  function pick(x,y){var best=hitAt(x,y);
    // tap on a ring line (no planet hit, nothing selected, no orbit open) -> SOLO that orbit
    if(best<0&&sel<0&&op.t<0&&!rp.on){var rt=ringAt(x,y,16); if(rt>=0){soloOrbit(rt); return;}}
    select(best===sel?-1:best);}
  var hov=-1;
  cv.addEventListener('pointermove',function(e){if(e.pointerType!=='mouse'||np>0) return; var b=cv.getBoundingClientRect(), h=hitAt(e.clientX-b.left,e.clientY-b.top);
    if(h!==hov){hov=h; cv.style.cursor=h>=0?'pointer':''; need();}});
  cv.addEventListener('pointerleave',function(){if(hov>=0){hov=-1; cv.style.cursor=''; need();}});

  // ---------------------------------------------------------------- live toggles (1D/1W/4W, CLIMBERS)
  var segB=root.querySelectorAll('.rso-seg button'), clB=root.querySelector('.rso-climb'), clBox=root.querySelector('.rso-cls'), legW=root.querySelector('[data-win]'), ctl=root.querySelector('.rso-ctl');
  function setTargets(){var cl=climb&&!rp.on?(D.climbers[WIN[wi]]||[]):null, set={}; if(cl) cl.forEach(function(t){set[t]=1;});
    for(var i=0;i<N;i++){omT[i]=omega(i); if(!rp.on){var base=cl?(set[info[i].t]?1:0.13):1; alT[i]=orbOn(info[i].g)?base:0;} smT[i]=cl&&set[info[i].t]?1.22:1;}
    for(i=N;i<Mact;i++){omT[i]=omega(i); if(!rp.on) alT[i]=0; smT[i]=1;}
    /* ring/dust dims applied each frame in placeCam */
    if(legW) legW.textContent=WL[WIN[wi]];
    if(clBox){if(cl){clBox.innerHTML=cl.map(function(t){var i=byT[t],s=info[i];return '<button data-i="'+i+'" style="--c:'+tcss(s.g)+'">'+esc(t)+'<i>▲'+(s.c[wi]==null?'new':s.c[wi])+'</i></button>';}).join('')||'<span>none</span>'; clBox.hidden=false;}
      else{clBox.hidden=true; clBox.innerHTML='';}}
    if(sel>=0) fillCo(); if(RM){for(i=0;i<Mact;i++){om[i]=omT[i];al[i]=alT[i];sm[i]=smT[i];}} need();}
  segB.forEach(function(b){b.addEventListener('click',function(){wi=WIN.indexOf(b.getAttribute('data-w')); snd('click',cfg); segB.forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');}); setTargets();});});
  if(clB) clB.addEventListener('click',function(){climb=!climb; snd('tog',cfg); clB.classList.toggle('on',climb); clB.setAttribute('aria-pressed',climb?'true':'false'); setTargets();});
  if(clBox) clBox.addEventListener('click',function(e){var b=e.target.closest('button[data-i]'); if(b){var i=+b.getAttribute('data-i'); render(0); select(i);}});

  // ---------------------------------------------------------------- corner buttons, HUD drawer
  var cb=document.createElement('div'); cb.className='rso-cbar';
  cb.innerHTML='<button type="button" class="rso-cb rp" aria-pressed="false"><i>◉</i>REPLAY</button><button type="button" class="rso-cb hud" aria-expanded="false" aria-controls="rso-dr"><i>⚙</i>HUD</button>';
  stage.appendChild(cb);
  var dr=document.createElement('div'); dr.className='rso-dr'; dr.id='rso-dr'; dr.setAttribute('aria-hidden','true'); stage.appendChild(dr);
  var SL=[['g','03 · GEOMETRY'],['sx','RING WIDTH · X',0.5,1.6,0.01,'×'],['sz','RING DEPTH · Z',0.3,1.8,0.01,'×'],['sy','TIER SPACING · Y',0.45,1.8,0.01,'×'],['tilt','RING TILT',-30,30,1,'°'],
    ['g','04 · DYNAMICS'],['size','GLOBAL PLANET SIZE',0.4,2.2,0.01,'×'],['speed','ORBIT SPEED',0,3,0.01,'×'],['glow','GLOW INTENSITY',0.1,2.2,0.01,'×'],
    ['g','05 · TAILS'],['trail','LENGTH',0,2.5,0.01,'×'],['tW','WIDTH · THICKNESS',0.2,3,0.01,'×'],['tOp','OPACITY',0,1.5,0.01,'×'],['tFade','FADE CURVE',0.3,4,0.05,' γ'],['tGlow','TAIL GLOW',0,2.5,0.01,'×'],
    ['g','06 · CAMERA'],['autoSpd','AUTO-ROTATE RATE',-3,3,0.05,'×'],['fov','FIELD OF VIEW',22,75,1,'°']];
  function drHTML(){var h='<div class="dr-hd"><b>MISSION CONTROL</b><span>ORBITAL · CONFIG</span><button type="button" class="dr-x" aria-label="Close controls">×</button></div><div class="dr-bd">';
    h+='<div class="dr-g">01 · THEME</div><div class="dr-pre">'+Object.keys(PRESETS).map(function(k){return '<button type="button" data-pre="'+k+'" class="'+(cfg.theme===k?'on':'')+'">'+PRESETS[k].name+'</button>';}).join('')+'</div>';
    h+='<div class="dr-g">02 · COLOUR</div><div class="dr-cols">'+TIERS.map(function(t,i){return '<label><input type="color" data-col="'+i+'" value="'+cfg.c[i]+'"><span>'+esc(t.label.replace(' · ELITE',''))+'</span></label>';}).join('')+
      '<label><input type="color" data-k="beam" value="'+cfg.beam+'"><span>BEAM / CORE</span></label><label><input type="color" data-k="bg" value="'+cfg.bg+'"><span>BACKGROUND</span></label>'+
      '</div>';
    SL.forEach(function(s){if(s[0]==='g'){h+='<div class="dr-g">'+s[1]+'</div>';if(s[1].indexOf('CAMERA')>0) h+='<label class="ck row"><input type="checkbox" data-k="auto"'+(cfg.auto?' checked':'')+'><span>AUTO-ROTATE</span></label>';
        if(s[1].indexOf('TAILS')>0) h+=tailsHTML(); return;}
      h+='<label class="dr-s'+(TK.indexOf(s[0])>=0?' tl-x':'')+'"><span>'+s[1]+'</span><output data-o="'+s[0]+'">'+fmt(s[0],cfg[s[0]],s[5])+'</output><input type="range" data-k="'+s[0]+'" min="'+s[2]+'" max="'+s[3]+'" step="'+s[4]+'" value="'+cfg[s[0]]+'"></label>';});
    h+='<div class="dr-g">07 · ORBITS</div>'+orbitsHTML();
    h+='<div class="dr-g">08 · BLACK HOLE</div>'+bhHTML();
    h+='<div class="dr-g">09 · AUDIO</div><label class="ck row"><input type="checkbox" data-k="sound"'+(cfg.sound?' checked':'')+'><span>UI SOUNDS</span></label>';
    h+='<button type="button" class="dr-reset">RESET TO DEFAULTS</button><div class="dr-ft">SAVED ON THIS DEVICE · localStorage</div></div>'; dr.innerHTML=h; orbSync(); bhSync();}
  var TK=['trail','tW','tOp','tFade','tGlow'];
  function shortLab(t){return TIERS[t].label.replace('RS ','').replace(' · ELITE','★').replace('–','-');}
  function orbitsHTML(){var h='<div class="orb-note">Per ring: stocks on/off · ring fade · planet size · FOCUS lays them out by RS</div>';
    for(var t=0;t<5;t++){var o=cfg.orb[t]; h+='<div class="orb-row" data-ot="'+t+'" style="--c:'+cfg.c[t]+'">'+'<div class="orb-hd"><b style="color:'+cfg.c[t]+'">'+esc(shortLab(t))+'</b>'+'<button type="button" class="orb-tog'+(o.on?' on':'')+'" data-orb="on" aria-pressed="'+o.on+'">STOCKS</button>'+'<button type="button" class="orb-tog'+(o.ring?' on':'')+'" data-orb="ring" aria-pressed="'+o.ring+'">RING</button>'+'<button type="button" class="orb-foc'+(op.t===t&&op.focus?' on':'')+'" data-foc="'+t+'">FOCUS</button></div>'+'<label class="orb-s"><span>RING FADE</span><output data-oo="ringOp">'+(o.ringOp*100|0)+'%</output>'+'<input type="range" data-orb="ringOp" min="0" max="1" step="0.01" value="'+o.ringOp+'"'+(o.ring?'':' disabled')+'></label>'+'<label class="orb-s"><span>PLANET SIZE</span><output data-oo="size">'+(+o.size).toFixed(2)+'×</output>'+'<input type="range" data-orb="size" min="0.3" max="3" step="0.01" value="'+o.size+'"></label></div>';}
    h+='<div class="orb-acts"><button type="button" class="orb-all" data-all="on">ALL ON</button><button type="button" class="orb-all" data-all="off">ALL OFF</button><button type="button" class="orb-all" data-all="solo" title="Leave only the focused / first-on orbit">SOLO FOCUS</button></div>'; return h;}
  function bhHTML(){return '<button type="button" class="bh-now">🕳 BLACK HOLE NOW</button>'+'<label class="ck row"><input type="checkbox" data-k="bhAuto"'+(cfg.bhAuto?' checked':'')+'><span>AUTO (every few min)</span></label>'+'<label class="dr-s"><span>AUTO EVERY · MIN</span><output data-o="bhMin">'+cfg.bhMin+'-'+cfg.bhMax+'m</output>'+'<input type="range" data-k="bhSpan" min="2" max="20" step="1" value="'+Math.round((cfg.bhMin+cfg.bhMax)/2)+'"></label>'+'<div class="bh-ft">Wild 8–12s ride · then exact restore · off when reduced-motion</div>'+
    '<div class="dr-sub">BLACK HOLE EVENTS · it pulls the orbits in, they come back round the other side</div>'+
    '<label class="ck row"><input type="checkbox" data-k="capOn"'+(cfg.capOn?' checked':'')+'><span>BLACK HOLE EVENTS</span></label>'+
    '<div class="dr-seg cap-f" role="group" aria-label="Black hole event frequency" data-grp="capFreq">'+[['rare','RARE'],['normal','NORMAL'],['chaos','CHAOS']].map(function(o){return '<button type="button" data-tv="'+o[0]+'" aria-pressed="'+(cfg.capFreq===o[0])+'" class="'+(cfg.capFreq===o[0]?'on':'')+'">'+o[1]+'</button>';}).join('')+'</div>'+
    '<div class="cap-acts"><button type="button" class="cap-now" title="Partial: 1–2 outer rings get pulled in">☄ TRIGGER NOW</button><button type="button" class="sn-now" title="The whole system gets pulled in">🕳 BLACK HOLE</button></div>'+
    '<div class="bh-ft cap-ft">RARE 2–4 min · NORMAL 45–90 s · CHAOS 12–25 s · TRIGGER NOW = 1–2 outer rings get tugged in · BLACK HOLE = the whole system (1 in 3 random events) · paused in replay, with a planet box open or while dragging</div>';}
  function seg(grp,opts){return '<div class="dr-seg tl-x" role="group" data-grp="'+grp+'">'+opts.map(function(o){return '<button type="button" data-tv="'+o[0]+'" aria-pressed="'+(cfg[grp]===o[0])+'" class="'+(cfg[grp]===o[0]?'on':'')+'">'+o[1]+'</button>';}).join('')+'</div>';}
  function tailsHTML(){return '<label class="ck row"><input type="checkbox" data-k="tOn"'+(cfg.tOn?' checked':'')+'><span>TAILS ON</span></label>'+
    '<div class="dr-sub tl-x">COLOUR MODE</div>'+seg('tMode',[['ring','RING'],['custom','CUSTOM'],['delta','Δ RANK']])+
    '<div class="dr-tc tl-x"><label class="cp"><input type="color" data-k="trailCol" value="'+cfg.trailCol+'"><span>CUSTOM</span></label><span class="dr-grad" title="gradient by rank change"><i>▼ FALLING</i><i>FLAT</i><i>CLIMBING ▲</i></span></div>'+
    '<div class="dr-sub tl-x">STYLE</div>'+seg('tStyle',[['solid','SOLID'],['dotted','DOTTED'],['sparkle','✦ SPARKLE']]);}
  function fmt(k,v,u){return (k==='tilt'||k==='fov'?Math.round(v):(+v).toFixed(2))+(u||'');}
  function segSync(){dr.querySelectorAll('.dr-seg').forEach(function(g){var gp=g.getAttribute('data-grp'); g.querySelectorAll('button').forEach(function(b){var on=cfg[gp]===b.getAttribute('data-tv'); b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on));});});
    dr.classList.toggle('toff',!cfg.tOn); dr.setAttribute('data-tm',cfg.tMode);}
  function applyCfg(full){TC=cfg.c.map(hex); TU.uTG.value=cfg.tGlow; TU.uMode.value=cfg.tStyle==='dotted'?1:2; segSync(); sbSync(); orbSync(); bhSync(); var rgt=rpBar&&rpBar.querySelector('.rp-gt'); if(rgt){rgt.value=String(cfg.glide); rgt.parentNode.querySelector('output').textContent=cfg.glide.toFixed(1)+' s/day';} trailRGB=hex(cfg.trailCol); U.uGlow.value=cfg.glow; U.uBeam.value=hex(cfg.beam); bgU.uBg.value=hex(cfg.bg); bgU.uT1.value=TC[2]; bgU.uT2.value=TC[4];
    nodeG.material.uniforms.uTC.value=flat(TC);
    ringMats.forEach(function(m,t){m.uniforms.uColor.value=TC[t];}); dustMats.forEach(function(m,t){m.uniforms.uColor.value=TC[t];});
    labels.forEach(function(e,t){e.style.setProperty('--c',cfg.c[t]);}); for(var k in tags) tags[k].style.setProperty('--c',tcss(grp[k]));
    root.style.setProperty('--acc',cfg.beam); root.style.setProperty('--bgc',cfg.bg);
    for(var t=0;t<5;t++) root.style.setProperty('--g'+t,cfg.c[t]);
    cam.fov=cfg.fov; layoutFixed(); resize(); if(full) setTargets(); if(sel>=0) fillCo(); if(typeof soSync==='function'&&sob) soSync(); saveCfg(cfg); need();}
  drHTML();
  dr.addEventListener('input',function(e){var el=e.target,k=el.getAttribute('data-k'),ci=el.getAttribute('data-col'),ok=el.getAttribute('data-orb'),row=el.closest('.orb-row');
    if(ok&&row){var t=+row.getAttribute('data-ot'); cfg.orb[t][ok]=+el.value; var o=row.querySelector('output[data-oo="'+ok+'"]'); if(o) o.textContent=ok==='ringOp'?(cfg.orb[t].ringOp*100|0)+'%':(+cfg.orb[t].size).toFixed(2)+'×'; applyCfg(false); return;}
    if(ci!=null){cfg.c[+ci]=el.value; cfg.theme='custom';} else if(k){if(el.type==='checkbox'){cfg[k]=el.checked; if(k==='bhAuto'){bh.arm(); bhSync();}}
      else if(k==='trailCol'){cfg.trailCol=el.value; cfg.tMode='custom'; segSync();} else if(el.type==='color'){cfg[k]=el.value; cfg.theme='custom';}
      else if(k==='bhSpan'){var mid=+el.value; cfg.bhMin=Math.max(1,mid-2); cfg.bhMax=mid+2; var o=dr.querySelector('output[data-o="bhMin"]'); if(o) o.textContent=cfg.bhMin+'-'+cfg.bhMax+'m'; bh.arm();}
      else {cfg[k]=+el.value; var o2=dr.querySelector('output[data-o="'+k+'"]'); var s=SL.filter(function(x){return x[0]===k;})[0]; if(o2) o2.textContent=fmt(k,cfg[k],s&&s[5]);}}
    if(cfg.theme==='custom') dr.querySelectorAll('.dr-pre button').forEach(function(b){b.classList.remove('on');});
    applyCfg(false);});
  dr.addEventListener('change',function(e){if(e.target.getAttribute('data-k')==='sound'&&cfg.sound) snd('tog',cfg);});
  function orbSync(){dr.querySelectorAll('.orb-row').forEach(function(row){var t=+row.getAttribute('data-ot'),o=cfg.orb[t];
      row.querySelectorAll('[data-orb]').forEach(function(el){var k=el.getAttribute('data-orb'); if(el.tagName==='BUTTON'){el.classList.toggle('on',!!o[k]); el.setAttribute('aria-pressed',String(!!o[k]));} else if(el.type==='range'){el.value=String(o[k]); el.disabled=k==='ringOp'&&!o.ring;}});
      var fo=row.querySelector('.orb-foc'); if(fo) fo.classList.toggle('on',op.t===t&&op.focus&&op.target>0);});}
  function bhSync(){var el=dr.querySelector('[data-k=bhAuto]'); if(el) el.checked=!!cfg.bhAuto; var o=dr.querySelector('output[data-o=bhMin]'); if(o) o.textContent=cfg.bhMin+'-'+cfg.bhMax+'m';
    var sl=dr.querySelector('[data-k=bhSpan]'); if(sl) sl.value=String(Math.round((cfg.bhMin+cfg.bhMax)/2)); var bn=dr.querySelector('.bh-now'); if(bn) bn.classList.toggle('busy',bh.on);
    if(typeof cap!=='undefined'&&cap) capSync();}
  dr.addEventListener('click',function(e){var b=e.target.closest('button'); if(!b) return;
    if(b.classList.contains('dr-x')){openDr(false);return;}
    var tv=b.getAttribute('data-tv'); if(tv){var gp=b.parentNode.getAttribute('data-grp'); cfg[gp]=tv; snd('click',cfg); segSync(); applyCfg(false); return;}
    if(b.classList.contains('dr-reset')){var snd0=false; cfg=JSON.parse(JSON.stringify(DEF)); cfg.sound=snd0; if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){cfg.bhAuto=false; cfg.capOn=false;} if(op.focus) closeTier(); drHTML(); applyCfg(true); bh.arm(); return;}
    var p=b.getAttribute('data-pre'); if(p){var P=PRESETS[p]; cfg.theme=p; cfg.c=P.c.slice(); cfg.beam=P.beam; cfg.bg=P.bg; cfg.tMode=P.tMode; cfg.trailCol=P.trailCol; snd('click',cfg); drHTML(); applyCfg(true); return;}
    var ok=b.getAttribute('data-orb'), row=b.closest('.orb-row');
    if(ok&&row){var t=+row.getAttribute('data-ot'); cfg.orb[t][ok]=!cfg.orb[t][ok]; snd('tog',cfg); applyCfg(true); orbSync(); return;}
    var ft=b.getAttribute('data-foc'); if(ft!=null){ft=+ft; snd('sel',cfg); if(op.t===ft&&op.focus) closeTier(); else openFocus(ft); openDr(false); return;}
    var all=b.getAttribute('data-all'); if(all==='on'){cfg.orb.forEach(function(o){o.on=true;}); applyCfg(true); orbSync(); return;}
    if(all==='off'){cfg.orb.forEach(function(o){o.on=false;}); applyCfg(true); orbSync(); return;}
    if(all==='solo'){var keep=op.t>=0?op.t:cfg.orb.findIndex(function(o){return o.on;}); if(keep<0) keep=0; cfg.orb.forEach(function(o,i){o.on=i===keep;}); if(!(op.t===keep&&op.focus)) openFocus(keep); applyCfg(true); orbSync(); openDr(false); return;}
    if(b.classList.contains('cap-now')||b.classList.contains('sn-now')){if(capTrigger(true,b.classList.contains('sn-now')?'full':'part')) openDr(false); return;}
    if(b.classList.contains('bh-now')){snd('play',cfg); bh.trigger(); bhSync(); return;}
  });
  ['pointerdown','touchstart','wheel'].forEach(function(ev){dr.addEventListener(ev,function(e){e.stopPropagation();},{passive:true});});
  var hudB=cb.querySelector('.hud'), rpB=cb.querySelector('.rp');
  var sbar=document.createElement('div'); sbar.className='rso-spd'; stage.parentNode.insertBefore(sbar,stage.nextSibling);
  var fzb=document.createElement('div'); fzb.className='rso-fzb'; fzb.textContent='◼ SIM FROZEN'; stage.appendChild(fzb);
  var SPV=[0.25,0.5,1,2,4];
  sbar.innerHTML='<div class="sb-r1"><button type="button" class="sb-fz" aria-pressed="false"><i>❚❚</i><span>FREEZE</span></button><div class="sb-pills" role="group" aria-label="Simulation speed">'+
    SPV.map(function(v){return '<button type="button" data-gs="'+v+'" aria-pressed="false">'+v+'×</button>';}).join('')+'</div></div>'+
    '<label class="sb-r2"><span>SIM SPEED</span><input type="range" min="-3.32" max="2" step="0.01" value="0" aria-label="Simulation speed, log scale 0.1x to 4x"><output>1.00×</output></label>';
  function sbSync(){if(!sbar) return; var g=cfg.gspd, sl=sbar.querySelector('input'), fb=sbar.querySelector('.sb-fz');
    sbar.querySelectorAll('[data-gs]').forEach(function(b){var on=Math.abs(+b.getAttribute('data-gs')-g)<1e-3; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on));});
    if(document.activeElement!==sl) sl.value=String(Math.log2(g)); sbar.querySelector('output').textContent=frozen?'0 · FROZEN':g.toFixed(2)+'×';
    fb.classList.toggle('on',frozen); fb.setAttribute('aria-pressed',String(frozen)); fb.querySelector('i').textContent=frozen?'▶':'❚❚'; fb.querySelector('span').textContent=frozen?'RESUME':'FREEZE';
    root.classList.toggle('frozen',frozen);}
  function setGs(g){cfg.gspd=clamp(Math.round(g*100)/100,0.1,4); saveCfg(cfg); frozen=false; sbSync(); need();}
  function setFreeze(b){frozen=!!b; sbSync(); snd('tog',cfg); need();}
  sbar.addEventListener('click',function(e){var b=e.target.closest('button'); if(!b) return; var g=b.getAttribute('data-gs'); if(g){snd('click',cfg); setGs(+g); return;} if(b.classList.contains('sb-fz')) setFreeze(!frozen);});
  sbar.addEventListener('input',function(e){if(e.target.type!=='range') return; var v=+e.target.value, g=Math.pow(2,v); SPV.forEach(function(s){if(Math.abs(Math.log2(s)-v)<0.06) g=s;}); setGs(g);});
  function openDr(on){dr.classList.toggle('on',on); dr.setAttribute('aria-hidden',on?'false':'true'); hudB.classList.toggle('on',on); hudB.setAttribute('aria-expanded',on?'true':'false'); snd('tog',cfg);}
  hudB.addEventListener('click',function(){openDr(!dr.classList.contains('on'));});

  // ---------------------------------------------------------------- replay UI
  var rpBar=document.createElement('div'); rpBar.className='rso-rp'; rpBar.hidden=true; stage.parentNode.insertBefore(rpBar,ctl);
  var tm=document.createElement('div'); tm.className='rso-tm'; tm.hidden=true; stage.appendChild(tm);
  var sumC=document.createElement('div'); sumC.className='rso-sum'; stage.appendChild(sumC);
  function rpHTML(){var nd=RP?RP.nd:0;
    rpBar.innerHTML='<div class="rp-r1"><div class="rp-win" role="group" aria-label="Replay timeframe">'+RW.map(function(w){var ok=w[0]==='max'||nd-1>=w[2];return '<button type="button" data-rw="'+w[0]+'"'+(ok?'':' disabled')+' class="'+(rp.win===w[0]?'on':'')+'">'+w[1]+'</button>';}).join('')+'</div>'+
      '<button type="button" class="rp-paths'+(rp.paths?' on':'')+'" aria-pressed="'+rp.paths+'">PATHS</button><button type="button" class="rp-exit" aria-label="Exit replay">EXIT</button></div>'+
      '<div class="rp-date"><span class="t">T−0</span><b>—</b><span class="n">DAY 0/0</span></div>'+
      '<div class="rp-scrub"><input type="range" min="0" max="1" step="0.01" value="1" aria-label="Replay position"><div class="rp-ends"><span class="a"></span><span class="b"></span></div></div>'+
      '<div class="rp-r3"><button type="button" class="rp-step" data-st="-1" aria-label="Step back">◀◀</button><button type="button" class="rp-play" aria-label="Play">▶</button><button type="button" class="rp-step" data-st="1" aria-label="Step forward">▶▶</button>'+
      '<div class="rp-spd" role="group" aria-label="Replay speed">'+[0.25,0.5,1,2,4].map(function(s){return '<button type="button" data-sp="'+s+'" class="'+(rp.spd===s?'on':'')+'">'+s+'×</button>';}).join('')+'</div></div>'+
      '<label class="rp-gl"><span>TRANSITION <em>· glide per day step at 1×</em></span><output>'+cfg.glide.toFixed(1)+' s/day</output><input type="range" class="rp-gt" min="0.6" max="4" step="0.1" value="'+cfg.glide+'" aria-label="Transition time per day step, seconds"></label>';}
  function winRange(){var w=RW.filter(function(x){return x[0]===rp.win;})[0]||RW[1]; rp.d1=RP.nd-1; rp.d0=Math.max(0,rp.d1-Math.min(w[2],RP.nd-1));}
  function rpReadout(){if(!RP) return; var d=curDay(), q=rpBar.querySelector('.rp-date');
    q.querySelector('.t').textContent='T−'+(rp.d1-d); q.querySelector('b').textContent=RP.dates[d]; q.querySelector('.n').textContent='DAY '+(d-rp.d0)+'/'+(rp.d1-rp.d0);
    var sc=rpBar.querySelector('.rp-scrub input'); if(document.activeElement!==sc||!scrubbing) sc.value=String(rp.p);
    var pl=rpBar.querySelector('.rp-play'); pl.textContent=rp.play?'❚❚':'▶'; pl.setAttribute('aria-label',rp.play?'Pause':'Play');
    var n50=0,inT=[0,0,0,0,0]; for(var i=0;i<Mact;i++){var s=rpState(i,d); if(s){inT[s.g]++; if(s.rk<=50) n50++;}}
    tm.innerHTML='<div class="l1">REPLAY '+esc(rp.win.toUpperCase())+' · '+esc(RP.dates[rp.d0].slice(5))+' → '+esc(RP.dates[rp.d1].slice(5))+'</div><div class="l2">TOP 50 <b>'+n50+'</b> · RINGS '+inT.map(function(x,t){return '<i style="color:'+cfg.c[t]+'">'+x+'</i>';}).join(' ')+'</div>'+
      rp.events.slice(-3).map(function(e){return '<div class="ev '+(e[1]>0?'up':'dn')+'">'+esc(e[2].slice(5))+' · '+esc(e[0])+(e[1]>0?' ▲ ENTERS TOP 50':' ▼ LEAVES TOP 50')+'</div>';}).join('');}
  var scrubbing=false;
  // mode: 'play' (clock tick), 'step' (button), 'scrub' (slider drag, short glide to the fractional pose), 'jump' (window start, no glide)
  function rpSeek(p,mode){rp.p=clamp(p,rp.d0,rp.d1); var nd=Math.floor(rp.p+1e-6), flash=mode==='play'||mode==='step';
    if(flash&&nd>rp.lastDay&&rp.lastDay>=rp.d0){for(var d=rp.lastDay+1;d<=nd;d++){var ups=0,dns=0;for(var i=0;i<Mact;i++){var a=RP.v[i*RP.nd+d-1],b=RP.v[i*RP.nd+d],ra=a<0?1e9:Math.floor(a/100),rb=b<0?1e9:Math.floor(b/100);
        if(rb<=50&&ra>50){fl[i]=1;flS[i]=1;ups++;rp.events.push([info[i].t,1,RP.dates[d]]);} else if(ra<=50&&rb>50){fl[i]=1;flS[i]=-1;dns++;rp.events.push([info[i].t,-1,RP.dates[d]]);}}
      if(ups) snd('up',cfg); else if(dns) snd('dn',cfg); else snd('tick',cfg);} if(rp.events.length>30) rp.events=rp.events.slice(-30);}
    if(mode==='scrub'){gRetarget('scrub',fracFn(rp.p)); rp.gday=-1;}
    else if(mode==='jump'){gJump(nd); rp.gday=nd;}
    else if(nd!==rp.gday){gRetarget(mode,dayFn(nd)); rp.gday=nd;}
    if(nd!==rp.lastDay){rp.lastDay=nd; rpReadout(); if(sel>=0) fillCo();} need();}
  function rpStart(){capAbort(); if(op.t>=0){closeTier(); opDone();} rp.on=true; rp.done=false; rp.sumP=false; rp.events=[]; winRange(); rp.p=rp.d0; rp.lastDay=rp.d0; rp.play=true; Mact=N+RP.nx; sumC.classList.remove('on');
    for(var i=N;i<Mact;i++){al[i]=0;} firstRanks(); gJump(rp.d0); rpHTML(); var sc=rpBar.querySelector('.rp-scrub input'); sc.min=String(rp.d0); sc.max=String(rp.d1); sc.value=String(rp.p);
    rpBar.querySelector('.rp-ends .a').textContent=RP.dates[rp.d0]; rpBar.querySelector('.rp-ends .b').textContent=RP.dates[rp.d1];
    pSeg.visible=rp.paths; rpBar.hidden=false; tm.hidden=false; ctl.hidden=true; if(clBox) clBox.hidden=true; root.classList.add('replay'); rpB.classList.add('on'); rpB.setAttribute('aria-pressed','true');
    setTargets(); rpReadout(); snd('play',cfg); labelsState(); need();}
  function rpStop(){rp.on=false; rp.play=false; rp.sumP=false; Mact=N; for(var i=0;i<N;i++){grp[i]=info[i].g; ty[i]=info[i].g; rf[i]=rfrac(info[i].k,D.universe,info[i].g)+jit[i]; dia[i]=0.1+0.29*Math.max(0,1-Math.log(info[i].k)/lnU); fl[i]=0;}
    if(sel>=N) select(-1); pSeg.visible=false; rpBar.hidden=true; tm.hidden=true; ctl.hidden=false; sumC.classList.remove('on'); root.classList.remove('replay'); rpB.classList.remove('on'); rpB.setAttribute('aria-pressed','false'); labelsState(); setTargets(); if(sel>=0) fillCo(); need();}
  function rpSummary(){var d0=rp.d0,d1=rp.d1,L=[],ins=0,outs=0;
    for(var i=0;i<Mact;i++){var a=RP.v[i*RP.nd+d0],b=RP.v[i*RP.nd+d1];var ra=a<0?null:Math.floor(a/100),rb=b<0?null:Math.floor(b/100);
      if(rb!=null&&rb<=50&&(ra==null||ra>50)) ins++; if(ra!=null&&ra<=50&&(rb==null||rb>50)) outs++;
      if(ra!=null&&rb!=null) L.push([i,Math.log(ra/rb),ra,rb]);}
    L.sort(function(x,y){return y[1]-x[1];}); var up=L.slice(0,5), dn=L.slice(-5).reverse().filter(function(x){return x[1]<0;});
    function row(x){var s=info[x[0]],c=x[2]-x[3],st=rpState(x[0],d1)||{g:grp[x[0]]};return '<button type="button" data-i="'+x[0]+'" style="--c:'+tcss(st.g)+'"><b>'+esc(s.t)+'</b><span>#'+x[2]+' → #'+x[3]+'</span><i class="'+(c>0?'up':'dn')+'">'+(c>0?'▲':'▼')+Math.abs(c)+'</i></button>';}
    sumC.innerHTML='<div class="s-hd"><b>REPLAY COMPLETE</b><span>'+esc(rp.win.toUpperCase())+' · '+esc(RP.dates[d0])+' → '+esc(RP.dates[d1])+' · '+(d1-d0)+' SESSIONS</span></div>'+
      '<div class="s-cols"><div><div class="s-g up">BIGGEST CLIMBERS</div>'+up.map(row).join('')+'</div><div><div class="s-g dn">BIGGEST FALLERS</div>'+(dn.map(row).join('')||'<em>none</em>')+'</div></div>'+
      '<div class="s-ft">TOP 50: <b class="up">+'+ins+'</b> entered · <b class="dn">−'+outs+'</b> left · ranked by relative climb ln(rank then ÷ rank now)</div>'+
      '<div class="s-bt"><button type="button" class="s-again">↻ REPLAY</button><button type="button" class="s-close">CLOSE</button></div>';
    sumC.classList.add('on'); snd('end',cfg);}
  sumC.addEventListener('click',function(e){var b=e.target.closest('button'); if(!b) return;
    if(b.classList.contains('s-again')){sumC.classList.remove('on'); rp.events=[]; rp.lastDay=rp.d0; rp.sumP=false; rpSeek(rp.d0,'jump'); rp.play=true; if(frozen) setFreeze(false); rp.done=false; rpReadout(); return;}
    if(b.classList.contains('s-close')){sumC.classList.remove('on'); return;}
    var i=b.getAttribute('data-i'); if(i!=null){sumC.classList.remove('on'); render(0); select(+i);}});
  ['pointerdown','touchstart'].forEach(function(ev){sumC.addEventListener(ev,function(e){e.stopPropagation();},{passive:true});});
  rpBar.addEventListener('click',function(e){var b=e.target.closest('button'); if(!b||b.disabled) return; snd('click',cfg);
    var w=b.getAttribute('data-rw'); if(w){rp.win=w; rpStart(); return;}
    if(b.classList.contains('rp-exit')){rpStop(); return;}
    if(b.classList.contains('rp-paths')){rp.paths=!rp.paths; b.classList.toggle('on',rp.paths); b.setAttribute('aria-pressed',String(rp.paths)); pSeg.visible=rp.paths; need(); return;}
    if(b.classList.contains('rp-play')){if(rp.p>=rp.d1-1e-6){rp.events=[]; rp.lastDay=rp.d0; rp.sumP=false; rpSeek(rp.d0,'jump');} rp.play=!rp.play; if(rp.play&&frozen) setFreeze(false); sumC.classList.remove('on'); rpReadout(); return;}
    var st=b.getAttribute('data-st'); if(st){rp.play=false; var t=+st>0?Math.floor(rp.p+1e-6)+1:Math.ceil(rp.p-1e-6)-1; rpSeek(t,'step'); rpReadout(); if(rp.p>=rp.d1) rp.sumP=true; return;}
    var sp=b.getAttribute('data-sp'); if(sp){rp.spd=+sp; rpBar.querySelectorAll('.rp-spd button').forEach(function(x){x.classList.toggle('on',x===b);});}});
  rpBar.addEventListener('input',function(e){if(e.target.type!=='range') return;
    if(e.target.classList.contains('rp-gt')){cfg.glide=clamp(+e.target.value,0.6,4); e.target.parentNode.querySelector('output').textContent=cfg.glide.toFixed(1)+' s/day'; saveCfg(cfg); return;}
    scrubbing=true; rp.play=false; var v=+e.target.value; if(v<rp.lastDay){rp.lastDay=Math.floor(v);} rpSeek(v,'scrub'); rpReadout();});
  rpBar.addEventListener('change',function(e){if(e.target.type==='range'&&!e.target.classList.contains('rp-gt')){scrubbing=false; rp.lastDay=Math.floor(rp.p+1e-6);}});
  function loadRP(){if(RP) return Promise.resolve(RP); rpB.classList.add('busy');
    return fetch(rpSrc,{cache:'no-cache'}).then(function(r){if(!r.ok) throw new Error('replay '+r.status); return r.json();}).then(function(J){
      var A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', w=J.w, nd=J.dates.length, nx=Math.min(J.roster.length-J.n_main,XC), n=N+nx, v=new Int32Array(n*nd);
      for(var i=0;i<n;i++){var s=J.d[i]||'';var tkr=J.roster[i];
        for(var d=0;d<nd;d++){var c=s.substr(d*w,w),x=0; if(c.length<w||c.charAt(0)==='.'){v[i*nd+d]=-1;continue;} for(var j=0;j<w;j++) x=x*64+A.indexOf(c.charAt(j)); v[i*nd+d]=x;}
        if(i>=N){var nm=(J.names||{})[tkr]||[]; info[i]={t:tkr,n:nm[0]||'',ind:'',g:nm[2]!=null?tierOf(nm[2]):4,k:nm[1]||D.universe,rs:nm[2],h:[],c:[null,null,null],p:[null,null,null],m:[0,0,0],x:1}; byT[tkr]=i;
          jit[i]=(hash(tkr)-0.5)*0.05; ang[i]=hash(tkr+'a')*6.2832; al[i]=alT[i]=0; sm[i]=smT[i]=1; om[i]=omT[i]=BASE*0.6; grp[i]=info[i].g; ty[i]=grp[i]; rf[i]=0.8; dia[i]=0.15;}}
      // keep J.roster order for the live names (same order as data/rs_orbital.json) - verify
      for(i=0;i<N;i++){if(J.roster[i]!==info[i].t) throw new Error('replay roster mismatch');}
      RP={dates:J.dates,N:J.N,nd:nd,nx:nx,v:v}; rpB.classList.remove('busy'); return RP;});}
  rpB.addEventListener('click',function(){snd('click',cfg); if(rp.on){rpStop();return;} loadRP().then(function(){openDr(false); rpStart();}).catch(function(e){rpB.classList.remove('busy'); rpB.classList.add('err'); if(window.console) console.warn('rs_orbital replay: '+(e&&e.message));});});


  // ---------------------------------------------------------------- open a tier (tap its label / long-press its ring)
  var tSrc=root.getAttribute('data-tiers'), TL=null;
  var tp=document.createElement('div'); tp.className='rso-tp'; tp.hidden=true; stage.parentNode.insertBefore(tp,ctl);
  var backB=document.createElement('button'); backB.type='button'; backB.className='rso-cb back'; backB.innerHTML='<i>✕</i>SHOW ALL'; backB.setAttribute('aria-label','Show all orbits'); backB.hidden=true; cb.insertBefore(backB,hudB);
  backB.addEventListener('click',function(){closeTier();});
  labels.forEach(function(e,t){var h=e.querySelector('.hit'); h.setAttribute('role','button'); h.setAttribute('tabindex','0'); h.setAttribute('aria-label','Open '+TIERS[t].label);
    h.insertAdjacentHTML('afterbegin','<u>⊕</u>');
    h.addEventListener('click',function(ev){ev.stopPropagation(); if(op.t===t&&op.target>0) closeTier(); else openTier(t);});
    h.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault(); h.click();}});});
  function labelsState(){labels.forEach(function(e,t){e.classList.toggle('open',op.t===t&&op.target>0); e.classList.toggle('off',rp.on||(op.t>=0&&op.target>0&&t!==op.t));}); soSync();}
  function ringAt(x,y,lim){var best=-1,bd=lim||30,o=new Float32Array(3);cY=Math.cos(yaw);sY=Math.sin(yaw);
    for(var t=0;t<TIERS.length;t++){for(var j=0;j<180;j++){W3(1.0,t,j/180*6.2832,0,o); v.set(o[0],o[1],o[2]).project(cam); var d=Math.hypot((v.x*0.5+0.5)*W-x,(-v.y*0.5+0.5)*H-y); if(d<bd){bd=d;best=t;}}}
    return best;}
  function setE(x){op.E=clamp(x,1,2.6); var sl=tp.querySelector('input[type=range]'), o=tp.querySelector('output'); if(sl) sl.value=String(op.E); if(o) o.textContent=op.E.toFixed(2)+'×'; need();}
  function loadTL(){if(TL) return Promise.resolve(TL); return fetch(tSrc,{cache:'no-cache'}).then(function(r){if(!r.ok) throw new Error('tiers '+r.status); return r.json();}).then(function(J){TL=J.tiers; return TL;});}
  var shownN=0;
  function rowsHTML(t,from,to){var L=TL[t]||[],h='';for(var j=from;j<Math.min(to,L.length);j++){var r=L[j],i=byT[r[0]],c=r[3];
      h+='<div class="tr'+(i!=null&&i<N?' sp':'')+'"><button type="button" class="tsel"'+(i!=null&&i<N?' data-i="'+i+'"':' disabled')+'><span class="rk">#'+r[1]+'</span><b>'+esc(r[0])+'</b><small>'+esc(r[4])+'</small></button>'+
        '<span class="rs">'+r[2]+'</span><span class="cg '+(c==null?'nw':c>0?'up':c<0?'dn':'eq')+'">'+(c==null?'NEW':c>0?'▲'+c:c<0?'▼'+(-c):'=')+'</span>'+
        '<a class="ch" href="stock.html?t='+encodeURIComponent(r[0])+'" aria-label="Chart '+esc(r[0])+'">CHART ›</a></div>';}
    return h;}
  function fillTP(t){var T=TIERS[t], col=cfg.c[t];
    tp.style.setProperty('--c',col);
    tp.innerHTML='<div class="tp-hd"><button type="button" class="tp-back" aria-label="Show all orbits">✕ SHOW ALL</button><div class="tp-t"><b>'+esc(T.label)+'</b><span>'+T.shown+' SPHERES · '+T.total.toLocaleString()+' NAMES IN TIER · #'+T.rank_lo+'–#'+T.rank_hi+'</span></div></div>'+
      '<label class="tp-s"><span>RING STRETCH <em>· or pinch the ring</em></span><output>'+op.E.toFixed(2)+'×</output><input type="range" min="1" max="2.6" step="0.01" value="'+op.E+'" aria-label="Ring stretch"></label>'+
      '<div class="tp-cols"><span>RANK · TICKER</span><span>RS</span><span>1W</span><span></span></div><div class="tp-list" tabindex="0"><div class="tp-ld">LOADING TIER…</div></div>';
    loadTL().then(function(){if(op.t!==t) return; shownN=Math.min(150,TL[t].length); var l=tp.querySelector('.tp-list'); l.innerHTML=rowsHTML(t,0,shownN)+more(t);}).catch(function(){var l=tp.querySelector('.tp-list'); if(l) l.innerHTML='<div class="tp-ld">tier list unavailable</div>';});}
  function more(t){var n=TL[t].length-shownN; return n>0?'<button type="button" class="tp-more">SHOW '+Math.min(150,n)+' MORE · '+n.toLocaleString()+' LEFT</button>':'';}
  tp.addEventListener('click',function(e){var b=e.target.closest('button'); if(!b) return;
    if(b.classList.contains('tp-back')){closeTier(); return;}
    if(b.classList.contains('tp-more')){var t=op.t, a=shownN; shownN=Math.min(TL[t].length,shownN+150); b.insertAdjacentHTML('beforebegin',rowsHTML(t,a,shownN)); var m2=more(t); if(m2) b.insertAdjacentHTML('beforebegin',m2); b.remove(); return;}
    var i=b.getAttribute('data-i'); if(i!=null){i=+i; render(0); select(i); try{stage.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(_){} }});
  tp.addEventListener('input',function(e){if(e.target.type==='range') setE(+e.target.value);});
  function openTier(t,asFocus){if(rp.on||bh.on) return; if(dr.classList.contains('on')) openDr(false);
    if(sel>=0&&grp[sel]!==t) select(-1);
    if(op.t<0) op.pre={E:op.E,zoom:zoom}; op.t=t; op.target=1; cfg.solo=t; saveCfg(cfg); root.classList.add('solo'); op.focus=!!asFocus; op.E=asFocus?Math.max(op.E,1.85):op.E; if(RM) op.k=1; snd('sel',cfg);
    if(asFocus){cfg.orb.forEach(function(o,i){/* keep user's on-flags; focus dims others in upd */}); fillTPFocus(t);} else fillTP(t);
    tp.hidden=false; ctl.hidden=true; if(clBox) clBox.hidden=true; backB.hidden=false; rpB.hidden=true;
    root.classList.add('tieropen'); root.classList.toggle('tierfocus',!!asFocus); labelsState(); orbSync(); need();}
  function openFocus(t){if(!orbOn(t)){cfg.orb[t].on=true; applyCfg(true);} openTier(t,true);}
  function fillTPFocus(t){var T=TIERS[t], col=cfg.c[t];
    tp.style.setProperty('--c',col);
    tp.innerHTML='<div class="tp-hd"><button type="button" class="tp-back" aria-label="Show all orbits">✕ SHOW ALL</button><div class="tp-t"><b>FOCUS · '+esc(T.label)+'</b><span>laid out by RS score · high RS farther out · pinch to stretch</span></div></div>'+      '<label class="tp-s"><span>RING STRETCH <em>· or pinch</em></span><output>'+op.E.toFixed(2)+'×</output><input type="range" min="1" max="2.6" step="0.01" value="'+op.E+'" aria-label="Ring stretch"></label>'+      '<div class="tp-focnote">Every sphere in this orbit is tagged. Tap a planet for its callout. SHOW ALL (or Esc) restores the full view.</div>';}
  function opDone(){op.k=0; op.t=-1; op.focus=false; if(op.pre){op.E=op.pre.E; zoom=op.pre.zoom; op.pre=null;} root.classList.remove('tierfocus'); orbSync();}
  function closeTier(){if(op.t<0) return; op.target=0; cfg.solo=-1; saveCfg(cfg); root.classList.remove('solo'); if(RM) opDone(); snd('tog',cfg); tp.hidden=true; ctl.hidden=false; backB.hidden=true; rpB.hidden=false;
    if(clBox&&climb) clBox.hidden=false; root.classList.remove('tieropen'); root.classList.remove('tierfocus'); labelsState(); need();}
  // ---------------------------------------------------------------- SOLO ORBIT bar + V-STRETCH (7 Oct 2026)
  var sob=document.createElement('div'); sob.className='rso-solo'; stage.parentNode.insertBefore(sob,stage.nextSibling);
  sob.innerHTML='<div class="so-r1"><span class="so-lb">◎ SOLO ORBIT</span><span class="so-st" aria-live="polite">ALL ORBITS</span></div>'+
    '<div class="so-btns" role="group" aria-label="Show only one orbit"><button type="button" class="all" data-so="-1" aria-pressed="true">ALL</button>'+
    TIERS.map(function(T,t){return '<button type="button" data-so="'+t+'" aria-pressed="false" aria-label="Solo '+esc(T.label)+'" style="--c:'+cfg.c[t]+'">'+esc(shortLab(t))+'</button>';}).join('')+'</div>'+
    '<label class="so-vs"><span>↕ V-STRETCH</span><input type="range" min="1" max="8" step="0.01" value="'+cfg.vs+'" aria-label="Vertical stretch of the solo orbit, 1x to 8x"><output>'+cfg.vs.toFixed(2)+'×</output></label>'+
    '<div class="so-hint"></div>';
  var soIn=sob.querySelector('input'), soOut=sob.querySelector('output'), soSt=sob.querySelector('.so-st'), soHint=sob.querySelector('.so-hint');
  function soOpen(){return op.t>=0&&op.target>0?op.t:-1;}
  function soSync(){var t=soOpen();
    sob.querySelectorAll('[data-so]').forEach(function(b){var v=+b.getAttribute('data-so'), on=v===t; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); if(v>=0) b.style.setProperty('--c',cfg.c[v]);});
    sob.style.setProperty('--c',t>=0?cfg.c[t]:cfg.beam); sob.classList.toggle('act',t>=0);
    soSt.textContent=t>=0?'SOLO · '+TIERS[t].label+' · '+TIERS[t].shown+' PLANETS':'ALL ORBITS';
    if(document.activeElement!==soIn) soIn.value=String(cfg.vs); soOut.textContent=cfg.vs.toFixed(2)+'×';
    soHint.textContent=t>=0?'Drag V-STRETCH to pull the planets apart (best rank on top) · clear: ALL · SHOW ALL · Esc · tap '+shortLab(t)+' again':
      'Pick a ring above, tap a ring line or its label to show only that orbit · V-STRETCH applies to the solo orbit';}
  function soloOrbit(t){if(rp.on||bh.on) return; if(t<0){closeTier(); return;} if(op.t===t&&op.target>0){closeTier(); return;}
    if(!orbOn(t)){cfg.orb[t].on=true; applyCfg(true);} if(op.t>=0&&op.t!==t){closeTier(); opDone();} openTier(t);}
  sob.addEventListener('click',function(e){var b=e.target.closest('button[data-so]'); if(!b) return; soloOrbit(+b.getAttribute('data-so'));});
  sob.addEventListener('input',function(e){if(e.target!==soIn) return; cfg.vs=clamp(Math.round(+soIn.value*100)/100,1,8); soOut.textContent=cfg.vs.toFixed(2)+'×'; saveCfg(cfg); need();});
  sob.addEventListener('change',function(e){if(e.target!==soIn) return; try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch(_){}});
  document.addEventListener('keydown',function(e){if(e.key!=='Escape') return; var tg=e.target, tn=tg&&tg.tagName;
    if(tn==='INPUT'&&tg.type!=='range'||tn==='TEXTAREA') return;
    if(sel>=0){select(-1); e.preventDefault();} else if(op.t>=0&&op.target>0){closeTier(); e.preventDefault();}});
  soSync();
  // ---------------------------------------------------------------- BLACK HOLE (fun ride; exact restore)
  bh.next=0; bh.yaw0=bh.pitch0=bh.zoom0=bh.cx=0;
  // accretion disk + event-horizon disc (capped particle count for iPhone)
  var bhG=new THREE.Group(); scene.add(bhG); bhG.visible=false;
  (function(){var n=220,P=new Float32Array(n*3),S=new Float32Array(n),C=new Float32Array(n*3),Ph=new Float32Array(n);
    for(var i=0;i<n;i++){var a=Math.random()*6.2832,rr=0.55+Math.random()*1.35+(i%7===0?0.9:0); P[i*3]=Math.cos(a)*rr;P[i*3+1]=(Math.random()-0.5)*0.08;P[i*3+2]=Math.sin(a)*rr;
      S[i]=0.09+Math.random()*0.14; Ph[i]=Math.random()*6.28; var hot=Math.random(); C[i*3]=0.85+0.15*hot; C[i*3+1]=0.35+0.55*hot; C[i*3+2]=0.05+0.35*(1-hot);}
    var g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(P,3)); g.setAttribute('aS',new THREE.BufferAttribute(S,1));
    g.setAttribute('aC',new THREE.BufferAttribute(C,3)); g.setAttribute('aPh',new THREE.BufferAttribute(Ph,1));
    var m=mat('attribute float aS;attribute vec3 aC;attribute float aPh;uniform float uTime;uniform float uScale;uniform float uK;uniform float uPS;varying vec3 vC;'+'void main(){float an=aPh+uTime*(0.9+aPh*0.4);vec3 p=position; float r=length(p.xz); p.xz=vec2(cos(an)*r,sin(an)*r);'+      'vec4 mv=modelViewMatrix*vec4(p,1.0);gl_PointSize=max(2.0*uPS,aS*(1.4+3.5*uK)*uPS*uScale/(-mv.z));vC=aC*(0.7+0.6*uK);gl_Position=projectionMatrix*mv;}',
      'varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*exp(-r*2.8),1.0);}',{uK:{value:0},uPS:{value:1}});
    var pts=new THREE.Points(g,m); pts.frustumCulled=false; bhG.add(pts); bh.acc=pts; bh.uK=m.uniforms.uK; bh.uPS=m.uniforms.uPS;   /* uPS: sprite scale, 1 for the ride, = group scale for CAPTURE */
    var hm=mat('varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      'uniform float uK;varying vec2 vU;void main(){vec2 p=vU*2.0-1.0;float r=length(p);if(r>1.0)discard; float core=smoothstep(0.55,0.0,r); float rim=exp(-pow((r-0.72)/0.08,2.0))*1.2*uK; float lens=exp(-pow((r-0.9)/0.05,2.0))*0.7*uK;'+      'vec3 col=vec3(0.0)+vec3(1.0,0.55,0.15)*rim+vec3(0.6,0.85,1.0)*lens; gl_FragColor=vec4(col,1.0)*step(0.001,core+rim+lens);}',{uK:{value:0}},THREE.AdditiveBlending);
    var disc=new THREE.Mesh(new THREE.PlaneGeometry(4.4,4.4),hm); disc.rotation.x=-Math.PI/2; disc.renderOrder=8; bhG.add(disc); bh.disc=disc; bh.dU=hm.uniforms.uK;
    // dark core (opaque black via custom shader — MeshBasicMaterial is not in our tree-shaken Three bundle)
    var cm=mat('void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}','void main(){gl_FragColor=vec4(0.0,0.0,0.0,1.0);}',{},THREE.NormalBlending); cm.transparent=false; cm.depthWrite=true; cm.depthTest=true; cm.blending=THREE.NormalBlending;
    var core=new THREE.Mesh(new THREE.SphereGeometry(0.7,24,16),cm); core.renderOrder=9; bhG.add(core); bh.core=core;
    if(bh.acc) bh.acc.renderOrder=7;})();
  function bhArm(){if(!cfg.bhAuto||RM){bh.next=1e18; return;} var lo=cfg.bhMin*60, hi=cfg.bhMax*60; bh.next=tNow+lo+Math.random()*Math.max(1,hi-lo);}
  bh.arm=bhArm;
  function bhTrigger(){if(bh.on||RM) return; if(cap.on){cap.pendingRide=true; return;} if(rp.on&&rp.play) rp.play=false;
    bh.on=true; bh.t=0; bh.t0=performance.now(); bh.dur=8+Math.random()*4; bh.phase=0; bh.k=0;
    bh.yaw0=yaw; bh.pitch0=pitch; bh.zoom0=zoom; bh.cx=cyC;
    // drift in from a side
    var side=Math.random()<0.5?-1:1; bh.x0=side*(R*cfg.sx*1.7+2); bh.y0=tierY(1)+(Math.random()-0.5)*1.2; bh.z0=(Math.random()-0.5)*2;
    bh.x1=0; bh.y1=cyC; bh.z1=0; bh.x=bh.x0; bh.y=bh.y0; bh.z=bh.z0;
    bhG.visible=true; root.classList.add('bhole'); snd('end',cfg); need();}
  bh.trigger=bhTrigger;
  function bhStep(dt){if(!bh.on){if(cfg.bhAuto&&!RM&&tNow>=bh.next&&!cap.on) bhTrigger(); return;}
    // wall-clock so the ride always lasts 8–12s even when the tab is at 10fps
    bh.t=(performance.now()-bh.t0)/1000; var u=clamp(bh.t/bh.dur,0,1);
    // phases: 0-0.22 drift in, 0.22-0.55 pull+swirl, 0.55-0.72 dive, 0.72-1 restore
    var kin, pout;
    if(u<0.22){kin=sstep(u/0.22); bh.k=0.15+0.55*kin; bh.x=bh.x0+(bh.x1-bh.x0)*kin; bh.y=bh.y0+(bh.y1-bh.y0)*kin; bh.z=bh.z0+(bh.z1-bh.z0)*kin;}
    else if(u<0.55){kin=sstep((u-0.22)/0.33); bh.k=0.7+0.3*kin; bh.x=bh.x1; bh.y=bh.y1; bh.z=bh.z1; yaw+=dt*0.55*bh.k;}
    else if(u<0.72){kin=sstep((u-0.55)/0.17); bh.k=1; zoom=bh.zoom0*(1-0.55*kin); pitch=bh.pitch0+(0.95-bh.pitch0)*kin*0.5; yaw+=dt*1.4;}
    else{pout=sstep((u-0.72)/0.28); bh.k=1-pout; yaw=bh.yaw0+(yaw-bh.yaw0)*(1-pout*0.85); /* ease camera home */
      yaw+=(bh.yaw0-yaw)*Math.min(1,dt*2.2); pitch+=(bh.pitch0-pitch)*Math.min(1,dt*2.2); zoom+=(bh.zoom0-zoom)*Math.min(1,dt*2.2);}
    bhG.position.set(bh.x,bh.y,bh.z); bhG.scale.setScalar(1.1+1.6*bh.k); bhG.rotation.y+=dt*(0.6+1.5*bh.k);
    if(bh.uK) bh.uK.value=bh.k; if(bh.dU) bh.dU.value=bh.k;
    // lensing: subtle FOV pulse (restored at end)
    cam.fov=cfg.fov+(bh.k>0.4?(bh.k-0.4)*18:0); cam.updateProjectionMatrix();
    busyF=true; need();
    if(u>=1){bh.on=false; bh.k=0; bhG.visible=false; yaw=bh.yaw0; pitch=bh.pitch0; zoom=bh.zoom0; cam.fov=cfg.fov; cam.updateProjectionMatrix();
      root.classList.remove('bhole'); bh.arm(); bhSync(); need();}}
  bhArm();
  // ---------------------------------------------------------------- BLACK HOLE EVENTS (7 Oct 2026, reworked): the hole pulls the orbit LAYERS in, they come back from the far side
  //   Per layer t (capL[t], mirrored into the ring + dust uniforms capU[t]):  ph 1 = pulled in toward H (near parts lead -> rings smear toward the hole
  //   and spiral, a = progress)  ->  swallowed (hidden in transit)  ->  ph 2 = back out from E, just off the OPPOSITE edge (b = progress, osc = overshoot
  //   wobble)  ->  ph 0 = home.  ph 3 = gentle tidal tug for layers that are not taken.  Outer / low-RS layers start first and get pulled hardest (more
  //   lead + swirl); elite layers start later, pull in slower and stay more rigid.  capD (GLSL) / capD3 (JS) only displace the DRAWN pose, computed
  //   from the live orbit pose every frame, so orbits / RS data never change and every layer lands back in its exact slot.
  //   mode 'full' = every shown layer (main event: BLACK HOLE button, 1 in 3 random); 'part' = 1-2 outer layers (TRIGGER NOW, 2 in 3 random).
  //   The black hole itself is one screen-space quad (bhx): opaque shadow, photon ring, rotating doppler-beamed accretion disk whose far half is
  //   point-mass lensed over the top and into a thin secondary arc underneath, glow halo and (desktop) a lensed micro-starfield. Scene stars, dust,
  //   rings, planets and tails are lensed by the same point-mass map in their vertex shaders (lensP); project() mirrors it for tags + taps.
  var CAPF={rare:[120,240],normal:[45,90],chaos:[12,25]};
  var cap={on:false,mode:'part',clk:0,dur:12,wait:0,next:60,side:1,key:'',pendingRide:false,toast:0,A:0,fl:0,sw:2.2,hq:true,cx:0,cy:0,rs:40,tE:56,lz:0,fadeAt:9,tg0:0.6,tgD:6,go:[]};
  var capL=[0,1,2,3,4].map(function(){return {ph:0,a:0,b:0,osc:0,sw:1,lead:0.6,st:0,on:false,t0:0,ti:3,g:0.5,to:3,tug:0};});
  var capVis=new Float32Array(M).fill(1), COARSE=!!(window.matchMedia&&matchMedia('(pointer: coarse)').matches);
  var BHX_FS=['uniform float uA;uniform float uT;uniform float uF;uniform float uHQ;uniform float uPx;uniform float uSd;uniform vec4 uBQ;varying vec2 vQ;',
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}',
    'const float EI=0.17;const float RI=1.38;const float RO=4.6;const float TE=1.42;',
    // accretion disk seen almost edge-on; s = image-plane point (shadow radii), far = 1 for the half behind the hole
    'vec4 disk(vec2 s,float far){float sl=smoothstep(-0.06,0.06,s.y);sl=far>0.5?sl:1.0-sl;if(sl<0.001) return vec4(0.0);',
    ' vec2 d=vec2(s.x,s.y/EI);float r=length(d);if(r<RI*0.92||r>RO*1.08) return vec4(0.0);',
    ' float x=clamp((r-RI)/(RO-RI),0.0,1.0);float prof=smoothstep(RI*0.93,RI*1.1,r)*(1.0-smoothstep(RO*0.7,RO*1.06,r))*pow(RI/r,0.9);',
    ' float an=-uSd*uT*1.7/pow(r,1.5);float cs=cos(an),sn=sin(an);vec2 rd=vec2(d.x*cs-d.y*sn,d.x*sn+d.y*cs);',
    ' float n=vn(rd*2.2+7.0);if(uHQ>0.5) n=n*0.62+vn(rd*5.3-3.0)*0.38;',
    ' float ps=atan(rd.y,rd.x);float st=0.5+0.5*sin(r*17.0+2.2*sin(ps*3.0+r*1.7));float tex=0.4+0.6*n*(0.55+0.45*st);',
    ' float dp=clamp(1.0-0.6*uSd*d.x/r,0.25,1.75);float dop=dp*dp;',
    ' vec3 c=mix(vec3(1.0,0.97,0.88),vec3(1.0,0.62,0.2),smoothstep(0.0,0.38,x));c=mix(c,vec3(0.95,0.22,0.64),smoothstep(0.4,1.0,x));',
    ' c=mix(c,vec3(1.0,0.96,0.9),clamp((dop-1.0)*0.3,0.0,0.45));c=mix(c,vec3(0.85,0.22,0.42),clamp((1.0-dop)*0.5,0.0,0.4));',
    ' float I=prof*tex*dop*sl*1.35;return vec4(c*I,clamp(I*1.3,0.0,0.96));}',
    'void main(){vec2 q=vQ;float rho=length(q);float Q=uBQ.w;if(rho>Q) discard;',
    ' float win=1.0-smoothstep(Q*0.7,Q,rho);float m=smoothstep(1.0-uPx,1.0+uPx,rho);float ir=1.0/max(rho*rho,1e-4);',
    ' vec2 b=q*(1.0-TE*TE*ir);float mu=1.0/max(0.06,abs(1.0-TE*TE*TE*TE*ir*ir));',
    ' vec3 add=vec3(1.0,0.52,0.24)*(exp(-(rho-1.0)*1.25)*0.14+exp(-max(rho-1.0,0.0)*5.5)*0.2)*m*win;',
    ' if(uHQ>0.5){vec2 g=b*4.2;vec2 id=floor(g);float h=h21(id);vec2 o=vec2(h21(id+3.1),h21(id+7.7))*0.8+0.1;float dd=length(fract(g)-o);',
    '   add+=vec3(0.82,0.9,1.0)*step(0.8,h)*smoothstep(0.1,0.0,dd)*min(mu,4.0)*0.5*m*win;}',
    ' vec4 df=disk(b,1.0);add+=df.rgb*min(sqrt(mu),1.8)*m*win;',
    ' float pw=max(0.012,uPx*1.2);float pr=exp(-pow((rho-1.025)/pw,2.0))*1.5+exp(-pow((rho-1.08)/(pw*3.0),2.0))*0.3;',
    ' add+=vec3(1.0,0.85,0.6)*pr*(1.0+0.6*uF)*(1.0-0.35*uSd*q.x/max(rho,1e-3));',
    ' vec2 qn=q*(1.0-smoothstep(1.25,2.9,rho)*TE*TE*ir);vec4 dn=disk(qn,0.0)*win;',
    ' float al=1.0-m;vec3 col=(dn.rgb+add*(1.0-dn.a))*(1.0+0.5*uF);al=dn.a+al*(1.0-dn.a);',
    ' gl_FragColor=vec4(col*uA,al*uA);}'].join('\n');
  var bhxU={uBQ:{value:new Float32Array([0,0,40,5.4])},uA:{value:0},uT:{value:0},uF:{value:0},uHQ:{value:1},uPx:{value:0.02},uSd:{value:1}};
  var bhxM=mat('uniform vec2 uRes;uniform vec4 uBQ;varying vec2 vQ;void main(){vQ=position.xy*uBQ.w;vec2 p=uBQ.xy+vQ*uBQ.z;gl_Position=vec4(p/uRes*2.0-1.0,0.0,1.0);}',BHX_FS,bhxU,THREE.NormalBlending);
  bhxM.premultipliedAlpha=true;   // ONE, ONE_MINUS_SRC_ALPHA: glow adds, the shadow (alpha 1, colour 0) blocks what is behind it
  var bhx=new THREE.Mesh(new THREE.PlaneGeometry(2,2),bhxM); bhx.frustumCulled=false; bhx.renderOrder=50; bhx.visible=false; scene.add(bhx);
  var capT=document.createElement('div'); capT.className='rso-toast'; capT.setAttribute('role','status'); capT.setAttribute('aria-live','polite'); stage.appendChild(capT);
  function capToast(n){if(n===cap.toast) return; cap.toast=n; if(!n){capT.classList.remove('on'); return;}
    var full=cap.mode==='full', nm=cap.go.map(function(t){return esc(shortLab(t));}).join(' + ');
    capT.classList.toggle('sn',n<3); capT.classList.toggle('ok',n===3);
    capT.innerHTML=n===1?'🕳 <b>BLACK HOLE INBOUND…</b>'+(full?' the whole system is being pulled in':' '+nm+' ring'+(cap.go.length>1?'s':'')+' caught'):
      n===2?'<b>SWALLOWED</b> · flung round the far side…':'✓ <b>ORBITS RESTORED</b>';
    capT.classList.add('on');}
  function capArm(){var f=CAPF[cfg.capFreq]||CAPF.normal; cap.wait=0; cap.next=f[0]+Math.random()*(f[1]-f[0]);}
  function capSync(){var el=dr.querySelector('[data-k=capOn]'); if(el) el.checked=!!cfg.capOn; var key=cfg.capOn+'|'+cfg.capFreq; if(key!==cap.key){cap.key=key; capArm();}
    dr.querySelectorAll('.cap-now,.sn-now').forEach(function(b){b.classList.toggle('busy',cap.on);});}
  function capLab(t){if(!cap.on) return 1; var L=capL[t]; return L.ph===1?1-sstep(L.a*1.6):L.ph===2?sstep((L.b-0.55)/0.45):1;}
  function capTrigger(manual,mode){if(cap.on||rp.on||bh.on||(op.t>=0&&op.target===0)) return false;
    if(manual&&sel>=0) select(-1);
    var vis=[]; for(var t=4;t>=0;t--){if(orbOn(t)&&(op.t<0||t===op.t)) vis.push(t);}          // outermost (lowest RS) first
    if(!vis.length){capArm(); return false;}
    if(mode!=='full'&&mode!=='part') mode=Math.random()<1/3?'full':'part';
    var go=mode==='full'?vis:vis.slice(0,vis.length>1&&Math.random()<0.5?2:1), sp=mode==='full'?1.05+Math.random()*0.2:0.95+Math.random()*0.15, endIn=0, end=0;
    cap.mode=mode; cap.go=go; cap.side=Math.random()<0.5?-1:1; cap.clk=0; cap.A=0; cap.fl=0; cap.sw=0.6+Math.random()*0.25; cap.hq=!COARSE&&W>=700; capToast(0);
    capL.forEach(function(L){L.on=false; L.ph=0; L.a=L.b=L.osc=L.st=L.tug=0;});
    go.forEach(function(t,r){var L=capL[t]; L.on=true; L.t0=(1.0+0.72*r)*sp; L.ti=(2.5+0.42*r)*sp; L.g=0.5; L.to=(3.1+0.22*r)*sp;
      L.lead=0.55+0.1*t; L.sw=0.7+0.12*t; endIn=Math.max(endIn,L.t0+L.ti); end=Math.max(end,L.t0+L.ti+L.g+L.to);});
    vis.forEach(function(t){var L=capL[t]; if(L.on) return; L.tug=0.12+0.05*t; L.lead=0.35+0.1*t; L.sw=0.25+0.05*t;});
    cap.tg0=0.6; cap.tgD=endIn+0.6; cap.fadeAt=endIn+0.8; cap.dur=Math.max(end,cap.fadeAt+1.7)+1.4; bhxU.uT.value=0;
    capVis.fill(1); cap.on=true; snd('play',cfg); capSync(); need(); return true;}
  function capEnd(abort){cap.on=false; cap.A=0; cap.lz=0; cap.fl=0; U.uLens.value[3]=0; bhx.visible=false;
    capL.forEach(function(L,t){L.on=false; L.ph=0; L.a=L.b=L.osc=L.st=L.tug=0; capU[t].cl[0]=capU[t].cl[1]=capU[t].cl[2]=capU[t].cl[3]=0;}); capVis.fill(1);
    capToast(0); capArm(); capSync(); need();
    if(cap.pendingRide){cap.pendingRide=false; if(!abort) bhTrigger();}}
  function capAbort(){if(cap.on) capEnd(true);}
  function capStep(dt){
    if(!cap.on){if(cfg.capOn&&!RM&&!rp.on&&sel<0&&np===0&&!bh.on&&!frozen&&!(op.t>=0&&op.k>0&&op.k<1)){cap.wait+=dt; if(cap.wait>=cap.next) capTrigger(false);} return;}
    busyF=true; var run=sel<0&&np===0; if(run) cap.clk+=dt;      // paused while a planet box is open or the camera is being dragged
    var tc=cap.clk, fl=0; bhxU.uT.value+=dt;
    cap.A=sstep(tc/1.5)*(1-sstep((tc-cap.fadeAt)/1.7));
    capL.forEach(function(L,t){
      if(L.on){var u=tc-L.t0;
        if(u<=0){L.ph=0; L.st=0;}
        else if(u<L.ti){var s=u/L.ti; L.ph=1; L.a=Math.pow(s,1.7); L.st=sstep(s*1.6);}
        else if(u<L.ti+L.g){L.ph=2; L.b=0; L.osc=0; L.st=1;}
        else{var s2=(u-L.ti-L.g)/L.to; if(s2>=1){L.ph=0; L.st=0; L.a=L.b=L.osc=0;}
          else{L.ph=2; L.b=1-Math.pow(1-s2,2.4); var v2=clamp((s2-0.5)/0.5,0,1); L.osc=0.085*Math.sin(2*Math.PI*v2)*Math.pow(1-v2,1.5); L.st=1-sstep(s2*1.3);}}
        if(u>L.ti*0.85&&u<L.ti+1.6) fl=Math.max(fl,Math.exp(-Math.max(0,u-L.ti)*2.2)*sstep((u-0.85*L.ti)/(0.15*L.ti)));}
      else if(L.tug>0){var x=clamp((tc-cap.tg0)/cap.tgD,0,1); L.a=L.tug*Math.pow(Math.sin(Math.PI*x),2); L.ph=L.a>1e-4?3:0; L.st=0;}
      else L.ph=0;
      var c=capU[t].cl; c[0]=L.a; c[1]=L.b; c[2]=L.osc; c[3]=L.ph; capU[t].cx[0]=L.sw; capU[t].cx[1]=L.lead;});
    cap.fl=fl; bhxU.uF.value=fl;
    var L0=capL[cap.go[0]], LL=capL[cap.go[cap.go.length-1]], outS=L0.t0+L0.ti+L0.g*0.6, endL=LL.t0+LL.ti+LL.g+LL.to;
    capToast(tc<outS?1:tc<endL-0.9?2:3);
    if(tc>=cap.dur) capEnd(false);}
  // per frame (from placeCam, camera already placed): hole H at the chosen screen side, exit E just off the opposite edge, lens + quad uniforms
  function capGeo(ty0){if(!cap.on) return;
    var A=cap.A, tv=Math.tan(cam.fov*Math.PI/360), asp=W/H, p=cam.position, fx=-p.x, fy=ty0-p.y, fz=-p.z, fl=Math.sqrt(fx*fx+fy*fy+fz*fz); fx/=fl; fy/=fl; fz/=fl;
    var rl=Math.hypot(fz,fx)||1, rx=-fz/rl, rz=fx/rl, ux=-rz*fy, uy=rz*fx-rx*fz, uz=rx*fy;
    function at(nx,ny,o){var a=nx*tv*asp, b=ny*tv; o.set(p.x+(fx+rx*a+ux*b)*fl, p.y+(fy+uy*b)*fl, p.z+(fz+rz*a+uz*b)*fl);}
    var rs0=clamp(Math.min(W*0.12,H*0.115),30,84), rs=rs0*(0.3+0.7*sstep(A)); cap.rs=rs;
    cap.cx=cap.side>0?W-1.5*rs0:1.5*rs0; cap.cy=H*0.4;
    var ny=1-cap.cy/H*2; at(cap.cx/W*2-1,ny,CH); at(-cap.side*1.3,ny-0.08,CE);
    CX.set(p.x-CH.x,p.y-CH.y,p.z-CH.z).normalize();
    var R1=R*1.3*Math.max(cfg.sx,cfg.sz)*(op.t>=0?Math.max(1,op.E):1)+3.3*cfg.sy;
    CG[0]=cap.sw*cap.side; CG[1]=Math.hypot(CH.x,CH.y-ty0,CH.z)+R1; CG[2]=Math.hypot(CE.x,CE.y-ty0,CE.z)+R1; CG[3]=Math.max(1e-3,rs*2*fl*tv/H);
    cap.tE=1.42*rs; cap.lz=A;
    var LZ=U.uLens.value; LZ[0]=cap.cx*PR; LZ[1]=(H-cap.cy)*PR; LZ[2]=cap.tE*PR; LZ[3]=cap.lz;
    var q=bhxU.uBQ.value; q[0]=LZ[0]; q[1]=LZ[1]; q[2]=rs*PR; q[3]=5.4; bhxU.uPx.value=1/(rs*PR); bhxU.uA.value=A; bhxU.uSd.value=cap.side; bhxU.uHQ.value=cap.hq?1:0; bhx.visible=A>0.003;}
  // ---------------------------------------------------------------- frame
  var v=new THREE.Vector3(), w2=new THREE.Vector3(), vis=true, last=performance.now(), frames=0;
  function project(){var sc=H/(2*Math.tan(cam.fov*Math.PI/360)), mv=cam.matrixWorldInverse, cd=camD, lz=cap.on?cap.lz:0, lx=cap.cx, ly=cap.cy, tE=cap.tE;
    for(var i=0;i<Mact;i++){v.set(sP[i*3],sP[i*3+1],sP[i*3+2]); w2.copy(v).applyMatrix4(mv); sdep[i]=clamp((-w2.z-cd)/-R,-1.2,1.2);
      v.project(cam); sx[i]=(v.x*0.5+0.5)*W; sy[i]=(-v.y*0.5+0.5)*H; sr[i]=sS[i]*0.435*2.3*sc/(-w2.z)/2*1.15;
      if(lz>0){var dx=sx[i]-lx, dy=sy[i]-ly, b=Math.sqrt(dx*dx+dy*dy)+1e-3, th=0.5*(b+Math.sqrt(b*b+4*tE*tE)), nb=b+(th-b)*lz*(1-sstep((b-4*tE)/(7*tE))); sx[i]=lx+dx*nb/b; sy[i]=ly+dy*nb/b;}}}
  // SOLO: push overlapping ticker tags apart vertically (a few relaxation passes, capped so each tag stays next to its planet)
  function nudge(L){var h=18, cap=20+8*(cfg.vs-1), n=L.length; if(n<2) return; L.sort(function(a,b){return a.y-b.y;});
    for(var pass=0;pass<12;pass++){var moved=false;
      for(var a=0;a<n;a++){var A=L[a]; for(var b=a+1;b<n;b++){var B=L[b]; if(B.y-A.y>=h) break;
        if(A.x+A.w+2<=B.x||B.x+B.w+2<=A.x) continue; var ov=h-(B.y-A.y)+0.5; A.y-=ov/2; B.y+=ov/2; moved=true;}}
      for(var j=0;j<n;j++){var Q=L[j]; Q.y=clamp(Q.y,Q.y0-cap,Q.y0+cap);} L.sort(function(a,b){return a.y-b.y;}); if(!moved) break;}}
  function overlay(){var tl=cfg.tilt*Math.PI/180;
    TIERS.forEach(function(_,t){v.set(-R*Math.cos(tl)*cfg.sx*tsc(t),tierY(t)-R*Math.sin(tl),0).project(cam); var x=(v.x*0.5+0.5)*W, yy2=(-v.y*0.5+0.5)*H; labels[t].style.transform='translate('+Math.max(6,x-4).toFixed(0)+'px,'+(yy2-15).toFixed(0)+'px)';
      var lo=(op.t<0||t===op.t?1:1-op.k)*(orbOn(t)?1:0.2)*(cfg.orb[t].ring?1:0.35)*capLab(t); labels[t].style.opacity=String(lo); labels[t].classList.toggle('offorb',!orbOn(t));});
    var show={}, cl=climb&&!rp.on?(D.climbers[WIN[wi]]||[]):null;
    if(cl) cl.forEach(function(t){show[byT[t]]=1;});
    else if(rp.on&&RP){var d=curDay(),best=[];for(var i=0;i<Mact;i++){var s=rpState(i,d);if(s) best.push([s.rk,i]);} best.sort(function(a,b){return a[0]-b[0];}); best.slice(0,5).forEach(function(x){show[x[1]]=1;});
      for(i=0;i<Mact;i++){if(fl[i]>0.55) show[i]=1;}}
    else topIdx.forEach(function(i){show[i]=1;});
    if(op.t>=0&&op.k>0.3){for(var j=0;j<Mact;j++){if(grp[j]===op.t&&ea[j]>0.5) show[j]=1; else if(show[j]&&j!==sel) delete show[j];}}
    // hide tags for switched-off orbits
    for(var sj in show){if(!orbOn(grp[+sj])) delete show[sj];}
    if(sel>=0&&orbOn(grp[sel])) show[sel]=1;
    if(hov>=0&&ea[hov]>0.5) show[hov]=1;
    for(var k in tags){if(!show[k]){tags[k].style.opacity='0'; tags[k].classList.remove('hov');}}
    var solo=op.t>=0&&op.k>0.3&&!rp.on, LB=solo?[]:null;
    for(k in show){var i2=+k,e=tag(i2),fr=sdep[i2]; e.classList.toggle('cl',!!cl); e.classList.toggle('hov',i2===hov); e.style.setProperty('--c',tcss(grp[i2]));
      var inSolo=solo&&grp[i2]===op.t;
      e.style.opacity=String((al[i2]<0.05?0:(i2===sel||i2===hov||inSolo?Math.min(1,al[i2]*1.5)*(inSolo?Math.min(1,op.k*1.4):1):clamp(0.35+0.65*(fr+0.6),0.3,1)*Math.min(1,al[i2]*1.5)))*(cap.on?capVis[i2]:1));
      var tx=sx[i2]+sr[i2]*0.75+2, ty2=sy[i2]-sr[i2]*0.75-12;
      if(inSolo){var tw_=info[i2].t.length*6.6+11; LB.push({e:e,i:i2,x:clamp(tx,2,W-tw_-2),y:ty2,y0:ty2,w:tw_});} else e.style.transform='translate('+tx.toFixed(0)+'px,'+ty2.toFixed(0)+'px)';}
    if(LB){nudge(LB); LB.forEach(function(L){var pv=L.e._oy==null?L.y-L.y0:L.e._oy, oy=pv+((L.y-L.y0)-pv)*0.35; L.e._oy=oy;
      L.e.style.transform='translate('+L.x.toFixed(0)+'px,'+(L.y0+oy).toFixed(0)+'px)';});}
    for(k in tags){if(!(LB&&show[k]&&grp[+k]===op.t)) tags[k]._oy=null;}
    if(sel>=0){ret.style.transform='translate('+sx[sel].toFixed(1)+'px,'+sy[sel].toFixed(1)+'px)'; placeCo(false);}}
  var busyF=true;
  function render(dt){busyF=false;
    if(op.t>=0){var ok=op.k; op.k=RM?op.target:op.k+(op.target-op.k)*Math.min(1,dt*3.2); if(Math.abs(op.k-op.target)<0.02) op.k=op.target; if(op.target===0&&op.pre) zoom+=(op.pre.zoom-zoom)*Math.min(1,dt*4); if(op.k===0&&op.target===0){opDone(); labelsState();} if(op.k!==ok){need(); busyF=true;}}
    // BH runs in real time (ignores FREEZE / SIM SPEED) so the ride always finishes cleanly
    bhStep(dt); capStep(dt);
    var gS=frozen||bh.on?0:cfg.gspd, dS=dt*gS;
    if(rp.on&&rp.play&&dS>0){var np2=rp.p+dS*rp.spd/cfg.glide; if(np2>=rp.d1){rpSeek(rp.d1,'play'); rp.play=false; rp.done=true; rp.sumP=true; rpReadout();} else rpSeek(np2,'play');}
    if(rp.on){var er=effRate(); if(rp.gu<10) rp.gu=Math.min(10,rp.gu+dt*er); if(RM&&rp.gu<1) rp.gu=1; if(rp.gu<1&&er>0) busyF=true; if(rp.sumP&&rp.gu>=1){rp.sumP=false; rpSummary();}}
    if(!RM){tNow+=dt; U.uTime.value+=dS;
      var ar=(cfg.auto?0.05*cfg.autoSpd:0)*(op.t>=0?1-0.6*op.k:1)*gS;
      if(frozen&&np===0){yawV*=Math.pow(0.002,dt);} else if(tNow-lastUser>2.5&&np===0){yawV+=(ar-yawV)*Math.min(1,dt*0.8);} else if(np===0){yawV*=Math.pow(0.04,dt);}
      if(np===0) yaw+=yawV*dt; if(Math.abs(yawV)>2e-4) busyF=true;
      var e=Math.min(1,dt*3), spd=cfg.speed*(rp.on?0.5:1), ar2=rp.on?Math.min(1,dt*Math.max(0.6,effRate())*3.5):Math.min(1,dt*3);
      for(var i=0;i<Mact;i++){om[i]+=(omT[i]-om[i])*e; var da=alT[i]-al[i]; al[i]+=da*ar2; if(da>0.004||da<-0.004) busyF=true; sm[i]+=(smT[i]-sm[i])*e; ang[i]+=om[i]*dS*spd*(i===sel?0.15:1)*(op.t>=0?1-0.72*op.k:1); if(fl[i]>0) fl[i]=Math.max(0,fl[i]-dS*0.9);}
      core.rotation.y+=dS*0.25;}
    else{for(var j=0;j<Mact;j++){if(fl[j]>0) fl[j]=0;}}
    placeCam(); upd(dt); renderer.render(scene,cam); project(); overlay(); dirty=false; frames++;}
  function loop(now){requestAnimationFrame(loop); var dt=Math.min(0.05,(now-last)/1000); last=now;
    if(!running||!vis||document.hidden) return; if(RM&&!dirty&&!(rp.on&&rp.play)&&!bh.on&&!cap.on) return; if(frozen&&!RM&&!dirty&&!busyF&&!bh.on&&!cap.on) return; render(dt);}
  if('IntersectionObserver' in window){new IntersectionObserver(function(en){vis=en[0].isIntersecting; if(vis) need();},{rootMargin:'80px'}).observe(stage);}
  if('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize',resize);
  applyCfg(true); render(0);
  if(cfg.solo>=0){var st0=cfg.solo; soloOrbit(st0); if(op.t===st0){op.k=1; render(0);}}   // restore the last SOLO orbit (stretch is in cfg.vs)
  requestAnimationFrame(loop);
  root.classList.add('live');
  window.RSO={select:function(t){var i=byT[t]; if(i!=null){render(0); select(i);} return i;}, frames:function(){return frames;}, n:N,
    pos:function(t){var i=byT[t]; if(i==null) return null; var b=cv.getBoundingClientRect(); return {x:b.left+sx[i],y:b.top+sy[i],r:sr[i]};}, sel:function(){return sel<0?null:info[sel].t;},
    replay:function(){return {on:rp.on,p:rp.p,d0:rp.d0,d1:rp.d1,play:rp.play,date:RP?RP.dates[curDay()]:null,events:rp.events.length,gu:rp.gu,gm:rp.gm,spd:rp.spd,glide:cfg.glide};}, cfg:function(){return cfg;}, open:function(t){openTier(t);}, close:function(){closeTier();}, tier:function(){return {t:op.t,k:op.k,E:op.E,zoom:zoom,focus:op.focus};}, orb:function(){return cfg.orb.map(function(o){return {on:o.on,ring:o.ring,ringOp:o.ringOp,size:o.size};});},
    focus:function(t){openFocus(t);}, cap:function(){return {on:cap.on,mode:cap.mode,clk:cap.clk,dur:cap.dur,wait:cap.wait,next:cap.next,A:cap.A,side:cap.side,hq:cap.hq,go:cap.go.slice(),C:[cap.cx,cap.cy,cap.rs],fl:cap.fl,toast:cap.toast,layers:capL.map(function(L){return {ph:L.ph,a:L.a,b:L.b,osc:L.osc,on:L.on,tug:L.tug,t0:L.t0,ti:L.ti,g:L.g,to:L.to};})};}, capNow:function(m){return capTrigger(true,m==='full'||m==='all'?'full':'part');}, capStop:function(){capAbort();}, solo:function(t){if(t===undefined) return soOpen(); soloOrbit(t); return soOpen();}, vstretch:function(x){if(x!=null){cfg.vs=clamp(+x,1,8); saveCfg(cfg); soSync(); need();} return cfg.vs;}, bh:function(){return {on:bh.on,k:bh.k,t:bh.t,dur:bh.dur,next:bh.next,auto:cfg.bhAuto};}, bhNow:function(){bh.trigger();}, speed:function(){return {g:cfg.gspd,frozen:frozen,uTime:U.uTime.value};}, freeze:function(b){setFreeze(b);}, setSpeed:function(g){setGs(g);},
    movers:function(n){var L=[]; for(var i=0;i<Mact;i++){if(al[i]>0.5) L.push([Math.abs(G1[i*3+1]-G0[i*3+1])+Math.abs(G1[i*3]-G0[i*3]),info[i].t]);} L.sort(function(a,b){return b[0]-a[0];}); return L.slice(0,n||5);},
    ang:function(t){var i=byT[t]; return i==null?null:ang[i];}, gp:function(t){var i=byT[t]; if(i==null) return null; gEval(i,Math.min(rp.gu,1),gq); return {rf:gq.rf,ty:gq.ty,lk:gq.lk,G0:[G0[i*3],G0[i*3+1]],G1:[G1[i*3],G1[i*3+1]]};},
    ring:function(t){var o=new Float32Array(3),b=cv.getBoundingClientRect();cY=Math.cos(yaw);sY=Math.sin(yaw);W3(1.0,t,Math.PI/2+yaw,0,o);v.set(o[0],o[1],o[2]).project(cam);return {x:b.left+(v.x*0.5+0.5)*W,y:b.top+(-v.y*0.5+0.5)*H};},
    ringPt:function(t,a){var o=new Float32Array(3),b=cv.getBoundingClientRect();cY=Math.cos(yaw);sY=Math.sin(yaw);W3(1.0,t,a,0,o);v.set(o[0],o[1],o[2]).project(cam);return {x:b.left+(v.x*0.5+0.5)*W,y:b.top+(-v.y*0.5+0.5)*H};},
    tickers:function(){var L=[];for(var i=0;i<Mact;i++){if(ea[i]>0.5) L.push(info[i].t);} return L;},
    label:function(t){var r=labels[t].querySelector('.hit').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}};
}
})();
