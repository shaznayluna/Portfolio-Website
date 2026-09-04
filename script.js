/* ============================================================
   Shared behaviour for every page.
   Loaded as a blocking script at the top of <body> so the theme
   is settled before anything paints.
   ============================================================ */

/* ---------- colour theme ---------- */
(function () {
  var root = document.documentElement;
  var KEY = "theme";

  function read()   { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); }    catch (e) {} }

  function systemPref() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light";
  }

  function sync(v) {
    var buttons = document.querySelectorAll("[data-set-theme]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed",
        buttons[i].getAttribute("data-set-theme") === v ? "true" : "false");
    }
  }

  function apply(v) { root.setAttribute("data-theme", v); sync(v); }

  var saved = read();
  apply(saved === "light" || saved === "dark" ? saved : systemPref());

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest("[data-set-theme]");
    if (!btn) return;
    var v = btn.getAttribute("data-set-theme");
    apply(v);
    write(v);
  });

  document.addEventListener("DOMContentLoaded", function () {
    sync(root.getAttribute("data-theme"));
  });
}());

/* ---------- scroll reveals ---------- */
(function () {
  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js-reveal");

  function positionAmongSiblings(el) {
    var i = 0, prev = el.previousElementSibling;
    while (prev) { i++; prev = prev.previousElementSibling; }
    return i;
  }

  function start() {
    var els = document.querySelectorAll(".reveal");
    if (!els.length) return;

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        var el = entries[i].target;
        el.style.animationDelay = Math.min(positionAmongSiblings(el), 6) * 60 + "ms";
        el.classList.add("is-in");
        io.unobserve(el);
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.06 });

    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}());

/* ---------- shared helpers ---------- */
function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function hasFinePointer() {
  return !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
}

/* ---------- smooth scrolling ---------- */
(function () {
  if (prefersReducedMotion() || !window.Lenis) return;

  var lenis = new window.Lenis({ duration: 1.05, smoothWheel: true });

  (function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }(0));

  /* In-page anchors have to be handed to Lenis. Left to the browser they
     jump natively and fight the smoothing mid-flight. */
  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    var hash = link.getAttribute("href");
    if (!hash || hash.length < 2) return;
    var target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -24 });
  });
}());

/* ---------- cursor ----------
   Takes over only on a real pointer with motion allowed. Everywhere else
   the CSS red-dot cursor on <body> stays, so nobody loses their pointer. */
(function () {
  if (!hasFinePointer() || prefersReducedMotion()) return;

  var dot = document.querySelector(".cursor-dot");
  if (!dot) return;

  document.documentElement.classList.add("js-cursor");

  var INTERACTIVE = "a, button, .card, [data-set-theme]";
  /* only small controls pull the cursor — dragging it to the centre of a
     large card would feel like a bug, not a flourish */
  var MAGNETIC = "button, .nav-links a, .footer-links a, [data-set-theme]";

  var targetX = window.innerWidth / 2,  targetY = window.innerHeight / 2;
  var currentX = targetX,               currentY = targetY;
  var magnet = null;

  document.addEventListener("pointermove", function (e) {
    targetX = e.clientX;
    targetY = e.clientY;
  }, { passive: true });

  document.addEventListener("pointerover", function (e) {
    var el = e.target && e.target.closest ? e.target.closest(INTERACTIVE) : null;
    dot.classList.toggle("is-over", !!el);
    magnet = e.target && e.target.closest ? e.target.closest(MAGNETIC) : null;
  });

  (function frame() {
    var wantX = targetX, wantY = targetY;

    if (magnet) {
      var r = magnet.getBoundingClientRect();
      wantX += ((r.left + r.width / 2) - targetX) * 0.3;
      wantY += ((r.top + r.height / 2) - targetY) * 0.3;
    }

    /* trail slightly behind the pointer rather than locking to it */
    currentX += (wantX - currentX) * 0.2;
    currentY += (wantY - currentY) * 0.2;

    dot.style.transform = "translate3d(" + currentX + "px," + currentY + "px,0)";
    requestAnimationFrame(frame);
  }());
}());

/* ---------- card tilt ---------- */
(function () {
  if (!hasFinePointer() || prefersReducedMotion()) return;

  var MAX_DEG = 5;
  var cards = document.querySelectorAll(".card");

  function move(e) {
    var r = this.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width  - 0.5;
    var py = (e.clientY - r.top)  / r.height - 0.5;
    this.style.setProperty("--ry", (px * MAX_DEG).toFixed(2) + "deg");
    this.style.setProperty("--rx", (-py * MAX_DEG).toFixed(2) + "deg");
  }

  function reset() {
    this.style.setProperty("--rx", "0deg");
    this.style.setProperty("--ry", "0deg");
  }

  for (var i = 0; i < cards.length; i++) {
    cards[i].addEventListener("pointermove", move, { passive: true });
    cards[i].addEventListener("pointerleave", reset);
  }
}());

/* ---------- hero entrance timing ----------
   The hero animation is CSS, but *when* it starts is decided here.
   Left to the browser it begins at first render, which on a heavy page
   means it finishes before anything is visible. Waiting for the webfont
   also avoids the headline animating in a fallback face and then
   reflowing — but the timeout guarantees it always plays. */
(function () {
  var root = document.documentElement;
  root.classList.add("js-hero");

  var started = false;
  function start() {
    if (started) return;
    started = true;
    root.classList.add("is-ready");
  }

  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(start).catch(start);
  }
  setTimeout(start, 1200);   /* never wait longer than this */
}());
