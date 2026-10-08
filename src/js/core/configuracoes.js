/* Configurações do usuário, salvas no navegador quando possível. */
window.RAM = window.RAM || {};

RAM.Configuracoes = (function () {
  const CHAVE = RAM.CONFIG.CHAVE_ARMAZENAMENTO;
  let dados = {};
  const ouvintes = [];

  function lerArmazenamento() {
    try {
      const bruto = window.localStorage && window.localStorage.getItem(CHAVE);
      return bruto ? JSON.parse(bruto) : {};
    } catch (e) { return {}; }
  }

  function gravarArmazenamento(obj) {
    try { window.localStorage && window.localStorage.setItem(CHAVE, JSON.stringify(obj)); } catch (e) { /* sem armazenamento: segue em memória */ }
  }

  function carregar() {
    const salvo = lerArmazenamento();
    dados = Object.assign({}, RAM.CONFIG.PADROES, salvo.config || {});
    if (!RAM.CONFIG.OPCOES_QUANTIDADE.includes(dados.quantidade)) dados.quantidade = 16;
    if (!RAM.CONFIG.DIFICULDADES.some(d => d.id === dados.dificuldade)) dados.dificuldade = "normal";
    if (!Array.isArray(dados.jogadores)) dados.jogadores = ["", ""];
    dados.volume = Math.min(1, Math.max(0, Number(dados.volume) || 0));
    return dados;
  }

  function salvar() {
    const salvo = lerArmazenamento();
    salvo.config = dados;
    gravarArmazenamento(salvo);
  }

  function get(chave) { return dados[chave]; }

  function set(chave, valor) {
    dados[chave] = valor;
    salvar();
    ouvintes.forEach(fn => fn(chave, valor));
  }

  function aoMudar(fn) { ouvintes.push(fn); }

  /* Histórico de perguntas já vistas (entre partidas) */
  function historico() {
    const salvo = lerArmazenamento();
    return Array.isArray(salvo.vistas) ? salvo.vistas : [];
  }
  function gravarHistorico(ids) {
    const salvo = lerArmazenamento();
    salvo.vistas = ids;
    gravarArmazenamento(salvo);
  }

  carregar();
  return { carregar, get, set, aoMudar, todos: () => Object.assign({}, dados), historico, gravarHistorico };
})();
