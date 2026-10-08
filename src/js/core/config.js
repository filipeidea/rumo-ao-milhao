/* Configuração fixa do jogo: escada de prêmios, opções e padrões. */
window.RAM = window.RAM || {};

RAM.CONFIG = {
  /* Escada completa de 16 degraus. Para partidas mais curtas, o jogo
     escolhe degraus espalhados desta lista, sempre terminando no milhão. */
  ESCADA: [
    1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000,
    75000, 100000, 150000, 200000, 300000, 400000, 500000, 1000000
  ],

  /* Opções disponíveis na tela de configurações */
  OPCOES_QUANTIDADE: [5, 8, 10, 12, 16],
  DIFICULDADES: [
    { id: "facil", nome: "Fácil", deslocamento: -1 },
    { id: "normal", nome: "Normal", deslocamento: 0 },
    { id: "dificil", nome: "Difícil", deslocamento: 1 }
  ],

  /* Errar a pergunta: o jogador leva esta fração do valor acumulado.
     Na pergunta final, quem erra sai sem nada (regra clássica). */
  FRACAO_AO_ERRAR: 0.5,

  MAX_JOGADORES: 8,

  PADROES: {
    volume: 0.8,
    efeitos: true,
    musica: true,
    quantidade: 16,
    dificuldade: "normal",
    modo: "individual",
    jogadores: ["", ""]
  },

  CHAVE_ARMAZENAMENTO: "rumo-ao-milhao:v1"
};
