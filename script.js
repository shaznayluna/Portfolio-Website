/* ============================================================
   Shared behaviour for every page.

   This file is loaded as a blocking script at the top of <body>,
   which is deliberate: the theme has to be settled before the
   first paint, and the hero has to be marked hidden before it
   is ever drawn. Both of those run immediately.

   Everything else touches elements further down the document,
   which do not exist yet at that point — so it goes through
   onReady(). Querying for them at load time silently returns
   null and the feature quietly does nothing.
   ============================================================ */

function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function hasFinePointer() {
  return !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
}

/* ---------- colour theme ----------
   Runs immediately: the theme must be right before anything paints. */
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

  /* data-theme drives the static site's CSS; .theme-dark is the class the
     Webflow build binds its Dark variable mode to. Setting both keeps one
     script serving both builds. */
  function apply(v) {
    root.setAttribute("data-theme", v);
    root.classList.toggle("theme-dark", v === "dark");
    sync(v);
  }

  var saved = read();
  apply(saved === "light" || saved === "dark" ? saved : systemPref());

  /* delegated, so it works for buttons that do not exist yet */
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest("[data-set-theme]");
    if (!btn) return;
    var v = btn.getAttribute("data-set-theme");
    apply(v);
    write(v);
  });

  onReady(function () { sync(root.getAttribute("data-theme")); });
}());

/* ---------- hero entrance timing ----------
   Also immediate, and deliberately high in this file. The hero hides
   itself until `js-hero` is set, so this must not sit downstream of
   anything that could throw and stop the script.

   It waits for `load` rather than for fonts: fonts resolve in a few
   hundred milliseconds, which on a page carrying real imagery is long
   before the first paint — the entrance would finish before anything
   reached the screen. The timeout is a backstop, since nothing should
   keep the headline hidden indefinitely. */
(function () {
  var root = document.documentElement;
  root.classList.add("js-hero");

  var started = false;
  function start() {
    if (started) return;
    started = true;
    root.classList.add("is-ready");
  }

  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start);
  }

  setTimeout(start, 8000);
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

  onReady(function () {
    var els = document.querySelectorAll(".reveal, [data-reveal]");  /* Webflow build marks reveals with an attribute */
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
  });
}());

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
onReady(function () {
  if (!hasFinePointer() || prefersReducedMotion()) return;

  var dot = document.querySelector(".cursor-dot");
  if (!dot) return;

  document.documentElement.classList.add("js-cursor");

  var INTERACTIVE = "a, button, .card, .folder, [data-set-theme]";
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
    /* the folders hand back the native hand cursor, so the dot steps aside */
    var hand = e.target && e.target.closest ? e.target.closest(".folder") : null;
    dot.classList.toggle("is-hidden", !!hand);
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
});

/* ---------- card tilt ---------- */
onReady(function () {
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
});

/* ---------- progressive scroll blur ----------
   The band is fixed to the viewport, so left alone it would blur the
   bottom of every section. It is only wanted over the work grid, so it
   follows that section in and out of view. */
onReady(function () {
  var band = document.querySelector(".scroll-blur");
  var work = document.querySelector(".work");
  if (!band || !work || !("IntersectionObserver" in window)) return;

  var io = new IntersectionObserver(function (entries) {
    band.classList.toggle("is-on", entries[0].isIntersecting);
  }, { rootMargin: "0px 0px -10% 0px" });

  io.observe(work);
});

/* ---------- about dialogs ----------
   Dormant while the hero cards are out of the markup. Native <dialog>
   does the heavy lifting when they return: Esc to close, the backdrop,
   focus trapping and restoring focus to the trigger are all built in. */
onReady(function () {
  var openers = document.querySelectorAll("[data-opens]");
  if (!openers.length) return;

  /* A dialog opened with showModal() is painted in the browser's top
     layer, which sits above the whole z-index system — the cursor dot at
     z-index 9999 still ends up underneath it. The only way to be above a
     top-layer element is to be inside it, so the dot moves into the
     dialog on open and back to the body on close. */
  var dot = document.querySelector(".cursor-dot");

  function liftCursorInto(dialog) {
    if (dot) dialog.appendChild(dot);
  }

  function dropCursorBack() {
    if (dot && dot.parentNode !== document.body) document.body.appendChild(dot);
  }

  /* A dialog is display:none until it opens, and browsers will not start
     an autoplaying video that has never been rendered. So play on open
     rather than relying on the autoplay attribute — and pause on close,
     since a looping video in a hidden dialog is pure waste. */
  function playVideos(dialog) {
    var vids = dialog.querySelectorAll("video");
    for (var v = 0; v < vids.length; v++) {
      var p = vids[v].play();
      if (p && p.catch) p.catch(function () {});   /* blocked autoplay is fine */
    }
  }

  function pauseVideos() {
    var vids = this.querySelectorAll("video");
    for (var v = 0; v < vids.length; v++) vids[v].pause();
  }

  var wired = {};

  for (var i = 0; i < openers.length; i++) {
    var id = openers[i].getAttribute("data-opens");

    /* one close handler per dialog, however many things open it */
    if (id && !wired[id]) {
      wired[id] = true;
      var target = document.getElementById(id);
      if (target) {
        target.addEventListener("close", dropCursorBack);
        target.addEventListener("close", pauseVideos);
      }
    }

    openers[i].addEventListener("click", function () {
      var dialog = document.getElementById(this.getAttribute("data-opens"));
      if (!dialog) return;
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      liftCursorInto(dialog);
      playVideos(dialog);
    });
  }

  document.addEventListener("click", function (e) {
    if (!e.target || !e.target.closest) return;

    var close = e.target.closest(".fact-close");
    if (close) {
      var owner = close.closest("dialog");
      if (owner) owner.close();
      return;
    }

    /* a click landing on the dialog element itself is a click on the
       backdrop — the inner grid covers everything else */
    if (e.target.tagName === "DIALOG" && e.target.classList.contains("fact-dialog")) {
      e.target.close();
    }
  });
});


/* ---------- about stack ----------
   Every card lives in one modal. Whichever folder opened it decides
   which card starts at the front; from there the cards behind are
   clickable, the arrows step through, and so do the arrow keys — so
   nothing is more than one action away once it is open. */
onReady(function () {
  var modal = document.getElementById("about-modal");
  if (!modal) return;

  var cards = [].slice.call(modal.querySelectorAll(".about-card"));
  if (!cards.length) return;

  var index = 0;

  function render() {
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      /* how far back from the front this card sits, wrapping around */
      var depth = (i - index + cards.length) % cards.length;

      card.style.setProperty("--o", depth);
      card.style.zIndex = cards.length - depth;
      card.setAttribute("data-depth", depth);
      card.classList.toggle("is-front", depth === 0);
      /* only the front card is read out; the rest are visual layers */
      card.setAttribute("aria-hidden", depth === 0 ? "false" : "true");
    }
  }

  function go(step) {
    index = (index + step + cards.length) % cards.length;
    render();
  }

  modal.addEventListener("click", function (e) {
    if (!e.target.closest) return;


    /* the card behind is the only control now: clicking it steps forward */
    var card = e.target.closest(".about-card");
    if (card && !card.classList.contains("is-front")) {
      index = cards.indexOf(card);
      render();
    }
  });

  modal.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });

  /* a folder opens the stack on its own card */
  document.addEventListener("click", function (e) {
    var trigger = e.target && e.target.closest ? e.target.closest("[data-card]") : null;
    if (!trigger || trigger.closest(".about-card")) return;

    var wanted = trigger.getAttribute("data-card");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute("data-card") === wanted) { index = i; break; }
    }
    render();
  });

  render();
});
