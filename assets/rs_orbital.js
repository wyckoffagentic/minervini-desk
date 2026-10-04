/* rs_orbital.js - RELATIVE STRENGTH · ORBITAL (top of rs.html).
   Data:   data/rs_orbital.json (live view) + data/rs_orbital_replay.json (replay; loaded on first REPLAY tap), both written by
           research-tools/rs_orbital.py on every rs / daily / refresh run.  Desk RS calc, not IBD's official rating.
   Engine: Three.js r186, tree-shaken + vendored at assets/vendor/three-r186.orbital.min.js (MIT, no CDN).
   Encoding: ring = RS tier, sphere size = rank, orbit speed + trail length = rank change over 1D/1W/4W, radius in ring = rank inside the tier.
   HUD drawer: colours, presets, X/Y/Z stretch, tilt, sizes, trails, speed, glow, camera; saved in localStorage ('rso.cfg.v1').
   Replay: real sessions only (whatever rating_history.json covers at build time), scrub / play / step, Top-50 entry/exit flashes,
           path trails, end-of-window summary.  Touch: drag = rotate, pinch = zoom, tap = select.
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
  neon:   {name:'NEON',            c:['#ffd23f','#a8ff3e','#00e5ff','#b06bff','#ff2bd6'],beam:'#00e5ff',bg:'#03030d',trailTier:true, trailCol:'#ffffff'},
  mission:{name:'MISSION CONTROL', c:['#ffffff','#d6e6ff','#9cc2ff','#5b8cff','#3a5fc8'],beam:'#bfe0ff',bg:'#01040c',trailTier:false,trailCol:'#7fb2ff'},
  mars:   {name:'MARS',            c:['#ffe2b0','#ffb066','#ff7a3d','#e04a2a','#b8392a'],beam:'#ff9a5a',bg:'#0c0302',trailTier:true, trailCol:'#ff8a4c'}};
var DEF={theme:'neon',c:PRESETS.neon.c.slice(),beam:'#00e5ff',bg:'#03030d',trailTier:true,trailCol:'#ffffff',
  sx:1,sz:1,sy:1,tilt:0,size:1,trail:1,speed:1,glow:1,auto:true,autoSpd:1,fov:38,sound:false};
var KEY='rso.cfg.v1';
function loadCfg(){var c=JSON.parse(JSON.stringify(DEF));try{var s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object'){for(var k in DEF){if(s[k]!==undefined&&typeof s[k]===typeof DEF[k]) c[k]=s[k];}if(!Array.isArray(c.c)||c.c.length!==5) c.c=DEF.c.slice();}}catch(e){}return c;}
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
  var U={uTime:{value:0},uScale:{value:600},uGlow:{value:cfg.glow},uBeam:{value:hex(cfg.beam)}};
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
    var m=mat('attribute float aS;attribute vec3 aC;attribute float aPh;uniform float uTime;uniform float uPR;varying vec3 vC;'+
      'void main(){vC=aC*(0.65+0.35*sin(uTime*(0.6+aPh*0.25)+aPh*7.0));gl_PointSize=aS*uPR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      'varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*exp(-r*3.5),1.0);}',{uPR:{value:PR}});
    var pts=new THREE.Points(g,m); pts.frustumCulled=false; stars.add(pts);})();

  // ---------------------------------------------------------------- rings (tierG: y + stretch -> tiltG: tilt -> spinG: yaw)
  var ringMats=[], tierG=[], tiltG=[], spinG=[], dustMats=[], dustAttr=[];
  var RING_VS='varying vec2 vP;void main(){vP=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  var RING_FS=['uniform vec3 uColor;uniform float uR;uniform float uTime;uniform float uDim;uniform float uGlow;varying vec2 vP;',
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
    ' gl_FragColor=vec4(col*uDim,1.0);}'].join('\n');
  var DUST_VS='attribute float aR;attribute float aA;attribute float aY;attribute float aSp;attribute float aS;attribute float aB;uniform float uTime;uniform float uScale;uniform float uDim;uniform vec3 uColor;varying vec3 vC;'+
    'void main(){float an=aA+uTime*aSp;vec4 mv=modelViewMatrix*vec4(cos(an)*aR,aY,sin(an)*aR,1.0);gl_PointSize=max(1.5,aS*uScale/(-mv.z));vC=uColor*aB*uDim;gl_Position=projectionMatrix*mv;}';
  var DUST_FS='varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*exp(-r*2.5),1.0);}';
  TIERS.forEach(function(T,t){
    var a=new THREE.Group(), b=new THREE.Group(), c=new THREE.Group(); a.add(b); b.add(c); scene.add(a); tierG.push(a); tiltG.push(b); spinG.push(c);
    var g=new THREE.RingGeometry(R*0.45,R*1.2,192,1); g.rotateX(-Math.PI/2);
    var m=mat(RING_VS,RING_FS,{uColor:{value:TC[t]},uR:{value:R},uDim:{value:TDIM[t]}});
    ringMats.push(m); var me=new THREE.Mesh(g,m); me.frustumCulled=false; c.add(me);
    var n=Math.min(T.dust,1200), Rr=new Float32Array(n),A=new Float32Array(n),Y=new Float32Array(n),Sp=new Float32Array(n),S=new Float32Array(n),Bb=new Float32Array(n);
    for(var j=0;j<n;j++){var l=LANES[Math.floor(Math.random()*3)]; Rr[j]=R*(l+(Math.random()-0.5)*0.16+(Math.random()<0.25?(Math.random()-0.5)*0.4:0));
      A[j]=Math.random()*6.2832; Y[j]=(Math.random()-0.5)*0.07; Sp[j]=0.03+Math.random()*0.05; S[j]=0.03+Math.random()*0.035; Bb[j]=(0.2+Math.random()*0.28)*TDIM[t];}
    var dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(Math.max(n,1)*3),3));
    [['aR',Rr],['aA',A],['aY',Y],['aSp',Sp],['aS',S],['aB',Bb]].forEach(function(x){dg.setAttribute(x[0],new THREE.BufferAttribute(x[1],1));});
    var dm=mat(DUST_VS,DUST_FS,{uDim:{value:1},uColor:{value:TC[t]}}); dustMats.push(dm);
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
  var S=D.s, N=S.length, XC=200, M=N+XC, K=16, PK=64, lnU=Math.log(Math.max(D.universe,2));
  var ang=new Float32Array(M),rf=new Float32Array(M),ty=new Float32Array(M),om=new Float32Array(M),omT=new Float32Array(M),jit=new Float32Array(M);
  var dia=new Float32Array(M),al=new Float32Array(M),alT=new Float32Array(M),sm=new Float32Array(M),smT=new Float32Array(M),fl=new Float32Array(M),flS=new Float32Array(M),grp=new Int8Array(M);
  var info=[], byT={}, Mact=N;
  S.forEach(function(s,i){byT[s.t]=i; info[i]={t:s.t,n:s.n,ind:s.ind,g:s.g,k:s.k,rs:s.rs,tt:s.tt,h:s.h,c:s.c,p:s.p,m:s.m};
    jit[i]=(hash(s.t)-0.5)*0.05; grp[i]=s.g; ty[i]=s.g; rf[i]=rfrac(s.k,D.universe,s.g)+jit[i]; ang[i]=hash(s.t+'a')*6.2832;
    dia[i]=0.1+0.29*Math.max(0,1-Math.log(s.k)/lnU); al[i]=alT[i]=1; sm[i]=smT[i]=1;});
  var BASE=0.2;
  function omega(i){if(i>=N) return BASE*0.6; var m=info[i].m[wi]; return BASE*(m>=0?1+1.6*m:1+0.78*m);}
  for(var i0=0;i0<N;i0++){om[i0]=omT[i0]=omega(i0);}
  function buf(n,k){return new THREE.BufferAttribute(new Float32Array(n*k),k);}
  var sg=new THREE.BufferGeometry(); sg.setAttribute('position',buf(M,3)); sg.setAttribute('aS',buf(M,1)); sg.setAttribute('aC',buf(M,3)); sg.setAttribute('aF',buf(M,1));
  var sP=sg.attributes.position.array,sS=sg.attributes.aS.array,sC=sg.attributes.aC.array,sF=sg.attributes.aF.array;
  var sMat=mat('attribute float aS;attribute vec3 aC;attribute float aF;uniform float uScale;varying vec3 vC;varying float vF;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aS*2.3*uScale/(-mv.z);vC=aC;vF=aF;gl_Position=projectionMatrix*mv;}',
    ['uniform float uGlow;varying vec3 vC;varying float vF;void main(){vec2 p=gl_PointCoord*2.0-1.0;p.y=-p.y;float r=length(p);if(r>1.0)discard;float rc=0.435;vec3 c=vec3(0.0);',
     'float lum=max(vC.r,max(vC.g,vC.b));vec3 hue=lum>0.0?vC/lum:vC;hue=mix(hue,vec3(1.0),clamp(vF,0.0,1.0)*0.7);',
     'if(r<rc){vec2 q=p/rc;vec3 n=vec3(q,sqrt(max(0.0,1.0-dot(q,q))));vec3 L=normalize(vec3(-0.45,0.55,0.7));',
     ' float df=max(dot(n,L),0.0);float spc=pow(max(dot(reflect(-L,n),vec3(0.0,0.0,1.0)),0.0),24.0);float rim=pow(1.0-n.z,2.2);',
     ' c=(hue*(0.16+0.9*df)+hue*rim*0.8+vec3(1.0)*spc*0.8)*smoothstep(rc,rc-0.05,r)*lum;}',
     'float h=pow(1.0-smoothstep(rc*0.75,1.0,r),2.8)*0.28*uGlow;c+=hue*lum*h*(1.0+vF*2.0);gl_FragColor=vec4(c,1.0);}'].join('\n'));
  var sPts=new THREE.Points(sg,sMat); sPts.frustumCulled=false;
  var tg=new THREE.BufferGeometry(); tg.setAttribute('position',buf(M*K,3)); tg.setAttribute('aS',buf(M*K,1)); tg.setAttribute('aC',buf(M*K,3));
  var tP=tg.attributes.position.array,tS=tg.attributes.aS.array,tC=tg.attributes.aC.array;
  var tMat=mat('attribute float aS;attribute vec3 aC;uniform float uScale;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=max(1.0,aS*uScale/(-mv.z));vC=aC;gl_Position=projectionMatrix*mv;}',
    'uniform float uGlow;varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*exp(-r*3.2)*(0.5+0.5*uGlow),1.0);}');
  var tPts=new THREE.Points(tg,tMat); tPts.frustumCulled=false;
  var LS=K*2-2, lg=new THREE.BufferGeometry(); lg.setAttribute('position',buf(M*LS,3)); lg.setAttribute('aC',buf(M*LS,3));
  var lP=lg.attributes.position.array,lC=lg.attributes.aC.array;
  var LINE_VS='attribute vec3 aC;varying vec3 vC;void main(){vC=aC;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', LINE_FS='varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.0);}';
  var lSeg=new THREE.LineSegments(lg,mat(LINE_VS,LINE_FS)); lSeg.frustumCulled=false;
  var PS=PK*2, pg=new THREE.BufferGeometry(); pg.setAttribute('position',buf(M*PS,3)); pg.setAttribute('aC',buf(M*PS,3));
  var pP=pg.attributes.position.array,pC=pg.attributes.aC.array;
  var pSeg=new THREE.LineSegments(pg,mat(LINE_VS,LINE_FS)); pSeg.frustumCulled=false; pSeg.visible=false;
  var bg2=new THREE.BufferGeometry(); bg2.setAttribute('position',buf(M,3)); bg2.setAttribute('aS',buf(M,1)); bg2.setAttribute('aC',buf(M,3));
  var bP=bg2.attributes.position.array,bS=bg2.attributes.aS.array,bC=bg2.attributes.aC.array;
  var bPts=new THREE.Points(bg2,mat('attribute float aS;attribute vec3 aC;uniform float uScale;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aS*uScale/(-mv.z);vC=aC;gl_Position=projectionMatrix*mv;}',
    'varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=length(p);if(r>1.0)discard;float ring=exp(-pow((r-0.8)/0.07,2.0))+exp(-pow((r-0.55)/0.04,2.0))*0.4;gl_FragColor=vec4(vC*ring,1.0);}'));
  bPts.frustumCulled=false;
  scene.add(pSeg); scene.add(lSeg); scene.add(tPts); scene.add(sPts); scene.add(bPts);
  var sel=-1, yaw=0.5, pitch=0.34, zoom=1;
  // opened tier: op.t = tier (-1 none), op.k = 0..1 animation, op.E = ring stretch (slider / pinch)
  var op={t:-1,k:0,target:0,E:1.35}, PITCH_O=0.8, ea=new Float32Array(M);
  function tsc(t){if(op.t<0) return 1; return t===op.t?1+(op.E-1)*op.k:1-0.55*op.k;}
  var cY=1,sY=0,cT=1,sT=0;
  function W3(rf_,ty_,a,o,arr){var tt=ty_<0.5?0:ty_>3.5?4:Math.round(ty_); if(op.t>=0&&tt===op.t) rf_+=(0.3+(rf_-0.6)*1.75-rf_)*op.k; var r=R*rf_*tsc(tt),x=Math.cos(a)*r,z=Math.sin(a)*r,x1=x*cY+z*sY,z1=-x*sY+z*cY;arr[o]=x1*cT*cfg.sx;arr[o+1]=x1*sT+tierY(ty_);arr[o+2]=z1*cfg.sz;}
  function colOf(i){var g=grp[i];return TC[g<0?0:g];}
  var trailRGB=hex(cfg.trailCol);

  // ---------------------------------------------------------------- replay state
  var RP=null, rp={on:false,d0:0,d1:0,p:0,play:false,spd:1,paths:false,win:'1m',lastDay:-1,events:[],done:false};
  var RW=[['1w','1W',5],['1m','1M',21],['3m','3M',63],['6m','6M',126],['max','MAX',1e9]];
  function rpState(i,d){var v=RP.v[i*RP.nd+d]; if(v<0) return null; var rk=Math.floor(v/100), rs=v%100;
    var vis=i<N||rk<=50; return vis?{rk:rk,rs:rs,g:tierOf(rs),N:RP.N[d]}:null;}
  function rpPose(i,p,out){var a=Math.floor(p),b=Math.min(a+1,rp.d1),f=sstep(p-a),A=rpState(i,a),B=b===a?A:rpState(i,b);
    if(!A&&!B){out.a=0;return out;}
    var X=A||B, Y=B||A, rfA=rfrac(X.rk,X.N,X.g)+jit[i], rfB=rfrac(Y.rk,Y.N,Y.g)+jit[i];
    out.ty=X.g+(Y.g-X.g)*f; out.rf=rfA+(rfB-rfA)*f; var lk=Math.log(X.rk)+(Math.log(Y.rk)-Math.log(X.rk))*f; out.dia=0.1+0.29*Math.max(0,1-lk/lnU);
    out.a=A&&B?1:A?1-f:f; out.g=f<0.5?X.g:Y.g; return out;}
  var pose={a:0,ty:0,rf:0,dia:0,g:0}, pose2={a:0,ty:0,rf:0,dia:0,g:0};

  function upd(dt){
    var cl=climb&&!rp.on?D.climbers[WIN[wi]]||[]:null, TL=cfg.trail, SZ=cfg.size;
    cY=Math.cos(yaw);sY=Math.sin(yaw);cT=Math.cos(cfg.tilt*Math.PI/180);sT=Math.sin(cfg.tilt*Math.PI/180);
    for(var i=0;i<Mact;i++){
      if(rp.on){rpPose(i,rp.p,pose); if(pose.a>0){ty[i]=pose.ty;rf[i]=pose.rf;dia[i]=pose.dia;grp[i]=pose.g;} alT[i]=pose.a; if(RM) al[i]=alT[i];}
      var tI=clamp(Math.round(ty[i]),0,4),c=colOf(i),dm=TDIM[tI],a=al[i]*dm*(op.t<0||tI===op.t?1:1-0.93*op.k),sz=dia[i]*sm[i]*SZ*(i===sel?1.25:1)*(1+fl[i]*0.5);
      ea[i]=a/dm; W3(rf[i],ty[i],ang[i],i*3,sP); sS[i]=sz; sC[i*3]=c[0]*a;sC[i*3+1]=c[1]*a;sC[i*3+2]=c[2]*a; sF[i]=fl[i];
      var tcol=cfg.trailTier?c:trailRGB;
      // burst ring on Top-50 entry/exit
      if(fl[i]>0.01){bP[i*3]=sP[i*3];bP[i*3+1]=sP[i*3+1];bP[i*3+2]=sP[i*3+2];bS[i]=sz*(1.2+(1-fl[i])*5.0);var fc=flS[i]>0?[1,0.95,0.7]:[1,0.3,0.35],fa=fl[i]*al[i];bC[i*3]=fc[0]*fa;bC[i*3+1]=fc[1]*fa;bC[i*3+2]=fc[2]*fa;}
      else{bS[i]=0;bC[i*3]=bC[i*3+1]=bC[i*3+2]=0;}
      // trails: live = arc behind the sphere (length ~ orbit speed); replay = the last ~1.5 sessions of motion
      for(var k=0;k<K;k++){var f=k/(K-1),o=(i*K+k)*3,fa2=Math.pow(1-f,1.6)*0.38*a*Math.min(1,TL*1.5)*(grp[i]===0?0.7:1);
        if(rp.on){var pp=Math.max(rp.d0,rp.p-f*1.5*TL); rpPose(i,pp,pose2); if(pose2.a<=0){pose2.ty=ty[i];pose2.rf=rf[i];} W3(pose2.rf,pose2.ty,ang[i]-f*0.25*TL,o,tP);}
        else{var span=clamp(Math.abs(om[i])*2.6,0.07,1.45)*TL; W3(rf[i],ty[i],ang[i]-f*span,o,tP);}
        tS[i*K+k]=sz*(0.55-0.45*f); tC[o]=tcol[0]*fa2;tC[o+1]=tcol[1]*fa2;tC[o+2]=tcol[2]*fa2;}
      for(k=0;k<K-1;k++){var o1=(i*K+k)*3,o2=o1+3,q=(i*LS+k*2)*3,f1=Math.pow(1-k/(K-1),1.2)*0.75*a*Math.min(1,TL*1.5),f2=Math.pow(1-(k+1)/(K-1),1.2)*0.75*a*Math.min(1,TL*1.5);
        lP[q]=tP[o1];lP[q+1]=tP[o1+1];lP[q+2]=tP[o1+2];lP[q+3]=tP[o2];lP[q+4]=tP[o2+1];lP[q+5]=tP[o2+2];
        lC[q]=tcol[0]*f1;lC[q+1]=tcol[1]*f1;lC[q+2]=tcol[2]*f1;lC[q+3]=tcol[0]*f2;lC[q+4]=tcol[1]*f2;lC[q+5]=tcol[2]*f2;}
      // replay path: each session's ring position from the window start to now, curling back in angle with age
      if(rp.on&&rp.paths){var cur=rp.p, n0=Math.max(rp.d0,Math.ceil(cur)-PK+1), prev=null, s=0, base=(i*PS)*3;
        for(var d=Math.floor(cur);d>=n0&&s<PK;d--){var st=rpState(i,d); if(!st){prev=null;continue;}
          var age=cur-d, rr=rfrac(st.rk,st.N,st.g)+jit[i], o3=base+s*6, fa3=Math.pow(1-age/Math.max(1,cur-rp.d0+1),1.1)*0.5*al[i];
          if(prev===null){W3(rf[i],ty[i],ang[i],o3,pP);} else {pP[o3]=prev[0];pP[o3+1]=prev[1];pP[o3+2]=prev[2];}
          W3(rr,st.g,ang[i]-age*0.035,o3+3,pP); prev=[pP[o3+3],pP[o3+4],pP[o3+5]];
          var pc=TC[st.g]; pC[o3]=pc[0]*fa3;pC[o3+1]=pc[1]*fa3;pC[o3+2]=pc[2]*fa3;pC[o3+3]=pc[0]*fa3*0.9;pC[o3+4]=pc[1]*fa3*0.9;pC[o3+5]=pc[2]*fa3*0.9; s++;}
        for(;s<PK;s++){var o4=base+s*6; for(var z=0;z<6;z++){pP[o4+z]=0;pC[o4+z]=0;}}}
    }
    sg.setDrawRange(0,Mact); tg.setDrawRange(0,Mact*K); lg.setDrawRange(0,Mact*LS); pg.setDrawRange(0,Mact*PS); bg2.setDrawRange(0,Mact);
    [sg,tg,lg,bg2].forEach(function(g){for(var k in g.attributes) g.attributes[k].needsUpdate=true;});
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
    if(rp.on&&RP){var d=clamp(Math.round(rp.p),rp.d0,rp.d1), st=rpState(sel,d), s0=null;
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
  function fitOpen(){var asp=W/H, vf=cfg.fov*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*asp), E0=Math.min(op.E,1.45);
    var halfW=R*1.1*E0*cfg.sx, hh=R*E0*cfg.sz*Math.sin(PITCH_O)+0.55;
    return {d:Math.max(halfW/Math.tan(hf/2)+R*E0*cfg.sz*0.55*Math.cos(PITCH_O), hh/Math.tan(vf/2)+R*E0*cfg.sz*0.4), y:tierY(op.t)};}
  var camD=14;
  function placeCam(){var k=op.t>=0?sstep(op.k):0, d=dist*zoom, cy=cyC, pt=pitch;
    if(k>0){var f=fitOpen(); d+=(f.d*zoom-d)*k; cy+=(f.y-cy)*k; pt+=(PITCH_O-pt)*k;}
    camD=d; cam.position.set(0,cy+d*Math.sin(pt),d*Math.cos(pt)); cam.lookAt(0,cy,0);
    retic.quaternion.copy(cam.quaternion); for(var t=0;t<spinG.length;t++){spinG[t].rotation.y=yaw; var q=tsc(t); tierG[t].scale.set(cfg.sx*q,1,cfg.sz*q);
      var od=op.t<0||t===op.t?1:1-0.9*op.k; ringMats[t].uniforms.uDim.value=TDIM[t]*(climb&&!rp.on?0.55:1)*od; dustMats[t].uniforms.uDim.value=(climb&&!rp.on?0.35:(rp.on?0.55:1))*od;}
    stars.rotation.y=yaw*0.25;}
  function resize(){var r=stage.getBoundingClientRect(); W=Math.max(1,Math.round(r.width)); H=Math.max(1,Math.round(r.height));
    renderer.setSize(W,H,false); cam.fov=cfg.fov; cam.aspect=W/H; cam.updateProjectionMatrix(); fit();
    U.uScale.value=H*PR/(2*Math.tan(cam.fov*Math.PI/360)); need();}
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
  cv.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'){yaw-=0.15;need();}else if(e.key==='ArrowRight'){yaw+=0.15;need();}else if(e.key==='Escape'){if(sel>=0) select(-1); else if(op.t>=0) closeTier();}});
  function pick(x,y){var best=-1,bd=1e9;for(var i=0;i<Mact;i++){if(ea[i]<0.5) continue;var d=Math.hypot(sx[i]-x,sy[i]-y),lim=Math.max(sr[i]+9,15);
      if(d<lim){var sc=d-sdep[i]*2-(sr[i]*0.3);if(sc<bd){bd=sc;best=i;}}}
    select(best===sel?-1:best);}

  // ---------------------------------------------------------------- live toggles (1D/1W/4W, CLIMBERS)
  var segB=root.querySelectorAll('.rso-seg button'), clB=root.querySelector('.rso-climb'), clBox=root.querySelector('.rso-cls'), legW=root.querySelector('[data-win]'), ctl=root.querySelector('.rso-ctl');
  function setTargets(){var cl=climb&&!rp.on?(D.climbers[WIN[wi]]||[]):null, set={}; if(cl) cl.forEach(function(t){set[t]=1;});
    for(var i=0;i<N;i++){omT[i]=omega(i); if(!rp.on){alT[i]=cl?(set[info[i].t]?1:0.13):1;} smT[i]=cl&&set[info[i].t]?1.22:1;}
    for(i=N;i<Mact;i++){omT[i]=omega(i); if(!rp.on) alT[i]=0; smT[i]=1;}
    ringMats.forEach(function(m,t){m.uniforms.uDim.value=TDIM[t]*(cl?0.55:1);}); dustMats.forEach(function(m){m.uniforms.uDim.value=cl?0.35:(rp.on?0.55:1);});
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
    ['g','04 · DYNAMICS'],['size','SPHERE SIZE',0.4,2.2,0.01,'×'],['trail','TRAIL LENGTH',0,2.5,0.01,'×'],['speed','ORBIT SPEED',0,3,0.01,'×'],['glow','GLOW INTENSITY',0.1,2.2,0.01,'×'],
    ['g','05 · CAMERA'],['autoSpd','AUTO-ROTATE RATE',-3,3,0.05,'×'],['fov','FIELD OF VIEW',22,75,1,'°']];
  function drHTML(){var h='<div class="dr-hd"><b>MISSION CONTROL</b><span>ORBITAL · CONFIG</span><button type="button" class="dr-x" aria-label="Close controls">×</button></div><div class="dr-bd">';
    h+='<div class="dr-g">01 · THEME</div><div class="dr-pre">'+Object.keys(PRESETS).map(function(k){return '<button type="button" data-pre="'+k+'" class="'+(cfg.theme===k?'on':'')+'">'+PRESETS[k].name+'</button>';}).join('')+'</div>';
    h+='<div class="dr-g">02 · COLOUR</div><div class="dr-cols">'+TIERS.map(function(t,i){return '<label><input type="color" data-col="'+i+'" value="'+cfg.c[i]+'"><span>'+esc(t.label.replace(' · ELITE',''))+'</span></label>';}).join('')+
      '<label><input type="color" data-k="beam" value="'+cfg.beam+'"><span>BEAM / CORE</span></label><label><input type="color" data-k="bg" value="'+cfg.bg+'"><span>BACKGROUND</span></label>'+
      '<label><input type="color" data-k="trailCol" value="'+cfg.trailCol+'"><span>TRAILS</span></label><label class="ck"><input type="checkbox" data-k="trailTier"'+(cfg.trailTier?' checked':'')+'><span>TRAILS MATCH RING</span></label></div>';
    SL.forEach(function(s){if(s[0]==='g'){h+='<div class="dr-g">'+s[1]+'</div>';if(s[1].indexOf('CAMERA')>0) h+='<label class="ck row"><input type="checkbox" data-k="auto"'+(cfg.auto?' checked':'')+'><span>AUTO-ROTATE</span></label>';return;}
      h+='<label class="dr-s"><span>'+s[1]+'</span><output data-o="'+s[0]+'">'+fmt(s[0],cfg[s[0]],s[5])+'</output><input type="range" data-k="'+s[0]+'" min="'+s[2]+'" max="'+s[3]+'" step="'+s[4]+'" value="'+cfg[s[0]]+'"></label>';});
    h+='<div class="dr-g">06 · AUDIO</div><label class="ck row"><input type="checkbox" data-k="sound"'+(cfg.sound?' checked':'')+'><span>UI SOUNDS</span></label>';
    h+='<button type="button" class="dr-reset">RESET TO DEFAULTS</button><div class="dr-ft">SAVED ON THIS DEVICE · localStorage</div></div>'; dr.innerHTML=h;}
  function fmt(k,v,u){return (k==='tilt'||k==='fov'?Math.round(v):(+v).toFixed(2))+(u||'');}
  function applyCfg(full){TC=cfg.c.map(hex); trailRGB=hex(cfg.trailCol); U.uGlow.value=cfg.glow; U.uBeam.value=hex(cfg.beam); bgU.uBg.value=hex(cfg.bg); bgU.uT1.value=TC[2]; bgU.uT2.value=TC[4];
    nodeG.material.uniforms.uTC.value=flat(TC);
    ringMats.forEach(function(m,t){m.uniforms.uColor.value=TC[t];}); dustMats.forEach(function(m,t){m.uniforms.uColor.value=TC[t];});
    labels.forEach(function(e,t){e.style.setProperty('--c',cfg.c[t]);}); for(var k in tags) tags[k].style.setProperty('--c',tcss(grp[k]));
    root.style.setProperty('--acc',cfg.beam); root.style.setProperty('--bgc',cfg.bg);
    for(var t=0;t<5;t++) root.style.setProperty('--g'+t,cfg.c[t]);
    cam.fov=cfg.fov; layoutFixed(); resize(); if(full) setTargets(); if(sel>=0) fillCo(); saveCfg(cfg); need();}
  drHTML();
  dr.addEventListener('input',function(e){var el=e.target,k=el.getAttribute('data-k'),ci=el.getAttribute('data-col');
    if(ci!=null){cfg.c[+ci]=el.value; cfg.theme='custom';} else if(k){if(el.type==='checkbox') cfg[k]=el.checked; else if(el.type==='color'){cfg[k]=el.value; cfg.theme='custom';} else {cfg[k]=+el.value; var o=dr.querySelector('output[data-o="'+k+'"]'); var s=SL.filter(function(x){return x[0]===k;})[0]; if(o) o.textContent=fmt(k,cfg[k],s&&s[5]);}}
    if(cfg.theme==='custom') dr.querySelectorAll('.dr-pre button').forEach(function(b){b.classList.remove('on');});
    applyCfg(false);});
  dr.addEventListener('change',function(e){if(e.target.getAttribute('data-k')==='sound'&&cfg.sound) snd('tog',cfg);});
  dr.addEventListener('click',function(e){var b=e.target.closest('button'); if(!b) return;
    if(b.classList.contains('dr-x')){openDr(false);return;}
    if(b.classList.contains('dr-reset')){var snd0=false; cfg=JSON.parse(JSON.stringify(DEF)); cfg.sound=snd0; drHTML(); applyCfg(true); return;}
    var p=b.getAttribute('data-pre'); if(p){var P=PRESETS[p]; cfg.theme=p; cfg.c=P.c.slice(); cfg.beam=P.beam; cfg.bg=P.bg; cfg.trailTier=P.trailTier; cfg.trailCol=P.trailCol; snd('click',cfg); drHTML(); applyCfg(true);}});
  ['pointerdown','touchstart','wheel'].forEach(function(ev){dr.addEventListener(ev,function(e){e.stopPropagation();},{passive:true});});
  var hudB=cb.querySelector('.hud'), rpB=cb.querySelector('.rp');
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
      '<div class="rp-spd" role="group" aria-label="Replay speed">'+[1,2,4].map(function(s){return '<button type="button" data-sp="'+s+'" class="'+(rp.spd===s?'on':'')+'">'+s+'×</button>';}).join('')+'</div></div>';}
  function winRange(){var w=RW.filter(function(x){return x[0]===rp.win;})[0]||RW[1]; rp.d1=RP.nd-1; rp.d0=Math.max(0,rp.d1-Math.min(w[2],RP.nd-1));}
  function rpReadout(){if(!RP) return; var d=clamp(Math.round(rp.p),rp.d0,rp.d1), q=rpBar.querySelector('.rp-date');
    q.querySelector('.t').textContent='T−'+(rp.d1-d); q.querySelector('b').textContent=RP.dates[d]; q.querySelector('.n').textContent='DAY '+(d-rp.d0)+'/'+(rp.d1-rp.d0);
    var sc=rpBar.querySelector('.rp-scrub input'); if(document.activeElement!==sc||!scrubbing) sc.value=String(rp.p);
    var pl=rpBar.querySelector('.rp-play'); pl.textContent=rp.play?'❚❚':'▶'; pl.setAttribute('aria-label',rp.play?'Pause':'Play');
    var n50=0,inT=[0,0,0,0,0]; for(var i=0;i<Mact;i++){var s=rpState(i,d); if(s){inT[s.g]++; if(s.rk<=50) n50++;}}
    tm.innerHTML='<div class="l1">REPLAY '+esc(rp.win.toUpperCase())+' · '+esc(RP.dates[rp.d0].slice(5))+' → '+esc(RP.dates[rp.d1].slice(5))+'</div><div class="l2">TOP 50 <b>'+n50+'</b> · RINGS '+inT.map(function(x,t){return '<i style="color:'+cfg.c[t]+'">'+x+'</i>';}).join(' ')+'</div>'+
      rp.events.slice(-3).map(function(e){return '<div class="ev '+(e[1]>0?'up':'dn')+'">'+esc(e[2].slice(5))+' · '+esc(e[0])+(e[1]>0?' ▲ ENTERS TOP 50':' ▼ LEAVES TOP 50')+'</div>';}).join('');}
  var scrubbing=false;
  function rpSeek(p,flash){var old=rp.p; rp.p=clamp(p,rp.d0,rp.d1); var nd=Math.floor(rp.p+1e-6);
    if(flash&&nd>rp.lastDay&&rp.lastDay>=rp.d0){for(var d=rp.lastDay+1;d<=nd;d++){var ups=0,dns=0;for(var i=0;i<Mact;i++){var a=RP.v[i*RP.nd+d-1],b=RP.v[i*RP.nd+d],ra=a<0?1e9:Math.floor(a/100),rb=b<0?1e9:Math.floor(b/100);
        if(rb<=50&&ra>50){fl[i]=1;flS[i]=1;ups++;rp.events.push([info[i].t,1,RP.dates[d]]);} else if(ra<=50&&rb>50){fl[i]=1;flS[i]=-1;dns++;rp.events.push([info[i].t,-1,RP.dates[d]]);}}
      if(ups) snd('up',cfg); else if(dns) snd('dn',cfg); else snd('tick',cfg);} if(rp.events.length>30) rp.events=rp.events.slice(-30);}
    if(nd!==rp.lastDay){rp.lastDay=nd; rpReadout(); if(sel>=0) fillCo();} need();}
  function rpStart(){if(op.t>=0){closeTier(); op.k=0; op.t=-1;} rp.on=true; rp.done=false; rp.events=[]; winRange(); rp.p=rp.d0; rp.lastDay=rp.d0; rp.play=true; Mact=N+RP.nx; sumC.classList.remove('on');
    for(var i=N;i<Mact;i++){al[i]=0;} rpHTML(); var sc=rpBar.querySelector('.rp-scrub input'); sc.min=String(rp.d0); sc.max=String(rp.d1); sc.value=String(rp.p);
    rpBar.querySelector('.rp-ends .a').textContent=RP.dates[rp.d0]; rpBar.querySelector('.rp-ends .b').textContent=RP.dates[rp.d1];
    pSeg.visible=rp.paths; rpBar.hidden=false; tm.hidden=false; ctl.hidden=true; if(clBox) clBox.hidden=true; root.classList.add('replay'); rpB.classList.add('on'); rpB.setAttribute('aria-pressed','true');
    setTargets(); rpReadout(); snd('play',cfg); labelsState(); need();}
  function rpStop(){rp.on=false; rp.play=false; Mact=N; for(var i=0;i<N;i++){grp[i]=info[i].g; ty[i]=info[i].g; rf[i]=rfrac(info[i].k,D.universe,info[i].g)+jit[i]; dia[i]=0.1+0.29*Math.max(0,1-Math.log(info[i].k)/lnU); fl[i]=0;}
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
    if(b.classList.contains('s-again')){sumC.classList.remove('on'); rp.events=[]; rp.lastDay=rp.d0; rpSeek(rp.d0,false); rp.play=true; rp.done=false; rpReadout(); return;}
    if(b.classList.contains('s-close')){sumC.classList.remove('on'); return;}
    var i=b.getAttribute('data-i'); if(i!=null){sumC.classList.remove('on'); render(0); select(+i);}});
  ['pointerdown','touchstart'].forEach(function(ev){sumC.addEventListener(ev,function(e){e.stopPropagation();},{passive:true});});
  rpBar.addEventListener('click',function(e){var b=e.target.closest('button'); if(!b||b.disabled) return; snd('click',cfg);
    var w=b.getAttribute('data-rw'); if(w){rp.win=w; rpStart(); return;}
    if(b.classList.contains('rp-exit')){rpStop(); return;}
    if(b.classList.contains('rp-paths')){rp.paths=!rp.paths; b.classList.toggle('on',rp.paths); b.setAttribute('aria-pressed',String(rp.paths)); pSeg.visible=rp.paths; need(); return;}
    if(b.classList.contains('rp-play')){if(rp.p>=rp.d1-1e-6){rp.events=[]; rp.lastDay=rp.d0; rpSeek(rp.d0,false);} rp.play=!rp.play; sumC.classList.remove('on'); rpReadout(); return;}
    var st=b.getAttribute('data-st'); if(st){rp.play=false; var t=+st>0?Math.floor(rp.p+1e-6)+1:Math.ceil(rp.p-1e-6)-1; rpSeek(t,+st>0); rpReadout(); if(rp.p>=rp.d1) rpSummary(); return;}
    var sp=b.getAttribute('data-sp'); if(sp){rp.spd=+sp; rpBar.querySelectorAll('.rp-spd button').forEach(function(x){x.classList.toggle('on',x===b);});}});
  rpBar.addEventListener('input',function(e){if(e.target.type!=='range') return; scrubbing=true; rp.play=false; var v=+e.target.value; if(v<rp.lastDay){rp.lastDay=Math.floor(v);} rpSeek(v,false); rpReadout();});
  rpBar.addEventListener('change',function(e){if(e.target.type==='range'){scrubbing=false; rp.lastDay=Math.floor(rp.p+1e-6);}});
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
  var backB=document.createElement('button'); backB.type='button'; backB.className='rso-cb back'; backB.innerHTML='<i>◂</i>BACK'; backB.hidden=true; cb.insertBefore(backB,hudB);
  backB.addEventListener('click',function(){closeTier();});
  labels.forEach(function(e,t){var h=e.querySelector('.hit'); h.setAttribute('role','button'); h.setAttribute('tabindex','0'); h.setAttribute('aria-label','Open '+TIERS[t].label);
    h.insertAdjacentHTML('afterbegin','<u>⊕</u>');
    h.addEventListener('click',function(ev){ev.stopPropagation(); if(op.t===t&&op.target>0) closeTier(); else openTier(t);});
    h.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault(); h.click();}});});
  function labelsState(){labels.forEach(function(e,t){e.classList.toggle('open',op.t===t&&op.target>0); e.classList.toggle('off',rp.on||(op.t>=0&&op.target>0&&t!==op.t));});}
  function ringAt(x,y){var best=-1,bd=30,o=new Float32Array(3);cY=Math.cos(yaw);sY=Math.sin(yaw);
    for(var t=0;t<TIERS.length;t++){for(var j=0;j<72;j++){W3(1.0,t,j/72*6.2832,0,o); v.set(o[0],o[1],o[2]).project(cam); var d=Math.hypot((v.x*0.5+0.5)*W-x,(-v.y*0.5+0.5)*H-y); if(d<bd){bd=d;best=t;}}}
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
    tp.innerHTML='<div class="tp-hd"><button type="button" class="tp-back" aria-label="Close tier">◂ BACK</button><div class="tp-t"><b>'+esc(T.label)+'</b><span>'+T.shown+' SPHERES · '+T.total.toLocaleString()+' NAMES IN TIER · #'+T.rank_lo+'–#'+T.rank_hi+'</span></div></div>'+
      '<label class="tp-s"><span>RING STRETCH <em>· or pinch the ring</em></span><output>'+op.E.toFixed(2)+'×</output><input type="range" min="1" max="2.6" step="0.01" value="'+op.E+'" aria-label="Ring stretch"></label>'+
      '<div class="tp-cols"><span>RANK · TICKER</span><span>RS</span><span>1W</span><span></span></div><div class="tp-list" tabindex="0"><div class="tp-ld">LOADING TIER…</div></div>';
    loadTL().then(function(){if(op.t!==t) return; shownN=Math.min(150,TL[t].length); var l=tp.querySelector('.tp-list'); l.innerHTML=rowsHTML(t,0,shownN)+more(t);}).catch(function(){var l=tp.querySelector('.tp-list'); if(l) l.innerHTML='<div class="tp-ld">tier list unavailable</div>';});}
  function more(t){var n=TL[t].length-shownN; return n>0?'<button type="button" class="tp-more">SHOW '+Math.min(150,n)+' MORE · '+n.toLocaleString()+' LEFT</button>':'';}
  tp.addEventListener('click',function(e){var b=e.target.closest('button'); if(!b) return;
    if(b.classList.contains('tp-back')){closeTier(); return;}
    if(b.classList.contains('tp-more')){var t=op.t, a=shownN; shownN=Math.min(TL[t].length,shownN+150); b.insertAdjacentHTML('beforebegin',rowsHTML(t,a,shownN)); var m2=more(t); if(m2) b.insertAdjacentHTML('beforebegin',m2); b.remove(); return;}
    var i=b.getAttribute('data-i'); if(i!=null){i=+i; render(0); select(i); try{stage.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(_){} }});
  tp.addEventListener('input',function(e){if(e.target.type==='range') setE(+e.target.value);});
  function openTier(t){if(rp.on) return; if(dr.classList.contains('on')) openDr(false);
    if(sel>=0&&grp[sel]!==t) select(-1);
    op.t=t; op.target=1; if(RM) op.k=1; snd('sel',cfg); fillTP(t); tp.hidden=false; ctl.hidden=true; if(clBox) clBox.hidden=true; backB.hidden=false; rpB.hidden=true;
    root.classList.add('tieropen'); labelsState(); need();}
  function closeTier(){if(op.t<0) return; op.target=0; if(RM){op.k=0; op.t=-1;} snd('tog',cfg); tp.hidden=true; ctl.hidden=false; backB.hidden=true; rpB.hidden=false;
    if(clBox&&climb) clBox.hidden=false; root.classList.remove('tieropen'); labelsState(); need();}
  // ---------------------------------------------------------------- frame
  var v=new THREE.Vector3(), w2=new THREE.Vector3(), vis=true, last=performance.now(), frames=0;
  function project(){var sc=H/(2*Math.tan(cam.fov*Math.PI/360)), mv=cam.matrixWorldInverse, cd=camD;
    for(var i=0;i<Mact;i++){v.set(sP[i*3],sP[i*3+1],sP[i*3+2]); w2.copy(v).applyMatrix4(mv); sdep[i]=clamp((-w2.z-cd)/-R,-1.2,1.2);
      v.project(cam); sx[i]=(v.x*0.5+0.5)*W; sy[i]=(-v.y*0.5+0.5)*H; sr[i]=sS[i]*0.435*2.3*sc/(-w2.z)/2*1.15;}}
  function overlay(){var tl=cfg.tilt*Math.PI/180;
    TIERS.forEach(function(_,t){v.set(-R*Math.cos(tl)*cfg.sx*tsc(t),tierY(t)-R*Math.sin(tl),0).project(cam); var x=(v.x*0.5+0.5)*W, yy2=(-v.y*0.5+0.5)*H; labels[t].style.transform='translate('+Math.max(6,x-4).toFixed(0)+'px,'+(yy2-15).toFixed(0)+'px)'; labels[t].style.opacity=op.t<0||t===op.t?'':String(1-0.95*op.k);});
    var show={}, cl=climb&&!rp.on?(D.climbers[WIN[wi]]||[]):null;
    if(cl) cl.forEach(function(t){show[byT[t]]=1;});
    else if(rp.on&&RP){var d=clamp(Math.round(rp.p),rp.d0,rp.d1),best=[];for(var i=0;i<Mact;i++){var s=rpState(i,d);if(s) best.push([s.rk,i]);} best.sort(function(a,b){return a[0]-b[0];}); best.slice(0,5).forEach(function(x){show[x[1]]=1;});
      for(i=0;i<Mact;i++){if(fl[i]>0.55) show[i]=1;}}
    else topIdx.forEach(function(i){show[i]=1;});
    if(op.t>=0&&op.k>0.3){for(var j=0;j<Mact;j++){if(grp[j]===op.t&&ea[j]>0.5) show[j]=1; else if(show[j]&&j!==sel) delete show[j];}}
    if(sel>=0) show[sel]=1;
    for(var k in tags){if(!show[k]) tags[k].style.opacity='0';}
    for(k in show){var i2=+k,e=tag(i2),fr=sdep[i2]; e.classList.toggle('cl',!!cl); e.style.setProperty('--c',tcss(grp[i2]));
      e.style.opacity=String(al[i2]<0.05?0:(i2===sel?1:clamp(0.35+0.65*(fr+0.6),0.3,1)*Math.min(1,al[i2]*1.5)));
      e.style.transform='translate('+(sx[i2]+sr[i2]*0.75+2).toFixed(0)+'px,'+(sy[i2]-sr[i2]*0.75-12).toFixed(0)+'px)';}
    if(sel>=0){ret.style.transform='translate('+sx[sel].toFixed(1)+'px,'+sy[sel].toFixed(1)+'px)'; placeCo(false);}}
  function render(dt){
    if(op.t>=0){var ok=op.k; op.k=RM?op.target:op.k+(op.target-op.k)*Math.min(1,dt*3.2); if(Math.abs(op.k-op.target)<0.02) op.k=op.target; if(op.k===0&&op.target===0){op.t=-1; labelsState();} if(op.k!==ok) need();}
    if(rp.on&&rp.play){var np2=rp.p+dt*rp.spd/0.55; if(np2>=rp.d1){rpSeek(rp.d1,true); rp.play=false; rp.done=true; rpReadout(); rpSummary();} else rpSeek(np2,true);}
    if(!RM){tNow+=dt; U.uTime.value=tNow;
      var ar=(cfg.auto?0.05*cfg.autoSpd:0)*(op.t>=0?1-0.6*op.k:1);
      if(tNow-lastUser>2.5&&np===0){yawV+=(ar-yawV)*Math.min(1,dt*0.8);} else if(np===0){yawV*=Math.pow(0.04,dt);}
      if(np===0) yaw+=yawV*dt;
      var e=Math.min(1,dt*3), spd=cfg.speed*(rp.on?0.5:1);
      for(var i=0;i<Mact;i++){om[i]+=(omT[i]-om[i])*e; al[i]+=(alT[i]-al[i])*Math.min(1,dt*(rp.on?6:3)); sm[i]+=(smT[i]-sm[i])*e; ang[i]+=om[i]*dt*spd*(i===sel?0.15:1)*(op.t>=0?1-0.72*op.k:1); if(fl[i]>0) fl[i]=Math.max(0,fl[i]-dt*0.9);}
      core.rotation.y+=dt*0.25;}
    else{for(var j=0;j<Mact;j++){if(fl[j]>0) fl[j]=0;}}
    placeCam(); upd(dt); renderer.render(scene,cam); project(); overlay(); dirty=false; frames++;}
  function loop(now){requestAnimationFrame(loop); var dt=Math.min(0.05,(now-last)/1000); last=now;
    if(!running||!vis||document.hidden) return; if(RM&&!dirty&&!(rp.on&&rp.play)) return; render(dt);}
  if('IntersectionObserver' in window){new IntersectionObserver(function(en){vis=en[0].isIntersecting; if(vis) need();},{rootMargin:'80px'}).observe(stage);}
  if('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize',resize);
  applyCfg(true); render(0); requestAnimationFrame(loop);
  root.classList.add('live');
  window.RSO={select:function(t){var i=byT[t]; if(i!=null){render(0); select(i);} return i;}, frames:function(){return frames;}, n:N,
    pos:function(t){var i=byT[t]; if(i==null) return null; var b=cv.getBoundingClientRect(); return {x:b.left+sx[i],y:b.top+sy[i],r:sr[i]};}, sel:function(){return sel<0?null:info[sel].t;},
    replay:function(){return {on:rp.on,p:rp.p,d0:rp.d0,d1:rp.d1,play:rp.play,date:RP?RP.dates[Math.round(rp.p)]:null,events:rp.events.length};}, cfg:function(){return cfg;}, open:function(t){openTier(t);}, close:function(){closeTier();}, tier:function(){return {t:op.t,k:op.k,E:op.E};},
    ring:function(t){var o=new Float32Array(3),b=cv.getBoundingClientRect();cY=Math.cos(yaw);sY=Math.sin(yaw);W3(1.0,t,Math.PI/2+yaw,0,o);v.set(o[0],o[1],o[2]).project(cam);return {x:b.left+(v.x*0.5+0.5)*W,y:b.top+(-v.y*0.5+0.5)*H};},
    label:function(t){var r=labels[t].querySelector('.hit').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}};
}
})();
