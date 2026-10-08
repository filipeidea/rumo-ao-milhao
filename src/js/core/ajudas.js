/* Ajudas: 50/50, plateia e pular. Funções puras, sem tela. */
window.RAM = window.RAM || {};

RAM.Ajudas = (function () {
  const TIPOS = {
    cinquenta: { nome: "50/50", tecla: "5" },
    plateia: { nome: "Plateia", tecla: "A" },
    pular: { nome: "Pular", tecla: "6" }
  };

  function novoEstado() { return { cinquenta: true, plateia: true, pular: true }; }

  /* Retorna os índices de duas alternativas erradas a eliminar. */
  function cinquenta(pergunta, rng) {
    rng = rng || Math.random;
    const erradas = [0, 1, 2, 3].filter(i => i !== pergunta.correta);
    const fica = erradas[Math.floor(rng() * erradas.length)];
    return erradas.filter(i => i !== fica);
  }

  /* Simula a votação da plateia. Respeita alternativas eliminadas.
     A correta tende a vencer, com mais confiança nas perguntas fáceis;
     nas difíceis a plateia fica dividida e às vezes erra. */
  function plateia(pergunta, eliminadas, rng) {
    rng = rng || Math.random;
    eliminadas = eliminadas || [];
    const ativas = [0, 1, 2, 3].filter(i => !eliminadas.includes(i));
    const nivel = pergunta.nivel || 3;

    // confiança base na correta, por nível de dificuldade
    const faixa = { 1: [62, 82], 2: [52, 72], 3: [42, 62], 4: [34, 52], 5: [28, 46] }[nivel];
    let pctCorreta = faixa[0] + rng() * (faixa[1] - faixa[0]);
    if (ativas.length === 2) pctCorreta = Math.min(90, pctCorreta + 14);

    const pesos = {};
    ativas.forEach(i => { pesos[i] = i === pergunta.correta ? 0 : 0.3 + rng(); });

    // Em perguntas difíceis, uma alternativa errada pode "enganar" a plateia
    const erradasAtivas = ativas.filter(i => i !== pergunta.correta);
    const chanceEngano = { 1: 0, 2: 0.03, 3: 0.08, 4: 0.15, 5: 0.22 }[nivel];
    if (erradasAtivas.length && rng() < chanceEngano) {
      const isca = erradasAtivas[Math.floor(rng() * erradasAtivas.length)];
      pesos[isca] += 2.5;
      pctCorreta = Math.max(24, pctCorreta - 12);
    }

    const resto = 100 - pctCorreta;
    const somaPesos = erradasAtivas.reduce((s, i) => s + pesos[i], 0) || 1;
    const bruto = [0, 0, 0, 0];
    bruto[pergunta.correta] = pctCorreta;
    erradasAtivas.forEach(i => { bruto[i] = resto * pesos[i] / somaPesos; });

    // Arredonda mantendo soma 100 (maior resto)
    const inteiros = bruto.map(Math.floor);
    let falta = 100 - inteiros.reduce((a, b) => a + b, 0);
    const ordem = ativas.slice().sort((a, b) => (bruto[b] - inteiros[b]) - (bruto[a] - inteiros[a]));
    for (let k = 0; falta > 0; k++, falta--) inteiros[ordem[k % ordem.length]]++;
    eliminadas.forEach(i => { inteiros[i] = 0; });
    return inteiros;
  }

  return { TIPOS, novoEstado, cinquenta, plateia };
})();
