/* Animações: partículas do palco, confete, explosões de brilho,
   contadores de valor e esperas que respeitam a pausa. */
window.RAM = window.RAM || {};

RAM.FX = (function () {
  const reduzido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pausado = false;

  /* ---------- canvas utilitário ---------- */
  function prepararCanvas(cv) {
    const ctx = cv.getContext("2d");
    function ajustar() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ajustar();
    window.addEventListener("resize", ajustar);
    return ctx;
  }

  /* ---------- poeira dourada do palco ---------- */
  function iniciarFundo(cv) {
    const ctx = prepararCanvas(cv);
    const N = reduzido ? 0 : 70;
    const ps = [];
    function nova(inicio) {
      return {
        x: Math.random() * cv.clientWidth,
        y: inicio ? Math.random() * cv.clientHeight : cv.clientHeight + 10,
        r: 0.6 + Math.random() * 2.2,
        v: 0.15 + Math.random() * 0.5,
        fase: Math.random() * Math.PI * 2,
        ouro: Math.random() < 0.45
      };
    }
    for (let i = 0; i < N; i++) ps.push(nova(true));
    function quadro(t) {
      const w = cv.clientWidth, h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (!pausado) {
        for (const p of ps) {
          p.y -= p.v; p.x += Math.sin(t / 1800 + p.fase) * 0.25;
          if (p.y < -10) Object.assign(p, nova(false));
        }
      }
      for (const p of ps) {
        const a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t / 600 + p.fase));
        ctx.beginPath();
        ctx.fillStyle = p.ouro ? "rgba(255,214,110," + a + ")" : "rgba(140,190,255," + a + ")";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(quadro);
    }
    if (N) requestAnimationFrame(quadro);
  }

  /* ---------- camada da frente: confete e brilhos ---------- */
  let fctx = null, fcv = null, particulas = [], rodando = false;
  function iniciarFrente(cv) { fcv = cv; fctx = prepararCanvas(cv); }

  function animarFrente() {
    if (rodando) return;
    rodando = true;
    function quadro() {
      const w = fcv.clientWidth, h = fcv.clientHeight;
      fctx.clearRect(0, 0, w, h);
      particulas = particulas.filter(p => p.vida > 0 && p.y < h + 40);
      for (const p of particulas) {
        if (!pausado) {
          p.vx *= p.atrito; p.vy = p.vy * p.atrito + p.g;
          p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vida--;
        }
        fctx.save();
        fctx.globalAlpha = Math.min(1, p.vida / 30);
        fctx.translate(p.x, p.y);
        if (p.tipo === "confete") {
          fctx.rotate(p.rot);
          fctx.scale(1, Math.cos(p.rot * 2));
          fctx.fillStyle = p.cor;
          fctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        } else {
          const g = fctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 3);
          g.addColorStop(0, "#fff"); g.addColorStop(0.3, p.cor); g.addColorStop(1, "rgba(0,0,0,0)");
          fctx.fillStyle = g;
          fctx.beginPath(); fctx.arc(0, 0, p.r * 3, 0, Math.PI * 2); fctx.fill();
        }
        fctx.restore();
      }
      if (particulas.length) requestAnimationFrame(quadro);
      else { rodando = false; fctx.clearRect(0, 0, w, h); }
    }
    requestAnimationFrame(quadro);
  }

  const CORES_CONFETE = ["#ffc93c", "#fff0b3", "#2160ff", "#66d0ff", "#ffffff", "#18d47c", "#ff3c55"];

  let chuvaId = 0;
  function limpar() {
    chuvaId++;
    particulas = [];
  }

  function confete(duracao) {
    if (!fctx || reduzido) return;
    const fim = performance.now() + (duracao || 4000);
    const id = ++chuvaId;
    (function chuva() {
      if (id !== chuvaId) return;
      const w = fcv.clientWidth;
      for (let i = 0; i < 9; i++) {
        particulas.push({
          tipo: "confete", x: Math.random() * w, y: -20,
          vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, g: 0.05, atrito: 0.995,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.25,
          r: 4 + Math.random() * 6, cor: CORES_CONFETE[(Math.random() * CORES_CONFETE.length) | 0], vida: 400
        });
      }
      animarFrente();
      if (performance.now() < fim) setTimeout(chuva, 50);
    })();
  }

  function explosao(x, y, cor, n) {
    if (!fctx || reduzido) return;
    n = n || 40;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, vel = 3 + Math.random() * 9;
      particulas.push({
        tipo: Math.random() < 0.5 ? "brilho" : "confete", x, y,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 2, g: 0.18, atrito: 0.96,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        r: 2 + Math.random() * 4, cor: cor || "#ffc93c", vida: 60 + Math.random() * 40
      });
    }
    animarFrente();
  }

  function explosaoEm(el, cor, n) {
    const r = el.getBoundingClientRect(), c = fcv.getBoundingClientRect();
    explosao(r.left - c.left + r.width / 2, r.top - c.top + r.height / 2, cor, n);
  }

  /* ---------- utilidades ---------- */
  function reiniciar(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // força o navegador a recomeçar a animação
    el.classList.add(cls);
  }

  function contar(el, de, para, ms, fmt) {
    if (reduzido || de === para) { el.textContent = fmt(para); return; }
    const t0 = performance.now();
    (function passo(t) {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(de + (para - de) * e));
      if (k < 1) requestAnimationFrame(passo);
    })(t0);
  }

  /* Espera que congela enquanto o jogo está pausado */
  function esperar(ms) {
    return new Promise(function (ok) {
      let restante = ms, ultimo = performance.now();
      (function tique() {
        const agora = performance.now();
        if (!pausado) restante -= agora - ultimo;
        ultimo = agora;
        if (restante <= 0) ok(); else setTimeout(tique, Math.min(50, restante));
      })();
    });
  }

  return {
    iniciarFundo, iniciarFrente, confete, limpar, explosao, explosaoEm, reiniciar, contar, esperar,
    set pausado(v) { pausado = v; }, get pausado() { return pausado; }, reduzido
  };
})();
