/* wa_pos.js - the desk's ONE position-size helper (added 4 Oct 2026, Chris: "for all trades use a $10,000 default, assumed bought at our buy
   stops: tell me the risk as per the stop and the profit targets at 2R and 3R; allow the 10,000 to be changeable").
   $ POSITION SIZE per trade (NOT account size), filled at the plan's buy-stop entry (shorts: sell-stop entry):
     shares   = floor(size / entry)
     risk/sh  = entry - stop (long) | stop - entry (short)      $ risk = shares x risk/sh      % risk = risk/sh / entry x 100
     2R / 3R  = entry +/- 2 / 3 x risk/sh                        $ at 2R / 3R = shares x 2 / 3 x risk/sh
   ACTIVE (triggered) trades, given the last close (Chris 4 Oct: "show the current profit for active trades"):
     $ P/L    = shares x (last - entry) (short: entry - last)    % = (last - entry) / entry (short inverted)    R = (last - entry) / risk/sh
     WAPos.now(o) -> 'NOW 102.50 → +$469 (+4.7%) · +1.5R'; WAPos.plc(o) -> '+$469'.  Pending plans: no last passed -> nothing.
   One size for every page: localStorage wa.desk.possize.v1 (default 10000). WAPos.set(v) saves it and every chart / table on every open
   page follows live ('wapos' event in this page, 'storage' in other tabs and the inline chart iframes).
   Mirrored for Python (email / feeds) in research-tools/trade_pct.py position().  Loaded in <head> of every page by research-tools/unify.py. */
(function(w){
  'use strict';
  if(w.WAPos)return;
  var KEY='wa.desk.possize.v1',DEF=10000,MIN=100,MAX=1e8;
  function num(v){v=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,''));return isFinite(v)?v:null;}
  function get(){var v=null;try{v=num(localStorage.getItem(KEY));}catch(e){}return v&&v>=MIN&&v<=MAX?v:DEF;}
  function set(v){v=num(v);if(!(v>=MIN&&v<=MAX))return false;try{localStorage.setItem(KEY,String(Math.round(v)));}catch(e){}
    try{w.dispatchEvent(new CustomEvent('wapos',{detail:Math.round(v)}));}catch(e){}return true;}
  function calc(entry,stop,side,size,last){
    var e=num(entry),s=num(stop),sz=num(size)||get(),lc=num(last);side=side==='short'?'short':'long';
    if(!(e>0))return null;
    var sh=Math.floor(sz/e),o={size:sz,side:side,entry:e,stop:s,shares:sh,cost:sh*e};
    var r=s==null?null:(side==='long'?e-s:s-e);
    if(r!=null&&r>0){var d=side==='long'?1:-1;o.risk_sh=r;o.risk=sh*r;o.risk_pct=r/e*100;o.r2=e+d*2*r;o.r3=e+d*3*r;o.p2=sh*2*r;o.p3=sh*3*r;}
    if(lc!=null&&lc>0){var dd=side==='long'?1:-1;o.last=lc;o.pl=sh*(lc-e)*dd;o.pl_pct=(lc-e)/e*100*dd;o.pl_r=(r!=null&&r>0)?(lc-e)*dd/r:null;}
    return o;}
  function sgnUsd(v){return (v>=0?'+':'-')+usd(Math.abs(v));}
  function plc(o){return o&&o.pl!=null?sgnUsd(o.pl):'';}
  function now(o){if(!o||o.pl==null)return '';return 'NOW '+px(o.last)+' → '+sgnUsd(o.pl)+' ('+(o.pl_pct>=0?'+':'')+o.pl_pct.toFixed(1)+'%)'+(o.pl_r!=null?' · '+(o.pl_r>=0?'+':'')+o.pl_r.toFixed(1)+'R':'');}
  function usd(v,dp){return v==null?'—':'$'+Number(v).toLocaleString('en-US',{minimumFractionDigits:dp||0,maximumFractionDigits:dp||0});}
  function px(v){return v==null?'—':Number(v).toFixed(2);}
  function line(o){   // compact one-liner for tables / cards
    if(!o)return '';var h=usd(o.size)+' → '+o.shares.toLocaleString('en-US')+' sh @ '+px(o.entry);
    return o.risk!=null?h+' · risk '+usd(o.risk)+' ('+o.risk_pct.toFixed(1)+'%) · 2R '+px(o.r2)+' +'+usd(o.p2)+' · 3R '+px(o.r3)+' +'+usd(o.p3):h+' · no stop';}
  function on(fn){w.addEventListener('wapos',function(){fn(get());});w.addEventListener('storage',function(e){if(e.key===KEY)fn(get());});}
  // any element <span data-wapos data-e="ENTRY" data-s="STOP" [data-side="short"]> is filled with line() and kept live (desk.js calls fill())
  // ... with data-l="LAST" data-open="1" (triggered plan) it adds ' · NOW ...'; <span data-wapos-pl data-e data-s data-l [data-side]> = the compact '+$469'
  function fill(root){(root||document).querySelectorAll('[data-wapos]').forEach(function(el){var op=el.getAttribute('data-open')==='1',o=calc(el.getAttribute('data-e'),el.getAttribute('data-s'),el.getAttribute('data-side'),null,op?el.getAttribute('data-l'):null);
    el.textContent=o?line(o)+(o.pl!=null?' · '+now(o):''):'';el.title='$ position size per trade (not account size), bought at the buy-stop entry; change it in any chart RISK box';});
    (root||document).querySelectorAll('[data-wapos-pl]').forEach(function(el){var o=calc(el.getAttribute('data-e'),el.getAttribute('data-s'),el.getAttribute('data-side'),null,el.getAttribute('data-l'));
      el.textContent=plc(o);if(o&&o.pl!=null){el.classList.toggle('tp-pos',o.pl>=0);el.classList.toggle('tp-neg',o.pl<0);}
      el.title='$ P/L of a '+usd(get())+' position bought at the entry, at the last close (change the size in any chart RISK box)';});}
  w.WAPos={KEY:KEY,DEFAULT:DEF,get:get,set:set,calc:calc,line:line,usd:usd,on:on,fill:fill,now:now,plc:plc};
  on(function(){fill();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){fill();});else fill();
})(window);
