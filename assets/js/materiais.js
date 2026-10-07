/* ==========================================================
   Materiais: abas com indicador deslizante e âncoras (#gdd, #ficha...)
   ========================================================== */
(function () {
  "use strict";

  var gsap = window.gsap;
  var O = window.Oficina;
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[role='tab']"));
  var ink = document.querySelector(".tabs__ink");
  if (!tabs.length) { return; }

  function moveInk(tab, animate) {
    if (!ink) { return; }
    var props = { x: tab.offsetLeft, width: tab.offsetWidth, top: tab.offsetTop };
    if (gsap && animate && !O.reduced) {
      gsap.to(ink, Object.assign({ duration: .45, ease: "back.out(1.6)" }, props));
    } else if (gsap) {
      gsap.set(ink, props);
    } else {
      ink.style.transform = "translateX(" + props.x + "px)";
      ink.style.width = props.width + "px";
      ink.style.top = props.top + "px";
    }
  }

  function select(tab, opts) {
    opts = opts || {};
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) { panel.hidden = !on; }
    });
    moveInk(tab, !opts.instant);
    var panel = document.getElementById(tab.getAttribute("aria-controls"));
    if (panel && gsap && !O.reduced && !opts.instant) {
      gsap.fromTo(panel.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .4, stagger: .05, ease: "power2.out" });
    }
    if (!opts.keepHash) {
      try { history.replaceState(null, "", "#" + tab.dataset.hash); } catch (e) { /* file:// */ }
    }
    if (opts.focus) { tab.focus(); }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(t); });
    t.addEventListener("keydown", function (ev) {
      var n = null;
      if (ev.key === "ArrowRight") { n = (i + 1) % tabs.length; }
      else if (ev.key === "ArrowLeft") { n = (i - 1 + tabs.length) % tabs.length; }
      else if (ev.key === "Home") { n = 0; }
      else if (ev.key === "End") { n = tabs.length - 1; }
      if (n !== null) { ev.preventDefault(); select(tabs[n], { focus: true }); }
    });
  });

  function fromHash() {
    var h = location.hash.slice(1);
    var t = tabs.filter(function (x) { return x.dataset.hash === h; })[0];
    return t || tabs[0];
  }

  window.addEventListener("hashchange", function () { select(fromHash(), { keepHash: true }); });
  window.addEventListener("resize", function () {
    var cur = tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0];
    if (cur) { moveInk(cur, false); }
  });

  document.querySelectorAll("[data-print]").forEach(function (b) {
    b.addEventListener("click", function () { window.print(); });
  });

  select(fromHash(), { instant: true, keepHash: true });
  /* as fontes mudam a largura das abas depois do carregamento */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      var cur = tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0];
      if (cur) { moveInk(cur, false); }
    });
  }
})();
