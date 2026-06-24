/* =========================================================
   Hero reveal — frosted blur with sharp "selection" windows
   HeroReveal.init(root) → { setActive }
   ========================================================= */
window.HeroReveal = (function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STATIC = [
    { xp: 0.07, yp: 0.18, wp: 0.24, hp: 0.30, r: 14 },
    { xp: 0.64, yp: 0.10, wp: 0.20, hp: 0.26, r: 12 },
    { xp: 0.52, yp: 0.56, wp: 0.30, hp: 0.24, r: 16 },
  ];

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function init(root) {
    if (!root) return noop();

    const canvas = root.querySelector("#hero-reveal-sharp");
    const lensLayer = root.querySelector("#hero-reveal-lenses");
    if (!canvas || !lensLayer) return noop();

    const ctx = canvas.getContext("2d");
    const sharp = document.createElement("canvas");
    const sctx = sharp.getContext("2d");
    const mouse = { tx: 0.5, ty: 0.5, x: 0.5, y: 0.5 };
    const blobs = [
      ["#e85a4a", 0.32, 0.42, 0.34],
      ["#c43d8a", 0.68, 0.28, 0.30],
      ["#3ec5e8", 0.22, 0.72, 0.28],
      ["#6b4fe0", 0.78, 0.62, 0.32],
      ["#f0a030", 0.48, 0.38, 0.22],
      ["#ffffff", 0.55, 0.48, 0.18],
    ];

    let active = false;
    let raf = null;
    let W = 0;
    let H = 0;
    const start = performance.now();
    const lensTpl =
      '<span class="hero__reveal-handle hero__reveal-handle--tl"></span>' +
      '<span class="hero__reveal-handle hero__reveal-handle--tr"></span>' +
      '<span class="hero__reveal-handle hero__reveal-handle--bl"></span>' +
      '<span class="hero__reveal-handle hero__reveal-handle--br"></span>' +
      '<span class="hero__reveal-handle hero__reveal-handle--tm"></span>' +
      '<span class="hero__reveal-handle hero__reveal-handle--bm"></span>' +
      '<span class="hero__reveal-handle hero__reveal-handle--ml"></span>' +
      '<span class="hero__reveal-handle hero__reveal-handle--mr"></span>';

    const lensEls = [];
    function ensureLenses() {
      if (lensEls.length) return;
      STATIC.forEach(() => {
        const el = document.createElement("div");
        el.className = "hero__reveal-lens hero__reveal-lens--static";
        el.innerHTML = lensTpl;
        lensLayer.appendChild(el);
        lensEls.push(el);
      });
      const cursorLens = document.createElement("div");
      cursorLens.className = "hero__reveal-lens hero__reveal-lens--cursor";
      cursorLens.innerHTML = lensTpl;
      lensLayer.appendChild(cursorLens);
      lensEls.push(cursorLens);
    }

    function resize() {
      const r = root.getBoundingClientRect();
      W = Math.max(1, Math.floor(r.width));
      H = Math.max(1, Math.floor(r.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = sharp.width = Math.floor(W * dpr);
      canvas.height = sharp.height = Math.floor(H * dpr);
      canvas.style.width = sharp.style.width = W + "px";
      canvas.style.height = sharp.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function rectPx(spec, isCursor) {
      if (isCursor) {
        const lw = Math.min(220, W * 0.28);
        const lh = Math.min(170, H * 0.26);
        const cx = mouse.x * W;
        const cy = mouse.y * H;
        return { x: cx - lw / 2, y: cy - lh / 2, w: lw, h: lh, r: 12 };
      }
      return {
        x: spec.xp * W,
        y: spec.yp * H,
        w: spec.wp * W,
        h: spec.hp * H,
        r: spec.r,
      };
    }

    function allRects() {
      return STATIC.map((s) => rectPx(s, false)).concat([rectPx(null, true)]);
    }

    function placeLens(el, r) {
      el.style.transform = "translate(" + r.x.toFixed(1) + "px," + r.y.toFixed(1) + "px)";
      el.style.width = r.w.toFixed(1) + "px";
      el.style.height = r.h.toFixed(1) + "px";
    }

    function syncLenses() {
      ensureLenses();
      STATIC.forEach((s, i) => placeLens(lensEls[i], rectPx(s, false)));
      placeLens(lensEls[lensEls.length - 1], rectPx(null, true));
    }

    function drawSharp(c, now) {
      const t = reduce ? 4 : (now - start) / 1000;
      c.fillStyle = "#1a3a8f";
      c.fillRect(0, 0, W, H);

      c.globalCompositeOperation = "lighter";
      blobs.forEach((b, i) => {
        const phase = i * 1.4;
        const bx = (b[1] + Math.sin(t * 0.09 + phase) * 0.04 + (mouse.x - 0.5) * 0.06) * W;
        const by = (b[2] + Math.cos(t * 0.11 + phase) * 0.04 + (mouse.y - 0.5) * 0.06) * H;
        const rad = b[3] * Math.max(W, H);
        const g = c.createRadialGradient(bx, by, 0, bx, by, rad);
        g.addColorStop(0, b[0]);
        g.addColorStop(1, "rgba(26,58,143,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(bx, by, rad, 0, Math.PI * 2);
        c.fill();
      });
      c.globalCompositeOperation = "source-over";

      c.globalAlpha = 0.12;
      for (let i = 0; i < 6; i++) {
        const cx = (0.15 + i * 0.14 + Math.sin(t * 0.15 + i) * 0.03) * W;
        const cy = (0.2 + (i % 3) * 0.25 + Math.cos(t * 0.12 + i) * 0.04) * H;
        const rr = Math.min(W, H) * (0.06 + (i % 2) * 0.02);
        c.beginPath();
        c.ellipse(cx, cy, rr, rr * 0.85, t * 0.08 + i, 0, Math.PI * 2);
        c.fillStyle = i % 2 ? "#ff6b5a" : "#ffffff";
        c.fill();
      }
      c.globalAlpha = 1;
    }

    function drawFrost(now) {
      drawSharp(sctx, now);
      ctx.clearRect(0, 0, W, H);
      ctx.filter = "blur(34px) saturate(1.15) brightness(1.04)";
      ctx.drawImage(sharp, 0, 0, W, H);
      ctx.filter = "none";

      ctx.fillStyle = "rgba(255,255,255,0.11)";
      ctx.fillRect(0, 0, W, H);

      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 120; i++) {
        const gx = (Math.sin(i * 12.7) * 0.5 + 0.5) * W;
        const gy = (Math.cos(i * 9.3) * 0.5 + 0.5) * H;
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.18)";
        ctx.fillRect(gx, gy, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;

      allRects().forEach((r) => {
        ctx.save();
        roundRect(ctx, r.x, r.y, r.w, r.h, r.r);
        ctx.clip();
        ctx.drawImage(sharp, 0, 0, W, H);
        ctx.restore();
      });
    }

    function loop(now) {
      mouse.x += (mouse.tx - mouse.x) * 0.11;
      mouse.y += (mouse.ty - mouse.y) * 0.11;
      drawFrost(now);
      syncLenses();
      if (active) raf = requestAnimationFrame(loop);
    }

    function setTarget(cx, cy) {
      const r = root.getBoundingClientRect();
      if (!r.width) return;
      mouse.tx = (cx - r.left) / r.width;
      mouse.ty = (cy - r.top) / r.height;
    }

    function onMove(e) {
      if (!active) return;
      setTarget(e.clientX, e.clientY);
    }

    const hero = root.closest(".hero") || root;
    window.addEventListener("resize", resize);
    hero.addEventListener("pointermove", onMove, { passive: true });
    hero.addEventListener("pointerdown", onMove, { passive: true });

    return {
      setActive(v) {
        if (v && !active) {
          active = true;
          resize();
          ensureLenses();
          syncLenses();
          raf = requestAnimationFrame(loop);
        } else if (!v && active) {
          active = false;
          if (raf) cancelAnimationFrame(raf);
        }
      },
    };
  }

  function noop() {
    return { setActive() {} };
  }

  return { init };
})();

(function () {
  const root = document.getElementById("hero-reveal");
  if (root) window.heroRevealBG = HeroReveal.init(root);
})();
