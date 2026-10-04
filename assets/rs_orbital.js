/* rs_orbital.js - RELATIVE STRENGTH · ORBITAL (top of rs.html).  Data: data/rs_orbital.json (research-tools/rs_orbital.py, rebuilt
   on every rs / daily / refresh run).  Renderer: Three.js r186, tree-shaken + vendored at assets/vendor/three-r186.orbital.min.js
   (MIT, no CDN).  Rings = RS tiers, sphere size = rank, orbit speed + trail length = rank change over the selected window.
   Touch: drag = rotate, pinch = zoom, tap = select.  prefers-reduced-motion = still frame (renders on interaction only).
   No WebGL2 / load failure -> the server-rendered static list (#rso.nogl).  Desk RS calc, not IBD's official rating. */
(function(){
'use strict';
window.RSO_UP=true;
var root=document.getElementById('rso'); if(!root) return;
function nogl(why){root.classList.add('nogl'); var l=root.querySelector('.rso-load'); if(l) l.remove(); if(why&&window.console) console.warn('rs_orbital: static list ('+why+')');}
var gl2=false; try{var tc=document.createElement('canvas'); gl2=!!(tc.getContext('webgl2'));}catch(e){}
if(!gl2){nogl('no WebGL2'); return;}
var src=root.getAttribute('data-src'), lib=root.getAttribute('data-three');
var libUrl; try{libUrl=new URL(lib,document.baseURI).href;}catch(e){libUrl=lib;}
Promise.all([fetch(src,{cache:'no-cache'}).then(function(r){if(!r.ok) throw new Error('data '+r.status); return r.json();}), import(libUrl)])
 .then(function(a){try{init(a[0],a[1]);}catch(e){nogl(e&&e.message);}})
 .catch(function(e){nogl(e&&e.message);});

function hex(c){c=c.replace('#','');return [parseInt(c.substr(0,2),16)/255,parseInt(c.substr(2,2),16)/255,parseInt(c.substr(4,2),16)/255];}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function clamp(x,a,b){return x<a?a:x>b?b:x;}
function hash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%100000)/100000;}

function init(D,THREE){
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stage=root.querySelector('.rso-stage'), cv=root.querySelector('.rso-cv'), ov=root.querySelector('.rso-ov');
  var load=root.querySelector('.rso-load'); if(load) load.remove();
  var WIN=['1d','1w','4w'], WL={'1d':'1D','1w':'1W','4w':'4W'}, wi=1, climb=false;
  var R=3.0, LANES=[1.0,0.82,0.64], TY=[3.0,1.5,0.0,-1.5,-3.0], CORE_Y=4.55, BOT_Y=-3.9;
  var TC=D.tiers.map(function(t){return hex(t.color);}), TDIM=[1,1,1,0.95,0.62];
  var renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x000000,0);
  var PR=Math.min(window.devicePixelRatio||1,2); renderer.setPixelRatio(PR);
  cv.addEventListener('webglcontextlost',function(e){e.preventDefault(); nogl('context lost'); running=false;});
  var scene=new THREE.Scene(), cam=new THREE.PerspectiveCamera(38,1,0.1,400);
  var orb=new THREE.Group(), fixed=new THREE.Group(), stars=new THREE.Group();
  scene.add(stars); scene.add(orb); scene.add(fixed);
  var U={uTime:{value:0},uScale:{value:600}};
  function mat(vs,fs,uni){var u={};for(var k in U) u[k]=U[k];for(k in (uni||{})) u[k]=uni[k];
    return new THREE.ShaderMaterial({uniforms:u,vertexShader:vs,fragmentShader:fs,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});}

  // ---------------------------------------------------------------- starfield
  (function(){var n=1300,P=new Float32Array(n*3),S=new Float32Array(n),C=new Float32Array(n*3),Ph=new Float32Array(n);
    for(var i=0;i<n;i++){var u=Math.random()*2-1,th=Math.random()*6.2832,rr=60+Math.random()*60,q=Math.sqrt(1-u*u);
      P[i*3]=Math.cos(th)*q*rr;P[i*3+1]=u*rr*0.8;P[i*3+2]=Math.sin(th)*q*rr;
      S[i]=(Math.random()<0.08?2.6:1.0+Math.random()*1.3); Ph[i]=Math.random()*6.28;
      var k=Math.random(), c=k<0.6?[0.75,0.85,1]:k<0.85?[0.6,0.9,1]:[1,0.75,0.95]; var b=0.35+Math.random()*0.65;
      C[i*3]=c[0]*b;C[i*3+1]=c[1]*b;C[i*3+2]=c[2]*b;}
    var g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(P,3)); g.setAttribute('aS',new THREE.BufferAttribute(S,1));
    g.setAttribute('aC',new THREE.BufferAttribute(C,3)); g.setAttribute('aPh',new THREE.BufferAttribute(Ph,1));
    var m=mat('attribute float aS;attribute vec3 aC;attribute float aPh;uniform float uTime;uniform float uPR;varying vec3 vC;'+
      'void main(){vC=aC*(0.65+0.35*sin(uTime*(0.6+aPh*0.25)+aPh*7.0));gl_PointSize=aS*uPR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      'varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*exp(-r*3.5),1.0);}',{uPR:{value:PR}});
    var pts=new THREE.Points(g,m); pts.frustumCulled=false; stars.add(pts);})();

  // ---------------------------------------------------------------- rings
  var ringMats=[];
  var RING_VS='varying vec2 vP;void main(){vP=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  var RING_FS=['uniform vec3 uColor;uniform float uR;uniform float uTime;uniform float uDim;varying vec2 vP;',
    'float ln(float x,float c,float w,float fw){return 1.0-smoothstep(w,w+fw*1.6,abs(x-c));}',
    'void main(){float r=length(vP);float a=atan(vP.y,vP.x);float fw=fwidth(r);',
    ' float core=ln(r,uR,0.016,fw);',
    ' float glow=exp(-pow((r-uR)/0.11,2.0))*0.55+exp(-pow((r-uR)/0.34,2.0))*0.16;',
    ' float lanes=0.0;',
    ' for(int k=1;k<3;k++){float f=k==1?0.82:0.64;float rr=uR*f;float d=step(0.46,fract(a*rr*7.0/6.2832));',
    '   lanes+=ln(r,rr,0.007,fw)*d*0.62+exp(-pow((r-rr)/0.05,2.0))*0.06;}',
    ' float outer=ln(r,uR*1.065,0.004,fw)*0.32;',
    ' float tk=step(fract(a*72.0/6.2832),0.1)*step(uR*1.095,r)*step(r,uR*1.135)*0.42;',
    ' float fill=smoothstep(uR*0.42,uR,r)*(1.0-smoothstep(uR,uR*1.02,r))*0.03;',
    ' float sw=0.62+0.38*pow(0.5+0.5*cos(a-uTime*0.45),3.0);',
    ' float I=(core*1.15+glow)*sw+lanes+outer+tk+fill;',
    ' vec3 col=uColor*I+vec3(1.0)*core*0.38*sw;',
    ' gl_FragColor=vec4(col*uDim,1.0);}'].join('\n');
  TY.forEach(function(y,t){
    var g=new THREE.RingGeometry(R*0.45,R*1.2,192,1); g.rotateX(-Math.PI/2);
    var m=mat(RING_VS,RING_FS,{uColor:{value:TC[t]},uR:{value:R},uDim:{value:TDIM[t]}});
    ringMats.push(m); var me=new THREE.Mesh(g,m); me.position.y=y; me.frustumCulled=false; orb.add(me);});

  // ---------------------------------------------------------------- dust (every ranked name not shown as a sphere)
  var dustMat;
  (function(){var tot=0;D.tiers.forEach(function(t){tot+=Math.min(t.dust,1200);});
    var Rr=new Float32Array(tot),A=new Float32Array(tot),Y=new Float32Array(tot),Sp=new Float32Array(tot),S=new Float32Array(tot),C=new Float32Array(tot*3),i=0;
    D.tiers.forEach(function(t,ti){var n=Math.min(t.dust,1200);for(var j=0;j<n;j++,i++){
      var l=LANES[Math.floor(Math.random()*3)]; Rr[i]=R*(l+(Math.random()-0.5)*0.16+(Math.random()<0.25?(Math.random()-0.5)*0.4:0));
      A[i]=Math.random()*6.2832; Y[i]=TY[ti]+(Math.random()-0.5)*0.07; Sp[i]=0.03+Math.random()*0.05; S[i]=0.03+Math.random()*0.035;
      var b=(0.22+Math.random()*0.3)*TDIM[ti]; C[i*3]=TC[ti][0]*b;C[i*3+1]=TC[ti][1]*b;C[i*3+2]=TC[ti][2]*b;}});
    var g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(tot*3),3));
    g.setAttribute('aR',new THREE.BufferAttribute(Rr,1));g.setAttribute('aA',new THREE.BufferAttribute(A,1));g.setAttribute('aY',new THREE.BufferAttribute(Y,1));
    g.setAttribute('aSp',new THREE.BufferAttribute(Sp,1));g.setAttribute('aS',new THREE.BufferAttribute(S,1));g.setAttribute('aC',new THREE.BufferAttribute(C,3));
    dustMat=mat('attribute float aR;attribute float aA;attribute float aY;attribute float aSp;attribute float aS;attribute vec3 aC;uniform float uTime;uniform float uScale;uniform float uDim;varying vec3 vC;'+
      'void main(){float an=aA+uTime*aSp;vec4 mv=modelViewMatrix*vec4(cos(an)*aR,aY,sin(an)*aR,1.0);gl_PointSize=max(1.5,aS*uScale/(-mv.z));vC=aC*uDim;gl_Position=projectionMatrix*mv;}',
      'varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*exp(-r*2.5),1.0);}',{uDim:{value:1}});
    var pts=new THREE.Points(g,dustMat); pts.frustumCulled=false; orb.add(pts);})();

  // ---------------------------------------------------------------- axis beam + ring nodes + AI core
  (function(){var h=CORE_Y-BOT_Y, g=new THREE.PlaneGeometry(1.0,h,1,1);
    var m=mat('varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      ['uniform float uTime;varying vec2 vU;void main(){float x=(vU.x-0.5)*1.0;float y=vU.y;',
       'float core=exp(-x*x/0.00018)*1.1+exp(-x*x/0.0025)*0.5+exp(-x*x/0.03)*0.16;',
       'float fade=smoothstep(0.0,0.12,y)*(0.55+0.45*y);',
       'float pu=pow(fract(y*2.6-uTime*0.32),22.0)*exp(-x*x/0.002)*1.4;',
       'vec3 c=vec3(0.45,0.92,1.0)*(core*fade+pu*fade)+vec3(1.0)*exp(-x*x/0.00006)*0.5*fade;',
       'gl_FragColor=vec4(c,1.0);}'].join('\n'));
    var me=new THREE.Mesh(g,m); me.position.y=(CORE_Y+BOT_Y)/2; me.frustumCulled=false; fixed.add(me); fixed.userData.beam=me;
    // nodes where the beam crosses each ring + the core halo (one Points draw)
    var n=TY.length+1,P=new Float32Array(n*3),S=new Float32Array(n),C=new Float32Array(n*3);
    TY.forEach(function(y,t){P[t*3+1]=y;S[t]=0.55;C[t*3]=0.5+TC[t][0]*0.5;C[t*3+1]=0.5+TC[t][1]*0.5;C[t*3+2]=0.5+TC[t][2]*0.5;});
    P[(n-1)*3+1]=CORE_Y;S[n-1]=4.2;C[(n-1)*3]=0.12;C[(n-1)*3+1]=0.55;C[(n-1)*3+2]=0.85;
    var gg=new THREE.BufferGeometry(); gg.setAttribute('position',new THREE.BufferAttribute(P,3)); gg.setAttribute('aS',new THREE.BufferAttribute(S,1)); gg.setAttribute('aC',new THREE.BufferAttribute(C,3));
    var mm=mat('attribute float aS;attribute vec3 aC;uniform float uScale;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aS*uScale/(-mv.z);vC=aC;gl_Position=projectionMatrix*mv;}',
      'varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*(exp(-r*9.0)*0.9+exp(-r*3.0)*0.35)*(1.0-r),1.0);}');
    var pts=new THREE.Points(gg,mm); pts.frustumCulled=false; fixed.add(pts);
    // core orb: fresnel sphere with a lat/long grid
    var sg=new THREE.SphereGeometry(0.6,48,32);
    var sm=mat('varying vec3 vN;varying vec2 vU;void main(){vU=uv;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      ['uniform float uTime;varying vec3 vN;varying vec2 vU;void main(){float f=pow(1.0-abs(vN.z),2.2);',
       'float la=1.0-smoothstep(0.0,0.06,abs(fract(vU.y*9.0)-0.5)*2.0-0.9);float lo=1.0-smoothstep(0.0,0.06,abs(fract(vU.x*18.0+uTime*0.03)-0.5)*2.0-0.9);',
       'float grid=max(la,lo)*0.45*(vN.z>0.0?1.0:0.35);',
       'vec3 c=vec3(0.2,0.75,1.0)*(0.10+f*1.25+grid)+vec3(0.85,1.0,1.0)*pow(f,5.0)*0.5;gl_FragColor=vec4(c,1.0);}'].join('\n'));
    var sp=new THREE.Mesh(sg,sm); sp.position.y=CORE_Y; fixed.add(sp); fixed.userData.core=sp;
    // HUD reticle facing the camera
    var rg=new THREE.PlaneGeometry(1.25,1.25);
    var rm=mat('varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      ['uniform float uTime;varying vec2 vU;float ln(float x,float c,float w){return 1.0-smoothstep(w*0.5,w,abs(x-c));}',
       'void main(){vec2 p=vU*2.0-1.0;float r=length(p);if(r>1.0)discard;float a=atan(p.y,p.x);',
       'float c=ln(r,0.18,0.03)*0.8+ln(r,0.36,0.025)*0.55+ln(r,0.62,0.02)*0.45*step(0.35,fract(a*3.0/6.2832+uTime*0.05));',
       'c+=ln(r,0.84,0.018)*step(fract(a*48.0/6.2832-uTime*0.12),0.18)*0.6;',
       'c+=exp(-r*r*90.0)*1.6+exp(-r*r*14.0)*0.25;',
       'c+=ln(abs(p.x),0.0,0.012)*step(r,0.95)*step(0.42,r)*0.35+ln(abs(p.y),0.0,0.012)*step(r,0.95)*step(0.42,r)*0.35;',
       'gl_FragColor=vec4(vec3(0.45,0.95,1.0)*c,1.0);}'].join('\n'));
    var ret=new THREE.Mesh(rg,rm); ret.position.y=CORE_Y; fixed.add(ret); fixed.userData.ret=ret;
    // tilted halo ring around the core
    var tg=new THREE.TorusGeometry(0.98,0.011,6,120);
    var tm=mat('void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}','void main(){gl_FragColor=vec4(0.35,0.85,1.0,1.0)*0.85;}');
    var to=new THREE.Mesh(tg,tm); to.position.y=CORE_Y; to.rotation.x=Math.PI/2-0.22; to.rotation.z=0.12; fixed.add(to);})();

  // ---------------------------------------------------------------- spheres + trails
  var S=D.s, N=S.length, K=16, lnU=Math.log(Math.max(D.universe,2));
  var ang=new Float32Array(N),rad=new Float32Array(N),yy=new Float32Array(N),om=new Float32Array(N),omT=new Float32Array(N);
  var dia=new Float32Array(N),al=new Float32Array(N),alT=new Float32Array(N),sm=new Float32Array(N),smT=new Float32Array(N);
  var byT={}, perTier=[0,0,0,0,0], cntTier=[0,0,0,0,0];
  S.forEach(function(s){cntTier[s.g]++;});
  S.forEach(function(s,i){byT[s.t]=i;var j=perTier[s.g]++, lane=j%3, nl=Math.ceil((cntTier[s.g]-lane)/3), slot=Math.floor(j/3);
    rad[i]=R*LANES[lane]; yy[i]=TY[s.g]; ang[i]=(slot/Math.max(nl,1))*6.2832+lane*0.9+hash(s.t)*0.5;
    dia[i]=0.13+0.37*Math.max(0,1-Math.log(s.k)/lnU); al[i]=alT[i]=1; sm[i]=smT[i]=1;});
  var BASE=0.2;
  function omega(i){var m=S[i].m[wi]; return BASE*(m>=0?1+1.6*m:1+0.78*m);}
  for(var i0=0;i0<N;i0++){om[i0]=omT[i0]=omega(i0);}
  var sP=new Float32Array(N*3),sS=new Float32Array(N),sC=new Float32Array(N*3);
  var sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.BufferAttribute(sP,3)); sg.setAttribute('aS',new THREE.BufferAttribute(sS,1)); sg.setAttribute('aC',new THREE.BufferAttribute(sC,3));
  var sMat=mat('attribute float aS;attribute vec3 aC;uniform float uScale;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aS*2.6*uScale/(-mv.z);vC=aC;gl_Position=projectionMatrix*mv;}',
    ['varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;p.y=-p.y;float r=length(p);if(r>1.0)discard;float rc=0.385;vec3 c=vec3(0.0);',
     'float lum=max(vC.r,max(vC.g,vC.b));vec3 hue=lum>0.0?vC/lum:vC;',
     'if(r<rc){vec2 q=p/rc;vec3 n=vec3(q,sqrt(max(0.0,1.0-dot(q,q))));vec3 L=normalize(vec3(-0.45,0.55,0.7));',
     ' float df=max(dot(n,L),0.0);float spc=pow(max(dot(reflect(-L,n),vec3(0.0,0.0,1.0)),0.0),22.0);float rim=pow(1.0-n.z,2.0);',
     ' c=(hue*(0.22+0.95*df)+hue*rim*0.9+vec3(1.0)*spc*0.85)*smoothstep(rc,rc-0.05,r)*lum;}',
     'float h=pow(1.0-smoothstep(rc*0.7,1.0,r),2.4)*0.8;c+=vC*h;gl_FragColor=vec4(c,1.0);}'].join('\n'));
  var sPts=new THREE.Points(sg,sMat); sPts.frustumCulled=false;
  var tP=new Float32Array(N*K*3),tS=new Float32Array(N*K),tC=new Float32Array(N*K*3);
  var tg=new THREE.BufferGeometry(); tg.setAttribute('position',new THREE.BufferAttribute(tP,3)); tg.setAttribute('aS',new THREE.BufferAttribute(tS,1)); tg.setAttribute('aC',new THREE.BufferAttribute(tC,3));
  var tMat=mat('attribute float aS;attribute vec3 aC;uniform float uScale;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=max(1.0,aS*uScale/(-mv.z));vC=aC;gl_Position=projectionMatrix*mv;}',
    'varying vec3 vC;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;gl_FragColor=vec4(vC*exp(-r*3.0),1.0);}');
  var tPts=new THREE.Points(tg,tMat); tPts.frustumCulled=false;
  var LS=K*2-2, lP=new Float32Array(N*LS*3), lC=new Float32Array(N*LS*3);
  var lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.BufferAttribute(lP,3)); lg.setAttribute('aC',new THREE.BufferAttribute(lC,3));
  var lMat=mat('attribute vec3 aC;varying vec3 vC;void main(){vC=aC;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}','varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.0);}');
  var lSeg=new THREE.LineSegments(lg,lMat); lSeg.frustumCulled=false;
  orb.add(lSeg); orb.add(tPts); orb.add(sPts);
  var sel=-1;
  function upd(){
    var cl=climb?D.climbers[WIN[wi]]||[]:null;
    for(var i=0;i<N;i++){var c=TC[S[i].g],dm=TDIM[S[i].g],a=al[i]*dm,sz=dia[i]*sm[i]*(i===sel?1.25:1);
      var x=Math.cos(ang[i])*rad[i], z=Math.sin(ang[i])*rad[i];
      sP[i*3]=x;sP[i*3+1]=yy[i];sP[i*3+2]=z;sS[i]=sz;sC[i*3]=c[0]*a;sC[i*3+1]=c[1]*a;sC[i*3+2]=c[2]*a;
      var span=clamp(Math.abs(om[i])*2.6,0.07,1.45)*(0.7+0.3*LANES[0]/ (rad[i]/R));
      for(var k=0;k<K;k++){var f=k/(K-1),an=ang[i]-f*span,o=(i*K+k)*3,fa=Math.pow(1-f,1.6)*0.75*a;
        tP[o]=Math.cos(an)*rad[i];tP[o+1]=yy[i];tP[o+2]=Math.sin(an)*rad[i];tS[i*K+k]=sz*(0.62-0.5*f);
        tC[o]=c[0]*fa;tC[o+1]=c[1]*fa;tC[o+2]=c[2]*fa;}
      for(k=0;k<K-1;k++){var o1=(i*K+k)*3,o2=o1+3,q=(i*LS+k*2)*3,f1=Math.pow(1-k/(K-1),1.2)*0.9*a,f2=Math.pow(1-(k+1)/(K-1),1.2)*0.9*a;
        lP[q]=tP[o1];lP[q+1]=tP[o1+1];lP[q+2]=tP[o1+2];lP[q+3]=tP[o2];lP[q+4]=tP[o2+1];lP[q+5]=tP[o2+2];
        lC[q]=c[0]*f1;lC[q+1]=c[1]*f1;lC[q+2]=c[2]*f1;lC[q+3]=c[0]*f2;lC[q+4]=c[1]*f2;lC[q+5]=c[2]*f2;}}
    sg.attributes.position.needsUpdate=sg.attributes.aS.needsUpdate=sg.attributes.aC.needsUpdate=true;
    tg.attributes.position.needsUpdate=tg.attributes.aS.needsUpdate=tg.attributes.aC.needsUpdate=true;
    lg.attributes.position.needsUpdate=lg.attributes.aC.needsUpdate=true;
  }

  // ---------------------------------------------------------------- HTML overlay: tier labels, ticker tags, reticle, callout
  var labels=D.tiers.map(function(t,ti){var e=document.createElement('div');e.className='rso-tl'+(ti===4?' dim':'');e.style.setProperty('--c',t.color);
    e.innerHTML=esc(t.label)+'<i>'+t.shown+(t.dust?' +'+t.dust.toLocaleString()+' dust':'')+'</i>';ov.appendChild(e);return e;});
  var topIdx=[]; (function(){var seen={};for(var i=0;i<N&&topIdx.length<6;i++){if(S[i].g===0){topIdx.push(i);seen[i]=1;}}
    for(var t=1;t<5;t++){for(i=0;i<N;i++){if(S[i].g===t){topIdx.push(i);break;}}}})();
  var tags={};
  function tag(i){if(tags[i]) return tags[i];var e=document.createElement('div');e.className='rso-tag';e.style.setProperty('--c',D.tiers[S[i].g].color);e.textContent=S[i].t;ov.appendChild(e);tags[i]=e;return e;}
  var svgNS='http://www.w3.org/2000/svg', lead=document.createElementNS(svgNS,'svg'); lead.setAttribute('class','rso-lead'); var lpath=document.createElementNS(svgNS,'path'); lead.appendChild(lpath); ov.appendChild(lead);
  var ret=document.createElement('div'); ret.className='rso-ret'; ov.appendChild(ret);
  var co=document.createElement('div'); co.className='rso-co'; co.setAttribute('role','dialog'); co.setAttribute('aria-live','polite'); ov.appendChild(co);
  var hint=root.querySelector('.rso-hint');
  var W=1,H=1, sx=new Float32Array(N),sy=new Float32Array(N),sr=new Float32Array(N),sdep=new Float32Array(N), coX=0,coY=0,coSide=0;

  function chgHTML(c,cls){return c==null?'<span class="nw">NEW</span>':c>0?'<span class="up">▲'+c+'</span>':c<0?'<span class="dn">▼'+(-c)+'</span>':'<span>=0</span>';}
  function spark(h,col){var v=[],lo=101,hi=-1;h.forEach(function(x,i){if(x!=null){v.push([i,x]);lo=Math.min(lo,x);hi=Math.max(hi,x);}});
    if(v.length<2) return '<svg class="sp" viewBox="0 0 186 46"><text x="93" y="26" fill="#7f9cc0" font-size="9" text-anchor="middle">no RS history yet</text></svg>';
    lo=Math.max(1,lo-3);hi=Math.min(99,hi+2);if(hi-lo<6){lo=Math.max(1,hi-6);}
    var n=h.length-1||1,X=function(i){return 2+i/n*182;},Y=function(x){return 42-(x-lo)/(hi-lo)*38;};
    var d='',pen=false;h.forEach(function(x,i){if(x==null){pen=false;return;}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(x).toFixed(1);pen=true;});
    var f=v[0],l=v[v.length-1], id='rsog'+Math.floor(Math.random()*1e6);
    var area='M'+X(f[0]).toFixed(1)+' 44'+v.map(function(p){return 'L'+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1);}).join('')+'L'+X(l[0]).toFixed(1)+' 44Z';
    return '<svg class="sp" viewBox="0 0 186 46" preserveAspectRatio="none"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity=".35"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'+
      '<path d="M2 '+Y(90).toFixed(1)+'H184" stroke="rgba(255,255,255,.13)" stroke-dasharray="2 3" fill="none" vector-effect="non-scaling-stroke"/>'+
      '<path d="'+area+'" fill="url(#'+id+')"/><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="filter:drop-shadow(0 0 3px '+col+')"/>'+
      '<circle cx="'+X(l[0]).toFixed(1)+'" cy="'+Y(l[1]).toFixed(1)+'" r="2.4" fill="#fff"/></svg>'+
      '<div class="spl"><span>'+esc((D.spark&&D.spark.from||'').slice(5))+' · RS '+f[1]+'</span><span>RS '+lo+'–'+hi+'</span><span>RS '+l[1]+' · '+esc((D.spark&&D.spark.to||'').slice(5))+'</span></div>';}
  function fillCo(){if(sel<0) return; var s=S[sel], t=D.tiers[s.g], w=WIN[wi];
    co.style.setProperty('--c',t.color); ret.style.setProperty('--c',t.color); lpath.setAttribute('stroke',t.color);
    co.innerHTML='<button class="x" aria-label="Close">×</button><div class="h">RANK #'+s.k+' · RS '+s.rs+' · '+chgHTML(s.c[wi])+' '+WL[w]+'</div>'+
      '<div class="tk"><b>'+esc(s.t)+'</b><span>'+esc(s.n)+'</span></div><div class="in">'+esc(t.label)+(s.ind?' · '+esc(s.ind):'')+(s.tt?' · TT ✓':'')+'</div>'+
      spark(s.h||[],t.color)+'<div class="ch">'+WIN.map(function(x,j){return '<div class="'+(j===wi?'on':'')+'"><small>'+WL[x]+(s.p[j]?' · was #'+s.p[j]:'')+'</small>'+chgHTML(s.c[j])+'</div>';}).join('')+'</div>'+
      '<a class="go" href="stock.html?t='+encodeURIComponent(s.t)+'">OPEN CHART ›</a>';
    co.querySelector('.x').addEventListener('click',function(e){e.stopPropagation();select(-1);});}
  function select(i){sel=i; if(i<0){co.classList.remove('on');ret.classList.remove('on');lpath.setAttribute('d','');need();return;}
    fillCo(); coSide=sx[i]>W/2?0:1; co.classList.add('on'); ret.classList.add('on'); placeCo(true); need();}
  function placeCo(force){if(sel<0) return; var cw=co.offsetWidth||206,ch=co.offsetHeight||170,x=sx[sel],y=sy[sel];
    if(!force&&((coSide===0&&x<cw+30)||(coSide===1&&x>W-cw-30))) coSide=1-coSide;
    coX=coSide===0?8:W-cw-8; var ty=y-ch-30; if(ty<6) ty=y+34; coY=clamp(ty,6,H-ch-6);
    co.style.transform='translate('+coX.toFixed(0)+'px,'+coY.toFixed(0)+'px)'+(co.classList.contains('on')?'':' scale(.96)');
    var ax=coSide===0?coX+cw:coX, ay=clamp(y,coY+14,coY+ch-14), mx=(x+ax)/2;
    lpath.setAttribute('d','M'+x.toFixed(1)+' '+y.toFixed(1)+'L'+mx.toFixed(1)+' '+ay.toFixed(1)+'L'+ax.toFixed(1)+' '+ay.toFixed(1));}

  // ---------------------------------------------------------------- camera / controls
  var yaw=0.5, pitch=0.34, zoom=1, yawV=0, lastUser=-1e9, tNow=0, dist=14, cy=0.3;
  function fit(){var asp=W/H, vf=cam.fov*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*asp);
    var halfW=R*1.16, top=CORE_Y+0.95, bot=TY[4]-R*Math.sin(pitch)*1.05-0.15, halfH=(top-bot)/2*Math.cos(pitch*0.35)+0.1; cy=(top+bot)/2;
    dist=Math.max(halfW/Math.tan(hf/2)+R*0.55*Math.cos(pitch), halfH/Math.tan(vf/2)+R*0.35)*1.0;}
  function placeCam(){var d=dist*zoom; cam.position.set(0,cy+d*Math.sin(pitch),d*Math.cos(pitch)); cam.lookAt(0,cy,0);
    var rt=fixed.userData.ret; rt.quaternion.copy(cam.quaternion); orb.rotation.y=yaw; stars.rotation.y=yaw*0.25;}
  function resize(){var r=stage.getBoundingClientRect(); W=Math.max(1,Math.round(r.width)); H=Math.max(1,Math.round(r.height));
    renderer.setSize(W,H,false); cam.aspect=W/H; cam.updateProjectionMatrix(); fit();
    U.uScale.value=H*PR/(2*Math.tan(cam.fov*Math.PI/360)); need();}
  var dirty=true; function need(){dirty=true;}
  var ptr={}, np=0, pinch0=0, zoom0=1, tap=null;
  function pd(e){return Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y);}
  function arr(){return Object.keys(ptr).map(function(k){return ptr[k];});}
  cv.addEventListener('pointerdown',function(e){var b=cv.getBoundingClientRect();ptr[e.pointerId]={x:e.clientX,y:e.clientY};np=Object.keys(ptr).length;
    try{cv.setPointerCapture(e.pointerId);}catch(_){}
    if(np===1) tap={x:e.clientX,y:e.clientY,t:performance.now(),bx:b.left,by:b.top,ok:true}; else {tap=null; if(np===2){pinch0=pd(arr());zoom0=zoom;}}
    yawV=0; lastUser=tNow; if(hint) hint.style.opacity='0';});
  cv.addEventListener('pointermove',function(e){var p=ptr[e.pointerId]; if(!p) return; var dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX;p.y=e.clientY;
    if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>9) tap.ok=false;
    if(np===1){yaw+=dx*0.0085; yawV=dx*0.0085*60; if(e.pointerType!=='touch'){pitch=clamp(pitch+dy*0.004,0.1,0.8); fit();}}
    else if(np===2){var d=pd(arr()); if(pinch0>0) zoom=clamp(zoom0*pinch0/d,0.55,1.6);}
    lastUser=tNow; need();});
  function up(e,cancel){if(!ptr[e.pointerId]) return; delete ptr[e.pointerId]; np=Object.keys(ptr).length;
    if(!cancel&&tap&&tap.ok&&np===0&&performance.now()-tap.t<500) pick(e.clientX-tap.bx,e.clientY-tap.by);
    if(np===0) tap=null; if(np<2) pinch0=0;}
  cv.addEventListener('pointerup',function(e){up(e,false);}); cv.addEventListener('pointercancel',function(e){up(e,true);});
  stage.addEventListener('touchmove',function(e){if(e.touches&&e.touches.length>1) e.preventDefault();},{passive:false});
  stage.addEventListener('gesturestart',function(e){e.preventDefault();});
  cv.addEventListener('wheel',function(e){if(!e.ctrlKey) return; e.preventDefault(); zoom=clamp(zoom*(1+e.deltaY*0.01),0.55,1.6); need();},{passive:false});
  cv.setAttribute('tabindex','0');
  cv.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'){yaw-=0.15;need();}else if(e.key==='ArrowRight'){yaw+=0.15;need();}else if(e.key==='Escape'){select(-1);}});
  function pick(x,y){var best=-1,bd=1e9;for(var i=0;i<N;i++){if(climb&&al[i]<0.5) continue;var d=Math.hypot(sx[i]-x,sy[i]-y),lim=Math.max(sr[i]+9,15);
      if(d<lim){var sc=d-sdep[i]*2-(sr[i]*0.3);if(sc<bd){bd=sc;best=i;}}}
    select(best===sel?-1:best);}

  // ---------------------------------------------------------------- toggles
  var segB=root.querySelectorAll('.rso-seg button'), clB=root.querySelector('.rso-climb'), clBox=root.querySelector('.rso-cls'), legW=root.querySelector('[data-win]');
  function setTargets(){var cl=climb?(D.climbers[WIN[wi]]||[]):null, set={}; if(cl) cl.forEach(function(t){set[t]=1;});
    for(var i=0;i<N;i++){omT[i]=omega(i); alT[i]=cl?(set[S[i].t]?1:0.13):1; smT[i]=cl&&set[S[i].t]?1.22:1;}
    ringMats.forEach(function(m,t){m.uniforms.uDim.value=TDIM[t]*(cl?0.55:1);}); dustMat.uniforms.uDim.value=cl?0.35:1;
    if(legW) legW.textContent=WL[WIN[wi]];
    if(clBox){if(cl){clBox.innerHTML=cl.map(function(t){var i=byT[t],s=S[i];return '<button data-i="'+i+'" style="--c:'+D.tiers[s.g].color+'">'+esc(t)+'<i>▲'+(s.c[wi]==null?'new':s.c[wi])+'</i></button>';}).join('')||'<span>none</span>'; clBox.hidden=false;}
      else{clBox.hidden=true; clBox.innerHTML='';}}
    if(sel>=0) fillCo(); if(RM){for(i=0;i<N;i++){om[i]=omT[i];al[i]=alT[i];sm[i]=smT[i];}} need();}
  segB.forEach(function(b,j){b.addEventListener('click',function(){wi=WIN.indexOf(b.getAttribute('data-w')); segB.forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');}); setTargets();});});
  if(clB) clB.addEventListener('click',function(){climb=!climb; clB.classList.toggle('on',climb); clB.setAttribute('aria-pressed',climb?'true':'false'); setTargets();});
  if(clBox) clBox.addEventListener('click',function(e){var b=e.target.closest('button[data-i]'); if(b){var i=+b.getAttribute('data-i'); render(0); select(i);}});
  setTargets();

  // ---------------------------------------------------------------- frame
  var v=new THREE.Vector3(), running=true, vis=true, last=performance.now(), frames=0;
  function project(){var sc=H/(2*Math.tan(cam.fov*Math.PI/360)); orb.updateMatrixWorld(); var mw=orb.matrixWorld, mv=cam.matrixWorldInverse;
    for(var i=0;i<N;i++){v.set(sP[i*3],sP[i*3+1],sP[i*3+2]).applyMatrix4(mw); var w=v.clone().applyMatrix4(mv); sdep[i]=clamp((-w.z-(dist*zoom))/-R,-1.2,1.2);
      v.project(cam); sx[i]=(v.x*0.5+0.5)*W; sy[i]=(-v.y*0.5+0.5)*H; sr[i]=sS[i]*sc/(-w.z)/2;}}
  function overlay(){
    TY.forEach(function(y,t){v.set(-R*1.0,y,0).project(cam); var x=(v.x*0.5+0.5)*W, yy2=(-v.y*0.5+0.5)*H; labels[t].style.transform='translate('+Math.max(6,x-4).toFixed(0)+'px,'+(yy2-15).toFixed(0)+'px)';});
    var show={}, cl=climb?(D.climbers[WIN[wi]]||[]):null;
    if(cl) cl.forEach(function(t){show[byT[t]]=1;}); else topIdx.forEach(function(i){show[i]=1;});
    if(sel>=0) show[sel]=1;
    for(var k in tags){if(!show[k]) tags[k].style.opacity='0';}
    for(k in show){var i=+k,e=tag(i),fr=sdep[i]; e.classList.toggle('cl',!!cl);
      e.style.opacity=String(i===sel?1:clamp(0.35+0.65*(fr+0.6),0.3,1));
      e.style.transform='translate('+(sx[i]+sr[i]*0.75+2).toFixed(0)+'px,'+(sy[i]-sr[i]*0.75-12).toFixed(0)+'px)';}
    if(sel>=0){ret.style.transform='translate('+sx[sel].toFixed(1)+'px,'+sy[sel].toFixed(1)+'px)'; placeCo(false);}}
  function render(dt){
    if(!RM){tNow+=dt; U.uTime.value=tNow;
      if(tNow-lastUser>2.5&&np===0){yawV+=(0.05-yawV)*Math.min(1,dt*0.8);} else if(np===0){yawV*=Math.pow(0.04,dt);}
      if(np===0) yaw+=yawV*dt;
      var e=Math.min(1,dt*3);
      for(var i=0;i<N;i++){om[i]+=(omT[i]-om[i])*e; al[i]+=(alT[i]-al[i])*e; sm[i]+=(smT[i]-sm[i])*e; ang[i]+=om[i]*dt*(i===sel?0.15:1);}
      var c=fixed.userData.core; c.rotation.y+=dt*0.25;}
    placeCam(); upd(); renderer.render(scene,cam); project(); overlay(); dirty=false; frames++;}
  function loop(now){requestAnimationFrame(loop); var dt=Math.min(0.05,(now-last)/1000); last=now;
    if(!running||!vis||document.hidden) return; if(RM&&!dirty) return; render(dt);}
  if('IntersectionObserver' in window){new IntersectionObserver(function(en){vis=en[0].isIntersecting; if(vis) need();},{rootMargin:'80px'}).observe(stage);}
  if('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize',resize);
  resize(); render(0); requestAnimationFrame(loop);
  root.classList.add('live');
  window.RSO={select:function(t){var i=byT[t]; if(i!=null){render(0); select(i);} return i;}, frames:function(){return frames;}, n:N,
    pos:function(t){var i=byT[t]; if(i==null) return null; var b=cv.getBoundingClientRect(); return {x:b.left+sx[i],y:b.top+sy[i],r:sr[i]};}, sel:function(){return sel<0?null:S[sel].t;}};
}
})();
