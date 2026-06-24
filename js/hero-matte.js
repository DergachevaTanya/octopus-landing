/* =========================================================
   Hero matte — Apple-style soft mesh background
   HeroMatte.init(canvas) → { setActive }
   ========================================================= */
window.HeroMatte = (function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }`;

  const FRAG = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec2 u_mouse;

    float matteOrb(vec2 p, vec2 c, float r, float soft) {
      float d = length(p - c);
      return 1.0 - smoothstep(r * (1.0 - soft), r, d);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res.xy;
      vec2 p = uv;
      p.x *= u_res.x / u_res.y;
      float t = u_time;
      vec2 m = u_mouse;
      m.x *= u_res.x / u_res.y;

      vec2 pull = (m - p) * 0.14;

      vec3 base = vec3(0.038, 0.040, 0.058);

      vec2 c1 = vec2(0.28, 0.38) + pull * 0.35
        + vec2(sin(t * 0.11) * 0.06, cos(t * 0.09) * 0.05);
      vec2 c2 = vec2(0.72, 0.32) + pull * 0.28
        + vec2(cos(t * 0.10 + 1.2) * 0.05, sin(t * 0.12) * 0.06);
      vec2 c3 = vec2(0.52, 0.68) + pull * 0.32
        + vec2(sin(t * 0.08 + 2.1) * 0.07, cos(t * 0.11 + 0.8) * 0.05);
      vec2 c4 = vec2(0.18, 0.72) + pull * 0.22
        + vec2(cos(t * 0.13) * 0.04, sin(t * 0.10 + 1.5) * 0.05);
      vec2 c5 = vec2(0.84, 0.58) + pull * 0.25
        + vec2(sin(t * 0.09 + 0.5) * 0.05, cos(t * 0.14) * 0.04);

      vec3 col = base;
      col = mix(col, vec3(0.22, 0.24, 0.62), matteOrb(p, c1, 0.42, 0.88) * 0.55);
      col = mix(col, vec3(0.12, 0.52, 0.68), matteOrb(p, c2, 0.38, 0.90) * 0.48);
      col = mix(col, vec3(0.38, 0.22, 0.62), matteOrb(p, c3, 0.44, 0.86) * 0.42);
      col = mix(col, vec3(0.58, 0.18, 0.42), matteOrb(p, c4, 0.32, 0.92) * 0.22);
      col = mix(col, vec3(0.10, 0.18, 0.48), matteOrb(p, c5, 0.36, 0.88) * 0.38);

      float cursor = matteOrb(p, m, 0.28, 0.94);
      col = mix(col, col + vec3(0.14, 0.16, 0.22), cursor * 0.35);

      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(lum), 0.12);

      float vig = 1.0 - smoothstep(0.35, 1.15, length(uv - vec2(0.5, 0.48)) * 1.35);
      col *= mix(0.78, 1.0, vig);

      float gr = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (gr - 0.5) * 0.014;

      gl_FragColor = vec4(col, 1.0);
    }`;

  function init(canvas) {
    if (!canvas) return noop();

    const mouse = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45 };
    function setTarget(cx, cy) {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      mouse.tx = (cx - r.left) / r.width;
      mouse.ty = (cy - r.top) / r.height;
    }
    window.addEventListener("pointermove", (e) => setTarget(e.clientX, e.clientY), { passive: true });
    window.addEventListener("pointerdown", (e) => setTarget(e.clientX, e.clientY), { passive: true });

    let active = false;
    let raf = null;

    const gl =
      canvas.getContext("webgl", { antialias: true, alpha: false }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) return fallback2D(canvas, mouse);

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return fallback2D(canvas, mouse);

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return fallback2D(canvas, mouse);

    const loc = {
      p: gl.getAttribLocation(prog, "p"),
      uRes: gl.getUniformLocation(prog, "u_res"),
      uTime: gl.getUniformLocation(prog, "u_time"),
      uMouse: gl.getUniformLocation(prog, "u_mouse"),
    };

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize);

    const start = performance.now();
    function render(now) {
      mouse.x += (mouse.tx - mouse.x) * 0.07;
      mouse.y += (mouse.ty - mouse.y) * 0.07;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc.p);
      gl.vertexAttribPointer(loc.p, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform1f(loc.uTime, reduce ? 4.0 : (now - start) / 1000);
      const aspect = canvas.width / canvas.height;
      gl.uniform2f(loc.uMouse, mouse.x * aspect, 1.0 - mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (active) raf = requestAnimationFrame(render);
    }

    return {
      setActive(v) {
        if (v && !active) {
          active = true;
          resize();
          raf = requestAnimationFrame(render);
        } else if (!v && active) {
          active = false;
          if (raf) cancelAnimationFrame(raf);
        }
      },
    };
  }

  function fallback2D(canvas, mouse) {
    const ctx = canvas.getContext("2d");
    const blobs = [
      ["#3840a8", 0.28, 0.38, 0.42],
      ["#1e7a9e", 0.72, 0.32, 0.38],
      ["#5c34a0", 0.52, 0.68, 0.44],
      ["#8c2868", 0.18, 0.72, 0.32],
      ["#1a3068", 0.84, 0.58, 0.36],
    ];
    let active = false;
    function rs() {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
    window.addEventListener("resize", rs);
    const start = performance.now();
    function draw(now) {
      if (!active) return;
      const W = canvas.width;
      const H = canvas.height;
      const t = (now - start) / 1000;
      mouse.x += (mouse.tx - mouse.x) * 0.07;
      mouse.y += (mouse.ty - mouse.y) * 0.07;
      ctx.fillStyle = "#0a0a10";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.filter = "blur(90px)";
      blobs.forEach((b, i) => {
        const phase = i * 1.7;
        const bx = (b[1] + Math.sin(t * 0.1 + phase) * 0.05 + (mouse.x - 0.5) * 0.1) * W;
        const by = (b[2] + Math.cos(t * 0.11 + phase) * 0.05 + (mouse.y - 0.5) * 0.1) * H;
        const rad = b[3] * Math.max(W, H);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
        g.addColorStop(0, b[0]);
        g.addColorStop(1, "rgba(10,10,16,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, rad, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      if (active) requestAnimationFrame(draw);
    }
    return {
      setActive(v) {
        if (v && !active) {
          active = true;
          rs();
          requestAnimationFrame(draw);
        } else if (!v) {
          active = false;
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
  const canvas = document.getElementById("hero-matte-bg");
  if (canvas) window.heroMatteBG = HeroMatte.init(canvas);
})();
