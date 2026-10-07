/* ==========================================================
   Mapa da oficina: fases, trilha de pontos, jogador e progresso
   ========================================================== */
(function () {
  "use strict";

  var gsap = window.gsap;
  var O = window.Oficina;
  var reduced = O.reduced;
  var TOTAL_MIN = 120;
  var STORE_KEY = "os-done";

  var map = document.querySelector("[data-map]");
  if (!map) { return; }

  var terrain = map.querySelector(".map__terrain");
  var trail = map.querySelector("[data-trail]");
  var player = map.querySelector("[data-player]");
  var card = document.querySelector("[data-card]");
  var nodes = Array.prototype.slice.call(map.querySelectorAll(".map-node"));

  /* Geometria em "unidades do mapa": x = % * proporção, y = %.
     Assim as distâncias respeitam a proporção real do mapa. */
  var ratio = 16 / 9;
  var worldPath = null;   // trilha medida na imagem (por trecho), ativa quando a imagem carrega
  var worldData = null;
  try {
    var pathEl = map.querySelector("[data-world-path]");
    if (pathEl) {
      worldData = { segs: JSON.parse(pathEl.textContent), ratio: evalRatio(pathEl.dataset.ratio) };
    }
  } catch (e) { worldData = null; }

  function evalRatio(txt) {
    var m = String(txt || "").split("/");
    var r = m.length === 2 ? parseFloat(m[0]) / parseFloat(m[1]) : parseFloat(txt);
    return r > 0 ? r : 16 / 9;
  }

  var pts = [];
  function computePoints() {
    pts = nodes.map(function (n) {
      return { x: parseFloat(n.dataset.x) * ratio, y: parseFloat(n.dataset.y) };
    });
  }
  nodes.forEach(function (n) {
    n.style.left = n.dataset.x + "%";
    n.style.top = n.dataset.y + "%";
  });
  computePoints();

  var info = {};
  document.querySelectorAll("[data-phase-info]").forEach(function (a) {
    info[a.getAttribute("data-phase-info")] = a;
  });

  var done = readDone();
  var selected = 0;   // índice da fase selecionada
  var playerAt = 0;   // índice onde o jogador está
  var walking = null;

  /* ---------- Progresso ---------- */
  function readDone() {
    try {
      var v = JSON.parse(O.store.get(STORE_KEY) || "[]");
      return Array.isArray(v) ? v.filter(function (n) { return n >= 1 && n <= nodes.length; }) : [];
    } catch (e) { return []; }
  }
  function saveDone() { O.store.set(STORE_KEY, JSON.stringify(done)); }
  function isDone(i) { return done.indexOf(i + 1) !== -1; }
  function currentIndex() {
    for (var i = 0; i < nodes.length; i++) { if (!isDone(i)) { return i; } }
    return nodes.length - 1;
  }

  /* ---------- Geometria da trilha ---------- */
  /* Reserva (sem imagem): curva suave entre as fases */
  function control(i) {
    var a = pts[i], b = pts[i + 1];
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var bend = (i % 2 === 0 ? 1 : -1) * len * 0.22;
    return { x: mx - (dy / len) * bend, y: my + (dx / len) * bend };
  }
  function bezierOn(i, t) {
    var a = pts[i], b = pts[i + 1], c = control(i);
    var u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y
    };
  }

  /* Com imagem: segue a trilha desenhada, por comprimento de arco */
  function buildWorldPath() {
    worldPath = worldData.segs.map(function (seg) {
      var p = seg.map(function (q) { return { x: q[0] * ratio, y: q[1] }; });
      var acc = [0];
      for (var k = 1; k < p.length; k++) {
        acc.push(acc[k - 1] + Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y));
      }
      return { p: p, acc: acc, len: acc[acc.length - 1] || 1 };
    });
  }
  function polyOn(i, t) {
    var s = worldPath[i];
    var d = t * s.len;
    for (var k = 1; k < s.p.length; k++) {
      if (d <= s.acc[k] || k === s.p.length - 1) {
        var span = (s.acc[k] - s.acc[k - 1]) || 1;
        var f = Math.max(0, Math.min(1, (d - s.acc[k - 1]) / span));
        return { x: s.p[k - 1].x + (s.p[k].x - s.p[k - 1].x) * f, y: s.p[k - 1].y + (s.p[k].y - s.p[k - 1].y) * f };
      }
    }
    return s.p[s.p.length - 1];
  }

  function pointOn(i, t) { return worldPath ? polyOn(i, t) : bezierOn(i, t); }
  function segLength(i) {
    if (worldPath) { return worldPath[i].len; }
    return Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) * 1.15;
  }
  function toPct(p) { return { left: (p.x / ratio) + "%", top: p.y + "%" }; }

  function buildTrail() {
    trail.innerHTML = "";
    var gap = worldPath ? 2.6 : 3.8;     // distância entre pontos
    var margin = worldPath ? 5 : 0;      // não desenhar dentro das clareiras
    for (var i = 0; i < pts.length - 1; i++) {
      var L = segLength(i);
      var count = Math.max(4, Math.round(L / gap));
      for (var k = 1; k < count; k++) {
        var t = k / count;
        if (worldPath ? (t * L < margin || (1 - t) * L < margin) : (t < 0.14 || t > 0.86)) { continue; }
        var p = toPct(pointOn(i, t));
        var dot = document.createElement("span");
        dot.className = "trail-dot";
        dot.dataset.seg = String(i);
        dot.style.left = p.left;
        dot.style.top = p.top;
        trail.appendChild(dot);
      }
    }
  }

  /* ---------- Estados visuais ---------- */
  function paint() {
    var cur = currentIndex();
    nodes.forEach(function (n, i) {
      var d = isDone(i);
      n.classList.toggle("is-done", d);
      n.classList.toggle("is-current", !d && i === cur);
      n.classList.toggle("is-locked", !d && i > cur);
      n.classList.toggle("is-selected", i === selected);
      var state = d ? "concluída" : (i === cur ? "atual" : (i > cur ? "bloqueada" : "disponível"));
      n.setAttribute("aria-label", "Fase " + (i + 1) + ": " + n.querySelector(".map-node__label").lastChild.textContent + ", " + state);
      n.setAttribute("aria-pressed", i === selected ? "true" : "false");
    });
    trail.querySelectorAll(".trail-dot").forEach(function (dot) {
      dot.classList.toggle("is-done", isDone(parseInt(dot.dataset.seg, 10)));
    });
    paintHud();
  }

  function paintHud() {
    var used = 0;
    done.forEach(function (ph) {
      var a = info[String(ph)];
      if (a) { used += parseInt(a.dataset.minutes, 10) || 0; }
    });
    var left = Math.max(0, TOTAL_MIN - used);
    var h = Math.floor(left / 60), m = left % 60;
    var txt = h > 0 ? h + "h" + String(m).padStart(2, "0") : m + " min";
    var hudTime = document.querySelector("[data-hud-time]");
    var hudCount = document.querySelector("[data-hud-count]");
    var meter = document.querySelector("[data-hud-meter]");
    if (hudTime) { hudTime.textContent = txt; }
    if (hudCount) { hudCount.textContent = done.length + " de " + nodes.length; }
    if (meter) {
      var w = (used / TOTAL_MIN * 100) + "%";
      if (gsap && !reduced) { gsap.to(meter, { width: w, duration: .8, ease: "power2.out" }); }
      else { meter.style.width = w; }
    }
  }

  /* ---------- Cartão da fase ---------- */
  function renderCard(i, animate) {
    var src = info[String(i + 1)];
    if (!src || !card) { return; }
    var d = isDone(i), cur = currentIndex();
    var locked = !d && i > cur;

    card.innerHTML = "";
    var top = document.createElement("div");
    top.className = "phase-card__top";
    var num = document.createElement("span");
    num.className = "phase-card__num";
    num.textContent = String(i + 1);
    var chip = document.createElement("span");
    chip.className = "chip phase-card__state " + (d ? "chip--green" : locked ? "" : "chip--yellow");
    chip.innerHTML = d
      ? '<i class="bi bi-check2-circle" aria-hidden="true"></i>Concluída'
      : locked ? '<i class="bi bi-lock" aria-hidden="true"></i>Bloqueada'
      : '<i class="bi bi-geo-alt" aria-hidden="true"></i>Fase atual';
    top.appendChild(num);
    top.appendChild(chip);
    card.appendChild(top);

    Array.prototype.forEach.call(src.children, function (child) {
      card.appendChild(child.cloneNode(true));
    });

    if (locked) {
      var note = document.createElement("p");
      note.className = "phase-card__locked";
      note.innerHTML = '<i class="bi bi-info-circle" aria-hidden="true"></i><span>Conclua as fases anteriores para destravar. Você pode entrar mesmo assim.</span>';
      card.appendChild(note);
    }

    var actions = document.createElement("div");
    actions.className = "phase-card__actions";
    var enter = document.createElement("a");
    enter.className = "btn btn--primary";
    enter.href = src.dataset.href;
    enter.setAttribute("data-transition", "");
    enter.setAttribute("data-press", "");
    enter.setAttribute("data-enter-phase", "");
    enter.innerHTML = '<i class="bi bi-door-open" aria-hidden="true"></i><span>Entrar na fase</span>';
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn";
    toggle.setAttribute("data-press", "");
    toggle.innerHTML = d
      ? '<i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span>Reabrir fase</span>'
      : '<i class="bi bi-check2-square" aria-hidden="true"></i><span>Marcar como concluída</span>';
    toggle.addEventListener("click", function () { toggleDone(i); });
    actions.appendChild(enter);
    actions.appendChild(toggle);
    card.appendChild(actions);

    if (animate && !reduced && gsap) {
      gsap.fromTo(card.children, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .4, stagger: .04, ease: "power2.out" });
    }
  }

  /* ---------- Jogador ---------- */
  function placePlayer(i) {
    var p = toPct(pts[i]);
    player.style.left = p.left;
    player.style.top = p.top;
    // fica um pouco acima do medalhão
    player.style.marginTop = "-3.6cqi";
  }

  function walkTo(target, onArrive) {
    if (walking) { walking.kill(); walking = null; }
    if (!gsap || reduced || target === playerAt) {
      playerAt = target;
      placePlayer(target);
      if (onArrive) { onArrive(); }
      return;
    }
    var tl = gsap.timeline({
      onComplete: function () { walking = null; if (onArrive) { onArrive(); } }
    });
    var step = target > playerAt ? 1 : -1;
    var body = player.querySelector(".player__body");
    for (var i = playerAt; i !== target; i += step) {
      (function (from) {
        var seg = step > 0 ? from : from - 1;
        var state = { t: step > 0 ? 0 : 1 };
        tl.to(state, {
          t: step > 0 ? 1 : 0,
          duration: .7,
          ease: "power1.inOut",
          onUpdate: function () {
            var p = toPct(pointOn(seg, state.t));
            player.style.left = p.left;
            player.style.top = p.top;
          },
          onComplete: function () { playerAt = from + step; }
        });
        tl.to(body, { y: -10, duration: .175, yoyo: true, repeat: 3, ease: "sine.out" }, "<");
      })(i);
    }
    tl.fromTo(body, { scaleY: .8 }, { scaleY: 1, duration: .35, ease: "back.out(3)" });
    walking = tl;
  }

  /* ---------- Seleção ---------- */
  function select(i, opts) {
    opts = opts || {};
    selected = i;
    paint();
    renderCard(i, true);
    var badge = nodes[i].querySelector(".map-node__badge");
    O.spring(badge, { scale: [0.8, 1.12, 1] });
    walkTo(i, opts.onArrive);
  }

  /* ---------- Concluir fase (com "estouro" de partículas) ---------- */
  function burst(node) {
    if (!gsap || reduced) { return; }
    var colors = ["#ffc233", "#3454f5", "#12a079", "#e8406a", "#fffdf7"];
    for (var k = 0; k < 14; k++) {
      var s = document.createElement("span");
      s.style.cssText = "position:absolute;left:" + node.style.left + ";top:" + node.style.top +
        ";width:10px;height:10px;border-radius:" + (k % 2 ? "50%" : "2px") +
        ";background:" + colors[k % colors.length] + ";border:2px solid #181b38;z-index:4;pointer-events:none";
      map.appendChild(s);
      var ang = (Math.PI * 2 * k) / 14;
      var dist = 50 + Math.random() * 50;
      gsap.fromTo(s, { x: -5, y: -5, scale: 1, rotate: 0 }, {
        x: Math.cos(ang) * dist, y: Math.sin(ang) * dist - 20, rotate: 200, scale: .2, opacity: 0,
        duration: .9 + Math.random() * .3, ease: "power3.out",
        onComplete: (function (el) { return function () { el.remove(); }; })(s)
      });
    }
  }

  function toggleDone(i) {
    var ph = i + 1;
    var wasDone = isDone(i);
    if (wasDone) {
      done = done.filter(function (n) { return n !== ph; });
      saveDone();
      select(i);
      O.toast("Fase " + ph + " reaberta", "bi-arrow-counterclockwise");
      return;
    }
    done.push(ph);
    done.sort();
    saveDone();
    burst(nodes[i]);
    O.toast("Fase " + ph + " concluída", "bi-trophy");
    paint();
    renderCard(i, true);
    var next = currentIndex();
    if (!isDone(next) && next !== i) {
      setTimeout(function () { select(next); }, 650);
    }
  }

  /* ---------- Imagem do mundo ---------- */
  function loadWorldImage() {
    var hint = map.querySelector("[data-map-hint]");
    var img = new Image();
    img.onload = function () {
      map.classList.remove("map--fallback");
      map.classList.add("map--world");
      terrain.style.backgroundImage = "url('assets/img/mapa-mundo.webp')";
      if (hint) { hint.hidden = true; }
      /* o mapa assume a proporção real da imagem, para as % baterem com o desenho */
      ratio = img.naturalWidth / img.naturalHeight;
      map.style.setProperty("--map-ratio", String(ratio));
      computePoints();
      if (worldData) { buildWorldPath(); }
      buildTrail();
      paint();
      if (!walking) { placePlayer(playerAt); }
    };
    img.onerror = function () {
      map.classList.add("map--fallback");
      if (hint) { hint.hidden = false; }
    };
    img.src = "assets/img/mapa-mundo.webp";
  }

  /* ---------- Entrada orquestrada (uma vez, quando o mapa aparece) ---------- */
  function intro() {
    if (!gsap || reduced) { return; }
    var dots = trail.querySelectorAll(".trail-dot");
    var badges = nodes.map(function (n) { return n.querySelector(".map-node__badge"); });
    var labels = nodes.map(function (n) { return n.querySelector(".map-node__label"); });
    var tl = gsap.timeline({ paused: true });
    tl.from(dots, { scale: 0, opacity: 0, duration: .25, stagger: .025, ease: "back.out(3)" })
      .from(badges, { scale: 0, rotate: -40, duration: .5, stagger: .12, ease: "back.out(2.5)" }, .1)
      .from(labels, { y: 10, opacity: 0, duration: .35, stagger: .12 }, .3)
      .from(player, { y: -120, opacity: 0, duration: .7, ease: "bounce.out" }, "-=.3")
      .from(card, { x: 30, opacity: 0, duration: .5, ease: "power3.out" }, "-=.6");

    if (!("IntersectionObserver" in window)) { return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { tl.play(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(map);
  }

  /* ---------- Título da capa letra por letra ---------- */
  function splitTitle() {
    var el = document.querySelector("[data-split]");
    if (!el || !gsap || reduced) { return; }
    var label = el.textContent;
    el.setAttribute("aria-label", label);
    var words = label.split(" ");
    el.innerHTML = "";
    words.forEach(function (w, wi) {
      var ws = document.createElement("span");
      ws.className = "w";
      ws.setAttribute("aria-hidden", "true");
      Array.prototype.forEach.call(w, function (ch) {
        var c = document.createElement("span");
        c.textContent = ch;
        ws.appendChild(c);
      });
      el.appendChild(ws);
      if (wi < words.length - 1) { el.appendChild(document.createTextNode(" ")); }
    });
    var letters = el.querySelectorAll(".w > span");
    gsap.from(letters, {
      yPercent: 110, rotate: function () { return gsap.utils.random(-25, 25); }, opacity: 0,
      duration: .7, ease: "back.out(2)", stagger: .022, delay: .25
    });
    gsap.from(".cover__lead, .cover__actions, .cover__rules li, .cover__kicker", {
      y: 18, opacity: 0, duration: .6, stagger: .08, delay: .7, ease: "power2.out"
    });
    gsap.from(".cover__img", { rotate: 8, scale: .9, opacity: 0, duration: 1, delay: .4, ease: "elastic.out(1, .6)" });
  }

  /* ---------- Eventos ---------- */
  nodes.forEach(function (n, i) {
    n.addEventListener("click", function () { select(i); });
  });

  document.addEventListener("keydown", function (ev) {
    var target = ev.target instanceof Element ? ev.target : document.body;
    if (target.closest("input, textarea, [contenteditable]")) { return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
    var k = parseInt(ev.key, 10);
    if (k >= 1 && k <= nodes.length) {
      select(k - 1);
      nodes[k - 1].focus({ preventScroll: true });
    } else if (ev.key === "Enter" && !target.closest("a, button")) {
      var enter = card.querySelector("[data-enter-phase]");
      if (enter) { enter.click(); }
    }
  });

  var resetBtn = document.querySelector("[data-reset-progress]");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      done = [];
      saveDone();
      select(0);
      O.toast("Progresso apagado. A jornada recomeça na fase 1.", "bi-arrow-counterclockwise");
    });
  }

  document.querySelectorAll("[data-scroll-map]").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      document.getElementById("mapa").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    });
  });

  /* ---------- Início ---------- */
  buildTrail();
  loadWorldImage();
  selected = currentIndex();
  playerAt = selected;
  placePlayer(playerAt);
  paint();
  renderCard(selected, false);
  splitTitle();
  intro();
})();
