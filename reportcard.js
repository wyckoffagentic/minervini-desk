/* ===== REPORT CARDS — shared inline drop-down company cards (research-tools/reportcards.py copies this to site/public/) =====
   Loads reportcards.js (window.RC_DATA, generated daily from feeds/fundamentals/latest.json) next to this script, then makes every
   ticker on the page tappable: tap -> an inline card opens under the row / chip / card; tap again (or ✕) -> closes.
   Tickers already linked by the trade-chart linker (a.tc-link) open the card too; the 🕹 buttons and the card's "Chart" link still
   open the chart modal. Works from file:// and on iPhone (tap targets, 390px layout). No third-party code. */
(function(){
  'use strict';
  if(window.__RC) return; window.__RC=true;
  var me=document.currentScript, src=(me&&me.src)||'';
  var BASE=src?src.replace(/reportcard\.js(?:[?#].*)?$/,''):'';
  var D=null, TK={}, RE=null;
  var STOP={RS:1,TT:1,ATR:1,SEPA:1,VCP:1,HTF:1,EPS:1,USD:1,CEO:1,ETF:1,PASS:1,FAIL:1,NEW:1,ADR:1,IPO:1,AI:1,US:1,NYSE:1,SEC:1,FY:1,YTD:1,
    ALL:1,ON:1,IT:1,NOW:1,BE:1,ARE:1,A:1,I:1,SMA:1,EMA:1,RSI:1,OK:1,TBD:1,NA:1,PM:1,AM:1,ET:1,PT:1,UTC:1,HBM:1,GPU:1,CPU:1,DRAM:1,NAND:1,
    GO:1,SO:1,AN:1,OR:1,AT:1,BY:1,TO:1,UP:1,DO:1,IN:1,OF:1,NO:1,ME:1,MY:1,WE:1,HE:1,KEY:1,BIG:1,TOP:1,LOW:1,HIGH:1,OUT:1,PLAY:1,CASH:1,
    BEAT:1,RUN:1,SEE:1,ONE:1,TWO:1,CAN:1,HAS:1,ANY:1,AGO:1,ARM:0};
  var SKIP='script,style,textarea,select,option,input,code,pre,svg,noscript,nav,title,h1,th,button,footer,.rc-card,.tc-modal,[data-no-rc],#banner,.tape,.rc-tk,a,.tc-btn,.logo';
  var CELL='td.tkc,.tk,.tkbig,.tkb,.chip';

  var css=document.createElement('style'); css.id='rc-style';
  css.textContent=
   '.rc-tk,[data-rc]{cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;-webkit-tap-highlight-color:rgba(255,210,63,.5)}'+
   '.rc-tk:focus-visible,[data-rc]:focus-visible{outline:3px solid #ffd23f;outline-offset:2px;border-radius:4px}'+
   '.rc-open{background:#fff3b0;border-radius:4px}'+
   'tr.rc-row>td{padding:0!important;border:0!important;background:transparent!important}'+
   '.rc-card{position:sticky;left:0;box-sizing:border-box;width:min(100%,calc(100vw - 28px));max-width:980px;margin:8px 0 12px;background:#fffdf5;color:var(--ink,#1b1b3a);'+
     'border:3px solid var(--ink,#1b1b3a);border-radius:16px;box-shadow:4px 4px 0 var(--ink,#1b1b3a);padding:12px 14px;font:500 14px/1.4 Fredoka,system-ui,sans-serif;text-align:left;white-space:normal;flex-basis:100%;grid-column:1/-1;letter-spacing:0;text-transform:none}'+
   '.rc-card *{box-sizing:border-box}'+
   '.rc-hd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-bottom:6px}'+
   '.rc-hd .rc-t{font-size:22px;font-weight:700}.rc-hd .rc-n{font-weight:600;opacity:.85}'+
   '.rc-x{margin-left:auto;border:2px solid var(--ink,#1b1b3a);background:#fff;border-radius:999px;width:34px;height:34px;font-size:16px;cursor:pointer;flex:none}'+
   '.rc-chip{display:inline-block;border:2px solid var(--ink,#1b1b3a);border-radius:999px;padding:0 8px;font-size:12px;font-weight:700;background:#fff;white-space:nowrap}'+
   '.rc-chip.ai{background:#c9b6ff}.rc-chip.sec{background:#8fe3ff}.rc-chip.lim{background:#ffd9a8}.rc-chip.g{background:#9dffb0}.rc-chip.r{background:#ffb3b3}.rc-chip.tag{background:#fff36b}'+
   '.rc-what{font-size:15px;margin:2px 0 8px}.rc-what small{opacity:.6}'+
   '.rc-ov{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;background:#fff;border:2px dashed var(--ink,#1b1b3a);border-radius:12px;padding:8px 10px;margin-bottom:8px}'+
   '.rc-big{font-size:30px;font-weight:700;line-height:1;min-width:64px;text-align:center;border:3px solid var(--ink,#1b1b3a);border-radius:14px;padding:6px 8px;background:#ffd23f}'+
   '.rc-big small{display:block;font-size:10px;font-weight:700;letter-spacing:.5px}'+
   '.rc-bars{flex:1;min-width:210px;display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;align-items:center;font-size:12.5px;font-weight:600}'+
   '.rc-bar{height:10px;border:2px solid var(--ink,#1b1b3a);border-radius:6px;background:#eee;overflow:hidden}.rc-bar i{display:block;height:100%;background:#7dff8a}'+
   '.rc-bar i.m{background:#ffe066}.rc-bar i.l{background:#ff9e9e}'+
   '.rc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px}'+
   '.rc-box{background:#fff;border:2px solid var(--ink,#1b1b3a);border-radius:12px;padding:8px 10px}'+
   '.rc-box h4{margin:0 0 4px;font-size:14px;font-weight:700}.rc-box ul{margin:4px 0 0;padding-left:18px}.rc-box li{margin:2px 0}'+
   '.rc-kv{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #bbb;padding:1px 0}.rc-kv b{text-align:right}'+
   '.rc-q{overflow-x:auto;margin-top:8px;-webkit-overflow-scrolling:touch}.rc-q table{border-collapse:collapse;font-size:12.5px;width:100%;min-width:420px}'+
   '.rc-q th,.rc-q td{border:1px solid #ccc;padding:2px 6px;text-align:right;white-space:nowrap}.rc-q th{background:#ffd23f;font-size:11px}.rc-q td:first-child,.rc-q th:first-child{text-align:left}'+
   '.rc-ft{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin-top:8px;font-size:12px;opacity:.9}'+
   '.rc-ft a{font-weight:700;color:inherit;border:2px solid var(--ink,#1b1b3a);border-radius:999px;padding:2px 10px;background:#fff;text-decoration:none}'+
   '.up{color:#0a7a2a}.dn{color:#b3261e}'+
   '@media (max-width:760px){.rc-card{font-size:13.5px;padding:10px;width:calc(100vw - 24px)}.rc-hd .rc-t{font-size:19px}.rc-big{font-size:26px}.rc-grid{grid-template-columns:1fr}}';
  document.head.appendChild(css);

  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function num(v,nd){if(v==null||isNaN(v))return 'n/a';return Number(v).toLocaleString('en-US',{minimumFractionDigits:nd==null?2:nd,maximumFractionDigits:nd==null?2:nd});}
  function big(v){if(v==null)return 'n/a';var a=Math.abs(v);return (v<0?'-':'')+(a>=1e9?(a/1e9).toFixed(2)+'B':a>=1e6?(a/1e6).toFixed(1)+'M':a>=1e3?(a/1e3).toFixed(0)+'K':a.toFixed(0));}
  function pct(v,nd){if(v==null)return 'n/a';return '<span class="'+(v>=0?'up':'dn')+'">'+(v>=0?'+':'')+Number(v).toFixed(nd==null?1:nd)+'%</span>';}
  function g(s){if(!s||s==='n/a')return 'n/a';if(s==='TA')return '<span class="up" title="turnaround: loss to profit">TA</span>';return '<span class="'+(s.charAt(0)==='-'?'dn':'up')+'">'+esc(s)+'</span>';}
  function ord(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
  function bar(label,v,miss){var c=v==null?'':v>=65?'':v>=40?'m':'l';return '<span>'+label+'</span><span class="rc-bar"><i class="'+c+'" style="width:'+(v==null?0:v)+'%"></i></span><b>'+(v==null?'n/a':v)+(miss?' <small>'+esc(miss)+'</small>':'')+'</b>';}
  function kv(k,v){return '<div class="rc-kv"><span>'+k+'</span><b>'+v+'</b></div>';}

  function card(t){
    var x=D.t[t]; if(!x) return '';
    var e=x.e||{}, fw=e.fwd||{}, oc=x.oc||{}, h=[];
    h.push('<div class="rc-hd"><span class="rc-t">'+esc(t)+'</span><span class="rc-n">'+esc(x.n||'')+'</span>'+
      '<span class="rc-chip sec">'+esc(x.sec||'Unclassified')+'</span>'+(x.ai?'<span class="rc-chip ai" title="AI-stack role, from the company description">AI · '+esc(x.ai)+'</span>':'')+
      (e.lim?'<span class="rc-chip lim">limited data</span>':'')+'<button type="button" class="rc-x" aria-label="Close report card">✕</button></div>');
    h.push('<div class="rc-what">'+(x.w?'🏭 '+esc(x.w)+' <small>('+esc(x.ws||'description')+')</small>':'🏭 <i>No company description available.</i>')+
      (x.ind?'<br><small>Industry: '+esc(x.ind)+(x.sic?' · SIC '+esc(x.sic):'')+'</small>':'')+'</div>');
    var tags=(x.ot||[]).map(function(s){return '<span class="rc-chip lim">'+esc(s)+'</span>';}).join(' ');
    h.push('<div class="rc-ov"><div class="rc-big" title="Overall score 0-100">'+(x.o==null?'n/a':x.o)+'<small>OVERALL</small></div><div class="rc-bars">'+
      bar('RS',oc.rs)+bar('Earnings',oc.earnings,e.lim?'limited':null)+bar('Sector',oc.sector)+bar('Peers',oc.peers)+'</div>'+(tags?'<div>'+tags+'</div>':'')+'</div>');
    var eb=['<div class="rc-box"><h4>📈 Earnings '+(e.s==null?'<span class="rc-chip lim">n/a</span>':'<span class="rc-chip '+(e.s>=65?'g':e.s>=40?'tag':'r')+'">'+e.s+'/100</span>')+
      ' '+(e.tags||[]).map(function(s){return '<span class="rc-chip tag">'+esc(s)+'</span>';}).join(' ')+'</h4>'];
    eb.push(kv('EPS latest qtr YoY',e.eq?g(e.eq):'n/a')+kv('Sales latest qtr YoY',e.sq!=null?pct(e.sq,0):'n/a')+
      kv('EPS growth, last 3 qtrs',(e.ea&&e.ea.length)?e.ea.map(g).join(' → '):'n/a')+
      kv('Sales growth, last 3 qtrs',(e.sa&&e.sa.length)?e.sa.map(g).join(' → '):'n/a')+
      kv('Consensus FY EPS growth',g(fw.cg)+' this yr · '+g(fw.ng)+' next')+
      kv('Last report',(e.lr||'n/a')+(e.su!=null?' · '+(e.su>=0?'beat ':'miss ')+(Math.abs(e.su)>100?'>100%':Math.abs(e.su).toFixed(0)+'%'):''))+kv('Next report',e.nr||'n/a')+
      (e.smed!=null?kv('Sector median score',e.smed+(e.srk?' · this: '+ord(e.srk)+' of '+e.sn:'')):''));
    if(e.b&&e.b.length) eb.push('<ul>'+e.b.map(function(s){return '<li>'+esc(s)+'</li>';}).join('')+'</ul>');
    eb.push('</div>');
    var r=x.r||{}, rb=['<div class="rc-box"><h4>💪 Relative strength</h4>'];
    rb.push(kv('RS rating (IBD-style)',r.rs!=null?r.rs+(r.rk?' · #'+r.rk+' of '+num(r.un,0):''):'n/a')+
      kv('Rank vs peers',r.gr?ord(r.gr)+' of '+r.gn+' in '+esc(r.g||''):'n/a')+
      kv('Rank in sector',r.sr?ord(r.sr)+' of '+r.sn+' in '+esc(x.sec||''):'n/a')+
      kv('Group standing',r.ld?esc(r.ld):'n/a')+
      kv('YTD 2026',x.y?pct(x.y.p):'n/a')+kv('Sector median YTD',x.sy!=null?pct(x.sy):'n/a')+
      kv('Trend Template',r.tt==null?'n/a':(r.tt?'✅ pass':'✗ fail'))+'</div>');
    var gs=(D.g||{})[x.gu]||{}, gb=['<div class="rc-box"><h4>🧭 Sector &amp; peers <small>('+esc(x.gu||x.sec||'')+')</small></h4>'];
    gb.push(gs.n?kv('Group trend',esc(gs.trend)+' · bull '+gs.bull_score+'/100')+kv('Breadth: Trend Template / >50d',Math.round(gs.tt_share*100)+'% / '+Math.round(gs.above50_share*100)+'%')+
      kv('Median return 1m / 3m / 6m',pct(gs.med_1m,1)+' / '+pct(gs.med_3m,0)+' / '+pct(gs.med_6m,0))+kv('Group RS rank',gs.group_rs_rank+' of '+gs.groups_n)+
      kv('Peer momentum',gs.peer_score+'/100 · '+Math.round(gs.rs90_share*100)+'% RS 90+ · '+gs.top50+' in Top 50 · '+gs.breakouts+' breakouts')+
      kv('Breadth trend (RS 80+, 4 wks)',gs.breadth_trend==null?'n/a':pct(gs.breadth_trend*100,0).replace('%','pp')):'<i>No sector data.</i>');
    gb.push('</div>');
    var st=x.st||[], sb='';
    if(st.length) sb='<div class="rc-box"><h4>🎯 In the scanners</h4>'+st.map(function(s){return '<div class="rc-kv"><span>'+esc(s.type)+'</span><b>'+(s.a?'⚡ ':'👀 ')+esc(s.status)+
      (s.pv!=null?' · pivot '+num(s.pv):'')+(s.sp!=null?' · stop '+num(s.sp):'')+'</b></div>';}).join('')+'</div>';
    h.push('<div class="rc-grid">'+eb.join('')+rb.join('')+gb.join('')+sb+'</div>');
    var q=e.q||[];
    if(q.length){
      h.push('<div class="rc-q"><table><tr><th>Qtr end</th><th>EPS</th><th>YoY</th><th>Sales</th><th>YoY</th><th>Net margin</th></tr>'+
        q.slice().reverse().map(function(z){return '<tr><td>'+esc(z.end)+(z.d?' <small title="Q4 = fiscal year minus 9-month YTD">d</small>':'')+'</td><td>'+num(z.eps)+'</td><td>'+g(z.ey)+'</td><td>'+big(z.rev)+'</td><td>'+g(z.ry)+'</td><td>'+(z.m==null?'n/a':z.m.toFixed(1)+'%')+'</td></tr>';}).join('')+
        '</table></div>');
    }
    if(e.an&&e.an.length) h.push('<div style="font-size:12.5px;margin-top:6px"><b>Annual EPS:</b> '+e.an.map(function(a){return esc(a.end.slice(0,4))+' '+num(a.eps);}).join(' · ')+
      (fw.ce!=null?' · <b>Consensus:</b> this FY '+num(fw.ce)+', next FY '+num(fw.ne)+(fw.cur?' ('+esc(fw.cur)+')':''):'')+'</div>');
    var links=[];
    if(x.ch) links.push('<a class="tc-btn rc-chart" data-tc="'+esc(t)+'" href="'+BASE+'charts/'+encodeURIComponent(t)+'.html">🕹 Chart</a>');
    if(x.tp) links.push('<a href="'+BASE+'tickers/'+encodeURIComponent(t)+'.html">📄 Ticker page</a>');
    if(st.length) links.push('<a href="'+BASE+'setups.html#master">🎯 Setups</a>');
    if(x.cik) links.push('<a target="_blank" rel="noopener" href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK='+x.cik+'&type=10-&dateb=&owner=include&count=40">SEC filings ↗</a>');
    h.push('<div class="rc-ft">'+links.join('')+'<span>History: '+esc(e.src||'n/a')+(e.qe?' (latest qtr '+esc(e.qe)+')':'')+' · Estimates: '+esc(fw.src||'n/a')+(fw.asof?' as of '+esc(fw.asof):'')+
      ' · RS &amp; prices: US close '+esc(D.session||'')+' · Card built '+esc(D.generated||'')+'</span></div>');
    return '<div class="rc-card" data-no-chart data-rc-for="'+esc(t)+'">'+h.join('')+'</div>';
  }

  function hostOf(el){
    var tr=el.closest('tr'); if(tr&&tr.parentNode&&tr.parentNode.tagName!=='THEAD'&&!tr.classList.contains('rc-row')) return {tr:tr};
    var b=el.closest('li,.card,.chip,.cat,.idx,.stp-act,.stp,p,.sig,.bubble,.tc-card,div')||el.parentNode;
    return {b:b};
  }
  function toggle(el,t){
    var h=hostOf(el), next;
    if(h.tr){
      next=h.tr.nextElementSibling;
      if(next&&next.classList.contains('rc-row')){var same=next.getAttribute('data-rc-for')===t; next.remove(); clearOpen(h.tr); if(same) return;}
      var row=document.createElement('tr'); row.className='rc-row'; row.setAttribute('data-rc-for',t);
      row.setAttribute('data-tt','1'); row.setAttribute('data-q',t);
      row.innerHTML='<td colspan="99">'+card(t)+'</td>'; h.tr.parentNode.insertBefore(row,h.tr.nextSibling);
      el.classList.add('rc-open'); wire(row); return;
    }
    next=h.b.nextElementSibling;
    if(next&&next.classList.contains('rc-card')){var same2=next.getAttribute('data-rc-for')===t; next.remove(); clearOpen(h.b); if(same2) return;}
    var tmp=document.createElement('div'); tmp.innerHTML=card(t); var c=tmp.firstChild;
    h.b.parentNode.insertBefore(c,h.b.nextSibling); el.classList.add('rc-open'); wire(c);
  }
  function clearOpen(root){root.querySelectorAll('.rc-open').forEach(function(x){x.classList.remove('rc-open');});}
  function wire(c){var x=c.querySelector('.rc-x'); if(x) x.addEventListener('click',function(ev){ev.stopPropagation();
    var host=c.classList.contains('rc-row')?c:c, prev=(c.tagName==='TR'?c:c).previousElementSibling; if(prev) clearOpen(prev); c.remove();});}

  window.addEventListener('click',function(ev){
    var t=ev.target; if(!t.closest) return;
    if(t.closest('th.sort,.filters button')){document.querySelectorAll('tr.rc-row').forEach(function(r){r.remove();});return;}
    if(t.closest('.rc-card')) return;
    var el=t.closest('[data-rc],.rc-tk'); if(!el||el.closest('.tc-btn')) return;
    if(ev.button!==0||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey) return;
    var tk=el.getAttribute('data-rc')||el.getAttribute('data-tc'); if(!tk||!D||!D.t[tk]) return;
    ev.preventDefault(); ev.stopPropagation(); toggle(el,tk);
  },true);
  window.addEventListener('keydown',function(ev){
    if(ev.key!=='Enter'&&ev.key!==' ') return; var el=ev.target; if(!el||!el.getAttribute||!el.getAttribute('data-rc')||el.tagName==='A') return;
    ev.preventDefault(); toggle(el,el.getAttribute('data-rc'));
  },true);
  document.addEventListener('input',function(ev){if(ev.target&&ev.target.id==='q') document.querySelectorAll('tr.rc-row').forEach(function(r){r.remove();});},true);

  function mark(el,t){el.setAttribute('data-rc',t); if(el.tagName!=='A'){el.setAttribute('role','button'); el.setAttribute('tabindex','0');} el.setAttribute('aria-label',(el.getAttribute('aria-label')||t)+' — open report card'); el.title=el.title||('Tap for the '+t+' report card');}
  function decorate(root){
    // 1) anchors whose text is a ticker (chart links, ticker-page links): the tap opens the card, the card links onwards
    root.querySelectorAll('a').forEach(function(a){
      if(a.hasAttribute('data-rc')||a.classList.contains('tc-btn')||a.closest('nav,.rc-card,.tc-modal,[data-no-rc],.tape,footer,.logo')) return;
      var t=(a.getAttribute('data-tc')||(a.textContent||'').replace(/🕹/g,'')).trim(); if(TK[t]) mark(a,t);
    });
    // 2) exact ticker cells (also 1-letter / word-like tickers, only in ticker cells)
    root.querySelectorAll('a.tc-card > b').forEach(function(el){var t=(el.textContent||'').trim(); if(TK[t]&&!el.hasAttribute('data-rc')){mark(el,t); el.classList.add('rc-tk');}});
    root.querySelectorAll(CELL+',td.tkc b,.tk b').forEach(function(el){
      if(el.closest(SKIP.replace(',.rc-tk',''))&&!el.matches(CELL)) return;
      if(el.querySelector('[data-rc],.rc-tk,a')) return;
      var s=(el.textContent||'').trim(), t=s.split(/[\s<]/)[0];
      if(TK[t]&&(s===t||el.matches('.chip'))&&el.children.length===0){ mark(el,t); el.classList.add('rc-tk'); }
    });
    // 3) plain-text mentions anywhere else (tables, chips, bubbles, lists, prose)
    if(!RE) return;
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
      if(!n.nodeValue||n.nodeValue.length<2) return NodeFilter.FILTER_REJECT;
      var p=n.parentElement; if(!p||p.closest(SKIP)||p.closest('[data-rc]')) return NodeFilter.FILTER_REJECT;
      RE.lastIndex=0; return RE.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
    var nodes=[],n; while((n=w.nextNode())) nodes.push(n);
    nodes.forEach(function(node){
      var s=node.nodeValue,frag=document.createDocumentFragment(),i=0,m; RE.lastIndex=0;
      while((m=RE.exec(s))){var st=m.index+m[1].length; if(st>i) frag.appendChild(document.createTextNode(s.slice(i,st)));
        var sp=document.createElement('span'); sp.className='rc-tk'; sp.textContent=m[2]; mark(sp,m[2]); frag.appendChild(sp); i=st+m[2].length;}
      if(i<s.length) frag.appendChild(document.createTextNode(s.slice(i)));
      node.parentNode.replaceChild(frag,node);
    });
  }
  function init(){
    D=window.RC_DATA; if(!D||!D.t) return;
    Object.keys(D.t).forEach(function(t){TK[t]=1;});
    var list=Object.keys(TK).filter(function(t){return t.length>=2&&!STOP[t];}).sort(function(a,b){return b.length-a.length;});
    if(list.length) RE=new RegExp('(^|[^A-Za-z0-9$/_.\\-])('+list.map(function(t){return t.replace(/[.\-]/g,'\\$&');}).join('|')+')(?![A-Za-z0-9_\\-]|\\.[A-Za-z])','g');
    decorate(document.body);
    var mm=/[#&?]card=([A-Z.\-]{1,8})/.exec(location.hash+location.search);
    if(mm&&TK[mm[1]]){var el=document.querySelector('[data-rc="'+mm[1]+'"]'); if(el){toggle(el,mm[1]); el.scrollIntoView({block:'center'});}}
    window.ReportCards={open:function(t){var el=document.querySelector('[data-rc="'+t+'"]'); if(el) toggle(el,t);},tickers:Object.keys(TK),ready:true};
    document.documentElement.setAttribute('data-rc-ready','1');
  }
  function load(){
    if(window.RC_DATA){init();return;}
    var s=document.createElement('script'); s.src=BASE+'reportcards.js'+(me&&me.getAttribute('data-v')?'?v='+me.getAttribute('data-v'):'');
    s.onload=function(){setTimeout(init,0);}; s.onerror=function(){s.remove();}; document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(load,0);}); else setTimeout(load,0);
})();
