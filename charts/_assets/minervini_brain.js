/* M BRAIN panel + event timeline for the desk chart pages (charts/<T>.html) and stock.html?t=T.
   Data: data/minervini_brain/<T>.json written by research-tools/minervini/minervini_brain.py (rules: research-tools/minervini/M_BRAIN.md).
   Research only, not advice. */
(function () {
  "use strict";
  var inCharts = /\/charts\//.test(location.pathname);
  var base = inCharts ? "../" : "";
  function ticker() {
    if (window.TC_DATA && window.TC_DATA.ticker) return String(window.TC_DATA.ticker).toUpperCase();
    var q = new URLSearchParams(location.search); var t = q.get("t") || q.get("ticker");
    if (t) return t.toUpperCase();
    var m = location.pathname.match(/\/charts\/([A-Z0-9.\-]+)\.html$/i); return m ? m[1].toUpperCase() : null;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var CSS = ".mb-wrap{max-width:1200px;margin:14px auto 28px;padding:0 10px;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d7e3f4}" +
    ".mb-box{border:1px solid #2a3b55;background:rgba(10,16,28,.92);border-radius:8px;padding:12px 14px;margin-bottom:12px}" +
    ".mb-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin:0 0 8px}.mb-h b{font-size:14px;letter-spacing:.06em;color:#8fe3ff}" +
    ".mb-h small{color:#7f93ad}.mb-v{font-size:15px;font-weight:700;padding:6px 10px;border-radius:6px;margin:4px 0 10px;display:inline-block}" +
    ".mb-v.buy{background:#0f3d22;color:#7dff8a}.mb-v.sell{background:#4a1418;color:#ff8a8a}.mb-v.watch{background:#3a3210;color:#ffd23f}.mb-v.no{background:#1d2738;color:#b9c6d8}" +
    ".mb-t{width:100%;border-collapse:collapse}.mb-t td{padding:4px 6px;border-top:1px solid #1c2a40;vertical-align:top}" +
    ".mb-r{white-space:nowrap;color:#8fe3ff;font-weight:700}.mb-l{white-space:nowrap;color:#9fb2cc}" +
    ".mb-s{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:#56708f}.mb-s.ok{background:#3ddc84}.mb-s.warn{background:#ffd23f}.mb-s.bad{background:#ff5d5d}" +
    ".mb-tl{list-style:none;margin:0;padding:0;max-height:420px;overflow:auto}.mb-tl li{display:grid;grid-template-columns:92px 54px 1fr;gap:8px;padding:5px 2px;border-top:1px solid #1c2a40}" +
    ".mb-d{color:#9fb2cc}.mb-c{color:#0a0f18;background:#8fe3ff;border-radius:4px;text-align:center;font-weight:700;font-size:11px;height:17px;line-height:17px}" +
    ".mb-e b{color:#fff}.mb-e i{color:#7f93ad;font-style:normal}.mb-e .a{color:#ffd23f}.mb-bf{font-size:10px;color:#7f93ad;border:1px solid #33465f;border-radius:3px;padding:0 3px;margin-left:6px}" +
    "@media(max-width:640px){.mb-tl li{grid-template-columns:78px 44px 1fr}.mb-l{white-space:normal}}";
  function vclass(v) { v = v || ""; return /^BUY/.test(v) ? "buy" : /^SELL/.test(v) ? "sell" : /^(WATCH|LATE|HOLD|WAIT)/.test(v) ? "watch" : "no"; }
  function render(d, host) {
    var h = '<section class="mb-box" id="mb-panel"><div class="mb-h"><b>🧠 MINERVINI BRAIN</b><small>' + esc(d.ticker) + " · session " + esc(d.session) +
      ' · each line cites its <a href="' + base + 'mbrain.html" style="color:#8fe3ff">M_BRAIN.md</a> rule ID · research only, not advice</small></div>' +
      '<div class="mb-v ' + vclass(d.verdict) + '">' + esc(d.verdict) + ' <small style="opacity:.75">[' + esc(d.verdict_rule) + "]</small></div><table class=\"mb-t\">";
    (d.lines || []).forEach(function (l) {
      var rid = String(l.rule).split(/[\/·– ]/)[0].toLowerCase();
      h += '<tr><td class="mb-r"><a href="' + base + 'mbrain.html#' + esc(rid) + '" style="color:inherit">' + esc(l.rule) + '</a></td><td class="mb-l"><span class="mb-s ' + esc(l.state) + '"></span>' + esc(l.label) + "</td><td>" + esc(l.text) + "</td></tr>";
    });
    h += "</table></section>";
    var ev = d.events || [];
    h += '<section class="mb-box" id="mb-timeline"><div class="mb-h"><b>📜 BRAIN EVENT LOG</b><small>' + esc(d.n_events) + " event(s) · append-only " + esc(d.log) +
      " · newest first</small></div>";
    if (!ev.length) h += '<div style="color:#7f93ad">No brain rule has triggered for this ticker in the logged window.</div>';
    else {
      h += '<ul class="mb-tl">';
      ev.forEach(function (e) {
        h += '<li><span class="mb-d">' + esc(e.date) + '</span><a class="mb-c" style="text-decoration:none" href="' + base + 'mbrain.html#' + esc(String(e.rule).toLowerCase()) + '">' + esc(e.rule) + '</a><span class="mb-e"><b>' + esc(String(e.event).replace(/_/g, " ")) + "</b>" +
          (e.price != null ? " @ " + esc(e.price) : "") + (e.backfill ? '<span class="mb-bf">backfill</span>' : "") + "<br><i>" + esc(e.view) + '</i><br><span class="a">→ ' + esc(e.action) + "</span></span></li>";
      });
      h += "</ul>";
    }
    h += "</section>";
    host.innerHTML = h;
  }
  function mount() {
    var tk = ticker(); if (!tk || document.getElementById("mb-wrap")) return;
    if (!document.getElementById("mb-css")) { var st = document.createElement("style"); st.id = "mb-css"; st.textContent = CSS; document.head.appendChild(st); }
    var host = document.createElement("div"); host.className = "mb-wrap"; host.id = "mb-wrap";
    var anchor = document.getElementById("stk-chart") || document.getElementById("tc-mount");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor.nextSibling); else document.body.appendChild(host);
    fetch(base + "data/minervini_brain/" + encodeURIComponent(tk) + ".json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { render(d, host); })
      .catch(function () { host.innerHTML = '<section class="mb-box"><div class="mb-h"><b>🧠 MINERVINI BRAIN</b><small>no brain read for ' + esc(tk) + " yet (minervini_brain.py runs daily after the scanners)</small></div></section>"; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
