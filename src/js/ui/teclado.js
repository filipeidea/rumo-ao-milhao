/* Atalhos do apresentador. Cada tecla age conforme a tela e a
   sobreposição abertas no momento. */
window.RAM = window.RAM || {};

RAM.Teclado = (function () {
  const { $ } = RAM.UI;

  function digitando(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) && t.type !== "range";
  }

  function aoTeclar(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const kl = k.length === 1 ? k.toLowerCase() : k;
    const tela = RAM.Telas.atual;
    const Pt = RAM.Partida;
    const ov = RAM.UI.ovAberto();

    // em campos de texto só Esc tem atalho (Enter envia o formulário)
    if (digitando(e)) {
      if (k === "Escape") { e.target.blur(); RAM.Telas.mostrar("menu"); }
      return;
    }

    if (kl === "f") { e.preventDefault(); RAM.Telas.alternarTelaCheia(); return; }
    if (kl === "m") { RAM.Telas.alternarSom(); return; }

    /* ----- sobreposições abertas têm prioridade ----- */
    if (ov) {
      const id = ov.id;
      if (id === "ov-confirmar") {
        if (k === "Escape") { e.preventDefault(); RAM.UI.responderConfirmacao(false); }
        else if (k === "Enter") { e.preventDefault(); RAM.UI.responderConfirmacao(document.activeElement !== $("#conf-nao")); }
        return;
      }
      if (id === "ov-pausa") {
        if (kl === "p" || k === "Escape" || k === "Enter" || k === " ") { e.preventDefault(); Pt.pausar(); }
        return;
      }
      if (id === "ov-plateia") {
        if (k === "Escape" || k === "Enter" || kl === "a") { e.preventDefault(); Pt.fecharPlateia(); }
        return;
      }
      if (k === "Enter" || k === " " || k === "Escape") { e.preventDefault(); Pt.pularSobreposicao(); }
      return;
    }

    /* ----- partida ----- */
    if (tela === "jogo") {
      if (["1", "2", "3", "4"].includes(k)) { Pt.selecionar(+k - 1); return; }
      if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); Pt.moverSelecao(1); return; }
      if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); Pt.moverSelecao(-1); return; }
      if (k === "Enter") {
        e.preventDefault();
        const j = Pt.jogo;
        if (!j) return;
        if (j.estado.fase === "pergunta") Pt.confirmar();
        else if (j.estado.fase === "revelada") Pt.continuar();
        return;
      }
      if (k === "5") { Pt.usarAjuda("cinquenta"); return; }
      if (kl === "a") { Pt.usarAjuda("plateia"); return; }
      if (k === "6") { Pt.usarAjuda("pular"); return; }
      if (kl === "s") { Pt.parar(); return; }
      if (kl === "p") { Pt.pausar(); return; }
      if (kl === "r") { Pt.reiniciar(); return; }
      if (k === "Escape") { e.preventDefault(); if (Pt.ocupado) return; Pt.sair(); return; }
      return;
    }

    /* ----- demais telas ----- */
    if (k === "Escape") {
      if (tela !== "menu") { e.preventDefault(); RAM.Telas.mostrar("menu"); }
      return;
    }
    if (tela === "menu" && k === "Enter" && document.activeElement === document.body) { $("#btn-comecar").click(); return; }
    if (tela === "resultado") {
      if (kl === "r") { Pt.jogarNovamente(); return; }
      if (k === "Enter" && document.activeElement === document.body) { Pt.jogarNovamente(); return; }
    }
  }

  function iniciar() { document.addEventListener("keydown", aoTeclar); }
  return { iniciar };
})();
