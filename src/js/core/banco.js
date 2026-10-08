/* Banco de perguntas: normaliza os dados, sorteia sem repetir e embaralha alternativas. */
window.RAM = window.RAM || {};

RAM.Banco = (function () {
  const LETRAS = ["A", "B", "C", "D"];
  let perguntas = [];

  function normalizar(lista) {
    return lista.map(function (q, i) {
      const slug = (q.categoria || "geral").normalize("NFD").replace(/[^\w]/g, "").slice(0, 4).toLowerCase();
      return {
        id: q.id || (slug + "-" + q.nivel + "-" + i),
        categoria: q.categoria || "Conhecimentos gerais",
        nivel: Math.max(1, Math.min(5, q.nivel | 0 || 1)),
        pergunta: q.pergunta,
        resposta: q.resposta,
        erradas: q.erradas.slice(0, 3),
        explicacao: q.explicacao || "",
        ordenar: !!q.ordenar
      };
    }).filter(q => q.pergunta && q.resposta && q.erradas.length === 3);
  }

  function carregar(lista) {
    perguntas = normalizar(lista || RAM.PERGUNTAS || []);
    return perguntas.length;
  }

  function embaralhar(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function numeroDe(txt) {
    const m = String(txt).replace(/\./g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }

  /* Prepara a pergunta para a tela: 4 alternativas com a correta em posição sorteada. */
  function preparar(q, rng) {
    let alts = [q.resposta].concat(q.erradas);
    alts = q.ordenar ? alts.slice().sort((a, b) => numeroDe(a) - numeroDe(b)) : embaralhar(alts, rng);
    return {
      id: q.id, categoria: q.categoria, nivel: q.nivel,
      pergunta: q.pergunta, explicacao: q.explicacao,
      alternativas: alts,
      correta: alts.indexOf(q.resposta)
    };
  }

  /* Sorteia uma pergunta do nível desejado.
     usadas: ids já usados nesta partida (nunca repetem).
     vistas: ids vistos em partidas anteriores (evitados quando possível).
     ultimaCategoria: evita repetir a mesma categoria em sequência. */
  function sortear(opts) {
    const rng = opts.rng || Math.random;
    const usadas = opts.usadas || new Set();
    const vistas = opts.vistas || new Set();
    const livres = perguntas.filter(q => !usadas.has(q.id));
    if (!livres.length) return null;

    // Busca em níveis cada vez mais distantes do desejado
    const ordemNiveis = [0, -1, 1, -2, 2, -3, 3, -4, 4].map(d => opts.nivel + d).filter(n => n >= 1 && n <= 5);
    for (const filtroVistas of [true, false]) {
      for (const n of ordemNiveis) {
        let cand = livres.filter(q => q.nivel === n && (!filtroVistas || !vistas.has(q.id)));
        if (!cand.length) continue;
        const outraCat = cand.filter(q => q.categoria !== opts.ultimaCategoria);
        if (outraCat.length) cand = outraCat;
        return preparar(cand[Math.floor(rng() * cand.length)], rng);
      }
    }
    return null;
  }

  function total() { return perguntas.length; }
  function todas() { return perguntas.slice(); }

  carregar();
  return { carregar, sortear, preparar, total, todas, LETRAS };
})();
