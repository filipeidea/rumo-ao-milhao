"""Teste de ponta a ponta no navegador (Chromium headless).
    python3 testes/teste-navegador.py  [pasta-de-capturas]
Joga partidas reais pela interface: vitória, derrota, parar, ajudas, grupo e celular."""
import sys, pathlib
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
URL = (RAIZ / "src" / "index.html").as_uri()
SAIDA = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "testes" / "capturas"
SAIDA.mkdir(parents=True, exist_ok=True)
falhas = []
def check(c, msg):
    print(("  ok  " if c else "  ERRO ") + msg)
    if not c: falhas.append(msg)

ACELERAR = "RAM.FX.esperar = ms => new Promise(r => setTimeout(r, Math.min(ms, 400) / 4));"

def estado(p, js): return p.evaluate(js)

def responder_certo(p):
    c = estado(p, "RAM.Partida.jogo.estado.pergunta.correta")
    p.keyboard.press(str(c + 1)); p.keyboard.press("Enter")
    p.wait_for_function("RAM.Partida.jogo.estado.fase !== 'travada' && !RAM.Partida.ocupado", timeout=8000)

def continuar(p):
    p.keyboard.press("Enter")
    p.wait_for_function("RAM.Partida.jogo.estado.fase !== 'revelada' && !RAM.Partida.ocupado", timeout=8000)
    p.wait_for_timeout(120)

with sync_playwright() as pw:
    nav = pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    p = nav.new_page(viewport={"width": 1920, "height": 1080})
    erros = []
    p.on("pageerror", lambda e: erros.append(str(e)))
    p.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and erros.append(m.text))
    p.goto(URL); p.wait_for_timeout(1800)
    p.screenshot(path=str(SAIDA / "01-menu-1080p.png"))
    check(p.locator("#escada-menu .degrau").count() == 16, "menu mostra escada de 16")

    # ---------- partida individual até o milhão ----------
    p.click("#btn-comecar"); p.wait_for_timeout(900)
    p.evaluate(ACELERAR)
    check(estado(p, "RAM.Telas.atual") == "jogo", "COMEÇAR abre a partida")
    p.wait_for_timeout(700)
    p.screenshot(path=str(SAIDA / "02-pergunta.png"))
    c = estado(p, "RAM.Partida.jogo.estado.pergunta.correta")
    p.keyboard.press(str(c + 1)); p.wait_for_timeout(300)
    p.screenshot(path=str(SAIDA / "03-selecionada.png"))
    check(p.locator(".alt.selecionada").count() == 1, "tecla seleciona alternativa")
    p.keyboard.press("Enter")
    p.wait_for_function("RAM.Partida.jogo.estado.fase === 'revelada' && !RAM.Partida.ocupado", timeout=8000)
    p.wait_for_timeout(250)
    p.screenshot(path=str(SAIDA / "04-certa.png"))
    check(p.locator(".alt.certa").count() == 1, "resposta certa destacada")
    continuar(p)
    check(estado(p, "RAM.Partida.jogo.jogadorAtual().nivel") == 1, "avançou para a pergunta 2")

    # ajudas
    p.keyboard.press("5"); p.wait_for_timeout(500)
    check(p.locator(".alt.eliminada").count() == 2, "50/50 elimina duas")
    p.keyboard.press("a"); p.wait_for_timeout(1900)
    p.screenshot(path=str(SAIDA / "05-plateia.png"))
    check(estado(p, "!document.getElementById('ov-plateia').hidden"), "plateia abre gráfico")
    p.keyboard.press("Enter"); p.wait_for_timeout(400)
    check(estado(p, "document.getElementById('ov-plateia').hidden"), "Enter fecha plateia")
    p.screenshot(path=str(SAIDA / "06-ajudas-usadas.png"))
    q_antes = estado(p, "RAM.Partida.jogo.estado.pergunta.id")
    p.keyboard.press("6"); p.wait_for_timeout(700)
    check(estado(p, "RAM.Partida.jogo.estado.pergunta.id") != q_antes, "pular troca a pergunta")
    check(p.locator(".ajuda.usada").count() == 3, "três ajudas marcadas como usadas")
    p.keyboard.press("5"); p.wait_for_timeout(200)
    check(p.locator(".alt.eliminada").count() == 0, "50/50 não funciona duas vezes")

    # pausa
    p.keyboard.press("p"); p.wait_for_timeout(300)
    check(estado(p, "RAM.Partida.pausado"), "P pausa")
    p.screenshot(path=str(SAIDA / "07-pausa.png"))
    p.keyboard.press("p"); p.wait_for_timeout(400)
    check(not estado(p, "RAM.Partida.pausado"), "P retoma")

    marco_visto = False
    for i in range(15):
        responder_certo(p)
        if i == 14:
            break
        p.keyboard.press("Enter")
        try:
            p.wait_for_selector("#ov-marco:not([hidden])", timeout=900)
            if not marco_visto:
                p.wait_for_timeout(900); p.screenshot(path=str(SAIDA / "08-marco.png")); marco_visto = True
            p.keyboard.press("Enter")
        except Exception:
            pass
        p.wait_for_function("RAM.Partida.jogo.estado.fase === 'pergunta' && !RAM.Partida.ocupado", timeout=8000)
        p.wait_for_timeout(100)
        if estado(p, "RAM.Partida.jogo.jogadorAtual().nivel") == 15:
            p.wait_for_timeout(600); p.screenshot(path=str(SAIDA / "09-pergunta-final.png"))
    check(marco_visto, "aparece aviso de nova faixa de valor")
    p.wait_for_selector("#ov-vitoria:not([hidden])", timeout=8000)
    p.wait_for_timeout(2500)
    p.screenshot(path=str(SAIDA / "10-vitoria.png"))
    p.keyboard.press("Enter")
    p.wait_for_function("RAM.Telas.atual === 'resultado'", timeout=8000)
    p.wait_for_timeout(2200)
    p.screenshot(path=str(SAIDA / "11-resultado-vitoria.png"))
    check("1.000.000" in p.inner_text("#res-premio"), "resultado mostra R$ 1.000.000")

    # ---------- jogar novamente: errar ----------
    p.click("#btn-res-novamente"); p.wait_for_timeout(900)
    for _ in range(4):
        responder_certo(p); continuar(p)
    c = estado(p, "RAM.Partida.jogo.estado.pergunta.correta")
    p.keyboard.press(str((c + 1) % 4 + 1)); p.keyboard.press("Enter")
    p.wait_for_function("RAM.Partida.jogo.estado.fase === 'revelada' && !RAM.Partida.ocupado", timeout=8000)
    p.wait_for_timeout(300)
    p.screenshot(path=str(SAIDA / "12-errou.png"))
    check(p.locator(".alt.errada").count() == 1 and p.locator(".alt.certa").count() == 1, "erro mostra a errada e a certa")
    check("leva" in p.inner_text("#painel-explica"), "erro mostra o valor conquistado")
    p.keyboard.press("Enter")
    p.wait_for_function("RAM.Telas.atual === 'resultado'", timeout=8000); p.wait_for_timeout(2000)
    check(p.inner_text("#res-premio").strip() == "R$ 2.500", "errou na 5ª leva metade de 5.000: " + p.inner_text("#res-premio"))
    p.screenshot(path=str(SAIDA / "13-resultado-erro.png"))

    # ---------- parar ----------
    p.keyboard.press("r"); p.wait_for_timeout(900)
    for _ in range(3):
        responder_certo(p); continuar(p)
    p.keyboard.press("s"); p.wait_for_timeout(400)
    p.screenshot(path=str(SAIDA / "14-confirmar-parar.png"))
    p.keyboard.press("Enter"); p.wait_for_timeout(600)
    p.keyboard.press("Enter")
    p.wait_for_function("RAM.Telas.atual === 'resultado'", timeout=8000); p.wait_for_timeout(2000)
    check(p.inner_text("#res-premio").strip() == "R$ 3.000", "parar leva o acumulado: " + p.inner_text("#res-premio"))

    # ---------- Esc volta ao menu ----------
    p.keyboard.press("Escape"); p.wait_for_timeout(500)
    check(estado(p, "RAM.Telas.atual") == "menu", "Esc no resultado volta ao menu")

    # ---------- configurações ----------
    p.click("#btn-menu-config"); p.wait_for_timeout(700)
    p.screenshot(path=str(SAIDA / "15-config.png"))
    p.click("#cfg-qtd button:has-text('8')")
    p.keyboard.press("Escape"); p.wait_for_timeout(500)
    check(p.locator("#escada-menu .degrau").count() == 8, "quantidade 8 muda a escada do menu")
    p.click("#btn-menu-ajuda"); p.wait_for_timeout(600)
    p.screenshot(path=str(SAIDA / "16-como-jogar.png"))
    p.keyboard.press("Escape"); p.wait_for_timeout(400)

    # ---------- modo grupo ----------
    p.click("#btn-menu-grupo"); p.wait_for_timeout(600)
    p.fill("#jogador-0", "Felipe"); p.fill("#jogador-1", "João")
    p.click("#btn-add-jogador"); p.fill("#jogador-2", "Ana")
    p.screenshot(path=str(SAIDA / "17-grupo.png"))
    p.click("#btn-grupo-comecar"); p.wait_for_timeout(1700)
    p.screenshot(path=str(SAIDA / "18-vez.png"))
    p.evaluate(ACELERAR)
    p.keyboard.press("Enter")
    p.wait_for_function("RAM.Partida.jogo.estado.fase === 'pergunta' && !RAM.Partida.ocupado", timeout=8000)
    nomes = []
    guard = 0
    while estado(p, "RAM.Telas.atual") == "jogo" and guard < 60:
        guard += 1
        nome = estado(p, "RAM.Partida.jogo.jogadorAtual().nome"); nomes.append(nome)
        nivel = estado(p, "RAM.Partida.jogo.jogadorAtual().nivel")
        if nome == "ANA" and nivel == 2:
            c = estado(p, "RAM.Partida.jogo.estado.pergunta.correta")
            p.keyboard.press(str((c + 1) % 4 + 1)); p.keyboard.press("Enter")
            p.wait_for_function("RAM.Partida.jogo.estado.fase === 'revelada' && !RAM.Partida.ocupado", timeout=8000)
        else:
            responder_certo(p)
        if len(nomes) == 4:
            p.wait_for_timeout(300); p.screenshot(path=str(SAIDA / "19-grupo-jogo.png"))
        if estado(p, "!document.getElementById('ov-vitoria').hidden"):
            p.keyboard.press("Enter"); p.wait_for_timeout(500)
            continue
        p.keyboard.press("Enter")
        for _ in range(3):
            p.wait_for_timeout(250)
            if estado(p, "RAM.UI.ovAberto() !== null"):
                p.keyboard.press("Enter")
        p.wait_for_function("RAM.Telas.atual !== 'jogo' || (RAM.Partida.jogo.estado.fase === 'pergunta' && !RAM.Partida.ocupado && RAM.UI.ovAberto() === null)", timeout=8000)
    check(nomes[:3] == ["FELIPE", "JOÃO", "ANA"], "grupo alterna jogadores: " + ",".join(nomes[:6]))
    p.wait_for_timeout(2000)
    p.screenshot(path=str(SAIDA / "20-grupo-resultado.png"))
    check(p.locator(".rank").count() == 3, "ranking do grupo com 3 participantes")

    check(not erros, "sem erros de JavaScript: " + "; ".join(erros[:3]))

    # ---------- outras resoluções ----------
    for (w, h, nome) in [(1366, 768, "1366"), (1440, 900, "1440")]:
        q = nav.new_page(viewport={"width": w, "height": h})
        q.goto(URL); q.wait_for_timeout(1200)
        q.screenshot(path=str(SAIDA / f"21-menu-{nome}.png"))
        q.click("#btn-comecar"); q.wait_for_timeout(1500)
        q.screenshot(path=str(SAIDA / f"22-jogo-{nome}.png"))
        sw = q.evaluate("document.documentElement.scrollWidth <= innerWidth")
        check(sw, f"sem rolagem horizontal em {nome}")
        q.close()
    for (w, h, nome) in [(390, 844, "celular"), (820, 1180, "tablet")]:
        q = nav.new_page(viewport={"width": w, "height": h}, has_touch=True, is_mobile=(nome == "celular"))
        q.goto(URL); q.wait_for_timeout(1200)
        q.screenshot(path=str(SAIDA / f"23-menu-{nome}.png"))
        q.evaluate("RAM.Configuracoes.set('modo','individual')")
        q.click("#btn-comecar"); q.wait_for_timeout(1600)
        q.screenshot(path=str(SAIDA / f"24-jogo-{nome}.png"))
        check(q.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"sem rolagem horizontal no {nome}")
        q.close()
    nav.close()

print("\n%d falha(s)" % len(falhas))
sys.exit(1 if falhas else 0)
