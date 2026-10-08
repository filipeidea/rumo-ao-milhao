/* Áudio 100% original, sintetizado em tempo real com Web Audio.
   Nenhum arquivo de som externo: músicas e efeitos são gerados aqui. */
window.RAM = window.RAM || {};

RAM.Audio = (function () {
  let ctx = null, master, sfxBus, musicBus, duckGain, ruido = null;
  let volume = 0.8, efeitosOn = true, musicaOn = true, mudo = false;
  let musicaAtual = null, seq = null;
  const suspenses = new Set();

  /* ---------- infraestrutura ---------- */
  function iniciar() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    duckGain = ctx.createGain(); duckGain.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(duckGain);
    aplicarGanhos();
    // buffer de ruído branco reaproveitado por percussão, aplausos e efeitos
    ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (musicaAtual) { const m = musicaAtual; musicaAtual = null; tocarMusica(m); }
    return true;
  }

  function aplicarGanhos() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(mudo ? 0 : volume, t, 0.05);
    sfxBus.gain.setTargetAtTime(efeitosOn ? 1 : 0, t, 0.05);
    musicBus.gain.setTargetAtTime(musicaOn ? 0.55 : 0, t, 0.15);
  }

  function configurar(o) {
    if ("volume" in o) volume = o.volume;
    if ("efeitos" in o) efeitosOn = o.efeitos;
    if ("musica" in o) musicaOn = o.musica;
    if ("mudo" in o) mudo = o.mudo;
    aplicarGanhos();
  }

  function abafarMusica(nivel, dur) {
    if (!ctx) return;
    duckGain.gain.setTargetAtTime(nivel, ctx.currentTime, dur || 0.2);
  }

  /* ---------- geradores básicos ---------- */
  function nota(freq, t, dur, o) {
    o = o || {};
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.tipo || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (o.ate) osc.frequency.exponentialRampToValueAtTime(o.ate, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const pico = o.ganho == null ? 0.2 : o.ganho;
    const ataque = o.ataque || 0.005, solta = o.solta || 0.08;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque);
    g.gain.setValueAtTime(pico, t + Math.max(ataque, dur - solta));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let ultimo = g;
    if (o.filtro) {
      const f = ctx.createBiquadFilter();
      f.type = o.filtro.tipo || "lowpass";
      f.frequency.setValueAtTime(o.filtro.freq, t);
      if (o.filtro.ate) f.frequency.exponentialRampToValueAtTime(o.filtro.ate, t + dur);
      f.Q.value = o.filtro.q || 1;
      g.connect(f); ultimo = f;
    }
    osc.connect(g);
    ultimo.connect(o.destino || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  }

  function ruidoEm(t, dur, o) {
    o = o || {};
    const src = ctx.createBufferSource();
    src.buffer = ruido;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.tipo || "bandpass";
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.ate) f.frequency.exponentialRampToValueAtTime(o.ate, t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    const pico = o.ganho == null ? 0.2 : o.ganho;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + (o.ataque || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.destino || sfxBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  function bumbo(t, dest, ganho) { nota(120, t, 0.28, { tipo: "sine", ate: 42, ganho: ganho || 0.55, solta: 0.2, destino: dest }); }
  function chimbal(t, dest, ganho) { ruidoEm(t, 0.05, { tipo: "highpass", freq: 7000, ganho: ganho || 0.06, destino: dest }); }
  function caixa(t, dest, ganho) { ruidoEm(t, 0.16, { freq: 1800, q: 0.7, ganho: ganho || 0.22, destino: dest }); nota(190, t, 0.1, { tipo: "triangle", ganho: 0.12, destino: dest }); }
  function prato(t, dest, ganho) { ruidoEm(t, 1.6, { tipo: "highpass", freq: 5000, ganho: ganho || 0.18, solta: 1, destino: dest }); }

  const hz = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

  function metal(acorde, t, dur, ganho, dest) {
    acorde.forEach(n => {
      nota(hz(n), t, dur, { tipo: "sawtooth", ganho: ganho, ataque: 0.04, solta: 0.25, detune: -6, filtro: { freq: 900, ate: 2600, q: 1.2 }, destino: dest });
      nota(hz(n), t, dur, { tipo: "sawtooth", ganho: ganho * 0.7, ataque: 0.04, solta: 0.25, detune: 7, filtro: { freq: 1200, q: 1 }, destino: dest });
    });
  }

  /* ---------- efeitos ---------- */
  const SFX = {
    selecao() {
      const t = ctx.currentTime;
      nota(1046, t, 0.07, { tipo: "square", ganho: 0.06, filtro: { freq: 3000 } });
      nota(1568, t + 0.06, 0.12, { tipo: "square", ganho: 0.06, filtro: { freq: 3000 } });
    },
    navegar() { nota(660, ctx.currentTime, 0.05, { tipo: "triangle", ganho: 0.05 }); },
    travar() {
      const t = ctx.currentTime;
      bumbo(t, sfxBus, 0.7);
      ruidoEm(t, 0.6, { tipo: "bandpass", freq: 300, ate: 2400, q: 2, ganho: 0.12, ataque: 0.3 });
      nota(hz(38), t, 0.9, { tipo: "sawtooth", ganho: 0.12, filtro: { freq: 300 }, solta: 0.5 });
    },
    certo() {
      const t = ctx.currentTime;
      [72, 76, 79, 84].forEach((n, i) => {
        nota(hz(n), t + i * 0.08, 0.5, { tipo: "triangle", ganho: 0.2, solta: 0.3 });
        nota(hz(n + 12), t + i * 0.08, 0.35, { tipo: "sine", ganho: 0.07 });
      });
      metal([60, 64, 67, 72], t + 0.32, 0.9, 0.05);
      prato(t + 0.32, sfxBus, 0.12);
      aplausos(t + 0.3, 2.4, 0.16);
    },
    errado() {
      const t = ctx.currentTime;
      nota(hz(52), t, 0.45, { tipo: "sawtooth", ate: hz(50), ganho: 0.18, filtro: { freq: 900 } });
      nota(hz(47), t + 0.42, 1.1, { tipo: "sawtooth", ate: hz(40), ganho: 0.2, filtro: { freq: 800, ate: 200 }, solta: 0.6 });
      nota(hz(35), t, 1.5, { tipo: "sine", ganho: 0.25, solta: 0.8 });
      ruidoEm(t + 0.2, 1.4, { tipo: "lowpass", freq: 600, ganho: 0.05, ataque: 0.2 }); // murmúrio
    },
    ajuda() {
      const t = ctx.currentTime;
      [84, 88, 91, 96, 100].forEach((n, i) => nota(hz(n), t + i * 0.05, 0.3, { tipo: "sine", ganho: 0.07 }));
      ruidoEm(t, 0.5, { tipo: "highpass", freq: 6000, ate: 12000, ganho: 0.04 });
    },
    cinquenta() {
      const t = ctx.currentTime;
      nota(1400, t, 0.25, { tipo: "sawtooth", ate: 120, ganho: 0.08, filtro: { freq: 3000 } });
      nota(1400, t + 0.3, 0.25, { tipo: "sawtooth", ate: 120, ganho: 0.08, filtro: { freq: 3000 } });
      SFX.ajuda();
    },
    plateia() {
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) ruidoEm(t + i * 0.25, 0.9, { tipo: "bandpass", freq: 350 + Math.random() * 250, q: 3, ganho: 0.07, ataque: 0.3 });
      SFX.ajuda();
    },
    pular() {
      const t = ctx.currentTime;
      ruidoEm(t, 0.5, { tipo: "bandpass", freq: 400, ate: 5000, q: 1.5, ganho: 0.18, ataque: 0.15 });
      nota(300, t, 0.35, { tipo: "triangle", ate: 1200, ganho: 0.08 });
    },
    entradaPergunta() {
      const t = ctx.currentTime;
      ruidoEm(t, 0.4, { tipo: "bandpass", freq: 6000, ate: 500, q: 1.2, ganho: 0.07 });
      nota(hz(43), t + 0.1, 0.5, { tipo: "sine", ganho: 0.3, solta: 0.35 });
    },
    vez() {
      const t = ctx.currentTime;
      for (let i = 0; i < 16; i++) caixa(t + i * (0.09 - i * 0.003), sfxBus, 0.06 + i * 0.008);
      bumbo(t + 1.05, sfxBus, 0.7); prato(t + 1.05, sfxBus, 0.2);
      metal([62, 66, 69], t + 1.05, 0.6, 0.05);
    },
    subida() {
      const t = ctx.currentTime;
      metal([57, 61, 64], t, 0.3, 0.04);
      metal([59, 63, 66], t + 0.28, 0.3, 0.04);
      metal([62, 66, 69, 74], t + 0.56, 1.1, 0.05);
      bumbo(t + 0.56, sfxBus); prato(t + 0.56, sfxBus, 0.18);
    },
    parar() {
      const t = ctx.currentTime;
      [88, 93].forEach((n, i) => nota(hz(n), t + i * 0.12, 0.9, { tipo: "sine", ganho: 0.15, solta: 0.7 }));
      nota(hz(76), t, 0.25, { tipo: "triangle", ganho: 0.1 });
      aplausos(t + 0.2, 1.8, 0.1);
    },
    vitoria() {
      const t = ctx.currentTime;
      const prog = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79, 84]];
      prog.forEach((a, i) => { metal(a, t + i * 0.42, i === 3 ? 2.6 : 0.4, 0.05); bumbo(t + i * 0.42, sfxBus); });
      [84, 88, 91, 96].forEach((n, i) => nota(hz(n), t + 1.26 + i * 0.1, 1.6, { tipo: "triangle", ganho: 0.1, solta: 1 }));
      prato(t + 1.26, sfxBus, 0.25);
      aplausos(t + 1.2, 5, 0.22);
    },
    pausa() { nota(hz(69), ctx.currentTime, 0.2, { tipo: "triangle", ganho: 0.08 }); nota(hz(64), ctx.currentTime + 0.12, 0.25, { tipo: "triangle", ganho: 0.08 }); }
  };

  function aplausos(t, dur, ganho) {
    const n = Math.floor(dur * 45);
    for (let i = 0; i < n; i++) {
      const ti = t + Math.random() * dur;
      const fade = 1 - (ti - t) / dur;
      ruidoEm(ti, 0.03 + Math.random() * 0.03, { tipo: "bandpass", freq: 1200 + Math.random() * 2500, q: 1.5, ganho: ganho * (0.3 + Math.random() * 0.7) * fade + 0.001 });
    }
  }

  function tocar(nome) {
    if (!ctx || !SFX[nome]) return;
    try { SFX[nome](); } catch (e) { /* som nunca deve travar o jogo */ }
  }

  /* Suspense: drone grave + batimentos que aceleram. Retorna função para parar. */
  function suspense(intensidade) {
    if (!ctx) return function () {};
    intensidade = intensidade || 0;
    const t = ctx.currentTime;
    const saida = ctx.createGain();
    saida.gain.setValueAtTime(0.0001, t);
    saida.gain.exponentialRampToValueAtTime(1, t + 0.4);
    saida.connect(sfxBus);
    const osc = [];
    [hz(31), hz(31) * 1.005, hz(38)].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? "triangle" : "sawtooth"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i === 2 ? 0.05 : 0.07;
      const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.setValueAtTime(180, t); filt.frequency.linearRampToValueAtTime(700 + intensidade * 300, t + 6);
      o.connect(g); g.connect(filt); filt.connect(saida); o.start(t); osc.push(o);
    });
    // trêmolo de cordas agudo nas perguntas valiosas
    if (intensidade >= 1) {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(74 + intensidade);
      const g = ctx.createGain(); g.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 11; const lg = ctx.createGain(); lg.gain.value = 0.015 * intensidade;
      lfo.connect(lg); lg.connect(g.gain);
      const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 2400;
      o.connect(g); g.connect(filt); filt.connect(saida); o.start(t); lfo.start(t); osc.push(o, lfo);
    }
    // batimentos
    let prox = t + 0.15, intervalo = 0.85 - intensidade * 0.1, ativo = true;
    const timer = setInterval(function () {
      if (!ativo) return;
      while (prox < ctx.currentTime + 0.3) {
        bumbo(prox, saida, 0.5); bumbo(prox + 0.16, saida, 0.32);
        prox += intervalo; intervalo = Math.max(0.42, intervalo * 0.94);
      }
    }, 60);
    function parar() {
      if (!ativo) return; ativo = false; clearInterval(timer);
      const tt = ctx.currentTime;
      saida.gain.cancelScheduledValues(tt);
      saida.gain.setValueAtTime(saida.gain.value || 0.5, tt);
      saida.gain.exponentialRampToValueAtTime(0.0001, tt + 0.12);
      osc.forEach(o => { try { o.stop(tt + 0.2); } catch (e) {} });
      suspenses.delete(parar);
    }
    suspenses.add(parar);
    return parar;
  }

  /* ---------- trilhas (sequenciador) ---------- */
  const TRILHAS = {
    /* Tema de abertura: Si bemol maior, I–vi–IV–V, metais e arpejo */
    abertura: {
      bpm: 118, passos: 64,
      tocarPasso(p, t, d) {
        const acordes = [[58, 62, 65], [55, 58, 62], [51, 55, 58], [53, 57, 60]];
        const graves = [46, 43, 39, 41];
        const c = Math.floor(p / 16), s = p % 16;
        const ac = acordes[c];
        if (s % 4 === 0) bumbo(t, musicBus, 0.45);
        if (s % 8 === 4) caixa(t, musicBus, 0.16);
        if (s % 2 === 1) chimbal(t, musicBus, 0.04);
        if ([0, 3, 6, 8, 11, 14].includes(s)) nota(hz(graves[c]), t, d * 1.6, { tipo: "sawtooth", ganho: 0.14, filtro: { freq: 500 }, destino: musicBus });
        if (s === 0) ac.forEach(n => nota(hz(n), t, d * 15, { tipo: "sawtooth", ganho: 0.025, ataque: 0.3, solta: 0.6, filtro: { freq: 1400 }, destino: musicBus }));
        const arp = [ac[0] + 12, ac[1] + 12, ac[2] + 12, ac[1] + 12];
        nota(hz(arp[s % 4]), t, d * 0.9, { tipo: "triangle", ganho: 0.045, destino: musicBus });
        if (c === 3 && (s === 12 || s === 14)) metal([ac[0] + 12, ac[2] + 12], t, d * 1.6, 0.025, musicBus);
        if (c === 0 && s === 0) metal([70, 74, 77], t, d * 3, 0.03, musicBus);
      }
    },
    /* Trilha de pergunta: Ré menor, pulsação contida; acelera com a tensão */
    pergunta: {
      bpm: 96, passos: 32,
      tocarPasso(p, t, d, tens) {
        const s = p % 16, metade = p >= 16;
        const raiz = metade ? 46 : 50;
        if (s % 8 === 0) bumbo(t, musicBus, 0.35);
        if (s % 2 === 0) chimbal(t, musicBus, 0.025 + tens * 0.01);
        if (tens >= 2 && s % 2 === 1) chimbal(t, musicBus, 0.02);
        if ([0, 3, 6, 10, 12].includes(s)) nota(hz(raiz - 12), t, d * 1.4, { tipo: "sawtooth", ganho: 0.11, filtro: { freq: 380 + tens * 80 }, destino: musicBus });
        if (s === 0) [raiz, raiz + 3, raiz + 7].forEach(n => nota(hz(n), t, d * 15.5, { tipo: "sawtooth", ganho: 0.018, ataque: 0.5, solta: 0.8, filtro: { freq: 900 }, destino: musicBus }));
        if (tens >= 1 && s % 4 === 2) nota(hz(raiz + 24 + (s === 6 ? 3 : 0)), t, d * 0.6, { tipo: "triangle", ganho: 0.03, destino: musicBus });
      }
    }
  };

  function tocarMusica(nome, tensao) {
    if (musicaAtual === nome && seq) { if (seq) seq.tensao = tensao || 0; return; }
    pararMusica();
    musicaAtual = nome;
    if (!ctx || !TRILHAS[nome]) return;
    const tr = TRILHAS[nome];
    const estado = { passo: 0, prox: ctx.currentTime + 0.1, tensao: tensao || 0, ativo: true };
    estado.timer = setInterval(function () {
      if (!estado.ativo || ctx.state !== "running") return;
      const d = 60 / (tr.bpm + estado.tensao * 8) / 4;
      while (estado.prox < ctx.currentTime + 0.15) {
        try { tr.tocarPasso(estado.passo % tr.passos, estado.prox, d, estado.tensao); } catch (e) {}
        estado.prox += d; estado.passo++;
      }
    }, 30);
    seq = estado;
    abafarMusica(1, 0.3);
  }

  function pararMusica() {
    if (seq) { seq.ativo = false; clearInterval(seq.timer); seq = null; }
    musicaAtual = null;
  }

  function pararTudo() {
    suspenses.forEach(fn => fn());
    pararMusica();
  }

  function pausar(p) {
    if (!ctx) return;
    if (p) ctx.suspend(); else ctx.resume();
  }

  return { iniciar, configurar, tocar, suspense, tocarMusica, pararMusica, pararTudo, abafarMusica, pausar, get ativo() { return !!ctx; } };
})();
