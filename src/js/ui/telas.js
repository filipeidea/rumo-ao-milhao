/* Navegação entre telas e telas fora da partida:
   menu, modo grupo, configurações, como jogar e resultado. */
window.RAM = window.RAM || {};

RAM.Telas = (function () {
  const { $, $$, app } = RAM.UI;
  const P = RAM.Pontuacao, C = RAM.Configuracoes, A = RAM.Audio;
  let atual = "menu";
  let mudo = false;

  function mostrar(nome) {
    RAM.FX.limpar();
    $$(".tela").forEach(t => t.classList.toggle("ativa", t.id === "tela-" + nome));
    app().dataset.tela = nome;
    app().classList.remove("escada-aberta");
    atual = nome;
    if (nome !== "jogo") { app().dataset.tensao = "0"; app().classList.remove("suspense", "ocupado"); }
    if (nome === "menu") renderMenu();
    if (nome === "config") renderConfig();
    if (nome === "grupo") renderGrupo();
    if (nome !== "jogo") A.tocarMusica("abertura");
    // foca o primeiro controle útil para quem usa teclado
    setTimeout(() => {
      const foco = { menu: "#btn-comecar", resultado: "#btn-res-novamente" }[nome];
      if (foco) $(foco).focus({ preventScroll: true });
      else if (nome === "grupo") { const i = $("#lista-jogadores input"); if (i && matchMedia("(pointer: fine)").matches) i.focus(); }
    }, 80);
  }

  /* ---------- menu ---------- */
  function renderMenu() {
    const escada = P.montarEscada(C.get("quantidade"));
    RAM.UI.renderEscada($("#escada-menu"), escada, 0);
    requestAnimationFrame(() => RAM.UI.posicionarCursor($("#escada-menu")));
    $("#menu-valor1").textContent = P.formatar(escada[0]);
    const dif = RAM.CONFIG.DIFICULDADES.find(d => d.id === C.get("dificuldade")).nome;
    $("#menu-modo").textContent = (C.get("modo") === "grupo" ? "Modo grupo" : "Modo individual") + " · " + escada.length + " perguntas · " + dif;
  }

  /* ---------- modo grupo ---------- */
  function renderGrupo() {
    let nomes = C.get("jogadores").slice(0, RAM.CONFIG.MAX_JOGADORES);
    while (nomes.length < 2) nomes.push("");
    desenharJogadores(nomes);
    $("#grupo-erro").hidden = true;
  }

  function lerNomes() { return $$("#lista-jogadores input").map(i => i.value.trim()); }

  function desenharJogadores(nomes) {
    const ol = $("#lista-jogadores");
    ol.innerHTML = "";
    nomes.forEach((nome, i) => {
      const li = document.createElement("li");
      li.innerHTML = '<span class="num">' + (i + 1) + '</span><input id="jogador-' + i + '" maxlength="16" placeholder="Nome do participante ' + (i + 1) + '" aria-label="Nome do participante ' + (i + 1) + '"><button type="button" class="remover" aria-label="Remover participante ' + (i + 1) + '">×</button>';
      $("input", li).value = nome;
      $(".remover", li).disabled = nomes.length <= 2;
      $(".remover", li).addEventListener("click", () => {
        const n = lerNomes(); n.splice(i, 1); desenharJogadores(n);
      });
      ol.appendChild(li);
    });
    $("#btn-add-jogador").disabled = nomes.length >= RAM.CONFIG.MAX_JOGADORES;
  }

  function iniciarGrupo() {
    $("#btn-add-jogador").addEventListener("click", () => {
      const n = lerNomes();
      if (n.length >= RAM.CONFIG.MAX_JOGADORES) return;
      n.push(""); desenharJogadores(n);
      $("#jogador-" + (n.length - 1)).focus();
    });
    $("#form-grupo").addEventListener("submit", e => {
      e.preventDefault();
      const brutos = lerNomes();
      const nomes = brutos.map((n, i) => (n || "Jogador " + (i + 1)).toUpperCase());
      const repetidos = nomes.filter((n, i) => nomes.indexOf(n) !== i);
      if (repetidos.length) {
        const erro = $("#grupo-erro");
        erro.textContent = "Dois participantes estão com o nome " + repetidos[0] + ". Use nomes diferentes.";
        erro.hidden = false;
        return;
      }
      C.set("jogadores", brutos);
      C.set("modo", "grupo");
      RAM.Partida.iniciar({ modo: "grupo", nomes });
    });
  }

  /* ---------- configurações ---------- */
  function renderConfig() {
    const vol = Math.round(C.get("volume") * 100);
    $("#cfg-volume").value = vol;
    $("#cfg-volume-val").textContent = vol + "%";
    $("#cfg-efeitos").setAttribute("aria-checked", String(C.get("efeitos")));
    $("#cfg-musica").setAttribute("aria-checked", String(C.get("musica")));
    RAM.UI.segmentos($("#cfg-qtd"), RAM.CONFIG.OPCOES_QUANTIDADE.map(n => ({ nome: String(n), valor: n })), C.get("quantidade"), v => C.set("quantidade", v));
    RAM.UI.segmentos($("#cfg-dif"), RAM.CONFIG.DIFICULDADES.map(d => ({ nome: d.nome, valor: d.id })), C.get("dificuldade"), v => C.set("dificuldade", v));
    RAM.UI.segmentos($("#cfg-modo"), [{ nome: "Individual", valor: "individual" }, { nome: "Grupo", valor: "grupo" }], C.get("modo"), v => C.set("modo", v));
    atualizarInfoBanco();
    atualizarBotaoTela();
  }

  function atualizarInfoBanco() {
    const vistas = C.historico().length, total = RAM.Banco.total();
    $("#cfg-banco-info").textContent = total + " perguntas · " + vistas + " já usadas";
  }

  function iniciarConfig() {
    $("#cfg-volume").addEventListener("input", e => {
      const v = +e.target.value;
      $("#cfg-volume-val").textContent = v + "%";
      C.set("volume", v / 100);
    });
    $("#cfg-volume").addEventListener("change", () => A.tocar("selecao"));
    RAM.UI.chave($("#cfg-efeitos"), C.get("efeitos"), v => { C.set("efeitos", v); A.tocar("selecao"); });
    RAM.UI.chave($("#cfg-musica"), C.get("musica"), v => C.set("musica", v));
    $("#cfg-tela").addEventListener("click", alternarTelaCheia);
    $("#cfg-reset").addEventListener("click", async () => {
      const ok = await RAM.UI.confirmar({ titulo: "REINICIAR BANCO?", texto: "As perguntas já usadas em partidas anteriores voltam a aparecer.", sim: "REINICIAR" });
      if (ok) { C.gravarHistorico([]); atualizarInfoBanco(); A.tocar("ajuda"); }
    });
  }

  /* ---------- tela cheia e som ---------- */
  function alternarTelaCheia() {
    const d = document;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else {
        const el = d.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        const p = req && req.call(el);
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* tela cheia indisponível neste navegador */ }
  }
  function atualizarBotaoTela() {
    const cheio = !!(document.fullscreenElement || document.webkitFullscreenElement);
    $("#cfg-tela").textContent = cheio ? "SAIR" : "ATIVAR";
    setTimeout(() => $$(".escada").forEach(ol => RAM.UI.posicionarCursor(ol)), 300);
  }

  function alternarSom() {
    mudo = !mudo;
    A.configurar({ mudo });
    app().classList.toggle("mudo", mudo);
  }

  /* ---------- resultado ---------- */
  function mostrarResultado(res, modo, escada) {
    const grupo = modo === "grupo";
    const vencedor = res[0];
    const fmt = P.formatar;
    const motivos = {
      venceu: "conquistou o prêmio máximo!",
      parou: "parou na pergunta " + (vencedor.respondidas + 1) + ".",
      errou: "errou a pergunta " + vencedor.respondidas + "."
    };
    if (grupo) {
      const empate = res.length > 1 && res[1].premio === vencedor.premio && res[1].acertos === vencedor.acertos;
      $("#res-motivo").textContent = empate ? "Empate no topo!" : "Vencedor: " + vencedor.nome;
      $(".res-premio-rotulo").textContent = "MAIOR PRÊMIO";
    } else {
      $("#res-motivo").textContent = "Você " + (motivos[vencedor.status] || "terminou a partida.");
      $(".res-premio-rotulo").textContent = "PRÊMIO CONQUISTADO";
    }
    RAM.FX.contar($("#res-premio"), 0, vencedor.premio, 1800, fmt);

    const soma = k => res.reduce((s, r) => s + r[k], 0);
    const respondidas = soma("respondidas"), acertos = soma("acertos"), erros = soma("erros");
    const pct = respondidas ? Math.round(100 * acertos / respondidas) : 0;
    const maior = Math.max.apply(null, res.map(r => r.maiorValor));
    $("#res-stats").innerHTML = [
      ["Respondidas", respondidas, ""], ["Acertos", pct + "%", "ouro"], ["Acertadas", acertos, "ok"],
      ["Erradas", erros, "nok"], ["Maior valor", P.formatarCurto(maior), "ouro"]
    ].map(s => '<div class="stat ' + s[2] + '"><b>' + s[1] + "</b><span>" + s[0] + "</span></div>").join("");

    const rk = $("#res-ranking");
    rk.hidden = !grupo;
    rk.classList.toggle("colunas", res.length > 4);
    $(".resultado").classList.toggle("grupo", grupo);
    if (grupo) {
      const st = { venceu: "milhão", parou: "parou", errou: "errou", jogando: "" };
      rk.innerHTML = res.map((r, i) =>
        '<div class="rank"><span class="pos">' + (i + 1) + 'º</span><span class="nm">' + RAM.UI.escapar(r.nome) +
        '</span><span class="det">' + r.acertos + " acerto" + (r.acertos === 1 ? "" : "s") + " · " + st[r.status] +
        '</span><span class="pr">' + fmt(r.premio) + "</span></div>").join("");
    }

    const itens = [];
    res.forEach(r => r.historico.forEach(h => itens.push({ h, nome: r.nome })));
    $("#res-lista").innerHTML = itens.map(({ h, nome }) =>
      '<li class="' + (h.acertou ? "ok" : "nok") + '"><span class="tag">' + (h.acertou ? "✓" : "✗") + "</span>" +
      (grupo ? "<b>" + RAM.UI.escapar(nome) + ":</b> " : "") + RAM.UI.escapar(h.pergunta) + " <small>(" + P.formatarCurto(h.valor) + ")</small></li>").join("");
    $("#res-lista-wrap").hidden = !itens.length;
    $("#res-lista-wrap").open = false;

    mostrar("resultado");
    if (vencedor.premio >= 1000000) RAM.FX.confete(3500);
  }

  /* ---------- ligação dos botões ---------- */
  function iniciar() {
    $("#btn-comecar").addEventListener("click", () => {
      if (C.get("modo") === "grupo") mostrar("grupo");
      else RAM.Partida.iniciar({ modo: "individual", nomes: ["Você"] });
    });
    $("#btn-menu-grupo").addEventListener("click", () => mostrar("grupo"));
    $("#btn-menu-config").addEventListener("click", () => mostrar("config"));
    $("#btn-menu-ajuda").addEventListener("click", () => mostrar("ajuda"));
    $("#btn-ajuda-atalhos").addEventListener("click", () => mostrar("config"));
    $$("[data-voltar]").forEach(b => b.addEventListener("click", () => mostrar("menu")));
    $("#btn-res-menu").addEventListener("click", () => mostrar("menu"));
    $("#btn-res-novamente").addEventListener("click", () => RAM.Partida.jogarNovamente());
    $$(".btn, .alt, .ajuda").forEach(b => b.addEventListener("pointerenter", () => { if (!b.disabled) A.tocar("navegar"); }));
    document.addEventListener("fullscreenchange", atualizarBotaoTela);
    document.addEventListener("webkitfullscreenchange", atualizarBotaoTela);
    window.addEventListener("resize", () => $$(".escada").forEach(ol => RAM.UI.posicionarCursor(ol)));
    iniciarGrupo();
    iniciarConfig();
  }

  return {
    iniciar, mostrar, mostrarResultado, alternarTelaCheia, alternarSom,
    get atual() { return atual; }, get mudo() { return mudo; }
  };
})();
