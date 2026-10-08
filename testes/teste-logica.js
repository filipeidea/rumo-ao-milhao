/* Testes da lógica do jogo. Rode com:  npm test  (ou node testes/teste-logica.js) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const raiz = path.join(__dirname, "..", "src");
const mem = {};
const ctx = { console, localStorage: { getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = String(v); } } };
ctx.window = ctx;
vm.createContext(ctx);
["js/data/perguntas.js", "js/core/config.js", "js/core/configuracoes.js", "js/core/pontuacao.js",
 "js/core/banco.js", "js/core/ajudas.js", "js/core/jogo.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(raiz, f), "utf8"), ctx, { filename: f }));
const { RAM } = ctx;

let falhas = 0, ok = 0;
function check(cond, msg) { if (cond) ok++; else { falhas++; console.log("  ✗ " + msg); } }
function rngSeed(s) { return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

console.log("Banco de perguntas");
const todas = RAM.Banco.todas();
check(todas.length >= 100, "pelo menos 100 perguntas (" + todas.length + ")");
check(new Set(todas.map(q => q.id)).size === todas.length, "ids únicos");
check(new Set(todas.map(q => q.pergunta)).size === todas.length, "enunciados únicos");
todas.forEach(q => check(new Set([q.resposta, ...q.erradas]).size === 4, "alternativas distintas: " + q.pergunta));
for (let n = 1; n <= 5; n++) check(todas.filter(q => q.nivel === n).length >= 20, "nível " + n + " tem 20+ perguntas");
check(RAM.CATEGORIAS.every(c => todas.some(q => q.categoria === c)), "todas as categorias têm perguntas");
check(todas.every(q => RAM.CATEGORIAS.includes(q.categoria)), "nenhuma categoria fora da lista");

console.log("Preparação e sorteio");
for (let k = 0; k < 300; k++) {
  const q = RAM.Banco.sortear({ nivel: 1 + (k % 5), rng: rngSeed(k + 1) });
  check(q.alternativas.length === 4 && q.alternativas[q.correta] === todas.find(t => t.id === q.id).resposta, "correta aponta para a resposta");
}
const pos = [0, 0, 0, 0];
for (let k = 0; k < 2000; k++) pos[RAM.Banco.sortear({ nivel: 3, rng: rngSeed(k * 7 + 3) }).correta]++;
check(pos.every(c => c > 250), "posição da correta varia entre A–D " + JSON.stringify(pos));

console.log("Pontuação");
const P = RAM.Pontuacao;
check(P.montarEscada(16).join() === RAM.CONFIG.ESCADA.join(), "escada de 16");
[5, 8, 10, 12].forEach(n => {
  const e = P.montarEscada(n);
  check(e.length === n && e[n - 1] === 1000000 && e[0] === 1000 && e.every((v, i) => !i || v > e[i - 1]), "escada de " + n + " crescente até o milhão: " + e.join(","));
});
check(P.valores(P.montarEscada(16), 0).parar === 0, "parar na 1ª = 0");
check(P.valores(P.montarEscada(16), 5).errar === 5000, "errar na 6ª = metade de 10.000");
check(P.valores(P.montarEscada(16), 15).errar === 0, "errar no milhão = 0");
check(P.formatar(1000000) === "R$ 1.000.000", "formatação " + P.formatar(1000000));
const difs = []; for (let i = 0; i < 16; i++) difs.push(P.dificuldadeDo(i, 16, 0));
check(difs.every((d, i) => !i || d >= difs[i - 1]) && difs[0] === 1 && difs[15] === 5, "dificuldade progressiva " + difs.join(""));

console.log("Ajudas");
for (let k = 0; k < 500; k++) {
  const r = rngSeed(k + 11);
  const q = RAM.Banco.sortear({ nivel: 1 + (k % 5), rng: r });
  const el = RAM.Ajudas.cinquenta(q, r);
  check(el.length === 2 && !el.includes(q.correta) && el[0] !== el[1], "50/50 remove duas erradas");
  const v = RAM.Ajudas.plateia(q, k % 2 ? el : [], r);
  check(v.reduce((a, b) => a + b, 0) === 100, "plateia soma 100: " + v);
  if (k % 2) check(el.every(i => v[i] === 0), "plateia zera eliminadas");
}
let correctTop = 0;
for (let k = 0; k < 1000; k++) { const r = rngSeed(k + 99); const q = RAM.Banco.sortear({ nivel: 1, rng: r }); const v = RAM.Ajudas.plateia(q, [], r); if (v.indexOf(Math.max(...v)) === q.correta) correctTop++; }
check(correctTop > 950, "plateia acerta nas fáceis (" + correctTop + "/1000)");
let hardTop = 0;
for (let k = 0; k < 1000; k++) { const r = rngSeed(k + 5); const q = RAM.Banco.sortear({ nivel: 5, rng: r }); const v = RAM.Ajudas.plateia(q, [], r); if (v.indexOf(Math.max(...v)) === q.correta) hardTop++; }
check(hardTop > 600 && hardTop < 990, "plateia hesita nas difíceis (" + hardTop + "/1000)");

console.log("Partida individual — vitória");
{
  const j = RAM.Jogo.criar({ quantidade: 16, rng: rngSeed(42) });
  const ids = new Set();
  for (let i = 0; i < 16; i++) {
    const q = j.estado.pergunta; check(!ids.has(q.id), "sem repetição"); ids.add(q.id);
    check(j.selecionar(q.correta) && j.travar(), "seleciona e trava");
    const r = j.revelar();
    check(r.acertou, "acertou");
    if (i === 15) check(r.venceu && r.premio === 1000000, "venceu o milhão");
    const a = j.avancar();
    if (i < 15) check(!a.fim && a.subiu && j.jogadorAtual().nivel === i + 1, "subiu para " + (i + 1)); else check(a.fim && j.estado.fase === "fim", "fim após o milhão");
  }
  const res = j.resultados()[0];
  check(res.acertos === 16 && res.percentual === 100 && res.maiorValor === 1000000, "resultado final");
}

console.log("Partida individual — derrota e parar");
{
  const j = RAM.Jogo.criar({ quantidade: 16, rng: rngSeed(7) });
  for (let i = 0; i < 6; i++) { j.selecionar(j.estado.pergunta.correta); j.travar(); j.revelar(); j.avancar(); }
  const q = j.estado.pergunta;
  const errada = [0, 1, 2, 3].find(i => i !== q.correta);
  check(!j.revelar(), "não revela sem travar");
  j.selecionar(errada); j.travar();
  const r = j.revelar();
  check(!r.acertou && r.correta === q.correta && r.premio === 10000, "errou na 7ª leva metade de 20.000: " + r.premio);
  check(j.avancar().fim, "fim após erro");
  const res = j.resultados()[0];
  check(res.respondidas === 7 && res.erros === 1 && res.maiorValor === 20000, "estatísticas após erro");

  const j2 = RAM.Jogo.criar({ quantidade: 16, rng: rngSeed(8) });
  for (let i = 0; i < 4; i++) { j2.selecionar(j2.estado.pergunta.correta); j2.travar(); j2.revelar(); j2.avancar(); }
  const rp = j2.parar();
  check(rp.parou && rp.premio === 5000, "parar leva o acumulado (5.000)");
  check(j2.avancar().fim, "fim após parar");
}

console.log("Ajudas na partida");
{
  const j = RAM.Jogo.criar({ quantidade: 16, rng: rngSeed(3) });
  const q1 = j.estado.pergunta;
  const el = j.usarCinquenta();
  check(el && el.length === 2, "usa 50/50");
  check(j.usarCinquenta() === null, "50/50 só uma vez");
  check(!j.selecionar(el[0]), "não seleciona eliminada");
  const v = j.usarPlateia();
  check(v && v[el[0]] === 0 && v[el[1]] === 0, "plateia respeita 50/50");
  check(j.usarPlateia() === null, "plateia só uma vez");
  const q2 = j.usarPular();
  check(q2 && q2.id !== q1.id && j.estado.eliminadas.length === 0 && j.estado.votos === null, "pular troca a pergunta e limpa ajudas visuais");
  check(j.usarPular() === null, "pular só uma vez");
  for (let i = 0; i < 15; i++) { j.selecionar(j.estado.pergunta.correta); j.travar(); j.revelar(); j.avancar(); check(j.estado.pergunta && j.estado.pergunta.id !== q1.id, "pergunta pulada não volta"); }
}

console.log("Modo grupo");
{
  const j = RAM.Jogo.criar({ modo: "grupo", nomes: ["Felipe", "João", "Ana"], quantidade: 8, rng: rngSeed(19) });
  const ordem = [];
  const vistos = new Set();
  let guard = 0;
  while (j.estado.fase !== "fim" && guard++ < 200) {
    const jog = j.jogadorAtual(); ordem.push(jog.nome);
    const q = j.estado.pergunta; check(!vistos.has(q.id), "grupo sem repetição"); vistos.add(q.id);
    if (jog.nome === "João" && jog.nivel === 2) j.parar();
    else {
      const resp = (jog.nome === "Ana" && jog.nivel === 4) ? (q.correta + 1) % 4 : q.correta;
      j.selecionar(resp); j.travar(); j.revelar();
    }
    j.avancar();
  }
  check(ordem.slice(0, 6).join() === "Felipe,João,Ana,Felipe,João,Ana", "alterna jogadores: " + ordem.slice(0, 6).join());
  const r = j.resultados();
  const por = Object.fromEntries(r.map(x => [x.nome, x]));
  check(por.Felipe.status === "venceu" && por.Felipe.premio === 1000000, "Felipe venceu");
  check(por["João"].status === "parou" && por["João"].premio === j.escada[1], "João parou com " + por["João"].premio);
  check(por.Ana.status === "errou" && por.Ana.premio === Math.floor(j.escada[3] / 2 / 100) * 100, "Ana errou e levou metade: " + por.Ana.premio);
  check(r[0].nome === "Felipe", "ranking ordenado por prêmio");
}

console.log("Esgotamento do banco");
{
  const vistas = RAM.Banco.todas().map(q => q.id);
  const j = RAM.Jogo.criar({ quantidade: 16, rng: rngSeed(5), vistas });
  check(!!j.estado.pergunta, "com histórico cheio ainda sorteia (reaproveita vistas)");
  const nomes = Array.from({ length: 8 }, (_, i) => "J" + i);
  const g = RAM.Jogo.criar({ modo: "grupo", nomes, quantidade: 16, rng: rngSeed(6) });
  let guard = 0;
  while (g.estado.fase !== "fim" && guard++ < 500) { g.usarPular(); g.selecionar(g.estado.pergunta.correta); g.travar(); g.revelar(); g.avancar(); }
  check(g.estado.fase === "fim", "partida termina mesmo se o banco acabar (" + guard + " rodadas)");
}

console.log("\n" + ok + " verificações OK, " + falhas + " falhas");
process.exit(falhas ? 1 : 0);
