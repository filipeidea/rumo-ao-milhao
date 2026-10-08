/* Lógica do jogo (sem tela). A interface só chama estes métodos
   e decide quando animar; nenhuma regra fica na interface. */
window.RAM = window.RAM || {};

RAM.Jogo = (function () {
  const P = RAM.Pontuacao, B = RAM.Banco, AJ = RAM.Ajudas;

  function criar(opcoes) {
    const rng = opcoes.rng || Math.random;
    const escada = P.montarEscada(opcoes.quantidade || 16);
    const deslocamento = opcoes.deslocamento || 0;
    const vistas = new Set(opcoes.vistas || []);
    const usadas = new Set();
    const nomes = (opcoes.nomes && opcoes.nomes.length) ? opcoes.nomes : ["Você"];

    const jogadores = nomes.map(nome => ({
      nome,
      nivel: 0,
      ajudas: AJ.novoEstado(),
      status: "jogando",          // jogando | parou | errou | venceu
      premio: 0,
      maiorValor: 0,
      acertos: 0,
      erros: 0,
      historico: []               // { pergunta, categoria, acertou, valor }
    }));

    const st = {
      modo: opcoes.modo || "individual",
      escada, jogadores,
      vez: 0,
      pergunta: null,
      eliminadas: [],
      votos: null,
      selecionada: null,
      fase: "pergunta",           // pergunta | travada | revelada | fim
      ultimoResultado: null,
      ultimaCategoria: null,
      semPerguntas: false
    };

    function jogadorAtual() { return jogadores[st.vez]; }

    function sortearPara(j) {
      const q = B.sortear({
        nivel: P.dificuldadeDo(j.nivel, escada.length, deslocamento),
        usadas, vistas, ultimaCategoria: st.ultimaCategoria, rng
      });
      if (!q) { st.semPerguntas = true; return null; }
      usadas.add(q.id);
      st.ultimaCategoria = q.categoria;
      return q;
    }

    function novaPergunta() {
      const j = jogadorAtual();
      st.pergunta = sortearPara(j);
      st.eliminadas = [];
      st.votos = null;
      st.selecionada = null;
      st.ultimoResultado = null;
      if (!st.pergunta) { encerrarPorFaltaDePerguntas(); return null; }
      st.fase = "pergunta";
      return st.pergunta;
    }

    function encerrarPorFaltaDePerguntas() {
      jogadores.forEach(j => {
        if (j.status === "jogando") { j.status = "parou"; j.premio = P.valores(escada, j.nivel).parar; }
      });
      st.fase = "fim";
    }

    function valoresAtuais() { return P.valores(escada, jogadorAtual().nivel); }

    function selecionar(i) {
      if (st.fase !== "pergunta" || !st.pergunta) return false;
      if (i < 0 || i > 3 || st.eliminadas.includes(i)) return false;
      st.selecionada = i;
      return true;
    }

    /* Trava a resposta escolhida. A interface faz o suspense e só depois chama revelar(). */
    function travar() {
      if (st.fase !== "pergunta" || st.selecionada === null) return false;
      st.fase = "travada";
      return true;
    }

    function revelar() {
      if (st.fase !== "travada") return null;
      const j = jogadorAtual();
      const v = valoresAtuais();
      const acertou = st.selecionada === st.pergunta.correta;
      j.historico.push({ pergunta: st.pergunta.pergunta, categoria: st.pergunta.categoria, acertou, valor: v.acertar });
      vistas.add(st.pergunta.id);
      let venceu = false;
      if (acertou) {
        j.acertos++;
        j.maiorValor = Math.max(j.maiorValor, v.acertar);
        j.premio = v.acertar;
        if (v.ultima) { j.status = "venceu"; venceu = true; }
      } else {
        j.erros++;
        j.maiorValor = Math.max(j.maiorValor, v.parar);
        j.premio = v.errar;
        j.status = "errou";
      }
      st.fase = "revelada";
      st.ultimoResultado = {
        acertou, venceu,
        selecionada: st.selecionada,
        correta: st.pergunta.correta,
        premio: j.premio,
        valores: v,
        nivelRespondido: j.nivel
      };
      return st.ultimoResultado;
    }

    function parar() {
      if (st.fase !== "pergunta") return null;
      const j = jogadorAtual();
      const v = valoresAtuais();
      j.status = "parou";
      j.premio = v.parar;
      j.maiorValor = Math.max(j.maiorValor, v.parar);
      st.fase = "revelada";
      st.ultimoResultado = { parou: true, acertou: false, venceu: false, correta: st.pergunta.correta, selecionada: null, premio: j.premio, valores: v, nivelRespondido: j.nivel };
      return st.ultimoResultado;
    }

    function usarCinquenta() {
      const j = jogadorAtual();
      if (st.fase !== "pergunta" || !j.ajudas.cinquenta) return null;
      j.ajudas.cinquenta = false;
      st.eliminadas = AJ.cinquenta(st.pergunta, rng);
      if (st.eliminadas.includes(st.selecionada)) st.selecionada = null;
      if (st.votos) st.votos = AJ.plateia(st.pergunta, st.eliminadas, rng);
      return st.eliminadas.slice();
    }

    function usarPlateia() {
      const j = jogadorAtual();
      if (st.fase !== "pergunta" || !j.ajudas.plateia) return null;
      j.ajudas.plateia = false;
      st.votos = AJ.plateia(st.pergunta, st.eliminadas, rng);
      return st.votos.slice();
    }

    function usarPular() {
      const j = jogadorAtual();
      if (st.fase !== "pergunta" || !j.ajudas.pular) return null;
      const nova = sortearPara(j);
      if (!nova) { st.semPerguntas = false; return null; } // sem reserva: mantém a atual e a ajuda
      j.ajudas.pular = false;
      st.pergunta = nova;
      st.eliminadas = [];
      st.votos = null;
      st.selecionada = null;
      return nova;
    }

    /* Depois da revelação: sobe de nível ou passa a vez.
       Retorna { fim, trocouJogador, subiu }. */
    function avancar() {
      if (st.fase !== "revelada") return null;
      const j = jogadorAtual();
      let subiu = false;
      if (j.status === "jogando" && st.ultimoResultado && st.ultimoResultado.acertou) { j.nivel++; subiu = true; }

      const anterior = st.vez;
      const ativos = jogadores.map((x, i) => i).filter(i => jogadores[i].status === "jogando");
      if (!ativos.length) { st.fase = "fim"; return { fim: true, trocouJogador: false, subiu }; }

      // próximo jogador ativo depois do atual (no individual é sempre o mesmo)
      let prox = ativos.find(i => i > anterior);
      if (prox === undefined) prox = ativos[0];
      st.vez = prox;
      if (!novaPergunta()) return { fim: true, trocouJogador: false, subiu };
      return { fim: false, trocouJogador: prox !== anterior, subiu };
    }

    function resultados() {
      return jogadores.map(j => {
        const respondidas = j.acertos + j.erros;
        return {
          nome: j.nome, status: j.status, premio: j.premio, maiorValor: j.maiorValor,
          acertos: j.acertos, erros: j.erros, respondidas,
          percentual: respondidas ? Math.round(100 * j.acertos / respondidas) : 0,
          historico: j.historico.slice()
        };
      }).sort((a, b) => b.premio - a.premio || b.acertos - a.acertos);
    }

    function idsVistos() { return Array.from(vistas); }

    novaPergunta();

    return {
      estado: st, escada, jogadorAtual, valoresAtuais,
      selecionar, travar, revelar, parar,
      usarCinquenta, usarPlateia, usarPular,
      avancar, resultados, idsVistos, novaPergunta
    };
  }

  return { criar };
})();
