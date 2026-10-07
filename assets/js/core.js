/* ==========================================================
   Oficina Socrática — núcleo compartilhado
   Tema, cortina entre páginas, micro-interações, copiar,
   molduras de imagem e avisos.
   ========================================================== */
(function () {
  "use strict";

  var gsap = window.gsap;
  var M = window.Motion || null;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* sem armazenamento */ } }
  };
  var session = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } },
    del: function (k) { try { window.sessionStorage.removeItem(k); } catch (e) { /* sem armazenamento */ } }
  };

  /* ---------- Molas (Motion, com GSAP de reserva) ---------- */
  function spring(el, props, opts) {
    if (reduced) { return; }
    opts = opts || {};
    if (!el) { return; }
    /* mola só aceita dois quadros-chave; sequências maiores usam duração fixa */
    var multi = Object.keys(props).some(function (k) { return Array.isArray(props[k]) && props[k].length > 2; });
    try {
      if (M && M.animate) {
        M.animate(el, props, multi
          ? { duration: .5, ease: "easeOut" }
          : { type: "spring", stiffness: opts.stiffness || 520, damping: opts.damping || 22 });
        return;
      }
    } catch (e) { /* cai para o GSAP */ }
    if (gsap) {
      var to = {};
      Object.keys(props).forEach(function (k) {
        to[k] = Array.isArray(props[k]) ? props[k][props[k].length - 1] : props[k];
      });
      gsap.to(el, Object.assign({ duration: .35, ease: "back.out(2)" }, to));
    }
  }

  /* ---------- Tema ---------- */
  function currentTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) { return t; }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    document.querySelectorAll("[data-theme-toggle] .bi").forEach(function (i) {
      i.className = "bi " + (t === "dark" ? "bi-sun" : "bi-moon-stars");
    });
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-label", t === "dark" ? "Usar tema claro" : "Usar tema escuro");
      b.setAttribute("title", t === "dark" ? "Usar tema claro" : "Usar tema escuro");
    });
  }
  function initTheme() {
    applyTheme(store.get("os-theme") || "light");
    document.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-theme-toggle]");
      if (!btn) { return; }
      var next = currentTheme() === "dark" ? "light" : "dark";
      store.set("os-theme", next);
      if (gsap && !reduced) {
        var icon = btn.querySelector(".bi");
        gsap.fromTo(icon, { rotate: -90, scale: .4 }, { rotate: 0, scale: 1, duration: .5, ease: "back.out(2.4)" });
      }
      applyTheme(next);
    });
  }

  /* ---------- Avisos ---------- */
  var toastZone;
  function toast(msg, icon) {
    if (!toastZone) {
      toastZone = document.createElement("div");
      toastZone.className = "toast-zone";
      toastZone.setAttribute("role", "status");
      toastZone.setAttribute("aria-live", "polite");
      document.body.appendChild(toastZone);
    }
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = '<i class="bi ' + (icon || "bi-check2-circle") + '" aria-hidden="true"></i><span></span>';
    t.querySelector("span").textContent = msg;
    toastZone.appendChild(t);
    if (gsap && !reduced) {
      gsap.fromTo(t, { y: 30, opacity: 0, scale: .9 }, { y: 0, opacity: 1, scale: 1, duration: .45, ease: "back.out(2)" });
      gsap.to(t, { y: -10, opacity: 0, duration: .35, delay: 2.2, onComplete: function () { t.remove(); } });
    } else {
      setTimeout(function () { t.remove(); }, 2500);
    }
  }

  /* ---------- Copiar ---------- */
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  function selectContents(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function copyFrom(btn) {
    var target = document.querySelector(btn.getAttribute("data-copy"));
    if (!target) { return; }
    var text = target.innerText.trim();
    var done = function () {
      toast("Copiado para a área de transferência");
      var icon = btn.querySelector(".bi");
      var label = btn.querySelector("[data-copy-label]");
      if (icon) { icon.className = "bi bi-check2"; }
      if (label) { label.textContent = "Copiado"; }
      spring(btn, { scale: [0.9, 1] });
      setTimeout(function () {
        if (icon) { icon.className = "bi bi-copy"; }
        if (label) { label.textContent = "Copiar"; }
      }, 1800);
    };
    var fail = function () {
      if (fallbackCopy(text)) { done(); return; }
      selectContents(target);
      toast("Texto selecionado. Use Ctrl+C para copiar.", "bi-cursor-text");
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else {
      fail();
    }
  }

  /* ---------- Molduras de imagem ---------- */
  function initImageSlots(root) {
    (root || document).querySelectorAll(".img-slot[data-src]:not([data-ready])").forEach(function (slot) {
      slot.setAttribute("data-ready", "");
      var src = slot.getAttribute("data-src");
      var label = slot.getAttribute("data-label") || "";
      var img = new Image();
      img.alt = slot.getAttribute("data-alt") || "";
      img.decoding = "async";
      img.onload = function () {
        slot.classList.remove("is-missing");
        slot.innerHTML = "";
        slot.appendChild(img);
        slot.dispatchEvent(new CustomEvent("imgslot:loaded", { bubbles: true }));
      };
      img.onerror = function () {
        slot.classList.add("is-missing");
        var file = src.split("/").pop();
        slot.innerHTML =
          '<div class="img-slot__missing">' +
          '<i class="bi bi-image" aria-hidden="true"></i>' +
          "<code></code><small></small></div>";
        slot.querySelector("code").textContent = file;
        slot.querySelector("small").textContent = label;
        slot.dispatchEvent(new CustomEvent("imgslot:missing", { bubbles: true }));
      };
      img.src = src;
    });
  }

  /* ---------- Micro-interações de pressionar ---------- */
  function initPress() {
    document.addEventListener("pointerdown", function (ev) {
      var el = ev.target.closest("[data-press]");
      if (!el) { return; }
      spring(el, { scale: 0.95 }, { stiffness: 700, damping: 30 });
      var up = function () {
        spring(el, { scale: 1 }, { stiffness: 420, damping: 12 });
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    });
  }

  /* ---------- Cortina entre páginas ---------- */
  var curtain;
  function buildCurtain(covered) {
    curtain = document.createElement("div");
    curtain.className = "curtain";
    curtain.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 6; i++) {
      var bar = document.createElement("div");
      bar.className = "curtain__bar";
      curtain.appendChild(bar);
    }
    document.body.appendChild(curtain);
    if (gsap) { gsap.set(curtain.children, { scaleY: covered ? 1 : 0 }); }
    return curtain;
  }
  function curtainIn() {
    var entering = document.documentElement.classList.contains("is-entering");
    if (!gsap || reduced || !entering) {
      document.documentElement.classList.remove("is-entering");
      return;
    }
    buildCurtain(true);
    document.documentElement.classList.remove("is-entering");
    gsap.to(curtain.children, {
      scaleY: 0, transformOrigin: "bottom", duration: .55, ease: "power3.inOut",
      stagger: { each: .05, from: "start" },
      onComplete: function () { curtain.remove(); curtain = null; }
    });
  }
  function curtainOut(href) {
    if (!gsap || reduced) { window.location.href = href; return; }
    session.set("os-curtain", "1");
    if (!curtain) { buildCurtain(false); }
    gsap.to(curtain.children, {
      scaleY: 1, transformOrigin: "top", duration: .45, ease: "power3.inOut",
      stagger: { each: .05, from: "start" },
      onComplete: function () { window.location.href = href; }
    });
  }
  function initTransitions() {
    document.addEventListener("click", function (ev) {
      var a = ev.target.closest("a[data-transition]");
      if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) { return; }
      ev.preventDefault();
      curtainOut(a.getAttribute("href"));
    });
    /* Ao voltar pelo histórico, a página pode vir do cache com a cortina fechada */
    window.addEventListener("pageshow", function (ev) {
      if (ev.persisted && curtain) { curtain.remove(); curtain = null; }
    });
  }

  /* ---------- Inicialização ---------- */
  function init() {
    session.del("os-curtain");
    initTheme();
    initTransitions();
    initPress();
    initImageSlots();
    document.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-copy]");
      if (btn) { copyFrom(btn); }
    });
    curtainIn();
  }

  window.Oficina = {
    toast: toast,
    spring: spring,
    store: store,
    reduced: reduced,
    initImageSlots: initImageSlots
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
