/* Componentes de interface reutilizáveis: escada, placar, gráfico,
   controles de formulário, sobreposições e diálogo de confirmação. */
window.RAM = window.RAM || {};

RAM.UI = (function () {
  const P = RAM.Pontuacao;
  const $ = (sel, raiz) => (raiz || document).querySelector(sel);
  const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));
  const app = () => $("#app");

  /* ---------- escada de prêmios ---------- */
  function renderEscada(ol, escada, nivelAtual, opts) {
    opts = opts || {};
    if (ol.dataset.chave !== escada.join(",")) {
      ol.innerHTML = "";
      for (let i = escada.length - 1; i >= 0; i--) {
        const li = document.createElement("li");
        li.className = "degrau" + (i === escada.length - 1 ? " topo" : "");
        li.dataset.i = i;
        li.innerHTML = '<span class="d-num">' + (i + 1) + '</span><span class="d-valor">' + P.formatar(escada[i]) + "</span>";
        ol.appendChild(li);
      }
      const cur = document.createElement("div");
      cur.className = "escada-cursor";
      ol.appendChild(cur);
      ol.dataset.chave = escada.join(",");
    }
    $$(".degrau", ol).forEach(li => {
      const i = +li.dataset.i;
      li.classList.toggle("feito", i < nivelAtual);
      li.classList.toggle("atual", i === nivelAtual);
    });
    ol.dataset.nivel = nivelAtual;
    posicionarCursor(ol, opts.animar);
  }

  function posicionarCursor(ol, animar) {
    const cur = $(".escada-cursor", ol);
    if (!cur) return;
    const nivel = +ol.dataset.nivel;
    const li = $('.degrau[data-i="' + Math.min(nivel, $$(".degrau", ol).length - 1) + '"]', ol);
    if (!li || !li.offsetHeight) { cur.style.opacity = 0; return; }
    cur.style.opacity = nivel >= $$(".degrau", ol).length ? 0 : 1;
    if (!animar) cur.style.transition = "none";
    cur.style.height = li.offsetHeight + "px";
    cur.style.transform = "translateY(" + li.offsetTop + "px)";
    if (!animar) { void cur.offsetWidth; cur.style.transition = ""; }
    else RAM.FX.reiniciar(cur, "sobe");
  }

  function marcarConquista(ol, i) {
    const li = $('.degrau[data-i="' + i + '"]', ol);
    if (li) RAM.FX.reiniciar(li, "conquista");
  }

  /* ---------- placar do modo grupo ---------- */
  function renderPlacar(el, jogadores, vez) {
    const rotulo = { parou: "parou", errou: "errou", venceu: "milhão!" };
    el.innerHTML = '<div class="placar-titulo">PLACAR</div>' + jogadores.map((j, i) => {
      const cls = "placar-linha" + (i === vez && j.status === "jogando" ? " vez" : "") + (j.status !== "jogando" ? " fora" : "");
      const st = j.status !== "jogando" ? '<span class="st">' + rotulo[j.status] + "</span>" : "";
      return '<div class="' + cls + '"><span>' + escapar(j.nome) + st + "</span><span>" + P.formatarCurto(j.premio) + "</span></div>";
    }).join("");
  }

  /* ---------- gráfico da plateia ---------- */
  function renderGrafico(el, votos, eliminadas) {
    const max = Math.max.apply(null, votos);
    el.innerHTML = votos.map((v, i) =>
      '<div class="barra' + (eliminadas.includes(i) ? " fora" : "") + (v === max ? " lider" : "") + '">' +
      '<span class="barra-pct" data-alvo="' + v + '">0%</span><div class="barra-col"></div><span class="barra-letra">' + RAM.Banco.LETRAS[i] + "</span></div>"
    ).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$(".barra", el).forEach((b, i) => {
        $(".barra-col", b).style.height = (votos[i] * 0.86) + "%";
        RAM.FX.contar($(".barra-pct", b), 0, votos[i], 1600, n => n + "%");
      });
    }));
  }

  /* ---------- controles de configuração ---------- */
  function segmentos(el, opcoes, valor, aoMudar) {
    el.innerHTML = "";
    opcoes.forEach(o => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.textContent = o.nome;
      b.dataset.valor = o.valor;
      b.setAttribute("aria-checked", String(o.valor === valor));
      b.addEventListener("click", () => {
        $$("button", el).forEach(x => x.setAttribute("aria-checked", String(x === b)));
        aoMudar(o.valor);
        if (RAM.Audio) RAM.Audio.tocar("navegar");
      });
      el.appendChild(b);
    });
  }

  function chave(btn, valor, aoMudar) {
    btn.setAttribute("aria-checked", String(!!valor));
    btn.addEventListener("click", () => {
      const novo = btn.getAttribute("aria-checked") !== "true";
      btn.setAttribute("aria-checked", String(novo));
      aoMudar(novo);
    });
  }

  /* ---------- sobreposições ---------- */
  const pilha = [];
  function abrirOv(el) {
    el.classList.remove("saindo");
    el.hidden = false;
    if (!pilha.includes(el)) pilha.push(el);
  }
  function fecharOv(el) {
    const i = pilha.indexOf(el);
    if (i >= 0) pilha.splice(i, 1);
    if (el.hidden) return Promise.resolve();
    el.classList.add("saindo");
    return new Promise(ok => setTimeout(() => { el.hidden = true; el.classList.remove("saindo"); ok(); }, 280));
  }
  function ovAberto() { return pilha[pilha.length - 1] || null; }

  /* Diálogo de confirmação dentro da página (sem confirm() do navegador) */
  let resolverConfirmacao = null;
  function confirmar(o) {
    $("#conf-titulo").textContent = o.titulo || "Tem certeza?";
    $("#conf-texto").innerHTML = o.texto || "";
    $("#conf-sim").textContent = o.sim || "CONFIRMAR";
    $("#conf-nao").textContent = o.nao || "CANCELAR";
    abrirOv($("#ov-confirmar"));
    setTimeout(() => $("#conf-sim").focus(), 50);
    return new Promise(ok => { resolverConfirmacao = ok; });
  }
  function responderConfirmacao(sim) {
    if (!resolverConfirmacao) return;
    const r = resolverConfirmacao; resolverConfirmacao = null;
    fecharOv($("#ov-confirmar"));
    r(sim);
  }
  function iniciarConfirmacao() {
    $("#conf-sim").addEventListener("click", () => responderConfirmacao(true));
    $("#conf-nao").addEventListener("click", () => responderConfirmacao(false));
  }

  /* ---------- carimbo central ---------- */
  function carimbo(texto, tipo) {
    const el = $("#carimbo");
    el.textContent = texto;
    el.className = "carimbo";
    void el.offsetWidth;
    el.classList.add(tipo);
  }

  function escapar(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  return {
    $, $$, app, renderEscada, posicionarCursor, marcarConquista, renderPlacar, renderGrafico,
    segmentos, chave, abrirOv, fecharOv, ovAberto, confirmar, responderConfirmacao, iniciarConfirmacao,
    carimbo, escapar
  };
})();
