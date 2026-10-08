# Rumo ao Milhão

Jogo de perguntas e respostas no estilo dos grandes programas de auditório da TV, feito para rodar no navegador de um computador ligado à televisão.

## Como abrir

- **Online:** https://filipeidea.github.io/rumo-ao-milhao/ (publicado automaticamente a cada push na `main`).
- **Jeito mais simples:** abra `dist/rumo-ao-milhao.html` em qualquer navegador (Chrome, Edge, Firefox). É um arquivo único, funciona até sem internet (só a fonte do título precisa de internet; sem ela, o jogo usa uma fonte do sistema).
- **Versão de desenvolvimento:** abra `src/index.html` direto, ou rode `npm start` e acesse http://localhost:8080. Não precisa instalar dependências.
- Na TV: aperte **F** para tela cheia.

## Atalhos do apresentador

| Tecla | Ação |
|---|---|
| 1 2 3 4 | Selecionar alternativa (setas também funcionam) |
| Enter | Confirmar resposta / continuar |
| Esc | Voltar |
| 5 | 50/50 |
| A | Ajuda da plateia |
| 6 | Pular pergunta |
| S | Parar e levar o prêmio |
| P | Pausar |
| R | Reiniciar partida |
| F | Tela cheia |
| M | Ligar/desligar som |

## Regras

- Escada de 16 perguntas, de R$ 1.000 a R$ 1.000.000 (valores fictícios). Nas configurações dá para jogar com 5, 8, 10 ou 12 perguntas; a escada é redistribuída e sempre termina no milhão.
- **Parar:** leva o valor acumulado.
- **Errar:** leva metade do acumulado. Na pergunta final, quem erra sai sem nada.
- **Ajudas** (uma vez cada, por jogador): 50/50, plateia e pular.
- **Modo grupo:** 2 a 8 participantes, cada um com sua própria escada. A vez passa a cada pergunta; quem erra ou para sai da disputa. Vence o maior prêmio.

## Como adicionar perguntas

Edite `src/js/data/perguntas.js` e acrescente uma linha:

```js
{ categoria: "Geografia", nivel: 3, pergunta: "Qual é a capital do Canadá?",
  resposta: "Ottawa", erradas: ["Toronto", "Montreal", "Vancouver"],
  explicacao: "Texto opcional mostrado depois da resposta." },
```

- `nivel` vai de 1 (fácil) a 5 (muito difícil).
- A posição da resposta correta é sorteada a cada partida.
- Use `ordenar: true` quando as alternativas forem números, para aparecerem em ordem crescente.
- Depois de editar, rode `npm run build` para atualizar o arquivo único em `dist/`.

O banco tem 376 perguntas em 14 categorias. O jogo não repete perguntas na mesma partida e evita as já vistas em partidas anteriores (dá para zerar esse histórico em Configurações → Banco de perguntas).

## Estrutura

```
rumo-ao-milhao/
├── src/                        código-fonte do jogo
│   ├── index.html              marcação das telas
│   ├── css/
│   │   ├── base.css            cores, tipografia, botões
│   │   ├── palco.css           fundo de palco animado
│   │   ├── telas.css           menu, escada de prêmios, configurações, resultado
│   │   ├── jogo.css            tela da pergunta, alternativas, ajudas
│   │   ├── sobreposicoes.css   plateia, vez do jogador, vitória, pausa
│   │   └── responsivo.css      celular e tablet em pé
│   └── js/
│       ├── data/perguntas.js   banco de perguntas (só dados)
│       ├── core/               regras, sem nenhuma dependência de tela
│       │   ├── config.js         escada de prêmios e opções
│       │   ├── configuracoes.js  preferências salvas no navegador
│       │   ├── pontuacao.js      valores, dificuldade progressiva, tensão
│       │   ├── banco.js          sorteio sem repetição, embaralhamento
│       │   ├── ajudas.js         50/50 e simulação da plateia
│       │   └── jogo.js           estado e regras da partida
│       ├── audio/audio.js      músicas e efeitos sintetizados (Web Audio)
│       ├── ui/                 interface
│       │   ├── animacoes.js      partículas, confete, contadores
│       │   ├── componentes.js    escada, placar, gráfico, diálogos
│       │   ├── telas.js          navegação e telas fora da partida
│       │   ├── partida.js        condução da partida na tela
│       │   └── teclado.js        atalhos do apresentador
│       └── main.js             inicialização
├── dist/rumo-ao-milhao.html    arquivo único gerado pelo build (para a TV)
├── scripts/build.py            gera dist/ a partir de src/
├── testes/
│   ├── teste-logica.js         regras, pontuação, ajudas, sorteio (Node)
│   └── teste-navegador.py      partidas completas num Chromium (Playwright)
├── .github/workflows/testes.yml    roda os testes a cada push
├── .github/workflows/publicar.yml  publica o jogo no GitHub Pages
└── package.json                atalhos: start, build, test, test:e2e
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Serve `src/` em http://localhost:8080 |
| `npm run build` | Gera `dist/rumo-ao-milhao.html` |
| `npm test` | Testes da lógica (Node, sem dependências) |
| `npm run test:e2e` | Testes no navegador (requer `pip install playwright` e `python -m playwright install chromium`) |

A camada `core/` não acessa a tela; a interface (`ui/`) só chama seus métodos e decide quando animar. Isso permite testar todas as regras no Node.

Todos os sons são gerados pelo próprio código; não há músicas ou arquivos de áudio de terceiros.
