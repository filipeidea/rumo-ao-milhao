/* Sistema de pontuação: monta a escada de prêmios e calcula valores. */
window.RAM = window.RAM || {};

RAM.Pontuacao = (function () {
  const ESCADA = RAM.CONFIG.ESCADA;

  /* Escolhe n degraus distribuídos pela escada completa, terminando no milhão. */
  function montarEscada(n) {
    n = Math.max(2, Math.min(ESCADA.length, n | 0));
    if (n === ESCADA.length) return ESCADA.slice();
    const res = [];
    for (let i = 0; i < n; i++) {
      res.push(ESCADA[Math.round(i * (ESCADA.length - 1) / (n - 1))]);
    }
    return res;
  }

  /* nivel = índice da pergunta atual (0 = primeira).
     acumulado = valor já garantido antes de responder a pergunta atual. */
  function valores(escada, nivel) {
    const acumulado = nivel > 0 ? escada[nivel - 1] : 0;
    const valendo = escada[nivel];
    const ultima = nivel === escada.length - 1;
    const errar = ultima ? 0 : arredondar(acumulado * RAM.CONFIG.FRACAO_AO_ERRAR);
    return { parar: acumulado, acertar: valendo, errar, ultima };
  }

  function arredondar(v) { return Math.floor(v / 100) * 100; }

  /* Dificuldade (1–5) da pergunta de índice "nivel" numa escada de "total". */
  function dificuldadeDo(nivel, total, deslocamento) {
    const frac = total <= 1 ? 1 : nivel / (total - 1);
    let d;
    if (frac < 0.19) d = 1;
    else if (frac < 0.38) d = 2;
    else if (frac < 0.63) d = 3;
    else if (frac < 0.88) d = 4;
    else d = 5;
    return Math.max(1, Math.min(5, d + (deslocamento || 0)));
  }

  /* Intensidade dramática 0–3, usada pelo visual e pelo áudio. */
  function tensao(nivel, total) {
    const frac = total <= 1 ? 1 : nivel / (total - 1);
    if (nivel === total - 1) return 3;
    if (frac >= 0.75) return 2;
    if (frac >= 0.5) return 1;
    return 0;
  }

  function formatar(v) {
    return "R$ " + Math.round(v).toLocaleString("pt-BR").replace(/,/g, ".");
  }

  function formatarCurto(v) {
    if (v >= 1000000) return "R$ " + (v / 1000000).toLocaleString("pt-BR") + " MILHÃO";
    if (v >= 1000) return "R$ " + (v / 1000).toLocaleString("pt-BR") + " MIL";
    return formatar(v);
  }

  return { montarEscada, valores, dificuldadeDo, tensao, formatar, formatarCurto };
})();
