/* Condução da partida na tela: liga a lógica (RAM.Jogo) às animações,
   ao áudio e aos botões. Toda regra fica em RAM.Jogo. */
window.RAM = window.RAM || {};

RAM.Partida = (function () {
  const { $, $$, app } = RAM.UI;
  const P = RAM.Pontuacao, A = RAM.Audio, FX = RAM.FX, C = RAM.Configuracoes;
  let jogo = null, ultimaConfig = null;
  let ocupado = false, pausado = false, sessao = 0;
  let pararSuspense = null, pularEspera = null, wake = null;
  const alts = () => $$("#alternativas .alt");
  const fmt = P.formatar;

  /* ---------- início ---------- */
  function iniciar(cfg) {
    ultimaConfig = cfg;
    sessao++;
    limparSuspense();
    const dif = RAM.CONFIG.DIFICULDADES.find(d => d.id === C.get("dificuldade")) || { deslocamento: 0 };
    jogo = RAM.Jogo.criar({
      modo: cfg.modo, nomes: cfg.nomes,
      quantidade: C.get("quantidade"), deslocamento: dif.deslocamento,
      vistas: C.historico()
    });
    ocupado = false; pausado = false; FX.pausado = false;
    $("#placar").hidden = cfg.modo !== "grupo";
    $("#hud-vez").hidden = cfg.modo !== "grupo";
    $("#escada-jogo").dataset.chave = "";
    RAM.Telas.mostrar("jogo");
    pedirTelaAcesa();
    const s = sessao;
    if (cfg.modo === "grupo") { ocupado = true; mostrarVez().then(() => { if (s !== sessao) return; ocupado = false; apresentar(); }); }
    else apresentar();
  }

  function jogarNovamente() { if (ultimaConfig) iniciar(ultimaConfig); }

  /* ---------- apresentação da pergunta ---------- */
  function apresentar() {
    const st = jogo.estado, q = st.pergunta, j = jogo.jogadorAtual();
    if (!q || st.fase === "fim") return finalizar();
    const v = jogo.valoresAtuais();
    const total = jogo.escada.length;
    const tensao = P.tensao(j.nivel, total);
    app().dataset.tensao = tensao;
    app().classList.remove("suspense", "ocupado");
    A.tocarMusica("pergunta", tensao);
    A.abafarMusica(1, 0.4);

    setValor("#v-errar", v.errar);
    setValor("#v-parar", v.parar);
    setValor("#v-acertar", v.acertar);
    $("#hud-vez").textContent = "VEZ DE " + j.nome;

    $("#painel-num").textContent = v.ultima ? "PERGUNTA FINAL · VALENDO " + fmt(v.acertar) : "PERGUNTA " + (j.nivel + 1) + " DE " + total;
    $("#painel-cat").textContent = q.categoria;
    const txt = $("#painel-texto");
    txt.textContent = q.pergunta;
    txt.classList.toggle("longo", q.pergunta.length > 70 && q.pergunta.length <= 105);
    txt.classList.toggle("muito-longo", q.pergunta.length > 105);
    $("#painel-explica").hidden = true;
    $("#painel").classList.remove("sai");
    FX.reiniciar($("#painel"), "entra");

    alts().forEach((b, i) => {
      b.className = "alt";
      b.disabled = false;
      $(".alt-texto", b).textContent = q.alternativas[i];
      $(".alt-texto", b).classList.toggle("longo", q.alternativas[i].length > 26);
      $(".alt-voto", b).textContent = "";
      b.setAttribute("aria-label", RAM.Banco.LETRAS[i] + ": " + q.alternativas[i]);
      void b.offsetWidth;
      b.classList.add("entra");
    });

    $("#btn-responder").hidden = false;
    $("#btn-responder").disabled = true;
    $("#btn-continuar").hidden = true;
    $("#btn-parar").hidden = false;
    $("#btn-parar").disabled = j.nivel === 0;
    atualizarAjudas();
    atualizarPlacar();
    atualizarEscada(false);
    A.tocar("entradaPergunta");
  }

  function setValor(sel, valor) {
    const el = $(sel);
    const antes = +(el.dataset.valor || 0);
    el.dataset.valor = valor;
    if (antes !== valor) { FX.contar(el, antes, valor, 700, fmt); FX.reiniciar(el, "muda"); }
    else el.textContent = fmt(valor);
  }

  function atualizarEscada(animar, nivel) {
    const j = jogo.jogadorAtual();
    RAM.UI.renderEscada($("#escada-jogo"), jogo.escada, nivel == null ? j.nivel : nivel, { animar });
  }

  function atualizarAjudas() {
    const aj = jogo.jogadorAtual().ajudas;
    ["cinquenta", "plateia", "pular"].forEach(t => {
      const b = $("#aj-" + t);
      b.classList.toggle("usada", !aj[t]);
      b.disabled = !aj[t];
      b.setAttribute("aria-label", RAM.Ajudas.TIPOS[t].nome + (aj[t] ? "" : " (já usada)"));
    });
  }

  function atualizarPlacar() {
    if (jogo.estado.modo === "grupo") RAM.UI.renderPlacar($("#placar"), jogo.estado.jogadores, jogo.estado.vez);
  }

  /* ---------- seleção e resposta ---------- */
  function selecionar(i) {
    if (ocupado || pausado || !jogo || jogo.estado.fase !== "pergunta") return;
    if (!jogo.selecionar(i)) return;
    alts().forEach((b, k) => b.classList.toggle("selecionada", k === i));
    $("#btn-responder").disabled = false;
    A.tocar("selecao");
  }

  function moverSelecao(delta) {
    if (!jogo || jogo.estado.fase !== "pergunta") return;
    const livres = [0, 1, 2, 3].filter(i => !jogo.estado.eliminadas.includes(i));
    const atual = livres.indexOf(jogo.estado.selecionada);
    const prox = atual < 0 ? (delta > 0 ? 0 : livres.length - 1) : (atual + delta + livres.length) % livres.length;
    selecionar(livres[prox]);
  }

  async function confirmar() {
    if (ocupado || pausado || !jogo) return;
    const st = jogo.estado;
    if (st.fase !== "pergunta" || st.selecionada === null) return;
    if (!jogo.travar()) return;
    const s = sessao;
    ocupado = true;
    app().classList.add("ocupado", "suspense");
    const escolhida = st.selecionada;
    const sel = alts()[escolhida];
    alts().forEach((b, i) => { if (i !== escolhida) b.classList.add("apagada"); });
    sel.classList.add("travada");
    $("#btn-responder").disabled = true;
    A.tocar("travar");
    A.abafarMusica(0.1, 0.25);
    const tensao = +app().dataset.tensao;
    pararSuspense = A.suspense(tensao);

    // pausa dramática: cresce com o valor da pergunta
    await FX.esperar(1700 + tensao * 1000 + Math.random() * 600);
    if (s !== sessao) return;
    limparSuspense();

    const r = jogo.revelar();
    app().classList.remove("suspense");
    sel.classList.remove("travada", "selecionada");

    if (r.acertou) {
      sel.classList.remove("apagada");
      sel.classList.add("certa");
      A.tocar("certo");
      A.abafarMusica(0.45, 0.4);
      FX.explosaoEm(sel, "#18d47c", 55);
      RAM.UI.carimbo(r.venceu ? "É O MILHÃO!" : "CERTA RESPOSTA!", r.venceu ? "ouro" : "certo");
      atualizarEscada(true, r.nivelRespondido + 1);
      RAM.UI.marcarConquista($("#escada-jogo"), r.nivelRespondido);
      setValor("#v-parar", r.premio);
      await FX.esperar(r.venceu ? 300 : 1100);
      if (s !== sessao) return;
      explicar('<b>Você garantiu ' + fmt(r.premio) + ".</b> " + RAM.UI.escapar(st.pergunta.explicacao || ""));
      if (r.venceu) {
        await FX.esperar(1700);
        if (s !== sessao) return;
        atualizarPlacar();
        ocupado = false;
        app().classList.remove("ocupado");
        await celebrarVitoria();
        if (s !== sessao) return;
        return continuar();
      }
    } else {
      sel.classList.remove("apagada");
      sel.classList.add("errada");
      A.tocar("errado");
      A.abafarMusica(0.25, 0.4);
      RAM.UI.carimbo("QUE PENA!", "errado");
      await FX.esperar(900);
      if (s !== sessao) return;
      const c = alts()[r.correta];
      c.classList.remove("apagada");
      c.classList.add("certa");
      await FX.esperar(500);
      if (s !== sessao) return;
      const letra = RAM.Banco.LETRAS[r.correta];
      explicar("A resposta certa era <b>" + letra + " — " + RAM.UI.escapar(st.pergunta.alternativas[r.correta]) + "</b>. " +
        RAM.UI.escapar(st.pergunta.explicacao || "") + "<br>" + (jogo.estado.modo === "grupo" ? RAM.UI.escapar(jogo.jogadorAtual().nome) + " leva " : "Você leva ") + "<b>" + fmt(r.premio) + "</b>.");
    }
    atualizarPlacar();
    prepararContinuar();
    ocupado = false;
    app().classList.remove("ocupado");
  }

  function explicar(html) {
    const el = $("#painel-explica");
    el.innerHTML = html;
    el.hidden = false;
  }

  function prepararContinuar() {
    const j = jogo.jogadorAtual();
    const outrosAtivos = jogo.estado.jogadores.some((x, i) => i !== jogo.estado.vez && x.status === "jogando");
    let rotulo = "PRÓXIMA PERGUNTA";
    if (j.status !== "jogando") rotulo = outrosAtivos ? "PRÓXIMO JOGADOR" : "VER RESULTADO";
    else if (jogo.estado.modo === "grupo" && outrosAtivos) rotulo = "PRÓXIMO JOGADOR";
    alts().forEach(b => { b.disabled = true; });
    $("#btn-responder").hidden = true;
    $("#btn-parar").hidden = true;
    const btn = $("#btn-continuar");
    btn.textContent = rotulo;
    btn.hidden = false;
    $$(".ajuda").forEach(b => { b.disabled = true; });
    setTimeout(() => btn.focus({ preventScroll: true }), 50);
  }

  /* ---------- avançar ---------- */
  async function continuar() {
    if (ocupado || pausado || !jogo || jogo.estado.fase !== "revelada") return;
    const s = sessao;
    ocupado = true;
    const tensaoAntes = +app().dataset.tensao;
    const res = jogo.avancar();
    if (res.fim) { ocupado = false; return finalizar(); }
    $("#btn-continuar").hidden = true;
    await saidaPergunta();
    if (s !== sessao) return;
    const j = jogo.jogadorAtual();
    const total = jogo.escada.length;
    if (res.trocouJogador) await mostrarVez();
    else if (res.subiu && (P.tensao(j.nivel, total) > tensaoAntes || j.nivel === total - 1)) await mostrarMarco();
    if (s !== sessao) return;
    ocupado = false;
    apresentar();
  }

  async function saidaPergunta() {
    $("#painel").classList.remove("entra");
    FX.reiniciar($("#painel"), "sai");
    alts().forEach(b => { b.classList.remove("entra"); b.classList.add("sai"); });
    $("#painel-explica").hidden = true;
    await FX.esperar(340);
  }

  /* ---------- sobreposições temporizadas ---------- */
  function aguardar(el, ms) {
    RAM.UI.abrirOv(el);
    return new Promise(ok => {
      let feito = false;
      const fim = () => { if (feito) return; feito = true; pularEspera = null; el.removeEventListener("click", fim); RAM.UI.fecharOv(el).then(ok); };
      pularEspera = fim;
      el.addEventListener("click", fim);
      FX.esperar(ms).then(fim);
    });
  }

  function mostrarVez() {
    const j = jogo.jogadorAtual();
    const v = jogo.valoresAtuais();
    $("#vez-nome").textContent = j.nome + "!";
    $("#vez-info").textContent = "Pergunta " + (j.nivel + 1) + " · valendo " + fmt(v.acertar);
    A.tocar("vez");
    return aguardar($("#ov-vez"), 2900);
  }

  function mostrarMarco() {
    const v = jogo.valoresAtuais();
    $("#marco-rotulo").textContent = v.ultima ? "A PERGUNTA FINAL VALE" : "AGORA VALENDO";
    $("#marco-valor").textContent = fmt(v.acertar);
    A.tocar("subida");
    if (v.ultima) FX.confete(1200);
    return aguardar($("#ov-marco"), 2600);
  }

  function celebrarVitoria() {
    const j = jogo.jogadorAtual();
    $("#vitoria-nome").textContent = (jogo.estado.modo === "grupo" ? j.nome : "VOCÊ") + " CONQUISTOU";
    A.pararMusica();
    A.tocar("vitoria");
    FX.confete(7000);
    RAM.UI.abrirOv($("#ov-vitoria"));
    setTimeout(() => $("#btn-vitoria-ok").focus({ preventScroll: true }), 2300);
    return new Promise(ok => {
      const fim = () => { pularEspera = null; $("#btn-vitoria-ok").removeEventListener("click", fim); RAM.UI.fecharOv($("#ov-vitoria")).then(ok); };
      $("#btn-vitoria-ok").addEventListener("click", fim);
      pularEspera = fim;
    });
  }

  /* ---------- parar ---------- */
  async function parar() {
    if (ocupado || pausado || !jogo || jogo.estado.fase !== "pergunta" || jogo.jogadorAtual().nivel === 0) return;
    const v = jogo.valoresAtuais();
    const grupo = jogo.estado.modo === "grupo";
    const s = sessao;
    const ok = await RAM.UI.confirmar({
      titulo: "PARAR AGORA?",
      texto: (grupo ? RAM.UI.escapar(jogo.jogadorAtual().nome) + " leva" : "Você leva") + " <b>" + fmt(v.parar) + "</b> e " + (grupo ? "sai da disputa." : "encerra a partida."),
      sim: "PARAR", nao: "CONTINUAR JOGANDO"
    });
    if (!ok || s !== sessao || jogo.estado.fase !== "pergunta") return;
    const r = jogo.parar();
    A.tocar("parar");
    A.abafarMusica(0.35, 0.4);
    RAM.UI.carimbo(fmt(r.premio), "ouro");
    FX.explosaoEm($("#v-parar"), "#ffc93c", 30);
    alts().forEach((b, i) => {
      b.classList.remove("selecionada");
      b.classList.add(i === r.correta ? "certa" : "apagada");
    });
    const st = jogo.estado;
    explicar((grupo ? RAM.UI.escapar(jogo.jogadorAtual().nome) + " parou" : "Você parou") + " com <b>" + fmt(r.premio) + "</b>. A resposta certa era <b>" +
      RAM.Banco.LETRAS[r.correta] + " — " + RAM.UI.escapar(st.pergunta.alternativas[r.correta]) + "</b>.");
    atualizarPlacar();
    prepararContinuar();
  }

  /* ---------- ajudas ---------- */
  async function usarAjuda(tipo) {
    if (ocupado || pausado || !jogo || jogo.estado.fase !== "pergunta") return;
    const btn = $("#aj-" + tipo);
    const st = jogo.estado;

    if (tipo === "cinquenta") {
      const el = jogo.usarCinquenta();
      if (!el) return;
      A.tocar("cinquenta");
      el.forEach(i => {
        const b = alts()[i];
        b.classList.remove("selecionada", "entra");
        b.classList.add("eliminada");
        b.disabled = true;
      });
      if (st.selecionada === null) $("#btn-responder").disabled = true;
      if (st.votos) mostrarVotos(st.votos);
      RAM.UI.carimbo("50 : 50", "ouro");
    } else if (tipo === "plateia") {
      const votos = jogo.usarPlateia();
      if (!votos) return;
      A.tocar("plateia");
      RAM.UI.renderGrafico($("#grafico-plateia"), votos, st.eliminadas);
      RAM.UI.abrirOv($("#ov-plateia"));
      setTimeout(() => $("#btn-plateia-ok").focus({ preventScroll: true }), 60);
      mostrarVotos(votos);
    } else if (tipo === "pular") {
      const s = sessao;
      const q = jogo.usarPular();
      if (!q) { RAM.UI.carimbo("SEM PERGUNTAS RESERVA", "errado"); return; }
      A.tocar("pular");
      ocupado = true;
      FX.explosaoEm(btn, "#66d0ff", 25);
      await saidaPergunta();
      if (s !== sessao) return;
      ocupado = false;
      apresentar();
    }
    FX.reiniciar(btn, "ativando");
    FX.explosaoEm(btn, "#ffc93c", 25);
    atualizarAjudas();
  }

  function mostrarVotos(votos) {
    alts().forEach((b, i) => { $(".alt-voto", b).textContent = jogo.estado.eliminadas.includes(i) ? "" : votos[i] + "%"; });
  }

  function fecharPlateia() { RAM.UI.fecharOv($("#ov-plateia")); }

  /* ---------- pausa, saída e reinício ---------- */
  function pausar() {
    if (RAM.Telas.atual !== "jogo" || !jogo) return;
    pausado = !pausado;
    FX.pausado = pausado;
    if (pausado) { A.tocar("pausa"); setTimeout(() => A.pausar(true), 250); RAM.UI.abrirOv($("#ov-pausa")); $("#btn-voltar-pausa").focus({ preventScroll: true }); }
    else { A.pausar(false); RAM.UI.fecharOv($("#ov-pausa")); }
  }

  async function sair() {
    if (!jogo || RAM.Telas.atual !== "jogo") return RAM.Telas.mostrar("menu");
    const ok = await RAM.UI.confirmar({ titulo: "VOLTAR AO MENU?", texto: "A partida em andamento será encerrada.", sim: "ENCERRAR", nao: "CONTINUAR" });
    if (!ok) return;
    encerrar();
    RAM.Telas.mostrar("menu");
  }

  async function reiniciar() {
    if (!ultimaConfig) return;
    const ok = await RAM.UI.confirmar({ titulo: "REINICIAR?", texto: "Começar uma nova partida do zero.", sim: "REINICIAR" });
    if (!ok) return;
    encerrar();
    iniciar(ultimaConfig);
  }

  function encerrar() {
    sessao++;
    limparSuspense();
    ocupado = false;
    if (pausado) { pausado = false; FX.pausado = false; A.pausar(false); RAM.UI.fecharOv($("#ov-pausa")); }
    ["#ov-vez", "#ov-marco", "#ov-plateia", "#ov-vitoria"].forEach(s => RAM.UI.fecharOv($(s)));
    pularEspera = null;
    soltarTelaAcesa();
    if (jogo) salvarHistorico();
  }

  function limparSuspense() { if (pararSuspense) { pararSuspense(); pararSuspense = null; } }

  function finalizar() {
    encerrar();
    RAM.Telas.mostrarResultado(jogo.resultados(), jogo.estado.modo, jogo.escada);
  }

  function salvarHistorico() {
    let ids = jogo.idsVistos();
    // quando quase todo o banco já foi visto, recomeça o ciclo
    if (ids.length > RAM.Banco.total() - 40) ids = ids.filter(id => !C.historico().includes(id));
    C.gravarHistorico(ids);
  }

  /* mantém a tela da TV acesa durante a partida, quando o navegador permite */
  async function pedirTelaAcesa() {
    try { if (navigator.wakeLock && !wake) wake = await navigator.wakeLock.request("screen"); } catch (e) { wake = null; }
  }
  function soltarTelaAcesa() { try { if (wake) wake.release(); } catch (e) {} wake = null; }

  /* Enter / clique durante as sobreposições temporizadas */
  function pularSobreposicao() { if (pularEspera) { pularEspera(); return true; } return false; }

  function iniciarEventos() {
    alts().forEach((b, i) => b.addEventListener("click", () => {
      // no celular, tocar de novo na alternativa já escolhida confirma
      if (jogo && jogo.estado.selecionada === i && jogo.estado.fase === "pergunta" && matchMedia("(pointer: coarse)").matches) confirmar();
      else selecionar(i);
    }));
    $("#btn-responder").addEventListener("click", confirmar);
    $("#btn-continuar").addEventListener("click", continuar);
    $("#btn-parar").addEventListener("click", parar);
    $("#aj-cinquenta").addEventListener("click", () => usarAjuda("cinquenta"));
    $("#aj-plateia").addEventListener("click", () => usarAjuda("plateia"));
    $("#aj-pular").addEventListener("click", () => usarAjuda("pular"));
    $("#btn-plateia-ok").addEventListener("click", fecharPlateia);
    $("#btn-pausa").addEventListener("click", pausar);
    $("#btn-voltar-pausa").addEventListener("click", pausar);
    $("#btn-sair").addEventListener("click", sair);
    $("#btn-som").addEventListener("click", RAM.Telas.alternarSom);
    $("#btn-tela").addEventListener("click", RAM.Telas.alternarTelaCheia);
    $("#btn-escada").addEventListener("click", () => {
      app().classList.toggle("escada-aberta");
      requestAnimationFrame(() => RAM.UI.posicionarCursor($("#escada-jogo")));
    });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && RAM.Telas.atual === "jogo") pedirTelaAcesa(); });
  }

  return {
    iniciar, jogarNovamente, selecionar, moverSelecao, confirmar, continuar, parar, usarAjuda,
    fecharPlateia, pausar, sair, reiniciar, pularSobreposicao, iniciarEventos,
    get jogo() { return jogo; }, get pausado() { return pausado; }, get ocupado() { return ocupado; }
  };
})();
