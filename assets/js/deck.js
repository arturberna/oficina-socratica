/* ==========================================================
   Motor de slides: navegação, passos, animações de entrada,
   cronômetro único, notas do professor e visão geral.
   ========================================================== */
(function () {
  "use strict";

  var gsap = window.gsap;
  var O = window.Oficina;
  var reduced = O.reduced;

  var deck = document.querySelector(".deck");
  if (!deck) { return; }
  var slides = Array.prototype.slice.call(deck.querySelectorAll(":scope > .slide"));
  var total = slides.length;
  var cur = -1;
  var busy = false;

  var ui = {
    count: document.querySelector("[data-count]"),
    bar: document.querySelector(".progress__bar"),
    block: document.querySelector("[data-current-block]"),
    notes: document.querySelector(".notes-panel"),
    overview: document.querySelector(".overview"),
    ovGrid: document.querySelector(".overview__grid"),
    timer: document.querySelector(".timer"),
    timerTime: document.querySelector(".timer__time"),
    timerLabel: document.querySelector(".timer__label"),
    timerToggle: document.querySelector("[data-timer-toggle]"),
    timerReset: document.querySelector("[data-timer-reset]")
  };
  var defaultBlock = ui.block ? ui.block.textContent : "";

  /* ======================================================
     Cronômetro: um só relógio ativo por vez.
     Cada slide com data-timer guarda o seu tempo restante.
     ====================================================== */
  var timers = {};      // índice do slide -> { total, remaining, label, over }
  var running = null;   // índice do slide cujo cronômetro está rodando
  var lastTick = 0;
  var tickId = null;

  slides.forEach(function (s, i) {
    var m = parseFloat(s.dataset.timer);
    if (m > 0) {
      timers[i] = {
        total: m * 60,
        remaining: m * 60,
        label: s.dataset.timerLabel || s.dataset.title || ("Slide " + (i + 1)),
        over: false
      };
    }
  });

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }
  function shownTimer() {
    if (running !== null) { return running; }
    return timers[cur] ? cur : null;
  }
  function paintTimer() {
    var i = shownTimer();
    if (!ui.timer) { return; }
    ui.timer.classList.toggle("is-visible", i !== null);
    if (i === null) { return; }
    var t = timers[i];
    ui.timerTime.textContent = fmt(t.remaining);
    ui.timerLabel.textContent = t.label;
    ui.timer.classList.toggle("is-running", running === i);
    ui.timer.classList.toggle("is-over", t.over);
    var icon = ui.timerToggle.querySelector(".bi");
    icon.className = "bi " + (running === i ? "bi-pause-fill" : "bi-play-fill");
    ui.timerToggle.setAttribute("aria-label", running === i ? "Pausar cronômetro" : "Iniciar cronômetro");
    /* anel grande dentro do slide */
    var ring = slides[i].querySelector("[data-ring]");
    if (ring) {
      ring.style.setProperty("--p", String(t.remaining / t.total));
      ring.classList.toggle("is-over", t.over);
      ring.querySelector(".ring__time").textContent = fmt(t.remaining);
      var st = ring.querySelector(".ring__state");
      if (st) {
        st.innerHTML = running === i
          ? '<i class="bi bi-pause-fill" aria-hidden="true"></i>pausar'
          : t.over ? '<i class="bi bi-alarm" aria-hidden="true"></i>acabou'
          : '<i class="bi bi-play-fill" aria-hidden="true"></i>iniciar';
      }
    }
  }
  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      [0, .28, .56].forEach(function (d) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = "square";
        o.frequency.value = 880;
        g.gain.setValueAtTime(.0001, ctx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + d + .02);
        g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + d + .2);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + d);
        o.stop(ctx.currentTime + d + .22);
      });
    } catch (e) { /* sem áudio */ }
  }
  function tick() {
    var now = performance.now();
    var dt = (now - lastTick) / 1000;
    lastTick = now;
    if (running === null) { return; }
    var t = timers[running];
    t.remaining -= dt;
    if (t.remaining <= 0) {
      t.remaining = 0;
      t.over = true;
      O.toast("Tempo esgotado: " + t.label, "bi-alarm");
      beep();
      stopTicking();
    }
    paintTimer();
  }
  function stopTicking() {
    running = null;
    if (tickId) { clearInterval(tickId); tickId = null; }
  }
  function toggleTimer(i) {
    if (i === null || i === undefined || !timers[i]) { return; }
    if (running === i) {
      stopTicking();
    } else {
      stopTicking();                 // pausa outro momento, se houver
      var t = timers[i];
      if (t.over) { t.remaining = t.total; t.over = false; }
      running = i;
      lastTick = performance.now();
      tickId = setInterval(tick, 250);
    }
    paintTimer();
    O.spring(ui.timer, { scale: [0.92, 1] });
  }
  function resetTimer(i) {
    if (i === null || !timers[i]) { return; }
    if (running === i) { stopTicking(); }
    timers[i].remaining = timers[i].total;
    timers[i].over = false;
    paintTimer();
  }

  /* ======================================================
     Passos revelados
     ====================================================== */
  /* data-reveal="N" define a ordem; sem número, vale a ordem do HTML */
  function pending(slide) {
    var all = Array.prototype.slice.call(slide.querySelectorAll("[data-reveal]"));
    return all
      .map(function (el, i) { return { el: el, k: parseFloat(el.dataset.reveal) || (i + 1) / 1000 }; })
      .filter(function (o) { return !o.el.classList.contains("is-revealed"); })
      .sort(function (a, b) { return a.k - b.k; })
      .map(function (o) { return o.el; });
  }
  function revealAll(slide, on) {
    slide.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.toggle("is-revealed", on);
      var b = el.querySelector(".msg__bubble");
      if (b && b.dataset.html) { b.innerHTML = b.dataset.html; }
    });
  }
  function reveal(el) {
    el.classList.add("is-revealed");
    var bubble = el.classList.contains("msg--ia") ? el.querySelector(".msg__bubble") : null;
    if (bubble && !reduced) {
      if (!bubble.dataset.html) { bubble.dataset.html = bubble.innerHTML; }
      bubble.innerHTML = '<span class="typing" aria-label="digitando"><span></span><span></span><span></span></span>';
      if (gsap) { gsap.fromTo(el, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .3 }); }
      setTimeout(function () {
        bubble.innerHTML = bubble.dataset.html;
        O.spring(bubble, { scale: [0.94, 1] });
      }, 750);
      return;
    }
    if (gsap && !reduced) {
      gsap.fromTo(el, { y: 18, opacity: 0, scale: .97 }, { y: 0, opacity: 1, scale: 1, duration: .45, ease: "back.out(1.8)" });
    }
  }

  /* ======================================================
     Animações de entrada do slide
     ====================================================== */
  var ANIM = {
    up: { y: 34, opacity: 0 },
    fade: { opacity: 0 },
    pop: { scale: .7, opacity: 0, ease: "back.out(2.2)" },
    left: { x: -50, opacity: 0 },
    right: { x: 50, opacity: 0 }
  };
  function animateIn(slide) {
    if (!gsap || reduced) { return; }
    var els = Array.prototype.filter.call(slide.querySelectorAll("[data-anim]"), function (el) {
      return !el.hasAttribute("data-reveal") || el.classList.contains("is-revealed");
    });
    els.forEach(function (el, k) {
      var from = Object.assign({}, ANIM[el.dataset.anim] || ANIM.up);
      var ease = from.ease || "power3.out";
      delete from.ease;
      gsap.fromTo(el, from, {
        x: 0, y: 0, scale: 1, opacity: 1,
        duration: .6, ease: ease, delay: .12 + k * .07, overwrite: true
      });
    });
    slide.querySelectorAll("[data-stagger]").forEach(function (group) {
      gsap.fromTo(group.children, { y: 26, opacity: 0, scale: .96 }, {
        y: 0, opacity: 1, scale: 1, duration: .5, ease: "back.out(1.6)",
        stagger: .08, delay: .25, overwrite: true
      });
    });
  }

  /* ======================================================
     Navegação
     ====================================================== */
  function paintChrome() {
    if (ui.count) { ui.count.textContent = (cur + 1) + " / " + total; }
    if (ui.bar) {
      var w = ((cur + 1) / total * 100) + "%";
      if (gsap && !reduced) { gsap.to(ui.bar, { width: w, duration: .5, ease: "power2.out" }); }
      else { ui.bar.style.width = w; }
    }
    if (ui.block) {
      ui.block.textContent = slides[cur].dataset.block || defaultBlock;
    }
    if (ui.notes && ui.notes.classList.contains("is-open")) { fillNotes(); }
    paintTimer();
    document.title = (slides[cur].dataset.title || "Slide") + " | " + (document.body.dataset.deckTitle || "Oficina Socrática");
  }

  function go(n, opts) {
    opts = opts || {};
    n = Math.max(0, Math.min(total - 1, n));
    if (n === cur || busy) { return; }
    var prev = cur;
    var dir = n > prev ? 1 : -1;
    var incoming = slides[n];
    var outgoing = prev >= 0 ? slides[prev] : null;

    /* ao voltar, o slide aparece completo; ao avançar, recomeça os passos */
    revealAll(incoming, dir < 0 && prev >= 0);

    cur = n;
    try { history.replaceState(null, "", "#" + (n + 1)); } catch (e) { /* file:// em alguns navegadores */ }

    slides.forEach(function (s) { s.setAttribute("aria-hidden", s === incoming ? "false" : "true"); });

    if (!gsap || reduced || opts.instant || !outgoing) {
      if (outgoing) { outgoing.classList.remove("is-active"); }
      incoming.classList.add("is-active");
      if (gsap) { gsap.set(incoming, { clearProps: "all" }); }
      paintChrome();
      if (!opts.instant) { animateIn(incoming); }
      return;
    }

    busy = true;
    incoming.classList.add("is-active");
    var isSection = incoming.classList.contains("slide--section");
    var tl = gsap.timeline({
      onComplete: function () {
        outgoing.classList.remove("is-active");
        gsap.set([outgoing, incoming], { clearProps: "transform,opacity,clipPath,zIndex" });
        busy = false;
      }
    });
    if (isSection) {
      gsap.set(incoming, { zIndex: 2 });
      tl.fromTo(incoming,
        { clipPath: dir > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0 0 0%)", duration: .6, ease: "power3.inOut" });
    } else {
      tl.to(outgoing, { xPercent: -6 * dir, opacity: 0, duration: .3, ease: "power2.in" })
        .fromTo(incoming, { xPercent: 6 * dir, opacity: 0 }, { xPercent: 0, opacity: 1, duration: .4, ease: "power3.out" }, "-=.08");
    }
    paintChrome();
    animateIn(incoming);
  }

  function next() {
    if (busy) { return; }
    var p = pending(slides[cur]);
    if (p.length) { reveal(p[0]); return; }
    if (cur < total - 1) { go(cur + 1); }
    else { O.spring(slides[cur].querySelector(".slide__inner"), { x: [-10, 10, -6, 0] }); }
  }
  function prev() { if (!busy && cur > 0) { go(cur - 1); } }

  /* ======================================================
     Notas e visão geral
     ====================================================== */
  function fillNotes() {
    var src = slides[cur].querySelector("aside.notes");
    ui.notes.innerHTML = "";
    var h = document.createElement("h4");
    h.innerHTML = '<i class="bi bi-journal-text" aria-hidden="true"></i><span></span>';
    h.querySelector("span").textContent = "Notas do professor, slide " + (cur + 1);
    ui.notes.appendChild(h);
    if (src) {
      Array.prototype.forEach.call(src.childNodes, function (c) { ui.notes.appendChild(c.cloneNode(true)); });
    } else {
      var p = document.createElement("p");
      p.textContent = "Sem notas para este slide.";
      ui.notes.appendChild(p);
    }
  }
  function toggleNotes() {
    if (!ui.notes) { return; }
    var open = !ui.notes.classList.contains("is-open");
    if (open) { fillNotes(); }
    ui.notes.classList.toggle("is-open", open);
    if (open && gsap && !reduced) { gsap.fromTo(ui.notes, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: "power3.out" }); }
  }

  function buildOverview() {
    if (!ui.ovGrid) { return; }
    ui.ovGrid.innerHTML = "";
    slides.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ov-item";
      b.innerHTML = '<span class="ov-item__n"></span><span class="ov-item__t"></span><span class="ov-item__m"></span>';
      b.querySelector(".ov-item__n").textContent = String(i + 1);
      b.querySelector(".ov-item__t").textContent = s.dataset.title || "Slide " + (i + 1);
      var meta = b.querySelector(".ov-item__m");
      if (s.dataset.block) {
        var blk = document.createElement("span");
        blk.textContent = s.dataset.block;
        meta.appendChild(blk);
      }
      if (s.dataset.timer) {
        var tm = document.createElement("span");
        tm.innerHTML = '<i class="bi bi-stopwatch" aria-hidden="true"></i> ';
        tm.appendChild(document.createTextNode(s.dataset.timer + " min"));
        meta.appendChild(tm);
      }
      b.addEventListener("click", function () { toggleOverview(false); go(i); });
      ui.ovGrid.appendChild(b);
    });
  }
  function toggleOverview(force) {
    if (!ui.overview) { return; }
    var open = typeof force === "boolean" ? force : !ui.overview.classList.contains("is-open");
    ui.overview.classList.toggle("is-open", open);
    if (open) {
      ui.ovGrid.querySelectorAll(".ov-item").forEach(function (b, i) { b.classList.toggle("is-current", i === cur); });
      if (gsap && !reduced) {
        gsap.fromTo(ui.ovGrid.children, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .35, stagger: .02, ease: "power2.out" });
      }
      var c = ui.ovGrid.children[cur];
      if (c) { c.focus({ preventScroll: false }); }
    }
  }

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); }
      else { document.exitFullscreen(); }
    } catch (e) { O.toast("Tela cheia indisponível neste navegador", "bi-fullscreen"); }
  }

  /* ======================================================
     Interações dentro dos slides
     ====================================================== */
  deck.addEventListener("click", function (ev) {
    var flip = ev.target.closest(".flip");
    if (flip) {
      flip.classList.toggle("is-flipped");
      flip.setAttribute("aria-pressed", flip.classList.contains("is-flipped") ? "true" : "false");
      O.spring(flip, { scale: [0.96, 1] });
      return;
    }
    var check = ev.target.closest(".check");
    if (check) {
      check.classList.toggle("is-checked");
      check.setAttribute("aria-pressed", check.classList.contains("is-checked") ? "true" : "false");
      O.spring(check.querySelector(".check__box"), { scale: [0.6, 1.25, 1] });
      var list = check.closest(".checklist");
      if (list && list.dataset.done && !list.querySelector(".check:not(.is-checked)")) {
        O.toast(list.dataset.done, "bi-stars");
      }
      return;
    }
    var ring = ev.target.closest("[data-ring]");
    if (ring) { toggleTimer(slides.indexOf(ring.closest(".slide"))); return; }
    var go2 = ev.target.closest("[data-go]");
    if (go2) { go(parseInt(go2.dataset.go, 10) - 1); }
  });

  /* ======================================================
     Teclado e toque
     ====================================================== */
  document.addEventListener("keydown", function (ev) {
    var target = ev.target instanceof Element ? ev.target : document.body;
    if (target.closest("input, textarea, select, [contenteditable]")) { return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
    var onControl = target.closest("button, a, [role='button']");
    var k = ev.key;
    if (ui.overview && ui.overview.classList.contains("is-open")) {
      if (k === "Escape" || k === "o" || k === "O") { ev.preventDefault(); toggleOverview(false); }
      return;
    }
    if (k === "ArrowRight" || k === "PageDown" || (k === " " && !onControl)) { ev.preventDefault(); next(); }
    else if (k === "ArrowLeft" || k === "PageUp") { ev.preventDefault(); prev(); }
    else if (k === "Home") { ev.preventDefault(); go(0); }
    else if (k === "End") { ev.preventDefault(); go(total - 1); }
    else if (k === "n" || k === "N") { toggleNotes(); }
    else if (k === "o" || k === "O") { toggleOverview(); }
    else if (k === "f" || k === "F") { toggleFullscreen(); }
    else if (k === "t" || k === "T") { toggleTimer(shownTimer()); }
    else if (k === "r" || k === "R") { resetTimer(shownTimer()); }
    else if (k === "Escape" && ui.notes) { ui.notes.classList.remove("is-open"); }
  });

  var sx = 0, sy = 0, st = 0;
  deck.addEventListener("pointerdown", function (ev) {
    if (ev.pointerType === "mouse") { return; }
    sx = ev.clientX; sy = ev.clientY; st = Date.now();
  });
  deck.addEventListener("pointerup", function (ev) {
    if (ev.pointerType === "mouse" || !st) { return; }
    var dx = ev.clientX - sx, dy = ev.clientY - sy;
    st = 0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) { next(); } else { prev(); }
    }
  });

  /* Botões da interface */
  function on(sel, fn) {
    document.querySelectorAll(sel).forEach(function (b) { b.addEventListener("click", fn); });
  }
  on("[data-next]", next);
  on("[data-prev]", prev);
  on("[data-notes-toggle]", toggleNotes);
  on("[data-overview-toggle]", function () { toggleOverview(); });
  on("[data-fullscreen]", toggleFullscreen);
  if (ui.timerToggle) { ui.timerToggle.addEventListener("click", function () { toggleTimer(shownTimer()); }); }
  if (ui.timerReset) { ui.timerReset.addEventListener("click", function () { resetTimer(shownTimer()); }); }

  window.addEventListener("hashchange", function () {
    var n = parseInt(location.hash.slice(1), 10);
    if (n >= 1 && n <= total) { go(n - 1); }
  });
  window.addEventListener("beforeunload", function (ev) {
    if (running !== null) { ev.preventDefault(); ev.returnValue = ""; }
  });

  /* ======================================================
     Início
     ====================================================== */
  buildOverview();
  var start = parseInt(location.hash.slice(1), 10);
  go(start >= 1 && start <= total ? start - 1 : 0, { instant: false });
})();
