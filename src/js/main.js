/* Ponto de entrada: liga configurações ao áudio e inicia a interface. */
(function () {
  const C = RAM.Configuracoes, A = RAM.Audio;

  function aplicarAudio() {
    A.configurar({ volume: C.get("volume"), efeitos: C.get("efeitos"), musica: C.get("musica") });
  }
  C.aoMudar(function (chave) {
    if (chave === "volume" || chave === "efeitos" || chave === "musica") aplicarAudio();
  });

  // O navegador só libera som depois do primeiro toque ou tecla
  function destravarAudio() {
    if (A.iniciar()) {
      aplicarAudio();
      if (RAM.Telas.atual !== "jogo") A.tocarMusica("abertura");
      window.removeEventListener("pointerdown", destravarAudio, true);
      window.removeEventListener("keydown", destravarAudio, true);
    }
  }
  window.addEventListener("pointerdown", destravarAudio, true);
  window.addEventListener("keydown", destravarAudio, true);

  RAM.FX.iniciarFundo(document.getElementById("fx-fundo"));
  RAM.FX.iniciarFrente(document.getElementById("fx-frente"));
  RAM.UI.iniciarConfirmacao();
  RAM.Telas.iniciar();
  RAM.Partida.iniciarEventos();
  RAM.Teclado.iniciar();
  aplicarAudio();
  RAM.Telas.mostrar("menu");
})();
