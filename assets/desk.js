/* desk.js - shared behaviour for every dashboard page (research-tools/unify.py adds it). No dependencies. */
(function(){
'use strict';
var nav=document.querySelector('.dk-nav'),on=nav&&nav.querySelector('a.on');
if(nav&&on&&nav.scrollWidth>nav.clientWidth){nav.scrollLeft=on.offsetLeft-nav.clientWidth/2+on.offsetWidth/2;}
})();
