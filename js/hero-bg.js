/* =========================================================
   Октопус — interactive background engine
   OctopusBG.init(canvas, { mode, style }) → { setActive, setStyle, getStyle }

   Two switchable styles (compiled together, swapped live):
     • "marble" — NEW: interactive liquid water.
                  mode 0 = deep seafloor (hero), mode 1 = sunlit shallows (menu)
     • "silk"   — OLD (v1): flowing domain-warped silk with coral glints
   WebGL with a 2D canvas fallback.
   ========================================================= */
window.OctopusBG = (function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }`;

  // shared simplex noise
  const NOISE = `
    vec3 mod289(vec3 x){ return x-floor(x*(1.0/289.0))*289.0; }
    vec2 mod289(vec2 x){ return x-floor(x*(1.0/289.0))*289.0; }
    vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v){
      const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
      vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
      vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
      vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
      vec3 perm=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
      vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
      m=m*m; m=m*m; vec3 x=2.0*fract(perm*C.www)-1.0;
      vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
      m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
      vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
      return 130.0*dot(m,g);
    }`;

  // NEW — interactive water marble
  const FRAG_MARBLE = `
    precision highp float;
    uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_mode;
    const vec3 SKY = vec3(0.247,0.722,0.961);
    ${NOISE}
    float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*snoise(p); p*=2.0; a*=0.5; } return s; }
    void main(){
      float mode=u_mode;
      vec2 uv=gl_FragCoord.xy/u_res.xy; vec2 p=uv; p.x*=u_res.x/u_res.y;
      float t=u_time*0.045; vec2 m=u_mouse; m.x*=u_res.x/u_res.y;
      vec2 pull=(m-p)*0.35;
      float q=fbm(p*1.5+pull+vec2(0.0,t));
      float marble=0.5+0.5*sin((p.x+p.y)*2.2+q*4.0+t*1.6); marble=pow(marble,1.2);
      vec2 cp=p*2.6+pull*0.5;
      float c1=fbm(cp+vec2(0.0,t*1.4));
      float c2=fbm(cp*1.35+3.0+vec2(t*1.1,0.0));
      float caustic=pow(max(1.0-abs(c1-c2)*1.7,0.0), mix(2.5,4.5,mode));
      vec3 baseC=mix(vec3(0.030,0.045,0.120), vec3(0.215,0.470,0.620), mode);
      vec3 midC =mix(vec3(0.090,0.150,0.420), vec3(0.360,0.620,0.760), mode);
      vec3 hiC  =mix(vec3(0.190,0.380,0.700), vec3(0.640,0.780,0.880), mode);
      vec3 col=baseC;
      col=mix(col,midC,smoothstep(0.18,0.70,marble));
      col=mix(col,hiC,smoothstep(0.58,0.95,marble)*mix(0.55,0.70,mode));
      col+=hiC*caustic*mix(0.10,0.22,mode);
      float sun=smoothstep(1.05,0.0,distance(uv,vec2(0.5,1.08)));
      col+=vec3(0.85,0.90,0.98)*sun*mode*0.09;
      float gd=distance(uv,u_mouse); float glow=smoothstep(0.42,0.0,gd);
      col+=mix(SKY,vec3(0.80,0.88,0.98),mode)*glow*mix(0.16,0.16,mode);
      col*=mix(0.85+0.18*uv.y, 0.90+0.12*uv.y, mode);
      col=mix(col,baseC,(1.0-mode)*smoothstep(0.5,0.0,uv.x)*smoothstep(0.45,0.0,uv.y)*0.45);
      float gr=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
      col+=(gr-0.5)*mix(0.025,0.018,mode);
      gl_FragColor=vec4(col,1.0);
    }`;

  // PREVIOUS (v2) — lighter, simpler, interactive marble (before the seafloor/shallow split)
  const FRAG_SILK = `
    precision highp float;
    uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse;
    const vec3 BASE   = vec3(0.090,0.078,0.235);
    const vec3 INDIGO = vec3(0.294,0.231,0.894);
    const vec3 SKY    = vec3(0.247,0.722,0.961);
    const vec3 LAV    = vec3(0.741,0.792,1.000);
    ${NOISE}
    float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*snoise(p); p*=2.0; a*=0.5; } return s; }
    void main(){
      vec2 uv=gl_FragCoord.xy/u_res.xy; vec2 p=uv; p.x*=u_res.x/u_res.y;
      float t=u_time*0.045; vec2 m=u_mouse; m.x*=u_res.x/u_res.y;
      vec2 pull=(m-p)*0.35;
      float q=fbm(p*1.5+pull+vec2(0.0,t));
      float marble=0.5+0.5*sin((p.x+p.y)*2.2+q*4.0+t*1.6); marble=pow(marble,1.2);
      vec3 col=BASE;
      col=mix(col,INDIGO,smoothstep(0.15,0.62,marble));
      col=mix(col,SKY,smoothstep(0.55,0.9,marble)*0.85);
      col=mix(col,LAV,smoothstep(0.82,1.0,marble)*0.65);
      float gd=distance(uv,u_mouse); float glow=smoothstep(0.42,0.0,gd);
      col+=SKY*glow*0.18; col+=LAV*smoothstep(0.16,0.0,gd)*0.12;
      col=mix(col,col*1.12+0.02,0.6); col*=0.9+0.18*uv.y;
      col=mix(col,BASE,smoothstep(0.5,0.0,uv.x)*smoothstep(0.45,0.0,uv.y)*0.45);
      float gg=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
      col+=(gg-0.5)*0.025;
      gl_FragColor=vec4(col,1.0);
    }`;

  function init(canvas, opts) {
    opts = opts || {};
    if (!canvas) return noop();
    const MODE = opts.mode || 0;
    let style = opts.style === "silk" ? "silk" : "marble";

    // smoothed pointer relative to this canvas
    const mouse = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45 };
    function setTarget(cx, cy) {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      mouse.tx = (cx - r.left) / r.width;
      mouse.ty = (cy - r.top) / r.height;
    }
    window.addEventListener("pointermove", (e) => setTarget(e.clientX, e.clientY), { passive: true });
    window.addEventListener("pointerdown", (e) => setTarget(e.clientX, e.clientY), { passive: true });

    let active = true, raf = null;

    const gl =
      canvas.getContext("webgl", { antialias: true, alpha: false }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) return fallback2D();

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    function makeProgram(fragSrc) {
      const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, fragSrc);
      if (!vs || !fs) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return null; }
      return {
        prog,
        loc: gl.getAttribLocation(prog, "p"),
        uRes: gl.getUniformLocation(prog, "u_res"),
        uTime: gl.getUniformLocation(prog, "u_time"),
        uMouse: gl.getUniformLocation(prog, "u_mouse"),
        uMode: gl.getUniformLocation(prog, "u_mode"),
      };
    }

    const programs = { marble: makeProgram(FRAG_MARBLE), silk: makeProgram(FRAG_SILK) };
    if (!programs.marble || !programs.silk) return fallback2D();

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize); resize();

    const start = performance.now();
    function render(now) {
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      const P = programs[style];
      gl.useProgram(P.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(P.loc);
      gl.vertexAttribPointer(P.loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(P.uRes, canvas.width, canvas.height);
      gl.uniform1f(P.uTime, reduce ? 6.0 : (now - start) / 1000);
      if (P.uMouse) gl.uniform2f(P.uMouse, mouse.x, 1.0 - mouse.y);
      if (P.uMode) gl.uniform1f(P.uMode, MODE);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (active) raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return {
      setActive(v) {
        if (v && !active) { active = true; resize(); raf = requestAnimationFrame(render); }
        else if (!v && active) { active = false; if (raf) cancelAnimationFrame(raf); }
      },
      setStyle(name) { if (programs[name]) style = name; },
      getStyle() { return style; },
    };

    /* ---------- 2D fallback ---------- */
    function fallback2D() {
      const ctx = canvas.getContext("2d");
      const PAL = {
        marble: MODE
          ? { fill: "#173a52", blobs: [["#7fe6ff",0.5,0.7,0.6,0,0.00018],["#bfeefb",0.45,0.45,0.5,1.7,0.00022],["#ffffff",0.6,0.85,0.35,3.1,0.00014]], glow: "255,250,235" }
          : { fill: "#0a0e22", blobs: [["#4b3be4",0.65,0.35,0.6,0,0.00016],["#2f63b0",0.45,0.6,0.5,1.7,0.0002],["#1a2a6b",0.55,0.8,0.4,3.1,0.00013]], glow: "63,184,245" },
        silk: { fill: "#17123a", blobs: [["#4b3be4",0.65,0.35,0.6,0,0.00016],["#3fb8f5",0.45,0.6,0.5,1.7,0.0002],["#bcc9ff",0.55,0.8,0.4,3.1,0.00013]], glow: "63,184,245" },
      };
      function rs() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
      window.addEventListener("resize", rs); rs();
      function draw(now) {
        const W = canvas.width, H = canvas.height, pal = PAL[style] || PAL.marble;
        mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;
        ctx.fillStyle = pal.fill; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter"; ctx.filter = "blur(80px)";
        pal.blobs.forEach((b) => {
          const bx = (b[1] + Math.cos(now*b[5]+b[4])*0.1 + (mouse.x-0.5)*0.12) * W;
          const by = (b[2] + Math.sin(now*b[5]*1.3+b[4])*0.1 + (mouse.y-0.5)*0.12) * H;
          const rad = b[3] * Math.max(W, H);
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
          g.addColorStop(0, b[0]); g.addColorStop(1, "rgba(7,10,24,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, rad, 0, Math.PI*2); ctx.fill();
        });
        const gx = mouse.x*W, gy = mouse.y*H, gr = 0.3*Math.max(W,H);
        const cg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        cg.addColorStop(0, "rgba("+pal.glow+",0.5)"); cg.addColorStop(1, "rgba("+pal.glow+",0)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI*2); ctx.fill();
        ctx.filter = "none"; ctx.globalCompositeOperation = "source-over";
        if (active) requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
      return {
        setActive(v) { if (v && !active) { active = true; rs(); requestAnimationFrame(draw); } else active = v; },
        setStyle(name) { if (PAL[name]) style = name; },
        getStyle() { return style; },
      };
    }
  }

  function noop() { return { setActive() {}, setStyle() {}, getStyle() { return "marble"; } }; }

  return { init };
})();

// Boot the hero background — deep seafloor, remembering the chosen style
(function () {
  let saved = "marble";
  try { saved = localStorage.getItem("octo-bg-style") || "marble"; } catch (e) {}
  window.heroBG = OctopusBG.init(document.getElementById("hero-bg"), { mode: 0, style: saved });
})();
